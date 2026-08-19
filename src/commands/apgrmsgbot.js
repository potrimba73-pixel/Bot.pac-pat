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
const PRESET_IDS = {
  '412347553141751808': 'Jockie Music (bot)',
  '759343605726052392': 'pt.jp lyaz',
  '770599668710637608': 'Utilizador 7705...',
  '456226577798135808': 'Utilizador 4562...',
};
const DEFAULT_TARGET_ID = '412347553141751808';
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '';
const TIMEZONE = 'Europe/Lisbon';

// ============================================================
// UTIL: ESCAPAR HTML E SANITIZAR
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

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9\-_]/g, '_');
}

// ============================================================
// FORMATADOR DE DATA
// ============================================================
const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
  timeZone: TIMEZONE,
});

const dateFormatterShort = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  timeZone: TIMEZONE,
});

// ============================================================
// FUNÇÕES AUXILIARES PARA NOMES E DISCRIMINADORES
// ============================================================
function getDisplayName(msg) {
  if (msg.member) return msg.member.displayName;
  if (msg.guild) {
    const member = msg.guild.members.cache.get(msg.author.id);
    if (member) return member.displayName;
  }
  return msg.author.globalName || msg.author.username;
}

function getDiscriminator(author) {
  const disc = author.discriminator || '0';
  return parseInt(disc) || 0;
}

// ============================================================
// RENDERIZADOR DE MARKDOWN DO DISCORD
// ============================================================
function renderMarkdown(text) {
  if (!text) return '';
  let processed = escapeHtml(text);

  // 1. Emojis customizados do Discord
  processed = processed.replace(/&lt;a?:([a-zA-Z0-9_]+):[0-9]+&gt;/g, ':$1:');

  // 2. Links em Markdown [Texto](URL)
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // 3. Links simples (URLs soltas)
  processed = processed.replace(/(^|[^"])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');

  // 4. Formatação básica
  processed = processed.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  processed = processed.replace(/__([^_]+?)__/g, '<u>$1</u>');
  processed = processed.replace(/~~([^~]+?)~~/g, '<s>$1</s>');
  processed = processed.replace(/\n/g, '<br>');

  return processed;
}

// ============================================================
// PROCESSADOR DE EMBEDS ESTILO DISCORD / JOCKIE MUSIC
// ============================================================
function renderMessageContentHTML(msg) {
  let html = '';

  // Texto base da mensagem
  if (msg.content) {
    html += `<div class="text-content">${renderMarkdown(msg.content)}</div>`;
  }

  // Embeds
  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      const desc = embed.description || '';

      // 1. Estilo especial: Caixas "Started playing..." (Card estilo Spotify)
      if (desc.toLowerCase().includes('started playing')) {
        const match = desc.match(/\[(.*?)\]\((.*?)\)/);
        const songTitle = match ? match[1] : desc.replace(/.*Started playing\s*/i, '');
        const songUrl = match ? match[2] : '#';

        html += `
        <div class="music-card">
          <svg class="spotify-icon" viewBox="0 0 24 24"><path fill="#1DB954" d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.899 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.019zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-.1.2-.84-.36-.18-.6.36-1.2.96-1.38 4.2-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z"/></svg>
          <span class="music-label">Started playing</span>
          <a href="${escapeHtml(songUrl)}" target="_blank" class="music-title">${escapeHtml(songTitle)}</a>
        </div>`;
        continue;
      }

      // 2. Estilo especial: Embed de Playlist (Ex: RAP TUGA)
      const isPlaylist = embed.title?.toLowerCase().includes('playlist') || desc.toLowerCase().includes('playlist') || embed.fields?.some(f => f.name.toLowerCase().includes('playlist'));

      if (isPlaylist) {
        let playlistName = '', tracks = '', length = '';
        for (const f of embed.fields || []) {
          const fn = f.name.toLowerCase();
          if (fn.includes('playlist')) playlistName = f.value;
          if (fn.includes('tracks')) tracks = f.value;
          if (fn.includes('length') || fn.includes('duração')) length = f.value;
        }

        const thumbnail = embed.thumbnail?.url || embed.image?.url || '';

        html += `
        <div class="embed-box">
          <div class="embed-inner">
            <div class="embed-details">
              <div class="embed-title-header">Added Playlist</div>
              <div class="embed-field-label">Playlist</div>
              <div class="embed-field-value-link">${renderMarkdown(playlistName || embed.title || 'Playlist')}</div>
              <div class="embed-grid">
                <div>
                  <div class="embed-field-label">Playlist Length</div>
                  <div class="embed-field-value">${escapeHtml(length || '-')}</div>
                </div>
                <div>
                  <div class="embed-field-label">Tracks</div>
                  <div class="embed-field-value">${escapeHtml(tracks || '-')}</div>
                </div>
              </div>
            </div>
            ${thumbnail ? `<img src="${escapeHtml(thumbnail)}" class="embed-thumb" alt="Cover">` : ''}
          </div>
        </div>`;
        continue;
      }

      // 3. Embed Genérico do Discord
      const color = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#202225';
      html += `
      <div class="embed-box" style="border-left-color: ${color};">
        ${embed.title ? `<div class="embed-title-header">${renderMarkdown(embed.title)}</div>` : ''}
        ${embed.description ? `<div class="text-content">${renderMarkdown(embed.description)}</div>` : ''}
      </div>`;
    }
  }

  // Anexos
  if (msg.attachments?.size) {
    for (const [, att] of msg.attachments) {
      if (att.contentType?.startsWith('image/')) {
        html += `<div class="attachment"><img src="${escapeHtml(att.url)}" alt="Anexo"></div>`;
      } else {
        html += `<div class="attachment"><a href="${escapeHtml(att.url)}" target="_blank" class="music-title">📎 ${escapeHtml(att.name)}</a></div>`;
      }
    }
  }

  return html || '<div class="text-content">(sem conteúdo)</div>';
}

// ============================================================
// EXTRAÇÃO DE TEXTO PARA TXT (RAW)
// ============================================================
function getTxtContentRaw(msg) {
  const isJockie = msg.author.id === '412347553141751808';
  let parts = [];

  if (msg.content) parts.push(msg.content);

  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      if (isJockie) {
        if (embed.description) parts.push(embed.description);
        if (embed.url && !embed.description?.includes(embed.url)) parts.push(embed.url);
        continue;
      }
      if (embed.title) parts.push(embed.title);
      if (embed.description) parts.push(embed.description);
      if (embed.fields) {
        for (const field of embed.fields) parts.push(`${field.name}: ${field.value}`);
      }
    }
  }

  if (msg.attachments?.size) {
    for (const [, att] of msg.attachments) parts.push(`📎 ${att.name} (${att.url})`);
  }

  return parts.join(' ').trim() || '(sem conteúdo)';
}

