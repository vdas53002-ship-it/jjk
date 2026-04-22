const db = require('../database');

/**
 * Achievement Service: Tracks long-term goals and awards Hinglish-themed rewards.
 */
module.exports = {
    // Definitive Achievement List
    DATA: {
        EXPLORE: [
            { id: 'exp_1', label: 'Cursed Scout', threshold: 50, reward: { gachaTickets: 5 }, desc: '50 Expedition Steps complete kiye. (Safar shuru!)' },
            { id: 'exp_2', label: 'Pathfinder', threshold: 200, reward: { dust: 500 }, desc: '200 Expedition Steps complete kiye. (Raste ka gyaan!)' },
            { id: 'exp_3', label: 'Cursed Ruler', threshold: 1000, reward: { gachaTickets: 25, title: 'Cursed Ruler' }, desc: '1000 Steps complete! (Duniya aapki hai!)' }
        ],
        PVP: [
            { id: 'pvp_1', label: 'Street Fighter', threshold: 10, reward: { coins: 5000 }, desc: '10 PvP matches jeetein. (Halka dangal!)' },
            { id: 'pvp_2', label: 'Zenin Elite', threshold: 50, reward: { shardsCurrency: 200 }, desc: '50 PvP matches jeetein. (Zenin garv!)' },
            { id: 'pvp_3', label: 'God of War', threshold: 250, reward: { shardsCurrency: 1000, title: 'God of War' }, desc: '250 Wins! (Koi muqabla nahi!)' }
        ],
        CATCH: [
            { id: 'cat_1', label: 'Spirit Sealer', threshold: 10, reward: { gachaTickets: 5 }, desc: '10 spirits capture kiye. (Sealing shuru!)' },
            { id: 'cat_2', label: 'Spirit Master', threshold: 50, reward: { shardsCurrency: 200 }, desc: '50 spirits capture kiye. (Master sorcerer!)' },
            { id: 'cat_3', label: 'Spirit King', threshold: 200, reward: { title: 'Spirit King', gachaTickets: 30 }, desc: '200 spirits capture! (Spirits aapke niche!)' }
        ],
        LOYALTY: [
            { id: 'loy_1', label: 'Regular Student', threshold: 7, reward: { coins: 2000 }, desc: '7 days login streak maintain kiya. (Pabandi!)' },
            { id: 'loy_2', label: 'Focus Master', threshold: 30, reward: { shardsCurrency: 300 }, desc: '30 days login streak! (Ek mahina shiddat!)' },
            { id: 'loy_3', label: 'True Sorcerer', threshold: 100, reward: { gachaTickets: 50, title: 'True Sorcerer' }, desc: '100 days login streak! (Asli junoon!)' }
        ]
    },

    /**
     * Updates progress for a category and checks for new completions.
     */
    async updateProgress(userId, category, amount = 1) {
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return null;

        if (!user.achievements) {
            user.achievements = { progress: {}, completed: [] };
        }
        if (!user.achievements.progress) user.achievements.progress = {};
        if (!user.achievements.completed) user.achievements.completed = [];

        const catKey = category.toUpperCase();
        user.achievements.progress[catKey] = (user.achievements.progress[catKey] || 0) + amount;

        const catData = this.DATA[catKey];
        if (!catData) return null;

        const currentProgress = user.achievements.progress[catKey];
        const newCompletions = [];

        for (const ach of catData) {
            if (user.achievements.completed.includes(ach.id)) continue;

            if (currentProgress >= ach.threshold) {
                user.achievements.completed.push(ach.id);
                newCompletions.push(ach);
                
                // Award Rewards
                if (ach.reward.coins) user.coins = (user.coins || 0) + ach.reward.coins;
                if (ach.reward.shardsCurrency) user.shardsCurrency = (user.shardsCurrency || 0) + ach.reward.shardsCurrency;
                if (ach.reward.gachaTickets) user.gachaTickets = (user.gachaTickets || 0) + ach.reward.gachaTickets;
                if (ach.reward.dust) user.dust = (user.dust || 0) + ach.reward.dust;
                if (ach.reward.title) user.title = ach.reward.title;
            }
        }

        if (newCompletions.length > 0) {
            await db.users.update({ telegramId: userId }, { $set: { 
                achievements: user.achievements,
                coins: user.coins,
                shardsCurrency: user.shardsCurrency,
                gachaTickets: user.gachaTickets,
                dust: user.dust,
                title: user.title
            }});
        } else {
            await db.users.update({ telegramId: userId }, { $set: { "achievements.progress": user.achievements.progress }});
        }

        return newCompletions;
    },

    /**
     * Formats achievement lists for display.
     */
    getSummary(user) {
        if (!user.achievements) return "<i>No progress recorded. Start your journey!</i>";
        
        let summary = "";
        for (const [cat, items] of Object.entries(this.DATA)) {
            const prog = user.achievements.progress[cat] || 0;
            const completedCount = items.filter(i => user.achievements.completed.includes(i.id)).length;
            summary += `▫️ <b>${cat}:</b> ${completedCount}/${items.length} completed (Progress: ${prog})\n`;
        }
        return summary;
    }
};
