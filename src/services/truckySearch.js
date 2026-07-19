import { EmbedBuilder } from "discord.js";

const TRUCKY_API_BASE = "https://api.truckyapp.com/v2";

export async function searchTruckyUserByName(name) {
  try {
    const response = await fetch(
      `${TRUCKY_API_BASE}/search/player?query=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.response && data.response.length > 0) {
      const exactMatch = data.response.find(p => 
        p.name.toLowerCase() === name.toLowerCase()
      );
      return exactMatch || data.response[0];
    }
    return null;
  } catch (e) {
    console.error("[Trucky Search] Erro:", e.message);
    return null;
  }
}

export async function getTruckyUserProfile(userId) {
  try {
    const response = await fetch(
      `${TRUCKY_API_BASE}/player?playerID=${userId}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data.response || null;
  } catch (e) {
    console.error("[Trucky Profile] Erro:", e.message);
    return null;
  }
}

export function createTruckyProfileEmbed(profile, searchedName) {
  const p = profile;
  const embed = new EmbedBuilder()
    .setTitle(`🚛 Perfil Trucky: ${p.name || searchedName}`)
    .setURL(`https://truckyapp.com/user/${p.id || ""}`)
    .setColor(0x3498db)
    .setTimestamp();

  if (p.avatar) {
    embed.setThumbnail(p.avatar);
  }

  const fields = [];

  if (p.level !== undefined) {
    fields.push({ name: "Nivel", value: String(p.level), inline: true });
  }

  if (p.distanceDriven) {
    fields.push({ name: "Distancia", value: `${p.distanceDriven.toLocaleString("pt-PT")} km`, inline: true });
  }

  if (p.jobCount) {
    fields.push({ name: "Entregas", value: String(p.jobCount), inline: true });
  }

  if (p.playTime) {
    const hours = Math.floor(p.playTime / 60);
    fields.push({ name: "Horas de jogo", value: `${hours}h`, inline: true });
  }

  if (p.company) {
    fields.push({ 
      name: "Companhia", 
      value: `${p.company.name} (ID: ${p.company.id})`, 
      inline: false 
    });
  }

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  embed.setFooter({ text: `ID: ${p.id || "N/A"} | Pesquisado por: ${searchedName}` });

  return embed;
}
