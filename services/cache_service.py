import time

class CacheService:
    def __init__(self):
        self.user_cache = {}
        self.ttl = 300

    def get_user(self, user_id):
        now = time.time()
        if user_id in self.user_cache and now < self.user_cache[user_id]['expires_at']:
            return self.user_cache[user_id]['data']
        return None

    def set_user(self, user_id, user):
        self.user_cache[user_id] = {
            "data": user,
            "expires_at": time.time() + self.ttl
        }

    def invalidate(self, user_id):
        if user_id in self.user_cache:
            del self.user_cache[user_id]

cache_service = CacheService()
