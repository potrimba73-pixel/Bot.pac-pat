import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

const TRUCKY_API_BASE = "https://api.truckyapp.com";

export async function searchTruckyUserByName(name) {
  try {
    const res = await fetch(`${TRUCKY_API_BASE}/v2/search/player?name=${encodeURIComponent(name)}`, {
      headers: { "Accept": "application/json" },
      timeout: 10000
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.response && data.response.length > 0) return data.response[0];
    return null;
  } catch (e) {
    console.error("[Trucky Search] Erro:", e.message);
    return null;
  }
}

export async function getTruckyUserProfile(userId) {
  try {
    const res = await fetch(`${TRUCKY_API_BASE}/v2/player/${userId}`, {
      headers: { "Accept": "application/json" },
      timeout: 10000
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.response || null;
  } catch (e) {
    console.error("[Trucky Profile] Erro:", e.message);
    return null;
  }
}

export function createTruckyProfileEmbed(profile, nomeInserido) {
  const embed = new EmbedBuilder()
    .setColor(0x262af1)
    .setTitle(`${CONFIG.EMOJI_SUCCESS} Perfil Trucky Encontrado`)
    .setDescription(`Nome inserido: **${nomeInserido}**`)
    .addFields(
      { name: "👤 Nome", value: profile.name || "N/A", inline: true },
      { name: "🆔 ID", value: profile.id?.toString() || "N/A", inline: true },
      { name: "🔗 Perfil", value: `[Ver no Trucky](https://truckyapp.com/user/${profile.id})`, inline: false }
    )
    .setThumbnail(profile.avatar || null)
    .setTimestamp();

  if (profile.company) {
    embed.addFields({ name: "🏢 Companhia", value: `${profile.company.name} (${profile.company.tag})`, inline: true });
  }

  if (profile.stats) {
    embed.addFields({
      name: "📊 Estatisticas",
      value: `Distancia: ${profile.stats.distance?.toLocaleString("pt-PT") || 0} km\nEntregas: ${profile.stats.deliveries || 0}`,
      inline: true
    });
  }

  return embed;
}
