const path = require('path');
const fs = require('fs');

const IMAGE_DIR = path.join(__dirname, '..', 'images');

const REGISTRY = {
    // --- BANNERS ---
    "Academy": path.join(IMAGE_DIR, 'Academy.jpg'),
    "Altar": path.join(IMAGE_DIR, 'Altar.jpg'),
    "Tournament": path.join(IMAGE_DIR, 'Academy.jpg'),
    "Sorcerer_M": path.join(IMAGE_DIR, 'SorcererM.jpg'),
    "Sorcerer_F": path.join(IMAGE_DIR, 'SorcererF.jpg'),
    "Curse_Low": path.join(IMAGE_DIR, 'CurseSpecial.jpg'),
    "Curse_Special": path.join(IMAGE_DIR, 'CurseSpecial.jpg'),
    "Battle_BG": path.join(IMAGE_DIR, 'jjk_battleground.png'),
    "inventory": path.join(IMAGE_DIR, 'inventory.jpg'),
    
    // --- CHARACTERS ---
    "Yuji Itadori": path.join(IMAGE_DIR, 'YujiItadori.jpg'),
    "Megumi Fushiguro": path.join(IMAGE_DIR, 'MegumiFushiguro.jpg'),
    "Nobara Kugisaki": path.join(IMAGE_DIR, 'NobaraKugisaki.jpg'),
    "Gojo Satoru": path.join(IMAGE_DIR, 'GojoSatoru.jpg'),
    "Ryomen Sukuna": path.join(IMAGE_DIR, 'RyomenSukuna.jpg'),
    "Toji Fushiguro": path.join(IMAGE_DIR, 'TojiFushiguro.jpg'),
    "Yuta Okkotsu": path.join(IMAGE_DIR, 'YutaOkkotsu.jpg'),
    "Aoi Todo": path.join(IMAGE_DIR, 'AoiTodo.jpg'),
    "Panda": path.join(IMAGE_DIR, 'Panda.jpg'),
    "Maki Zenin": path.join(IMAGE_DIR, 'MakiZenin.jpg'),
    "Inumaki Toge": path.join(IMAGE_DIR, 'TogeInumaki.jpg'),
    "Suguru Geto": path.join(IMAGE_DIR, 'SuguruGeto.jpg'),
    "Mei Mei": path.join(IMAGE_DIR, 'MeiMei.jpg'),
    "Choso": path.join(IMAGE_DIR, 'choso.jpg'),
    "Kamo": path.join(IMAGE_DIR, 'kamo.png'),
    "Kasumi Miwa": path.join(IMAGE_DIR, 'KuzumiMiwa.jpg'),
    
    // --- NEW CHARACTERS ---
    "Hakari Kinji": path.join(IMAGE_DIR, 'HakariKinji.jpg'),
    "Kirara Hoshi": path.join(IMAGE_DIR, 'KiraraHoshi.jpg'),
    "Kiyotaka Ijichi": path.join(IMAGE_DIR, 'KiyotakaIjichi.jpg'),
    "Mai Zenin": path.join(IMAGE_DIR, 'MaiZenin.jpg'),
    "Masamichi Yaga": path.join(IMAGE_DIR, 'MasamichiYaga.jpg'),
    "Kento Nanami": path.join(IMAGE_DIR, 'NanamiKento.jpg'),
    "Naobito Zenin": path.join(IMAGE_DIR, 'NaobitoZenin.jpg'),
    "Shoko Ieiri": path.join(IMAGE_DIR, 'ShokoIeiri.jpg'),
    "Yoshinobu Gakuganji": path.join(IMAGE_DIR, 'YoshinobuGakuGanji.jpg'),
    "Yuki Tsukumo": path.join(IMAGE_DIR, 'YukiTsukomo.jpg'),
    "Active Panda": path.join(IMAGE_DIR, 'ActivePanda.jpg'),
    "Rika Orimoto": path.join(IMAGE_DIR, 'Rika.jpg'),
    "Akari Nitta": path.join(IMAGE_DIR, 'AkariNitta.jpg'),
    "Kokichi Muta": path.join(IMAGE_DIR, 'KokichiMuta.jpg'),
    "Utahime Iori": path.join(IMAGE_DIR, 'UtahimeIori.jpg'),
    
    // --- ALIASES ---
    "Sukuna": path.join(IMAGE_DIR, 'RyomenSukuna.jpg'),
    "Gojo": path.join(IMAGE_DIR, 'GojoSatoru.jpg'),
    "Itadori": path.join(IMAGE_DIR, 'YujiItadori.jpg'),
    "Fushiguro": path.join(IMAGE_DIR, 'MegumiFushiguro.jpg'),
    "Okkotsu": path.join(IMAGE_DIR, 'YutaOkkotsu.jpg'),
    "Geto": path.join(IMAGE_DIR, 'SuguruGeto.jpg'),
    "Maki": path.join(IMAGE_DIR, 'MakiZenin.jpg'),
    "Inumaki": path.join(IMAGE_DIR, 'TogeInumaki.jpg'),
    "Nanami": path.join(IMAGE_DIR, 'NanamiKento.jpg'),
    "Hakari": path.join(IMAGE_DIR, 'HakariKinji.jpg'),
    "Yuki": path.join(IMAGE_DIR, 'YukiTsukomo.jpg'),
    "Shoko": path.join(IMAGE_DIR, 'ShokoIeiri.jpg'),
    "Yaga": path.join(IMAGE_DIR, 'MasamichiYaga.jpg'),
    "Mai": path.join(IMAGE_DIR, 'MaiZenin.jpg'),
    "Kirara": path.join(IMAGE_DIR, 'KiraraHoshi.jpg')
};

