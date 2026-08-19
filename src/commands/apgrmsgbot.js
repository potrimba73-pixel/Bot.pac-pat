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
// CONSTANTES E PRESETS DE IDS
// ============================================================
const PRESET_IDS = {
  '412347553141751808': 'Jockie Music (bot)',
  '759343605726052392': 'pt.jp lyaz',
  '770599668710637608': 'Utilizador 7705...',
  '456226577798135808': 'Utilizador 4562...',
};

const DEFAULT_TARGET_IDS = ['412347553141751808', '759343605726052392'];
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '';
const TIMEZONE = 'Europe/Lisbon';

// ============================================================
// UTILITÁRIOS
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
  if (!name) return 'canal';
  // Remove emojis e caracteres especiais mantendo apenas letras/números
  const cleaned = name.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned : 'canal';
}

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZone: TIMEZONE,
});

const dateFormatterShort = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  timeZone: TIMEZONE,
});

function getDisplayName(msg) {
  if (msg.member) return msg.member.displayName;
  if (msg.guild) {
    const member = msg.guild.members.cache.get(msg.author.id);
    if (member) return member.displayName;
  }
  return msg.author.globalName || msg.author.username;
}

// ============================================================
// PARSER DE MARKDOWN & WIDGET INTERATIVO SPOTIFY
// ============================================================
function renderMarkdown(text) {
  if (!text) return '';
  let processed = escapeHtml(text);

  // Emojis do Discord
  processed = processed.replace(/&lt;a?:([a-zA-Z0-9_]+):[0-9]+&gt;/g, ':$1:');

  // Links em Markdown [Texto](URL)
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Links simples
  processed = processed.replace(/(^|[^"])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');

  // Estilos de texto
  processed = processed.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  processed = processed.replace(/__([^_]+?)__/g, '<u>$1</u>');
  processed = processed.replace(/~~([^~]+?)~~/g, '<s>$1</s>');
  processed = processed.replace(/\n/g, '<br>');

  return processed;
}

function extractSpotifyEmbed(text) {
  if (!text) return null;
  const spotifyRegex = /https:\/\/open\.spotify\.com\/(playlist|track|album|artist)\/([a-zA-Z0-9]+)/;
  const match = text.match(spotifyRegex);
  if (!match) return null;
  
  const type = match[1]; // playlist, track, album, etc.
  const id = match[2];
  return { type, id, fullUrl: match[0] };
}

function renderMessageContentHTML(msg) {
  let html = '';
  const spotifyData = extractSpotifyEmbed(msg.content);

  if (msg.content) {
    let contentText = renderMarkdown(msg.content);
    html += `<div class="text-content">${contentText}</div>`;
  }

  // WIDGET INTERATIVO SPOTIFY
  if (spotifyData) {
    const embedUrl = `https://open.spotify.com/embed/${spotifyData.type}/${spotifyData.id}?utm_source=generator&theme=0`;
    html += `
    <div class="spotify-widget-container">
      <iframe 
        style="border-radius:12px;" 
        src="${embedUrl}" 
        width="100%" 
        height="152" 
        frameBorder="0" 
        allowfullscreen="" 
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
        loading="lazy">
      </iframe>
    </div>`;
  }

  // EMBEDS DO DISCORD (Ex: Jockie Music)
  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      const desc = embed.description || '';

      if (desc.toLowerCase().includes('started playing')) {
        const match = desc.match(/\[(.*?)\]\((.*?)\)/);
        const songTitle = match ? match[1] : desc.replace(/.*Started playing\s*/i, '');
        const songUrl = match ? match[2] : '#';

        const embedSpotify = extractSpotifyEmbed(songUrl);
        if (embedSpotify) {
          const embedUrl = `https://open.spotify.com/embed/${embedSpotify.type}/${embedSpotify.id}?utm_source=generator&theme=0`;
          html += `
          <div class="spotify-widget-container">
            <iframe style="border-radius:12px;" src="${embedUrl}" width="100%" height="80" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
          </div>`;
        } else {
          html += `
          <div class="music-card">
            <span class="music-icon">🎵</span>
            <span class="music-label">Started playing:</span>
            <a href="${escapeHtml(songUrl)}" target="_blank" class="music-title">${escapeHtml(songTitle)}</a>
          </div>`;
        }
        continue;
      }

      // Se o embed contiver link do Spotify mas não tiver acionado o iframe acima
      if (!spotifyData && embed.url && extractSpotifyEmbed(embed.url)) {
        const sp = extractSpotifyEmbed(embed.url);
        const embedUrl = `https://open.spotify.com/embed/${sp.type}/${sp.id}?utm_source=generator&theme=0`;
        html += `
        <div class="spotify-widget-container">
          <iframe style="border-radius:12px;" src="${embedUrl}" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
        </div>`;
        continue;
      }

      // Embed Padrão
      const color = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#2f3136';
      html += `
      <div class="embed-box" style="border-left: 4px solid ${color};">
        ${embed.title ? `<div class="embed-title">${renderMarkdown(embed.title)}</div>` : ''}
        ${embed.description ? `<div class="text-content">${renderMarkdown(embed.description)}</div>` : ''}
      </div>`;
    }
  }

  if (msg.attachments?.size) {
    for (const [, att] of msg.attachments) {
      if (att.contentType?.startsWith('image/')) {
        html += `<div class="attachment"><img src="${escapeHtml(att.url)}" alt="Anexo"></div>`;
      } else {
        html += `<div class="attachment"><a href="${escapeHtml(att.url)}" target="_blank">📎 ${escapeHtml(att.name)}</a></div>`;
      }
    }
  }

  return html || '<div class="text-content">(sem conteúdo)</div>';
}

function getTxtContentRaw(msg) {
  let parts = [];
  if (msg.content) parts.push(msg.content);
  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      if (embed.title) parts.push(embed.title);
      if (embed.description) parts.push(embed.description);
    }
  }
  if (msg.attachments?.size) {
    for (const [, att] of msg.attachments) parts.push(`📎 ${att.name} (${att.url})`);
  }
  return parts.join(' ').trim() || '(sem conteúdo)';
}

