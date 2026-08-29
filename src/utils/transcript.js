// src/utils/transcript.js

import { AttachmentBuilder } from "discord.js";

/**
 * ============================================================
 * CONFIGURAÇÃO
 * ============================================================
 */

const DEFAULT_OPTIONS = {
  locale: "pt-PT",
  timeZone: "Europe/Lisbon",
  maxMessages: 10000,
  includeTxt: true,
  includeImages: true,
};

/**
 * ============================================================
 * SEGURANÇA / HELPERS
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

function safeUrl(value = "") {
  try {
    const raw = String(value).trim();

    if (!raw) return "";

    const url = new URL(raw);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return "";
    }

    return escapeHtml(url.toString());
  } catch {
    return "";
  }
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

function normalizeText(value = "") {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

/**
 * ============================================================
 * DATA / TIMEZONE
 * ============================================================
 */

function formatDate(date, options = DEFAULT_OPTIONS) {
  if (!date) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(
      options.locale,
      {
        timeZone: options.timeZone,
        dateStyle: "short",
        timeStyle: "medium",
      }
    ).format(new Date(date));
  } catch {
    return "—";
  }
}

function formatTime(date, options = DEFAULT_OPTIONS) {
  if (!date) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(
      options.locale,
      {
        timeZone: options.timeZone,
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(date));
  } catch {
    return "—";
  }
}

function formatDay(date, options = DEFAULT_OPTIONS) {
  if (!date) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(
      options.locale,
      {
        timeZone: options.timeZone,
        dateStyle: "full",
      }
    ).format(new Date(date));
  } catch {
    return "—";
  }
}

/**
 * ============================================================
 * AUTOR
 * ============================================================
 */

function getAuthorName(message) {
  return (
    message.member?.displayName ||
    message.author?.globalName ||
    message.author?.username ||
    "Utilizador desconhecido"
  );
}

function getAvatar(message) {
  try {
    return (
      message.author?.displayAvatarURL?.({
        extension: "png",
        size: 128,
      }) || ""
    );
  } catch {
    return "";
  }
}

function isBot(message) {
  return Boolean(message.author?.bot);
}

/**
 * ============================================================
 * CACHE DE MENÇÕES
 * ============================================================
 */

function createMentionCache(channel) {
  const mentionNames = new Map();
  const mentionChannels = new Map();
  const mentionRoles = new Map();

  const guild = channel?.guild;

  if (!guild) {
    return {
      mentionNames,
      mentionChannels,
      mentionRoles,
    };
  }

  try {
    for (
      const member
      of guild.members?.cache?.values() || []
    ) {
      mentionNames.set(
        member.id,
        member.displayName ||
          member.user?.globalName ||
          member.user?.username ||
          "utilizador"
      );
    }
  } catch (error) {
    console.warn(
      "[Transcript] Não foi possível criar cache de membros:",
      error
    );
  }

  try {
    for (
      const channelItem
      of guild.channels?.cache?.values() || []
    ) {
      mentionChannels.set(
        channelItem.id,
        channelItem.name || "canal"
      );
    }
  } catch (error) {
    console.warn(
      "[Transcript] Não foi possível criar cache de canais:",
      error
    );
  }

  try {
    for (
      const role
      of guild.roles?.cache?.values() || []
    ) {
      mentionRoles.set(
        role.id,
        role.name || "cargo"
      );
    }
  } catch (error) {
    console.warn(
      "[Transcript] Não foi possível criar cache de cargos:",
      error
    );
  }

  return {
    mentionNames,
    mentionChannels,
    mentionRoles,
  };
}

/**
 * ============================================================
 * DISCORD TEXT → HTML
 * ============================================================
 */

function formatDiscordText(
  value = "",
  mentionCache = {}
) {
  let text = escapeHtml(
    normalizeText(value)
  );

  const {
    mentionNames = new Map(),
    mentionChannels = new Map(),
    mentionRoles = new Map(),
  } = mentionCache;

  /**
   * Emojis personalizados
   *
   * <:nome:id>
   * <a:nome:id>
   */

  text = text.replace(
    /&lt;(a?):([\w~+-]+):(\d+)&gt;/g,
    (_, animated, name, id) => {
      const extension = animated
        ? "gif"
        : "png";

      const url =
        `https://cdn.discordapp.com/emojis/${id}.${extension}?size=48&quality=lossless`;

      const safe = safeUrl(url);

      if (!safe) {
        return `:${escapeHtml(name)}:`;
      }

      return `
        <img
          class="emoji custom-emoji"
          src="${safe}"
          alt=":${escapeHtml(name)}:"
          title=":${escapeHtml(name)}:"
          loading="lazy"
          aria-label="Emoji ${escapeHtml(name)}"
        >
      `;
    }
  );

  /**
   * Menções a utilizadores
   */

  text = text.replace(
    /&lt;@!?(\d+)&gt;/g,
    (_, id) => {
      const name =
        mentionNames.get(id) ||
        "utilizador";

      return `
        <span
          class="mention"
          title="ID: ${escapeHtml(id)}"
        >@${escapeHtml(name)}</span>
      `;
    }
  );

  /**
   * Menções a canais
   */

  text = text.replace(
    /&lt;#(\d+)&gt;/g,
    (_, id) => {
      const name =
        mentionChannels.get(id) ||
        "canal";

      return `
        <span
          class="mention channel-mention"
          title="ID: ${escapeHtml(id)}"
        >#${escapeHtml(name)}</span>
      `;
    }
  );

  /**
   * Menções a cargos
   */

  text = text.replace(
    /&lt;@&amp;(\d+)&gt;/g,
    (_, id) => {
      const name =
        mentionRoles.get(id) ||
        "cargo";

      return `
        <span
          class="mention role-mention"
          title="ID: ${escapeHtml(id)}"
        >@${escapeHtml(name)}</span>
      `;
    }
  );

  /**
   * Blocos de código
   */

  text = text.replace(
    /```(?:([\w+-]+)\n)?([\s\S]*?)```/g,
    (_, language, code) => `
      <pre
        class="code-block"
        data-language="${escapeHtml(
          language || ""
        )}"
      ><code>${code}</code></pre>
    `
  );

  /**
   * Código inline
   */

  text = text.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );

  /**
   * Negrito
   */

  text = text.replace(
    /\*\*([^*\n]+)\*\*/g,
    "<strong>$1</strong>"
  );

  /**
   * Sublinhado
   */

  text = text.replace(
    /__([^_\n]+)__/g,
    "<u>$1</u>"
  );

  /**
   * Riscado
   */

  text = text.replace(
    /~~([^~\n]+)~~/g,
    "<s>$1</s>"
  );

  /**
   * Itálico
   */

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
   */

  text = text.replace(
    /(https?:\/\/[^\s<]+)/g,
    (rawUrl) => {
      const cleanUrl =
        rawUrl.replace(
          /[),.!?]+$/,
          ""
        );

      const trailing =
        rawUrl.slice(
          cleanUrl.length
        );

      const safe =
        safeUrl(cleanUrl);

      if (!safe) {
        return escapeHtml(rawUrl);
      }

      return `
        <a
          class="message-link"
          href="${safe}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir link"
        >${escapeHtml(cleanUrl)}</a>${escapeHtml(
          trailing
        )}
      `;
    }
  );

  return text;
}

