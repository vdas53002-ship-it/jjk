const { Markup } = require('telegraf');
const ui = require('../ui');
const db = require('../../database');
const media = require('../media');

/**
 * Minigame Handler: The Black Flash Practice (Reaction Test)
 */
module.exports = {
    async startBlackFlash(ctx) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        if (!user) return ctx.reply("Please /start first.");

        // 1. Cooldown Check
        const now = Date.now();
        const lastAttempt = user.lastBFTime || 0;
        const diff = Math.floor((now - lastAttempt) / 1000);
        
        if (diff < 60) {
            return ctx.reply(`⏳ Your cursed energy is still recovering. Try again in ${60 - diff}s.`);
        }

        // 2. Buff Check
        if (user.blackflash_buff && user.blackflash_expiry > now) {
            return ctx.reply("⚡ You already have a Black Flash buff waiting! Use it in your next battle.");
        }

        let msg = ui.formatHeader("⚡ BLACK FLASH CHALLENGE ⚡") + "\n\n" +
            "Focus your cursed energy... Within 0.000001 seconds of impact, a spark becomes a flame.\n\n" +
            "📌 <b>Goal:</b> Tap the button the exact moment it turns BLACK!\n\n" +
            "Tap the button below when you are ready to focus.";

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✨ I AM READY', 'bf_ready')]
        ]);

        return ctx.replyWithHTML(msg, kb);
    },

    async handleBFReady(ctx) {
        await ctx.answerCbQuery();
        
        const countdown = ["⚡ 3...", "⚡ 2...", "⚡ 1...", "⚡ **NOW!**"];
        
        for (let i = 0; i < countdown.length; i++) {
            setTimeout(async () => {
                const isLast = i === countdown.length - 1;
                const msg = ui.formatHeader("⚡ FOCUS... ⚡") + "\n\n" + countdown[i];
                
                const kb = isLast 
                    ? Markup.inlineKeyboard([[Markup.button.callback('🔴 TAP NOW 🔴', `bf_tap_${Date.now()}`)]])
                    : Markup.inlineKeyboard([[Markup.button.callback('⚪ FOCUSING...', 'bf_too_early')]]);

                try {
                    await media.smartEdit(ctx, msg, kb);
                } catch (e) {}
            }, i * 1000);
        }
    },

    async handleBFTap(ctx, signalTime) {
        const tapTime = Date.now();
        const diff = tapTime - parseInt(signalTime);
        const user = await db.users.findOne({ telegramId: ctx.from.id });

        // Window: 100ms (too fast/reflex) to 800ms (fair window considering Telegram lag)
        if (diff >= 100 && diff <= 800) {
            const expiry = Date.now() + (60 * 60 * 1000); // 1 hour
            await db.users.update({ telegramId: ctx.from.id }, { 
                $set: { 
                    blackflash_buff: true, 
                    blackflash_expiry: expiry,
                    lastBFTime: Date.now() 
                } 
            });

            const successMsg = ui.formatHeader("✨ BLACK FLASH! ✨") + "\n\n" +
                `Fantastic! Your reaction was <code>${diff}ms</code>.\n\n` +
                "Your cursed energy has surged! You gain <b>+5% Critical Hit chance</b> for your next battle.\n" +
                "(Expires in 1 hour or after 1 battle)";
            
            const kb = Markup.inlineKeyboard([
                [Markup.button.callback('⚔️ Battle Now', 'cmd_explore'), Markup.button.callback('🔙 Return', 'back_to_hub')]
            ]);

            return media.smartEdit(ctx, successMsg, kb);
        } else {
            // Failure
            await db.users.update({ telegramId: ctx.from.id }, { $set: { lastBFTime: Date.now() } });
            
            const failMsg = ui.formatHeader("❌ TOO SLOW...") + "\n\n" +
                `Your reaction was <code>${diff}ms</code>. The spark failed to manifest.\n\n` +
                "Try again in 60 seconds once your energy stabilizes.";
                
            return media.smartEdit(ctx, failMsg, Markup.inlineKeyboard([[Markup.button.callback('🔙 Return', 'back_to_hub')]]));
        }
    }
};
