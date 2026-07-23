// ============================================================
// messageCreate.js - Evento de mensagens (com assistente IA)
// ============================================================

import { EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config/index.js';
import { gerarResposta, handleReacaoIA } from '../assistant/smartResponse.js';
import { safeReply } from '../utils/safeReply.js';

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
  const resposta = await gerarResposta(message, client);
  
  if (resposta) {
    // Construir embed com a resposta
    const embed = new EmbedBuilder()
      .setTitle(`${resposta.emoji || '🤖'} ${resposta.titulo || 'Assistente PAC'}`)
      .setDescription(resposta.resposta)
      .setColor(resposta.tipo === 'fora_assunto' ? 0xffaa00 : 0x00bfff)
      .setFooter({ 
        text: 'Portugal Alfa Community • Reage com 👍 ou 👎 para avaliar',
        iconURL: message.guild.iconURL()
      })
      .setTimestamp();

    // Enviar resposta
    const msg = await message.reply({ embeds: [embed] });

    // Guardar a pergunta no cache para as reações
    if (!client._iaPerguntas) client._iaPerguntas = {};
    client._iaPerguntas[msg.id] = message.content;

    // Reagir com 👍 e 👎 na mensagem do bot (já feito no smartResponse)
    // Mas vamos garantir que as reações estão lá
    try {
      await msg.react('👍');
      await msg.react('👎');
    } catch (e) {
      console.warn('[MessageCreate] Erro ao adicionar reações:', e.message);
    }

    return;
  }
}

// ===== EXPORTAR HANDLER DE REAÇÕES =====
export { handleReacaoIA };
