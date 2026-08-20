import {
  EmbedBuilder,
  AuditLogEvent,
  ChannelType,
  PermissionsBitField,
} from "discord.js";
import { CONFIG } from "../config/index.js";

/**
 * External Discord logging service
 * --------------------------------
 * Mantém os nomes das funções existentes para compatibilidade
 * com o resto do bot e adiciona logs mais detalhados.
 */

let externalClient = null;

const EXTERNAL_CHANNELS = {
  MEMBER_LOGS: "1510402716008972520",
  MESSAGE_LOGS: "1511421322134163547",
  MEMBER_UPDATES: "1511422765486444544",
  COMMUNITY_LOGS: "1510402518629482587",
};

const COLORS = {
  SUCCESS: 0x57f287,
  INFO: 0x5865f2,
  WARNING: 0xfee75c,
  DANGER: 0xed4245,
  ORANGE: 0xfaa61a,
  CYAN: 0x00b8d9,
  PURPLE: 0x9b59b6,
  GREY: 0x747f8d,
};

const MAX_FIELD = 1024;
const MAX_DESCRIPTION = 4096;
const MAX_EMBED_FIELDS = 25;
const AUDIT_LOOKBACK_MS = 8_000;

// ===== DEDUPLICAÇÃO GERAL =====
const processedEvents = new Map();
const DEDUP_WINDOW_MS = 2000;

function isDuplicateEvent(key) {
  if (!key) return false;
  const now = Date.now();
  const last = processedEvents.get(key);
  if (last && (now - last) < DEDUP_WINDOW_MS) return true;
  processedEvents.set(key, now);
  // Limpeza periódica
  if (processedEvents.size > 2000) {
    const old = now - 60000;
    for (const [k, t] of processedEvents) {
      if (t < old) processedEvents.delete(k);
    }
  }
  return false;
}

// ===== CACHE DE CONVITES =====
const inviteCache = new Map(); // memberId -> { code, inviterId, inviterTag, url }

async function updateInviteCache(member) {
  try {
    const guild = member.guild;
    const invites = await guild.invites.fetch();
    if (!globalThis._inviteSnapshots) globalThis._inviteSnapshots = new Map();
    const oldSnapshot = globalThis._inviteSnapshots.get(guild.id) || new Map();
    const newSnapshot = new Map();
    let usedInvite = null;

    for (const invite of invites.values()) {
      newSnapshot.set(invite.code, invite.uses || 0);
      const oldUses = oldSnapshot.get(invite.code) || 0;
      if ((invite.uses || 0) > oldUses) {
        usedInvite = invite;
        break;
      }
    }

    globalThis._inviteSnapshots.set(guild.id, newSnapshot);

    if (usedInvite) {
      inviteCache.set(member.id, {
        code: usedInvite.code,
        inviterId: usedInvite.inviterId,
        inviterTag: usedInvite.inviter?.tag || usedInvite.inviterId,
        url: `https://discord.gg/${usedInvite.code}`
      });
    } else {
      inviteCache.set(member.id, {
        code: "desconhecido",
        inviterId: "❓",
        inviterTag: "Desconhecido",
        url: "N/A"
      });
    }
  } catch (error) {
    console.error("[InviteCache] Erro ao atualizar cache de convite:", error);
    inviteCache.set(member.id, {
      code: "erro",
      inviterId: "❓",
      inviterTag: "Erro ao obter",
      url: "N/A"
    });
  }
}

/* ============================================================
 * HELPERS
 * ============================================================ */

function truncate(value, max = MAX_FIELD, fallback = "*Nenhum*") {
  if (value === null || value === undefined || value === "") return fallback;
  const text = String(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 15))}\n… *(truncado)*`;
}

function code(value, max = MAX_FIELD, fallback = "N/A") {
  const text = truncate(value, Math.max(1, max - 2), fallback).replace(/`/g, "ˋ");
  return `\`${text}\``;
}

function userLabel(user) {
  if (!user) return "❓ Desconhecido";
  return `<@${user.id}> | ${code(user.tag ?? user.username ?? user.id)}`;
}

function channelLabel(channel) {
  if (!channel) return "❓ Desconhecido";
  if (channel.id) {
    return `<#${channel.id}> | ${code(channel.name ?? channel.id)}`;
  }
  return code(channel.name);
}

function roleLabel(role) {
  if (!role) return "❓ Desconhecido";
  return `<@&${role.id}> | ${code(role.name ?? role.id)}`;
}

function createBaseEmbed(title, color = COLORS.INFO, timestamp = true) {
  const embed = new EmbedBuilder().setTitle(title).setColor(color);
  if (timestamp) embed.setTimestamp();
  return embed;
}

