// ============================================================
// messageCreate.js - Evento de mensagens (com assistente IA)
// ============================================================

import { EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config/index.js';
import { handleSmartResponse } from '../assistant/smartResponse.js';

export async function handleMessageCreate(message, client) {
  // ===== IGNORAR MENSAGENS DO BOT =====
  if (message.author.bot) return;

  // ===== IGNORAR MENSAGENS EM DMs =====
  if (!message.guild) return;

  // ===== IGNORAR MENSAGENS EM CANAIS DE TICKETS =====
  if (message.channel.name?.startsWith('ticket-')) return;

  // ===== IGNORAR COMANDOS =====
  if (message.content.startsWith('/')) return;

  // ===== PROCESSAR PERGUNTA NA IA =====
  await handleSmartResponse(message, client);
}
