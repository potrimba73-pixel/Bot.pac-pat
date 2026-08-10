// ============================================================
// utils/db.js - Sistema de Base de Dados (MongoDB + JSON Fallback)
// ============================================================

import { MongoClient } from "mongodb";
import { CONFIG } from "../config/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(process.cwd(), "db.json");
const BACKUP_PATH = path.resolve(process.cwd(), "db.backup.json");
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ============================================================
// ESTADO
// ============================================================
let client = null;
let mongoDB = null;
let useMongo = false;
let reconnectInterval = null;
let isSaving = false;
let saveQueue = [];

// ============================================================
// CACHE EM MEMÓRIA
// ============================================================
let cache = {
  tickets: {},
  avaliacoes: {},
  acceptedRules: [],
  acceptedRulesAt: {},
  messages: {},
  painelsHash: {},
  mapaConfig: {},
  ticketsCount: 0,
};

// ============================================================
// FUNÇÕES DE LOG
// ============================================================
function logDB(message, type = "info") {
  const prefix = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
    debug: "🔍"
  };
  console.log(`[DB] ${prefix[type] || "ℹ️"} ${message}`);
}

// ============================================================
// JSON FALLBACK
// ============================================================
function loadJSON() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      
      // ✅ Migração segura de dados
      cache.tickets = data.tickets || {};
      cache.avaliacoes = data.avaliacoes || {};
      cache.acceptedRules = data.acceptedRules || [];
      cache.acceptedRulesAt = data.acceptedRulesAt || {};
      cache.messages = data.messages || {};
      cache.painelsHash = data.painelsHash || {};
      cache.mapaConfig = data.mapaConfig || {};
      cache.ticketsCount = Object.keys(cache.tickets).length;
      
      logDB(`📂 JSON carregado: ${cache.ticketsCount} tickets`, "info");
    } else {
      logDB("📂 Ficheiro JSON não encontrado, a criar novo.", "warning");
      saveJSON();
    }
  } catch (e) {
    logDB(`Erro ao carregar JSON: ${e.message}`, "error");
    
    // ✅ Tentar restaurar backup
    if (fs.existsSync(BACKUP_PATH)) {
      try {
        logDB("🔄 A tentar restaurar backup...", "warning");
        const backupData = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf-8"));
        cache.tickets = backupData.tickets || {};
        cache.avaliacoes = backupData.avaliacoes || {};
        cache.acceptedRules = backupData.acceptedRules || [];
        cache.acceptedRulesAt = backupData.acceptedRulesAt || {};
        cache.messages = backupData.messages || {};
        cache.painelsHash = backupData.painelsHash || {};
        cache.mapaConfig = backupData.mapaConfig || {};
        cache.ticketsCount = Object.keys(cache.tickets).length;
        logDB(`✅ Backup restaurado: ${cache.ticketsCount} tickets`, "success");
      } catch (backupError) {
        logDB(`Erro ao restaurar backup: ${backupError.message}`, "error");
      }
    }
  }
}

function saveJSON() {
  try {
    // ✅ Criar backup antes de sobrescrever
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
    }
    
    fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
  } catch (e) {
    logDB(`Erro ao guardar JSON: ${e.message}`, "error");
  }
}

// ============================================================
// MONGODB - CONEXÃO
// ============================================================
export async function connectDB() {
  // Se não há URI configurada, usar JSON
  if (!CONFIG.MONGODB_URI || CONFIG.MONGODB_URI === "") {
    logDB("MONGODB_URI não configurada, a usar JSON.", "warning");
    loadJSON();
    return;
  }

  try {
    client = new MongoClient(CONFIG.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
    });

    // ✅ Event listeners para reconnect
    client.on("error", (err) => {
      logDB(`MongoDB error: ${err.message}`, "error");
      useMongo = false;
      scheduleReconnect();
    });

    client.on("close", () => {
      logDB("MongoDB connection closed.", "warning");
      useMongo = false;
      scheduleReconnect();
    });

    client.on("reconnect", () => {
      logDB("MongoDB reconectado!", "success");
      useMongo = true;
    });

    await client.connect();
    mongoDB = client.db("pacpat_bot");
    useMongo = true;

    // ✅ Verificar conexão com ping
    await mongoDB.command({ ping: 1 });
    logDB("MongoDB conectado com sucesso!", "success");

    // ✅ Carregar dados para cache
    await loadMongoToCache();

    // ✅ Criar índices
    await createIndexes();

  } catch (error) {
    logDB(`Erro ao conectar MongoDB: ${error.message}`, "error");
    logDB("A usar JSON como fallback.", "warning");
    loadJSON();
    scheduleReconnect();
  }
}

