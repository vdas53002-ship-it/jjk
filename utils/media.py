import os
import json
import time
import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.types import BufferedInputFile, InputMediaPhoto
from aiogram.exceptions import TelegramBadRequest

from . import assets
from .combat.visual import visual_engine

CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'media_cache.json')
MEDIA_CACHE = {}
GENERATED_CACHE = {} # Cache for dynamically generated images (Team cards, etc)

if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            MEDIA_CACHE = json.load(f)
    except Exception as e:
        print(f"Cache load error: {e}")

_last_save = 0

def save_cache():
    global _last_save
    now = time.time()
    if now - _last_save < 60: # Only save once per minute
        return
    
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        # We'll use a temporary file to ensure atomic writes
        temp_file = CACHE_FILE + ".tmp"
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(MEDIA_CACHE, f)
        os.replace(temp_file, CACHE_FILE)
        _last_save = now
    except Exception as e:
        print(f"Cache save error: {e}")

async def smart_edit(message: types.Message, caption: str, reply_markup=None, no_reply=False):
    try:
        if message.photo or message.video or message.animation or message.document:
            return await message.edit_caption(caption=caption, parse_mode='HTML', reply_markup=reply_markup)
        return await message.edit_text(text=caption, parse_mode='HTML', reply_markup=reply_markup)
    except TelegramBadRequest as e:
        if "message is not modified" in str(e):
            return
        if "there is no text in the message to edit" in str(e):
            try:
                return await message.edit_caption(caption=caption, parse_mode='HTML', reply_markup=reply_markup)
            except Exception:
                pass
        if "message can't be edited" in str(e) or "message to edit not found" in str(e) or "there is no text in the message to edit" in str(e):
            if not no_reply:
                try:
                    return await message.reply(caption, parse_mode='HTML', reply_markup=reply_markup)
                except Exception:
                    pass
            return
        raise e
    except Exception:
        if not no_reply:
            try:
                return await message.reply(caption, parse_mode='HTML', reply_markup=reply_markup)
            except Exception:
                pass

async def edit_banner(message: types.Message, key: str, caption: str, reply_markup=None):
    # 1. Try to get asset path
    asset_path = assets.get_asset_path(key)
    
    # 2. If message is not a photo message, we must send a new one
    if not (message.photo or message.video or message.animation or message.document):
        return await send_banner(message.bot, message.chat.id, key, caption, reply_markup)

    # 3. Try to use cache for editing media
    file_id = MEDIA_CACHE.get(key)
    
    try:
        if file_id:
            return await message.edit_media(
                media=InputMediaPhoto(media=file_id, caption=caption, parse_mode='HTML'),
                reply_markup=reply_markup
            )
        
        # 4. Fallback to local file if not in cache or if edit fails
        if asset_path and os.path.exists(asset_path):
            photo = types.FSInputFile(asset_path)
            res = await message.edit_media(
                media=InputMediaPhoto(media=photo, caption=caption, parse_mode='HTML'),
                reply_markup=reply_markup
            )
            # Update cache
            if res.photo:
                MEDIA_CACHE[key] = res.photo[-1].file_id
                save_cache()
            return res
    except Exception:
        # If edit_media fails, it might be due to an invalid file_id in cache
        if file_id and key in MEDIA_CACHE:
            del MEDIA_CACHE[key]
        return await smart_edit(message, caption, reply_markup)

    return await smart_edit(message, caption, reply_markup)

async def edit_portrait(message: types.Message, item, caption: str, reply_markup=None):
    char_name = item.get('name', 'Academy')
    asset_path = assets.get_asset_path(item)

    if not (message.photo or message.video):
        return await send_portrait(message.bot, message.chat.id, item, caption, reply_markup)

    file_id = MEDIA_CACHE.get(char_name)

    try:
        if file_id:
            return await message.edit_media(
                media=InputMediaPhoto(media=file_id, caption=caption, parse_mode='HTML'),
                reply_markup=reply_markup
            )
        
        if asset_path and os.path.exists(asset_path):
            photo = types.FSInputFile(asset_path)
            res = await message.edit_media(
                media=InputMediaPhoto(media=photo, caption=caption, parse_mode='HTML'),
                reply_markup=reply_markup
            )
            if res.photo:
                MEDIA_CACHE[char_name] = res.photo[-1].file_id
                save_cache()
            return res
    except Exception:
        if file_id and char_name in MEDIA_CACHE:
            del MEDIA_CACHE[char_name]
        return await smart_edit(message, caption, reply_markup)

    return await smart_edit(message, caption, reply_markup)

async def send_portrait(bot: Bot, chat_id: int, item, caption: str, reply_markup=None, reply_to_message_id=None):
    char_name = item.get('name', 'mysterious_sorcerer')
    
    # 1. Try Cache
    if char_name in MEDIA_CACHE:
        try:
            return await bot.send_photo(chat_id, MEDIA_CACHE[char_name], caption=caption, parse_mode='HTML', reply_markup=reply_markup, reply_to_message_id=reply_to_message_id)
        except Exception:
            del MEDIA_CACHE[char_name]
    
    # 2. Try Local File
    asset_path = assets.get_asset_path(item)
    if asset_path and os.path.exists(asset_path):
        try:
            photo = types.FSInputFile(asset_path)
            res = await bot.send_photo(chat_id, photo, caption=caption, parse_mode='HTML', reply_markup=reply_markup, reply_to_message_id=reply_to_message_id)
            # Cache the file_id for next time
            MEDIA_CACHE[char_name] = res.photo[-1].file_id
            save_cache()
            return res
        except Exception as e:
            print(f"Error sending local portrait {asset_path}: {e}")
    
    # 3. Fallback to message
    return await bot.send_message(chat_id, caption, parse_mode='HTML', reply_markup=reply_markup, reply_to_message_id=reply_to_message_id)

