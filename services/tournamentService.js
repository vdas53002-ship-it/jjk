const db = require('../database');

/**
 * Tournament Service: Manages automated daily brackets.
 */
let currentTournament = {
    registrations: [],
    bracket: null,
    status: 'open', // open, active, closed
    winner: null
};

module.exports = {
    async registerUser(userId, username) {
        if (currentTournament.status !== 'open') return { success: false, msg: "Registration is closed for today." };
        if (currentTournament.registrations.includes(userId)) return { success: false, msg: "You're already in the bracket!" };
        
        currentTournament.registrations.push({ id: userId, username });
        return { success: true, msg: "✅ Succesfully enrolled in the Zenin Tournament! Bracket starts at 12:00 UTC." };
    },

    async generateBracket() {
        if (currentTournament.registrations.length < 2) {
            currentTournament.status = 'closed';
            return { success: false, msg: "Not enough participants to start." };
        }

        currentTournament.status = 'active';
        // Simple power-of-2 bracket seeding
        const participants = currentTournament.registrations.sort(() => 0.5 - Math.random());
        currentTournament.bracket = {
            round: 1,
            matches: []
        };

        for (let i = 0; i < participants.length; i += 2) {
            if (participants[i+1]) {
                currentTournament.bracket.matches.push({ p1: participants[i], p2: participants[i+1], winner: null });
            } else {
                currentTournament.bracket.matches.push({ p1: participants[i], p2: { id: 0, username: 'BYE' }, winner: participants[i] });
            }
        }
        return { success: true, bracket: currentTournament.bracket };
    },

    async resolveNextMatch() {
        if (currentTournament.status !== 'active') return null;
        
        const match = currentTournament.bracket.matches.find(m => !m.winner);
        if (!match) {
            // Round complete, generate next round? 
            // Simplified: Just crown a winner from the last matches for now
            return null; 
        }

        // Simulate resolution
        match.winner = Math.random() > 0.5 ? match.p1 : match.p2;
        return match;
    },

    getStatus() {
        return {
            count: currentTournament.registrations.length,
            status: currentTournament.status,
            bracket: currentTournament.bracket
        };
    }
};
