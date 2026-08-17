import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";
import { formatDateFull, getClockEmoji } from "../utils/dateUtils.js";

export async function sendLog(ticketId, type, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket) return;

  const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
  if (!logChannel) {
    console.warn("[Logs] Canal de logs não encontrado:", CONFIG.CANAL_LOGS);
    return;
  }

  // ============ ABERTURA ============
  if (type === "open") {
    const isRecruitment = ticket.type === "recrutamento";
    const clockEmoji = getClockEmoji(new Date(ticket.openedAt));

    let description = `👤 **Aberto por:** <@${ticket.userId}> | \`${ticket.userName || ticket.username}\``;
    if (isRecruitment && ticket.truckyNome) {
      description += `\n🚛 **Trucky:** \`${ticket.truckyNome}\``;
    }
    description += `\n📝 **Tipo:** ${ticket.label}`;
    description += `\n\n${clockEmoji} **Abertura:** ${formatDateFull(ticket.openedAt)}`;
    description += `\n\n🎫 **Aceda ao ticket ao pressionar o botão abaixo**`;

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket Aberto - #${ticket.id}`)
      .setDescription(description)
      .setColor(0x2629F1)
      .setTimestamp(new Date(ticket.openedAt));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🎫 Ir para o Ticket')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${ticket.guildId}/${ticket.channelId}`)
    );

    await logChannel.send({ embeds: [embed], components: [row] });
  }

  // ============ FECHO ============
  if (type === "close") {
    const isRecruitment = ticket.type === "recrutamento";
    const recrutadoText = ticket.recrutado === true ? '✅ Sim' : ticket.recrutado === false ? '❌ Não' : 'N/A';
    const clockEmojiAbertura = getClockEmoji(new Date(ticket.openedAt));
    const clockEmojiFecho = getClockEmoji(ticket.closedAt ? new Date(ticket.closedAt) : new Date());

    let description = `👤 **Aberto por:** <@${ticket.userId}> | \`${ticket.userName || ticket.username}\``;
    
    if (isRecruitment && ticket.truckyNome) {
      description += `\n🚛 **Trucky:** \`${ticket.truckyNome}\``;
    }
    description += `\n📝 **Tipo:** ${ticket.label}`;
    
    description += `\n\n⚒️ **Assumido por:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Não assumido'}`;
    description += `\n⚒️ **Fechado por:** ${ticket.closedBy ? `<@${ticket.closedBy}>` : 'Não informado'}`;
    
    description += `\n\n↕ **Informações Adicionais:**`;
    description += `\n${clockEmojiAbertura} **Horários:**`;
    description += `\n• **Abertura:** ${formatDateFull(ticket.openedAt)}`;
    description += `\n• **Fechamento:** ${ticket.closedAt ? formatDateFull(ticket.closedAt) : 'N/A'}`;
    
    if (isRecruitment) {
      description += `\n🚛 **Nome no Trucky:**`;
      description += `\n• \`${ticket.truckyNome || 'Não informado'}\``;
      description += `\n💼 **Recrutado:**`;
      description += `\n• ${recrutadoText}`;
      if (ticket.fotoNome) {
        description += `\n📷 **Nome para Foto:**`;
        description += `\n• \`${ticket.fotoNome}\``;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🗑️ Ticket Fechado - #${ticket.id}`)
      .setDescription(description)
      .setColor(0x2629F1)
      .setTimestamp(ticket.closedAt ? new Date(ticket.closedAt) : new Date());

    await logChannel.send({ embeds: [embed] });
  }
}
