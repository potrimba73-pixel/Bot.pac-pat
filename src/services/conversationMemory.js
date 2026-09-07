// src/services/conversationMemory.js
const memory = new Map();
const MAX_HISTORY = 5; // últimas 5 interações por canal

export function getConversationHistory(channelId) {
  return memory.get(channelId) || [];
}

export function addToConversation(channelId, userMessage, botResponse) {
  const history = memory.get(channelId) || [];
  history.push({ user: userMessage, bot: botResponse });
  if (history.length > MAX_HISTORY) history.shift();
  memory.set(channelId, history);
}

// Opcional: limpar memória antiga (para evitar crescimento infinito)
export function clearOldMemory(maxAge = 3600000) { // 1 hora
  // Não implementado para simplicidade, mas podes adicionar se quiseres.
}