/**
 * ============================================================
 * RENDER IMAGE
 * ============================================================
 */

function renderImage(
  url,
  alt = "Imagem",
  className = "embed-image",
  options = DEFAULT_OPTIONS
) {
  if (!options.includeImages) {
    return "";
  }

  const safe = safeUrl(url);

  if (!safe) {
    return "";
  }

  return `
    <a
      class="image-link"
      href="${safe}"
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir imagem em tamanho completo"
      aria-label="Abrir ${escapeHtml(alt)}"
    >
      <img
        class="${className}"
        src="${safe}"
        alt="${escapeHtml(alt)}"
        loading="lazy"
      >
    </a>
  `;
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

  const number =
    Number(embed.color);

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
 * RENDER EMBED
 * ============================================================
 */

function renderEmbed(
  embed,
  mentionCache = {},
  options = DEFAULT_OPTIONS
) {
  if (!embed) {
    return "";
  }

  const title = embed.title
    ? formatDiscordText(
        embed.title,
        mentionCache
      )
    : "";

  const description =
    embed.description
      ? formatDiscordText(
          embed.description,
          mentionCache
        )
      : "";

  const color =
    getEmbedColor(embed);

  /**
   * Autor
   */

  const author =
    embed.author?.name
      ? `
        <div class="embed-author">

          ${
            embed.author.iconURL &&
            options.includeImages
              ? `
                <img
                  src="${safeUrl(
                    embed.author.iconURL
                  )}"
                  alt=""
                  loading="lazy"
                >
              `
              : ""
          }

          ${
            safeUrl(embed.author.url)
              ? `
                <a
                  href="${safeUrl(
                    embed.author.url
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${formatDiscordText(
                    embed.author.name,
                    mentionCache
                  )}
                </a>
              `
              : `
                <span>
                  ${formatDiscordText(
                    embed.author.name,
                    mentionCache
                  )}
                </span>
              `
          }

        </div>
      `
      : "";

  /**
   * Thumbnail
   */

  const thumbnail =
    embed.thumbnail?.url
      ? renderImage(
          embed.thumbnail.url,
          "Thumbnail",
          "embed-thumbnail",
          options
        )
      : "";

  /**
   * Imagem
   */

  const image =
    embed.image?.url
      ? renderImage(
          embed.image.url,
          "Imagem do embed",
          "embed-image",
          options
        )
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
          .map(
            (field) => `
              <div
                class="embed-field ${
                  field.inline
                    ? "inline"
                    : ""
                }"
              >

                <div class="embed-field-name">
                  ${formatDiscordText(
                    field.name || "",
                    mentionCache
                  )}
                </div>

                <div class="embed-field-value">
                  ${formatDiscordText(
                    field.value || "",
                    mentionCache
                  )}
                </div>

              </div>
            `
          )
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
            embed.footer.iconURL &&
            options.includeImages
              ? `
                <img
                  src="${safeUrl(
                    embed.footer.iconURL
                  )}"
                  alt=""
                  loading="lazy"
                >
              `
              : ""
          }

          <span>
            ${formatDiscordText(
              embed.footer.text,
              mentionCache
            )}
          </span>

        </div>
      `
      : "";

  /**
   * Timestamp
   */

  const timestamp =
    embed.timestamp
      ? `
        <div class="embed-timestamp">
          ${escapeHtml(
            formatDate(
              embed.timestamp,
              options
            )
          )}
        </div>
      `
      : "";

  /**
   * Título
   */

  const titleHtml =
    title &&
    safeUrl(embed.url)
      ? `
        <a
          class="embed-title"
          href="${safeUrl(
            embed.url
          )}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${title}
        </a>
      `
      : title
        ? `
          <div class="embed-title">
            ${title}
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
    !footer &&
    !timestamp
  ) {
    return "";
  }

  return `
    <div
      class="embed"
      style="--embed-color:${color}"
      role="region"
      aria-label="Embed"
    >

      ${author}

      <div class="embed-main">

        <div class="embed-content">

          ${titleHtml}

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

          <div class="embed-footer-row">
            ${footer}
            ${timestamp}
          </div>

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
 * REPLY
 * ============================================================
 */

function renderReply(
  message,
  allMessages
) {
  const messageId =
    message.reference?.messageId;

  if (!messageId) {
    return "";
  }

  const referenced =
    allMessages.get(messageId);

  if (!referenced) {
    return `
      <div
        class="reply-ref reply-missing"
        aria-label="Mensagem original indisponível"
      >
        <span class="reply-line"></span>
        <span class="reply-icon">↪</span>

        <span class="reply-preview">
          <span>
            Resposta a uma mensagem
            que não está disponível
          </span>
        </span>
      </div>
    `;
  }

  const author =
    getAuthorName(referenced);

  const preview =
    referenced.content
      ? normalizeText(
          referenced.content
        )
          .replace(/\s+/g, " ")
          .slice(0, 180)
      : referenced.attachments?.size
        ? "📎 Anexo"
        : referenced.embeds?.length
          ? "📦 Embed"
          : referenced.stickers?.size
            ? "🎨 Sticker"
            : "Mensagem";

  return `
    <a
      class="reply-ref"
      href="#m-${escapeHtml(
        messageId
      )}"
      title="Ir para a mensagem original"
      aria-label="Resposta a ${escapeHtml(
        author
      )}"
    >

      <span class="reply-line"></span>

      <span class="reply-icon">↪</span>

      ${
        getAvatar(referenced)
          ? `
            <img
              class="reply-avatar"
              src="${safeUrl(
                getAvatar(referenced)
              )}"
              alt=""
              loading="lazy"
            >
          `
          : ""
      }

      <span class="reply-preview">

        <strong>
          ${escapeHtml(author)}
        </strong>

        <span>
          ${escapeHtml(preview)}
        </span>

      </span>

    </a>
  `;
}

/**
 * ============================================================
 * ATTACHMENTS
 * ============================================================
 */

function renderAttachments(
  message,
  options = DEFAULT_OPTIONS
) {
  if (
    !message.attachments?.size
  ) {
    return "";
  }

  let html = "";

  for (
    const attachment
    of message.attachments.values()
  ) {
    const url =
      safeUrl(attachment.url);

    if (!url) {
      continue;
    }

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
        attachment.url || ""
      );

    const size =
      formatFileSize(
        attachment.size
      );

    html += `
      <div
        class="attachment"
        role="group"
        aria-label="Anexo ${escapeHtml(
          name
        )}"
      >

        <div class="attachment-icon">
          ${
            isImage
              ? "🖼️"
              : "📎"
          }
        </div>

        <div class="attachment-info">

          <a
            href="${url}"
            target="_blank"
            rel="noopener noreferrer"
            class="attachment-name"
          >
            ${escapeHtml(name)}
          </a>

          <div class="attachment-meta">

            ${
              contentType
                ? escapeHtml(
                    contentType
                  )
                : "Ficheiro"
            }

            ${
              size
                ? ` • ${escapeHtml(
                    size
                  )}`
                : ""
            }

          </div>

        </div>

      </div>

      ${
        isImage
          ? renderImage(
              attachment.url,
              name,
              "attachment-image",
              options
            )
          : ""
      }
    `;
  }

  return html;
}

/**
 * ============================================================
 * STICKERS
 * ============================================================
 */

function renderStickers(message) {
  if (!message.stickers?.size) {
    return "";
  }

  let html = "";

  for (
    const sticker
    of message.stickers.values()
  ) {
    html += `
      <div
        class="sticker"
        role="img"
        aria-label="Sticker ${escapeHtml(
          sticker.name ||
            "Sticker"
        )}"
      >
        <span class="sticker-icon">🎨</span>

        <strong>
          ${escapeHtml(
            sticker.name ||
              "Sticker"
          )}
        </strong>
      </div>
    `;
  }

  return html;
}

/**
 * ============================================================
 * REACTIONS
 * ============================================================
 */

function renderReactions(
  message,
  options = DEFAULT_OPTIONS
) {
  if (
    !message.reactions?.cache?.size
  ) {
    return "";
  }

  const reactions =
    message.reactions.cache;

  if (!reactions.size) {
    return "";
  }

  return `
    <div
      class="reactions"
      aria-label="Reações"
    >

      ${Array.from(
        reactions.values()
      )
        .map((reaction) => {
          const emoji =
            reaction.emoji;

          const name =
            emoji.name ||
            "emoji";

          const custom =
            emoji.id &&
            options.includeImages
              ? `
                <img
                  class="reaction-emoji"
                  src="${safeUrl(
                    `https://cdn.discordapp.com/emojis/${emoji.id}.png?size=32`
                  )}"
                  alt="${escapeHtml(
                    name
                  )}"
                  loading="lazy"
                >
              `
              : escapeHtml(name);

          return `
            <span
              class="reaction"
              title="${escapeHtml(
                name
              )} — ${
                reaction.count || 0
              }"
            >
              ${custom}

              <strong>
                ${reaction.count || 0}
              </strong>

            </span>
          `;
        })
        .join("")}

    </div>
  `;
}

