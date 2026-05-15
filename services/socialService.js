const db = require('../database');

/**
 * Social Service: Manages Friends, Gifts, and Spectating.
 */
module.exports = {
    async listOnlineBattles() {
        return await db.battles.find({ status: 'active' });
    },

    async addSpectator(battleId, userId) {
        const battle = await db.battles.findOne({ _id: battleId });
        if (!battle) return { success: false, msg: "Battle no longer active." };
        
        if (!battle.spectators) battle.spectators = [];
        if (!battle.spectators.includes(userId)) {
            await db.battles.update({ _id: battleId }, { $push: { spectators: userId } });
        }
        return { success: true, battle };
    },

    async cheerPlayer(battleId, userId, targetPlayerId) {
        const battle = await db.battles.findOne({ _id: battleId });
        if (!battle) return { success: false, msg: "Battle concluded." };
        
        if (battle.cheered && battle.cheered.includes(userId)) {
            return { success: false, msg: "You have already cheered in this match!" };
        }

        // Apply temporary buff logic here for the next turn
        await db.battles.update({ _id: battleId }, { 
            $set: { [`cheers.${targetPlayerId}`]: ((battle.cheers && battle.cheers[targetPlayerId]) || 0) + 0.05 },
            $push: { cheered: userId }
        });
        return { success: true, msg: "📣 You cheer loudly! +5% Crit Power for your ally!" };
    },

    async giftItem(fromUserId, toUsername, itemId, qty) {
        const fromUser = await db.users.findOne({ telegramId: fromUserId });
        const toUser = await db.users.findOne({ $or: [{ username: toUsername }, { username: toUsername.replace('@', '') }] });
        
        if (!toUser) return { success: false, msg: "Target sorcerer not found." };
        if (fromUser.telegramId === toUser.telegramId) return { success: false, msg: "You cannot gift to yourself!" };

        const inv = fromUser.inventory || [];
        const itemIdx = inv.findIndex(i => i.id === itemId && i.qty >= qty);
        if (itemIdx === -1) return { success: false, msg: "Insufficient item quantity in your bag." };

        // Deduct from sender
        inv[itemIdx].qty -= qty;
        const updatedFromInv = inv.filter(i => i.qty > 0);
        
        // Add to receiver
        let toInv = toUser.inventory || [];
        const existingIdx = toInv.findIndex(i => i.id === itemId);
        if (existingIdx !== -1) {
            toInv[existingIdx].qty += qty;
        } else {
            toInv.push({ id: itemId, qty });
        }

        await db.users.update({ telegramId: fromUser.telegramId }, { $set: { inventory: updatedFromInv } });
        await db.users.update({ telegramId: toUser.telegramId }, { $set: { inventory: toInv } });

        return { success: true, msg: `🎁 Successfully sent ${qty}x ${itemId} to ${toUser.username}!` };
    }
};
