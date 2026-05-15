/**
 * Type System for Cursed Clash
 * Close-range > Barrier > Long-range > Close-range
 */
module.exports = {
    TYPES: {
        CLOSE: 'Close-range',
        LONG: 'Long-range',
        BARRIER: 'Barrier'
    },

    getMultiplier(attackerType, defenderType) {
        if (attackerType === defenderType) return 1.0;

        const relationships = {
            'Close-range': { 'Barrier': 1.5, 'Long-range': 0.75 },
            'Long-range': { 'Close-range': 1.5, 'Barrier': 0.75 },
            'Barrier': { 'Long-range': 1.5, 'Close-range': 0.75 }
        };

        return (relationships[attackerType] && relationships[attackerType][defenderType]) || 1.0;
    }
};
