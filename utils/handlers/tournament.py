from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from utils import ui
from services.tournament_service import tournament_service

router = Router()

@router.message(Command("tournament", "tourney"))
@router.callback_query(F.data == "cmd_tournament")
async def handle_tournament(callback_or_message: types.CallbackQuery | types.Message):
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()

    stats = tournament_service.get_status()
    
    msg = ui.format_header("ZENIN TOURNAMENT") + "\n\n" + \
          f"🏆 <b>Current Status:</b> {stats['status'].upper()}\n" + \
          f"👥 <b>Participants:</b> {stats['count']}\n\n"

    builder = InlineKeyboardBuilder()

    if stats['status'] == 'open':
        msg += "Registration is currently OPEN! The bracket will be generated once enough sorcerers sign up."
        builder.row(types.InlineKeyboardButton(text="📝 Sign Up", callback_data="tourney_reg"))
    elif stats['status'] == 'active':
        msg += "The tournament is in progress! Watch the brackets unfold in our global channel."
    else:
        msg += "Today's tournament has concluded. Return tomorrow to claim your spot in the Hall of Fame!"

    builder.row(types.InlineKeyboardButton(text="🔙 BACK", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.message.edit_text(msg, parse_mode='HTML', reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())

@router.callback_query(F.data == "tourney_reg")
async def handle_registration(callback: types.CallbackQuery):
    result = await tournament_service.register_user(callback.from_user.id, callback.from_user.username or callback.from_user.first_name)
    await callback.answer(result['msg'], show_alert=not result['success'])
    if result['success']:
        msg = ui.format_header("ZENIN TOURNAMENT") + "\n\n✅ You are registered! Prepare your team for the 12:00 UTC brackets."
        await callback.message.edit_text(msg, parse_mode='HTML', reply_markup=None)
