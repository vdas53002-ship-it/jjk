require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const db = require('./database');
const ui = require('./utils/ui');
const media = require('./utils/media');
const registrationScene = require('./utils/handlers/registration');
const trainingScene = require('./utils/handlers/train');
const pvp = require('./utils/handlers/pvp');
const gachaScene = require('./utils/handlers/gacha');
const shop = require('./utils/handlers/shop');
const clans = require('./utils/handlers/clans');
const competition = require('./utils/handlers/competition');
const social = require('./utils/handlers/social');
const inventory = require('./utils/handlers/inventory');
const quests = require('./utils/handlers/quests');
const upgrades = require('./utils/handlers/upgrades');
const clanService = require('./services/clanService');
const admin = require('./utils/handlers/admin');
const team = require('./utils/handlers/team');
const utility = require('./utils/handlers/utility');
const minigame = require('./utils/handlers/minigame');
const tournament = require('./utils/handlers/tournament');
const tournamentService = require('./services/tournamentService');
const domains = require('./utils/handlers/domains');
const socialService = require('./services/socialService');
const explore = require('./utils/handlers/explore');
const challenge = require('./utils/handlers/challenge');
const matchmaking = require('./services/matchmaking');
const adminService = require('./services/adminService');
// Removed uploadScene import


const bot = new Telegraf(process.env.BOT_TOKEN);

// --- GLOBAL ERROR HANDLER ---
bot.catch((err, ctx) => {
    console.error(`❌ [TELEGRAF ERROR] for update ${ctx.updateType}:`, err);
});

// --- ADMIN SECURITY ---
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];
const isAdmin = (ctx, next) => {
    if (ADMIN_IDS.includes(ctx.from.id)) return next();
    return ctx.reply("❌ Unauthorized. Admin access required.");
};

// --- SCENE SETUP ---
const stage = new Scenes.Stage([registrationScene, trainingScene, gachaScene, clans.clanScene]);

// --- MAINTENANCE CACHE ---
let maintenanceCache = { value: false, lastCheck: 0 };
const getMaintenance = async () => {
    const now = Date.now();
    if (now - maintenanceCache.lastCheck < 60000) return maintenanceCache.value;
    const setting = await db.settings.findOne({ key: 'maintenance' });
    maintenanceCache = { value: !!(setting && setting.value), lastCheck: now };
    return maintenanceCache.value;
};

bot.use(session());

// --- IGNORE OLD UPDATES ---
bot.use((ctx, next) => {
    if (ctx.updateType === 'message' || ctx.updateType === 'callback_query') {
        const msg = ctx.message || ctx.callbackQuery.message;
        if (msg && msg.date) {
            const now = Math.floor(Date.now() / 1000);
            if (now - msg.date > 30) { // Ignore anything older than 30 seconds
                console.log(`🕒 [OLD UPDATE] Ignoring message/callback from ${ctx.from.id} (${now - msg.date}s old)`);
                return;
            }
        }
    }
    return next();
});

// --- GLOBAL INTERACTION COOLDOWN ---
bot.on('callback_query', async (ctx, next) => {
    const now = Date.now();
    if (!ctx.session) ctx.session = {}; 
    const lastClick = ctx.session.lastClick || 0;
    
    // Snappier 350ms cooldown (down from 600ms)
    if (now - lastClick < 350) {
        return ctx.answerCbQuery().catch(() => null);
    }
    
    ctx.session.lastClick = now;
    
    // We pass true to indicate it's already answered or should be handled by next
    return next();
});


bot.use(stage.middleware());

// --- MIDDLEWARE ---
bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    
    let user = await db.users.findOne({ telegramId: ctx.from.id });

    if (user) {
        if (user.banned) {
            if (user.banUntil === -1 || Date.now() < user.banUntil) {
                return ctx.reply(`🚫 You are currently banned.\nReason: ${user.banReason || 'Unspecified'}`);
            } else {
                await db.users.update({ telegramId: ctx.from.id }, { $set: { banned: false } });
                user.banned = false;
            }
        }

        // --- STAMINA INIT ---
        if (user.stamina === undefined) {
             user.stamina = 100;
             await db.users.update({ telegramId: ctx.from.id }, { $set: { stamina: 100, lastStaminaUpdate: Date.now() } });
        }
    }

    // --- CACHED MAINTENANCE CHECK ---
    const isMaintenance = await getMaintenance();
    if (isMaintenance && (!user || (user.adminRole || 0) < 2)) {
        if (!((ctx.message && ctx.message.text) && ctx.message.text.startsWith('/admin'))) {
            return ctx.reply("🚧 <b>SYSTEM MAINTENANCE</b>\nThe Higher-Ups are currently reinforcing the barriers. Most functions are unavailable. Check back later!", { parse_mode: 'HTML' });
        }
    }

    ctx.state.user = user;
    return next();
});

