import os
import time
import random
from aiogram import Router, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.utils.keyboard import InlineKeyboardBuilder

from database import db
from utils import ui, media
from utils.data import characters
from services.explore_service import explore_service

router = Router()

def get_message(cob):
    """Get the actual Message object from either a CallbackQuery or Message."""
    return cob.message if isinstance(cob, types.CallbackQuery) else cob

def get_chat_id(cob):
    return get_message(cob).chat.id

def get_bot(cob):
    return get_message(cob).bot

async def safe_answer(cob, text, show_alert=False):
    """Answer a CallbackQuery or reply to a Message safely."""
    if isinstance(cob, types.CallbackQuery):
        await cob.answer(text, show_alert=show_alert)
    else:
        await cob.answer(text)

@router.callback_query(F.data.startswith("cmd_explore"))
@router.message(Command("hunt", "explore"))
async def handle_explore(callback_or_message: types.CallbackQuery | types.Message, user: dict):
    msg = get_message(callback_or_message)

    # Group: redirect to DM with auto-start of hunt
    if msg.chat.type in ("group", "supergroup") and isinstance(callback_or_message, types.Message):
        bot_info = await msg.bot.get_me()
        builder = InlineKeyboardBuilder()
        builder.row(types.InlineKeyboardButton(
            text="🏮 DM",
            url=f"https://t.me/{bot_info.username}?start=hunt"
        ))
        return await msg.reply(
            "⚠️ Use <b>/hunt</b> in the bot's DM to hunt for curses.",
            parse_mode='HTML', reply_markup=builder.as_markup()
        )

    if not user:
        return await msg.answer("Please /start first to register.")

    # Sync Daily Limits
    daily_reset = explore_service.check_daily_reset(user)
    if daily_reset:
        await db.users.update({"telegramId": user['telegramId']}, {"$set": daily_reset})
        user.update(daily_reset)

    active = user.get('activeExplore')
    if active and active.get('status') == 'found':
        # Auto-cancel previous stuck encounter so user always gets a new one
        await db.users.update({"telegramId": user['telegramId']}, {"$set": {"activeExplore": None}})
        user['activeExplore'] = None

    level = user.get('playerLevel', 1)
    tier = "TIER_1"
    if level >= 50: tier = "TIER_3"
    elif level >= 20: tier = "TIER_2"

    await start_new_explore(callback_or_message, user, tier)

async def start_new_explore(callback_or_message, user: dict, tier="TIER_1"):
    user_id = callback_or_message.from_user.id

    if not explore_service.acquire_lock(user_id):
        return await safe_answer(callback_or_message, "⏳ Expedition already starting...")

    try:
        biome = explore_service.BIOMES.get(tier, explore_service.BIOMES["TIER_1"])

        if user.get('playerLevel', 1) < biome['minLevel']:
            explore_service.release_lock(user_id)
            return await safe_answer(callback_or_message,
                f"Access Denied! Reach Level {biome['minLevel']} to enter.", show_alert=True)

        now = int(time.time() * 1000)
        if (user.get('dailyExploreCount', 0)) >= explore_service.CONSTANTS["DAILY_EXPLORE_LIMIT"]:
            explore_service.release_lock(user_id)
            return await safe_answer(callback_or_message, "Daily limit reached, come back tomorrow.", show_alert=True)


        await db.users.update({"telegramId": user['telegramId']}, {
            "$inc": {"dailyExploreCount": 1},
            "$set": {
                "lastExploreTime": now,
                "lastExploreActionAt": now,
                "activeExplore": {"biome": tier, "step": 1, "status": "started"}
            }
        })

        if isinstance(callback_or_message, types.CallbackQuery):
            await callback_or_message.answer("Entering Expedition...")

        res = await process_step(callback_or_message, user['telegramId'], 1, tier)
        explore_service.release_lock(user_id)
        return res

    except Exception as e:
        explore_service.release_lock(user_id)
        print(f"Explore Start Error: {e}")
        import traceback; traceback.print_exc()
        await safe_answer(callback_or_message, "❌ Error starting expedition.")

async def process_step(callback_or_message, user_id, step, biome_key):
    user = await db.users.find_one({"telegramId": user_id})
    force_boss = step >= explore_service.CONSTANTS["MAX_STEPS"]
    force_rarity = 'Epic' if force_boss and biome_key == 'TIER_3' else None
    encounter = await explore_service.roll_encounter(user_id, biome_key, force_rarity)
    char = encounter['character']

    # Scale wild level based on player level
    user_level = user.get('playerLevel', 1)
    wild_level = random.randint(max(1, user_level - 5), user_level + 2)
    
    wild_hp = char['hp'] + (wild_level * 15)
    wild_ce = char['ce'] + (wild_level * 5)

    await db.users.update({"telegramId": user_id}, {
        "$set": {
            "lastExploreActionAt": int(time.time() * 1000),
            "activeExplore": {
                "name": char['name'],
                "rarity": encounter['rarity'],
                "wildLevel": wild_level,
                "biome": biome_key,
                "step": step,
                "status": "found",
                "lastStepTime": int(time.time() * 1000)
            }
        }
    })

    caption = (
        ui.format_header("Elite Boss" if force_boss else "Hunt Encounter", "EXPLORE") + "\n\n"

        f"<b>While you were hunting {char['name'].upper()} appeared!</b>\n\n"
        f"      Grade: <b>{char.get('grade', 'Unrated')}</b>\n"
        f"      HP: <b>{wild_hp}</b> / CE: <b>{wild_ce}</b>\n\n"
        " <i>Initiate the clash?</i>"
    )

    uid = f":uid_{user_id}"
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="Battle Start", callback_data=f"exp_f:{wild_level}:{char['name']}{uid}"))
    builder.row(types.InlineKeyboardButton(text="Cancel", callback_data=f"exp_cancel_hunt{uid}"))

    # Send with enemy portrait image
    if isinstance(callback_or_message, types.CallbackQuery):
        return await media.edit_portrait(callback_or_message.message, char, caption, reply_markup=builder.as_markup())
    else:
        # For message (command), send portrait with image
        return await media.send_portrait(
            callback_or_message.bot,
            callback_or_message.chat.id,
            char,
            caption,
            reply_markup=builder.as_markup(),
            reply_to_message_id=callback_or_message.message_id
        )

