const types = require('./types');

// --- STAT GRADING SYSTEM ---
const GRADE_STATS = {
    "Grade 4":  { hp: [10, 15], atk: [1, 2], def: 1, spd: 11 },
    "Grade 3":  { hp: [15, 20], atk: [2, 2], def: 2, spd: 12 },
    "Grade 2":  { hp: [20, 28], atk: [2, 3], def: 2, spd: 13 },
    "Grade 1":  { hp: [30, 45], atk: [4, 5], def: 3, spd: 15 },
    "Special":  { hp: [50, 100], atk: [5, 8], def: 5, spd: 20 }
};

const DATA = {
    // --- COMMON (35 Characters) ---
    "Arata Nitta": { rarity: "Common", grade: "Grade 3", type: "Barrier" },
    "Kasumi Miwa": { rarity: "Common", grade: "Grade 3", type: "Close-range" },
    "Mai Zenin": { rarity: "Common", grade: "Grade 3", type: "Long-range" },
    "Ijichi Kiyotaka": { rarity: "Common", grade: "Grade 4", type: "Barrier" },
    "Momo Nishimiya": { rarity: "Common", grade: "Grade 3", type: "Long-range" },
    "Noritoshi Kamo Young": { rarity: "Common", grade: "Grade 3", type: "Long-range" },
    "Takuma Ino Early": { rarity: "Common", grade: "Grade 3", type: "Close-range" },
    "Young Maki": { rarity: "Common", grade: "Grade 4", type: "Close-range" },
    "Young Inumaki": { rarity: "Common", grade: "Grade 4", type: "Long-range" },
    "Young Megumi": { rarity: "Common", grade: "Grade 4", type: "Barrier" },
    "Nobara Early": { rarity: "Common", grade: "Grade 4", type: "Long-range" },
    "Utahime Low": { rarity: "Common", grade: "Grade 3", type: "Barrier" },
    "Shoko Ieiri Support": { rarity: "Common", grade: "Grade 3", type: "Barrier" },
    "Kusakabe Low": { rarity: "Common", grade: "Grade 2", type: "Close-range" },
    "Rin Amai": { rarity: "Common", grade: "Grade 4", type: "Close-range" },
    "Baku": { rarity: "Common", grade: "Grade 4", type: "Close-range" },
    "Grasshopper Curse": { rarity: "Common", grade: "Grade 2", type: "Close-range" },
    "Fly Head": { rarity: "Common", grade: "Grade 4", type: "Long-range" },
    "Transfigured Human": { rarity: "Common", grade: "Grade 3", type: "Close-range" },
    "Small Cursed Corpse": { rarity: "Common", grade: "Grade 4", type: "Close-range" },
    "Worm Pet": { rarity: "Common", grade: "Grade 4", type: "Barrier" },
    "Cursed Corpse Generic": { rarity: "Common", grade: "Grade 4", type: "Close-range" },
    "Chizuru CG": { rarity: "Common", grade: "Grade 3", type: "Long-range" },
    "Remi CG": { rarity: "Common", grade: "Grade 3", type: "Close-range" },
    "Tsumiki Fushiguro": { rarity: "Common", grade: "Grade 4", type: "Barrier" },
    "Ui Ui": { rarity: "Common", grade: "Grade 3", type: "Barrier" },
    "Kechizu Weak": { rarity: "Common", grade: "Grade 2", type: "Long-range" },
    "Eso Weak": { rarity: "Common", grade: "Grade 2", type: "Long-range" },
    "Haba Weak": { rarity: "Common", grade: "Grade 2", type: "Long-range" },
    "Jiro Awasaka Low": { rarity: "Common", grade: "Grade 2", type: "Barrier" },
    "Haruta Shigemo Low": { rarity: "Common", grade: "Grade 2", type: "Close-range" },
    "Larue Low": { rarity: "Common", grade: "Grade 2", type: "Close-range" },
    "Miguel Low": { rarity: "Common", grade: "Grade 1", type: "Close-range" },
    "Akari Nitta": { rarity: "Common", grade: "Grade 4", type: "Barrier" },

    // --- RARE (30 Characters) ---
    "Yuji Itadori Early": { rarity: "Rare", grade: "Grade 2", type: "Close-range" },
    "Megumi Fushiguro Full": { rarity: "Rare", grade: "Grade 2", type: "Barrier" },
    "Nobara Post-Awakening": { rarity: "Rare", grade: "Grade 2", type: "Long-range" },
    "Inumaki Toge Full": { rarity: "Rare", grade: "Grade 1", type: "Long-range" },
    "Panda Power": { rarity: "Rare", grade: "Grade 2", type: "Close-range" },
    "Inumaki Master": { rarity: "Rare", grade: "Grade 1", type: "Long-range" },
    "Noritoshi Kamo Full": { rarity: "Rare", grade: "Grade 1", type: "Long-range" },
    "Takuma Ino Full": { rarity: "Rare", grade: "Grade 1", type: "Close-range" },
    "Naobito Zenin Old": { rarity: "Rare", grade: "Grade 1", type: "Close-range" },
    "Naoya Zenin Human": { rarity: "Rare", grade: "Grade 1", type: "Close-range" },
    "Ogi Zenin": { rarity: "Rare", grade: "Grade 1", type: "Close-range" },
    "Reggie Star": { rarity: "Rare", grade: "Grade 1", type: "Barrier" },
    "Jiro Awasaka Full": { rarity: "Rare", grade: "Grade 2", type: "Barrier" },
    "Mechamaru Low": { rarity: "Rare", grade: "Grade 1", type: "Long-range" },
    "Choso Full": { rarity: "Rare", grade: "Special", type: "Long-range" },
    "Eso Full": { rarity: "Rare", grade: "Special", type: "Long-range" },
    "Kechizu Full": { rarity: "Rare", grade: "Special", type: "Long-range" },
    "Haba Full": { rarity: "Rare", grade: "Special", type: "Long-range" },
    "Finger Bearer": { rarity: "Rare", grade: "Special", type: "Long-range" },
    "Grasshopper Strong": { rarity: "Rare", grade: "Grade 2", type: "Close-range" },
    "Dagon Weak": { rarity: "Rare", grade: "Special", type: "Barrier" },
    "Hanami Weak": { rarity: "Rare", grade: "Special", type: "Barrier" },
    "Kurourushi Weak": { rarity: "Rare", grade: "Special", type: "Close-range" },
    "Smallpox Deity": { rarity: "Rare", grade: "Special", type: "Barrier" },
    "Uraume Weak": { rarity: "Rare", grade: "Special", type: "Long-range" },
    "Kirara Hoshi": { rarity: "Rare", grade: "Grade 1", type: "Barrier" },
    "Kokichi Muta": { rarity: "Rare", grade: "Grade 1", type: "Long-range" },

    // --- EPIC (20 Characters) ---
    "Kento Nanami": { rarity: "Epic", grade: "Grade 1", type: "Close-range" },
    "Aoi Todo Master": { rarity: "Epic", grade: "Grade 1", type: "Close-range" },
    "Mei Mei Base": { rarity: "Epic", grade: "Grade 1", type: "Long-range" },
    "Masamichi Yaga": { rarity: "Epic", grade: "Grade 1", type: "Barrier" },
    "Naobito Zenin Prime": { rarity: "Epic", grade: "Grade 1", type: "Close-range" },
    "Naoya Zenin Curse": { rarity: "Epic", grade: "Special", type: "Close-range" },
    "Maki Zenin Awakened": { rarity: "Epic", grade: "Grade 1", type: "Close-range" },
    "Kinji Hakari Base": { rarity: "Epic", grade: "Grade 1", type: "Close-range" },
    "Hiromi Higuruma Pre": { rarity: "Epic", grade: "Grade 1", type: "Close-range" },
    "Mechamaru Full": { rarity: "Epic", grade: "Grade 1", type: "Long-range" },
    "Choso Blood Master": { rarity: "Epic", grade: "Special", type: "Long-range" },
    "Dagon Full Disaster": { rarity: "Epic", grade: "Special", type: "Barrier" },
    "Hanami Full Disaster": { rarity: "Epic", grade: "Special", type: "Barrier" },
    "Mahito Weakened": { rarity: "Epic", grade: "Special", type: "Close-range" },
    "Jogo Weakened": { rarity: "Epic", grade: "Special", type: "Long-range" },
    "Kurourushi Full": { rarity: "Epic", grade: "Special", type: "Close-range" },
    "Takaba": { rarity: "Epic", grade: "Special", type: "Barrier" },
    "Hana Weak": { rarity: "Epic", grade: "Special", type: "Long-range" },
    "Uraume Full": { rarity: "Epic", grade: "Special", type: "Long-range" },
    "Yoshinobu Gakuganji": { rarity: "Epic", grade: "Grade 1", type: "Long-range" },
    "Utahime Iori": { rarity: "Epic", grade: "Grade 1", type: "Barrier" },

    // --- LEGENDARY (15 Characters) ---
    "Gojo Satoru Full": { rarity: "Legendary", grade: "Special", type: "Long-range" },
    "Ryomen Sukuna": { rarity: "Legendary", grade: "Special", type: "Close-range" },
    "Yuta Okkotsu": { rarity: "Legendary", grade: "Special", type: "Long-range" },
    "Kenjaku": { rarity: "Legendary", grade: "Special", type: "Barrier" },
    "Toji Fushiguro": { rarity: "Legendary", grade: "Grade 1", type: "Close-range" },
    "Jogo Full Power": { rarity: "Legendary", grade: "Special", type: "Long-range" },
    "Mahito Final": { rarity: "Legendary", grade: "Special", type: "Close-range" },
    "Suguru Geto Peak": { rarity: "Legendary", grade: "Special", type: "Long-range" },
    "Yuki Tsukumo Full": { rarity: "Legendary", grade: "Special", type: "Close-range" },
    "Higuruma Awakened": { rarity: "Legendary", grade: "Special", type: "Close-range" },
    "Hana Full": { rarity: "Legendary", grade: "Special", type: "Long-range" },
    "Hakari Jackpot": { rarity: "Legendary", grade: "Special", type: "Close-range" },
    "Kashimo Hajime": { rarity: "Legendary", grade: "Grade 1", type: "Long-range" },
    "Rika Full Curse": { rarity: "Legendary", grade: "Special", type: "Close-range" },

    // --- MYTHIC (5 Characters) ---
    "Sukuna 20F": { rarity: "Mythic", grade: "Special", type: "Close-range" },
    "Awakened Gojo": { rarity: "Mythic", grade: "Special", type: "Long-range" },
    "Mahoraga": { rarity: "Mythic", grade: "Special", type: "Close-range" },
    "Kenjaku All Curses": { rarity: "Mythic", grade: "Special", type: "Barrier" },
    "Rika Uncontrolled": { rarity: "Mythic", grade: "Special", type: "Close-range" }
};

