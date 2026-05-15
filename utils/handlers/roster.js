const { Markup } = require('telegraf');
const db = require('../../database');
const ui = require('../ui');
const media = require('../media');
const characters = require('../data/characters');
const upgradeService = require('../../services/upgradeService');
const userService = require('../../services/userService');

/**
 * Roster Handler: Comprehensive character management system.
 * Features: Viewing, Stats, Upgrading, and Dual-mode Selling (Single/Bulk).
 */
module.exports = {
    async showRoster(ctx, page = 1) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return ctx.reply("Please register first.");

        const roster = await db.roster.find({ userId: userId });
        const teamIds = user.teamIds || [];

        const perPage = 10;
        const totalPages = Math.ceil(roster.length / perPage);
        const start = (page - 1) * perPage;
        const items = roster.slice(start, start + perPage);

        let msg = ui.formatHeader(`SQUAD ARCHIVES`) + "\n\n";
        msg += `🎖 <b>USER:</b> ${user.username} | 🌟 <b>LEVEL:</b> ${user.playerLevel || 1}\n`;
        msg += `📦 <b>STORAGE:</b> ${roster.length} / 100\n\n`;

        msg += `🛡️ <b>ACTIVE TEAM:</b>\n`;
        if (teamIds.length === 0) {
            msg += "<i>No spirits deployed.</i>\n";
        } else {
            teamIds.forEach((id, i) => {
                msg += `${i + 1}. <b>${id}</b>\n`;
            });
        }
        msg += "\n";

        msg += `🗃 <b>COLLECTION:</b>\n`;
        items.forEach((c, i) => {
            const isTeam = teamIds.includes(c.charId);
            const prefix = isTeam ? "🛡️ " : "▫️ ";
            msg += `${prefix}${c.charId} (Lvl ${c.level})\n`;
        });

        if (roster.length === 0) msg += "<i>Your roster is currently empty. Summon some souls!</i>";

        const kb = [];
        if (totalPages > 1) {
            const nav = [];
            if (page > 1) nav.push(Markup.button.callback('⬅️', `roster_page_${page - 1}`));
            nav.push(Markup.button.callback(`${page} / ${totalPages}`, 'none'));
            if (page < totalPages) nav.push(Markup.button.callback('➡️', `roster_page_${page + 1}`));
            kb.push(nav);
        }

        kb.push([
            Markup.button.callback('🔍 DETAILS', 'roster_nav_details'),
            Markup.button.callback('💸 SELL SPIRITS', 'roster_nav_sell_menu')
        ]);
        kb.push([Markup.button.callback('🔙 BACK TO HUB', 'back_to_hub')]);

        const extra = { ...Markup.inlineKeyboard(kb) };
        if (ctx.callbackQuery) return media.smartEdit(ctx, msg, extra);
        return ctx.replyWithHTML(msg, Markup.inlineKeyboard(kb));
    },

    async handleSellMenu(ctx) {
        const msg = ui.formatHeader("💰 SPIRIT DISPOSAL", "ROSTER") + "\n\n" +
            "Release spirits back into the veil to recover Coins and Soul Dust.\n\n" +
            "• <b>Common:</b> 50 Coins, 10 Dust\n" +
            "• <b>Rare+:</b> Higher yields based on grade.";
        
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🎯 SELECT INDIVIDUALS', 'roster_nav_release')],
            [Markup.button.callback('🧹 SELL ALL COMMONS', 'roster_nav_release_commons')],
            [Markup.button.callback('🔥 SELL ALL UNASSIGNED', 'roster_mass_release_all')],
            [Markup.button.callback('⬅️ BACK', 'cmd_roster')]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async handleReleaseMenu(ctx, filterCommons = false, page = 0) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        const roster = await db.roster.find({ userId: userId });
        const teamIds = user.teamIds || [];
        
        let targets = roster;
        if (filterCommons) {
            targets = roster.filter(c => {
                const char = characters[c.charId];
                return char && char.rarity === 'Common' && !teamIds.includes(c.charId);
            });
        }

        // Sort: Non-team first
        targets.sort((a, b) => {
            const aInTeam = teamIds.includes(a.charId) ? 1 : 0;
            const bInTeam = teamIds.includes(b.charId) ? 1 : 0;
            return aInTeam - bInTeam;
        });

        const pageSize = 8;
        const start = page * pageSize;
        const visible = targets.slice(start, start + pageSize);

        if (!ctx.session.selectedForRelease) ctx.session.selectedForRelease = [];

        let msg = ui.formatHeader(filterCommons ? "SELL COMMONS" : "SELECT FOR RELEASE") + "\n\n" +
            `Selected: <b>${ctx.session.selectedForRelease.length}</b> spirits\n\n`;

        const kb = [];
        visible.forEach(c => {
            const isTeam = teamIds.includes(c.charId);
            const isSelected = ctx.session.selectedForRelease.includes(c._id);
            const icon = isTeam ? '🛡️' : (isSelected ? '✅' : '⬜️');
            const label = `${icon} ${c.charId} (Lvl ${c.level})`;
            kb.push([Markup.button.callback(label, isTeam ? 'none' : `roster_release_toggle_${c._id}`)]);
        });

        const nav = [];
        if (page > 0) nav.push(Markup.button.callback('⬅️', `roster_nav_release_${filterCommons ? 'commons_' : ''}page_${page - 1}`));
        if (start + pageSize < targets.length) nav.push(Markup.button.callback('➡️', `roster_nav_release_${filterCommons ? 'commons_' : ''}page_${page + 1}`));
        if (nav.length > 0) kb.push(nav);

        if (ctx.session.selectedForRelease.length > 0) {
            kb.push([Markup.button.callback('🔥 CONFIRM RELEASE SELECTED', 'roster_mass_release_selected')]);
        }

        if (filterCommons) {
            kb.push([Markup.button.callback('🧹 SELL ALL COMMONS NOW', 'roster_mass_release_commons')]);
        }

        kb.push([Markup.button.callback('⬅️ BACK', 'roster_nav_sell_menu')]);

        return media.smartEdit(ctx, msg, Markup.inlineKeyboard(kb));
    },

    async toggleSelectForRelease(ctx, rosterId) {
        if (!ctx.session.selectedForRelease) ctx.session.selectedForRelease = [];
        const idx = ctx.session.selectedForRelease.indexOf(rosterId);
        if (idx > -1) {
            ctx.session.selectedForRelease.splice(idx, 1);
        } else {
            if (ctx.session.selectedForRelease.length >= 10) return ctx.answerCbQuery("⚠️ Max 10 at once!", { show_alert: true });
            ctx.session.selectedForRelease.push(rosterId);
        }
        await ctx.answerCbQuery("Selection updated.");
        return this.handleReleaseMenu(ctx, false); // Default to false for toggle
    },

    async handleMassReleaseSelected(ctx) {
        const userId = ctx.from.id;
        const selectedIds = ctx.session.selectedForRelease || [];
        if (selectedIds.length === 0) return ctx.answerCbQuery("Nothing selected.");

        const rosterEntries = await db.roster.find({ _id: { $in: selectedIds }, userId });
        const totalCoins = rosterEntries.length * 50;
        const totalDust = rosterEntries.length * 10;

        const msg = `⚠️ <b>CONFIRM BULK SALE</b>\n\nYou are about to release <b>${rosterEntries.length}</b> spirits.\n\n` +
            `💰 <b>Gains:</b> ${totalCoins} Coins & ✨ ${totalDust} Dust\n\n` +
            `<i>Spirit list: ${rosterEntries.map(c => c.charId).join(", ")}</i>`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🔥 YES, SELL ALL', 'roster_release_selected_exec')],
            [Markup.button.callback('❌ CANCEL', 'roster_nav_release')]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async executeSelectedRelease(ctx) {
        const userId = ctx.from.id;
        const selectedIds = ctx.session.selectedForRelease || [];
        const count = selectedIds.length;

        if (count === 0) return ctx.answerCbQuery("Nothing selected.");

        await db.roster.remove({ _id: { $in: selectedIds }, userId }, { multi: true });
        await db.users.update({ telegramId: userId }, { $inc: { coins: count * 50, dust: count * 10 } });
        ctx.session.selectedForRelease = [];

        await ctx.answerCbQuery(`🔥 Sale complete! +${count * 50} Coins & +${count * 10} Dust!`, { show_alert: true });
        return this.showRoster(ctx, 1);
    },

    async handleMassReleaseCommons(ctx) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return ctx.reply("❌ Please register first.");
        const roster = await db.roster.find({ userId: userId });
        
        const commons = roster.filter(c => {
            const char = characters[c.charId];
            return char && char.rarity === 'Common' && !(user.teamIds || []).includes(c.charId);
        });

        if (commons.length === 0) return ctx.answerCbQuery("No common spirits available.", { show_alert: true });

        const totalCoins = commons.length * 50;
        const totalDust = commons.length * 10;

        const msg = `⚠️ <b>MASS RELEASE: COMMONS</b>\n\nRelease <b>${commons.length} Common</b> spirits?\n\n` +
            `💰 <b>Gains:</b> ${totalCoins} Coins & ✨ ${totalDust} Dust\n\n` +
            `<i>Note: Active team members are protected.</i>`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🔥 RELEASE ALL COMMONS', 'roster_mass_release_exec')],
            [Markup.button.callback('❌ CANCEL', 'roster_nav_sell_menu')]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async executeMassRelease(ctx) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return ctx.reply("❌ Please register first.");
        const roster = await db.roster.find({ userId: userId });
        const commons = roster.filter(c => {
            const char = characters[c.charId];
            return char && char.rarity === 'Common' && !(user.teamIds || []).includes(c.charId);
        });

        if (commons.length === 0) return ctx.answerCbQuery("None found.");

        const idsToRemove = commons.map(c => c._id);
        const count = idsToRemove.length;

        await db.roster.remove({ _id: { $in: idsToRemove } }, { multi: true });
        await db.users.update({ telegramId: userId }, { $inc: { coins: count * 50, dust: count * 10 } });

        await ctx.answerCbQuery(`🔥 Mass release complete! +${count * 50} Coins & +${count * 10} Dust!`, { show_alert: true });
        return this.showRoster(ctx, 1);
    },

    async handleMassReleaseAll(ctx) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return ctx.reply("❌ Please register first.");
        const roster = await db.roster.find({ userId: userId });
        const teamIds = user.teamIds || [];

        const targets = roster.filter(c => !teamIds.includes(c.charId));

        if (targets.length === 0) return ctx.answerCbQuery("No unassigned spirits found.", { show_alert: true });

        const totalCoins = targets.length * 50;
        const totalDust = targets.length * 10;

        const msg = `⚠️ <b>MASS RELEASE: ALL UNASSIGNED</b>\n\n` +
            `You are about to release <b>${targets.length}</b> spirits (EVERYTHING not in your team).\n\n` +
            `💰 <b>Gains:</b> ${totalCoins} Coins & ✨ ${totalDust} Dust\n\n` +
            `<i>Confirming this will sell Rares, Epics, and Legendaries if they aren't equipped!</i>`;

        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🔥 YES, SELL EVERYTHING', 'roster_mass_release_all_exec')],
            [Markup.button.callback('❌ CANCEL', 'roster_nav_sell_menu')]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async executeMassReleaseAll(ctx) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return ctx.reply("❌ Please register first.");
        const roster = await db.roster.find({ userId: userId });
        const teamIds = user.teamIds || [];

        const targets = roster.filter(c => !teamIds.includes(c.charId));
        if (targets.length === 0) return ctx.answerCbQuery("Done.");

        const idsToRemove = targets.map(c => c._id);
        const count = idsToRemove.length;

        await db.roster.remove({ _id: { $in: idsToRemove } }, { multi: true });
        await db.users.update({ telegramId: userId }, { $inc: { coins: count * 50, dust: count * 10 } });

        await ctx.answerCbQuery(`🔥 Purgatory complete! +${count * 50} Coins & +${count * 10} Dust!`, { show_alert: true }).catch(() => null);
        return this.showRoster(ctx, 1);
    },

    async handleReleaseConfirm(ctx, rosterId) {
        if (ctx.callbackQuery) ctx.answerCbQuery().catch(() => null);
        const char = await db.roster.findOne({ _id: rosterId });
        if (!char) return ctx.answerCbQuery("Spirit not found.");

        const msg = `⚠️ <b>SELL CONFIRMATION</b>\n\nAre you sure you want to release <b>${char.charId} (Lvl ${char.level})</b>?\n\n` +
            `💰 <b>Rewards:</b> 50 Coins & ✨ 10 Dust`;
        
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('✅ YES, SELL', `roster_release_exec_${rosterId}`)],
            [Markup.button.callback('❌ CANCEL', `roster_view_${rosterId}`)]
        ]);

        return media.smartEdit(ctx, msg, kb);
    },

    async executeRelease(ctx, rosterId) {
        const userId = ctx.from.id;
        const char = await db.roster.findOne({ _id: rosterId, userId: userId });
        if (!char) return ctx.answerCbQuery("Not owned.");
        
        await db.roster.remove({ _id: rosterId, userId: userId });
        await db.users.update({ telegramId: userId }, { $inc: { coins: 50, dust: 10 } });

        await ctx.answerCbQuery(`🕊 Released ${char.charId}. +50 Coins & +10 Dust!`);
        return this.showRoster(ctx, 1);
    },

    async handleDetailsNav(ctx) {
        const userId = ctx.from.id;
        const roster = await db.roster.find({ userId });
        
        if (roster.length === 0) return ctx.answerCbQuery("Roster is empty.");

        const kb = roster.map(c => [Markup.button.callback(`${c.charId} (Lvl ${c.level})`, `roster_view_${c._id}`)]);
        kb.push([Markup.button.callback('⬅️ BACK TO ROSTER', 'cmd_roster')]);
        
        try {
            if (ctx.callbackQuery && ctx.callbackQuery.message.photo) {
                await ctx.deleteMessage();
                return ctx.replyWithHTML("🔍 <b>SELECT A CHARACTER TO INSPECT:</b>", { ...Markup.inlineKeyboard(kb) });
            }
        } catch(e) {}
        
        return media.smartEdit(ctx, "🔍 <b>SELECT A CHARACTER TO INSPECT:</b>", Markup.inlineKeyboard(kb));
    },

    async showGlobalArchive(ctx, page = 0) {
        const charNames = Object.keys(characters).sort((a, b) => {
             const rA = characters[a].rarity; const rB = characters[b].rarity;
             const rVals = { "Mythic":5, "Legendary":4, "Epic":3, "Rare":2, "Common":1, "Boss":6 };
             if (rVals[rB] !== rVals[rA]) return (rVals[rB]||0) - (rVals[rA]||0);
             return a.localeCompare(b);
        });
        
        const limit = 12;
        const maxPage = Math.ceil(charNames.length / limit) - 1;
        page = Math.max(0, Math.min(page, maxPage));
        
        const slice = charNames.slice(page * limit, (page + 1) * limit);
        let msg = ui.formatHeader(`ARCHIVE (${page + 1}/${maxPage + 1})`) + "\n\nSelect a soul to inspect its vessel:\n";
        
        const kb = [];
        for (let i = 0; i < slice.length; i += 2) {
            const row = [];
            row.push(Markup.button.callback(slice[i], `cmd_view_char_${slice[i]}`));
            if (slice[i+1]) row.push(Markup.button.callback(slice[i+1], `cmd_view_char_${slice[i+1]}`));
            kb.push(row);
        }
        
        const nav = [];
        if (page > 0) nav.push(Markup.button.callback('⬅️ PREV', `view_archive_${page - 1}`));
        if (page < maxPage) nav.push(Markup.button.callback('NEXT ➡️', `view_archive_${page + 1}`));
        if (nav.length) kb.push(nav);
        
        const extra = { parse_mode: 'HTML', ...Markup.inlineKeyboard(kb) };
        try {
            if (ctx.callbackQuery && ctx.callbackQuery.message.photo) {
                 await ctx.deleteMessage().catch(()=>null);
                 return ctx.replyWithHTML(msg, extra);
            }
            if (ctx.callbackQuery) return media.smartEdit(ctx, msg, extra);
        } catch(e) {}
        
        return ctx.replyWithHTML(msg, extra);
    },

    async viewCommand(ctx, forceTarget = null, fromArchive = false) {
        const query = forceTarget || ((ctx.message && ctx.message.text) ? ctx.message.text.split(' ').slice(1).join(' ').toLowerCase() : "");
        const userId = ctx.from.id;

        if (!query) {
            const roster = await db.roster.find({ userId });
            if (roster.length > 0 && !fromArchive) {
                return this.handleDetailsNav(ctx);
            }
            return this.showGlobalArchive(ctx, 0);
        }
        
        let foundKey = null;
        for (const [key, data] of Object.entries(characters)) {
            const aliases = data.aliases || [];
            if (key.toLowerCase() === query || key.toLowerCase().includes(query) || aliases.some(a => a.toLowerCase().includes(query))) {
                foundKey = key;
                break;
            }
        }
        
        if (!foundKey) return ctx.reply(`❌ Could not find any cursed spirit or sorcerer matching "${query}".`);
        
        const rosterEntry = await db.roster.findOne({ userId, charId: foundKey });
        const base = characters[foundKey];

        if (rosterEntry) {
            return this.showCharacterDetails(ctx, rosterEntry._id);
        }

        let msg = ui.formatHeader(`ARCHIVE: ${base.name}`) + "\n\n";
        msg += `🏮 <b>STATUS:</b> <i>NOT OWNED</i>\n`;
        msg += `🎭 <b>Rarity:</b> ${base.rarity}\n`;
        msg += `🏮 <b>Base Grade:</b> ${base.grade || 'Unrated'}\n\n`;
        msg += `❤️ <b>Base HP:</b> ${base.hp} | 🌀 <b>Base CE:</b> ${base.ce}\n`;
        msg += `⚔️ <b>ATK:</b> ${base.atk || base.attack || 100} | ⚡ <b>SPD:</b> ${base.speed || 100}\n\n`;
        msg += `📝 <b>Description:</b>\n<i>${base.description || "A manifestation of cursed energy."}</i>\n`;
        
        let kb = [];
        if (fromArchive) {
            kb.push([Markup.button.callback('⬅️ BACK TO ARCHIVE', 'view_archive_0')]);
        } else {
            kb.push([Markup.button.callback('📜 VIEW YOUR ROSTER', 'roster_nav_details')]);
            kb.push([Markup.button.callback('📚 GLOBAL ARCHIVE', 'view_archive_0')]);
        }
        
        const extra = { parse_mode: 'HTML', ...Markup.inlineKeyboard(kb) };
        
        try {
            if (ctx.callbackQuery && ctx.callbackQuery.message.text) {
                await ctx.deleteMessage().catch(()=>null);
            }
        } catch(e) {}
        
        return media.sendPortrait(ctx, base, msg, extra);
    },

    async showCharacterDetails(ctx, rosterId) {
        const userId = ctx.from.id;
        const char = await db.roster.findOne({ _id: rosterId, userId });
        if (!char) return ctx.answerCbQuery("Data missing.");

        const base = characters[char.charId];
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return ctx.reply("❌ Please register first.");
        const stats = userService.calculateFinalStats(char, base);

        const isTeam = (user.teamIds || []).includes(char.charId);
        
        const dustCost = 10 + (char.level * 5);
        const coinCost = 100 + (char.level * 50);

        const currentStars = char.stars || 0;
        const availableShards = (user.shards && user.shards[char.charId]) ? user.shards[char.charId] : 0;
        const starDisplay = currentStars > 0 ? '⭐'.repeat(currentStars) : '0⭐';
        
        const energyIcon = base.energyType === 'PE' ? '💪' : '🌀';
        const energyLabel = base.energyType === 'PE' ? 'PE' : 'CE';

        let msg = ui.formatHeader(`INFO: ${char.charId}`) + "\n\n";
        if (isTeam) msg += "🛡️ <b>[CURRENT TEAM MEMBER]</b>\n\n";
        
        if (currentStars > 0) msg += `🌟 <b>AWAKENED ${currentStars}/5: +${currentStars * 15}% STATS</b>\n\n`;
        
        msg += `🎭 <b>Rarity:</b> ${base.rarity}\n` +
               `📈 <b>Level:</b> ${char.level} | 🏮 <b>Grade:</b> ${stats.grade}\n` +
               `⭐️ <b>Stars:</b> ${starDisplay}\n\n` +
               `❤️ <b>HP:</b> ${stats.hp}/${stats.maxHp}\n` +
               `${energyIcon} <b>${energyLabel}:</b> ${stats.ce}/${stats.maxCe}\n` +
               `⚔️ <b>ATK:</b> ${stats.atk} | ⚡ <b>SPD:</b> ${stats.speed}\n\n` +
               `<b>UPGRADE COST (Level):</b>\n` +
               `💰 ${coinCost} Coins | ✨ ${dustCost} Dust\n` +
               `<i>(Wallet: 💰 ${user.coins} | ✨ ${user.dust || 0})</i>\n\n` +
               `<b>AWAKENING:</b>\n` +
               `🧩 Shards: ${availableShards}/${currentStars < 5 ? currentStars + 1 : 'MAX'}`;

        const kb = [
            [
                Markup.button.callback('🆙 LEVEL UP', `roster_upg_lvl_${char._id}`),
                Markup.button.callback(`⭐️ AWAKEN${availableShards >= (currentStars + 1) ? ' (!)' : ''}`, `roster_upg_star_${char._id}`)
            ],
            [Markup.button.callback('🛰 DEPLOY: 1', `rost_dep_${char.charId}_0`), Markup.button.callback('🛰 DEPLOY: 2', `rost_dep_${char.charId}_1`), Markup.button.callback('🛰 DEPLOY: 3', `rost_dep_${char.charId}_2`)],
            [
                Markup.button.callback('💸 SELL', isTeam ? 'none' : `roster_release_conf_${char._id}`),
                Markup.button.callback('⬅️ BACK', 'roster_nav_details')
            ]
        ];

        try {
            if (ctx.callbackQuery && ctx.callbackQuery.message.photo) {
                return await ctx.editMessageCaption(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(kb) });
            } else if (ctx.callbackQuery) {
                await ctx.deleteMessage();
            }
        } catch(e) {}
        
        return media.sendPortrait(ctx, base, msg, Markup.inlineKeyboard(kb));
    },

    async executeLevelUp(ctx, rosterId) {
        const userId = ctx.from.id;
        const result = await upgradeService.levelUpCharacter(userId, rosterId);
        
        if (!result.success) {
            return ctx.answerCbQuery(result.msg, { show_alert: true });
        }

        await ctx.answerCbQuery("🎉 Level Up Successful!");
        return this.showCharacterDetails(ctx, rosterId);
    },

    async executeAwaken(ctx, rosterId) {
        const userId = ctx.from.id;
        const char = await db.roster.findOne({ _id: rosterId, userId });
        const user = await db.users.findOne({ telegramId: userId });
        
        if (!char || !user) return ctx.answerCbQuery("Data missing.");

        const currentStars = char.stars || 0;
        if (currentStars >= 5) return ctx.answerCbQuery("❌ Character is already MAX Awakened!", { show_alert: true });

        const cost = currentStars + 1;
        const availableShards = (user.shards && user.shards[char.charId]) ? user.shards[char.charId] : 0;

        if (availableShards < cost) {
            return ctx.answerCbQuery(`❌ Not enough shards! You need ${cost} Shards. You have ${availableShards}.`, { show_alert: true });
        }

        user.shards[char.charId] -= cost;
        await db.users.update({ telegramId: userId }, { $set: { shards: user.shards } });
        
        await db.roster.update({ _id: rosterId }, { $set: { stars: currentStars + 1 } });

        await ctx.answerCbQuery(`⭐️ AWAKENING SUCCESSFUL! ${char.charId} is now ${currentStars + 1}★!`, { show_alert: true });
        return this.showCharacterDetails(ctx, rosterId);
    },

    async executeDeployment(ctx, charId, slotIdx) {
        const userId = ctx.from.id;
        const user = await db.users.findOne({ telegramId: userId });
        if (!user) return ctx.reply("❌ Please register first.");

        // Check if in battle (since isUserBusy is not imported here, we check manually)
        if (ctx.session && ctx.session.activeBattle && ctx.session.activeBattle.status === 'ongoing') return ctx.answerCbQuery("⚠️ You cannot deploy characters while in a battle!", { show_alert: true });
        if (user.activeExplore && (user.activeExplore.status === 'found' || user.activeExplore.status === 'battling')) return ctx.answerCbQuery("⚠️ You cannot deploy characters while in a battle!", { show_alert: true });

        let teamIds = user.teamIds || ["Yuji Itadori", "Megumi Fushiguro", "Nobara Kugisaki"];

        teamIds[slotIdx] = charId;
        
        await db.users.update({ telegramId: userId }, { $set: { teamIds: teamIds } });
        await ctx.answerCbQuery(`✅ ${charId} deployed to Slot ${parseInt(slotIdx)+1}!`, { show_alert: true });
        
        const char = await db.roster.findOne({ charId: charId, userId: userId });
        return this.showCharacterDetails(ctx, char._id);
    }
};
