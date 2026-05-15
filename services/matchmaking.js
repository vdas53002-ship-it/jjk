const db = require('../database');

/**
 * Matchmaking Service: Manages Ranked (ELO) and Casual (TPS) queues.
 */
let queue = []; 

module.exports = {
    // Callback to be set by the battle system
    onMatchFound: null,

    /**
     * TPS = sum((rarityWeight * level)) + (total_upgrades * 10)
     */
    async calculateTPS(user) {
        const roster = await db.roster.find({ userId: user.telegramId });
        let tps = 0;
        const weights = { "Common": 1, "Rare": 2, "Epic": 3, "Legendary": 4 };

        for (const charId of (user.teamIds || [])) {
            if (!charId) continue;
            const entry = roster.find(r => r.charId === charId);
            if (entry) {
                const weight = weights[entry.rarity] || 1;
                const upgradesCount = Object.keys(entry.upgrades || {}).length;
                tps += (weight * entry.level) + (upgradesCount * 10);
            }
        }
        return tps;
    },

    async joinQueue(user, isCasual = false) {
        // 1. Basic Checks
        const now = Date.now();
        const lastAction = user.lastQueueJoin || 0;
        if (now - lastAction < 10000) {
             return { error: `⏳ Please wait ${Math.ceil((10000 - (now - lastAction))/1000)}s before queuing again.` };
        }

        if (!user.teamIds || user.teamIds.filter(id => id).length < 3) {
            return { error: "❌ Your team must have 3 characters. Use /team to set your lineup." };
        }

        // 2. Prepare Entry
        this.leaveQueue(user.telegramId);
        const tps = await this.calculateTPS(user);
        
        const entry = {
            userId: user.telegramId,
            username: user.username,
            elo: user.elo || 1000,
            tps: tps,
            isCasual: isCasual,
            timestamp: now
        };

        await db.users.update({ telegramId: user.telegramId }, { $set: { lastQueueJoin: now } });
        queue.push(entry);
        return { success: true, tps };
    },

    leaveQueue(userId) {
        queue = queue.filter(q => q.userId !== userId);
    },

    /**
     * Matches players in the queue. Runs via Interval.
     */
    async processQueue() {
        const now = Date.now();
        // Timeouts (60s)
        const active = queue.filter(q => (now - q.timestamp) < 60000);
        const timedOut = queue.filter(q => (now - q.timestamp) >= 60000);
        
        // Notify timed out
        for (const q of timedOut) {
            this.leaveQueue(q.userId);
            if (this.onMatchTimeout) this.onMatchTimeout(q.userId);
        }

        queue = active;

        const matched = new Set();

        for (let i = 0; i < queue.length; i++) {
            const p1 = queue[i];
            if (matched.has(p1.userId)) continue;

            for (let j = i + 1; j < queue.length; j++) {
                const p2 = queue[j];
                if (matched.has(p2.userId)) continue;

                if (p1.isCasual !== p2.isCasual) continue;

                let isMatch = false;
                if (p1.isCasual) {
                    isMatch = Math.abs(p1.tps - p2.tps) <= 200;
                } else {
                    isMatch = Math.abs(p1.elo - p2.elo) <= 100;
                }

                if (isMatch) {
                    matched.add(p1.userId);
                    matched.add(p2.userId);
                    this.leaveQueue(p1.userId);
                    this.leaveQueue(p2.userId);

                    if (this.onMatchFound) {
                        this.onMatchFound(p1, p2, p1.isCasual ? 'casual' : 'ranked');
                    }
                    break;
                }
            }
        }
    }
};

// Start Matchmaking Cycle
setInterval(() => module.exports.processQueue(), 3000);