/**
 * ============================================================
 * MENSAGENS DE SISTEMA
 * ============================================================
 */

function getSystemMessageText(
  message
) {
  const author =
    getAuthorName(message);

  const type =
    String(
      message.type || ""
    ).toUpperCase();

  switch (type) {
    case "CHANNEL_PINNED_MESSAGE":
      return `📌 ${author} fixou uma mensagem neste canal.`;

    case "RECIPIENT_ADD":
      return `👤 ${author} adicionou alguém à conversa.`;

    case "RECIPIENT_REMOVE":
      return `👤 ${author} removeu alguém da conversa.`;

    case "CHANNEL_NAME_CHANGE":
      return `✏️ ${author} alterou o nome do canal.`;

    case "CHANNEL_ICON_CHANGE":
      return `🖼️ ${author} alterou o ícone do canal.`;

    case "THREAD_CREATED":
      return `🧵 ${author} criou uma thread.`;

    case "CHANNEL_FOLLOW_ADD":
      return `🔔 ${author} adicionou um canal seguido.`;

    case "GUILD_MEMBER_JOIN":
      return `👋 ${author} entrou no servidor.`;

    case "USER_PREMIUM_GUILD_SUBSCRIPTION":
      return `💎 ${author} impulsionou o servidor.`;

    default:
      return `ℹ️ ${author} realizou uma ação do sistema.`;
  }
}

function isSystemMessage(message) {
  return Boolean(
    message.type &&
    String(
      message.type
    ).toUpperCase() !== "DEFAULT" &&
    String(
      message.type
    ).toUpperCase() !== "REPLY"
  );
}

