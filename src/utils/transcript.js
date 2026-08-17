// src/utils/transcript.js
import { AttachmentBuilder } from "discord.js";

export async function gerarTranscript(channel, ticketId) {
  try {
    const messages = await channel.messages.fetch({ limit: 200 });
    const sorted = Array.from(messages.values())
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // ===== GERAR HTML =====
    let html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transcript - Ticket #${ticketId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #2f3136; color: #dcddde; font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; }
    .header { background: #202225; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #5865f2; }
    .header h1 { color: #fff; font-size: 20px; }
    .header p { color: #b9bbbe; font-size: 13px; margin-top: 4px; }
    .message { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #40444b; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
    .content { flex: 1; }
    .author { color: #fff; font-weight: 600; font-size: 14px; }
    .time { color: #72767d; font-size: 11px; margin-left: 8px; }
    .body { color: #dcddde; font-size: 14px; margin-top: 4px; white-space: pre-wrap; word-wrap: break-word; }
    .embed { background: #2f3136; border-left: 4px solid #5865f2; padding: 10px 12px; margin-top: 6px; border-radius: 4px; }
    .embed-title { color: #fff; font-weight: 600; font-size: 14px; }
    .embed-desc { color: #dcddde; font-size: 13px; margin-top: 4px; }
    .attachment { margin-top: 6px; }
    .attachment a { color: #00aff4; text-decoration: none; font-size: 13px; }
    .attachment img { max-width: 300px; border-radius: 4px; margin-top: 4px; border: 1px solid #40444b; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Transcript - Ticket #${ticketId}</h1>
    <p>Canal: #${channel.name} • Total: ${sorted.length} mensagens</p>
  </div>`;

    for (const msg of sorted) {
      const avatar = msg.author.displayAvatarURL({ extension: "png", size: 64 });
      const date = msg.createdAt.toLocaleString("pt-PT");
      const content = msg.content ? msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

      html += `
  <div class="message">
    <img class="avatar" src="${avatar}" alt="">
    <div class="content">
      <span class="author">${msg.author.tag}</span>
      <span class="time">${date}</span>
      <div class="body">${content || "<em>Sem texto</em>"}</div>`;

      // Embeds
      for (const emb of msg.embeds) {
        html += `
      <div class="embed">
        <div class="embed-title">${emb.title || ""}</div>
        <div class="embed-desc">${emb.description || ""}</div>
      </div>`;
      }

      // Anexos
      for (const [, att] of msg.attachments) {
        const isImage = att.contentType?.startsWith("image/");
        html += `
      <div class="attachment">
        <a href="${att.url}" target="_blank">📎 ${att.name}</a>
        ${isImage ? `<br><img src="${att.proxyURL || att.url}" alt="${att.name}">` : ""}
      </div>`;
      }

      html += `
    </div>
  </div>`;
    }

    html += `
</body>
</html>`;

    // ===== GERAR TXT =====
    let txt = `═══════════════════════════════════════════════════════════════\n`;
    txt += `  TRANSCRIPT - Ticket #${ticketId}\n`;
    txt += `═══════════════════════════════════════════════════════════════\n`;
    txt += `Canal: #${channel.name}\n`;
    txt += `Total: ${sorted.length} mensagens\n`;
    txt += `Data: ${new Date().toLocaleString("pt-PT")}\n`;
    txt += `═══════════════════════════════════════════════════════════════\n\n`;

    for (const msg of sorted) {
      const date = msg.createdAt.toLocaleString("pt-PT");
      txt += `[${date}] ${msg.author.tag} (${msg.author.id})\n`;
      if (msg.content) txt += `  ${msg.content}\n`;
      if (msg.attachments.size > 0) {
        const names = Array.from(msg.attachments.values()).map(a => a.name).join(", ");
        txt += `  📎 Anexos: ${names}\n`;
      }
      txt += `\n`;
    }

    txt += `═══════════════════════════════════════════════════════════════\n`;
    txt += `  FIM DO TRANSCRIPT\n`;
    txt += `═══════════════════════════════════════════════════════════════\n`;

    // ===== CRIAR ATTACHMENTS =====
    const htmlBuffer = Buffer.from(html, "utf-8");
    const txtBuffer = Buffer.from(txt, "utf-8");

    const htmlAttachment = new AttachmentBuilder(htmlBuffer, {
      name: `transcript-${ticketId}.html`
    });

    const txtAttachment = new AttachmentBuilder(txtBuffer, {
      name: `transcript-${ticketId}.txt`
    });

    return {
      attachment: htmlAttachment,
      fileName: `transcript-${ticketId}.html`,
      txtAttachment: txtAttachment,
      txtFileName: `transcript-${ticketId}.txt`,
      ticketId
    };

  } catch (err) {
    console.error(`[Transcript] Erro no ticket #${ticketId}:`, err.message);
    return null;
  }
}