function setFooter(embed, id, label = "ID") {
  if (id) embed.setFooter({ text: `${label}: ${id}` });
  return embed;
}

function safeAvatarURL(user) {
  try {
    return user?.displayAvatarURL?.({ size: 256 }) ?? null;
  } catch {
    return null;
  }
}

function setUserThumbnail(embed, user) {
  const url = safeAvatarURL(user);
  if (url) embed.setThumbnail(url);
  return embed;
}

function formatMessageContent(content) {
  if (!content) return "*Vazio / embed / anexo / sticker*";
  return truncate(content);
}

function formatAttachment(attachment) {
  if (!attachment) return null;
  const name = attachment.name ?? "ficheiro";
  const url = attachment.url ?? "";
  if (url) return `📎 [${truncate(name, 120)}](${url})`;
  return `📎 ${code(name, 180)}`;
}

function formatAttachments(attachments) {
  if (!attachments?.size) return "*Nenhum*";
  const lines = [...attachments.values()].map(formatAttachment).filter(Boolean);
  return truncate(lines.join("\n"));
}

function getChannelTypeName(type) {
  const names = {
    [ChannelType.GuildText]: "Texto",
    [ChannelType.GuildVoice]: "Voz",
    [ChannelType.GuildCategory]: "Categoria",
    [ChannelType.GuildAnnouncement]: "Anúncios",
    [ChannelType.AnnouncementThread]: "Thread de anúncios",
    [ChannelType.PublicThread]: "Thread pública",
    [ChannelType.PrivateThread]: "Thread privada",
    [ChannelType.GuildStageVoice]: "Stage",
    [ChannelType.GuildForum]: "Fórum",
    [ChannelType.GuildMedia]: "Media",
  };
  return names[type] ?? String(type ?? "Desconhecido");
}