/**
 * ============================================================
 * INFORMAÇÕES ADICIONAIS
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
    <section
      class="info-card"
      aria-label="Informações do ticket"
    >

      <div class="info-title">
        <span>📋</span>
        <span>Informações do ticket</span>
      </div>

      <div class="info-grid">

        ${
          openedBy
            ? `
              <div class="info-item">
                <span>👤 Aberto por</span>
                <strong>
                  ${escapeHtml(
                    openedBy
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          openedAt
            ? `
              <div class="info-item">
                <span>🕐 Aberto em</span>
                <strong>
                  ${escapeHtml(
                    openedAt
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          ticketLabel ||
          ticketType
            ? `
              <div class="info-item">
                <span>📝 Tipo</span>
                <strong>
                  ${escapeHtml(
                    ticketLabel ||
                      ticketType
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          claimedBy
            ? `
              <div class="info-item">
                <span>🛡️ Assumido por</span>
                <strong>
                  ${escapeHtml(
                    claimedBy
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          closedBy
            ? `
              <div class="info-item">
                <span>👮 Fechado por</span>
                <strong>
                  ${escapeHtml(
                    closedBy
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          closedAt
            ? `
              <div class="info-item">
                <span>⏰ Fechado em</span>
                <strong>
                  ${escapeHtml(
                    closedAt
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          duration
            ? `
              <div class="info-item">
                <span>⌛ Duração</span>
                <strong>
                  ${escapeHtml(
                    duration
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          evaluationSent !==
          undefined
            ? `
              <div class="info-item">
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
          evaluation !==
            undefined &&
          evaluation !== null
            ? `
              <div class="info-item">
                <span>⭐ Avaliação</span>
                <strong>
                  ${escapeHtml(
                    evaluation
                  )}
                  ${
                    Number.isFinite(
                      Number(
                        evaluation
                      )
                    )
                      ? " / 5"
                      : ""
                  }
                </strong>
              </div>
            `
            : ""
        }

        ${
          truckyNome
            ? `
              <div class="info-item">
                <span>🚛 Nome no Trucky</span>
                <strong>
                  ${escapeHtml(
                    truckyNome
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          recrutado !==
          undefined
            ? `
              <div class="info-item">
                <span>💼 Recrutado</span>
                <strong>
                  ${
                    recrutado ===
                    true
                      ? "✅ Sim"
                      : recrutado ===
                          false
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
              <div class="info-item">
                <span>📷 Nome para foto</span>
                <strong>
                  ${escapeHtml(
                    fotoNome
                  )}
                </strong>
              </div>
            `
            : ""
        }

        ${
          evaluationComment
            ? `
              <div class="info-item info-full">
                <span>
                  💬 Comentário da avaliação
                </span>

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
 * CSS
 * ============================================================
 */

