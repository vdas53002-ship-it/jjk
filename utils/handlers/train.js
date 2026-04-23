const { Scenes, Markup } = require('telegraf');
const engine = require('../combat/engine');
const ui = require('../ui');
const media = require('../media');
const characters = require('../data/characters');
const db = require('../../database');
const userService = require('../../services/userService');
const questService = require('../../services/questService');
const exploreService = require('../../services/exploreService');
const items = require('../data/items');

/**
 * Training Scene: Handles PvE battles against AI.
 */
const trainingScene = new Scenes.BaseScene('training');

trainingScene.enter(async (ctx) => {
    console.log(`[TRAIN] User ${ctx.from.id} entered training scene`);
    let user = ctx.state.user || await db.users.findOne({ telegramId: ctx.from.id });
    if (!user) {
        console.log(`[TRAIN] User not found for ${ctx.from.id}`);
        return ctx.scene.leave();
    }

    const wildTarget = ctx.scene.state.wildTarget; 
    
    if (!wildTarget) {
        const msg = ui.formatHeader("🎓 TRAINING GROUNDS", "BATTLE") + "\n\n" +
            "Select a sparring intensity to hone your techniques.\n\n" +
            "🟢 <b>Easy:</b> Low-level curses (-5 Levels)\n" +
            "🟡 <b>Normal:</b> Equal-level combatants\n" +
            "🔴 <b>Hard:</b> Advanced spirits (+5 Levels)";
        
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🟢 EASY', 'start_train_easy'), Markup.button.callback('🟡 NORMAL', 'start_train_normal')],
            [Markup.button.callback('🔴 HARD', 'start_train_hard')],
            [Markup.button.callback('🔙 BACK', 'back_to_hub')]
        ]);

        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, kb);
        return ctx.replyWithHTML(msg, kb);
    }

    return startBattle(ctx, user, wildTarget, ctx.scene.state.level || 'easy');
});

async function startBattle(ctx, user, wildTarget, level) {
    console.log(`[TRAIN] Starting battle: level=${level}, wild=${wildTarget || 'none'}`);
    const roster = await db.roster.find({ userId: ctx.from.id });
    const teamIds = user.teamIds || [];
    
    const hasBuff = user.blackflash_buff && user.blackflash_expiry > Date.now();
    if (hasBuff) {
        await db.users.update({ telegramId: ctx.from.id }, { $set: { blackflash_buff: false } });
    }

    // 1. Prepare User Team with Scaling & Clan Buffs
    const clan = user.clanId ? await db.clans.findOne({ _id: user.clanId }) : null;
    let clanMult = 1.0;
    if (clan && clan.leaderId === user.telegramId) {
        const membersCount = clan.members.length || 1;
        clanMult = 1.0 + (Math.floor(membersCount / 3) * 0.01); // 1% per 3 members
    }

    let userTeam = teamIds.map(id => {
        if (!id || !characters[id]) return null;
        const data = roster.find(r => r.charId === id) || { level: 1 };
        const scaledChar = userService.calculateFinalStats(data, JSON.parse(JSON.stringify(characters[id])), clanMult);
        scaledChar.hasBFBuff = hasBuff; 
        return scaledChar;
    }).filter(c => c !== null);

    if (wildTarget) {
        userTeam = [userTeam[0]];
    }

    if (userTeam.length === 0) {
        await ctx.reply("❌ Your team is empty! Use /team to set your squad.");
        return ctx.scene.leave();
    }

    let aiTeam = [];
    let aiName = "AI Trainer";
    let aiLevel = (user.playerLevel || 1);

    if (wildTarget && characters[wildTarget]) {
        const rarityMod = { Common: -2, Rare: 0, Epic: 5, Legendary: 10, Mythic: 25 }[characters[wildTarget].rarity] || 0;
        aiLevel = Math.max(1, (user.playerLevel || 1) + rarityMod);
        const base = characters.scaleStats(characters[wildTarget], aiLevel);
        base.isWild = true;
        aiTeam.push(base);
        aiName = `Wild ${base.name}`;
    } else {
        // Balanced difficulty offsets & Grade-wise Selection
        let poolRarities = [];
        if (level === 'easy') {
            aiLevel = Math.max(1, Math.floor(aiLevel * 0.5));
            poolRarities = ['Common'];
        } else if (level === 'hard') {
            aiLevel = Math.floor(aiLevel * 1.5);
            poolRarities = ['Rare', 'Epic'];
        } else {
            // normal
            poolRarities = ['Common', 'Rare'];
        }

        let pool = Object.values(characters).filter(c => poolRarities.includes(c.rarity));
        if (pool.length === 0) pool = Object.values(characters).filter(c => c.rarity === 'Common');

        for (let i = 0; i < 3; i++) {
            const baseChar = pool[Math.floor(Math.random() * pool.length)];
            aiTeam.push(characters.scaleStats(baseChar, aiLevel));
        }
        aiName = `Trainer`;
    }

    const battle = engine.initBattle(
        { telegramId: user.telegramId, username: user.username, teamMembers: userTeam },
        { telegramId: 0, username: aiName, teamMembers: aiTeam }
    );
    battle.is1v1 = !!wildTarget;
    battle.difficultyLevel = level;
    
    // Inherit message ID to prevent sending a new message
    const parentMsgId = ctx.scene.state.parentMsgId;
    if (parentMsgId) {
        battle.p1Mid = parentMsgId;
        battle.msgId = parentMsgId;
    }

    ctx.session.activeBattle = battle;
    return renderBattle(ctx);
}

