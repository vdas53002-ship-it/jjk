import random
from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from database import db
from utils import ui, media
from services.reward_service import reward_service
from services.achievement_service import achievement_service

router = Router()

TIPS = [
    "💡 Barrier types are strong against Long-range attackers!",
    "💡 Close-range fighters deal 1.5x damage to Barrier types.",
    "💡 Use your Cursed Energy (CE) wisely; dodging regenerates CE!",
    "💡 Higher Grade sorcerers have better base stats. Promote them in /upgrades!",
    "💡 Mythic and Legendary sorcerers cost more to level up but are far stronger.",
    "💡 Use /bf daily for a free crit boost before battles!",
    "💡 Clan members share ELO power — join a strong syndicate!",
    "💡 Daily quests (/quests) reset every midnight UTC.",
    "💡 Use /view to inspect any character's stats and moves!",
]

# ── FULL HELP DATA ─────────────────────────────────────────────────────────

HELP_DATA = {
    "select": {
        "title": "ARCHIVE ACCESS",
        "msg": "Welcome, Sorcerer. Choose your preferred language to access the archives:\n\n<i>Apni bhasha chunein:</i>",
        "kb": [
            [{"text": "🇬🇧 English", "callback_data": "help_en_main"}],
            [{"text": "🇮🇳 Hinglish", "callback_data": "help_hi_main"}]
        ]
    },
    "en": {
        "main": {
            "title": "CURSED ARCHIVES",
            "msg": "Select a section to learn the laws of cursed energy:",
            "kb": [
                [{"text": "⚔️ Combat",    "callback_data": "help_en_combat"},
                 {"text": "🧬 Growth",    "callback_data": "help_en_growth"}],
                [{"text": "🗺 Explore",   "callback_data": "help_en_explore"},
                 {"text": "🏰 Social",    "callback_data": "help_en_social"}],
                [{"text": "💰 Economy",   "callback_data": "help_en_economy"},
                 {"text": "📜 Commands",  "callback_data": "help_en_cmds"}],
                [{"text": "🔍 Characters","callback_data": "help_en_chars"},
                 {"text": "🛠 Admin",     "callback_data": "help_en_admin"}],
                [{"text": "🌐 Change Language", "callback_data": "cmd_help"}]
            ]
        },
        "combat": {
            "title": "BATTLE GUIDE",
            "msg": (
                "• 👊 <b>Type Triangle:</b> Close > Barrier > Long > Close\n"
                "  (1.5× damage on advantage, 0.75× on disadvantage)\n\n"
                "• ⚡ <b>Black Flash:</b> 2× Critical damage. Meter burst = 3×!\n"
                "• 🌬️ <b>Dodge:</b> 2 uses per character per battle. Grants +40 CE.\n"
                "• 🔄 <b>Switch:</b> Swap active character — costs your turn.\n"
                "• 🏳️ <b>Surrender:</b> Exit instantly but earn zero rewards.\n"
                "• 💥 <b>AOE Moves:</b> Hit all enemy team for 40% splash.\n"
                "• 🩸 <b>Status Effects:</b> Bleed / Poison deal % HP per turn.\n"
                "• 🌀 <b>CE Meter:</b> Fills to 100 from Black Flashes → BURST.\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_en_main"}]]
        },
        "growth": {
            "title": "GROWTH SYSTEM",
            "msg": (
                "• 🎖 <b>Player Level:</b> Earn XP from battles & quests.\n"
                "• 📈 <b>Character XP:</b> Each battle gives your team XP.\n"
                "• ⭐ <b>Stars:</b> Use Shards in /upgrades for +15% stats per star.\n"
                "• 🏮 <b>Grade Promotion:</b> Lv15→Grade3, Lv30→Grade2, Lv45→Grade1, Lv60→Special\n"
                "• 🔥 <b>Pity System:</b> Guaranteed Legendary at 100 pulls.\n"
                "• 🏅 <b>Milestones:</b> Level-up bonuses at 2, 5, 10, 15, 20, 25, 30, 50, 100.\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_en_main"}]]
        },
        "explore": {
            "title": "HUNTING GUIDE",
            "msg": (
                "• 🏮 <b>Manual Hunt (/hunt):</b> 1,000 free hunts/day. No stamina.\n"
                "• ⚙️ <b>Auto-Grind:</b> Costs 🔋50 Stamina for 10 instant rooms.\n"
                "• 🗺 <b>Biomes:</b>\n"
                "  — Haunted Outskirts (Lv1+): Common/Rare drops\n"
                "  — Cursed Urban District (Lv20+): Rare/Epic drops\n"
                "  — Special Grade Territory (Lv50+): Epic/Legendary drops\n"
                "• ⚔️ <b>Encounter Types:</b> Battle, Scavenge, Mystery, Rest\n"
                "• 🔋 <b>Stamina:</b> Claim /daily or use Energy Drinks to restore.\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_en_main"}]]
        },
        "social": {
            "title": "CLANS & SCHOOLS",
            "msg": (
                "• 🏫 <b>Academy (/school):</b> Choose Tokyo or Kyoto High.\n"
                "  — Tokyo: +10% ATK, +5% Speed\n"
                "  — Kyoto: +10% CE Regen, +5% Defence\n\n"
                "• 🛡 <b>Clans (/clan):</b> Join a Syndicate for power bonuses.\n"
                "  — Create at Lv20 (costs 5,000 Coins)\n"
                "  — Join at Lv15 (same academy only!)\n"
                "  — Contribute dust to treasury\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_en_main"}]]
        },
        "economy": {
            "title": "ITEMS & MARKET",
            "msg": (
                "• 💰 <b>Coins:</b> Main currency. Earn from battles & daily.\n"
                "• ✨ <b>Dust:</b> Used for upgrades & grade promotions.\n"
                "• 🎟 <b>Gacha Tickets:</b> Pull new characters from the altar.\n"
                "• 🔋 <b>Stamina:</b> Required for Auto-Grind (max 100).\n"
                "• 💎 <b>Shards:</b> Awaken characters (star upgrades).\n\n"
                "• 🛍 <b>Daily Shop:</b> Potions, CE Charge, Guard Stone, etc.\n"
                "• 🗓 <b>Weekly Shop:</b> Tickets, Revives, Black Flash Manual.\n"
                "• ✨ <b>Special Shop:</b> Energy Drinks, Gacha Packs, EXP Charms.\n\n"
                "• 💰 <b>Coin Cap:</b> 2,000 coins earned per day from battles.\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_en_main"}]]
        },
        "chars": {
            "title": "CHARACTER COMMANDS",
            "msg": (
                "• <code>/view &lt;name&gt;</code> — View any character's stats + moves\n\n"
                "• <code>/data &lt;name&gt;</code> — Full character data sheet with ownership\n\n"
                "• <code>/roster</code> — Your full collection & management\n\n"
                "• <code>/myteam</code> — Set your active 3-character squad\n\n"
                "• <code>/gacha</code> — Summon new sorcerers from the altar\n\n"
                "• <code>/upgrades</code> — Level up & apply item upgrades\n\n"
                "<i>Tip: Partial names work too — /view Gojo will match Gojo Satoru Full</i>"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_en_main"}]]
        },
        "admin": {
            "title": "ADMIN COMMANDS",
            "msg": (
                "<b>Staff-Only Commands:</b>\n\n"
                "• <code>/admin</code> — Open admin dashboard\n"
                "• <code>/admin user @name</code> — View user profile\n"
                "• <code>/admin add_coins @user 1000</code> — Add coins\n"
                "• <code>/admin add_gems @user 10</code> — Add gems\n"
                "• <code>/admin add_shards @user 50</code> — Add shards\n"
                "• <code>/admin give_item @user &lt;id&gt; &lt;qty&gt;</code> — Give item\n"
                "• <code>/admin give_char @user &lt;name&gt; &lt;lv&gt;</code> — Give character\n"
                "• <code>/admin maintenance on/off</code> — Toggle maintenance\n"
                "• <code>/reset</code> — Reset user (reply to message)\n"
                "• <code>/give_error</code> — Get error log dump\n"
                "• <code>/upload</code> — Upload image asset (reply to photo)\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_en_main"}]]
        },
        "cmds": {
            "title": "FULL COMMAND LIST",
            "msg": (
                "📋 <b>PROFILE & TEAM</b>\n"
                "• /start — Begin your journey / Open profile\n"
                "• /profile — View your sorcerer license\n"
                "• /roster — Manage all your spirits\n"
                "• /myteam — Set your active battle team\n"
                "• /inv — Check your items & charms\n"
                "• /school — Choose Tokyo or Kyoto High\n\n"

                "⚔️ <b>COMBAT</b>\n"
                "• /hunt — Explore for cursed spirits (DM)\n"
                "• /duel — Challenge someone (reply in group)\n"
                "• /ranked — Join ranked matchmaking\n"
                "• /bf — Black Flash minigame (+crit buff)\n\n"

                "🧬 <b>GROWTH</b>\n"
                "• /gacha — Summon new sorcerers\n"
                "• /upgrades — Level up & upgrade characters\n"
                "• /daily — Claim daily rewards & stamina\n"
                "• /quests — View & claim daily quests\n"
                "• /achievements — View your milestones\n\n"

                "🔍 <b>INFO</b>\n"
                "• /view &lt;name&gt; — Character stats + moves\n"
                "• /data &lt;name&gt; — Full character data sheet\n"
                "• /inspect — Detailed character dashboard\n\n"

                "🏰 <b>SOCIAL</b>\n"
                "• /clan — Clan hub\n"
                "• /tournament — Zenin tournament info\n\n"

                "🛍 <b>ECONOMY</b>\n"
                "• /shop — Visit the market\n\n"

                "🔧 <b>UTILITY</b>\n"
                "• /unstuck — Clear stuck sessions\n"
                "• /help — This help menu\n"
                "• /refer — Invite friends & earn rewards\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_en_main"}]]
        }
    },
    "hi": {
        "main": {
            "title": "जुजुत्सु गाइड",
            "msg": "Niche diye gaye buttons se guide chunein:",
            "kb": [
                [{"text": "⚔️ युद्ध",    "callback_data": "help_hi_combat"},
                 {"text": "🧬 प्रगति",   "callback_data": "help_hi_growth"}],
                [{"text": "🗺 शिकार",   "callback_data": "help_hi_explore"},
                 {"text": "🏰 स्कूल",   "callback_data": "help_hi_social"}],
                [{"text": "💰 बाजार",   "callback_data": "help_hi_economy"},
                 {"text": "📜 कमांड्स", "callback_data": "help_hi_cmds"}],
                [{"text": "🌐 भाषा बदलें", "callback_data": "cmd_help"}]
            ]
        },
        "combat": {
            "title": "युद्ध गाइड",
            "msg": (
                "• 👊 <b>Triangle:</b> Close > Barrier > Long > Close\n"
                "• ⚡ <b>Black Flash:</b> 2× Critical. Meter burst = 3×!\n"
                "• 🌬️ <b>Dodge:</b> 2 baar per character, +40 CE milta hai.\n"
                "• 🔄 <b>Switch:</b> Character badlein - turn consume hota hai.\n"
                "• 🏳️ <b>Surrender:</b> Bhag sakte hain lekin reward nahi.\n"
                "• 🩸 <b>Status:</b> Bleed/Poison har turn HP khaata hai.\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_hi_main"}]]
        },
        "growth": {
            "title": "प्रगति गाइड",
            "msg": (
                "• 🏮 <b>Grade Promotion:</b> Lv15, 30, 45, 60 pe promote karein.\n"
                "• ⭐ <b>Stars:</b> Shards use karo star badhaane ke liye.\n"
                "• 🔥 <b>Pity:</b> 100 pulls pe guaranteed Legendary.\n"
                "• 📈 <b>XP:</b> Battles se character aur player dono ka XP badhta hai.\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_hi_main"}]]
        },
        "explore": {
            "title": "शिकार गाइड",
            "msg": (
                "• 🏮 <b>Manual (/hunt):</b> 1,000 hunts/day, koi stamina nahi.\n"
                "• ⚙️ <b>Auto-Grind:</b> 50 Stamina de ke 10 rooms instant clear.\n"
                "• 🗺 <b>Biomes:</b> Lv1 (Common), Lv20 (Rare), Lv50 (Epic+)\n"
                "• 🔋 <b>Stamina:</b> /daily se milta hai ya Energy Drink se.\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_hi_main"}]]
        },
        "social": {
            "title": "स्कूल और क्लान",
            "msg": (
                "• 🏫 <b>Academy (/school):</b> Tokyo ya Kyoto chunein.\n"
                "• 🛡 <b>Clans (/clan):</b> Lv15 pe join, Lv20 pe create (5k coins).\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_hi_main"}]]
        },
        "economy": {
            "title": "बाजार गाइड",
            "msg": (
                "• 💰 <b>Coins:</b> Battles aur daily se milte hain.\n"
                "• ✨ <b>Dust:</b> Upgrades aur promotion ke liye.\n"
                "• 🎟 <b>Tickets:</b> Gacha pull ke liye use karein.\n"
                "• 💎 <b>Shards:</b> Star upgrade ke liye.\n"
                "• 🛍 <b>Shop:</b> Daily, Weekly, Special items.\n"
                "• 💰 <b>Coin Cap:</b> Din mein 2,000 coin battles se milte hain.\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_hi_main"}]]
        },
        "cmds": {
            "title": "कमांड लिस्ट",
            "msg": (
                "📋 <b>PROFILE & TEAM</b>\n"
                "• /start  /profile  /roster  /myteam  /inv  /school\n\n"
                "⚔️ <b>COMBAT</b>\n"
                "• /hunt  /duel  /ranked  /bf\n\n"
                "🧬 <b>GROWTH</b>\n"
                "• /gacha  /upgrades  /daily  /quests  /achievements\n\n"
                "🔍 <b>INFO</b>\n"
                "• /view &lt;name&gt;  /data &lt;name&gt;\n\n"
                "🏰 <b>SOCIAL</b>\n"
                "• /clan  /tournament\n\n"
                "🛍 <b>ECONOMY</b>\n"
                "• /shop\n\n"
                "🔧 <b>UTILITY</b>\n"
                "• /unstuck  /help\n"
            ),
            "kb": [[{"text": "⬅️ Back", "callback_data": "help_hi_main"}]]
        }
    }
}


