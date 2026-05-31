import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { gerarTranscript } from "../utils/transcript.js";

export async function sendLog(ticketId, action, client) {
    const ticket = db.tickets[ticketId];
    if (!ticket) return;
    const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
    if (!logChannel) return;

    const dataAbertura = new Date(ticket.openedAt).toLocaleString("pt-PT", {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Lisbon'
    });

    if (action === "open") {
        const embed = new EmbedBuilder()
            .setTitle(`Logs System - #${ticketId}`)
            .setDescription(["Usuário que abriu:", `${ticket.username} (${ticket.userId})`, "", `Tipo: ${ticket.label}`, "", "Vá para o ticket pressionando o botão abaixo"].join("\n"))
            .setColor(0x262af1).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("Ticket Aberto").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`),
        );
        await logChannel.send({ embeds: [embed], components: [row] });
    } else if (action === "claim") {
        const embed = new EmbedBuilder()
            .setTitle(`Logs System - #${ticketId}`)
            .setDescription(["Usuário que abriu:", `${ticket.username} (${ticket.userId})`, "", "Assumido por:", `${ticket.claimedByName} (${ticket.claimedBy})`, "", `Tipo: ${ticket.label}`].join("\n"))
            .setColor(0x262af1).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("Ticket Aberto").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`),
        );
        await logChannel.send({ embeds: [embed], components: [row] });
    } else if (action === "close") {
        const dataFechamento = new Date(ticket.closedAt).toLocaleString("pt-PT", {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Lisbon'
        });
        const recrutadoText = ticket.recrutado !== null ? `Recrutado: ${ticket.recrutado ? "Sim" : "Não"}` : "";
        const fotoText = ticket.fotoNome ? `Foto: ${ticket.fotoNome}` : "";

        const ticketChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
        let transcriptData = null;
        if (ticketChannel) {
            transcriptData = await gerarTranscript(ticketChannel, ticketId);
            if (transcriptData) {
                ticket.transcriptUrl = transcriptData.url;
                await saveDB();
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`Ticket Fechado - #${ticketId}`)
            .setDescription([
                "Usuário que abriu:", `${ticket.username}`, "", "Assumido por:", ticket.claimedByName || "Ninguém", "", "Fechado por:", `${ticket.closedByName}`, "",
                "Informações Adicionais:", `Abertura: ${dataAbertura}`, `Fechamento: ${dataFechamento}`, `Tipo: ${ticket.label}`, recrutadoText, fotoText
            ].filter(Boolean).join("\n"))
            .setColor(0x262af1).setTimestamp()
            .setFooter({ text: "Portugal Alfa Community", iconURL: client.user?.displayAvatarURL() });

        const row = new ActionRowBuilder();
        if (transcriptData) {
            row.addComponents(
                new ButtonBuilder().setLabel("Ver Transcript").setStyle(ButtonStyle.Link).setURL(transcriptData.url),
                new ButtonBuilder().setLabel("Ver no GitHub").setStyle(ButtonStyle.Link).setURL(transcriptData.githubUrl),
            );
        }
        await logChannel.send({ embeds: [embed], components: row.components.length > 0 ? [row] : [] });
    }
}

export async function enviarLogAvaliacao(ticket, estrelas, mensagem, user, client) {
    try {
        const canalAvaliacoes = await client.channels.fetch(CONFIG.CANAL_AVALIACOES).catch(() => null);
        if (!canalAvaliacoes) return;
        const dataAvaliacao = new Date().toLocaleString("pt-PT", {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Lisbon'
        });
        const estrelasTexto = "⭐".repeat(estrelas) + ` (${estrelas}/5)`;
        const embed = new EmbedBuilder()
            .setTitle("Portugal Alfa Community - Avaliação Recebida")
            .setDescription([`Usuário: ${user.username}`, "", "Avaliação", estrelasTexto, "", "Atendido por", ticket.claimedByName || "Ninguém", "", "Mensagem", mensagem || "Nenhuma mensagem adicionada.", "", `Horário: ${dataAvaliacao}`].join("\n"))
            .setColor(0xFFD700).setTimestamp();
        await canalAvaliacoes.send({ embeds: [embed] });
    } catch (error) {
        console.error("Erro ao enviar log de avaliação:", error);
    }
}

export async function enviarAvaliacaoDM(ticket, client) {
    try {
        const user = await client.users.fetch(ticket.userId).catch(() => null);
        if (!user) return;
        const dataFechamento = new Date(ticket.closedAt).toLocaleString("pt-PT", {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Lisbon'
        });
        const embed = new EmbedBuilder()
            .setTitle("Ticket Fechado")
            .setDescription(["Seu ticket foi fechado com sucesso, avalie nosso atendimento clicando nas estrelas abaixo.", "", "Fechado por:", ticket.closedByName, "", "Fechado em:", dataFechamento, "", "Caso necessário, não hesite em abrir ticket novamente!"].join("\n"))
            .setColor(0xFF0000);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`avaliar_1_${ticket.id}`).setLabel("1").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`avaliar_2_${ticket.id}`).setLabel("2").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`avaliar_3_${ticket.id}`).setLabel("3").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`avaliar_4_${ticket.id}`).setLabel("4").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`avaliar_5_${ticket.id}`).setLabel("5").setStyle(ButtonStyle.Secondary),
        );
        await user.send({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error("Erro ao enviar avaliação por DM:", error);
    }
}
