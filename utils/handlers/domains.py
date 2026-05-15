from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from utils import ui, media
from services.domain_service import domain_service

router = Router()

@router.message(Command("domains", "de"))
@router.callback_query(F.data == "cmd_domains")
async def show_domain_list(callback_or_message: types.CallbackQuery | types.Message, user: dict):
    if user.get('playerLevel', 1) < 40:
        msg = ui.format_header("DOMAIN MASTERY") + "\n\n⚠️ Your cursed energy is too weak. Domain Expansion unlocks at Level 40."
        if isinstance(callback_or_message, types.CallbackQuery):
            return await callback_or_message.answer(msg.replace('<b>', '').replace('</b>', ''), show_alert=True)
        return await callback_or_message.answer(msg, parse_mode='HTML')

    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()

    msg = ui.format_header("DOMAIN EXPANSION") + "\n\nSelect a sorcerer to view their potential Domain field:\n\n"
    builder = InlineKeyboardBuilder()
    team_ids = user.get('teamIds', [])
    for char_id in team_ids:
        builder.row(types.InlineKeyboardButton(text=f"🏮 {char_id}", callback_data=f"view_domain_{char_id}"))
    
    builder.row(types.InlineKeyboardButton(text="🔙 HUB", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("view_domain_"))
async def render_domain_detail(callback: types.CallbackQuery):
    char_id = callback.data.replace("view_domain_", "")
    domain = domain_service.get_domain(char_id)
    
    buff_str = ", ".join([f"{k.capitalize()}: {v}x" for k, v in domain['buff'].items()])
    msg = ui.format_header(domain['name']) + "\n\n" + \
          f"👤 <b>Sorcerer:</b> {char_id}\n" + \
          f"🌀 <b>Sure-Hit:</b> {domain['effect']}\n" + \
          f"📈 <b>Mastery Power:</b> {buff_str}\n\n" + \
          "<i>The domain is deployed when the CE gauge reaches 100%.</i>"
    
    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="🔙 Back", callback_data="cmd_domains"))
    
    await callback.answer()
    await media.smart_edit(callback.message, msg, reply_markup=builder.as_markup())
