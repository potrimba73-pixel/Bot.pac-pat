import { EmbedBuilder } from "discord.js";
import { logExternalMessageDelete } from "../services/externalLogs.js";

export async function handleMessageDelete(message) {
  if (message.author?.bot) return;
  if (!message.guild) return;

  // Log externo
  try {
    await logExternalMessageDelete(message);
  } catch (e) {
    // Silencioso - nao crasha se o log externo falhar
  }
}