// ============================================================
// GERADOR HTML ESTILO DISCORD PRO
// ============================================================
function generatePrettyHTML(messages, channel, staffName, motivo, targetIdsStr, targetNamesStr) {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const guildName = channel.guild ? channel.guild.name : 'Servidor';
  const guildIcon = channel.guild?.iconURL({ extension: 'png', size: 64 }) || '';

  const msgsHtml = sorted.map((msg) => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const data = dateFormatter.format(msg.createdAt);
    const authorName = getDisplayName(msg);
    const isBot = msg.author.bot;

    const botBadge = isBot ? `
      <span class="bot-badge">BOT</span>
      <span class="app-badge">APP</span>` : '';

    return `
    <div class="message-card">
      <img class="avatar" src="${avatar}" alt="Avatar" loading="lazy">
      <div class="content">
        <div class="header">
          <span class="author">${escapeHtml(authorName)}</span>
          ${botBadge}
          <span class="time">${data}</span>
        </div>
        ${renderMessageContentHTML(msg)}
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mensagens apagadas - ${escapeHtml(guildName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background-color: #121316;
    color: #dcddde;
    font-family: 'Whitney', 'GG Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    display: flex;
    justify-content: center;
    padding: 30px 15px;
  }
  .container {
    width: 100%;
    max-width: 850px;
    background-color: #1e1f22;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    overflow: hidden;
    border: 1px solid #2b2d31;
  }
  .top-bar {
    background-color: #2b2d31;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid #1e1f22;
  }
  .server-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: #5865f2;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #fff;
    object-fit: cover;
  }
  .top-info h1 {
    font-size: 1.1rem;
    color: #fff;
    font-weight: 700;
  }
  .top-info p {
    font-size: 0.8rem;
    color: #949ba4;
    margin-top: 2px;
  }
  .chat-area {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .message-card {
    background-color: #2b2d31;
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    gap: 14px;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .content { flex: 1; overflow: hidden; }
  .header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .author { font-weight: 600; color: #5865f2; font-size: 0.95rem; }
  .bot-badge {
    background-color: #5865f2;
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .app-badge {
    background-color: #4752c4;
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .time { color: #949ba4; font-size: 0.75rem; margin-left: auto; }
  .text-content { color: #dbdee1; font-size: 0.9rem; word-break: break-word; }
  .text-content a { color: #00a8fc; text-decoration: none; }
  .text-content a:hover { text-decoration: underline; }
  
  .spotify-widget-container {
    margin-top: 8px;
    max-width: 100%;
    border-radius: 12px;
    overflow: hidden;
    background: #000;
  }

  .music-card {
    background: #1e1f22;
    padding: 8px 12px;
    border-radius: 6px;
    margin-top: 6px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .music-title { color: #00a8fc; font-weight: 600; text-decoration: none; font-size: 0.85rem; }
  .embed-box { background: #1e1f22; padding: 10px; margin-top: 6px; border-radius: 4px; }
  
  .footer-bar {
    background-color: #2b2d31;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #1e1f22;
    font-size: 0.8rem;
    color: #949ba4;
  }
  .badges { display: flex; gap: 10px; }
  .badge {
    background-color: #1e1f22;
    padding: 4px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="top-bar">
      ${guildIcon ? `<img src="${guildIcon}" class="server-icon" alt="Icon">` : `<div class="server-icon">${escapeHtml(guildName[0])}</div>`}
      <div class="top-info">
        <h1>Mensagens apagadas</h1>
        <p>Servidor: <strong>${escapeHtml(guildName)}</strong> • Canal: <strong>#${escapeHtml(channel.name)}</strong> • Staff: <strong>${escapeHtml(staffName)}</strong> • Alvo: <strong>${escapeHtml(targetNamesStr)}</strong> • Data: <strong>${dateFormatterShort.format(new Date())}</strong></p>
      </div>
    </div>
    <div class="chat-area">
      ${msgsHtml}
    </div>
    <div class="footer-bar">
      <div class="badges">
        <div class="badge">📊 ${sorted.length} mensagem(ns)</div>
        <div class="badge">👤 Alvo: &lt;@${escapeHtml(targetIdsStr)}&gt;</div>
      </div>
      <div>Transcript gerado automaticamente • ${dateFormatterShort.format(new Date())}</div>
    </div>
  </div>
</body>
</html>`;
}

function generateTxt(messages, channel, staffName, motivo, targetNamesStr) {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const lines = [
    '🧹 MENSAGENS APAGADAS',
    `Canal: #${channel.name}`,
    `Staff: ${staffName}`,
    `Motivo: ${motivo}`,
    `Alvo(s): ${targetNamesStr}`,
    `Quantidade: ${sorted.length}`,
    '================================\n'
  ];

  for (const msg of sorted) {
    const data = dateFormatter.format(msg.createdAt);
    const authorName = getDisplayName(msg);
    lines.push(`[${data}] ${authorName}: ${getTxtContentRaw(msg)}`);
  }

  return lines.join('\n');
}

// ============================================================
// COMANDO PRINCIPAL
// ============================================================
export async function execute(interaction, client) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }
  } catch (err) {
    console.error('[Apgrmsgbot] Erro ao diferir interação:', err);
    return;
  }

  try {
    if (!interaction.member.permissions.has('ManageMessages')) {
      return interaction.editReply({ content: '❌ Precisas da permissão **Gerenciar Mensagens**.' });
    }

    const channel = interaction.channel;
    const targetUser = interaction.options.getUser('membro');
    const targetIdRaw = interaction.options.getString('alvo-id');
    
    let targetIds = [];
    let targetNames = [];

    if (targetUser) {
      targetIds.push(targetUser.id);
      targetNames.push(targetUser.username);
    } else if (targetIdRaw) {
      const parsedIds = targetIdRaw.split(/[, ]+/).filter(id => /^\d{17,19}$/.test(id));
      if (parsedIds.length === 0) {
        return interaction.editReply({ content: '❌ O(s) ID(s) deve(m) ser numérico(s) com 17-19 dígitos.' });
      }
      targetIds = parsedIds;
      for (const id of targetIds) {
        if (PRESET_IDS[id]) {
          targetNames.push(PRESET_IDS[id]);
        } else {
          try {
            const user = await client.users.fetch(id);
            targetNames.push(user.username);
          } catch {
            targetNames.push(`ID: ${id}`);
          }
        }
      }
    } else {
      targetIds = DEFAULT_TARGET_IDS;
      targetNames = DEFAULT_TARGET_IDS.map(id => PRESET_IDS[id] || id);
    }

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

    const targetMessages = collected.filter(msg => targetIds.includes(msg.author.id));
    const totalFound = targetMessages.size;

    if (totalFound === 0) {
      return interaction.editReply({ content: `ℹ️ Nenhuma mensagem dos alvos selecionados (${targetNames.join(', ')}) encontrada nas últimas ${collected.size} mensagens.` });
    }

    const now = Date.now();
    const bulkable = targetMessages.filter(m => (now - m.createdTimestamp) < 1209600000);
    const rest = targetMessages.filter(m => !bulkable.has(m.id));
    let deletedCount = 0, failedCount = 0;

    if (bulkable.size > 0) {
      try {
        const deleted = await channel.bulkDelete(bulkable, true);
        deletedCount += deleted.size;
      } catch {
        for (const msg of bulkable.values()) {
          try { await msg.delete(); deletedCount++; } catch { failedCount++; }
        }
      }
    }

    for (const msg of rest.values()) {
      try { await msg.delete(); deletedCount++; } catch { failedCount++; }
    }

    const msgArray = Array.from(targetMessages.values());
    const timestamp = Date.now();
    const safeChannelName = sanitizeFileName(channel.name);
    const baseName = `transcript-${safeChannelName}-${timestamp}`;
    const files = [];

    const targetIdsStr = targetIds.join(', ');
    const targetNamesStr = targetNames.join(', ');

    if (formato === 'html' || formato === 'ambos') {
      const html = generatePrettyHTML(msgArray, channel, interaction.user.username, motivo, targetIdsStr, targetNamesStr);
      files.push(new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `${baseName}.html` }));
    }
    if (formato === 'txt' || formato === 'ambos') {
      const txt = generateTxt(msgArray, channel, interaction.user.username, motivo, targetNamesStr);
      files.push(new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `${baseName}.txt` }));
    }

    const embed = new EmbedBuilder()
      .setTitle('🧹 Mensagens Apagadas')
      .setDescription(`📊 **Quantidade:** ${deletedCount}\n👤 **Alvo(s):** ${targetNamesStr}\n👮 **Staff:** <@${interaction.user.id}>\nℹ️ **Motivo:** ${motivo}`)
      .setColor(0x5865F2)
      .setTimestamp();

    await channel.send({ embeds: [embed], files });
    await interaction.editReply({ content: `✅ ${deletedCount} mensagens apagadas com sucesso.` });

  } catch (error) {
    console.error('[Apgrmsgbot] Erro:', error);
    try {
      await interaction.editReply({ content: `❌ Erro ao executar a operação: ${error.message}` });
    } catch {
      console.error('Incapaz de responder à interação.');
    }
  }
}
