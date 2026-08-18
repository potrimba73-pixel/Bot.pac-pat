// src/commands/apgrmsgbot.js
import {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
} from 'discord.js';

// ============================================================
// CONSTANTES
// ============================================================
// IDs predefinidos (podes editar ou adicionar mais)
const PRESET_IDS = {
  '412347553141751808': 'Jockie Music (bot)',
  '759343605726052392': 'pt.jp lyaz',
  '770599668710637608': 'Utilizador 7705...',
  '456226577798135808': 'Utilizador 4562...',
};
const DEFAULT_TARGET_ID = '412347553141751808'; // Jockie Music
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '';

// ============================================================
// UTIL: ESCAPAR HTML
// ============================================================
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// EXTRAIR TEXTO DA MENSAGEM
// ============================================================
function getMessageText(msg) {
  let text = msg.content || '';

  if (msg.embeds?.length) {
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

  if (msg.attachments?.size) {
    for (const [, att] of msg.attachments) {
      text += (text ? '\n' : '') + `📎 ${att.name} (${att.url})`;
    }
  }

  if (msg.stickers?.size) {
    for (const sticker of msg.stickers.values()) {
      text += (text ? '\n' : '') + `🖼️ Sticker: ${sticker.name}`;
    }
  }

  return text || '(sem conteúdo)';
}

// ============================================================
// GERAR HTML (estilo Discord melhorado)
// ============================================================
function generatePrettyHTML(messages, channel, staffName, motivo, targetId, targetName) {
  const guild = channel.guild;
  const guildName = guild?.name || 'Servidor Desconhecido';
  const channelName = channel.name;
  const guildIcon = guild?.iconURL({ dynamic: true, size: 64 }) || '';

  const msgsHtml = Array.from(messages).map((msg, index) => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const data = new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(msg.createdAt);
    const texto = escapeHtml(getMessageText(msg)).replace(/\n/g, '<br>');

    const hue = (parseInt(msg.author.id.slice(0, 6), 16) % 360);
    const authorColor = msg.author.bot ? '#5865F2' : `hsl(${hue}, 70%, 55%)`;
    const botBadge = msg.author.bot ? '<span class="bot-badge">BOT</span>' : '';

    let embedsHtml = '';
    if (msg.embeds?.length) {
      for (const embed of msg.embeds) {
        const embedColor = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#5865F2';
        embedsHtml += `
        <div class="embed" style="border-left-color: ${embedColor};">
          ${embed.title ? `<div class="embed-title">${escapeHtml(embed.title)}</div>` : ''}
          ${embed.description ? `<div class="embed-desc">${escapeHtml(embed.description)}</div>` : ''}
          ${embed.fields ? embed.fields.map(f => `
            <div class="embed-field">
              <div class="embed-field-name">${escapeHtml(f.name)}</div>
              <div class="embed-field-value">${escapeHtml(f.value)}</div>
            </div>
          `).join('') : ''}
          ${embed.image?.url ? `<img src="${embed.image.url}" class="embed-image" loading="lazy">` : ''}
          ${embed.thumbnail?.url ? `<img src="${embed.thumbnail.url}" class="embed-thumbnail" loading="lazy">` : ''}
          ${embed.url ? `<a href="${embed.url}" target="_blank" class="embed-link">🔗 Link</a>` : ''}
        </div>`;
      }
    }

    const rowClass = index % 2 === 0 ? 'message' : 'message alt';
    return `
    <div class="${rowClass}">
      <img class="avatar" src="${avatar}" alt="Avatar" loading="lazy">
      <div class="content">
        <div class="header">
          <span class="author" style="color: ${authorColor};">${escapeHtml(msg.author.username)}</span>
          ${botBadge}
          <span class="time">${data}</span>
        </div>
        <div class="text">${texto}</div>
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
      background: #1e1f22;
      color: #dbdee1;
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #2b2d31;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .header {
      background: #1e1f22;
      padding: 20px 24px;
      border-bottom: 1px solid #3a3c42;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header .guild-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #2b2d31;
      border: 2px solid #3a3c42;
      object-fit: cover;
    }
    .header .info {
      flex: 1;
    }
    .header h1 {
      color: #ffffff;
      font-size: 20px;
      font-weight: 600;
      margin: 0;
    }
    .header p {
      color: #949ba4;
      font-size: 13px;
      margin: 4px 0 0;
    }
    .header p strong {
      color: #dbdee1;
      font-weight: 600;
    }
    .messages {
      padding: 12px 16px;
    }
    .message {
      display: flex;
      gap: 14px;
      padding: 10px 12px;
      border-radius: 6px;
      transition: background 0.15s;
    }
    .message.alt {
      background: rgba(255,255,255,0.03);
    }
    .message:hover {
      background: rgba(255,255,255,0.05);
    }
    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
      border: 1px solid #3a3c42;
    }
    .content {
      flex: 1;
      min-width: 0;
    }
    .header .author {
      font-weight: 600;
      font-size: 15px;
      margin-right: 6px;
    }
    .bot-badge {
      background: #5865f2;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: 8px;
      vertical-align: middle;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .header .time {
      color: #72767d;
      font-size: 12px;
      font-weight: 400;
      margin-left: auto;
    }
    .text {
      margin-top: 4px;
      font-size: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #dbdee1;
    }
    .text em {
      color: #72767d;
      font-style: italic;
    }
    .embed {
      background: #2b2d31;
      border-left: 4px solid #5865f2;
      padding: 10px 14px;
      margin-top: 8px;
      border-radius: 4px;
      font-size: 13px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    .embed-title {
      color: #ffffff;
      font-weight: 600;
      font-size: 14px;
    }
    .embed-desc {
      color: #dbdee1;
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
      color: #dbdee1;
    }
    .embed-image {
      max-width: 300px;
      border-radius: 6px;
      margin-top: 6px;
      border: 1px solid #3a3c42;
      display: block;
    }
    .embed-thumbnail {
      float: right;
      max-width: 80px;
      border-radius: 6px;
      margin-left: 12px;
      border: 1px solid #3a3c42;
    }
    .embed-link {
      color: #00aff4;
      text-decoration: none;
      font-weight: 500;
      display: inline-block;
      margin-top: 4px;
    }
    .embed-link:hover {
      text-decoration: underline;
    }
    a {
      color: #00aff4;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .footer {
      background: #1e1f22;
      padding: 16px 24px;
      border-top: 1px solid #3a3c42;
      text-align: center;
      color: #72767d;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .footer .stats {
      display: flex;
      gap: 16px;
      color: #949ba4;
    }
    .footer .stats span {
      background: #2b2d31;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
    }
    @media (max-width: 600px) {
      .header {
        flex-direction: column;
        align-items: flex-start;
      }
      .header .info h1 {
        font-size: 18px;
      }
      .message {
        padding: 8px 8px;
        gap: 10px;
      }
      .avatar {
        width: 36px;
        height: 36px;
      }
    }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    ${guildIcon ? `<img class="guild-icon" src="${guildIcon}" alt="Ícone do servidor">` : '<div class="guild-icon" style="background:#2b2d31;"></div>'}
    <div class="info">
      <h1>🧹 Mensagens apagadas</h1>
      <p>
        <strong>Servidor:</strong> ${escapeHtml(guildName)} &bull;
        <strong>Canal:</strong> #${escapeHtml(channelName)} &bull;
        <strong>Staff:</strong> ${escapeHtml(staffName)} &bull;
        <strong>Alvo:</strong> <@${targetId}> (${escapeHtml(targetName)}) &bull;
        <strong>Data:</strong> ${new Intl.DateTimeFormat('pt-PT').format(new Date())}
      </p>
    </div>
  </div>
  <div class="messages">
    ${msgsHtml}
  </div>
  <div class="footer">
    <div class="stats">
      <span>📊 ${Array.from(messages).length} mensagens</span>
      <span>👤 Alvo: <@${targetId}></span>
    </div>
    <div>Transcript gerado automaticamente • ${new Intl.DateTimeFormat('pt-PT').format(new Date())}</div>
  </div>
</div>
</body>
</html>`;
}

// ============================================================
// GERAR TXT
// ============================================================
function generateTxt(messages, channel, staffName, motivo, targetId, targetName) {
  const lines = [];
  lines.push('🧹 MENSAGENS APAGADAS');
  lines.push('================================');
  lines.push(`Canal: ${channel.name}`);
  lines.push(`Staff: ${staffName}`);
  lines.push(`Motivo: ${motivo}`);
  lines.push(`Alvo: ${targetId} (${targetName})`);
  lines.push(`Quantidade: ${Array.from(messages).length}`);
  lines.push(`Data: ${new Intl.DateTimeFormat('pt-PT').format(new Date())}`);
  lines.push('================================\n');

  for (const msg of messages) {
    const data = new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(msg.createdAt);
    const text = getMessageText(msg);
    lines.push(`[${data}] ${msg.author.username}: ${text}`);
  }

  return lines.join('\n');
}

// ============================================================
// FUNÇÃO DE CONFIRMAÇÃO
// ============================================================
async function askConfirmation(interaction, quantidade) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_yes')
      .setLabel('✅ Sim, apagar')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('confirm_no')
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({
    content: `⚠️ **Confirmação**: Vais apagar **${quantidade}** mensagens. Esta ação é irreversível. Continuar?`,
    components: [row],
  });

  const filter = (i) => i.user.id === interaction.user.id;
  try {
    const collected = await interaction.channel.awaitMessageComponent({
      filter,
      time: 30000,
    });
    const choice = collected.customId === 'confirm_yes';
    await collected.deferUpdate();
    await interaction.editReply({ components: [] });
    return choice;
  } catch {
    await interaction.editReply({ content: '⏰ Tempo esgotado. Operação cancelada.', components: [] });
    return false;
  }
}

// ============================================================
// COMANDO PRINCIPAL
// ============================================================
export async function execute(interaction, client) {
  // 1. Verificar permissões do utilizador
  if (!interaction.member.permissions.has('ManageMessages')) {
    return interaction.reply({
      content: '❌ Precisas da permissão **Gerenciar Mensagens**.',
      flags: 64,
    });
  }

  const channel = interaction.channel;

  // 2. Verificar permissões do bot
  const botMember = channel.guild.members.me;
  if (!botMember.permissionsIn(channel).has(['ManageMessages', 'ReadMessageHistory'])) {
    return interaction.reply({
      content: '❌ O bot precisa das permissões **Gerenciar Mensagens** e **Ler Histórico de Mensagens** neste canal.',
      flags: 64,
    });
  }

  // 3. Obter parâmetros – alvo
  const targetUser = interaction.options.getUser('membro');
  const targetIdRaw = interaction.options.getString('alvo-id');
  let targetId, targetName;

  if (targetUser) {
    // Se o utilizador foi selecionado na lista de membros
    targetId = targetUser.id;
    targetName = targetUser.username;
  } else if (targetIdRaw) {
    // Se foi fornecido um ID manualmente
    if (!/^\d{17,19}$/.test(targetIdRaw)) {
      return interaction.reply({
        content: '❌ O ID deve ser numérico e ter entre 17 e 19 dígitos.',
        flags: 64,
      });
    }
    targetId = targetIdRaw;
    // Verificar se o ID está na lista predefinida
    if (PRESET_IDS[targetId]) {
      targetName = PRESET_IDS[targetId];
    } else {
      try {
        const user = await client.users.fetch(targetId);
        targetName = user.username;
      } catch {
        targetName = 'Utilizador Desconhecido';
      }
    }
  } else {
    // Nenhum alvo especificado – usar o predefinido (Jockie Music)
    targetId = DEFAULT_TARGET_ID;
    targetName = PRESET_IDS[targetId] || 'Alvo predefinido';
  }

  // Não permitir apagar mensagens do próprio bot
  if (targetId === client.user.id) {
    return interaction.reply({
      content: '❌ Não podes apagar mensagens do próprio bot.',
      flags: 64,
    });
  }

  const quantidade = interaction.options.getInteger('quantidade') || 50;
  const motivo = interaction.options.getString('motivo') || 'Limpeza de mensagens';
  const formato = interaction.options.getString('formato') || 'ambos';

  // 4. Deferir resposta
  await interaction.deferReply({ flags: 64 });

  try {
    // 5. Buscar mensagens (paginado)
    let collected = new Collection();
    let lastId = null;
    const maxFetch = Math.min(quantidade, 1000);
    while (collected.size < maxFetch) {
      const opts = {
        limit: Math.min(100, maxFetch - collected.size),
      };
      if (lastId) opts.before = lastId;
      const batch = await channel.messages.fetch(opts);
      if (batch.size === 0) break;
      collected = collected.concat(batch);
      lastId = batch.last().id;
    }

    const targetMessages = collected.filter(msg => msg.author.id === targetId);
    const totalFound = targetMessages.size;

    // 6. Se não encontrou, sugerir IDs predefinidos com mensagens
    if (totalFound === 0) {
      // Contar mensagens por autor (apenas IDs predefinidos)
      const foundPresets = [];
      for (const [id, name] of Object.entries(PRESET_IDS)) {
        const count = collected.filter(msg => msg.author.id === id).size;
        if (count > 0) {
          foundPresets.push(`<@${id}> (${name}) – ${count} mensagens`);
        }
      }

      let suggestion = '';
      if (foundPresets.length > 0) {
        suggestion = `\n💡 **IDs predefinidos com mensagens neste canal:**\n${foundPresets.join('\n')}`;
      } else {
        // Se nenhum predefinido tiver mensagens, mostrar os bots que têm
        const botCounts = new Map();
        for (const msg of collected.values()) {
          if (msg.author.bot && msg.author.id !== client.user.id) {
            botCounts.set(msg.author.id, (botCounts.get(msg.author.id) || 0) + 1);
          }
        }
        if (botCounts.size > 0) {
          const sorted = [...botCounts.entries()].sort((a, b) => b[1] - a[1]);
          const top = sorted[0];
          suggestion = `\n💡 **Sugestão**: O bot com mais mensagens é <@${top[0]}> (${top[1]} mensagens). Talvez queiras usar esse ID?`;
        }
      }

      return interaction.editReply({
        content: `ℹ️ Nenhuma mensagem de <@${targetId}> (${targetName}) encontrada nas últimas ${collected.size} mensagens.${suggestion}`,
      });
    }

    // 7. Confirmar se for grande
    if (totalFound > 50) {
      const confirm = await askConfirmation(interaction, totalFound);
      if (!confirm) {
        return interaction.editReply({ content: '❌ Operação cancelada.' });
      }
    }

    // 8. Apagar mensagens (bulk + individual)
    const now = Date.now();
    const bulkable = targetMessages.filter(m => (now - m.createdTimestamp) < 1209600000);
    const rest = targetMessages.filter(m => !bulkable.has(m.id));

    let deletedCount = 0;
    let failedCount = 0;

    if (bulkable.size > 0) {
      try {
        const deleted = await channel.bulkDelete(bulkable, true);
        deletedCount += deleted.size;
      } catch {
        for (const msg of bulkable.values()) {
          try {
            await msg.delete();
            deletedCount++;
          } catch {
            failedCount++;
          }
        }
      }
    }

    for (const msg of rest.values()) {
      try {
        await msg.delete();
        deletedCount++;
      } catch {
        failedCount++;
      }
    }

    // 9. Gerar ficheiros
    const timestamp = Date.now();
    const baseName = `transcript-${channel.name}-${timestamp}`;
    const files = [];

    if (formato === 'html' || formato === 'ambos') {
      const html = generatePrettyHTML(
        targetMessages.values(),
        channel,
        interaction.user.username,
        motivo,
        targetId,
        targetName,
      );
      files.push(new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `${baseName}.html` }));
    }

    if (formato === 'txt' || formato === 'ambos') {
      const txt = generateTxt(
        targetMessages.values(),
        channel,
        interaction.user.username,
        motivo,
        targetId,
        targetName,
      );
      files.push(new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `${baseName}.txt` }));
    }

    // 10. Enviar transcript no canal
    const embed = new EmbedBuilder()
      .setTitle('🧹 Mensagens apagadas')
      .setDescription(
        `📊 **Quantidade:** ${deletedCount}${failedCount > 0 ? ` (${failedCount} falhas)` : ''}\n` +
        `👤 **Alvo:** <@${targetId}>\n` +
        `📅 **Data:** ${new Intl.DateTimeFormat('pt-PT').format(new Date())}\n` +
        `👮 **Staff:** <@${interaction.user.id}>\n` +
        `ℹ️ **Motivo:** ${motivo}`
      )
      .setColor(0xFF0000)
      .setFooter({ text: 'Transcript gerado automaticamente' })
      .setTimestamp();

    await channel.send({ embeds: [embed], files });

    // 11. Log de auditoria
    if (LOG_CHANNEL_ID) {
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('📝 Log de Limpeza')
          .setDescription(
            `**Staff:** <@${interaction.user.id}>\n` +
            `**Canal:** #${channel.name}\n` +
            `**Alvo:** <@${targetId}> (${targetName})\n` +
            `**Mensagens apagadas:** ${deletedCount}\n` +
            `**Motivo:** ${motivo}`
          )
          .setColor(0xFFA500)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    // 12. Responder ao utilizador
    await interaction.editReply({
      content: `✅ ${deletedCount} mensagens apagadas. ${failedCount > 0 ? `(${failedCount} falhas)` : ''} Transcript(s) enviado(s) no canal.`,
    });

  } catch (error) {
    console.error('[Apgrmsgbot] Erro:', error);
    try {
      await interaction.editReply({
        content: `❌ Erro: ${error.message || 'tente novamente.'}`,
      });
    } catch {
      await interaction.reply({
        content: `❌ Erro: ${error.message || 'tente novamente.'}`,
        flags: 64,
      });
    }
  }
}
