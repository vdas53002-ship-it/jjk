const db = require('../../database');
const ui = require('../ui');
const pvp = require('./pvp');
const { Markup } = require('telegraf');

const pendingChallenges = new Map();
const activeDuels = new Map(); // { duelId: { timer, challengerId, targetId, chatId } }

module.exports = {
    async sendChallenge(ctx) {
        const challenger = await db.users.findOne({ telegramId: ctx.from.id });
        const text = ctx.message.text.split(' ');
        if (text.length < 2) return ctx.reply("❌ Usage: /challenge @username");

        let targetUsername = text[1].replace('@', '');
        
        const mention = ctx.message.entities && ctx.message.entities.find(e => e.type === 'mention' || e.type === 'text_mention');
        let target;
        if (mention && mention.type === 'text_mention') {
            target = await db.users.findOne({ telegramId: mention.user.id });
        } else {
            target = await db.users.findOne({ username: new RegExp(`^${targetUsername}$`, 'i') });
        }

        if (!target) return ctx.reply("❌ That sorcerer could not be found. They must use /start to register first.");
        if (target.telegramId === challenger.telegramId) return ctx.reply("❌ You cannot challenge yourself!");

        // 1. Pre-checks
        if (!challenger.teamIds || challenger.teamIds.length < 3) {
            return ctx.reply("❌ Your team must have 3 characters. Use /team to set your lineup.");
        }

        const now = Date.now();
        if (now - (challenger.lastChallengeTime || 0) < 10000) {
            return ctx.reply("⏳ Please wait 10 seconds before sending another challenge.");
        }

        // 2. Already Pending Check
        const key = `${challenger.telegramId}_${target.telegramId}`;
        if (pendingChallenges.has(key)) {
            return ctx.reply(`⏳ You already have a pending challenge to @${target.username}.`);
        }

        const timeout = setTimeout(() => {
            if (pendingChallenges.has(key)) {
                pendingChallenges.delete(key);
                ctx.reply(`⏳ Challenge to @${target.username} timed out.`);
                ctx.telegram.sendMessage(target.telegramId, `⏳ Challenge from @${challenger.username} expired.`).catch(e => {});
            }
        }, 60000);

        pendingChallenges.set(key, { challengerId: challenger.telegramId, targetId: target.telegramId, timeout });
        await db.users.update({ telegramId: ctx.from.id }, { $set: { lastChallengeTime: now } });

        const cancelKb = Markup.inlineKeyboard([[Markup.button.callback('❌ CANCEL CHALLENGE', `chal_cancel_${target.telegramId}`)]]);
        await ctx.replyWithHTML(`⚔️ Challenge sent to @${target.username}!\nWaiting for response (60s)...`, cancelKb);

        const invMsg = ui.formatHeader("⚔️ CHALLENGE RECEIVED! ⚔️") + "\n\n" +
            `@${challenger.username} has challenged you to a battle!\n` +
            `<i>Do you accept the clash?</i>`;
        
        const invKb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ ACCEPT', `chal_accept_${challenger.telegramId}`), Markup.button.callback('❌ DECLINE', `chal_decline_${challenger.telegramId}`)]
        ]);

        try {
            await ctx.telegram.sendMessage(target.telegramId, invMsg, { parse_mode: 'HTML', ...invKb });
        } catch (e) {
            ctx.reply("❌ Could not notify the opponent. They might have blocked the bot.");
            pendingChallenges.delete(key);
            clearTimeout(timeout);
        }
    },

    async sendDuel(ctx) {
        const challenger = await db.users.findOne({ telegramId: ctx.from.id });
        if (!challenger) return ctx.reply("Please /start first.");

        let target;
        if (ctx.message.reply_to_message) {
            const targetId = ctx.message.reply_to_message.from.id;
            target = await db.users.findOne({ telegramId: targetId });
        } else {
            const text = ctx.message.text.split(' ');
            if (text.length < 2) return ctx.reply("❌ Usage: /duel @username (or reply to a message)");
            
            let targetUsername = text[1].replace('@', '');
            
            const mention = ctx.message.entities && ctx.message.entities.find(e => e.type === 'mention' || e.type === 'text_mention');
            if (mention && mention.type === 'text_mention') {
                target = await db.users.findOne({ telegramId: mention.user.id });
            } else {
                target = await db.users.findOne({ username: new RegExp(`^${targetUsername}$`, 'i') });
            }
        }

        if (!target) return ctx.reply("❌ That sorcerer could not be found. They must use /start to register first.");
        if (target.telegramId === challenger.telegramId) return ctx.reply("❌ You cannot duel yourself!");

        // 1. Pre-checks
        if (!challenger.teamIds || challenger.teamIds.length < 3) {
            return ctx.reply("❌ Your team must have 3 characters. Use /team to set your lineup.");
        }

        const now = Date.now();
        if (now - (challenger.lastChallengeTime || 0) < 10000) {
            return ctx.reply("⏳ Please wait 10 seconds before sending another duel request.");
        }

        // 2. Already Pending Check
        const key = `duel_${challenger.telegramId}_${target.telegramId}`;
        if (pendingChallenges.has(key)) {
            return ctx.reply(`⏳ Duel request already pending for @${target.username}.`);
        }

        const timeout = setTimeout(() => {
            if (pendingChallenges.has(key)) {
                pendingChallenges.delete(key);
                ctx.reply(`⏳ Duel request to @${target.username} timed out.`);
            }
        }, 60000);

        pendingChallenges.set(key, { challengerId: challenger.telegramId, targetId: target.telegramId, chatId: ctx.chat.id, timeout });
        await db.users.update({ telegramId: ctx.from.id }, { $set: { lastChallengeTime: now } });

        const invMsg = ui.formatHeader("⚔️ DUEL REQUEST! ⚔️") + "\n\n" +
            `🔥 <a href="tg://user?id=${challenger.telegramId}">${challenger.username}</a> has challenged <a href="tg://user?id=${target.telegramId}">${target.username}</a> to a live DUEL!\n` +
            `<i>Do you accept the clash?</i>`;
        
        const invKb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ ACCEPT', `chal_accept_${challenger.telegramId}_duel`), Markup.button.callback('❌ DECLINE', `chal_decline_${challenger.telegramId}_duel`)]
        ]);

        return ctx.replyWithHTML(invMsg, invKb);
    },

    async handleAccept(ctx, challengerId, type = 'challenge') {
        const targetId = ctx.from.id;
        const key = type === 'duel' ? `duel_${challengerId}_${targetId}` : `${challengerId}_${targetId}`;
        
        if (!pendingChallenges.has(key)) {
            return ctx.answerCbQuery("❌ This challenge has expired or been canceled.", { show_alert: true });
        }

        const chal = pendingChallenges.get(key);
        clearTimeout(chal.timeout);
        pendingChallenges.delete(key);

        const challenger = await db.users.findOne({ telegramId: parseInt(challengerId) });
        const opponent = await db.users.findOne({ telegramId: targetId });

        if (!opponent.teamIds || opponent.teamIds.length < 3) {
            ctx.answerCbQuery("❌ You need 3 characters to battle!", { show_alert: true });
            return ctx.reply(`❌ @${opponent.username} does not have a valid team and cannot duel.`);
        }

        await ctx.answerCbQuery("⚔️ Duel Accepted!");

        if (type === 'duel') {
            let countdown = 15;
            const prepMsg = ui.formatHeader("⚔️ DUEL PREPARATION") + "\n\n" +
                `The clash between <a href="tg://user?id=${challenger.telegramId}">${challenger.username}</a> and <a href="tg://user?id=${opponent.telegramId}">${opponent.username}</a> begins in ${countdown}s!\n\n` +
                `🛡 ADVICE: Head to your DMs to set your team or verify your strategy!`;
            
            const msg = await ctx.replyWithHTML(prepMsg);

            const timer = setInterval(async () => {
                countdown -= 5;
                if (countdown > 0) {
                    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 
                        ui.formatHeader("⚔️ DUEL PREPARATION") + "\n\n" +
                        `The clash begins in ${countdown}s!\n\n` +
                        `🛡 ADVICE: Set your team in DMs now!`, { parse_mode: 'HTML' }).catch(() => null);
                } else {
                    clearInterval(timer);
                    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => null);
                    
                    // Start actual battle
                    return pvp.startPvPBattle(
                        { userId: challenger.telegramId, username: challenger.username, isCasual: true },
                        { userId: opponent.telegramId, username: opponent.username, isCasual: true },
                        'duel',
                        ctx.telegram,
                        ctx.chat.id // Pass group chat ID
                    );
                }
            }, 5000);
        } else {
            return pvp.startPvPBattle(
                { userId: challenger.telegramId, username: challenger.username, isCasual: true },
                { userId: opponent.telegramId, username: opponent.username, isCasual: true },
                'challenge',
                ctx.telegram
            );
        }
    },

    async handleDecline(ctx, challengerId, type = 'challenge') {
        const targetId = ctx.from.id;
        const key = type === 'duel' ? `duel_${challengerId}_${targetId}` : `${challengerId}_${targetId}`;
        
        if (pendingChallenges.has(key)) {
            const chal = pendingChallenges.get(key);
            clearTimeout(chal.timeout);
            pendingChallenges.delete(key);

            await ctx.telegram.sendMessage(challengerId, `❌ @${ctx.from.username} declined your ${type}.`);
        }

        await ctx.answerCbQuery(`${type === 'duel' ? 'Duel' : 'Challenge'} declined.`);
        return ctx.editMessageText(`❌ ${type === 'duel' ? 'Duel' : 'Challenge'} declined.`);
    },

    async handleCancel(ctx, targetId) {
        const challengerId = ctx.from.id;
        const key = `${challengerId}_${targetId}`;

        if (pendingChallenges.has(key)) {
            const chal = pendingChallenges.get(key);
            clearTimeout(chal.timeout);
            pendingChallenges.delete(key);
            
            const target = await db.users.findOne({ telegramId: parseInt(targetId) });
            await ctx.telegram.sendMessage(targetId, `⚔️ Challenge from @${ctx.from.username} has been withdrawn.`);
        }

        await ctx.answerCbQuery("Challenge canceled.");
        return ctx.editMessageText("❌ Challenge withdrawn.");
    }
};
