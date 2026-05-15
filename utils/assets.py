import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_DIR = os.path.join(BASE_DIR, 'images')
PIXEL_DIR = os.path.join(IMAGE_DIR, 'pixel_art')

# --- PRE-LOAD DIRECTORY LISTINGS ---
_image_files = []
_pixel_files = []
if os.path.exists(IMAGE_DIR):
    _image_files = os.listdir(IMAGE_DIR)
if os.path.exists(PIXEL_DIR):
    _pixel_files = os.listdir(PIXEL_DIR)

def refresh_file_lists():
    global _image_files, _pixel_files
    if os.path.exists(IMAGE_DIR):
        _image_files = os.listdir(IMAGE_DIR)
    if os.path.exists(PIXEL_DIR):
        _pixel_files = os.listdir(PIXEL_DIR)

REGISTRY = {
    # --- BANNERS ---
    "Academy": os.path.join(IMAGE_DIR, 'Academy.webp'),
    "Market": os.path.join(IMAGE_DIR, 'market_banner.webp'),
    "Altar": os.path.join(IMAGE_DIR, 'Altar.webp'),
    "Tournament": os.path.join(IMAGE_DIR, 'Academy.webp'),
    "Sorcerer_M": os.path.join(IMAGE_DIR, 'Sorcerer_Dossier.webp'),
    "Sorcerer_F": os.path.join(IMAGE_DIR, 'Sorcerer_Dossier.webp'),
    "Sorcerer_Dossier": os.path.join(IMAGE_DIR, 'Sorcerer_Dossier.webp'),
    "Tokyo_Logo": os.path.join(IMAGE_DIR, 'tokyo_logo.webp'),
    "Kyoto_Logo": os.path.join(IMAGE_DIR, 'kyoto_logo.webp'),


    "Curse_Low": os.path.join(IMAGE_DIR, 'CurseSpecial.webp'),
    "Curse_Special": os.path.join(IMAGE_DIR, 'CurseSpecial.webp'),
    "Battle_BG": os.path.join(IMAGE_DIR, 'jjk_battleground.webp'),
    "inventory": os.path.join(IMAGE_DIR, 'inventory.webp'),

    # --- ITEMS ---
    "katana": os.path.join(IMAGE_DIR, 'item_katana.webp'),
    "nails": os.path.join(IMAGE_DIR, 'item_nails.webp'),
    "cloud": os.path.join(IMAGE_DIR, 'item_cloud.webp'),
    "spear": os.path.join(IMAGE_DIR, 'item_spear.webp'),
    "scroll": os.path.join(IMAGE_DIR, 'item_scroll.webp'),
    "finger": os.path.join(IMAGE_DIR, 'item_finger.webp'),
    "reset_orb": os.path.join(IMAGE_DIR, 'item_reset_orb.webp'),
    "pill": os.path.join(IMAGE_DIR, 'item_pill.webp'),
    "elixir": os.path.join(IMAGE_DIR, 'item_elixir.webp'),
    "fragment": os.path.join(IMAGE_DIR, 'item_fragment.webp'),
    "dshard": os.path.join(IMAGE_DIR, 'item_dshard.webp'),
    "minor_hp_potion": os.path.join(IMAGE_DIR, 'item_minor_hp_potion.webp'),
    "ce_charge": os.path.join(IMAGE_DIR, 'item_ce_charge.webp'),
    "guard_stone": os.path.join(IMAGE_DIR, 'item_guard_stone.webp'),
    "lucky_charm": os.path.join(IMAGE_DIR, 'item_lucky_charm.webp'),
    "common_upgrade": os.path.join(IMAGE_DIR, 'item_common_upgrade.webp'),
    "gacha_ticket": os.path.join(IMAGE_DIR, 'item_gacha_ticket.webp'),
    "major_hp_potion": os.path.join(IMAGE_DIR, 'item_major_hp_potion.webp'),
    "black_flash_manual": os.path.join(IMAGE_DIR, 'item_black_flash_manual.webp'),
    "revive_token": os.path.join(IMAGE_DIR, 'item_revive_token.webp'),
    "special_grade_potion": os.path.join(IMAGE_DIR, 'item_special_grade_potion.webp'),
    "ce_core": os.path.join(IMAGE_DIR, 'item_ce_core.webp'),
    "gold_ingot": os.path.join(IMAGE_DIR, 'item_gold_ingot.webp'),
    
    # --- CHARACTERS ---
    "Yuji Itadori Early": os.path.join(IMAGE_DIR, 'YujiItadori.webp'),
    "Megumi Fushiguro Full": os.path.join(IMAGE_DIR, 'MegumiFushiguro.webp'),
    "Nobara Post-Awakening": os.path.join(IMAGE_DIR, 'NobaraKugisaki.webp'),
    "Gojo Satoru Full": os.path.join(IMAGE_DIR, 'GojoSatoru.webp'),
    "Ryomen Sukuna": os.path.join(IMAGE_DIR, 'RyomenSukuna.webp'),
    "Toji Fushiguro": os.path.join(IMAGE_DIR, 'TojiFushiguro.webp'),
    "Yuta Okkotsu": os.path.join(IMAGE_DIR, 'YutaOkkotsu.webp'),
    "Aoi Todo Master": os.path.join(IMAGE_DIR, 'AoiTodo.webp'),
    "Active Panda": os.path.join(IMAGE_DIR, 'ActivePanda.webp'),
    "Panda Power": os.path.join(IMAGE_DIR, 'Panda.webp'),
    "Maki Zenin Awakened": os.path.join(IMAGE_DIR, 'MakiZenin.webp'),
    "Inumaki Toge Full": os.path.join(IMAGE_DIR, 'InumakiToge.webp'),
    "Suguru Geto Peak": os.path.join(IMAGE_DIR, 'SuguruGeto.webp'),
    "Mei Mei Base": os.path.join(IMAGE_DIR, 'MeiMei.webp'),
    "Choso Full": os.path.join(IMAGE_DIR, 'choso.webp'),
    "Noritoshi Kamo Full": os.path.join(IMAGE_DIR, 'kamo.webp'),
    "Kasumi Miwa": os.path.join(IMAGE_DIR, 'KuzumiMiwa.webp'),
    "Kinji Hakari Base": os.path.join(IMAGE_DIR, 'HakariKinji.webp'),
    "Hakari Jackpot": os.path.join(IMAGE_DIR, 'HakariKinji.webp'),
    "Kirara Hoshi": os.path.join(IMAGE_DIR, 'KiraraHoshi.webp'),
    "Kento Nanami": os.path.join(IMAGE_DIR, 'NanamiKento.webp'),
    "Mai Zenin": os.path.join(IMAGE_DIR, 'MaiZenin.webp'),
    "Masamichi Yaga": os.path.join(IMAGE_DIR, 'MasamichiYaga.webp'),
    "Shoko Ieiri Support": os.path.join(IMAGE_DIR, 'ShokoIeiri.webp'),
    "Yuki Tsukumo Full": os.path.join(IMAGE_DIR, 'YukiTsukomo.webp'),
    "Sukuna 20F": os.path.join(IMAGE_DIR, 'Sukuna20F.webp'),
    "Awakened Gojo": os.path.join(IMAGE_DIR, 'AwakenedGojo.webp'),
    "Mahoraga": os.path.join(IMAGE_DIR, 'Mahoraga.webp'),
    "Kiyotaka Ijichi": os.path.join(IMAGE_DIR, 'KiyotakaIjichi.webp'),
    "Ijichi Kiyotaka": os.path.join(IMAGE_DIR, 'KiyotakaIjichi.webp'),
    "Akari Nitta": os.path.join(IMAGE_DIR, 'AkariNitta.webp'),
    "Utahime Iori": os.path.join(IMAGE_DIR, 'UtahimeIori.webp'),
    "Yoshinobu Gakuganji": os.path.join(IMAGE_DIR, 'YoshinobuGakuGanji.webp'),
    "Kokichi Muta": os.path.join(IMAGE_DIR, 'KokichiMuta.webp'),
    "Rika Full Curse": os.path.join(IMAGE_DIR, 'Rika.webp'),
    "Rika Uncontrolled": os.path.join(IMAGE_DIR, 'RikaUncontrolled.webp'),
    "Kenjaku All Curses": os.path.join(IMAGE_DIR, 'KenjakuAllCurses.webp'),
    "Naobito Zenin Prime": os.path.join(IMAGE_DIR, 'NaobitoZenin.webp'),
    "Jogo (Disaster Flame)": os.path.join(IMAGE_DIR, 'Jogo.webp'),
    "Mahito (Idle Transfiguration)": os.path.join(IMAGE_DIR, 'Mahito.webp'),
    "Dagon (Full Power)": os.path.join(IMAGE_DIR, 'DagonFull.webp'),
    "Rainbow Dragon": os.path.join(IMAGE_DIR, 'RainbowDragon.webp'),
    "Tamamo-no-Mae": os.path.join(IMAGE_DIR, 'Tamamo.webp'),
    "Kurourushi": os.path.join(IMAGE_DIR, 'Kurourushi.webp'),
    "Smallpox Deity": os.path.join(IMAGE_DIR, 'SmallpoxDeity.webp'),
    "Eso": os.path.join(IMAGE_DIR, 'Eso.webp'),
    "Kechizu": os.path.join(IMAGE_DIR, 'Kechizu.webp'),
    "Kuchisake-Onna": os.path.join(IMAGE_DIR, 'KuchisakeOnna.webp'),
    "Ganesha": os.path.join(IMAGE_DIR, 'Ganesha.webp'),
    "Finger Bearer": os.path.join(IMAGE_DIR, 'Finger-Bearer.webp'),
    "Higuruma Awakened": os.path.join(IMAGE_DIR, 'HIGURUMA AWAKENED.webp'),
    "Bakery Shoulder Curse": os.path.join(IMAGE_DIR, 'BakeryShoulderCurse.webp'),
    "School Lech": os.path.join(IMAGE_DIR, "Junpei'sSchoolLech.webp"),
    "Theater Parasite": os.path.join(IMAGE_DIR, 'TheaterParasiteCurse.webp'),
    "Yasoba Bridge Curse": os.path.join(IMAGE_DIR, 'YasobaBridgeCurse.webp'),
    "Juvenile Center Crawler": os.path.join(IMAGE_DIR, 'JuvenileCenterCrawler.webp'),
    "Sugisawa Ceiling": os.path.join(IMAGE_DIR, 'SugisawaCeiling.webp'),
    "Roppongi Eyeball Spider": os.path.join(IMAGE_DIR, 'RoppongiEyeballSpider.webp'),
    "Human Hand Spider": os.path.join(IMAGE_DIR, 'HumanHandSpider.webp'),
    "Night Parade Cyclops": os.path.join(IMAGE_DIR, 'NightParadeCyclops.webp'),
    "Occult Club Glutton": os.path.join(IMAGE_DIR, 'OccultClubGlutton.webp'),
    "Hanami Full Disaster": os.path.join(IMAGE_DIR, 'Hanami.webp'),
    "Dagon Full Disaster": os.path.join(IMAGE_DIR, 'DagonFull.webp'),
}

