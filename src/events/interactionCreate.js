import {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { criarTicketRecrutamento, handleTruckyVerification, updateTicketEmbed } from "../services/tickets.js";
import { sendLog } from "../services/logs.js";

export async function handleInteractionCreate(interaction, client) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "transcript") {
      const ticket = Object.values(db.tickets).find(t => t.channelId === interaction.channelId && !t.closed);
      if (!ticket) {
        return interaction.reply({ content: `Nenhum ticket ativo encontrado neste canal.`, flags: 64 });
      }
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      let transcript = `**Transcript do Ticket #${ticket.id}**\n\n`;
      messages.reverse().forEach(msg => {
        transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
      });
      await interaction.reply({ content: transcript.substring(0, 2000), flags: 64 });
    }

    if (interaction.commandName === "painelmembro") {
      await enviarPainelMembro(interaction);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("modal_trucky_")) {
      await handleTruckyVerification(interaction, client);
    }

    if (interaction.customId.startsWith("modal_ajuda_")) {
      const especificacoes = interaction.fields.getTextInputValue("ajuda_especificacoes")?.trim();
      interaction._ajudaEspecificacoes = especificacoes;
      const { criarTicket } = await import("../services/tickets.js");
      await criarTicket(interaction, "ajuda", `Pedir ajuda`, client);
    }

    if (interaction.customId.startsWith("modal_foto_trucky_")) {
      await handleFotoTruckyModal(interaction, client);
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_geral") {
      const value = interaction.values[0];
      const labels = { bugs: `Bugs`, denuncia: `Denúncia`, suporte: `Suporte`, criador: `Criador De Conteúdo` };
      const { criarTicket } = await import("../services/tickets.js");
      await criarTicket(interaction, value, labels[value], client);
    }

    if (interaction.customId === "ticket_recruitamento") {
      const value = interaction.values[0];
      if (value === "recrutamento") {
        const { createTicket } = await import("../services/tickets.js");
        await createTicket(interaction, "recrutamento", `Recrutamento PAT`, client);
      }
      if (value === "ajuda") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_ajuda_${interaction.user.id}_${Date.now()}`)
          .setTitle(`Especificações do Problema`);
        const input = new TextInputBuilder()
          .setCustomId("ajuda_especificacoes")
          .setLabel("Descreve o teu problema ou dúvida")
          .setPlaceholder("Ex: Não consigo instalar o Trucky App...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
      }
    }
  }

  if (interaction.isButton()) {
    const customId = interaction.customId;

    // === ACEITAR REGRAS (painel de regras) ===
    if (customId === "aceitar_regras") {
      const member = interaction.member;
      if (!db.acceptedRules) db.acceptedRules = [];
      if (!db.acceptedRules.includes(member.id)) {
        db.acceptedRules.push(member.id);
        await saveDB();
      }
      const cargoMembro = interaction.guild.roles.cache.get(CONFIG.CARGO_MEMBRO);
      const cargoVerificado = interaction.guild.roles.cache.get(CONFIG.CARGO_VERIFICADO);
      if (cargoMembro) await member.roles.add(cargoMembro).catch(() => {});
      if (cargoVerificado) await member.roles.add(cargoVerificado).catch(() => {});
      await interaction.reply({ content: `✅ Regras aceites com sucesso! Bem-vindo à comunidade 🎉.`, flags: 64 });
    }

    // === ACEITAR REGRAS RECRUTAMENTO ===
    if (customId.startsWith("aceitar_regras_rec_")) {
      const parts = customId.split("_");
      const userId = parts[3];
      const nomeTrucky = parts.slice(4).join("_");
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: `Este botão não é para ti!`, flags: 64 });
      }
      await criarTicketRecrutamento(interaction, client, nomeTrucky);
    }

    // === RECUSAR REGRAS RECRUTAMENTO ===
    if (customId.startsWith("recusar_regras_rec_")) {
      const userId = customId.split("_")[3];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: `Este botão não é para ti!`, flags: 64 });
      }
      await interaction.update({
        content: `Recrutamento cancelado. Se mudares de ideias, podes voltar a candidatar-te mais tarde.`,
        embeds: [],
        components: [],
      });
    }

        // === ASSUMIR TICKET ===
    if (customId.startsWith("assumir_")) {
      const ticketId = customId.replace("assumir_", "");
      const ticket = db.tickets[ticketId];
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `Ticket nao encontrado ou ja fechado.`, flags: 64 });
      }
      if (ticket.claimedBy) {
        return interaction.reply({ content: `Este ticket ja foi assumido por <@${ticket.claimedBy}>.`, flags: 64 });
      }

      ticket.claimedBy = interaction.user.id;
      ticket.claimedByName = interaction.user.username;
      await saveDB();

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (channel) {
        await updateTicketEmbed(channel, ticketId);
        
        // Mensagem visivel para TODOS no canal do ticket
        await channel.send(`Olá, o teu ticket foi assumido por <@${interaction.user.id}>. Se precisares de chamar a staff, usa a opção Painel Membro.`);
        
        // Mensagem EPHEMERAL (so quem clicou ve) com dica do /painelstaff
        await interaction.reply({
          content: `Olá <@${interaction.user.id}>, sabias que podes usar o /painelstaff para teres mais acesso ao ticket.`,
          flags: 64
        });
      }
    }

    // === PAINEL MEMBRO ===
    if (customId.startsWith("painel_membro_")) {
      const ticketId = customId.replace("painel_membro_", "");
      const ticket = db.tickets[ticketId];
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `Ticket não encontrado ou já fechado.`, flags: 64 });
      }

      const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
      if (!guild) return interaction.reply({ content: `Erro ao aceder ao servidor.`, flags: 64 });

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) return interaction.reply({ content: `Canal não encontrado.`, flags: 64 });

      const members = await channel.members.fetch();
      const staffList = [];

      for (const [memberId, member] of members) {
        if (memberId === CONFIG.BOT_ID_EXCLUIR) continue;
        if (memberId === ticket.userId) continue;

        const perms = channel.permissionsFor(member);
        if (perms && perms.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages)) {
          const highestRole = member.roles.cache.sort((a, b) => b.position - a.position).first();
          staffList.push({
            member,
            rolePosition: highestRole ? highestRole.position : 0,
            roleName: highestRole ? highestRole.name : "Sem cargo",
            displayName: member.displayName || member.user.username,
          });
        }
      }

      staffList.sort((a, b) => {
        if (b.rolePosition !== a.rolePosition) return b.rolePosition - a.rolePosition;
        return a.displayName.localeCompare(b.displayName);
      });

      if (staffList.length === 0) {
        return interaction.reply({ content: `Nenhum membro da staff encontrado neste ticket.`, flags: 64 });
      }

      const staffText = staffList.map(s => `**${s.roleName}** | ${s.displayName} | <@${s.member.id}>`).join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`Painel Membro`)
        .setDescription([
          `Lista de staff disponível neste ticket:`,
          "",
          staffText
        ].join("\n"))
        .setColor(CONFIG.COR_PRINCIPAL);

      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    // === SAIR DO TICKET ===
    if (customId.startsWith("sair_")) {
      const ticketId = customId.replace("sair_", "");
      const ticket = db.tickets[ticketId];
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `Ticket não encontrado ou já fechado.`, flags: 64 });
      }
      if (ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: `Só quem abriu o ticket pode sair.`, flags: 64 });
      }

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (channel) {
        await channel.permissionOverwrites.delete(interaction.user.id);
        await interaction.reply({ content: `Saíste do ticket com sucesso.`, flags: 64 });
      }
    }

    // === FECHAR TICKET ===
    if (customId.startsWith("deletar_")) {
      const ticketId = customId.replace("deletar_", "");
      const ticket = db.tickets[ticketId];
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `Ticket não encontrado ou já fechado.`, flags: 64 });
      }

      if (ticket.type === "recrutamento") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`recrutado_sim_${ticketId}`).setLabel(`Sim - Recrutado`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recrutado_nao_${ticketId}`).setLabel(`Não - Não Recrutado`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`fechar_definitivo_${ticketId}`).setLabel(`Fechar Definitivo (Não Recrutamento. Outros assuntos)`).setStyle(ButtonStyle.Secondary),
        );

        await interaction.reply({
          content: `O candidato foi recrutado?`,
          components: [row],
        });
      } else {
        await fecharTicket(interaction, ticketId, client, false);
      }
    }

    // === RECRUTADO SIM ===
    if (customId.startsWith("recrutado_sim_")) {
      const ticketId = customId.replace("recrutado_sim_", "");
      const ticket = db.tickets[ticketId];
      if (!ticket) return interaction.reply({ content: `Ticket não encontrado.`, flags: 64 });

      const modal = new ModalBuilder()
        .setCustomId(`modal_foto_trucky_${ticketId}`)
        .setTitle(`Nome da Foto do Trucky`);

      const input = new TextInputBuilder()
        .setCustomId("foto_nome")
        .setLabel("Nome da tua foto de perfil do Trucky")
        .setPlaceholder("Ex: Diego")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    // === RECRUTADO NÃO ===
    if (customId.startsWith("recrutado_nao_")) {
      const ticketId = customId.replace("recrutado_nao_", "");
      await fecharTicket(interaction, ticketId, client, false);
    }

    // === FECHAR DEFINITIVO ===
    if (customId.startsWith("fechar_definitivo_")) {
      const ticketId = customId.replace("fechar_definitivo_", "");
      await fecharTicket(interaction, ticketId, client, false);
    }
  }
}

