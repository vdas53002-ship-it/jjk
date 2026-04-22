const db = require('../database');
const items = require('../utils/data/items');

/**
 * Upgrade Service: Handles character stat items, move unlocks, and domain expansions.
 */
module.exports = {
    /**
     * Applies an item upgrade to a character.
     */
    async applyItemUpgrade(userId, rosterId, itemId) {
        const char = await db.roster.findOne({ _id: rosterId, userId: userId });
        const user = await db.users.findOne({ telegramId: userId });
        const item = items[itemId];

        if (!char || !user || !item) return { success: false, msg: "Data mismatch error." };

        // 1. Initial Checks
        char.upgrades = char.upgrades || {};
        const totalUpg = Object.values(char.upgrades).reduce((a, b) => a + b, 0);
        if (totalUpg >= 6) return { success: false, msg: "This character has reached the maximum of 6 upgrade slots." };

        // 2. Item Specific Validation
        const currentCount = char.upgrades[itemId] || 0;

        switch (itemId) {
            case 'minor_hp_potion': return { success: false, msg: "Healing potions cannot be used as permanent upgrades." };
            case 'hp_amulet':
                if (currentCount >= 3) return { success: false, msg: "Maximum 3 HP Amulets allowed." };
                break;
            case 'ce_crystal':
                if (currentCount >= 3) return { success: false, msg: "Maximum 3 CE Crystals allowed." };
                break;
            case 'black_flash_manual':
                if (currentCount >= 2) return { success: false, msg: "Maximum 2 Black Flash Manuals allowed." };
                break;
            case 'speed_boots':
            case 'technique_scroll':
            case 'domain_fragment':
                if (currentCount >= 1) return { success: false, msg: "This upgrade can only be applied once." };
                break;
        }

        // 3. Inventory Check
        const invIdx = user.inventory.findIndex(i => i.id === itemId);
        if (invIdx === -1 || user.inventory[invIdx].qty <= 0) {
            return { success: false, msg: `You do not own any ${item.name}s.` };
        }

        // 4. Apply Effect
        char.upgrades[itemId] = currentCount + 1;

        let report = "";
        switch (itemId) {
            case 'hp_amulet':
                // Base HP increase
                report = `HP increased by 15.`;
                break;
            case 'ce_crystal':
                report = `Cursed Energy increased by 10.`;
                break;
            case 'black_flash_manual':
                char.bonusCrit = (char.bonusCrit || 0) + 5;
                report = `Critical Hit chance increased by +5%.`;
                break;
            case 'speed_boots':
                char.initiativeBonus = (char.initiativeBonus || 0) + 5;
                report = `Initiative bonus increased by +5%.`;
                break;
            case 'technique_scroll':
                char.hasUnlockedMove = true;
                report = `New technique unlocked!`;
                break;
            case 'domain_fragment':
                char.hasDomain = true;
                report = `Domain Expansion manifested!`;
                break;
        }

        // 5. Deduct and Save
        user.inventory[invIdx].qty -= 1;
        await db.users.update({ telegramId: userId }, { $set: { inventory: user.inventory } });
        await db.roster.update({ _id: rosterId }, { $set: { upgrades: char.upgrades, bonusCrit: char.bonusCrit, initiativeBonus: char.initiativeBonus, hasUnlockedMove: char.hasUnlockedMove, hasDomain: char.hasDomain } });

        return { success: true, msg: `✅ Upgrade Successful! ${report}`, char };
    },

    async levelUpCharacter(userId, rosterId) {
        const char = await db.roster.findOne({ _id: rosterId, userId: userId });
        const user = await db.users.findOne({ telegramId: userId });

        if (!char || !user) return { success: false, msg: "Data mismatch error." };

        // 1. Calculate Costs
        const level = char.level || 1;
        const dustCost = 10 + (level * 5);
        const coinCost = 100 + (level * 50);

        // 2. Balance Check
        if ((user.dust || 0) < dustCost) return { success: false, msg: `❌ Not enough Dust! Need ${dustCost}.` };
        if (user.coins < coinCost) return { success: false, msg: `❌ Not enough Coins! Need ${coinCost}.` };

        // 3. Apply Level Up
        const newLevel = level + 1;
        const hpGain = 20;
        const ceGain = 5;
        const atkGain = 3;

        // 4. Update DB
        await db.users.update({ telegramId: userId }, { $inc: { dust: -dustCost, coins: -coinCost } });
        await db.roster.update({ _id: rosterId }, {
            $inc: { level: 1, hp: hpGain, maxHp: hpGain, ce: ceGain, maxCe: ceGain, atk: atkGain }
        });

        return {
            success: true,
            msg: `🎉 <b>${char.charId}</b> reached Level ${newLevel}!\n\n` +
                `🩸 HP +${hpGain} | 🌀 CE +${ceGain} | ⚔️ ATK +${atkGain}\n` +
                `💰 Cost: ${coinCost} Coins, ${dustCost} Dust`
        };
    }
};
