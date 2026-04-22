const path = require('path');
const fs = require('fs');
const visual = require('./combat/visual');
const assets = require('./assets');

// --- MEDIA CACHE ---
const CACHE_FILE = path.join(__dirname, '..', 'data', 'media_cache.json');
let MEDIA_CACHE = {};

if (fs.existsSync(CACHE_FILE)) {
    try { MEDIA_CACHE = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } 
    catch (e) { console.error("Cache load error:", e); }
}

const saveCache = () => {
    try {
        if (!fs.existsSync(path.dirname(CACHE_FILE))) fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(MEDIA_CACHE));
    } catch (e) { console.error("Cache save error:", e); }
};

module.exports = {
    async smartEdit(ctx, caption, extra = {}) {
        try {
            if (ctx.update && ctx.update.callback_query && ctx.update.callback_query.message && (ctx.update.callback_query.message.photo || ctx.update.callback_query.message.video)) {
                return await ctx.editMessageCaption(caption, { parse_mode: 'HTML', ...extra });
            }
            return await ctx.editMessageText(caption, { parse_mode: 'HTML', ...extra });
        } catch (e) {
            if (e.description && e.description.includes("message is not modified")) return; 
            // Only reply if it's NOT a battle update to avoid spam
            if (!extra.noReply) return ctx.replyWithHTML(caption, extra);
        }
    },

    async sendPortrait(ctx, item, caption, extra = {}) {
        const charName = item.name || 'mysterious_sorcerer';
        if (MEDIA_CACHE[charName]) {
            try { return await ctx.replyWithPhoto(MEDIA_CACHE[charName], { caption, parse_mode: 'HTML', ...extra }); }
            catch (e) { delete MEDIA_CACHE[charName]; }
        }
        const localPath = assets.getAssetPath(item);
        if (!fs.existsSync(localPath)) return await ctx.replyWithHTML(caption, extra);

        try {
            const res = await ctx.replyWithPhoto({ source: fs.createReadStream(localPath) }, { caption, parse_mode: 'HTML', ...extra });
            if (res && res.photo) {
                MEDIA_CACHE[charName] = res.photo[res.photo.length - 1].file_id;
                saveCache();
            }
            return res;
        } catch (e) { return await ctx.replyWithHTML(caption, extra); }
    },

    async sendBanner(ctx, key, caption, extra = {}) {
        if (MEDIA_CACHE[key]) {
            try { return await ctx.replyWithPhoto(MEDIA_CACHE[key], { caption, parse_mode: 'HTML', ...extra }); }
            catch (e) { delete MEDIA_CACHE[key]; }
        }
        const localPath = assets.getAssetPath(key);
        if (!fs.existsSync(localPath)) return ctx.replyWithHTML(caption, extra);

        try {
            const res = await ctx.replyWithPhoto({ source: fs.createReadStream(localPath) }, { caption, parse_mode: 'HTML', ...extra });
            if (res && res.photo) {
                MEDIA_CACHE[key] = res.photo[res.photo.length - 1].file_id;
                saveCache();
            }
            return res;
        } catch (e) { return ctx.replyWithHTML(caption, extra); }
    },

    async sendBattleTurn(ctx, battle, userId, extra = {}, chatId = null, messageId = null) {
        const isP1 = String(userId) === String(battle.p1.id);
        const targetChatId = chatId || (isP1 ? battle.p1.id : battle.p2.id);
        const targetMsgId = messageId || (isP1 ? battle.p1Mid : battle.p2Mid) || battle.msgId;
        
        const ui = require('./ui');
        const caption = ui.renderPokemonUI(battle, userId);
        const p1Char = battle.p1.team[battle.p1.activeIdx];
        const p2Char = battle.p2.team[battle.p2.activeIdx];

        try {
            const buffer = await visual.generateBattleScene(p1Char, p2Char, isP1 ? 'p1' : 'p2');
            
            if (targetMsgId) {
                try {
                    // Force edit existing media with explicit source handling
                    return await ctx.telegram.editMessageMedia(
                        targetChatId, 
                        targetMsgId, 
                        null, 
                        { 
                            type: 'photo', 
                            media: { source: buffer, filename: 'battle.jpg' }, 
                            caption: caption, 
                            parse_mode: 'HTML' 
                        }, 
                        extra
                    );
                } catch (editError) {
                    const desc = editError.description || "";
                    if (desc.includes("message is not modified")) return; // Same content, ignore
                    
                    if (desc.includes("Too Many Requests")) {
                        console.warn(`[RATE LIMIT] Skipping battle frame update.`);
                        return;
                    }

                    // Only if the message is actually gone/un-editable do we allow a new message
                    if (!desc.includes("message can't be edited") && !desc.includes("message to edit not found")) {
                        console.error("[BATTLE UI] Edit failed but skipping sendPhoto to avoid spam:", desc);
                        return; // Silent fail to prevent " ek hee cheez baar baar"
                    }
                }
            }

            // --- PROTECTED SEND NEW ---
            // Only runs if targetMsgId was null OR the specific "can't be edited" errors occurred.
            const res = await ctx.telegram.sendPhoto(targetChatId, { source: buffer }, { caption, parse_mode: 'HTML', ...extra });
            
            if (isP1) battle.p1Mid = res.message_id;
            else battle.p2Mid = res.message_id;
            battle.msgId = res.message_id; 

            return res;
        } catch (e) {
            console.error("[CRITICAL BATTLE MEDIA ERROR]:", e.description || e);
        }
    }
};


