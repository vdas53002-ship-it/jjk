from database import db

class AchievementService:
    def __init__(self):
        self.DATA = {
            "EXPLORE": [
                {"id": 'exp_1', "label": 'Cursed Scout', "threshold": 50, "reward": {"gachaTickets": 5}, "desc": '50 Expedition Steps complete kiye.'},
                {"id": 'exp_3', "label": 'Cursed Ruler', "threshold": 1000, "reward": {"gachaTickets": 25, "title": 'Cursed Ruler'}, "desc": '1000 Steps complete!'}
            ],
            "PVP": [
                {"id": 'pvp_1', "label": 'Street Fighter', "threshold": 10, "reward": {"coins": 5000}, "desc": '10 PvP matches jeetein.'},
                {"id": 'pvp_3', "label": 'God of War', "threshold": 250, "reward": {"shardsCurrency": 1000, "title": 'God of War'}, "desc": '250 Wins!'}
            ],
            "CATCH": [
                {"id": 'cat_1', "label": 'Spirit Sealer', "threshold": 10, "reward": {"gachaTickets": 5}, "desc": '10 spirits capture kiye.'}
            ]
        }

    async def update_progress(self, user_id, category, amount=1):
        user = await db.users.find_one({"telegramId": user_id})
        if not user: return []

        achievements = user.get('achievements', {"progress": {}, "completed": []})
        progress = achievements.get('progress', {})
        completed = achievements.get('completed', [])

        cat_key = category.upper()
        progress[cat_key] = progress.get(cat_key, 0) + amount
        
        cat_data = self.DATA.get(cat_key, [])
        new_completions = []

        for ach in cat_data:
            if ach['id'] in completed: continue
            if progress[cat_key] >= ach['threshold']:
                completed.append(ach['id'])
                new_completions.append(ach)
                
                # Award rewards
                reward = ach['reward']
                if 'coins' in reward: user['coins'] = user.get('coins', 0) + reward['coins']
                if 'gachaTickets' in reward: user['gachaTickets'] = user.get('gachaTickets', 0) + reward['gachaTickets']
                if 'title' in reward: user['title'] = reward['title']

        achievements['progress'] = progress
        achievements['completed'] = completed
        
        await db.users.update({"telegramId": user_id}, {"$set": {
            "achievements": achievements,
            "coins": user.get('coins', 0),
            "gachaTickets": user.get('gachaTickets', 0),
            "title": user.get('title', 'Wandering Soul')
        }})

        return new_completions

achievement_service = AchievementService()