const CUSTOM_MOVES = {
    // --- COMMON (Sorcerers) ---
    "Arata Nitta": [
        { name: "Healing Palm", dmg: [0, 0], ce: 15, type: "Barrier", effect: { type: "heal", val: 0.2 } },
        { name: "Protective Barrier", dmg: [0, 0], ce: 10, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.7 } },
        { name: "Basic Strike", dmg: [1, 1], ce: 0, type: "Close-range" },
        { name: "Pain Management", dmg: [0, 0], ce: 5, type: "Barrier", effect: { type: "buff", stat: "hp", val: 1.1 } }
    ],
    "Kasumi Miwa": [
        { name: "Simple Domain Slash", dmg: [1, 1], ce: 45, type: "Close-range" },
        { name: "Batto Sword Draw", dmg: [1, 1], ce: 25, type: "Close-range" },
        { name: "Quick Slash", dmg: [1, 1], ce: 0, type: "Close-range" },
        { name: "Simple Domain Stance", dmg: [0, 0], ce: 30, type: "Barrier", effect: { type: "buff", stat: "res", val: 1.5 } }
    ],
    "Mai Zenin": [
        { name: "Construction Bullet", dmg: [1, 1], ce: 5, type: "Long-range" },
        { name: "Pistol Shot", dmg: [1, 1], ce: 0, type: "Long-range" },
        { name: "Trap Setup", dmg: [0, 0], ce: 10, type: "Long-range", effect: { type: "buff", stat: "atk", val: 1.5 } },
        { name: "Sniper Stance", dmg: [0, 0], ce: 5, type: "Long-range", crit: 15 }
    ],
    "Ijichi Kiyotaka": [
        { name: "Panic Barrier", dmg: [0, 0], ce: 5, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.8 } },
        { name: "Call for Help", dmg: [0, 0], ce: 10, type: "Barrier", effect: { type: "swap" } },
        { name: "Nervous Stumble", dmg: [1, 1], ce: 0, type: "Close-range", effect: { type: "stun", chance: 0.2 } },
        { name: "Curtain Setup", dmg: [0, 0], ce: 15, type: "Barrier", effect: { type: "buff", stat: "res", val: 1.3 } }
    ],
    "Momo Nishimiya": [
        { name: "Broom Strike", dmg: [1, 1], ce: 0, type: "Close-range" },
        { name: "Tool Manipulation", dmg: [1, 1], ce: 5, type: "Long-range" },
        { name: "Wind Gust", dmg: [1, 1], ce: 10, type: "Long-range", effect: { type: "stun", chance: 0.1 } },
        { name: "Aerial Evasion", dmg: [0, 0], ce: 5, type: "Long-range", effect: { type: "evade" } }
    ],
    "Noritoshi Kamo Young": [
        { name: "Blood Arrow", dmg: [1, 1], ce: 5, type: "Long-range" },
        { name: "Crimson Bind", dmg: [1, 1], ce: 10, type: "Long-range", effect: { type: "stun", chance: 0.5 } },
        { name: "Blood Shield", dmg: [0, 0], ce: 5, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.9 } },
        { name: "Coagulation", dmg: [0, 0], ce: 10, type: "Barrier", effect: { type: "heal", val: 0.1 } }
    ],
    "Akari Nitta": [
        { name: "Support Call", dmg: [0, 0], ce: 5, type: "Barrier", effect: { type: "swap" } },
        { name: "Emergency First Aid", dmg: [0, 0], ce: 10, type: "Barrier", effect: { type: "heal", val: 0.1 } },
        { name: "Auxiliary Barrier", dmg: [0, 0], ce: 5, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.7 } },
        { name: "Panic Strike", dmg: [1, 1], ce: 0, type: "Close-range" }
    ],

    // --- COMMON (Curses) ---
    "Grasshopper Curse": [
        { name: "Jump Kick", dmg: [1, 1], ce: 5, type: "Close-range" },
        { name: "Leg Swipe", dmg: [1, 1], ce: 0, type: "Close-range" },
        { name: "Grasshopper Leap", dmg: [0, 0], ce: 10, type: "Close-range", effect: { type: "evade" } },
        { name: "Bug Mandibles", dmg: [1, 1], ce: 15, type: "Close-range" }
    ],
    "Fly Head": [
        { name: "Poison Sting", dmg: [1, 1], ce: 0, type: "Long-range", effect: { type: "poison", chance: 1.0, duration: 2, val: 0.03 } },
        { name: "Swarm", dmg: [1, 1], ce: 5, type: "Long-range" },
        { name: "Escape", dmg: [0, 0], ce: 0, type: "Long-range", effect: { type: "swap" } },
        { name: "Irritant Aura", dmg: [1, 1], ce: 5, type: "Barrier", effect: { type: "debuff", stat: "atk", val: 0.9 } }
    ],

    // --- RARE ---
    "Yuji Itadori Early": [
        { name: "Divergent Fist", dmg: [1, 1], ce: 50, type: "Close-range", effect: { type: "recoil", val: 0.1 } },
        { name: "Black Flash", dmg: [1, 1], ce: 100, type: "Close-range", crit: 15 },
        { name: "Cursed Strike", dmg: [1, 1], ce: 20, type: "Close-range" },
        { name: "Strong Punch", dmg: [1, 1], ce: 35, type: "Close-range" }
    ],
    "Megumi Fushiguro Full": [
        { name: "Chimera Shadow", dmg: [1, 1], ce: 60, type: "Barrier", aoe: true },
        { name: "Rabbit Escape", dmg: [0, 0], ce: 30, type: "Barrier", effect: { type: "evade" } },
        { name: "Max Elephant", dmg: [1, 1], ce: 70, type: "Long-range" },
        { name: "Shadow Garden", dmg: [2, 2], ce: 150, type: "Barrier", aoe: true, effect: { type: "stun", duration: 1 } }
    ],
    "Nobara Post-Awakening": [
        { name: "Resonance", dmg: [1, 1], ce: 15, type: "Long-range", effect: { type: "ignoreDef", val: 0.5 } },
        { name: "Hairpin", dmg: [1, 1], ce: 20, type: "Long-range", aoe: true },
        { name: "Straw Doll Strike", dmg: [1, 1], ce: 5, type: "Long-range" },
        { name: "Resonance Spike", dmg: [2, 2], ce: 100, type: "Long-range", effect: { type: "ignoreDef", val: 1.0 } }
    ],
    "Inumaki Master": [
        { name: "Blast Away", dmg: [1, 1], ce: 15, type: "Long-range" },
        { name: "Don't Move", dmg: [1, 1], ce: 20, type: "Long-range", effect: { type: "stun", duration: 1 } },
        { name: "Sleep", dmg: [0, 0], ce: 10, type: "Long-range", effect: { type: "stun", chance: 0.8 } },
        { name: "Speech Domain", dmg: [2, 2], ce: 100, type: "Long-range", aoe: true, effect: { type: "stun", duration: 1 } }
    ],
    "Panda Power": [
        { name: "Gorilla Mode", dmg: [0, 0], ce: 15, type: "Close-range", effect: { type: "buff", stat: "atk", val: 1.5 } },
        { name: "Drumbeat", dmg: [1, 1], ce: 10, type: "Close-range" },
        { name: "Unyielding", dmg: [0, 0], ce: 10, type: "Close-range", effect: { type: "heal", val: 0.15 } },
        { name: "Triple Core Strike", dmg: [2, 2], ce: 100, type: "Close-range", crit: 30 }
    ],
    "Noritoshi Kamo Full": [
        { name: "Piercing Blood", dmg: [1, 1], ce: 15, type: "Long-range" },
        { name: "Slicing Exorcism", dmg: [1, 1], ce: 20, type: "Long-range", aoe: true },
        { name: "Blood Manipulation", dmg: [0, 0], ce: 10, type: "Long-range", effect: { type: "buff", stat: "atk", val: 1.3 } },
        { name: "Crimson Bind", dmg: [2, 2], ce: 100, type: "Long-range", effect: { type: "stun", duration: 1 } }
    ],
    "Takuma Ino Full": [
        { name: "Auspicious Beast", dmg: [1, 1], ce: 15, type: "Close-range" },
        { name: "Kirin", dmg: [0, 0], ce: 10, type: "Close-range", effect: { type: "evade" } },
        { name: "Kaichi", dmg: [1, 1], ce: 5, type: "Close-range" },
        { name: "Ryu Dragon", dmg: [2, 2], ce: 100, type: "Long-range", aoe: true }
    ],
    "Naobito Zenin Old": [
        { name: "24 FPS Buff", dmg: [0, 0], ce: 10, type: "Close-range", effect: { type: "buff", stat: "atk", val: 1.2 } },
        { name: "Projection Strike", dmg: [1, 1], ce: 15, type: "Close-range" },
        { name: "Frame Trap", dmg: [1, 1], ce: 15, type: "Close-range", effect: { type: "stun", duration: 1 } },
        { name: "Falling Blossom Emotion", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true }
    ],
    "Naoya Zenin Human": [
        { name: "Projection Dash", dmg: [1, 1], ce: 15, type: "Close-range" },
        { name: "High-Speed Burst", dmg: [0, 0], ce: 10, type: "Close-range", effect: { type: "evade" } },
        { name: "7:3 Critical Strike", dmg: [1, 1], ce: 20, type: "Close-range", effect: { type: "ignoreDef", val: 0.4 } },
        { name: "Frame Trap Mastery", dmg: [2, 2], ce: 100, type: "Close-range", effect: { type: "stun", duration: 1 } }
    ],
    "Mechamaru Low": [
        { name: "Pigeon Viola", dmg: [1, 1], ce: 10, type: "Long-range" },
        { name: "Jet Boost", dmg: [0, 0], ce: 10, type: "Long-range", effect: { type: "evade" } },
        { name: "Albatross Shield", dmg: [0, 0], ce: 5, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.8 } },
        { name: "Ultimate Cannon", dmg: [2, 2], ce: 100, type: "Long-range", aoe: true }
    ],
    "Finger Bearer": [
        { name: "Purple Beam", dmg: [1, 1], ce: 15, type: "Long-range" },
        { name: "Cursed Blast", dmg: [1, 1], ce: 20, type: "Long-range", aoe: true },
        { name: "Speed Burst", dmg: [0, 0], ce: 10, type: "Close-range", effect: { type: "buff", stat: "atk", val: 1.2 } },
        { name: "Unfinished Domain", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true }
    ],
    "Smallpox Deity": [
        { name: "Gravestone", dmg: [1, 1], ce: 20, type: "Barrier", effect: { type: "stun", duration: 1 } },
        { name: "Burial", dmg: [1, 1], ce: 15, type: "Barrier" },
        { name: "3-Count Strike", dmg: [1, 1], ce: 10, type: "Barrier" },
        { name: "Graveyard Domain", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true, effect: { type: "stun", duration: 2 } }
    ],
    "Dagon Weak": [
        { name: "Water Spray", dmg: [1, 1], ce: 10, type: "Long-range" },
        { name: "Shikigami Summon", dmg: [1, 1], ce: 15, type: "Barrier" },
        { name: "Bubble Shield", dmg: [0, 0], ce: 5, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.8 } },
        { name: "Ocean Domain", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true }
    ],
    "Uraume Weak": [
        { name: "Frost Calm", dmg: [1, 1], ce: 15, type: "Long-range", effect: { type: "stun", chance: 0.3 } },
        { name: "Ice Fall", dmg: [1, 1], ce: 20, type: "Long-range", aoe: true },
        { name: "Ice Shield", dmg: [0, 0], ce: 10, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.7 } },
        { name: "Absolute Zero", dmg: [2, 2], ce: 100, type: "Long-range", effect: { type: "stun", duration: 1 } }
    ],
    "Kirara Hoshi": [
        { name: "Interstellar Flight", dmg: [0, 0], ce: 15, type: "Barrier", effect: { type: "evade" } },
        { name: "Star Attraction", dmg: [1, 1], ce: 10, type: "Barrier", effect: { type: "stun", chance: 0.4 } },
        { name: "Constellation Bind", dmg: [1, 1], ce: 20, type: "Barrier", effect: { type: "debuff", stat: "spd", val: 0.5 } },
        { name: "Southern Cross", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true }
    ],
    "Kokichi Muta": [
        { name: "Puppet Strike", dmg: [1, 1], ce: 5, type: "Close-range" },
        { name: "Mini-Cannon", dmg: [1, 1], ce: 10, type: "Long-range" },
        { name: "Wooden Shield", dmg: [0, 0], ce: 5, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.8 } },
        { name: "Cursed Energy Pulse", dmg: [2, 2], ce: 100, type: "Long-range", aoe: true }
    ],
    "Choso Full": [
        { name: "Piercing Blood", dmg: [1, 1], ce: 15, type: "Long-range" },
        { name: "Supernova", dmg: [1, 1], ce: 20, type: "Long-range", aoe: true },
        { name: "Blood Harden", dmg: [0, 0], ce: 10, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.7 } },
        { name: "Flowing Red Scale", dmg: [2, 2], ce: 100, type: "Barrier", effect: { type: "buff", stat: "atk", val: 2.0 } }
    ],

    // --- EPIC ---
    "Nanami Kento": [
        { name: "Ratio Technique", dmg: [1, 1], ce: 15, type: "Close-range", effect: { type: "ignoreDef", val: 0.5 } },
        { name: "Critical Blow", dmg: [1, 1], ce: 10, type: "Close-range", crit: 25 },
        { name: "Tool Strike", dmg: [1, 1], ce: 5, type: "Close-range" },
        { name: "Overtime Collapse", dmg: [1, 1], ce: 30, type: "Close-range" }
    ],
    "Aoi Todo Master": [
        { name: "Boogie Woogie", dmg: [0, 0], ce: 10, type: "Barrier", effect: { type: "swap" } },
        { name: "Black Flash Mastery", dmg: [1, 1], ce: 20, type: "Close-range", crit: 30 },
        { name: "Powerful Clap", dmg: [1, 1], ce: 15, type: "Barrier", effect: { type: "stun", chance: 0.5 } },
        { name: "Self-Embodiment", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true, effect: { type: "stun", duration: 1 } }
    ],
    "Maki Zenin Awakened": [
        { name: "Split Soul Strike", dmg: [1, 1], ce: 20, type: "Close-range", effect: { type: "ignoreDef", val: 0.7 } },
        { name: "Speed Blitz", dmg: [0, 0], ce: 15, type: "Close-range", effect: { type: "evade" } },
        { name: "Tool Combo", dmg: [1, 1], ce: 5, type: "Close-range" },
        { name: "Heavenly Physicality", dmg: [2, 2], ce: 100, type: "Close-range", crit: 20 }
    ],
    "Kinji Hakari Base": [
        { name: "Poker Shot", dmg: [1, 1], ce: 10, type: "Long-range" },
        { name: "Shutter Strike", dmg: [1, 1], ce: 15, type: "Close-range" },
        { name: "Gacha Roll Luck", dmg: [0, 0], ce: 20, type: "Barrier", effect: { type: "buff", stat: "atk", val: 1.5 } },
        { name: "Idle Death Gamble", dmg: [2, 2], ce: 100, type: "Barrier", effect: { type: "heal", val: 1.0 } }
    ],
    "Hiromi Higuruma Pre": [
        { name: "Gavel Strike", dmg: [1, 1], ce: 5, type: "Close-range" },
        { name: "Sentence: Guilt", dmg: [0, 0], ce: 20, type: "Barrier", effect: { type: "debuff", stat: "atk", val: 0.5 } },
        { name: "Extended Gavel", dmg: [1, 1], ce: 15, type: "Long-range" },
        { name: "Deadly Sentencing", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true, effect: { type: "stun", duration: 2 } }
    ],
    "Choso Blood Master": [
        { name: "Supernova Burst", dmg: [1, 1], ce: 20, type: "Long-range", aoe: true },
        { name: "Piercing Blood Flow", dmg: [1, 1], ce: 15, type: "Long-range" },
        { name: "Blood Armor Harden", dmg: [0, 0], ce: 10, type: "Barrier", effect: { type: "buff", stat: "def", val: 0.6 } },
        { name: "Flowing Red Scale Max", dmg: [3, 3], ce: 100, type: "Barrier", effect: { type: "buff", stat: "atk", val: 1.8 } }
    ],
    "Hanami Full Disaster": [
        { name: "Flower Field Aura", dmg: [1, 1], ce: 20, type: "Barrier", effect: { type: "stun", duration: 1 } },
        { name: "Wooden Root Strike", dmg: [1, 1], ce: 15, type: "Long-range" },
        { name: "Solar Beam", dmg: [1, 1], ce: 25, type: "Long-range", aoe: true },
        { name: "Ceremonial Light", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true }
    ],
    "Yoshinobu Gakuganji": [
        { name: "Electric Riff", dmg: [1, 1], ce: 15, type: "Long-range", aoe: true },
        { name: "Sonic Blast", dmg: [1, 1], ce: 10, type: "Long-range", effect: { type: "stun", chance: 0.3 } },
        { name: "Power Chord", dmg: [1, 1], ce: 20, type: "Long-range", effect: { type: "buff", stat: "atk", val: 1.3 } },
        { name: "Concert Finale", dmg: [2, 2], ce: 100, type: "Long-range", aoe: true }
    ],
    "Utahime Iori": [
        { name: "Ritual Dance", dmg: [0, 0], ce: 20, type: "Barrier", effect: { type: "buff", stat: "atk", val: 2.0 } },
        { name: "Solo Forbidden Area", dmg: [0, 0], ce: 30, type: "Barrier", effect: { type: "buff", stat: "ce", val: 1.5 } },
        { name: "Song of Courage", dmg: [0, 0], ce: 15, type: "Barrier", effect: { type: "heal", val: 0.2 } },
        { name: "Final Performance", dmg: [1, 1], ce: 100, type: "Barrier", aoe: true, effect: { type: "buff", stat: "res", val: 2.0 } }
    ],

    // --- LEGENDARY ---
    "Gojo Satoru Full": [
        { name: "Lapse Blue", dmg: [1, 1], ce: 50, type: "Long-range", effect: { type: "stun", chance: 0.2 } },
        { name: "Reversal Red", dmg: [1, 1], ce: 70, type: "Long-range" },
        { name: "Hollow Purple", dmg: [1, 2], ce: 110, type: "Long-range", aoe: true },
        { name: "Unlimited Void", dmg: [2, 2], ce: 180, type: "Barrier", aoe: true, effect: { type: "stun", duration: 3 } }
    ],
    "Ryomen Sukuna": [
        { name: "Cleave", dmg: [1, 1], ce: 15, type: "Close-range", effect: { type: "ignoreDef", val: 0.6 } },
        { name: "Dismantle", dmg: [1, 1], ce: 20, type: "Close-range", crit: 25 },
        { name: "Fire Arrow", dmg: [1, 2], ce: 25, type: "Long-range", effect: { type: "poison", val: 0.05 } },
        { name: "Malevolent Shrine", dmg: [3, 3], ce: 100, type: "Barrier", aoe: true }
    ],
    "Yuta Okkotsu": [
        { name: "Rika Strike", dmg: [1, 1], ce: 15, type: "Close-range" },
        { name: "Copy Technique", dmg: [0, 0], ce: 20, type: "Barrier", effect: { type: "buff", stat: "atk", val: 1.5 } },
        { name: "RCT Heal", dmg: [0, 0], ce: 25, type: "Barrier", effect: { type: "heal", val: 0.4 } },
        { name: "Pure Love Beam", dmg: [2, 2], ce: 100, type: "Long-range", aoe: true }
    ],
    "Kenjaku": [
        { name: "Spirit Manipulation", dmg: [1, 1], ce: 15, type: "Long-range", aoe: true },
        { name: "Anti-Gravity", dmg: [0, 0], ce: 20, type: "Barrier", effect: { type: "evade" } },
        { name: "Uzumaki", dmg: [1, 1], ce: 25, type: "Long-range", effect: { type: "ignoreDef", val: 0.8 } },
        { name: "Womb Profusion", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true }
    ],
    "Toji Fushiguro": [
        { name: "Split Soul Katana", dmg: [1, 1], ce: 15, type: "Close-range", effect: { type: "ignoreDef", val: 1.0 } },
        { name: "Inverted Spear", dmg: [1, 1], ce: 20, type: "Close-range", effect: { type: "stun", duration: 1 } },
        { name: "Playful Cloud", dmg: [1, 1], ce: 10, type: "Close-range", crit: 30 },
        { name: "Physical Prowess", dmg: [2, 2], ce: 100, type: "Close-range", buff: { type: "evade" } }
    ],
    "Mahoraga": [
        { name: "Sword of Extermination", dmg: [1, 1], ce: 20, type: "Close-range", effect: { type: "ignoreDef", val: 0.9 } },
        { name: "Adaptation", dmg: [0, 0], ce: 20, type: "Barrier", effect: { type: "heal", val: 0.3 } },
        { name: "Wheel Spin Blast", dmg: [1, 1], ce: 25, type: "Long-range", aoe: true },
        { name: "Zero-Sum Domain", dmg: [3, 3], ce: 100, type: "Barrier", aoe: true }
    ],
    "Sukuna 20F": [
        { name: "World Cutting Slash", dmg: [2, 2], ce: 30, type: "Long-range", effect: { type: "ignoreDef", val: 1.0 } },
        { name: "Dismantle Rain", dmg: [1, 1], ce: 25, type: "Close-range", aoe: true },
        { name: "Flame Core", dmg: [1, 1], ce: 20, type: "Long-range", effect: { type: "poison", val: 0.08 } },
        { name: "Malevolent Shrine Max", dmg: [4, 4], ce: 100, type: "Barrier", aoe: true }
    ],
    "Awakened Gojo": [
        { name: "Purple Unleashed", dmg: [2, 2], ce: 40, type: "Long-range", aoe: true },
        { name: "Infinity Shield", dmg: [0, 0], ce: 20, type: "Barrier", effect: { type: "evade" } },
        { name: "Maximum Blue", dmg: [1, 1], ce: 15, type: "Long-range", effect: { type: "stun", duration: 1 } },
        { name: "Unlimited Void Max", dmg: [3, 3], ce: 100, type: "Barrier", aoe: true, effect: { type: "stun", duration: 3 } }
    ],
    "Dagon Full Disaster": [
        { name: "Death Swarm", dmg: [1, 1], ce: 20, type: "Barrier", aoe: true },
        { name: "Water Prison", dmg: [1, 1], ce: 20, type: "Barrier", effect: { type: "stun", duration: 1 } },
        { name: "Shikigami Summon", dmg: [1, 1], ce: 15, type: "Barrier" },
        { name: "Horizon of Captivating Skandha", dmg: [2, 2], ce: 100, type: "Barrier", aoe: true, effect: { type: "stun", duration: 1 } }
    ]
};

