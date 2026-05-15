from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from utils import ui

router = Router()

@router.message(Command("competition", "comp"))
@router.callback_query(F.data == "cmd_competition")
async def show_competition_hub(callback_or_message: types.CallbackQuery | types.Message):
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()

    msg = ui.format_header("COMPETITION HUB") + "\n\n" + \
          "Participate in global events to earn unique rewards and titles.\n\n" + \
          "🏆 <b>Ranked Season:</b> 25 Days Remaining\n" + \
          "🌪 <b>Vessel Clash:</b> Not Active\n" + \
          "🏯 <b>Syndicate War:</b> Starts in 4h 12m"

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="⚔️ ENTER RANKED", callback_data="cmd_matchmaking"))
    builder.row(types.InlineKeyboardButton(text="🔙 BACK TO HUB", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.message.edit_text(msg, parse_mode='HTML', reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())
