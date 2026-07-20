import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";

let externalClient = null;
let externalChannels = {};

export function setExternalClient(client) {
  externalClient = client;
}

export async function setupExternalLogChannels(guild) {
  if (!guild) return;

  const channels = [
    { name: "logs-entradas", id: "entradas" },
    { name: "logs-saidas", id: "saidas" },
    { name: "logs-mensagens", id: "mensagens" },
    { name: "logs-canais", id: "canais" },
    { name: "logs-cargos", id: "cargos" },
    { name: "logs-voz", id: "voz" },
    { name: "logs-moderacao", id: "moderacao" },
    { name: "logs-membros", id: "membros" },
    { name: "logs-tickets", id: "tickets" },
  ];

  for (const ch of channels) {
    const existing = guild.channels.cache.find(c => c.name === ch.name);
    if (existing) {
      externalChannels[ch.id] = existing.id;
    }
  }
}

export async function sendLog(ticketId, action, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket) return;

  const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_TICKETS).catch(() => null);
  if (!logChannel) return;

  const dataAbertura = ticket.openedAt
    ? new Date(ticket.openedAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })
    : "N/A";
  const dataFechamento = ticket.closedAt
    ? new Date(ticket.closedAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })
    : "N/A";

  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_TICKET} Ticket ${action === "open" ? "Aberto" : action === "close" ? "Fechado" : "Assumido"} - #${ticketId}`)
    .setColor(action === "open" ? 0x00ff00 : action === "close" ? 0xff0000 : 0xffa500)
    .setTimestamp();

  if (action === "open") {
    embed.setDescription([
      `${CONFIG.EMOJI_USER} **Usuário:** <@${ticket.userId}> | ${ticket.username}`,
      `${CONFIG.EMOJI_INFO} **Tipo:** ${ticket.label || "N/A"}`,
      `${CONFIG.EMOJI_TIME} **Abertura:** ${dataAbertura}`,
      ticket.truckyNome ? `${CONFIG.EMOJI_TRUCK} **Trucky:** ${ticket.truckyNome}` : "",
    ].filter(Boolean).join("\n"));
  } else if (action === "close") {
    const recrutadoStatus = ticket.recrutado === true
      ? `${CONFIG.EMOJI_RECRUTADO} **Recrutado:** Sim`
      : ticket.recrutado === false
        ? `${CONFIG.EMOJI_NAO_RECRUTADO} **Recrutado:** Não`
        : `${CONFIG.EMOJI_INFO} **Recrutado:** N/A`;

    embed.setDescription([
      `${CONFIG.EMOJI_USER} **Usuário:** <@${ticket.userId}> | ${ticket.username}`,
      `${CONFIG.EMOJI_STAFF} **Assumido por:** ${ticket.claimedBy ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}` : "Ninguém"}`,
      `${CONFIG.EMOJI_STAFF} **Fechado por:** ${ticket.closedBy ? `${ticket.closedByName}` : "N/A"}`,
      "",
      `${CONFIG.EMOJI_INFO} **Informações:**`,
      `**Abertura:** ${dataAbertura}`,
      `**Fechamento:** ${dataFechamento}`,
      `**Tipo:** ${ticket.label || "N/A"}`,
      ticket.truckyNome ? `${CONFIG.EMOJI_TRUCK} **Trucky:** ${ticket.truckyNome}` : "",
      "",
      recrutadoStatus,
    ].filter(Boolean).join("\n"));
  } else if (action === "claim") {
    embed.setDescription([
      `${CONFIG.EMOJI_USER} **Usuário:** <@${ticket.userId}> | ${ticket.username}`,
      `${CONFIG.EMOJI_STAFF} **Assumido por:** ${ticket.claimedBy ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}` : "Ninguém"}`,
      `${CONFIG.EMOJI_INFO} **Tipo:** ${ticket.label || "N/A"}`,
    ].filter(Boolean).join("\n"));
  }

  await logChannel.send({ embeds: [embed] });
}

export async function enviarLogAvaliacao(ticket, estrelas, mensagem, avaliador, client) {
  const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS_AVALIACOES).catch(() => null);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_STAR} Nova Avaliação - Ticket #${ticket.id}`)
    .setDescription([
      `${CONFIG.EMOJI_USER} **Avaliador:** <@${avaliador.id}> | ${avaliador.username}`,
      `${CONFIG.EMOJI_STAR} **Estrelas:** ${"⭐".repeat(estrelas)}`,
      `${CONFIG.EMOJI_INFO} **Mensagem:** ${mensagem || "Sem mensagem"}`,
      `${CONFIG.EMOJI_TIME} **Data:** ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`,
    ].join("\n"))
    .setColor(0xffd700)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

export async function enviarAvaliacaoDM(ticket, client) {
  try {
    const user = await client.users.fetch(ticket.userId);
    if (!user) return;

    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_STAR} Avaliação do Atendimento`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} O teu ticket #${ticket.id} foi fechado.`,
        "",
        `${CONFIG.EMOJI_STAR} Como foi o atendimento?`,
        "Clica numa das estrelas abaixo para avaliar:",
      ].join("\n"))
      .setColor(0xffd700)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`avaliar_1_${ticket.id}`).setLabel("⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`avaliar_2_${ticket.id}`).setLabel("⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`avaliar_3_${ticket.id}`).setLabel("⭐⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`avaliar_4_${ticket.id}`).setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`avaliar_5_${ticket.id}`).setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Primary),
    );

    await user.send({ embeds: [embed], components: [row] });
  } catch (e) {
    console.error("Erro ao enviar avaliação DM:", e.message);
  }
}

