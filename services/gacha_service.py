import random
from database import db
from utils.data import characters
from datetime import datetime

# Helper to roll stats for a character
def roll_character_stats(char_info):
    base_stats = char_info.get('base_stats', {
        'TS': [50, 60], 'STR': [3, 5], 'SPD': [3, 5], 'DUR': [3, 5], 'CE': [3, 5]
    })
    return {
        'TS': random.randint(base_stats['TS'][0], base_stats['TS'][1]),
        'STR': random.randint(base_stats['STR'][0], base_stats['STR'][1]),
        'SPD': random.randint(base_stats['SPD'][0], base_stats['SPD'][1]),
        'DUR': random.randint(base_stats['DUR'][0], base_stats['DUR'][1]),
        'CE': random.randint(base_stats['CE'][0], base_stats['CE'][1])
    }

RATES = {
    'mythic': 50,     # 0.5%
    'legendary': 150, # 1.5%
    'epic': 1300,     # 13%
    'rare': 3500,     # 35%
    'common': 5000    # 50%
}

DUST_VALUES = {
    'Mythic': 300,
    'Legendary': 100,
    'Epic': 40,
    'Rare': 15,
    'Common': 5
}

async def pull(user):
    # 1. Pity Check
    force_legendary = False
    pity_count = user.get('pityCount', 0) + 1
    user['pityCount'] = pity_count
    
    if pity_count >= 100:
        force_legendary = True
    
    rarity = 'Common'
    roll = random.randint(1, 10000)

    if force_legendary:
        rarity = 'Legendary'
        user['pityCount'] = 0
    elif roll <= RATES['mythic']:
        rarity = 'Mythic'
        user['pityCount'] = 0
    elif roll <= RATES['mythic'] + RATES['legendary']:
        rarity = 'Legendary'
        user['pityCount'] = 0 # Reset pity
    elif roll <= RATES['mythic'] + RATES['legendary'] + RATES['epic']:
        rarity = 'Epic'
    elif roll <= RATES['mythic'] + RATES['legendary'] + RATES['epic'] + RATES['rare']:
        rarity = 'Rare'

    # 2. Select Character from Pool
    pool = [c for c in characters.DATA.values() if c.get('rarity') == rarity]
    if not pool:
        pool = [c for c in characters.DATA.values() if c.get('rarity') == 'Common']
    
    # Shuffle for entropy
    random.shuffle(pool)
    character = random.choice(pool)

    # 3. Duplicate Handling
    try:
        roster = user.get('_cached_roster') or await db.roster.find({"userId": user['telegramId']})
    except Exception:
        roster = []
    already_owned = any(r.get('charId') == character['name'] for r in roster)
    
    # Update cache when new char added
    if not already_owned:
        if '_cached_roster' in user:
            user['_cached_roster'].append({"charId": character['name'], "userId": user['telegramId']})
    
    is_new = True
    dust_earned = 0

    if already_owned:
        is_new = False
        shards = user.get('shards', {})
        current_shards = shards.get(character['name'], 0)
        shards[character['name']] = current_shards + 1
        user['shards'] = shards
    else:
        # Roll base stats for the new character instance
        rolled_stats = roll_character_stats(character)
        
        await db.roster.insert({
            "userId": user['telegramId'],
            "charId": character['name'],
            "level": 1,
            "xp": 0,
            "grade": "Grade 4",
            "rarity": character['rarity'],
            "upgrades": {},
            "rolled_stats": rolled_stats,
            "shards": 0,
            "lastUpdated": datetime.now()
        })

    return {
        "character": character,
        "isNew": is_new,
        "dustEarned": dust_earned,
        "pityCount": user['pityCount'],
        "isPity": force_legendary,
        "dustTotal": user.get('dust', 0)
    }

async def bulk_pull(user):
    results = []
    total_dust = 0
    new_count = 0

    try:
        current_roster = await db.roster.find({"userId": user['telegramId']})
        user['_cached_roster'] = current_roster
    except Exception:
        user['_cached_roster'] = []

    for _ in range(10):
        res = await pull(user)
        results.append(res)
        total_dust += res['dustEarned']
        if res['isNew']:
            new_count += 1

    await db.users.update({"telegramId": user['telegramId']}, {
        "$set": { 
            "pityCount": user['pityCount'], 
            "dust": user.get('dust', 0),
            "shards": user.get('shards', {})
        }
    })

    return {
        "results": results,
        "totalDust": total_dust,
        "newCount": new_count,
        "pityCount": user['pityCount']
    }
