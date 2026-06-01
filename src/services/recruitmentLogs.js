import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

export async function logMemberJoin(member, client) {
    try {
        const logChannelId = CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle("📝 Novo Candidato - Recrutamento")
            .setDescription(`${member.user.tag} entrou no servidor de recrutamento.`)
            .addFields(
                { name: "ID", value: member.id, inline: true },
                { name: "Conta criada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false }
            )
            .setColor(0x0099ff)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[RecruitmentLogs] Erro ao logar entrada:", err.message);
    }
}

export async function logRecruitmentAction(client, action, data) {
    try {
        const logChannelId = CONFIG.CANAL_LOG_RECRUTAMENTO_MSG;
        if (!logChannelId) return;

        const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor(action === "join" ? 0x00ff00 : action === "leave" ? 0xff0000 : 0x0099ff)
            .setTitle(`Recrutamento: ${action.toUpperCase()}`)
            .setTimestamp();

        if (data.user) {
            embed.addFields(
                { name: "Utilizador", value: `<@${data.user.id}> (${data.user.tag})`, inline: true },
                { name: "ID", value: data.user.id, inline: true }
            );
        }

        if (data.guild) {
            embed.addFields({ name: "Servidor", value: data.guild.name, inline: false });
        }

        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[RecruitmentLogs] Erro:", err.message);
    }
}
