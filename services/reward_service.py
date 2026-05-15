from datetime import datetime, timedelta
from database import db
from services.achievement_service import achievement_service

class RewardService:
    async def _add_items_to_inventory(self, user, items):
        inv = user.get('inventory', [])
        for itm in items:
            idx = next((i for i, x in enumerate(inv) if x['id'] == itm['id']), -1)
            if idx > -1: inv[idx]['qty'] += itm['qty']
            else: inv.append(itm)
        return inv

    async def claim_daily(self, user_id):
        user = await db.users.find_one({"telegramId": user_id})
        if not user: return {"success": False, "msg": "❌ Register first!"}

        now = datetime.utcnow()
        today = now.strftime('%Y-%m-%d')

        if user.get('lastDailyClaim') == today:
            return {"success": False, "msg": "⏳ Already claimed today!"}

        # Rewards from note
        coins = 150 # 100 golds + 50 coins
        shards = 10
        items = [
            {"id": "gacha_ticket", "qty": 1},
            {"id": "energy_drink", "qty": 1},
            {"id": "minor_hp_potion", "qty": 5}
        ]

        inv = await self._add_items_to_inventory(user, items)
        
        updates = {
            "$inc": {"coins": coins, "shardsCurrency": shards, "gachaTickets": 1},
            "$set": {"lastDailyClaim": today, "inventory": inv}
        }
        await db.users.update({"telegramId": user_id}, updates)

        reward_text = f"🎫 1 Gacha Ticket\n🥤 1 Energy Drink\n🧪 5 Healing Potions\n💰 150 Coins\n💎 10 Shards"
        return {"success": True, "msg": f"📅 <b>DAILY REWARDS</b>\n\n{reward_text}"}

    async def claim_weekly(self, user_id):
        user = await db.users.find_one({"telegramId": user_id})
        if not user: return {"success": False, "msg": "❌ Register first!"}

        now = datetime.utcnow()
        # ISO week number
        current_week = f"{now.year}-W{now.isocalendar()[1]}"

        if user.get('lastWeeklyClaim') == current_week:
            return {"success": False, "msg": "⏳ Already claimed this week!"}

        coins = 1500 # 1000 golds + 500 coins
        shards = 100
        items = [
            {"id": "gacha_ticket", "qty": 10},
            {"id": "energy_drink", "qty": 5},
            {"id": "minor_hp_potion", "qty": 10}
        ]

        inv = await self._add_items_to_inventory(user, items)
        
        updates = {
            "$inc": {"coins": coins, "shardsCurrency": shards, "gachaTickets": 10},
            "$set": {"lastWeeklyClaim": current_week, "inventory": inv}
        }
        await db.users.update({"telegramId": user_id}, updates)

        reward_text = f"🎫 10 Gacha Tickets\n🥤 5 Energy Drinks\n🧪 10 Healing Potions\n💰 1500 Coins\n💎 100 Shards"
        return {"success": True, "msg": f"🗓 <b>WEEKLY REWARDS</b>\n\n{reward_text}"}

    async def claim_monthly(self, user_id):
        user = await db.users.find_one({"telegramId": user_id})
        if not user: return {"success": False, "msg": "❌ Register first!"}

        now = datetime.utcnow()
        current_month = f"{now.year}-{now.month}"

        if user.get('lastMonthlyClaim') == current_month:
            return {"success": False, "msg": "⏳ Already claimed this month!"}

        coins = 15000 # 10000 golds + 5000 coins
        shards = 1000
        items = [
            {"id": "gacha_ticket", "qty": 50},
            {"id": "energy_drink", "qty": 20},
            {"id": "minor_hp_potion", "qty": 50}
        ]

        inv = await self._add_items_to_inventory(user, items)
        
        updates = {
            "$inc": {"coins": coins, "shardsCurrency": shards, "gachaTickets": 50},
            "$set": {"lastMonthlyClaim": current_month, "inventory": inv}
        }
        await db.users.update({"telegramId": user_id}, updates)

        reward_text = f"🎫 50 Gacha Tickets\n🥤 20 Energy Drinks\n🧪 50 Healing Potions\n💰 15000 Coins\n💎 1000 Shards"
        return {"success": True, "msg": f"🌕 <b>MONTHLY REWARDS</b>\n\n{reward_text}"}

reward_service = RewardService()