// --- DM ONLY GUARD ---
bot.use(async (ctx, next) => {
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
        const text = (ctx.message && ctx.message.text) || "";
        // ONLY redirect /start and /explore
        const isStart = text.startsWith('/start');
        const isExplore = text.startsWith('/explore');

        if (isStart || isExplore) {
            const botUsername = ctx.botInfo.username;
            const msg = ui.formatHeader("HEADQUARTERS REQUIRED", "GENERAL") + "\n\n" +
                "👤 <b>PRIVATE MISSION</b>\n\n" +
                "The Higher-Ups have mandated that Registration and Exploration must be conducted in private to avoid cursed energy interference.\n\n" +
                "Click below to enter your private headquarters!";
            
            return ctx.replyWithHTML(msg, Markup.inlineKeyboard([
                [Markup.button.url('🚪 ENTER HQ', `https://t.me/${botUsername}?start=start`)]
            ]));
        }
    }
    return next();
});

// --- ANTI-SPAM MIDDLEWARE ---
const COOLDOWNS = new Map();
bot.use((ctx, next) => {
    if (!ctx.from || !ctx.message) return next();
    const userId = ctx.from.id;
    const now = Date.now();
    const lastAction = COOLDOWNS.get(userId) || 0;
    
    if (now - lastAction < 500) { // 0.5 second cooldown (snappier)
        return; // Ignore rapid spam
    }
    
    COOLDOWNS.set(userId, now);
    return next();
});

// --- COMMANDS ---

bot.start(async (ctx) => {
    if (!ctx.state.user) {
        return ctx.scene.enter('registration');
    }

    const startMsg = ui.formatHeader("JUJUTSU HIGH: CURSED CLASH") + "\n\n" +
        "Greetings, sorcerer. You have returned to the Tokyo Jujutsu High headquarters.\n\n" +
        "<i>\"The world is a stage, and cursed energy is the lighting.\"</i>\n\n" +
        "Verify your status or head out to the field below.";

    return media.sendBanner(ctx, "Academy", startMsg, Markup.inlineKeyboard([
        [Markup.button.callback('👤 My Profile', 'cmd_profile_init')],
        [Markup.button.callback('📜 Roster', 'cmd_roster'), Markup.button.callback('🎒 Inventory', 'cmd_inv')],
        [Markup.button.callback('🗺 Explore', 'cmd_explore'), Markup.button.callback('📜 Commands', 'help_main')]
    ]));
});

bot.action('cmd_explore', async (ctx) => {
    return explore.handleExplore(ctx);
});

bot.action(/exp_init_(.+)/, async (ctx) => {
    return explore.startNewExplore(ctx, null, ctx.match[1]);
});

bot.action(/exp_catch_menu_(.+)/, async (ctx) => {
    return explore.handleCaptureMenu(ctx, ctx.match[1]);
});

bot.action('exp_next', async (ctx) => {
    return explore.handleNextStep(ctx);
});

bot.action('exp_resume', async (ctx) => {
    return explore.handleResume(ctx);
});

bot.action('exp_cancel_hunt', async (ctx) => {
    return explore.handleCancelHunt(ctx);
});

bot.action('back_to_hub', async (ctx) => {
    await ctx.answerCbQuery();
    try { await ctx.scene.leave(); } catch (e) {}
    return ctx.replyWithHTML(ui.formatHeader("JUJUTSU HIGH") + "\n\nWelcome back, sorcerer. Use /profile to view your license.");
});



