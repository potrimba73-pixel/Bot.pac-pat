import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

let externalClient = null;

// Canais no servidor externo
const EXTERNAL_CHANNELS = {
  MEMBER_LOGS: "1510402716008972520", // Entradas/saídas, voice, regras
  MESSAGE_LOGS: "1511421322134163547", // Mensagens apagadas/editadas
  MEMBER_UPDATES: "1511422765486444544", // Atualizações de membros (roles, avatar, etc)
  COMMUNITY_LOGS: "1510402518629482587", // Logs da comunidade (canais, cargos, bans)
};

export function setExternalClient(client) {
  externalClient = client;
}

async function getExternalChannel(channelId) {
  if (!externalClient || !channelId) return null;
  return externalClient.channels.fetch(channelId).catch(() => null);
}

// Helper para criar embed base
function createBaseEmbed(title, color, timestamp = true) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color);
  if (timestamp) embed.setTimestamp();
  return embed;
}

// ========== MESSAGE EVENTS (canal 1511421322134163547) ==========
export async function logExternalMessageDelete(message) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MESSAGE_LOGS);
    if (!logChannel) return;

    // Tentar obter quem apagou via Audit Log
    let deleter = null;
    try {
      const auditLogs = await message.guild.fetchAuditLogs({
        limit: 1,
        type: 72, // MESSAGE_DELETE
      });
      const entry = auditLogs.entries.first();
      if (entry && entry.target.id === message.author?.id &&
          Date.now() - entry.createdTimestamp < 5000) {
        deleter = entry.executor;
      }
    } catch (e) {}

    const embed = createBaseEmbed("🗑️ Mensagem Apagada", 0xff0000)
      .addFields(
        { name: "👤 Autor", value: message.author ? `<@${message.author.id}> | \`${message.author.tag}\`` : "Desconhecido", inline: true },
        { name: "🧹 Apagado por", value: deleter ? `<@${deleter.id}> | \`${deleter.tag}\`` : "🤖 Bot / Próprio Autor", inline: true },
        { name: "📍 Canal", value: `<#${message.channel.id}>`, inline: true },
        { name: "📝 Conteúdo", value: message.content?.substring(0, 1024) || "*Vazio/Embed/Anexo*", inline: false }
      )
      .setFooter({ text: `ID: ${message.id}` });

    if (message.attachments.size > 0) {
      const attachmentNames = Array.from(message.attachments.values()).map(a => a.name).join(", ");
      embed.addFields({ name: "📎 Anexos", value: attachmentNames.substring(0, 1024), inline: false });
    }

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar delete:", err.message);
  }
}

