const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/jjk_bot';
const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
});

let _db;

/**
 * Drop-in wrapper for NeDB-promises compatibility.
 * This prevents having to rewrite all service files.
 */
class CollectionWrapper {
    constructor(collection) {
        this.collection = collection;
    }

    async find(query = {}) {
        return await this.collection.find(query).toArray();
    }

    async findOne(query = {}) {
        return await this.collection.findOne(query);
    }

    async update(query, update, options = {}) {
        let res;
        if (options.multi) {
            res = await this.collection.updateMany(query, update, options);
        } else {
            res = await this.collection.updateOne(query, update, options);
        }
        return res.modifiedCount || res.upsertedCount || 0;
    }

    async insert(doc) {
        if (Array.isArray(doc)) {
            const res = await this.collection.insertMany(doc);
            return doc; // NeDB returns the inserted documents
        }
        const res = await this.collection.insertOne(doc);
        return { ...doc, _id: res.insertedId };
    }

    async remove(query, options = {}) {
        if (options.multi) {
            return await this.collection.deleteMany(query);
        }
        return await this.collection.deleteOne(query);
    }

    async count(query = {}) {
        return await this.collection.countDocuments(query);
    }

    async ensureIndex(options) {
        const { fieldName, unique } = options;
        return await this.collection.createIndex({ [fieldName]: 1 }, { unique });
    }
}

const dbProxy = {
    _collections: {},
    get(target, prop) {
        if (prop === 'connect') return async () => {
            console.log(`📡 Attempting connection to: ${uri.replace(/:([^@]+)@/, ':****@')}`);
            await client.connect();
            _db = client.db();
            console.log('✅ MongoDB Connected Successfully');
        };

        if (!_db) {
            // If accessing before connect, return a dummy that will throw helpful error or just return the wrapper when ready
            // But usually the bot connects at startup.
            throw new Error(`Database not connected. Call db.connect() first.`);
        }

        if (!this._collections[prop]) {
            this._collections[prop] = new CollectionWrapper(_db.collection(prop));
        }
        return this._collections[prop];
    }
};

const db = new Proxy({}, dbProxy);

module.exports = db;