function rolePermissionNames(role) {
  if (!role?.permissions) return [];
  try {
    const names = [];
    for (const [name, bit] of Object.entries(PermissionsBitField.Flags)) {
      if (role.permissions.has(bit)) names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

function channelSnapshot(channel) {
  return {
    name: channel?.name ?? null,
    type: getChannelTypeName(channel?.type),
    parentId: channel?.parentId ?? null,
    position: channel?.rawPosition ?? channel?.position ?? null,
    topic: channel?.topic ?? null,
    nsfw: typeof channel?.nsfw === "boolean" ? channel.nsfw : null,
    rateLimitPerUser: channel?.rateLimitPerUser ?? null,
    bitrate: channel?.bitrate ?? null,
    userLimit: channel?.userLimit ?? null,
  };
}

function diff(label, before, after) {
  if (before === after) return null;
  return `**${label}:** ${code(before ?? "Nenhum")} → ${code(after ?? "Nenhum")}`;
}

function addDiffs(embed, changes, name = "🔄 Alterações") {
  const valid = changes.filter(Boolean);
  if (!valid.length) return false;
  embed.addFields({ name, value: truncate(valid.join("\n")), inline: false });
  return true;
}

async function getExternalChannel(channelId) {
  if (!externalClient || !channelId) return null;
  try {
    const channel = await externalClient.channels.fetch(channelId);
    if (!channel?.isTextBased?.() || typeof channel.send !== "function") {
      console.warn(`[ExternalLogs] Canal ${channelId} não é enviável.`);
      return null;
    }
    return channel;
  } catch (error) {
    console.error(`[ExternalLogs] Não foi possível obter o canal ${channelId}:`, error?.message);
    return null;
  }
}

async function sendLog(channelId, payload) {
  const channel = await getExternalChannel(channelId);
  if (!channel) return false;
  try {
    await channel.send(payload);
    return true;
  } catch (error) {
    console.error(`[ExternalLogs] Erro ao enviar log para ${channelId}:`, error?.message);
    return false;
  }
}

async function findAuditExecutor(
  guild,
  type,
  { targetId = null, channelId = null, maxAge = AUDIT_LOOKBACK_MS } = {}
) {
  if (!guild?.fetchAuditLogs) return null;
  try {
    const logs = await guild.fetchAuditLogs({ limit: 10, type });
    const now = Date.now();
    for (const entry of logs.entries.values()) {
      if (!entry?.executor) continue;
      if (now - entry.createdTimestamp > maxAge) continue;
      const entryTargetId = entry.target?.id ?? entry.targetId ?? null;
      const entryChannelId = entry.extra?.channel?.id ?? entry.extra?.channelId ?? null;
      if (targetId && entryTargetId && entryTargetId !== targetId) continue;
      if (channelId && entryChannelId && entryChannelId !== channelId) continue;
      return entry;
    }
  } catch {
    /* ignorar */
  }
  return null;
}

function executorLabel(entry, fallback = "❓ Não identificado") {
  if (!entry?.executor) return fallback;
  return `<@${entry.executor.id}> | ${code(entry.executor.tag ?? entry.executor.username ?? entry.executor.id)}`;
}

function messagePayload(embed, files = []) {
  const payload = { embeds: [embed] };
  if (files.length) payload.files = files;
  return payload;
}

/* ============================================================
 * SETUP
 * ============================================================ */

export function setExternalClient(client) {
  externalClient = client;
}

export async function setupExternalLogChannels(guild) {
  if (!externalClient) {
    console.warn("[ExternalLogs] Cliente externo ainda não foi configurado.");
    return false;
  }
  console.log(`[ExternalLogs] Canais de log configurados para ${guild?.name ?? "servidor"}.`);
  return true;
}

/* ============================================================
 * MESSAGE EVENTS
 * ============================================================ */

export async function logExternalMessageDelete(message) {
  try {
    if (isDuplicateEvent(`msgDel_${message?.id}`)) return;

    const guild = message?.guild;
    const channel = await getExternalChannel(EXTERNAL_CHANNELS.MESSAGE_LOGS);
    if (!channel) return;

    const entry = await findAuditExecutor(
      guild,
      AuditLogEvent.MessageDelete,
      {
        targetId: message?.author?.id ?? null,
        channelId: message?.channel?.id ?? null,
      }
    );

    let deletedBy = "❓ Não identificado";
    let actionText = "teve uma mensagem apagada";

    if (entry?.executor) {
      const executorId = entry.executor.id;
      const authorId = message?.author?.id;

      if (executorId === authorId) {
        deletedBy = `${userLabel(message.author)}\n\`Próprio autor\``;
        actionText = "apagou a própria mensagem";
      } else {
        deletedBy = executorLabel(entry);
        actionText = "teve uma mensagem apagada por um moderador";
      }
    } else {
      if (message?.author) {
        deletedBy = `${userLabel(message.author)}\n\`Próprio autor\``;
        actionText = "apagou a própria mensagem";
      } else {
        deletedBy = "❓ Não identificado";
        actionText = "teve uma mensagem apagada";
      }
    }

    const embed = createBaseEmbed("🗑️ Mensagem Apagada", COLORS.DANGER)
      .setDescription(
        `${message?.author ? userLabel(message.author) : "❓ Utilizador desconhecido"} **${actionText}**`
      );

    embed.addFields(
      { name: "👤 Utilizador", value: message?.author ? userLabel(message.author) : "❓ Desconhecido", inline: true },
      { name: "🧹 Apagado por", value: deletedBy, inline: true },
      { name: "📍 Canal", value: channelLabel(message?.channel), inline: true },
      { name: "📝 Mensagem", value: formatMessageContent(message?.content), inline: false },
      { name: "📎 Anexos", value: formatAttachments(message?.attachments), inline: false }
    );

    if (message?.stickers?.size) {
      embed.addFields({
        name: "🎨 Stickers",
        value: truncate([...message.stickers.values()].map(s => s.name).join(", ")),
        inline: false,
      });
    }

    embed.addFields(
      { name: "👤 Utilizador ID", value: code(message?.author?.id), inline: true },
      { name: "📍 Canal ID", value: code(message?.channel?.id), inline: true },
      { name: "💬 Mensagem ID", value: code(message?.id), inline: true }
    );

    setFooter(embed, message?.id, "Mensagem ID");

    await channel.send(messagePayload(embed));
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar delete:", error?.message);
  }
}

export async function logExternalMessageUpdate(oldMessage, newMessage) {
  try {
    if (!newMessage?.guild) return;

    let old = oldMessage;
    let current = newMessage;

    if (old?.partial) {
      try { old = await old.fetch(); } catch { /* mantém */ }
    }
    if (current?.partial) {
      try { current = await current.fetch(); } catch { /* mantém */ }
    }

    const oldContent = old?.content ?? "";
    const newContent = current?.content ?? "";

    if (oldContent === newContent) return;

    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MESSAGE_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("📝 Mensagem Editada", COLORS.WARNING)
      .setDescription(
        `${current?.author ? userLabel(current.author) : "❓ Utilizador"} **editou uma mensagem de texto**`
      );

    embed.addFields(
      { name: "👤 Utilizador", value: current?.author ? userLabel(current.author) : "❓ Desconhecido", inline: true },
      { name: "📍 Canal", value: channelLabel(current?.channel), inline: true },
      { name: "💬 Mensagem", value: code(current?.id), inline: true },
      { name: "📝 Antiga mensagem", value: formatMessageContent(oldContent), inline: false },
      { name: "📝 Nova mensagem", value: formatMessageContent(newContent), inline: false }
    );

    if (current?.attachments?.size) {
      embed.addFields({ name: "📎 Anexos atuais", value: formatAttachments(current.attachments), inline: false });
    }

    embed.addFields(
      { name: "👤 Utilizador ID", value: code(current?.author?.id), inline: true },
      { name: "📍 Canal ID", value: code(current?.channel?.id), inline: true },
      { name: "💬 Mensagem ID", value: code(current?.id), inline: true }
    );

    setFooter(embed, current?.id, "Mensagem ID");

    await logChannel.send(messagePayload(embed));
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar update:", error?.message);
  }
}

export { logExternalMessageDelete as logMessageDelete, logExternalMessageUpdate as logMessageUpdate };

/* ============================================================
 * MEMBER EVENTS
 * ============================================================ */

export async function logExternalMemberJoin(member) {
  try {
    const key = `join_${member?.id}`;
    if (isDuplicateEvent(key)) return;

    await updateInviteCache(member);

    const embed = createBaseEmbed("📥 Membro Entrou", COLORS.SUCCESS)
      .setDescription(`${userLabel(member?.user)} **entrou no servidor**.`);

    const createdTimestamp = member?.user?.createdTimestamp;
    const accountAge = createdTimestamp ? `<t:${Math.floor(createdTimestamp / 1000)}:R>` : "Desconhecida";
    const memberCount = member?.guild?.memberCount ? `#${member.guild.memberCount}` : "N/A";

    const inviteInfo = inviteCache.get(member.id);
    const inviteField = inviteInfo
      ? `[${inviteInfo.code}](${inviteInfo.url}) | Criado por: ${inviteInfo.inviterTag}`
      : "Não disponível";

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(member?.user), inline: true },
      { name: "🔢 Entrada", value: code(memberCount), inline: true },
      { name: "📅 Conta criada", value: accountAge, inline: true },
      { name: "🔗 Convite usado", value: inviteField, inline: false },
      { name: "🆔 ID", value: code(member?.id), inline: true },
      { name: "🏠 Servidor", value: code(member?.guild?.name), inline: true }
    );

    setUserThumbnail(embed, member?.user);
    setFooter(embed, member?.id);

    await sendLog(EXTERNAL_CHANNELS.MEMBER_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar entrada:", error?.message);
  }
}

export async function logExternalMemberLeave(member) {
  try {
    const key = `leave_${member?.id}`;
    if (isDuplicateEvent(key)) return;

    const guild = member?.guild;
    const kickEntry = await findAuditExecutor(guild, AuditLogEvent.MemberKick, { targetId: member?.id });
    const banEntry = await findAuditExecutor(guild, AuditLogEvent.MemberBanAdd, { targetId: member?.id });

    let title = "👋 Membro Saiu";
    let color = COLORS.DANGER;
    let action = "saiu do servidor";
    let executorDisplay = "👤 Saiu por conta própria"; // Novo texto

    if (kickEntry) {
      title = "👢 Membro Expulso";
      color = COLORS.ORANGE;
      action = "foi expulso do servidor";
      executorDisplay = executorLabel(kickEntry);
    } else if (banEntry) {
      title = "🔨 Membro Banido";
      color = COLORS.DANGER;
      action = "foi banido do servidor";
      executorDisplay = executorLabel(banEntry);
    }

    const embed = createBaseEmbed(title, color)
      .setDescription(`${userLabel(member?.user)} **${action}**.`);

    const inviteInfo = inviteCache.get(member.id);
    const inviteField = inviteInfo
      ? `[${inviteInfo.code}](${inviteInfo.url}) | Criado por: ${inviteInfo.inviterTag}`
      : "Não disponível";

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(member?.user), inline: true },
      { name: "🆔 ID", value: code(member?.id), inline: true },
      { name: "🔗 Convite usado (entrada)", value: inviteField, inline: false },
      { name: "🧑‍⚖️ Executado por", value: executorDisplay, inline: true },
      { name: "🏠 Servidor", value: code(guild?.name), inline: true }
    );

    if (kickEntry?.reason || banEntry?.reason) {
      const reason = kickEntry?.reason || banEntry?.reason;
      embed.addFields({ name: "📋 Motivo", value: truncate(reason), inline: false });
    }

    setUserThumbnail(embed, member?.user);
    setFooter(embed, member?.id);

    await sendLog(EXTERNAL_CHANNELS.MEMBER_LOGS, { embeds: [embed] });

    inviteCache.delete(member.id);
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar saída:", error?.message);
  }
}