export async function logExternalMessageUpdate(oldMessage, newMessage) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MESSAGE_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("✏️ Mensagem Editada", 0xffff00)
      .addFields(
        { name: "👤 Autor", value: `<@${newMessage.author.id}> | \`${newMessage.author.tag}\``, inline: true },
        { name: "📍 Canal", value: `<#${newMessage.channel.id}>`, inline: true },
        { name: "📝 Antes", value: oldMessage.content?.substring(0, 1024) || "*Vazio*", inline: false },
        { name: "📝 Depois", value: newMessage.content?.substring(0, 1024) || "*Vazio*", inline: false }
      )
      .setFooter({ text: `ID: ${newMessage.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar update:", err.message);
  }
}

// ========== MEMBER EVENTS (canal 1510402716008972520) ==========
export async function logExternalMemberJoin(member) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MEMBER_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("📥 Novo Membro Entrou", 0x00ff00)
      .setDescription(`**${member.user.tag}** juntou-se ao servidor.`)
      .addFields(
        { name: "👤 Utilizador", value: `<@${member.id}>`, inline: true },
        { name: "📝 Nome", value: `\`${member.user.tag}\``, inline: true },
        { name: "🆔 ID", value: `\`${member.id}\``, inline: true },
        { name: "📅 Conta criada", value: ``, inline: true },
        { name: "⏰ Entrou em", value: ``, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `ID: ${member.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar entrada:", err.message);
  }
}

export async function logExternalMemberLeave(member) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MEMBER_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("👋 Membro Saiu", 0xff0000)
      .setDescription(`**${member.user.tag}** saiu do servidor.`)
      .addFields(
        { name: "👤 Utilizador", value: `<@${member.id}> | \`${member.user.tag}\``, inline: false },
        { name: "🆔 ID", value: `\`${member.id}\``, inline: true },
        { name: "🏠 Servidor", value: `\`${member.guild.name}\``, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `ID: ${member.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar saída:", err.message);
  }
}

// ========== MEMBER UPDATES (canal 1511422765486444544) ==========
export async function logExternalMemberUpdate(oldMember, newMember) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MEMBER_UPDATES);
    if (!logChannel) return;

    const changes = [];

    // Nickname
    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`📝 **Nickname:** \`${oldMember.nickname || "Nenhum"}\` → \`${newMember.nickname || "Nenhum"}\``);
    }

    // Roles
    const oldRoles = oldMember.roles.cache.filter(r => r.id !== newMember.guild.id);
    const newRoles = newMember.roles.cache.filter(r => r.id !== newMember.guild.id);
    const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

    if (addedRoles.size > 0) {
      const rolesText = addedRoles.map(r => `<@&${r.id}> (\`${r.name}\`)`).join(", ");
      changes.push(`➕ **Cargos adicionados:** ${rolesText}`);
    }
    if (removedRoles.size > 0) {
      const rolesText = removedRoles.map(r => `<@&${r.id}> (\`${r.name}\`)`).join(", ");
      changes.push(`➖ **Cargos removidos:** ${rolesText}`);
    }

    // Avatar
    if (oldMember.avatar !== newMember.avatar) {
      changes.push("🖼️ **Avatar do servidor atualizado**");
    }

    if (changes.length === 0) return;

    const embed = createBaseEmbed("📝 Membro Atualizado", 0xffff00)
      .setDescription(`<@${newMember.id}> | \`${newMember.user.tag}\` foi atualizado.`)
      .addFields({ name: "Alterações", value: changes.join("\n"), inline: false })
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `ID: ${newMember.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar update:", err.message);
  }
}

// ========== RULES ACCEPTANCE (canal 1511422765486444544) ==========
export async function logExternalRulesAccepted(member, guildName, rolesAdded = []) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MEMBER_UPDATES);
    if (!logChannel) return;

    const embed = createBaseEmbed("📜 Regras Aceites", 0x00ff88)
      .setDescription(`<@${member.id}> | \`${member.user.tag}\` aceitou as regras.`)
      .addFields(
        { name: "👤 Utilizador", value: `<@${member.id}>`, inline: true },
        { name: "🏠 Servidor", value: `\`${guildName}\``, inline: true },
        { name: "🆔 ID", value: `\`${member.id}\``, inline: true }
      );

    if (rolesAdded.length > 0) {
      embed.addFields({ name: "✅ Cargos atribuídos", value: rolesAdded.join(", "), inline: false });
    } else {
      embed.addFields({ name: "⚠️ Aviso", value: "Nenhum cargo foi atribuído automaticamente.", inline: false });
    }

    embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `ID: ${member.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar regras aceites:", err.message);
  }
}

// ========== BAN/UNBAN (canal COMMUNITY_LOGS) ==========
export async function logExternalMemberBan(ban) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.COMMUNITY_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("🔨 Membro Banido", 0xff0000)
      .setDescription(`<@${ban.user.id}> | \`${ban.user.tag}\` foi banido.`)
      .addFields(
        { name: "🆔 ID", value: `\`${ban.user.id}\``, inline: true },
        { name: "🏠 Servidor", value: `\`${ban.guild.name}\``, inline: true }
      )
      .setFooter({ text: `ID: ${ban.user.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar ban:", err.message);
  }
}

export async function logExternalMemberUnban(user, guild) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.COMMUNITY_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("🔓 Membro Desbanido", 0x00ff00)
      .setDescription(`<@${user.id}> | \`${user.tag}\` foi desbanido.`)
      .addFields({ name: "🆔 ID", value: `\`${user.id}\``, inline: true })
      .setFooter({ text: `ID: ${user.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar unban:", err.message);
  }
}

// ========== VOICE EVENTS (canal 1510402716008972520) ==========
export async function logExternalVoiceJoin(member, channel) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MEMBER_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("🔊 Entrou em Canal de Voz", 0x00ff00)
      .setDescription(`<@${member.id}> | \`${member.user.tag}\` entrou em **${channel.name}**.`)
      .addFields(
        { name: "👤 Utilizador", value: `<@${member.id}>`, inline: true },
        { name: "📍 Canal", value: `<#${channel.id}>`, inline: true }
      )
      .setFooter({ text: `ID: ${member.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar voice join:", err.message);
  }
}

export async function logExternalVoiceLeave(member, channel) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MEMBER_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("🔊 Saiu de Canal de Voz", 0xff6600)
      .setDescription(`<@${member.id}> | \`${member.user.tag}\` saiu de **${channel.name}**.`)
      .addFields(
        { name: "👤 Utilizador", value: `<@${member.id}>`, inline: true },
        { name: "📍 Canal", value: `<#${channel.id}>`, inline: true }
      )
      .setFooter({ text: `ID: ${member.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar voice leave:", err.message);
  }
}

// ========== CHANNEL EVENTS (canal COMMUNITY_LOGS) ==========
export async function logExternalChannelCreate(channel) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.COMMUNITY_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("📁 Canal Criado", 0x00ff00)
      .setDescription(`**#${channel.name}** foi criado.`)
      .addFields(
        { name: "Tipo", value: `\`${channel.type.toString()}\``, inline: true },
        { name: "🆔 ID", value: `\`${channel.id}\``, inline: true }
      )
      .setFooter({ text: `ID: ${channel.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar channel create:", err.message);
  }
}

export async function logExternalChannelDelete(channel) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.COMMUNITY_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("🗑️ Canal Apagado", 0xff0000)
      .setDescription(`**#${channel.name}** foi apagado.`)
      .addFields(
        { name: "Tipo", value: `\`${channel.type.toString()}\``, inline: true },
        { name: "🆔 ID", value: `\`${channel.id}\``, inline: true }
      )
      .setFooter({ text: `ID: ${channel.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar channel delete:", err.message);
  }
}

// ========== ROLE EVENTS (canal COMMUNITY_LOGS) ==========
export async function logExternalRoleCreate(role) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.COMMUNITY_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("🏷️ Cargo Criado", 0x00ff00)
      .setDescription(`**@${role.name}** foi criado.`)
      .addFields(
        { name: "Cor", value: `\`${role.hexColor}\``, inline: true },
        { name: "🆔 ID", value: `\`${role.id}\``, inline: true }
      )
      .setFooter({ text: `ID: ${role.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar role create:", err.message);
  }
}

export async function logExternalRoleDelete(role) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.COMMUNITY_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("🗑️ Cargo Apagado", 0xff0000)
      .setDescription(`**@${role.name}** foi apagado.`)
      .addFields({ name: "🆔 ID", value: `\`${role.id}\``, inline: true })
      .setFooter({ text: `ID: ${role.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar role delete:", err.message);
  }
}

// ========== SEARCH LOG (canal MESSAGE_LOGS) ==========
export async function logExternalSearch(user, query, results) {
  try {
    const logChannel = await getExternalChannel(EXTERNAL_CHANNELS.MESSAGE_LOGS);
    if (!logChannel) return;

    const embed = createBaseEmbed("🔍 Pesquisa Realizada", 0x0099ff)
      .setDescription(`<@${user.id}> | \`${user.tag}\` fez uma pesquisa.`)
      .addFields(
        { name: "Query", value: `\`\`\`${query.substring(0, 1024)}\`\`\``, inline: false },
        { name: "Resultados", value: results ? String(results) : "Nenhum", inline: true }
      )
      .setFooter({ text: `ID: ${user.id}` });

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ExternalLogs] Erro ao logar pesquisa:", err.message);
  }
}

// ========== AUTO-SETUP DE CANAIS NO SERVIDOR EXTERNO ==========
export async function setupExternalLogChannels(guild) {
  try {
    const requiredChannels = [
      { name: "📝-membros-logs", id: EXTERNAL_CHANNELS.MEMBER_LOGS, topic: "Entradas, saídas, voice" },
      { name: "💬-mensagens-logs", id: EXTERNAL_CHANNELS.MESSAGE_LOGS, topic: "Mensagens apagadas/editadas" },
      { name: "👤-membro-updates", id: EXTERNAL_CHANNELS.MEMBER_UPDATES, topic: "Roles, avatar, regras aceites" },
      { name: "🏠-comunidade-logs", id: EXTERNAL_CHANNELS.COMMUNITY_LOGS, topic: "Canais, cargos, bans" },
    ];

    const created = [];
    const existing = [];

    for (const ch of requiredChannels) {
      const channel = await guild.channels.fetch(ch.id).catch(() => null);
      if (!channel) {
        try {
          const newChannel = await guild.channels.create({
            name: ch.name,
            type: 0, // GuildText
            topic: ch.topic,
            permissionOverwrites: [
              { id: guild.id, deny: ["ViewChannel"] }, // Esconde de @everyone
            ],
          });
          created.push(newChannel.name);
          console.log(`[ExternalLogs] Canal criado: ${newChannel.name} (${newChannel.id})`);
        } catch (e) {
          console.error(`[ExternalLogs] Erro ao criar canal ${ch.name}:`, e.message);
        }
      } else {
        existing.push(channel.name);
      }
    }

    if (created.length > 0) {
      console.log(`[ExternalLogs] Canais criados: ${created.join(", ")}`);
    }
    if (existing.length > 0) {
      console.log(`[ExternalLogs] Canais existentes: ${existing.join(", ")}`);
    }
  } catch (err) {
    console.error("[ExternalLogs] Erro no setup:", err.message);
  }
}
