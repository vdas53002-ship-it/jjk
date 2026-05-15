const db = require('../../database');
const ui = require('../ui');

/**
 * Competitive Handler: Logic for rankings and leaderboards.
 */
module.exports = {
    async showLeaderboard(ctx) {
        const topPlayers = await db.users.find({}).sort({ elo: -1 }).limit(10);
        
        let msg = ui.formatHeader("GLOBAL RANKINGS") + "\n\n";
        topPlayers.forEach((p, i) => {
            const medal = i === 0 ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : "👤"));
            msg += `${medal} <b>#${i + 1} ${p.username}</b> - <code>${p.elo} ELO</code> (${p.rank})\n`;
        });
        
        msg += `\n<i>Only the strongest reach the peak.</i>`;
        return ctx.replyWithHTML(msg);
    },

    async showRank(ctx) {
        const user = ctx.state.user;
        if (!user) return ctx.reply("Please /start first.");

        const count = await db.users.count({ elo: { $gt: user.elo } });
        const globalRank = count + 1;

        let msg = ui.formatHeader("SORCERER RANK") + "\n\n" +
            `🎖 <b>TIER:</b> ${user.rank}\n` +
            `📈 <b>ELO:</b> <code>${user.elo}</code>\n` +
            `🌍 <b>GLOBAL POSITION:</b> #${globalRank}\n\n` +
            `<i>Next Promotion at Gold Rank (1600 ELO).</i>`;

        return ctx.replyWithHTML(msg);
    }
};
