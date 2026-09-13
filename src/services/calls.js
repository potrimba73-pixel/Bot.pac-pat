// src/services/calls.js
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
  StringSelectMenuBuilder,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeEditReply } from "../utils/safeReply.js";

// ============================================================
// PAINEL STAFF — DINÂMICO
// ============================================================
//
//  ┌ Não assumido ────────►  [ ✅ Assumir ]  [ 🗑️ Fechar ]
//  ├ Assumido por ti ─────►  [ 🔄 Passar  ]  [ 🗑️ Fechar ]
//  └ Assumido por outro ──►  [ 🔔 Pedir   ]  [ 🗑️ Fechar ]
//
//  Linha 2 (sempre): Call → Criar | Apagar | Adicionar | Remover
// ============================================================

export async function sendPainelChamada(channel, ticketId, interaction) {
  const ticket = db.tickets[String(ticketId)];
  if (!ticket) {
    return safeEditReply(interaction, { content: "❌ Ticket não encontrado.", flags: 64 });
  }

  const staffId = interaction?.user?.id ?? null;
  const isClaimed = !!ticket.claimedBy;
  const isClaimer = ticket.claimedBy && ticket.claimedBy === staffId;

  const responsavel = isClaimed ? `<@${ticket.claimedBy}>` : "`Ninguém assumiu`";
  const callEstado = ticket.callActive ? "🟢 Ativa" : "🔴 Não iniciada";

  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_PAINEL || "🛡️"} Painel de Staff`)
    .setDescription(
      `${CONFIG.EMOJI_INFO || "ℹ️"} Selecione a opção desejada abaixo.\n\n` +
      `${CONFIG.EMOJI_STAFF || "👮"} **Responsável:** ${responsavel}\n` +
      `${CONFIG.EMOJI_CALL || "📞"} **Call:** ${callEstado}`
    )
    .setColor(0x262af1)
    .setFooter({ text: `Ticket #${ticketId}` })
    .setTimestamp();

  const rows = [];

  // LINHA 1 — Estado do ticket
  const ticketRow = new ActionRowBuilder();

  if (!isClaimed) {
    ticketRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`assumir_${ticketId}`)
        .setLabel("✅ Assumir Ticket")
        .setStyle(ButtonStyle.Success)
    );
  } else if (isClaimer) {
    ticketRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`passar_${ticketId}`)
        .setLabel("🔄 Passar Assumo")
        .setStyle(ButtonStyle.Primary)
    );
  } else {
    ticketRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`pedirassumo_${ticketId}`)
        .setLabel("🔔 Pedir Assumo")
        .setStyle(ButtonStyle.Primary)
    );
  }

  ticketRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`deletar_${ticketId}`)
      .setLabel("🗑️ Fechar Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  rows.push(ticketRow);

  // LINHA 2 — Call
  const callRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`criar_call_${ticketId}`)
      .setLabel("📞 Criar Call")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!!ticket.callActive),
    new ButtonBuilder()
      .setCustomId(`apagar_call_${ticketId}`)
      .setLabel("🔚 Apagar Call")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!ticket.callActive),
    new ButtonBuilder()
      .setCustomId(`add_user_${ticketId}`)
      .setLabel("➕ Adicionar")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!ticket.callActive),
    new ButtonBuilder()
      .setCustomId(`remove_user_${ticketId}`)
      .setLabel("➖ Remover")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!ticket.callActive)
  );

  rows.push(callRow);

  if (interaction) {
    await safeEditReply(interaction, { embeds: [embed], components: rows, flags: 64 });
  } else {
    await channel.send({ embeds: [embed], components: rows });
  }
}

// ============================================================
// PASSAR ASSUMO — abre o select menu
// ============================================================

export async function abrirPassarAssumo(interaction, ticketId, staffList) {
  const ticket = db.tickets[String(ticketId)];
  if (!ticket || ticket.closed) {
    return safeEditReply(interaction, { content: "⚠️ Ticket não encontrado.", flags: 64 });
  }
  if (ticket.claimedBy !== interaction.user.id) {
    return safeEditReply(interaction, { content: "❌ Só quem assumiu o ticket pode passá-lo.", flags: 64 });
  }

  const outros = (staffList || []).filter((s) => s.member.id !== interaction.user.id);
  if (outros.length === 0) {
    return safeEditReply(interaction, { content: "⚠️ Não há outros staff neste canal.", flags: 64 });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`passar_select_${ticket.id}`)
    .setPlaceholder("🔄 Escolhe o staff que vai receber")
    .addOptions(
      outros.slice(0, 25).map((s) => ({
        label: (s.displayName || s.username || "Staff").substring(0, 100),
        description: `${s.roleName} • ${s.status}`.substring(0, 100),
        value: s.member.id,
      }))
    );

  return safeEditReply(interaction, {
    content: "🔄 **Para quem queres passar este ticket?**",
    components: [new ActionRowBuilder().addComponents(select)],
    flags: 64,
  });
}

// ============================================================
// PASSAR ASSUMO — aplicar a escolha
// ============================================================

