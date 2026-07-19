import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { sendExternalLog } from "../services/externalLogs.js";

export default {
  name: "voiceStateUpdate",
  async execute(oldState, newState, client) {
    if (oldState.guild.id !== CONFIG.GUILD_ID) return;
    if (oldState.member?.user?.bot) return;

    const member = newState.member || oldState.member;
    if (!member) return;

    let content = null;

    // Entrou num canal
    if (!oldState.channelId && newState.channelId) {
      content = `👉🎤 <@${member.id}> entrou no canal de voz **${newState.channel.name}**`;
    }
    // Saiu de um canal
    else if (oldState.channelId && !newState.channelId) {
      content = `👈🎤 <@${member.id}> saiu do canal de voz **${oldState.channel.name}**`;
    }
    // Mudou de canal
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      content = `↔️🎤 <@${member.id}> mudou de **${oldState.channel.name}** para **${newState.channel.name}**`;
    }

    if (!content) return;

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.INFO)
      .setDescription(content)
      .setThumbnail(member.user.displayAvatarURL())
      .setFooter({ text: `ID: ${member.id}`, iconURL: member.user.displayAvatarURL() })
      .setTimestamp();

    await sendExternalLog(client, embed);
  }
};
