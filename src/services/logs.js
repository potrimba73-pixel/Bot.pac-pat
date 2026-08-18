import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";
import { formatDateFull, formatDateSimple, getClockEmoji, formatDuration, getDurationEmoji } from "../utils/dateUtils.js";

// ============================================================
// FUNÇÃO AUXILIAR: DATA COM TIMEZONE EUROPE/LISBON
// ============================================================
function formatDateWithTimezone(date, format = 'short') {
  const d = new Date(date);
  const timezone = 'Europe/Lisbon';
  const options = {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  if (format === 'full') {
    options.weekday = 'long';
  }
  return new Intl.DateTimeFormat('pt-PT', options).format(d);
}

function getUnixTimestamp(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

// ============================================================
// LOGS DE ABERTURA E FECHO
// ============================================================

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
    const duracao = formatDuration(ticket.openedAt, ticket.closedAt || new Date());
    const duracaoEmoji = getDurationEmoji(ticket.openedAt, ticket.closedAt || new Date());

    let description = `👤 **Aberto por:** <@${ticket.userId}> | \`${ticket.userName || ticket.username}\``;
    
    if (isRecruitment && ticket.truckyNome) {
      description += `\n🚛 **Trucky:** \`${ticket.truckyNome}\``;
    }
    description += `\n📝 **Tipo:** ${ticket.label}`;
    
    description += `\n\n⚒️ **Assumido por:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Não assumido'}`;
    description += `\n⚒️ **Fechado por:** ${ticket.closedBy ? `<@${ticket.closedBy}>` : 'Não informado'}`;
    
    description += `\n\n↕ **Informações Adicionais:**`;
    description += `\n🕑 **Horários:**`;
    description += `\n• **Abertura:** ${formatDateFull(ticket.openedAt)}`;
    description += `\n• **Fechamento:** ${ticket.closedAt ? formatDateFull(ticket.closedAt) : 'N/A'}`;
    description += `\n• ${duracaoEmoji} **Duração:** ${duracao}`;
    
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

// ============================================================
// LOG DE AVALIAÇÃO (NOVO)
// ============================================================

export async function sendAvaliacaoLog(ticketId, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket) return;

  const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
  if (!logChannel) {
    console.warn("[Logs] Canal de logs não encontrado:", CONFIG.CANAL_LOGS);
    return;
  }

  // --- Buscar o staff que atendeu (se existir) ---
  let staffUser = null;
  if (ticket.claimedBy) {
    try {
      staffUser = await client.users.fetch(ticket.claimedBy);
    } catch (e) {}
  }

  // --- Buscar o utilizador que avaliou (autor do ticket) ---
  let avaliador = null;
  try {
    avaliador = await client.users.fetch(ticket.userId);
  } catch (e) {}

  // --- Montar a mensagem com o formato pretendido ---
  const estrelas = ticket.rating || 0;
  const estrelasTexto = '⭐'.repeat(estrelas) + '☆'.repeat(5 - estrelas);
  const avaliadorMencao = avaliador ? `<@${avaliador.id}>` : 'Desconhecido';
  const avaliadorTag = avaliador ? `\`${avaliador.tag}\`` : '`Desconhecido`';
  const staffMencao = staffUser ? `<@${staffUser.id}>` : 'Não atribuído';
  const staffTag = staffUser ? `\`${staffUser.tag}\`` : '`N/A`';

  // --- Gerar timestamp UNIX com fuso de Portugal ---
  const agora = new Date();
  const unixTimestamp = Math.floor(agora.getTime() / 1000);

  // Data formatada para exibição (com fuso de Portugal)
  const formatador = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const dataFormatada = formatador.format(agora);

  // Dia da semana (também com fuso)
  const formatadorDia = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long'
  });
  const diaSemana = formatadorDia.format(agora);

  // --- Construir a mensagem final ---
  const logMessage = [
    `⭐ **Portugal Alfa Community - Avaliação Recebida #${ticket.id}**`,
    `👤 Avaliado por: ${avaliadorMencao} | ${avaliadorTag}`,
    '',
    '⭐ Avaliação:',
    `\`${estrelasTexto}\` (${estrelas}/5)`,
    '',
    '👮 | Atendido por:',
    `\`${staffTag}\``,
    '',
    '✏️ | Mensagem:',
    '`(sem mensagem)`',   // Se não houver campo de mensagem, podes deixar assim
    '',
    `🕑 | Horário: ${diaSemana}, <t:${unixTimestamp}:S> (${dataFormatada})`
  ].join('\n');

  // --- Enviar para o canal de logs ---
  await logChannel.send(logMessage);
}
