const db = require('../database');
const questPool = require('../utils/data/quests');

/**
 * Quest Service: Manages generation, progress, and rewards for daily quests.
 */
class QuestService {
    /**
     * Ensures user has 3 quests for the current day.
     */
    async syncQuests(userId) {
        const today = new Date().toISOString().split('T')[0];
        
        // Check if quests already exist for today
        const existing = await db.quests.find({ userId, date: today });
        if (existing.length >= 3) return existing;

        // Otherwise generate 3 new ones
        const allQuests = Object.values(questPool);
        const selected = [];
        const poolCopy = [...allQuests];

        while (selected.length < 3 && poolCopy.length > 0) {
            const idx = Math.floor(Math.random() * poolCopy.length);
            const quest = poolCopy.splice(idx, 1)[0];
            
            // Weight check (Legendary is 5% likely, Rare 20%, Common 100%)
            const roll = Math.random();
            const weights = { "Common": 1.0, "Rare": 0.2, "Legendary": 0.05 };
            if (roll > (weights[quest.rarity] || 1.0)) {
                // Skip and add back to pool for another chance if pool not exhausted
                if (poolCopy.length > 3) continue; 
            }

            const newQuest = {
                userId,
                questId: quest.id,
                date: today,
                progress: 0,
                target: quest.target,
                completed: false,
                claimed: false
            };
            
            await db.quests.insert(newQuest);
            selected.push(newQuest);
        }

        return selected;
    }

    /**
     * Updates progress for any active quests matching the action.
     */
    async updateProgress(userId, actionType, value = 1) {
        const today = new Date().toISOString().split('T')[0];
        const activeQuests = await db.quests.find({ userId, date: today, completed: false });

        for (const userQuest of activeQuests) {
            const meta = questPool[userQuest.questId];
            if (meta && meta.action === actionType) {
                const newProgress = userQuest.progress + value;
                const isCompleted = newProgress >= userQuest.target;
                
                await db.quests.update({ _id: userQuest._id }, { 
                    $set: { 
                        progress: isCompleted ? userQuest.target : newProgress,
                        completed: isCompleted 
                    }
                });
            }
        }
    }

    /**
     * Claims rewards for a specific quest.
     */
    async claimQuest(userId, questId) {
        const today = new Date().toISOString().split('T')[0];
        const userQuest = await db.quests.findOne({ userId, questId: parseInt(questId), date: today });

        if (!userQuest || !userQuest.completed || userQuest.claimed) {
            return { success: false, message: "Quest not claimable." };
        }

        const meta = questPool[userQuest.questId];
        const user = await db.users.findOne({ telegramId: userId });

        // Grant Rewards
        const setOps = { claimed: true };
        await db.quests.update({ _id: userQuest._id }, { $set: setOps });

        // Update User Balance
        const userUpdates = {
            $inc: { coins: meta.reward.coins, xp: meta.reward.xp }
        };
        
        // Add items to inventory
        if (meta.reward.items && meta.reward.items.length > 0) {
            const inv = user.inventory || [];
            meta.reward.items.forEach(item => {
                const idx = inv.findIndex(i => i.id === item.id);
                if (idx > -1) inv[idx].qty += item.qty;
                else inv.push(item);
            });
            userUpdates.$set = { inventory: inv };
        }

        await db.users.update({ telegramId: userId }, userUpdates);

        return { success: true, reward: meta.reward };
    }

    /**
     * Claims all completed/unclaimed quests.
     */
    async claimAll(userId) {
        const today = new Date().toISOString().split('T')[0];
        const completions = await db.quests.find({ userId, date: today, completed: true, claimed: false });

        if (completions.length === 0) return { success: false, message: "No rewards to claim." };

        let totalCoins = 0;
        let totalXp = 0;
        let totalItems = [];

        for (const uq of completions) {
            const meta = questPool[uq.questId];
            totalCoins += meta.reward.coins;
            totalXp += meta.reward.xp;
            if (meta.reward.items) totalItems.push(...meta.reward.items);
            
            await db.quests.update({ _id: uq._id }, { $set: { claimed: true } });
        }

        const user = await db.users.findOne({ telegramId: userId });
        const inv = user.inventory || [];
        totalItems.forEach(item => {
            const idx = inv.findIndex(i => i.id === item.id);
            if (idx > -1) inv[idx].qty += item.qty;
            else inv.push(item);
        });

        await db.users.update({ telegramId: userId }, {
            $inc: { coins: totalCoins, xp: totalXp },
            $set: { inventory: inv }
        });

        return { success: true, coins: totalCoins, xp: totalXp, items: totalItems };
    }

    getTimeUntilReset() {
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const diff = tomorrow - now;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }
}

module.exports = new QuestService();
