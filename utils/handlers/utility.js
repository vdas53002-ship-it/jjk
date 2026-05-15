const { Markup } = require('telegraf');
const rewardService = require('../../services/rewardService');
const ui = require('../ui');
const media = require('../media');
const achievementService = require('../../services/achievementService');
const db = require('../../database');

const TIPS = [
    "💡 Barrier types are strong against Long-range attackers!",
    "💡 Close-range fighters deal 1.5x damage to Barrier types.",
    "💡 Use your Cursed Energy (CE) wisely; guarding regenerates CE!",
    "💡 Higher Grade sorcerers have better base stats. Promote them in /upgrades!",
    "💡 Mythic and Legendary sorcerers cost more to level up but are far stronger."
];

/**
 * Utility Handler: Help, Tips, and Daily Claims.
 */
module.exports = {
    async showHelp(ctx, query = 'main') {
        const HELP_DATA = {
            select: {
                title: "ARCHIVE ACCESS",
                msg: "Welcome, Sorcerer. Choose your preferred language to access the archives:\n\n<i>Apni bhasha chunein:</i>",
                kb: [
                    [{ text: "🇬🇧 English", callback_data: "help_en_main" }],
                    [{ text: "🇮🇳 Hinglish", callback_data: "help_hi_main" }]
                ]
            },
            en: {
                main: {
                    title: "CURSED ARCHIVES",
                    msg: "Select a section to learn the laws of cursed energy:",
                    kb: [
                        [{ text: "⚔️ Combat", callback_data: "help_en_combat" }, { text: "🧬 Growth", callback_data: "help_en_growth" }],
                        [{ text: "🗺 Explore", callback_data: "help_en_explore" }, { text: "🏰 Social", callback_data: "help_en_social" }],
                        [{ text: "💰 Economy", callback_data: "help_en_economy" }, { text: "📜 Commands", callback_data: "help_en_cmds" }],
                        [{ text: "🌐 Change Language", callback_data: "help_main" }]
                    ]
                },
                combat: {
                    title: "BATTLE GUIDE",
                    msg: "• 👊 <b>Triangle:</b> Close > Barrier > Long > Close.\n" +
                         "• 🏢 <b>Group Battles:</b> Hunts and fights stay in Group Chats (GC) if started there.\n" +
                         "• 🏳️ <b>Flee (Run):</b> Exit battle instantly but gain ZERO rewards.\n" +
                         "• ⚡ <b>Black Flash:</b> 2x Critical damage.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_en_main" }]]
                },
                growth: {
                    title: "GROWTH SYSTEM",
                    msg: "• 👤 <b>Profile:</b> Level up your license by staying active (5 XP/min).\n" +
                         "• 👥 <b>Rarity Scaling:</b> Mythic/Legendary characters cost more to upgrade.\n" +
                         "• 🎖 <b>Promotion:</b> Advance from Grade 4 to <b>Special Grade</b> at Level 15, 30, 45, and 60!\n" +
                         "• ✨ <b>Stars:</b> Use Shards in /upgrades for 10% stat boosts.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_en_main" }]]
                },
                explore: {
                    title: "HUNTING GUIDE",
                    msg: "• 🏮 <b>Manual Hunt:</b> 1,000 free hunts per day. No stamina cost.\n" +
                         "• ⚙️ <b>Auto-Grind (/open):</b> Costs 🔋 50 Stamina for 10 rooms. Instant rewards.\n" +
                         "• 🕸 <b>Capture:</b> Lower HP or use items. Rarity/Grade is saved to roster.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_en_main" }]]
                },
                social: {
                    title: "CLANS & SCHOOLS",
                    msg: "• 🏫 <b>Academy:</b> Join Tokyo or Kyoto High at Profile Level 5.\n" +
                         "• 🛡 <b>Clans:</b> Create or join Syndicates at Profile Level 10.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_en_main" }]]
                },
                economy: {
                    title: "ITEMS & MARKET",
                    msg: "• 🔋 <b>Stamina:</b> Restores with /daily or Energy Drinks.\n" +
                         "• ✨ <b>Dust:</b> Essential for both Star Upgrades and Grade Promotions.\n" +
                         "• 🧿 <b>Charms:</b> Carry 'Cursed Charms' in inventory for capture bonuses.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_en_main" }]]
                },
                cmds: {
                    title: "COMMAND LIST & GUIDE",
                    msg: "📑 <b>PROFILE & TEAM</b>\n" +
                         "• /profile - View your license & stats.\n" +
                         "• /roster - Manage all your spirits.\n" +
                         "• /team - Set your active battle team.\n" +
                         "• /inv - Check your items & charms.\n\n" +
                         "⚔️ <b>ACTION & COMBAT</b>\n" +
                         "• /hunt - Find wild spirits in the GC.\n" +
                         "• /open - Start a 10-room auto-expedition.\n" +
                         "• /train - Practice fight for character XP.\n" +
                         "• /gacha - Summon new rare sorcerers.\n\n" +
                         "🧬 <b>GROWTH & PROGRESS</b>\n" +
                         "• /upgrades - Upgrade Stars & Grade.\n" +
                         "• /daily - Claim your daily stamina/coins.\n" +
                         "• /school - Join Tokyo or Kyoto High.\n" +
                         "• /clan - Create or join a Syndicate.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_en_main" }]]
                }
            },
            hi: {
                main: {
                    title: "जुजुत्सु गाइड",
                    msg: "Niche diye gaye buttons se guide chunein:",
                    kb: [
                        [{ text: "⚔️ युद्ध", callback_data: "help_hi_combat" }, { text: "🧬 प्रगति", callback_data: "help_hi_growth" }],
                        [{ text: "🗺 शिकार", callback_data: "help_hi_explore" }, { text: "🏰 स्कूल-क्लान", callback_data: "help_hi_social" }],
                        [{ text: "💰 बाजार", callback_data: "help_hi_economy" }, { text: "📜 कमांड्स", callback_data: "help_hi_cmds" }],
                        [{ text: "🌐 भाषा बदलें", callback_data: "help_main" }]
                    ]
                },
                combat: {
                    title: "युद्ध गाइड",
                    msg: "• 👊 <b>Triangle:</b> Close > Barrier > Long > Close.\n" +
                         "• 🏢 <b>GC Fights:</b> Agar aap GC mein hunt shuru karte hain toh battle bhi wahi hogi.\n" +
                         "• 🏳️ <b>Flee (Run):</b> Aap fight se bhag sakte hain lekin koi reward nahi milega.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_hi_main" }]]
                },
                growth: {
                    title: "प्रगति गाइड",
                    msg: "• 👥 <b>Rarity:</b> Mythic aur Legendary characters upgrade karne mein zyada mehange hain.\n" +
                         "• 🎖 <b>Promotion:</b> Grade 4 se <b>Special Grade</b> tak promote karein (Level 15, 30, 45, 60 pe).\n" +
                         "• ✨ <b>Stars:</b> Shards use karke star badhaein aur stats boost karein.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_hi_main" }]]
                },
                explore: {
                    title: "शिकार गाइड",
                    msg: "• 🏮 <b>Manual:</b> Din ke 1,000 hunts free hain. Koi stamina nahi lagega.\n" +
                         "• ⚙️ <b>Auto (/open):</b> Stamina use karke turant rooms clear karein.\n" +
                         "• 🕸 <b>Catch:</b> Spirits ko pakadne ke liye unki HP kam karein ya Seals use karein.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_hi_main" }]]
                },
                social: {
                    title: "स्कूल और क्लान",
                    msg: "• 🏫 <b>Academy:</b> Profile Level 5 pe Tokyo ya Kyoto High join karein.\n" +
                         "• 🛡 <b>Clans:</b> Profile Level 10 pe apna clan banayein ya join karein.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_hi_main" }]]
                },
                economy: {
                    title: "बाजार गाइड",
                    msg: "• ✨ <b>Dust:</b> Yeh Star upgrades aur Grade promotion dono ke liye chahiye hota hai.\n" +
                         "• 🧿 <b>Items:</b> Inventory mein 'Cursed Charms' rakhne se capture chance badh jata hai.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_hi_main" }]]
                },
                cmds: {
                    title: "कमांड लिस्ट और गाइड",
                    msg: "📑 <b>PROFILE & TEAM</b>\n" +
                         "• /profile - Apna status aur stats dekhein.\n" +
                         "• /roster - Apne saare characters manage karein.\n" +
                         "• /team - Apni battle team set karein.\n" +
                         "• /inv - Apne items aur charms check karein.\n\n" +
                         "⚔️ <b>ACTION & COMBAT</b>\n" +
                         "• /hunt - GC mein wild spirits dhoondein.\n" +
                         "• /open - 10-room ki auto-expedition shuru karein.\n" +
                         "• /train - XP badhane ke liye practice fight karein.\n" +
                         "• /gacha - Naye rare sorcerers ko bulayein.\n\n" +
                         "🧬 <b>GROWTH & PROGRESS</b>\n" +
                         "• /upgrades - Star aur Grade badhane ke liye.\n" +
                         "• /daily - Rozana free stamina aur coins payein.\n" +
                         "• /school - Tokyo ya Kyoto High join karein.\n" +
                         "• /clan - Apna clan banayein ya join karein.",
                    kb: [[{ text: "⬅️ Back", callback_data: "help_hi_main" }]]
                }
            }
        };

        let data = null;
        const parts = (typeof query === 'string') ? query.split('_') : [];
        
        if (parts.length < 2 || query === 'main') {
            data = HELP_DATA.select;
        } else {
            const lang = parts[0];
            const cat = parts[1];
            data = (HELP_DATA[lang] && HELP_DATA[lang][cat]) ? HELP_DATA[lang][cat] : HELP_DATA.select;
        }

        if (!data) data = HELP_DATA.select;
        const fullMsg = ui.formatHeader(data.title) + "\n\n" + data.msg;

        if (ctx.callbackQuery) {
            await ctx.answerCbQuery().catch(() => null);
            return media.smartEdit(ctx, fullMsg, Markup.inlineKeyboard(data.kb));
        }
        return ctx.replyWithHTML(fullMsg, Markup.inlineKeyboard(data.kb));
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
    },

    async handleClose(ctx) {
        try {
            if (ctx.callbackQuery) await ctx.answerCbQuery("Menu Closed.");
            return ctx.deleteMessage().catch(() => null);
        } catch (e) {
            return null;
        }
    }
};