// ============================================================
// MONGODB - ÍNDICES
// ============================================================
async function createIndexes() {
  if (!mongoDB) return;
  
  try {
    const ticketsCol = mongoDB.collection("tickets");
    await ticketsCol.createIndex({ id: 1 }, { unique: true });
    await ticketsCol.createIndex({ userId: 1 });
    await ticketsCol.createIndex({ channelId: 1 });
    await ticketsCol.createIndex({ closed: 1 });
    await ticketsCol.createIndex({ type: 1 });
    await ticketsCol.createIndex({ openedAt: -1 });
    
    const rulesCol = mongoDB.collection("acceptedRules");
    await rulesCol.createIndex({ _id: 1 }, { unique: true });
    
    logDB("Índices MongoDB criados/verificados", "debug");
  } catch (e) {
    logDB(`Erro ao criar índices: ${e.message}`, "warning");
  }
}

// ============================================================
// MONGODB - RECONNECT
// ============================================================
function scheduleReconnect() {
  if (reconnectInterval) return;
  
  logDB("Reconnect agendado em 30s...", "warning");
  reconnectInterval = setTimeout(async () => {
    reconnectInterval = null;
    logDB("A tentar reconectar MongoDB...", "info");
    await connectDB();
  }, 30000);
}

// ============================================================
// MONGODB - CARREGAR PARA CACHE
// ============================================================
async function loadMongoToCache() {
  if (!mongoDB) return;

  try {
    // ✅ Tickets
    const ticketsCol = mongoDB.collection("tickets");
    const tickets = await ticketsCol.find({}).toArray();
    for (const t of tickets) {
      cache.tickets[t.id] = t;
    }

    // ✅ Avaliações
    const avalCol = mongoDB.collection("avaliacoes");
    const avaliacoes = await avalCol.find({}).toArray();
    for (const a of avaliacoes) {
      cache.avaliacoes[a.ticketId] = a.avaliacoes;
    }

    // ✅ Regras
    const rulesCol = mongoDB.collection("acceptedRules");
    const rules = await rulesCol.findOne({ _id: "rules" });
    if (rules) {
      cache.acceptedRules = rules.users || [];
      cache.acceptedRulesAt = rules.acceptedAt || {};
    }

    // ✅ Mensagens/Painéis
    const msgCol = mongoDB.collection("messages");
    const messages = await msgCol.findOne({ _id: "panels" });
    if (messages) {
      cache.messages = messages.data || {};
      cache.painelsHash = messages.painelsHash || {};
    }

    // ✅ Configuração do Mapa
    const mapCol = mongoDB.collection("mapaConfig");
    const mapa = await mapCol.findOne({ _id: "config" });
    if (mapa) {
      cache.mapaConfig = mapa.data || {};
    }

    cache.ticketsCount = Object.keys(cache.tickets).length;
    logDB(`📊 MongoDB cache: ${cache.ticketsCount} tickets`, "info");

  } catch (e) {
    logDB(`Erro ao carregar MongoDB: ${e.message}`, "error");
  }
}

