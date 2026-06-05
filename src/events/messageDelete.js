import { Events, EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";
import { logExternalMessageDelete } from "../services/externalLogs.js";

export async function handleMessageDelete(message, client) {
  if (message.author?.bot) return;
  if (!message.guild) return;

  // Verificar se é um canal de ticket - se for, NÃO enviar log local
  const isTicketChannel = Object.values(db.tickets || {}).some(
    t => t.channelId === message.channel.id && !t.closed
  );

  // Log local APENAS se NÃO for canal de ticket
  if (!isTicketChannel) {
    try {
      const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle("🗑️ Mensagem Apagada")
          .addFields(
            { name: "Autor", value: `<@${message.author?.id || "Desconhecido"}>`, inline: true },
            { name: "Canal", value: `<#${message.channel.id}>`, inline: true },
            { name: "Conteúdo", value: message.content?.substring(0, 1024) || "*Vazio/Embed*", inline: false }
          )
          .setColor(0xff0000)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error("[MessageDelete] Erro log local:", err.message);
    }
  }

  // Log externo (servidor 1510401803974475947) - SEMPRE
  await logExternalMessageDelete(message);
}
