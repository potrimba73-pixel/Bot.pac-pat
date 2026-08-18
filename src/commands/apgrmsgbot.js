// src/commands/apgrmsgbot.js
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { safeDeferReply, safeEditReply } from '../utils/safeReply.js';

const DEFAULT_BOT_ID = '412347553141751808';

// Função getMessageText (igual à anterior)
function getMessageText(msg) {
  let text = msg.content || '';
  if (msg.embeds && msg.embeds.length > 0) {
    for (const embed of msg.embeds) {
      if (embed.title) text += (text ? '\n' : '') + embed.title;
      if (embed.description) text += (text ? '\n' : '') + embed.description;
      if (embed.fields) {
        for (const field of embed.fields) {
          text += (text ? '\n' : '') + `${field.name}: ${field.value}`;
        }
      }
      if (embed.url) text += (text ? '\n' : '') + embed.url;
      if (embed.author?.name) text += (text ? '\n' : '') + `Por ${embed.author.name}`;
      if (embed.footer?.text) text += (text ? '\n' : '') + embed.footer.text;
    }
  }
  if (msg.attachments && msg.attachments.size > 0) {
    for (const [id, att] of msg.attachments) {
      text += (text ? '\n' : '') + `📎 ${att.name} (${att.url})`;
    }
  }
  return text || '(sem texto)';
}

