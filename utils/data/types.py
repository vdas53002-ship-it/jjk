class Types:
    TYPES = {
        'CLOSE': 'Close-range',
        'LONG': 'Long-range',
        'BARRIER': 'Barrier'
    }

    @staticmethod
    def get_multiplier(attacker_type, defender_type):
        if attacker_type == defender_type:
            return 1.0

        relationships = {
            'Close-range': {'Barrier': 1.5, 'Long-range': 0.75},
            'Long-range': {'Close-range': 1.5, 'Barrier': 0.75},
            'Barrier': {'Long-range': 1.5, 'Close-range': 0.75}
        }

        return relationships.get(attacker_type, {}).get(defender_type, 1.0)

types_system = Types()
