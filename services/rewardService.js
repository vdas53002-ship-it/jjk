const db = require('../database');
const achievementService = require('./achievementService');

/**
 * Reward Service: Manages daily claims and login streaks.
 */
module.exports = {
    DAILY_REWARDS: [
        { coins: 200 },
        { coins: 300, dust: 5 },
        { coins: 500, tickets: 1 },
        { coins: 750, dust: 10 },
        { coins: 1000, tickets: 2 }
    ],

    async claimDaily(userId) {
        const user = await db.users.findOne({ telegramId: userId });
        
        if (!user) {
            return { success: false, msg: "❌ <b>ACCESS DENIED</b>\n\nYou must first register as a sorcerer using /start before claiming daily rewards." };
        }

        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        if (user.lastDailyClaim === today) {
            return { success: false, msg: "⏳ You've already focused your energy today. Return tomorrow!" };
        }

        const lastClaimDate = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null;
        let streak = user.loginStreak || 0;
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (lastClaimDate && (now - lastClaimDate) < oneDayMs * 2) {
            streak++;
        } else {
            streak = 1;
        }

        // --- Milestone Rewards ---
        let coins = 200 + (Math.min(streak, 10) - 1) * 100; // 200, 300, 400... up to 1100
        if (streak > 10) coins = 1200;
        if (streak >= 20) coins = 1500;
        if (streak >= 30) coins = 3000;

        let items = [];
        let shards = 0;
        let title = null;

        // Structured Rewards
        if (streak % 7 === 0) {
            // Weekly Bonus
            items.push({ id: 'gacha_ticket', qty: 3 });
            shards = 50;
            if (streak === 7) title = "Weekly Warrior";
            if (streak === 14) title = "Disciplined Soul";
            if (streak === 21) title = "Cursed Veteran";
        } else if (streak === 30) {
            // Monthly Mega Bonus
            items.push({ id: 'gacha_ticket', qty: 10 });
            shards = 500;
            title = "Immortal Sorcerer";
        } else {
            // Minor daily items
            if (streak % 3 === 0) items.push({ id: 'ce_charge', qty: 1 });
            if (streak % 5 === 0) items.push({ id: 'rare_upgrade', qty: 1 });
        }

        let rewardList = `💰 +${coins} Coins`;
        if (shards > 0) rewardList += `\n💎 +${shards} Shards`;
        items.forEach(itm => {
            const itemName = itm.id.replace(/_/g, ' ').toUpperCase();
            rewardList += `\n📦 +${itm.qty}x ${itemName}`;
        });

        // Grant
        const updates = { 
            $inc: { coins, shardsCurrency: shards }, 
            $set: { lastDailyClaim: today, loginStreak: streak } 
        };
        if (title) updates.$set.title = title;
        
        let inv = user.inventory || [];
        items.forEach(itm => {
            const idx = inv.findIndex(i => i.id === itm.id);
            if (idx > -1) inv[idx].qty += itm.qty;
            else inv.push(itm);
        });
        updates.$set.inventory = inv;
        
        // Gacha tickets often stored separately
        const ticketItem = items.find(i => i.id === 'gacha_ticket');
        if (ticketItem) updates.$inc.gachaTickets = ticketItem.qty;

        await db.users.update({ telegramId: userId }, updates);

        if (title) rewardList += `\n🏅 <b>New Title:</b> ${title}`;

        // Achievement Progress & XP
        const xpGain = 50 + (Math.min(streak, 7) * 10);
        await db.users.update({ telegramId: userId }, { $inc: { playerXp: xpGain } });
        rewardList += `\n📈 +${xpGain} Player XP`;

        const newAchs = await achievementService.updateProgress(userId, 'LOYALTY', 0); // Trigger check for current streak
        // Special case: updateProgress usually increments. For loyalty we sync with streak.
        await db.users.update({ telegramId: userId }, { $set: { "achievements.progress.LOYALTY": streak } });
        const finalAchs = await achievementService.updateProgress(userId, 'LOYALTY', 0); 
        
        if (finalAchs && finalAchs.length > 0) {
            rewardList += `\n\n🏆 <b>ACHIEVEMENT UNLOCKED!</b>\n` + finalAchs.map(a => `✨ ${a.label}: ${a.desc}`).join('\n');
        }

        return { 
            success: true, 
            msg: `📅 <b>DAY ${streak} FOCUS COMPLETE</b>\n\nRewards:\n${rewardList}\n\nMaintain your streak for greater power!`,
            streak
        };
    }
};
