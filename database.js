const Datastore = require('nedb-promises');
const path = require('path');

const dbPath = (name) => path.join(__dirname, 'data', `${name}.db`);

const db = {
    users: Datastore.create({ filename: dbPath('users'), autoload: true }),
    roster: Datastore.create({ filename: dbPath('roster'), autoload: true }),
    battles: Datastore.create({ filename: dbPath('battles'), autoload: true }),
    clans: Datastore.create({ filename: dbPath('clans'), autoload: true }),
    quests: Datastore.create({ filename: dbPath('quests'), autoload: true }),
    items: Datastore.create({ filename: dbPath('items'), autoload: true }),
    settings: Datastore.create({ filename: dbPath('settings'), autoload: true })
};

// Ensure indexes for performance
db.users.ensureIndex({ fieldName: 'telegramId', unique: true });
db.roster.ensureIndex({ fieldName: 'userId' });

module.exports = db;
