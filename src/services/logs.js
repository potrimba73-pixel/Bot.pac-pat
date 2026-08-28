import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";

import {
  formatDateFull,
  getClockEmoji,
  formatDuration,
  getDurationEmoji,
} from "../utils/dateUtils.js";

/**
 * ============================================================
 * TIMEZONE
 * ============================================================
 */

function formatDateWithTimezone(
  date,
  format = "short"
) {
  if (!date) return "—";

  const options = {
    timeZone: "Europe/Lisbon",

    day: "2-digit",
    month: "2-digit",
    year: "numeric",

    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  if (format === "full") {
    options.weekday = "long";
  }

  return new Intl.DateTimeFormat(
    "pt-PT",
    options
  ).format(new Date(date));
}

/**
 * ============================================================
 * UNIX TIMESTAMP
 * ============================================================
 */

function getUnixTimestamp(date) {
  return Math.floor(
    new Date(date).getTime() / 1000
  );
}

/**
 * ============================================================
 * USER TAG
 * ============================================================
 */

function getUserTag(user) {
  if (!user) {
    return "Desconhecido";
  }

  return user.tag ||
    user.globalName ||
    user.username ||
    "Desconhecido";
}

/**
 * ============================================================
 * LOGS DE ABERTURA / FECHO
 * ============================================================
 */

export async function sendLog(
  ticketId,
  type,
  client
) {
  try {

    const ticket =
      db.tickets[ticketId];

    if (!ticket) {
      console.warn(
        `[Logs] Ticket #${ticketId} não encontrado.`
      );

      return;
    }

    const logChannel =
      await client.channels
        .fetch(CONFIG.CANAL_LOGS)
        .catch(() => null);

    if (!logChannel) {
      console.warn(
        "[Logs] Canal de logs não encontrado:",
        CONFIG.CANAL_LOGS
      );

      return;
    }

    /**
     * ========================================================
     * ABERTURA
     * ========================================================
     */

    if (type === "open") {

      const isRecruitment =
        ticket.type === "recrutamento";

      const openedAt =
        ticket.openedAt
          ? new Date(ticket.openedAt)
          : new Date();

      const clockEmoji =
        getClockEmoji(
          openedAt
        );

      let description =
        `👤 **Aberto por:** <@${ticket.userId}>`;

      if (
        ticket.userName ||
        ticket.username
      ) {
        description +=
          ` | \`${ticket.userName || ticket.username}\``;
      }

      if (
        isRecruitment &&
        ticket.truckyNome
      ) {
        description +=
          `\n🚛 **Trucky:** \`${ticket.truckyNome}\``;
      }

      description +=
        `\n📝 **Tipo:** ${ticket.label || ticket.type || "N/A"}`;

      description +=
        `\n\n${clockEmoji} **Abertura:** ${formatDateFull(openedAt)}`;

      description +=
        `\n\n🎫 **Aceda ao ticket ao pressionar o botão abaixo**`;

      const embed =
        new EmbedBuilder()
          .setTitle(
            `🎫 Ticket Aberto - #${ticket.id || ticketId}`
          )
          .setDescription(
            description
          )
          .setColor(0x2629F1)
          .setTimestamp(
            openedAt
          );

      const row =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel(
                "🎫 Ir para o Ticket"
              )
              .setStyle(
                ButtonStyle.Link
              )
              .setURL(
                `https://discord.com/channels/${ticket.guildId}/${ticket.channelId}`
              )
          );

      await logChannel.send({
        embeds: [embed],
        components: [row],
      });

      return;
    }

    /**
     * ========================================================
     * FECHO
     * ========================================================
     */

    if (type === "close") {

      const isRecruitment =
        ticket.type === "recrutamento";

      const closedAt =
        ticket.closedAt
          ? new Date(ticket.closedAt)
          : new Date();

      const openedAt =
        ticket.openedAt
          ? new Date(ticket.openedAt)
          : closedAt;

      const recrutadoText =
        ticket.recrutado === true
          ? "✅ Sim"
          : ticket.recrutado === false
            ? "❌ Não"
            : "N/A";

      const clockEmojiAbertura =
        getClockEmoji(
          openedAt
        );

      const clockEmojiFecho =
        getClockEmoji(
          closedAt
        );

      const duracao =
        formatDuration(
          openedAt,
          closedAt
        );

      const duracaoEmoji =
        getDurationEmoji(
          openedAt,
          closedAt
        );

      let description =
        `👤 **Aberto por:** <@${ticket.userId}>`;

      if (
        ticket.userName ||
        ticket.username
      ) {
        description +=
          ` | \`${ticket.userName || ticket.username}\``;
      }

      if (
        isRecruitment &&
        ticket.truckyNome
      ) {
        description +=
          `\n🚛 **Trucky:** \`${ticket.truckyNome}\``;
      }

      description +=
        `\n📝 **Tipo:** ${ticket.label || ticket.type || "N/A"}`;

      description +=
        `\n\n⚒️ **Assumido por:** ${
          ticket.claimedBy
            ? `<@${ticket.claimedBy}>`
            : "Não assumido"
        }`;

      description +=
        `\n👮 **Fechado por:** ${
          ticket.closedBy
            ? `<@${ticket.closedBy}>`
            : "Não informado"
        }`;

      description +=
        `\n\n↕ **Informações Adicionais:**`;

      description +=
        `\n🕑 **Horários:**`;

      description +=
        `\n• ${clockEmojiAbertura} **Abertura:** ${formatDateFull(openedAt)}`;

      description +=
        `\n• ${clockEmojiFecho} **Fechamento:** ${formatDateFull(closedAt)}`;

      description +=
        `\n• ${duracaoEmoji} **Duração:** ${duracao}`;

      /**
       * Recrutamento
       */

      if (isRecruitment) {

        description +=
          `\n🚛 **Nome no Trucky:**`;

        description +=
          `\n• \`${ticket.truckyNome || "Não informado"}\``;

        description +=
          `\n💼 **Recrutado:**`;

        description +=
          `\n• ${recrutadoText}`;

        if (ticket.fotoNome) {

          description +=
            `\n📷 **Nome para Foto:**`;

          description +=
            `\n• \`${ticket.fotoNome}\``;
        }
      }

      /**
       * Avaliação, se já existir
       */

      if (
        ticket.rating !== undefined &&
        ticket.rating !== null
      ) {

        const rating =
          Math.max(
            0,
            Math.min(
              5,
              Number(ticket.rating)
            )
          );

        const stars =
          "⭐".repeat(rating) +
          "☆".repeat(5 - rating);

        description +=
          `\n\n⭐ **Avaliação:** ${stars} (${rating}/5)`;

        if (
          ticket.evaluationComment
        ) {
          description +=
            `\n💬 **Comentário:** ${ticket.evaluationComment}`;
        }
      }

      const embed =
        new EmbedBuilder()
          .setTitle(
            `🗑️ Ticket Fechado - #${ticket.id || ticketId}`
          )
          .setDescription(
            description
          )
          .setColor(0x2629F1)
          .setTimestamp(
            closedAt
          );

      await logChannel.send({
        embeds: [embed],
      });

      return;
    }

    console.warn(
      `[Logs] Tipo de log desconhecido: ${type}`
    );

  } catch (error) {

    console.error(
      `[Logs] Erro ao enviar log do ticket #${ticketId}:`,
      error
    );
  }
}

