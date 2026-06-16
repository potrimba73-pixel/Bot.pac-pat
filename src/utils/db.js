import { MongoClient } from "mongodb";
import { CONFIG } from "../config/index.js";

let client = null;
let db = null;

// Cache em memória para performance
let cache = {
  tickets: {},
  avaliacoes: {},
  acceptedRules: [],
  messages: {},
};
let cacheLoaded = false;

export async function connectDB() {
  if (client) return db;

  try {
    client = new MongoClient(CONFIG.MONGODB_URI);
    await client.connect();
    db = client.db("pacpat_bot");

    // Carregar dados para cache
    await loadCache();

    console.log("[DB] ✅ MongoDB conectado com sucesso!");
    return db;
  } catch (error) {
    console.error("[DB] ❌ Erro ao conectar MongoDB:", error.message);
    console.log("[DB] ⚠️ A usar cache em memória (dados serão perdidos no restart)");
    return null;
  }
}

async function loadCache() {
  if (!db || cacheLoaded) return;

  try {
    // Tickets
    const ticketsCollection = db.collection("tickets");
    const tickets = await ticketsCollection.find({}).toArray();
    for (const t of tickets) {
      cache.tickets[t.id] = t;
    }

    // Avaliações
    const avalCollection = db.collection("avaliacoes");
    const avaliacoes = await avalCollection.find({}).toArray();
    for (const a of avaliacoes) {
      cache.avaliacoes[a.ticketId] = a.avaliacoes;
    }

    // Regras aceites
    const rulesCollection = db.collection("acceptedRules");
    const rules = await rulesCollection.findOne({ _id: "rules" });
    if (rules) {
      cache.acceptedRules = rules.users || [];
    }

    // Mensagens dos painéis
    const msgCollection = db.collection("messages");
    const messages = await msgCollection.findOne({ _id: "panels" });
    if (messages) {
      cache.messages = messages.data || {};
    }

    cacheLoaded = true;
    console.log(`[DB] 📊 Cache carregado: ${Object.keys(cache.tickets).length} tickets`);
  } catch (error) {
    console.error("[DB] Erro ao carregar cache:", error.message);
  }
}

export async function saveDB() {
  if (!db) {
    console.log("[DB] ⚠️ MongoDB não conectado, dados apenas em memória");
    return;
  }

  try {
    // Salvar tickets
    const ticketsCollection = db.collection("tickets");
    for (const [id, ticket] of Object.entries(cache.tickets)) {
      await ticketsCollection.updateOne(
        { id: id },
        { $set: ticket },
        { upsert: true }
      );
    }

    // Salvar avaliações
    const avalCollection = db.collection("avaliacoes");
    for (const [ticketId, avaliacoes] of Object.entries(cache.avaliacoes)) {
      await avalCollection.updateOne(
        { ticketId: ticketId },
        { $set: { ticketId, avaliacoes } },
        { upsert: true }
      );
    }

    // Salvar regras aceites
    const rulesCollection = db.collection("acceptedRules");
    await rulesCollection.updateOne(
      { _id: "rules" },
      { $set: { users: cache.acceptedRules } },
      { upsert: true }
    );

    // Salvar mensagens dos painéis
    const msgCollection = db.collection("messages");
    await msgCollection.updateOne(
      { _id: "panels" },
      { $set: { data: cache.messages } },
      { upsert: true }
    );

    console.log("[DB] 💾 Dados salvos no MongoDB");
  } catch (error) {
    console.error("[DB] Erro ao salvar:", error.message);
  }
}

// Getter para a cache (compatível com código antigo)
export const db = {
  get tickets() { return cache.tickets; },
  set tickets(val) { cache.tickets = val; },
  get avaliacoes() { return cache.avaliacoes; },
  set avaliacoes(val) { cache.avaliacoes = val; },
  get acceptedRules() { return cache.acceptedRules; },
  set acceptedRules(val) { cache.acceptedRules = val; },
  get messages() { return cache.messages; },
  set messages(val) { cache.messages = val; },
};

// Para compatibilidade com código antigo que usa db diretamente
export default { db, saveDB, connectDB };