// --- INITIALIZATION ---
const ALIASES = {
    "Panda": "Panda Power",
    "Megumi Fushiguro": "Megumi Fushiguro Full",
    "Inumaki Toge": "Inumaki Toge Full",
    "Nobara Kugisaki": "Nobara Post-Awakening",
    "Yuji Itadori": "Yuji Itadori Early",
    "Gojo Satoru": "Gojo Satoru Full",
    "Sukuna": "Ryomen Sukuna",
    "Nanami Kento": "Nanami Kento",
    "Nanami": "Nanami Kento",
    "Todo Aoi": "Aoi Todo Master",
    "Aoi Todo": "Aoi Todo Master",
    "Maki Zenin": "Young Maki",
    "Miwa Kasumi": "Kasumi Miwa",
    "Kasumi Miwa": "Kasumi Miwa",
    "Akari": "Akari Nitta",
    "Kirara": "Kirara Hoshi",
    "Gakuganji": "Yoshinobu Gakuganji",
    "Utahime": "Utahime Iori",
    "Muta": "Kokichi Muta"
};

for (const k in DATA) {
    const char = DATA[k];
    const grade = char.grade || 'Grade 3';
    
    let baseHp = 200, baseCe = 100, baseAtk = 15, baseSpd = 12, def = 5;
    let energyType = 'CE';

    if (grade === 'Grade 4') { baseHp = 150; baseCe = 50; baseAtk = 10; baseSpd = 10; def = 2; }
    if (grade === 'Grade 3') { baseHp = 250; baseCe = 80; baseAtk = 15; baseSpd = 12; def = 3; }
    if (grade === 'Grade 2') { baseHp = 400; baseCe = 120; baseAtk = 25; baseSpd = 15; def = 5; }
    if (grade === 'Grade 1') { baseHp = 800; baseCe = 200; baseAtk = 45; baseSpd = 18; def = 8; }
    if (grade === 'Special') { baseHp = 1500; baseCe = 400; baseAtk = 80; baseSpd = 25; def = 12; }

    const nameStr = k.toLowerCase();
    if (nameStr.includes('yuta')) { baseCe = 600; baseHp = 1300; }
    else if (nameStr.includes('toji') || nameStr.includes('maki')) { 
        baseCe = 250; 
        energyType = 'PE'; 
        baseHp = grade === 'Special' ? 2000 : (baseHp * 1.5);
        baseAtk = baseAtk * 1.5;
    }
    else if (nameStr.includes('hakari')) { baseHp = 2200; }
    else if (nameStr.includes('sukuna')) { baseHp = 2500; baseCe = 800; baseAtk = 120; }
    else if (nameStr.includes('gojo')) { baseHp = 2400; baseCe = 1000; baseAtk = 110; }
    else if (nameStr.includes('megumi')) { baseHp = baseHp * 0.8; baseCe = baseCe * 1.5; }
    
    char.name = k;
    char.maxHp = Math.floor(baseHp + (Math.random() * 50));
    char.hp = char.maxHp;
    char.atk = Math.floor(baseAtk + (Math.random() * 5));
    char.defense = def;
    char.speed = baseSpd;
    char.resilience = def;
    char.maxCe = baseCe;
    char.ce = baseCe;
    char.energyType = energyType;

    if (CUSTOM_MOVES[k]) {
        char.moves = JSON.parse(JSON.stringify(CUSTOM_MOVES[k]));
        char.moves.forEach(m => {
            if (m.dmg && Array.isArray(m.dmg)) {
                // Scale up by 15 roughly (because earlier it was divided by 100, now back up to ~150-300 scale)
                m.dmg[0] = Math.max(1, m.dmg[0] * 15);
                m.dmg[1] = Math.max(1, m.dmg[1] * 15);
            }
        });
    } else {
        char.moves = [
            { name: 'Basic Strike', dmg: [30, 50], ce: 0, type: 'Close-range' },
            { name: 'Cursed Surge', dmg: [60, 90], ce: 40, type: 'Long-range' },
            { name: 'Focus Energy', dmg: [0, 0], ce: 50, type: 'Barrier', effect: { type: 'buff', stat: 'atk', val: 1.5 } },
            { name: 'Domain Expansion', dmg: [250, 250], ce: 150, type: 'Barrier', aoe: true }
        ];
    }
}
// Map Aliases for existing players
for (const alias in ALIASES) {
    const target = ALIASES[alias];
    if (DATA[target] && !DATA[alias]) {
        DATA[alias] = JSON.parse(JSON.stringify(DATA[target]));
        DATA[alias].name = alias; // Keep the display name consistent with users' roster
    }
}

/**
 * Scales character stats based on level.
 */
DATA.scaleStats = function(char, level = 1) {
    const base = JSON.parse(JSON.stringify(char)); // Clone base stats
    
    // Scaling Logic:
    // HP: +150 per level
    // ATK: +25 per level
    // CE: +10 per level (Base 200)
    const scaled = {
        ...base,
        level: level,
        maxHp: Math.floor(base.maxHp + (level - 1) * 15),
        atk: Math.floor(base.atk + (level - 1) * 1.5),
        maxCe: Math.floor(200 + (level - 1) * 10)
    };
    
    scaled.hp = scaled.maxHp;
    scaled.ce = scaled.maxCe;
    
    return scaled;
};

module.exports = DATA;
