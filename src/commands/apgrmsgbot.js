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
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZone: TIMEZONE,
});

const dateFormatterShort = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  timeZone: TIMEZONE,
});

// ============================================================
// [NOVA FUNÇÃO] CONVERTE MARKDOWN DO DISCORD DIRETAMENTE PARA HTML
// ============================================================
function renderMarkdown(text) {
  if (!text) return '';

  let processed = text;

  // 1. Substituir emojis personalizados do Discord (ex: <:spotify:837...>) por texto para evitar imagens quebradas no HTML
  processed = processed.replace(/<a?:([a-zA-Z0-9_]+):[0-9]+>/g, ':$1:');

  // 2. Processar Links do Discord [texto](url) primeiro
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, textContent, url) => {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(textContent)}</a>`;
  });

  // 3. Links soltos (https://...) que não estão em formato [](url)
  processed = processed.replace(/(https?:\/\/[^\s]+)/g, (match) => {
    return `<a href="${escapeHtml(match)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match)}</a>`;
  });

  // 4. Negrito **texto**
  processed = processed.replace(/\*\*([^*]+?)\*\*/g, (match, p1) => `<strong>${escapeHtml(p1)}</strong>`);
  
  // 5. Itálico *texto*
  processed = processed.replace(/\*([^*]+?)\*/g, (match, p1) => `<em>${escapeHtml(p1)}</em>`);

  // 6. Sublinhado __texto__
  processed = processed.replace(/__([^_]+?)__/g, (match, p1) => `<u>${escapeHtml(p1)}</u>`);

  // 7. Riscado ~~texto~~
  processed = processed.replace(/~~([^~]+?)~~/g, (match, p1) => `<s>${escapeHtml(p1)}</s>`);

  // 8. Quebras de linha
  processed = processed.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');

  return processed;
}

// ============================================================
// FUNÇÕES DE EXTRAÇÃO DE TEXTO
// ============================================================

// [PARA HTML] Extrai e organiza o conteúdo, removendo formatações de link cruas para o HTML
function getMessageText(msg) {
  const isJockie = msg.author.id === '412347553141751808';
  let text = msg.content || '';

  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      // --- Playlist ---
      if (
        embed.title?.toLowerCase().includes('playlist') ||
        embed.fields?.some(f => f.name?.toLowerCase().includes('playlist'))
      ) {
        let playlistName = '', tracks = '', length = '';
        for (const field of embed.fields || []) {
          const fname = field.name.toLowerCase();
          if (fname.includes('playlist')) playlistName = field.value;
          else if (fname.includes('tracks')) tracks = field.value;
          else if (fname.includes('length') || fname.includes('duração')) length = field.value;
        }
        if (!playlistName && embed.description) {
          const lines = embed.description.split('\n');
          for (const line of lines) {
            if (line.includes('Playlist') && !line.includes('Length')) playlistName = line.replace('Playlist', '').trim();
            if (line.includes('Tracks')) tracks = line.replace(/.*Tracks\s*/, '').trim();
            if (line.includes('Length')) length = line.replace(/.*Length\s*/, '').trim();
          }
        }
        let result = '📋 **Added Playlist**';
        if (playlistName) result += `\n**Playlist:** ${playlistName}`;
        if (tracks) result += `\n**Tracks:** ${tracks}`;
        if (length) result += `\n**Length:** ${length}`;
        if (embed.url) result += `\n🔗 ${embed.url}`;
        text += (text ? '\n' : '') + result;
        continue;
      }

      // --- Música ---
      if (
        embed.url?.includes('spotify.com') || embed.provider?.name === 'Spotify' ||
        (isJockie && (embed.title || embed.description)) ||
        embed.description?.toLowerCase().includes('started playing')
      ) {
        let lines = [];
        if (embed.description) {
          const descLines = embed.description.split('\n').map(s => s.trim()).filter(Boolean);
          const hasStartedPlaying = descLines.some(line => /^[-•*]\s*Started playing/i.test(line));

          if (hasStartedPlaying) {
            for (const line of descLines) {
              const match = line.match(/^[-•*]\s*Started playing\s+(.+?)\s+by\s+(.+)/i);
              if (match) {
                lines.push(`- Started playing **${match[1].trim()}** by **${match[2].trim()}**`);
              } else {
                lines.push(line);
              }
            }
          } else {
            let title = embed.title || '';
            let artist = '';
            const byMatch = embed.description.match(/by\s+(.+)/i);
            if (byMatch) artist = byMatch[1].trim();
            else {
              const parts = embed.description.split(/[•\-]/).map(s => s.trim());
              if (parts.length >= 2) artist = parts[1];
              else artist = embed.description;
            }
            if (!artist && embed.author?.name) artist = embed.author.name;
            if (!artist && title.includes('-')) {
              const parts = title.split('-').map(s => s.trim());
              if (parts.length === 2) { title = parts[0]; artist = parts[1]; }
            }
            if (!title && msg.content) title = msg.content;
            let result = `🎵 **${title}**`;
            if (artist) result += ` por **${artist}**`;
            if (embed.url) result += `\n🔗 ${embed.url}`;
            lines.push(result);
          }
        } else {
          let title = embed.title || '';
          let artist = '';
          if (embed.author?.name) artist = embed.author.name;
          let result = `🎵 **${title}**`;
          if (artist) result += ` por ${artist}`;
          if (embed.url) result += `\n🔗 ${embed.url}`;
          lines.push(result);
        }
        if (lines.length) text += (text ? '\n' : '') + lines.join('\n');
        continue;
      }

      // --- Outros Embeds ---
      let parts = [];
      if (embed.title) parts.push(`**${embed.title}**`);
      if (embed.description) parts.push(embed.description);
      if (embed.fields) for (const field of embed.fields) parts.push(`**${field.name}:** ${field.value}`);
      if (embed.url) parts.push(`🔗 ${embed.url}`);
      if (embed.author?.name) parts.push(`Por ${embed.author.name}`);
      if (embed.footer?.text) parts.push(embed.footer.text);
      if (parts.length) text += (text ? '\n' : '') + parts.join('\n');
    }
  }

  if (!text && isJockie && msg.content) text = msg.content;
  if (msg.attachments?.size) for (const [, att] of msg.attachments) text += (text ? '\n' : '') + `📎 ${att.name} (${att.url})`;
  if (msg.stickers?.size) for (const sticker of msg.stickers.values()) text += (text ? '\n' : '') + `🖼️ Sticker: ${sticker.name}`;

  return text || '(sem conteúdo)';
}

