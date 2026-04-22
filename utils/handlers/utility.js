const rewardService = require('../../services/rewardService');
const ui = require('../ui');
const media = require('../media');
const achievementService = require('../../services/achievementService');
const db = require('../../database');

const TIPS = [
    "💡 Barrier types are strong against Long-range attackers!",
    "💡 Close-range fighters deal 1.5x damage to Barrier types.",
    "💡 Use your Cursed Energy (CE) wisely; guarding regenerates CE!",
    "💡 Black Flash deals 2.0x damage and can't be dodged.",
    "💡 Swapping characters can save a sorcerer from a lethal strike.",
    "💡 Leveling up your player rank unlocks new gacha banners and items."
];

/**
 * Utility Handler: Help, Tips, and Daily Claims.
 */
module.exports = {
    async showHelp(ctx, category = 'main') {
        const HELP_DATA = {
            main: {
                title: "CURSED GUIDE",
                msg: "Welcome to the Jujutsu High Archives. Select a section to learn the laws of cursed energy:\n\n" +
                     "⚔️ <b>Combat Mechanics</b> - Tactics & Types\n" +
                     "🧬 <b>Sorcerer Growth</b> - Leveling & Awakening\n" +
                     "🗺 <b>Exploration</b> - Capturing cursed souls\n" +
                     "🏅 <b>Competitive</b> - Rankings & Seasons",
                kb: [
                    [{ text: "⚔️ Combat", callback_data: "help_combat" }, { text: "🧬 Growth", callback_data: "help_growth" }],
                    [{ text: "🗺 Explore", callback_data: "help_explore" }, { text: "🏅 Compete", callback_data: "help_comp" }],
                    [{ text: "📜 Command List", callback_data: "help_cmds" }]
                ]
            },
            combat: {
                title: "COMBAT TACTICS",
                msg: "The battle relies on the <b>Technical Triangle</b>:\n" +
                     "• 👊 <b>Close</b> beats 🏮 <b>Barrier</b>\n" +
                     "• 🏮 <b>Barrier</b> beats 🏹 <b>Long</b>\n" +
                     "• 🏹 <b>Long</b> beats 👊 <b>Close</b>\n\n" +
                     "🌟 <b>Black Flash:</b> Timing-based 2.0x crit.\n" +
                     "⚡️ <b>Guard:</b> Halves damage and restores 20 CE.\n" +
                     "🔄 <b>Switch:</b> Changes active sorcerer (costs turn).",
                kb: [[{ text: "⬅️ Back", callback_data: "help_main" }]]
            },
            growth: {
                title: "CHARACTER GROWTH",
                msg: "Strengthen your spirits through three paths:\n" +
                     "1. 📈 <b>Leveling:</b> Gain XP from battles to increase HP/CE.\n" +
                     "2. ⭐ <b>Star Awakening:</b> Consume Shards and Dust via /upgrade for +10% base stats.\n" +
                     "3. 🏮 <b>Domain Mastery:</b> Reaching Level 40 unlocks custom field effects via /domains.",
                kb: [[{ text: "⬅️ Back", callback_data: "help_main" }]]
            },
            cmds: {
                title: "REFERENCE GUIDE",
                msg: "<b>Core:</b> /profile, /team, /roster, /inventory\n" +
                     "<b>Action:</b> /explore, /train, /gacha, /blackflash\n" +
                     "<b>Social:</b> /friends, /clan, /daily, /leaderboard\n" +
                     "<b>Support:</b> /streak, /help",
                kb: [[{ text: "⬅️ Back", callback_data: "help_main" }]]
            },
            explore: {
                title: "CURSED EXPLORATION",
                msg: "The world is teeming with wild spirits. Use /explore to find them:\n" +
                     "• 🕯 <b>Common:</b> 50% spawn (60% catch)\n" +
                     "• 💎 <b>Rare:</b> 30% spawn (40% catch)\n" +
                     "• 🔥 <b>Epic:</b> 15% spawn (25% catch)\n" +
                     "• 🏆 <b>Legendary:</b> 4.5% spawn (10% catch)\n" +
                     "• 💀 <b>Mythic:</b> 0.5% spawn (0% catch - Defeat for rewards)",
                kb: [[{ text: "⬅️ Back", callback_data: "help_main" }]]
            },
            comp: {
                title: "COMPETITIVE LEAGUE",
                msg: "Test your skill in <b>Higher-Ups PvP</b>:\n" +
                     "• Duel other sorcerers to gain ELO and increase your Rank.\n" +
                     "• Promotion path: Iron > Bronze > Silver > Gold > Special Grade.\n\n" +
                     "🏆 <b>Zenin Tournament:</b> Automated daily events with exclusive titles for the top 3 survivors.",
                kb: [[{ text: "⬅️ Back", callback_data: "help_main" }]]
            }
        };

        const data = HELP_DATA[category] || HELP_DATA.main;
        const fullMsg = ui.formatHeader(data.title) + "\n\n" + data.msg;

        if (ctx.callbackQuery) {
            await ctx.answerCbQuery();
            return media.smartEdit(ctx, fullMsg, { inline_keyboard: data.kb });
        }
        return ctx.replyWithHTML(fullMsg, { reply_markup: { inline_keyboard: data.kb } });
    },

    async showTip(ctx) {
        const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
        return ctx.replyWithHTML(`🥋 <b>SORCERER TIP:</b>\n\n<i>"${tip}"</i>`);
    },

    async handleDaily(ctx) {
        const res = await rewardService.claimDaily(ctx.from.id);
        return ctx.replyWithHTML(res.msg);
    },

    async showStreak(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.reply("❌ You must register first using /start.");
        return ctx.replyWithHTML(`🔥 <b>CURRENT STREAK:</b> ${user.loginStreak || 0} Days`);
    },

    async showAchievements(ctx) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        if (!user) return ctx.reply("Please register first.");

        let msg = ui.formatHeader("ACHIEVEMENT SYSTEM", "GENERAL") + "\n\n" +
                  "<i>\"Your dedication is your greatest weapon.\"</i>\n\n" +
                  "Your current progress and milestones:\n\n";

        const stats = achievementService.DATA;
        const progress = user.achievements?.progress || {};
        const completed = user.achievements?.completed || [];

        for (const [cat, items] of Object.entries(stats)) {
            const prog = progress[cat.toUpperCase()] || 0;
            const catDone = items.filter(i => completed.includes(i.id)).length;
            
            msg += `🔖 <b>${cat}:</b> [${catDone}/${items.length}]\n`;
            msg += `└ Progress: <code>${prog}</code>\n\n`;
        }

        msg += "<i>Achievements unlock automated rewards (Gold, Shards, tickets, Dust). Keep grinding!</i>";

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🎖 EQUIP TITLE', 'menu_titles')],
            [Markup.button.callback('⬅️ BACK TO PROFILE', 'cmd_profile_init')]
        ]);

        if (ctx.callbackQuery) {
            ctx.answerCbQuery().catch(() => null);
            return media.smartEdit(ctx, msg, kb);
        }
        return ctx.replyWithHTML(msg, kb);
    },

    async showTitlesMenu(ctx) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        if (!user) return ctx.reply("❌ You must register first using /start.");
        const completed = user.achievements?.completed || [];
        
        // Find all achievements that grant a title
        const titleAchs = [];
        Object.values(achievementService.DATA).forEach(cat => {
            cat.forEach(ach => {
                if (ach.reward.title && completed.includes(ach.id)) {
                    titleAchs.push(ach);
                }
            });
        });

        let msg = ui.formatHeader("SELECT TITLE", "GENERAL") + "\n\n" +
                  "You have earned these titles. Choose one to equip:\n\n";

        if (titleAchs.length === 0) {
            msg += "<i>No titles unlocked yet. Complete achievements to earn them!</i>";
        } else {
            msg += `Current Title: <b>${user.title || "Wandering Soul"}</b>\n\n`;
        }

        const kb = titleAchs.map(ach => [
            Markup.button.callback(`🎖 ${ach.reward.title}`, `equip_title_${ach.reward.title}`)
        ]);
        
        kb.push([Markup.button.callback('⬅️ BACK', 'cmd_achievements')]);

        if (ctx.callbackQuery) ctx.answerCbQuery().catch(() => null);
        return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    },

    async equipTitle(ctx, title) {
        ctx.answerCbQuery(`🎖 Title equipped: ${title}!`, { show_alert: true }).catch(() => null);
        await db.users.update({ telegramId: ctx.from.id }, { $set: { title: title } });
        return this.showAchievements(ctx);
    }
};