// ============================================================
// GERAR HTML (DISCORD DARK MODE EXACTO)
// ============================================================
function generatePrettyHTML(messages, channel, staffName, motivo, targetId, targetName) {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);

  const msgsHtml = sorted.map((msg) => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 80 });
    const data = dateFormatter.format(msg.createdAt);
    const authorName = getDisplayName(msg);
    const isBot = msg.author.bot;

    // Badge oficial APP com visto ✓
    const botBadgeHtml = isBot ? `
      <span class="bot-tag">
        <svg class="bot-check" viewBox="0 0 16 15" width="10" height="10"><path fill="currentColor" d="M6 11L2 7l1.4-1.4L6 8.2l6.6-6.6L14 3z"/></svg>
        <span class="bot-text">APP</span>
      </span>` : '';

    const contentHtml = renderMessageContentHTML(msg);

    return `
    <div class="chat-message">
      <img class="user-avatar" src="${avatar}" alt="Avatar" loading="lazy">
      <div class="message-body">
        <div class="message-header">
          <span class="username">${escapeHtml(authorName)}</span>
          ${botBadgeHtml}
          <span class="timestamp">${data}</span>
        </div>
        <div class="message-content">
          ${contentHtml}
        </div>
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transcript - #${escapeHtml(channel.name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=gg+sans:wght@400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background-color: #111214;
    color: #dbdee1;
    font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.375rem;
    padding: 20px 0;
    display: flex;
    justify-content: center;
  }

  .chat-container {
    width: 100%;
    max-width: 1000px;
    background-color: #111214;
    padding: 0 16px;
  }

  .chat-message {
    display: flex;
    margin-bottom: 16px;
    padding: 2px 0;
  }

  .chat-message:hover {
    background-color: rgba(2, 2, 2, 0.08);
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 16px;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .message-body {
    flex: 1;
    overflow: hidden;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .username {
    font-weight: 600;
    font-size: 1rem;
    color: #f2f3f5;
  }

  .bot-tag {
    background-color: #5865f2;
    color: #ffffff;
    font-size: 0.625rem;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 15px;
    line-height: 1;
  }

  .bot-check {
    display: inline-block;
  }

  .timestamp {
    color: #949ba4;
    font-size: 0.75rem;
    font-weight: 500;
    margin-left: 2px;
  }

  .text-content {
    color: #dbdee1;
    font-size: 0.9375rem;
    word-wrap: break-word;
  }

  .text-content a {
    color: #00a8fc;
    text-decoration: none;
  }

  .text-content a:hover {
    text-decoration: underline;
  }

  .music-card {
    display: inline-flex;
    align-items: center;
    background-color: #2b2d31;
    border: 1px solid #1e1f22;
    border-radius: 6px;
    padding: 8px 12px;
    margin-top: 6px;
    gap: 8px;
    max-width: 100%;
  }

  .spotify-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .music-label {
    color: #dbdee1;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .music-title {
    color: #00a8fc;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
  }

  .music-title:hover {
    text-decoration: underline;
  }

  .embed-box {
    background-color: #2b2d31;
    border-radius: 4px;
    padding: 12px 16px;
    margin-top: 6px;
    max-width: 520px;
    border-left: 4px solid #1e1f22;
  }

  .embed-inner {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .embed-details {
    flex: 1;
  }

  .embed-title-header {
    color: #ffffff;
    font-weight: 700;
    font-size: 0.9375rem;
    margin-bottom: 8px;
  }

  .embed-field-label {
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 700;
    margin-top: 6px;
  }

  .embed-field-value-link a {
    color: #00a8fc;
    font-weight: 700;
    font-size: 0.875rem;
    text-decoration: none;
  }

  .embed-field-value-link a:hover {
    text-decoration: underline;
  }

  .embed-grid {
    display: flex;
    gap: 24px;
    margin-top: 8px;
  }

  .embed-field-value {
    color: #dbdee1;
    font-size: 0.875rem;
    margin-top: 2px;
  }

  .embed-thumb {
    width: 80px;
    height: 80px;
    border-radius: 4px;
    object-fit: cover;
  }

  .attachment img {
    max-width: 100%;
    max-height: 350px;
    border-radius: 8px;
    margin-top: 6px;
  }
</style>
</head>
<body>
  <div class="chat-container">
    ${msgsHtml}
  </div>
</body>
</html>`;
}