export async function logExternalMemberUpdate(oldMember, newMember) {
  try {
    const key = `update_${newMember?.id}`;
    if (isDuplicateEvent(key)) return;

    const changes = [];

    if (oldMember?.nickname !== newMember?.nickname) {
      changes.push(`📝 **Nickname:** ${code(oldMember?.nickname ?? "Nenhum")} → ${code(newMember?.nickname ?? "Nenhum")}`);
    }
    if (oldMember?.user?.username !== newMember?.user?.username) {
      changes.push(`👤 **Username:** ${code(oldMember?.user?.username)} → ${code(newMember?.user?.username)}`);
    }
    if (oldMember?.avatar !== newMember?.avatar) {
      changes.push("🖼️ **Avatar do servidor atualizado**");
    }
    if (oldMember?.user?.avatar !== newMember?.user?.avatar) {
      changes.push("🖼️ **Avatar global atualizado**");
    }
    if (oldMember?.user?.globalName !== newMember?.user?.globalName) {
      changes.push(`🏷️ **Nome global:** ${code(oldMember?.user?.globalName ?? "Nenhum")} → ${code(newMember?.user?.globalName ?? "Nenhum")}`);
    }

    const oldRoles = oldMember?.roles?.cache?.filter(role => role.id !== newMember.guild.id) ?? new Map();
    const newRoles = newMember?.roles?.cache?.filter(role => role.id !== newMember.guild.id) ?? new Map();

    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

    if (addedRoles.size) {
      changes.push(`➕ **Cargos adicionados:** ${truncate([...addedRoles.values()].map(roleLabel).join(", "))}`);
    }
    if (removedRoles.size) {
      changes.push(`➖ **Cargos removidos:** ${truncate([...removedRoles.values()].map(roleLabel).join(", "))}`);
    }

    if (oldMember?.communicationDisabledUntilTimestamp !== newMember?.communicationDisabledUntilTimestamp) {
      const until = newMember?.communicationDisabledUntilTimestamp;
      changes.push(until ? `⏳ **Timeout:** aplicado até <t:${Math.floor(until / 1000)}:F>` : "⏳ **Timeout:** removido");
    }

    if (!changes.length) return;

    const entry = await findAuditExecutor(newMember?.guild, AuditLogEvent.MemberUpdate, { targetId: newMember?.id });

    const embed = createBaseEmbed("📝 Membro Atualizado", COLORS.WARNING)
      .setDescription(`${userLabel(newMember?.user)} **foi atualizado**.`);

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(newMember?.user), inline: true },
      { name: "🆔 ID", value: code(newMember?.id), inline: true },
      { name: "🧑‍⚖️ Executado por", value: executorLabel(entry), inline: true }
    );

    addDiffs(embed, changes);
    setUserThumbnail(embed, newMember?.user);
    setFooter(embed, newMember?.id);

    await sendLog(EXTERNAL_CHANNELS.MEMBER_UPDATES, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar update de membro:", error?.message);
  }
}

