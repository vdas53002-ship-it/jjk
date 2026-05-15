from database import db

class SocialService:
    async def list_online_battles(self):
        return await db.battles.find({"status": 'active'})

    async def add_spectator(self, battle_id, user_id):
        battle = await db.battles.find_one({"_id": battle_id})
        if not battle: return {"success": False, "msg": "Battle no longer active."}
        
        spectators = battle.get('spectators', [])
        if user_id not in spectators:
            await db.battles.update({"_id": battle_id}, {"$push": {"spectators": user_id}})
        
        return {"success": True, "battle": battle}

    async def cheer_player(self, battle_id, user_id, target_player_id):
        battle = await db.battles.find_one({"_id": battle_id})
        if not battle: return {"success": False, "msg": "Battle concluded."}
        
        cheered = battle.get('cheered', [])
        if user_id in cheered:
            return {"success": False, "msg": "You have already cheered in this match!"}

        cheers = battle.get('cheers', {})
        current_cheer = cheers.get(str(target_player_id), 0)
        
        await db.battles.update({"_id": battle_id}, { 
            "$set": {f"cheers.{target_player_id}": current_cheer + 0.05},
            "$push": {"cheered": user_id}
        })
        return {"success": True, "msg": "📣 You cheer loudly! +5% Crit Power for your ally!"}

    async def gift_item(self, from_user_id, to_username, item_id, qty):
        from_user = await db.users.find_one({"telegramId": from_user_id})
        to_user = await db.users.find_one({"$or": [{"username": to_username}, {"username": to_username.replace('@', '')}]})
        
        if not to_user: return {"success": False, "msg": "Target sorcerer not found."}
        if from_user['telegramId'] == to_user['telegramId']: return {"success": False, "msg": "You cannot gift to yourself!"}

        from utils.data import characters
        inv = from_user.get('inventory', [])
        shards = from_user.get('shards', {})
        
        # Resolve character ID if it's a character card
        resolved_char_id = item_id
        if item_id not in characters.DATA:
            ALIASES = getattr(characters, 'ALIASES', {})
            # Try alias
            if item_id in ALIASES:
                resolved_char_id = ALIASES[item_id]
            else:
                # Try partial match
                for name in characters.DATA:
                    if item_id.lower() == name.lower() or item_id.lower() in name.lower():
                        resolved_char_id = name
                        break
        
        is_char_card = resolved_char_id in characters.DATA
        effective_item_id = resolved_char_id if is_char_card else item_id

        if is_char_card:
            if shards.get(effective_item_id, 0) < qty:
                return {"success": False, "msg": f"Insufficient {effective_item_id} cards in your collection."}
            shards[effective_item_id] -= qty
            await db.users.update({"telegramId": from_user['telegramId']}, {"$set": {"shards": shards}})
        else:
            item_idx = next((i for i, x in enumerate(inv) if x['id'] == item_id and x['qty'] >= qty), -1)
            if item_idx == -1: return {"success": False, "msg": "Insufficient item quantity in your bag."}
            inv[item_idx]['qty'] -= qty
            updated_from_inv = [i for i in inv if i['qty'] > 0]
            await db.users.update({"telegramId": from_user['telegramId']}, {"$set": {"inventory": updated_from_inv}})
        
        # Add to receiver
        if is_char_card:
            to_shards = to_user.get('shards', {})
            to_shards[effective_item_id] = to_shards.get(effective_item_id, 0) + qty
            await db.users.update({"telegramId": to_user['telegramId']}, {"$set": {"shards": to_shards}})
            return {"success": True, "msg": f"🎁 Successfully sent {qty}x {effective_item_id} cards to @{to_user['username']}!"}
        else:
            to_inv = to_user.get('inventory', [])
            existing_idx = next((i for i, x in enumerate(to_inv) if x['id'] == item_id), -1)
            if existing_idx != -1:
                to_inv[existing_idx]['qty'] += qty
            else:
                to_inv.append({"id": item_id, "qty": qty})
            await db.users.update({"telegramId": to_user['telegramId']}, {"$set": {"inventory": to_inv}})
            return {"success": True, "msg": f"🎁 Successfully sent {qty}x {item_id} to @{to_user['username']}!"}

social_service = SocialService()
