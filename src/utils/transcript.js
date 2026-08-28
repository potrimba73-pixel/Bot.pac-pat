// src/utils/transcript.js
import { AttachmentBuilder } from "discord.js";

/**
 * Escapa texto para utilização segura dentro de HTML.
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
 * Converte Markdown/Discord básico em HTML.
 * Emojis Unicode continuam a ser renderizados normalmente pelo browser.
 */
function formatDiscordText(value = "") {
  let text = escapeHtml(value);

  // Emojis personalizados: <:nome:id> e <a:nome:id>
  text = text.replace(
    /&lt;(a?):([\w~]+):(\d+)&gt;/g,
    (_, animated, name, id) => {
      const extension = animated ? "gif" : "png";
      const url = `https://cdn.discordapp.com/emojis/${id}.${extension}?size=48&quality=lossless`;

      return `<img
        class="emoji custom-emoji"
        src="${url}"
        alt=":${name}:"
        title=":${name}:"
        loading="lazy"
      >`;
    }
  );

  // Menções
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

  // Links
  text = text.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a class="message-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Código inline
  text = text.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );

  // Markdown básico
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

  return text;
}

/**
 * Cor do embed.
 */
function getEmbedColor(embed) {
  if (embed?.color == null) {
    return "#5865f2";
  }

  return `#${Number(embed.color)
    .toString(16)
    .padStart(6, "0")}`;
}

/**
 * Formatação da data em Português de Portugal.
 */
