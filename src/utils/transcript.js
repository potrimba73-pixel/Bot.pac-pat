// src/utils/transcript.js

import { AttachmentBuilder } from "discord.js";

/**
 * ============================================================
 * ESCAPE HTML
 * ============================================================
 */

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * ============================================================
 * DATA / TIMEZONE
 * ============================================================
 */

function formatDate(date) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(date));
}

/**
 * ============================================================
 * DISCORD TEXT → HTML
 * ============================================================
 */

function formatDiscordText(value = "") {
  let text = escapeHtml(value);

  /**
   * Emojis personalizados
   * <:nome:id>
   * <a:nome:id>
   */
  text = text.replace(
    /&lt;(a?):([\w~]+):(\d+)&gt;/g,
    (_, animated, name, id) => {
      const extension = animated ? "gif" : "png";

      const url =
        `https://cdn.discordapp.com/emojis/${id}.${extension}?size=48&quality=lossless`;

      return `
        <img
          class="emoji custom-emoji"
          src="${url}"
          alt=":${name}:"
          title=":${name}:"
          loading="lazy"
        >
      `;
    }
  );

  /**
   * Menções
   */

  text = text.replace(
    /&lt;@!?(\d+)&gt;/g,
    `<span class="mention">@utilizador</span>`
  );

  text = text.replace(
    /&lt;#(\d+)&gt;/g,
    `<span class="mention">#canal</span>`
  );

  text = text.replace(
    /&lt;@&(\d+)&gt;/g,
    `<span class="mention">@cargo</span>`
  );

  /**
   * Markdown de código
   */

  text = text.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );

  /**
   * Markdown básico
   */

  text = text.replace(
    /\*\*([^*\n]+)\*\*/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /__([^_\n]+)__/g,
    "<u>$1</u>"
  );

  text = text.replace(
    /~~([^~\n]+)~~/g,
    "<s>$1</s>"
  );

  text = text.replace(
    /(^|\s)\*([^*\n]+)\*(?=\s|$)/g,
    "$1<em>$2</em>"
  );

  text = text.replace(
    /(^|\s)_([^_\n]+)_(?=\s|$)/g,
    "$1<em>$2</em>"
  );

  /**
   * Links
   *
   * Fazemos isto depois do escape para impedir
   * HTML arbitrário dentro das mensagens.
   */

  text = text.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => {
      return `
        <a
          class="message-link"
          href="${url}"
          target="_blank"
          rel="noopener noreferrer"
        >${url}</a>
      `;
    }
  );

  return text;
}

/**
 * ============================================================
 * EMBED COLOR
 * ============================================================
 */

function getEmbedColor(embed) {
  if (
    embed?.color === null ||
    embed?.color === undefined
  ) {
    return "#5865f2";
  }

  const number = Number(embed.color);

  if (!Number.isFinite(number)) {
    return "#5865f2";
  }

  return `#${number
    .toString(16)
    .padStart(6, "0")
    .slice(-6)}`;
}

/**
 * ============================================================
 * RENDER IMAGE
 * ============================================================
 */

function renderImage(
  url,
  alt = "Imagem",
  className = "embed-image"
) {
  if (!url) return "";

  const safeUrl = escapeHtml(url);
  const safeAlt = escapeHtml(alt);

  return `
    <a
      class="image-link"
      href="${safeUrl}"
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir imagem em tamanho completo"
    >
      <img
        class="${className}"
        src="${safeUrl}"
        alt="${safeAlt}"
        loading="lazy"
      >
    </a>
  `;
}

/**
 * ============================================================
 * RENDER EMBED
 * ============================================================
 */

