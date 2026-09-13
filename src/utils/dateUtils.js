// src/utils/dateUtils.js

export function formatTimestamp(date) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  return Math.floor(ms / 1000);
}

export function formatDateFull(date) {
  const d = new Date(date);
  const weekday = d.toLocaleDateString('pt-PT', {
    weekday: 'long',
    timeZone: 'Europe/Lisbon'
  });
  return `${weekday}, <t:${formatTimestamp(d)}:S>`;
}

export function formatDateShort(date) {
  const d = new Date(date);
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Lisbon'
  });
}

export function formatDateSimple(date) {
  const d = new Date(date);
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Lisbon'
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

  if (minuto < 15) return hourEmojis[index];
  if (minuto < 45) return halfEmojis[index];
  index = (hora + 1) % 12;
  return hourEmojis[index];
}

/**
 * Calcula a duração entre duas datas e formata como string
 * Exemplo: 2h 15m 30s
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

/**
 * Retorna um emoji de relógio baseado na duração entre duas datas
 */
export function getDurationEmoji(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = Math.abs(end - start);
  const diffSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);

  const totalMinutes = (hours * 60) + minutes;

  const hourEmojis = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];
  const halfEmojis = ['🕧', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦'];

  const roundedMinutes = Math.round(totalMinutes / 15) * 15;
  const hour = Math.floor(roundedMinutes / 60) % 12;
  const minute = roundedMinutes % 60;

  if (minute === 0) return hourEmojis[hour];
  if (minute === 30) return halfEmojis[hour];
  if (minute === 15) return halfEmojis[hour];
  if (minute === 45) return hourEmojis[(hour + 1) % 12];
  return hourEmojis[hour];
}

/**
 * ✅ NOVO — Duração aproximada legível em português
 * Exemplo: "1 semana, 3 dias e 14 horas"
 */
export function formatDurationApprox(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = Math.abs(end - start);
  const totalMinutes = Math.floor(diffMs / 60000);

  const weeks = Math.floor(totalMinutes / (7 * 24 * 60));
  const days = Math.floor((totalMinutes % (7 * 24 * 60)) / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (weeks > 0) parts.push(`${weeks} semana${weeks !== 1 ? "s" : ""}`);
  if (days > 0) parts.push(`${days} dia${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hora${hours !== 1 ? "s" : ""}`);
  if (minutes > 0 && parts.length < 3)
    parts.push(`${minutes} minuto${minutes !== 1 ? "s" : ""}`);

  if (parts.length === 0) return "menos de 1 minuto";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}
