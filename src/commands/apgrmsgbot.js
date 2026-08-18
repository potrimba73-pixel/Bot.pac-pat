// src/commands/apgrmsgbot.js
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { gerarTranscript } from '../utils/transcript.js';
import { safeDeferReply, safeEditReply } from '../utils/safeReply.js';

const TARGET_BOT_ID = '412347553141751808';

// ============================================================
// EXTRAI O TEXTO REAL DA MENSAGEM (inclusive embeds)
// ============================================================
function getMessageText(msg) {
  let text = msg.content || '';

  // Extrair informações dos embeds (ex: Spotify, links, etc)
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
    }
  }

  // Anexos
  if (msg.attachments && msg.attachments.size > 0) {
    for (const [id, att] of msg.attachments) {
      text += (text ? '\n' : '') + `[Anexo: ${att.name} (${att.url})]`;
    }
  }

  return text || '(sem texto)';
}

// ============================================================
// COMANDO PRINCIPAL
// ============================================================
export async function execute(interaction, client) {
  // Verificar permissão
  if (!interaction.member.permissions.has('ManageMessages')) {
    return interaction.reply({
      content: '❌ Precisas da permissão Gerenciar Mensagens.',
      flags: 64
    });
  }

  const quantidade = interaction.options.getInteger('quantidade') || 50;
  const motivo = interaction.options.getString('motivo') || 'Limpeza de mensagens do bot';

  const deferred = await safeDeferReply(interaction);
  if (!deferred) {
    return interaction.reply({ content: '⏳ A processar...', flags: 64 });
  }

  const channel = interaction.channel;

  try {
    const messages = await channel.messages.fetch({ limit: Math.min(quantidade, 100) });
    const botMessages = messages.filter(msg => msg.author.id === TARGET_BOT_ID);

    if (botMessages.size === 0) {
      return await safeEditReply(interaction, {
        content: `ℹ️ Nenhuma mensagem do bot <@${TARGET_BOT_ID}> encontrada.`,
        flags: 64
      });
    }

    // ===== TENTAR GERAR TRANSCRIPT COM A FUNÇÃO EXISTENTE =====
    let transcriptResult = null;
    try {
      transcriptResult = await gerarTranscript(channel, `bot-clean-${Date.now()}`);
      console.log('[Apgrmsgbot] Transcript gerado com sucesso.');
    } catch (err) {
      console.error('[Apgrmsgbot] Erro ao gerar transcript:', err.message);
    }

    const files = [];

    // Se a função gerou attachments, usamos
    if (transcriptResult && transcriptResult.attachment && transcriptResult.txtAttachment) {
      files.push(transcriptResult.attachment);      // HTML
      files.push(transcriptResult.txtAttachment);   // TXT
    } else {
      // ===== FALLBACK MANUAL (HTML + TXT com texto dos embeds) =====
      // TXT
      let txtContent = '🧹 MENSAGENS DO BOT APAGADAS\n';
      txtContent += '================================\n';
      txtContent += `Canal: ${channel.name}\n`;
      txtContent += `Staff: ${interaction.user.username}\n`;
      txtContent += `Motivo: ${motivo}\n`;
      txtContent += `Bot alvo: ${TARGET_BOT_ID}\n`;
      txtContent += `Quantidade: ${botMessages.size}\n`;
      txtContent += `Data: ${new Date().toLocaleString('pt-PT')}\n`;
      txtContent += '================================\n\n';

      // HTML (básico, mas funcional)
      let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Transcript - BOT Clean</title>
  <style>
    body { background: #36393f; color: #dcddde; font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #fff; }
    .msg { border-bottom: 1px solid #40444b; padding: 10px 0; }
    .time { color: #72767d; font-size: 12px; }
    .author { color: #fff; font-weight: bold; }
    .text { margin-top: 4px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>🧹 Mensagens do BOT apagadas</h1>
  <p><strong>Canal:</strong> ${channel.name}</p>
  <p><strong>Staff:</strong> ${interaction.user.username}</p>
  <p><strong>Motivo:</strong> ${motivo}</p>
  <p><strong>Data:</strong> ${new Date().toLocaleString('pt-PT')}</p>
  <hr>`;

      for (const msg of botMessages.values()) {
        const data = msg.createdAt.toLocaleString('pt-PT');
        const text = getMessageText(msg); // 🔥 AQUI EXTRAI O TEXTO REAL
        txtContent += `[${data}] ${msg.author.username}: ${text}\n`;
        htmlContent += `
  <div class="msg">
    <span class="time">${data}</span>
    <span class="author">${msg.author.username}</span>
    <div class="text">${text.replace(/\n/g, '<br>')}</div>
  </div>`;
      }

      htmlContent += `
</body>
</html>`;

      const txtBuffer = Buffer.from(txtContent, 'utf-8');
      const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
      files.push(new AttachmentBuilder(txtBuffer, { name: `bot-transcript-${Date.now()}.txt` }));
      files.push(new AttachmentBuilder(htmlBuffer, { name: `bot-transcript-${Date.now()}.html` }));
    }

    // ===== APAGAR MENSAGENS =====
    for (const msg of botMessages.values()) {
      await msg.delete().catch(() => {});
    }

    // ===== ENVIAR EMBED + FICHEIROS =====
    const embed = new EmbedBuilder()
      .setTitle('🧹 Mensagens do BOT apagadas')
      .setDescription(
        `📊 **Quantidade:** ${botMessages.size}\n` +
        `🤖 **Bot alvo:** <@${TARGET_BOT_ID}>\n` +
        `📅 **Data:** ${new Date().toLocaleString('pt-PT')}\n` +
        `👮 **Staff:** <@${interaction.user.id}>\n` +
        `ℹ️ **Motivo:** ${motivo}`
      )
      .setColor(0xFF0000)
      .setFooter({ text: 'Transcript gerado automaticamente' })
      .setTimestamp();

    await channel.send({ embeds: [embed], files });

    // ===== RESPOSTA AO UTILIZADOR =====
    await safeEditReply(interaction, {
      content: `✅ ${botMessages.size} mensagens apagadas. Transcript enviado no canal.`,
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
