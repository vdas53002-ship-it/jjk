import random
from utils.data.types import types_system

class CombatResolver:
    def resolve_attack(self, attacker, defender, move, is_meter_full=False):
        # CE Check
        if attacker.get('ce', 0) < move.get('ce', 0):
            return {
                "damage": 10,
                "isBlackFlash": False,
                "msg": f"{attacker['name']} tried to use {move['name']} but lacked Cursed Energy!"
            }

        # 1. Base Damage Calculation
        min_dmg, max_dmg = move.get('dmg', [10, 20])
        base_move_dmg = random.randint(min_dmg, max_dmg)
        
        power = float(attacker.get('power', 50))
        stamina = float(attacker.get('stamina', 50))
        ce_stat = float(attacker.get('ce_stat', 50))
        technique = float(attacker.get('technique', 50))
        level = float(attacker.get('level', 1))
        
        # Power Metrics Influence
        a_tp = float(attacker.get('tp', 100))
        a_ts = float(attacker.get('ts', 100))
        d_tp = float(defender.get('tp', 100))
        d_ts = float(defender.get('ts', 100))

        # TS adds a flat multiplier to the character's potency
        ts_mult = 1.0 + (a_ts / 2500.0)
        # TP adds to the character's overall stability and secondary scaling
        tp_mult = 1.0 + (a_tp / 5000.0)

        # Tank Build Scaling: 0.2 to 6.0 based on Level
        scale = 0.2 + (level / 20.0)
        if scale > 6.0: scale = 6.0

        is_cursed = move.get('type') in ['Long-range', 'Barrier', 'Cursed']
        
        if is_cursed:
            # Cursed Damage Scaling
            attack_power = ((ce_stat * 1.5) + (technique * 0.8)) * ts_mult
        else:
            # Physical Damage Scaling
            attack_power = ((power * 0.8) + (stamina * 0.1)) * ts_mult

        # 2. Multipliers
        type_mult = types_system.get_multiplier(move.get('type'), defender.get('type'))
        
        # Resilience (Defense scaling) - Boosted by Defender's TP
        resilience_base = float(defender.get('stamina', 50)) / 10.0
        resilience_tp_bonus = d_tp / 100.0
        resilience = resilience_base + resilience_tp_bonus
        
        if move.get('ignoreBarrier') or move.get('effect', {}).get('ignoreBarrier'):
            resilience = 0
            
        resilience_mult = 100.0 / (100.0 + resilience)
        
        # Piercing
        piercer = 1.0
        if move.get('ignoreDef') or move.get('effect', {}).get('ignoreDef'):
            piercer = 1.5

        # 3. Black Flash (Crit) - Precision influenced by Technique and TS
        bf_chance = (float(move.get('crit', 10)) + (technique / 15.0) + (a_ts / 50.0)) / 100
        if attacker.get('hasBFBuff'):
            bf_chance += 0.05

        is_black_flash = random.random() < bf_chance or is_meter_full
        crit_mult = 1.0
        if is_black_flash:
            crit_mult = 3.0 if is_meter_full else 2.5 # Buffed BF mult

        # Accuracy & Evasion - Speed influenced by TS
        move_acc = move.get('accuracy', 100) + (a_ts / 20.0)
        def_evasion = min(45, (float(defender.get('speed', 100)) / 20.0) + (d_ts / 40.0))
        
        is_miss = random.random() * 100 > move_acc
        is_dodge = not is_miss and random.random() * 100 < def_evasion
        
        if is_miss or is_dodge:
            return {
                "damage": 0,
                "isBlackFlash": False,
                "ceCost": move.get('ce', 0),
                "isMiss": is_miss,
                "isDodge": is_dodge,
                "typeMult": 1.0,
                "isAOE": False,
                "meterGain": 0
            }

        # 4. Final Calculation
        damage = int((base_move_dmg + attack_power) * type_mult * crit_mult * resilience_mult * piercer * tp_mult)
        if damage < 1: damage = max(1, int(power * 0.05)) # Minimum damage based on Power

        # 5. Positioning
        attacker_pos = attacker.get('position', 'middle')
        defender_pos = defender.get('position', 'middle')
        atk_pos_mult = 1.1 if attacker_pos == 'front' else (0.95 if attacker_pos == 'back' else 1.0)
        def_pos_mult = 1.2 if defender_pos == 'front' else (0.9 if defender_pos == 'back' else 1.0)
        
        damage = int(damage * atk_pos_mult * (1.0 / def_pos_mult))

        # 6. Variance
        variance = random.randint(85, 100) / 100.0
        damage = int(damage * variance)

        type_msg = ""
        if type_mult > 1.2: type_msg = "💥 <b>It's Super Effective!</b>"
        elif type_mult < 0.8: type_msg = "🛡️ <b>It's not very effective...</b>"

        return {
            "damage": damage,
            "isBlackFlash": is_black_flash,
            "ceCost": move.get('ce', 0),
            "typeMult": type_mult,
            "typeMsg": type_msg,
            "isAOE": move.get('aoe', False),
            "meterGain": 20 if is_black_flash else 0
        }

combat_resolver = CombatResolver()
