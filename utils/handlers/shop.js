const db = require('../../database');
const ui = require('../ui');
const media = require('../media');
const items = require('../data/items');
const shopService = require('../../services/shopService');
const { Markup } = require('telegraf');

/**
 * Shop Handler: Manages the Daily, Weekly, and Special markets.
 */
module.exports = {
    async showShop(ctx, category = 'daily') {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        if (!user) return ctx.reply("Please /start first.");

        // Refresh stock if needed
        const shopState = await shopService.refreshShopIfNeeded(user);

        // Calculate Time Until Refresh
        const now = new Date();
        let refreshText = "";
        if (category === 'daily') {
            const nextDaily = new Date().setUTCHours(24, 0, 0, 0);
            const diff = nextDaily - now;
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff / (1000 * 60)) % 60);
            refreshText = `📅 Refresh in ${h}h ${m}m`;
        } else if (category === 'weekly') {
            const day = now.getUTCDay();
            const diffDays = (8 - day) % 7 || 7;
            const nextWeekly = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffDays).setUTCHours(0, 0, 0, 0);
            const diff = nextWeekly - now;
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            refreshText = `🗓 Refresh in ${d}d ${h}h`;
        } else {
            refreshText = "✨ Always Available";
        }

        let itemList = "";
        const filtered = Object.values(items).filter(i => i.shop?.category === category);
        const kb = [];

        filtered.forEach(item => {
            const stockMax = item.shop.stock;
            const shopState = user.shopState || {};
            const categoryState = shopState[category] || { stock: {} };
            const stockCurrent = category === 'special' ? '∞' : (categoryState.stock[item.id] ?? stockMax);
            
            itemList += `▪️ <b>${item.icon || '📦'} ${item.name}</b>\n` +
                       `💰 Price: <code>${item.price}</code> | 📦 Stock: ${stockCurrent}\n` +
                       `📝 <i>${item.description}</i>\n\n`;

            if (stockCurrent > 0 || category === 'special') {
                kb.push([Markup.button.callback(`🛒 Buy ${item.name}`, `shop_confirm_${item.id}`)]);
            } else {
                kb.push([Markup.button.callback(`🚫 SOLD OUT`, `nop`)]);
            }
        });

        const msg = ui.formatHeader(`MARKET - ${category.toUpperCase()}`, "SHOP") + "\n" +
            `⏳ <i>${refreshText}</i>\n\n` +
            `💰 <b>Wallet:</b> <code>${user.coins}</code> Coins\n\n` +
            ui.panel(itemList || "<i>The shelves are empty... Come back later.</i>");

        const tabs = [
            Markup.button.callback('🌟 DAILY', 'shop_nav_daily'),
            Markup.button.callback('🗓 WEEKLY', 'shop_nav_weekly'),
            Markup.button.callback('✨ SPECIALS', 'shop_nav_special')
        ];
        
        kb.push(tabs);
        kb.push([Markup.button.callback('🔙 BACK', 'back_to_hub')]);

        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
        return ctx.replyWithHTML(msg, Markup.inlineKeyboard(kb));
    },

    async showConfirm(ctx, itemId) {
        const item = items[itemId];
        const user = await db.users.findOne({ telegramId: ctx.from.id });

        let msg = ui.formatHeader("🛒 CONFIRM PURCHASE") + "\n\n" +
            `Are you sure you want to buy <b>1x ${item.name}</b> for 🪙 <b>${item.price}</b>?\n\n` +
            `Your Balance: 🪙 ${user.coins} ➔ 🪙 ${user.coins - item.price}`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ CONFIRM', `shop_exec_${itemId}`)],
            [Markup.button.callback('❌ CANCEL', `shop_nav_${item.shop.category}`)]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async executePurchase(ctx, itemId) {
        const result = await shopService.buyItem(ctx.from.id, itemId);

        if (!result.success) {
            return ctx.answerCbQuery(result.msg, { show_alert: true });
        }

        const user = await db.users.findOne({ telegramId: ctx.from.id });
        let msg = ui.formatHeader("✅ PURCHASE COMPLETE") + "\n\n" +
            `You received <b>1x ${result.item.name}</b>!\n` +
            `Remaining balance: 🪙 <b>${user.coins}</b>`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🎒 INVENTORY', 'cmd_inv')],
            [Markup.button.callback('🛍 SHOP AGAIN', `shop_nav_${result.item.shop.category}`)],
            [Markup.button.callback('🔙 BACK', 'back_to_hub')]
        ]);

        await ctx.answerCbQuery(`Successfully bought ${result.item.name}!`);
        return media.smartEdit(ctx, msg, kb);
    }
};
