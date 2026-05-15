import time
from datetime import datetime, timedelta
from database import db
from utils.data.items import ITEMS

class ShopService:
    async def refresh_shop_if_needed(self, user):
        now_ms = int(time.time() * 1000)
        
        # Start of today (UTC)
        now_date = datetime.utcnow()
        start_of_day = datetime(now_date.year, now_date.month, now_date.day)
        start_of_day_ms = int(start_of_day.timestamp() * 1000)
        
        # Start of week (Monday)
        days_to_monday = now_date.weekday() # 0 is Monday
        start_of_week = start_of_day - timedelta(days=days_to_monday)
        start_of_week_ms = int(start_of_week.timestamp() * 1000)

        shop_state = user.get('shopState', {
            'daily': {'last': 0, 'stock': {}},
            'weekly': {'last': 0, 'stock': {}}
        })

        updated = False

        # Daily Refresh
        if shop_state.get('daily', {}).get('last', 0) < start_of_day_ms:
            shop_state['daily'] = {'last': now_ms, 'stock': {}}
            for item_id, item in ITEMS.items():
                if item.get('shop', {}).get('category') == 'daily':
                    shop_state['daily']['stock'][item_id] = item['shop']['stock']
            updated = True

        # Weekly Refresh
        if shop_state.get('weekly', {}).get('last', 0) < start_of_week_ms:
            shop_state['weekly'] = {'last': now_ms, 'stock': {}}
            for item_id, item in ITEMS.items():
                if item.get('shop', {}).get('category') == 'weekly':
                    shop_state['weekly']['stock'][item_id] = item['shop']['stock']
            updated = True

        if updated:
            user['shopState'] = shop_state
            await db.users.update({"telegramId": user['telegramId']}, {"$set": {"shopState": shop_state}})
        
        return shop_state

    async def buy_item(self, user_id, item_id):
        user = await db.users.find_one({"telegramId": user_id})
        item = ITEMS.get(item_id)

        if not user or not item:
            return {"success": False, "msg": "Transaction Error: Data Mismatch."}
        
        await self.refresh_shop_if_needed(user)
        category = item.get('shop', {}).get('category', 'special')
        
        # 1. Stock Check
        if category != 'special':
            current_stock = user['shopState'].get(category, {}).get('stock', {}).get(item_id, 0)
            if current_stock <= 0:
                return {"success": False, "msg": "❌ This item is sold out! Check back after refresh."}

        # 2. Currency Check
        total_cost = item['price']
        currency = item.get('currency', 'coins')
        if user.get(currency, 0) < total_cost:
            return {"success": False, "msg": f"❌ Not enough {currency}! You need {total_cost - user.get(currency, 0)} more."}

        # 3. Deduction
        user[currency] -= total_cost
        if category != 'special':
            user['shopState'][category]['stock'][item_id] -= 1

        # 4. Inventory Addition
        inventory = user.get('inventory', [])
        found = False
        for inv_item in inventory:
            if inv_item['id'] == item_id:
                inv_item['qty'] += 1
                found = True
                break
        
        if not found:
            inventory.append({"id": item_id, "qty": 1})
        
        user['inventory'] = inventory

        # Special Field Updates
        if item_id == 'gacha_ticket':
            user['gachaTickets'] = user.get('gachaTickets', 0) + 1
        elif item_id == 'gacha_pack':
            user['gachaTickets'] = user.get('gachaTickets', 0) + 10

        # Save to DB
        await db.users.update({"telegramId": user_id}, {"$set": {
            currency: user[currency],
            "shopState": user['shopState'],
            "inventory": user['inventory'],
            "gachaTickets": user.get('gachaTickets', 0)
        }})

        return {
            "success": True,
            "item": item,
            "qty": 1,
            "totalCost": total_cost,
            "currency": currency,
            "msg": f"✅ Successfully purchased 1x {item['name']}!"
        }

shop_service = ShopService()
