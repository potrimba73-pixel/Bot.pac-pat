import fs from "node:fs";
import path from "node:path";

// ==================== CONFIGURAÇÃO ====================
const USE_MONGODB = process.env.USE_MONGODB === "true";
const MONGO_URI = process.env.MONGO_URI || null;
const DB_NAME = process.env.MONGO_DB_NAME || "pac_bot";
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || "./tickets.json";

// Tentar importar mongodb dinamicamente (para não crashar se não estiver instalado)
let MongoClient = null;
if (USE_MONGODB && MONGO_URI) {
    try {
        const mongo = await import("mongodb");
        MongoClient = mongo.MongoClient;
        console.log("[DB] MongoDB importado com sucesso.");
    } catch (err) {
        console.warn("[DB] MongoDB não instalado. A usar JSON local.");
        console.warn("[DB] Para usar MongoDB, corre: npm install mongodb");
    }
}

// Cache em memória
export let db = {
    tickets: {},
    cooldowns: {},
    transcripts: {},
    settings: {},
    acceptedRules: [],
    messages: {},
    avaliacoes: {},
};

let mongoClient = null;
let mongoDb = null;
let lastSave = Date.now();
const SAVE_INTERVAL = 30000; // 30 segundos

// ==================== MONGODB ====================
async function connectMongo() {
    if (!MongoClient || !MONGO_URI) return false;
    try {
        mongoClient = new MongoClient(MONGO_URI, {
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        await mongoClient.connect();
        mongoDb = mongoClient.db(DB_NAME);
        console.log("[DB] MongoDB conectado com sucesso.");
        return true;
    } catch (err) {
        console.error("[DB] Erro ao conectar MongoDB:", err.message);
        console.log("[DB] A usar fallback JSON local.");
        return false;
    }
}

async function loadFromMongo() {
    if (!mongoDb) return;
    try {
        const collections = ["tickets", "cooldowns", "transcripts", "settings", "acceptedRules", "messages", "avaliacoes"];
        for (const col of collections) {
            const docs = await mongoDb.collection(col).find({}).toArray();
            const data = {};
            docs.forEach(doc => {
                const key = doc._key || doc._id?.toString();
                if (key) data[key] = doc.data || doc;
            });
            // Para arrays (acceptedRules), usar formato especial
            if (col === "acceptedRules") {
                const arrDoc = docs.find(d => d._key === "array");
                db[col] = arrDoc?.data || [];
            } else {
                db[col] = data;
            }
        }
        console.log("[DB] Dados carregados do MongoDB.");
    } catch (err) {
        console.error("[DB] Erro ao carregar do MongoDB:", err.message);
    }
}

async function saveToMongo() {
    if (!mongoDb) return;
    try {
        for (const [colName, data] of Object.entries(db)) {
            const collection = mongoDb.collection(colName);

            // Arrays precisam de tratamento especial
            if (Array.isArray(data)) {
                await collection.updateOne(
                    { _key: "array" },
                    { $set: { _key: "array", data: data, updatedAt: new Date() } },
                    { upsert: true }
                );
                continue;
            }

            const ops = Object.entries(data).map(([key, value]) => ({
                updateOne: {
                    filter: { _key: key },
                    update: { $set: { _key: key, data: value, updatedAt: new Date() } },
                    upsert: true,
                }
            }));
            if (ops.length > 0) {
                await collection.bulkWrite(ops);
            }
        }
    } catch (err) {
        console.error("[DB] Erro ao guardar no MongoDB:", err.message);
    }
}

// ==================== JSON LOCAL (FALLBACK) ====================
function loadLocal() {
    try {
        if (fs.existsSync(LOCAL_DB_PATH)) {
            const raw = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
            const parsed = JSON.parse(raw);
            db = { ...db, ...parsed };
            // Garantir que acceptedRules é sempre array
            if (!Array.isArray(db.acceptedRules)) db.acceptedRules = [];
            console.log("[DB] Dados carregados do JSON local.");
        } else {
            console.log("[DB] Ficheiro JSON não encontrado, a criar novo.");
            saveLocal();
        }
    } catch (err) {
        console.error("[DB] Erro ao carregar JSON:", err.message);
    }
}

function saveLocal() {
    try {
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error("[DB] Erro ao guardar JSON:", err.message);
    }
}

// ==================== API PÚBLICA ====================
export async function loadDB() {
    if (USE_MONGODB && MongoClient && MONGO_URI) {
        const connected = await connectMongo();
        if (connected) {
            await loadFromMongo();
            // Auto-save periódico
            setInterval(async () => {
                await saveToMongo();
            }, SAVE_INTERVAL);
            return;
        }
    }
    loadLocal();
    // Auto-save periódico
    setInterval(() => {
        saveLocal();
    }, SAVE_INTERVAL);
}

export async function saveDB() {
    if (mongoDb) {
        await saveToMongo();
    } else {
        saveLocal();
    }
}

export function getDB() {
    return db;
}

export function updateDB(key, value) {
    db[key] = value;
}
