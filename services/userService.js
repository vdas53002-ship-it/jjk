const db = require('../database');
const questService = require('./questService');
const achievementService = require('./achievementService');

/**
 * User Service: Advanced Leveling & Rewards (Character vs Player)
 */
module.exports = {
    // Milestone rewards for Player Level
    MILESTONES: {
        2: { coins: 100 },
        5: { gachaTickets: 1 },
        10: { items: [{ id: 'rare_upgrade', qty: 1 }] },
        15: { coins: 200, items: [{ id: 'ce_charge', qty: 1 }] },
        20: { items: [{ id: 'domain_fragment', qty: 1 }] },
        25: { title: "Jujutsu Sorcerer" },
        30: { gachaTickets: 5 },
        40: { message: "Epic Character Shard unlocked!" }, 
        50: { items: [{ id: 'legendary_shard', qty: 1 }] },
        100: { title: "Special Grade", message: "Exclusive Skin Awarded!" }
    },

    /**
     * Advanced Reward Logic (GDD spec)
     * @param {Object} ctx - Context (for metadata like battles count)
     * @param {string} mode - 'training_easy', 'training_hard', 'casual', 'ranked'
     * @param {boolean} won - Whether won
     * @param {number} streak - Win streak
     */
    async addAdvancedRewards(userId, mode, won, streak = 0, customCoins = null, customXp = null, customDust = null) {
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return;

        // 1. Identify Reward Coefficients
        const modeMap = {
            'training_easy':   { charXp: won ? 10 : 2,  playerXp: won ? 10 : 5,  coins: won ? 20 : 10 },
            'training_normal': { charXp: won ? 20 : 5,  playerXp: won ? 20 : 8,  coins: won ? 40 : 15 },
            'training_hard':   { charXp: won ? 30 : 10, playerXp: won ? 30 : 10, coins: won ? 60 : 20 },
            'casual':          { charXp: won ? 25 : 10, playerXp: won ? 25 : 10, coins: won ? 50 : 20 }, 
            'ranked':          { charXp: won ? 40 : 15, playerXp: won ? 40 : 15, coins: won ? 100 : 30 },
            'challenge':       { charXp: won ? 20 : 5,  playerXp: won ? 20 : 10, coins: won ? 40 : 15 }
        };

        const base = modeMap[mode] || (mode === 'custom' ? { charXp: 0, playerXp: customXp || 0, coins: customCoins || 0 } : modeMap['training_easy']);

        // 2. Base Gain
        let coinGain = customCoins !== null ? customCoins : base.coins;
        
        // Ranked Streak Bonus (Win 3 in a row → +100 extra coins)
        if (mode === 'ranked' && won && streak >= 3) {
            coinGain += 100;
        }

        // Hard Training Bonus (10% random common item)
        if (mode === 'training_hard' && won && Math.random() < 0.10) {
            const commonItems = ['minor_potion', 'ce_charge', 'lucky_charm'];
            const drop = commonItems[Math.floor(Math.random() * commonItems.length)];
            const inv = user.inventory || [];
            const idx = inv.findIndex(i => i.id === drop);
            if (idx > -1) inv[idx].qty += 1;
            else inv.push({ id: drop, qty: 1 });
            user.inventory = inv;
        }

        // New Player Boost (First 14 days = 2x Coins, except custom)
        const regDate = new Date(user.registrationDate || 0);
        const daysSinceReg = (new Date() - regDate) / (1000 * 60 * 60 * 24);
        if (daysSinceReg <= 14 && mode !== 'custom') coinGain *= 2; 

        // Daily Cap (2000)
        const today = new Date().toISOString().slice(0, 10);
        if (user.lastCoinDate !== today) { user.coinsEarnedToday = 0; user.lastCoinDate = today; }
        coinGain = Math.min(coinGain, 2000 - (user.coinsEarnedToday || 0));
        
        user.coins = (user.coins || 0) + coinGain;
        user.coinsEarnedToday = (user.coinsEarnedToday || 0) + coinGain;

        // 2.2 Dust Gain (Pokemon Style Stardust)
        let dustGain = customDust !== null ? customDust : (won ? 10 : 2);
        if (mode.includes('hard') || mode === 'ranked') dustGain += 10;
        user.dust = (user.dust || 0) + dustGain;

        // 2.5 Quest Progress
        if (mode.startsWith('training') && won) await questService.updateProgress(userId, 'training_win');
        if (mode === 'ranked') await questService.updateProgress(userId, 'ranked_play');

        // 3. Player Experience & Milestones
        const playerXpGain = customXp !== null ? customXp : (won ? base.playerXp : Math.floor(base.playerXp / 2));
        user.playerXp = (user.playerXp || 0) + playerXpGain;
        
        const nextPlayerXp = (user.playerLevel || 1) * 50;
        let leveledUp = false;
        if (user.playerXp >= nextPlayerXp) {
            user.playerLevel = (user.playerLevel || 1) + 1;
            user.playerXp = 0;
            user.stamina = Math.min(100, (user.stamina || 0) + 20); // GDD: +20 Stamina on Level Up
            leveledUp = true;
            const m = this.MILESTONES[user.playerLevel];
            if (m) {
                if (m.coins) user.coins += m.coins;
                if (m.gachaTickets) user.gachaTickets = (user.gachaTickets || 0) + m.gachaTickets;
                if (m.title) user.title = m.title;
                if (m.items) {
                    const inv = user.inventory || [];
                    m.items.forEach(itm => {
                        const idx = inv.findIndex(i => i.id === itm.id);
                        if (idx > -1) inv[idx].qty += itm.qty;
                        else inv.push(itm);
                    });
                    user.inventory = inv;
                }
            }
        }

        // 4. Character XP (Scaling level * 10)
        const charXpGain = base.charXp;
        const roster = await db.roster.find({ userId: userId });
        const levelCaps = { 'Iron': 10, 'Bronze': 20, 'Silver': 30, 'Gold': 40, 'Special Grade': 50 };
        const maxLevelByRank = levelCaps[user.rank] || 50;

        for (const charId of user.teamIds) {
            if (!charId) continue;
            const entry = roster.find(r => r.charId === charId);
            if (entry) {
                // If not at cap
                if (entry.level < maxLevelByRank) {
                    entry.xp = (entry.xp || 0) + charXpGain;
                    const needed = entry.level * 10;
                    if (entry.xp >= needed) {
                        entry.level += 1;
                        entry.xp = 0;
                    }
                    await db.roster.update({ _id: entry._id }, { $set: { level: entry.level, xp: entry.xp } });
                }
            }
        }

        user.battles = (user.battles || 0) + 1;
        
        await db.users.update({ telegramId: userId }, {
            $set: {
                coins: user.coins,
                coinsEarnedToday: user.coinsEarnedToday,
                lastCoinDate: user.lastCoinDate,
                dust: user.dust,
                playerXp: user.playerXp,
                playerLevel: user.playerLevel,
                stamina: user.stamina,
                inventory: user.inventory,
                title: user.title,
                gachaTickets: user.gachaTickets,
                battles: user.battles
            }
        });
        
        let achievementMsg = "";
        if (won) {
            const achs = await achievementService.updateProgress(userId, 'PVP', 1);
            if (achs && achs.length > 0) {
                achievementMsg = `\n\n🏆 <b>ACHIEVEMENT UNLOCKED!</b>\n` + achs.map(a => `✨ ${a.label}`).join('\n');
            }
        }

        return { user, coinGain, playerXpGain, charXpGain, dustGain, leveledUp, playerLevel: user.playerLevel, achievementMsg };
    },

    getGradeByLevel(level) {
        if (level < 20) return "Grade 4";
        if (level < 40) return "Grade 3";
        if (level < 60) return "Grade 2";
        if (level < 80) return "Grade 1";
        return "Special Grade";
    },

    /**
     * Stat Calculation with Level 50 scaling specs and Awakening Stars
     */
    calculateFinalStats(rosterEntry, baseChar, clanMult = 1.0) {
        const level = rosterEntry.level || 1;
        const stars = rosterEntry.stars || 0; // Awakening Level (0 to 5)
        
        // Base Level Ups (+15 HP/level, +1.5 ATK/level, +2 CE/level)
        const levelHp = (level - 1) * 15;
        const levelAtk = (level - 1) * 1.5;
        const levelCe = (level - 1) * 2;
        
        const rawMaxHp = (baseChar.maxHp || 200) + levelHp;
        const rawAtk = (baseChar.atk || 15) + levelAtk;
        const rawCe = (baseChar.maxCe || 100) + levelCe;
        
        // Awakening Multiplier (+15% per Star)
        const starMult = 1.0 + (stars * 0.15);
        
        const finalMaxHp = Math.floor(rawMaxHp * starMult * clanMult);
        const finalAtk = Math.floor(rawAtk * starMult * clanMult);
        const finalCe = Math.floor(rawCe * starMult * clanMult);
        
        const dynamicGrade = this.getGradeByLevel(level);
        
        return {
            ...baseChar,
            ...rosterEntry,
            grade: dynamicGrade, 
            hp: finalMaxHp, 
            maxHp: finalMaxHp,
            ce: finalCe,   
            maxCe: finalCe,
            atk: finalAtk,
            speed: baseChar.speed || 10,
            resilience: baseChar.resilience || 10,
            level: level,
            stars: stars,
            energyType: baseChar.energyType || 'CE'
        };
    }
};
