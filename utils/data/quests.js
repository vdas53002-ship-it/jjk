/**
 * Quest Pool: Predefined daily tasks for sorcerers.
 */
module.exports = {
    1: {
        id: 1,
        description: "Win 2 ranked matches",
        action: "ranked_win",
        target: 2,
        reward: { coins: 150, items: [{ id: "gacha_ticket", qty: 1 }], xp: 50 },
        rarity: "Common"
    },
    2: {
        id: 2,
        description: "Use Domain Expansion twice",
        action: "domain_use",
        target: 2,
        reward: { coins: 100, items: [{ id: "ce_charge", qty: 1 }], xp: 30 },
        rarity: "Common"
    },
    3: {
        id: 3,
        description: "Switch characters 3 times in one battle",
        action: "switch_use",
        target: 3,
        reward: { coins: 50, items: [{ id: "guard_stone", qty: 1 }], xp: 20 },
        rarity: "Common"
    },
    4: {
        id: 4,
        description: "Deal 500 total damage",
        action: "deal_damage",
        target: 500,
        reward: { coins: 100, items: [{ id: "lucky_charm", qty: 1 }], xp: 40 },
        rarity: "Common"
    },
    5: {
        id: 5,
        description: "Explore 5 times",
        action: "explore_count",
        target: 5,
        reward: { coins: 100, items: [{ id: "gacha_ticket", qty: 1 }], xp: 30 },
        rarity: "Common"
    },
    6: {
        id: 6,
        description: "Defeat a Special Grade Curse",
        action: "defeat_special",
        target: 1,
        reward: { coins: 80, items: [{ id: "gacha_ticket", qty: 1 }], xp: 25 },
        rarity: "Rare"
    },
    7: {
        id: 7,
        description: "Capture 1 character in explore",
        action: "capture_count",
        target: 1,
        reward: { coins: 100, items: [{ id: "cursed_charm", qty: 1 }], xp: 40 },
        rarity: "Common"
    },
    8: {
        id: 8,
        description: "Use 5 items in battles",
        action: "item_use",
        target: 5,
        reward: { coins: 80, items: [{ id: "minor_potion", qty: 1 }], xp: 25 },
        rarity: "Common"
    },
    9: {
        id: 9,
        description: "Win a battle without losing any character",
        action: "perfect_win",
        target: 1,
        reward: { coins: 120, items: [{ id: "revive_token", qty: 1 }], xp: 60 },
        rarity: "Legendary"
    },
    10: {
        id: 10,
        description: "Perform a Black Flash",
        action: "black_flash",
        target: 1,
        reward: { coins: 60, items: [{ id: "bf_charm", qty: 1 }], xp: 20 },
        rarity: "Common"
    }
};