// === HANDLER DO MODAL DA FOTO TRUCKY ===
async function handleFotoTruckyModal(interaction, client) {
  const ticketId = interaction.customId.replace("modal_foto_trucky_", "");
  const ticket = db.tickets[ticketId];
  if (!ticket) return interaction.reply({ content: `Ticket não encontrado.`, flags: 64 });

  let fotoNome = interaction.fields.getTextInputValue("foto_nome")?.trim() || "Não informado";
  // Remove extensão (.png, .jpg, etc.)
  fotoNome = fotoNome.replace(/\.[^/.]+$/, "");

  ticket.fotoNome = fotoNome;
  ticket.recrutado = true;
  ticket.closedBy = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  ticket.closedAt = new Date().toISOString();
  await saveDB();

  const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);

  // Atribui cargos: RECRUTADO + RECRUTAMENTO_1
  if (guild) {
    const member = await guild.members.fetch(ticket.userId).catch(() => null);
    if (member) {
      const cargoRecrutado = guild.roles.cache.get(CONFIG.CARGO_RECRUTADO);
      const cargoRecrutamento1 = guild.roles.cache.get(CONFIG.CARGO_RECRUTAMENTO_1);
      if (cargoRecrutado) await member.roles.add(cargoRecrutado).catch(() => {});
      if (cargoRecrutamento1) await member.roles.add(cargoRecrutamento1).catch(() => {});
    }
  }

  // Envia mensagem de boas-vindas no canal geral (1200170007418642502)
  const canalGeral = await client.channels.fetch(CONFIG.CANAL_GERAL).catch(() => null);
  if (canalGeral) {
    await canalGeral.send([
      `🎉 Bem-vindo à Portugal Alfa Truckers!`,
      ``,
      `Parabéns <@${ticket.userId}>! Foste recrutado com sucesso.`,
      `✅ Segue as regras da empresa e diverte-te!`,
      `🚛 A tua foto de perfil para o Trucky ficará disponível em <#${CONFIG.CANAL_TEMPLATE_FOTO}>.`,
      `ℹ️ Caso precises de ajuda, abre um ticket ou coloca a tua dúvida num chat aberto.`
    ].join("\n"));
  }

  await sendLog(ticketId, "close", client);

  // Embed de fecho no ticket
  const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (channel) {
    const embedFechamento = new EmbedBuilder()
      .setTitle(`🗑️ Ticket Fechado`)
      .setDescription([
        `ℹ️ O teu ticket foi fechado com sucesso.`,
        ``,
        `👮 Fechado por: ${interaction.user.username}`,
        `⏰ Fechado em: ${new Date().toLocaleString("pt-PT")}`
      ].join("\n"))
      .setColor(CONFIG.COR_ERRO);

    await channel.send({ embeds: [embedFechamento] });

    // DM ao user
    try {
      const user = await client.users.fetch(ticket.userId);
      const embedDM = new EmbedBuilder()
        .setTitle(`⭐ Ticket Fechado`)
        .setDescription([
          `ℹ️ O teu ticket foi fechado com sucesso, avalia o nosso atendimento clicando nas estrelas abaixo.`,
          ``,
          `🎫 Ticket ID: #${ticket.id}`,
          `📝 Tipo: ${ticket.label}`,
          ``,
          `👮 Fechado por:`,
          `${interaction.user.username}`,
          ``,
          `⏰ Fechado em:`,
          `${new Date().toLocaleString("pt-PT")}`,
          ``,
          `🎫 Caso necessário, não hesite em abrir ticket novamente!`
        ].join("\n"))
        .setColor(CONFIG.COR_PRINCIPAL);

      await user.send({ embeds: [embedDM] });
    } catch (e) {
      console.log("Não foi possível enviar DM ao user:", e.message);
    }

    setTimeout(async () => {
      await channel.delete().catch(() => {});
    }, 10000);
  }

  await interaction.reply({
    content: `✅ Utilizador recrutado com sucesso! Foto do Trucky: ${fotoNome}.\nTicket será fechado em 10 segundos...`,
    flags: 64
  });
}

