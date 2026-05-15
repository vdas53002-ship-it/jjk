import asyncio
from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from database import db
from utils import ui, media
from services.admin_service import admin_service
from utils.data import characters

import os
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

router = Router()

class UploadStates(StatesGroup):
    waiting_for_filename = State()

@router.message(F.text.startswith("/upload"))
async def start_upload(message: types.Message, state: FSMContext):
    admin_id = message.from_user.id
    role = await admin_service.get_user_role(admin_id)
    if role < 3:
        return await message.reply("❌ Head Admin+ required for uploads.")
    
    # Check if replying to photo or doc
    reply = message.reply_to_message
    if not reply:
        return await message.reply("❌ Please reply to an image with /upload")
    
    file_id = None
    if reply.photo:
        file_id = reply.photo[-1].file_id
    elif reply.document:
        if reply.document.mime_type and reply.document.mime_type.startswith('image/'):
            file_id = reply.document.file_id
    
    if not file_id:
        return await message.reply("❌ No image found in that message.")

    # Check for "Save as" format
    # Format: /upload Save as 'Name'
    text = message.text
    if "Save as" in text and "'" in text:
        try:
            filename = text.split("'")[1].strip()
            if filename:
                return await finalize_upload(message, file_id, filename)
        except Exception:
            pass

    await state.update_data(file_id=file_id)
    await message.reply("📝 Send the filename to save as (e.g. <b>GojoSatoru</b>):", parse_mode='HTML')
    await state.set_state(UploadStates.waiting_for_filename)

async def finalize_upload(message, file_id, filename):
    filename = filename.replace(" ", "").replace("/", "").replace("\\", "")
    if not any(filename.lower().endswith(ext) for ext in ['.jpg', '.png', '.jpeg']):
        filename += ".jpg"
        
    if not os.path.exists("images"):
        os.makedirs("images")
    save_path = os.path.join("images", filename)
    
    try:
        file = await message.bot.get_file(file_id)
        await message.bot.download_file(file.file_path, save_path)
        await message.reply(f"✅ Image saved as <code>{filename}</code> in images folder.", parse_mode='HTML')
    except Exception as e:
        await message.reply(f"❌ Upload failed: {e}")
    return

@router.message(UploadStates.waiting_for_filename)
async def process_upload_filename(message: types.Message, state: FSMContext):
    admin_id = message.from_user.id
    role = await admin_service.get_user_role(admin_id)
    if role < 3:
        await state.clear()
        return await message.reply("❌ Unauthorized.")

    data = await state.get_data()
    file_id = data.get('file_id')
    filename = message.text.strip()
    
    if not filename:
        return await message.reply("❌ Invalid filename.")

    await finalize_upload(message, file_id, filename)
    await state.clear()

@router.message(Command("admin"))
async def handle_admin_command(message: types.Message):
    admin_id = message.from_user.id
    role = await admin_service.get_user_role(admin_id)
    if role == 0:
        logger = __import__('logging').getLogger(__name__)
        logger.warning(f"Unauthorized /admin attempt from {admin_id}")
        return await message.reply("❌ Unauthorized. You do not have permission to access the Overseer dashboard.")

    args = message.text.split()[1:]
    if not args:
        return await show_dashboard(message)

    sub = args[0].lower()
    
    try:
        if sub == 'user':
            target = await resolve_target(args[1] if len(args) > 1 else None)
            if not target: return await message.reply("❌ Sorcerer not found.")
            return await show_user_info(message, target['telegramId'])
            
        elif sub in ['add_coins', 'add_gems', 'add_shards', 'give_item', 'give_char']:
            if role < 3: return await message.reply("❌ Head Admin+ required.")
            target = await resolve_target(args[1] if len(args) > 1 else None)
            if not target: return await message.reply("❌ Target not found.")
            
            res = None
            if sub == 'add_coins': res = await admin_service.add_currency(admin_id, target['telegramId'], 'coins', int(args[2]))
            elif sub == 'add_gems': res = await admin_service.add_currency(admin_id, target['telegramId'], 'gems', int(args[2]))
            elif sub == 'add_shards': res = await admin_service.add_currency(admin_id, target['telegramId'], 'shardsCurrency', int(args[2]))
            elif sub == 'give_item': res = await admin_service.give_item(admin_id, target['telegramId'], args[2], int(args[3]))
            elif sub == 'give_char':
                char_name = " ".join(args[2:-1]) if len(args) > 3 and args[-1].isdigit() else " ".join(args[2:])
                level = int(args[-1]) if len(args) > 3 and args[-1].isdigit() else 1
                res = await admin_service.grant_character(admin_id, target['telegramId'], char_name, level)
            
            if res: await message.reply(res['msg'], parse_mode='HTML')

        elif sub == 'maintenance':
            if role < 3: return await message.reply("❌ Head Admin+ required.")
            state = args[1].lower() == 'on' if len(args) > 1 else False
            await db.settings.update({"key": 'maintenance'}, {"$set": {"value": state}}, upsert=True)
            await message.reply(f"🚧 Maintenance Mode: {'ENABLED' if state else 'DISABLED'}")

        elif sub == 'stats':
            await show_dashboard(message)
            
        else:
            await message.reply("❓ Unknown Command. Use /admin to see options.")

    except Exception as e:
        await message.reply(f"❌ System Error: {str(e)}")

async def resolve_target(input_val):
    if not input_val: return None
    if input_val.startswith('@'):
        return await db.users.find_one({"username": input_val.replace('@', '')})
    if input_val.isdigit():
        return await db.users.find_one({"telegramId": int(input_val)})
    return None

