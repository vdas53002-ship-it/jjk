import random
from datetime import datetime
from database import db
from utils.data import quests

class QuestService:
    async def sync_quests(self, user_id):
        today = datetime.utcnow().strftime('%Y-%m-%d')
        
        # Check if quests already exist for today
        existing = await db.quests.find({"userId": user_id, "date": today})
        if len(existing) >= 3:
            return existing

        # Otherwise generate 3 new ones
        all_quests = list(quests.DATA.values())
        selected = []
        pool = list(all_quests)

        while len(selected) < 3 and pool:
            idx = random.randint(0, len(pool) - 1)
            quest = pool.pop(idx)
            
            # Weight check
            roll = random.random()
            weights = {"Common": 1.0, "Rare": 0.2, "Legendary": 0.05}
            if roll > weights.get(quest['rarity'], 1.0):
                if len(pool) > 3:
                    continue

            new_quest = {
                "userId": user_id,
                "questId": quest['id'],
                "date": today,
                "progress": 0,
                "target": quest['target'],
                "completed": False,
                "claimed": False
            }
            
            await db.quests.insert(new_quest)
            selected.append(new_quest)

        return selected

    async def update_progress(self, user_id, action_type, value=1):
        today = datetime.utcnow().strftime('%Y-%m-%d')
        active_quests = await db.quests.find({"userId": user_id, "date": today, "completed": False})

        for user_quest in active_quests:
            meta = quests.DATA.get(user_quest['questId'])
            if meta and meta['action'] == action_type:
                new_progress = user_quest['progress'] + value
                is_completed = new_progress >= user_quest['target']
                
                await db.quests.update({"_id": user_quest['_id']}, {
                    "$set": {
                        "progress": user_quest['target'] if is_completed else new_progress,
                        "completed": is_completed
                    }
                })

    async def claim_quest(self, user_id, quest_id):
        today = datetime.utcnow().strftime('%Y-%m-%d')
        user_quest = await db.quests.find_one({"userId": user_id, "questId": int(quest_id), "date": today})

        if not user_quest or not user_quest.get('completed') or user_quest.get('claimed'):
            return {"success": False, "message": "Quest not claimable."}

        meta = quests.DATA.get(user_quest['questId'])
        user = await db.users.find_one({"telegramId": user_id})

        await db.quests.update({"_id": user_quest['_id']}, {"$set": {"claimed": True}})

        inc_ops = {"coins": meta['reward'].get('coins', 0), "playerXp": meta['reward'].get('xp', 0)}
        set_ops = {}

        if meta['reward'].get('items'):
            inv = user.get('inventory', [])
            for item in meta['reward']['items']:
                idx = next((i for i, x in enumerate(inv) if x['id'] == item['id']), -1)
                if idx > -1:
                    inv[idx]['qty'] += item['qty']
                else:
                    inv.append(item)
            set_ops['inventory'] = inv

        await db.users.update({"telegramId": user_id}, {"$inc": inc_ops, "$set": set_ops})

        return {"success": True, "reward": meta['reward']}

    async def claim_all(self, user_id):
        today = datetime.utcnow().strftime('%Y-%m-%d')
        completions = await db.quests.find({"userId": user_id, "date": today, "completed": True, "claimed": False})

        if not completions:
            return {"success": False, "message": "No rewards to claim."}

        total_coins = 0
        total_xp = 0
        total_items = []

        for uq in completions:
            meta = quests.DATA.get(uq['questId'])
            total_coins += meta['reward'].get('coins', 0)
            total_xp += meta['reward'].get('xp', 0)
            if meta['reward'].get('items'):
                total_items.extend(meta['reward']['items'])
            
            await db.quests.update({"_id": uq['_id']}, {"$set": {"claimed": True}})

        user = await db.users.find_one({"telegramId": user_id})
        inv = user.get('inventory', [])
        for item in total_items:
            idx = next((i for i, x in enumerate(inv) if x['id'] == item['id']), -1)
            if idx > -1:
                inv[idx]['qty'] += item['qty']
            else:
                inv.append(item)

        await db.users.update({"telegramId": user_id}, {
            "$inc": {"coins": total_coins, "playerXp": total_xp},
            "$set": {"inventory": inv}
        })

        return {"success": True, "coins": total_coins, "xp": total_xp, "items": total_items}

    def get_time_until_reset(self):
        from datetime import timedelta
        now = datetime.utcnow()
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        diff = tomorrow - now
        hours, remainder = divmod(diff.seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        return f"{hours}h {minutes}m"

quest_service = QuestService()
