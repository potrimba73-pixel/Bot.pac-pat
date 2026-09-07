// src/events/messageUpdate.js
import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { logExternalMessageUpdate } from "../services/externalLogs.js";

export async function handleMessageUpdate(oldMessage, newMessage, client) {
  // Ignorar bots e DMs
  if (newMessage.author?.bot) return;
  if (!newMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;

  // Enviar log para o servidor externo (canal de mensagens)
  try {
    await logExternalMessageUpdate(oldMessage, newMessage);
    console.log(`[MessageUpdate] Log enviado para servidor externo: ${newMessage.id}`);
  } catch (error) {
    console.error("[MessageUpdate] Erro ao enviar log externo:", error);
  }

  // Opcional: manter também um log interno no servidor principal (se desejar)
  // Descomentar as linhas abaixo para ativar o log local
  /*
  try {
    const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setAuthor({ name: newMessage.author.username, iconURL: newMessage.author.displayAvatarURL({ dynamic: true }) })
        .setTitle(`✏️ ${newMessage.author} editou uma mensagem de texto`)
        .addFields(
          { name: "Canal de texto:", value: `<#${newMessage.channel.id}>`, inline: false },
          { name: "Antiga mensagem:", value: `\`\`\`\n${oldMessage.content || "Sem texto"}\n\`\`\``, inline: false },
          { name: "Nova mensagem:", value: `\`\`\`\n${newMessage.content || "Sem texto"}\n\`\`\``, inline: false }
        )
        .setFooter({ text: `ID do usuário: ${newMessage.author.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("[MessageUpdate] Erro ao enviar log local:", error);
  }
  */
}