module.exports = {
    REGISTRY,
    IMAGE_DIR,
    
    getAssetPath(nameOrItem) {
        const charName = typeof nameOrItem === 'string' ? nameOrItem : (nameOrItem.name || 'Academy');
        
        // 1. Registry Match
        if (REGISTRY[charName]) return REGISTRY[charName];
        
        // 2. Fuzzy Registry Match
        const match = Object.keys(REGISTRY).find(key => charName.includes(key) || key.includes(charName));
        if (match) return REGISTRY[match];

        // 3. Dynamic FS Lookup
        const noSpaces = charName.replace(/\s+/g, '');
        const sanitized = charName.toLowerCase().split(' ').join('_');
        
        if (fs.existsSync(IMAGE_DIR)) {
            const files = fs.readdirSync(IMAGE_DIR);
            const extensions = ['.jpg', '.png', '.jpeg', '.gif'];
            
            // Try Patterns
            for (const ext of extensions) {
                const f = files.find(f => {
                    const low = f.toLowerCase();
                    return low === (noSpaces + ext).toLowerCase() || low === (sanitized + ext).toLowerCase();
                });
                if (f) return path.join(IMAGE_DIR, f);
            }
            
            // Try StartsWith
            const startMatch = files.find(f => f.toLowerCase().startsWith(noSpaces.toLowerCase()) || f.toLowerCase().startsWith(sanitized.toLowerCase()));
            if (startMatch) return path.join(IMAGE_DIR, startMatch);
        }

        // 4. Default Fallbacks
        const rarity = nameOrItem.rarity || 'Common';
        const isCurse = charName.toLowerCase().includes("curse") || charName.toLowerCase().includes("spirit");
        
        let fallback = REGISTRY["Academy"];
        if (isCurse) fallback = REGISTRY["Curse_Special"];
        else {
            const isF = charName.match(/nobara|maki|shoko|mei|hana|miwa|momo/i);
            fallback = isF ? REGISTRY["Sorcerer_F"] : REGISTRY["Sorcerer_M"];
        }

        return fs.existsSync(fallback) ? fallback : REGISTRY["Academy"];
    },

    getPixelAssetPath(nameOrItem) {
        const charName = typeof nameOrItem === 'string' ? nameOrItem : (nameOrItem.name || 'Academy');
        const PIXEL_DIR = path.join(IMAGE_DIR, 'pixel_art');
        
        if (fs.existsSync(PIXEL_DIR)) {
            const files = fs.readdirSync(PIXEL_DIR);
            
            let searchName = charName.toLowerCase();
            
            const aliases = {
                "ryomen sukuna": "sukuna",
                "megumi fushiguro": "megumi",
                "yuji itadori": "yuji",
                "gojo satoru": "gojo",
                "nobara kugisaki": "nobara",
                "maki zenin": "maki",
                "inumaki toge": "inumaki",
                "toge inumaki": "inumaki",
                "kento nanami": "nanami",
                "aoi todo": "todo",
                "toji fushiguro": "toji",
                "yuta okkotsu": "yuta",
                "suguru geto": "geto",
                "hakari kinji": "hakari",
                "mei mei": "meimei",
                "masamichi yaga": "yaga",
                "yoshinobu gakuganji": "gakuganji",
                "noritoshi kamo": "kamo"
            };
            
            if (aliases[searchName]) searchName = aliases[searchName];
            else searchName = searchName.split(" ")[0];
            
            const match = files.find(f => f.toLowerCase().includes(searchName));
            if (match) return path.join(PIXEL_DIR, match);
        }
        
        // Fallback to regular portrait if no pixel art found
        return this.getAssetPath(nameOrItem);
    }
};
