// src/utils/dateUtils.js

// Adiciona esta função no final do ficheiro
export function getDurationEmoji(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = Math.abs(end - start);
  const diffSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  
  // Mapeamento de duração para emojis de relógio
  // 0-15 min = 🕐, 15-45 min = 🕜, 45-75 min = 🕑, etc.
  const totalMinutes = (hours * 60) + minutes;
  
  const hourEmojis = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];
  const halfEmojis = ['🕧', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦'];
  
  // Arredonda para a hora/meia hora mais próxima
  const roundedMinutes = Math.round(totalMinutes / 15) * 15;
  const hour = Math.floor(roundedMinutes / 60) % 12;
  const minute = roundedMinutes % 60;
  
  if (minute === 0) {
    return hourEmojis[hour];
  } else if (minute === 30) {
    return halfEmojis[hour];
  } else if (minute === 15) {
    return halfEmojis[hour]; // aproxima para meia hora
  } else if (minute === 45) {
    return hourEmojis[(hour + 1) % 12]; // aproxima para a próxima hora
  }
  
  return hourEmojis[hour];
}

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