function formatDate(date) {
  return new Date(date).toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/**
 * Renderiza uma imagem clicável.
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
 * Renderiza embeds do Discord.
 */
function renderEmbed(embed) {
  const title = embed.title
    ? formatDiscordText(embed.title)
    : "";

  const description = embed.description
    ? formatDiscordText(embed.description)
    : "";

  const color = getEmbedColor(embed);

  const thumbnail = embed.thumbnail?.url
    ? renderImage(
        embed.thumbnail.url,
        "Thumbnail",
        "embed-thumbnail"
      )
    : "";

  const image = embed.image?.url
    ? renderImage(
        embed.image.url,
        "Imagem do embed",
        "embed-image"
      )
    : "";

  let fields = "";

  if (Array.isArray(embed.fields) && embed.fields.length) {
    fields = `
      <div class="embed-fields">
        ${embed.fields
          .map(
            (field) => `
              <div class="embed-field ${
                field.inline ? "inline" : ""
              }">
                <div class="embed-field-name">
                  ${formatDiscordText(field.name || "")}
                </div>

                <div class="embed-field-value">
                  ${formatDiscordText(field.value || "")}
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  const author = embed.author?.name
    ? `
      <div class="embed-author">
        ${
          embed.author.iconURL
            ? `
              <img
                src="${escapeHtml(embed.author.iconURL)}"
                alt=""
              >
            `
            : ""
        }

        ${formatDiscordText(embed.author.name)}
      </div>
    `
    : "";

  const footer = embed.footer?.text
    ? `
      <div class="embed-footer">
        ${
          embed.footer.iconURL
            ? `
              <img
                src="${escapeHtml(embed.footer.iconURL)}"
                alt=""
              >
            `
            : ""
        }

        ${formatDiscordText(embed.footer.text)}
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
 * Informações adicionais do ticket.
 *
 * Pode receber:
 *
 * {
 *   evaluationSent: true,
 *   evaluation: "⭐⭐⭐⭐⭐",
 *   evaluationComment: "Excelente atendimento",
 *   closedBy: "arte_10",
 *   closedAt: "05/06/2026, 18:20:54"
 * }
 */
function renderAdditionalInfo(additionalInfo = {}) {
  const evaluationSent =
    additionalInfo.evaluationSent;

  const evaluation =
    additionalInfo.evaluation;

  const comment =
    additionalInfo.evaluationComment;

  const hasEvaluationInfo =
    evaluationSent !== undefined ||
    evaluation !== undefined ||
    comment !== undefined;

  if (
    !hasEvaluationInfo &&
    !additionalInfo.closedBy &&
    !additionalInfo.closedAt
  ) {
    return "";
  }

  return `
    <section class="info-card">

      <div class="info-title">
        📋 Informações adicionais
      </div>

      <div class="info-grid">

        ${
          additionalInfo.closedBy
            ? `
              <div>
                <span>👮 Fechado por</span>
                <strong>
                  ${escapeHtml(additionalInfo.closedBy)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          additionalInfo.closedAt
            ? `
              <div>
                <span>⏰ Fechado em</span>
                <strong>
                  ${escapeHtml(additionalInfo.closedAt)}
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
                  ${evaluationSent ? "Sim" : "Não"}
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
          comment
            ? `
              <div class="info-full">

                <span>
                  💬 Comentário
                </span>

                <strong>
                  ${formatDiscordText(comment)}
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
 * Gera o transcript completo do ticket.
 *
 * Compatível com:
 *
 * gerarTranscript(channel, ticketId)
 *
 * Também aceita informações adicionais:
 *
 * gerarTranscript(channel, ticketId, {
 *   evaluationSent: true,
 *   evaluation: "⭐⭐⭐⭐⭐",
 *   evaluationComment: "Excelente",
 *   closedBy: "arte_10",
 *   closedAt: "05/06/2026, 18:20:54"
 * })
 */
export async function gerarTranscript(
  channel,
  ticketId,
  additionalInfo = {}
) {
  try {
    /*
     * ==========================================================
     * BUSCAR TODAS AS MENSAGENS
     * ==========================================================
     *
     * O Discord permite no máximo 100 mensagens por fetch.
     * Por isso fazemos paginação até chegar ao início do canal.
     */

    const allMessages = new Map();

    let lastId;

    while (true) {
      const options = {
        limit: 100,
      };

      if (lastId) {
        options.before = lastId;
      }

      const batch =
        await channel.messages.fetch(options);

      if (!batch.size) {
        break;
      }

      for (const message of batch.values()) {
        allMessages.set(message.id, message);
      }

      if (batch.size < 100) {
        break;
      }

      lastId = batch.last()?.id;

      if (!lastId) {
        break;
      }
    }

    /*
     * Ordenar cronologicamente.
     */
    const sorted = Array.from(
      allMessages.values()
    ).sort(
      (a, b) =>
        a.createdTimestamp -
        b.createdTimestamp
    );

    /*
     * ==========================================================
     * INFORMAÇÕES DO SERVIDOR
     * ==========================================================
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
        ? formatDate(sorted[0].createdAt)
        : "—";

    const generatedAt =
      formatDate(new Date());

    const infoHtml =
      renderAdditionalInfo(
        additionalInfo
      );

    /*
     * ==========================================================
     * HTML
     * ==========================================================
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
    Transcript - #${escapeHtml(channelName)}
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

      backdrop-filter: blur(12px);

      border-bottom:
        1px solid #111214;

      padding: 14px 24px;

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

      background: #5865f2;

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

      color: var(--white);

      font-size: 24px;

    }

    .meta {

      display: flex;

      flex-wrap: wrap;

      gap:
        8px 18px;

      color: var(--muted);

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

      margin:
        0 0 22px;

    }

    .info-title {

      color: var(--white);

      font-weight: 700;

      margin-bottom: 12px;

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

      color: var(--muted);

      font-size: 12px;

      margin-bottom: 3px;

    }

    .info-grid strong {

      color: var(--text);

      font-weight: 600;

    }

    .info-full {

      grid-column:
        1 / -1;

    }

    .message {

      position: relative;

      display: flex;

      gap: 16px;

      padding:
        8px 8px 8px 0;

      border-radius: 6px;

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

      background: #202225;

    }

    .message-content {

      min-width: 0;

      flex: 1;

    }

    .author-line {

      display: flex;

      align-items: baseline;

      flex-wrap: wrap;

      gap: 7px;

    }

    .author {

      color: var(--white);

      font-weight: 600;

    }

    .bot-tag {

      background: #5865f2;

      color: white;

      border-radius: 3px;

      padding:
        1px 4px;

      font-size: 10px;

      font-weight: 700;

      text-transform: uppercase;

    }

    .time {

      color: var(--muted);

      font-size: 12px;

    }

    .edited {

      color: var(--muted);

      font-size: 10px;

    }

    .body {

      margin-top: 2px;

      white-space: pre-wrap;

      overflow-wrap: anywhere;

      color: var(--text);

    }

    .body.empty {

      color: var(--muted);

      font-style: italic;

    }

    .emoji {

      width: 1.375em;

      height: 1.375em;

      vertical-align: -.35em;

      object-fit: contain;

      display: inline-block;

    }

    .custom-emoji {

      margin:
        0 1px;

    }

    .mention {

      color: var(--mention);

      background:
        var(--mention-bg);

      border-radius: 3px;

      padding:
        0 2px;

      font-weight: 500;

    }

    .message-link {

      text-decoration: none;

    }

    .message-link:hover {

      text-decoration: underline;

    }

    code {

      background:
        #1e1f22;

      border:
        1px solid rgba(255,255,255,.06);

      border-radius: 4px;

      padding:
        1px 4px;

      font-family:
        Consolas,
        "Courier New",
        monospace;

      color: #c9cdfb;

    }

    .reply-ref {

      margin-top: 5px;

      font-size: 12px;

      color: var(--muted);

    }

    .embed {

      max-width: 680px;

      margin-top: 8px;

      padding:
        10px 12px 12px;

      border-left:
        4px solid var(--embed-color);

      background:
        #2b2d31;

      border-radius: 4px;

    }

    .embed-main {

      display: flex;

      gap: 12px;

    }

    .embed-content {

      flex: 1;

      min-width: 0;

    }

    .embed-title {

      color: var(--white);

      font-weight: 700;

      margin-bottom: 4px;

    }

    .embed-description {

      white-space: pre-wrap;

      overflow-wrap: anywhere;

    }

    .embed-author {

      color: var(--white);

      font-weight: 600;

      font-size: 13px;

      display: flex;

      align-items: center;

      gap: 6px;

      margin-bottom: 5px;

    }

    .embed-author img,
    .embed-footer img {

      width: 20px;

      height: 20px;

      border-radius: 50%;

      object-fit: cover;

    }

    .embed-thumb-wrap {

      flex:
        0 0 auto;

    }

    .embed-thumbnail {

      width: 80px;

      height: 80px;

      object-fit: cover;

      border-radius: 4px;

    }

    .embed-image {

      display: block;

      max-width:
        min(100%, 560px);

      max-height: 500px;

      object-fit: contain;

      border-radius: 4px;

      margin-top: 10px;

      background:
        #202225;

    }

    .image-link {

      display: inline-block;

      line-height: 0;

    }

    .image-link:hover img {

      filter:
        brightness(1.08);

    }

    .embed-fields {

      display: grid;

      grid-template-columns: 1fr;

      gap: 8px;

      margin-top: 10px;

    }

    .embed-field.inline {

      display: inline-block;

    }

    .embed-field-name {

      color: var(--white);

      font-weight: 700;

      font-size: 13px;

    }

    .embed-field-value {

      margin-top: 2px;

      white-space: pre-wrap;

      overflow-wrap: anywhere;

    }

    .embed-footer {

      display: flex;

      align-items: center;

      gap: 6px;

      color: var(--muted);

      font-size: 11px;

      margin-top: 10px;

    }

    .attachment {

      margin-top: 8px;

      background:
        #1e1f22;

      border-radius: 6px;

      padding:
        8px 10px;

      width: fit-content;

      max-width: 100%;

    }

    .attachment a {

      text-decoration: none;

      overflow-wrap: anywhere;

    }

    .attachment a:hover {

      text-decoration: underline;

    }

    .attachment-image {

      display: block;

      max-width:
        min(100%, 560px);

      max-height: 500px;

      border-radius: 4px;

      margin-top: 7px;

      object-fit: contain;

    }

    .system-divider {

      display: flex;

      align-items: center;

      gap: 10px;

      color: var(--muted);

      font-size: 12px;

      margin:
        18px 0;

    }

    .system-divider::before,
    .system-divider::after {

      content: "";

      height: 1px;

      background:
        var(--line);

      flex: 1;

    }

    .footer {

      text-align: center;

      color: var(--muted);

      font-size: 12px;

      padding-top: 24px;

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

        padding: 16px;

      }

      .ticket-header h1 {

        font-size: 20px;

      }

      .message {

        gap: 10px;

      }

      .avatar {

        width: 36px;

        height: 36px;

        flex-basis: 36px;

      }

      .info-grid {

        grid-template-columns: 1fr;

      }

      .info-full {

        grid-column: auto;

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
              src="${escapeHtml(guildIcon)}"
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
          # ${escapeHtml(channelName)}
        </div>

      </div>

    </div>

  </div>

  <main class="wrap">

    <section class="ticket-header">

      <h1>
        📋 Transcript — #${escapeHtml(channelName)}
      </h1>

      <div class="meta">

        <span>
          🎫 Ticket #${escapeHtml(ticketId)}
        </span>

        <span>
          💬 ${sorted.length} mensagens
        </span>

        <span>
          🕐 Início: ${escapeHtml(createdAt)}
        </span>

        <span>
          📅 Gerado: ${escapeHtml(generatedAt)}
        </span>

      </div>

    </section>

    ${infoHtml}

    <section class="messages">
`;

    /*
     * ==========================================================
     * MENSAGENS
     * ==========================================================
     */

    let lastDay = "";

    for (const msg of sorted) {
      const day =
        new Date(
          msg.createdTimestamp
        ).toLocaleDateString("pt-PT");

      if (day !== lastDay) {

        html += `
          <div class="system-divider">
            ${escapeHtml(day)}
          </div>
        `;

        lastDay = day;
      }

      const avatar =
        msg.author?.displayAvatarURL?.({
          extension: "png",
          size: 64,
        }) || "";

      const author =
        msg.member?.displayName ||
        msg.author?.globalName ||
        msg.author?.username ||
        "Utilizador desconhecido";

      const botTag =
        msg.author?.bot
          ? `<span class="bot-tag">BOT</span>`
          : "";

      const time =
        formatDate(msg.createdAt);

      const content =
        msg.content
          ? formatDiscordText(msg.content)
          : "";

      const edited =
        msg.editedTimestamp
          ? `<span class="edited">(editada)</span>`
          : "";

      html += `
        <article
          class="message"
          id="m-${escapeHtml(msg.id)}"
        >

          ${
            avatar
              ? `
                <img
                  class="avatar"
                  src="${escapeHtml(avatar)}"
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
                content ? "" : "empty"
              }"
            >
              ${content || "Sem texto"}
            </div>
      `;

      /*
       * Reply
       */

      if (msg.reference?.messageId) {

        html += `
          <div class="reply-ref">

            ↪ Resposta à mensagem

            <a
              href="#m-${escapeHtml(
                msg.reference.messageId
              )}"
            >
              ${escapeHtml(
                msg.reference.messageId
              )}
            </a>

          </div>
        `;
      }

      /*
       * Embeds
       */

      for (const embed of msg.embeds || []) {

        html +=
          renderEmbed(embed);
      }

      /*
       * Anexos
       */

      for (
        const [, attachment]
        of msg.attachments || []
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
            url
          );

        html += `
          <div class="attachment">

            <a
              href="${escapeHtml(url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              📎 ${escapeHtml(name)}
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

      html += `
          </div>

        </article>
      `;
    }

    html += `
    </section>

    <div class="footer">

      Fim do transcript •
      ${sorted.length} mensagens exportadas

    </div>

  </main>

</body>

</html>
`;

    /*
     * ==========================================================
     * TXT
     * ==========================================================
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

    if (additionalInfo.closedBy) {

      txt +=
        `Fechado por: ${additionalInfo.closedBy}\n`;
    }

    if (additionalInfo.closedAt) {

      txt +=
        `Fechado em: ${additionalInfo.closedAt}\n`;
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

    txt +=
      "═══════════════════════════════════════════════════════════════\n\n";

    /*
     * Mensagens TXT
     */

    for (const msg of sorted) {

      const author =
        msg.member?.displayName ||
        msg.author?.globalName ||
        msg.author?.username ||
        "Utilizador desconhecido";

      txt +=
        `[${formatDate(msg.createdAt)}] `;

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

      /*
       * Embeds
       */

      for (
        const embed
        of msg.embeds || []
      ) {

        if (embed.title) {

          txt +=
            `  [Embed] ${embed.title}\n`;
        }

        if (embed.description) {

          txt +=
            `  ${embed.description}\n`;
        }

        for (
          const field
          of embed.fields || []
        ) {

          txt +=
            `  ${field.name}: ${field.value}\n`;
        }
      }

      /*
       * Anexos
       */

      for (
        const [, attachment]
        of msg.attachments || []
      ) {

        txt +=
          `  📎 ${
            attachment.name ||
            "Anexo"
          }: ${attachment.url}\n`;
      }

      txt += "\n";
    }

    txt +=
      "═══════════════════════════════════════════════════════════════\n";

    txt +=
      "  FIM DO TRANSCRIPT\n";

    txt +=
      "═══════════════════════════════════════════════════════════════\n";

    /*
     * ==========================================================
     * ATTACHMENTS
     * ==========================================================
     */

    const htmlAttachment =
      new AttachmentBuilder(
        Buffer.from(html, "utf-8"),
        {
          name:
            `transcript-${ticketId}.html`,
        }
      );

    const txtAttachment =
      new AttachmentBuilder(
        Buffer.from(txt, "utf-8"),
        {
          name:
            `transcript-${ticketId}.txt`,
        }
      );

    /*
     * ==========================================================
     * RETORNO
     * ==========================================================
     */

    return {

      attachment:
        htmlAttachment,

      fileName:
        `transcript-${ticketId}.html`,

      txtAttachment:

        txtAttachment,

      txtFileName:
        `transcript-${ticketId}.txt`,

      ticketId,

      messageCount:
        sorted.length,

    };

  } catch (err) {

    console.error(
      `[Transcript] Erro no ticket #${ticketId}:`,
      err
    );

    return null;
  }
}