@router.message(Command("help"))
@router.callback_query(F.data.startswith("cmd_help"))
async def handle_help(callback_or_message: types.CallbackQuery | types.Message):
    await render_help(callback_or_message, 'select')


@router.callback_query(F.data.startswith("help_"))
async def help_callback(callback: types.CallbackQuery):
    query = callback.data.replace("help_", "")
    await callback.answer()
    await render_help(callback, query)


async def render_help(callback_or_message, query):
    parts = query.split('_')
    if len(parts) < 2 or query == 'select':
        data = HELP_DATA['select']
    else:
        lang = parts[0]
        cat  = '_'.join(parts[1:])
        data = HELP_DATA.get(lang, {}).get(cat, HELP_DATA['select'])

    msg = ui.format_header(data['title']) + "\n\n" + data['msg']
    builder = InlineKeyboardBuilder()
    for row in data['kb']:
        builder.row(*[
            types.InlineKeyboardButton(text=btn['text'], callback_data=btn['callback_data'])
            for btn in row
        ])

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())




@router.message(Command("daily"))
@router.callback_query(F.data == "cmd_daily")
async def handle_daily(callback_or_message: types.CallbackQuery | types.Message):
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()
    res = await reward_service.claim_daily(callback_or_message.from_user.id)
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.message.answer(res['msg'], parse_mode='HTML')
    else:
        await callback_or_message.answer(res['msg'], parse_mode='HTML')

