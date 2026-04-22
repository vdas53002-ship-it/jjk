const tournamentService = require('../../services/tournamentService');
const ui = require('../ui');

/**
 * Tournament Handler: Manage player registration and bracket views.
 */
module.exports = {
    async handleTournament(ctx) {
        const stats = tournamentService.getStatus();
        
        let msg = ui.formatHeader("ZENIN TOURNAMENT") + "\n\n" +
            `🏆 <b>Current Status:</b> ${stats.status.toUpperCase()}\n` +
            `👥 <b>Participants:</b> ${stats.count}\n\n`;

        if (stats.status === 'open') {
            msg += "Registration is currently OPEN! The bracket will be generated once enough sorcerers sign up.";
            return ctx.replyWithHTML(msg, {
                reply_markup: {
                    inline_keyboard: [[{ text: "📝 Sign Up", callback_data: "tourney_reg" }]]
                }
            });
        } else if (stats.status === 'active') {
            msg += "The tournament is in progress! Watch the brackets unfold in our global channel.";
            return ctx.replyWithHTML(msg);
        } else {
            msg += "Today's tournament has concluded. Return tomorrow to claim your spot in the Hall of Fame!";
            return ctx.replyWithHTML(msg);
        }
    },

    async handleRegistration(ctx) {
        const result = await tournamentService.registerUser(ctx.from.id, ctx.from.username || ctx.from.first_name);
        await ctx.answerCbQuery(result.msg, { show_alert: !result.success });
        if (result.success) {
            return ctx.editMessageText(ui.formatHeader("ZENIN TOURNAMENT") + "\n\n✅ You are registered! Prepare your team for the 12:00 UTC brackets.", { parse_mode: 'HTML' });
        }
    }
};