const showProfile = async (ctx) => {
    const user = ctx.state.user;
    if (!user) return ctx.reply("Please use /start to register first.");

    const nextPlayerXp = (user.playerLevel || 1) * 50;
    const expBar = ui.createProgressBar(user.playerXp || 0, nextPlayerXp, 10);

    let body = `👤 <b>Name:</b> @${user.username}\n` +
               `🎖 <b>Title:</b> ${user.title || "Wandering Soul"}\n` +
               `🌟 <b>Level:</b> ${user.playerLevel || 1}\n` +
               `📈 <b>EXP:</b> ${expBar} (${user.playerXp || 0}/${nextPlayerXp})\n` +
               `🏆 <b>ELO:</b> ${user.elo} (${user.rank})\n` +
               `🏫 <b>Academy:</b> ${user.school || "<i>Unassigned (/school)</i>"}`;

    let economy = `💰 <b>Coins:</b> ${user.coins}\n` +
                  `✨ <b>Dust:</b> ${user.dust || 0}\n` +
                  `🔋 <b>Stamina:</b> ${user.stamina}/100`;

    const fullMsg = ui.formatHeader("SORCERER LICENSE") + "\n\n" +
                    ui.panel(body) + "\n\n" +
                    ui.panel(economy) + "\n\n" +
                    `<i>"Cursed energy is a spark. You are the flame."</i>`;

    let userPhoto = null;
    try {
        const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id);
        console.log(`[PROFILE DEBUG] User ${ctx.from.id} has ${photos.total_count} photos.`);
        if (photos.total_count > 0) {
            // Take the largest version of the most recent photo
            const recentPhotoSet = photos.photos[0];
            userPhoto = recentPhotoSet[recentPhotoSet.length - 1].file_id;
        }
    } catch (e) {
        console.error("[PROFILE PHOTO ERROR]", e);
    }

    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('👥 Team', 'cmd_team'), Markup.button.callback('🎒 Items', 'cmd_inv')],
        [Markup.button.callback('🛡 Clans', 'clan_home'), Markup.button.callback('🗺 Explore', 'cmd_explore')],
        [Markup.button.callback('📜 Achievements', 'cmd_achievements')]
    ]);

    if (userPhoto) {
        if (ctx.callbackQuery) {
            return ctx.telegram.editMessageMedia(
                ctx.chat.id, 
                ctx.callbackQuery.message.message_id, 
                null, 
                { type: 'photo', media: userPhoto, caption: fullMsg, parse_mode: 'HTML' },
                kb
            ).catch(() => ctx.replyWithPhoto(userPhoto, { caption: fullMsg, parse_mode: 'HTML', ...kb }));
        }
        return ctx.replyWithPhoto(userPhoto, { caption: fullMsg, parse_mode: 'HTML', ...kb });
    }

    const leadCharId = user.teamIds[0] || "Yuji Itadori";
    return media.sendPortrait(ctx, { name: leadCharId }, fullMsg, kb);
};

bot.command('profile', showProfile);

bot.action('cmd_profile_init', async (ctx) => {
    await ctx.answerCbQuery();
    return showProfile(ctx);
});

async function showSchoolSelection(ctx) {
    const user = ctx.state.user || await db.users.findOne({ telegramId: ctx.from.id });
    if (user.school) {
        const link = user.school === 'Tokyo' ? "https://t.me/+u9BMzrdh5H44OTM1" : "https://t.me/+Ethjl7sH_KIxOTFl";
        const msg = `🏯 <b>LOYALTY CONFIRMED</b>\n\nYou are a student of <b>${user.school}</b> Academy. Find your exclusive Headquarters link below:\n\n🔗 <a href="${link}">${user.school} HQ Link</a>\n\n<i>"Your comrades are waiting at the front line."</i>`;
        
        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, Markup.inlineKeyboard([[Markup.button.url('🏘 JOIN GC', link)], [Markup.button.callback('⬅️ BACK', 'cmd_profile_init')]]));
        return ctx.replyWithHTML(msg, Markup.inlineKeyboard([[Markup.button.url('🏘 JOIN GC', link)]]));
    }

    const msg = ui.formatHeader("ACADEMY ENTRANCE", "GENERAL") + "\n\n" +
        "Select your path. This choice will determine your kin and your clans.\n\n" +
        "🚫 <b>WARNING:</b> This choice is <b>PERMANENT</b>.";

    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('🏮 TOKYO JUJUTSU HIGH', 'school_set_Tokyo')],
        [Markup.button.callback('⛩️ KYOTO JUJUTSU HIGH', 'school_set_Kyoto')],
        [Markup.button.callback('🏠 RETURN', 'back_to_hub')]
    ]);

    if (ctx.callbackQuery) return media.smartEdit(ctx, msg, kb);
    return ctx.replyWithHTML(msg, kb);
}

bot.command('school', showSchoolSelection);
bot.action('cmd_school', showSchoolSelection);

