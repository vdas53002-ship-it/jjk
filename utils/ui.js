module.exports = {
    // Icons & Markers
    ICONS: {
        CLOSE: "👊", LONG: "🏹", BARRIER: "🏮",
        HP: "❤️", CE: "🌀", COINS: "🪙", TICKETS: "🎫", DUST: "✨",
        COMMON: "⬜", RARE: "🟦", EPIC: "🟪", LEGENDARY: "🟨", MYTHIC: "🟥"
    },

    divider() {
        return "──────────────────";
    },

    formatHeader(text, type = "GENERAL") {
        const themes = {
            GENERAL: "✧", BATTLE: "⚔️", EXPLORE: "📍", SHOP: "🏷️", CLAN: "💠", UPGRADE: "⚡"
        };
        const icon = themes[type] || themes.GENERAL;
        return `<b>${icon} ${text.toUpperCase()} ${icon}</b>\n` + "──────────────────";
    },

    panel(body) {
        return `┃ ${body.split('\n').join('\n┃ ')}`;
    },

    /**
     * Creates a Unicode progress bar with specific theme.
     */
    createProgressBar(current, max, length = 10, filled = "▰", empty = "▱") {
        const pct = Math.max(0, Math.min(1, current / max));
        const filledLength = Math.round(pct * length);
        const emptyLength = length - filledLength;
        return filled.repeat(filledLength) + empty.repeat(emptyLength);
    },

    /**
     * Pokemon-Style Battle Renderer
     * Refined to show HP/CE and turn context.
     */
    renderPokemonUI(battle, userId) {
        const isP1 = String(userId) === String(battle.p1.id);
        const p1 = battle.p1.team[battle.p1.activeIdx];
        const p2 = battle.p2.team[battle.p2.activeIdx];
        
        // Show last 2 logs to ensure attacks are visible even after cleanup messages
        const displayLogs = battle.log.slice(-2);
        
        let msg = `<b>─── ⚔️ ${battle.is1v1 ? "WILD ENCOUNTER" : "DUEL"} ⚔️ ───</b>\n\n`;
        
        const p1EnergyIcon = p1.energyType === 'PE' ? '💪' : '🌀';
        const p2EnergyIcon = p2.energyType === 'PE' ? '💪' : '🌀';
        const p1Label = p1.energyType === 'PE' ? 'PE' : 'CE';
        const p2Label = p2.energyType === 'PE' ? 'PE' : 'CE';

        // Header Info (Text-based HP/CE)
        msg += `👤 <b>${p1.name.toUpperCase()}</b>\n`;
        msg += `❤️ <b>HP:</b> <code>${this.createProgressBar(p1.hp, p1.maxHp, 10, "█", "░")}</code> [${Math.ceil(p1.hp)}/${p1.maxHp}]\n`;
        msg += `${p1EnergyIcon} <b>${p1Label}:</b> <code>${this.createProgressBar(p1.ce, p1.maxCe || 100)}</code> [${Math.ceil(p1.ce)}/${p1.maxCe || 100}]\n\n`;

        msg += `👹 <b>${p2.name.toUpperCase()}</b>\n`;
        msg += `❤️ <b>HP:</b> <code>${this.createProgressBar(p2.hp, p2.maxHp, 10, "█", "░")}</code> [${Math.ceil(p2.hp)}/${p2.maxHp}]\n`;
        msg += `${p2EnergyIcon} <b>${p2Label}:</b> <code>${this.createProgressBar(p2.ce, p2.maxCe || 100)}</code> [${Math.ceil(p2.ce)}/${p2.maxCe || 100}]\n\n`;

        if (displayLogs.length > 0) {
            msg += `✨ <b>BATTLE LOG:</b>\n`;
            displayLogs.forEach(entry => {
                const cleanStr = entry.replace(/<[^>]*>/g, '');
                if (cleanStr.trim()) msg += `› <i>${cleanStr}</i>\n`;
            });
        } else {
            msg += `⏳ <i>Ready for battle! Select a move...</i>\n`;
        }

        msg += `\n──────────────────`;
        return msg;
    }
};

