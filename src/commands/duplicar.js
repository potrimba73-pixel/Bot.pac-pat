// src/commands/duplicar.js
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { CONFIG } from "../config/index.js";

export const data = new SlashCommandBuilder()
  .setName("duplicar")
  .setDescription("Duplica a estrutura do servidor atual para outro servidor (Staff)")
  .addStringOption(option =>
    option.setName("servidor_id")
      .setDescription("ID do servidor de destino")
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option.setName("apenas_ids")
      .setDescription("Apenas listar IDs, sem criar canais/cargos (simular)")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction, client) {
  await interaction.deferReply({ flags: 64 });

  const targetGuildId = interaction.options.getString("servidor_id");
  const apenasIds = interaction.options.getBoolean("apenas_ids") || false;

  // Validar ID
  if (!/^\d{17,20}$/.test(targetGuildId)) {
    return interaction.editReply("❌ ID de servidor inválido. Deve ter 17-20 dígitos.");
  }

  // Obter servidor de origem (atual)
  const sourceGuild = interaction.guild;
  if (!sourceGuild) {
    return interaction.editReply("❌ Não foi possível obter o servidor de origem.");
  }

  // Obter servidor de destino
  const targetGuild = await client.guilds.fetch(targetGuildId).catch(() => null);
  if (!targetGuild) {
    return interaction.editReply(`❌ Servidor de destino não encontrado ou o bot não está lá. Verifica o ID: \`${targetGuildId}\``);
  }

  // Verificar permissões do bot no destino
  const botMember = await targetGuild.members.fetch(client.user.id).catch(() => null);
  if (!botMember) {
    return interaction.editReply("❌ Não consegui obter o meu membro no servidor de destino.");
  }
  const botPerms = targetGuild.members.me.permissions;
  if (!botPerms.has(PermissionFlagsBits.ManageChannels) || !botPerms.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply("❌ O bot precisa das permissões **Gerenciar Canais** e **Gerenciar Cargos** no servidor de destino.");
  }

  // Coletar dados da origem
  const categories = sourceGuild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .map(c => ({ id: c.id, name: c.name, position: c.position }))
    .sort((a, b) => a.position - b.position);

  const channels = sourceGuild.channels.cache
    .filter(c => c.type !== ChannelType.GuildCategory && c.type !== ChannelType.GuildVoice)
    .map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
      position: c.position,
      topic: c.topic || null,
      nsfw: c.nsfw || false,
      rateLimitPerUser: c.rateLimitPerUser || 0,
    }))
    .sort((a, b) => a.position - b.position);

  const voiceChannels = sourceGuild.channels.cache
    .filter(c => c.type === ChannelType.GuildVoice)
    .map(c => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      position: c.position,
      bitrate: c.bitrate || 64000,
      userLimit: c.userLimit || 0,
    }))
    .sort((a, b) => a.position - b.position);

  const roles = sourceGuild.roles.cache
    .filter(r => r.id !== sourceGuild.id) // exclui @everyone
    .map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
    }))
    .sort((a, b) => b.position - a.position); // ordem inversa (cargos mais altos primeiro)

  // Se for apenas simular, mostrar resumo
  if (apenasIds) {
    const resumo = [
      `📋 **Simulação - Estrutura do servidor ${sourceGuild.name}**`,
      `Categorias: ${categories.length}`,
      `Canais de texto: ${channels.length}`,
      `Canais de voz: ${voiceChannels.length}`,
      `Cargos: ${roles.length}`,
      `\n**IDs de origem:**`,
      `Categorias: ${categories.map(c => `${c.name} (${c.id})`).join(', ')}`,
      `Canais: ${channels.map(c => `${c.name} (${c.id})`).join(', ')}`,
      `Cargos: ${roles.map(r => `${r.name} (${r.id})`).join(', ')}`,
    ];
    return interaction.editReply(resumo.join('\n').slice(0, 2000));
  }

  // ----- EXECUÇÃO REAL -----
  const created = {
    categories: {},
    channels: {},
    voiceChannels: {},
    roles: {},
    targetGuildId: targetGuild.id,
    sourceGuildId: sourceGuild.id,
    timestamp: new Date().toISOString(),
  };

  // Mapeamento de IDs antigos -> novos (para parentId)
  const categoryMap = new Map();
  const channelParentMap = new Map();

  try {
    // 1. Criar categorias (na mesma ordem)
    for (const cat of categories) {
      const newCat = await targetGuild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        position: cat.position,
      });
      categoryMap.set(cat.id, newCat.id);
      created.categories[cat.name] = newCat.id;
      console.log(`[Duplicar] Categoria "${cat.name}" criada (ID: ${newCat.id})`);
    }

    // 2. Criar cargos (na mesma ordem, com permissões simplificadas)
    // Nota: Não podemos copiar permissões diretamente para evitar excesso de permissões.
    // Vamos criar com nome, cor, hoist, mentionable.
    for (const role of roles) {
      const newRole = await targetGuild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position, // pode não ser exato, mas tentamos
      });
      created.roles[role.name] = newRole.id;
      console.log(`[Duplicar] Cargo "${role.name}" criado (ID: ${newRole.id})`);
    }

    // 3. Criar canais de texto
    for (const ch of channels) {
      const parentId = ch.parentId ? categoryMap.get(ch.parentId) : null;
      const newCh = await targetGuild.channels.create({
        name: ch.name,
        type: ch.type,
        parent: parentId,
        topic: ch.topic,
        nsfw: ch.nsfw,
        rateLimitPerUser: ch.rateLimitPerUser,
        position: ch.position,
      });
      created.channels[ch.name] = newCh.id;
      channelParentMap.set(ch.id, newCh.id);
      console.log(`[Duplicar] Canal "${ch.name}" criado (ID: ${newCh.id})`);
    }

    // 4. Criar canais de voz
    for (const vc of voiceChannels) {
      const parentId = vc.parentId ? categoryMap.get(vc.parentId) : null;
      const newVc = await targetGuild.channels.create({
        name: vc.name,
        type: ChannelType.GuildVoice,
        parent: parentId,
        bitrate: vc.bitrate,
        userLimit: vc.userLimit,
        position: vc.position,
      });
      created.voiceChannels[vc.name] = newVc.id;
      console.log(`[Duplicar] Canal de voz "${vc.name}" criado (ID: ${newVc.id})`);
    }

    // 5. Gerar resumo de IDs
    const resumo = [
      `✅ **Estrutura duplicada com sucesso!**`,
      `📌 **Servidor de origem:** ${sourceGuild.name} (${sourceGuild.id})`,
      `📌 **Servidor de destino:** ${targetGuild.name} (${targetGuild.id})`,
      ``,
      `📋 **IDs criados:**`,
      ``,
      `**🏷️ Categorias:**`,
      ...Object.entries(created.categories).map(([name, id]) => `• ${name}: \`${id}\``),
      ``,
      `**📝 Canais de texto:**`,
      ...Object.entries(created.channels).map(([name, id]) => `• ${name}: \`${id}\``),
      ``,
      `**🔊 Canais de voz:**`,
      ...Object.entries(created.voiceChannels).map(([name, id]) => `• ${name}: \`${id}\``),
      ``,
      `**👥 Cargos:**`,
      ...Object.entries(created.roles).map(([name, id]) => `• ${name}: \`${id}\``),
    ];

    // Enviar resumo (pode ser longo, truncar se necessário)
    const finalMessage = resumo.join('\n');
    if (finalMessage.length > 2000) {
      // Enviar como ficheiro
      const buffer = Buffer.from(finalMessage, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: 'duplicar-resumo.txt' });
      await interaction.editReply({
        content: `✅ Estrutura duplicada! Resumo completo em anexo.`,
        files: [attachment],
      });
    } else {
      await interaction.editReply(finalMessage);
    }

    // Também guardar num ficheiro local para referência
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(process.cwd(), `duplicar-${targetGuild.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(created, null, 2));
    console.log(`[Duplicar] Dados guardados em ${filePath}`);

  } catch (error) {
    console.error('[Duplicar] Erro:', error);
    await interaction.editReply(`❌ Erro ao duplicar estrutura: ${error.message}`);
  }
}
