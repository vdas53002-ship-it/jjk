const { Scenes, Markup } = require('telegraf');
const engine = require('../combat/engine');
const matchmaking = require('../../services/matchmaking');
const ui = require('../ui');
const db = require('../../database');
const characters = require('../data/characters');
const media = require('../media');

module.exports = {
    async handleQueue(ctx, isCasual = false) {
        const user = ctx.state.user;
        if (!user) return ctx.reply("Please /start first.");
        
        if (!isCasual) {
            if ((user.stamina || 0) < 10) {
                return ctx.reply("❌ Insufficient Stamina! Ranked matches require 🔋 10 Stamina.");
            }
            await db.users.update({ telegramId: user.telegramId }, { $inc: { stamina: -10 } });
        }

        const result = await matchmaking.joinQueue(user, isCasual);
        
        if (result.error) {
            return ctx.reply(result.error);
        }

        const mode = isCasual ? "CASUAL" : "RANKED";
        const scoreLabel = isCasual ? "TPS" : "ELO";
        const scoreValue = isCasual ? result.tps : (user.elo || 1000);
        const range = isCasual ? "±200" : "±100";

        const msg = ui.formatHeader(`🎮 ${mode} MATCH – SEARCHING`) + "\n\n" +
            `🔍 Searching for opponent...\n` +
            `Your ${scoreLabel}: <code>${scoreValue}</code>\n` +
            `Looking for ${scoreLabel} ${range}...\n\n` +
            `<i>Searching typically takes 5-30 seconds.</i>`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('❌ CANCEL', 'pvp_cancel_queue')]
        ]);

        return ctx.replyWithHTML(msg, kb);
    },

    async handleCancel(ctx) {
        matchmaking.leaveQueue(ctx.from.id);
        await ctx.answerCbQuery("Matchmaking canceled.");
        return ctx.editMessageText("❌ Matchmaking canceled. Return to the hub to try again.", { parse_mode: 'HTML' });
    },

    async startPvPBattle(p1, p2, mode, bot, chatId = null) {
        const u1 = await db.users.findOne({ telegramId: p1.userId });
        const u2 = await db.users.findOne({ telegramId: p2.userId });
        const r1 = await db.roster.find({ userId: p1.userId });
        const r2 = await db.roster.find({ userId: p2.userId });

        const hydrateTeam = (user, roster, clan = null) => {
            let clanMult = 1.0;
            if (clan && clan.leaderId === user.telegramId) {
                const members = clan.members.length || 1;
                clanMult = 1.0 + (Math.floor(members / 3) * 0.01); // 1% per 3 members
            }

            return user.teamIds.map(id => {
                if (!id || !characters[id]) return null;
                const data = roster.find(r => r.charId === id) || { level: 1 };
                return userService.calculateFinalStats(data, JSON.parse(JSON.stringify(characters[id])), clanMult);
            }).filter(c => c !== null);
        };

        const u1_clan = u1.clanId ? await db.clans.findOne({ _id: u1.clanId }) : null;
        const u2_clan = u2.clanId ? await db.clans.findOne({ _id: u2.clanId }) : null;

        const battle = engine.initBattle(
            { telegramId: u1.telegramId, username: u1.username, teamMembers: hydrateTeam(u1, r1, u1_clan) },
            { telegramId: u2.telegramId, username: u2.username, teamMembers: hydrateTeam(u2, r2, u2_clan) }
        );

        battle.mode = mode; // 'casual' or 'ranked' or 'duel'
        battle.status = 'active';
        battle.p1Choice = null;
        battle.p2Choice = null;
        battle.chatId = chatId; // For live GC updates
        battle.lastActionAt = Date.now(); 

        const inserted = await db.battles.insert(battle);
        const battleId = inserted._id;

        // Notify both players
        const msg = ui.formatHeader(`${mode.toUpperCase()} CLASH`, "BATTLE") + "\n\n" +
            `💥 CHALLENGER APPROACHES!\n\n` +
            `   ⚔️ @${u1.username} vs @${u2.username}\n\n` +
            "<i>Prepare your cursed techniques...</i>";

        const kb = Markup.inlineKeyboard([[Markup.button.callback('🚀 ENTER BATTLE', `pvp_enter_${battleId}`)]]);

        try {
            await bot.telegram.sendMessage(u1.telegramId, msg, { parse_mode: 'HTML', ...kb });
            await bot.telegram.sendMessage(u2.telegramId, msg, { parse_mode: 'HTML', ...kb });
            
            if (chatId) {
                const gcMsg = await bot.telegram.sendMessage(chatId, ui.formatHeader("🔥 LIVE DUEL BEGINS") + "\n\n" +
                    `⚔️ <a href="tg://user?id=${u1.telegramId}">${u1.username}</a> vs <a href="tg://user?id=${u2.telegramId}">${u2.username}</a>\n\n` +
                    `<i>Spectators, witness the clash!</i>`, { parse_mode: 'HTML' });
                await db.battles.update({ _id: battleId }, { $set: { groupMessageId: gcMsg.message_id } });
            }
        } catch (e) {
            console.error("Match notification error:", e);
        }
    },

    async handleEnter(ctx, battleId) {
        const battle = await db.battles.findOne({ _id: battleId });
        if (!battle || battle.status !== 'active') return ctx.answerCbQuery("❌ Battle expired.");
        
        const isP1 = ctx.from.id === battle.p1.id;
        const msgKey = isP1 ? 'p1Mid' : 'p2Mid';
        
        await db.battles.update({ _id: battleId }, { $set: { [msgKey]: ctx.callbackQuery.message.message_id, lastActionAt: Date.now() } });
        
        await ctx.answerCbQuery().catch(() => null);
        return this.renderBattle(ctx,  { ...battle, [msgKey]: ctx.callbackQuery.message.message_id });
    },

    async renderBattle(ctx, battle) {
        const p1 = battle.p1;
        const p2 = battle.p2;
        const isP1 = ctx.from.id === p1.id;
        const mySide = isP1 ? p1 : p2;
        const myActive = mySide.team[mySide.activeIdx];
        const msgId = isP1 ? battle.p1Mid : battle.p2Mid;

        const msg = ui.renderPokemonUI(battle, ctx.from.id);

        if (battle.status === 'finished') {
            const winnerId = battle.winnerId;
            const resultMsg = winnerId === ctx.from.id ? "\n\n🎉 VICTORY! Match concluded." : "\n\n💀 DEFEAT! Soul dissipated.";
            return ctx.telegram.editMessageCaption(ctx.chat.id, msgId, null, msg + resultMsg, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]]) }).catch(() => null);
        }

        const hasActed = isP1 ? !!battle.p1Choice : !!battle.p2Choice;
        if (hasActed) {
            return ctx.telegram.editMessageCaption(ctx.chat.id, msgId, null, msg + "\n⏳ Waiting for opponent...", { parse_mode: 'HTML' }).catch(() => null);
        }

        const moveButtons = myActive.moves.map((m, i) => {
            const cost = m.ce || 0;
            const label = cost > 0 ? `${m.name} [🌀${cost}]` : m.name;
            return Markup.button.callback(label, `pvp_atk_${battle._id}_${i}`);
        });
        const moveRows = [];
        for (let i = 0; i < moveButtons.length; i += 2) {
            moveRows.push(moveButtons.slice(i, i + 2));
        }

        const kb = Markup.inlineKeyboard([
            ...moveRows,
            [
                Markup.button.callback('🔄 Switch', `pvp_swi_${battle._id}`),
                Markup.button.callback('🏳️ Run', `pvp_surr_${battle._id}`),
                Markup.button.callback('🎒 Bag', `pvp_bag_${battle._id}`)
            ]
        ]);

        return media.sendBattleTurn(ctx, battle, ctx.from.id, kb, ctx.chat.id, msgId);
    },

    async handleMove(ctx, battleId, moveData) {
        const battle = await db.battles.findOne({ _id: battleId });
        if (!battle) return ctx.answerCbQuery("Battle not found.");
        if (battle.status !== 'active') return ctx.answerCbQuery("Battle has already ended.");
        if (battle.processing) return ctx.answerCbQuery("⏳ Processing turn... Please wait.");

        const isP1 = ctx.from.id === battle.p1.id;
        const isP2 = ctx.from.id === battle.p2.id;
        if (!isP1 && !isP2) return ctx.answerCbQuery("🚫 You are not a participant in this clash!", { show_alert: true });

        const choiceKey = isP1 ? 'p1Choice' : 'p2Choice';
        
        if (battle[choiceKey]) return ctx.answerCbQuery("Action already locked!");

        await db.battles.update({ _id: battleId }, { $set: { [choiceKey]: moveData, lastActionAt: Date.now() } });
        await ctx.answerCbQuery("Action locked!");

        const updated = await db.battles.findOne({ _id: battleId });
        if (updated.p1Choice && updated.p2Choice) {
            return this.resolveTurn(ctx, updated);
        } else {
            return this.renderBattle(ctx, updated);
        }
    },

    async resolveTurn(ctx, battle) {
        if (battle.processing) return;
        battle.processing = true;
        await db.battles.update({ _id: battle._id }, { $set: { processing: true } });

        const p1Choice = battle.p1Choice;
        const p2Choice = battle.p2Choice;
        const bot = ctx.telegram;

        try {
            const actors = engine.getOrderedActors(battle, p1Choice, p2Choice);
            battle.p1Choice = null;
            battle.p2Choice = null;
            
            for (let i = 0; i < actors.length; i++) {
                const actor = actors[i];
                const logs = engine.processAction(battle, actor);
                if (logs.length > 0) {
                    const cleanLogs = logs.filter(l => !l.includes("Round") && !l.includes("ROUND"));
                    if (cleanLogs.length > 0) {
                        battle.log.push(cleanLogs.join('\n'));
                        
                        const isLast = (i === actors.length - 1) && (battle.status === 'finished' || engine.postTurnCleanup(JSON.parse(JSON.stringify(battle))).length === 0);
                        
                        if (!isLast) {
                            await Promise.all([
                                this.pushUpdate(bot, battle, battle.p1.id, battle.p1Mid),
                                this.pushUpdate(bot, battle, battle.p2.id, battle.p2Mid)
                            ]);
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                }
                if (battle.status === 'finished') break;
            }

            if (battle.status !== 'finished') {
                const cleanupLogs = engine.postTurnCleanup(battle);
                if (cleanupLogs.length > 0) {
                    battle.log.push(cleanupLogs.join('\n'));
                }
            }

            // Finalize state
            if (battle.status === 'finished') {
                battle.winnerId = battle.winner === battle.p1.username ? battle.p1.id : battle.p2.id;
                await this.awardPvPRewards(battle);
            }
        } finally {
            battle.processing = false;
            await db.battles.update({ _id: battle._id }, { 
                $set: { 
                    p1: battle.p1,
                    p2: battle.p2,
                    turn: battle.turn,
                    log: battle.log,
                    status: battle.status,
                    winner: battle.winner,
                    winnerId: battle.winnerId,
                    sharedData: battle.sharedData,
                    processing: false 
                } 
            });
            
            // Final push (always happens once at the end)
            const updates = [
                this.pushUpdate(bot, battle, battle.p1.id, battle.p1Mid),
                this.pushUpdate(bot, battle, battle.p2.id, battle.p2Mid)
            ];
            if (battle.chatId && battle.groupMessageId) {
                updates.push(this.pushUpdate(bot, battle, battle.chatId, battle.groupMessageId, true));
            }
            await Promise.all(updates);
        }
    },

    async pushUpdate(bot, battle, targetId, messageId, isSpectator = false) {
        if (!messageId) return;
        const isP1 = targetId === battle.p1.id;
        const mySide = isP1 ? battle.p1 : battle.p2;
        const myActive = mySide.team[mySide.activeIdx];
        const ctxMock = { telegram: bot, chat: { id: targetId } };

        const msg = ui.renderPokemonUI(battle, isSpectator ? null : targetId);

        if (battle.status === 'finished') {
            const resultMsg = isSpectator ? `\n\n🏆 VICTORY FOR @${battle.winner}!` : (battle.winnerId === targetId ? "\n\n🎉 VICTORY! Match concluded." : "\n\n💀 DEFEAT! Soul dissipated.");
            const kb = isSpectator ? null : Markup.inlineKeyboard([[Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]]);
            return bot.editMessageCaption(targetId, messageId, null, msg + resultMsg, { parse_mode: 'HTML', ...kb }).catch(() => null);
        }

        if (!isSpectator) {
            const hasActed = isP1 ? !!battle.p1Choice : !!battle.p2Choice;
            if (hasActed) {
                return bot.editMessageCaption(targetId, messageId, null, msg + "\n⏳ Waiting for opponent...", { parse_mode: 'HTML' }).catch(() => null);
            }
        } else {
            // Spectator log
            const statusLine = `\n\n🌓 STATUS: Waiting for sorcerers to move...`;
            return bot.editMessageCaption(targetId, messageId, null, msg + statusLine, { parse_mode: 'HTML' }).catch(() => null);
        }

        const moveButtons = myActive.moves.map((m, i) => Markup.button.callback(m.name, `pvp_atk_${battle._id}_${i}`));
        const moveRows = [];
        for (let i = 0; i < moveButtons.length; i += 2) {
            moveRows.push(moveButtons.slice(i, i + 2));
        }

        const kb = Markup.inlineKeyboard([
            ...moveRows,
            [
                Markup.button.callback('🔄 Switch', `pvp_swi_${battle._id}`),
                Markup.button.callback('🏳️ Run', `pvp_surr_${battle._id}`),
                Markup.button.callback('🎒 Bag', `pvp_bag_${battle._id}`)
            ]
        ]);

        return media.sendBattleTurn(ctxMock, battle, userId, kb, userId, messageId);
    },

    async awardPvPRewards(battle) {
        const userService = require('../../services/userService');
        const p1 = await db.users.findOne({ telegramId: battle.p1.id });
        const p2 = await db.users.findOne({ telegramId: battle.p2.id });
        
        const isP1Winner = battle.winner === battle.p1.username;
        const mode = battle.mode;

        // Rewards for P1
        await userService.addAdvancedRewards(battle.p1.id, mode, isP1Winner, isP1Winner ? (p1.winStreak || 0) + 1 : 0);
        await db.users.update({ telegramId: battle.p1.id }, { 
            $set: { winStreak: isP1Winner ? (p1.winStreak || 0) + 1 : 0 },
            $inc: { [`pvp_${mode}_wins`]: isP1Winner ? 1 : 0, [`pvp_${mode}_losses`]: isP1Winner ? 0 : 1 }
        });

        // Rewards for P2
        await userService.addAdvancedRewards(battle.p2.id, mode, !isP1Winner, !isP1Winner ? (p2.winStreak || 0) + 1 : 0);
        await db.users.update({ telegramId: battle.p2.id }, { 
            $set: { winStreak: !isP1Winner ? (p2.winStreak || 0) + 1 : 0 },
            $inc: { [`pvp_${mode}_wins`]: !isP1Winner ? 1 : 0, [`pvp_${mode}_losses`]: !isP1Winner ? 0 : 1 }
        });

        // ELO Update (Ranked only)
        if (mode === 'ranked') {
            const k = 32;
            const ea = 1 / (1 + Math.pow(10, (p2.elo - p1.elo) / 400));
            const eb = 1 / (1 + Math.pow(10, (p1.elo - p2.elo) / 400));
            const sa = isP1Winner ? 1 : 0;
            const sb = isP1Winner ? 0 : 1;
            
            const newElo1 = Math.round(p1.elo + k * (sa - ea));
            const newElo2 = Math.round(p2.elo + k * (sb - eb));
            
            await db.users.update({ telegramId: p1.telegramId }, { $set: { elo: newElo1 } });
            await db.users.update({ telegramId: p2.telegramId }, { $set: { elo: newElo2 } });

            // --- RANKED LOOT (PvP STEAL) ---
            const winner = isP1Winner ? p1 : p2;
            const loser = isP1Winner ? p2 : p1;
            
            // 1. Coin Steal (10% of loser's wallet, max 500)
            let stealAmt = Math.floor((loser.coins || 0) * 0.10);
            if (stealAmt > 500) stealAmt = 500;
            if (stealAmt > 0 && loser.coins >= stealAmt) {
                await db.users.update({ telegramId: loser.telegramId }, { $inc: { coins: -stealAmt } });
                await db.users.update({ telegramId: winner.telegramId }, { $inc: { coins: stealAmt } });
                
                const lootMsg = `\n\n💰 LOOT!\nWinner @${winner.username} stole 🪙 ${stealAmt} coins from @${loser.username}!`;
                await ctx.telegram.sendMessage(winner.telegramId, lootMsg, { parse_mode: 'HTML' }).catch(() => null);
                await ctx.telegram.sendMessage(loser.telegramId, lootMsg, { parse_mode: 'HTML' }).catch(() => null);
            }

            // 2. Item Steal (5% chance to take a common item)
            if (Math.random() < 0.05) {
                const loserInv = loser.inventory || [];
                const commonIds = ['minor_hp_potion', 'ce_charge', 'lucky_charm'];
                const stealableItems = loserInv.filter(i => commonIds.includes(i.id) && i.qty > 0);
                
                if (stealableItems.length > 0) {
                    const itemToSteal = stealableItems[Math.floor(Math.random() * stealableItems.length)];
                    
                    // Remove from loser
                    const lIdx = loserInv.findIndex(i => i.id === itemToSteal.id);
                    loserInv[lIdx].qty -= 1;
                    await db.users.update({ telegramId: loser.telegramId }, { $set: { inventory: loserInv } });
                    
                    // Add to winner
                    const winInv = winner.inventory || [];
                    const winIdx = winInv.findIndex(i => i.id === itemToSteal.id);
                    if (winIdx > -1) {
                        winInv[winIdx].qty += 1;
                        await db.users.update({ telegramId: winner.telegramId }, { $set: { inventory: winInv } });
                    } else {
                        winInv.push({ id: itemToSteal.id, qty: 1 });
                        await db.users.update({ telegramId: winner.telegramId }, { $set: { inventory: winInv } });
                    }
                    
                    const itemMsg = `\n\n🏴‍☠️ ITEM STOLEN!\n@${winner.username} stole a ${itemToSteal.id.replace(/_/g, ' ')} from @${loser.username}'s bag!`;

                    await ctx.telegram.sendMessage(winner.telegramId, itemMsg, { parse_mode: 'HTML' }).catch(() => null);
                    await ctx.telegram.sendMessage(loser.telegramId, itemMsg, { parse_mode: 'HTML' }).catch(() => null);
                }
            }
        }
    },

    async checkBattleTimeouts(bot) {
        const TIMEOUT_MS = 120000; // 2 minutes
        const activeBattles = await db.battles.find({ status: 'active' });
        
        for (const b of activeBattles) {
            const lastAction = b.lastActionAt || b.createdAt || 0;
            const idleMs = Date.now() - lastAction;

            if (idleMs < TIMEOUT_MS) continue;

            console.log(`[TIMEOUT] Ending battle ${b._id} — idle for ${Math.floor(idleMs/1000)}s.`);

            if (b.p1Choice && !b.p2Choice) {
                b.winner = b.p1.username;
                b.winnerId = b.p1.id;
            } else if (b.p2Choice && !b.p1Choice) {
                b.winner = b.p2.username;
                b.winnerId = b.p2.id;
            } else {
                b.winner = 'None (Draw)';
                b.winnerId = null;
            }

            b.status = 'finished';
            b.log.push('⏱️ Match ended — 2 minutes of inactivity.');

            await db.battles.update({ _id: b._id }, {
                $set: {
                    status: b.status,
                    winner: b.winner,
                    winnerId: b.winnerId,
                    log: b.log
                }
            });

            const timeoutLine = b.winnerId
                ? `\n\n⏱️ TIMEOUT! @${b.winner} wins — opponent was too slow.`
                : `\n\n⏱️ TIMEOUT! Match dissolved — neither sorcerer acted in time.`;

            const kb = Markup.inlineKeyboard([[Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]]);

            const notifyPlayer = async (userId, msgId) => {
                const caption = ui.renderPokemonUI(b, userId) + timeoutLine;
                try {
                    if (msgId) {
                        // Player had the battle open — edit their existing message
                        await bot.telegram.editMessageCaption(userId, msgId, null, caption, { parse_mode: 'HTML', ...kb }).catch(() => null);
                    } else {
                        // Player never opened the battle — send a fresh message
                        await bot.telegram.sendMessage(userId, `⏱️ BATTLE TIMEOUT\n\nYour match ended because no action was taken within 2 minutes.${timeoutLine}`, { parse_mode: 'HTML', ...kb }).catch(() => null);
                    }
                } catch (e) {
                    console.error('[TIMEOUT NOTIFY]', e.message);
                }
            };

            await notifyPlayer(b.p1.id, b.p1Mid);
            await notifyPlayer(b.p2.id, b.p2Mid);
        }
    }
};
