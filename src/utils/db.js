// ============================================================
// utils/db.js - Sistema de Base de Dados
// MongoDB + JSON Fallback + Cache + Backup + Atomic Save
// ============================================================

import { MongoClient } from "mongodb";
import { CONFIG } from "../config/index.js";
import fs from "fs";
import path from "path";

// ============================================================
// CONFIGURAÇÕES
// ============================================================

const DB_PATH = path.resolve(process.cwd(), "db.json");
const BACKUP_PATH = path.resolve(process.cwd(), "db.backup.json");
const TEMP_PATH = `${DB_PATH}.tmp`;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const RECONNECT_BASE_DELAY = 5000;
const RECONNECT_MAX_DELAY = 60000;

// ============================================================
// ESTADO
// ============================================================

let client = null;
let mongoDB = null;
let useMongo = false;

let reconnectTimeout = null;
let reconnectAttempts = 0;

let isSaving = false;
let saveRequested = false;
let savePromise = null;

let isInitialized = false;

// ============================================================
// CACHE EM MEMÓRIA
// ============================================================

const cache = {
  tickets: {},
  avaliacoes: {},
  acceptedRules: [],
  acceptedRulesAt: {},
  messages: {},
  painelsHash: {},
  mapaConfig: {},
};

// ============================================================
// LOG
// ============================================================

function logDB(message, type = "info") {
  const prefix = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
    debug: "🔍",
  };

  console.log(`[DB] ${prefix[type] || "ℹ️"} ${message}`);
}

// ============================================================
// HELPERS
// ============================================================

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getTicketsCount() {
  return Object.keys(cache.tickets).length;
}

function normalizeCache(data = {}) {
  return {
    tickets:
      data.tickets &&
      typeof data.tickets === "object" &&
      !Array.isArray(data.tickets)
        ? data.tickets
        : {},

    avaliacoes:
      data.avaliacoes &&
      typeof data.avaliacoes === "object" &&
      !Array.isArray(data.avaliacoes)
        ? data.avaliacoes
        : {},

    acceptedRules: Array.isArray(data.acceptedRules)
      ? data.acceptedRules
      : [],

    acceptedRulesAt:
      data.acceptedRulesAt &&
      typeof data.acceptedRulesAt === "object" &&
      !Array.isArray(data.acceptedRulesAt)
        ? data.acceptedRulesAt
        : {},

    messages:
      data.messages &&
      typeof data.messages === "object" &&
      !Array.isArray(data.messages)
        ? data.messages
        : {},

    painelsHash:
      data.painelsHash &&
      typeof data.painelsHash === "object" &&
      !Array.isArray(data.painelsHash)
        ? data.painelsHash
        : {},

    mapaConfig:
      data.mapaConfig &&
      typeof data.mapaConfig === "object" &&
      !Array.isArray(data.mapaConfig)
        ? data.mapaConfig
        : {},
  };
}

function applyCache(data) {
  const normalized = normalizeCache(data);

  cache.tickets = normalized.tickets;
  cache.avaliacoes = normalized.avaliacoes;
  cache.acceptedRules = normalized.acceptedRules;
  cache.acceptedRulesAt = normalized.acceptedRulesAt;
  cache.messages = normalized.messages;
  cache.painelsHash = normalized.painelsHash;
  cache.mapaConfig = normalized.mapaConfig;
}

// ============================================================
// JSON - LEITURA
// ============================================================

function readJSONFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");

  if (!raw.trim()) {
    throw new Error("Ficheiro JSON vazio.");
  }

  return JSON.parse(raw);
}

// ============================================================
// JSON - LOAD
// ============================================================

