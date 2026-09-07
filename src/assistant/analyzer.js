// src/assistant/analyzer.js
import { ChannelType, PermissionsBitField } from "discord.js";
import { ASSISTANT_CONFIG } from "../config/index.js";
import { assistantMemory } from "../services/ajuda.js";

const HISTORY_CACHE_TTL = 3600000; // 1 hora
let lastHistoryFetch = 0;

// ============================================================
// FUNÇÕES AUXILIARES PARA EMBEDDINGS E SIMILARIDADE
// ============================================================

/**
 * Gera um vetor de embedding para um texto usando a API do Gemini.
 * Se a chave não estiver disponível, retorna null.
 */
async function getEmbedding(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/embedding-001",
        content: { parts: [{ text: text }] }
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.embedding?.values || null;
  } catch (e) {
    console.error("[Embedding] Erro:", e.message);
    return null;
  }
}

/**
 * Calcula a similaridade de cosseno entre dois vetores.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ============================================================
// CLASSE PRINCIPAL
// ============================================================

export class MessageAnalyzer {
  constructor(client) {
    this.client = client;
    this.rateLimitQueue = [];
  }

  async rateLimitDelay() {
    const now = Date.now();
    this.rateLimitQueue = this.rateLimitQueue.filter(t => now - t < 1000);
    if (this.rateLimitQueue.length >= 5) {
      await new Promise(r => setTimeout(r, 1000));
    }
    this.rateLimitQueue.push(now);
  }

  // ----------------------------------------------------------
  // Busca o histórico de mensagens do especialista
  // ----------------------------------------------------------
  async fetchExpertHistory(guild, userId, limit = 50) {
    if (Date.now() - lastHistoryFetch < HISTORY_CACHE_TTL && assistantMemory.diegoHistory?.length > 0) {
      return assistantMemory.diegoHistory;
    }

    const history = [];
    const textChannels = guild.channels.cache.filter(
      c => c.type === ChannelType.GuildText && 
           c.permissionsFor(this.client.user)?.has(PermissionsBitField.Flags.ViewChannel)
    );

    const channelsToFetch = Array.from(textChannels.values()).slice(0, 10);

    for (const channel of channelsToFetch) {
      try {
        await this.rateLimitDelay();
        if (!channel.permissionsFor(this.client.user)?.has(PermissionsBitField.Flags.ReadMessageHistory)) {
          continue;
        }
        const messages = await channel.messages.fetch({ limit: 100 });
        const expertMsgs = messages.filter(m => m.author.id === userId && m.content.length > 10);

        expertMsgs.forEach(msg => {
          const allMsgs = Array.from(messages.values())
            .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
          const idx = allMsgs.findIndex(m => m.id === msg.id);

          const context = [];
          if (idx > 0) {
            context.push({
              author: allMsgs[idx-1].author.username,
              content: allMsgs[idx-1].content.substring(0, 200)
            });
          }
          context.push({
            author: msg.author.username,
            content: msg.content.substring(0, 500)
          });

          history.push({
            content: msg.content.substring(0, 500),
            channel: channel.name,
            timestamp: msg.createdTimestamp,
            context,
            hasLinks: this.extractLinks(msg.content),
            isHelpful: this.isHelpfulMessage(msg.content)
          });
        });
      } catch (e) {
        if (e.code !== 50001 && e.code !== 50013) {
          console.log(`[Analyzer] Erro em ${channel.name}:`, e.message);
        }
      }
    }

    history.sort((a, b) => b.timestamp - a.timestamp);
    assistantMemory.diegoHistory = history.slice(0, limit);
    lastHistoryFetch = Date.now();
    return assistantMemory.diegoHistory;
  }

  // ----------------------------------------------------------
  // Utilitários (extração de links, deteção de ajuda)
  // ----------------------------------------------------------
  extractLinks(content) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.match(urlRegex) || [];
  }

  isHelpfulMessage(content) {
    const helpIndicators = [
      "podes", "posso", "ajuda", "configurar", "instalar",
      "link", "vídeo", "tutorial", "faz assim", "tenta",
      "precisas de", "baixa", "download", "mod", "plugin",
      "usa", "experimenta", "tens que", "deves", "recomendo"
    ];
    return helpIndicators.some(word => content.toLowerCase().includes(word));
  }

  // ----------------------------------------------------------
  // MÉTODO PRINCIPAL – busca semântica com fallback para keywords
  // ----------------------------------------------------------
  async findSimilarResponses(question, limit = 3) {
    const history = assistantMemory.diegoHistory;
    if (!history || history.length === 0) return [];

    // 1. Tentar busca por embeddings (se a chave Gemini estiver disponível)
    const questionEmbed = await getEmbedding(question);
    if (questionEmbed) {
      const scored = [];
      for (const item of history) {
        const itemEmbed = await getEmbedding(item.content);
        if (!itemEmbed) continue;
        const score = cosineSimilarity(questionEmbed, itemEmbed);
        scored.push({ ...item, score });
      }
      scored.sort((a, b) => b.score - a.score);
      const results = scored.filter(s => s.score > 0.5).slice(0, limit);
      if (results.length > 0) {
        return results;
      }
      // Se a busca semântica não encontrou nada, cai no fallback abaixo
    }

    // 2. FALLBACK: método baseado em palavras‑chave (original)
    return this._findSimilarResponsesKeyword(question, limit);
  }

  // ----------------------------------------------------------
  // MÉTODO ANTIGO (palavras‑chave) – mantido para fallback
  // ----------------------------------------------------------
  _findSimilarResponsesKeyword(question, limit = 3) {
    const history = assistantMemory.diegoHistory;
    if (!history || history.length === 0) return [];

    const questionLower = question.toLowerCase();
    const qWords = questionLower.split(/\s+/).filter(w => w.length > 3);
    if (qWords.length === 0) return [];

    const scored = history.map(h => {
      let score = 0;
      const contentLower = h.content.toLowerCase();

      qWords.forEach(word => {
        if (contentLower.includes(word)) score += 3;
      });

      if (h.isHelpful) score += 5;
      if (h.hasLinks.length > 0) score += 4;

      // Palavras específicas (câmara, console, etc.)
      const specificWords = ["camara", "camera", "console", "developer", "config.cfg", "numpad", "0", "teletransportar", "ctrl f9", "project alm", "insanux"];
      specificWords.forEach(word => {
        if (questionLower.includes(word) && contentLower.includes(word)) {
          score += 15;
        }
      });

      h.context.forEach(ctx => {
        qWords.forEach(word => {
          if (ctx.content.toLowerCase().includes(word)) score += 2;
        });
      });

      return { ...h, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score > 3).slice(0, limit);
  }
}