bot.action(/school_set_(.+)/, async (ctx) => {
    const academy = ctx.match[1];
    const user = await db.users.findOne({ telegramId: ctx.from.id });
    if (user.school) return ctx.answerCbQuery("❌ Choice already made.");

    await db.users.update({ telegramId: ctx.from.id }, { $set: { school: academy } });
    await ctx.answerCbQuery(`🏮 Welcome to ${academy} High!`, { show_alert: true });
    
    const link = academy === 'Tokyo' ? "https://t.me/+u9BMzrdh5H44OTM1" : "https://t.me/+Ethjl7sH_KIxOTFl";
    await ctx.replyWithHTML(`🎉 <b>CONGRATULATIONS SORCERER!</b>\n\nYou are now an official student of <b>${academy} Jujutsu High</b>. Join your Academy Headquarters using the link below:\n\n👇 <b>JOIN HERE:</b>\n${link}`, Markup.inlineKeyboard([[Markup.button.url('🚀 JOIN ACADEMY GC', link)]]));
    
    return showProfile(ctx);
});

// PvP Matchmaking is handled via the /explore or profile menus, or challenge system.


// Matchmaking Event Hooks
matchmaking.onMatchFound = (p1, p2, mode) => pvp.startPvPBattle(p1, p2, mode, bot);
matchmaking.onMatchTimeout = (userId) => {
    bot.telegram.sendMessage(userId, "⚠️ <b>Matchmaking Timeout</b>\nNo opponent was found within 60 seconds. Please try again later.", { parse_mode: 'HTML' });
};


// Removed redundant explore commands
bot.command('explore', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args[1] === 'stats' || args[1] === 'status') return explore.showExploreStats(ctx);
    return explore.handleExplore(ctx);
});



bot.command('surrender', async (ctx) => {
    // Check if in battle (this needs search in active pvp/pve matches)
    return ctx.reply("Use the 🏳️ Surrender button inside the battle UI to concede.");
});

bot.command('rematch', async (ctx) => {
    const now = Date.now();
    const lastRematch = ctx.session.lastRematch || 0;
    if (now - lastRematch < 5000) return ctx.reply("⏳ Rematch request on cooldown (5s).");
    ctx.session.lastRematch = now;
    
    // Logic to find last opponent and send request
    return ctx.reply("♻️ Rematch request sent. Waiting 15s for response...");
});

bot.command('train', async (ctx) => {
    console.log(`[BOT] Received /train command from ${ctx.from.id}`);
    if (!ctx.state.user) return ctx.reply("Please /start first.");
    return ctx.scene.enter('training');
});

bot.command('shop', async (ctx) => {
    console.log(`[BOT] Received /shop command from ${ctx.from.id}`);
    if (!ctx.state.user) return ctx.reply("Please /start first.");
    return shop.showShop(ctx);
});

bot.command('clan', async (ctx) => {
    console.log(`[BOT] Received /clan command from ${ctx.from.id}`);
    if (!ctx.state.user) return ctx.reply("Please /start first.");
    return ctx.scene.enter('clan_scene');
});

// Roster command is handled below in the interactive section



bot.command('create_clan', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply("Usage: /create_clan NAME TAG");
    const name = args.slice(1, -1).join(' ');
    const tag = args[args.length - 1];
    
    const result = await clanService.createClan(ctx.from.id, name, tag);
    return ctx.reply(result.msg);
});

bot.command('test', isAdmin, async (ctx) => {
    await db.users.update({ telegramId: ctx.from.id }, {
        $set: { 
            coins: 10000, 
            dust: 100, 
            stamina: 100,
            gachaTickets: 25,
            inventory: [
                { id: 'energy_drink', qty: 5 },
                { id: 'cursed_charm', qty: 5 },
                { id: 'exp_ticket', qty: 1 }
            ]
        }
    });
    return ctx.reply("🧪 ADMIN MODE: 10k Coins, Full Stamina, and Test Consumables added to your bag!");
});

bot.command('gacha', async (ctx) => {
    if (!ctx.state.user) return ctx.reply("Please /start first.");
    return ctx.scene.enter('gacha_summon');
});

// Removed /upload command (Admin/Dev only tool)

bot.command('quests', (ctx) => quests.handleQuests(ctx));
bot.command(['upgrade', 'upgrades'], upgrades.showUpgradeMenu);
bot.command(['inventory', 'inv'], inventory.showInventory);
bot.command('roster', (ctx) => require('./utils/handlers/roster').showRoster(ctx));
bot.command('view', (ctx) => require('./utils/handlers/roster').viewCommand(ctx));

bot.command('leaderboard', competition.showLeaderboard);
bot.command('rank', competition.showRank);
bot.command('tournament', tournament.handleTournament);

bot.command('daily', utility.handleDaily);
bot.command('streak', utility.showStreak);
bot.command('blackflash', minigame.startBlackFlash);
bot.command('domains', domains.showDomainList);
bot.command('help', utility.showHelp);

