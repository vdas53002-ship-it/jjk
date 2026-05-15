import re
import time
import random
from utils.combat.resolver import combat_resolver

class CombatEngine:
    def init_battle(self, p1_data, p2_data):
        return {
            "p1": self.format_player_state(p1_data),
            "p2": self.format_player_state(p2_data),
            "turn": 1,
            "log": [],
            "status": "ongoing",
            "winner": None,
            "lastActionAt": int(time.time() * 1000),
            "sharedData": {
                "p1Meter": 0,
                "p2Meter": 0,
                "p1DomainUsed": False,
                "p2DomainUsed": False,
                "p1TotalDmg": 0,
                "p2TotalDmg": 0,
                "p1_dodges": 0,
                "p2_dodges": 0,
                "p1_domain_used": False,
                "p2_domain_used": False,
                "lastHitWasBlackFlash": False
            }
        }

    def format_player_state(self, player_data):
        return {
            "id": player_data['telegramId'],
            "username": player_data['username'],
            "activeIdx": 0,
            "team": [{
                **c,
                "hasHealed": False,
                "position": "middle",
                "statusEffects": [],
                "_dodging": False,
            } for c in player_data['teamMembers']]
        }

    def get_ordered_actors(self, state, p1_action, p2_action):
        actors = [
            {"id": "p1", "action": p1_action, "player": state['p1'], "opponent": state['p2'], "meter": "p1Meter", "dmg": "p1TotalDmg"},
            {"id": "p2", "action": p2_action, "player": state['p2'], "opponent": state['p1'], "meter": "p2Meter", "dmg": "p2TotalDmg"}
        ]
        
        # Priority: Dodge/Switch/Item > Speed
        def get_priority(action):
            atype = action.get('type')
            if atype in ['dodge', 'switch', 'item']: return 1
            return 0

        # Initiative = Speed + (Technique * 0.2)
        actors.sort(key=lambda a: (
            get_priority(a['action']),
            a['player']['team'][a['player']['activeIdx']].get('speed', 100) + 
            (a['player']['team'][a['player']['activeIdx']].get('technique', 50) * 0.2)
        ), reverse=True)
        return actors


    def process_action(self, state, actor):
        action_log = []
        player   = actor['player']
        opponent = actor['opponent']
        char     = player['team'][player['activeIdx']]
        opp_char = opponent['team'][opponent['activeIdx']]

        if char['hp'] <= 0:
            return action_log

        # Stun check
        if any(e['type'] == 'stun' for e in char.get('statusEffects', [])) and actor['action']['type'] != 'switch':
            action_log.append(f"{char['name']} is stunned and can't move!")
            return action_log

        atype = actor['action']['type']

        # ── SWITCH ──────────────────────────────────────────────────────
        if atype == 'switch':
            next_idx  = actor['action']['nextIdx']
            player['activeIdx'] = next_idx
            next_char = player['team'][next_idx]
            action_log.append(f"{player['username']} switched to {next_char['name']}!")
            return action_log

        # ── DODGE ────────────────────────────────────────────────────────
        if atype == 'dodge':
            dodge_key = actor['id'] + '_dodges'
            used = state['sharedData'].get(dodge_key, 0)
            if used >= 2:
                action_log.append(f"{char['name']} has no dodges left!")
                return action_log
            state['sharedData'][dodge_key] = used + 1
            char['_dodging'] = True
            char['ce'] = min(char.get('maxCe', 500), char.get('ce', 0) + 40)
            remaining = 2 - state['sharedData'][dodge_key]
            action_log.append(f"{char['name']} braces to dodge! (+40 CE) [{remaining} dodge(s) left]")
            return action_log

        # ── ATTACK ───────────────────────────────────────────────────────
        if atype == 'attack':
            meter_key     = actor['meter']
            is_meter_full = state['sharedData'].get(meter_key, 0) >= 100
            move_idx      = actor['action'].get('moveIdx', 0)

            # Guard: clamp move_idx to valid range
            moves = char.get('moves', [])
            if not moves:
                action_log.append(f"{char['name']} has no moves!")
                return action_log
            move_idx = min(move_idx, len(moves) - 1)
            move = moves[move_idx]

            # If opponent is dodging this turn
            if opp_char.get('_dodging'):
                opp_char['_dodging'] = False
                opp_char['ce'] = min(opp_char.get('maxCe', 500), opp_char.get('ce', 0) + 40)
                spd_diff = opp_char.get('speed', 12) - char.get('speed', 12)

                if spd_diff > 3:
                    # Speed blitz — dodger counters
                    non_dodge_moves = [m for m in opp_char.get('moves', []) if not m.get('isDodge') and m.get('name') != 'Dodge']
                    counter_move = non_dodge_moves[0] if non_dodge_moves else move
                    raw_dmg = counter_move.get('dmg', [30, 50])
                    if isinstance(raw_dmg, list) and len(raw_dmg) >= 2:
                        base_dmg = random.randint(raw_dmg[0], raw_dmg[1])
                    else:
                        base_dmg = int(raw_dmg) if raw_dmg else 30
                    counter_dmg = max(1, int(opp_char.get('atk', 20) * base_dmg / 100))
                    char['hp'] = max(0, char['hp'] - counter_dmg)
                    action_log.append(
                        f"{opp_char['name']} DODGED {char['name']}'s {move['name']}! "
                        f"Speed Blitz! (Spd {opp_char.get('speed',12)} vs {char.get('speed',12)}) "
                        f"Counter: {opp_char['name']} hits {char['name']} for -{counter_dmg} HP! (+40 CE)"
                    )
                    if char['hp'] <= 0:
                        action_log.append(f"💀 {char['name']} was KO'd by the counter!")
                else:
                    action_log.append(
                        f"{opp_char['name']} DODGED {char['name']}'s {move['name']}! (+40 CE)"
                    )
                # Attacker still gains +40 CE
                char['ce'] = min(char.get('maxCe', 500), char.get('ce', 0) + 40)
                return action_log

            # Normal attack resolution
            res = combat_resolver.resolve_attack(char, opp_char, move, is_meter_full)

            if not res or "msg" in res:
                action_log.append(res.get('msg', f"{char['name']} attacks!") if res else f"{char['name']} attacks!")
                return action_log

            final_dmg = max(0, int(res.get('damage', 0) * char.get('dmgBuff', 1.0)))

            # Track domain expansion usage and apply Domain Shard Buff
            is_ultimate = 'domain' in move.get('name', '').lower() or 'expansion' in move.get('name', '').lower() or move.get('ce', 0) >= 100
            if is_ultimate:
                if char.get('hasDomainShardBuff'):
                    final_dmg = int(final_dmg * 1.5)
                if 'domain' in move.get('name', '').lower() or 'expansion' in move.get('name', '').lower():
                    state['sharedData'][actor['id'] + '_domain_used'] = True

            opp_char['hp'] = max(0, opp_char['hp'] - final_dmg)

            # CE: negative ce cost = gains CE; positive = spends CE; +15 base regen
            ce_cost = move.get('ce', 0)
            if ce_cost < 0:
                char['ce'] = min(char.get('maxCe', 500), char.get('ce', 0) + abs(ce_cost) + 15)
            else:
                char['ce'] = min(char.get('maxCe', 500), max(0, char.get('ce', 0) - ce_cost + 15))

            state['sharedData'][actor['dmg']] = state['sharedData'].get(actor['dmg'], 0) + final_dmg
            state['sharedData']['lastHitWasBlackFlash'] = res.get('isBlackFlash', False)
            char['dmgBuff'] = 1.0

            log_line = f"{char['name']} used {move['name']}! Deals {final_dmg} Dmg!"
            if char.get('hasDomainShardBuff') and is_ultimate:
                log_line += " (Domain Shard Boost +50%!)"

            if res.get('isMiss'):
                log_line += " But it MISSED!"
            elif not res.get('isDodge'):
                if res.get('isBlackFlash'):
                    tag = "METER BURST: BLACK FLASH!" if is_meter_full else "BLACK FLASH!"
                    log_line += f" {tag}"
                    state['sharedData'][meter_key] = 0 if is_meter_full else min(100, state['sharedData'].get(meter_key, 0) + 20)
                if res.get('typeMsg'):
                    log_line += f" {re.sub(r'<[^>]+>', '', res['typeMsg'])}"

            action_log.append(log_line)

            # AOE splash
            if res.get('isAOE'):
                for idx, c in enumerate(opponent['team']):
                    if idx != opponent['activeIdx'] and c['hp'] > 0:
                        splash = int(final_dmg * 0.4)
                        c['hp'] = max(0, c['hp'] - splash)
                        action_log.append(f"Splash: {c['name']} took {splash} dmg!")

            # Status effects
            if move.get('effect'):
                e     = move['effect']
                etype = e.get('type')
                chance = e.get('chance', 1.0)
                if etype == 'bleed' and random.random() < chance:
                    opp_char.setdefault('statusEffects', []).append({"type":"bleed","duration":e.get("duration",2),"val":e.get("val",0.05)})
                    action_log.append(f"{opp_char['name']} is bleeding!")
                elif etype == 'poison' and random.random() < chance:
                    opp_char.setdefault('statusEffects', []).append({"type":"poison","duration":e.get("duration",3),"val":e.get("val",0.04)})
                    action_log.append(f"{opp_char['name']} was poisoned!")
                elif etype == 'stun' and random.random() < chance:
                    opp_char.setdefault('statusEffects', []).append({"type":"stun","duration":1})
                    action_log.append(f"{opp_char['name']} was stunned!")
                elif etype == 'lifesteal':
                    heal = int(final_dmg * e.get('val', 0.3))
                    char['hp'] = min(char['maxHp'], char['hp'] + heal)
                    action_log.append(f"{char['name']} absorbed {heal} HP!")
                elif etype == 'heal':
                    heal_amt = int(char['maxHp'] * e.get('val', 0.2))
                    char['hp'] = min(char['maxHp'], char['hp'] + heal_amt)
                    action_log.append(f"{char['name']} healed for {heal_amt} HP!")
                elif etype == 'buff' and e.get('stat') == 'atk':
                    char['dmgBuff'] = e.get('val', 1.5)
                    action_log.append(f"{char['name']} concentrated energy!")

            if opp_char['hp'] <= 0:
                action_log.append(f"{opp_char['name']} was KO'd!")

            return action_log

        # Unknown action type - return empty log (never None)
        return action_log

    def post_turn_cleanup(self, state):
        cleanup_log = []
        for p in [state['p1'], state['p2']]:
            char = p['team'][p['activeIdx']]
            if char['hp'] <= 0: continue
            new_effects = []
            for e in char.get('statusEffects', []):
                if e['type'] in ['bleed', 'poison', 'decay']:
                    dot_dmg = int(char['maxHp'] * e.get('val', 0.05))
                    char['hp'] = max(0, char['hp'] - dot_dmg)
                    label = "Bleed" if e['type'] == 'bleed' else ("Poison" if e['type'] == 'poison' else "Decay")
                    cleanup_log.append(f"{label}: {char['name']} lost {dot_dmg} HP.")
                e['duration'] -= 1
                if e['duration'] > 0:
                    new_effects.append(e)
            char['statusEffects'] = new_effects

        state['turn'] += 1
        p1_lost = all(c['hp'] <= 0 for c in state['p1']['team'])
        p2_lost = all(c['hp'] <= 0 for c in state['p2']['team'])
        if p1_lost or p2_lost:
            state['status'] = 'finished'
            state['winner'] = state['p2']['username'] if p1_lost else state['p1']['username']
        return cleanup_log

    def process_turn(self, state, p1_action, p2_action):
        # Reset dodging state at start of turn
        for p in [state['p1'], state['p2']]:
            for c in p['team']:
                c['_dodging'] = False

        actors   = self.get_ordered_actors(state, p1_action, p2_action)
        turn_log = []
        for actor in actors:
            logs = self.process_action(state, actor)
            if logs:  # guard against None
                turn_log.extend(logs)
        cleanup = self.post_turn_cleanup(state)
        turn_log.extend(cleanup)
        state['log'].append("\n".join(turn_log))
        return state

combat_engine = CombatEngine()
