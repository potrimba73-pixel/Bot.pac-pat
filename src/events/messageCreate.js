import { logExternalMessageDelete } from "../services/externalLogs.js";

export async function handleMessageCreate(message, client) {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Log externo de mensagens criadas nao esta implementado
  // Podes adicionar logExternalMessageCreate no externalLogs.js se quiseres
}
