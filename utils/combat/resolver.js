const types = require('../data/types');

/**
 * Combat Resolver: Handles refined GDD damage calculation.
 * Damage = (BaseMoveDamage + (AttackPower * 0.2)) * TypeMultiplier * CriticalMultiplier * ResilienceMultiplier
 */
module.exports = {
    resolveAttack(attacker, defender, move, isMeterFull = false) {
        // CE Check
        if (attacker.ce < move.ce) {
            return {
                damage: 10, // Default "Basic Punch"
                isBlackFlash: false,
                msg: `${attacker.name} tried to use ${move.name} but lacked Cursed Energy!`
            };
        }

        // 1. Base Damage Calculation
        const [min, max] = move.dmg || [10, 20];
        const baseMoveDmg = Math.floor(Math.random() * (max - min + 1)) + min;
        const attackPower = Number(attacker.atk || attacker.attack || 50);

        // 2. Multipliers
        const typeMult = Number(types.getMultiplier(move.type, defender.type) || 1.0);
        
        // --- Technical Logic Expansion ---
        let resilience = Number(defender.resilience || 0);
        if (move.ignoreBarrier || (move.effect && move.effect.ignoreBarrier)) {
            resilience = 0; // Completely bypass resilience
        }
        
        let resilienceMult = 1 - (resilience / 100);
        
        // Defense Piercing logic
        let piercer = 1.0;
        if (move.ignoreDef || (move.effect && move.effect.ignoreDef)) {
            piercer = 1.5; // Acts as a damage boost if defense is ignored
        }

        // 3. Black Flash (Crit)
        let bfChance = Number(move.crit || 10) / 100;
        
        if (attacker.hasBFBuff) {
            bfChance += 0.05;
        }

        let isBlackFlash = Math.random() < bfChance || isMeterFull;
        let critMult = 1.0;
        
        if (isBlackFlash) {
            critMult = isMeterFull ? 3.0 : 2.0;
        }

        // --- Accuracy & Evasion Checks ---
        const moveAcc = move.accuracy || 100;
        const defEvasion = Math.min(25, (defender.speed || 100) / 40); // Max 25% evasion
        
        let isMiss = Math.random() * 100 > moveAcc;
        let isDodge = !isMiss && Math.random() * 100 < defEvasion;
        
        if (isMiss || isDodge) {
            return {
                damage: 0,
                isBlackFlash: false,
                ceCost: move.ce,
                isMiss,
                isDodge,
                typeMult: 1.0,
                isAOE: false,
                meterGain: 0
            };
        }

        // 4. Final Calculation
        // Increased attack multiplier from 0.2 to 1.5 for faster, exciting combat
        let damage = Math.floor((baseMoveDmg + (attackPower * 1.5)) * typeMult * critMult * resilienceMult * piercer);
        if (isNaN(damage)) damage = 10;

        // 5. Positioning Modifier
        const attackerPos = attacker.position || 'middle';
        const defenderPos = defender.position || 'middle';
        const atkPosMult = attackerPos === 'front' ? 1.1 : (attackerPos === 'back' ? 0.95 : 1.0);
        const defPosMult = defenderPos === 'front' ? 1.2 : (defenderPos === 'back' ? 0.9 : 1.0);
        
        damage = Math.floor(damage * atkPosMult * (1 / defPosMult));

        // 6. Random Variance (85% to 100% - Pokemon style)
        const variance = (Math.floor(Math.random() * 16) + 85) / 100;
        damage = Math.floor(damage * variance);

        let typeMsg = "";
        if (typeMult > 1.2) typeMsg = "💥 <b>It's Super Effective!</b>";
        else if (typeMult < 0.8) typeMsg = "🛡️ <b>It's not very effective...</b>";

        return {
            damage,
            isBlackFlash,
            ceCost: move.ce,
            typeMult,
            typeMsg,
            isAOE: move.aoe || false,
            meterGain: isBlackFlash ? 20 : 0
        };
    }
};