// ============================================================
// MONGODB - GUARDAR (OTIMIZADO COM BULK WRITE)
// ============================================================
export async function saveDB() {
  // ✅ Evitar saves simultâneos
  if (isSaving) {
    return new Promise((resolve) => {
      saveQueue.push(resolve);
    });
  }

  isSaving = true;

  try {
    // ✅ Guardar sempre no JSON (backup)
    saveJSON();

    // ✅ Se MongoDB disponível, guardar lá também
    if (useMongo && mongoDB) {
      await saveToMongoDB();
    }

    return true;
  } catch (e) {
    logDB(`Erro ao guardar: ${e.message}`, "error");
    return false;
  } finally {
    isSaving = false;
    
    // ✅ Processar fila
    if (saveQueue.length > 0) {
      const resolvers = [...saveQueue];
      saveQueue = [];
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }
}

async function saveToMongoDB() {
  try {
    const operations = [];

    // ✅ Tickets - Bulk Write
    const ticketsCol = mongoDB.collection("tickets");
    const ticketOps = Object.entries(cache.tickets).map(([id, ticket]) => ({
      updateOne: {
        filter: { id: id },
        update: { $set: ticket },
        upsert: true
      }
    }));
    
    if (ticketOps.length > 0) {
      operations.push({ collection: "tickets", ops: ticketOps });
    }

    // ✅ Avaliações - Bulk Write
    const avalCol = mongoDB.collection("avaliacoes");
    const avalOps = Object.entries(cache.avaliacoes).map(([ticketId, avaliacoes]) => ({
      updateOne: {
        filter: { ticketId: ticketId },
        update: { $set: { ticketId, avaliacoes } },
        upsert: true
      }
    }));
    
    if (avalOps.length > 0) {
      operations.push({ collection: "avaliacoes", ops: avalOps });
    }

    // ✅ Executar operações em paralelo
    await Promise.all(operations.map(async ({ collection, ops }) => {
      const col = mongoDB.collection(collection);
      await col.bulkWrite(ops, { ordered: false });
    }));

    // ✅ Regras (documento único)
    const rulesCol = mongoDB.collection("acceptedRules");
    await rulesCol.updateOne(
      { _id: "rules" },
      { 
        $set: { 
          users: cache.acceptedRules,
          acceptedAt: cache.acceptedRulesAt,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    // ✅ Mensagens/Painéis (documento único)
    const msgCol = mongoDB.collection("messages");
    await msgCol.updateOne(
      { _id: "panels" },
      { 
        $set: { 
          data: cache.messages,
          painelsHash: cache.painelsHash,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    // ✅ Configuração do Mapa (documento único)
    const mapCol = mongoDB.collection("mapaConfig");
    await mapCol.updateOne(
      { _id: "config" },
      { 
        $set: { 
          data: cache.mapaConfig,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    logDB("💾 MongoDB atualizado (bulk write)", "debug");

  } catch (e) {
    logDB(`Erro ao guardar no MongoDB: ${e.message}`, "error");
    useMongo = false;
    throw e;
  }
}

// ============================================================
// FUNÇÕES DE UTILIDADE
// ============================================================

// ✅ Limpar tickets fechados antigos (mais de 30 dias)
export async function cleanOldTickets(daysOld = 30) {
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  let cleaned = 0;

  for (const [id, ticket] of Object.entries(cache.tickets)) {
    if (ticket.closed && new Date(ticket.closedAt).getTime() < cutoff) {
      delete cache.tickets[id];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logDB(`🧹 ${cleaned} tickets antigos removidos`, "info");
    await saveDB();
  }

  return cleaned;
}

// ✅ Obter estatísticas da DB
export function getDBStats() {
  const tickets = Object.values(cache.tickets);
  const openTickets = tickets.filter(t => !t.closed);
  const closedTickets = tickets.filter(t => t.closed);
  
  return {
    totalTickets: tickets.length,
    openTickets: openTickets.length,
    closedTickets: closedTickets.length,
    acceptedRules: cache.acceptedRules.length,
    avaliacoes: Object.keys(cache.avaliacoes).length,
    usingMongo: useMongo,
    cacheSize: JSON.stringify(cache).length,
  };
}

// ✅ Exportar cache para JSON (útil para debug)
export function exportCache() {
  return JSON.stringify(cache, null, 2);
}

// ✅ Importar dados (cuidado!)
export function importCache(data) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    cache.tickets = parsed.tickets || {};
    cache.avaliacoes = parsed.avaliacoes || {};
    cache.acceptedRules = parsed.acceptedRules || [];
    cache.acceptedRulesAt = parsed.acceptedRulesAt || {};
    cache.messages = parsed.messages || {};
    cache.painelsHash = parsed.painelsHash || {};
    cache.mapaConfig = parsed.mapaConfig || {};
    cache.ticketsCount = Object.keys(cache.tickets).length;
    saveDB();
    return true;
  } catch (e) {
    logDB(`Erro ao importar dados: ${e.message}`, "error");
    return false;
  }
}

// ============================================================
// GETTER/SETTER (compatível com código antigo)
// ============================================================
export const db = {
  get tickets() { return cache.tickets; },
  set tickets(val) { 
    cache.tickets = val; 
    cache.ticketsCount = Object.keys(val).length;
    saveDB(); 
  },
  
  get avaliacoes() { return cache.avaliacoes; },
  set avaliacoes(val) { 
    cache.avaliacoes = val; 
    saveDB(); 
  },
  
  get acceptedRules() { return cache.acceptedRules; },
  set acceptedRules(val) { 
    cache.acceptedRules = val; 
    saveDB(); 
  },
  
  get acceptedRulesAt() { return cache.acceptedRulesAt; },
  set acceptedRulesAt(val) { 
    cache.acceptedRulesAt = val; 
    saveDB(); 
  },
  
  get messages() { return cache.messages; },
  set messages(val) { 
    cache.messages = val; 
    saveDB(); 
  },
  
  get painelsHash() { return cache.painelsHash; },
  set painelsHash(val) { 
    cache.painelsHash = val; 
    saveDB(); 
  },
  
  get mapaConfig() { return cache.mapaConfig; },
  set mapaConfig(val) { 
    cache.mapaConfig = val; 
    saveDB(); 
  },
};

// ============================================================
// EXPORTAÇÕES
// ============================================================
export default { 
  db, 
  saveDB, 
  connectDB, 
  cleanOldTickets, 
  getDBStats,
  exportCache,
  importCache
};
