import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

// Define aqui o ID do teu cargo de regras (substitui pelo ID real)
const ID_CARGO_REGRAS = "1534970663344017479"; 

export async function handleGuildMemberUpdate(oldMember, newMember, client) {
  const logChannel = await newMember.guild.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
  if (!logChannel) return;

  // Comparação para detetar cargos adicionados
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));

  if (addedRoles.size > 0) {
    const aceitouRegras = addedRoles.has(ID_CARGO_REGRAS);
    
    // Mapeia os cargos para menções diretas (evita o erro "@cargo desconhecido")
    const rolesList = addedRoles.map(r => `${r}`).join(" e ");

    // Se aceitou as regras, mostra o título personalizado, senão mostra "Membro Atualizado"
    const titulo = aceitouRegras ? "📝 Regras aceites ✅" : "📝 Membro Atualizado";

    const embed = new EmbedBuilder()
      .setColor(0x57F287) // Cor Verde
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setTitle(titulo)
      .setDescription(`${newMember} foi atualizado.`)
      .addFields(
        { 
          name: "Alterações", 
          value: `➕ **Cargos adicionados:** ${rolesList}`, 
          inline: false 
        }
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();

    return logChannel.send({ embeds: [embed] });
  }

  // Comparação para detetar cargos removidos
  const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

  if (removedRoles.size > 0) {
    const rolesList = removedRoles.map(r => `${r}`).join(" e ");

    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Cor Vermelha
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setTitle("📝 Membro Atualizado")
      .setDescription(`${newMember} foi atualizado.`)
      .addFields(
        { 
          name: "Alterações", 
          value: `➖ **Cargos removidos:** ${rolesList}`, 
          inline: false 
        }
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();

    return logChannel.send({ embeds: [embed] });
  }
}
