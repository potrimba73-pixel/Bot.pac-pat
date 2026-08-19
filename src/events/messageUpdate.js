import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

export async function handleMessageUpdate(oldMessage, newMessage) {
  if (newMessage.author?.bot) return;
  if (!newMessage.guild) return;
  if (oldMessage.content === newMessage.content) return; // Ignora se não mudou o texto

  const logChannel = await newMessage.guild.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
  if (!logChannel) return;

  const author = newMessage.author;

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C) // Cor Amarela
    .setAuthor({ 
      name: `@${author.username}`, 
      iconURL: author.displayAvatarURL({ dynamic: true }) 
    })
    .setTitle(`✏️ ${author} editou uma mensagem de texto`)
    .addFields(
      { name: "Canal de texto:", value: `#・${newMessage.channel.name}`, inline: false },
      { name: "Antiga mensagem:", value: `\`\`\`\n${oldMessage.content || "Sem texto"}\n\`\`\``, inline: false },
      { name: "Nova mensagem:", value: `\`\`\`\n${newMessage.content || "Sem texto"}\n\`\`\``, inline: false }
    )
    .setFooter({ text: `ID do usuário: ${author.id}` })
    .setTimestamp();

  return logChannel.send({ embeds: [embed] });
}
