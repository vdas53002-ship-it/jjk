const characters = require('../utils/data/characters');
const db = require('../database');

/**
 * Explore Service: Manages 1v1 encounter generation and capture logic.
 */
class ExploreService {
    constructor() {
        this.locks = new Set();
        this.CONSTANTS = {
            STAMINA_COST: 0,
            MAX_STAMINA: 100,
            REFILL_MINUTES: 5,
            DAILY_EXPLORE_LIMIT: 1000,
            DAILY_CATCH_LIMIT: 10,
            COOLDOWN_SEC: 5,
            MAX_STEPS: 3,
            
            // Base Rates
            BASE_CHANCES: {
                "Common": 0.35,
                "Rare": 0.18,
                "Epic": 0.08,
                "Legendary": 0.03,
                "Mythic": 0.005
            },
// ... (REWARDS)

            // WIN REWARDS
            REWARDS: {
                "Common": { coins: 30, xp: 15 },
                "Rare": { coins: 60, xp: 25 },
                "Epic": { coins: 120, xp: 40 },
                "Legendary": { coins: 250, xp: 70 },
                "Mythic": { coins: 1000, xp: 200 }
            },
            LOSS_REWARDS: { coins: 20, xp: 5 }
        };

        this.BIOMES = {
            "TIER_1": {
                id: "TIER_1",
                name: "🏮 Haunted Outskirts",
                desc: "Low-level spirits (Lv.1+).",
                minLevel: 1,
                multiplier: 1.0,
                probabilities: { "Common": 0.84, "Rare": 0.10, "Epic": 0.05, "Legendary": 0.01, "Mythic": 0.0 }
            },
            "TIER_2": {
                id: "TIER_2",
                name: "🏚️ Cursed Urban District",
                desc: "Stronger curses (Lv.20+).",
                minLevel: 20,
                multiplier: 1.8,
                probabilities: { "Common": 0.35, "Rare": 0.50, "Epic": 0.12, "Legendary": 0.03, "Mythic": 0.0 }
            },
            "TIER_3": {
                id: "TIER_3",
                name: "🏯 Special Grade Territory",
                desc: "Special Grade threats (Lv.50+).",
                minLevel: 50,
                multiplier: 3.5,
                probabilities: { "Common": 0.0, "Rare": 0.20, "Epic": 0.70, "Legendary": 0.08, "Mythic": 0.02 }
            }
        };

        this.CONSTANTS.REWARDS = {
            "Common": { coins: 100, xp: 50, dust: 20, shards: 5 },
            "Rare": { coins: 300, xp: 120, dust: 50, shards: 15 },
            "Epic": { coins: 1000, xp: 400, dust: 150, shards: 50 },
            "Legendary": { coins: 5000, xp: 1500, dust: 500, shards: 200 },
            "Mythic": { coins: 20000, xp: 10000, dust: 2000, shards: 1000 }
        };
    }

    acquireLock(userId) {
        if (this.locks.has(userId)) return false;
        this.locks.add(userId);
        // Safety timeout to prevent permanent locks
        setTimeout(() => this.locks.delete(userId), 15000); 
        return true;
    }

    releaseLock(userId) {
        this.locks.delete(userId);
    }

    async rollEncounter(biomeKey = "ACADEMY", forceRarity = null) {
        const biome = this.BIOMES[biomeKey] || this.BIOMES["ACADEMY"];
        const roll = Math.random();
        let cumulative = 0;
        let selectedRarity = forceRarity || "Common";

        if (!forceRarity) {
            for (const [rarity, chance] of Object.entries(biome.probabilities)) {
                cumulative += chance;
                if (roll <= cumulative) {
                    selectedRarity = rarity;
                    break;
                }
            }
        }

        const pool = Object.values(characters).filter(c => c.rarity === selectedRarity);
        if (pool.length === 0) return this.rollEncounter("ACADEMY");

        const selected = pool[Math.floor(Math.random() * pool.length)];

        return {
            character: selected,
            rarity: selectedRarity,
            biome: biomeKey,
            catchable: this.CONSTANTS.BASE_CHANCES[selectedRarity] > 0
        };
    }

    getRandomEvent(currentStep) {
        const events = [
            { type: 'battle', weight: 60, icon: '⚔️', name: 'CURSED SPIRIT' },
            { type: 'scavenge', weight: 20, icon: '📦', name: 'TREASURE CACHE' },
            { type: 'mystery', weight: 10, icon: '❔', name: 'SHADOWY FIGURE' },
            { type: 'rest', weight: 10, icon: '⛺', name: 'SAFE ZONE' }
        ];

        // Boss on final step
        if (currentStep >= this.CONSTANTS.MAX_STEPS) return events[0];

        const roll = Math.random() * 100;
        let cumulative = 0;
        for (const e of events) {
            cumulative += e.weight;
            if (roll <= cumulative) return e;
        }
        return events[0];
    }

    generateStepReward(type) {
        const roll = Math.random();
        switch(type) {
            case 'scavenge': 
                const shardChance = Math.random() < 0.10;
                if (shardChance) return { shardsCurrency: 10, msg: "📦 <b>LUCKY FIND!</b>\nYou found a cache of Cursed Shards!\n🧩 +10 Shards" };
                return { coins: 250, dust: 10, msg: "📦 You found a supply crate!\n💰 +250 Coins\n✨ +10 Dust" };
            case 'treasure':
                const item = roll < 0.7 ? 'cursed_charm' : 'gacha_ticket';
                return { 
                    coins: 750, 
                    itemId: item, 
                    msg: `💎 <b>TREASURE CACHE!</b>\n💰 +750 Coins\n🎁 Found: 1x ${item.replace(/_/g, ' ').toUpperCase()}` 
                };
            case 'rest': 
                return { stamina: 50, msg: "🍵 A brief respite at a safe house.\n⚡ +50 Stamina restored." };
            case 'mystery': 
                if (roll < 0.4) return { shardsCurrency: 15, msg: "🌑 A shadow figure grants you power...\n🧩 +15 Shards found!" };
                return { coins: 200, xp: 150, msg: "📖 A wandering soul shares its knowledge.\n💰 +200 Coins\n📈 +150 XP" };
            default: return { coins: 20, msg: "💨 Just some wind through the ruins." };
        }
    }

