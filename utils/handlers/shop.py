import time
import difflib
from datetime import datetime, timedelta
from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from database import db
from utils import ui, media
from utils.data.items import ITEMS
from services.shop_service import shop_service

router = Router()

ITEM_NICKNAMES = {
    "katana": "katana",
    "nails": "nails",
    "cloud": "cloud",
    "spear": "spear",
    "elixir": "elixir",
    "fragment": "fragment",
    "pill": "pill",
    "shard": "dshard",
    "scroll": "scroll",
    "finger": "finger",
    "orb": "reset_orb"
}

def resolve_item_id(nick: str) -> str:
    """Resolves an item ID from a nickname with auto-correction."""
    nick = nick.lower().strip()
    if nick in ITEM_NICKNAMES:
        return ITEM_NICKNAMES[nick]
    
    # Fuzzy matching
    matches = difflib.get_close_matches(nick, ITEM_NICKNAMES.keys(), n=1, cutoff=0.6)
    if matches:
        return ITEM_NICKNAMES[matches[0]]
    return None

@router.message(Command("shop"))
@router.callback_query(F.data == "shop_menu")
async def cmd_shop(callback_or_message: types.CallbackQuery | types.Message, user: dict):
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()

    msg = (
        "🛒 <b>Cᴜʀꜱᴇᴅ Mᴀʀᴋᴇᴛ</b>\n"
        "━━━━━━━━━━━━━━\n"
        f" 🪙 <b>Yᴏᴜʀ Cᴏɪɴꜱ:</b> <code>{user.get('coins', 0):,}</code>\n\n"
        "🔮 <b>Cᴜʀꜱᴇᴅ Tᴏᴏʟꜱ:</b>\n"
        "🗡️ Split Soul Katana — 500 🪙\n"
        "🔨 Resonance Nails — 250 🪙\n"
        "🗃️ Playful Cloud — 800 🪙\n"
        "📿 Inverted Spear — 1,200 🪙\n\n"
        "⚡ <b>Cᴏɴꜱᴜᴍᴀʙʟᴇꜱ:</b>\n"
        "🍷 Reverse Elixir — 150 🪙\n"
        "🧿 Cursed Fragment — 300 🪙\n"
        "💊 Energy Pill — 100 🪙\n"
        "🔥 Domain Shard — 750 🪙\n\n"
        "🎴 <b>Sᴩᴇᴄɪᴀʟ Iᴛᴇᴍꜱ:</b>\n"
        "👁️ Six Eyes Scroll — 5,000 🪙\n"
        "👑 Sukuna Finger — 10,000 🪙\n"
        "🌀 Technique Reset Orb — 3,500 🪙\n\n"
        "━━━━━━━━━━━━━━\n"
        "🛍️ <b>Bᴜʏ:</b> <code>/buy [item] [qty]</code>\n"
        "💰 <b>Sᴇʟʟ:</b> <code>/sell [item] [qty]</code>\n\n"
        "<i>Exᴀᴍᴩʟᴇ:</i>\n"
        " <code>/buy katana 1</code>\n"
        " <code>/buy finger</code>\n"
        " <code>/sell shard 2</code>"
    )

    builder = InlineKeyboardBuilder()
    builder.row(types.InlineKeyboardButton(text="🔙 Back to Hub", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await media.edit_banner(callback_or_message.message, "Market", msg, reply_markup=builder.as_markup())
    else:
        await media.send_banner(callback_or_message.bot, callback_or_message.chat.id, "Market", msg, reply_markup=builder.as_markup())


@router.message(Command("buy"))
async def handle_buy(message: types.Message, user: dict):
    args = message.text.split()
    if len(args) < 2:
        return await message.reply("🛍️ <b>Usage:</b> <code>/buy [item] [qty]</code>\nExample: <code>/buy katana 1</code>", parse_mode='HTML')

    nick = args[1].lower()
    qty = 1
    if len(args) > 2 and args[2].isdigit():
        qty = int(args[2])

    item_id = resolve_item_id(nick)
    if not item_id:
        return await message.reply("❌ That item is not in the market archives. Check for typos!")

    item = ITEMS.get(item_id)
    total_cost = item['price'] * qty

    if user.get('coins', 0) < total_cost:
        msg = f"❌ You don't have enough coins. Need 🪙 {total_cost:,}."
        return await media.send_banner(message.bot, message.chat.id, item_id, msg)

    # Execute purchase via shop_service
    for _ in range(qty):
        res = await shop_service.buy_item(user['telegramId'], item_id)
        if not res['success']:
            msg = f"❌ Purchase failed: {res['msg']}"
            return await media.send_banner(message.bot, message.chat.id, item_id, msg)

    msg = (
        f"✅ <b>PURCHASE SUCCESSFUL!</b>\n\n"
        f"You bought <b>{qty}x {item['name']}</b> for 🪙 <b>{total_cost:,}</b>.\n"
        f"Remaining Balance: 🪙 <b>{user.get('coins', 0) - total_cost:,}</b>"
    )
    await media.send_banner(message.bot, message.chat.id, item_id, msg)


@router.message(Command("sell"))
async def handle_sell(message: types.Message, user: dict):
    args = message.text.split()
    if len(args) < 2:
        return await message.reply("💰 <b>Usage:</b> <code>/sell [item] [qty]</code>\nExample: <code>/sell shard 2</code>", parse_mode='HTML')

    nick = args[1].lower()
    qty = 1
    if len(args) > 2 and args[2].isdigit():
        qty = int(args[2])

    item_id = resolve_item_id(nick)
    if not item_id:
        return await message.reply("❌ That item cannot be sold here. Check for typos!")

    item = ITEMS.get(item_id)
    # Sell price is usually 50% of buy price
    sell_price = int(item['price'] * 0.5)
    total_gain = sell_price * qty

    # Check inventory
    inv = user.get('inventory', [])
    inv_entry = next((i for i in inv if i['id'] == item_id), None)
    
    if not inv_entry or inv_entry['qty'] < qty:
        msg = f"❌ You don't have {qty}x {item['name']} in your bag."
        return await media.send_banner(message.bot, message.chat.id, item_id, msg)

    # Execute sell
    inv_entry['qty'] -= qty
    final_inv = [i for i in inv if i['qty'] > 0]
    
    await db.users.update({"telegramId": user['telegramId']}, {
        "$set": {"inventory": final_inv},
        "$inc": {"coins": total_gain}
    })

    msg = (
        f"🤝 <b>SALE COMPLETE!</b>\n\n"
        f"You sold <b>{qty}x {item['name']}</b> for 🪙 <b>{total_gain:,}</b>.\n"
        f"New Balance: 🪙 <b>{user.get('coins', 0) + total_gain:,}</b>"
    )
    await media.send_banner(message.bot, message.chat.id, item_id, msg)

@router.message(Command("give"))
async def handle_give_admin(message: types.Message, user: dict):
    # Admin Check (Owner ID from logs)
    if message.from_user.id != 7454452968:
        return

    args = message.text.split()
    if len(args) < 2:
        return await message.reply("🛠 <b>Admin Give:</b> <code>/give [item_nick] [qty]</code>", parse_mode='HTML')

    nick = args[1].lower()
    qty = 1
    if len(args) > 2 and args[2].isdigit():
        qty = int(args[2])

    item_id = resolve_item_id(nick)
    if not item_id:
        return await message.reply("❌ Invalid item nickname.")

    item = ITEMS.get(item_id)
    
    # Determine target
    target_id = message.from_user.id
    if message.reply_to_message:
        target_id = message.reply_to_message.from_user.id
    
    target_user = await db.users.find_one({"telegramId": target_id})
    if not target_user:
        return await message.reply("❌ Target user not found in database.")

    # Add to inventory
    inv = target_user.get('inventory', [])
    found = False
    for entry in inv:
        if entry['id'] == item_id:
            entry['qty'] += qty
            found = True
            break
    if not found:
        inv.append({"id": item_id, "qty": qty})
    
    await db.users.update({"telegramId": target_id}, {"$set": {"inventory": inv}})
    
    await message.reply(f"🎁 <b>GIFT SENT!</b>\n\nTarget: <code>{target_id}</code>\nItem: <b>{qty}x {item['name']}</b>", parse_mode='HTML')

@router.message(Command("gift"))
async def handle_gift(message: types.Message, user: dict):
    if not message.reply_to_message:
        return await message.reply("🎁 <b>Usage:</b> Reply to someone with <code>/gift [item] [qty]</code>", parse_mode='HTML')

    args = message.text.split()
    if len(args) < 2:
        return await message.reply("🎁 <b>Usage:</b> <code>/gift [item] [qty]</code>", parse_mode='HTML')

    nick = args[1].lower()
    qty = 1
    if len(args) > 2 and args[2].isdigit():
        qty = int(args[2])

    item_id = resolve_item_id(nick)
    if not item_id:
        return await message.reply("❌ Item not found. Check for typos!")

    item = ITEMS.get(item_id)
    
    # Check sender inventory
    inv = user.get('inventory', [])
    sender_entry = next((i for i in inv if i['id'] == item_id), None)
    
    if not sender_entry or sender_entry['qty'] < qty:
        return await message.reply(f"❌ You don't have {qty}x {item['name']} to gift.")

    target_id = message.reply_to_message.from_user.id
    if target_id == message.from_user.id:
        return await message.reply("❌ You can't gift to yourself!")

    target_user = await db.users.find_one({"telegramId": target_id})
    if not target_user:
        return await message.reply("❌ Recipient must be a registered sorcerer.")

    # Transaction
    sender_entry['qty'] -= qty
    final_inv_sender = [i for i in inv if i['qty'] > 0]
    
    target_inv = target_user.get('inventory', [])
    found = False
    for entry in target_inv:
        if entry['id'] == item_id:
            entry['qty'] += qty
            found = True
            break
    if not found:
        target_inv.append({"id": item_id, "qty": qty})
    
    await db.users.update({"telegramId": user['telegramId']}, {"$set": {"inventory": final_inv_sender}})
    await db.users.update({"telegramId": target_id}, {"$set": {"inventory": target_inv}})
    
    await message.reply(
        f"🎁 <b>GIFT DELIVERED!</b>\n\n"
        f"You sent <b>{qty}x {item['name']}</b> to "
        f"<b>{message.reply_to_message.from_user.full_name}</b>!",
        parse_mode='HTML'
    )

@router.callback_query(F.data == "nop")
async def nop(callback: types.CallbackQuery):
    await callback.answer("This item is sold out!")
