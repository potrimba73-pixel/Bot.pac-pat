// src/events/messageCreate.js
import { EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config/index.js';
import { handleSmartResponse } from '../assistant/smartResponse.js';
import { getSession } from '../utils/translationSessions.js';
import { translateText } from '../services/translator.js';

export async function handleMessageCreate(message, client) {
  // ===== IGNORAR MENSAGENS DO BOT =====
  if (message.author.bot) return;

  // ===== IGNORAR MENSAGENS EM DMs =====
  if (!message.guild) return;

  // =============================================
  // 🧭 SESSÃO DE TRADUÇÃO ATIVA?
  // =============================================
  const session = await getSession(message.channelId);
  if (session) {
    const { staffId, userId, userLang } = session;
    const authorId = message.author.id;

    // Apenas mensagens do staff ou do utilizador alvo são traduzidas
    if (authorId === staffId || authorId === userId) {
      const isStaff = authorId === staffId;
      const sourceLang = isStaff ? 'pt' : userLang;
      const targetLang = isStaff ? userLang : 'pt';

      try {
        const translated = await translateText(message.content, sourceLang, targetLang);
        if (translated && translated !== message.content) {
          const recipientId = isStaff ? userId : staffId;
          await message.reply({
            content: `🌐 **Tradução para <@${recipientId}>:**\n${translated}`,
            allowedMentions: { users: [recipientId] }
          });
        }
      } catch (error) {
        if (error.message.includes('máx')) {
          await message.reply(`⚠️ ${error.message}`);
        } else {
          console.error('[Tradução] Erro:', error);
        }
      }
    }
  }
  // =============================================

  // ===== IGNORAR MENSAGENS EM CANAIS DE TICKETS =====
  if (message.channel.name?.startsWith('ticket-')) return;

  // ===== IGNORAR COMANDOS =====
  if (message.content.startsWith('/')) return;

  // ===== PROCESSAR PERGUNTA NA IA =====
  await handleSmartResponse(message, client);
}
