const db = require('../../database');
const ui = require('../ui');

/**
 * Social Handler: Logic for friends and gifting.
 */
module.exports = {
    async addFriend(ctx) {
        const user = ctx.state.user;
        const targetUsername = ctx.message.text.split(' ')[1];

        if (!targetUsername) return ctx.reply("Usage: /addfriend @username");

        const target = await db.users.findOne({ username: targetUsername.replace('@', '') });
        if (!target) return ctx.reply("Could not find that sorcerer.");

        if (target.telegramId === user.telegramId) return ctx.reply("You cannot friend yourself.");

        // Check if already friends
        user.friends = user.friends || [];
        if (user.friends.some(f => f.userId === target.telegramId)) {
            return ctx.reply("You are already connected with this user.");
        }

        // Add to friends (Pending logic simplified for MVP)
        user.friends.push({ userId: target.telegramId, username: target.username, status: 'accepted' });
        target.friends = target.friends || [];
        target.friends.push({ userId: user.telegramId, username: user.username, status: 'accepted' });

        await db.users.update({ telegramId: user.telegramId }, user);
        await db.users.update({ telegramId: target.telegramId }, target);

        return ctx.replyWithHTML(`🤝 <b>Bond Formed!</b> You and @${target.username} are now friends.`);
    },

    async showFriends(ctx) {
        const user = ctx.state.user;
        const friends = user.friends || [];

        if (friends.length === 0) return ctx.reply("Your contact list is empty. Use /addfriend to connect.");

        let msg = ui.formatHeader("FRIENDS LIST") + "\n\n";
        for (const f of friends) {
            const friendData = await db.users.findOne({ telegramId: f.userId });
            const status = friendData ? `🎖 ${friendData.rank}` : "Unknown";
            msg += `👤 @${f.username} - ${status}\n`;
        }

        return ctx.replyWithHTML(msg);
    }
};