function renderEmbed(embed) {
  if (!embed) return "";

  const title = embed.title
    ? formatDiscordText(embed.title)
    : "";

  const description = embed.description
    ? formatDiscordText(embed.description)
    : "";

  const color = getEmbedColor(embed);

  const thumbnail =
    embed.thumbnail?.url
      ? renderImage(
          embed.thumbnail.url,
          "Thumbnail",
          "embed-thumbnail"
        )
      : "";

  const image =
    embed.image?.url
      ? renderImage(
          embed.image.url,
          "Imagem do embed",
          "embed-image"
        )
      : "";

  /**
   * Author
   */

  const author =
    embed.author?.name
      ? `
        <div class="embed-author">

          ${
            embed.author.iconURL
              ? `
                <img
                  src="${escapeHtml(
                    embed.author.iconURL
                  )}"
                  alt=""
                >
              `
              : ""
          }

          <span>
            ${formatDiscordText(
              embed.author.name
            )}
          </span>

        </div>
      `
      : "";

  /**
   * Fields
   */

  let fields = "";

  if (
    Array.isArray(embed.fields) &&
    embed.fields.length
  ) {
    fields = `
      <div class="embed-fields">

        ${embed.fields
          .map((field) => {
            return `
              <div
                class="embed-field ${
                  field.inline
                    ? "inline"
                    : ""
                }"
              >

                <div class="embed-field-name">
                  ${formatDiscordText(
                    field.name || ""
                  )}
                </div>

                <div class="embed-field-value">
                  ${formatDiscordText(
                    field.value || ""
                  )}
                </div>

              </div>
            `;
          })
          .join("")}

      </div>
    `;
  }

  /**
   * Footer
   */

  const footer =
    embed.footer?.text
      ? `
        <div class="embed-footer">

          ${
            embed.footer.iconURL
              ? `
                <img
                  src="${escapeHtml(
                    embed.footer.iconURL
                  )}"
                  alt=""
                >
              `
              : ""
          }

          <span>
            ${formatDiscordText(
              embed.footer.text
            )}
          </span>

        </div>
      `
      : "";

  if (
    !title &&
    !description &&
    !fields &&
    !thumbnail &&
    !image &&
    !author &&
    !footer
  ) {
    return "";
  }

  return `
    <div
      class="embed"
      style="--embed-color:${color}"
    >

      ${author}

      <div class="embed-main">

        <div class="embed-content">

          ${
            title
              ? `
                <div class="embed-title">
                  ${title}
                </div>
              `
              : ""
          }

          ${
            description
              ? `
                <div class="embed-description">
                  ${description}
                </div>
              `
              : ""
          }

          ${fields}

          ${footer}

        </div>

        ${
          thumbnail
            ? `
              <div class="embed-thumb-wrap">
                ${thumbnail}
              </div>
            `
            : ""
        }

      </div>

      ${image}

    </div>
  `;
}

/**
 * ============================================================
 * ADDITIONAL INFO
 * ============================================================
 */

