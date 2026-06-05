import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { gerarTranscript, enviarTranscriptComoFicheiro } from "../utils/transcript.js";

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
      .setTitle(`${CONFIG.EMOJI_TICKET} Logs System - #${ticketId}`)
      .setDescription([
        `${CONFIG.EMOJI_USER} Usuário que abriu:`, 
        `${ticket.username} (${ticket.userId})`, 
        "", 
        `${CONFIG.EMOJI_INFO} Tipo: ${ticket.label}`, 
        "", 
        `${CONFIG.EMOJI_TICKET} Vá para o ticket pressionando o botão abaixo`
      ].join("\n"))
      .setColor(0x262af1).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel(`${CONFIG.EMOJI_TICKET} Ticket Aberto`).setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`),
    );
    await logChannel.send({ embeds: [embed], components: [row] });
  } else if (action === "claim") {
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_TICKET} Logs System - #${ticketId}`)
      .setDescription([
        `${CONFIG.EMOJI_USER} Usuário que abriu:`, 
        `${ticket.username} (${ticket.userId})`, 
        "", 
        `${CONFIG.EMOJI_STAFF} Assumido por:`, 
        `${ticket.claimedByName} (${ticket.claimedBy})`, 
        "", 
        `${CONFIG.EMOJI_INFO} Tipo: ${ticket.label}`
      ].join("\n"))
      .setColor(0x262af1).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel(`${CONFIG.EMOJI_TICKET} Ticket Aberto`).setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`),
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
      .setTitle(`${CONFIG.EMOJI_FECHAR} Ticket Fechado - #${ticketId}`)
      .setDescription([
        `${CONFIG.EMOJI_USER} Usuário que abriu:`, `${ticket.username}`, "", 
        `${CONFIG.EMOJI_STAFF} Assumido por:`, ticket.claimedByName || "Ninguém", "", 
        `${CONFIG.EMOJI_STAFF} Fechado por:`, `${ticket.closedByName}`, "",
        `${CONFIG.EMOJI_INFO} Informações Adicionais:`, `Abertura: ${dataAbertura}`, `Fechamento: ${dataFechamento}`, `Tipo: ${ticket.label}`, recrutadoText, fotoText
      ].filter(Boolean).join("\n"))
      .setColor(0x262af1).setTimestamp()
      .setFooter({ text: "Portugal Alfa Community", iconURL: client.user?.displayAvatarURL() });

    const row = new ActionRowBuilder();

    // Enviar transcript como ficheiro HTML no log
    if (transcriptData) {
      try {
        const fileResult = await enviarTranscriptComoFicheiro(logChannel, ticketId, client);
        if (fileResult) {
          row.addComponents(
            new ButtonBuilder().setLabel(`${CONFIG.EMOJI_FILE} Ver Transcript`).setStyle(ButtonStyle.Link).setURL(fileResult.url),
          );
        }
      } catch (e) {
        console.error("Erro ao enviar transcript:", e);
      }
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
    const estrelasTexto = `${CONFIG.EMOJI_STAR}`.repeat(estrelas) + ` (${estrelas}/5)`;
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_STAR} Portugal Alfa Community - Avaliação Recebida`)
      .setDescription([
        `${CONFIG.EMOJI_USER} Usuário: ${user.username}`, 
        "", 
        `${CONFIG.EMOJI_STAR} Avaliação`, 
        estrelasTexto, 
        "", 
        `${CONFIG.EMOJI_STAFF} Atendido por`, 
        ticket.claimedByName || "Ninguém", 
        "", 
        `${CONFIG.EMOJI_EDIT} Mensagem`, 
        mensagem || "Nenhuma mensagem adicionada.", 
        "", 
        `${CONFIG.EMOJI_TIME} Horário: ${dataAvaliacao}`
      ].join("\n"))
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

    // Criar emojis de estrelas para os botoes
    const starEmojis = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"];

    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_STAR} Ticket Fechado`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Seu ticket foi fechado com sucesso, avalie nosso atendimento clicando nas estrelas abaixo.`, 
        "", 
        `${CONFIG.EMOJI_STAFF} Fechado por:`, 
        ticket.closedByName, 
        "", 
        `${CONFIG.EMOJI_TIME} Fechado em:`, 
        dataFechamento, 
        "", 
        `${CONFIG.EMOJI_TICKET} Caso necessário, não hesite em abrir ticket novamente!`
      ].join("\n"))
      .setColor(0xFF0000);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`avaliar_1_${ticket.id}`).setLabel("1⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliar_2_${ticket.id}`).setLabel("2⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliar_3_${ticket.id}`).setLabel("3⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliar_4_${ticket.id}`).setLabel("4⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliar_5_${ticket.id}`).setLabel("5⭐").setStyle(ButtonStyle.Secondary),
    );

    await user.send({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error("Erro ao enviar avaliação por DM:", error);
  }
}