function getTranscriptCss() {
  return `
:root {
  --discord-bg: #313338;
  --discord-bg-secondary: #2b2d31;
  --discord-bg-tertiary: #1e1f22;
  --discord-floating: #111214;

  --discord-text: #dbdee1;
  --discord-text-strong: #f2f3f5;
  --discord-muted: #949ba4;

  --discord-link: #00a8fc;
  --discord-blurple: #5865f2;

  --discord-hover: rgba(255,255,255,.035);
  --discord-line: rgba(255,255,255,.06);

  --mention-bg: rgba(88,101,242,.25);
  --mention-text: #c9cdfb;

  --success: #23a559;
  --danger: #f23f42;

  --radius-small: 4px;
  --radius-medium: 8px;
  --radius-large: 12px;
}

* {
  box-sizing: border-box;
}

html {
  background: var(--discord-bg);
  scroll-behavior: smooth;
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
    Helvetica,
    Arial,
    sans-serif;

  font-size: 15px;
  line-height: 1.375;

  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

a {
  color: var(--discord-link);
}

img {
  max-width: 100%;
}

::selection {
  background: rgba(88,101,242,.45);
  color: #fff;
}

/* =========================================================
   SCROLLBAR
   ========================================================= */

::-webkit-scrollbar {
  width: 14px;
}

::-webkit-scrollbar-track {
  background: var(--discord-bg);
}

::-webkit-scrollbar-thumb {
  background: #1e1f22;
  border: 4px solid var(--discord-bg);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #18191c;
}

/* =========================================================
   TOPBAR
   ========================================================= */

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;

  background: rgba(30,31,34,.92);

  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);

  border-bottom: 1px solid #111214;

  box-shadow:
    0 1px 4px rgba(0,0,0,.25);

  padding: 12px 24px;
}

.server {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;

  display: flex;
  align-items: center;
  gap: 12px;
}

.server-icon {
  width: 40px;
  height: 40px;

  flex: 0 0 40px;

  border-radius: 50%;

  object-fit: cover;

  background: var(--discord-blurple);
}

.server-name {
  color: var(--discord-text-strong);

  font-size: 15px;
  font-weight: 700;

  overflow-wrap: anywhere;
}

.channel-name {
  color: var(--discord-muted);

  font-size: 13px;
  margin-top: 1px;

  overflow-wrap: anywhere;
}

/* =========================================================
   MAIN
   ========================================================= */

.wrap {
  width: 100%;
  max-width: 1120px;

  margin: 0 auto;

  padding: 28px 24px 64px;
}

/* =========================================================
   HEADER
   ========================================================= */

.ticket-header {
  background: var(--discord-bg-secondary);

  border: 1px solid var(--discord-line);

  border-radius: var(--radius-large);

  padding: 22px;
  margin-bottom: 20px;

  box-shadow:
    0 4px 16px rgba(0,0,0,.12);
}

.ticket-header h1 {
  margin: 0 0 10px;

  color: var(--discord-text-strong);

  font-size: 24px;
  line-height: 1.2;
  font-weight: 700;

  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  flex-wrap: wrap;

  gap: 8px 18px;

  color: var(--discord-muted);

  font-size: 13px;
}

.meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* =========================================================
   INFO CARD
   ========================================================= */

.info-card {
  background: var(--discord-bg-secondary);

  border: 1px solid var(--discord-line);

  border-radius: var(--radius-medium);

  padding: 16px;
  margin-bottom: 24px;
}

.info-title {
  display: flex;
  align-items: center;

  gap: 7px;

  color: var(--discord-text-strong);

  font-weight: 700;

  margin-bottom: 12px;
}

.info-grid {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: 8px;
}

.info-item {
  background: var(--discord-bg-tertiary);

  border-radius: var(--radius-medium);

  padding: 10px 12px;

  min-width: 0;
}

.info-item span,
.info-item strong {
  display: block;
}

.info-item span {
  color: var(--discord-muted);

  font-size: 12px;

  margin-bottom: 3px;
}

.info-item strong {
  color: var(--discord-text);

  font-weight: 600;

  overflow-wrap: anywhere;
}

.info-full {
  grid-column: 1 / -1;
}

/* =========================================================
   MESSAGES
   ========================================================= */

.messages {
  width: 100%;
}

.message {
  position: relative;

  display: flex;

  gap: 16px;

  padding: 3px 8px 3px 0;

  margin: 1px 0;

  border-radius: var(--radius-small);

  scroll-margin-top: 80px;

  transition:
    background .12s ease,
    box-shadow .12s ease;
}

.message:hover {
  background: var(--discord-hover);
}

.message:target {
  background: rgba(88,101,242,.12);

  box-shadow:
    inset 3px 0 0 var(--discord-blurple);
}

.message-error {
  margin: 8px 0;

  padding: 12px;

  background: rgba(242,63,66,.08);

  border: 1px solid rgba(242,63,66,.25);

  border-radius: var(--radius-medium);

  color: #f2a2a5;
}

.system-message {
  margin: 10px 0;
  padding: 8px 12px;

  text-align: center;

  color: var(--discord-muted);

  font-size: 12px;
  font-weight: 500;

  background: rgba(0,0,0,.12);

  border-radius: var(--radius-medium);
}

/* =========================================================
   AVATAR
   ========================================================= */

.avatar {
  width: 40px;
  height: 40px;

  flex: 0 0 40px;

  border-radius: 50%;

  object-fit: cover;

  background: var(--discord-bg-tertiary);

  margin-top: 2px;
}

/* =========================================================
   MESSAGE CONTENT
   ========================================================= */

.message-content {
  min-width: 0;
  flex: 1;

  padding: 0 0 2px;
}

.author-line {
  display: flex;

  align-items: baseline;

  flex-wrap: wrap;

  gap: 7px;

  min-height: 20px;
}

.author {
  color: var(--discord-text-strong);

  font-size: 15px;
  font-weight: 600;

  overflow-wrap: anywhere;
}

.bot-tag {
  display: inline-flex;
  align-items: center;

  height: 15px;

  padding: 0 5px;

  background: var(--discord-blurple);

  color: white;

  border-radius: 3px;

  font-size: 9px;
  line-height: 15px;
  font-weight: 700;

  text-transform: uppercase;
}

.time {
  color: var(--discord-muted);

  font-size: 11px;
}

.edited {
  color: var(--discord-muted);

  font-size: 10px;
}

/* =========================================================
   MESSAGE BODY
   ========================================================= */

.body {
  margin-top: 1px;

  color: var(--discord-text);

  white-space: pre-wrap;

  overflow-wrap: anywhere;
  word-break: break-word;
}

.body.empty {
  color: var(--discord-muted);

  font-style: italic;
}

/* =========================================================
   EMOJIS
   ========================================================= */

.emoji {
  width: 1.375em;
  height: 1.375em;

  display: inline-block;

  vertical-align: -.35em;

  object-fit: contain;
}

.custom-emoji {
  margin: 0 1px;
}

/* =========================================================
   MENTIONS
   ========================================================= */

.mention {
  display: inline;

  padding: 0 2px;

  color: var(--mention-text);

  background: var(--mention-bg);

  border-radius: 3px;

  font-weight: 500;

  transition:
    background .12s ease,
    color .12s ease;
}

.mention:hover {
  color: #fff;
  background: rgba(88,101,242,.5);
}

.channel-mention {
  color: #c9cdfb;
}

/* =========================================================
   LINKS
   ========================================================= */

.message-link {
  color: var(--discord-link);

  text-decoration: none;

  overflow-wrap: anywhere;
}

.message-link:hover {
  text-decoration: underline;
}

/* =========================================================
   CODE
   ========================================================= */

code {
  padding: 1px 4px;

  background: var(--discord-bg-tertiary);

  border: 1px solid rgba(255,255,255,.06);

  border-radius: 3px;

  color: #c9cdfb;

  font-family:
    Consolas,
    "Courier New",
    monospace;

  font-size: .9em;
}

.code-block {
  position: relative;

  margin: 6px 0;

  padding: 10px 12px;

  background: var(--discord-bg-tertiary);

  border: 1px solid rgba(255,255,255,.06);

  border-radius: var(--radius-small);

  overflow-x: auto;

  white-space: pre-wrap;

  font-size: 13px;
}

.code-block[data-language]:not([data-language=""])::before {
  content: attr(data-language);

  display: block;

  margin-bottom: 6px;

  color: var(--discord-muted);

  font-size: 10px;

  text-transform: uppercase;
}

.code-block code {
  padding: 0;

  border: 0;

  background: transparent;

  color: var(--discord-text);
}

/* =========================================================
   REPLIES
   ========================================================= */

.reply-ref {
  position: relative;

  display: flex;

  align-items: center;

  gap: 7px;

  width: fit-content;

  max-width: min(680px, 100%);

  min-height: 24px;

  margin: 3px 0;

  padding: 2px 8px 2px 0;

  color: var(--discord-muted);

  text-decoration: none;

  font-size: 12px;
}

.reply-ref:hover {
  color: var(--discord-text);
}

.reply-line {
  width: 28px;
  height: 14px;

  flex: 0 0 28px;

  border-top: 2px solid #4e5058;
  border-left: 2px solid #4e5058;

  border-top-left-radius: 6px;

  margin-left: 2px;
}

.reply-icon {
  color: var(--discord-muted);

  font-size: 13px;
}

.reply-avatar {
  width: 18px;
  height: 18px;

  border-radius: 50%;

  object-fit: cover;
}

.reply-preview {
  display: flex;

  gap: 5px;

  min-width: 0;

  overflow: hidden;
}

.reply-preview strong {
  color: var(--discord-text);

  white-space: nowrap;
}

.reply-preview span {
  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;
}

.reply-missing {
  opacity: .65;
}

/* =========================================================
   EMBEDS
   ========================================================= */

.embed {
  max-width: 680px;

  margin-top: 8px;

  padding: 10px 12px 12px;

  background: #2b2d31;

  border-left: 4px solid var(--embed-color);

  border-radius: 4px;

  box-shadow:
    0 1px 2px rgba(0,0,0,.12);
}

.embed-main {
  display: flex;

  gap: 16px;
}

.embed-content {
  flex: 1;

  min-width: 0;
}

.embed-title {
  display: block;

  margin-bottom: 5px;

  color: var(--discord-text-strong);

  font-weight: 700;

  text-decoration: none;

  overflow-wrap: anywhere;
}

a.embed-title:hover {
  text-decoration: underline;
}

.embed-description {
  white-space: pre-wrap;

  overflow-wrap: anywhere;
}

.embed-author {
  display: flex;

  align-items: center;

  gap: 7px;

  margin-bottom: 5px;

  color: var(--discord-text-strong);

  font-size: 13px;
  font-weight: 600;
}

.embed-author img {
  width: 20px;
  height: 20px;

  border-radius: 50%;

  object-fit: cover;
}

.embed-author a {
  color: var(--discord-text-strong);

  text-decoration: none;
}

.embed-author a:hover {
  text-decoration: underline;
}

.embed-thumbnail {
  width: 80px;
  height: 80px;

  flex: 0 0 80px;

  object-fit: cover;

  border-radius: 4px;

  background: var(--discord-bg-tertiary);
}

.embed-image {
  display: block;

  width: auto;

  max-width: 100%;
  max-height: 500px;

  margin-top: 10px;

  border-radius: 4px;

  object-fit: contain;

  background: var(--discord-bg-tertiary);
}

.image-link {
  display: inline-block;

  max-width: 100%;

  line-height: 0;
}

.image-link:hover img {
  filter: brightness(1.05);
}

.embed-fields {
  display: grid;

  grid-template-columns:
    1fr;

  gap: 8px;

  margin-top: 10px;
}

.embed-field.inline {
  display: inline-block;
}

.embed-field-name {
  color: var(--discord-text-strong);

  font-size: 13px;
  font-weight: 700;
}

.embed-field-value {
  margin-top: 2px;

  white-space: pre-wrap;

  overflow-wrap: anywhere;
}

.embed-footer-row {
  display: flex;

  align-items: center;

  flex-wrap: wrap;

  gap: 10px;
}

.embed-footer {
  display: flex;

  align-items: center;

  gap: 6px;

  margin-top: 10px;

  color: var(--discord-muted);

  font-size: 11px;
}

.embed-footer img {
  width: 20px;
  height: 20px;

  border-radius: 50%;

  object-fit: cover;
}

.embed-timestamp {
  margin-top: 10px;

  color: var(--discord-muted);

  font-size: 11px;
}

/* =========================================================
   ATTACHMENTS
   ========================================================= */

.attachment {
  display: flex;

  align-items: center;

  gap: 10px;

  width: fit-content;
  max-width: 100%;

  margin-top: 8px;

  padding: 10px 12px;

  background: var(--discord-bg-tertiary);

  border: 1px solid rgba(255,255,255,.06);

  border-radius: var(--radius-medium);

  transition:
    background .12s ease,
    border-color .12s ease;
}

.attachment:hover {
  background: #18191c;

  border-color:
    rgba(255,255,255,.1);
}

.attachment-icon {
  font-size: 20px;

  flex: 0 0 auto;
}

.attachment-info {
  min-width: 0;
}

.attachment-name {
  display: block;

  color: var(--discord-link);

  font-weight: 600;

  text-decoration: none;

  overflow-wrap: anywhere;
}

.attachment-name:hover {
  text-decoration: underline;
}

.attachment-meta {
  margin-top: 2px;

  color: var(--discord-muted);

  font-size: 11px;
}

.attachment-image {
  display: block;

  max-width: min(100%, 560px);
  max-height: 500px;

  margin-top: 8px;

  border-radius: 5px;

  object-fit: contain;

  background: var(--discord-bg-tertiary);
}

/* =========================================================
   STICKERS
   ========================================================= */

.sticker {
  display: inline-flex;

  align-items: center;

  gap: 6px;

  margin-top: 8px;

  padding: 7px 10px;

  background: var(--discord-bg-tertiary);

  border-radius: var(--radius-medium);

  color: var(--discord-text);
}

.sticker-icon {
  font-size: 18px;
}

/* =========================================================
   REACTIONS
   ========================================================= */

.reactions {
  display: flex;

  flex-wrap: wrap;

  gap: 4px;

  margin-top: 6px;
}

.reaction {
  display: inline-flex;

  align-items: center;

  gap: 5px;

  padding: 3px 7px;

  background: var(--discord-bg-secondary);

  border: 1px solid rgba(255,255,255,.08);

  border-radius: 8px;

  color: var(--discord-muted);

  font-size: 12px;

  transition:
    background .12s ease,
    border-color .12s ease;
}

.reaction:hover {
  background: #35373c;

  border-color:
    rgba(255,255,255,.14);
}

.reaction-emoji {
  width: 16px;
  height: 16px;

  object-fit: contain;
}

/* =========================================================
   DAY DIVIDER
   ========================================================= */

.system-divider {
  display: flex;

  align-items: center;

  gap: 10px;

  margin: 22px 0 14px;

  color: var(--discord-muted);

  font-size: 12px;
  font-weight: 600;

  text-transform: capitalize;
}

.system-divider::before,
.system-divider::after {
  content: "";

  height: 1px;

  flex: 1;

  background: var(--discord-line);
}

/* =========================================================
   FOOTER
   ========================================================= */

.footer {
  margin-top: 34px;

  padding-top: 20px;

  border-top: 1px solid var(--discord-line);

  text-align: center;

  color: var(--discord-muted);

  font-size: 12px;
}

/* =========================================================
   MOBILE
   ========================================================= */

@media (max-width: 700px) {
  body {
    font-size: 14px;
  }

  .topbar {
    padding: 10px 12px;
  }

  .wrap {
    padding: 16px 10px 40px;
  }

  .ticket-header {
    padding: 16px;

    border-radius: 10px;
  }

  .ticket-header h1 {
    font-size: 20px;
  }

  .meta {
    flex-direction: column;

    gap: 5px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .info-full {
    grid-column: auto;
  }

  .message {
    gap: 10px;

    padding-right: 2px;
  }

  .avatar {
    width: 36px;
    height: 36px;

    flex-basis: 36px;
  }

  .author {
    font-size: 14px;
  }

  .time {
    font-size: 10px;
  }

  .embed {
    max-width: 100%;
  }

  .embed-main {
    flex-direction: column;

    gap: 8px;
  }

  .embed-thumb-wrap {
    order: -1;
  }

  .embed-thumbnail {
    width: 72px;
    height: 72px;
  }

  .embed-image,
  .attachment-image {
    max-height: 380px;
  }

  .reply-preview {
    max-width:
      calc(100vw - 100px);
  }
}

/* =========================================================
   VERY SMALL SCREENS
   ========================================================= */

@media (max-width: 420px) {
  .message {
    gap: 8px;
  }

  .avatar {
    width: 32px;
    height: 32px;

    flex-basis: 32px;
  }

  .topbar .server-icon {
    width: 34px;
    height: 34px;

    flex-basis: 34px;
  }

  .ticket-header h1 {
    font-size: 18px;
  }

  .reply-line {
    width: 18px;
    flex-basis: 18px;
  }
}

/* =========================================================
   PRINT
   ========================================================= */

@media print {
  .topbar {
    position: static;

    box-shadow: none;

    backdrop-filter: none;
  }

  .message:hover {
    background: transparent;
  }

  .wrap {
    max-width: none;
  }
}
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

    const maxMessages = Math.max(
      1,
      Number(config.maxMessages) || 10000
    );

    /**
     * ========================================================
     * BUSCAR MENSAGENS
     * ========================================================
     */

    const allMessages =
      new Map();

    let lastId = null;
    let fetchedCount = 0;

    while (
      fetchedCount <
      maxMessages
    ) {
      const remaining =
        maxMessages -
        fetchedCount;

      const limit = Math.min(
        100,
        remaining
      );

      const fetchOptions = {
        limit,
      };

      if (lastId) {
        fetchOptions.before =
          lastId;
      }

      const batch =
        await channel.messages.fetch(
          fetchOptions
        );

      if (!batch?.size) {
        break;
      }

      for (
        const message
        of batch.values()
      ) {
        allMessages.set(
          message.id,
          message
        );
      }

      fetchedCount +=
        batch.size;

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

    /**
     * ========================================================
     * ORDENAR
     * ========================================================
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
     * CACHE DE MENÇÕES
     * ========================================================
     */

    const mentionCache =
      createMentionCache(
        channel
      );

    /**
     * ========================================================
     * DADOS DO TICKET
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
            sorted[0].createdAt,
            config
          )
        : "—";

    const generatedAt =
      formatDate(
        new Date(),
        config
      );

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
/>

<meta
  name="color-scheme"
  content="dark"
/>

<meta
  name="description"
  content="Transcript do ticket #${escapeHtml(
    channelName
  )}"
/>

<title>
  Transcript — #${escapeHtml(
    channelName
  )}
</title>

<style>

${getTranscriptCss()}

</style>

</head>

<body>

<header class="topbar">

  <div class="server">

    ${
      guildIcon
        ? `
          <img
            class="server-icon"
            src="${safeUrl(
              guildIcon
            )}"
            alt="${escapeHtml(
              guildName
            )}"
            loading="lazy"
          >
        `
        : `
          <div
            class="server-icon"
            aria-hidden="true"
          ></div>
        `
    }

    <div>

      <div class="server-name">
        ${escapeHtml(
          guildName
        )}
      </div>

      <div class="channel-name">
        #${escapeHtml(
          channelName
        )}
      </div>

    </div>

  </div>

</header>

<main class="wrap">

<section
  class="ticket-header"
  aria-label="Informações principais do transcript"
>

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

${infoHtml}

<section
  class="messages"
  aria-label="Mensagens do ticket"
>
`;

    /**
     * ========================================================
     * MENSAGENS
     * ========================================================
     */

    let lastDay = "";

    for (
      const msg
      of sorted
    ) {
      try {
        const day =
          formatDay(
            msg.createdAt,
            config
          );

        if (
          day !== lastDay
        ) {
          html += `
            <div
              class="system-divider"
              role="separator"
            >
              ${escapeHtml(
                day
              )}
            </div>
          `;

          lastDay = day;
        }

        /**
         * Mensagens de sistema
         */

        if (
          isSystemMessage(
            msg
          )
        ) {
          html += `
            <div
              class="system-message"
              role="status"
            >
              ${escapeHtml(
                getSystemMessageText(
                  msg
                )
              )}
            </div>
          `;

          continue;
        }

        const avatar =
          getAvatar(msg);

        const author =
          getAuthorName(msg);

        const botTag =
          isBot(msg)
            ? `
              <span
                class="bot-tag"
                aria-label="Bot"
              >
                BOT
              </span>
            `
            : "";

        const time =
          formatTime(
            msg.createdAt,
            config
          );

        const fullTime =
          formatDate(
            msg.createdAt,
            config
          );

        const content =
          msg.content
            ? formatDiscordText(
                msg.content,
                mentionCache
              )
            : "";

        const edited =
          msg.editedTimestamp
            ? `
              <span
                class="edited"
                title="Esta mensagem foi editada"
              >
                (editada)
              </span>
            `
            : "";

        html += `
          <article
            class="message"
            id="m-${escapeHtml(
              msg.id
            )}"
            role="article"
            aria-label="Mensagem de ${escapeHtml(
              author
            )}"
          >

            ${
              avatar
                ? `
                  <img
                    class="avatar"
                    src="${safeUrl(
                      avatar
                    )}"
                    alt=""
                    title="${escapeHtml(
                      author
                    )}"
                    loading="lazy"
                  >
                `
                : `
                  <div
                    class="avatar"
                    aria-hidden="true"
                  ></div>
                `
            }

            <div class="message-content">

              <div class="author-line">

                <span class="author">
                  ${escapeHtml(
                    author
                  )}
                </span>

                ${botTag}

                <time
                  class="time"
                  datetime="${escapeHtml(
                    new Date(
                      msg.createdTimestamp
                    ).toISOString()
                  )}"
                  title="${escapeHtml(
                    fullTime
                  )}"
                >
                  ${escapeHtml(
                    time
                  )}
                </time>

                ${edited}

              </div>

              ${renderReply(
                msg,
                allMessages
              )}

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

              ${
                msg.embeds?.length
                  ? msg.embeds
                      .map(
                        (embed) =>
                          renderEmbed(
                            embed,
                            mentionCache,
                            config
                          )
                      )
                      .join("")
                  : ""
              }

              ${renderAttachments(
                msg,
                config
              )}

              ${renderStickers(
                msg
              )}

              ${renderReactions(
                msg,
                config
              )}

            </div>

          </article>
        `;
      } catch (
        messageError
      ) {
        console.error(
          `[Transcript] Erro ao renderizar mensagem ${msg.id}:`,
          messageError
        );

        html += `
          <div
            class="message-error"
            role="alert"
          >
            ⚠️ Não foi possível
            renderizar completamente
            a mensagem
            <code>${escapeHtml(
              msg.id
            )}</code>.
          </div>
        `;
      }
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

    if (
      additionalInfo.openedBy
    ) {
      txt +=
        `Aberto por: ${additionalInfo.openedBy}\n`;
    }

    if (
      additionalInfo.openedAt
    ) {
      txt +=
        `Aberto em: ${additionalInfo.openedAt}\n`;
    }

    if (
      additionalInfo.ticketLabel ||
      additionalInfo.ticketType
    ) {
      txt +=
        `Tipo: ${
          additionalInfo.ticketLabel ||
          additionalInfo.ticketType
        }\n`;
    }

    if (
      additionalInfo.claimedBy
    ) {
      txt +=
        `Assumido por: ${additionalInfo.claimedBy}\n`;
    }

    if (
      additionalInfo.closedBy
    ) {
      txt +=
        `Fechado por: ${additionalInfo.closedBy}\n`;
    }

    if (
      additionalInfo.closedAt
    ) {
      txt +=
        `Fechado em: ${additionalInfo.closedAt}\n`;
    }

    if (
      additionalInfo.duration
    ) {
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

    if (
      additionalInfo.truckyNome
    ) {
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

    if (
      additionalInfo.fotoNome
    ) {
      txt +=
        `Nome para Foto: ${additionalInfo.fotoNome}\n`;
    }

    txt +=
      "═══════════════════════════════════════════════════════════════\n\n";

    /**
     * ========================================================
     * TXT DAS MENSAGENS
     * ========================================================
     */

    for (
      const msg
      of sorted
    ) {
      try {
        const author =
          getAuthorName(msg);

        txt +=
          `[${formatDate(
            msg.createdAt,
            config
          )}] `;

        txt +=
          `${author} (${msg.author?.id || "?"})`;

        if (
          msg.author?.bot
        ) {
          txt += " [BOT]";
        }

        if (
          msg.editedTimestamp
        ) {
          txt += " [EDITADA]";
        }

        txt += "\n";

        if (
          msg.content
        ) {
          txt +=
            `${msg.content}\n`;
        }

        /**
         * Reply
         */

        if (
          msg.reference?.messageId
        ) {
          const referenced =
            allMessages.get(
              msg.reference.messageId
            );

          txt +=
            `  ↪ Resposta a: ${
              referenced
                ? getAuthorName(
                    referenced
                  )
                : "mensagem indisponível"
            }`;

          txt +=
            ` [ID: ${msg.reference.messageId}]\n`;
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

          if (
            embed.author?.name
          ) {
            txt +=
              `  Autor: ${embed.author.name}\n`;
          }

          if (
            embed.title
          ) {
            txt +=
              `  Título: ${embed.title}\n`;
          }

          if (
            embed.description
          ) {
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

          if (
            embed.url
          ) {
            txt +=
              `  URL: ${embed.url}\n`;
          }

          if (
            embed.image?.url
          ) {
            txt +=
              `  Imagem: ${embed.image.url}\n`;
          }

          if (
            embed.thumbnail?.url
          ) {
            txt +=
              `  Thumbnail: ${embed.thumbnail.url}\n`;
          }

          if (
            embed.footer?.text
          ) {
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
            }`;

          if (
            attachment.size
          ) {
            txt +=
              ` (${formatFileSize(
                attachment.size
              )})`;
          }

          txt +=
            `: ${attachment.url}\n`;
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

        /**
         * Reações
         */

        if (
          msg.reactions?.cache?.size
        ) {
          const reactionText =
            Array.from(
              msg.reactions.cache.values()
            )
              .map(
                (reaction) =>
                  `${
                    reaction.emoji.name ||
                    "emoji"
                  } x${
                    reaction.count ||
                    0
                  }`
              )
              .join(", ");

          if (
            reactionText
          ) {
            txt +=
              `  Reações: ${reactionText}\n`;
          }
        }

        /**
         * Sistema
         */

        if (
          isSystemMessage(
            msg
          )
        ) {
          txt +=
            `  [SISTEMA] ${getSystemMessageText(
              msg
            )}\n`;
        }

        txt += "\n";
      } catch (
        txtError
      ) {
        console.error(
          `[Transcript] Erro ao gerar TXT da mensagem ${msg.id}:`,
          txtError
        );

        txt +=
          `  [ERRO] Não foi possível processar a mensagem ${msg.id}\n\n`;
      }
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
