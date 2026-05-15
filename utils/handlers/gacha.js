const { Scenes, Markup } = require('telegraf');
const gachaService = require('../../services/gachaService');
const media = require('../media');
const ui = require('../ui');
const db = require('../../database');

/**
 * Gacha Scene: The Summoning Altar
 */
const gachaScene = new Scenes.BaseScene('gacha_summon');

gachaScene.enter(async (ctx) => {
    return gachaScene.renderMenu(ctx);
});

gachaScene.renderMenu = async function(ctx) {
    const user = await db.users.findOne({ telegramId: ctx.from.id });
    
    let msg = ui.formatHeader("🎲 SUMMONING ALTAR") + "\n\n" +
        "<i>Draw the souls of legendary sorcerers into your service.</i>\n\n" +
        `🎫 <b>Tickets:</b> <code>${user.gachaTickets || 0}</code>\n` +
        `🪙 <b>Coins:</b> <code>${user.coins || 0}</code>\n` +
        `✨ <b>Dust:</b> <code>${user.dust || 0}</code>\n\n` +
        `🔥 <b>Pity:</b> <code>${user.pityCount || 0}/100</code> (Guaranteed Legendary)\n\n` +
        "<b>SUMMON OPTIONS:</b>\n" +
        "• 1x Pull: 1 Ticket or 200 Coins\n" +
        "• 10x Pull: 10 Tickets or 2000 Coins";

    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('✨ 1x Summon', 'pull_conf_1'), Markup.button.callback('💎 10x Summon', 'pull_conf_10')],
        [Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]
    ]);

    if (ctx.callbackQuery) {
        await media.smartEdit(ctx, msg, kb);
    } else {
        await ctx.replyWithHTML(msg, kb);
    }
};

// --- CONFIRMATION ---
gachaScene.action(/pull_conf_(\d+)/, async (ctx) => {
    const count = parseInt(ctx.match[1]);
    const user = await db.users.findOne({ telegramId: ctx.from.id });
    const costTickets = count;
    const costCoins = count * 200; // 200 Coins per pull

    const hasTickets = (user.gachaTickets || 0) >= costTickets;
    const hasCoins = (user.coins || 0) >= costCoins;

    if (!hasTickets && !hasCoins) {
        return ctx.answerCbQuery(`❌ Insufficient funds! You need ${costTickets} Tickets or ${costCoins} Coins.`, { show_alert: true });
    }

    let msg = ui.formatHeader(`CONFIRM ${count}x SUMMON`) + "\n\nSelect your payment method:";
    const kb = [];
    if (hasTickets) kb.push([Markup.button.callback(`🎫 Use ${costTickets} Tickets`, `pull_exec_${count}_ticket`)]);
    if (hasCoins) kb.push([Markup.button.callback(`💰 Use ${costCoins} Coins`, `pull_exec_${count}_coin`)]);
    kb.push([Markup.button.callback('🔙 Cancel', 'back_to_altar')]);

    return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
});

// --- EXECUTION ---
gachaScene.action(/pull_exec_(\d+)_(.+)/, async (ctx) => {
    const count = parseInt(ctx.match[1]);
    const method = ctx.match[2];
    const user = await db.users.findOne({ telegramId: ctx.from.id });
    
    // Final check
    const cost = method === 'ticket' ? count : count * 200;
    const balance = method === 'ticket' ? (user.gachaTickets || 0) : (user.coins || 0);

    if (balance < cost) return ctx.answerCbQuery("❌ Balance changed. Aborting.");

    // Deduct
    const update = method === 'ticket' ? { $inc: { gachaTickets: -cost } } : { $inc: { coins: -cost } };
    await db.users.update({ telegramId: ctx.from.id }, update);

    await ctx.answerCbQuery("The ritual begins...");

    // Play Animation
    const path = require('path');
    const videoPath = path.join(process.cwd(), 'gacha.mp4');
    
    let animMsg;
    try {
        animMsg = await ctx.replyWithVideo({ source: videoPath }, { 
            caption: "🔮 <b>INVOKING CURSED SOULS...</b>", 
            parse_mode: 'HTML' 
        });
    } catch (e) {
        console.error("Gacha Animation Error:", e);
    }
    
    // Wait for 6 seconds
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Try to delete animation message for cleaner UI
    try { await ctx.telegram.deleteMessage(ctx.chat.id, animMsg.message_id); } catch(e) {}

    if (count === 1) {
        const result = await gachaService.pull(user);
        const char = result.character;
        
        // Final DB Sync for single pull (since service doesn't do it)
        await db.users.update({ telegramId: user.telegramId }, {
            $set: { 
                pityCount: result.pityCount, // result has updated pity
                dust: result.dustTotal || user.dust || 0,
                shards: user.shards || {}
            }
        });

        let resMsg = ui.formatHeader("SUMMON COMPLETE") + "\n\n" +
            `✨ <b>Character:</b> ${char.name}\n` +
            `💎 <b>Rarity:</b> ${char.rarity}\n` +
            `<b>Pity:</b> ${result.pityCount}/100 ${result.isPity ? '⭐ GUARANTEED' : ''}\n\n`;

        if (result.isNew) {
            resMsg += `🆕 <b>NEW ACQUISITION!</b> Added to roster.`;
            return media.sendPortrait(ctx, char, resMsg, Markup.inlineKeyboard([
                [Markup.button.callback('✨ Pull Again', 'pull_conf_1'), Markup.button.callback('🔙 Altar', 'back_to_altar')]
            ]));
        } else {
            if (result.dustEarned > 0) {
                resMsg += `♻️ <b>DUPLICATE:</b> Converted to +${result.dustEarned} Dust (Max Shards).`;
            } else {
                resMsg += `♻️ <b>DUPLICATE:</b> Converted to 1 Character Shard.`;
            }
            return media.smartEdit(ctx, resMsg, Markup.inlineKeyboard([
                [Markup.button.callback('✨ Pull Again', 'pull_conf_1'), Markup.button.callback('🔙 Altar', 'back_to_altar')]
            ]));
        }
    } else {
        // 10x Pull Visual Rendering
        const bulk = await gachaService.bulkPull(user);
        const visual = require('../combat/visual');
        const gridBuffer = await visual.generateGachaGrid(bulk.results);
        
        let earnedShards = 0;
        bulk.results.forEach(r => {
             if (!r.isNew && r.dustEarned === 0) earnedShards++;
        });

        let resMsg = ui.formatHeader("🎲 10-PULL RESULTS") + "\n\n" +
            `✨ <b>New Characters:</b> ${bulk.newCount}\n` +
            `♻️ <b>Shards Earned:</b> +${earnedShards}\n`;
        if (bulk.totalDust > 0) {
            resMsg += `💎 <b>Dust Earned:</b> +${bulk.totalDust}\n`;
        }
        resMsg += `🔥 <b>New Pity:</b> ${bulk.pityCount}/100`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('💎 10x Pull Again', 'pull_conf_10')],
            [Markup.button.callback('🔙 Back to Altar', 'back_to_altar')]
        ]);

        if (gridBuffer) {
            return ctx.replyWithPhoto({ source: gridBuffer }, { caption: resMsg, parse_mode: 'HTML', ...kb });
        } else {
            return media.smartEdit(ctx, resMsg, kb);
        }
    }
});

gachaScene.action('back_to_altar', async (ctx) => {
    await ctx.answerCbQuery();
    return gachaScene.renderMenu(ctx);
});

module.exports = gachaScene;
