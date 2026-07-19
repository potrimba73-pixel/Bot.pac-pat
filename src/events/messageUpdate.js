import { logExternalMessageUpdate } from "../services/externalLogs.js";

export async function handleMessageUpdate(oldMessage, newMessage, client) {
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  if (!oldMessage.guild) return;

  try {
    await logExternalMessageUpdate(oldMessage, newMessage);
  } catch (e) {
    console.error("[MessageUpdate] Erro:", e.message);
  }
}
