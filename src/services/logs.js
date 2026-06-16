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

  // Link do Trucky se existir
  const truckyLink = ticket.truckyNome && ticket.truckyNome !== "Não informado"
    ? `[${ticket.truckyNome}](https://hub.truckyapp.com/user/${ticket.userId})`
    : null;

  if (action === "open") {
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_TICKET} Logs System - #${ticketId}`)
      .setDescription(
        `${CONFIG.EMOJI_USER} Usuário que abriu:\n` +
        `<@${ticket.userId}> | ${ticket.username}\n\n` +
        `${CONFIG.EMOJI_INFO} Tipo: ${ticket.label}\n` +
        (truckyLink ? `${CONFIG.EMOJI_TRUCK} Trucky: ${truckyLink}\n\n` : "\n") +
        `${CONFIG.EMOJI_TICKET} Vá para o ticket pressionando o botão abaixo`
      )
      .setColor(0x262af1)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`${CONFIG.EMOJI_TICKET} Ticket Aberto`)
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`),
    );

    await logChannel.send({ embeds: [embed], components: [row] });

  } else if (action === "claim") {
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_TICKET} Logs System - #${ticketId}`)
      .setDescription(
        `${CONFIG.EMOJI_USER} Usuário que abriu:\n` +
        `<@${ticket.userId}> | ${ticket.username}\n\n` +
        `${CONFIG.EMOJI_STAFF} Assumido por:\n` +
        `<@${ticket.claimedBy}> | ${ticket.claimedByName}\n\n` +
        `${CONFIG.EMOJI_INFO} Tipo: ${ticket.label}`
      )
      .setColor(0x262af1)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`${CONFIG.EMOJI_TICKET} Ticket Aberto`)
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`),
    );

    await logChannel.send({ embeds: [embed], components: [row] });

  } else if (action === "close") {
    const dataFechamento = new Date(ticket.closedAt).toLocaleString("pt-PT", {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Lisbon'
    });

    const recrutadoText = ticket.recrutado !== null
      ? `${CONFIG.EMOJI_CHECK} Recrutado: ${ticket.recrutado ? "Sim" : "Não"}`
      : "";
    const fotoText = ticket.fotoNome ? `${CONFIG.EMOJI_FILE} Foto: ${ticket.fotoNome}` : "";
    const truckyText = ticket.truckyNome && ticket.truckyNome !== "Não informado"
      ? `${CONFIG.EMOJI_TRUCK} Trucky: [${ticket.truckyNome}](https://hub.truckyapp.com/user/${ticket.userId})`
      : "";

    // GERAR TRANSCRIPT
    let transcriptAttachment = null;
    const ticketChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (ticketChannel) {
      transcriptAttachment = await gerarTranscript(ticketChannel, ticketId);
    }

    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_FECHAR} Ticket Fechado - #${ticketId}`)
      .setDescription(
        `${CONFIG.EMOJI_USER} Usuário que abriu:\n` +
        `<@${ticket.userId}> | ${ticket.username}\n\n` +
        `${CONFIG.EMOJI_STAFF} Assumido por:\n` +
        (ticket.claimedBy ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}` : "Ninguém") +
        `\n\n${CONFIG.EMOJI_STAFF} Fechado por:\n` +
        `<@${ticket.closedBy}> | ${ticket.closedByName}\n\n` +
        `${CONFIG.EMOJI_INFO} Informações Adicionais:\n` +
        `Abertura: ${dataAbertura}\n` +
        `Fechamento: ${dataFechamento}\n` +
        `Tipo: ${ticket.label}\n` +
        (truckyText ? `${truckyText}\n` : "") +
        (recrutadoText ? `${recrutadoText}\n` : "") +
        (fotoText ? `${fotoText}` : "")
      )
      .setColor(0x262af1)
      .setTimestamp()
      .setFooter({ text: "Portugal Alfa Community", iconURL: client.user?.displayAvatarURL() });

    if (transcriptAttachment) {
      await logChannel.send({
        embeds: [embed],
        files: [transcriptAttachment.attachment]
      });
    } else {
      await logChannel.send({ embeds: [embed] });
    }
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
      .setDescription(
        `${CONFIG.EMOJI_USER} Usuário: <@${user.id}> | ${user.username}\n\n` +
        `${CONFIG.EMOJI_TICKET} Ticket: #${ticket.id}\n` +
        `${CONFIG.EMOJI_INFO} Tipo: ${ticket.label || "N/A"}\n\n` +
        `${CONFIG.EMOJI_STAR} Avaliação\n` +
        `${estrelasTexto}\n\n` +
        `${CONFIG.EMOJI_STAFF} Atendido por\n` +
        (ticket.claimedBy ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}` : "Ninguém") +
        `\n\n${CONFIG.EMOJI_EDIT} Mensagem\n` +
        `${mensagem || "Nenhuma mensagem adicionada."}\n\n` +
        `${CONFIG.EMOJI_TIME} Horário: ${dataAvaliacao}`
      )
      .setColor(0xFFD700)
      .setTimestamp();

    await canalAvaliacoes.send({ embeds: [embed] });
  } catch (error) {
    console.error("Erro ao enviar log de avaliação:", error);
  }
}

export async function enviarAvaliacaoDM(ticket, client) {
  try {
    const user = await client.users.fetch(ticket.userId).catch(() => null);
    if (!user) {
      console.log(`[DM] Utilizador ${ticket.userId} não encontrado, não foi possível enviar avaliação.`);
      return;
    }

    const dataFechamento = new Date(ticket.closedAt).toLocaleString("pt-PT", {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Lisbon'
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_STAR} Ticket Fechado`)
      .setDescription(
        `${CONFIG.EMOJI_INFO} Seu ticket foi fechado com sucesso, avalie nosso atendimento clicando nas estrelas abaixo.\n\n` +
        `${CONFIG.EMOJI_TICKET} Ticket: #${ticket.id}\n` +
        `${CONFIG.EMOJI_INFO} Tipo: ${ticket.label || "N/A"}\n\n` +
        `${CONFIG.EMOJI_STAFF} Fechado por:\n` +
        `<@${ticket.closedBy}> | ${ticket.closedByName}\n\n` +
        `${CONFIG.EMOJI_TIME} Fechado em:\n` +
        `${dataFechamento}\n\n` +
        `${CONFIG.EMOJI_TICKET} Caso necessário, não hesite em abrir ticket novamente!`
      )
      .setColor(0xFF0000);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`avaliar_1_${ticket.id}`).setLabel("1⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliar_2_${ticket.id}`).setLabel("2⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliar_3_${ticket.id}`).setLabel("3⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliar_4_${ticket.id}`).setLabel("4⭐").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`avaliar_5_${ticket.id}`).setLabel("5⭐").setStyle(ButtonStyle.Secondary),
    );

    await user.send({ embeds: [embed], components: [row] });
    console.log(`[DM] ✅ Avaliação enviada para ${user.tag}`);
  } catch (error) {
    // CORREÇÃO: Não crashar se não conseguir enviar DM
    if (error.code === 50278) {
      console.log(`[DM] ⚠️ Não foi possível enviar DM para ${ticket.userId}: utilizador não partilha servidor com o bot.`);
    } else if (error.code === 50007) {
      console.log(`[DM] ⚠️ Não foi possível enviar DM para ${ticket.userId}: DMs desativadas.`);
    } else {
      console.error(`[DM] ⚠️ Erro ao enviar avaliação por DM:`, error.message);
    }
  }
}
