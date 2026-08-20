// ============================================================
// events/messageDelete.js
// Log de mensagens apagadas
// ============================================================

import { logExternalMessageDelete } from "../services/externalLogs.js";

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const PROCESSED_CACHE_TTL = 30_000;

// ============================================================
// CACHE DE EVENTOS PROCESSADOS
// ============================================================

const processedMessages = new Map();

// ============================================================
// LIMPEZA AUTOMÁTICA DO CACHE
// ============================================================

function limparCacheAntigo() {
  const agora = Date.now();

  for (const [messageId, timestamp] of processedMessages) {
    if (agora - timestamp > PROCESSED_CACHE_TTL) {
      processedMessages.delete(messageId);
    }
  }
}

// ============================================================
// HANDLER
// ============================================================

export async function handleMessageDelete(message) {
  // ----------------------------------------------------------
  // VALIDAÇÃO
  // ----------------------------------------------------------

  if (!message) return;

  if (!message.guild) return;

  if (message.author?.bot) return;

  if (!message.id) return;

  // ----------------------------------------------------------
  // PREVENIR DUPLICAÇÃO
  // ----------------------------------------------------------

  limparCacheAntigo();

  if (processedMessages.has(message.id)) {
    console.log(
      `[MessageDelete] ℹ️ Evento duplicado ignorado: ${message.id}`
    );

    return;
  }

  processedMessages.set(
    message.id,
    Date.now()
  );

  // ----------------------------------------------------------
  // LOG EXTERNO
  // ----------------------------------------------------------

  try {
    await logExternalMessageDelete(message);

    console.log(
      `[MessageDelete] 🗑️ Mensagem ${message.id} registada.`
    );
  } catch (err) {
    console.error(
      `[MessageDelete] ❌ Erro ao registar ${message.id}:`,
      err?.message || err
    );

    // Permite nova tentativa se o envio falhar.
    processedMessages.delete(message.id);
  }
}
