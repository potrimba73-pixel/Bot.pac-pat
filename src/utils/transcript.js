import { AttachmentBuilder } from "discord.js";
import discordTranscripts from "discord.js-html-transcript";

const DEFAULT_OPTIONS = {
  locale: "pt-PT",
  timeZone: "Europe/Lisbon",
  maxMessages: 10000,
  includeTxt: true,
  saveImages: false,
};

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeText(value = "") {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function formatDate(date, options = DEFAULT_OPTIONS) {
  if (!date) return "—";

  try {
    return new Intl.DateTimeFormat(options.locale, {
      timeZone: options.timeZone,
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(date));
  } catch {
    return "—";
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatFileSize(bytes) {
  const size = Number(bytes);

  if (!Number.isFinite(size) || size < 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * ============================================================
 * INFORMAÇÕES DO TICKET
 * ============================================================
 */

function renderTicketInfo(info = {}) {
  const {
    openedBy,
    openedAt,
    closedBy,
    closedAt,
    claimedBy,
    evaluationSent,
    evaluation,
    evaluationComment,
    ticketType,
    ticketLabel,
    truckyNome,
    recrutado,
    fotoNome,
    duration,
  } = info;

  const hasInfo =
    openedBy ||
    openedAt ||
    closedBy ||
    closedAt ||
    claimedBy ||
    evaluationSent !== undefined ||
    evaluation !== undefined ||
    evaluationComment ||
    ticketType ||
    ticketLabel ||
    truckyNome ||
    recrutado !== undefined ||
    fotoNome ||
    duration;

  if (!hasInfo) return "";

  const item = (label, value) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "";
    }

    return `
      <div class="ticket-info-item">
        <span>${label}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  };

  return `
    <section class="ticket-info">
      <div class="ticket-info-title">
        <span>📋</span>
        <strong>Informações do ticket</strong>
      </div>

      <div class="ticket-info-grid">

        ${item("👤 Aberto por", openedBy)}
        ${item("🕐 Aberto em", openedAt)}

        ${item(
          "📝 Tipo",
          ticketLabel || ticketType
        )}

        ${item(
          "🛡️ Assumido por",
          claimedBy
        )}

        ${item(
          "👮 Fechado por",
          closedBy
        )}

        ${item(
          "⏰ Fechado em",
          closedAt
        )}

        ${item(
          "⌛ Duração",
          duration
        )}

        ${
          evaluationSent !== undefined
            ? item(
                "📨 Avaliação enviada",
                evaluationSent
                  ? "Sim"
                  : "Não"
              )
            : ""
        }

        ${
          evaluation !== undefined &&
          evaluation !== null
            ? item(
                "⭐ Avaliação",
                `${evaluation}${
                  Number.isFinite(
                    Number(evaluation)
                  )
                    ? " / 5"
                    : ""
                }`
              )
            : ""
        }

        ${item(
          "🚛 Nome no Trucky",
          truckyNome
        )}

        ${
          recrutado !== undefined
            ? item(
                "💼 Recrutado",
                recrutado === true
                  ? "✅ Sim"
                  : recrutado === false
                    ? "❌ Não"
                    : "N/A"
              )
            : ""
        }

        ${item(
          "📷 Nome para foto",
          fotoNome
        )}

        ${
          evaluationComment
            ? `
              <div class="ticket-info-item ticket-info-full">
                <span>💬 Comentário da avaliação</span>
                <strong>
                  ${escapeHtml(
                    evaluationComment
                  )}
                </strong>
              </div>
            `
            : ""
        }

      </div>
    </section>
  `;
}

/**
 * ============================================================
 * CSS DO CABEÇALHO
 * ============================================================
 *
 * O conteúdo das mensagens é renderizado pela biblioteca,
 * que usa uma interface muito mais próxima do Discord.
 */

function getWrapperCss() {
  return `
    :root {
      --discord-bg: #313338;
      --discord-secondary: #2b2d31;
      --discord-tertiary: #1e1f22;
      --discord-text: #dbdee1;
      --discord-white: #f2f3f5;
      --discord-muted: #949ba4;
      --discord-blurple: #5865f2;
      --discord-line: rgba(255,255,255,.06);
    }

    * {
      box-sizing: border-box;
    }

    html {
      background: var(--discord-bg);
      color-scheme: dark;
    }

    body {
      margin: 0;
      min-height: 100vh;

      background: var(--discord-bg);
      color: var(--discord-text);

      font-family:
        "gg sans",
        "Noto Sans",
        "Helvetica Neue",
        Arial,
        sans-serif;

      -webkit-font-smoothing: antialiased;
    }

    .custom-topbar {
      position: sticky;
      top: 0;
      z-index: 999;

      height: 64px;

      display: flex;
      align-items: center;

      padding: 0 24px;

      background:
        rgba(30,31,34,.96);

      border-bottom:
        1px solid rgba(0,0,0,.35);

      box-shadow:
        0 2px 8px rgba(0,0,0,.18);

      backdrop-filter: blur(14px);
    }

    .custom-server {
      width: min(1180px, 100%);
      margin: auto;

      display: flex;
      align-items: center;

      gap: 12px;
    }

    .custom-server-icon {
      width: 40px;
      height: 40px;

      flex: 0 0 40px;

      border-radius: 50%;

      object-fit: cover;

      background: var(--discord-blurple);
    }

    .custom-server-name {
      color: var(--discord-white);

      font-size: 15px;
      font-weight: 700;
    }

    .custom-channel {
      margin-top: 1px;

      color: var(--discord-muted);

      font-size: 13px;
    }

    .custom-wrapper {
      width: min(1180px, 100%);
      margin: auto;

      padding:
        24px 24px 60px;
    }

    .ticket-header {
      margin-bottom: 18px;

      padding: 20px;

      background:
        var(--discord-secondary);

      border:
        1px solid var(--discord-line);

      border-radius: 8px;
    }

    .ticket-header h1 {
      margin: 0 0 10px;

      color: var(--discord-white);

      font-size: 22px;
      font-weight: 700;
    }

    .ticket-meta {
      display: flex;
      flex-wrap: wrap;

      gap: 8px 18px;

      color: var(--discord-muted);

      font-size: 13px;
    }

    .ticket-info {
      margin-bottom: 20px;

      padding: 16px;

      background:
        var(--discord-secondary);

      border:
        1px solid var(--discord-line);

      border-radius: 8px;
    }

    .ticket-info-title {
      display: flex;
      align-items: center;

      gap: 8px;

      margin-bottom: 12px;

      color: var(--discord-white);
    }

    .ticket-info-grid {
      display: grid;

      grid-template-columns:
        repeat(2, minmax(0, 1fr));

      gap: 8px;
    }

    .ticket-info-item {
      min-width: 0;

      padding: 10px 12px;

      background:
        var(--discord-tertiary);

      border-radius: 6px;
    }

    .ticket-info-item span {
      display: block;

      margin-bottom: 3px;

      color: var(--discord-muted);

      font-size: 12px;
    }

    .ticket-info-item strong {
      display: block;

      color: var(--discord-text);

      font-size: 14px;

      overflow-wrap: anywhere;
    }

    .ticket-info-full {
      grid-column: 1 / -1;
    }

    .transcript-container {
      overflow: hidden;

      border-radius: 8px;

      background:
        var(--discord-bg);

      box-shadow:
        0 2px 8px rgba(0,0,0,.12);
    }

    .custom-footer {
      margin-top: 30px;

      padding-top: 18px;

      border-top:
        1px solid var(--discord-line);

      color: var(--discord-muted);

      text-align: center;

      font-size: 12px;
    }

    @media (max-width: 700px) {
      .custom-topbar {
        padding: 0 12px;
      }

      .custom-wrapper {
        padding:
          14px 8px 40px;
      }

      .ticket-header {
        padding: 16px;
      }

      .ticket-header h1 {
        font-size: 19px;
      }

      .ticket-meta {
        flex-direction: column;
        gap: 5px;
      }

      .ticket-info-grid {
        grid-template-columns: 1fr;
      }

      .ticket-info-full {
        grid-column: auto;
      }
    }
  `;
}

/**
 * ============================================================
 * BUSCAR TODAS AS MENSAGENS
 * ============================================================
 */

async function fetchAllMessages(
  channel,
  maxMessages
) {
  const messages = new Map();

  let lastId = null;

  while (
    messages.size <
    maxMessages
  ) {
    const remaining =
      maxMessages -
      messages.size;

    const limit = Math.min(
      100,
      remaining
    );

    const options = {
      limit,
    };

    if (lastId) {
      options.before = lastId;
    }

    const batch =
      await channel.messages.fetch(
        options
      );

    if (!batch?.size) {
      break;
    }

    for (
      const message
      of batch.values()
    ) {
      messages.set(
        message.id,
        message
      );
    }

    if (
      batch.size < limit
    ) {
      break;
    }

    const oldest =
      batch.last();

    if (!oldest?.id) {
      break;
    }

    lastId = oldest.id;
  }

  return Array.from(
    messages.values()
  ).sort(
    (a, b) =>
      a.createdTimestamp -
      b.createdTimestamp
  );
}

/**
 * ============================================================
 * TXT
 * ============================================================
 */

function generateTxt(
  messages,
  channel,
  ticketId,
  additionalInfo,
  config
) {
  const guildName =
    channel.guild?.name ||
    "Servidor Discord";

  const channelName =
    channel.name ||
    `ticket-${ticketId}`;

  const generatedAt =
    formatDate(
      new Date(),
      config
    );

  let txt = "";

  txt +=
    "═══════════════════════════════════════════════════════════════\n";

  txt +=
    `  TRANSCRIPT - Ticket #${ticketId}\n`;

  txt +=
    "═══════════════════════════════════════════════════════════════\n";

  txt += `Servidor: ${guildName}\n`;
  txt += `Canal: #${channelName}\n`;
  txt += `Total: ${messages.length} mensagens\n`;
  txt += `Gerado em: ${generatedAt}\n`;

  const info = additionalInfo || {};

  if (info.openedBy)
    txt += `Aberto por: ${info.openedBy}\n`;

  if (info.openedAt)
    txt += `Aberto em: ${info.openedAt}\n`;

  if (info.ticketLabel || info.ticketType)
    txt += `Tipo: ${
      info.ticketLabel ||
      info.ticketType
    }\n`;

  if (info.claimedBy)
    txt += `Assumido por: ${info.claimedBy}\n`;

  if (info.closedBy)
    txt += `Fechado por: ${info.closedBy}\n`;

  if (info.closedAt)
    txt += `Fechado em: ${info.closedAt}\n`;

  if (info.duration)
    txt += `Duração: ${info.duration}\n`;

  if (info.evaluationSent !== undefined)
    txt += `Avaliação enviada: ${
      info.evaluationSent
        ? "Sim"
        : "Não"
    }\n`;

  if (
    info.evaluation !== undefined &&
    info.evaluation !== null
  ) {
    txt += `Avaliação: ${info.evaluation}\n`;
  }

  if (info.evaluationComment)
    txt += `Comentário da avaliação: ${info.evaluationComment}\n`;

  if (info.truckyNome)
    txt += `Nome no Trucky: ${info.truckyNome}\n`;

  if (info.recrutado !== undefined)
    txt += `Recrutado: ${
      info.recrutado === true
        ? "Sim"
        : info.recrutado === false
          ? "Não"
          : "N/A"
    }\n`;

  if (info.fotoNome)
    txt += `Nome para Foto: ${info.fotoNome}\n`;

  txt +=
    "═══════════════════════════════════════════════════════════════\n\n";

  for (
    const message
    of messages
  ) {
    txt +=
      `[${formatDate(
        message.createdAt,
        config
      )}] `;

    txt +=
      `${message.member?.displayName ||
        message.author?.globalName ||
        message.author?.username ||
        "Utilizador desconhecido"} `;

    txt +=
      `(${message.author?.id || "?"})`;

    if (message.author?.bot) {
      txt += " [BOT]";
    }

    if (message.editedTimestamp) {
      txt += " [EDITADA]";
    }

    txt += "\n";

    if (message.content) {
      txt +=
        `${normalizeText(
          message.content
        )}\n`;
    }

    if (
      message.reference?.messageId
    ) {
      txt +=
        `↪ Resposta a: ${message.reference.messageId}\n`;
    }

    for (
      const attachment
      of message.attachments.values()
    ) {
      txt +=
        `📎 ${
          attachment.name ||
          "Anexo"
        }`;

      const size =
        formatFileSize(
          attachment.size
        );

      if (size) {
        txt += ` (${size})`;
      }

      txt +=
        `: ${attachment.url}\n`;
    }

    for (
      const embed
      of message.embeds || []
    ) {
      txt += "\n[EMBED]\n";

      if (embed.title)
        txt += `Título: ${embed.title}\n`;

      if (embed.description)
        txt += `Descrição: ${embed.description}\n`;

      if (embed.url)
        txt += `URL: ${embed.url}\n`;

      for (
        const field
        of embed.fields || []
      ) {
        txt +=
          `${field.name}: ${field.value}\n`;
      }
    }

    if (
      message.stickers?.size
    ) {
      for (
        const sticker
        of message.stickers.values()
      ) {
        txt +=
          `🎨 Sticker: ${
            sticker.name ||
            "Sticker"
          }\n`;
      }
    }

    if (
      message.reactions?.cache?.size
    ) {
      const reactions =
        Array.from(
          message.reactions.cache.values()
        )
          .map(
            reaction =>
              `${
                reaction.emoji.name ||
                "emoji"
              } x${
                reaction.count || 0
              }`
          )
          .join(", ");

      if (reactions) {
        txt +=
          `Reações: ${reactions}\n`;
      }
    }

    txt += "\n";
  }

  txt +=
    "═══════════════════════════════════════════════════════════════\n";

  txt +=
    "  FIM DO TRANSCRIPT\n";

  txt +=
    "═══════════════════════════════════════════════════════════════\n";

  return txt;
}

/**
 * ============================================================
 * GERAR TRANSCRIPT
 * ============================================================
 */

export async function gerarTranscript(
  channel,
  ticketId,
  additionalInfo = {},
  options = {}
) {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  try {
    if (!channel) {
      throw new Error(
        "Canal do ticket não foi fornecido."
      );
    }

    /**
     * --------------------------------------------------------
     * MENSAGENS
     * --------------------------------------------------------
     */

    const messages =
      await fetchAllMessages(
        channel,
        Math.max(
          1,
          Number(
            config.maxMessages
          ) || 10000
        )
      );

    /**
     * --------------------------------------------------------
     * GERADOR DISCORD
     * --------------------------------------------------------
     *
     * Esta é a parte importante.
     *
     * Em vez de recriarmos o Discord com regex,
     * usamos o renderer especializado.
     */

    const discordHtml =
      await discordTranscripts.generateFromMessages(
        messages,
        channel,
        {
          returnType: "string",

          saveImages:
            Boolean(
              config.saveImages
            ),

          footerText:
            "{number} mensagem{s}",

          poweredBy: false,

          hydrate: true,

          callbacks: {
            resolveUser:
              async userId => {
                try {
                  return (
                    channel.client.users.fetch(
                      userId
                    )
                  );
                } catch {
                  return null;
                }
              },

            resolveChannel:
              async channelId => {
                try {
                  return (
                    channel.client.channels.fetch(
                      channelId
                    )
                  );
                } catch {
                  return null;
                }
              },

            resolveRole:
              async roleId => {
                try {
                  return (
                    channel.guild?.roles.fetch(
                      roleId
                    ) || null
                  );
                } catch {
                  return null;
                }
              },
          },
        }
      );

    /**
     * --------------------------------------------------------
     * INFORMAÇÕES
     * --------------------------------------------------------
     */

    const guildName =
      channel.guild?.name ||
      "Servidor Discord";

    const guildIcon =
      channel.guild?.iconURL?.({
        extension: "png",
        size: 128,
      }) || "";

    const channelName =
      channel.name ||
      `ticket-${ticketId}`;

    const createdAt =
      messages[0]?.createdAt
        ? formatDate(
            messages[0].createdAt,
            config
          )
        : "—";

    const generatedAt =
      formatDate(
        new Date(),
        config
      );

    const ticketInfo =
      renderTicketInfo(
        additionalInfo
      );

    /**
     * --------------------------------------------------------
     * HTML FINAL
     * --------------------------------------------------------
     */

    const html = `
<!DOCTYPE html>
<html lang="pt-PT">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>

<meta
  name="color-scheme"
  content="dark"
/>

<title>
  Transcript — #${escapeHtml(
    channelName
  )}
</title>

<style>

${getWrapperCss()}

</style>

</head>

<body>

<header class="custom-topbar">

  <div class="custom-server">

    ${
      guildIcon
        ? `
          <img
            class="custom-server-icon"
            src="${escapeHtml(
              guildIcon
            )}"
            alt=""
          >
        `
        : `
          <div
            class="custom-server-icon"
          ></div>
        `
    }

    <div>

      <div class="custom-server-name">
        ${escapeHtml(
          guildName
        )}
      </div>

      <div class="custom-channel">
        #${escapeHtml(
          channelName
        )}
      </div>

    </div>

  </div>

</header>

<main class="custom-wrapper">

  <section class="ticket-header">

    <h1>
      📋 Transcript — #${escapeHtml(
        channelName
      )}
    </h1>

    <div class="ticket-meta">

      <span>
        🎫 Ticket #${escapeHtml(
          ticketId
        )}
      </span>

      <span>
        💬 ${messages.length} mensagens
      </span>

      <span>
        🕐 Início: ${escapeHtml(
          createdAt
        )}
      </span>

      <span>
        📅 Gerado: ${escapeHtml(
          generatedAt
        )}
      </span>

    </div>

  </section>

  ${ticketInfo}

  <section
    class="transcript-container"
    aria-label="Mensagens do ticket"
  >

    ${discordHtml}

  </section>

  <footer class="custom-footer">

    Fim do transcript •
    ${messages.length}
    mensagens exportadas

  </footer>

</main>

</body>

</html>
`;

    /**
     * --------------------------------------------------------
     * TXT
     * --------------------------------------------------------
     */

    const txt =
      generateTxt(
        messages,
        channel,
        ticketId,
        additionalInfo,
        config
      );

    /**
     * --------------------------------------------------------
     * ATTACHMENTS
     * --------------------------------------------------------
     */

    const htmlAttachment =
      new AttachmentBuilder(
        Buffer.from(
          html,
          "utf-8"
        ),
        {
          name:
            `transcript-${ticketId}.html`,
        }
      );

    const txtAttachment =
      config.includeTxt
        ? new AttachmentBuilder(
            Buffer.from(
              txt,
              "utf-8"
            ),
            {
              name:
                `transcript-${ticketId}.txt`,
            }
          )
        : null;

    /**
     * --------------------------------------------------------
     * RETURN
     * --------------------------------------------------------
     */

    return {
      attachment:
        htmlAttachment,

      fileName:
        `transcript-${ticketId}.html`,

      txtAttachment,

      txtFileName:
        `transcript-${ticketId}.txt`,

      ticketId,

      messageCount:
        messages.length,

      html,

      txt,
    };

  } catch (error) {
    console.error(
      `[Transcript] Erro no ticket #${ticketId}:`,
      error
    );

    return null;
  }
}
