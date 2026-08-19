import { logExternalMessageDelete } from "../services/externalLogs.js";

export async function handleMessageDelete(message) {
  if (message.author?.bot) return;
  if (!message.guild) return;

  // Apenas log externo (canal 1511421322134163547)
  try {
    await logExternalMessageDelete(message);
  } catch (e) {
    // Silencioso
  }
}