// ============================================================
// GERAR TXT
// ============================================================
function generateTxt(messages, channel, staffName, motivo, targetId, targetName) {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);

  const lines = [];
  lines.push('🧹 MENSAGENS APAGADAS');
  lines.push('================================');
  lines.push(`Canal: #${channel.name}`);
  lines.push(`Staff: ${staffName}`);
  lines.push(`Motivo: ${motivo}`);
  lines.push(`Alvo: ${targetId} (${targetName})`);
  lines.push(`Quantidade: ${sorted.length}`);
  lines.push(`Data: ${dateFormatterShort.format(new Date())}`);
  lines.push('================================\n');

  for (const msg of sorted) {
    const data = dateFormatter.format(msg.createdAt);
    const authorName = getDisplayName(msg);
    const discrim = getDiscriminator(msg.author);
    const content = getTxtContentRaw(msg);
    lines.push(`[${data}] ${authorName} (${discrim}): ${content}`);
  }

  return lines.join('\n');
}

// ============================================================
// CONFIRMAÇÃO
// ============================================================
async function askConfirmation(interaction, quantidade) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confirm_yes').setLabel('✅ Sim, apagar').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('confirm_no').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
  );
  await interaction.editReply({ content: `⚠️ **Confirmação**: Vais apagar **${quantidade}** mensagens. Esta ação é irreversível. Continuar?`, components: [row] });
  const filter = (i) => i.user.id === interaction.user.id;
  try {
    const collected = await interaction.channel.awaitMessageComponent({ filter, time: 30000 });
    await collected.deferUpdate();
    await interaction.editReply({ components: [] });
    return collected.customId === 'confirm_yes';
  } catch {
    await interaction.editReply({ content: '⏰ Tempo esgotado. Operação cancelada.', components: [] });
    return false;
  }
}

