const items = require('../data/items');
const ui = require('../ui');
const db = require('../../database');
const media = require('../media');
const { Markup } = require('telegraf');

/**
 * Inventory Handler: Displays and manages the user's collected items.
 */
module.exports = {
    async showInventory(ctx) {
        let user = await db.users.findOne({ telegramId: ctx.from.id });
        const inv = user.inventory || [];
        
        const potions = inv.filter(i => items[i.id]?.name.toLowerCase().includes('potion'));
        
        let msg = `⚡ <b>Yᴏᴜʀ Iɴᴠᴇɴᴛᴏʀʏ</b> 👇\n\n` +
            `• <b>Tɪᴄᴋᴇᴛꜱ :</b> <code>${user.gachaTickets || 0}</code>\n` +
            `• <b>Cᴜʀᴇꜱᴇᴅ Eɴᴇʀɢʏ :</b> <code>${user.stamina || 0}/100</code>\n` +
            `• <b>Pᴏᴛɪᴏɴꜱ :</b> <code>${potions.length}</code>\n\n` +
            `💰 <b>Gᴏʟᴅꜱ :</b> <code>${user.gems || 0}</code>\n` +
            `💎 <b>Sʜᴀʀᴅꜱ :</b> <code>${user.shardsCurrency || 0}</code>\n` +
            `🪙 <b>Cᴏɪɴꜱ :</b> <code>${user.coins || 0}</code>\n\n` +
            `<i>Tap an item button below to use or view details.</i>`;

        const kb = [];
        inv.forEach(entry => {
            const data = items[entry.id];
            if (data) {
                kb.push([Markup.button.callback(`${data.icon} ${data.name} (x${entry.qty})`, `view_inv_${entry.id}`)]);
            }
        });
        kb.push([Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]);

        if (ctx.callbackQuery) {
            return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
        }
        return media.sendBanner(ctx, "inventory", msg, Markup.inlineKeyboard(kb));
    },

    async viewItemDetails(ctx, itemId) {
        const item = items[itemId];
        if (!item) return ctx.answerCbQuery("Item not found.");

        const user = await db.users.findOne({ telegramId: ctx.from.id });
        const invEntry = (user.inventory || []).find(i => i.id === itemId);
        if (!invEntry || invEntry.qty <= 0) return ctx.answerCbQuery("You no longer own this item.");

        const type = item.type || item.shop?.category || "Consumable";
        let msg = ui.formatHeader(item.name) + "\n\n" +
            `Type: <b>${type.toUpperCase()}</b>\n` +
            `Quantity: <b>${invEntry.qty}</b>\n\n` +
            `<i>${item.description}</i>`;

        const kb = [];
        // Only show USE button for specific items
        const usableOutOfBattle = ['energy_drink', 'exp_ticket', 'cursed_charm', 'exp_charm', 'minor_hp_potion', 'ce_charge'];
        if (usableOutOfBattle.includes(itemId)) {
            kb.push([Markup.button.callback(`✨ Use ${item.name}`, `use_inv_${itemId}`)]);
        }
        kb.push([Markup.button.callback('⬅️ Back to Bag', 'cmd_inv')]);

        return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    },

    async useItem(ctx, itemId) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        const inv = user.inventory || [];
        const invIdx = inv.findIndex(i => i.id === itemId);

        if (invIdx === -1 || inv[invIdx].qty <= 0) {
            return ctx.answerCbQuery("❌ You don't have enough of this item!");
        }

        let updateResult = "";
        const setOps = {};
        const incOps = {};

        if (itemId === 'energy_drink') {
            incOps.dailyExploreCount = -100; // Large reduction for drink
            updateResult = "✅ Hunt Limit Restored! (Daily hunt count reduced by 100)";
        } else if (itemId === 'max_stamina_potion') {
            setOps.dailyExploreCount = 0;
            updateResult = "🔥 EXPEDITION BURST! Daily limit reset to 0/500.";
        } else if (itemId === 'soul_shard') {
            incOps.dust = 100;
            updateResult = "✨ Soul Shard Shattered! +100 Dust acquired.";
        } else if (itemId === 'mystery_box') {
            const roll = Math.random();
            if (roll < 0.4) {
                incOps.coins = 1000;
                updateResult = "🎁 Mystery Box Opened: Found 1000 Coins!";
            } else if (roll < 0.7) {
                incOps.gachaTickets = 2;
                updateResult = "🎁 Mystery Box Opened: Found 2x Gacha Tickets!";
            } else {
                incOps.dust = 50;
                updateResult = "🎁 Mystery Box Opened: Found +50 Dust!";
            }
        } else if (itemId === 'exp_ticket') {
            const expiry = Date.now() + (24 * 60 * 60 * 1000);
            setOps.hasExplorationTicket = true;
            setOps.expTicketExpiry = expiry;
            updateResult = "✅ Activation Successful! You have unlimited explorations for the next 24h.";
        } else if (itemId === 'cursed_charm') {
            setOps.activeCursedCharm = true;
            updateResult = "🧿 Cursed Charm Active! Your next hunt will have a massive capture bonus.";
        } else if (itemId === 'exp_charm') {
            setOps.activeExpCharm = true;
            updateResult = "✨ EXP Charm Active! Your team will gain double XP in their next battle.";
        } else if (['special_grade_potion', 'minor_hp_potion', 'major_hp_potion', 'ce_core', 'ce_charge'].includes(itemId)) {
            return ctx.answerCbQuery("⚔️ This is a combat item! Use it during a duel.", { show_alert: true });
        }

        // Standard decrement logic
        inv[invIdx].qty -= 1;
        const finalInv = inv.filter(i => i.qty > 0);
        
        await db.users.update({ telegramId: ctx.from.id }, { 
            $set: { ...setOps, inventory: finalInv },
            $inc: incOps 
        });

        await ctx.answerCbQuery(updateResult, { show_alert: true });
        return this.showInventory(ctx);
    }
};

