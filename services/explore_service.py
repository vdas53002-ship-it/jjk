import random
import time
from datetime import datetime
from database import db
from utils.data import characters

class ExploreService:
    def __init__(self):
        self.locks = set()
        self.last_encountered = {} # user_id -> list of last 5 names
        self.CONSTANTS = {
            "STAMINA_COST": 0,
            "MAX_STAMINA": 100,
            "REFILL_MINUTES": 5,
            "DAILY_EXPLORE_LIMIT": 1000,
            "MAX_STEPS": 3,
            "BASE_CHANCES": {},
            "REWARDS": {
                "Common": {"coins": 100, "xp": 50, "dust": 20, "shards": 5},
                "Rare": {"coins": 300, "xp": 120, "dust": 50, "shards": 15},
                "Epic": {"coins": 1000, "xp": 400, "dust": 150, "shards": 50},
                "Legendary": {"coins": 5000, "xp": 1500, "dust": 500, "shards": 200},
                "Mythic": {"coins": 20000, "xp": 10000, "dust": 2000, "shards": 1000}
            },
            "LOSS_REWARDS": {"coins": 20, "xp": 5}
        }

        self.BIOMES = {
            "TIER_1": {
                "id": "TIER_1",
                "name": "🏮 Haunted Outskirts",
                "desc": "Low-level spirits (Lv.1+).",
                "minLevel": 1,
                "multiplier": 1.0,
                "probabilities": {"Common": 0.838, "Rare": 0.10, "Epic": 0.05, "Legendary": 0.01, "Mythic": 0.002}
            },
            "TIER_2": {
                "id": "TIER_2",
                "name": "🏚️ Cursed Urban District",
                "desc": "Stronger curses (Lv.20+).",
                "minLevel": 20,
                "multiplier": 1.8,
                "probabilities": {"Common": 0.345, "Rare": 0.50, "Epic": 0.12, "Legendary": 0.03, "Mythic": 0.005}
            },
            "TIER_3": {
                "id": "TIER_3",
                "name": "🏯 Special Grade Territory",
                "desc": "Special Grade threats (Lv.50+).",
                "minLevel": 50,
                "multiplier": 3.5,
                "probabilities": {"Common": 0.0, "Rare": 0.20, "Epic": 0.70, "Legendary": 0.08, "Mythic": 0.02}
            }
        }

    def acquire_lock(self, user_id):
        if user_id in self.locks:
            return False
        self.locks.add(user_id)
        # We'd ideally use an async sleep or timer to release lock, 
        # but for simplicity in Python we handle it in the handler
        return True

    def release_lock(self, user_id):
        if user_id in self.locks:
            self.locks.remove(user_id)

    async def roll_encounter(self, user_id=None, biome_key="TIER_1", force_rarity=None):
        biome = self.BIOMES.get(biome_key, self.BIOMES["TIER_1"])
        roll = random.random()
        cumulative = 0
        selected_rarity = force_rarity or "Common"

        if not force_rarity:
            for rarity, chance in biome["probabilities"].items():
                cumulative += chance
                if roll <= cumulative:
                    selected_rarity = rarity
                    break

        # 2. Select Character from Pool
        pool = [c for c in characters.DATA.values() if c.get('rarity') == selected_rarity]
        if not pool:
            # Fallback to Common if requested rarity pool is empty
            pool = [c for c in characters.DATA.values() if c.get('rarity') == 'Common']
        
        if not pool:
            # Absolute fallback if even common pool is empty (should not happen)
            return await self.roll_encounter(user_id, "TIER_1")

        # Avoid picking any of the last 5 characters for this user
        history = self.last_encountered.get(user_id, [])
        if len(pool) > len(history):
            temp_pool = [c for c in pool if c['name'] not in history]
            if temp_pool:
                pool = temp_pool

        # Shuffle pool for extra randomness
        random.shuffle(pool)
        selected = random.choice(pool)


        # Update history (keep last 5)
        history.append(selected['name'])
        if len(history) > 5:
            history.pop(0)
        self.last_encountered[user_id] = history

        return {
            "character": selected,
            "rarity": selected_rarity,
            "biome": biome_key,
            "catchable": True # All are catchable now
        }

    def get_random_event(self, current_step):
        events = [
            {"type": 'battle', "weight": 60, "icon": '⚔️', "name": 'CURSED SPIRIT'},
            {"type": 'scavenge', "weight": 20, "icon": '📦', "name": 'TREASURE CACHE'},
            {"type": 'mystery', "weight": 10, "icon": '❔', "name": 'SHADOWY FIGURE'},
            {"type": 'rest', "weight": 10, "icon": '⛺', "name": 'SAFE ZONE'}
        ]

        if current_step >= self.CONSTANTS["MAX_STEPS"]:
            return events[0]

        roll = random.random() * 100
        cumulative = 0
        for e in events:
            cumulative += e["weight"]
            if roll <= cumulative:
                return e
        return events[0]

    def generate_step_reward(self, event_type):
        roll = random.random()
        if event_type == 'scavenge':
            if random.random() < 0.10:
                return {"shardsCurrency": 10, "msg": "📦 <b>LUCKY FIND!</b>\nYou found a cache of Cursed Shards!\n🧩 +10 Shards"}
            return {"coins": 250, "dust": 10, "msg": "📦 You found a supply crate!\n💰 +250 Coins\n✨ +10 Dust"}
        elif event_type == 'treasure':
            item = 'cursed_charm' if roll < 0.7 else 'gacha_ticket'
            return {
                "coins": 750,
                "itemId": item,
                "msg": f"💎 <b>TREASURE CACHE!</b>\n💰 +750 Coins\n🎁 Found: 1x {item.replace('_', ' ').upper()}"
            }
        elif event_type == 'rest':
            return {"stamina": 50, "msg": "🍵 A brief respite at a safe house.\n⚡ +50 Stamina restored."}
        elif event_type == 'mystery':
            if roll < 0.4:
                return {"shardsCurrency": 15, "msg": "🌑 A shadow figure grants you power...\n🧩 +15 Shards found!"}
            return {"coins": 200, "xp": 150, "msg": "📖 A wandering soul shares its knowledge.\n💰 +200 Coins\n📈 +150 XP"}
        else:
            return {"coins": 20, "msg": "💨 Just some wind through the ruins."}

    async def run_auto_grind(self, user, biome_key="TIER_1"):
        batch_size = 10
        stamina_cost = 50
        results = {
            "coins": 0,
            "dust": 0,
            "xp": 0,
            "charactersFound": [],
            "shards": 0,
            "staminaUsed": stamina_cost,
            "success": True
        }

        if user.get('stamina', 0) < stamina_cost:
            return {"success": False, "msg": f"❌ Insufficient Stamina! You need 🔋 50 Stamina for this blitz."}

        for _ in range(batch_size):
            event = self.get_random_event(1)
            if event['type'] == 'battle':
                results["coins"] += 30
                results["xp"] += 15
            else:
                reward = self.generate_step_reward(event['type'])
                results["coins"] += reward.get('coins', 0)
                results["dust"] += reward.get('dust', 0)
                results["xp"] += reward.get('xp', 0)
                results["shards"] += reward.get('shardsCurrency', 0)

        return results

    def check_daily_reset(self, user):
        if not user: return None
        now = datetime.utcnow()
        last_reset_ms = user.get('lastDailyReset', 0)
        last_reset = datetime.utcfromtimestamp(last_reset_ms / 1000.0) if last_reset_ms else datetime.min
        
        if now.day != last_reset.day or now.month != last_reset.month:
            return {
                "dailyExploreCount": 0,
                "lastDailyReset": int(now.timestamp() * 1000)
            }
        return None

explore_service = ExploreService()