async def show_dashboard(callback_or_message):
    stats = await admin_service.get_system_stats()
    msg = ui.format_header("BOT OVERSEER", "GENERAL") + "\n\n" + \
          f"👤 <b>Users:</b> <code>{stats['users']}</code>\n" + \
          f"⚔️ <b>Active Battles:</b> <code>{stats['activeBattles']}</code>\n" + \
          f"🏰 <b>Total Clans:</b> <code>{stats['clans']}</code>\n\n" + \
          f"📊 <b>SYSTEM HEALTH</b>\n" + \
          f"└ Uptime: <code>{stats['uptime'] // 60}m</code>\n" + \
          f"└ Memory: <code>{stats['memory']}</code>\n" + \
          ui.divider() + "\n" + \
          f"<i>Quick Command:</i> <code>/admin user @name</code>"

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="💰 COINS", callback_data="adm_short_coins"), types.InlineKeyboardButton(text="⛩ CHARACTER", callback_data="adm_short_char"))
    builder.row(types.InlineKeyboardButton(text="💎 SHARDS", callback_data="adm_short_shards"), types.InlineKeyboardButton(text="🎟 TICKETS", callback_data="adm_short_tkts"))
    builder.row(types.InlineKeyboardButton(text="📢 BROADCAST", callback_data="adm_nav_broadcast"), types.InlineKeyboardButton(text="🌪 SEASON RESET", callback_data="adm_nav_season"))
    builder.row(types.InlineKeyboardButton(text="🔄 REFRESH", callback_data="adm_nav_stats"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await callback_or_message.reply(msg, parse_mode='HTML', reply_markup=builder.as_markup())

async def show_user_info(callback_or_message, user_id):
    user = await db.users.find_one({"telegramId": user_id})
    roster = await db.roster.find({"userId": user_id})
    
    msg = ui.format_header(f"👤 USER PROFILE: @{user['username']}") + "\n" + \
          f"ID: <code>{user['telegramId']}</code>\n" + \
          f"Role: <b>{'Staff' if user.get('adminRole') else 'Player'}</b>\n" + \
          f"Status: {'🚫 BANNED' if user.get('banned') else '✅ Active'}\n" + \
          ui.divider() + "\n" + \
          f"📊 <b>STATS</b>\n" + \
          f"Rank: {user.get('rank', 'Iron')} (ELO: {user.get('elo', 1000)})\n" + \
          f"Coins: 🪙 {user['coins']} | Gems: 💎 {user.get('gems', 0)}\n" + \
          f"Dust: ✨ {user.get('dust', 0)} | Tickets: 🎟 {user.get('gachaTickets', 0)}\n\n" + \
          f"⚠️ <b>Warnings:</b> {user.get('warnings', 0)}/3\n" + \
          f"📦 <b>Roster:</b> {len(roster)} characters"

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="⚠️ WARN", callback_data=f"adm_warn_{user_id}"), types.InlineKeyboardButton(text="🚫 BAN", callback_data=f"adm_ban_{user_id}"))
    builder.row(types.InlineKeyboardButton(text="🔄 RESET", callback_data=f"adm_reset_{user_id}"), types.InlineKeyboardButton(text="🔙 BACK", callback_data="adm_nav_stats"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await callback_or_message.reply(msg, parse_mode='HTML', reply_markup=builder.as_markup())

@router.callback_query(F.data == "adm_nav_stats")
async def adm_nav_stats_callback(callback: types.CallbackQuery):
    await callback.answer()
    await show_dashboard(callback)

@router.callback_query(F.data.startswith("adm_short_"))
async def handle_short_msg(callback: types.CallbackQuery):
    sub = callback.data.replace("adm_short_", "")
    msgs = {
        "coins": "💰 <b>GIVE COINS</b>\nUse: <code>/admin add_coins @user 1000</code>",
        "char": "⛩ <b>GIVE CHARACTER</b>\nUse: <code>/admin give_char @user Character Name 1</code>",
        "shards": "💎 <b>GIVE SHARDS</b>\nUse: <code>/admin add_shards @user 50</code>",
        "tkts": "🎟 <b>GIVE TICKETS</b>\nUse: <code>/admin give_item @user gacha_ticket 5</code>"
    }
    await callback.answer()
    await callback.message.reply(msgs.get(sub, "Unknown"), parse_mode='HTML')

@router.callback_query(F.data.startswith("adm_warn_"))
async def handle_admin_warn(callback: types.CallbackQuery):
    user_id = int(callback.data.replace("adm_warn_", ""))
    admin_id = callback.from_user.id
    res = await admin_service.warn_user(admin_id, user_id, "Admin Panel Warn")
    await callback.answer(res['msg'], show_alert=True)
    await show_user_info(callback, user_id)

@router.callback_query(F.data.startswith("adm_ban_"))
async def handle_admin_ban(callback: types.CallbackQuery):
    user_id = int(callback.data.replace("adm_ban_", ""))
    admin_id = callback.from_user.id
    res = await admin_service.ban_user(admin_id, user_id, "perm", "Admin Panel Ban")
    await callback.answer(res['msg'], show_alert=True)
    await show_user_info(callback, user_id)

@router.callback_query(F.data.startswith("adm_reset_"))
async def handle_admin_reset(callback: types.CallbackQuery):
    user_id = int(callback.data.replace("adm_reset_", ""))
    admin_id = callback.from_user.id
    res = await admin_service.reset_account(admin_id, user_id)
    await callback.answer(res['msg'], show_alert=True)
    await show_user_info(callback, user_id)

@router.callback_query(F.data == "adm_nav_season")
async def handle_season_reset(callback: types.CallbackQuery):
    admin_id = callback.from_user.id
    role = await admin_service.get_user_role(admin_id)
    if role < 4:
        return await callback.answer("❌ Owner only.", show_alert=True)
    
    res = await admin_service.execute_season_reset(admin_id)
    await callback.answer(res['msg'], show_alert=True)
