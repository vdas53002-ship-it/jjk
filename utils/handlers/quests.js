const questService = require('../../services/questService');
const questPool = require('../data/quests');
const ui = require('../ui');
const { Markup } = require('telegraf');

/**
 * Quest Handler: UI and interaction for the daily quest system.
 */
module.exports = {
    async handleQuests(ctx) {
        if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => null);
        const userId = ctx.from.id;
        const quests = await questService.syncQuests(userId);
        const resetTime = questService.getTimeUntilReset();

        let msg = ui.formatHeader("📋 DAILY QUESTS") + "\n" +
            `⏳ Resets in: <b>${resetTime}</b>\n` +
            `${ui.divider()}\n\n`;

        const kb = [];

        quests.forEach((uq, idx) => {
            const meta = questPool[uq.questId];
            const statusIcon = uq.claimed ? "✅" : (uq.completed ? "🌟" : "⬜");
            const progressPct = Math.min(1, uq.progress / uq.target);
            const progressBar = this.generateProgressBar(progressPct);
            
            msg += `${statusIcon} <b>${idx + 1}. ${meta.description}</b>\n` +
                `   ${progressBar} (${uq.progress}/${uq.target})\n` +
                `   💰 <i>Rewards: ${meta.reward.coins} coins + ${meta.reward.xp} XP</i>\n\n`;

            if (uq.completed && !uq.claimed) {
                kb.push([Markup.button.callback(`🎁 CLAIM QUEST ${idx + 1}`, `q_claim_${uq.questId}`)]);
            }
        });

        msg += `${ui.divider()}`;
        
        const hasUnclaimed = quests.some(q => q.completed && !q.claimed);
        if (hasUnclaimed) {
            kb.push([Markup.button.callback('✨ CLAIM ALL REWARDS', 'q_claim_all')]);
        }
        
        kb.push([Markup.button.callback('🔙 BACK', 'back_to_hub')]);

        if (ctx.callbackQuery) {
            return ctx.editMessageText(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(kb) }).catch(() => null);
        }
        return ctx.replyWithHTML(msg, Markup.inlineKeyboard(kb));
    },

    generateProgressBar(pct) {
        const size = 10;
        const filled = Math.round(size * pct);
        const empty = size - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
    },

    async handleClaim(ctx, questId) {
        await ctx.answerCbQuery("Processing claim...").catch(() => null);
        const result = await questService.claimQuest(ctx.from.id, questId);
        if (result.success) {
            let rewardMsg = "✅ <b>Quest completed!</b> You received:\n\n" +
                `💰 <b>Coins:</b> +${result.reward.coins}\n` +
                `📈 <b>Experience:</b> +${result.reward.xp}`;
            
            if (result.reward.items) {
                result.reward.items.forEach(i => rewardMsg += `\n📦 <b>${i.id}:</b> +${i.qty}`);
            }

            await ctx.replyWithHTML(rewardMsg);
            return this.handleQuests(ctx);
        } else {
            return ctx.replyWithHTML(`❌ <b>Claim failed:</b> ${result.message}`);
        }
    },

    async handleClaimAll(ctx) {
        await ctx.answerCbQuery("Focusing energies...").catch(() => null);
        const result = await questService.claimAll(ctx.from.id);
        if (result.success) {
            let rewardMsg = "✨ <b>All quests claimed!</b> Total rewards:\n\n" +
                `💰 <b>Coins:</b> +${result.coins}\n` +
                `📈 <b>Experience:</b> +${result.xp}`;
            
            if (result.items && result.items.length > 0) {
                // Group items
                const consolidated = {};
                result.items.forEach(i => consolidated[i.id] = (consolidated[i.id] || 0) + i.qty);
                Object.entries(consolidated).forEach(([id, qty]) => {
                    rewardMsg += `\n📦 <b>${id}:</b> +${qty}`;
                });
            }

            await ctx.replyWithHTML(rewardMsg);
            return this.handleQuests(ctx);
        } else {
            return ctx.replyWithHTML(`❌ <b>Claim failed:</b> ${result.message}`);
        }
    }
};