/* ============================================================
 * VOICE EVENTS (com deduplicação)
 * ============================================================ */

export async function logExternalVoiceJoin(member, channel) {
  try {
    const key = `voiceJoin_${member?.id}_${channel?.id}`;
    if (isDuplicateEvent(key)) return;

    const embed = createBaseEmbed("🔊 Entrou em Canal de Voz", COLORS.SUCCESS)
      .setDescription(`${userLabel(member?.user)} **entrou em** ${channelLabel(channel)}.`);

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(member?.user), inline: true },
      { name: "🔊 Canal", value: channelLabel(channel), inline: true },
      { name: "🆔 Utilizador ID", value: code(member?.id), inline: true }
    );

    setUserThumbnail(embed, member?.user);
    setFooter(embed, member?.id);

    await sendLog(EXTERNAL_CHANNELS.MEMBER_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar voice join:", error?.message);
  }
}

export async function logExternalVoiceLeave(member, channel) {
  try {
    const key = `voiceLeave_${member?.id}_${channel?.id}`;
    if (isDuplicateEvent(key)) return;

    const embed = createBaseEmbed("🔊 Saiu de Canal de Voz", COLORS.ORANGE)
      .setDescription(`${userLabel(member?.user)} **saiu de** ${channelLabel(channel)}.`);

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(member?.user), inline: true },
      { name: "🔊 Canal", value: channelLabel(channel), inline: true },
      { name: "🆔 Utilizador ID", value: code(member?.id), inline: true }
    );

    setUserThumbnail(embed, member?.user);
    setFooter(embed, member?.id);

    await sendLog(EXTERNAL_CHANNELS.MEMBER_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar voice leave:", error?.message);
  }
}

