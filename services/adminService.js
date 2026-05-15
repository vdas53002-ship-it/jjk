const db = require('../database');
const fs = require('fs');
const path = require('path');

// --- Log Helper ---
const logAdminAction = (adminId, command, targetId, result) => {
    const logPath = './logs/admin.log';
    if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');
    const entry = `[${new Date().toISOString()}] Admin:${adminId} | Cmd:${command} | Target:${targetId || 'N/A'} | Result:${result}\n`;
    fs.appendFileSync(logPath, entry);
};

const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];

/**
 * Admin Service: "God Mode" logic with Role-Based Access Control.
 */
module.exports = {
    ROLES: { OWNER: 4, HEAD_ADMIN: 3, MODERATOR: 2, EVENT_MANAGER: 1, PLAYER: 0 },

    async getUserRole(userId) {
        // Enforce Environment Overrides (Master Admin)
        if (ADMIN_IDS.includes(userId)) return this.ROLES.OWNER;

        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return 0;
        return user.adminRole ?? 0;
    },

    /**
     * User Management
     */
    async banUser(adminId, userId, duration = 'perm', reason = 'No reason') {
        const until = duration === 'perm' ? -1 : Date.now() + (parseInt(duration) * 24 * 60 * 60 * 1000);
        await db.users.update({ telegramId: userId }, { $set: { banned: true, banUntil: until, banReason: reason } });
        logAdminAction(adminId, `ban:${duration}`, userId, "SUCCESS");
        return { success: true, msg: `✅ User ${userId} banned for ${duration}. Reason: ${reason}` };
    },

    async unbanUser(adminId, userId) {
        await db.users.update({ telegramId: userId }, { $set: { banned: false, banUntil: null } });
        logAdminAction(adminId, 'unban', userId, "SUCCESS");
        return { success: true, msg: `✅ User ${userId} unbanned.` };
    },

    async warnUser(adminId, userId, reason) {
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return { success: false, msg: "User not found." };
        user.warnings = (user.warnings || 0) + 1;
        await db.users.update({ telegramId: userId }, { $set: { warnings: user.warnings } });
        logAdminAction(adminId, 'warn', userId, `WARNINGS:${user.warnings}`);
        return { success: true, msg: `✅ Warning issued to ${userId} (${user.warnings}/3). Reason: ${reason}` };
    },

    async resetAccount(adminId, userId) {
        await db.users.update({ telegramId: userId }, { $set: { 
            coins: 500, playerLevel: 1, playerXp: 0, elo: 1000, rank: 'Iron', 
            inventory: [], battles: 0 
        }});
        await db.roster.remove({ userId: userId }, { multi: true });
        logAdminAction(adminId, 'reset_account', userId, "SUCCESS");
        return { success: true, msg: `✅ User ${userId} account fully reset.` };
    },

    /**
     * Economy & Items
     */
    async addCurrency(adminId, userId, type, amount) {
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return { success: false, msg: "User not found." };
        const update = {};
        update[type] = amount;
        await db.users.update({ telegramId: userId }, { $inc: update });
        logAdminAction(adminId, `add_${type}`, userId, `AMT:${amount}`);
        return { success: true, msg: `✅ Modified ${type} by ${amount} for ${userId}.` };
    },

    async giveItem(adminId, userId, itemId, qty) {
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return { success: false, msg: "User not found." };
        
        let inventory = user.inventory || [];
        const existingIdx = inventory.findIndex(i => i.id === itemId);
        if (existingIdx !== -1) {
            inventory[existingIdx].qty += qty;
        } else {
            inventory.push({ id: itemId, qty: qty });
        }
        
        await db.users.update({ telegramId: userId }, { $set: { inventory } });
        logAdminAction(adminId, 'give_item', userId, `ITEM:${itemId} QTY:${qty}`);
        return { success: true, msg: `✅ Granted ${qty}x ${itemId} to ${userId}.` };
    },

    async grantCharacter(adminId, userId, requestedName, level = 1) {
        const charDataModule = require('../utils/data/characters');
        const DATA = charDataModule;
        const ALIASES = charDataModule.ALIASES || {};

        // 1. Resolve Name (Strict -> Alias -> Case-Insensitive -> Partial)
        let charId = Object.keys(DATA).find(k => k.toLowerCase() === requestedName.toLowerCase());
        
        if (!charId) {
            const aliasMatch = Object.keys(ALIASES).find(a => a.toLowerCase() === requestedName.toLowerCase());
            if (aliasMatch) charId = ALIASES[aliasMatch];
        }
        
        if (!charId) {
            const spacedName = requestedName.replace(/_/g, ' ').toLowerCase();
            charId = Object.keys(DATA).find(k => k.toLowerCase().includes(spacedName));
        }

        const charData = DATA[charId];
        if (!charData) return { success: false, msg: `❌ Character "${requestedName}" not found.` };

        await db.roster.insert({
            userId,
            charId,
            level: parseInt(level) || 1,
            xp: 0,
            rarity: charData.rarity,
            upgrades: {},
            lastUpdated: new Date()
        });

        logAdminAction(adminId, 'give_char', userId, `CHAR:${charId} LV:${level}`);
        return { success: true, msg: `✅ Granted <b>${charId}</b> Lv.${level} to user ${userId}.` };
    },

    /**
     * Battle Control
     */
    async listActiveBattles() {
        return await db.battles.find({ status: 'active' });
    },

    async cancelBattle(adminId, battleId) {
        await db.battles.update({ _id: battleId }, { $set: { status: 'cancelled' } });
        logAdminAction(adminId, 'cancel_battle', null, `BATTLE:${battleId}`);
        return { success: true, msg: `✅ Battle ${battleId} cancelled.` };
    },

    /**
     * System Stats
     */
    async getSystemStats() {
        const userCount = await db.users.count({});
        const activeBattles = await db.battles.count({ status: 'active' });
        const clanCount = await db.clans.count({});
        const mem = process.memoryUsage();
        
        return {
            users: userCount,
            activeBattles,
            clans: clanCount,
            uptime: process.uptime(),
            memory: `${Math.round(mem.rss / 1024 / 1024)}MB`
        };
    },

    async executeSeasonReset(adminId) {
        const users = await db.users.find({});
        for (const user of users) {
            const newElo = Math.max(1000, 1000 + Math.floor((user.elo - 1000) * 0.5));
            await db.users.update({ _id: user._id }, { 
                $set: { 
                    elo: newElo, 
                    rank: 'Iron',
                    dust: (user.dust || 0) + 50 
                } 
            });
        }
        logAdminAction(adminId, 'season_reset', 'ALL', "SUCCESS");
        return { success: true, msg: `🌪 Season Reset complete for ${users.length} sorcerers.` };
    }
};
