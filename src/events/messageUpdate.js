import { Events, EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";
import { logExternalMessageUpdate } from "../services/externalLogs.js";

export async function handleMessageUpdate(oldMessage, newMessage, client) {
  if (newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  if (!newMessage.guild) return;

  // Log local
  try {
    const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle("✏️ Mensagem Editada")
        .addFields(
          { name: "Autor", value: `<@${newMessage.author.id}>`, inline: true },
          { name: "Canal", value: `<#${newMessage.channel.id}>`, inline: true },
          { name: "Antes", value: oldMessage.content?.substring(0, 1024) || "*Vazio*", inline: false },
          { name: "Depois", value: newMessage.content?.substring(0, 1024) || "*Vazio*", inline: false }
        )
        .setColor(0xffff00)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("[MessageUpdate] Erro log local:", err.message);
  }

  // Log externo (servidor 1510401803974475947)
  await logExternalMessageUpdate(oldMessage, newMessage);
}
