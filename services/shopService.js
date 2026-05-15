const db = require('../database');
const items = require('../utils/data/items');

/**
 * Shop Service: Handles secure transactions, stock management, and timed refreshes.
 */
module.exports = {
    /**
     * Checks and refreshes shop stock if needed based on timeframe.
     */
    async refreshShopIfNeeded(user) {
        const now = Date.now();
        const startOfDay = new Date().setUTCHours(0, 0, 0, 0);
        
        // Find last Monday at 00:00 UTC
        const today = new Date();
        const day = today.getUTCDay(); // 0 is Sunday, 1 is Monday
        const diff = (day === 0 ? 6 : day - 1);
        const startOfWeek = new Date(today.setUTCDate(today.getUTCDate() - diff)).setUTCHours(0, 0, 0, 0);

        user.shopState = user.shopState || { daily: { last: 0, stock: {} }, weekly: { last: 0, stock: {} } };

        let updated = false;

        // Daily Refresh
        if (user.shopState.daily.last < startOfDay) {
            user.shopState.daily.last = now;
            user.shopState.daily.stock = {};
            // Initialize stock from metadata
            Object.values(items).filter(i => i.shop && i.shop.category === 'daily').forEach(i => {
                user.shopState.daily.stock[i.id] = i.shop.stock;
            });
            updated = true;
        }

        // Weekly Refresh
        if (user.shopState.weekly.last < startOfWeek) {
            user.shopState.weekly.last = now;
            user.shopState.weekly.stock = {};
            Object.values(items).filter(i => i.shop && i.shop.category === 'weekly').forEach(i => {
                user.shopState.weekly.stock[i.id] = i.shop.stock;
            });
            updated = true;
        }

        if (updated) {
            await db.users.update({ telegramId: user.telegramId }, { $set: { shopState: user.shopState } });
        }
        return user.shopState;
    },

    /**
     * Attempts to purchase an item with stock and balance checks.
     */
    async buyItem(userId, itemId) {
        let user = await db.users.findOne({ telegramId: userId });
        const item = items[itemId];

        if (!user || !item) return { success: false, msg: "Transaction Error: Data Mismatch." };
        
        await this.refreshShopIfNeeded(user);
        const category = item.shop.category;
        
        // 1. Stock Check
        if (category !== 'special') {
            const currentStock = user.shopState[category].stock[itemId] || 0;
            if (currentStock <= 0) return { success: false, msg: "❌ This item is sold out! Check back after refresh." };
        }

        // 2. Currency Check
        const totalCost = item.price;
        const currency = item.currency; // 'coins'
        if ((user[currency] || 0) < totalCost) {
            return { success: false, msg: `❌ Not enough ${currency}! You need ${totalCost - (user[currency] || 0)} more.` };
        }

        // 3. Deduction
        user[currency] -= totalCost;
        if (category !== 'special') {
            user.shopState[category].stock[itemId] -= 1;
        }

        // 4. Inventory Addition
        user.inventory = user.inventory || [];
        const invIndex = user.inventory.findIndex(i => i.id === itemId);
        if (invIndex > -1) {
            user.inventory[invIndex].qty += 1;
        } else {
            user.inventory.push({ id: itemId, qty: 1 });
        }

        // Special: Gacha Tickets (Direct field update)
        if (itemId === 'gacha_ticket') {
            user.gachaTickets = (user.gachaTickets || 0) + 1;
        } else if (itemId === 'gacha_pack') {
            user.gachaTickets = (user.gachaTickets || 0) + 10;
        }

        await db.users.update({ telegramId: userId }, { $set: user });

        return { 
            success: true, 
            item, 
            qty: 1, 
            totalCost, 
            currency,
            msg: `✅ Successfully purchased 1x ${item.name}!`
        };
    }
};
