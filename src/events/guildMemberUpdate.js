import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

// Cache para agrupar atualizações por membro
const pendingUpdates = new Map();

export async function handleGuildMemberUpdate(oldMember, newMember, client) {
  const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
  if (!logChannel) return;

  const memberId = newMember.id;
  const now = Date.now();

  // Se já existe um agendamento para este membro, cancelar e reagendar
  if (pendingUpdates.has(memberId)) {
    clearTimeout(pendingUpdates.get(memberId).timeout);
    pendingUpdates.delete(memberId);
  }

  // Acumular alterações
  const changes = {
    nickname: null,
    addedRoles: [],
    removedRoles: [],
    timestamp: now
  };

  // Verificar mudança de nickname
  if (oldMember.nickname !== newMember.nickname) {
    changes.nickname = {
      old: oldMember.nickname || "Nenhum",
      new: newMember.nickname || "Nenhum"
    };
  }

  // Verificar cargos adicionados
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  if (addedRoles.size > 0) {
    changes.addedRoles = Array.from(addedRoles.values());
  }

  // Verificar cargos removidos (opcional, mas mantido para consistência)
  const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
  if (removedRoles.size > 0) {
    changes.removedRoles = Array.from(removedRoles.values());
  }

  // Se não há alterações, sair
  if (!changes.nickname && changes.addedRoles.length === 0 && changes.removedRoles.length === 0) {
    return;
  }

  // Agendar envio do log consolidado (debounce de 500ms)
  const timeout = setTimeout(async () => {
    pendingUpdates.delete(memberId);

    // Construir descrição das alterações
    let description = `**Membro Atualizado**\n${newMember} foi atualizado.`;
    let changesText = "";

    if (changes.nickname) {
      changesText += `Nickname: **${changes.nickname.old}** → **${changes.nickname.new}**\n`;
    }

    if (changes.addedRoles.length > 0) {
      const rolesMentions = changes.addedRoles.map(r => `${r}`).join(" ");
      changesText += `➕ Cargos adicionados: ${rolesMentions}\n`;
    }

    if (changes.removedRoles.length > 0) {
      const rolesMentions = changes.removedRoles.map(r => `${r}`).join(" ");
      changesText += `➖ Cargos removidos: ${rolesMentions}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setDescription(description)
      .addFields(
        { name: "Alterações", value: changesText.trim(), inline: false }
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});
  }, 500);

  pendingUpdates.set(memberId, { timeout });
}
