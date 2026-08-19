import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

export async function handleVoiceStateUpdate(oldState, newState, client) {
  if (!newState.guild) return;

  const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
  if (!logChannel) return;

  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  // Entrou em Canal de Voz
  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setDescription(`**Entrou em Canal de Voz**\n${member} | \`${member.user.username}\` entrou em **${newState.channel.name}**.`)
      .addFields(
        { name: "Utilizador", value: `${member}`, inline: false },
        { name: "Canal", value: `⁠${newState.guild.name}⁠🔊${newState.channel.name}`, inline: false }
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    return logChannel.send({ embeds: [embed] });
  }

  // Saiu de Canal de Voz
  if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setDescription(`**Saiu de Canal de Voz**\n${member} | \`${member.user.username}\` saiu de **${oldState.channel.name}**.`)
      .addFields(
        { name: "Utilizador", value: `${member}`, inline: false },
        { name: "Canal", value: `⁠${oldState.guild.name}⁠🔊${oldState.channel.name}`, inline: false }
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    return logChannel.send({ embeds: [embed] });
  }
}