// === FECHAR TICKET (normal ou não recrutado) ===
async function fecharTicket(interaction, ticketId, client, recrutado) {
  const ticket = db.tickets[ticketId];
  if (!ticket) return interaction.reply({ content: `Ticket não encontrado.`, flags: 64 });

  ticket.closed = true;
  ticket.recrutado = recrutado;
  ticket.closedBy = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  ticket.closedAt = new Date().toISOString();
  await saveDB();

  await sendLog(ticketId, "close", client);

  const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (channel) {
    const embedFechamento = new EmbedBuilder()
      .setTitle(`🗑️ Ticket Fechado`)
      .setDescription([
        `ℹ️ O teu ticket foi fechado com sucesso.`,
        ``,
        `👮 Fechado por: ${interaction.user.username}`,
        `⏰ Fechado em: ${new Date().toLocaleString("pt-PT")}`
      ].join("\n"))
      .setColor(CONFIG.COR_ERRO);

    await channel.send({ embeds: [embedFechamento] });

    // DM ao user
    try {
      const user = await client.users.fetch(ticket.userId);
      const embedDM = new EmbedBuilder()
        .setTitle(`⭐ Ticket Fechado`)
        .setDescription([
          `ℹ️ O teu ticket foi fechado com sucesso, avalia o nosso atendimento clicando nas estrelas abaixo.`,
          ``,
          `🎫 Ticket ID: #${ticket.id}`,
          `📝 Tipo: ${ticket.label}`,
          ``,
          `👮 Fechado por:`,
          `${interaction.user.username}`,
          ``,
          `⏰ Fechado em:`,
          `${new Date().toLocaleString("pt-PT")}`,
          ``,
          `🎫 Caso necessário, não hesite em abrir ticket novamente!`
        ].join("\n"))
        .setColor(CONFIG.COR_PRINCIPAL);

      await user.send({ embeds: [embedDM] });
    } catch (e) {
      console.log("Não foi possível enviar DM ao user:", e.message);
    }

    setTimeout(async () => {
      await channel.delete().catch(() => {});
    }, 10000);
  }

  await interaction.reply({ content: `Ticket fechado com sucesso!`, flags: 64 });
}

