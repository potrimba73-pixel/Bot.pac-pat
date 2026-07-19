import { EmbedBuilder, AuditLogEvent } from "discord.js";
import { CONFIG } from "../config/index.js";

const JOCKIE_BOT_IDS = ["411916947773587456", "412347257233604609", "696354359568695317", "696363427599958127"];

export async function sendExternalLog(client, embed, options = {}) {
  try {
    const guild = await client.guilds.fetch(CONFIG.LOG_SERVER_ID);
    const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID);
    if (!channel) return;

    if (options.content) {
      await channel.send({ content: options.content, embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error("[External Logs] Erro:", e.message);
  }
}

export async function logMessageDelete(client, message) {
  if (message.author?.bot && JOCKIE_BOT_IDS.includes(message.author.id)) return;
  if (!message.guild) return;

  let apagadoPor = "🤖 Bot / Proprio Autor";
  let apagadoPorTag = "Sistema";

  try {
    const auditLogs = await message.guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 5
    });
    const entry = auditLogs.entries.find(e => 
      e.target?.id === message.author?.id && 
      Date.now() - e.createdTimestamp < 5000
    );
    if (entry) {
      apagadoPor = `<@${entry.executor.id}>`;
      apagadoPorTag = entry.executor.tag;
    }
  } catch (e) {
    // Ignorar erro de permissao
  }

  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.DANGER)
    .setTitle("🗑️ Mensagem Apagada")
    .addFields(
      { name: "👤 Autor", value: message.author ? `<@${message.author.id}> | ${message.author.tag}` : "Desconhecido", inline: false },
      { name: "🧹 Apagado por", value: `${apagadoPor} | ${apagadoPorTag}`, inline: false },
      { name: "📍 Canal", value: `<#${message.channel.id}>`, inline: false }
    )
    .setTimestamp();

  if (message.content) {
    embed.addFields({ name: "📝 Conteudo", value: message.content.substring(0, 1000) || "Vazio/Embed/Anexo", inline: false });
  } else {
    embed.addFields({ name: "📝 Conteudo", value: "Vazio/Embed/Anexo", inline: false });
  }

  // Anexos com URL direto (nao expira)
  if (message.attachments?.size > 0) {
    const anexos = [];
    for (const [id, att] of message.attachments) {
      anexos.push(`[${att.name}](${att.url})`);
    }
    embed.addFields({ name: "📎 Anexos", value: anexos.join("\n"), inline: false });
  }

  await sendExternalLog(client, embed);
}

export async function logMessageUpdate(client, oldMessage, newMessage) {
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.WARNING)
    .setTitle("✏️ Mensagem Editada")
    .addFields(
      { name: "👤 Autor", value: `<@${oldMessage.author.id}> | ${oldMessage.author.tag}`, inline: false },
      { name: "📍 Canal", value: `<#${oldMessage.channel.id}>`, inline: false },
      { name: "📝 Antes", value: oldMessage.content?.substring(0, 1000) || "Vazio", inline: false },
      { name: "📝 Depois", value: newMessage.content?.substring(0, 1000) || "Vazio", inline: false }
    )
    .setTimestamp();

  await sendExternalLog(client, embed);
}
