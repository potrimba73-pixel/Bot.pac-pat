import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";
import { logExternalMessageUpdate } from "../services/externalLogs.js";

export async function handleMessageUpdate(oldMessage, newMessage, client) {
  if (newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  if (!newMessage.guild) return;

  // === NÃO ENVIAR LOG LOCAL NO CANAL 1457144182954266634 ===
  // O log local foi removido. Todos os logs de mensagens vão para o servidor externo.

  // Log externo (servidor 1510401803974475947, canal 1511421322134163547)
  await logExternalMessageUpdate(oldMessage, newMessage);
}
