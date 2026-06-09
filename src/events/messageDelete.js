import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";
import { logExternalMessageDelete } from "../services/externalLogs.js";

export async function handleMessageDelete(message, client) {
  if (message.author?.bot) return;
  if (!message.guild) return;

  // === NÃO ENVIAR LOG LOCAL NO CANAL 1457144182954266634 ===
  // O log local foi removido. Todos os logs de mensagens vão para o servidor externo.

  // Log externo (servidor 1510401803974475947, canal 1511421322134163547)
  await logExternalMessageDelete(message);
}
