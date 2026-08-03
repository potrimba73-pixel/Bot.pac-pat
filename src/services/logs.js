import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";

function getDiaSemana(dateStr) {
  const date = new Date(dateStr);
  const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  return dias[date.getDay()];
}

export async function sendLog(ticketId, type, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket) return;

  const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
  if (!logChannel) {
    console.warn("[Logs] Canal de logs não encontrado:", CONFIG.CANAL_LOGS);
    return;
  }

  if (type === "open") {
    const openedTimestamp = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
    const diaSemana = getDiaSemana(ticket.openedAt);

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket Aberto - #${ticket.id}`)
      .setDescription([
        `👤 Utilizador: <@${ticket.userId}> | ${ticket.userName || ticket.username}`,
        `📝 Tipo: ${ticket.label}`,
        `⏰ Abertura: ${diaSemana}, <t:${openedTimestamp}:S>`,
      ].join("\n"))
      .setColor(CONFIG.COR_SUCESSO)
      .setTimestamp();

    if (ticket.truckyNome) {
      embed.addFields({
        name: `🚛 Trucky`,
        value: ticket.truckyLink && ticket.truckyLink.startsWith("http")
          ? `[${ticket.truckyNome}](${ticket.truckyLink})`
          : ticket.truckyNome,
        inline: true
      });
    }

    await logChannel.send({ embeds: [embed] });
  }

  if (type === "close") {
    const openedTimestamp = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
    const closedTimestamp = ticket.closedAt
      ? Math.floor(new Date(ticket.closedAt).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const openedDia = getDiaSemana(ticket.openedAt);
    const closedDia = ticket.closedAt ? getDiaSemana(ticket.closedAt) : getDiaSemana(new Date().toISOString());

    const claimedText = ticket.claimedBy
      ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}`
      : "Não assumido";

    const closedText = ticket.closedBy
      ? ticket.closedByName || "Staff"
      : "Não informado";

    const recrutadoText = ticket.recrutado === true
      ? "Sim 🎉"
      : ticket.recrutado === false
      ? "Não 😔"
      : "N/A";

    const embed = new EmbedBuilder()
      .setTitle(`🗑️ Ticket Fechado - #${ticket.id}`)
      .setDescription([
        `👤 Utilizador: <@${ticket.userId}> | ${ticket.userName || ticket.username}`,
        `👮 Assumido por: ${claimedText}`,
        `👮 Fechado por: ${closedText}`,
        "",
        `⏰ Abertura: ${openedDia}, <t:${openedTimestamp}:S>`,
        `⏰ Fechamento: ${closedDia}, <t:${closedTimestamp}:S>`,
        `📝 Tipo: ${ticket.label}`,
      ].join("\n"))
      .setColor(CONFIG.COR_ERRO)
      .setTimestamp();

    if (ticket.truckyNome) {
      embed.addFields({
        name: `🚛 Trucky`,
        value: ticket.truckyLink && ticket.truckyLink.startsWith("http")
          ? `[${ticket.truckyNome}](${ticket.truckyLink})`
          : ticket.truckyNome,
        inline: true
      });
    }

    if (ticket.fotoNome) {
      embed.addFields({
        name: `📷 Foto Trucky`,
        value: ticket.fotoNome,
        inline: true
      });
    }

    embed.addFields({
      name: `🎉 Recrutado`,
      value: recrutadoText,
      inline: true
    });

    await logChannel.send({ embeds: [embed] });
  }
}
