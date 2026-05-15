import time
import asyncio
from database import db

class MatchmakingService:
    def __init__(self):
        self.queue = []
        self.on_match_found = None
        self.on_match_timeout = None

    async def calculate_tps(self, user):
        roster = await db.roster.find({"userId": user['telegramId']})
        tps = 0
        weights = {"Common": 1, "Rare": 2, "Epic": 3, "Legendary": 4, "Mythic": 5}
        
        team_ids = user.get('teamIds', [])
        for char_id in team_ids:
            if not char_id: continue
            entry = next((r for r in roster if r['charId'] == char_id), None)
            if entry:
                weight = weights.get(entry.get('rarity', 'Common'), 1)
                upgrades_count = len(entry.get('upgrades', {}))
                tps += (weight * entry.get('level', 1)) + (upgrades_count * 10)
        return tps

    async def join_queue(self, user, is_casual=False):
        now = int(time.time() * 1000)
        last_action = user.get('lastQueueJoin', 0)
        
        if now - last_action < 10000:
            wait = int((10000 - (now - last_action)) / 1000)
            return {"error": f"⏳ Please wait {wait}s before queuing again."}

        team_ids = user.get('teamIds', [])
        if len([tid for tid in team_ids if tid]) < 3:
            return {"error": "❌ Your team must have 3 characters. Use /myscorer to set your lineup."}

        self.leave_queue(user['telegramId'])
        tps = await self.calculate_tps(user)
        
        entry = {
            "userId": user['telegramId'],
            "username": user.get('username', 'Sorcerer'),
            "elo": user.get('elo', 1000),
            "tps": tps,
            "isCasual": is_casual,
            "timestamp": now
        }

        await db.users.update({"telegramId": user['telegramId']}, {"$set": {"lastQueueJoin": now}})
        self.queue.append(entry)
        return {"success": True, "tps": tps}

    def leave_queue(self, user_id):
        self.queue = [q for q in self.queue if q['userId'] != user_id]

    async def process_queue(self):
        while True:
            await asyncio.sleep(3)
            now = int(time.time() * 1000)
            
            # Timeouts (60s)
            active = [q for q in self.queue if (now - q['timestamp']) < 60000]
            timed_out = [q for q in self.queue if (now - q['timestamp']) >= 60000]
            
            for q in timed_out:
                self.leave_queue(q['userId'])
                if self.on_match_timeout:
                    await self.on_match_timeout(q['userId'])

            self.queue = active
            matched_ids = set()

            for i in range(len(self.queue)):
                p1 = self.queue[i]
                if p1['userId'] in matched_ids: continue

                for j in range(i + 1, len(self.queue)):
                    p2 = self.queue[j]
                    if p2['userId'] in matched_ids: continue
                    if p1['isCasual'] != p2['isCasual']: continue

                    is_match = False
                    if p1['isCasual']:
                        is_match = abs(p1['tps'] - p2['tps']) <= 200
                    else:
                        is_match = abs(p1['elo'] - p2['elo']) <= 100

                    if is_match:
                        matched_ids.add(p1['userId'])
                        matched_ids.add(p2['userId'])
                        
                        if self.on_match_found:
                            mode = 'casual' if p1['isCasual'] else 'ranked'
                            # In Python, we might need a reference to the bot or dispatcher
                            asyncio.create_task(self.on_match_found(p1, p2, mode))
                        
                        break
            
            # Clean up matched players
            self.queue = [q for q in self.queue if q['userId'] not in matched_ids]

matchmaking_service = MatchmakingService()