function loadJSON() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      logDB("📂 db.json não encontrado, a criar novo.", "warning");

      applyCache({});
      saveJSON();

      return true;
    }

    const data = readJSONFile(DB_PATH);

    applyCache(data);

    logDB(
      `📂 JSON carregado: ${getTicketsCount()} tickets`,
      "success"
    );

    return true;
  } catch (error) {
    logDB(
      `Erro ao carregar db.json: ${error.message}`,
      "error"
    );

    // --------------------------------------------------------
    // BACKUP
    // --------------------------------------------------------

    if (!fs.existsSync(BACKUP_PATH)) {
      logDB("Nenhum backup disponível.", "warning");

      applyCache({});
      return false;
    }

    try {
      logDB("🔄 A tentar restaurar backup...", "warning");

      const backupData = readJSONFile(BACKUP_PATH);

      applyCache(backupData);

      logDB(
        `✅ Backup restaurado: ${getTicketsCount()} tickets`,
        "success"
      );

      // Recriar db.json a partir do backup
      saveJSON();

      return true;
    } catch (backupError) {
      logDB(
        `Erro ao restaurar backup: ${backupError.message}`,
        "error"
      );

      applyCache({});
      return false;
    }
  }
}

// ============================================================
// JSON - SAVE ATÓMICO
// ============================================================

function saveJSON() {
  try {
    const serialized = JSON.stringify(cache, null, 2);

    // --------------------------------------------------------
    // Escrever primeiro para ficheiro temporário
    // --------------------------------------------------------

    fs.writeFileSync(TEMP_PATH, serialized, "utf-8");

    // --------------------------------------------------------
    // Backup do ficheiro atual
    // --------------------------------------------------------

    if (fs.existsSync(DB_PATH)) {
      try {
        fs.copyFileSync(DB_PATH, BACKUP_PATH);
      } catch (backupError) {
        logDB(
          `Aviso ao criar backup: ${backupError.message}`,
          "warning"
        );
      }
    }

    // --------------------------------------------------------
    // Substituição atómica
    // --------------------------------------------------------

    fs.renameSync(TEMP_PATH, DB_PATH);

    return true;
  } catch (error) {
    logDB(
      `Erro ao guardar JSON: ${error.message}`,
      "error"
    );

    // Limpar temporário se necessário
    try {
      if (fs.existsSync(TEMP_PATH)) {
        fs.unlinkSync(TEMP_PATH);
      }
    } catch {
      // Ignorar erro de limpeza
    }

    return false;
  }
}

// ============================================================
// MONGODB - CONNECT
// ============================================================

export async function connectDB() {
  if (!CONFIG.MONGODB_URI?.trim()) {
    logDB(
      "MONGODB_URI não configurada. A usar JSON.",
      "warning"
    );

    loadJSON();
    isInitialized = true;

    return false;
  }

  // Evitar múltiplas conexões simultâneas
  if (mongoDB && useMongo) {
    return true;
  }

  try {
    // Fechar cliente anterior
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignorar
      }

      client = null;
      mongoDB = null;
    }

    client = new MongoClient(CONFIG.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,

      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,

      retryWrites: true,
      retryReads: true,

      maxIdleTimeMS: 60000,
    });

    client.on("error", (error) => {
      logDB(
        `MongoDB error: ${error.message}`,
        "error"
      );

      handleMongoFailure();
    });

    client.on("close", () => {
      logDB(
        "Ligação MongoDB fechada.",
        "warning"
      );

      handleMongoFailure();
    });

    await client.connect();

    mongoDB = client.db("pacpat_bot");

    await mongoDB.command({ ping: 1 });

    useMongo = true;
    reconnectAttempts = 0;

    logDB(
      "MongoDB conectado com sucesso!",
      "success"
    );

    await loadMongoToCache();
    await createIndexes();

    isInitialized = true;

    return true;
  } catch (error) {
    logDB(
      `Erro ao conectar MongoDB: ${error.message}`,
      "error"
    );

    useMongo = false;
    mongoDB = null;

    // JSON continua a ser fonte local
    loadJSON();

    scheduleReconnect();

    isInitialized = true;

    return false;
  }
}

// ============================================================
// MONGODB - FAILURE
// ============================================================

function handleMongoFailure() {
  if (!useMongo) {
    scheduleReconnect();
    return;
  }

  useMongo = false;
  mongoDB = null;

  scheduleReconnect();
}

// ============================================================
// MONGODB - RECONNECT
// ============================================================