export async function logExternalVoiceMove(member, oldChannel, newChannel) {
  try {
    const key = `voiceMove_${member?.id}_${oldChannel?.id}_${newChannel?.id}`;
    if (isDuplicateEvent(key)) return;

    const embed = createBaseEmbed("🔀 Mudança de Canal de Voz", COLORS.CYAN)
      .setDescription(`${userLabel(member?.user)} **mudou de canal de voz**.`);

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(member?.user), inline: true },
      { name: "⬅️ De", value: channelLabel(oldChannel), inline: true },
      { name: "➡️ Para", value: channelLabel(newChannel), inline: true }
    );

    setUserThumbnail(embed, member?.user);
    setFooter(embed, member?.id);

    await sendLog(EXTERNAL_CHANNELS.MEMBER_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar voice move:", error?.message);
  }
}

/* ============================================================
 * CHANNEL EVENTS
 * ============================================================ */

export async function logExternalChannelCreate(channel) {
  try {
    const embed = createBaseEmbed("📁 Canal Criado", COLORS.SUCCESS)
      .setDescription(`**#${channel?.name ?? "desconhecido"}** foi criado.`);

    embed.addFields(
      { name: "📁 Canal", value: channelLabel(channel), inline: true },
      { name: "📌 Tipo", value: code(getChannelTypeName(channel?.type)), inline: true },
      { name: "🆔 ID", value: code(channel?.id), inline: true },
      { name: "📂 Categoria", value: channel?.parent ? channelLabel(channel.parent) : "*Nenhuma*", inline: false }
    );

    if (channel?.topic) {
      embed.addFields({ name: "📝 Tópico", value: truncate(channel.topic), inline: false });
    }

    setFooter(embed, channel?.id, "Canal ID");
    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar channel create:", error?.message);
  }
}

export async function logExternalChannelDelete(channel) {
  try {
    const entry = await findAuditExecutor(channel?.guild, AuditLogEvent.ChannelDelete, { targetId: channel?.id });

    const embed = createBaseEmbed("🗑️ Canal Apagado", COLORS.DANGER)
      .setDescription(`**#${channel?.name ?? "desconhecido"}** foi apagado.`);

    embed.addFields(
      { name: "📁 Canal", value: `#${truncate(channel?.name ?? "desconhecido", 200)}`, inline: true },
      { name: "📌 Tipo", value: code(getChannelTypeName(channel?.type)), inline: true },
      { name: "🆔 ID", value: code(channel?.id), inline: true },
      { name: "🧑‍⚖️ Apagado por", value: executorLabel(entry), inline: false }
    );

    if (channel?.parent) {
      embed.addFields({ name: "📂 Categoria", value: channelLabel(channel.parent), inline: false });
    }

    setFooter(embed, channel?.id, "Canal ID");
    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar channel delete:", error?.message);
  }
}

export async function logExternalChannelUpdate(oldChannel, newChannel) {
  try {
    const before = channelSnapshot(oldChannel);
    const after = channelSnapshot(newChannel);

    const changes = [
      diff("Nome", before.name, after.name),
      diff("Tipo", before.type, after.type),
      diff("Categoria", before.parentId, after.parentId),
      diff("Posição", before.position, after.position),
      diff("Tópico", before.topic, after.topic),
      diff("NSFW", before.nsfw, after.nsfw),
      diff("Slowmode", before.rateLimitPerUser, after.rateLimitPerUser),
      diff("Bitrate", before.bitrate, after.bitrate),
      diff("Limite de utilizadores", before.userLimit, after.userLimit),
    ];

    if (!changes.some(Boolean)) return;

    const entry = await findAuditExecutor(newChannel?.guild, AuditLogEvent.ChannelUpdate, { targetId: newChannel?.id });

    const embed = createBaseEmbed("📝 Canal Atualizado", COLORS.WARNING)
      .setDescription(`**#${newChannel?.name ?? "desconhecido"}** foi atualizado.`);

    embed.addFields(
      { name: "📁 Canal", value: channelLabel(newChannel), inline: true },
      { name: "🆔 ID", value: code(newChannel?.id), inline: true },
      { name: "🧑‍⚖️ Alterado por", value: executorLabel(entry), inline: true }
    );

    addDiffs(embed, changes);
    setFooter(embed, newChannel?.id, "Canal ID");

    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar channel update:", error?.message);
  }
}

/* ============================================================
 * ROLE EVENTS
 * ============================================================ */

