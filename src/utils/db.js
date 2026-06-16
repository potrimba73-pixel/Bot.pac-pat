import { MongoClient } from "mongodb";
import { CONFIG } from "../config/index.js";
import fs from "fs";
import path from "path";

let client = null;
let mongoDB = null;
let useMongo = false;

// Cache em memória
let cache = {
  tickets: {},
  avaliacoes: {},
  acceptedRules: [],
  messages: {},
};

const DB_PATH = path.resolve("db.json");

// ========== JSON FALLBACK ==========
function loadJSON() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      cache.tickets = data.tickets || {};
      cache.avaliacoes = data.avaliacoes || {};
      cache.acceptedRules = data.acceptedRules || [];
      cache.messages = data.messages || {};
      console.log(`[DB] 📂 JSON carregado: ${Object.keys(cache.tickets).length} tickets`);
    } else {
      console.log("[DB] 📂 Ficheiro JSON não encontrado, a criar novo.");
      saveJSON();
    }
  } catch (e) {
    console.error("[DB] Erro ao carregar JSON:", e.message);
  }
}

function saveJSON() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error("[DB] Erro ao guardar JSON:", e.message);
  }
}

// ========== MONGODB ==========
export async function connectDB() {
  // Se não há URI configurada, usar JSON
  if (!CONFIG.MONGODB_URI || CONFIG.MONGODB_URI === "") {
    console.log("[DB] ⚠️ MONGODB_URI não configurada, a usar JSON.");
    loadJSON();
    return;
  }

  try {
    client = new MongoClient(CONFIG.MONGODB_URI);
    await client.connect();
    mongoDB = client.db("pacpat_bot");
    useMongo = true;

    // Carregar para cache
    await loadMongoToCache();

    console.log("[DB] ✅ MongoDB conectado com sucesso!");
  } catch (error) {
    console.error("[DB] ❌ Erro ao conectar MongoDB:", error.message);
    console.log("[DB] ⚠️ A usar JSON como fallback.");
    loadJSON();
  }
}

async function loadMongoToCache() {
  if (!mongoDB) return;

  try {
    // Tickets
    const ticketsCol = mongoDB.collection("tickets");
    const tickets = await ticketsCol.find({}).toArray();
    for (const t of tickets) {
      cache.tickets[t.id] = t;
    }

    // Avaliações
    const avalCol = mongoDB.collection("avaliacoes");
    const avaliacoes = await avalCol.find({}).toArray();
    for (const a of avaliacoes) {
      cache.avaliacoes[a.ticketId] = a.avaliacoes;
    }

    // Regras
    const rulesCol = mongoDB.collection("acceptedRules");
    const rules = await rulesCol.findOne({ _id: "rules" });
    if (rules) cache.acceptedRules = rules.users || [];

    // Mensagens
    const msgCol = mongoDB.collection("messages");
    const messages = await msgCol.findOne({ _id: "panels" });
    if (messages) cache.messages = messages.data || {};

    console.log(`[DB] 📊 MongoDB cache: ${Object.keys(cache.tickets).length} tickets`);
  } catch (e) {
    console.error("[DB] Erro ao carregar MongoDB:", e.message);
  }
}

export async function saveDB() {
  // Guardar sempre no JSON (backup)
  saveJSON();

  // Se MongoDB disponível, guardar lá também
  if (useMongo && mongoDB) {
    try {
      // Tickets
      const ticketsCol = mongoDB.collection("tickets");
      for (const [id, ticket] of Object.entries(cache.tickets)) {
        await ticketsCol.updateOne({ id: id }, { $set: ticket }, { upsert: true });
      }

      // Avaliações
      const avalCol = mongoDB.collection("avaliacoes");
      for (const [ticketId, avaliacoes] of Object.entries(cache.avaliacoes)) {
        await avalCol.updateOne(
          { ticketId: ticketId },
          { $set: { ticketId, avaliacoes } },
          { upsert: true }
        );
      }

      // Regras
      const rulesCol = mongoDB.collection("acceptedRules");
      await rulesCol.updateOne(
        { _id: "rules" },
        { $set: { users: cache.acceptedRules } },
        { upsert: true }
      );

      // Mensagens
      const msgCol = mongoDB.collection("messages");
      await msgCol.updateOne(
        { _id: "panels" },
        { $set: { data: cache.messages } },
        { upsert: true }
      );

      console.log("[DB] 💾 MongoDB atualizado");
    } catch (e) {
      console.error("[DB] Erro ao guardar no MongoDB:", e.message);
    }
  }
}

// ========== GETTER/SETTER (compatível com código antigo) ==========
export const db = {
  get tickets() { return cache.tickets; },
  set tickets(val) { cache.tickets = val; saveJSON(); },
  get avaliacoes() { return cache.avaliacoes; },
  set avaliacoes(val) { cache.avaliacoes = val; saveJSON(); },
  get acceptedRules() { return cache.acceptedRules; },
  set acceptedRules(val) { cache.acceptedRules = val; saveJSON(); },
  get messages() { return cache.messages; },
  set messages(val) { cache.messages = val; saveJSON(); },
};

export default { db, saveDB, connectDB };