// ========== EXTERNAL LOGS ==========

export async function logExternalMessageDelete(message) {
  if (!externalClient) return;
  const ch = await getExternalChannel("mensagens");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Mensagem Apagada")
    .setDescription([
      `**Autor:** ${message.author?.tag || "Desconhecido"}`,
      `**Canal:** <#${message.channelId}>`,
      `**Conteúdo:** ${message.content?.substring(0, 1000) || "(sem texto)"}`,
    ].join("\n"))
    .setColor(0xff0000)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalMessageUpdate(oldMessage, newMessage) {
  if (!externalClient) return;
  const ch = await getExternalChannel("mensagens");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Mensagem Editada")
    .setDescription([
      `**Autor:** ${newMessage.author?.tag || "Desconhecido"}`,
      `**Canal:** <#${newMessage.channelId}>`,
      `**Antes:** ${oldMessage.content?.substring(0, 500) || "(sem texto)"}`,
      `**Depois:** ${newMessage.content?.substring(0, 500) || "(sem texto)"}`,
    ].join("\n"))
    .setColor(0xffa500)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalMemberJoin(member) {
  if (!externalClient) return;
  const ch = await getExternalChannel("entradas");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("✅ Novo Membro")
    .setDescription([
      `**Usuário:** <@${member.id}> | ${member.user.tag}`,
      `**ID:** ${member.id}`,
      `**Conta criada:** ${member.user.createdAt.toLocaleString("pt-PT")}`,
    ].join("\n"))
    .setColor(0x00ff00)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalMemberLeave(member) {
  if (!externalClient) return;
  const ch = await getExternalChannel("saidas");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Membro Saiu")
    .setDescription([
      `**Usuário:** ${member.user.tag}`,
      `**ID:** ${member.id}`,
    ].join("\n"))
    .setColor(0xff0000)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalVoiceJoin(member, channel) {
  if (!externalClient) return;
  const ch = await getExternalChannel("voz");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🔊 Entrou no Canal de Voz")
    .setDescription([
      `**Usuário:** <@${member.id}> | ${member.user.tag}`,
      `**Canal:** ${channel.name}`,
    ].join("\n"))
    .setColor(0x00ff00)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalVoiceLeave(member, channel) {
  if (!externalClient) return;
  const ch = await getExternalChannel("voz");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🔇 Saiu do Canal de Voz")
    .setDescription([
      `**Usuário:** <@${member.id}> | ${member.user.tag}`,
      `**Canal:** ${channel.name}`,
    ].join("\n"))
    .setColor(0xff0000)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalChannelCreate(channel) {
  if (!externalClient) return;
  const ch = await getExternalChannel("canais");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("📢 Canal Criado")
    .setDescription([
      `**Nome:** ${channel.name}`,
      `**Tipo:** ${channel.type}`,
      `**ID:** ${channel.id}`,
    ].join("\n"))
    .setColor(0x00ff00)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalChannelDelete(channel) {
  if (!externalClient) return;
  const ch = await getExternalChannel("canais");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Canal Apagado")
    .setDescription([
      `**Nome:** ${channel.name}`,
      `**Tipo:** ${channel.type}`,
      `**ID:** ${channel.id}`,
    ].join("\n"))
    .setColor(0xff0000)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalRoleCreate(role) {
  if (!externalClient) return;
  const ch = await getExternalChannel("cargos");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🎨 Cargo Criado")
    .setDescription([
      `**Nome:** ${role.name}`,
      `**ID:** ${role.id}`,
      `**Cor:** ${role.hexColor}`,
    ].join("\n"))
    .setColor(0x00ff00)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalRoleDelete(role) {
  if (!externalClient) return;
  const ch = await getExternalChannel("cargos");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Cargo Apagado")
    .setDescription([
      `**Nome:** ${role.name}`,
      `**ID:** ${role.id}`,
    ].join("\n"))
    .setColor(0xff0000)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalMemberUpdate(oldMember, newMember) {
  if (!externalClient) return;
  const ch = await getExternalChannel("membros");
  if (!ch) return;

  const oldRoles = oldMember.roles.cache.map(r => r.name).join(", ") || "Nenhum";
  const newRoles = newMember.roles.cache.map(r => r.name).join(", ") || "Nenhum";

  if (oldRoles === newRoles) return;

  const embed = new EmbedBuilder()
    .setTitle("🔄 Cargo Atualizado")
    .setDescription([
      `**Usuário:** <@${newMember.id}> | ${newMember.user.tag}`,
      `**Antes:** ${oldRoles}`,
      `**Depois:** ${newRoles}`,
    ].join("\n"))
    .setColor(0xffa500)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalMemberBan(ban) {
  if (!externalClient) return;
  const ch = await getExternalChannel("moderacao");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🔨 Membro Banido")
    .setDescription([
      `**Usuário:** ${ban.user.tag}`,
      `**ID:** ${ban.user.id}`,
      `**Razão:** ${ban.reason || "Não especificada"}`,
    ].join("\n"))
    .setColor(0xff0000)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logExternalMemberUnban(user, guild) {
  if (!externalClient) return;
  const ch = await getExternalChannel("moderacao");
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle("🔓 Membro Desbanido")
    .setDescription([
      `**Usuário:** ${user.tag}`,
      `**ID:** ${user.id}`,
    ].join("\n"))
    .setColor(0x00ff00)
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

async function getExternalChannel(id) {
  if (!externalClient || !externalChannels[id]) return null;
  return await externalClient.channels.fetch(externalChannels[id]).catch(() => null);
}