    async calculateFinalCaptureChance(user, targetChar, battleData) {
        const base = this.CONSTANTS.BASE_CHANCES[targetChar.rarity] || 0.1;
        let finalChance = base;
        const modifiers = [];

        // 1. Capture Items
        if (battleData.usedItem === 'domain_essence') {
            return { finalChance: 1.0, modifiers: ["🌌 Domain Essence (100% Guaranteed)"] };
        }
        
        if (battleData.usedItem === 'grade_1_shackle') {
            finalChance += 0.30;
            modifiers.push("⛓ Grade-1 Shackle (+30%)");
        } else if (battleData.usedItem === 'cursed_seal_tag') {
            finalChance += 0.15;
            modifiers.push("🏷️ Cursed Seal (+15%)");
        } else if (battleData.usedItem === 'cursed_charm' || battleData.usedCharm || user.activeCursedCharm) {
            finalChance += 0.25;
            modifiers.push("🧿 Cursed Charm (+25%)");
        }

        // 2. HP Scaling
        const hpPct = (battleData.enemyHp / battleData.enemyMaxHp) * 100;
        if (hpPct < 15) {
            finalChance += 0.15;
            modifiers.push("🩸 Critical Health (+15%)");
        } else if (hpPct <= 40) {
            finalChance += 0.05;
            modifiers.push("🩹 Low Health (+5%)");
        }

        // 3. Damage Contribution (+10%)
        if (battleData.dmgP1Percent > 90) {
            finalChance += 0.10;
            modifiers.push("⚔️ Overwhelming Might (+10%)");
        }

        // 4. Black Flash Finisher (+10%)
        if (battleData.lastHitWasBlackFlash) {
            finalChance += 0.10;
            modifiers.push("⚡ Black Flash Finish (+10%)");
        }

        // 5. Duplicate Penalty (-30%)
        const alreadyOwns = await db.roster.findOne({ userId: user.telegramId, charId: targetChar.name });
        if (alreadyOwns) {
            finalChance -= 0.10;
            modifiers.push("🔄 Duplicate Bond (-10%)");
        } else {
            finalChance += 0.10;
            modifiers.push("✨ First Discovery (+10%)");
        }

        // 6. Level Gap Penalty (-10%)
        if (targetChar.level > (user.playerLevel || 1) + 10) {
            finalChance -= 0.10;
            modifiers.push("🏔 Level Gap (-10%)");
        }

        return {
            finalChance: Math.max(0.01, Math.min(0.80, finalChance)),
            modifiers
        };
    }

    syncStamina(user) {
        return null;
    }

    /**
     * Auto-Grind: Performs 10 automated hunts at once.
     * Rewards are standard, but character encounters are much rarer (30% of normal).
     * Automatically attempts a low-chance (5%) capture if a character is found.
     */
    async runAutoGrind(user, biomeKey = "TIER_1") {
        const batchSize = 10;
        const staminaCost = 50; // 5 per hunt
        const results = {
            coins: 0,
            dust: 0,
            xp: 0,
            charactersFound: [],
            shards: 0,
            staminaUsed: staminaCost
        };

        if ((user.stamina || 0) < staminaCost) {
            return { success: false, msg: `❌ Insufficient Stamina! You need 🔋 50 Stamina for this blitz.` };
        }

        const biome = this.BIOMES[biomeKey] || this.BIOMES["TIER_1"];
        
        for (let i = 0; i < batchSize; i++) {
            // 1. Base Rewards (Simulate 1 step of exploration)
            const event = this.getRandomEvent(1); // Usually a battle or scavenge
            
            if (event.type === 'battle') {
                // Reduced character chance (30% of normal)
                if (Math.random() < 0.30) {
                    const encounter = await this.rollEncounter(biomeKey);
                    
                    // Auto-Capture check (Flat 5% chance)
                    if (Math.random() < 0.05) {
                        results.charactersFound.push(encounter.character.name);
                    } else {
                        // Consolation prize for finding but not catching
                        results.coins += 50;
                    }
                } else {
                    // Standard trash mob reward
                    results.coins += 30;
                    results.xp += 15;
                }
            } else {
                const reward = this.generateStepReward(event.type);
                results.coins += (reward.coins || 0);
                results.dust += (reward.dust || 0);
                results.xp += (reward.xp || 0);
                results.shards += (reward.shardsCurrency || 0);
            }
        }

        return { success: true, ...results };
    }

    checkDailyReset(user) {
        if (!user) return null;
        const now = new Date();
        const lastReset = user.lastDailyReset ? new Date(user.lastDailyReset) : new Date(0);
        
        if (now.getUTCDate() !== lastReset.getUTCDate() || now.getUTCMonth() !== lastReset.getUTCMonth()) {
            return {
                dailyExploreCount: 0,
                dailyCatchCount: 0,
                lastDailyReset: now.getTime()
            };
        }
        return null;
    }
}

module.exports = new ExploreService();
