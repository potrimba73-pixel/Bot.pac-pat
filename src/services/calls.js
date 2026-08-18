import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeEditReply } from "../utils/safeReply.js";

// ============================================================
// PAINEL STAFF
// ============================================================

export async function sendPainelChamada(channel, ticketId, interaction) {
  const ticket = db.tickets[ticketId];
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_PAINEL} Painel de Staff`)
    .setDescription(
      `${CONFIG.EMOJI_INFO} Selecione a opção desejada abaixo.\n\n` +
      `${CONFIG.EMOJI_CALL} Call: ${ticket?.callActive ? "Ativa" : "Não iniciada"}`
    )
    .setColor(0x262af1);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`criar_call_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_CALL} Criar Call`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`apagar_call_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_FECHAR} Apagar Call`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`chamar_membro_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_CHAMAR} Chamar Membro`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`add_user_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_ADD} Adicionar`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`remove_user_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_REMOVE} Remover`)
      .setStyle(ButtonStyle.Secondary),
  );

  if (interaction) {
    await safeEditReply(interaction, { embeds: [embed], components: [row], flags: 64 });
  } else {
    await channel.send({ embeds: [embed], components: [row] });
  }
}

// ============================================================
// CRIAR CALL
// ============================================================

export async function criarCall(interaction, ticketId, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket) {
    return safeEditReply(interaction, { content: "❌ Ticket não encontrado.", flags: 64 });
  }

  let existingCall = null;
  if (ticket.callChannelId) {
    existingCall = await interaction.guild.channels.fetch(ticket.callChannelId).catch(() => null);
  }

  if (ticket.callActive && existingCall) {
    return safeEditReply(interaction, {
      content: `${CONFIG.EMOJI_WARNING} Já existe uma call ativa.`,
      flags: 64,
    });
  }

  const callData = {
    name: `call-${ticket.username}`,
    type: ChannelType.GuildVoice,
    parent: interaction.channel.parentId || undefined,
    permissionOverwrites: [
      {
        id: interaction.guild.id,
        type: 0,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
      },
      {
        id: ticket.userId,
        type: 1,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      },
      {
        id: CONFIG.CARGO_STAFF,
        type: 0,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      },
    ],
  };

  if (!callData.parent) delete callData.parent;

  const channel = await interaction.guild.channels.create(callData);
  ticket.callActive = true;
  ticket.callChannelId = channel.id;
  await saveDB();

  await safeEditReply(interaction, {
    content: `${CONFIG.EMOJI_SUCCESS} Call criada: ${channel}`,
    flags: 64,
  });
}

// ============================================================
// APAGAR CALL
// ============================================================

export async function apagarCall(interaction, ticketId, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket || !ticket.callActive) {
    return safeEditReply(interaction, {
      content: `${CONFIG.EMOJI_WARNING} Não existe call ativa.`,
      flags: 64,
    });
  }

  const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
  if (!mainGuild) {
    return safeEditReply(interaction, {
      content: `${CONFIG.EMOJI_ERROR} Erro: Não consegui aceder ao servidor principal.`,
      flags: 64,
    });
  }

  try {
    const callChannel = await mainGuild.channels.fetch(ticket.callChannelId).catch(() => null);
    if (callChannel) await callChannel.delete();
  } catch (e) {
    console.log("[Calls] Call já foi apagada manualmente:", e.message);
  }

  ticket.callActive = false;
  ticket.callChannelId = null;
  await saveDB();

  await safeEditReply(interaction, {
    content: `${CONFIG.EMOJI_SUCCESS} Call apagada.`,
    flags: 64,
  });
}

// ============================================================
// CHAMAR MEMBRO (STAFF → MEMBRO)
// ============================================================

export async function chamarMembro(interaction, ticketId, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket) {
    return safeEditReply(interaction, { content: "❌ Ticket não encontrado.", flags: 64 });
  }

  try {
    const user = await client.users.fetch(ticket.userId).catch(() => null);
    if (!user) {
      return safeEditReply(interaction, {
        content: `${CONFIG.EMOJI_ERROR} Não foi possível encontrar o utilizador.`,
        flags: 64,
      });
    }

    const staffMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const staffName = staffMember?.displayName || staffMember?.user?.username || interaction.user.username;

    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_CHAMAR} Staff a Chamar!`)
      .setDescription(
        `Olá ${user.username}!\n\n` +
        `Um membro da staff está a chamar-te no teu ticket <#${ticket.channelId}>.\n\n` +
        `${CONFIG.EMOJI_INFO} Motivo: ${ticket.label}\n` +
        `${CONFIG.EMOJI_STAFF} Staff: ${staffName}\n\n` +
        `${CONFIG.EMOJI_TIME} Importante: Responde o mais breve possível!`
      )
      .setColor(0x00ff88)
      .setTimestamp()
      .setFooter({
        text: "Portugal Alfa Community",
        iconURL: client.user?.displayAvatarURL(),
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`${CONFIG.EMOJI_TICKET} Ir para o Ticket`)
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`)
    );

    await user.send({ embeds: [embed], components: [row] });

    await interaction.channel.send({
      content: `${CONFIG.EMOJI_CHAMAR} ${interaction.user.username} chamou <@${user.id}> no privado.`,
    });

    await safeEditReply(interaction, {
      content: `${CONFIG.EMOJI_SUCCESS} Mensagem enviada para ${user.username} no privado!`,
      flags: 64,
    });
  } catch (error) {
    console.error("Erro ao chamar membro:", error);
    await safeEditReply(interaction, {
      content: `${CONFIG.EMOJI_ERROR} Erro ao enviar mensagem no privado. O utilizador pode ter DMs desativadas.`,
      flags: 64,
    });
  }
}

// ============================================================
// ADICIONAR UTILIZADOR À CALL (MODAL)
// ============================================================

export async function addUserToCall(interaction, ticketId, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket) {
    return safeEditReply(interaction, { content: "❌ Ticket não encontrado.", flags: 64 });
  }

  if (!ticket.callActive || !ticket.callChannelId) {
    return safeEditReply(interaction, {
      content: `${CONFIG.EMOJI_WARNING} Não existe call ativa. Cria uma primeiro.`,
      flags: 64,
    });
  }

  // Abrir modal para pedir o ID do utilizador
  const modal = new ModalBuilder()
    .setCustomId(`modal_add_user_${ticketId}`)
    .setTitle("Adicionar utilizador à call");

  const input = new TextInputBuilder()
    .setCustomId("user_id")
    .setLabel("ID do utilizador")
    .setPlaceholder("Ex: 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

// ============================================================
// REMOVER UTILIZADOR DA CALL (MODAL)
// ============================================================

export async function removeUserFromCall(interaction, ticketId, client) {
  const ticket = db.tickets[ticketId];
  if (!ticket) {
    return safeEditReply(interaction, { content: "❌ Ticket não encontrado.", flags: 64 });
  }

  if (!ticket.callActive || !ticket.callChannelId) {
    return safeEditReply(interaction, {
      content: `${CONFIG.EMOJI_WARNING} Não existe call ativa.`,
      flags: 64,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_remove_user_${ticketId}`)
    .setTitle("Remover utilizador da call");

  const input = new TextInputBuilder()
    .setCustomId("user_id")
    .setLabel("ID do utilizador")
    .setPlaceholder("Ex: 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

// ============================================================
// PROCESSAR MODAL DE ADICIONAR/REMOVER (chamado do interactionCreate)
// ============================================================

export async function handleAddUserModal(interaction, client) {
  const ticketId = interaction.customId.replace("modal_add_user_", "");
  const userId = interaction.fields.getTextInputValue("user_id")?.trim();

  if (!userId || !/^\d+$/.test(userId)) {
    return interaction.reply({ content: "❌ ID inválido. Insere apenas números.", ephemeral: true });
  }

  const ticket = db.tickets[ticketId];
  if (!ticket || !ticket.callActive || !ticket.callChannelId) {
    return interaction.reply({ content: "❌ Call não encontrada ou inativa.", ephemeral: true });
  }

  try {
    const guild = interaction.guild;
    const callChannel = await guild.channels.fetch(ticket.callChannelId);
    if (!callChannel) {
      return interaction.reply({ content: "❌ Canal de call não encontrado.", ephemeral: true });
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "❌ Utilizador não encontrado no servidor.", ephemeral: true });
    }

    await callChannel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
    });

    await interaction.reply({
      content: `✅ Utilizador <@${member.id}> adicionado à call.`,
      ephemeral: true,
    });

    await interaction.channel.send({
      content: `${CONFIG.EMOJI_ADD} <@${member.id}> foi adicionado à call por ${interaction.user.username}.`,
    });
  } catch (error) {
    console.error("[AddUser] Erro:", error);
    await interaction.reply({
      content: `❌ Erro ao adicionar utilizador: ${error.message}`,
      ephemeral: true,
    });
  }
}