// Removed placeholder /spectate and /replay commands
bot.command('gift', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 4) return ctx.reply("Usage: /gift @username item_id quantity");
    const res = await socialService.giftItem(ctx.from.id, args[1], args[2], parseInt(args[3]));
    return ctx.reply(res.msg);
});

bot.command('addfriend', social.addFriend);
bot.command('friends', social.showFriends);

bot.command('team', (ctx) => {
    if (!ctx.state.user) return ctx.reply("Please /start first.");
    return team.showTeamMenu(ctx);
});

// Basic callback handlers for UI placeholders
// --- TEAM ACTIONS ---
bot.action('cmd_team', (ctx) => team.showTeamMenu(ctx));
bot.action(/team_page_(\d+)/, (ctx) => team.showTeamMenu(ctx, parseInt(ctx.match[1])));
bot.action('team_swap_menu', (ctx) => team.showSwapMenu(ctx));
bot.action(/team_swap_slot_(\d+)/, (ctx) => team.showSwapBench(ctx, parseInt(ctx.match[1])));
bot.action(/team_swpage_(\d+)_(\d+)/, (ctx) => team.showSwapBench(ctx, parseInt(ctx.match[1]), parseInt(ctx.match[2])));
bot.action(/team_swap_confirm_(\d+)_(.+)/, (ctx) => team.confirmSwap(ctx, parseInt(ctx.match[1]), ctx.match[2]));
bot.action(/team_swap_exec_(\d+)_(.+)/, (ctx) => team.executeSwap(ctx, parseInt(ctx.match[1]), ctx.match[2]));
bot.action('team_reorder_menu', (ctx) => team.showReorderMenu(ctx));
bot.action(/team_move_(\d+)_(up|down)/, (ctx) => team.executeMove(ctx, parseInt(ctx.match[1]), ctx.match[2]));

// --- CHALLENGE & DUEL ACTIONS ---
bot.command('challenge', (ctx) => challenge.sendChallenge(ctx));
bot.action(/chal_accept_(.+)/, (ctx) => challenge.handleAccept(ctx, ctx.match[1]));
bot.action(/chal_decline_(.+)/, (ctx) => challenge.handleDecline(ctx, ctx.match[1]));
bot.action(/chal_cancel_(.+)/, (ctx) => challenge.handleCancel(ctx, ctx.match[1]));

// --- ADMINISTRATIVE OVERSIGHT ---
bot.command('admin', isAdmin, (ctx) => admin.handleAdminCommand(ctx));
bot.action(/^adm_nav_(.+)/, isAdmin, async (ctx) => {
    const action = ctx.match[1];
    await ctx.answerCbQuery();
    
    switch (action) {
        case 'stats': return admin.showDashboard(ctx);
        case 'battles': return admin.listBattles(ctx);
        case 'season': 
            const res = await adminService.executeSeasonReset();
            return ctx.reply(res.msg);
        case 'broadcast': 
            return ctx.reply("📣 <b>Broadcast Guide:</b>\nUse: <code>/admin broadcast [YOUR MESSAGE]</code>\nThis will send the message to all registered users.", { parse_mode: 'HTML' });
        case 'help': 
            return ctx.reply("📚 <b>Admin Command Reference:</b>\n\n" +
                "👤 <b>User:</b> <code>/admin user [id]</code>\n" +
                "💰 <b>Coins:</b> <code>/admin add_coins [id] [qty]</code>\n" +
                "🚫 <b>Ban:</b> <code>/admin ban [id] [days] [reason]</code>\n" +
                "✨ <b>Gacha:</b> <code>/admin gacha_pity_reset [id]</code>\n" +
                "🛡 <b>Clan:</b> <code>/admin clan_delete [name]</code>", { parse_mode: 'HTML' });
    }
});


bot.action(/^adm_short_(.+)/, isAdmin, async (ctx) => {
    const short = ctx.match[1];
    await ctx.answerCbQuery();
    ctx.state.commandText = `/admin ${short}_msg`;
    return admin.handleAdminCommand(ctx);
});

bot.action(/^adm_(warn|ban|reset|user)_(.+)/, isAdmin, async (ctx) => {
    const [_, action, targetId] = ctx.match;
    await ctx.answerCbQuery();
    ctx.state.commandText = `/admin ${action} ${targetId}`;
    return admin.handleAdminCommand(ctx);
});

