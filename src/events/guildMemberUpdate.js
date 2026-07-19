import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { sendExternalLog } from "../services/externalLogs.js";

const cooldowns = new Map();
const COOLDOWN_MS = 5000;

export default {
  name: "guildMemberUpdate",
  async execute(oldMember, newMember, client) {
    if (oldMember.guild.id !== CONFIG.GUILD_ID) return;

    const now = Date.now();
    const last = cooldowns.get(newMember.id);
    if (last && now - last < COOLDOWN_MS) return;
    cooldowns.set(newMember.id, now);

    const changes = [];

    // Nickname
    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`📝 Nickname: ${oldMember.nickname || newMember.user.username} → ${newMember.nickname || newMember.user.username}`);
    }

    // Cargos adicionados (filtrar "desconhecido")
    const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id) && !r.name.toLowerCase().includes("desconhecido"));
    if (added.size > 0) {
      const cargos = added.map(r => `<@&${r.id}>`).join(", ");
      changes.push(`➕ Cargos adicionados: ${cargos}`);
    }

    // Cargos removidos (filtrar "desconhecido")
    const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id) && !r.name.toLowerCase().includes("desconhecido"));
    if (removed.size > 0) {
      const cargos = removed.map(r => `<@&${r.id}>`).join(", ");
      changes.push(`➖ Cargos removidos: ${cargos}`);
    }

    // Avatar
    if (oldMember.user.displayAvatarURL() !== newMember.user.displayAvatarURL()) {
      changes.push(`🖼 Avatar alterado`);
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor(CONFIG.COLORS.INFO)
      .setTitle("📝 Membro Atualizado")
      .setDescription(`<@${newMember.id}> | ${newMember.user.tag} foi atualizado.\n\n**Alteracoes**\n${changes.join("\n")}`)
      .setThumbnail(newMember.user.displayAvatarURL())
      .setTimestamp();

    await sendExternalLog(client, embed);
  }
};
