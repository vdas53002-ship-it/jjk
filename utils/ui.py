import math
import re

# ── Small Caps font map ───────────────────────────────────────────────
_SC = {
    'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ',
    'j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'Q','r':'ʀ',
    's':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ',
    'A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ꜰ','G':'ɢ','H':'ʜ','I':'ɪ',
    'J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'Q','R':'ʀ',
    'S':'ꜱ','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ',
    ' ':' ','[':'[',']':']',':':':',
    '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
    '-':'-','/':'/','+':'+','!':'!','%':'%','.':'.',',':',',
}

ICONS = {
    "COMMON": "⬜",
    "RARE": "🟦",
    "EPIC": "🟪",
    "LEGENDARY": "🟨",
    "MYTHIC": "🟥",
}

def sc(text):
    return ''.join(_SC.get(c, c) for c in str(text))

def create_progress_bar(current, max_val, length=10, filled="█", empty="░"):
    if not max_val: return empty * length
    pct = max(0.0, min(1.0, current / max_val))
    n = round(pct * length)
    return filled * n + empty * (length - n)

def hp_bar(cur, mx): return create_progress_bar(cur, mx, 10, '█', '░')

def divider(): return "━━━━━━━━━━━━━━━━━━━━━━"

def move_label(move):
    name = sc(move.get('name', 'Attack'))
    pwr  = move.get('power', move.get('basePower', move.get('damage', 0)))
    ce   = move.get('ce', 0)
    parts = []
    if pwr: parts.append(f"PWR: {pwr}")
    if ce and ce > 0: parts.append(f"CE: {ce}")
    suffix = f" [{', '.join(parts)}]" if parts else ""
    return f"- {name}{suffix}"

def format_header(text, type_="GENERAL"):
    return text.upper()

def panel(body): return body

def box(text, title=None):
    lines = text.split('\n')
    width = max(len(re.sub(r'<[^>]+>', '', line)) for line in lines)
    if title: width = max(width, len(title) + 4)
    
    res = ""
    if title:
        res += f"<b>╔══ {sc(title)} ══{'═' * (width - len(title) - 4)}╗</b>\n"
    else:
        res += f"<b>╔{'═' * (width + 2)}╗</b>\n"
    
    for line in lines:
        clean_line = re.sub(r'<[^>]+>', '', line)
        padding = " " * (width - len(clean_line))
        res += f"<b>║</b> {line}{padding} <b>║</b>\n"
        
    res += f"<b>╚{'═' * (width + 2)}╝</b>"
    return res

def premium_divider(style="modern"):
    if style == "cursed":
        return "⚡︎ ─────────── ⚡︎"
    if style == "fancy":
        return "✧ ══════════════ ✧"
    return "━━━━━━━━━━━━━━━━━━━━━━"

def render_stat_bar(label, current, max_val, color_icon="🟩"):
    pct = (current / max_val) * 100 if max_val > 0 else 0
    bar = create_progress_bar(current, max_val, 8, "▰", "▱")
    return f"{label} {bar} <code>{int(pct)}%</code>"

def render_pokemon_ui(battle, user_id):
    # ── Identify Viewer vs Opponent ───────────────────────────────────
    is_p1 = user_id == battle['p1']['id']
    viewer = battle['p1'] if is_p1 else battle['p2']
    opponent = battle['p2'] if is_p1 else battle['p1']
    
    v_idx = viewer.get('activeIdx', 0)
    o_idx = opponent.get('activeIdx', 0)
    v_char = viewer['team'][v_idx]
    o_char = opponent['team'][o_idx]

    # ── Last turn log ─────────────────────────────────────────────────
    logs = battle.get('log', [])
    last_log = logs[-1] if logs else "BATTLE START!"
    
    def get_status_icons(player):
        icons = ""
        for i, c in enumerate(player['team']):
            if c['hp'] <= 0: icons += "💀"
            elif i == player['activeIdx']: icons += "🔴"
            else: icons += "⚪"
        return icons

    # ── HP/CE display ─────────────────────────────────────────────────
    v_energy_icon = '💪' if v_char.get('energyType') == 'PE' else '🌀'
    o_energy_icon = '💪' if o_char.get('energyType') == 'PE' else '🌀'

    msg = (
        f"<b>⚔️ {sc(battle.get('mode', 'DUEL'))}</b>\n"
        f"<b>━━━━━━━━━━━━━━━━━━━━━━</b>\n"
        f"<b>{sc(o_char['name'])}</b> <code>[{o_char.get('grade', 'G3')}]</code>\n"
        f"<b>HP:</b> <code>{int(o_char['hp'])}/{o_char['maxHp']}</code>\n"
        f"<code>{hp_bar(o_char['hp'], o_char['maxHp'])}</code>\n"
        f"{o_energy_icon} <b>CE:</b> <code>{int(o_char['ce'])}</code>\n"
        f"<b>━━━━━━━━━━━━━━━━━━━━━━</b>\n"
        f"<b>{sc(v_char['name'])}</b> (YOU) <code>[{v_char.get('grade', 'G3')}]</code>\n"
        f"<b>HP:</b> <code>{int(v_char['hp'])}/{v_char['maxHp']}</code>\n"
        f"<code>{hp_bar(v_char['hp'], v_char['maxHp'])}</code>\n"
        f"{v_energy_icon} <b>CE:</b> <code>{int(v_char['ce'])}</code>\n"
        f"<b>━━━━━━━━━━━━━━━━━━━━━━</b>\n"
        f"💬 {last_log}\n"
        f"<b>━━━━━━━━━━━━━━━━━━━━━━</b>\n"
        f"𝗬𝗢𝗨: {get_status_icons(viewer)}  𝗩𝗦  𝗢𝗣𝗣: {get_status_icons(opponent)}\n"
    )


    return msg
