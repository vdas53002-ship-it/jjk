/**
 * Item Data Library: Consumables, Tickets, and Upgrade Materials.
 */
module.exports = {
    // --- DAILY SHOP ---
    "minor_hp_potion": {
        id: "minor_hp_potion",
        name: "Minor Potion",
        icon: "🧪",
        description: "Restore 25% HP in battle.",
        price: 40,
        currency: "coins",
        shop: { category: "daily", stock: 5 }
    },
    "ce_charge": {
        id: "ce_charge",
        name: "CE Charge",
        icon: "⚡️",
        description: "Restore 30 CE in battle.",
        price: 60,
        currency: "coins",
        shop: { category: "daily", stock: 3 }
    },
    "guard_stone": {
        id: "guard_stone",
        name: "Guard Stone",
        icon: "🛡",
        description: "Take 0 damage next turn.",
        price: 80,
        currency: "coins",
        shop: { category: "daily", stock: 2 }
    },
    "lucky_charm": {
        id: "lucky_charm",
        name: "Lucky Charm",
        icon: "🧿",
        description: "+10% crit chance for one battle.",
        price: 50,
        currency: "coins",
        shop: { category: "daily", stock: 3 }
    },
    "common_upgrade": {
        id: "common_upgrade",
        name: "Common Upgrade",
        icon: "💎",
        description: "Get a random HP or CE upgrade.",
        price: 150,
        currency: "coins",
        shop: { category: "daily", stock: 1 }
    },

    // --- WEEKLY SHOP ---
    "gacha_ticket": {
        id: "gacha_ticket",
        name: "Gacha Ticket",
        icon: "🎫",
        description: "One random character pull.",
        price: 200,
        currency: "coins",
        shop: { category: "weekly", stock: 3 }
    },
    "major_hp_potion": {
        id: "major_hp_potion",
        name: "Major Potion",
        icon: "🧪",
        description: "Restore 50% HP in battle.",
        price: 120,
        currency: "coins",
        shop: { category: "weekly", stock: 5 }
    },
    "black_flash_manual": {
        id: "black_flash_manual",
        name: "Black Flash Manual",
        icon: "📖",
        description: "Permanently +5% crit chance for one character.",
        price: 600,
        currency: "coins",
        shop: { category: "weekly", stock: 1 }
    },
    "revive_token": {
        id: "revive_token",
        name: "Revive Token",
        icon: "✨",
        description: "Revive a KO'd ally with 30% HP.",
        price: 400,
        currency: "coins",
        shop: { category: "weekly", stock: 1 }
    },

    "special_grade_potion": {
        id: "special_grade_potion",
        name: "Special Grade Elixir",
        icon: "🍶",
        description: "Fully restore HP for all partners.",
        price: 500,
        currency: "coins",
        shop: { category: "weekly", stock: 1 }
    },
    "ce_core": {
        id: "ce_core",
        name: "Cursed Energy Core",
        icon: "🧩",
        description: "Fully restore Cursed Energy in battle.",
        price: 300,
        currency: "coins",
        shop: { category: "weekly", stock: 2 }
    },
    // --- SPECIALS ---
    "tool_scrap": {
        id: "tool_scrap",
        name: "Cursed Tool Scrap",
        icon: "🔩",
        description: "Essential material for weapon upgrades.",
        price: 100,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "soul_shard": {
        id: "soul_shard",
        name: "Shards",
        icon: "💎",
        description: "Highly concentrated essence for leveling.",
        price: 250,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "mystery_box": {
        id: "mystery_box",
        name: "Mystery Cursed Box",
        icon: "🎁",
        description: "Contains a random item or ticket.",
        price: 400,
        currency: "coins",
        shop: { category: "special", stock: 10 }
    },
    "energy_drink": {
        id: "energy_drink",
        name: "Energy Drink",
        icon: "🥤",
        description: "Recover 100 daily hunts.",
        price: 50,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "exp_ticket": {
        id: "exp_ticket",
        name: "Hunt Ticket",
        icon: "🎫",
        description: "+1 hunt (bypass daily limit).",
        price: 100,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "cursed_seal_tag": {
        id: "cursed_seal_tag",
        name: "Cursed Seal",
        icon: "🏷️",
        description: "Standard tool for capturing spirits. +15% chance.",
        price: 150,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "cursed_charm": {
        id: "cursed_charm",
        name: "Cursed Charm",
        icon: "🧿",
        description: "+10% capture chance while hunting.",
        price: 200,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "grade_1_shackle": {
        id: "grade_1_shackle",
        name: "Grade-1 Shackle",
        icon: "⛓",
        description: "+30% capture chance while hunting.",
        price: 800,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "domain_essence": {
        id: "domain_essence",
        name: "Domain Essence",
        icon: "🌌",
        description: "100% Guaranteed Capture chance.",
        price: 5000,
        currency: "coins",
        shop: { category: "special", stock: 1 }
    },
    "max_stamina_potion": {
        id: "max_stamina_potion",
        name: "Max Stamina Potion",
        icon: "🔥",
        description: "Fully reset daily hunt limit.",
        price: 150,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "gacha_pack": {
        id: "gacha_pack",
        name: "10x Gacha Pack",
        icon: "🗃",
        description: "Bundle of 10 Gacha Tickets.",
        price: 1800,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "exp_charm": {
        id: "exp_charm",
        name: "EXP Charm",
        icon: "✨",
        description: "2x Character XP for the next battle.",
        price: 300,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    },
    "gold_ingot": {
        id: "gold_ingot",
        name: "Gold Ingot",
        icon: "🪙",
        description: "Valuable gold that can be sold for 1000 Coins.",
        price: 1200,
        currency: "coins",
        shop: { category: "special", stock: 999 }
    }
};

