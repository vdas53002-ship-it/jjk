const { Markup } = require('telegraf');
const upgradeService = require('../../services/upgradeService');
const db = require('../../database');
const ui = require('../ui');
const media = require('../media');
const items = require('../data/items');

/**
 * Upgrade Handler: UI for character "Awakening" and Stat Upgrades.
 */
module.exports = {
    async showUpgradeMenu(ctx, page = 0) {
        const userId = ctx.from.id;
        const roster = await db.roster.find({ userId: userId });

        if (roster.length === 0) return ctx.reply("❌ You have no characters to upgrade.");

        let msg = ui.formatHeader("🔧 UPGRADE – SELECT CHARACTER") + "\n\n" +
            "Select a sorcerer to enhance their fundamental capabilities.\n\n";

        const pageSize = 5;
        const totalPages = Math.ceil(roster.length / pageSize);
        const start = page * pageSize;
        const visible = roster.slice(start, start + pageSize);

        visible.forEach((c, i) => {
            const upgCount = Object.values(c.upgrades || {}).reduce((a, b) => a + b, 0);
            msg += `${start + i + 1}. <b>${c.charId}</b> (Lv${c.level}) — Slots: ${upgCount}/6\n`;
        });

        const kb = visible.map(c => [
            Markup.button.callback(`🔧 Upgrade ${c.charId}`, `upg_sel_char_${c._id}`)
        ]);

        const nav = [];
        if (page > 0) nav.push(Markup.button.callback('⬅️', `upg_page_${page - 1}`));
        if (start + pageSize < roster.length) nav.push(Markup.button.callback('➡️', `upg_page_${page + 1}`));
        if (nav.length > 0) kb.push(nav);

        kb.push([Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]);

        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
        return ctx.replyWithHTML(msg, Markup.inlineKeyboard(kb));
    },

    async renderUpgradeOptions(ctx, rosterId) {
        const char = await db.roster.findOne({ _id: rosterId });
        const user = await db.users.findOne({ telegramId: ctx.from.id });

        const upgCount = Object.values(char.upgrades || {}).reduce((a, b) => a + b, 0);

        let msg = ui.formatHeader(`UPGRADE: ${char.charId}`) + "\n\n" +
            `🎭 <b>Grade:</b> ${char.grade || 'Grade 4'}\n` +
            `📈 <b>Level:</b> ${char.level || 1}\n` +
            `📊 <b>Slots:</b> ${upgCount}/6\n\n` +
            `Choose an enhancement path:\n`;

        const kb = [
            [Markup.button.callback('✨ LEVEL UP (Dust/Coins)', `upg_lvl_exec_${rosterId}`)],
            [Markup.button.callback('🎖 PROMOTE GRADE', `upg_grade_exec_${rosterId}`)]
        ];
        
        const upgradeItems = Object.values(items).filter(i => i.shop);

        upgradeItems.forEach(item => {
            if (['daily', 'weekly', 'special'].includes(item.shop.category)) {
                const invItem = (user.inventory || []).find(inv => inv.id === item.id) || { qty: 0 };
                const label = `${item.icon} ${item.name} (x${invItem.qty})`;
                
                if (invItem.qty > 0) {
                    kb.push([Markup.button.callback(label, `upg_confirm_${rosterId}_${item.id}`)]);
                }
            }
        });

        kb.push([Markup.button.callback('⬅️ Back to Roster', 'cmd_upgrades')]);

        return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    },

    async confirmUpgrade(ctx, rosterId, itemId) {
        const char = await db.roster.findOne({ _id: rosterId });
        const item = items[itemId];

        let msg = ui.formatHeader("🔧 CONFIRM UPGRADE") + "\n\n" +
            `Character: <b>${char.charId}</b>\n` +
            `Upgrade: <b>${item.name}</b>\n` +
            `Effect: <i>${item.description}</i>\n\n` +
            "Proceed with awakening this power?";

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ CONFIRM', `upg_exec_${rosterId}_${itemId}`)],
            [Markup.button.callback('❌ CANCEL', `upg_sel_char_${rosterId}`)]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async handleUpgradeExecution(ctx, rosterId, itemId) {
        const result = await upgradeService.applyItemUpgrade(ctx.from.id, rosterId, itemId);

        if (!result.success) {
            return ctx.answerCbQuery(result.msg, { show_alert: true });
        }

        let msg = ui.formatHeader("✨ UPGRADE COMPLETE ✨") + "\n\n" +
            `${result.msg}\n\n` +
            `Check your character's stats to see the growth!`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🔧 Upgrade Again', `upg_sel_char_${rosterId}`)],
            [Markup.button.callback('👤 View Character', `roster_view_${rosterId}`)],
            [Markup.button.callback('🔙 Return', 'cmd_upgrades')]
        ]);

        await ctx.answerCbQuery("Success! Power Manifested.");
        return media.smartEdit(ctx, msg, kb);
    },

    async executeLevelUp(ctx, rosterId) {
        const result = await upgradeService.levelUpCharacter(ctx.from.id, rosterId);
        
        if (!result.success) {
            return ctx.answerCbQuery(result.msg, { show_alert: true });
        }

        await ctx.answerCbQuery("✨ LEVEL UP SUCCESSFUL!");
        return this.renderUpgradeOptions(ctx, rosterId);
    },

    async executeGradePromotion(ctx, rosterId) {
        const result = await upgradeService.promoteGrade(ctx.from.id, rosterId);
        
        if (!result.success) {
            return ctx.answerCbQuery(result.msg, { show_alert: true });
        }

        let msg = ui.formatHeader("🎖 PROMOTION GRANTED 🎖") + "\n\n" +
            `${result.msg}\n\n` +
            `Your sorcerer has ascended to a new height of power.`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🔧 Upgrade Again', `upg_sel_char_${rosterId}`)],
            [Markup.button.callback('🔙 Return', 'cmd_upgrades')]
        ]);

        await ctx.answerCbQuery("🎖 PROMOTION SUCCESS!");
        return media.smartEdit(ctx, msg, kb);
    }
};
