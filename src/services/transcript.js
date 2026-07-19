import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

export async function generateTranscript(channel, user, client) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // ===== TXT =====
    let txt = `TRANSCRIPT - ${channel.name}\n`;
    txt += `=`.repeat(50) + "\n";
    txt += `Aberto por: ${user?.tag || "Desconhecido"}\n`;
    txt += `Data: ${new Date().toLocaleString("pt-PT")}\n`;
    txt += `Total mensagens: ${sorted.length}\n`;
    txt += `=`.repeat(50) + "\n\n";

    const anexosList = [];

    for (const msg of sorted) {
      const data = msg.createdAt.toLocaleString("pt-PT");
      txt += `[${data}] ${msg.author.tag}: ${msg.content || "(sem texto)"}\n`;

      if (msg.embeds.length > 0) {
        for (const emb of msg.embeds) {
          txt += `  [EMBED] ${emb.title || ""}: ${emb.description || ""}\n`;
        }
      }

      if (msg.attachments.size > 0) {
        for (const [id, att] of msg.attachments) {
          txt += `  [ANEXO] ${att.name}: ${att.url}\n`;
          anexosList.push({ name: att.name, url: att.url, proxy: att.proxyURL });
        }
      }

      txt += "\n";
    }

    // ===== HTML =====
    let html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Transcript - ${channel.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#36393f;color:#dcddde;font-family:'Segoe UI',sans-serif;padding:20px}
  .header{background:#2f3136;padding:15px;border-radius:8px;margin-bottom:20px}
  .header h1{color:#fff;font-size:18px}
  .header p{color:#b9bbbe;font-size:13px}
  .msg{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #40444b}
  .avatar{width:40px;height:40px;border-radius:50%}
  .content{flex:1}
  .author{color:#fff;font-weight:600;font-size:15px}
  .time{color:#72767d;font-size:11px;margin-left:8px}
  .text{color:#dcddde;font-size:14px;margin-top:4px;white-space:pre-wrap}
  .embed{background:#2f3136;border-left:4px solid #5865f2;padding:10px;margin-top:6px;border-radius:4px}
  .embed-title{color:#fff;font-weight:600;font-size:14px}
  .embed-desc{color:#dcddde;font-size:13px;margin-top:4px}
  .attachment{margin-top:6px}
  .attachment a{color:#00b0f4;text-decoration:none;font-size:13px}
  .attachment img{max-width:300px;border-radius:4px;margin-top:4px}
  .anexos-section{background:#2f3136;padding:15px;border-radius:8px;margin-top:20px}
  .anexos-section h3{color:#fff;font-size:14px;margin-bottom:10px}
  .anexo-item{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #40444b}
  .anexo-item img{width:60px;height:60px;object-fit:cover;border-radius:4px}
  .anexo-item a{color:#00b0f4;text-decoration:none;font-size:13px}
</style>
</head>
<body>
<div class="header">
  <h1>Transcript - ${channel.name}</h1>
  <p>Aberto por: ${user?.tag || "Desconhecido"} | Data: ${new Date().toLocaleString("pt-PT")} | Mensagens: ${sorted.length}</p>
</div>
<div class="messages">`;

    for (const msg of sorted) {
      const data = msg.createdAt.toLocaleString("pt-PT");
      html += `
<div class="msg">
  <img class="avatar" src="${msg.author.displayAvatarURL({ extension: "png", size: 64 })}" alt="">
  <div class="content">
    <span class="author">${msg.author.tag}</span><span class="time">${data}</span>
    <div class="text">${msg.content ? msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "(sem texto)"}</div>`;

      for (const emb of msg.embeds) {
        html += `
    <div class="embed">
      <div class="embed-title">${emb.title || ""}</div>
      <div class="embed-desc">${emb.description || ""}</div>
    </div>`;
      }

      for (const [id, att] of msg.attachments) {
        const isImage = att.contentType?.startsWith("image/");
        html += `
    <div class="attachment">
      <a href="${att.url}" target="_blank">${att.name}</a>
      ${isImage ? `<br><img src="${att.proxyURL || att.url}" alt="${att.name}">` : ""}
    </div>`;
      }

      html += `
  </div>
</div>`;
    }

    // Secao de anexos no fim
    if (anexosList.length > 0) {
      html += `
</div>
<div class="anexos-section">
  <h3>Anexos (${anexosList.length})</h3>`;
      for (const anexo of anexosList) {
        const isImage = anexo.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        html += `
  <div class="anexo-item">
    ${isImage ? `<img src="${anexo.proxy || anexo.url}" alt="">` : ""}
    <a href="${anexo.url}" target="_blank">${anexo.name}</a>
  </div>`;
      }
      html += `
</div>`;
    }

    html += `
</body>
</html>`;

    return {
      txt: Buffer.from(txt, "utf-8"),
      html: Buffer.from(html, "utf-8"),
      count: sorted.length
    };
  } catch (e) {
    console.error("[Transcript] Erro:", e.message);
    return null;
  }
}

export async function sendTranscript(channel, user, client, targetChannel) {
  const result = await generateTranscript(channel, user, client);
  if (!result) return null;

  const txtAtt = new AttachmentBuilder(result.txt, { name: `transcript_${channel.name}.txt` });
  const htmlAtt = new AttachmentBuilder(result.html, { name: `transcript_${channel.name}.html` });

  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.PRIMARY)
    .setTitle(`${CONFIG.EMOJI_SUCCESS} Transcript Gerado`)
    .setDescription(`Ticket: **${channel.name}**\nMensagens: **${result.count}**`)
    .setFooter({ text: `Por ${user?.tag || "Sistema"}` })
    .setTimestamp();

  const msg = await targetChannel.send({
    embeds: [embed],
    files: [txtAtt, htmlAtt]
  });

  return msg;
}