async def send_banner(bot: Bot, chat_id: int, key: str, caption: str, reply_markup=None, reply_to_message_id=None):
    # 1. Try Cache
    if key in MEDIA_CACHE:
        try:
            return await bot.send_photo(chat_id, MEDIA_CACHE[key], caption=caption, parse_mode='HTML', reply_markup=reply_markup, reply_to_message_id=reply_to_message_id)
        except Exception:
            del MEDIA_CACHE[key]
    
    # 2. Try Local File
    asset_path = assets.get_asset_path(key)
    if asset_path and os.path.exists(asset_path):
        try:
            photo = types.FSInputFile(asset_path)
            res = await bot.send_photo(chat_id, photo, caption=caption, parse_mode='HTML', reply_markup=reply_markup, reply_to_message_id=reply_to_message_id)
            MEDIA_CACHE[key] = res.photo[-1].file_id
            save_cache()
            return res
        except Exception as e:
            print(f"Error sending local banner {asset_path}: {e}")
            
    # 3. Fallback to message
    return await bot.send_message(chat_id, caption, parse_mode='HTML', reply_markup=reply_markup, reply_to_message_id=reply_to_message_id)

async def send_battle_turn(bot: Bot, chat_id: int, battle, user_id: int, reply_markup=None, reply_to_message_id=None, message_id=None):
    p1 = battle['p1']
    p2 = battle['p2']
    
    # Identify which character is which for the scene
    p1_active = p1['team'][p1['activeIdx']]
    p2_active = p2['team'][p2['activeIdx']]
    
    # Generate Frame
    buffer = await visual_engine.generate_battle_scene(p1_active, p2_active)
    
    target_msg_id = message_id or battle.get('msgId')
    
    if not buffer:
        # Fallback to text UI
        from utils import ui
        msg = ui.render_pokemon_ui(battle, user_id)
        if target_msg_id:
            return await bot.edit_message_caption(chat_id=chat_id, message_id=target_msg_id, caption=msg, parse_mode='HTML', reply_markup=reply_markup)
        return await bot.send_message(chat_id, msg, parse_mode='HTML', reply_markup=reply_markup)

    photo = BufferedInputFile(buffer, filename="battle.jpg")
    
    from utils import ui
    # Use minimal caption when image is present to avoid redundancy
    logs = battle.get('log', [])
    last_log = logs[-1] if logs else "BATTLE START!"
    caption = f"<b>BATTLE UPDATE</b>\n\n{last_log}"

    if target_msg_id:
        try:
            return await bot.edit_message_media(
                chat_id=chat_id,
                message_id=target_msg_id,
                media=InputMediaPhoto(media=photo, caption=caption, parse_mode='HTML'),
                reply_markup=reply_markup
            )
        except Exception:
            # If edit fails (e.g. image too different or expired), send new
            res = await bot.send_photo(chat_id, photo, caption=caption, parse_mode='HTML', reply_markup=reply_markup, reply_to_message_id=reply_to_message_id)
            battle['msgId'] = res.message_id
            return res
    else:
        res = await bot.send_photo(chat_id, photo, caption=caption, parse_mode='HTML', reply_markup=reply_markup, reply_to_message_id=reply_to_message_id)
        battle['msgId'] = res.message_id
        return res

async def send_generated_photo(bot: Bot, chat_id: int, buffer: bytes, cache_key: str, caption: str, reply_markup=None):
    """Send a generated photo, using file_id cache if available."""
    if cache_key in GENERATED_CACHE:
        try:
            return await bot.send_photo(chat_id, GENERATED_CACHE[cache_key], caption=caption, parse_mode='HTML', reply_markup=reply_markup)
        except Exception:
            del GENERATED_CACHE[cache_key]
    
    photo = BufferedInputFile(buffer, filename="image.jpg")
    res = await bot.send_photo(chat_id, photo, caption=caption, parse_mode='HTML', reply_markup=reply_markup)
    if res.photo:
        GENERATED_CACHE[cache_key] = res.photo[-1].file_id
    return res

async def edit_generated_photo(message: types.Message, buffer: bytes, cache_key: str, caption: str, reply_markup=None):
    """Edit a generated photo, using file_id cache if available."""
    if cache_key in GENERATED_CACHE:
        try:
            return await message.edit_media(
                media=InputMediaPhoto(media=GENERATED_CACHE[cache_key], caption=caption, parse_mode='HTML'),
                reply_markup=reply_markup
            )
        except Exception:
            del GENERATED_CACHE[cache_key]
    
    photo = BufferedInputFile(buffer, filename="image.jpg")
    try:
        res = await message.edit_media(
            media=InputMediaPhoto(media=photo, caption=caption, parse_mode='HTML'),
            reply_markup=reply_markup
        )
        if res.photo:
            GENERATED_CACHE[cache_key] = res.photo[-1].file_id
        return res
    except Exception:
        return await smart_edit(message, caption, reply_markup)
