const { Scenes, Markup } = require('telegraf');
const db = require('../../database');
const ui = require('../ui');
const media = require('../media');
const characters = require('../data/characters');

/**
 * Registration Scene: Handles character creation and starter selection.
 */
const registrationScene = new Scenes.BaseScene('registration');

registrationScene.enter(async (ctx) => {
    const welcome = ui.formatHeader("ACADEMY REGISTRATION") + "\n\n" +
        "🏮 <b>Welcome to Jujutsu High!</b>\n\n" +
        "Your cursed energy signature is being recorded. First, identify your soul's physical vessel:";

    const genderButtons = [
        [Markup.button.callback('♂️ Male', 'reg_gen_Male'), Markup.button.callback('♀️ Female', 'reg_gen_Female')],
        [Markup.button.callback('✨ Other', 'reg_gen_Other')]
    ];
    await ctx.replyWithHTML(welcome, Markup.inlineKeyboard(genderButtons));
});

registrationScene.action(/reg_gen_(.+)/, async (ctx) => {
    ctx.scene.state.gender = ctx.match[1];
    await ctx.answerCbQuery(`Identified: ${ctx.match[1]}`);

    const starterMsg = ui.formatHeader("STARTER SELECTION") + "\n\n" +
        "<i>Your vessel is chosen. Now, select your lead sorcerer to begin your journey:</i>\n\n" +
        "👊 <b>Yuji Itadori</b> (Close-range)\nBalanced damage and high resilience.\n\n" +
        "🔨 <b>Nobara Kugisaki</b> (Long-range)\nHigh output but fragile.\n\n" +
        "🐺 <b>Megumi Fushiguro</b> (Barrier)\nStrategic defense and domain potential.";

    const starterButtons = [
        [Markup.button.callback('👊 Yuji Itadori', 'reg_start_Yuji Itadori')],
        [Markup.button.callback('🔨 Nobara Kugisaki', 'reg_start_Nobara Kugisaki')],
        [Markup.button.callback('🐺 Megumi Fushiguro', 'reg_start_Megumi Fushiguro')]
    ];
    await media.smartEdit(ctx, starterMsg, Markup.inlineKeyboard(starterButtons));
});

registrationScene.action(/reg_start_(.+)/, async (ctx) => {
    const starterName = ctx.match[1];
    const gender = ctx.scene.state.gender || 'Other';
    const userId = ctx.from.id;

    // Pick 5 random commons from full data
    const commonPool = Object.keys(characters).filter(id => characters[id].rarity === 'Common');
    const shuffled = commonPool.sort(() => 0.5 - Math.random());
    const randomCommons = shuffled.slice(0, 5);
    const allStarterIds = [starterName, ...randomCommons];

    // Initialize user data based on GDD
    const newUser = {
        telegramId: userId,
        username: ctx.from.username || ctx.from.first_name || `User_${userId}`,
        vessel: gender,
        rank: 'Iron',
        elo: 1000,
        playerLevel: 1,
        playerXp: 0,
        coins: 1000,
        dust: 50,
        gachaTickets: 6,
        inventory: [
            { id: 'minor_hp_potion', qty: 5 },
            { id: 'ce_charge', qty: 5 },
            { id: 'cursed_seal_tag', qty: 3 }
        ],
        teamIds: allStarterIds.slice(0, 3), // Team defaults to first 3
        registrationDate: new Date(),
        firstBattleComplete: false,
        battles: 0,
        friends: []
    };

    await db.users.insert(newUser);

    // Initial Roster population
    for (const charId of allStarterIds) {
        const charData = characters[charId];
        await db.roster.insert({
            userId,
            charId,
            level: 1,
            xp: 0,
            rarity: charData.rarity,
            upgrades: { hp: 0, ce: 0, attack: 0, speed: 0 },
            lastUpdated: new Date()
        });
    }

    await ctx.answerCbQuery(`Starter Pack Assigned!`);

    const finalMsg = ui.formatHeader("LICENSE GRANTED") + "\n\n" +
        `🌈 <b>Squad Manifestation Complete!</b>\n\n` +
        `You've been assigned 1 lead and 5 additional sorcerers to your archives.\n\n` +
        `📦 <b>Starter Pack:</b>\n` +
        `💰 1,000 Coins & 50 Dust\n` +
        `🎟 6 Gacha Tickets\n` +
        `🏷️ 3 Cursed Seal Tags\n` +
        `🧪 5 Potions & 5 CE Charges\n\n` +
        `Use /profile to view your team or /explore to start grinding energy!`;

    await media.sendPortrait(ctx, { name: starterName }, finalMsg, Markup.inlineKeyboard([
        [Markup.button.callback('📂 Open Profile', 'cmd_profile_init')]
    ]));
    
    return ctx.scene.leave();
});

module.exports = registrationScene;
