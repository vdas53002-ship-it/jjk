from database import db

class DomainService:
    DOMAINS = {
        "Yuji Itadori": {"name": "Physical Prowess", "effect": "Divergent hit guaranteed", "buff": {"attack": 1.2}},
        "Gojo Satoru": {"name": "Infinite Void", "effect": "Enemy stun 2 turns", "buff": {"crit": 50}},
        "Ryomen Sukuna": {"name": "Malevolent Shrine", "effect": "Splash damage all", "buff": {"attack": 1.5}},
        "Megumi Fushiguro": {"name": "Chimera Shadow Garden", "effect": "Clone attack", "buff": {"speed": 2.0}}
    }

    def get_domain(self, char_id):
        return self.DOMAINS.get(char_id, {"name": "Simple Domain", "effect": "Standard defensive buff", "buff": {"resilience": 1.2}})

    async def unlock_domain(self, user_id, char_id):
        user = await db.users.find_one({"telegramId": user_id})
        if not user or user.get('playerLevel', 1) < 40:
            return {"success": False, "msg": "Domain Expansion requires Level 40 Mastery!"}
        
        return {"success": True, "msg": f"🔥 {char_id} has unlocked their Domain: {self.get_domain(char_id)['name']}!"}

domain_service = DomainService()