async function renderBattle(ctx) {
    console.log("[TRAIN] Rendering battle state");
    const battle = ctx.session.activeBattle;
    if (!battle) {
        console.error("[TRAIN] No active battle found in session!");
        return ctx.reply("❌ Error: Battle session lost.");
    }
    const p1 = battle.p1;
    const myActive = p1.team[p1.activeIdx];

    if (battle.status === 'finished') {
        const msg = ui.renderPokemonUI(battle, p1.id);
        const wildTarget = ctx.scene.state.wildTarget;
        const useCharm = ctx.scene.state.useCharm;
        let rewardMsg = "";
        const userId = p1.id;
        const userDoc = await db.users.findOne({ telegramId: userId });

        if (battle.surrendered) {
            rewardMsg = `\n\n🏳️ <b>FLED</b>\nYou abandoned the clash. No rewards were granted.`;
        } else if (battle.winner === p1.username) {
            if (wildTarget) {
                const targetChar = characters[wildTarget];
                const enemyChar = battle.p2.team[0]; 
                
                // Tier Scaling
                const biomeKey = userDoc.activeExplore?.biome || 'TIER_1';
                const tier = exploreService.BIOMES[biomeKey] || exploreService.BIOMES['TIER_1'];
                const baseRewards = exploreService.CONSTANTS.REWARDS[targetChar.rarity] || { coins: 50, xp: 20, dust: 5 };
                
                const winCoins = Math.floor(baseRewards.coins * tier.multiplier);
                const winXp = Math.floor(baseRewards.xp * tier.multiplier);
                const winDust = Math.floor(baseRewards.dust * tier.multiplier);

                const results = await userService.addAdvancedRewards(userId, 'custom', true, 0, winCoins, winXp, winDust);

                const captureRes = await exploreService.calculateFinalCaptureChance(userDoc, { ...targetChar, level: enemyChar.level }, {
                    usedCharm: useCharm,
                    enemyHp: enemyChar.hp,
                    enemyMaxHp: enemyChar.maxHp,
                    dmgP1Percent: (battle.sharedData.p1TotalDmg / enemyChar.maxHp) * 100,
                    lastHitWasBlackFlash: battle.sharedData.lastHitWasBlackFlash
                });

                const captureButtons = [[Markup.button.callback('🕸 CAPTURE', `conf_cap_${wildTarget}`)]];
                rewardMsg = `\n\n🎯 <b>Catch Rate:</b> ${Math.floor(captureRes.finalChance * 100)}%`;
                rewardMsg += `\n💰 +${results.coinGain} Coins | ✨ +${results.dustGain} Dust | 📈 +${results.playerXpGain} XP`;
                return ctx.telegram.editMessageCaption(ctx.chat.id, battle.msgId, null, msg + rewardMsg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(captureButtons) }).catch(() => null);
            } else {
                const trMode = `training_${battle.difficultyLevel || 'easy'}`;
                const results = await userService.addAdvancedRewards(userId, trMode, true, userDoc.streak || 0);
                rewardMsg = `\n\n💰 +${results.coinGain} coins | 📈 +${results.playerXpGain} XP | ✨ +${results.dustGain} Dust`;
            }
        } else {
            const trMode = `training_${battle.difficultyLevel || 'easy'}`;
            const results = await userService.addAdvancedRewards(userId, trMode, false, 0);
            rewardMsg = `\n\n💀 <b>DEFEAT</b>\nYou blacked out and lost your momentum.`;
            if (results && (results.coinGain > 0 || results.playerXpGain > 0 || results.dustGain > 0)) {
                rewardMsg += `\n<i>Consolation:</i> 💰 +${results.coinGain} Coins | 📈 +${results.playerXpGain} XP`;
                if (results.dustGain > 0) rewardMsg += ` | ✨ +${results.dustGain} Dust`;
            }
        }

        const endKb = Markup.inlineKeyboard([[Markup.button.callback('🔙 Return to Hub', 'back_to_hub')]]);
        return ctx.telegram.editMessageCaption(ctx.chat.id, battle.msgId, null, msg + rewardMsg, { parse_mode: 'HTML', ...endKb }).catch(() => null);
    }

    // --- BATTLE ACTIONS ---
    const moveButtons = myActive.moves.map((m, i) => {
        const cost = m.ce || 0;
        const label = cost > 0 ? `${m.name} [🌀${cost}]` : m.name;
        return Markup.button.callback(label, `exec_attack_${i}`);
    });
    const moveRows = [];
    for (let i = 0; i < moveButtons.length; i += 2) {
        moveRows.push(moveButtons.slice(i, i + 2));
    }

    const kb = Markup.inlineKeyboard([
        ...moveRows,
        [
            Markup.button.callback('🔄 Switch', 'battle_switch'), 
            Markup.button.callback('🏃 Run', 'battle_surrender'), 
            Markup.button.callback('🎒 Bag', 'battle_item')
        ]
    ]);

    // Send visual turn
    return media.sendBattleTurn(ctx, battle, p1.id, kb, ctx.chat.id);
}

