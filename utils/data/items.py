ITEMS = {
    # --- DAILY SHOP ---
    "minor_hp_potion": {
        "id": "minor_hp_potion",
        "name": "Minor Potion",
        "icon": "🧪",
        "description": "Restore 25% HP in battle.",
        "price": 200,
        "currency": "coins",
        "shop": {"category": "daily", "stock": 5}
    },
    "ce_charge": {
        "id": "ce_charge",
        "name": "CE Charge",
        "icon": "⚡️",
        "description": "Restore 30 CE in battle.",
        "price": 250,
        "currency": "coins",
        "shop": {"category": "daily", "stock": 3}
    },
    "guard_stone": {
        "id": "guard_stone",
        "name": "Guard Stone",
        "icon": "🛡",
        "description": "Take 0 damage next turn.",
        "price": 500,
        "currency": "coins",
        "shop": {"category": "daily", "stock": 2}
    },
    "lucky_charm": {
        "id": "lucky_charm",
        "name": "Lucky Charm",
        "icon": "🧿",
        "description": "+10% crit chance for one battle.",
        "price": 300,
        "currency": "coins",
        "shop": {"category": "daily", "stock": 3}
    },
    "common_upgrade": {
        "id": "common_upgrade",
        "name": "Common Upgrade",
        "icon": "💎",
        "description": "Get a random HP or CE upgrade.",
        "price": 1500,
        "currency": "coins",
        "shop": {"category": "daily", "stock": 1}
    },

    # --- WEEKLY SHOP ---
    "gacha_ticket": {
        "id": "gacha_ticket",
        "name": "Gacha Ticket",
        "icon": "🎫",
        "description": "One random character pull.",
        "price": 500,
        "currency": "coins",
        "shop": {"category": "weekly", "stock": 5}
    },
    "major_hp_potion": {
        "id": "major_hp_potion",
        "name": "Major Potion",
        "icon": "🧪",
        "description": "Restore 50% HP in battle.",
        "price": 800,
        "currency": "coins",
        "shop": {"category": "weekly", "stock": 3}
    },
    "black_flash_manual": {
        "id": "black_flash_manual",
        "name": "Black Flash Manual",
        "icon": "📖",
        "description": "Permanently +5% crit chance for one character.",
        "price": 5000,
        "currency": "coins",
        "shop": {"category": "weekly", "stock": 1}
    },
    "revive_token": {
        "id": "revive_token",
        "name": "Revive Token",
        "icon": "✨",
        "description": "Revive a KO'd ally with 30% HP.",
        "price": 2000,
        "currency": "coins",
        "shop": {"category": "weekly", "stock": 1}
    },
    "special_grade_potion": {
        "id": "special_grade_potion",
        "name": "Special Grade Elixir",
        "icon": "🍶",
        "description": "Fully restore HP for all partners.",
        "price": 3000,
        "currency": "coins",
        "shop": {"category": "weekly", "stock": 1}
    },
    "ce_core": {
        "id": "ce_core",
        "name": "Cursed Energy Core",
        "icon": "🧩",
        "description": "Fully restore Cursed Energy in battle.",
        "price": 1200,
        "currency": "coins",
        "shop": {"category": "weekly", "stock": 2}
    },

    # --- SPECIALS ---
    # --- NEW MARKET ITEMS ---
    "katana": {
        "id": "katana",
        "name": "Split Soul Katana",
        "icon": "🗡️",
        "description": "Ignores physical toughness. Deals direct soul damage.",
        "price": 500,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "nails": {
        "id": "nails",
        "name": "Resonance Nails",
        "icon": "🔨",
        "description": "Used for Resonance techniques. High critical chance.",
        "price": 250,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "cloud": {
        "id": "cloud",
        "name": "Playful Cloud",
        "icon": "🗃️",
        "description": "A special grade tool that scales with the user's pure physical strength.",
        "price": 800,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "spear": {
        "id": "spear",
        "name": "Inverted Spear",
        "icon": "📿",
        "description": "Nullifies all cursed techniques on hit.",
        "price": 1200,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "elixir": {
        "id": "elixir",
        "name": "Reverse Elixir",
        "icon": "🍷",
        "description": "Heals moderate wounds using positive energy.",
        "price": 150,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "fragment": {
        "id": "fragment",
        "name": "Cursed Fragment",
        "icon": "🧿",
        "description": "A shard of intense malice. Boosts CE for 1 turn.",
        "price": 300,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "pill": {
        "id": "pill",
        "name": "Energy Pill",
        "icon": "💊",
        "description": "Quickly restores a small amount of stamina.",
        "price": 100,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "dshard": {
        "id": "dshard",
        "name": "Domain Shard",
        "icon": "🔥",
        "description": "A piece of a collapsed domain. Increases ultimate damage.",
        "price": 750,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "scroll": {
        "id": "scroll",
        "name": "Six Eyes Scroll",
        "icon": "👁️",
        "description": "Ancient knowledge of the Six Eyes. Dramatically increases BIQ.",
        "price": 5000,
        "currency": "coins",
        "shop": {"category": "special", "stock": 5}
    },
    "finger": {
        "id": "finger",
        "name": "Sukuna Finger",
        "icon": "👑",
        "description": "A fragment of the King of Curses. Grants terrifying power at a cost.",
        "price": 10000,
        "currency": "coins",
        "shop": {"category": "special", "stock": 1}
    },
    "reset_orb": {
        "id": "reset_orb",
        "name": "Technique Reset Orb",
        "icon": "🌀",
        "description": "Allows a sorcerer to re-learn their primary techniques.",
        "price": 3500,
        "currency": "coins",
        "shop": {"category": "special", "stock": 999}
    },
    "gold_ingot": {
        "id": "gold_ingot",
        "name": "Gold Ingot",
        "icon": "🪙",
        "description": "Valuable gold that can be sold for 5000 Coins.",
        "price": 10000,
        "currency": "coins",
        "shop": {"category": "none", "stock": 0}
    }
}