@router.message(Command("weekly"))
async def handle_weekly(message: types.Message):
    res = await reward_service.claim_weekly(message.from_user.id)
    await message.answer(res['msg'], parse_mode='HTML')

@router.message(Command("monthly"))
async def handle_monthly(message: types.Message):
    res = await reward_service.claim_monthly(message.from_user.id)
    await message.answer(res['msg'], parse_mode='HTML')


@router.message(Command("streak"))
async def handle_streak(message: types.Message, user: dict):
    await message.reply(
        f"🔥 <b>CURRENT STREAK:</b> {user.get('login_streak', 0)} Days",
        parse_mode='HTML'
    )


@router.message(Command("achievements"))
@router.callback_query(F.data.startswith("cmd_achievements"))
async def cmd_achievements(callback_or_message: types.CallbackQuery | types.Message, user: dict):
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()

    msg = (
        ui.format_header("ACHIEVEMENT SYSTEM", "GENERAL") + "\n\n"
        "<i>\"Your dedication is your greatest weapon.\"</i>\n\n"
        "Your current progress and milestones:\n\n"
    )

    stats = achievement_service.DATA
    user_achs = user.get('achievements', {})
    progress  = user_achs.get('progress', {})
    completed = user_achs.get('completed', [])

    for cat, items_list in stats.items():
        prog     = progress.get(cat.upper(), 0)
        cat_done = len([i for i in items_list if i['id'] in completed])
        msg += f"🔖 <b>{cat}:</b> [{cat_done}/{len(items_list)}]\n"
        msg += f"└ Progress: <code>{prog}</code>\n\n"

    msg += "<i>Achievements unlock automated rewards. Keep grinding!</i>"

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="🎖 EQUIP TITLE",   callback_data="menu_titles"))
    builder.row(types.InlineKeyboardButton(text="⬅️ BACK TO HUB", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())


@router.callback_query(F.data == "menu_titles")
async def handle_titles_menu(callback: types.CallbackQuery, user: dict):
    user_achs = user.get('achievements', {})
    completed = user_achs.get('completed', [])

    title_achs = []
    for cat in achievement_service.DATA.values():
        for ach in cat:
            if ach['reward'].get('title') and ach['id'] in completed:
                title_achs.append(ach)

    msg = (
        ui.format_header("SELECT TITLE", "GENERAL") + "\n\n"
        "You have earned these titles. Choose one to equip:\n\n"
    )
    if not title_achs:
        msg += "<i>No titles unlocked yet. Complete achievements to earn them!</i>"
    else:
        msg += f"Current Title: <b>{user.get('title', 'Wandering Soul')}</b>\n\n"

    builder = InlineKeyboardBuilder()
    for ach in title_achs:
        builder.row(types.InlineKeyboardButton(
            text=f"🎖 {ach['reward']['title']}",
            callback_data=f"equip_title_{ach['reward']['title']}"
        ))
    builder.row(types.InlineKeyboardButton(text="⬅️ BACK", callback_data="cmd_achievements"))

    await callback.answer()
    await media.smart_edit(callback.message, msg, reply_markup=builder.as_markup())


@router.callback_query(F.data.startswith("equip_title_"))
async def handle_equip_title(callback: types.CallbackQuery, user: dict):
    title = callback.data.replace("equip_title_", "")
    await db.users.update({"telegramId": callback.from_user.id}, {"$set": {"title": title}})
    await callback.answer(f"🎖 Title equipped: {title}!", show_alert=True)
    user['title'] = title
    await handle_achievements(callback, user)


@router.callback_query(F.data == "close_menu")
async def handle_close(callback: types.CallbackQuery):
    await callback.answer("Menu Closed.")
    await callback.message.delete()


@router.message(Command("refer", "referral"))
async def handle_refer(message: types.Message, user: dict):
    bot_info = await message.bot.get_me()
    ref_link = f"https://t.me/{bot_info.username}?start=ref_{message.from_user.id}"
    
    msg = (
        ui.format_header("REFERRAL PROGRAM") + "\n\n"
        "Invite other sorcerers to Jujutsu High and earn rewards!\n\n"
        "🔗 <b>Your Referral Link:</b>\n"
        f"<code>{ref_link}</code>\n"
        "<i>(Tap the link above to copy it)</i>\n\n"
        "<b>REWARDS:</b>\n"
        "• <b>Referrer:</b> 💰 5,000 Coins & 🎟 2 Gacha Tickets\n"
        "• <b>New Player:</b> 💰 500 Coins & 🎟 1 Gacha Ticket (Bonus)\n\n"
        "<i>\"Unity among sorcerers is the greatest deterrent to curses.\"</i>"
    )
    
    builder = InlineKeyboardBuilder()
    # share_url for Telegram
    share_text = f"🏮 Join me in the Jujutsu Kaisen RPG and start your journey as a sorcerer! Get a registration bonus using my link:"
    share_url = f"https://t.me/share/url?url={ref_link}&text={__import__('urllib.parse').parse.quote(share_text)}"
    
    builder.row(types.InlineKeyboardButton(text="📢 SHARE WITH FRIENDS", url=share_url))
    
    await message.reply(msg, parse_mode='HTML', reply_markup=builder.as_markup())
