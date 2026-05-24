import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";
import { gerarTranscript } from "../utils/transcript.js";

export async function sendLog(ticketId, action, client) {
    const ticket = db.tickets[ticketId];
    if (!ticket) return;

    const logChannelId = CONFIG.CANAL_LOGS;

    const logChannel = await client.channels
        .fetch(logChannelId)
        .catch(() => null);
    if (!logChannel) return;

    const dataAbertura = new Date(ticket.openedAt).toLocaleString("pt-PT", {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Lisbon'
    });

    if (action === "open") {
        const embed = new EmbedBuilder()
            .setTitle(`Logs System - #${ticketId}`)
            .setDescription([
                "⚒️ **Usuário que abriu:**",
                `<@${ticket.userId}> | ${ticket.username}`,
                "",
                `📋 **Tipo:** ${ticket.label}`,
                "",
                "Vá para o ticket pressionando o botão abaixo •"
            ].join("\n"))
            .setColor(0x262af1)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("✅ Ticket Aberto")
                .setStyle(ButtonStyle.Link)
                .setURL(
                    `https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`,
                ),
        );

        await logChannel.send({ embeds: [embed], components: [row] });
    } else if (action === "claim") {
        const embed = new EmbedBuilder()
            .setTitle(`Logs System - #${ticketId}`)
            .setDescription([
                "⚒️ **Usuário que abriu:**",
                `<@${ticket.userId}> | ${ticket.username}`,
                "",
                "⚒️ **Assumido por:**",
                `<@${ticket.claimedBy}> | ${ticket.claimedByName}`,
                "",
                `📋 **Tipo:** ${ticket.label}`,
                "",
                "Vá para o ticket pressionando o botão abaixo •"
            ].join("\n"))
            .setColor(0x262af1)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("✅ Ticket Aberto")
                .setStyle(ButtonStyle.Link)
                .setURL(
                    `https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`,
                ),
        );

        await logChannel.send({ embeds: [embed], components: [row] });
    } else if (action === "close") {
        const dataFechamento = new Date(ticket.closedAt).toLocaleString("pt-PT", {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Lisbon'
        });

        const recrutadoText = ticket.recrutado !== null 
            ? `**Recrutado:** ${ticket.recrutado ? "✅ Sim" : "❌ Não"}` 
            : "";
        const fotoText = ticket.fotoNome ? `**Foto:** ${ticket.fotoNome}` : "";

        const embed = new EmbedBuilder()
            .setTitle(`Logs System - #${ticketId}`)
            .setDescription([
                "⚒️ **Usuário que abriu:**",
                `<@${ticket.userId}> | ${ticket.username}`,
                "",
                "⚒️ **Assumido por:**",
                ticket.claimedBy ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}` : "Ninguém",
                "",
                "⚒️ **Fechado por:**",
                `<@${ticket.closedBy}> | ${ticket.closedByName}`,
                "",
                "↕ **Informações Adicionais:**",
                "**Horários:**",
                `• Abertura: ${dataAbertura}`,
                `• Fechamento: ${dataFechamento}`,
                "**Tipo:**",
                `• ${ticket.label}`,
                recrutadoText,
                fotoText
            ].filter(Boolean).join("\n"))
            .setColor(0x262af1)
            .setTimestamp()
            .setFooter({
                text: "Portugal Alfa Community",
                iconURL: client.user?.displayAvatarURL(),
            });

        const ticketChannel = await client.channels
            .fetch(ticket.channelId)
            .catch(() => null);

        let transcriptFile = null;

        if (ticketChannel) {
            transcriptFile = await gerarTranscript(ticketChannel, ticketId);
        }

        if (transcriptFile) {
            await logChannel.send({
                embeds: [embed],
                files: [transcriptFile],
            });
        } else {
            await logChannel.send({ embeds: [embed] });
        }
    }
}

export async function enviarLogAvaliacao(ticket, estrelas, mensagem, user, client) {
    try {
        const canalAvaliacoes = await client.channels.fetch(CONFIG.CANAL_AVALIACOES).catch(() => null);
        if (!canalAvaliacoes) {
            console.log("Canal de avaliações não encontrado.");
            return;
        }

        const dataAvaliacao = new Date().toLocaleString("pt-PT", {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Lisbon'
        });

        const estrelasTexto = "⭐".repeat(estrelas) + ` (${estrelas}/5)`;

        const embed = new EmbedBuilder()
            .setTitle("Portugal Alfa Community - Avaliação Recebida")
            .setDescription([
                "⚒️ **Usuário:**",
                `<@${user.id}> | ${user.username}`,
                "",
                "🏵️ **Avaliação**",
                estrelasTexto,
                "",
                "⚒️ **Atendido por**",
                ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Ninguém",
                "",
                "🖊️ **Mensagem**",
                mensagem || "Nenhuma mensagem adicionada.",
                "",
                "⏰ **Horário**",
                dataAvaliacao
            ].join("\n"))
            .setColor(0xFFD700)
            .setTimestamp();

        await canalAvaliacoes.send({ embeds: [embed] });
        console.log("✅ Log de avaliação enviado para o canal.");
    } catch (error) {
        console.error("Erro ao enviar log de avaliação:", error);
    }
}

export async function enviarAvaliacaoDM(ticket, client) {
    try {
        const user = await client.users.fetch(ticket.userId).catch(() => null);
        if (!user) {
            console.log("Não foi possível encontrar o utilizador " + ticket.userId + " para enviar avaliação.");
            return;
        }

        const dataFechamento = new Date(ticket.closedAt).toLocaleString("pt-PT", {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Lisbon'
        });

        const embed = new EmbedBuilder()
            .setTitle("🎫 Ticket Fechado")
            .setDescription([
                "Seu ticket foi fechado com sucesso, avalie nosso atendimento clicando nas estrelas abaixo.",
                "",
                "⚒️ **Fechado por:**",
                `<@${ticket.closedBy}> | ${ticket.closedByName}`,
                "",
                "🕑 **Fechado em:**",
                dataFechamento,
                "",
                "Caso necessário, não hesite em abrir ticket novamente!"
            ].join("\n"))
            .setColor(0xFF0000);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`avaliar_1_${ticket.id}`)
                .setLabel("⭐ 1")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`avaliar_2_${ticket.id}`)
                .setLabel("⭐⭐ 2")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`avaliar_3_${ticket.id}`)
                .setLabel("⭐⭐⭐ 3")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`avaliar_4_${ticket.id}`)
                .setLabel("⭐⭐⭐⭐ 4")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`avaliar_5_${ticket.id}`)
                .setLabel("⭐⭐⭐⭐⭐ 5")
                .setStyle(ButtonStyle.Secondary),
        );

        await user.send({
            embeds: [embed],
            components: [row]
        });

        console.log("✅ Avaliação enviada por DM para " + user.tag);
    } catch (error) {
        console.error("Erro ao enviar avaliação por DM:", error);
    }
}
