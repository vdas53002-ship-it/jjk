import asyncio
import time
from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from database import db
from utils import ui
from utils.handlers import pvp

router = Router()

# Global state for pending challenges
# Key: "challengerId_targetId" or "duel_challengerId_targetId"
# Value: {"challengerId": int, "targetId": int, "chatId": int, "type": str, "timestamp": int}
pending_challenges = {}

# @router.message(Command("challenge"))
# async def handle_challenge(message: types.Message, user: dict):
#     args = message.text.split()
#     if len(args) < 2:
#         return await message.reply(" Usage: /challenge @username")
# 
#     target_username = args[1].replace('@', '')
#     
#     # Try to find target
#     target = await db.users.find_one({"username": {"$regex": f"^{target_username}$", "$options": "i"}})
#     
#     if not target:
#         return await message.reply(" That sorcerer could not be found. They must use /start to register first.")
#     
#     if target['telegramId'] == user['telegramId']:
#         return await message.reply(" You cannot challenge yourself!")
# 
#     if not user.get('teamIds') or len(user['teamIds']) < 3:
#         return await message.reply(" Your team must have 3 characters. Use /myscorer to set your lineup.")
# 
#     now = int(time.time())
#     if now - user.get('lastChallengeTime', 0) < 10:
#         return await message.reply("⏳ Please wait 10 seconds before sending another challenge.")
# 
#     key = f"{user['telegramId']}_{target['telegramId']}"
#     if key in pending_challenges:
#         return await message.reply(f"⏳ You already have a pending challenge to @{target['username']}.")
# 
#     pending_challenges[key] = {
#         "challengerId": user['telegramId'],
#         "targetId": target['telegramId'],
#         "type": "challenge",
#         "timestamp": now
#     }
#     
#     await db.users.update({"telegramId": user['telegramId']}, {"$set": {"lastChallengeTime": now}})
# 
#     builder = InlineKeyboardBuilder()
#     builder.row(types.InlineKeyboardButton(text="Cancel Challenge", callback_data=f"chal_cancel_{target['telegramId']}"))
#     
#     await message.reply(f"Challenge sent to @{target['username']}!\nWaiting for response (60s)...", parse_mode='HTML', reply_markup=builder.as_markup())
# 
#     # Send notification to target
#     inv_msg = ui.format_header("Challenge Recieved") + "\n\n" + \
#               f"@{user['username']} has challenged you to a private battle!\n" + \
#               "<i>Do you accept the clash?</i>"
#     
#     inv_builder = InlineKeyboardBuilder()
#     inv_builder.row(
#         types.InlineKeyboardButton(text=" Accept", callback_data=f"chal_accept_{user['telegramId']}"),
#         types.InlineKeyboardButton(text="Decline", callback_data=f"chal_decline_{user['telegramId']}")
#     )
# 
#     try:
#         await message.bot.send_message(target['telegramId'], inv_msg, parse_mode='HTML', reply_markup=inv_builder.as_markup())
#     except:
#         await message.reply(" Could not notify the opponent. They might have blocked the bot.")
#         if key in pending_challenges: del pending_challenges[key]
#         return
# 
#     # Auto-timeout after 60s
#     await asyncio.sleep(60)
#     if key in pending_challenges and pending_challenges[key]['timestamp'] == now:
#         del pending_challenges[key]
#         await message.reply(f"⏳ Challenge to @{target['username']} timed_out.")
#         try: await message.bot.send_message(target['telegramId'], f"⏳ Challenge from @{user['username']} expired.")
#         except: pass

@router.message(Command("duel"))
async def handle_duel(message: types.Message, user: dict):
    if not message.reply_to_message:
        return await message.reply(" Usage: /duel (Must be used as a reply in a group chat)")

    target_id = message.reply_to_message.from_user.id
    target = await db.users.find_one({"telegramId": target_id})

    if not target:
        return await message.reply(" That sorcerer could not be found. They must use /start to register in DMs first.")
    
    if target['telegramId'] == user['telegramId']:
        return await message.reply(" You cannot duel yourself!")

    if not user.get('teamIds') or len(user['teamIds']) < 3:
        return await message.reply(" Your team must have 3 deployed characters. Head to DMs and use /myscorer to set your lineup before challenging.")

    now = int(time.time())
    if now - user.get('lastChallengeTime', 0) < 10:
        return await message.reply("⏳ Please wait a moment before sending another duel request.")

    key = f"duel_{user['telegramId']}_{target['telegramId']}"
    if key in pending_challenges:
        return await message.reply(f"⏳ A duel request is already pending for @{target.get('username', 'this user')}.")

    pending_challenges[key] = {
        "challengerId": user['telegramId'],
        "targetId": target['telegramId'],
        "chatId": message.chat.id,
        "type": "duel",
        "timestamp": now
    }
    
    await db.users.update({"telegramId": user['telegramId']}, {"$set": {"lastChallengeTime": now}})

    inv_msg = ui.format_header("⚔️ DUEL REQUEST! ⚔️", "GC CLASH") + "\n\n" + \
              f"<b>{user['username']}</b> has challenged <b>{target.get('username', 'Target')}</b> to a live DUEL!\n\n" + \
              "<i>Will you step into the fray? You have 60 seconds.</i>"
    
    builder = InlineKeyboardBuilder()
    builder.row(
        types.InlineKeyboardButton(text="Accept", callback_data=f"chal_accept_{user['telegramId']}_duel"),
        types.InlineKeyboardButton(text="Decline", callback_data=f"chal_decline_{user['telegramId']}_duel")
    )

    await message.reply(inv_msg, parse_mode='HTML', reply_markup=builder.as_markup())

    # Timeout
    await asyncio.sleep(60)
    if key in pending_challenges and pending_challenges[key]['timestamp'] == now:
        del pending_challenges[key]
        await message.reply(f"⏳ Duel request to @{target.get('username', 'Target')} timed out.")

