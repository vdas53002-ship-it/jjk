import os
import time
import psutil
from datetime import datetime, timedelta
from database import db
from utils.data import characters
from services.cache_service import cache_service


class AdminService:
    ROLES = {"OWNER": 4, "HEAD_ADMIN": 3, "MODERATOR": 2, "EVENT_MANAGER": 1, "PLAYER": 0}

    def __init__(self):
        self.admin_ids = [int(i.strip()) for i in os.getenv('ADMIN_IDS', '').split(',') if i.strip()]

    async def get_user_role(self, user_id):
        if not self.admin_ids:
            self.admin_ids = [int(i.strip()) for i in os.getenv('ADMIN_IDS', '').split(',') if i.strip()]

        if user_id in self.admin_ids:
            return self.ROLES["OWNER"]
        
        user = await db.users.find_one({"telegramId": user_id})
        if not user: return 0
        return user.get('adminRole', 0)

    def log_action(self, admin_id, command, target_id, result):
        log_dir = './logs'
        if not os.path.exists(log_dir): os.makedirs(log_dir)
        log_path = os.path.join(log_dir, 'admin.log')
        entry = f"[{datetime.utcnow().isoformat()}] Admin:{admin_id} | Cmd:{command} | Target:{target_id or 'N/A'} | Result:{result}\n"
        with open(log_path, 'a') as f:
            f.write(entry)

    async def ban_user(self, admin_id, user_id, duration='perm', reason='No reason'):
        if duration == 'perm':
            until = -1
        else:
            try:
                days = int(duration)
                until = int((datetime.utcnow() + timedelta(days=days)).timestamp() * 1000)
            except ValueError:
                until = -1

        await db.users.update({"telegramId": user_id}, {"$set": {"banned": True, "banUntil": until, "banReason": reason}})
        cache_service.invalidate(user_id)
        self.log_action(admin_id, f"ban:{duration}", user_id, "SUCCESS")

        return {"success": True, "msg": f"✅ User {user_id} banned for {duration}. Reason: {reason}"}

    async def unban_user(self, admin_id, user_id):
        await db.users.update({"telegramId": user_id}, {"$set": {"banned": False, "banUntil": None}})
        cache_service.invalidate(user_id)
        self.log_action(admin_id, 'unban', user_id, "SUCCESS")

        return {"success": True, "msg": f"✅ User {user_id} unbanned."}

    async def warn_user(self, admin_id, user_id, reason):
        user = await db.users.find_one({"telegramId": user_id})
        if not user: return {"success": False, "msg": "User not found."}
        warnings = user.get('warnings', 0) + 1
        await db.users.update({"telegramId": user_id}, {"$set": {"warnings": warnings}})
        cache_service.invalidate(user_id)
        self.log_action(admin_id, 'warn', user_id, f"WARNINGS:{warnings}")

        return {"success": True, "msg": f"✅ Warning issued to {user_id} ({warnings}/3). Reason: {reason}"}

    async def reset_account(self, admin_id, user_id):
        reset_data = {
            "coins": 0, "dust": 0, "gems": 0, "gachaTickets": 0,
            "stamina": 100, "playerLevel": 1, "playerXp": 0,
            "elo": 1000, "rank": "Iron", "battles": 0, "battlesWon": 0,
            "dailyExploreCount": 0, "activeExplore": None,
            "banned": False, "warnings": 0, "title": "Wandering Soul",
            "school": None, "team": [], "activeTeam": None,
        }
        await db.users.update({"telegramId": user_id}, {"$set": reset_data})
        cache_service.invalidate(user_id)

        await db.roster.remove({"userId": user_id}, multi=True)

        self.log_action(admin_id, 'reset_account', user_id, "SUCCESS")
        return {"success": True, "msg": f"✅ User {user_id} account fully reset."}

    async def add_currency(self, admin_id, user_id, currency_type, amount):
        user = await db.users.find_one({"telegramId": user_id})
        if not user: return {"success": False, "msg": "User not found."}
        await db.users.update({"telegramId": user_id}, {"$inc": {currency_type: amount}})
        cache_service.invalidate(user_id)
        self.log_action(admin_id, f"add_{currency_type}", user_id, f"AMT:{amount}")

        return {"success": True, "msg": f"✅ Modified {currency_type} by {amount} for {user_id}."}

    async def give_item(self, admin_id, user_id, item_id, qty):
        user = await db.users.find_one({"telegramId": user_id})
        if not user: return {"success": False, "msg": "User not found."}
        
        inv = user.get('inventory', [])
        idx = next((i for i, x in enumerate(inv) if x['id'] == item_id), -1)
        if idx != -1:
            inv[idx]['qty'] += qty
        else:
            inv.append({"id": item_id, "qty": qty})
        
        update_data = {"inventory": inv}
        if item_id == 'gacha_ticket':
            update_data["gachaTickets"] = user.get('gachaTickets', 0) + qty
        elif item_id == 'gacha_pack':
            update_data["gachaTickets"] = user.get('gachaTickets', 0) + (qty * 10)

        await db.users.update({"telegramId": user_id}, {"$set": update_data})

        cache_service.invalidate(user_id)
        self.log_action(admin_id, 'give_item', user_id, f"ITEM:{item_id} QTY:{qty}")

        return {"success": True, "msg": f"✅ Granted {qty}x {item_id} to {user_id}."}

    async def grant_character(self, admin_id, user_id, requested_name, level=1):
        data = characters.DATA
        char_id = None
        
        # Resolve Name
        requested_name_lower = requested_name.lower().replace('_', ' ')
        for k in data.keys():
            if k.lower() == requested_name_lower:
                char_id = k
                break
        
        if not char_id:
            for k, v in data.items():
                if requested_name_lower in k.lower():
                    char_id = k
                    break
        
        if not char_id:
            return {"success": False, "msg": f"❌ Character \"{requested_name}\" not found."}

        char_data = data[char_id]
        await db.roster.insert({
            "userId": user_id,
            "charId": char_id,
            "level": int(level),
            "xp": 0,
            "rarity": char_data['rarity'],
            "upgrades": {},
            "lastUpdated": datetime.utcnow()
        })

        self.log_action(admin_id, 'give_char', user_id, f"CHAR:{char_id} LV:{level}")
        return {"success": True, "msg": f"✅ Granted <b>{char_id}</b> Lv.{level} to user {user_id}."}

    async def list_active_battles(self):
        return await db.battles.find({"status": 'active'})

    async def cancel_battle(self, admin_id, battle_id):
        await db.battles.update({"_id": battle_id}, {"$set": {"status": 'cancelled'}})
        self.log_action(admin_id, 'cancel_battle', None, f"BATTLE:{battle_id}")
        return {"success": True, "msg": f"✅ Battle {battle_id} cancelled."}

    async def get_system_stats(self):
        user_count = await db.users.count({})
        active_battles = await db.battles.count({"status": 'active'})
        clan_count = await db.clans.count({})
        
        process = psutil.Process(os.getpid())
        mem = process.memory_info().rss / 1024 / 1024
        
        return {
            "users": user_count,
            "activeBattles": active_battles,
            "clans": clan_count,
            "uptime": int(time.time() - process.create_time()),
            "memory": f"{int(mem)}MB"
        }

    async def execute_season_reset(self, admin_id):
        users = await db.users.find({})
        for user in users:
            new_elo = max(1000, 1000 + int((user.get('elo', 1000) - 1000) * 0.5))
            await db.users.update({"_id": user['_id']}, {
                "$set": {
                    "elo": new_elo,
                    "rank": 'Iron',
                    "dust": user.get('dust', 0) + 50
                }
            })
        self.log_action(admin_id, 'season_reset', 'ALL', "SUCCESS")
        return {"success": True, "msg": f"🌪 Season Reset complete for {len(users)} sorcerers."}

admin_service = AdminService()
