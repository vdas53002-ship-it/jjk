from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from database import db
from utils import ui, media
from utils.data import items
from services.upgrade_service import upgrade_service

router = Router()

async def render_upgrade_list(callback_or_message, user_id, page=0):
    roster = await db.roster.find({"userId": user_id})
    if not roster:
        msg = "❌ You have no characters to upgrade."
        if isinstance(callback_or_message, types.CallbackQuery):
            return await callback_or_message.answer(msg, show_alert=True)
        return await callback_or_message.answer(msg)

    msg = ui.format_header("🔧 UPGRADE – SELECT CHARACTER") + "\n\n" + \
          "Select a sorcerer to enhance their fundamental capabilities.\n\n"

    page_size = 5
    total_pages = (len(roster) + page_size - 1) // page_size
    start = page * page_size
    visible = roster[start:start+page_size]

    builder = InlineKeyboardBuilder()
    for i, c in enumerate(visible):
        upg_count = sum(c.get('upgrades', {}).values())
        msg += f"{start + i + 1}. <b>{c['charId']}</b> (Lv{c.get('level', 1)}) — Slots: {upg_count}/6\n"
        builder.row(types.InlineKeyboardButton(text=f"🔧 Upgrade {c['charId']}", callback_data=f"upg_sel_char_{c['_id']}"))

    nav_row = []
    if page > 0:
        nav_row.append(types.InlineKeyboardButton(text="⬅️", callback_data=f"upg_page_{page-1}"))
    if start + page_size < len(roster):
        nav_row.append(types.InlineKeyboardButton(text="➡️", callback_data=f"upg_page_{page+1}"))
    if nav_row: builder.row(*nav_row)
    
    builder.row(types.InlineKeyboardButton(text="🔙 Return to Hub", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await media.send_banner(callback_or_message.bot, callback_or_message.chat.id, "Academy", msg, reply_markup=builder.as_markup())

@router.message(Command("upgrades", "upgrade"))
@router.callback_query(F.data == "cmd_upgrades")
async def cmd_upgrades(callback_or_message: types.CallbackQuery | types.Message):
    user_id = callback_or_message.from_user.id
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()
    await render_upgrade_list(callback_or_message, user_id, 0)

@router.callback_query(F.data.startswith("upg_page_"))
async def upg_page(callback: types.CallbackQuery):
    page = int(callback.data.split("_")[-1])
    await callback.answer()
    await render_upgrade_list(callback, callback.from_user.id, page)

@router.callback_query(F.data.startswith("upg_sel_char_"))
async def upg_sel_char(callback: types.CallbackQuery):
    roster_id = callback.data.split("_")[-1]
    char = await db.roster.find_one({"_id": roster_id})
    user = await db.users.find_one({"telegramId": callback.from_user.id})
    
    if not char: return await callback.answer("Character not found.")

    from services.user_service import user_service
    from utils.data import characters
    char_full = user_service.calculate_final_stats(char, characters.DATA.get(char['charId']))
    
    upg_count = sum(char.get('upgrades', {}).values())
    shards = user.get('shards', {}).get(char['charId'], 0)
    
    msg = ui.format_header(f"UPGRADE: {char['charId']}") + "\n\n" + \
          f"🎭 <b>Grade:</b> {char_full.get('grade', 'Grade 4')}\n" + \
          f"📈 <b>Level:</b> {char_full.get('level', 1)}\n" + \
          f"💎 <b>TP:</b> <code>{char_full.get('tp', 0)}</code>\n" + \
          f"📊 <b>TS:</b> <code>{char_full.get('ts', 0)}</code>\n" + \
          f"🎴 <b>Shards:</b> <code>{shards}</code>\n" + \
          f"⚙️ <b>Slots:</b> {upg_count}/6\n\n" + \
          "Choose an enhancement path:\n"

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="✨ LEVEL UP (Dust/Coins)", callback_data=f"upg_lvl_exec_{roster_id}"))
    builder.row(types.InlineKeyboardButton(text="🎖 PROMOTE GRADE (Merge Cards)", callback_data=f"upg_grade_exec_{roster_id}"))
    
    # Show applicable inventory items (simplified)
    for inv_item in user.get('inventory', []):
        item_data = items.ITEMS.get(inv_item['id'])
        if item_data and item_data.get('shop'):
            builder.row(types.InlineKeyboardButton(text=f"{item_data.get('icon', '📦')} {item_data['name']} (x{inv_item['qty']})", callback_data=f"upg_item_{roster_id}_{inv_item['id']}"))

    builder.row(types.InlineKeyboardButton(text="⬅️ Back to Roster", callback_data="cmd_upgrades"))
    await callback.answer()
    await media.smart_edit(callback.message, msg, reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("upg_lvl_exec_"))
async def upg_lvl_exec(callback: types.CallbackQuery):
    roster_id = callback.data.split("_")[-1]
    res = await upgrade_service.level_up_character(callback.from_user.id, roster_id)
    
    if not res['success']:
        return await callback.answer(res['msg'], show_alert=True)
    
    await callback.answer("✨ Level Up Successful!")
    await callback.message.reply(res['msg'], parse_mode='HTML')
    # Refresh view
    await upg_sel_char(callback)

@router.callback_query(F.data.startswith("upg_grade_exec_"))
async def upg_grade_exec(callback: types.CallbackQuery):
    roster_id = callback.data.split("_")[-1]
    res = await upgrade_service.promote_grade(callback.from_user.id, roster_id)
    
    if not res['success']:
        return await callback.answer(res['msg'], show_alert=True)
    
    await callback.answer("🎖 Grade Promotion Successful!")
    await callback.message.reply(res['msg'], parse_mode='HTML')
    # Refresh view
    await upg_sel_char(callback)

@router.callback_query(F.data.startswith("upg_item_"))
async def upg_item_exec(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    roster_id = parts[2]
    item_id = "_".join(parts[3:])
    
    res = await upgrade_service.apply_item_upgrade(callback.from_user.id, roster_id, item_id)
    if not res['success']:
        return await callback.answer(res['msg'], show_alert=True)
    
    await callback.answer(f"✅ {res['msg']}", show_alert=True)
    await upg_sel_char(callback)
