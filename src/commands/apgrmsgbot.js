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
// FORMATADORES DE DATA
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
// AUXILIARES
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
// MARKDOWN DO DISCORD
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

// ============================================================
// RENDERIZADOR DE CONTEÚDO
// ============================================================
function renderMessageContentHTML(msg) {
  let html = '';

  if (msg.content) {
    html += `<div class="text-content">${renderMarkdown(msg.content)}</div>`;
  }

  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      const desc = embed.description || '';

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

      const color = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#202225';
      html += `
      <div class="embed-box" style="border-left-color: ${color};">
        ${embed.title ? `<div class="embed-title-header">${renderMarkdown(embed.title)}</div>` : ''}
        ${embed.description ? `<div class="text-content">${renderMarkdown(embed.description)}</div>` : ''}
      </div>`;
    }
  }

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
// GERADORES DE TRANSCRIPT
// ============================================================
function generatePrettyHTML(messages, channel, staffName, motivo, targetId, targetName) {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);

  const msgsHtml = sorted.map((msg) => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const data = dateFormatter.format(msg.createdAt);
    const authorName = getDisplayName(msg);
    const isBot = msg.author.bot;

    const botBadgeHtml = isBot ? `
      <span class="bot-tag">
        <svg class="bot-check" viewBox="0 0 16 15" width="10" height="10"><path fill="currentColor" d="M6 11L2 7l1.4-1.4L6 8.2l6.6-6.6L14 3z"/></svg>
        <span class="bot-text">APP</span>
      </span>` : '';

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
          ${renderMessageContentHTML(msg)}
        </div>
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Transcript - #${escapeHtml(channel.name)}</title>
<style>
  body { background-color: #111214; color: #dbdee1; font-family: sans-serif; padding: 20px; }
  .chat-message { display: flex; margin-bottom: 16px; }
  .user-avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 16px; }
  .username { font-weight: bold; color: #f2f3f5; }
  .timestamp { color: #949ba4; font-size: 0.75rem; margin-left: 6px; }
  .bot-tag { background-color: #5865f2; color: #fff; font-size: 0.6rem; padding: 1px 4px; border-radius: 3px; }
  .music-card { background: #2b2d31; padding: 8px; border-radius: 4px; margin-top: 4px; display: inline-block; }
  .embed-box { background: #2b2d31; border-left: 4px solid #1e1f22; padding: 10px; margin-top: 4px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="chat-container">${msgsHtml}</div>
</body>
</html>`;
}

function generateTxt(messages, channel, staffName, motivo, targetId, targetName) {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const lines = [
    '🧹 MENSAGENS APAGADAS',
    `Canal: #${channel.name}`,
    `Staff: ${staffName}`,
    `Motivo: ${motivo}`,
    `Alvo: ${targetId} (${targetName})`,
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
    let targetId, targetName;

    if (targetUser) {
      targetId = targetUser.id;
      targetName = targetUser.username;
    } else if (targetIdRaw) {
      if (!/^\d{17,19}$/.test(targetIdRaw)) {
        return interaction.editReply({ content: '❌ O ID deve ser numérico (17-19 dígitos).' });
      }
      targetId = targetIdRaw;
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
      targetId = DEFAULT_TARGET_ID;
      targetName = PRESET_IDS[targetId] || 'Alvo predefinido';
    }

    // PERMITE APAGAR: Removeu-se a restrição que impedia apagar se o targetId fosse igual ao bot que executa o comando.
    
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

    // Filtra as mensagens pelo ID pretendido (ex: 759343605726052392 ou outro)
    const targetMessages = collected.filter(msg => msg.author.id === targetId);
    const totalFound = targetMessages.size;

    if (totalFound === 0) {
      return interaction.editReply({ content: `ℹ️ Nenhuma mensagem de <@${targetId}> (${targetName}) encontrada nas últimas ${collected.size} mensagens.` });
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

    if (formato === 'html' || formato === 'ambos') {
      const html = generatePrettyHTML(msgArray, channel, interaction.user.username, motivo, targetId, targetName);
      files.push(new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `${baseName}.html` }));
    }
    if (formato === 'txt' || formato === 'ambos') {
      const txt = generateTxt(msgArray, channel, interaction.user.username, motivo, targetId, targetName);
      files.push(new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `${baseName}.txt` }));
    }

    const embed = new EmbedBuilder()
      .setTitle('🧹 Mensagens Apagadas')
      .setDescription(`📊 **Quantidade:** ${deletedCount}\n👤 **Alvo:** <@${targetId}> (${targetName})\n👮 **Staff:** <@${interaction.user.id}>\nℹ️ **Motivo:** ${motivo}`)
      .setColor(0xFF0000)
      .setTimestamp();

    await channel.send({ embeds: [embed], files });
    await interaction.editReply({ content: `✅ ${deletedCount} mensagens de <@${targetId}> apagadas com sucesso.` });

  } catch (error) {
    console.error('[Apgrmsgbot] Erro:', error);
    try {
      await interaction.editReply({ content: `❌ Erro ao executar a operação: ${error.message}` });
    } catch {
      console.error('Incapaz de responder à interação.');
    }
  }
}