// ============================================================
// COMANDO PRINCIPAL
// ============================================================
export async function execute(interaction, client) {
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (err) {
    console.error('[Erro Crítico] Interação expirou antes de deferir.', err);
    return;
  }

  try {
    if (!interaction.member.permissions.has('ManageMessages')) {
      return interaction.editReply({ content: '❌ Precisas da permissão **Gerenciar Mensagens**.', flags: 64 });
    }

    const channel = interaction.channel;
    const botMember = channel.guild.members.me;
    if (!botMember.permissionsIn(channel).has(['ManageMessages', 'ReadMessageHistory'])) {
      return interaction.editReply({ content: '❌ O bot precisa das permissões **Gerenciar Mensagens** e **Ler Histórico de Mensagens** neste canal.', flags: 64 });
    }

    const targetUser = interaction.options.getUser('membro');
    const targetIdRaw = interaction.options.getString('alvo-id');
    let targetId, targetName;

    if (targetUser) { targetId = targetUser.id; targetName = targetUser.username; }
    else if (targetIdRaw) {
      if (!/^\d{17,19}$/.test(targetIdRaw)) return interaction.editReply({ content: '❌ O ID deve ser numérico e ter entre 17 e 19 dígitos.' });
      targetId = targetIdRaw;
      if (PRESET_IDS[targetId]) targetName = PRESET_IDS[targetId];
      else {
        try { const user = await client.users.fetch(targetId); targetName = user.username; }
        catch { targetName = 'Utilizador Desconhecido'; }
      }
    } else { targetId = DEFAULT_TARGET_ID; targetName = PRESET_IDS[targetId] || 'Alvo predefinido'; }

    if (targetId === client.user.id) return interaction.editReply({ content: '❌ Não podes apagar mensagens do próprio bot.' });

    const quantidade = interaction.options.getInteger('quantidade') || 50;
    const motivo = interaction.options.getString('motivo') || 'Limpeza de mensagens';
    const formato = interaction.options.getString('formato') || 'ambos';

    let collected = new Collection();
    let lastId = null;
    const maxFetch = Math.min(quantidade, 1000);
    while (collected.size < maxFetch) {
      const opts = { limit: Math.min(100, maxFetch - collected.size) };
      if (lastId) opts.before = lastId;
      const batch = await channel.messages.fetch(opts);
      if (batch.size === 0) break;
      collected = collected.concat(batch);
      lastId = batch.last().id;
    }

    const targetMessages = collected.filter(msg => msg.author.id === targetId);
    const totalFound = targetMessages.size;

    if (totalFound === 0) {
      let suggestion = '';
      const botCounts = new Map();
      for (const msg of collected.values()) {
        if (msg.author.bot && msg.author.id !== client.user.id) botCounts.set(msg.author.id, (botCounts.get(msg.author.id) || 0) + 1);
      }
      if (botCounts.size > 0) {
        const sorted = [...botCounts.entries()].sort((a, b) => b[1] - a[1]);
        suggestion = `\n💡 **Sugestão**: O bot com mais mensagens é <@${sorted[0][0]}> (${sorted[0][1]} mensagens).`;
      }
      return interaction.editReply({ content: `ℹ️ Nenhuma mensagem de <@${targetId}> (${targetName}) encontrada nas últimas ${collected.size} mensagens.${suggestion}` });
    }

    if (totalFound > 50) {
      if (!(await askConfirmation(interaction, totalFound))) return interaction.editReply({ content: '❌ Operação cancelada.' });
    }

    const now = Date.now();
    const bulkable = targetMessages.filter(m => (now - m.createdTimestamp) < 1209600000);
    const rest = targetMessages.filter(m => !bulkable.has(m.id));
    let deletedCount = 0, failedCount = 0;

    if (bulkable.size > 0) {
      try { const deleted = await channel.bulkDelete(bulkable, true); deletedCount += deleted.size; }
      catch { for (const msg of bulkable.values()) { try { await msg.delete(); deletedCount++; } catch { failedCount++; } } }
    }
    for (const msg of rest.values()) { try { await msg.delete(); deletedCount++; } catch { failedCount++; } }

    const msgArray = Array.from(targetMessages.values());
    const timestamp = Date.now();
    const safeChannelName = sanitizeFileName(channel.name);
    const baseName = `transcript-${safeChannelName}-${timestamp}`;
    const files = [];

    if (formato === 'html' || formato === 'ambos') {
      const html = generatePrettyHTML(msgArray, channel, interaction.user.username, motivo, targetId, targetName);
      files.push(new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `${baseName}.html` }));
    }
    if (formato === 'txt' || formato === 'ambos') {
      const txt = generateTxt(msgArray, channel, interaction.user.username, motivo, targetId, targetName);
      files.push(new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `${baseName}.txt` }));
    }

    const embed = new EmbedBuilder()
      .setTitle('🧹 Mensagens apagadas')
      .setDescription(`📊 **Quantidade:** ${deletedCount}${failedCount > 0 ? ` (${failedCount} falhas)` : ''}\n👤 **Alvo:** <@${targetId}>\n📅 **Data:** ${dateFormatterShort.format(new Date())}\n👮 **Staff:** <@${interaction.user.id}>\nℹ️ **Motivo:** ${motivo}`)
      .setColor(0xFF0000).setFooter({ text: 'Transcript gerado automaticamente' }).setTimestamp();
    await channel.send({ embeds: [embed], files });

    if (LOG_CHANNEL_ID) {
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('📝 Log de Limpeza')
          .setDescription(`**Staff:** <@${interaction.user.id}>\n**Canal:** #${channel.name}\n**Alvo:** <@${targetId}> (${targetName})\n**Mensagens apagadas:** ${deletedCount}\n**Motivo:** ${motivo}`)
          .setColor(0xFFA500).setTimestamp();
        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    await interaction.editReply({ content: `✅ ${deletedCount} mensagens apagadas. ${failedCount > 0 ? `(${failedCount} falhas)` : ''} Transcript(s) enviado(s) no canal.` });

  } catch (error) {
    console.error('[Apgrmsgbot] Erro:', error);
    try { await interaction.editReply({ content: `❌ Erro: ${error.message || 'tente novamente.'}` }); }
    catch { console.error('Não foi possível responder à interação.'); }
  }
}
