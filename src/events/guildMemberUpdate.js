import { EmbedBuilder } from "discord.js";

// IDs dos Servidores
const GUILD_PRINCIPAL_ID = "932093509060689933";
const GUILD_LOGS_ID = "1510401803974475947";

// IDs dos Canais de Logs (Servidor de Logs)
const CANAL_LOGS_MEMBROS = "1510402309929042060";
const CANAL_LOGS_REGRAS = "1539682562794852474";

// ID do Embed das Regras
const EMBED_REGRAS_ID = "1539040418107367425";

export async function handleGuildMemberUpdate(oldMember, newMember, client) {
  // Executa apenas se a alteração acontecer no Servidor Principal
  if (newMember.guild.id !== GUILD_PRINCIPAL_ID) return;

  const guildLogs = await client.guilds.fetch(GUILD_LOGS_ID).catch(() => null);
  if (!guildLogs) return;

  // Comparação de Cargos Adicionados
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));

  if (addedRoles.size > 0) {
    // Nomes dos cargos formatados em texto simples (evita o erro @cargo desconhecido)
    const rolesNames = addedRoles.map(r => `\`${r.name}\``).join(" | ");

    // Verifica se o cargo atribuído tem a ver com as regras
    const eRegras = addedRoles.some(r => 
      r.name.toLowerCase().includes("regras") || 
      r.name.toLowerCase().includes("verificado")
    );

    if (eRegras) {
      // Log exclusivo para o Canal de Regras (1539682562794852474)
      const canalRegras = await guildLogs.channels.fetch(CANAL_LOGS_REGRAS).catch(() => null);
      if (canalRegras) {
        const embedRegras = new EmbedBuilder()
          .setColor(0x57F287) // Verde
          .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
          .setTitle("📝 Regras aceites ✅")
          .setDescription(`${newMember} foi atualizado.`)
          .addFields(
            { name: "Alterações", value: `➕ **Cargos adicionados:** (${rolesNames})`, inline: false }
          )
          .setFooter({ text: `ID: ${newMember.id} • Mensagem Regras: ${EMBED_REGRAS_ID}` })
          .setTimestamp();

        await canalRegras.send({ embeds: [embedRegras] });
      }
    } else {
      // Log para o Canal Geral de Membros (1510402309929042060)
      const canalMembros = await guildLogs.channels.fetch(CANAL_LOGS_MEMBROS).catch(() => null);
      if (canalMembros) {
        const embedMembros = new EmbedBuilder()
          .setColor(0x57F287) // Verde
          .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
          .setTitle("📝 Membro Atualizado")
          .setDescription(`${newMember} foi atualizado.`)
          .addFields(
            { name: "Alterações", value: `➕ **Cargos adicionados:** (${rolesNames})`, inline: false }
          )
          .setFooter({ text: `ID: ${newMember.id}` })
          .setTimestamp();

        await canalMembros.send({ embeds: [embedMembros] });
      }
    }
    return;
  }

  // Comparação de Cargos Removidos
  const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

  if (removedRoles.size > 0) {
    const canalMembros = await guildLogs.channels.fetch(CANAL_LOGS_MEMBROS).catch(() => null);
    if (!canalMembros) return;

    const rolesNames = removedRoles.map(r => `\`${r.name}\``).join(" | ");

    const embedRemovido = new EmbedBuilder()
      .setColor(0xED4245) // Vermelho
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setTitle("📝 Membro Atualizado")
      .setDescription(`${newMember} foi atualizado.`)
      .addFields(
        { name: "Alterações", value: `➖ **Cargos removidos:** (${rolesNames})`, inline: false }
      )
      .setFooter({ text: `ID: ${newMember.id}` })
      .setTimestamp();

    await canalMembros.send({ embeds: [embedRemovido] });
  }
}
