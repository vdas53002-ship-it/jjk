import asyncio
import time
from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from database import db
from utils import ui, media

router = Router()

@router.message(Command("bf", "blackflash"))
@router.callback_query(F.data == "cmd_minigame")
async def start_black_flash(callback_or_message: types.CallbackQuery | types.Message, user: dict):
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()

    now = int(time.time() * 1000)
    last_attempt = user.get('lastBFTime', 0)
    diff = (now - last_attempt) // 1000
    
    if diff < 60:
        msg = f"⏳ Your cursed energy is still recovering. Try again in {60 - diff}s."
        if isinstance(callback_or_message, types.CallbackQuery):
            return await callback_or_message.answer(msg, show_alert=True)
        return await callback_or_message.answer(msg)

    if user.get('blackflash_buff') and user.get('blackflash_expiry', 0) > now:
        msg = "⚡ You already have a Black Flash buff waiting! Use it in your next battle."
        if isinstance(callback_or_message, types.CallbackQuery):
            return await callback_or_message.answer(msg, show_alert=True)
        return await callback_or_message.answer(msg)

    msg = ui.format_header("⚡ BLACK FLASH CHALLENGE ⚡") + "\n\n" + \
          "Focus your cursed energy... Within 0.000001 seconds of impact, a spark becomes a flame.\n\n" + \
          "📌 <b>Goal:</b> Tap the button the exact moment it turns BLACK!\n\n" + \
          "Tap the button below when you are ready to focus."

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="✨ I AM READY", callback_data="bf_ready"))
    builder.row(types.InlineKeyboardButton(text="🔙 BACK", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.smart_edit(callback_or_message.message, msg, reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())

@router.callback_query(F.data == "bf_ready")
async def handle_bf_ready(callback: types.CallbackQuery):
    await callback.answer()
    
    countdown = ["⚡ 3...", "⚡ 2...", "⚡ 1...", "⚡ <b>NOW!</b>"]
    
    for i, text in enumerate(countdown):
        is_last = i == len(countdown) - 1
        msg = ui.format_header("⚡ FOCUS... ⚡") + "\n\n" + text
        
        builder = InlineKeyboardBuilder()
        if is_last:
            builder.row(types.InlineKeyboardButton(text="🔴 TAP NOW 🔴", callback_data=f"bf_tap_{int(time.time() * 1000)}"))
        else:
            builder.row(types.InlineKeyboardButton(text="⚪ FOCUSING...", callback_data="bf_too_early"))
        
        try:
            await media.smart_edit(callback.message, msg, reply_markup=builder.as_markup())
        except:
            pass
        
        if not is_last:
            await asyncio.sleep(1)

@router.callback_query(F.data == "bf_too_early")
async def handle_bf_too_early(callback: types.CallbackQuery):
    await callback.answer("⏳ Wait for the signal!", show_alert=True)

@router.callback_query(F.data.startswith("bf_tap_"))
async def handle_bf_tap(callback: types.CallbackQuery):
    tap_time = int(time.time() * 1000)
    signal_time = int(callback.data.split("_")[-1])
    diff = tap_time - signal_time
    
    # Window: 100ms to 800ms
    if 100 <= diff <= 800:
        expiry = tap_time + (60 * 60 * 1000)
        await db.users.update({"telegramId": callback.from_user.id}, {
            "$set": {
                "blackflash_buff": True,
                "blackflash_expiry": expiry,
                "lastBFTime": tap_time
            }
        })

        msg = ui.format_header("✨ BLACK FLASH! ✨") + "\n\n" + \
              f"Fantastic! Your reaction was <code>{diff}ms</code>.\n\n" + \
              "Your cursed energy has surged! You gain <b>+5% Critical Hit chance</b> for your next battle.\n" + \
              "(Expires in 1 hour or after 1 battle)"
        
        builder = InlineKeyboardBuilder()
        builder.row(types.InlineKeyboardButton(text="⚔️ Battle Now", callback_data="cmd_explore"))
        builder.row(types.InlineKeyboardButton(text="🔙 Return", callback_data="back_to_hub"))
        
        await callback.answer("✨ BLACK FLASH!", show_alert=True)
        await media.smart_edit(callback.message, msg, reply_markup=builder.as_markup())
    else:
        await db.users.update({"telegramId": callback.from_user.id}, {"$set": {"lastBFTime": tap_time}})
        
        fail_msg = ui.format_header("❌ TOO SLOW...") + "\n\n" + \
                   f"Your reaction was <code>{diff}ms</code>. The spark failed to manifest.\n\n" + \
                   "Try again in 60 seconds once your energy stabilizes."
            
        builder = InlineKeyboardBuilder()
        builder.row(types.InlineKeyboardButton(text="🔙 Return", callback_data="back_to_hub"))
        
        await callback.answer("❌ Failed", show_alert=True)
        await media.smart_edit(callback.message, fail_msg, reply_markup=builder.as_markup())
