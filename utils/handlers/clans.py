from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from database import db
from utils import ui, media
from services.clan_service import clan_service

router = Router()

@router.message(Command("clan", "syndicate"))
@router.callback_query(F.data == "cmd_clan")
@router.callback_query(F.data == "clan_home")
async def cmd_clan(callback_or_message: types.CallbackQuery | types.Message, user: dict):
    if not user.get('school'):
        msg = "🏯 <b>ACADEMY REQUIRED</b>\nYou must choose your path (Tokyo vs Kyoto) before joining a syndicate.\n\nUse /school to decide."
        if isinstance(callback_or_message, types.CallbackQuery):
            return await callback_or_message.answer(msg, show_alert=True)
        return await callback_or_message.answer(msg, parse_mode='HTML')

    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()

    if not user.get('clanId'):
        return await render_join_or_create(callback_or_message, user)
    return await render_clan_hub(callback_or_message, user)

async def render_join_or_create(callback_or_message, user):
    msg = ui.format_header("CLAN RECRUITMENT") + "\n\n" + \
          "You are not part of a syndicate. Join a clan to share resources and compete globally.\n\n" + \
          "🔓 <b>Min Level to Join:</b> 15\n" + \
          "🏗 <b>Min Level to Create:</b> 20 (Costs 5,000 G)"

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="🔍 Browse Clans", callback_data="browse_clans"))
    builder.row(types.InlineKeyboardButton(text="🏗 Create Syndicate (5k G)", callback_data="init_create_clan"))
    builder.row(types.InlineKeyboardButton(text="🔙 Return to Hub", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())

async def render_clan_hub(callback_or_message, user):
    clan = await db.clans.find_one({"_id": user['clanId']})
    if not clan:
        return await render_join_or_create(callback_or_message, user)

    msg = ui.format_header(f"SYNDICATE: {clan['name']}") + "\n\n" + \
          f"🏫 <b>Academy:</b> {clan['school']}\n" + \
          f"🏷 <b>Tag:</b> [{clan['tag']}]\n" + \
          f"👥 <b>Members:</b> {len(clan['members'])}/{clan.get('slots', 25)}\n" + \
          f"📈 <b>Power Score:</b> <code>{clan.get('totalElo', 0)}</code>\n" + \
          f"✨ <b>Treasury:</b> <code>{clan['treasury'].get('dust', 0)}</code> Dust\n\n" + \
          f"🏆 <b>Your Role:</b> {user.get('clanRole', 'Member')}\n"

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="💎 Contribute Dust", callback_data="contribute_dust"))
    builder.row(types.InlineKeyboardButton(text="🚪 Leave Syndicate", callback_data="leave_clan"))

    if user.get('clanRole') == 'Leader':
        builder.row(types.InlineKeyboardButton(text="🏗 Expand (+5 Slots, 5k G)", callback_data="expand_clan"))
        builder.row(types.InlineKeyboardButton(text="⚙️ Leader Panel", callback_data="leader_panel"))

    builder.row(types.InlineKeyboardButton(text="🔙 Return to Hub", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())

@router.callback_query(F.data == "init_create_clan")
async def handle_init_create(callback: types.CallbackQuery, user: dict):
    if user.get('playerLevel', 1) < 20:
        return await callback.answer("❌ Level 20 required to create!", show_alert=True)
    
    await callback.answer()
    await callback.message.reply("Please use the following format to create a clan:\n/create_clan NAME TAG\nExample: /create_clan 'Kyoto High' KYT")

@router.message(Command("create_clan"))
async def handle_create_clan(message: types.Message, user: dict):
    args = message.text.split(maxsplit=2)
    if len(args) < 3:
        return await message.reply("❌ <b>USAGE:</b> /create_clan [NAME] [TAG]\nExample: /create_clan 'Jujutsu High' JJH", parse_mode='HTML')
    
    name = args[1]
    tag = args[2][:4]
    
    result = await clan_service.create_clan(message.from_user.id, name, tag)
    if not result['success']:
        return await message.reply(f"❌ {result['msg']}")
    
    await message.reply(f"✅ {result['msg']}")
    user.update({"clanId": result['clan']['_id'], "clanRole": "Leader"})
    await render_clan_hub(message, user)

@router.callback_query(F.data == "browse_clans")
async def handle_browse_clans(callback: types.CallbackQuery, user: dict):
    clans = await db.clans.find({"school": user['school']})
    # Sort by totalElo desc in code or query
    clans.sort(key=lambda x: x.get('totalElo', 0), reverse=True)
    clans = clans[:10]
    
    if not clans:
        return await callback.answer("No clans found in your Academy.", show_alert=True)

    msg = ui.format_header(f"DISCOVER: {user['school'].upper()}") + "\n\n"
    builder = InlineKeyboardBuilder()
    for i, c in enumerate(clans):
        msg += f"<b>#{i+1} [{c['tag']}] {c['name']}</b>\n└ 👥 {len(c['members'])}/{c.get('slots', 25)} | 📈 {c.get('totalElo', 0)}\n\n"
        builder.row(types.InlineKeyboardButton(text=f"Join {c['tag']}", callback_data=f"join_clan_{c['_id']}"))

    builder.row(types.InlineKeyboardButton(text="⬅️ Back", callback_data="cmd_clan"))
    await callback.answer()
    await media.smart_edit(callback.message, msg, reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("join_clan_"))
async def handle_join_clan(callback: types.CallbackQuery, user: dict):
    clan_id = callback.data.replace("join_clan_", "")
    result = await clan_service.join_clan(callback.from_user.id, clan_id)
    
    if not result['success']:
        return await callback.answer(result['msg'], show_alert=True)
    
    await callback.answer(result['msg'], show_alert=True)
    user.update({"clanId": clan_id, "clanRole": "Member"})
    await render_clan_hub(callback, user)

@router.callback_query(F.data == "leave_clan")
async def handle_leave_clan(callback: types.CallbackQuery, user: dict):
    result = await clan_service.leave_clan(callback.from_user.id)
    if not result['success']:
        return await callback.answer(result['msg'], show_alert=True)
    
    await callback.answer(result['msg'], show_alert=True)
    user.update({"clanId": None, "clanRole": None})
    await render_join_or_create(callback, user)

@router.callback_query(F.data == "expand_clan")
async def handle_expand_clan(callback: types.CallbackQuery, user: dict):
    result = await clan_service.expand_clan(callback.from_user.id)
    await callback.answer(result['msg'], show_alert=not result['success'])
    if result['success']:
        await render_clan_hub(callback, user)
