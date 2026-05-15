from aiogram import Router, types, F
from aiogram.filters import Command
from aiogram.utils.keyboard import InlineKeyboardBuilder

from database import db
from utils import ui

router = Router()

SCHOOLS = {
    "tokyo": {
        "name": "Tokyo Jujutsu High",
        "emoji": "🏯",
        "desc": (
            "Elite sorcerers trained in the heart of Tokyo.\n"
            "Known for raw power and aggressive cursed techniques."
        ),
        "bonus": "+10% Attack, +5% Speed",
    },
    "kyoto": {
        "name": "Kyoto Jujutsu High",
        "emoji": "⛩️",
        "desc": (
            "Masters of precision and cursed energy control.\n"
            "Known for technique mastery and balanced combat."
        ),
        "bonus": "+10% CE Regen, +5% Defence",
    },
}

@router.message(Command("school"))
async def cmd_school(message: types.Message, user: dict):
    if not user:
        return await message.reply("Please /start first to register.")

    current = user.get('school')
    if current:
        info = SCHOOLS.get(current.lower().replace(" jujutsu high", "").strip(), {})
        name = info.get('name', current)
        emoji = info.get('emoji', '🏫')
        msg = (
            f"{emoji} <b>ACADEMY ENROLLMENT</b>\n\n"
            f"You are enrolled in <b>{name}</b>.\n\n"
            f"Want to transfer? Choose below:"
        )
    else:
        msg = (
            "🏫 <b>CHOOSE YOUR ACADEMY</b>\n\n"
            "Select your path — Tokyo or Kyoto High.\n"
            "Your school determines your training bonuses."
        )

    builder = InlineKeyboardBuilder()
    if current:
        builder.row(types.InlineKeyboardButton(text="🎖 Request Verification", callback_data="school_choose_verify_grade"))
        builder.row(
            types.InlineKeyboardButton(text="🏯 Tokyo High",  callback_data="school_choose_tokyo"),
            types.InlineKeyboardButton(text="⛩️ Kyoto High", callback_data="school_choose_kyoto"),
        )
    else:
        builder.row(
            types.InlineKeyboardButton(text="🏯 Tokyo High",  callback_data="school_choose_tokyo"),
            types.InlineKeyboardButton(text="⛩️ Kyoto High", callback_data="school_choose_kyoto"),
        )
    
    builder.row(types.InlineKeyboardButton(text="🏠 Return to Hub", callback_data="back_to_hub"))
    await message.reply(msg, parse_mode='HTML', reply_markup=builder.as_markup())


@router.callback_query(F.data.startswith("school_choose_"))
async def handle_school_choice(callback: types.CallbackQuery, user: dict):
    await callback.answer()
    if not user:
        return await callback.message.reply("Please /start first.")

    choice = callback.data.replace("school_choose_", "")
    if choice == "verify_grade":
        # Check if user is in a school
        if not user.get('school'):
            return await callback.answer("❌ You must join a school first!", show_alert=True)
        
        # We need to find which character to verify. For now, let's assume the first team member or open a roster selection.
        # To keep it simple as per user request for "all", we'll check if any team members can be verified.
        team_ids = user.get('teamIds', [])
        if not team_ids:
            return await callback.answer("❌ You have no active sorcerers in your team to verify.", show_alert=True)
        
        # Use the first team member as the primary target for verification in this menu
        target_id = team_ids[0]
        from services.upgrade_service import upgrade_service
        res = await upgrade_service.promote_grade(user['telegramId'], target_id)
        
        if not res['success']:
            return await callback.answer(res['msg'].replace("<b>", "").replace("</b>", ""), show_alert=True)
        
        return await callback.message.edit_text(
            f"🎖 <b>VERIFICATION SUCCESSFUL</b>\n\n"
            f"The Higher-Ups of {user.get('school')} have authorized the promotion!\n\n"
            f"{res['msg']}",
            parse_mode='HTML',
            reply_markup=InlineKeyboardBuilder().row(types.InlineKeyboardButton(text="🔙 Back", callback_data="back_to_hub")).as_markup()
        )

    if choice not in SCHOOLS:
        return await callback.answer("Invalid school.", show_alert=True)

    info   = SCHOOLS[choice]
    school_name = info['name']

    await db.users.update(
        {"telegramId": user['telegramId']},
        {"$set": {"school": school_name}}
    )

    msg = (
        f"{info['emoji']} <b>ENROLLMENT COMPLETE!</b>\n\n"
        f"Welcome to <b>{school_name}</b>!\n\n"
        f"📖 {info['desc']}\n\n"
        f"⚡ <b>Bonus:</b> {info['bonus']}\n\n"
        f"🎖 You can now request <b>Official Verification</b> for your sorcerers in this menu."
    )
    
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="🎖 Request Verification", callback_data="school_choose_verify_grade"))
    builder.row(types.InlineKeyboardButton(text="🏠 Return to Hub", callback_data="back_to_hub"))
    
    await callback.message.edit_text(msg, parse_mode='HTML', reply_markup=builder.as_markup())