export async function aplicarPassarAssumo(interaction, ticketId, novoStaffId, client) {
  await interaction.deferReply({ flags: 64 });

  const ticket = db.tickets[String(ticketId)];
  if (!ticket || ticket.closed) {
    return interaction.editReply("⚠️ Ticket não encontrado ou já fechado.");
  }
  if (ticket.claimedBy !== interaction.user.id) {
    return interaction.editReply("❌ Já não és o responsável deste ticket.");
  }

  const membro = await interaction.guild.members.fetch(novoStaffId).catch(() => null);
  if (!membro) return interaction.editReply("❌ Staff não encontrado no servidor.");

  ticket.claimedBy = novoStaffId;
  ticket.claimedAt = new Date().toISOString();
  ticket.claimedByName = membro.displayName || membro.user.username;
  await saveDB();

  try {
    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) {
      const { updateTicketEmbed } = await import("./tickets.js");
      await updateTicketEmbed(channel, ticket.id);
      await channel.send(
        `🔄 **Ticket passado!**\n\n👮 Novo responsável: <@${novoStaffId}>\n📌 Passado por: <@${interaction.user.id}>`
      );
    }
  } catch (e) {
    console.error("[PassarAssumo] Erro ao atualizar ticket:", e.message);
  }

  return interaction.editReply(`✅ Ticket passado para <@${novoStaffId}>.`);
}

// ============================================================
// PEDIR ASSUMO — envia DM ao responsável atual
// ============================================================

export async function enviarPedidoAssumo(interaction, ticketId, client) {
  await interaction.deferReply({ flags: 64 });

  const ticket = db.tickets[String(ticketId)];
  if (!ticket || ticket.closed) {
    return interaction.editReply("⚠️ Ticket não encontrado.");
  }
  if (!ticket.claimedBy) {
    return interaction.editReply("ℹ️ Este ticket ainda não foi assumido — podes assumi-lo diretamente.");
  }
  if (ticket.claimedBy === interaction.user.id) {
    return interaction.editReply("ℹ️ Já és tu o responsável.");
  }

  const donoAtual = ticket.claimedBy;
  const pedinte = interaction.user;

  const embed = new EmbedBuilder()
    .setTitle("🙋 Pedido de Assumo")
    .setDescription(
      `👤 **Quem pede:** <@${pedinte.id}> | \`${pedinte.username}\`\n` +
      `👮 **Responsável atual:** <@${donoAtual}>\n` +
      `🎫 **Ticket:** #${ticket.id} • ${ticket.label}\n\n` +
      `Aceita ou recusa o pedido abaixo.`
    )
    .setColor(0xfee75c)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aceitar_pedido_${ticket.id}_${pedinte.id}`)
      .setLabel("✅ Aceitar pedido")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`recusar_pedido_${ticket.id}_${pedinte.id}`)
      .setLabel("❌ Recusar")
      .setStyle(ButtonStyle.Danger)
  );

  try {
    const dono = await client.users.fetch(donoAtual);
    await dono.send({ embeds: [embed], components: [row] });
  } catch {
    await interaction.channel.send(
      `⚠️ Não consegui enviar DM a <@${donoAtual}>. Notifica-o por aqui:\n` +
      `🙋 <@${donoAtual}> — <@${pedinte.id}> está a pedir para assumir o ticket.`
    );
  }

  await interaction.channel.send({
    content: `🙋 <@${donoAtual}> — <@${pedinte.id}> pediu para assumir o ticket!`,
  });

  return interaction.editReply("✅ Pedido enviado ao responsável.");
}

// ============================================================
// ACEITAR PEDIDO DE ASSUMO
// ============================================================

export async function aceitarPedidoAssumo(interaction, ticketId, pedinteId, client) {
  await interaction.deferReply({ flags: 64 });

  const ticket = db.tickets[String(ticketId)];
  if (!ticket || ticket.closed) {
    return interaction.editReply("⚠️ Ticket já não existe.");
  }
  if (ticket.claimedBy !== interaction.user.id) {
    return interaction.editReply("❌ Já não és o responsável deste ticket.");
  }

  const membro = await interaction.guild.members.fetch(pedinteId).catch(() => null);
  if (!membro) return interaction.editReply("❌ Staff já não está no servidor.");

  ticket.claimedBy = pedinteId;
  ticket.claimedAt = new Date().toISOString();
  ticket.claimedByName = membro.displayName || membro.user.username;
  await saveDB();

  try {
    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) {
      const { updateTicketEmbed } = await import("./tickets.js");
      await updateTicketEmbed(channel, ticket.id);
      await channel.send(`✅ <@${pedinteId}> é agora o novo responsável do ticket.`);
    }
  } catch (e) {
    console.error("[AceitarPedido] Erro:", e.message);
  }

  try {
    await interaction.message.edit({ components: [] });
  } catch {}

  return interaction.editReply("✅ Pedido aceite.");
}

// ============================================================
// RECUSAR PEDIDO DE ASSUMO
// ============================================================

export async function recusarPedidoAssumo(interaction, ticketId, pedinteId, client) {
  const ticket = db.tickets[String(ticketId)];
  if (!ticket || ticket.closed) {
    return safeEditReply(interaction, { content: "⚠️ Ticket já não existe.", flags: 64 });
  }
  if (ticket.claimedBy !== interaction.user.id) {
    return safeEditReply(interaction, { content: "❌ Já não és o responsável.", flags: 64 });
  }

  try {
    await interaction.message.edit({ components: [] });
  } catch {}

  try {
    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) {
      await channel.send(`❌ <@${pedinteId}> — o teu pedido de assumo foi recusado por <@${interaction.user.id}>.`);
    }
  } catch {}

  return safeEditReply(interaction, { content: "❌ Pedido recusado.", flags: 64 });
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
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      },
      {
        id: CONFIG.CARGO_STAFF,
        type: 0,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
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
// CHAMAR MEMBRO
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
    const staffName =
      staffMember?.displayName || staffMember?.user?.username || interaction.user.username;

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
// ADICIONAR / REMOVER UTILIZADOR DA CALL (MODAIS)
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