function scheduleReconnect() {
  if (reconnectTimeout) return;

  reconnectAttempts++;

  const delayMs = Math.min(
    RECONNECT_BASE_DELAY *
      Math.pow(2, reconnectAttempts - 1),
    RECONNECT_MAX_DELAY
  );

  logDB(
    `Reconexão MongoDB agendada em ${Math.round(
      delayMs / 1000
    )}s...`,
    "warning"
  );

  reconnectTimeout = setTimeout(async () => {
    reconnectTimeout = null;

    logDB(
      "🔄 A tentar reconectar MongoDB...",
      "info"
    );

    const connected = await connectDB();

    if (!connected) {
      scheduleReconnect();
    }
  }, delayMs);
}

// ============================================================
// MONGODB - LOAD CACHE
// ============================================================

async function loadMongoToCache() {
  if (!mongoDB) return;

  try {
    // Limpar cache antes de sincronizar
    applyCache({});

    // --------------------------------------------------------
    // TICKETS
    // --------------------------------------------------------

    const tickets = await mongoDB
      .collection("tickets")
      .find({})
      .toArray();

    for (const ticket of tickets) {
      if (ticket.id) {
        cache.tickets[String(ticket.id)] = ticket;
      }
    }

    // --------------------------------------------------------
    // AVALIAÇÕES
    // --------------------------------------------------------

    const avaliacoes = await mongoDB
      .collection("avaliacoes")
      .find({})
      .toArray();

    for (const item of avaliacoes) {
      if (item.ticketId) {
        cache.avaliacoes[String(item.ticketId)] =
          item.avaliacoes ?? [];
      }
    }

    // --------------------------------------------------------
    // REGRAS
    // --------------------------------------------------------

    const rules = await mongoDB
      .collection("acceptedRules")
      .findOne({ _id: "rules" });

    if (rules) {
      cache.acceptedRules = Array.isArray(rules.users)
        ? rules.users
        : [];

      cache.acceptedRulesAt =
        rules.acceptedAt &&
        typeof rules.acceptedAt === "object"
          ? rules.acceptedAt
          : {};
    }

    // --------------------------------------------------------
    // MENSAGENS / PAINÉIS
    // --------------------------------------------------------

    const messages = await mongoDB
      .collection("messages")
      .findOne({ _id: "panels" });

    if (messages) {
      cache.messages = messages.data || {};
      cache.painelsHash = messages.painelsHash || {};
    }

    // --------------------------------------------------------
    // MAPA
    // --------------------------------------------------------

    const mapa = await mongoDB
      .collection("mapaConfig")
      .findOne({ _id: "config" });

    if (mapa) {
      cache.mapaConfig = mapa.data || {};
    }

    logDB(
      `📊 Cache sincronizado: ${getTicketsCount()} tickets`,
      "success"
    );
  } catch (error) {
    logDB(
      `Erro ao carregar MongoDB: ${error.message}`,
      "error"
    );

    throw error;
  }
}

// ============================================================
// MONGODB - INDEXES
// ============================================================

async function createIndexes() {
  if (!mongoDB) return;

  try {
    const tickets = mongoDB.collection("tickets");

    await Promise.all([
      tickets.createIndex({ userId: 1 }),
      tickets.createIndex({ channelId: 1 }),
      tickets.createIndex({ type: 1 }),
      tickets.createIndex({ closed: 1 }),
      tickets.createIndex({ openedAt: -1 }),

      tickets.createIndex({
        userId: 1,
        closed: 1,
      }),

      tickets.createIndex({
        type: 1,
        closed: 1,
      }),

      tickets.createIndex({
        closed: 1,
        openedAt: -1,
      }),
    ]);

    // Índices para documentos usados com upsert
    await mongoDB
      .collection("avaliacoes")
      .createIndex(
        { ticketId: 1 },
        { unique: true }
      );

    logDB(
      "Índices MongoDB verificados/criados.",
      "debug"
    );
  } catch (error) {
    logDB(
      `Erro ao criar índices: ${error.message}`,
      "warning"
    );
  }
}

// ============================================================
// SAVE DB - COALESCING / QUEUE
// ============================================================

