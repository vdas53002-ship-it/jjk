const db = require('../../database');
const ui = require('../ui');
const media = require('../media');
const characters = require('../data/characters');
const { Markup } = require('telegraf');

const TYPES = { Close: '👊', Long: '🏹', Barrier: '🛡️' };

/**
 * Team Handler: Manages the 3-man active squad with Front, Middle, Back positions.
 */
module.exports = {
    async showTeamMenu(ctx, page = 0) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        const roster = await db.roster.find({ userId: userId });

        if (!user.teamIds || user.teamIds.length === 0) {
            // Initialize team if empty
            const initialIds = roster.slice(0, 3).map(r => r.charId);
            await db.users.update({ telegramId: userId }, { $set: { teamIds: initialIds } });
            user.teamIds = initialIds;
        }

        let teamBody = "";
        const labels = ["FRONT", "MIDDLE", "BACK"];
        
        for (let i = 0; i < user.teamIds.length; i++) {
            const id = user.teamIds[i];
            const data = roster.find(r => r.charId === id) || { level: 1 };
            const base = characters[id];
            if (!base) continue;

            const rarityIcon = ui.ICONS[base.rarity.toUpperCase()] || "⚪";
            teamBody += `<b>[${labels[i]}]</b>\n` +
                       `▪️ ${rarityIcon} <b>${id}</b> <pre>Lv.${data.level}</pre>\n\n`;
        }

        let msg = ui.formatHeader("SQUAD FORMATION") + "\n\n" +
                  teamBody +
                  ui.divider() + "\n";
        
        // Bench Logic
        const bench = roster.filter(r => !user.teamIds.includes(r.charId)).sort((a,b) => b.level - a.level);
        const pageSize = 5;
        const totalPages = Math.ceil(bench.length / pageSize);
        const start = page * pageSize;
        const visibleBench = bench.slice(start, start + pageSize);

        msg += `🗄 <b>BENCH (Page ${page + 1}/${totalPages || 1}):</b>\n`;
        if (visibleBench.length > 0) {
            visibleBench.forEach(b => {
                const base = characters[b.charId];
                const rarityIcon = base ? (ui.ICONS[base.rarity.toUpperCase()] || "⚪") : "⚪";
                msg += `▪️ ${rarityIcon} <b>${b.charId}</b> (Lv.${b.level})\n`;
            });
        } else {
            msg += "▪️ <i>No reserves available.</i>\n";
        }

        const kbRow1 = [
            Markup.button.callback('🔄 SWAP', 'team_swap_menu'),
            Markup.button.callback('↕️ REORDER', 'team_reorder_menu')
        ];
        const kbRow2 = [];
        if (page > 0) kbRow2.push(Markup.button.callback('⬅️ PREV', `team_page_${page - 1}`));
        if (page < totalPages - 1) kbRow2.push(Markup.button.callback('NEXT ➡️', `team_page_${page + 1}`));
        
        const kb = [kbRow1, kbRow2, [Markup.button.callback('🔙 BACK', 'back_to_hub')]].filter(r => r.length > 0);

        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
        return ctx.replyWithHTML(msg, Markup.inlineKeyboard(kb));
    },

    async showSwapMenu(ctx) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        let msg = ui.formatHeader("⚔️ SWAP CHARACTERS") + "\n\nSelect a slot to replace:";
        
        const labels = ["FRONT", "MIDDLE", "BACK"];
        const kb = user.teamIds.map((id, i) => [
            Markup.button.callback(`${labels[i]}: ${id}`, `team_swap_slot_${i}`)
        ]);
        kb.push([Markup.button.callback('🔙 CANCEL', 'cmd_team')]);

        return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    },

    async showSwapBench(ctx, slotIdx, page = 0) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        const roster = await db.roster.find({ userId: userId });
        const bench = roster.filter(r => !user.teamIds.includes(r.charId)).sort((a,b) => b.level - a.level);
        
        const pageSize = 8;
        const start = page * pageSize;
        const visible = bench.slice(start, start + pageSize);

        let msg = ui.formatHeader("SELECT REPLACEMENT") + `\n\nReplacing: <b>${user.teamIds[slotIdx]}</b>\nChoose from bench:`;
        
        const kb = visible.map(b => [
            Markup.button.callback(`${b.charId} (Lv${b.level})`, `team_swap_confirm_${slotIdx}_${b.charId}`)
        ]);

        const nav = [];
        if (page > 0) nav.push(Markup.button.callback('⬅️', `team_swpage_${slotIdx}_${page - 1}`));
        if (start + pageSize < bench.length) nav.push(Markup.button.callback('➡️', `team_swpage_${slotIdx}_${page + 1}`));
        if (nav.length > 0) kb.push(nav);
        
        kb.push([Markup.button.callback('🔙 CANCEL', 'team_swap_menu')]);

        return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    },

    async confirmSwap(ctx, slotIdx, newId) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        const oldId = user.teamIds[slotIdx];
        const labels = ["FRONT", "MIDDLE", "BACK"];

        let msg = ui.formatHeader("CONFIRM SWAP") + `\n\nSwap <b>${oldId}</b> (${labels[slotIdx]}) with <b>${newId}</b> (Bench)?`;
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ CONFIRM', `team_swap_exec_${slotIdx}_${newId}`)],
            [Markup.button.callback('❌ CANCEL', 'team_swap_menu')]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async executeSwap(ctx, slotIdx, newId) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        const oldId = user.teamIds[slotIdx];

        user.teamIds[slotIdx] = newId;
        await db.users.update({ telegramId: userId }, { $set: { teamIds: user.teamIds } });

        await ctx.answerCbQuery(`✅ ${newId} is now ${["FRONT", "MIDDLE", "BACK"][slotIdx]}!`);
        return this.showTeamMenu(ctx);
    },

    async showReorderMenu(ctx) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        let msg = ui.formatHeader("⚔️ REORDER TEAM") + "\n\nUse arrows to shift members:";
        
        const labels = ["FRONT", "MIDDLE", "BACK"];
        const kb = [];

        user.teamIds.forEach((id, i) => {
            msg += `\n${i+1}. <b>${labels[i]}:</b> ${id}`;
            const row = [];
            if (i > 0) row.push(Markup.button.callback(`↑ MOVE UP`, `team_move_${i}_up`));
            if (i < 2) row.push(Markup.button.callback(`↓ MOVE DOWN`, `team_move_${i}_down`));
            kb.push(row);
        });

        kb.push([Markup.button.callback('✅ DONE', 'cmd_team')]);
        return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    },

    async executeMove(ctx, idx, dir) {
        const user = await db.users.findOne({ telegramId: ctx.from.id });
        const target = dir === 'up' ? idx - 1 : idx + 1;
        
        const temp = user.teamIds[idx];
        user.teamIds[idx] = user.teamIds[target];
        user.teamIds[target] = temp;

        await db.users.update({ telegramId: ctx.from.id }, { $set: { teamIds: user.teamIds } });
        await ctx.answerCbQuery("Formation shifted.");
        return this.showReorderMenu(ctx);
    }
};
