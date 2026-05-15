const { Scenes, Markup } = require('telegraf');
const clanService = require('../../services/clanService');
const db = require('../../database');
const ui = require('../ui');
const media = require('../media');

/**
 * Clan Scene: The Syndicate Hub
 */
const clanScene = new Scenes.BaseScene('clan_scene');

clanScene.enter(async (ctx) => {
    const user = await db.users.findOne({ telegramId: ctx.from.id });
    if (!user.school) {
        return ctx.replyWithHTML("🏯 <b>ACADEMY REQUIRED</b>\nYou must choose your path (Tokyo vs Kyoto) before joining a syndicate.\n\nUse /school to decide.");
    }
    
    if (!user.clanId) {
        return clanScene.renderJoinOrCreate(ctx, user);
    }
    return clanScene.renderClanHub(ctx, user);
});

clanScene.renderJoinOrCreate = async function(ctx, user) {
    let msg = ui.formatHeader("CLAN RECRUITMENT") + "\n\n" +
        "You are not part of a syndicate. Join a clan to share resources and compete globally.\n\n" +
        "🔓 <b>Min Level to Join:</b> 15\n" +
        "🏗 <b>Min Level to Create:</b> 20 (Costs 5,000 G)";

    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('🔍 Browse Clans', 'browse_clans')],
        [Markup.button.callback('🏗 Create Syndicate (5k G)', 'init_create_clan')],
        [Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]
    ]);

    if (ctx.callbackQuery) {
        await media.smartEdit(ctx, msg, kb);
    } else {
        await ctx.replyWithHTML(msg, kb);
    }
};

clanScene.renderClanHub = async function(ctx, user) {
    const clan = await db.clans.findOne({ _id: user.clanId });
    if (!clan) return module.exports.renderJoinOrCreate(ctx, user);

    let msg = ui.formatHeader(`SYNDICATE: ${clan.name}`) + "\n\n" +
        `🏫 <b>Academy:</b> ${clan.school}\n` +
        `🏷 <b>Tag:</b> [${clan.tag}]\n` +
        `👥 <b>Members:</b> ${clan.members.length}/${clan.slots || 25}\n` +
        `📈 <b>Power Score:</b> <code>${clan.totalElo || 0}</code>\n` +
        `✨ <b>Treasury:</b> <code>${clan.treasury.dust || 0}</code> Dust\n\n` +
        `🏆 <b>Your Role:</b> ${user.clanRole}\n`;

    const kb = [
        [Markup.button.callback('💎 Contribute Dust', 'contribute_dust')],
        [Markup.button.callback('🚪 Leave Syndicate', 'leave_clan')]
    ];

    if (user.clanRole === 'Leader') {
        kb.push([Markup.button.callback('🏗 Expand (+5 Slots, 5k G)', 'expand_clan')]);
        kb.push([Markup.button.callback('⚙️ Leader Panel', 'leader_panel')]);
    }

    kb.push([Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]);

    if (ctx.callbackQuery) {
        await media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    } else {
        await ctx.replyWithHTML(msg, Markup.inlineKeyboard(kb));
    }
};

clanScene.action('init_create_clan', async (ctx) => {
    const user = await db.users.findOne({ telegramId: ctx.from.id });
    if (user.playerLevel < 20) return ctx.answerCbQuery("❌ Level 20 required to create!", { show_alert: true });
    
    await ctx.answerCbQuery();
    return ctx.reply("Please use the following format to create a clan:\n/create_clan NAME TAG\nExample: /create_clan 'Kyoto High' KYT");
});

clanScene.action('leave_clan', async (ctx) => {
    const result = await clanService.leaveClan(ctx.from.id);
    if (result.success) return clanScene.enter(ctx);
});

clanScene.action('expand_clan', async (ctx) => {
    const res = await clanService.expandClan(ctx.from.id);
    await ctx.answerCbQuery(res.msg, { show_alert: !res.success });
    if (res.success) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        return clanScene.renderClanHub(ctx, user);
    }
});

clanScene.action('browse_clans', async (ctx) => {
    const user = await db.users.findOne({ telegramId: ctx.from.id });
    const clans = await db.clans.find({ school: user.school }).sort({ totalElo: -1 }).limit(10);
    
    if (clans.length === 0) return ctx.answerCbQuery("No clans found in your Academy.", { show_alert: true });

    let msg = ui.formatHeader(`DISCOVER: ${user.school.toUpperCase()}`) + "\n\n";
    clans.forEach((c, i) => {
        msg += `<b>#${i+1} [${c.tag}] ${c.name}</b>\n└ 👥 ${c.members.length}/${c.slots || 25} | 📈 ${c.totalElo}\n\n`;
    });

    const kb = clans.map(c => [Markup.button.callback(`Join ${c.tag}`, `join_clan_${c._id}`)]);
    kb.push([Markup.button.callback('⬅️ Back', 'back_to_hub')]);

    return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
});

clanScene.action(/join_clan_(.+)/, async (ctx) => {
    const res = await clanService.joinClan(ctx.from.id, ctx.match[1]);
    await ctx.answerCbQuery(res.msg, { show_alert: !res.success });
    if (res.success) {
        return clanScene.enter(ctx);
    }
});

// Clan specific listeners for scene actions
clanScene.action('back_to_hub', (ctx) => {
    ctx.answerCbQuery().catch(() => null);
    return ctx.scene.leave();
});

// Listener for the global "clan_home" callback
const showHome = async (ctx) => {
    return ctx.scene.enter('clan_scene');
};

module.exports = { clanScene, showHome };
