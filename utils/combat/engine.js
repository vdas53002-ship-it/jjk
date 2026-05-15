const resolver = require('./resolver');

/**
 * Combat Engine: Refined GDD simultaneous turn logic.
 * Refactored for step-by-step resolution support.
 */
module.exports = {
    initBattle(p1, p2) {
        return {
            p1: this.formatPlayerState(p1),
            p2: this.formatPlayerState(p2),
            turn: 1,
            log: [],
            status: 'ongoing',
            winner: null,
            lastActionAt: Date.now(),
            sharedData: {
                p1Meter: 0,
                p2Meter: 0,
                p1DomainUsed: false,
                p2DomainUsed: false,
                p1TotalDmg: 0,
                p2TotalDmg: 0,
                lastHitWasBlackFlash: false
            }
        };
    },

    formatPlayerState(playerData) {
        return {
            id: playerData.telegramId,
            username: playerData.username,
            activeIdx: 0,
            team: playerData.teamMembers.map(c => ({
                ...c,
                hasHealed: false,
                position: 'middle',
                statusEffects: []
            }))
        };
    },

    /**
     * Determines actor order based on speed
     */
    getOrderedActors(state, p1Action, p2Action) {
        let actors = [
            { id: 'p1', action: p1Action, player: state.p1, opponent: state.p2, meter: 'p1Meter', dmg: 'p1TotalDmg' },
            { id: 'p2', action: p2Action, player: state.p2, opponent: state.p1, meter: 'p2Meter', dmg: 'p2TotalDmg' }
        ];

        actors.sort((a, b) => {
            const speedA = a.player.team[a.player.activeIdx].speed || 1;
            const speedB = b.player.team[b.player.activeIdx].speed || 1;
            if (speedA === speedB) return Math.random() - 0.5;
            return speedB - speedA;
        });

        return actors;
    },

    /**
     * Processes a single actor's action
     */
    processAction(state, actor) {
        const actionLog = [];
        const char = actor.player.team[actor.player.activeIdx];
        const oppChar = actor.opponent.team[actor.opponent.activeIdx];

        if (char.hp <= 0) return actionLog;

        const stun = (char.statusEffects || []).find(e => e.type === 'stun');
        if (stun && actor.action.type !== 'switch') {
            actionLog.push(`💫 <b>${char.name}</b> is stunned!`);
            return actionLog;
        }

        if (actor.action.type === 'switch') {
            const nextIdx = actor.action.nextIdx;
            const nextChar = actor.player.team[nextIdx];
            actor.player.activeIdx = nextIdx;
            actionLog.push(`🔄 ${actor.player.username} switched to <b>${nextChar.name}</b>!`);
            return actionLog;
        }

        if (actor.action.type === 'attack') {
            const isMeterFull = state.sharedData[actor.meter] >= 100;
            const move = char.moves[actor.action.moveIdx];
            const result = resolver.resolveAttack(char, oppChar, move, isMeterFull);

            // Apply Main Damage
            const finalDmg = Math.floor(result.damage * (char.dmgBuff || 1.0));
            oppChar.hp = Math.max(0, oppChar.hp - finalDmg);
            char.ce = Math.max(0, char.ce - result.ceCost);
            state.sharedData[actor.dmg] += finalDmg;
            state.sharedData.lastHitWasBlackFlash = result.isBlackFlash;
            
            // Clear one-time buffs
            char.dmgBuff = 1.0;

            let logLine = `${char.name} used <b>${move.name}</b> on ${oppChar.name}`;
            
            if (result.isMiss) {
                logLine += `\n💨 But it <b>MISSED!</b>`;
            } else if (result.isDodge) {
                logLine += `\n🌬️ ${oppChar.name} <b>DODGED!</b>`;
            } else {
                logLine += ` <b>[-${finalDmg} HP]</b>`;
                if (result.isBlackFlash) {
                    logLine += isMeterFull ? `\n🔥 <b>METER BURST: BLACK FLASH!</b>` : `\n⚡️ <b>BLACK FLASH!</b>`;
                    state.sharedData[actor.meter] = isMeterFull ? 0 : Math.min(100, state.sharedData[actor.meter] + 20);
                }
                if (result.typeMsg) logLine += `\n${result.typeMsg}`;
            }
            
            actionLog.push(logLine);

            // --- AOE Splash Damage ---
            if (result.isAOE) {
                actor.opponent.team.forEach((c, idx) => {
                    if (idx !== actor.opponent.activeIdx && c.hp > 0) {
                        const splash = Math.floor(finalDmg * 0.4);
                        c.hp = Math.max(0, c.hp - splash);
                        actionLog.push(`💥 Splash: ${c.name} took <b>${splash} dmg</b>!`);
                    }
                });
            }

            if (move.effect) {
                const e = move.effect;
                if (e.type === 'bleed' && Math.random() < (e.chance || 1)) {
                    oppChar.statusEffects.push({ type: 'bleed', duration: e.duration || 2, val: e.val || 0.05 });
                    actionLog.push(`🩸 ${oppChar.name} is bleeding!`);
                } else if (e.type === 'poison' && Math.random() < (e.chance || 1)) {
                    oppChar.statusEffects.push({ type: 'poison', duration: e.duration || 3, val: e.val || 0.04 });
                    actionLog.push(`🤢 ${oppChar.name} was poisoned!`);
                } else if (e.type === 'stun' && Math.random() < (e.chance || 1)) {
                    oppChar.statusEffects.push({ type: 'stun', duration: 1 });
                    actionLog.push(`💫 ${oppChar.name} was stunned!`);
                } else if (e.type === 'lifesteal') {
                    const heal = Math.floor(finalDmg * (e.val || 0.3));
                    char.hp = Math.min(char.maxHp, char.hp + heal);
                    actionLog.push(`✨ ${char.name} absorbed <b>${heal} HP</b>!`);
                } else if (e.type === 'heal') {
                    const healAmt = Math.floor(char.maxHp * (e.val || 0.2));
                    char.hp = Math.min(char.maxHp, char.hp + healAmt);
                    actionLog.push(`💖 ${char.name} healed for <b>${healAmt} HP</b>!`);
                } else if (e.type === 'swap') {
                    const available = actor.player.team.map((c, i) => ({c, i})).filter(x => x.c.hp > 0 && x.i !== actor.player.activeIdx);
                    if (available.length > 0) {
                        const target = available[Math.floor(Math.random() * available.length)];
                        actor.player.activeIdx = target.i;
                        actionLog.push(`🔄 ${char.name} swapped out for <b>${target.c.name}</b>!`);
                    }
                } else if (e.type === 'buff' && e.stat === 'atk') {
                    char.dmgBuff = e.val || 1.5;
                    actionLog.push(`🔥 ${char.name} concentrated energy!`);
                }
            }

            if (oppChar.hp <= 0) actionLog.push(`💀 ${oppChar.name} was KO'd!`);
        }

        return actionLog;
    },

    /**
     * Post-action maintenance (status effects, CE regen, win check)
     */
    postTurnCleanup(state) {
        const cleanupLog = [];
        [state.p1, state.p2].forEach(p => {
            const char = p.team[p.activeIdx];
            if (char.hp <= 0) return;
            if (char.statusEffects) {
                char.statusEffects = char.statusEffects.filter(e => {
                    if (e.type === 'bleed' || e.type === 'poison' || e.type === 'decay') {
                        const dotDmg = Math.floor(char.maxHp * (e.val || 0.05));
                        char.hp = Math.max(0, char.hp - dotDmg);
                        const label = e.type === 'bleed' ? '🩸 Bleed' : (e.type === 'poison' ? '🤢 Poison' : '💀 Decay');
                        cleanupLog.push(`${label}: ${char.name} lost <b>${dotDmg} HP</b>.`);
                    }
                    e.duration--;
                    return e.duration > 0;
                });
            }
            char.ce = Math.min(char.maxCe || 200, char.ce + 10);
        });

        state.turn += 1;
        const p1Lost = state.p1.team.every(c => c.hp <= 0);
        const p2Lost = state.p2.team.every(c => c.hp <= 0);
        if (p1Lost || p2Lost) {
            state.status = 'finished';
            state.winner = p1Lost ? state.p2.username : state.p1.username;
        }

        return cleanupLog;
    },

    // Legacy method for non-animated handlers
    processTurn(state, p1Action, p2Action) {
        const actors = this.getOrderedActors(state, p1Action, p2Action);
        const turnLog = [];
        
        for (const actor of actors) {
            const logs = this.processAction(state, actor);
            turnLog.push(...logs);
        }

        const cleanupLogs = this.postTurnCleanup(state);
        turnLog.push(...cleanupLogs);

        state.log.push(turnLog.join('\n'));
        return state;
    }
};
