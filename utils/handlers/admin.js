const adminService = require('../../services/adminService');
const ui = require('../ui');
const media = require('../media');
const db = require('../../database');
const { Markup } = require('telegraf');

/**
 * Admin Handler: Advanced oversight and system administration.
 */
module.exports = {
    async handleAdminCommand(ctx) {
        const adminId = ctx.from.id;
        const adminRole = await adminService.getUserRole(adminId);
        if (adminRole === 0) return ctx.reply("❌ Unauthorized.");

        const text = (ctx.message && ctx.message.text) || ctx.state.commandText || "";
        const args = text.split(' ').slice(1);

        if (args.length === 0 && !ctx.state.commandText) return module.exports.showDashboard(ctx);

        const sub = (args[0] && args[0].toLowerCase()) || null;

        try {
            switch (sub) {
                // --- USER MANAGEMENT ---
                case 'user': {
                    const target = await this.resolveTarget(args[1]);
                    if (!target) return ctx.reply("❌ Sorcerer not found.");
                    return this.showUserInfo(ctx, target.telegramId);
                }
                case 'profile': {
                    const target = await this.resolveTarget(args[1]);
                    if (!target) return ctx.reply("❌ Sorcerer not found.");
                    return this.showPublicProfile(ctx, target.telegramId);
                }
                case 'warn': {
                    if (adminRole < 2) return ctx.reply("❌ Moderator+ required.");
                    const target = await this.resolveTarget(args[1]);
                    if (!target) return ctx.reply("❌ Target not found.");
                    const res = await adminService.warnUser(adminId, target.telegramId, args.slice(2).join(' '));
                    return ctx.reply(res.msg);
                }
                case 'ban': {
                    if (adminRole < 2) return ctx.reply("❌ Moderator+ required.");
                    const target = await this.resolveTarget(args[1]);
                    if (!target) return ctx.reply("❌ Target not found.");
                    const res = await adminService.banUser(adminId, target.telegramId, args[2] || '1', args.slice(3).join(' '));
                    return ctx.reply(res.msg);
                }
                case 'reset': {
                    if (adminRole < 3) return ctx.reply("❌ Head Admin+ required.");
                    const target = await this.resolveTarget(args[1]);
                    if (!target) return ctx.reply("❌ Target not found.");
                    return ctx.reply((await adminService.resetAccount(adminId, target.telegramId)).msg);
                }

                // --- ECONOMY ---
                case 'add_coins':
                case 'add_gems':
                case 'add_shards':
                case 'give_item':
                case 'give_char':
                case 'give_character': {
                    if (adminRole < 3) return ctx.reply("❌ Head Admin+ required.");
                    const target = await this.resolveTarget(args[1]);
                    if (!target) return ctx.reply("❌ Target not found.");
                    
                    let res;
                    if (sub === 'add_coins') res = await adminService.addCurrency(adminId, target.telegramId, 'coins', parseInt(args[2]));
                    else if (sub === 'add_gems') res = await adminService.addCurrency(adminId, target.telegramId, 'gems', parseInt(args[2]));
                    else if (sub === 'add_shards') res = await adminService.addCurrency(adminId, target.telegramId, 'shardsCurrency', parseInt(args[2]));
                    else if (sub === 'give_item') res = await adminService.giveItem(adminId, target.telegramId, args[2], parseInt(args[3]));
                    else {
                        // give_char parsing: name might have spaces or underscores
                        let charName = args[2];
                        let level = args[3] || 1;
                        
                        // Handle names with spaces: "/admin give_char @user Yuji Itadori 50"
                        if (args.length > 4 && !isNaN(parseInt(args[args.length - 1]))) {
                            level = args[args.length - 1];
                            charName = args.slice(2, -1).join(' ');
                        } else if (args.length > 3 && isNaN(parseInt(args[3]))) {
                            charName = args.slice(2).join(' ');
                            level = 1;
                        }
                        
                        res = await adminService.grantCharacter(adminId, target.telegramId, charName, level);
                    }
                    return ctx.replyWithHTML(res.msg);
                }

                // --- BATTLE CONTROL ---
                case 'battles': return this.listBattles(ctx);
                case 'cancel_battle': {
                    if (adminRole < 2) return ctx.reply("❌ Moderator+ required.");
                    return ctx.reply((await adminService.cancelBattle(adminId, args[1])).msg);
                }

                // --- SYSTEM ---
                case 'broadcast': {
                    if (adminRole < 2) return ctx.reply("❌ Moderator+ required.");
                    return this.handleBroadcast(ctx, args);
                }
                case 'season_reset': {
                    if (adminRole < 4) return ctx.reply("❌ Owner required.");
                    return this.showSeasonConfirm(ctx);
                }
                case 'season_reset_exec': {
                    if (adminRole < 4) return ctx.reply("❌ Owner required.");
                    return ctx.reply((await adminService.executeSeasonReset(adminId)).msg);
                }
                
                // Shortcut Helpers
                case 'coins_msg': return ctx.reply("💰 <b>GIVE COINS</b>\nUse: <code>/admin add_coins @user 1000</code>", { parse_mode: 'HTML' });
                case 'shards_msg': return ctx.reply("💎 <b>GIVE SHARDS</b>\nUse: <code>/admin add_shards @user 50</code>", { parse_mode: 'HTML' });
                case 'tkts_msg': return ctx.reply("🎟 <b>GIVE TICKETS</b>\nUse: <code>/admin give_item @user gacha_ticket 5</code>", { parse_mode: 'HTML' });
                case 'char_msg': return ctx.reply("⛩ <b>GIVE CHARACTER</b>\nUse: <code>/admin give_char @user Character Name 1</code>", { parse_mode: 'HTML' });
                case 'item_msg': return ctx.reply("🎁 <b>GIVE ITEM</b>\nUse: <code>/admin give_item @user item_id 1</code>", { parse_mode: 'HTML' });

                case 'stats': return this.showDashboard(ctx);

                case 'promote': {
                    if (adminRole < 4) return ctx.reply("❌ Owner required.");
                    const target = await this.resolveTarget(args[1]);
                    if (!target) return ctx.reply("❌ Target not found.");
                    const level = parseInt(args[2]) || 1;
                    await db.users.update({ telegramId: target.telegramId }, { $set: { adminRole: level } });
                    return ctx.reply(`✅ @${target.username} promoted to Role Level ${level}.`);
                }
                case 'demote': {
                    if (adminRole < 4) return ctx.reply("❌ Owner required.");
                    const target = await this.resolveTarget(args[1]);
                    if (!target) return ctx.reply("❌ Target not found.");
                    await db.users.update({ telegramId: target.telegramId }, { $set: { adminRole: 0 } });
                    return ctx.reply(`✅ @${target.username} demoted to Player.`);
                }
                case 'maintenance': {
                    if (adminRole < 3) return ctx.reply("❌ Head Admin+ required.");
                    const state = (args[1] && args[1].toLowerCase() === 'on');
                    await db.settings.update({ key: 'maintenance' }, { $set: { value: state } }, { upsert: true });
                    return ctx.reply(`🚧 Maintenance Mode: ${state ? 'ENABLED' : 'DISABLED'}`);
                }

                default:
                    return ctx.reply("❓ Unknown Command. Use /admin to see options.");
            }
        } catch (e) {
            console.error(e);
            return ctx.reply(`❌ System Error: ${e.message}`);
        }
    },

    async resolveTarget(input) {
        if (!input) return null;
        if (input.startsWith('@')) {
            return await db.users.findOne({ username: input.replace('@', '') });
        }
        const id = parseInt(input);
        if (!isNaN(id)) return await db.users.findOne({ telegramId: id });
        return null;
    },

    async showUserInfo(ctx, userId) {
        const user = await db.users.findOne({ telegramId: userId });
        const roster = await db.roster.find({ userId });
        
        let msg = ui.formatHeader(`👤 USER PROFILE: @${user.username}`) + "\n" +
            `ID: <code>${user.telegramId}</code>\n` +
            `Role: <b>${user.adminRole ? 'Staff' : 'Player'}</b>\n` +
            `Status: ${user.banned ? '🚫 BANNED' : '✅ Active'}\n` +
            ui.divider() + "\n" +
            `📊 <b>STATS</b>\n` +
            `Rank: ${user.rank} (ELO: ${user.elo})\n` +
            `Coins: 🪙 ${user.coins} | Gems: 💎 ${user.gems || 0}\n` +
            `Dust: ✨ ${user.dust || 0} | Tickets: 🎟 ${user.gachaTickets || 0}\n\n` +
            `⚠️ <b>Warnings:</b> ${user.warnings || 0}/3\n` +
            `📦 <b>Roster:</b> ${roster.length} characters`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('⚠️ WARN', `adm_warn_${userId}`), Markup.button.callback('🚫 BAN', `adm_ban_${userId}`)],
            [Markup.button.callback('🔄 RESET', `adm_reset_${userId}`), Markup.button.callback('🔙 BACK', 'adm_nav_stats')]
        ]);

        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, kb);
        return ctx.replyWithHTML(msg, kb);
    },

    async showSeasonConfirm(ctx) {
        const msg = ui.formatHeader("SEASON RESET", "BATTLE") + "\n\n" +
            "⚠️ <b>WARNING: ELO WIPEOUT</b>\n" +
            "You are about to reset all sorcerer ELO to 1000 and distribute Dust rewards.\n\n" +
            "<i>This action is irreversible. Continue?</i>";

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ YES, RESET SEASON', 'adm_season_yes')],
            [Markup.button.callback('❌ NO, CANCEL', 'adm_nav_stats')]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async showDashboard(ctx) {
        const stats = await adminService.getSystemStats();
        let msg = ui.formatHeader("BOT OVERSEER", "GENERAL") + "\n\n" +
            `👤 <b>Users:</b> <code>${stats.users}</code>\n` +
            `⚔️ <b>Active Battles:</b> <code>${stats.activeBattles}</code>\n` +
            `🏰 <b>Total Clans:</b> <code>${stats.clans}</code>\n\n` +
            `📊 <b>SYSTEM HEALTH</b>\n` +
            `└ Uptime: <code>${Math.floor(stats.uptime / 60)}m</code>\n` +
            `└ Memory: <code>${stats.memory}</code>\n` +
            ui.divider() + "\n" +
            `<i>Quick Command:</i> <code>/admin user @name</code>`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('💰 COINS', 'adm_short_coins'), Markup.button.callback('⛩ CHARACTER', 'adm_short_char')],
            [Markup.button.callback('💎 SHARDS', 'adm_short_shards'), Markup.button.callback('🎟 TICKETS', 'adm_short_tkts')],
            [Markup.button.callback('📢 BROADCAST', 'adm_nav_broadcast'), Markup.button.callback('🌪 SEASON RESET', 'adm_nav_season')],
            [Markup.button.callback('🔄 REFRESH', 'adm_nav_stats')]
        ]);

        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, kb);
        return ctx.replyWithHTML(msg, kb);
    },

    async handleBroadcast(ctx, args) {
        const message = args.slice(1).join(' ');
        if (!message) return ctx.reply("Usage: /admin broadcast [message]");
        
        await ctx.reply(`⚠️ <b>PREVIEW:</b>\n\n${message}\n\nType /admin broadcast_confirm to send to all users.`, { parse_mode: 'HTML' });
        ctx.session.pendingBroadcast = message;
    },

    async listBattles(ctx) {
        const battles = await adminService.listActiveBattles();
        let msg = ui.formatHeader("⚔️ LIVE BATTLES") + "\n\n";
        
        if (battles.length === 0) msg += "<i>No active cursed clashes.</i>";
        
        const kb = [];
        battles.slice(0, 10).forEach(b => {
            msg += `• <code>${b._id}</code>: @${b.p1.username} vs ${b.p2 ? '@' + b.p2.username : 'AI'}\n`;
            kb.push([Markup.button.callback(`❌ Cancel ${b._id.slice(-4)}`, `adm_cancel_${b._id}`)]);
        });

        kb.push([Markup.button.callback('🔙 BACK', 'adm_nav_stats')]);

        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, { inline_keyboard: kb });
        return ctx.replyWithHTML(msg, Markup.inlineKeyboard(kb));
    },

    async showHelpReference(ctx) {
        const msg = "📚 <b>ADMIN COMMAND REFERENCE:</b>\n\n" +
            "👤 <b>User:</b> <code>/admin user [id]</code>\n" +
            "👤 <b>Profile:</b> <code>/admin profile [id]</code>\n" +
            "💰 <b>Coins:</b> <code>/admin add_coins [id] [qty]</code>\n" +
            "⛩ <b>Char:</b> <code>/admin give_char [id] [name] [lv]</code>\n" +
            "🚫 <b>Ban:</b> <code>/admin ban [id] [days] [reason]</code>\n" +
            "✨ <b>Gacha:</b> <code>/admin gacha_pity_reset [id]</code>\n" +
            "🛡 <b>Clan:</b> <code>/admin clan_delete [name]</code>\n" +
            "📢 <b>Broadcast:</b> <code>/admin broadcast [msg]</code>\n" +
            "⚡ <b>Maintenance:</b> <code>/admin maintenance on/off</code>";
        
        if (ctx.callbackQuery) return media.smartEdit(ctx, msg);
        return ctx.replyWithHTML(msg);
    },

    /**
     * Renders a themed "Sorcerer License" for a specific target user.
     * Mimics bot.js showProfile for admin oversight.
     */
    async showPublicProfile(ctx, userId) {
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return ctx.reply("❌ User data not found.");

        const nextPlayerXp = (user.playerLevel || 1) * 50;
        const expBar = ui.createProgressBar(user.playerXp || 0, nextPlayerXp, 10);

        let body = `👤 <b>Name:</b> @${user.username}\n` +
                   `🎖 <b>Title:</b> ${user.title || "Wandering Soul"}\n` +
                   `🌟 <b>Level:</b> ${user.playerLevel || 1}\n` +
                   `📈 <b>EXP:</b> ${expBar} (${user.playerXp || 0}/${nextPlayerXp})\n` +
                   `🏆 <b>ELO:</b> <code>${user.elo}</code> (${user.rank})`;

        let economy = `💰 <b>Coins:</b> ${user.coins}\n` +
                      `✨ <b>Dust:</b> ${user.dust || 0}\n` +
                      `🔋 <b>Stamina:</b> ${user.stamina}/100`;

        const fullMsg = ui.formatHeader(`OVERSEER: @${user.username}`, "GENERAL") + "\n\n" +
                        ui.panel(body) + "\n\n" +
                        ui.panel(economy) + "\n\n" +
                        `<i>Status: ${user.banned ? '🚫 BANNED' : '✅ ACTIVE'}</i>`;

        let userPhoto = null;
        try {
            const photos = await ctx.telegram.getUserProfilePhotos(userId);
            if (photos.total_count > 0) {
                const recentPhotoSet = photos.photos[0];
                userPhoto = recentPhotoSet[recentPhotoSet.length - 1].file_id;
            }
        } catch (e) {}

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🔍 ADMIN INFO', `adm_user_${userId}`), Markup.button.callback('🔙 BACK', 'adm_nav_stats')]
        ]);

        if (userPhoto) {
            return ctx.replyWithPhoto(userPhoto, { caption: fullMsg, parse_mode: 'HTML', ...kb });
        }

        const leadCharId = (user.teamIds && user.teamIds[0]) || "Yuji Itadori Early";
        return media.sendPortrait(ctx, { name: leadCharId }, fullMsg, kb);
    }
};