// [PARA TXT] Extrai o texto CRU exatamente como aparece no Discord, sem processar Markdown ou Links
function getTxtContent(msg) {
  const isJockie = msg.author.id === '412347553141751808';
  let parts = [];

  // 1. Adicionar o conteúdo de texto puro
  if (msg.content) parts.push(msg.content);

  // 2. Processar os Embeds de forma CRUA
  if (msg.embeds?.length) {
    for (const embed of msg.embeds) {
      // Se for o Jockie, preservamos a descrição original que contém [**Título**](URL)
      if (isJockie) {
        if (embed.description) parts.push(embed.description);
        if (embed.url && !embed.description?.includes(embed.url)) {
          parts.push(embed.url);
        }
        continue; // Não processa os outros campos do embed para o Jockie, para não duplicar
      }

      // Para outros bots ou embeds normais, concatena tudo sem escapar
      if (embed.title) parts.push(embed.title);
      if (embed.description) parts.push(embed.description);
      if (embed.fields) {
        for (const field of embed.fields) {
          parts.push(`**${field.name}:** ${field.value}`);
        }
      }
      if (embed.url) parts.push(embed.url);
      if (embed.author?.name) parts.push(`Por ${embed.author.name}`);
      if (embed.footer?.text) parts.push(embed.footer.text);
    }
  }

  // 3. Anexos e Stickers
  if (msg.attachments?.size) {
    for (const [, att] of msg.attachments) {
      parts.push(`📎 ${att.name} (${att.url})`);
    }
  }
  if (msg.stickers?.size) {
    for (const sticker of msg.stickers.values()) {
      parts.push(`🖼️ Sticker: ${sticker.name}`);
    }
  }

  return parts.join(' ').trim() || '(sem conteúdo)';
}

