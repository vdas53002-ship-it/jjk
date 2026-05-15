import asyncio
import os
from aiogram import Router, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from database import db
from utils import ui, media
from utils.combat.visual import visual_engine
from services import gacha_service

router = Router()

class GachaStates(StatesGroup):
    in_altar = State()

async def render_menu(callback_or_message, user):
    msg = (
        ui.format_header("Summmoning Altar") + "\n\n"
        "<i>Draw the souls of legendary sorcerers into your service.</i>\n\n"
        f"🎫 <b>Tickets:</b> <code>{user.get('gachaTickets', 0)}</code>\n"
        f"🪙 <b>Coins:</b> <code>{user.get('coins', 0)}</code>\n"
        f"<b>Dust:</b> <code>{user.get('dust', 0)}</code>\n\n"
        f"<b>Pity:</b> <code>{user.get('pityCount', 0)}/100</code> (Guaranteed Legendary)\n\n"
        "<b>SUMMON OPTIONS:</b>\n"
        "• 1x Pull: 1 Ticket or 200 Coins\n"
        "• 10x Pull: 10 Tickets or 2000 Coins"
    )

    uid = f":uid_{user['telegramId']}"
    builder = InlineKeyboardBuilder()
    builder.row(
        types.InlineKeyboardButton(text="1x Summon", callback_data=f"pull_conf_1{uid}"),
        types.InlineKeyboardButton(text="10x Summon", callback_data=f"pull_conf_10{uid}")
    )
    builder.row(types.InlineKeyboardButton(text="Return to Hub", callback_data=f"back_to_hub{uid}"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.edit_banner(callback_or_message.message, "Altar", msg, reply_markup=builder.as_markup())
    else:
        await media.send_banner(callback_or_message.bot, callback_or_message.chat.id, "Altar", msg, reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("gacha_menu"))
@router.message(Command("gacha"))
async def enter_gacha(callback_or_message: types.CallbackQuery | types.Message, user: dict, state: FSMContext):
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()
    
    if not user:
        if isinstance(callback_or_message, types.CallbackQuery):
            await callback_or_message.answer("❌ Please /start first.", show_alert=True)
        else:
            await callback_or_message.reply("❌ Please /start first.")
        return

    await state.set_state(GachaStates.in_altar)
    await render_menu(callback_or_message, user)

@router.callback_query(F.data.regexp(r"pull_conf_(\d+)"))
async def confirm_pull(callback: types.CallbackQuery, user: dict):
    if not user:
        return await callback.answer("❌ Please /start first.", show_alert=True)
    # Strip :uid_ suffix if present before splitting
    clean_data = callback.data.split(":")[0]
    count = int(clean_data.split("_")[-1])
    cost_tickets = count
    cost_coins = count * 200

    has_tickets = user.get('gachaTickets', 0) >= cost_tickets
    has_coins = user.get('coins', 0) >= cost_coins

    if not has_tickets and not has_coins:
        return await callback.answer(f" Insufficient funds! You need {cost_tickets} Tickets or {cost_coins} Coins.", show_alert=True)

    msg = ui.format_header(f"CONFIRM {count}x SUMMON") + "\n\nSelect your payment method:"
    uid = f":uid_{user['telegramId']}"
    builder = InlineKeyboardBuilder()
    if has_tickets:
        builder.row(types.InlineKeyboardButton(text=f"Use {cost_tickets} Tickets", callback_data=f"pull_exec_{count}_ticket{uid}"))
    if has_coins:
        builder.row(types.InlineKeyboardButton(text=f" Use {cost_coins} Coins", callback_data=f"pull_exec_{count}_coin{uid}"))
    builder.row(types.InlineKeyboardButton(text="Cancel", callback_data=f"back_to_altar{uid}"))

    await media.smart_edit(callback.message, msg, reply_markup=builder.as_markup())

@router.callback_query(F.data.regexp(r"pull_exec_(\d+)_(.+)"))
async def execute_pull(callback: types.CallbackQuery, user: dict):
    if not user:
        return await callback.answer("❌ Please /start first.", show_alert=True)
    parts = callback.data.split("_")
    count = int(parts[2])
    method = parts[3]
    
    cost = count if method == 'ticket' else count * 200
    balance = user.get('gachaTickets', 0) if method == 'ticket' else user.get('coins', 0)

    if balance < cost:
        return await callback.answer(" Balance changed. Aborting.", show_alert=True)

    # Deduct
    update_field = "gachaTickets" if method == 'ticket' else "coins"
    await db.users.update({"telegramId": user['telegramId']}, {"$inc": {update_field: -cost}})
    
    # Update local user object for subsequent logic
    user[update_field] -= cost

    await callback.answer("The ritual begins...")

    # Animation (Video)
    video_path = os.path.join(os.getcwd(), 'gacha.mp4')
    anim_msg = None
    if os.path.exists(video_path):
        try:
            anim_msg = await callback.message.answer_video(
                video=types.FSInputFile(video_path),
                caption="<b>Invoking cursed souls...</b>",
                parse_mode='HTML'
            )
        except Exception as e:
            print(f"Gacha Animation Error: {e}")
    
    await asyncio.sleep(6)
    
    if anim_msg:
        try:
            await anim_msg.delete()
        except:
            pass

    if count == 1:
        result = await gacha_service.pull(user)
        char = result['character']
        
        # Sync DB (pity/dust already updated in user dict by pull function)
        await db.users.update({"telegramId": user['telegramId']}, {
            "$set": { 
                "pityCount": result['pityCount'],
                "dust": result['dustTotal'],
                "shards": user.get('shards', {})
            }
        })

        # Calculate final stats for display using the naya schema
        from services.user_service import user_service
        # Simulate a roster entry for the new character to calculate stats
        temp_entry = {
            "level": 1,
            "grade": "Grade 4",
            "rolled_stats": result.get('rolled_stats')
        }
        full_stats = user_service.calculate_final_stats(temp_entry, char)

        rarity_icons = {'Common':'⬜','Rare':'🟦','Epic':'🟪','Legendary':'🟨','Mythic':'🟥'}
        r_icon = rarity_icons.get(char.get('rarity','Common'), '⬜')
        pity_str = ' ✨ PITY!' if result['isPity'] else f" ({result['pityCount']}/100)"

        if result['isNew']:
            status = "🆕 <b>NEW SORCERER!</b> Added to your roster."
        elif result['dustEarned'] > 0:
            status = f"🔁 <b>Duplicate</b> → +{result['dustEarned']} ✨ Dust"
        else:
            status = "🔁 <b>Duplicate</b> → +1 Shard"

        res_msg = (
            f"🎴 <b>SUMMON RESULT</b>\n\n"
            f"{r_icon} <b>{char['name']}</b>\n"
            f"📊 Rarity: <b>{char.get('rarity','?')}</b>\n"
            f"🏮 Grade: <b>Grade 4</b>\n\n"
            f"👊 <b>STR:</b> <code>{full_stats['power']}</code> | ⚡ <b>SPD:</b> <code>{full_stats['speed']}</code>\n"
            f"🛡️ <b>DUR:</b> <code>{full_stats['stamina']}</code> | 🌀 <b>CE:</b> <code>{full_stats['ce_stat']}</code>\n"
            f"🏮 <b>TS:</b> <code>{full_stats['ts']}</code> | 💠 <b>TP:</b> <code>{full_stats['tp']}</code>\n\n"
            f"❤️ <b>HP:</b> <code>{full_stats['maxHp']}</code> | ✨ <b>CE Max:</b> <code>{full_stats['maxCe']}</code>\n\n"
            f"🔮 Pity{pity_str}\n"
            f"{status}"
        )

        uid = f":uid_{user['telegramId']}"
        builder = InlineKeyboardBuilder()
        builder.row(
            types.InlineKeyboardButton(text="🔄 Pull Again", callback_data=f"pull_conf_1{uid}"),
            types.InlineKeyboardButton(text="📋 My Sorcerers", callback_data=f"cmd_roster{uid}")
        )
        builder.row(types.InlineKeyboardButton(text="🔙 Altar", callback_data=f"back_to_altar{uid}"))

        try:
            await media.send_portrait(callback.bot, callback.message.chat.id, char, res_msg, reply_markup=builder.as_markup())
        except Exception:
            await callback.message.reply(res_msg, parse_mode='HTML', reply_markup=builder.as_markup())
    else:
        # 10x Pull
        bulk = await gacha_service.bulk_pull(user)
        
        # Grid visual
        buffer = await visual_engine.generate_gacha_grid(bulk['results'])
        
        res_msg = (
            ui.format_header("10x pull results") + "\n\n"
            f"<b>New Characters:</b> {bulk['newCount']}\n"
            f"<b>New Pity:</b> {bulk['pityCount']}/100"
        )
        if bulk['totalDust'] > 0:
            res_msg += f"\n<b>Dust Earned:</b> +{bulk['totalDust']}"

        uid = f":uid_{user['telegramId']}"
        builder = InlineKeyboardBuilder()
        builder.row(types.InlineKeyboardButton(text="10x Pull Again", callback_data=f"pull_conf_10{uid}"))
        builder.row(types.InlineKeyboardButton(text="Back to Altar", callback_data=f"back_to_altar{uid}"))

        if buffer:
            photo = types.BufferedInputFile(buffer, filename="gacha_results.jpg")
            await callback.message.answer_photo(photo, caption=res_msg, parse_mode='HTML', reply_markup=builder.as_markup())
        else:
            await media.smart_edit(callback.message, res_msg, reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("back_to_altar"))
async def back_to_altar(callback: types.CallbackQuery, user: dict):
    if not user:
        return await callback.answer("❌ Please /start first.", show_alert=True)
    await callback.answer()
    await render_menu(callback, user)