export async function handleRemoveUserModal(interaction, client) {
  const ticketId = interaction.customId.replace("modal_remove_user_", "");
  const userId = interaction.fields.getTextInputValue("user_id")?.trim();

  if (!userId || !/^\d+$/.test(userId)) {
    return interaction.reply({ content: "❌ ID inválido. Insere apenas números.", ephemeral: true });
  }

  const ticket = db.tickets[ticketId];
  if (!ticket || !ticket.callActive || !ticket.callChannelId) {
    return interaction.reply({ content: "❌ Call não encontrada ou inativa.", ephemeral: true });
  }

  try {
    const guild = interaction.guild;
    const callChannel = await guild.channels.fetch(ticket.callChannelId);
    if (!callChannel) {
      return interaction.reply({ content: "❌ Canal de call não encontrado.", ephemeral: true });
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "❌ Utilizador não encontrado no servidor.", ephemeral: true });
    }

    await callChannel.permissionOverwrites.delete(member.id);

    await interaction.reply({
      content: `✅ Utilizador <@${member.id}> removido da call.`,
      ephemeral: true,
    });

    await interaction.channel.send({
      content: `${CONFIG.EMOJI_REMOVE} <@${member.id}> foi removido da call por ${interaction.user.username}.`,
    });
  } catch (error) {
    console.error("[RemoveUser] Erro:", error);
    await interaction.reply({
      content: `❌ Erro ao remover utilizador: ${error.message}`,
      ephemeral: true,
    });
  }
}
