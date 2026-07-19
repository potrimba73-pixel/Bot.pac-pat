import { logExternalMessageCreate } from "../services/externalLogs.js";

export async function handleMessageCreate(message, client) {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Log externo
  try {
    await logExternalMessageCreate(message);
  } catch (e) {
    // Silencioso
  }
}
