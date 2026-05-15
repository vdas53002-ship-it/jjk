const db = require('../database');
const characters = require('../utils/data/characters');
const questService = require('./questService');

/**
 * Gacha Service: Algorithmic Summoning & Pity Management
 */
module.exports = {
    RATES: {
        legendary: 200, // 2% (Down from 5%)
        epic: 1300,     // 13% (Down from 15%)
        rare: 3500,     // 35% (Up from 30%)
        common: 5000    // 50%
    },

    DUST_VALUES: {
        Legendary: 100,
        Epic: 40,
        Rare: 15,
        Common: 5
    },

    /**
     * Performs a single gacha pull for a user.
     * @param {Object} user - User document
     */
    async pull(user) {
        // 1. Pity Check (Force Legendary at 100 non-L pulls)
        let forceLegendary = false;
        user.pityCount = (user.pityCount || 0) + 1;
        
        if (user.pityCount >= 100) {
            forceLegendary = true;
        }
        
        let rarity = 'Common';
        const roll = Math.floor(Math.random() * 10000) + 1;

        if (forceLegendary || roll <= this.RATES.legendary) {
            rarity = 'Legendary';
            user.pityCount = 0; // Reset pity
        } else if (roll <= this.RATES.legendary + this.RATES.epic) {
            rarity = 'Epic';
        } else if (roll <= this.RATES.legendary + this.RATES.epic + this.RATES.rare) {
            rarity = 'Rare';
        }

        // 2. Select Character from Pool (EXCLUDING MYTHIC)
        const pool = Object.values(characters).filter(c => c.rarity === rarity && c.rarity !== 'Mythic');
        const character = pool[Math.floor(Math.random() * pool.length)];

        // 3. Duplicate Handling
        const roster = await db.roster.find({ userId: user.telegramId });
        const alreadyOwned = roster.some(r => r.charId === character.name);
        
        let isNew = true;
        let dustEarned = 0;

        if (alreadyOwned) {
            isNew = false;
            const shards = user.shards || {};
            const currentShards = shards[character.name] || 0;
            
            if (currentShards >= 3) {
                dustEarned = this.DUST_VALUES[rarity];
                user.dust = (user.dust || 0) + dustEarned;
            } else {
                shards[character.name] = currentShards + 1;
                user.shards = shards;
            }
        } else {
            await db.roster.insert({
                userId: user.telegramId,
                charId: character.name,
                level: 1,
                xp: 0,
                rarity: character.rarity,
                upgrades: {},
                shards: 0,
                lastUpdated: new Date()
            });
        }

        await questService.updateProgress(user.telegramId, 'gacha_pull');
        
        return {
            character,
            isNew,
            dustEarned,
            pityCount: user.pityCount,
            isPity: forceLegendary
        };
    },

    /**
     * Performs 10 pulls in sequence.
     */
    async bulkPull(user) {
        const results = [];
        let totalDust = 0;
        let newCount = 0;

        for (let i = 0; i < 10; i++) {
            const res = await this.pull(user);
            results.push(res);
            totalDust += res.dustEarned;
            if (res.isNew) newCount++;
        }

        // Finalize DB state for bulk
        await db.users.update({ telegramId: user.telegramId }, {
            $set: { 
                pityCount: user.pityCount, 
                dust: user.dust || 0,
                shards: user.shards || {}
            }
        });

        return {
            results,
            totalDust,
            newCount,
            pityCount: user.pityCount
        };
    }
};