export async function logExternalRoleCreate(role) {
  try {
    const embed = createBaseEmbed("🏷️ Cargo Criado", COLORS.SUCCESS)
      .setDescription(`**@${role?.name ?? "desconhecido"}** foi criado.`);

    const permissions = rolePermissionNames(role);
    embed.addFields(
      { name: "🏷️ Nome", value: code(role?.name), inline: true },
      { name: "🎨 Cor", value: code(role?.hexColor), inline: true },
      { name: "📢 Mentionable", value: code(role?.mentionable ? "Sim" : "Não"), inline: true },
      { name: "👁️ Separado", value: code(role?.hoist ? "Sim" : "Não"), inline: true },
      { name: "🆔 ID", value: code(role?.id), inline: true },
      { name: "🔐 Permissões", value: permissions.length ? truncate(permissions.join(", ")) : "*Nenhuma*", inline: false }
    );

    setFooter(embed, role?.id, "Role ID");
    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar role create:", error?.message);
  }
}

export async function logExternalRoleDelete(role) {
  try {
    const entry = await findAuditExecutor(role?.guild, AuditLogEvent.RoleDelete, { targetId: role?.id });

    const embed = createBaseEmbed("🗑️ Cargo Apagado", COLORS.DANGER)
      .setDescription(`**@${role?.name ?? "desconhecido"}** foi apagado.`);

    embed.addFields(
      { name: "🏷️ Nome", value: code(role?.name), inline: true },
      { name: "🎨 Cor", value: code(role?.hexColor), inline: true },
      { name: "🆔 ID", value: code(role?.id), inline: true },
      { name: "🧑‍⚖️ Apagado por", value: executorLabel(entry), inline: false }
    );

    setFooter(embed, role?.id, "Role ID");
    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar role delete:", error?.message);
  }
}

export async function logExternalRoleUpdate(oldRole, newRole) {
  try {
    const changes = [
      diff("Nome", oldRole?.name, newRole?.name),
      diff("Cor", oldRole?.hexColor, newRole?.hexColor),
      diff("Mentionable", oldRole?.mentionable ? "Sim" : "Não", newRole?.mentionable ? "Sim" : "Não"),
      diff("Separado", oldRole?.hoist ? "Sim" : "Não", newRole?.hoist ? "Sim" : "Não"),
      diff("Posição", oldRole?.position, newRole?.position),
    ];

    const oldPermissions = new Set(rolePermissionNames(oldRole));
    const newPermissions = new Set(rolePermissionNames(newRole));
    const addedPermissions = [...newPermissions].filter(p => !oldPermissions.has(p));
    const removedPermissions = [...oldPermissions].filter(p => !newPermissions.has(p));

    if (addedPermissions.length) {
      changes.push(`🔐 **Permissões adicionadas:** ${truncate(addedPermissions.join(", "))}`);
    }
    if (removedPermissions.length) {
      changes.push(`🔐 **Permissões removidas:** ${truncate(removedPermissions.join(", "))}`);
    }

    if (!changes.some(Boolean)) return;

    const entry = await findAuditExecutor(newRole?.guild, AuditLogEvent.RoleUpdate, { targetId: newRole?.id });

    const embed = createBaseEmbed("📝 Cargo Atualizado", COLORS.WARNING)
      .setDescription(`**@${newRole?.name ?? "desconhecido"}** foi atualizado.`);

    embed.addFields(
      { name: "🏷️ Cargo", value: roleLabel(newRole), inline: true },
      { name: "🆔 ID", value: code(newRole?.id), inline: true },
      { name: "🧑‍⚖️ Alterado por", value: executorLabel(entry), inline: true }
    );

    addDiffs(embed, changes);
    setFooter(embed, newRole?.id, "Role ID");

    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar role update:", error?.message);
  }
}

/* ============================================================
 * BAN / UNBAN / KICK
 * ============================================================ */

export async function logExternalMemberBan(ban) {
  try {
    const entry = await findAuditExecutor(ban?.guild, AuditLogEvent.MemberBanAdd, { targetId: ban?.user?.id });

    const embed = createBaseEmbed("🔨 Membro Banido", COLORS.DANGER)
      .setDescription(`${userLabel(ban?.user)} **foi banido do servidor**.`);

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(ban?.user), inline: true },
      { name: "🆔 ID", value: code(ban?.user?.id), inline: true },
      { name: "🧑‍⚖️ Banido por", value: executorLabel(entry), inline: true },
      { name: "🏠 Servidor", value: code(ban?.guild?.name), inline: true }
    );

    if (entry?.reason) {
      embed.addFields({ name: "📋 Motivo", value: truncate(entry.reason), inline: false });
    }

    setUserThumbnail(embed, ban?.user);
    setFooter(embed, ban?.user?.id);

    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar ban:", error?.message);
  }
}

