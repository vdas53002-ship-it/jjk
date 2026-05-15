from aiogram import Router, types, F
from aiogram.filters import Command
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from aiogram.utils.keyboard import InlineKeyboardBuilder

router = Router()

HUNT_KEYBOARD = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="/hunt")]
    ],
    resize_keyboard=True,
    one_time_keyboard=False
)

@router.message(Command("open"))
async def cmd_open(message: types.Message):
    if message.chat.type in ("group", "supergroup"):
        bot_info = await message.bot.get_me()
        builder = InlineKeyboardBuilder()
        builder.row(types.InlineKeyboardButton(
            text="💬 Open DM",
            url=f"https://t.me/{bot_info.username}?start=start"
        ))
        return await message.reply(
            "⚠️ Use <b>/open</b> in the bot's DM to get the hunt keyboard.",
            parse_mode='HTML', reply_markup=builder.as_markup()
        )

    await message.reply(
        "<b>Hunt Keyboard Activated!</b>\nTap /hunt to quickly start hunting.",
        parse_mode='HTML',
        reply_markup=HUNT_KEYBOARD
    )

@router.message(Command("close"))
async def cmd_close_kb(message: types.Message):
    if message.chat.type in ("group", "supergroup"):
        bot_info = await message.bot.get_me()
        builder = InlineKeyboardBuilder()
        builder.row(types.InlineKeyboardButton(
            text="💬 Open DM",
            url=f"https://t.me/{bot_info.username}?start=start"
        ))
        return await message.reply(
            "⚠️ Use <b>/close</b> in the bot's DM to remove the keyboard.",
            parse_mode='HTML', reply_markup=builder.as_markup()
        )

    await message.reply(
        "<b>Keyboard Closed.</b>",
        parse_mode='HTML',
        reply_markup=ReplyKeyboardRemove()
    )