// Função generatePrettyHTML (igual à anterior, mas com targetId)
function generatePrettyHTML(messages, channelName, staffName, motivo, targetId) {
  // messages é um array de mensagens
  const msgsHtml = messages.map(msg => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const data = msg.createdAt.toLocaleString('pt-PT');
    const texto = getMessageText(msg).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const authorColor = msg.author.bot ? '#5865F2' : '#FFFFFF';

    let embedsHtml = '';
    if (msg.embeds && msg.embeds.length > 0) {
      for (const embed of msg.embeds) {
        let embedColor = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#5865F2';
        embedsHtml += `
        <div class="embed" style="border-left-color: ${embedColor};">
          ${embed.title ? `<div class="embed-title">${embed.title}</div>` : ''}
          ${embed.description ? `<div class="embed-desc">${embed.description}</div>` : ''}
          ${embed.fields ? embed.fields.map(f => `
            <div class="embed-field">
              <div class="embed-field-name">${f.name}</div>
              <div class="embed-field-value">${f.value}</div>
            </div>
          `).join('') : ''}
          ${embed.image ? `<img src="${embed.image.url}" class="embed-image">` : ''}
          ${embed.thumbnail ? `<img src="${embed.thumbnail.url}" class="embed-thumbnail">` : ''}
          ${embed.url ? `<a href="${embed.url}" target="_blank">🔗 Link</a>` : ''}
        </div>`;
      }
    }

    return `
    <div class="message">
      <img class="avatar" src="${avatar}" alt="Avatar">
      <div class="content">
        <div class="header">
          <span class="author" style="color: ${authorColor};">${msg.author.username}</span>
          <span class="time">${data}</span>
        </div>
        <div class="text">${texto || '<em>Sem texto</em>'}</div>
        ${embedsHtml}
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Transcript - Limpeza</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #2f3136;
      color: #dcddde;
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 20px;
      line-height: 1.5;
    }
    .header {
      background: #202225;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #5865f2;
    }
    .header h1 { color: #fff; font-size: 20px; margin-bottom: 4px; }
    .header p { color: #b9bbbe; font-size: 13px; }
    .message {
      display: flex;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #40444b;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .content { flex: 1; }
    .header .author {
      font-weight: 600;
      font-size: 14px;
    }
    .header .time {
      color: #72767d;
      font-size: 11px;
      margin-left: 8px;
    }
    .text {
      margin-top: 4px;
      font-size: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .embed {
      background: #2f3136;
      border-left: 4px solid #5865f2;
      padding: 10px 12px;
      margin-top: 6px;
      border-radius: 4px;
      font-size: 13px;
    }
    .embed-title {
      color: #fff;
      font-weight: 600;
    }
    .embed-desc {
      color: #dcddde;
      margin-top: 4px;
    }
    .embed-field {
      margin-top: 6px;
    }
    .embed-field-name {
      color: #b9bbbe;
      font-weight: 600;
    }
    .embed-field-value {
      color: #dcddde;
    }
    .embed-image {
      max-width: 300px;
      border-radius: 4px;
      margin-top: 6px;
      border: 1px solid #40444b;
    }
    .embed-thumbnail {
      float: right;
      max-width: 80px;
      border-radius: 4px;
      margin-left: 10px;
    }
    a {
      color: #00aff4;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    em {
      color: #72767d;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #72767d;
      font-size: 12px;
      border-top: 1px solid #40444b;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧹 Mensagens apagadas</h1>
    <p><strong>Canal:</strong> ${channelName} &bull; <strong>Staff:</strong> ${staffName} &bull; <strong>Motivo:</strong> ${motivo} &bull; <strong>Alvo:</strong> <@${targetId}> &bull; <strong>Data:</strong> ${new Date().toLocaleString('pt-PT')}</p>
  </div>
  ${msgsHtml}
  <div class="footer">Transcript gerado automaticamente • ${new Date().toLocaleString('pt-PT')}</div>
</body>
</html>`;
}

export async function execute(interaction, client) {
  // Verificar permissão
  if (!interaction.member.permissions.has('ManageMessages')) {
    return interaction.reply({
      content: '❌ Precisas da permissão Gerenciar Mensagens.',
      flags: 64
    });
  }

  const targetUser = interaction.options.getUser('membro');
  const targetId = targetUser ? targetUser.id : DEFAULT_BOT_ID;
  const targetName = targetUser ? targetUser.username : 'Jockie Music (bot)';
  const quantidade = interaction.options.getInteger('quantidade') || 50;
  const motivo = interaction.options.getString('motivo') || 'Limpeza de mensagens';

  // Deferir a resposta uma única vez
  const deferred = await safeDeferReply(interaction);
  if (!deferred) {
    // Se não conseguiu deferir, tenta responder diretamente (não deve acontecer)
    return interaction.reply({ content: '⏳ A processar...', flags: 64 });
  }

  const channel = interaction.channel;

  try {
    const messages = await channel.messages.fetch({ limit: Math.min(quantidade, 100) });
    // Filtrar e converter para array
    const targetMessages = messages.filter(msg => msg.author.id === targetId);
    const msgArray = Array.from(targetMessages.values());

    if (msgArray.length === 0) {
      return await safeEditReply(interaction, {
        content: `ℹ️ Nenhuma mensagem de <@${targetId}> encontrada.`,
        flags: 64
      });
    }

    // Gerar HTML com o array
    const html = generatePrettyHTML(msgArray, channel.name, interaction.user.username, motivo, targetId);

    // Gerar TXT
    let txt = '🧹 MENSAGENS APAGADAS\n';
    txt += '================================\n';
    txt += `Canal: ${channel.name}\n`;
    txt += `Staff: ${interaction.user.username}\n`;
    txt += `Motivo: ${motivo}\n`;
    txt += `Alvo: ${targetId} (${targetName})\n`;
    txt += `Quantidade: ${msgArray.length}\n`;
    txt += `Data: ${new Date().toLocaleString('pt-PT')}\n`;
    txt += '================================\n\n';
    for (const msg of msgArray) {
      const data = msg.createdAt.toLocaleString('pt-PT');
      const text = getMessageText(msg);
      txt += `[${data}] ${msg.author.username}: ${text}\n`;
    }

    const htmlBuffer = Buffer.from(html, 'utf-8');
    const txtBuffer = Buffer.from(txt, 'utf-8');
    const files = [
      new AttachmentBuilder(htmlBuffer, { name: `transcript-${Date.now()}.html` }),
      new AttachmentBuilder(txtBuffer, { name: `transcript-${Date.now()}.txt` })
    ];

    // Apagar mensagens
    for (const msg of msgArray) {
      await msg.delete().catch(() => {});
    }

    // Enviar embed com ficheiros
    const embed = new EmbedBuilder()
      .setTitle('🧹 Mensagens apagadas')
      .setDescription(
        `📊 **Quantidade:** ${msgArray.length}\n` +
        `👤 **Alvo:** <@${targetId}>\n` +
        `📅 **Data:** ${new Date().toLocaleString('pt-PT')}\n` +
        `👮 **Staff:** <@${interaction.user.id}>\n` +
        `ℹ️ **Motivo:** ${motivo}`
      )
      .setColor(0xFF0000)
      .setFooter({ text: 'Transcript gerado automaticamente' })
      .setTimestamp();

    await channel.send({ embeds: [embed], files });

    // Responder ao utilizador
    await safeEditReply(interaction, {
      content: `✅ ${msgArray.length} mensagens apagadas. Transcript (HTML + TXT) enviado no canal.`,
      flags: 64
    });

  } catch (error) {
    console.error('[Apgrmsgbot] Erro:', error);
    await safeEditReply(interaction, {
      content: `❌ Erro: ${error.message || 'tente novamente.'}`,
      flags: 64
    });
  }
}
