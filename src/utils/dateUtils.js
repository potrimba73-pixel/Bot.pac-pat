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

  if (mode === 'hour') return hourEmojis[index];
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

/**
 * Calcula a duração entre duas datas e formata como string
 * Exemplo: 2h 15m 30s
 * @param {Date|string} startDate - Data de início
 * @param {Date|string} endDate - Data de fim
 * @returns {string} Duração formatada
 */
export function formatDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = Math.abs(end - start);
  
  const diffSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  
  let result = '';
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  
  return result;
}
