// src/utils/dateUtils.js

export function formatTimestamp(date) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  return Math.floor(ms / 1000);
}

export function formatDateFull(date) {
  const d = new Date(date);
  const weekday = d.toLocaleDateString('pt-PT', { weekday: 'long' });
  return `${weekday}, <t:${formatTimestamp(d)}:S>`;
}

export function formatDateShort(date) {
  const d = new Date(date);
  return d.toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

export function formatDateSimple(date) {
  const d = new Date(date);
  return d.toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/**
 * Retorna o emoji de relógio mais apropriado para a hora
 * @param {Date} date - Data a usar
 * @param {string} mode - 'hour' (hora cheia), 'half' (meia hora), 'nearest' (mais próxima)
 * @returns {string} Emoji de relógio
 */
export function getClockEmoji(date = new Date(), mode = 'half') {
  const formatter = new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Lisbon'
  });
  
  const parts = formatter.formatToParts(date);
  const hora = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minuto = parseInt(parts.find(p => p.type === 'minute').value, 10);

  const hourEmojis = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];
  const halfEmojis = ['🕧', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦'];

  let index = hora % 12;

  if (mode === 'hour') {
    return hourEmojis[index];
  }

  if (mode === 'nearest') {
    if (minuto < 15) return hourEmojis[index];
    if (minuto < 45) return halfEmojis[index];
    index = (hora + 1) % 12;
    return hourEmojis[index];
  }

  // mode === 'half' (padrão)
  if (minuto < 15) return hourEmojis[index];
  if (minuto < 45) return halfEmojis[index];
  index = (hora + 1) % 12;
  return hourEmojis[index];
}