export async function logExternalMemberUnban(user, guild) {
  try {
    const entry = await findAuditExecutor(guild, AuditLogEvent.MemberBanRemove, { targetId: user?.id });

    const embed = createBaseEmbed("🔓 Membro Desbanido", COLORS.SUCCESS)
      .setDescription(`${userLabel(user)} **foi desbanido**.`);

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(user), inline: true },
      { name: "🆔 ID", value: code(user?.id), inline: true },
      { name: "🧑‍⚖️ Desbanido por", value: executorLabel(entry), inline: true },
      { name: "🏠 Servidor", value: code(guild?.name), inline: true }
    );

    setUserThumbnail(embed, user);
    setFooter(embed, user?.id);

    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar unban:", error?.message);
  }
}

export async function logExternalMemberKick(member, reason = null) {
  try {
    const entry = await findAuditExecutor(member?.guild, AuditLogEvent.MemberKick, { targetId: member?.id });

    const embed = createBaseEmbed("👢 Membro Expulso", COLORS.ORANGE)
      .setDescription(`${userLabel(member?.user)} **foi expulso do servidor**.`);

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(member?.user), inline: true },
      { name: "🆔 ID", value: code(member?.id), inline: true },
      { name: "🧑‍⚖️ Expulso por", value: executorLabel(entry), inline: true }
    );

    if (reason || entry?.reason) {
      embed.addFields({ name: "📋 Motivo", value: truncate(reason ?? entry?.reason), inline: false });
    }

    setUserThumbnail(embed, member?.user);
    setFooter(embed, member?.id);

    await sendLog(EXTERNAL_CHANNELS.COMMUNITY_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar kick:", error?.message);
  }
}

/* ============================================================
 * RULES / SEARCH
 * ============================================================ */

export async function logExternalRulesAccepted(member, guildName, rolesAdded = []) {
  try {
    const embed = createBaseEmbed("📜 Regras Aceites", COLORS.SUCCESS)
      .setDescription(`${userLabel(member?.user)} **aceitou as regras**.`);

    embed.addFields(
      { name: "👤 Utilizador", value: userLabel(member?.user), inline: true },
      { name: "🏠 Servidor", value: code(guildName), inline: true },
      { name: "🆔 ID", value: code(member?.id), inline: true },
      { name: "✅ Cargos atribuídos", value: rolesAdded?.length ? truncate(rolesAdded.join(", ")) : "⚠️ Nenhum cargo foi atribuído automaticamente.", inline: false }
    );

    setUserThumbnail(embed, member?.user);
    setFooter(embed, member?.id);

    await sendLog(EXTERNAL_CHANNELS.MEMBER_UPDATES, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar regras aceites:", error?.message);
  }
}

export async function logExternalSearch(user, query, results) {
  try {
    const embed = createBaseEmbed("🔍 Pesquisa Realizada", COLORS.INFO)
      .setDescription(`${userLabel(user)} **realizou uma pesquisa**.`);

    embed.addFields(
      { name: "🔎 Query", value: truncate(query ? `\`\`\`\n${String(query).slice(0, 1000)}\n\`\`\`` : "*Vazia*"), inline: false },
      { name: "📊 Resultados", value: code(results ?? "Nenhum"), inline: true },
      { name: "🆔 Utilizador ID", value: code(user?.id), inline: true }
    );

    setUserThumbnail(embed, user);
    setFooter(embed, user?.id);

    await sendLog(EXTERNAL_CHANNELS.MESSAGE_LOGS, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro ao logar pesquisa:", error?.message);
  }
}

/* ============================================================
 * GENERIC LOGGER
 * ============================================================ */

export async function logExternalGeneric({
  channelId = EXTERNAL_CHANNELS.COMMUNITY_LOGS,
  title,
  description,
  color = COLORS.INFO,
  fields = [],
  footerId = null,
  thumbnailUser = null,
} = {}) {
  try {
    if (!title) return false;
    const embed = createBaseEmbed(title, color);
    if (description) embed.setDescription(truncate(description, MAX_DESCRIPTION));
    if (fields.length) {
      embed.addFields(
        fields
          .filter(f => f?.name && f?.value)
          .slice(0, MAX_EMBED_FIELDS)
          .map(f => ({ name: truncate(f.name, 256), value: truncate(f.value), inline: Boolean(f.inline) }))
      );
    }
    if (thumbnailUser) setUserThumbnail(embed, thumbnailUser);
    if (footerId) setFooter(embed, footerId);

    return await sendLog(channelId, { embeds: [embed] });
  } catch (error) {
    console.error("[ExternalLogs] Erro no log genérico:", error?.message);
    return false;
  }
}

export {
  EXTERNAL_CHANNELS,
  COLORS as EXTERNAL_LOG_COLORS,
};
