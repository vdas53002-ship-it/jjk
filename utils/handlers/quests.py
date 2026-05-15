from aiogram import Router, types, F
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.filters import Command

from utils import ui
from services.quest_service import quest_service
from utils.data import quests as quest_pool

router = Router()

@router.message(Command("quests"))
@router.callback_query(F.data.startswith("cmd_quests"))
async def handle_quests(callback_or_message: types.CallbackQuery | types.Message, user: dict):
    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.answer()
    
    user_id = callback_or_message.from_user.id
    active_quests = await quest_service.sync_quests(user_id)
    reset_time = quest_service.get_time_until_reset()

    msg = ui.format_header("📋 DAILY QUESTS") + "\n" + \
          f"⏳ Resets in: <b>{reset_time}</b>\n" + \
          f"{ui.divider()}\n\n"

    builder = InlineKeyboardBuilder()

    for idx, uq in enumerate(active_quests):
        meta = quest_pool.DATA.get(uq['questId'])
        if not meta: continue
        
        status_icon = "✅" if uq.get('claimed') else ("🌟" if uq.get('completed') else "⬜")
        progress_pct = min(1.0, uq['progress'] / uq['target'])
        
        # UI Progress Bar
        size = 10
        filled = round(size * progress_pct)
        empty = size - filled
        progress_bar = f"[{'█' * filled}{'░' * empty}]"
        
        msg += f"{status_icon} <b>{idx + 1}. {meta['description']}</b>\n" + \
               f"   {progress_bar} ({uq['progress']}/{uq['target']})\n" + \
               f"   💰 <i>Rewards: {meta['reward'].get('coins', 0)} coins + {meta['reward'].get('xp', 0)} XP</i>\n\n"

        if uq.get('completed') and not uq.get('claimed'):
            builder.row(types.InlineKeyboardButton(text=f"🎁 CLAIM QUEST {idx + 1}", callback_data=f"q_claim_{uq['questId']}"))

    msg += f"{ui.divider()}"
    
    has_unclaimed = any(q.get('completed') and not q.get('claimed') for q in active_quests)
    if has_unclaimed:
        builder.row(types.InlineKeyboardButton(text="✨ CLAIM ALL REWARDS", callback_data="q_claim_all"))
    
    builder.row(types.InlineKeyboardButton(text="🔙 BACK", callback_data="back_to_hub"))

    if isinstance(callback_or_message, types.CallbackQuery):
        await callback_or_message.message.edit_text(msg, parse_mode='HTML', reply_markup=builder.as_markup())
    else:
        await callback_or_message.answer(msg, parse_mode='HTML', reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("q_claim_"))
async def handle_claim(callback: types.CallbackQuery):
    if callback.data == "q_claim_all":
        await callback.answer("Focusing energies...")
        result = await quest_service.claim_all(callback.from_user.id)
        if result['success']:
            msg = f"✨ <b>All quests claimed!</b> Total rewards:\n\n💰 <b>Coins:</b> +{result['coins']}\n📈 <b>Experience:</b> +{result['xp']}"
            if result.get('items'):
                consolidated = {}
                for i in result['items']: consolidated[i['id']] = consolidated.get(i['id'], 0) + i['qty']
                for tid, qty in consolidated.items(): msg += f"\n📦 <b>{tid}:</b> +{qty}"
            await callback.message.reply(msg, parse_mode='HTML')
            await handle_quests(callback)
        else:
            await callback.answer(result['message'], show_alert=True)
    else:
        quest_id = callback.data.replace("q_claim_", "")
        await callback.answer("Processing claim...")
        result = await quest_service.claim_quest(callback.from_user.id, quest_id)
        if result['success']:
            msg = f"✅ <b>Quest completed!</b> You received:\n\n💰 <b>Coins:</b> +{result['reward']['coins']}\n📈 <b>Experience:</b> +{result['reward']['xp']}"
            if result['reward'].get('items'):
                for i in result['reward']['items']: msg += f"\n📦 <b>{i['id']}:</b> +{i['qty']}"
            await callback.message.reply(msg, parse_mode='HTML')
            await handle_quests(callback)
        else:
            await callback.answer(result['message'], show_alert=True)