/**
 * ============================================================
 * LOG DE AVALIAÇÃO
 * ============================================================
 */

export async function sendAvaliacaoLog(
  ticketId,
  client
) {
  try {

    const ticket =
      db.tickets[ticketId];

    if (!ticket) {
      console.warn(
        `[Avaliação] Ticket #${ticketId} não encontrado.`
      );

      return;
    }

    const logChannel =
      await client.channels
        .fetch(CONFIG.CANAL_LOGS)
        .catch(() => null);

    if (!logChannel) {
      console.warn(
        "[Avaliação] Canal de logs não encontrado:",
        CONFIG.CANAL_LOGS
      );

      return;
    }

    /**
     * ========================================================
     * STAFF
     * ========================================================
     */

    let staffUser = null;

    if (ticket.claimedBy) {
      try {
        staffUser =
          await client.users.fetch(
            ticket.claimedBy
          );
      } catch {
        staffUser = null;
      }
    }

    /**
     * ========================================================
     * AVALIADOR
     * ========================================================
     */

    let avaliador = null;

    if (ticket.userId) {
      try {
        avaliador =
          await client.users.fetch(
            ticket.userId
          );
      } catch {
        avaliador = null;
      }
    }

    /**
     * ========================================================
     * AVALIAÇÃO
     * ========================================================
     */

    const rawRating =
      Number(
        ticket.rating ?? 0
      );

    const rating =
      Number.isFinite(
        rawRating
      )
        ? Math.max(
            0,
            Math.min(
              5,
              Math.round(rawRating)
            )
          )
        : 0;

    const estrelasTexto =
      "⭐".repeat(rating) +
      "☆".repeat(5 - rating);

    /**
     * ========================================================
     * DADOS
     * ========================================================
     */

    const avaliadorMencao =
      avaliador
        ? `<@${avaliador.id}>`
        : ticket.userId
          ? `<@${ticket.userId}>`
          : "Desconhecido";

    const avaliadorTag =
      avaliador
        ? getUserTag(avaliador)
        : "Desconhecido";

    const staffMencao =
      staffUser
        ? `<@${staffUser.id}>`
        : "Não atribuído";

    const staffTag =
      staffUser
        ? getUserTag(staffUser)
        : "N/A";

    /**
     * ========================================================
     * COMENTÁRIO
     * ========================================================
     *
     * Aceita vários nomes possíveis para manter
     * compatibilidade com diferentes versões da DB.
     */

    const comentario =
      ticket.evaluationComment ??
      ticket.ratingComment ??
      ticket.avaliacaoComment ??
      ticket.comment ??
      ticket.feedback ??
      null;

    /**
     * ========================================================
     * DATA / UNIX
     * ========================================================
     */

    const agora =
      new Date();

    const unixTimestamp =
      getUnixTimestamp(
        agora
      );

    const dataFormatada =
      formatDateWithTimezone(
        agora
      );

    const diaSemana =
      new Intl.DateTimeFormat(
        "pt-PT",
        {
          timeZone:
            "Europe/Lisbon",

          weekday:
            "long",
        }
      ).format(agora);

    /**
     * ========================================================
     * MENSAGEM
     * ========================================================
     */

    const logMessage = [
      `⭐ **Portugal Alfa Community - Avaliação Recebida #${ticket.id || ticketId}**`,

      `👤 **Avaliado por:** ${avaliadorMencao} | \`${avaliadorTag}\``,

      "",

      "⭐ **Avaliação:**",

      `\`${estrelasTexto}\` (${rating}/5)`,

      "",

      "👮 **Atendido por:**",

      `${staffMencao} | \`${staffTag}\``,

      "",

      "✏️ **Mensagem:**",

      comentario
        ? `> ${String(comentario)
            .replace(/\n/g, "\n> ")}`
        : "> (sem mensagem)",

      "",

      `🕑 **Horário:** ${diaSemana}, <t:${unixTimestamp}:F>`,

      `📅 ${dataFormatada}`,

      "",

      `🎫 **Ticket:** #${ticket.id || ticketId}`,
    ].join("\n");

    /**
     * ========================================================
     * ENVIAR
     * ========================================================
     */

    await logChannel.send(
      logMessage
    );

  } catch (error) {

    console.error(
      `[Avaliação] Erro ao enviar avaliação do ticket #${ticketId}:`,
      error
    );
  }
}
