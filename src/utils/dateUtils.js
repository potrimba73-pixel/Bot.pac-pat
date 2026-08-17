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