# Add Aliases
REGISTRY.update({
    "Sukuna": REGISTRY["Ryomen Sukuna"],
    "Gojo": REGISTRY["Gojo Satoru Full"],
    "Itadori": REGISTRY["Yuji Itadori Early"],
    "Fushiguro": REGISTRY["Megumi Fushiguro Full"],
    "Okkotsu": REGISTRY["Yuta Okkotsu"],
    "Geto": REGISTRY["Suguru Geto Peak"],
    "Maki": REGISTRY["Maki Zenin Awakened"],
    "Inumaki": REGISTRY["Inumaki Toge Full"],
    "Nanami": REGISTRY["Kento Nanami"],
})

def get_asset_path(name_or_item):
    if isinstance(name_or_item, str):
        char_name = name_or_item
    else:
        char_name = name_or_item.get('name', 'Academy')

    # 1. Exact Registry Match
    if char_name in REGISTRY:
        return REGISTRY[char_name]

    # 2. Fuzzy Registry Match
    for key in REGISTRY:
        if char_name.lower() in key.lower() or key.lower() in char_name.lower():
            return REGISTRY[key]

    # 3. Dynamic Lookup in images directory
    sanitized = char_name.lower().replace(" ", "")
    # Try common variations (removing 'Early', 'Full', etc)
    base_name = char_name.split(" ")[0].lower()
    
    # Priority 1: Contains full sanitized name
    for f in _image_files:
        low_f = f.lower()
        if sanitized in low_f:
            return os.path.join(IMAGE_DIR, f)
            
    # Priority 2: Contains base name (first word)
    for f in _image_files:
        low_f = f.lower()
        if base_name in low_f and len(base_name) > 3:
            return os.path.join(IMAGE_DIR, f)

    # 4. Fallback Logic
    is_curse = any(word in char_name.lower() for word in ["curse", "spirit", "mahoraga", "sukuna", "finger", "dagon", "hanami", "jogo", "mahito"])
    if is_curse:
        if "sukuna" in char_name.lower(): return REGISTRY.get("Ryomen Sukuna", REGISTRY["Academy"])
        if "mahoraga" in char_name.lower(): return REGISTRY.get("Mahoraga", REGISTRY["Academy"])
        return REGISTRY.get("Curse_Special", REGISTRY["Academy"])
    else:
        is_f = any(name in char_name.lower() for name in ['nobara', 'maki', 'shoko', 'mei', 'hana', 'miwa', 'momo', 'utahime', 'akari', 'mai', 'yuki'])
        fallback = REGISTRY.get("Sorcerer_F") if is_f else REGISTRY.get("Sorcerer_M")
        return fallback if fallback and os.path.exists(fallback) else REGISTRY["Academy"]

def get_pixel_asset_path(name_or_item):
    if isinstance(name_or_item, str):
        char_name = name_or_item
    else:
        char_name = name_or_item.get('name', 'Academy')

    aliases = {
        "ryomen sukuna": "sukuna",
        "megumi fushiguro": "megumi",
        "yuji itadori": "yuji",
        "gojo satoru": "gojo",
        "nobara kugisaki": "nobara",
        "maki zenin": "maki",
        "inumaki toge": "inumaki",
        "kento nanami": "nanami",
        "aoi todo": "todo",
        "toji fushiguro": "toji",
        "yuta okkotsu": "yuta",
        "suguru geto": "geto"
    }

    search_name = char_name.lower()
    search_name = aliases.get(search_name, search_name.split(" ")[0])

    for f in _pixel_files:
        if search_name in f.lower():
            return os.path.join(PIXEL_DIR, f)

    return get_asset_path(name_or_item)