// ============================================================
// GERAR HTML
// ============================================================
function generatePrettyHTML(messages, channel, staffName, motivo, targetId, targetName) {
  const guild = channel.guild;
  const guildName = guild?.name || 'Servidor Desconhecido';
  const channelName = channel.name;
  const guildIcon = guild?.iconURL({ dynamic: true, size: 64 }) || '';
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);

  const msgsHtml = sorted.map((msg, index) => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
    const data = dateFormatter.format(msg.createdAt);
    const rawText = getMessageText(msg);
    const texto = renderMarkdown(rawText);

    const hue = (parseInt(msg.author.id.slice(0, 6), 16) % 360);
    const authorColor = msg.author.bot ? '#5865F2' : `hsl(${hue}, 70%, 55%)`;
    const botBadge = msg.author.bot ? '<span class="bot-badge">BOT</span>' : '';
    const appBadge = msg.author.bot ? '<span class="app-badge">APP</span>' : '';
    const rowClass = index % 2 === 0 ? 'message' : 'message alt';

    return `
    <div class="${rowClass}">
      <img class="avatar" src="${avatar}" alt="Avatar" loading="lazy">
      <div class="content">
        <div class="header">
          <span class="author" style="color: ${authorColor};">${escapeHtml(msg.author.username)}</span>
          ${botBadge} ${appBadge}
          <span class="time">${data}</span>
        </div>
        <div class="text">${texto}</div>
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Transcript - Limpeza</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1e1f22; color: #dbdee1; font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; line-height: 1.6; }
  .container { max-width: 900px; margin: 0 auto; background: #2b2d31; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .header { background: #1e1f22; padding: 20px 24px; border-bottom: 1px solid #3a3c42; display: flex; align-items: center; gap: 16px; }
  .header .guild-icon { width: 48px; height: 48px; border-radius: 50%; background: #2b2d31; border: 2px solid #3a3c42; object-fit: cover; }
  .header .info { flex: 1; }
  .header h1 { color: #ffffff; font-size: 20px; font-weight: 600; margin: 0; }
  .header p { color: #949ba4; font-size: 13px; margin: 4px 0 0; }
  .header p strong { color: #dbdee1; font-weight: 600; }
  .messages { padding: 12px 16px; }
  .message { display: flex; gap: 14px; padding: 10px 12px; border-radius: 6px; transition: background 0.15s; }
  .message.alt { background: rgba(255,255,255,0.03); }
  .message:hover { background: rgba(255,255,255,0.05); }
  .avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; border: 1px solid #3a3c42; }
  .content { flex: 1; min-width: 0; }
  .header { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; }
  .header .author { font-weight: 600; font-size: 15px; margin-right: 4px; }
  .bot-badge { background: #5865f2; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
  .app-badge { background: #3ba55d; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
  .header .time { color: #72767d; font-size: 12px; font-weight: 400; margin-left: auto; }
  .text { margin-top: 4px; font-size: 14px; white-space: pre-wrap; word-wrap: break-word; color: #dbdee1; }
  .text a { color: #00a8fc; text-decoration: none; }
  .text a:hover { text-decoration: underline; }
  .text br + br { display: block; content: ''; margin-top: 4px; }
  .footer { background: #1e1f22; padding: 16px 24px; border-top: 1px solid #3a3c42; text-align: center; color: #72767d; font-size: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .footer .stats { display: flex; gap: 16px; color: #949ba4; }
  .footer .stats span { background: #2b2d31; padding: 2px 10px; border-radius: 12px; font-size: 11px; }
  @media (max-width: 600px) { .header { flex-direction: column; align-items: flex-start; } .header .time { margin-left: 0; } .message { padding: 8px 8px; gap: 10px; } .avatar { width: 36px; height: 36px; } }
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
        <strong>Data:</strong> ${dateFormatterShort.format(new Date())}
      </p>
    </div>
  </div>
  <div class="messages">
    ${msgsHtml}
  </div>
  <div class="footer">
    <div class="stats">
      <span>📊 ${sorted.length} mensagens</span>
      <span>👤 Alvo: <@${targetId}></span>
    </div>
    <div>Transcript gerado automaticamente • ${dateFormatterShort.format(new Date())}</div>
  </div>
</div>
</body>
</html>`;
}

// ============================================================
// GERAR TXT (COM O FORMATO EXATO QUE VOCÊ PEDIU)
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
    const text = getTxtContent(msg);
    lines.push(`[${data}] ${msg.author.username}: ${text}`);
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
  if (!interaction.member.permissions.has('ManageMessages')) {
    return interaction.reply({ content: '❌ Precisas da permissão **Gerenciar Mensagens**.', flags: 64 });
  }

  const channel = interaction.channel;
  const botMember = channel.guild.members.me;
  if (!botMember.permissionsIn(channel).has(['ManageMessages', 'ReadMessageHistory'])) {
    return interaction.reply({ content: '❌ O bot precisa das permissões **Gerenciar Mensagens** e **Ler Histórico de Mensagens** neste canal.', flags: 64 });
  }

  // ============================================================
  // Prevenir erro 10062: Defer reply IMEDIATAMENTE
  // ============================================================
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (err) {
    console.error('[Erro Crítico] Interação expirou antes de deferir:', err);
    return; 
  }

  try {
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