@router.callback_query(F.data.startswith("chal_accept_"))
async def handle_accept(callback: types.CallbackQuery, user: dict):
    parts = callback.data.split("_")
    challenger_id = int(parts[2])
    is_duel = "duel" in parts
    
    clicker_id = callback.from_user.id
    
    # Find key
    found_key = None
    if is_duel:
        found_key = f"duel_{challenger_id}_{clicker_id}"
    else:
        found_key = f"{challenger_id}_{clicker_id}"
    
    if found_key not in pending_challenges:
        return await callback.answer(" This challenge has expired or been canceled.", show_alert=True)

    chal = pending_challenges[found_key]
    if chal['targetId'] != clicker_id:
        return await callback.answer(" This request was not meant for you!", show_alert=True)

    del pending_challenges[found_key]

    challenger = await db.users.find_one({"telegramId": challenger_id})
    opponent = user # clicker

    if not opponent.get('teamIds') or len(opponent['teamIds']) < 3:
        await callback.answer(" You need 3 characters deployed to battle!", show_alert=True)
        return await callback.message.reply(f" @{opponent['username']} does not have a valid team. Please head to DMs and use /team.")

    await callback.answer(" Challenge Accepted! Prepare yourself.")

    if is_duel:
        await callback.message.delete()
        countdown = 15
        prep_msg_template = ui.format_header("⚔️ DOMAIN EXPANSION IMMINENT") + "\n\n" + \
                   "The clash between <b>{c}</b> and <b>{o}</b> begins in <b>{t}s</b>!\n\n" + \
                   "<b>ADVICE:</b> Head to the bot DMs now if you need to adjust your team!"
        
        msg = await callback.message.reply(prep_msg_template.format(c=challenger['username'], o=opponent['username'], t=countdown), parse_mode='HTML')

        while countdown > 0:
            await asyncio.sleep(5)
            countdown -= 5
            if countdown > 0:
                await msg.edit_text(prep_msg_template.format(c=challenger['username'], o=opponent['username'], t=countdown), parse_mode='HTML')
            else:
                await msg.delete()
                # Start actual battle
                return await pvp.start_pvp_battle(
                    {"userId": challenger['telegramId'], "username": challenger['username'], "is_casual": True},
                    {"userId": opponent['telegramId'], "username": opponent['username'], "is_casual": True},
                    'duel',
                    callback.bot,
                    callback.message.chat.id
                )
    else:
        await callback.message.edit_text(" Challenge Accepted! Spawning battle...")
        return await pvp.start_pvp_battle(
            {"userId": challenger['telegramId'], "username": challenger['username'], "is_casual": True},
            {"userId": opponent['telegramId'], "username": opponent['username'], "is_casual": True},
            'challenge',
            callback.bot
        )

@router.callback_query(F.data.startswith("chal_decline_"))
async def handle_decline(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    challenger_id = int(parts[2])
    is_duel = "duel" in parts
    
    clicker_id = callback.from_user.id
    found_key = f"duel_{challenger_id}_{clicker_id}" if is_duel else f"{challenger_id}_{clicker_id}"
    
    if found_key in pending_challenges:
        del pending_challenges[found_key]
        await callback.answer("Declined.")
        if is_duel:
            await callback.message.edit_text(f" <b>{callback.from_user.username}</b> declined the duel request.", parse_mode='HTML')
        else:
            try: await callback.bot.send_message(challenger_id, f" @{callback.from_user.username} declined your challenge.")
            except: pass
            await callback.message.edit_text("Challenge declined.")
    else:
        await callback.answer("Expired or canceled.", show_alert=True)

@router.callback_query(F.data.startswith("chal_cancel_"))
async def handle_cancel(callback: types.CallbackQuery):
    target_id = int(callback.data.replace("chal_cancel_", ""))
    challenger_id = callback.from_user.id
    key = f"{challenger_id}_{target_id}"

    if key in pending_challenges:
        del pending_challenges[key]
        try: await callback.bot.send_message(target_id, f" Challenge from @{callback.from_user.username} has been withdrawn.")
        except: pass
    
    await callback.answer("Challenge canceled.")
    await callback.message.edit_text(" Challenge withdrawn.")
