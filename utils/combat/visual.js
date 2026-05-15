const sharp = require('sharp');
const fs = require('fs');
const assets = require('../assets');

// Optimize Sharp Performance
// sharp.concurrency(2);
// sharp.cache(100);
// if (sharp.simd) sharp.simd(true);

/**
 * Visual Engine: Generates high-quality Pokemon GBA-style battle frames.
 */
module.exports = {
    async generateBattleScene(p1Char, p2Char, activeSide = 'p1') {
        try {
            // 1. Resolve asset paths (Use Pixel Art if available)
            const p1Path = assets.getPixelAssetPath(p1Char);
            const p2Path = assets.getPixelAssetPath(p2Char);

            // 2. Process Sprites (320x320 for zero overlap)
            const p1Sprite = await sharp(p1Path).resize(320, 320).toBuffer();
            const p1Glow = Buffer.from(`<svg><rect x="0" y="0" width="320" height="320" fill="none" stroke="#00e5ff" stroke-width="4" opacity="0.4" rx="10"/></svg>`);

            const p2Sprite = await sharp(p2Path).resize(320, 320).toBuffer();
            const p2Glow = Buffer.from(`<svg><rect x="0" y="0" width="320" height="320" fill="none" stroke="#ff1744" stroke-width="4" opacity="0.4" rx="10"/></svg>`);

            // 3. UI Logic & Layers
            const p1HP_Pct = Math.max(0, Math.min(1, p1Char.hp / (p1Char.maxHp || 100)));
            const p2HP_Pct = Math.max(0, Math.min(1, p2Char.hp / (p2Char.maxHp || 100)));
            const getHPColor = (pct) => pct > 0.5 ? '#00ff88' : pct > 0.2 ? '#ffcc00' : '#ff4444';

            // Get last action text
            const lastLog = p1Char.lastAction || "BATTLE START!";
            const cleanLog = lastLog.replace(/<[^>]*>/g, '').toUpperCase();

            // SVG UI Layer: Simplified HUD (Fixed sides)
            const uiLayer = Buffer.from(`
                <svg width="1024" height="600">
                    <!-- HUD Backgrounds (P1 Left, P2 Right) -->
                    <rect x="40" y="20" width="400" height="70" rx="10" fill="rgba(10, 10, 20, 0.9)" stroke="#00e5ff" stroke-width="2"/>
                    <text x="60" y="50" font-family="Arial" font-size="22" fill="white" font-weight="bold">${p1Char.name.toUpperCase()}</text>
                    <rect x="60" y="62" width="360" height="10" rx="5" fill="#222" />
                    <rect x="60" y="62" width="${p1HP_Pct * 360}" height="10" rx="5" fill="${getHPColor(p1HP_Pct)}" />

                    <rect x="564" y="20" width="400" height="70" rx="10" fill="rgba(10, 10, 20, 0.9)" stroke="#ff1744" stroke-width="2"/>
                    <text x="584" y="50" font-family="Arial" font-size="22" fill="white" font-weight="bold">${p2Char.name.toUpperCase()}</text>
                    <rect x="584" y="62" width="360" height="10" rx="5" fill="#222" />
                    <rect x="584" y="62" width="${p2HP_Pct * 360}" height="10" rx="5" fill="${getHPColor(p2HP_Pct)}" />

                    <!-- Dialogue Bar -->
                    <rect x="50" y="530" width="924" height="50" rx="10" fill="rgba(0,0,0,0.85)"/>
                    <text x="80" y="565" font-family="monospace" font-size="22" fill="#00ff88" font-weight="bold">${cleanLog}</text>
                </svg>
            `);

            // 4. Base Background (Cached)
            const bgPath = assets.REGISTRY["Battle_BG"];
            if (!global.bgBuffer && fs.existsSync(bgPath)) {
                global.bgBuffer = await sharp(bgPath).resize(1024, 600).toBuffer();
            }
            let base = global.bgBuffer ? sharp(global.bgBuffer) : sharp({ create: { width: 1024, height: 600, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } } });

            // 5. Final Composition (Quality 90 for clarity)
            return await base.composite([
                { input: p1Sprite, top: 110, left: 80 },   
                { input: p1Glow, top: 110, left: 80 },     
                { input: p2Sprite, top: 110, left: 644 },  
                { input: p2Glow, top: 110, left: 644 },    
                { input: uiLayer, top: 0, left: 0 }      
            ]).jpeg({ quality: 75 }).toBuffer();


        } catch (e) {
            console.error("Visual Generation Error:", e);
            return null;
        }
    },
 
    async generateGachaGrid(results) {
        try {
            const canvasWidth = 1600;
            const canvasHeight = 940;
            const itemWidth = 300;
            const itemHeight = 420;
            const spacingX = 15;
            const spacingY = 30;
            const startX = 25;
            const startY = 50;

            const rarityColors = {
                Common: "#b0bec5",
                Rare: "#2196f3",
                Epic: "#9c27b0",
                Legendary: "#ffca28",
                Mythic: "#f44336"
            };

            const compositions = [];

            for (let i = 0; i < results.length; i++) {
                const res = results[i];
                const char = res.character;
                const imgPath = assets.getAssetPath(char);
                const col = i % 5;
                const row = Math.floor(i / 5);

                const left = startX + col * (itemWidth + spacingX);
                const top = startY + row * (itemHeight + spacingY);

                // Process Portrait - use fit cover to maintain aspect ratio without stretching
                const portrait = await sharp(imgPath).resize(260, 260, { fit: 'cover' }).toBuffer();
                
                // Create Rarity Frame (SVG)
                const frameColor = rarityColors[char.rarity] || "#ffffff";
                
                // Background goes UNDER portrait
                const bgFrame = Buffer.from(`
                    <svg width="${itemWidth}" height="${itemHeight}">
                        <rect x="5" y="5" width="290" height="410" rx="20" fill="rgba(20,20,30,0.8)" stroke="none"/>
                    </svg>
                `);

                // Foreground border and text goes OVER portrait
                const fgFrame = Buffer.from(`
                    <svg width="${itemWidth}" height="${itemHeight}">
                        <rect x="5" y="5" width="290" height="410" rx="20" fill="none" stroke="${frameColor}" stroke-width="6"/>
                        <text x="150" y="320" font-family="Arial" font-size="24" fill="white" font-weight="bold" text-anchor="middle">${char.name.toUpperCase()}</text>
                        <text x="150" y="355" font-family="Arial" font-size="18" fill="${frameColor}" font-weight="bold" text-anchor="middle">${char.rarity.toUpperCase()}</text>
                        ${res.isNew ? '<circle cx="260" cy="40" r="30" fill="#ff4444"/><text x="260" y="48" font-family="Arial" font-size="18" fill="white" font-weight="bold" text-anchor="middle">NEW</text>' : ''}
                    </svg>
                `);

                compositions.push({ input: bgFrame, top: top, left: left });
                compositions.push({ input: portrait, top: top + 20, left: left + 20 });
                compositions.push({ input: fgFrame, top: top, left: left });
            }

            // Create Dark Background
            const base = sharp({
                create: {
                    width: canvasWidth,
                    height: canvasHeight,
                    channels: 4,
                    background: { r: 10, g: 10, b: 15, alpha: 1 }
                }
            });

            return await base.composite(compositions).jpeg({ quality: 80 }).toBuffer();

        } catch (e) {
            console.error("Gacha Grid Generation Error:", e);
            return null;
        }
    }
};

