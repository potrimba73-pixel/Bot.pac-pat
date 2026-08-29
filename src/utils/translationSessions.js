// src/utils/translationSessions.js
import { db, saveDB } from './db.js';

// Inicializa a coleção se não existir
if (!db.translationSessions) {
  db.translationSessions = {};
}

export async function startSession(channelId, staffId, userId, userLang = 'en') {
  db.translationSessions[channelId] = { staffId, userId, userLang };
  await saveDB();
}

export async function getSession(channelId) {
  return db.translationSessions[channelId] || null;
}

export async function endSession(channelId) {
  delete db.translationSessions[channelId];
  await saveDB();
}

export async function isActive(channelId) {
  return !!db.translationSessions[channelId];
}
