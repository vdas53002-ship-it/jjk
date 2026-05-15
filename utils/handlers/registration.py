import random
from aiogram import Router, types, F
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.utils.keyboard import InlineKeyboardBuilder
from datetime import datetime

from database import db
from utils import ui, media
from utils.data import characters

class RegistrationStates(StatesGroup):
    choosing_gender = State()
    choosing_starter = State()

router = Router()

@router.message(F.text == "/register")
async def start_registration(message: types.Message, state: FSMContext):
    user = await db.users.find_one({"telegramId": message.from_user.id})
    if user:
        return await message.reply("🏮 <b>ALREADY REGISTERED</b>\nYour soul is already recorded in the archives. Use /hub to continue.", parse_mode='HTML')
    welcome = (
        ui.format_header("ACADEMY REGISTRATION") + "\n\n"
        "🏮 Welcome to Jujutsu High!\n\n"
        "Your cursed energy signature is being recorded. First, identify your soul's physical vessel:"
    )

    builder = InlineKeyboardBuilder()
    builder.row(
        types.InlineKeyboardButton(text="♂️ Male", callback_data="reg_gen_Male"),
        types.InlineKeyboardButton(text="♀️ Female", callback_data="reg_gen_Female")
    )
    builder.row(types.InlineKeyboardButton(text="✨ Other", callback_data="reg_gen_Other"))

    await message.reply(welcome, parse_mode='HTML', reply_markup=builder.as_markup())
    await state.set_state(RegistrationStates.choosing_gender)

@router.callback_query(RegistrationStates.choosing_gender, F.data.startswith("reg_gen_"))
async def process_gender(callback: types.CallbackQuery, state: FSMContext):
    gender = callback.data.split("_")[-1]
    await state.update_data(gender=gender)
    await callback.answer(f"Identified: {gender}")

    starter_msg = (
        ui.format_header("STARTER SELECTION") + "\n\n"
        "<i>Your vessel is chosen. Now, select your lead sorcerer to begin your journey:</i>\n\n"
        "👊 Yuji Itadori (Close-range)\nBalanced damage and high resilience.\n\n"
        "🔨 Nobara Kugisaki (Long-range)\nHigh output but fragile.\n\n"
        "🐺 Megumi Fushiguro (Barrier)\nStrategic defense and domain potential."
    )

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="👊 Yuji Itadori", callback_data="reg_start_Yuji Itadori"))
    builder.row(types.InlineKeyboardButton(text="🔨 Nobara Kugisaki", callback_data="reg_start_Nobara Kugisaki"))
    builder.row(types.InlineKeyboardButton(text="🐺 Megumi Fushiguro", callback_data="reg_start_Megumi Fushiguro"))

    await media.smart_edit(callback.message, starter_msg, reply_markup=builder.as_markup())
    await state.set_state(RegistrationStates.choosing_starter)

@router.callback_query(RegistrationStates.choosing_starter, F.data.startswith("reg_start_"))
async def process_starter(callback: types.CallbackQuery, state: FSMContext):
    starter_name = callback.data.replace("reg_start_", "")
    data = await state.get_data()
    gender = data.get('gender', 'Other')
    user_id = callback.from_user.id

    # Pick 5 random commons
    common_pool = [name for name, info in characters.DATA.items() if info.get('rarity') == 'Common']
    random_commons = random.sample(common_pool, min(5, len(common_pool)))
    all_starter_ids = [starter_name] + random_commons

    new_user = {
        "telegramId": user_id,
        "username": callback.from_user.username or callback.from_user.first_name or f"User_{user_id}",
        "vessel": gender,
        "rank": 'Iron',
        "elo": 1000,
        "playerLevel": 1,
        "playerXp": 0,
        "coins": 1000,
        "dust": 50,
        "gachaTickets": 6,
        "inventory": [
            {"id": 'minor_hp_potion', "qty": 5},
            {"id": 'ce_charge', "qty": 5}
        ],
        "teamIds": all_starter_ids[:3],
        "registrationDate": datetime.now(),
        "firstBattleComplete": False,
        "battles": 0,
        "friends": []
    }

    await db.users.insert(new_user)
    
    # Referral Logic
    ref_id = data.get('referrer_id')
    ref_bonus_msg = ""
    if ref_id:
        referrer = await db.users.find_one({"telegramId": ref_id})
        if referrer:
            # Reward Referrer: 5000 coins, 2 tickets
            await db.users.update({"telegramId": ref_id}, {
                "$inc": {"coins": 5000, "gachaTickets": 2}
            })
            # Reward New User: 500 coins, 1 ticket
            await db.users.update({"telegramId": user_id}, {
                "$inc": {"coins": 500, "gachaTickets": 1}
            })
            ref_bonus_msg = "\n🎁 <b>Referral Bonus:</b> +500 Coins & +1 Gacha Ticket!"
            try:
                await callback.bot.send_message(
                    ref_id, 
                    f"🎊 <b>Referral Success!</b>\n@{new_user['username']} has joined. You've been rewarded with 5,000 Coins and 2 Gacha Tickets!",
                    parse_mode='HTML'
                )
            except: pass

    # Roster population
    for char_id in all_starter_ids:
        char_info = characters.DATA.get(char_id, {"rarity": "Common"})
        
        # Roll base stats using the new schema
        base_ranges = char_info.get('base_stats', {
            'TS': [50, 60], 'STR': [3, 5], 'SPD': [3, 5], 'DUR': [3, 5], 'CE': [3, 5]
        })
        rolled_stats = {
            'TS': random.randint(base_ranges['TS'][0], base_ranges['TS'][1]),
            'STR': random.randint(base_ranges['STR'][0], base_ranges['STR'][1]),
            'SPD': random.randint(base_ranges['SPD'][0], base_ranges['SPD'][1]),
            'DUR': random.randint(base_ranges['DUR'][0], base_ranges['DUR'][1]),
            'CE': random.randint(base_ranges['CE'][0], base_ranges['CE'][1])
        }

        await db.roster.insert({
            "userId": user_id,
            "charId": char_id,
            "level": 1,
            "xp": 0,
            "grade": "Grade 4",
            "rarity": char_info.get('rarity'),
            "rolled_stats": rolled_stats,
            "upgrades": {},
            "lastUpdated": datetime.now()
        })

    await callback.answer("Starter Pack Assigned!")

    final_msg = (
        ui.format_header("LICENSE GRANTED") + "\n\n"
        f"🌈 Squad Manifestation Complete!\n\n"
        f"You've been assigned 1 lead and 5 additional sorcerers to your archives.\n\n"
        f"📦 Starter Pack:\n"
        f"💰 1,000 Coins & 50 Dust\n"
        f"🎟 6 Gacha Tickets\n"
        f"🧪 5 Potions & 5 CE Charges\n"
        f"{ref_bonus_msg}\n\n"
        f"Use /profile to view your team or /hunt to start grinding energy!"
    )

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="📂 Open Profile", callback_data="cmd_profile_init"))

    # Assuming send_portrait is implemented to handle bot and chat_id
    await media.send_portrait(callback.bot, callback.message.chat.id, {"name": starter_name}, final_msg, reply_markup=builder.as_markup())
    
    await state.clear()
