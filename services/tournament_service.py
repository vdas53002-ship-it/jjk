import random
from database import db

class TournamentService:
    def __init__(self):
        self.current_tournament = {
            "registrations": [],
            "bracket": None,
            "status": 'open', # open, active, closed
            "winner": None
        }

    async def register_user(self, user_id, username):
        if self.current_tournament['status'] != 'open':
            return {"success": False, "msg": "Registration is closed for today."}
        
        if any(r['id'] == user_id for r in self.current_tournament['registrations']):
            return {"success": False, "msg": "You're already in the bracket!"}
        
        self.current_tournament['registrations'].append({"id": user_id, "username": username})
        return {"success": True, "msg": "✅ Succesfully enrolled in the Zenin Tournament! Bracket starts at 12:00 UTC."}

    async def generate_bracket(self):
        participants = self.current_tournament['registrations']
        if len(participants) < 2:
            self.current_tournament['status'] = 'closed'
            return {"success": False, "msg": "Not enough participants to start."}

        self.current_tournament['status'] = 'active'
        random.shuffle(participants)
        
        matches = []
        for i in range(0, len(participants), 2):
            if i + 1 < len(participants):
                matches.append({"p1": participants[i], "p2": participants[i+1], "winner": None})
            else:
                matches.append({"p1": participants[i], "p2": {"id": 0, "username": 'BYE'}, "winner": participants[i]})
        
        self.current_tournament['bracket'] = {
            "round": 1,
            "matches": matches
        }
        return {"success": True, "bracket": self.current_tournament['bracket']}

    def get_status(self):
        return {
            "count": len(self.current_tournament['registrations']),
            "status": self.current_tournament['status'],
            "bracket": self.current_tournament['bracket']
        }

tournament_service = TournamentService()