bot.command('broadcast_confirm', async (ctx) => {
    const adminRole = await adminService.getUserRole(ctx.from.id);
    if (adminRole < 2) return;
    const msg = ctx.session.pendingBroadcast;
    if (!msg) return ctx.reply("❌ No pending broadcast found.");
    
    const users = await db.users.find({});
    ctx.reply(`🚀 Broadcasting to ${users.length} users...`);
    let count = 0;
    for (const u of users) {
        try {
            await ctx.telegram.sendMessage(u.telegramId, `📢 <b>ANNOUNCEMENT</b>\n\n${msg}`, { parse_mode: 'HTML' });
            count++;
        } catch(e) {}
    }
    ctx.session.pendingBroadcast = null;
    return ctx.reply(`✅ Broadcast complete. Delivered to ${count} sorcerers.`);
});

bot.action('tourney_reg', async (ctx) => {
    // Note: handleRegistration already calls answerCbQuery
    return tournament.handleRegistration(ctx);
});

bot.action('bf_ready', (ctx) => minigame.handleBFReady(ctx));
bot.action(/bf_tap_(.+)/, (ctx) => minigame.handleBFTap(ctx, ctx.match[1]));

bot.action(/bf_zone_(\d+)_(\d+)/, (ctx) => {
    ctx.answerCbQuery();
    return minigame.handleBFChoice(ctx, ctx.match[1], ctx.match[2]);
});

bot.action('cmd_domains', (ctx) => {
    ctx.answerCbQuery();
    return domains.showDomainList(ctx);
});

bot.action(/view_domain_(.+)/, (ctx) => {
    ctx.answerCbQuery();
    return domains.renderDomainDetail(ctx, ctx.match[1]);
});

bot.action(/spec_(.+)/, async (ctx) => {
    const res = await socialService.addSpectator(ctx.match[1], ctx.from.id);
    await ctx.answerCbQuery(res.success ? "Successfully joined spectator channel!" : res.msg);
    if (res.success) return ctx.reply("You are now spectating...");
});

bot.action(/exp_f:(\d+):(.+)/, async (ctx) => {
    return explore.initiateWildBattle(ctx, ctx.match[2], false, ctx.match[1]);
});
bot.action(/exp_c:(\d+):(.+)/, async (ctx) => {
    return explore.initiateWildBattle(ctx, ctx.match[2], true, ctx.match[1]);
});
bot.action(/tool_cap_shackle_(.+)/, async (ctx) => {
    return explore.executeCapture(ctx, ctx.match[1], 'grade_1_shackle');
});

bot.action(/tool_cap_essence_(.+)/, async (ctx) => {
    return explore.executeCapture(ctx, ctx.match[1], 'domain_essence');
});

bot.action(/tool_cap_tag_(.+)/, async (ctx) => {
    return explore.executeCapture(ctx, ctx.match[1], 'cursed_seal_tag');
});

bot.action(/pvp_enter_(.+)/, async (ctx) => {
    return pvp.handleEnter(ctx, ctx.match[1]);
});

bot.action(/pvp_atk_(.+)_(.+)/, async (ctx) => {
    return pvp.handleMove(ctx, ctx.match[1], { type: 'attack', moveIdx: parseInt(ctx.match[2]) });
});

bot.action(/pvp_grd_(.+)/, async (ctx) => {
    return pvp.handleMove(ctx, ctx.match[1], { type: 'guard' });
});

bot.action(/pvp_swi_(.+)/, async (ctx) => {
    const battleId = ctx.match[1];
    const battle = await db.battles.findOne({ _id: battleId });
    const isP1 = ctx.from.id === battle.p1.id;
    const player = isP1 ? battle.p1 : battle.p2;
    
    const kb = player.team.map((c, i) => {
        if (i === player.activeIdx || c.hp <= 0) return null;
        return [Markup.button.callback(`🔄 ${c.name}`, `pvp_swiexec_${battleId}_${i}`)];
    }).filter(b => b !== null);
    
    kb.push([Markup.button.callback('⬅️ Back', `pvp_enter_${battleId}`)]);
    return ctx.editMessageReplyMarkup(Markup.inlineKeyboard(kb).reply_markup);
});

bot.action(/pvp_swiexec_(.+)_(.+)/, async (ctx) => {
    return pvp.handleMove(ctx, ctx.match[1], { type: 'switch', nextIdx: parseInt(ctx.match[2]) });
});

