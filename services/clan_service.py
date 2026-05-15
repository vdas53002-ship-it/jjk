from datetime import datetime
from database import db

class ClanService:
    async def create_clan(self, user_id, name, tag):
        user = await db.users.find_one({"telegramId": user_id})
        
        if not user: return {"success": False, "msg": "User not found."}
        if user.get('playerLevel', 1) < 20: return {"success": False, "msg": "Creation requires Player Level 20."}
        if user.get('clanId'): return {"success": False, "msg": "You are already in a clan."}
        if not user.get('school'): return {"success": False, "msg": "You must choose an academy (/school) first."}
        if user.get('coins', 0) < 5000: return {"success": False, "msg": "Insufficient Coins (5,000 required)."}

        new_clan = {
            "name": name,
            "tag": tag.upper(),
            "leaderId": user_id,
            "school": user['school'],
            "slots": 25,
            "members": [user_id],
            "elders": [],
            "treasury": {"dust": 0},
            "createdAt": datetime.utcnow(),
            "totalElo": user.get('elo', 1000)
        }

        result = await db.clans.insert(new_clan)
        clan_id = result['_id']
        
        await db.users.update({"telegramId": user_id}, {
            "$inc": {"coins": -5000},
            "$set": {"clanId": clan_id, "clanRole": 'Leader'}
        })

        return {"success": True, "msg": f"Clan [{tag}] {name} established!", "clan": result}

    async def join_clan(self, user_id, clan_id):
        user = await db.users.find_one({"telegramId": user_id})
        clan = await db.clans.find_one({"_id": clan_id})

        if not user or not clan: return {"success": False, "msg": "Joining Error: Clan not found."}
        if not user.get('school'): return {"success": False, "msg": "You must choose an academy (/school) before joining a clan."}
        if user['school'] != clan['school']: return {"success": False, "msg": f"❌ This clan belongs to {clan['school']} High. You are in {user['school']} High!"}
        if user.get('playerLevel', 1) < 15: return {"success": False, "msg": "Joining requires Player Level 15."}
        if user.get('clanId'): return {"success": False, "msg": "You are already in a clan."}
        
        capacity = clan.get('slots', 25)
        if len(clan['members']) >= capacity: return {"success": False, "msg": f"Clan is at maximum capacity ({len(clan['members'])}/{capacity})."}

        members = clan['members']
        members.append(user_id)
        total_elo = clan.get('totalElo', 0) + user.get('elo', 1000)

        await db.clans.update({"_id": clan_id}, {"$set": {"members": members, "totalElo": total_elo}})
        await db.users.update({"telegramId": user_id}, {"$set": {"clanId": clan_id, "clanRole": 'Member'}})

        return {"success": True, "msg": f"Welcome to {clan['name']}, sorcerer!", "clan": clan}

    async def leave_clan(self, user_id):
        user = await db.users.find_one({"telegramId": user_id})
        if not user or not user.get('clanId'): return {"success": False, "msg": "You are not in a clan."}

        clan = await db.clans.find_one({"_id": user['clanId']})
        if clan['leaderId'] == user_id: return {"success": False, "msg": "Leaders cannot leave. You must disband or promote a new leader first."}

        members = [m for m in clan['members'] if m != user_id]
        elders = [e for e in clan.get('elders', []) if e != user_id]
        total_elo = clan.get('totalElo', 0) - user.get('elo', 1000)

        await db.clans.update({"_id": clan['_id']}, {"$set": {"members": members, "elders": elders, "totalElo": total_elo}})
        await db.users.update({"telegramId": user_id}, {"$set": {"clanId": None, "clanRole": None}})

        return {"success": True, "msg": "You have left the clan."}

    async def expand_clan(self, user_id):
        user = await db.users.find_one({"telegramId": user_id})
        if not user.get('clanId') or user.get('clanRole') != 'Leader':
            return {"success": False, "msg": "Only the leader can expand the syndicate."}
        
        if user.get('coins', 0) < 5000: return {"success": False, "msg": "Insufficient Coins (5,000 required)."}
        
        clan = await db.clans.find_one({"_id": user['clanId']})
        current_slots = clan.get('slots', 25)
        if current_slots >= 50: return {"success": False, "msg": "Syndicate has reached maximum capacity (50)."}

        await db.clans.update({"_id": clan['_id']}, {"$inc": {"slots": 5}})
        await db.users.update({"telegramId": user_id}, {"$inc": {"coins": -5000}})

        return {"success": True, "msg": f"Syndicate expanded! Capacity now: {current_slots + 5}."}

clan_service = ClanService()