// === PAINEL MEMBRO (comando /painelmembro) ===
async function enviarPainelMembro(interaction) {
  const ticket = Object.values(db.tickets).find(t => t.channelId === interaction.channelId && !t.closed);
  if (!ticket) {
    return interaction.reply({ content: `Nenhum ticket ativo encontrado neste canal.`, flags: 64 });
  }

  const guild = interaction.guild;
  const channel = interaction.channel;

  const members = await channel.members.fetch();
  const staffList = [];

  for (const [memberId, member] of members) {
    if (memberId === CONFIG.BOT_ID_EXCLUIR) continue;
    if (memberId === ticket.userId) continue;

    const perms = channel.permissionsFor(member);
    if (perms && perms.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages)) {
      const highestRole = member.roles.cache.sort((a, b) => b.position - a.position).first();
      staffList.push({
        member,
        rolePosition: highestRole ? highestRole.position : 0,
        roleName: highestRole ? highestRole.name : "Sem cargo",
        displayName: member.displayName || member.user.username,
      });
    }
  }

  staffList.sort((a, b) => {
    if (b.rolePosition !== a.rolePosition) return b.rolePosition - a.rolePosition;
    return a.displayName.localeCompare(b.displayName);
  });

  if (staffList.length === 0) {
    return interaction.reply({ content: `Nenhum membro da staff encontrado neste ticket.`, flags: 64 });
  }

  const staffText = staffList.map(s => `**${s.roleName}** | ${s.displayName} | <@${s.member.id}>`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`Painel Membro`)
    .setDescription([
      `Lista de staff disponível neste ticket:`,
      "",
      staffText
    ].join("\n"))
    .setColor(CONFIG.COR_PRINCIPAL);

  await interaction.reply({ embeds: [embed], flags: 64 });
}
