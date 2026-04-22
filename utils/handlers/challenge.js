const db = require('../../database');
const ui = require('../ui');
const pvp = require('./pvp');
const { Markup } = require('telegraf');

const pendingChallenges = new Map();

/**
 * Challenge Handler: Manages direct 1v1 PvP invitations.
 */
module.exports = {
    async sendChallenge(ctx) {
        const challenger = await db.users.findOne({ telegramId: ctx.from.id });
        const text = ctx.message.text.split(' ');
        if (text.length < 2) return ctx.reply("❌ Usage: /challenge @username");

        const targetUsername = text[1].replace('@', '');
        const target = await db.users.findOne({ username: targetUsername });

        if (!target) return ctx.reply("❌ That sorcerer could not be found.");
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

        // 3. Create Challenge
        const timeout = setTimeout(() => {
            if (pendingChallenges.has(key)) {
                pendingChallenges.delete(key);
                ctx.reply(`⏳ Challenge to @${target.username} timed out.`);
                ctx.telegram.sendMessage(target.telegramId, `⏳ Challenge from @${challenger.username} expired.`).catch(e => {});
            }
        }, 60000);

        pendingChallenges.set(key, { challengerId: challenger.telegramId, targetId: target.telegramId, timeout });
        await db.users.update({ telegramId: ctx.from.id }, { $set: { lastChallengeTime: now } });

        // 4. UI to Challenger
        const cancelKb = Markup.inlineKeyboard([[Markup.button.callback('❌ CANCEL CHALLENGE', `chal_cancel_${target.telegramId}`)]]);
        await ctx.replyWithHTML(`⚔️ <b>Challenge sent to @${target.username}!</b>\nWaiting for response (60s)...`, cancelKb);

        // 5. UI to Target
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

    async handleAccept(ctx, challengerId) {
        const targetId = ctx.from.id;
        const key = `${challengerId}_${targetId}`;
        
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
            return ctx.telegram.sendMessage(challengerId, `@${opponent.username} does not have a valid team and cannot accept the challenge.`);
        }

        await ctx.answerCbQuery("⚔️ Challenge Accepted!");
        
        // Start Battle
        // We reuse pvp.startPvPBattle which initializes the engine and notifies both
        return pvp.startPvPBattle(
            { userId: challenger.telegramId, username: challenger.username, isCasual: true },
            { userId: opponent.telegramId, username: opponent.username, isCasual: true },
            'challenge',
            ctx.telegram
        );
    },

    async handleDecline(ctx, challengerId) {
        const targetId = ctx.from.id;
        const key = `${challengerId}_${targetId}`;
        
        if (pendingChallenges.has(key)) {
            const chal = pendingChallenges.get(key);
            clearTimeout(chal.timeout);
            pendingChallenges.delete(key);

            const challenger = await db.users.findOne({ telegramId: parseInt(challengerId) });
            await ctx.telegram.sendMessage(challengerId, `❌ @${ctx.from.username} declined your challenge.`);
        }

        await ctx.answerCbQuery("Challenge declined.");
        return ctx.editMessageText("❌ You declined the challenge.");
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
