const exploreService = require('../../services/exploreService');
const achievementService = require('../../services/achievementService');
const media = require('../media');
const ui = require('../ui');
const db = require('../../database');
const characters = require('../data/characters');
const questService = require('../../services/questService');
const { Markup } = require('telegraf');

/**
 * Explore Handler: Manages the discovery of wild characters.
 */
module.exports = {
    async handleExplore(ctx) {
        try {
            let user = await db.users.findOne({ telegramId: ctx.from.id });
            if (!user) return ctx.reply("Please /start first.");

            // Sync Daily Limits
            const dailyReset = exploreService.checkDailyReset(user);
            if (dailyReset) {
                await db.users.update({ telegramId: user.telegramId }, { $set: dailyReset });
                user = { ...user, ...dailyReset };
            }

            // 1. Direct Spawn Strategy (Tier Selection)
            if (user.activeExplore && user.activeExplore.status === 'found') {
                return this.handleResume(ctx);
            }

            // Show 3 Tiers for spawning
            const msg = ui.formatHeader("CURSED EXPEDITION", "EXPLORE") + "\n\n" +
                "Select the manifestation level for your hunt:\n\n" +
                "🏮 <b>Outskirts:</b> Grades 4-2 (Lv.1+)\n" +
                "🏚️ <b>District:</b> Grades 2-1 (Lv.20+)\n" +
                "🏯 <b>Territory:</b> Special Grades (Lv.50+)";

            const kb = Markup.inlineKeyboard([
                [Markup.button.callback('🏮 HAUNTED OUTSKIRTS', 'exp_init_TIER_1')],
                [Markup.button.callback('🏚️ CURSED DISTRICT', 'exp_init_TIER_2')],
                [Markup.button.callback('🏯 SPECIAL GRADE TERRITORY', 'exp_init_TIER_3')],
                [Markup.button.callback('🏠 BACK', 'back_to_hub')]
            ]);

            return ctx.replyWithHTML(msg, kb);

        } catch (error) {
            console.error("[Explore Error]", error);
            return ctx.reply("❌ Cursed instability. Return to Jujutsu High.");
        }
    },

    async handleNextStep(ctx) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        if (!user.activeExplore) {
            if (ctx.callbackQuery) return ctx.answerCbQuery("Expedition ended.");
            return ctx.reply("Expedition ended.");
        }
        
        const nextStep = user.activeExplore.step;
        if (nextStep > exploreService.CONSTANTS.MAX_STEPS) {
            await db.users.update({ telegramId: ctx.from.id }, { $set: { activeExplore: null } });
            return ctx.reply("Expedition Completed! Return to High.");
        }

        if (ctx.callbackQuery) await ctx.answerCbQuery("Moving forward...");
        return this.processStep(ctx, user.telegramId, nextStep, user.activeExplore.biome);
    },
    
    async startNewExplore(ctx, user, biomeKey = "TIER_1") {
        const userId = ctx.from.id;
        if (!exploreService.acquireLock(userId)) {
            if (ctx.callbackQuery) return ctx.answerCbQuery("⏳ Expedition already starting...");
            return ctx.reply("⏳ Expedition already starting...");
        }
        
        try {
            if (!user) user = await db.users.findOne({ telegramId: userId });
            
            if (user.activeExplore && user.activeExplore.status !== 'completed' && user.activeExplore.status !== 'started') {
                // Ignore the lock if we are already in the middle of something (shouldn't happen with new logic)
            }

            const biome = exploreService.BIOMES[biomeKey] || exploreService.BIOMES["ACADEMY"];

            // 1. Level Lock Check
            if ((user.playerLevel || 1) < biome.minLevel) {
                if (ctx.callbackQuery) return ctx.answerCbQuery(`🔒 Access Denied! Reach Level ${biome.minLevel} to enter this grade.`, { show_alert: true });
                return ctx.reply(`🔒 Access Denied! Reach Level ${biome.minLevel} to enter this grade.`);
            }

            // 2. Cooldown Check
            const now = Date.now();
            const lastAction = user.lastExploreTime || 0;
            const secondsSinceLast = Math.floor((now - lastAction) / 1000);
            if (secondsSinceLast < exploreService.CONSTANTS.COOLDOWN_SEC) {
                if (ctx.callbackQuery) return ctx.answerCbQuery(`⌛ Stabilizing... Wait ${exploreService.CONSTANTS.COOLDOWN_SEC - secondsSinceLast}s.`, { show_alert: true });
                return ctx.reply(`⌛ Stabilizing... Wait ${exploreService.CONSTANTS.COOLDOWN_SEC - secondsSinceLast}s.`);
            }

            // 3. Daily Explore Limit
            if ((user.dailyExploreCount || 0) >= exploreService.CONSTANTS.DAILY_EXPLORE_LIMIT) {
                return ctx.reply(`📅 Daily expeditions (${exploreService.CONSTANTS.DAILY_EXPLORE_LIMIT}/${exploreService.CONSTANTS.DAILY_EXPLORE_LIMIT}) exhausted.`);
            }

            // 4. Update Explore Count & Initialize Step 1
            await db.users.update({ telegramId: user.telegramId }, { 
                $inc: { dailyExploreCount: 1 },
                $set: { lastExploreTime: now, activeExplore: { biome: biomeKey, step: 1, status: 'started' } }
            });

            await questService.updateProgress(user.telegramId, 'explore_count');

            if (ctx.callbackQuery) await ctx.answerCbQuery("Entering Expedition...");
            const res = await this.processStep(ctx, user.telegramId, 1, biomeKey);
            exploreService.releaseLock(userId);
            return res;
        } catch (error) {
            exploreService.releaseLock(userId);
            console.error("[StartNewExplore Error]", error);
            return ctx.reply("❌ The spirit escaped into the folds. Try again.");
        }
    },

    async processStep(ctx, userId, step, biomeKey) {
        const biome = exploreService.BIOMES[biomeKey];
        const event = exploreService.getRandomEvent(step);
        const progress = `[ ${"⏹ ".repeat(step)}${"⏺ ".repeat(exploreService.CONSTANTS.MAX_STEPS - step)}]`;

        if (event.type === 'battle') {
            // Roll encounter for battle
            const forceBoss = step >= exploreService.CONSTANTS.MAX_STEPS;
            const forceRarity = forceBoss ? (biomeKey === 'SHIBUYA' ? 'Legendary' : 'Epic') : null;
            const encounter = await exploreService.rollEncounter(biomeKey, forceRarity);
            const char = characters[encounter.character.name];

            const rarityMod = { Common: -5, Rare: 0, Epic: 5, Legendary: 15, Mythic: 30 };
            const wildLevel = Math.max(1, 1 + (rarityMod[encounter.rarity] || 0));
            const wildHp = char.hp + (wildLevel * 10);
            const wildCe = char.ce + (wildLevel * 2);

            await db.users.update({ telegramId: userId }, {
                $set: {
                    activeExplore: {
                        name: char.name,
                        rarity: encounter.rarity,
                        wildLevel: wildLevel,
                        biome: biomeKey,
                        step: step,
                        status: 'found',
                        lastStepTime: Date.now()
                    }
                }
            });

            const stats = `🗺 <b>Location:</b> ${biomeKey.toUpperCase()}\n` +
                          `📊 <b>Level:</b> ${wildLevel}\n` +
                          `🧬 <b>Style:</b> ${char.rarity} [Type ${ui.formatHeader("", "BATTLE").split(' ')[1]}]`;

            const msg = ui.formatHeader(forceBoss ? "GUILTY BOSS" : "WILD ENCOUNTER", "EXPLORE") + "\n\n" +
                `⚡ <b>A wild ${char.name.toUpperCase()} appeared!</b>\n\n` +
                `      Grade: <b>${char.grade || 'Unrated'}</b>\n` +
                `      HP: <b>${wildHp}</b> / CE: <b>${wildCe}</b>\n\n` +
                "⚔️ <i>Initiate the clash?</i>";

            const kb = Markup.inlineKeyboard([
                [Markup.button.callback('⚔️ BATTLE START', `exp_f:${wildLevel}:${char.name}`)],
                [Markup.button.callback('🕸️ CATCH', `exp_catch_menu_${char.name}`)],
                [Markup.button.callback('🏃 CANCEL', 'exp_cancel_hunt')]
            ]);

            return media.sendPortrait(ctx, char, msg, kb);

        } else {
            // Resolve non-combat event
            const reward = exploreService.generateStepReward(event.type);
            const userData = await db.users.findOne({ telegramId: userId });
            
            // 1. Currency/XP
            const setOps = { "activeExplore.step": step + 1 };
            const incOps = { 
                coins: reward.coins || 0, 
                stamina: reward.stamina || 0, 
                dust: reward.dust || 0,
                playerXp: reward.xp || 0
            };

            // 2. Inventory Item Addition
            if (reward.itemId) {
                const inv = userData.inventory || [];
                const invIdx = inv.findIndex(i => i.id === reward.itemId);
                if (invIdx > -1) {
                    await db.users.update({ telegramId: userId, "inventory.id": reward.itemId }, { 
                        $inc: { "inventory.$.qty": 1 } 
                    });
                } else {
                    await db.users.update({ telegramId: userId }, { 
                        $push: { inventory: { id: reward.itemId, qty: 1 } } 
                    });
                }
            }

            await db.users.update({ telegramId: userId }, { $set: setOps, $inc: incOps });

            const msg = ui.formatHeader(event.name, "EXPLORE") + "\n" +
                `<b>${progress}</b>\n\n` +
                `${event.icon} <b>Room ${step}: ${event.name}</b>\n\n` +
                ui.panel(reward.msg) + "\n\n" +
                "<i>You investigate the area and recover the spoils.</i>";

            // Achievement Progress
            const achs = await achievementService.updateProgress(userId, 'EXPLORE', 1);
            if (achs && achs.length > 0) {
                msg += `\n\n🏆 <b>ACHIEVEMENT UNLOCKED!</b>\n` + achs.map(a => `✨ ${a.label}`).join('\n');
            }

            const kb = Markup.inlineKeyboard([
                [Markup.button.callback(step >= 3 ? '🗺 COMPLETE EXPEDITION' : '🚪 NEXT ROOM', step >= 3 ? 'cmd_explore' : `exp_next`)],
                [Markup.button.callback('🏠 EXIT', 'back_to_hub')]
            ]);

            return media.sendBanner(ctx, biomeKey || event.type || "Explore", msg, kb);
        }
    },

    async initiateWildBattle(ctx, charName, useCharm = false, wildLevel = 1) {
        await db.users.update({ telegramId: ctx.from.id }, { 
            $set: { "activeExplore.status": 'battling', "activeExplore.usedCharm": useCharm } 
        });
        
        const msgId = (ctx.callbackQuery && ctx.callbackQuery.message) ? ctx.callbackQuery.message.message_id : null;
        if (ctx.callbackQuery) await ctx.answerCbQuery("Entering encounter...");
        
        return ctx.scene.enter('training', { 
            wildTarget: charName, 
            useCharm, 
            wildLevel: parseInt(wildLevel),
            parentMsgId: msgId
        });
    },

    async handleCancelHunt(ctx) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        const oldEnemy = user.activeExplore ? user.activeExplore.name : "Spirit";
        
        await db.users.update({ telegramId: ctx.from.id }, { $set: { activeExplore: null } });
        if (ctx.callbackQuery) await ctx.answerCbQuery(`🌫️ The expedition has been cancelled.`, { show_alert: false });
        
        return ctx.replyWithHTML("🕊 <b>Expedition Abandoned.</b>\nThe spirit fades back into the shadows.");
    },

    async handleResume(ctx) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        if (!user.activeExplore) {
            if (ctx.callbackQuery) return ctx.answerCbQuery("Encounter lost.");
            return ctx.reply("Encounter lost.");
        }
        
        const char = characters[user.activeExplore.name];
        if (!char) {
            if (ctx.callbackQuery) return ctx.answerCbQuery("Invalid target.");
            return ctx.reply("Invalid target.");
        }

        const msg = ui.formatHeader("CURSED DISCOVERY") + "\n\n" +
            `🎭 <b>Encounter:</b> ${char.name} (Waiting)\n` +
            `💎 <b>Rarity:</b> ${user.activeExplore.rarity}\n\n` +
            "Your discovery is still waiting. Don't let it escape!";

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('⚔️ BATTLE START', `exp_f:${user.activeExplore.wildLevel}:${char.name}`)],
            [Markup.button.callback('🕸️ CATCH', `exp_catch_menu_${char.name}`)],
            [Markup.button.callback('🏃 CANCEL', 'exp_cancel_hunt')]
        ]);

        if (ctx.callbackQuery) await ctx.answerCbQuery("Resuming encounter...");
        return media.sendPortrait(ctx, char, msg, kb);
    },

    async handleCaptureMenu(ctx, charName) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        const char = characters[charName];
        
        if (!char) {
            if (ctx.callbackQuery) return ctx.answerCbQuery("Invalid target.");
            return ctx.reply("Invalid target.");
        }

        const catchItems = [
            { id: 'cursed_seal_tag', name: 'Cursed Seal Tag', icon: '🏷️' },
            { id: 'grade_1_shackle', name: 'Grade-1 Shackle', icon: '⛓' },
            { id: 'domain_essence', name: 'Domain Essence', icon: '🌌' }
        ];

        const available = catchItems.filter(item => {
            const inv = user.inventory || [];
            return inv.some(i => i.id === item.id && i.qty > 0);
        });

        if (available.length === 0) {
            if (ctx.callbackQuery) return ctx.answerCbQuery("❌ You have no capture tools! Buy some from the /shop.", { show_alert: true });
            return ctx.reply("❌ You have no capture tools! Buy some from the /shop.");
        }

        let msg = ui.formatHeader("SELECT CAPTURE TOOL") + "\n\n" +
            `🎯 <b>Target:</b> ${char.name}\n` +
            `🎒 <b>Your Inventory:</b>\n\n` +
            "Choose a tool to manifest your power and seal the spirit:";

        const kb = available.map(item => [
            Markup.button.callback(`${item.icon} Use ${item.name}`, `tool_cap_${item.id.split('_').pop()}_${char.name}`)
        ]);
        
        kb.push([Markup.button.callback('⬅️ Back', `exp_resume`)]);

        if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => null);
        return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    },

    async executeCapture(ctx, charName, toolId = null) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        const exploreData = user.activeExplore;
        
        if (!exploreData || exploreData.name !== charName) {
            if (ctx.callbackQuery) return ctx.answerCbQuery("❌ Explore session vanished.");
            return ctx.reply("❌ Explore session vanished.");
        }

        const char = characters[charName];
        
        // 1. Daily Catch Check
        if ((user.dailyCatchCount || 0) >= exploreService.CONSTANTS.DAILY_CATCH_LIMIT) {
            return ctx.reply("❌ Your daily capture capacity is full. You can still battle, but this spirit broke free!");
        }

        // 2. Consume Item (if toolId)
        if (toolId) {
            const hasItem = (user.inventory || []).find(i => i.id === toolId && i.qty > 0);
            if (!hasItem) {
                if (ctx.callbackQuery) return ctx.answerCbQuery("❌ You don't have this item!", { show_alert: true });
                return ctx.reply("❌ You don't have this item!");
            }
            
            await db.users.update({ telegramId: userId, "inventory.id": toolId }, { 
                $inc: { "inventory.$.qty": -1 } 
            });
        }

        // 3. Perform Capture Roll (Use service)
        // Check for passive charm if no manual tool is used
        let passiveCharm = false;
        if (!toolId) {
            passiveCharm = (user.inventory || []).some(i => i.id === 'cursed_charm' && i.qty > 0);
        }

        const captureRes = await exploreService.calculateFinalCaptureChance(user, char, {
            usedItem: toolId,
            usedCharm: passiveCharm,
            enemyHp: 1,
            enemyMaxHp: 100,
            lastHitWasBlackFlash: true
        });

        const roll = Math.random();
        const success = roll <= captureRes.finalChance;

        let msg = "";
        const step = (user.activeExplore && user.activeExplore.step) || 1;
        const isExpedition = !!user.activeExplore;

        const nextBtn = (isExpedition && step <= 3) 
            ? Markup.button.callback('🚪 NEXT ROOM', 'exp_next') 
            : Markup.button.callback('🔙 BACK TO HUB', 'back_to_hub');

        const kb = Markup.inlineKeyboard([
            [nextBtn]
        ]);

        if (success) {
            msg = ui.formatHeader("✨ CAPTURE SUCCESS ✨", "EXPLORE") + "\n\n" +
                `Fantastic work! <b>${charName}</b> has joined your roster (Level 1).\n\n` +
                `🎯 <b>Chance:</b> ${Math.floor(captureRes.finalChance * 100)}%`;
            
            await db.roster.insert({ userId, charId: charName, level: 1, xp: 0 });
            await questService.updateProgress(userId, 'capture_count');
            
            const update = { $inc: { dailyCatchCount: 1 } };
            if (!isExpedition || step > 3) update.$set = { activeExplore: null };
            else update.$set = { "activeExplore.status": "ready" };

            await db.users.update({ telegramId: userId }, update);
        } else {
            msg = ui.formatHeader("❌ CAPTURE FAILED", "EXPLORE") + "\n\n" +
                `The wild ${charName} broke free and vanished!\n\n` +
                `🎯 <b>Chance:</b> ${Math.floor(captureRes.finalChance * 100)}%`;
            
            const update = { $inc: { coins: 50 } };
            if (!isExpedition || step > 3) update.$set = { activeExplore: null };
            else update.$set = { "activeExplore.status": "ready" };

            await db.users.update({ telegramId: userId }, update);
        }

        if (ctx.callbackQuery) await ctx.answerCbQuery(success ? "Captured!" : "Failed!");
        return media.sendPortrait(ctx, char, msg, kb);
    },

    async handleLetGo(ctx) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        const step = user.activeExplore?.step || 1;
        const isExpedition = !!user.activeExplore;

        const update = { $inc: { coins: 50 } };
        if (!isExpedition || step > 3) update.$set = { activeExplore: null };
        else update.$set = { "activeExplore.status": "ready" };

        await db.users.update({ telegramId: userId }, update);

        const nextBtn = (isExpedition && step <= 3) 
            ? Markup.button.callback('🚪 NEXT ROOM', 'exp_next') 
            : Markup.button.callback('🔙 BACK TO HUB', 'back_to_hub');

        if (ctx.callbackQuery) await ctx.answerCbQuery("🌿 You let the spirit go peacefully. +50 Coins.");
        return media.sendBanner(ctx, "Explore", "🕊 <b>The spirit fades away...</b>\nYou receive 50 coins for your restraint.",  Markup.inlineKeyboard([[nextBtn]]));
    },

    async showExploreStats(ctx) {
        let user = ctx.state.user;
        if (!user) return ctx.reply("Please /start first.");

        // Sync local data first
        const staminaSync = exploreService.syncStamina(user);
        if (staminaSync) {
            await db.users.update({ telegramId: user.telegramId }, { $set: staminaSync });
            user = { ...user, ...staminaSync };
        }

        const now = Date.now();
        const nextExplore = Math.max(0, exploreService.CONSTANTS.COOLDOWN_SEC - Math.floor((now - (user.lastExploreTime || 0)) / 1000));
        
        const inv = user.inventory || [];
        const getQty = (id) => (inv.find(i => i.id === id) || { qty: 0 }).qty;

        let msg = ui.formatHeader("EXPLORATION STATS", "EXPLORE") + "\n\n" +
            `🗺 <b>Expeditions:</b> ${user.dailyExploreCount || 0}/1000\n` +
            `🕸 <b>Captures:</b> ${user.dailyCatchCount || 0}/${exploreService.CONSTANTS.DAILY_CATCH_LIMIT}\n` +
            `⌛ <b>Cooldown:</b> ${nextExplore > 0 ? `${nextExplore}s` : 'READY!'}\n\n` +
            `ℹ️ <i>Stamina is no longer required for basic exploration.</i>\n\n` +
            `🎒 <b>BAG:</b>\n` +
            `▪️ Cursed Charms: ${getQty('cursed_charm')}\n` +
            `▪️ Energy Drinks: ${getQty('energy_drink')}`;

        return media.sendBanner(ctx, "Explore", msg);
    }
};

