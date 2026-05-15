const domainService = require('../../services/domainService');
const ui = require('../ui');
const media = require('../media');

/**
 * Domain Handler: Manage ultimate techniques.
 */
module.exports = {
    async showDomainList(ctx) {
        const user = ctx.state.user;
        if (user.playerLevel < 40) {
            return ctx.replyWithHTML(ui.formatHeader("DOMAIN MASTERY") + "\n\n⚠️ Your cursed energy is too weak. Domain Expansion unlocks at Level 40.");
        }

        let msg = ui.formatHeader("DOMAIN EXPANSION") + "\n\n" +
            "Select a sorcerer to view their potential Domain field:\n\n";

        const kb = user.teamIds.map(charId => [
            { text: `🏮 ${charId}`, callback_data: `view_domain_${charId}` }
        ]);

        return ctx.replyWithHTML(msg, { reply_markup: { inline_keyboard: kb } });
    },

    async renderDomainDetail(ctx, charId) {
        const domain = await domainService.getDomain(charId);
        const msg = ui.formatHeader(domain.name) + "\n\n" +
            `👤 <b>Sorcerer:</b> ${charId}\n` +
            `🌀 <b>Sure-Hit:</b> ${domain.effect}\n` +
            `📈 <b>Mastery Power:</b> ${JSON.stringify(domain.buff)}\n\n` +
            `<i>The domain is deployed when the CE gauge reaches 100%.</i>`;
        
        return media.smartEdit(ctx, msg, { 
            reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "cmd_domains" }]] } 
        });
    }
};