export async function saveDB() {
  saveRequested = true;

  if (savePromise) {
    return savePromise;
  }

  savePromise = (async () => {
    try {
      while (saveRequested) {
        saveRequested = false;
        isSaving = true;

        // ----------------------------------------------------
        // JSON é sempre persistido
        // ----------------------------------------------------

        const jsonSaved = saveJSON();

        if (!jsonSaved) {
          logDB(
            "Falha ao guardar JSON.",
            "error"
          );
        }

        // ----------------------------------------------------
        // MongoDB
        // ----------------------------------------------------

        if (useMongo && mongoDB) {
          try {
            await saveToMongoDB();
          } catch (error) {
            logDB(
              `MongoDB indisponível: ${error.message}`,
              "warning"
            );

            useMongo = false;
            mongoDB = null;

            scheduleReconnect();
          }
        }
      }

      return true;
    } catch (error) {
      logDB(
        `Erro crítico ao guardar: ${error.message}`,
        "error"
      );

      return false;
    } finally {
      isSaving = false;
    }
  })();

  try {
    return await savePromise;
  } finally {
    savePromise = null;
  }
}

// ============================================================
// MONGODB - SAVE
// ============================================================

async function saveToMongoDB() {
  if (!mongoDB) {
    throw new Error("MongoDB não disponível.");
  }

  // ----------------------------------------------------------
  // TICKETS
  // ----------------------------------------------------------

  const ticketOps = Object.entries(cache.tickets).map(
    ([id, ticket]) => ({
      updateOne: {
        filter: { id },
        update: {
          $set: {
            ...ticket,
            id,
          },
        },
        upsert: true,
      },
    })
  );

  // ----------------------------------------------------------
  // AVALIAÇÕES
  // ----------------------------------------------------------

  const avalOps = Object.entries(cache.avaliacoes).map(
    ([ticketId, avaliacoes]) => ({
      updateOne: {
        filter: { ticketId },
        update: {
          $set: {
            ticketId,
            avaliacoes,
          },
        },
        upsert: true,
      },
    })
  );

  // ----------------------------------------------------------
  // BULK OPERATIONS
  // ----------------------------------------------------------

  const bulkPromises = [];

  if (ticketOps.length > 0) {
    bulkPromises.push(
      mongoDB
        .collection("tickets")
        .bulkWrite(ticketOps, {
          ordered: false,
        })
    );
  }

  if (avalOps.length > 0) {
    bulkPromises.push(
      mongoDB
        .collection("avaliacoes")
        .bulkWrite(avalOps, {
          ordered: false,
        })
    );
  }

  await Promise.all(bulkPromises);

  // ----------------------------------------------------------
  // ACCEPTED RULES
  // ----------------------------------------------------------

  await mongoDB
    .collection("acceptedRules")
    .updateOne(
      { _id: "rules" },
      {
        $set: {
          users: cache.acceptedRules,
          acceptedAt: cache.acceptedRulesAt,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

  // ----------------------------------------------------------
  // MESSAGES / PANELS
  // ----------------------------------------------------------

  await mongoDB
    .collection("messages")
    .updateOne(
      { _id: "panels" },
      {
        $set: {
          data: cache.messages,
          painelsHash: cache.painelsHash,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

  // ----------------------------------------------------------
  // MAPA CONFIG
  // ----------------------------------------------------------

  await mongoDB
    .collection("mapaConfig")
    .updateOne(
      { _id: "config" },
      {
        $set: {
          data: cache.mapaConfig,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

  logDB(
    "💾 MongoDB atualizado.",
    "debug"
  );
}

// ============================================================
// CLEAN OLD TICKETS
// ============================================================

export async function cleanOldTickets(daysOld = 30) {
  if (
    !Number.isFinite(daysOld) ||
    daysOld < 1
  ) {
    throw new Error(
      "daysOld deve ser um número maior que 0."
    );
  }

  const cutoff =
    Date.now() -
    daysOld * 24 * 60 * 60 * 1000;

  let cleaned = 0;

  for (const [id, ticket] of Object.entries(
    cache.tickets
  )) {
    if (!ticket?.closed) continue;

    const closedAt = new Date(ticket.closedAt);

    if (
      Number.isNaN(closedAt.getTime())
    ) {
      continue;
    }

    if (closedAt.getTime() < cutoff) {
      delete cache.tickets[id];

      // Remover avaliações associadas
      delete cache.avaliacoes[id];

      cleaned++;
    }
  }

  if (cleaned > 0) {
    logDB(
      `🧹 ${cleaned} tickets antigos removidos.`,
      "info"
    );

    await saveDB();
  }

  return cleaned;
}

// ============================================================
// STATS
// ============================================================

export function getDBStats() {
  const tickets = Object.values(cache.tickets);

  let openTickets = 0;
  let closedTickets = 0;

  for (const ticket of tickets) {
    if (ticket?.closed) {
      closedTickets++;
    } else {
      openTickets++;
    }
  }

  return {
    totalTickets: tickets.length,
    openTickets,
    closedTickets,

    acceptedRules:
      cache.acceptedRules.length,

    avaliacoes:
      Object.keys(cache.avaliacoes).length,

    usingMongo: useMongo,

    initialized: isInitialized,

    saving: isSaving,

    cacheSize:
      Buffer.byteLength(
        JSON.stringify(cache),
        "utf8"
      ),
  };
}

// ============================================================
// EXPORT CACHE
// ============================================================

export function exportCache() {
  return JSON.stringify(
    clone(cache),
    null,
    2
  );
}

// ============================================================
// IMPORT CACHE
// ============================================================

export async function importCache(data) {
  try {
    const parsed =
      typeof data === "string"
        ? JSON.parse(data)
        : data;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        "Dados inválidos."
      );
    }

    applyCache(parsed);

    const saved = await saveDB();

    if (!saved) {
      throw new Error(
        "Não foi possível persistir os dados."
      );
    }

    logDB(
      `📥 Cache importado: ${getTicketsCount()} tickets.`,
      "success"
    );

    return true;
  } catch (error) {
    logDB(
      `Erro ao importar dados: ${error.message}`,
      "error"
    );

    return false;
  }
}

// ============================================================
// GETTER / SETTER
// Compatibilidade com código antigo
// ============================================================

export const db = {
  get tickets() {
    return cache.tickets;
  },

  set tickets(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new TypeError(
        "db.tickets deve ser um objeto."
      );
    }

    cache.tickets = value;
    saveDB();
  },

  get avaliacoes() {
    return cache.avaliacoes;
  },

  set avaliacoes(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new TypeError(
        "db.avaliacoes deve ser um objeto."
      );
    }

    cache.avaliacoes = value;
    saveDB();
  },

  get acceptedRules() {
    return cache.acceptedRules;
  },

  set acceptedRules(value) {
    if (!Array.isArray(value)) {
      throw new TypeError(
        "db.acceptedRules deve ser um array."
      );
    }

    cache.acceptedRules = value;
    saveDB();
  },

  get acceptedRulesAt() {
    return cache.acceptedRulesAt;
  },

  set acceptedRulesAt(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new TypeError(
        "db.acceptedRulesAt deve ser um objeto."
      );
    }

    cache.acceptedRulesAt = value;
    saveDB();
  },

  get messages() {
    return cache.messages;
  },

  set messages(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new TypeError(
        "db.messages deve ser um objeto."
      );
    }

    cache.messages = value;
    saveDB();
  },

  get painelsHash() {
    return cache.painelsHash;
  },

  set painelsHash(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new TypeError(
        "db.painelsHash deve ser um objeto."
      );
    }

    cache.painelsHash = value;
    saveDB();
  },

  get mapaConfig() {
    return cache.mapaConfig;
  },

  set mapaConfig(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new TypeError(
        "db.mapaConfig deve ser um objeto."
      );
    }

    cache.mapaConfig = value;
    saveDB();
  },
};

// ============================================================
// SHUTDOWN GRACEFUL
// ============================================================

export async function closeDB() {
  logDB(
    "🛑 A fechar sistema de base de dados...",
    "info"
  );

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Garantir persistência final
  await saveDB();

  if (client) {
    try {
      await client.close();

      logDB(
        "MongoDB desligado corretamente.",
        "success"
      );
    } catch (error) {
      logDB(
        `Erro ao fechar MongoDB: ${error.message}`,
        "warning"
      );
    }
  }

  client = null;
  mongoDB = null;
  useMongo = false;
}

// ============================================================
// EXPORTAÇÕES
// ============================================================

export default {
  db,
  saveDB,
  connectDB,
  closeDB,
  cleanOldTickets,
  getDBStats,
  exportCache,
  importCache,
};