trainingScene.action(/start_train_(.+)/, async (ctx) => {
    const level = ctx.match[1];
    let user = ctx.state.user || await db.users.findOne({ telegramId: ctx.from.id });
    await ctx.answerCbQuery(`Starting ${level} training...`);
    return startBattle(ctx, user, null, level);
});

trainingScene.action('battle_switch', async (ctx) => {
    const battle = ctx.session.activeBattle;
    const roster = battle.p1.team;
    const switchKb = roster.map((c, i) => {
        if (i === battle.p1.activeIdx || c.hp <= 0) return null;
        return [Markup.button.callback(`🔄 ${c.name} (Lv.${c.level})`, `exec_switch_${i}`)];
    }).filter(b => b !== null);
    switchKb.push([Markup.button.callback('⬅️ Back', 'back_to_actions')]);
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(switchKb).reply_markup);
});

trainingScene.action(/exec_switch_(.+)/, async (ctx) => {
    ctx.answerCbQuery().catch(() => null);
    const nextIdx = parseInt(ctx.match[1]);
    const battle = ctx.session.activeBattle;
    engine.processTurn(battle, { type: 'switch', nextIdx }, { type: 'attack', moveIdx: 0 });
    return renderBattle(ctx);
});

trainingScene.action(/exec_attack_(.+)/, async (ctx) => {
    ctx.answerCbQuery().catch(() => null);
    const moveIdx = parseInt(ctx.match[1]);
    const battle = ctx.session.activeBattle;

    if (!battle) return ctx.answerCbQuery("❌ Battle session lost. Use /profile to recover.");
    if (battle.processing) return ctx.answerCbQuery("⏳ Action in progress...");
    battle.processing = true;

    try {
        const char = battle.p1.team[battle.p1.activeIdx];
        const move = char.moves[moveIdx];
        if (char.ce < (move.ce || 0)) {
            battle.processing = false;
            return ctx.answerCbQuery("🌀 Not enough Cursed Energy!");
        }

        // Granular Resolution
        const actors = engine.getOrderedActors(battle, { type: 'attack', moveIdx }, { type: 'attack', moveIdx: 0 });
        
        for (let i = 0; i < actors.length; i++) {
            const actor = actors[i];
            const logs = engine.processAction(battle, actor);
            if (logs.length > 0) {
                battle.log.push(logs.join('\n'));
                
                const isLastAction = (i === actors.length - 1) && (battle.status === 'finished' || engine.postTurnCleanup(JSON.parse(JSON.stringify(battle))).length === 0);

                if (!isLastAction) {
                    await media.sendBattleTurn(ctx, battle, battle.p1.id);
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            if (battle.status === 'finished') break;
        }

        if (battle.status !== 'finished') {
            const cleanup = engine.postTurnCleanup(battle);
            if (cleanup.length > 0) {
                battle.log.push(cleanup.join('\n'));
                // No intermediate update here, let renderBattle handle the final state
            }
        }
    } finally {
        battle.processing = false;
    }

    return renderBattle(ctx);
});



trainingScene.action('battle_item', async (ctx) => {
    const user = await db.users.findOne({ telegramId: ctx.from.id });
    // Fix: Items don't have 'type' property yet, so we filter by IDs known to be combat items
    const combatItemIds = ['minor_hp_potion', 'major_hp_potion', 'special_grade_potion', 'ce_charge', 'ce_core', 'guard_stone', 'lucky_charm'];
    const combatItems = (user.inventory || []).filter(i => combatItemIds.includes(i.id)).filter(i => i.qty > 0);
    if (combatItems.length === 0) return ctx.answerCbQuery("Bag is empty!", { show_alert: true });
    const itemKb = combatItems.map(i => [Markup.button.callback(`${items[i.id].name} (x${i.qty})`, `exec_item_${i.id}`)]);
    itemKb.push([Markup.button.callback('⬅️ Back', 'back_to_actions')]);
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(itemKb).reply_markup);
});

trainingScene.action(/exec_item_(.+)/, async (ctx) => {
    ctx.answerCbQuery().catch(() => null);
    const itemId = ctx.match[1];
    const battle = ctx.session.activeBattle;
    await db.users.update({ telegramId: ctx.from.id, "inventory.id": itemId }, { $inc: { "inventory.$.qty": -1 } });
    engine.processTurn(battle, { type: 'item', itemId }, { type: 'attack', moveIdx: 0 });
    return renderBattle(ctx);
});

trainingScene.action('back_to_actions', async (ctx) => { 
    ctx.answerCbQuery().catch(() => null);
    return renderBattle(ctx); 
});

trainingScene.action('battle_surrender', async (ctx) => {
    if (!ctx.session.activeBattle) return ctx.answerCbQuery("No active battle.");
    ctx.session.activeBattle.status = 'finished';
    ctx.session.activeBattle.winner = 'AI';
    ctx.session.activeBattle.surrendered = true;
    return renderBattle(ctx);
});

module.exports = trainingScene;
