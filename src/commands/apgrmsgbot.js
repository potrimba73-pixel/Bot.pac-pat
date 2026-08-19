// src/commands/apgrmsgbot.js
import {
  EmbedBuilder,
  AttachmentBuilder,
  Collection,
} from 'discord.js';

// ============================================================
// CONSTANTES E PRESETS DE IDS
// ============================================================
const PRESET_IDS = {
  '412347553141751808': 'Jockie Music',
  '759343605726052392': 'pt.jp lyaz',
  '770599668710637608': 'Utilizador 7705...',
  '456226577798135808': 'Utilizador 4562...',
};

// Obtém automaticamente todos os IDs do objeto acima
const DEFAULT_TARGET_IDS = Object.keys(PRESET_IDS);
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
  const cleaned = name.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned : 'canal';
}

function stripMarkdown(text) {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/~~/g, '');
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
// PARSER DE MARKDOWN & SPOTIFY
// ============================================================
function renderMarkdown(text) {
  if (!text) return '';
  let processed = escapeHtml(text);

  processed = processed.replace(/&lt;a?:([a-zA-Z0-9_]+):[0-9]+&gt;/g, ':$1:');
  processed = processed.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  processed = processed.replace(/(^|[^"])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
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
  
  return { type: match[1], id: match[2], fullUrl: match[0] };
}

function renderMessageContentHTML(msg) {
  let html = '';
  const spotifyData = extractSpotifyEmbed(msg.content);

  if (msg.content) {
    // Remover o emoji do Spotify e limpar o texto
    let contentText = msg.content.replace(/<:spotify:[0-9]+>/g, '').trim();
    contentText = renderMarkdown(contentText);
    html += `<div class="text-content">${contentText}</div>`;
  }

  // Widget Interativo para links diretos de utilizadores
  if (spotifyData && !msg.author.bot) {
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

  // Embeds do Bot (Jockie Music)
  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      const desc = embed.description || '';

      // Caixa "Started playing" estilizada
      if (desc.toLowerCase().includes('started playing')) {
        const match = desc.match(/\[(.*?)\]\((.*?)\)/);
        let songTitle = match ? match[1] : desc.replace(/.*Started playing\s*/i, '');
        const songUrl = match ? match[2] : '#';

        // Remover asteriscos (markdown) do título/artista
        songTitle = stripMarkdown(songTitle);

        html += `
        <div class="spotify-started-card">
          <svg class="spotify-logo" viewBox="0 0 24 24" width="20" height="20" fill="#1DB954">
            <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm5.521 17.341c-.217.357-.68.472-1.038.254-2.842-1.737-6.42-2.13-10.635-1.166-.402.093-.802-.16-.894-.562-.093-.403.16-.803.562-.895 4.616-1.055 8.567-.603 11.748 1.341.358.217.472.68.257 1.038zm1.472-3.272c-.273.444-.853.585-1.296.312-3.251-1.998-8.21-2.58-12.057-1.411-.5.152-1.026-.134-1.177-.633-.152-.5.134-1.027.633-1.178 4.402-1.336 9.882-.69 13.585 1.583.444.273.585.853.312 1.327zm.144-3.41c-3.899-2.315-10.334-2.528-14.1-1.385-.6.183-1.237-.16-1.42-.76-.183-.601.16-1.238.76-1.421 4.318-1.311 11.42-1.06 15.86 1.576.54.321.718 1.021.398 1.56-.322.541-1.021.718-1.498.43z"/>
          </svg>
          <span class="started-text">Started playing</span>
          <a href="${escapeHtml(songUrl)}" target="_blank" class="started-link">${escapeHtml(songTitle)}</a>
        </div>`;
        continue;
      }

      // Embed genérico
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
  if (msg.content) parts.push(stripMarkdown(msg.content));
  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      if (embed.title) parts.push(stripMarkdown(embed.title));
      if (embed.description) parts.push(stripMarkdown(embed.description));
    }
  }
  if (msg.attachments?.size) {
    for (const [, att] of msg.attachments) parts.push(`📎 ${att.name} (${att.url})`);
  }
  return parts.join(' ').trim() || '(sem conteúdo)';
}

// ============================================================
// GERADOR HTML ESTILO DISCORD DARK
// ============================================================
function generatePrettyHTML(messages, channel, staffName, motivo, targetIdsStr, targetNamesStr) {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const guildName = channel.guild ? channel.guild.name : 'Servidor';
  const guildIcon = channel.guild?.iconURL({ extension: 'png', size: 64 }) || '';

  const msgsHtml = sorted.map((msg) => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const data = dateFormatter.format(msg.createdAt);
    
    // Garantir que o nome não venha como a palavra genérica "BOT"
    let authorName = getDisplayName(msg);
    if ((authorName.toUpperCase() === 'BOT' || !authorName) && PRESET_IDS[msg.author.id]) {
      authorName = PRESET_IDS[msg.author.id];
    }

    const isBot = msg.author.bot;

    // Apenas a tag azul APP
    const appBadge = isBot ? `
      <span class="app-badge">
        <svg class="check-icon" viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
        </svg>
        APP
      </span>` : '';

    return `
    <div class="message-card">
      <img class="avatar" src="${avatar}" alt="Avatar" loading="lazy">
      <div class="content">
        <div class="header">
          <span class="author ${isBot ? 'bot-author' : ''}">${escapeHtml(authorName)}</span>
          ${appBadge}
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
  .bot-author { color: #57F287; }
  
  .app-badge {
    background-color: #5865f2;
    color: #fff;
    font-size: 0.62rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .check-icon { display: inline-block; }

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

  .spotify-started-card {
    background: #111214;
    border: 1px solid #2b2d31;
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    width: fit-content;
    max-width: 100%;
  }
  .spotify-logo { flex-shrink: 0; }
  .started-text { color: #dbdee1; font-size: 0.88rem; font-weight: 500; }
  .started-link { color: #00a8fc; font-weight: 700; text-decoration: none; font-size: 0.88rem; }
  .started-link:hover { text-decoration: underline; }

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
    let authorName = getDisplayName(msg);
    if ((authorName.toUpperCase() === 'BOT' || !authorName) && PRESET_IDS[msg.author.id]) {
      authorName = PRESET_IDS[msg.author.id];
    }
    lines.push(`[${data}] ${authorName}: ${getTxtContentRaw(msg)}`);
  }

  return lines.join('\n');
}

// ============================================================
// COMANDO PRINCIPAL
// ============================================================
export async function execute(interaction, client) {
  // Prevenção segura do erro 40060 (Interaction has already been acknowledged)
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ flags: 64 });
    }
  } catch (err) {
    // Caso a interação já tenha sido respondida pelo framework
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

// ============================================================
// BUSCA E FILTRAGEM CORRIGIDA
// ============================================================
const quantidadeDesejada = interaction.options.getInteger('quantidade') || 50;
const motivo = interaction.options.getString('motivo') || 'Limpeza de mensagens';
const formato = interaction.options.getString('formato') || 'ambos';

let targetMessages = new Collection();
let lastId = null;
let totalLidas = 0;
const MAX_MENSAGENS_PARA_LER = 1000; // Limite de segurança para não bloquear o bot em canais gigantes

// Procura mensagens no histórico ATÉ atingir a quantidade desejada do alvo
while (targetMessages.size < quantidadeDesejada && totalLidas < MAX_MENSAGENS_PARA_LER) {
  const opts = { limit: 100 };
  if (lastId) opts.before = lastId;

  const batch = await channel.messages.fetch(opts);
  if (batch.size === 0) break; // Chegou ao fim do histórico do canal

  totalLidas += batch.size;
  lastId = batch.last().id;

  // Filtra apenas as mensagens dos alvos
  const filtradas = batch.filter(msg => targetIds.includes(msg.author.id));

  for (const [id, msg] of filtradas) {
    if (targetMessages.size < quantidadeDesejada) {
      targetMessages.set(id, msg);
    } else {
      break;
    }
  }
}

const totalFound = targetMessages.size;

if (totalFound === 0) {
  return interaction.editReply({ 
    content: `ℹ️ Nenhuma mensagem dos alvos selecionados (${targetNames.join(', ')}) foi encontrada nas últimas ${totalLidas} mensagens lidas.` 
  });
}

    const now = Date.now();
    const bulkable = targetMessages.filter(m => (now - m.createdTimestamp) < 1209600000);
    const rest = targetMessages.filter(m => !bulkable.has(m.id));
    let deletedCount = 0;

    if (bulkable.size > 0) {
      try {
        const deleted = await channel.bulkDelete(bulkable, true);
        deletedCount += deleted.size;
      } catch {
        for (const msg of bulkable.values()) {
          try { await msg.delete(); deletedCount++; } catch {}
        }
      }
    }

    for (const msg of rest.values()) {
      try { await msg.delete(); deletedCount++; } catch {}
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
    } catch {}
  }
}
