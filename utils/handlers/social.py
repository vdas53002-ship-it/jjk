from aiogram import Router, types, F
from aiogram.filters import Command

from database import db
from utils import ui
from services.social_service import social_service

router = Router()

@router.message(Command("addfriend"))
async def handle_add_friend(message: types.Message, user: dict):
    parts = message.text.split()
    if len(parts) < 2:
        return await message.reply("Usage: /addfriend @username")
    
    target_username = parts[1].replace('@', '')
    target = await db.users.find_one({"username": target_username})
    
    if not target:
        return await message.reply("Could not find that sorcerer.")
    
    if target['telegramId'] == user['telegramId']:
        return await message.reply("You cannot friend yourself.")
    
    user_friends = user.get('friends', [])
    if any(f['userId'] == target['telegramId'] for f in user_friends):
        return await message.reply("You are already connected with this user.")
    
    # Add to friends
    user_friends.append({"userId": target['telegramId'], "username": target['username'], "status": 'accepted'})
    target_friends = target.get('friends', [])
    target_friends.append({"userId": user['telegramId'], "username": user['username'], "status": 'accepted'})
    
    await db.users.update({"telegramId": user['telegramId']}, {"$set": {"friends": user_friends}})
    await db.users.update({"telegramId": target['telegramId']}, {"$set": {"friends": target_friends}})
    
    await message.reply(f"🤝 <b>Bond Formed!</b> You and @{target['username']} are now friends.", parse_mode='HTML')

@router.message(Command("friends"))
async def handle_show_friends(message: types.Message, user: dict):
    friends = user.get('friends', [])
    if not friends:
        return await message.reply("Your contact list is empty. Use /addfriend to connect.")
    
    msg = ui.format_header("FRIENDS LIST") + "\n\n"
    for f in friends:
        friend_data = await db.users.find_one({"telegramId": f['userId']})
        status = f"🎖 {friend_data.get('rank', 'Sorcerer')}" if friend_data else "Unknown"
        msg += f"👤 @{f['username']} - {status}\n"
    
    await message.reply(msg, parse_mode='HTML')

@router.message(Command("gift"))
async def handle_gift(message: types.Message, user: dict):
    parts = message.text.split()
    if len(parts) < 4:
        return await message.reply("🎁 <b>USAGE:</b> /gift @username [item_id] [quantity]\nExample: /gift @yuji gacha_ticket 5", parse_mode='HTML')
    
    target_username = parts[1]
    item_id = parts[2]
    try:
        qty = int(parts[3])
    except ValueError:
        return await message.reply("❌ Quantity must be a number.")

    if qty <= 0:
        return await message.reply("❌ Quantity must be greater than zero.")

    res = await social_service.gift_item(message.from_user.id, target_username, item_id, qty)
    await message.reply(res['msg'], parse_mode='HTML')
