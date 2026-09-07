// src/services/iaCache.js
import { db, saveDB } from '../utils/db.js';

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function getCachedAnswer(question) {
  if (!db.iaCache) db.iaCache = {};
  const key = question.toLowerCase().trim();
  const entry = db.iaCache[key];
  if (entry && (Date.now() - entry.timestamp < CACHE_TTL)) {
    return entry.answer;
  }
  return null;
}

export function setCachedAnswer(question, answer, source = 'IA') {
  if (!db.iaCache) db.iaCache = {};
  const key = question.toLowerCase().trim();
  db.iaCache[key] = {
    answer,
    source,
    timestamp: Date.now()
  };
  saveDB(); // persistência imediata (pode ser assíncrono)
}
