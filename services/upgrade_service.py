from database import db
from utils.data import items
from utils.data.characters import DATA as CHAR_DATA

class UpgradeService:
    async def apply_item_upgrade(self, user_id, roster_id, item_id):
        char = await db.roster.find_one({"_id": roster_id, "userId": user_id})
        user = await db.users.find_one({"telegramId": user_id})
        item = items.DATA.get(item_id)

        if not char or not user or not item:
            return {"success": False, "msg": "Data mismatch error."}

        upgrades = char.get('upgrades', {})
        total_upg = sum(upgrades.values())
        if total_upg >= 6:
            return {"success": False, "msg": "This character has reached the maximum of 6 upgrade slots."}

        current_count = upgrades.get(item_id, 0)

        # Item Specific Validation
        if item_id == 'minor_hp_potion':
            return {"success": False, "msg": "Healing potions cannot be used as permanent upgrades."}
        elif item_id == 'hp_amulet':
            if current_count >= 3: return {"success": False, "msg": "Maximum 3 HP Amulets allowed."}
        elif item_id == 'ce_crystal':
            if current_count >= 3: return {"success": False, "msg": "Maximum 3 CE Crystals allowed."}
        elif item_id == 'black_flash_manual':
            if current_count >= 2: return {"success": False, "msg": "Maximum 2 Black Flash Manuals allowed."}
        elif item_id in ['speed_boots', 'technique_scroll', 'domain_fragment']:
            if current_count >= 1: return {"success": False, "msg": "This upgrade can only be applied once."}
        elif item_id in ['katana', 'nails', 'cloud', 'spear']:
            if current_count >= 1: return {"success": False, "msg": "A sorcerer can only equip one of this specific Cursed Tool."}
            # Optional: Limit to 2 weapons total
            weapon_count = sum(1 for k in upgrades if k in ['katana', 'nails', 'cloud', 'spear'])
            if weapon_count >= 2: return {"success": False, "msg": "Maximum 2 Cursed Tools allowed per character."}
        elif item_id == 'scroll':
            if current_count >= 1: return {"success": False, "msg": "The Six Eyes knowledge can only be absorbed once."}
        elif item_id == 'finger':
            if current_count >= 5: return {"success": False, "msg": "Maximum 5 Sukuna Fingers can be consumed safely."}
        elif item_id == 'reset_orb':
            pass # Reset orb ignores the 6 slot limit, it clears them.

        # Inventory Check
        inv = user.get('inventory', [])
        idx = next((i for i, x in enumerate(inv) if x['id'] == item_id), -1)
        if idx == -1 or inv[idx]['qty'] <= 0:
            return {"success": False, "msg": f"You do not own any {item['name']}s."}

        # Apply Effect
        update_roster = {}
        report = ""

        if item_id == 'reset_orb':
            update_roster['upgrades'] = {}
            # We don't reset base stats right now, just the slots to allow new upgrades.
            # Ideally we'd remove the stat bonuses, but for simplicity we'll just clear the slots.
            # A full stat recalculation would be needed if base stats were mutated.
            report = "All upgrade slots have been cleared! Stats from previous items remain permanently fused."
        else:
            upgrades[item_id] = current_count + 1
            update_roster['upgrades'] = upgrades

            if item_id == 'hp_amulet':
                report = "HP increased by 15."
            elif item_id == 'ce_crystal':
                report = "Cursed Energy increased by 10."
            elif item_id == 'black_flash_manual':
                update_roster['bonusCrit'] = char.get('bonusCrit', 0) + 5
                report = "Critical Hit chance increased by +5%."
            elif item_id == 'speed_boots':
                update_roster['initiativeBonus'] = char.get('initiativeBonus', 0) + 5
                report = "Initiative bonus increased by +5%."
            elif item_id == 'technique_scroll':
                update_roster['hasUnlockedMove'] = True
                report = "New technique unlocked!"
            elif item_id == 'domain_fragment':
                update_roster['hasDomain'] = True
                report = "Domain Expansion manifested!"
            elif item_id == 'katana':
                update_roster['atk'] = char.get('atk', CHAR_DATA.get(char['charId'], {}).get('atk', 100)) + 50
                update_roster['bonusCrit'] = char.get('bonusCrit', 0) + 5
                report = "Equipped Split Soul Katana: +50 STR, +5% Crit."
            elif item_id == 'nails':
                update_roster['bonusCrit'] = char.get('bonusCrit', 0) + 15
                report = "Equipped Resonance Nails: +15% Crit."
            elif item_id == 'cloud':
                update_roster['atk'] = char.get('atk', CHAR_DATA.get(char['charId'], {}).get('atk', 100)) + 100
                report = "Equipped Playful Cloud: +100 STR."
            elif item_id == 'spear':
                update_roster['atk'] = char.get('atk', CHAR_DATA.get(char['charId'], {}).get('atk', 100)) + 50
                update_roster['initiativeBonus'] = char.get('initiativeBonus', 0) + 10
                report = "Equipped Inverted Spear: +50 STR, +10% Initiative."
            elif item_id == 'scroll':
                update_roster['biq'] = char.get('biq', 10) + 20
                update_roster['technique'] = char.get('technique', 10) + 20
                report = "Absorbed Six Eyes Scroll: +20 BIQ, +20 Technique."
            elif item_id == 'finger':
                update_roster['atk'] = char.get('atk', CHAR_DATA.get(char['charId'], {}).get('atk', 100)) + 150
                update_roster['hp'] = char.get('hp', CHAR_DATA.get(char['charId'], {}).get('hp', 100)) + 300
                update_roster['maxHp'] = char.get('maxHp', CHAR_DATA.get(char['charId'], {}).get('hp', 100)) + 300
                report = "Consumed Sukuna Finger: +150 STR, +300 HP. A dark aura surrounds you..."

        # Deduct and Save
        inv[idx]['qty'] -= 1
        await db.users.update({"telegramId": user_id}, {"$set": {"inventory": inv}})
        await db.roster.update({"_id": roster_id}, {"$set": update_roster})

        return {"success": True, "msg": f"✅ Upgrade Successful! {report}", "char": char}

    GRADE_LEVEL_CAPS = {
        "Grade 4": 25,
        "Grade 3": 45,
        "Grade 2": 65,
        "Grade 1": 85,
        "Special": 100,
        "Special Grade": 100
    }

    async def level_up_character(self, user_id, roster_id):
        char = await db.roster.find_one({"_id": roster_id, "userId": user_id})
        user = await db.users.find_one({"telegramId": user_id})

        if not char or not user:
            return {"success": False, "msg": "Data mismatch error."}

        grade = char.get('grade', 'Grade 4')
        level = char.get('level', 1)
        cap = self.GRADE_LEVEL_CAPS.get(grade, 25)

        if level >= cap:
            return {
                "success": False, 
                "msg": f"❌ <b>Level Cap Reached!</b>\n\n{char['charId']} is capped at Level {cap} as a {grade} sorcerer. Promote their Grade to unlock higher levels."
            }

        RARITY_COSTS = {
            "Common": 1.0,
            "Rare": 1.8,
            "Epic": 3.0,
            "Legendary": 6.0,
            "Mythic": 12.0
        }

        rarity = char.get('rarity') or CHAR_DATA.get(char['charId'], {}).get('rarity', 'Common')
        mult = RARITY_COSTS.get(rarity, 1.0)
        
        dust_cost = int((10 + (level * 5)) * mult)
        coin_cost = int((100 + (level * 50)) * mult)

        if user.get('dust', 0) < dust_cost:
            return {"success": False, "msg": f"❌ Not enough Dust! {rarity} upgrade needs {dust_cost}."}
        if user.get('coins', 0) < coin_cost:
            return {"success": False, "msg": f"❌ Not enough Coins! {rarity} upgrade needs {coin_cost}."}

        new_level = level + 1
        
        # Scaling gains based on rarity potential
        tp_gain = int(5 * mult)
        ts_gain = int(10 * mult)
        hp_gain = 20
        ce_gain = 5
        atk_gain = 3

        await db.users.update({"telegramId": user_id}, {"$inc": {"dust": -dust_cost, "coins": -coin_cost}})
        await db.roster.update({"_id": roster_id}, {
            "$inc": {
                "level": 1, 
                "tp": tp_gain, 
                "ts": ts_gain,
                "hp": hp_gain, 
                "maxHp": hp_gain, 
                "ce": ce_gain, 
                "maxCe": ce_gain, 
                "atk": atk_gain
            }
        })

        return {
            "success": True,
            "msg": f"🎉 <b>{char['charId']}</b> reached Level {new_level}!\n\n" + \
                   f"💎 TP +{tp_gain} | 📊 TS +{ts_gain}\n" + \
                   f"🩸 HP +{hp_gain} | 🌀 CE +{ce_gain} | ⚔️ STR +{atk_gain}\n" + \
                   f"💰 Cost: {coin_cost} Coins, {dust_cost} Dust"
        }

    async def promote_grade(self, user_id, roster_id):
        char = await db.roster.find_one({"_id": roster_id, "userId": user_id})
        user = await db.users.find_one({"telegramId": user_id})
        
        if not char or not user:
            return {"success": False, "msg": "Data mismatch error."}

        GRADES = ["Grade 4", "Grade 3", "Grade 2", "Grade 1", "Special"]
        current_grade = char.get('grade', "Grade 4")
        try:
            current_idx = GRADES.index(current_grade)
        except ValueError:
            current_idx = 0
        
        if current_idx == len(GRADES) - 1:
            return {"success": False, "msg": "This sorcerer has already reached the pinnacle (Special Grade)!"}

        next_grade = GRADES[current_idx + 1]
        rarity = char.get('rarity') or CHAR_DATA.get(char['charId'], {}).get('rarity', 'Common')

        # New Shard Requirements (Merging Duplicates)
        # Format: {Rarity: [Shards for 4->3, 3->2, 2->1, 1->Special]}
        SHARD_REQS = {
            "Common":    [2, 4, 6, 10],
            "Rare":      [2, 3, 5, 8],
            "Epic":      [1, 2, 4, 6],
            "Legendary": [1, 2, 3, 5],
            "Mythic":    [1, 1, 2, 3]
        }

        req_list = SHARD_REQS.get(rarity, [2, 4, 6, 10])
        shards_needed = req_list[current_idx]
        
        user_shards = user.get('shards', {})
        available_shards = user_shards.get(char['charId'], 0)

        if available_shards < shards_needed:
            return {
                "success": False, 
                "msg": f"❌ <b>Insufficient Cards!</b>\n\nTo promote <b>{char['charId']}</b> ({rarity}) to {next_grade}, you need to merge <b>{shards_needed}</b> duplicate cards from the Altar.\n\nCurrently available: <code>{available_shards}/{shards_needed}</code>"
            }

        hp_bonus = 50 * (current_idx + 1)
        atk_bonus = 10 * (current_idx + 1)

        # Deduct shards
        user_shards[char['charId']] = available_shards - shards_needed
        await db.users.update({"telegramId": user_id}, {"$set": {"shards": user_shards}})
        
        await db.roster.update({"_id": roster_id}, {
            "$set": {"grade": next_grade},
            "$inc": {"hp": hp_bonus, "maxHp": hp_bonus, "atk": atk_bonus}
        })

        return { 
            "success": True, 
            "msg": f"🎖 <b>GRADE PROMOTED!</b>\n\n<b>{char['charId']}</b> has merged their duplicates and reached <b>{next_grade}</b>!\n\n" + \
                   f"🩸 HP +{hp_bonus} | ⚔️ STR +{atk_bonus}\n" + \
                   f"✨ Level Cap increased!"
        }

upgrade_service = UpgradeService()