bot.action(/pvp_surr_(.+)/, async (ctx) => {
    // Basic surrender logic
    const battleId = ctx.match[1];
    const battle = await db.battles.findOne({ _id: battleId });
    if (!battle) return;
    
    const isP1 = ctx.from.id === battle.p1.id;
    battle.status = 'finished';
    battle.winner = isP1 ? battle.p2.username : battle.p1.username;
    battle.winnerId = isP1 ? battle.p2.id : battle.p1.id;
    battle.log.push(`🏳️ ${ctx.from.username} surrendered.`);
    
    await pvp.awardPvPRewards(battle);
    await db.battles.update({ _id: battleId }, battle);
    return pvp.renderBattle(ctx, battle);
});

bot.action(/conf_cap_(.+)/, async (ctx) => {
    await ctx.answerCbQuery("Attempting capture...");
    return explore.executeCapture(ctx, ctx.match[1]);
});


// cmd_team action handled in the team section


bot.action('clan_home', async (ctx) => {
    await ctx.answerCbQuery();
    return clans.showHome(ctx);
});

bot.action(/upg_exec_(.+)_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    return upgrades.handleUpgradeExecution(ctx, ctx.match[1], ctx.match[2]);
});
bot.action('cmd_inv', async (ctx) => {
    await ctx.answerCbQuery();
    return inventory.showInventory(ctx);
});
bot.action(/view_inv_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    return inventory.viewItemDetails(ctx, ctx.match[1]);
});
bot.action(/use_inv_(.+)/, async (ctx) => {
    return inventory.useItem(ctx, ctx.match[1]);
});

bot.action('cmd_achievements', async (ctx) => {
    return utility.showAchievements(ctx);
});
bot.action('menu_titles', async (ctx) => {
    return utility.showTitlesMenu(ctx);
});
bot.action(/equip_title_(.+)/, async (ctx) => {
    return utility.equipTitle(ctx, ctx.match[1]);
});

// --- QUEST ACTIONS ---
bot.action('cmd_quests', (ctx) => quests.handleQuests(ctx));
bot.action(/q_claim_(\d+)/, (ctx) => quests.handleClaim(ctx, ctx.match[1]));
bot.action('q_claim_all', (ctx) => quests.handleClaimAll(ctx));

bot.action(/help_(.+)/, async (ctx) => {
    // Utility.showHelp handles answerCbQuery
    return utility.showHelp(ctx, ctx.match[1]);
});

bot.action('exp_let_go', (ctx) => explore.handleLetGo(ctx));
// Command and action listeners are consolidated above.


// --- ADVANCED TEAM ACTIONS ---
bot.action('team_nav_swap', (ctx) => {
    ctx.answerCbQuery();
    return team.showSwapMenu(ctx);
});
bot.action('team_nav_reorder', (ctx) => {
    ctx.answerCbQuery();
    return team.showReorderMenu(ctx);
});
bot.action(/team_swap_select_(.+)/, (ctx) => {
    ctx.answerCbQuery();
    return team.handleSwapSelect(ctx, ctx.match[1]);
});
bot.action(/team_swap_exec_(\d+)_(.+)/, (ctx) => {
    return team.executeSwap(ctx, parseInt(ctx.match[1]), ctx.match[2]);
});
bot.action(/team_reorder_(\d+)_(\d+)/, (ctx) => {
    return team.executeReorder(ctx, parseInt(ctx.match[1]), parseInt(ctx.match[2]));
});