@router.callback_query(F.data.startswith("exp_f:"))
async def handle_explore_battle(callback: types.CallbackQuery, state: FSMContext, user: dict):
    from utils.handlers.train import start_battle
    data = callback.data.split(':')
    char_name = data[2]
    await callback.answer("⚔️ Entering Combat...")
    await start_battle(callback, user, wild_target=char_name, level='normal', state=state)


@router.callback_query(F.data.startswith("exp_next"))
async def handle_next(callback: types.CallbackQuery, user: dict):
    await callback.answer()  # instant
    active = user.get('activeExplore')
    if not active:
        return
    return await process_step(callback, user['telegramId'], active['step'], active['biome'])

async def handle_resume(callback_or_message, user: dict):
    active = user.get('activeExplore')
    if not active:
        return await safe_answer(callback_or_message, "Encounter lost.")

    char = characters.DATA.get(active['name'])
    if not char:
        return await safe_answer(callback_or_message, "Encounter data lost. Hunt cancelled.")

    caption = (
        ui.format_header("CURSED DISCOVERY") + "\n\n"
        f" <b>Encounter:</b> {char['name']} (Waiting)\n"
        f" <b>Rarity:</b> {active['rarity']}\n\n"
        "Your discovery is still waiting. Don't let it escape!"
    )

    uid = f":uid_{user.get('telegramId', 0)}"
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="Battle Start", callback_data=f"exp_f:{active['wildLevel']}:{char['name']}{uid}"))
    builder.row(types.InlineKeyboardButton(text="Cancel", callback_data=f"exp_cancel_hunt{uid}"))

    if isinstance(callback_or_message, types.CallbackQuery):
        return await media.edit_portrait(callback_or_message.message, char, caption, reply_markup=builder.as_markup())
    return await media.send_portrait(
        callback_or_message.bot,
        callback_or_message.chat.id,
        char,
        caption,
        reply_markup=builder.as_markup(),
        reply_to_message_id=callback_or_message.message_id
    )

@router.callback_query(F.data == "exp_resume")
async def cb_resume(callback: types.CallbackQuery, user: dict):
    await callback.answer()
    return await handle_resume(callback, user)

@router.callback_query(F.data == "exp_cancel_hunt")
async def handle_cancel(callback: types.CallbackQuery, user: dict):
    await callback.answer()  # instant
    await db.users.update({"telegramId": user['telegramId']}, {"$set": {"activeExplore": None}})
    await callback.message.reply("🕊 <b>Expedition Abandoned.</b>\nThe spirit fades back into the shadows.", parse_mode='HTML')

@router.callback_query(F.data == "menu_auto_grind")
async def show_auto_menu(callback: types.CallbackQuery, user: dict):
    msg = (
        ui.format_header("Automated Grinding", "EXPLORE") + "\n\n"
        " <b>Auto-system: Active</b>\n\n"
        "The Higher-Ups have approved automated scouting missions.\n\n"
        "⚠️ <b>WARNING:</b>\n"
        "• Cost: 🔋 50 Stamina\n\n"
        "Select area:"
    )
    uid = f":uid_{user['telegramId']}"
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="🏮 OUTSKIRTS", callback_data=f"exp_auto_TIER_1{uid}"))
    builder.row(types.InlineKeyboardButton(text="🏚️ DISTRICT", callback_data=f"exp_auto_TIER_2{uid}"))
    builder.row(types.InlineKeyboardButton(text="🏯 TERRITORY", callback_data=f"exp_auto_TIER_3{uid}"))
    builder.row(types.InlineKeyboardButton(text="Back", callback_data=f"cmd_explore{uid}"))
    await media.edit_banner(callback.message, "Academy", msg, reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("exp_auto_"))
async def execute_auto(callback: types.CallbackQuery, user: dict):
    tier = callback.data.replace("exp_auto_", "")
    res = await explore_service.run_auto_grind(user, tier)

    if not res['success']:
        return await callback.answer(res['msg'], show_alert=True)

    await db.users.update({"telegramId": user['telegramId']}, {
        "$inc": {
            "coins": res['coins'],
            "dust": res['dust'],
            "playerXp": res['xp'],
            "shardsCurrency": res['shards'],
            "stamina": -res['staminaUsed']
        }
    })

    msg = (
        ui.format_header("AUTO-GRIND COMPLETE", "EXPLORE") + "\n\n"
        f"<b>Coins:</b> +{res['coins']}\n"
        f"<b>Dust:</b> +{res['dust']}\n"
        f"<b>XP:</b> +{res['xp']}\n"
    )
    uid = f":uid_{user['telegramId']}"
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="Again", callback_data=f"exp_auto_{tier}{uid}"))
    builder.row(types.InlineKeyboardButton(text="Back to hub", callback_data=f"back_to_hub{uid}"))

    await callback.answer()
    return await media.edit_banner(callback.message, tier, msg, reply_markup=builder.as_markup())