function renderAdditionalInfo(
  additionalInfo = {}
) {
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
  } = additionalInfo;

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

  if (!hasInfo) {
    return "";
  }

  return `
    <section class="info-card">

      <div class="info-title">
        📋 Informações do ticket
      </div>

      <div class="info-grid">

        ${
          openedBy
            ? `
              <div>
                <span>👤 Aberto por</span>
                <strong>
                  ${escapeHtml(openedBy)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          openedAt
            ? `
              <div>
                <span>🕐 Aberto em</span>
                <strong>
                  ${escapeHtml(openedAt)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          ticketLabel
            ? `
              <div>
                <span>📝 Tipo</span>
                <strong>
                  ${escapeHtml(ticketLabel)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          claimedBy
            ? `
              <div>
                <span>⚒️ Assumido por</span>
                <strong>
                  ${escapeHtml(claimedBy)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          closedBy
            ? `
              <div>
                <span>👮 Fechado por</span>
                <strong>
                  ${escapeHtml(closedBy)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          closedAt
            ? `
              <div>
                <span>⏰ Fechado em</span>
                <strong>
                  ${escapeHtml(closedAt)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          duration
            ? `
              <div>
                <span>⌛ Duração</span>
                <strong>
                  ${escapeHtml(duration)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          evaluationSent !== undefined
            ? `
              <div>
                <span>📨 Avaliação enviada</span>
                <strong>
                  ${
                    evaluationSent
                      ? "Sim"
                      : "Não"
                  }
                </strong>
              </div>
            `
            : ""
        }

        ${
          evaluation !== undefined &&
          evaluation !== null
            ? `
              <div>
                <span>⭐ Avaliação</span>
                <strong>
                  ${escapeHtml(evaluation)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          truckyNome
            ? `
              <div>
                <span>🚛 Nome no Trucky</span>
                <strong>
                  ${escapeHtml(truckyNome)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          recrutado !== undefined
            ? `
              <div>
                <span>💼 Recrutado</span>
                <strong>
                  ${
                    recrutado === true
                      ? "✅ Sim"
                      : recrutado === false
                        ? "❌ Não"
                        : "N/A"
                  }
                </strong>
              </div>
            `
            : ""
        }

        ${
          fotoNome
            ? `
              <div>
                <span>📷 Nome para foto</span>
                <strong>
                  ${escapeHtml(fotoNome)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          evaluationComment
            ? `
              <div class="info-full">

                <span>
                  💬 Comentário da avaliação
                </span>

                <strong>
                  ${formatDiscordText(
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
 * GERAR TRANSCRIPT
 * ============================================================
 */

export async function gerarTranscript(
  channel,
  ticketId,
  additionalInfo = {}
) {
  try {
    if (!channel) {
      throw new Error(
        "Canal do ticket não foi fornecido."
      );
    }

    /**
     * ========================================================
     * BUSCAR TODAS AS MENSAGENS
     * ========================================================
     */

    const allMessages = new Map();

    let lastId = null;

    while (true) {
      const options = {
        limit: 100,
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

      for (const message of batch.values()) {
        allMessages.set(
          message.id,
          message
        );
      }

      if (batch.size < 100) {
        break;
      }

      const oldest =
        batch.last();

      if (!oldest?.id) {
        break;
      }

      lastId = oldest.id;
    }

    /**
     * Ordenar mensagens cronologicamente
     */

    const sorted =
      Array.from(
        allMessages.values()
      ).sort(
        (a, b) =>
          a.createdTimestamp -
          b.createdTimestamp
      );

    /**
     * ========================================================
     * DADOS DO SERVIDOR / TICKET
     * ========================================================
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
      sorted[0]?.createdAt
        ? formatDate(
            sorted[0].createdAt
          )
        : "—";

    const generatedAt =
      formatDate(new Date());

    const infoHtml =
      renderAdditionalInfo(
        additionalInfo
      );

    /**
     * ========================================================
     * HTML
     * ========================================================
     */

    let html = `<!DOCTYPE html>
<html lang="pt-PT">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <meta
    name="color-scheme"
    content="dark"
  >

  <title>
    Transcript - #${escapeHtml(
      channelName
    )}
  </title>

  <style>

    * {
      box-sizing: border-box;
    }

    :root {
      --bg: #313338;
      --bg-secondary: #2b2d31;
      --bg-tertiary: #1e1f22;
      --text: #dbdee1;
      --muted: #949ba4;
      --white: #f2f3f5;
      --link: #00a8fc;
      --mention: #c9cdfb;
      --mention-bg: rgba(88,101,242,.30);
      --line: rgba(255,255,255,.06);
    }

    html {
      background: var(--bg);
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);

      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        Helvetica,
        Arial,
        sans-serif;

      font-size: 15px;
      line-height: 1.45;
    }

    a {
      color: var(--link);
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;

      background:
        rgba(30,31,34,.96);

      backdrop-filter:
        blur(12px);

      border-bottom:
        1px solid #111214;

      padding:
        14px 24px;
    }

    .server {
      display: flex;
      align-items: center;
      gap: 12px;

      max-width: 1100px;
      margin: auto;
    }

    .server-icon {
      width: 40px;
      height: 40px;

      border-radius: 50%;

      object-fit: cover;

      background:
        #5865f2;

      flex: 0 0 40px;
    }

    .server-name {
      color: var(--white);
      font-weight: 700;
    }

    .channel-name {
      color: var(--muted);
      font-size: 13px;
    }

    .wrap {
      max-width: 1100px;
      margin: 0 auto;

      padding:
        28px 24px 60px;
    }

    .ticket-header {
      background:
        var(--bg-secondary);

      border:
        1px solid var(--line);

      border-radius: 12px;

      padding: 22px;

      margin-bottom: 22px;

      box-shadow:
        0 6px 20px rgba(0,0,0,.16);
    }

    .ticket-header h1 {
      margin:
        0 0 8px;

      color:
        var(--white);

      font-size: 24px;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;

      gap:
        8px 18px;

      color:
        var(--muted);

      font-size: 13px;
    }

    .meta span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .info-card {
      background:
        var(--bg-secondary);

      border:
        1px solid var(--line);

      border-radius: 10px;

      padding: 16px;

      margin-bottom: 22px;
    }

    .info-title {
      color:
        var(--white);

      font-weight: 700;

      margin-bottom:
        12px;
    }

    .info-grid {
      display: grid;

      grid-template-columns:
        repeat(2, minmax(0, 1fr));

      gap: 10px;
    }

    .info-grid > div {
      background:
        var(--bg-tertiary);

      border-radius: 8px;

      padding:
        10px 12px;
    }

    .info-grid span,
    .info-grid strong {
      display: block;
    }

    .info-grid span {
      color:
        var(--muted);

      font-size: 12px;

      margin-bottom:
        3px;
    }

    .info-grid strong {
      color:
        var(--text);

      font-weight:
        600;

      overflow-wrap:
        anywhere;
    }

    .info-full {
      grid-column:
        1 / -1;
    }

    .message {
      display: flex;

      gap: 16px;

      padding:
        8px 8px 8px 0;

      border-radius:
        6px;

      scroll-margin-top:
        80px;
    }

    .message:hover {
      background:
        rgba(255,255,255,.025);
    }

    .avatar {
      width: 42px;
      height: 42px;

      border-radius: 50%;

      object-fit: cover;

      flex:
        0 0 42px;

      background:
        #202225;
    }

    .message-content {
      min-width: 0;
      flex: 1;
    }

    .author-line {
      display: flex;

      align-items:
        baseline;

      flex-wrap:
        wrap;

      gap: 7px;
    }

    .author {
      color:
        var(--white);

      font-weight:
        600;
    }

    .bot-tag {
      background:
        #5865f2;

      color:
        white;

      border-radius:
        3px;

      padding:
        1px 4px;

      font-size:
        10px;

      font-weight:
        700;

      text-transform:
        uppercase;
    }

    .time {
      color:
        var(--muted);

      font-size:
        12px;
    }

    .edited {
      color:
        var(--muted);

      font-size:
        10px;
    }

    .body {
      margin-top:
        2px;

      white-space:
        pre-wrap;

      overflow-wrap:
        anywhere;

      color:
        var(--text);
    }

    .body.empty {
      color:
        var(--muted);

      font-style:
        italic;
    }

    .emoji {
      width:
        1.375em;

      height:
        1.375em;

      vertical-align:
        -.35em;

      object-fit:
        contain;

      display:
        inline-block;
    }

    .custom-emoji {
      margin:
        0 1px;
    }

    .mention {
      color:
        var(--mention);

      background:
        var(--mention-bg);

      border-radius:
        3px;

      padding:
        0 2px;

      font-weight:
        500;
    }

    .message-link {
      text-decoration:
        none;

      overflow-wrap:
        anywhere;
    }

    .message-link:hover {
      text-decoration:
        underline;
    }

    code {
      background:
        #1e1f22;

      border:
        1px solid rgba(255,255,255,.06);

      border-radius:
        4px;

      padding:
        1px 4px;

      font-family:
        Consolas,
        "Courier New",
        monospace;

      color:
        #c9cdfb;
    }

    .reply-ref {
      margin-top:
        5px;

      font-size:
        12px;

      color:
        var(--muted);
    }

    .reply-ref a {
      text-decoration:
        none;
    }

    .embed {
      max-width:
        680px;

      margin-top:
        8px;

      padding:
        10px 12px 12px;

      border-left:
        4px solid var(--embed-color);

      background:
        #2b2d31;

      border-radius:
        4px;
    }

    .embed-main {
      display:
        flex;

      gap:
        12px;
    }

    .embed-content {
      flex:
        1;

      min-width:
        0;
    }

    .embed-title {
      color:
        var(--white);

      font-weight:
        700;

      margin-bottom:
        4px;
    }

    .embed-description {
      white-space:
        pre-wrap;

      overflow-wrap:
        anywhere;
    }

    .embed-author {
      color:
        var(--white);

      font-weight:
        600;

      font-size:
        13px;

      display:
        flex;

      align-items:
        center;

      gap:
        6px;

      margin-bottom:
        5px;
    }

    .embed-author img,
    .embed-footer img {
      width:
        20px;

      height:
        20px;

      border-radius:
        50%;

      object-fit:
        cover;
    }

    .embed-thumbnail {
      width:
        80px;

      height:
        80px;

      object-fit:
        cover;

      border-radius:
        4px;
    }

    .embed-image {
      display:
        block;

      max-width:
        min(100%, 560px);

      max-height:
        500px;

      object-fit:
        contain;

      border-radius:
        4px;

      margin-top:
        10px;

      background:
        #202225;
    }

    .image-link {
      display:
        inline-block;

      line-height:
        0;
    }

    .image-link:hover img {
      filter:
        brightness(1.08);
    }

    .embed-fields {
      display:
        grid;

      grid-template-columns:
        1fr;

      gap:
        8px;

      margin-top:
        10px;
    }

    .embed-field.inline {
      display:
        inline-block;
    }

    .embed-field-name {
      color:
        var(--white);

      font-weight:
        700;

      font-size:
        13px;
    }

    .embed-field-value {
      margin-top:
        2px;

      white-space:
        pre-wrap;

      overflow-wrap:
        anywhere;
    }

    .embed-footer {
      display:
        flex;

      align-items:
        center;

      gap:
        6px;

      color:
        var(--muted);

      font-size:
        11px;

      margin-top:
        10px;
    }

    .attachment {
      margin-top:
        8px;

      background:
        #1e1f22;

      border-radius:
        6px;

      padding:
        8px 10px;

      width:
        fit-content;

      max-width:
        100%;
    }

    .attachment a {
      text-decoration:
        none;

      overflow-wrap:
        anywhere;
    }

    .attachment a:hover {
      text-decoration:
        underline;
    }

    .attachment-image {
      display:
        block;

      max-width:
        min(100%, 560px);

      max-height:
        500px;

      border-radius:
        4px;

      margin-top:
        7px;

      object-fit:
        contain;
    }

    .system-divider {
      display:
        flex;

      align-items:
        center;

      gap:
        10px;

      color:
        var(--muted);

      font-size:
        12px;

      margin:
        18px 0;
    }

    .system-divider::before,
    .system-divider::after {
      content:
        "";

      height:
        1px;

      background:
        var(--line);

      flex:
        1;
    }

    .footer {
      text-align:
        center;

      color:
        var(--muted);

      font-size:
        12px;

      padding-top:
        24px;
    }

    @media (max-width: 700px) {

      .topbar {
        padding:
          12px 14px;
      }

      .wrap {
        padding:
          18px 12px 40px;
      }

      .ticket-header {
        padding:
          16px;
      }

      .ticket-header h1 {
        font-size:
          20px;
      }

      .message {
        gap:
          10px;
      }

      .avatar {
        width:
          36px;

        height:
          36px;

        flex-basis:
          36px;
      }

      .info-grid {
        grid-template-columns:
          1fr;
      }

      .info-full {
        grid-column:
          auto;
      }

      .embed-main {
        flex-direction:
          column;
      }

      .embed-thumb-wrap {
        order:
          -1;
      }
    }

  </style>

</head>

<body>

  <div class="topbar">

    <div class="server">

      ${
        guildIcon
          ? `
            <img
              class="server-icon"
              src="${escapeHtml(
                guildIcon
              )}"
              alt=""
            >
          `
          : `
            <div class="server-icon"></div>
          `
      }

      <div>

        <div class="server-name">
          ${escapeHtml(guildName)}
        </div>

        <div class="channel-name">
          #${escapeHtml(channelName)}
        </div>

      </div>

    </div>

  </div>

  <main class="wrap">

    <section class="ticket-header">

      <h1>
        📋 Transcript — #${escapeHtml(
          channelName
        )}
      </h1>

      <div class="meta">

        <span>
          🎫 Ticket #${escapeHtml(
            ticketId
          )}
        </span>

        <span>
          💬 ${sorted.length} mensagens
        </span>

        <span>
          🕐 Início:
          ${escapeHtml(createdAt)}
        </span>

        <span>
          📅 Gerado:
          ${escapeHtml(generatedAt)}
        </span>

      </div>

    </section>

    ${infoHtml}

    <section class="messages">
`;

    /**
     * ========================================================
     * MENSAGENS
     * ========================================================
     */

    let lastDay = "";

    for (const msg of sorted) {

      const day =
        new Intl.DateTimeFormat(
          "pt-PT",
          {
            timeZone:
              "Europe/Lisbon",
            dateStyle:
              "full",
          }
        ).format(
          new Date(
            msg.createdTimestamp
          )
        );

      if (day !== lastDay) {

        html += `
          <div class="system-divider">
            ${escapeHtml(day)}
          </div>
        `;

        lastDay = day;
      }

      /**
       * Avatar
       */

      const avatar =
        msg.author?.displayAvatarURL?.({
          extension: "png",
          size: 64,
        }) || "";

      /**
       * Nome
       */

      const author =
        msg.member?.displayName ||
        msg.author?.globalName ||
        msg.author?.username ||
        "Utilizador desconhecido";

      /**
       * BOT
       */

      const botTag =
        msg.author?.bot
          ? `<span class="bot-tag">BOT</span>`
          : "";

      /**
       * Hora
       */

      const time =
        formatDate(
          msg.createdAt
        );

      /**
       * Conteúdo
       */

      const content =
        msg.content
          ? formatDiscordText(
              msg.content
            )
          : "";

      /**
       * Editada
       */

      const edited =
        msg.editedTimestamp
          ? `<span class="edited">(editada)</span>`
          : "";

      html += `
        <article
          class="message"
          id="m-${escapeHtml(
            msg.id
          )}"
        >

          ${
            avatar
              ? `
                <img
                  class="avatar"
                  src="${escapeHtml(
                    avatar
                  )}"
                  alt=""
                  loading="lazy"
                >
              `
              : `
                <div class="avatar"></div>
              `
          }

          <div class="message-content">

            <div class="author-line">

              <span class="author">
                ${escapeHtml(author)}
              </span>

              ${botTag}

              <span class="time">
                ${escapeHtml(time)}
              </span>

              ${edited}

            </div>

            <div
              class="body ${
                content
                  ? ""
                  : "empty"
              }"
            >
              ${
                content ||
                "Sem texto"
              }
            </div>
      `;

      /**
       * ======================================================
       * REPLY
       * ======================================================
       */

      if (
        msg.reference?.messageId
      ) {

        const referenced =
          allMessages.get(
            msg.reference.messageId
          );

        const replyAuthor =
          referenced?.member
            ?.displayName ||
          referenced?.author
            ?.globalName ||
          referenced?.author
            ?.username ||
          "mensagem";

        html += `
          <div class="reply-ref">

            ↪ Resposta a

            <a
              href="#m-${escapeHtml(
                msg.reference.messageId
              )}"
            >
              ${escapeHtml(
                replyAuthor
              )}
            </a>

          </div>
        `;
      }

      /**
       * ======================================================
       * EMBEDS
       * ======================================================
       */

      for (
        const embed
        of msg.embeds || []
      ) {
        html +=
          renderEmbed(embed);
      }

      /**
       * ======================================================
       * ANEXOS
       * ======================================================
       */

      for (
        const attachment
        of msg.attachments.values()
      ) {

        const url =
          attachment.url;

        const name =
          attachment.name ||
          "Anexo";

        const contentType =
          attachment.contentType ||
          "";

        const isImage =
          contentType.startsWith(
            "image/"
          ) ||
          /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(
            url || ""
          );

        html += `
          <div class="attachment">

            <a
              href="${escapeHtml(
                url
              )}"
              target="_blank"
              rel="noopener noreferrer"
            >
              📎 ${escapeHtml(
                name
              )}
            </a>

            ${
              isImage
                ? renderImage(
                    url,
                    name,
                    "attachment-image"
                  )
                : ""
            }

          </div>
        `;
      }

      /**
       * ======================================================
       * STICKER
       * ======================================================
       */

      if (
        msg.stickers?.size
      ) {

        for (
          const sticker
          of msg.stickers.values()
        ) {

          html += `
            <div class="attachment">

              🎨 Sticker:
              <strong>
                ${escapeHtml(
                  sticker.name ||
                    "Sticker"
                )}
              </strong>

            </div>
          `;
        }
      }

      html += `
          </div>

        </article>
      `;
    }

    html += `
    </section>

    <div class="footer">

      Fim do transcript •
      ${sorted.length}
      mensagens exportadas

    </div>

  </main>

</body>

</html>
`;

    /**
     * ========================================================
     * TXT
     * ========================================================
     */

    let txt = "";

    txt +=
      "═══════════════════════════════════════════════════════════════\n";

    txt +=
      `  TRANSCRIPT - Ticket #${ticketId}\n`;

    txt +=
      "═══════════════════════════════════════════════════════════════\n";

    txt +=
      `Servidor: ${guildName}\n`;

    txt +=
      `Canal: #${channelName}\n`;

    txt +=
      `Total: ${sorted.length} mensagens\n`;

    txt +=
      `Início: ${createdAt}\n`;

    txt +=
      `Gerado em: ${generatedAt}\n`;

    if (additionalInfo.openedBy) {
      txt +=
        `Aberto por: ${additionalInfo.openedBy}\n`;
    }

    if (additionalInfo.openedAt) {
      txt +=
        `Aberto em: ${additionalInfo.openedAt}\n`;
    }

    if (additionalInfo.ticketLabel) {
      txt +=
        `Tipo: ${additionalInfo.ticketLabel}\n`;
    }

    if (additionalInfo.claimedBy) {
      txt +=
        `Assumido por: ${additionalInfo.claimedBy}\n`;
    }

    if (additionalInfo.closedBy) {
      txt +=
        `Fechado por: ${additionalInfo.closedBy}\n`;
    }

    if (additionalInfo.closedAt) {
      txt +=
        `Fechado em: ${additionalInfo.closedAt}\n`;
    }

    if (additionalInfo.duration) {
      txt +=
        `Duração: ${additionalInfo.duration}\n`;
    }

    if (
      additionalInfo.evaluationSent !==
      undefined
    ) {
      txt +=
        `Avaliação enviada: ${
          additionalInfo.evaluationSent
            ? "Sim"
            : "Não"
        }\n`;
    }

    if (
      additionalInfo.evaluation !==
      undefined &&
      additionalInfo.evaluation !==
      null
    ) {
      txt +=
        `Avaliação: ${additionalInfo.evaluation}\n`;
    }

    if (
      additionalInfo.evaluationComment
    ) {
      txt +=
        `Comentário da avaliação: ${additionalInfo.evaluationComment}\n`;
    }

    if (additionalInfo.truckyNome) {
      txt +=
        `Nome no Trucky: ${additionalInfo.truckyNome}\n`;
    }

    if (
      additionalInfo.recrutado !==
      undefined
    ) {
      txt +=
        `Recrutado: ${
          additionalInfo.recrutado === true
            ? "Sim"
            : additionalInfo.recrutado === false
              ? "Não"
              : "N/A"
        }\n`;
    }

    if (additionalInfo.fotoNome) {
      txt +=
        `Nome para Foto: ${additionalInfo.fotoNome}\n`;
    }

    txt +=
      "═══════════════════════════════════════════════════════════════\n\n";

    /**
     * Mensagens TXT
     */

    for (const msg of sorted) {

      const author =
        msg.member?.displayName ||
        msg.author?.globalName ||
        msg.author?.username ||
        "Utilizador desconhecido";

      txt +=
        `[${formatDate(
          msg.createdAt
        )}] `;

      txt +=
        `${author} (${msg.author?.id || "?"})`;

      if (msg.author?.bot) {
        txt += " [BOT]";
      }

      txt += "\n";

      if (msg.content) {
        txt +=
          `${msg.content}\n`;
      }

      /**
       * Replies
       */

      if (
        msg.reference?.messageId
      ) {
        txt +=
          `  ↪ Resposta a mensagem: ${msg.reference.messageId}\n`;
      }

      /**
       * Embeds
       */

      for (
        const embed
        of msg.embeds || []
      ) {

        txt +=
          "  [EMBED]\n";

        if (embed.author?.name) {
          txt +=
            `  Autor: ${embed.author.name}\n`;
        }

        if (embed.title) {
          txt +=
            `  Título: ${embed.title}\n`;
        }

        if (embed.description) {
          txt +=
            `  Descrição: ${embed.description}\n`;
        }

        for (
          const field
          of embed.fields || []
        ) {
          txt +=
            `  ${field.name}: ${field.value}\n`;
        }

        if (embed.url) {
          txt +=
            `  URL: ${embed.url}\n`;
        }

        if (embed.image?.url) {
          txt +=
            `  Imagem: ${embed.image.url}\n`;
        }

        if (embed.thumbnail?.url) {
          txt +=
            `  Thumbnail: ${embed.thumbnail.url}\n`;
        }

        if (embed.footer?.text) {
          txt +=
            `  Footer: ${embed.footer.text}\n`;
        }
      }

      /**
       * Anexos
       */

      for (
        const attachment
        of msg.attachments.values()
      ) {
        txt +=
          `  📎 ${
            attachment.name ||
            "Anexo"
          }: ${attachment.url}\n`;
      }

      /**
       * Stickers
       */

      for (
        const sticker
        of msg.stickers.values()
      ) {
        txt +=
          `  🎨 Sticker: ${
            sticker.name ||
            "Sticker"
          }\n`;
      }

      txt += "\n";
    }

    txt +=
      "═══════════════════════════════════════════════════════════════\n";

    txt +=
      "  FIM DO TRANSCRIPT\n";

    txt +=
      "═══════════════════════════════════════════════════════════════\n";

    /**
     * ========================================================
     * ATTACHMENTS
     * ========================================================
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
      new AttachmentBuilder(
        Buffer.from(
          txt,
          "utf-8"
        ),
        {
          name:
            `transcript-${ticketId}.txt`,
        }
      );

    /**
     * ========================================================
     * RETURN
     * ========================================================
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
        sorted.length,

      html,
      txt,
    };

  } catch (err) {

    console.error(
      `[Transcript] Erro no ticket #${ticketId}:`,
      err
    );

    return null;
  }
}