bot.action(/roster_page_(\d+)/, (ctx) => {
    ctx.answerCbQuery();
    return require('./utils/handlers/roster').showRoster(ctx, parseInt(ctx.match[1]));
});
bot.action('roster_nav_details', async (ctx) => {
    ctx.answerCbQuery();
    return require('./utils/handlers/roster').handleDetailsNav(ctx);
});
bot.action(/roster_view_(.+)/, async (ctx) => {
    ctx.answerCbQuery();
    return require('./utils/handlers/roster').showCharacterDetails(ctx, ctx.match[1]);
});
bot.action('roster_nav_sell_menu', async (ctx) => {
    return require('./utils/handlers/roster').handleSellMenu(ctx);
});
bot.action('roster_nav_release', async (ctx) => {
    return require('./utils/handlers/roster').handleReleaseMenu(ctx, false);
});
bot.action('roster_nav_release_commons', async (ctx) => {
    return require('./utils/handlers/roster').handleReleaseMenu(ctx, true);
});
bot.action('roster_mass_release_commons', async (ctx) => {
    return require('./utils/handlers/roster').handleMassReleaseCommons(ctx);
});
bot.action('roster_mass_release_exec', async (ctx) => {
    return require('./utils/handlers/roster').executeMassRelease(ctx);
});
bot.action('roster_mass_release_all', async (ctx) => {
    return require('./utils/handlers/roster').handleMassReleaseAll(ctx);
});
bot.action('roster_mass_release_all_exec', async (ctx) => {
    return require('./utils/handlers/roster').executeMassReleaseAll(ctx);
});
bot.action(/roster_release_toggle_(.+)/, async (ctx) => {
    return require('./utils/handlers/roster').toggleSelectForRelease(ctx, ctx.match[1]);
});
bot.action('roster_mass_release_selected', async (ctx) => {
    return require('./utils/handlers/roster').handleMassReleaseSelected(ctx);
});
bot.action('roster_release_selected_exec', async (ctx) => {
    return require('./utils/handlers/roster').executeSelectedRelease(ctx);
});
bot.action(/roster_release_conf_(.+)/, (ctx) => {
    return require('./utils/handlers/roster').handleReleaseConfirm(ctx, ctx.match[1]);
});
bot.action(/roster_release_exec_(.+)/, (ctx) => {
    return require('./utils/handlers/roster').executeRelease(ctx, ctx.match[1]);
});
bot.action(/roster_upg_lvl_(.+)/, (ctx) => {
    return require('./utils/handlers/roster').executeLevelUp(ctx, ctx.match[1]);
});
bot.action(/roster_upg_star_(.+)/, (ctx) => {
    return require('./utils/handlers/roster').executeAwaken(ctx, ctx.match[1]);
});
bot.action(/rost_dep_(.+)_(.+)/, async (ctx) => {
    return require('./utils/handlers/roster').executeDeployment(ctx, ctx.match[1], ctx.match[2]);
});

bot.action('cmd_roster', (ctx) => {
    ctx.answerCbQuery();
    return require('./utils/handlers/roster').showRoster(ctx);
});

bot.action(/^view_archive_(\d+)/, (ctx) => {
    return require('./utils/handlers/roster').showGlobalArchive(ctx, parseInt(ctx.match[1]));
});
bot.action(/^cmd_view_char_(.+)/, (ctx) => {
    return require('./utils/handlers/roster').viewCommand(ctx, ctx.match[1], true);
});

bot.command('achievements', (ctx) => utility.showAchievements(ctx));
// Removed placeholder /trade command

(async () => {
    console.log('✅ JUJUTSU HIGH BOT: STARTING...');
    bot.launch({ dropPendingUpdates: true });
    console.log('✅ JUJUTSU HIGH BOT: CURSED CLASH IS ONLINE');
    
    try {
        // Auto-update command menu in Telegram - THE COMPLETE LIST
        await bot.telegram.setMyCommands([
            { command: 'start', description: 'Begin your sorcerer journey' },
            { command: 'profile', description: 'View your sorcerer license' },
            { command: 'explore', description: 'Find & capture wild spirits' },
            { command: 'roster', description: 'Manage squad & all owned sorcerers' },
            { command: 'view', description: 'Inspect full character cards' },
            { command: 'train', description: 'AI practice (Easy/Normal/Hard)' },
            { command: 'inv', description: 'Open your toolbag' },
            { command: 'gacha', description: 'Summon new souls' },
            { command: 'shop', description: 'Buy charms & drinks' },
            { command: 'daily', description: 'Claim daily login reward' },
            { command: 'streak', description: 'Check your current login streak' },
            { command: 'achievements', description: 'View progress & equip titles' },
            { command: 'school', description: 'Choose your Jujutsu Academy (Tokyo/Kyoto)' },
            { command: 'quests', description: 'View active missions' },
            { command: 'upgrades', description: 'Boost character stats' },
            { command: 'domains', description: 'Manage domain expansions' },
            { command: 'clan', description: 'Open Syndicate Hub' },
            { command: 'create_clan', description: 'Start your own Clan (1k Coins)' },
            { command: 'friends', description: 'Manage ally list' },
            { command: 'gift', description: 'Send items to others' },
            { command: 'tournament', description: 'Enter the Zenin Tournament' },
            { command: 'leaderboard', description: 'View Special Grade rankings' },
            { command: 'rank', description: 'Check your global ELO position' },
            { command: 'blackflash', description: 'Play timing mini-game' },
            { command: 'help', description: 'Open the comprehensive guide' },
            { command: 'admin', description: 'Administrative oversight' }
        ]);
        console.log('📜 ALL COMMANDS Scheduled with Telegram.');
    } catch (e) {
        console.error('⚠️ [WARNING] Failed to set bot commands:', e.message);
    }
    
    // Start Inactivity Watcher (Every 30s)
    setInterval(() => pvp.checkBattleTimeouts(bot), 30000);
})();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
