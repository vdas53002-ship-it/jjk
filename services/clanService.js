const db = require('../database');

/**
 * Clan Service: Logic for organizations, membership, and seniority.
 */
module.exports = {
    /**
     * Creates a new Clan.
     * @param {number} userId - Founder Telegram ID
     * @param {string} name - Clan Name
     * @param {string} tag - Clan Tag (3-4 chars)
     */
    async createClan(userId, name, tag) {
        const user = await db.users.findOne({ telegramId: userId });
        
        // 1. Validation
        if (!user) return { success: false, msg: "User not found." };
        if (user.playerLevel < 20) return { success: false, msg: "Creation requires Player Level 20." };
        if (user.clanId) return { success: false, msg: "You are already in a clan." };
        if (!user.school) return { success: false, msg: "You must choose an academy (/school) first." };
        if (user.coins < 5000) return { success: false, msg: "Insufficient Coins (5,000 required)." };

        // 2. Process
        user.coins -= 5000;
        const newClan = {
            name,
            tag: tag.toUpperCase(),
            leaderId: userId,
            school: user.school,
            slots: 25,
            members: [userId],
            elders: [],
            treasury: { dust: 0 },
            createdAt: new Date(),
            totalElo: user.elo || 1000
        };

        const result = await db.clans.insert(newClan);
        user.clanId = result._id;
        user.clanRole = 'Leader';
        
        await db.users.update({ telegramId: userId }, { $set: { coins: user.coins, clanId: result._id, clanRole: 'Leader' } });

        return { success: true, msg: `Clan [${tag}] ${name} established!`, clan: result };
    },

    /**
     * Joins a clan.
     */
    async joinClan(userId, clanId) {
        const user = await db.users.findOne({ telegramId: userId });
        const clan = await db.clans.findOne({ _id: clanId });

        if (!user || !clan) return { success: false, msg: "Joining Error: Clan not found." };
        if (!user.school) return { success: false, msg: "You must choose an academy (/school) before joining a clan." };
        if (user.school !== clan.school) return { success: false, msg: `❌ This clan belongs to ${clan.school} High. You are in ${user.school} High!` };
        if (user.playerLevel < 15) return { success: false, msg: "Joining requires Player Level 15." };
        if (user.clanId) return { success: false, msg: "You are already in a clan." };
        
        const capacity = clan.slots || 25;
        if (clan.members.length >= capacity) return { success: false, msg: `Clan is at maximum capacity (${clan.members.length}/${capacity}).` };

        clan.members.push(userId);
        clan.totalElo = (clan.totalElo || 0) + (user.elo || 1000);
        user.clanId = clan._id;
        user.clanRole = 'Member';

        await db.clans.update({ _id: clanId }, { $set: { members: clan.members, totalElo: clan.totalElo } });
        await db.users.update({ telegramId: userId }, { $set: { clanId: clan._id, clanRole: 'Member' } });

        return { success: true, msg: `Welcome to ${clan.name}, sorcerer!`, clan };
    },

    /**
     * Leaves a clan.
     */
    async leaveClan(userId) {
        const user = await db.users.findOne({ telegramId: userId });
        if (!user || !user.clanId) return { success: false, msg: "You are not in a clan." };

        const clan = await db.clans.findOne({ _id: user.clanId });
        if (clan.leaderId === userId) return { success: false, msg: "Leaders cannot leave. You must disband or promote a new leader first." };

        clan.members = clan.members.filter(m => m !== userId);
        clan.elders = clan.elders.filter(m => m !== userId);
        clan.totalElo -= (user.elo || 1000);

        await db.clans.update({ _id: clan._id }, { $set: { members: clan.members, elders: clan.elders, totalElo: clan.totalElo } });
        
        await db.users.update({ telegramId: userId }, { $set: { clanId: null, clanRole: null } });

        return { success: true, msg: "You have left the clan." };
    },

    /**
     * Expands clan slots (+5 for 5,000 coins)
     */
    async expandClan(userId) {
        const user = await db.users.findOne({ telegramId: userId });
        if (!user.clanId || user.clanRole !== 'Leader') return { success: false, msg: "Only the leader can expand the syndicate." };
        
        if (user.coins < 5000) return { success: false, msg: "Insufficient Coins (5,000 required)." };
        
        const clan = await db.clans.findOne({ _id: user.clanId });
        const currentSlots = clan.slots || 25;
        if (currentSlots >= 50) return { success: false, msg: "Syndicate has reached maximum capacity (50)." };

        await db.clans.update({ _id: clan._id }, { $inc: { slots: 5 } });
        await db.users.update({ telegramId: userId }, { $inc: { coins: -5000 } });

        return { success: true, msg: `Syndicate expanded! Capacity now: ${currentSlots + 5}.` };
    }
};
