const db = require('../database');

/**
 * Domain Service: Manages the ultimate sorcery techniques.
 */
module.exports = {
    DOMAINS: {
        "Yuji Itadori": { name: "Physical Prowess", effect: "Divergent hit guaranteed", buff: { attack: 1.2 } },
        "Gojo Satoru": { name: "Infinite Void", effect: "Enemy stun 2 turns", buff: { crit: 50 } },
        "Ryomen Sukuna": { name: "Malevolent Shrine", effect: "Splash damage all", buff: { attack: 1.5 } },
        "Megumi Fushiguro": { name: "Chimera Shadow Garden", effect: "Clone attack", buff: { speed: 2.0 } }
    },

    async getDomain(charId) {
        return this.DOMAINS[charId] || { name: "Simple Domain", effect: "Standard defensive buff", buff: { resilience: 1.2 } };
    },

    async unlockDomain(userId, charId) {
        const user = await db.users.findOne({ telegramId: userId });
        if (user.playerLevel < 40) return { success: false, msg: "Domain Expansion requires Level 40 Mastery!" };
        
        // Logical unlock in db?
        return { success: true, msg: `🔥 ${charId} has unlocked their Domain: ${this.DOMAINS[charId].name}!` };
    }
};
