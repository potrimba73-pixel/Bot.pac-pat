import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";
import { updateTicketEmbed, criarTicketRecrutamento, handleTruckyVerification } from "../services/tickets.js";
import { sendPainelChamada, criarCall, apagarCall, chamarMembro } from "../services/calls.js";
import { sendLog, enviarLogAvaliacao, enviarAvaliacaoDM } from "../services/logs.js";
import { handleAjudaCommand, handleAjudaProcurar, handleAjudaModal, assistantMemory } from "../services/ajuda.js";

// Cooldown para painel membro (5 minutos = 300000ms)
const painelMembroCooldown = new Map();

export async function handleInteractionCreate(interaction, client) {
  // ========== MODAL SUBMIT ==========
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("modal_avaliar_")) {
      const parts = interaction.customId.split("_");
      const ticketId = parts[2];
      const estrelas = parseInt(parts[3]);
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket não encontrado.`, flags: 64 });
      }
      const mensagem = interaction.fields.getTextInputValue("mensagem_avaliacao") || "";
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      await enviarLogAvaliacao(ticket, estrelas, mensagem, interaction.user, client);
      if (!db.avaliacoes[ticketId]) {
        db.avaliacoes[ticketId] = [];
      }
      db.avaliacoes[ticketId].push({
        estrelas: estrelas,
        mensagem: mensagem,
        data: new Date().toISOString(),
        avaliador: interaction.user.id,
      });
      saveDB();
      await safeEditReply(interaction, { content: `${CONFIG.EMOJI_STAR} Obrigado pela sua avaliação de ${estrelas} estrelas!`, flags: 64 });
      return;
    }
    if (interaction.customId === "modal_ajuda") {
      await handleAjudaModal(interaction, client);
      return;
    }
    if (interaction.customId.startsWith("modal_trucky_")) {
      await handleTruckyVerification(interaction, client);
      return;
    }
  }

  // ========== COMANDOS DE BARRA ==========
  if (interaction.isChatInputCommand()) {
    // /apagar
    if (interaction.commandName === "apagar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas administradores podem usar este comando.`, flags: 64 });
      }
      const canaisInput = interaction.options.getString("canais");
      const guild = interaction.guild;
      let canaisParaApagar = [];
      if (canaisInput) {
        const ids = canaisInput.split(",").map((id) => id.trim());
        for (const id of ids) {
          const canal = await guild.channels.fetch(id).catch(() => null);
          if (canal) canaisParaApagar.push(canal);
        }
      } else {
        canaisParaApagar = guild.channels.cache.filter((ch) => ch.type === 0).map((ch) => ch);
      }
      await interaction.reply({ content: `${CONFIG.EMOJI_LOADING} A apagar mensagens em ${canaisParaApagar.length} canais...`, flags: 64 });
      let totalApagadas = 0;
      const erros = [];
      for (const canal of canaisParaApagar) {
        try {
          const messages = await canal.messages.fetch({ limit: 100 });
          const botMessages = messages.filter((msg) => msg.author.id === client.user.id);
          for (const msg of botMessages.values()) {
            await msg.delete().catch(() => {});
            totalApagadas++;
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (e) {
          erros.push(`${canal.name}: ${e.message}`);
        }
      }
      if (!canaisInput) {
        db.messages = {};
      } else {
        const ids = canaisInput.split(",").map((id) => id.trim());
        for (const id of ids) {
          if (db.messages.painelGeral && id === CONFIG.CANAL_TICKETS_GERAL)
            delete db.messages.painelGeral;
          if (db.messages.painelRecrutamento && id === CONFIG.CANAL_TICKETS_RECRUTAMENTO)
            delete db.messages.painelRecrutamento;
          if (db.messages.painelRegras && id === CONFIG.CANAL_REGRAS)
            delete db.messages.painelRegras;
          if (db.messages.painelRegrasRecrutamento && id === CONFIG.CANAL_REGRAS_RECRUTAMENTO)
            delete db.messages.painelRegrasRecrutamento;
        }
      }
      saveDB();
      const resposta = [
        `${CONFIG.EMOJI_BROOM} Limpeza concluída!`,
        `${CONFIG.EMOJI_CHECK} Total de mensagens apagadas: ${totalApagadas}`,
        ...(erros.length > 0 ? [`${CONFIG.EMOJI_WARNING} Erros em ${erros.length} canais`] : []),
        "",
        `${CONFIG.EMOJI_INFO} Dica: Use os comandos manuais para reenviar paineis.`
      ].join("\n");
      await safeEditReply(interaction, { content: resposta });
      return;
    }

    // /ajuda
    if (interaction.commandName === "ajuda") {
      await handleAjudaCommand(interaction, client);
      return;
    }

    // /limpar
    if (interaction.commandName === "limpar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Não tens permissão para usar este comando.`, flags: 64 });
      }
      const quantidade = interaction.options.getInteger("quantidade");
      const motivo = interaction.options.getString("motivo") || "Sem motivo especificado";
      await interaction.deferReply({ flags: 64 });
      const messages = await interaction.channel.messages.fetch({ limit: quantidade });
      for (const msg of messages.values()) {
        if (msg.deletable) {
          await msg.delete().catch(() => {});
        }
      }
      await interaction.editReply({ content: `${CONFIG.EMOJI_BROOM} ${quantidade} mensagens apagadas!\n${CONFIG.EMOJI_INFO} Motivo: ${motivo}\n${CONFIG.EMOJI_FILE} Transcript guardado no sistema.`, flags: 64 });
      return;
    }

    // /status
    if (interaction.commandName === "status") {
      const embed = new EmbedBuilder()
        .setTitle(`${CONFIG.EMOJI_INFO} Status do Bot`)
        .setDescription([
          `${CONFIG.EMOJI_USER} Bot: ${client.user.tag}`,
          `${CONFIG.EMOJI_TIME} Ping: ${client.ws.ping}ms`,
          `${CONFIG.EMOJI_TICKET} Tickets abertos: ${Object.values(db.tickets).filter(t => !t.closed).length}`,
          `${CONFIG.EMOJI_USER} Membros: ${interaction.guild.memberCount}`,
          `${CONFIG.EMOJI_TIME} Online desde: <t:${Math.floor(client.readyTimestamp / 1000)}:R>`
        ].join("\n"))
        .setColor(0x00ff00)
        .setTimestamp();
      await interaction.reply({ embeds: [embed], flags: 64 });
      return;
    }

    // /painelstaff
    if (interaction.commandName === "painelstaff") {
      const ticket = Object.values(db.tickets).find(
        t => t.channelId === interaction.channel.id && !t.closed
      );
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Este canal não é um ticket ativo.`, flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const panelText = [
        `${CONFIG.EMOJI_PAINEL} Painel de Staff — Ticket #${ticket.id}`,
        "",
        `${CONFIG.EMOJI_USER} Criador: ${ticket.username}`,
        `${CONFIG.EMOJI_INFO} Tipo: ${ticket.label}`,
        `${CONFIG.EMOJI_STAFF} Assumido por: ${ticket.claimedBy ? ticket.claimedByName : "Ninguém"}`,
        `${CONFIG.EMOJI_CALL} Call: ${ticket.callActive ? "Ativa" : "Inativa"}`,
        "",
        `${CONFIG.EMOJI_INFO} Seleciona uma opção abaixo:`,
      ].join("\n");
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`criar_call_${ticket.id}`).setLabel(`${CONFIG.EMOJI_CALL} Criar Call`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`apagar_call_${ticket.id}`).setLabel(`${CONFIG.EMOJI_FECHAR} Apagar Call`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`chamar_membro_${ticket.id}`).setLabel(`${CONFIG.EMOJI_CHAMAR} Chamar Membro`).setStyle(ButtonStyle.Success),
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`passar_ticket_${ticket.id}`).setLabel(`${CONFIG.EMOJI_PASSAR} Passar Ticket`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`add_user_${ticket.id}`).setLabel(`${CONFIG.EMOJI_ADD} Adicionar User`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`remove_user_${ticket.id}`).setLabel(`${CONFIG.EMOJI_REMOVE} Remover User`).setStyle(ButtonStyle.Secondary),
      );
      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`deletar_${ticket.id}`).setLabel(`${CONFIG.EMOJI_FECHAR} Fechar Ticket`).setStyle(ButtonStyle.Danger),
      );
      await interaction.editReply({ content: panelText, components: [row1, row2, row3], flags: 64 });
      return;
    }

    // /passar
    if (interaction.commandName === "passar") {
      const ticket = Object.values(db.tickets).find(
        t => t.channelId === interaction.channel.id && !t.closed
      );
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Este canal não é um ticket ativo.`, flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 });
      }
      if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
        return interaction.reply({ content: `${CONFIG.EMOJI_WARNING} Só quem assumiu o ticket pode passá-lo. Usa /pedirassumo primeiro.`, flags: 64 });
      }
      const targetStaff = interaction.options.getUser("staff");
      const targetMember = await interaction.guild.members.fetch(targetStaff.id).catch(() => null);
      if (!targetMember || !targetMember.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} O utilizador selecionado não é staff.`, flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const oldClaimed = ticket.claimedByName;
      ticket.claimedBy = targetStaff.id;
      ticket.claimedByName = targetStaff.username;
      saveDB();
      await updateTicketEmbed(interaction.channel, ticket.id);
      await interaction.channel.send(
        `${CONFIG.EMOJI_PASSAR} Ticket passado! ${interaction.user.username} passou o controlo para ${targetStaff.username}.`
      );
      await interaction.editReply({ content: `${CONFIG.EMOJI_SUCCESS} Ticket passado para ${targetStaff.username} com sucesso!`, flags: 64 });
      return;
    }

    // /pedirassumo
    if (interaction.commandName === "pedirassumo") {
      const ticket = Object.values(db.tickets).find(
        t => t.channelId === interaction.channel.id && !t.closed
      );
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Este canal não é um ticket ativo.`, flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 });
      }
      if (!ticket.claimedBy) {
        ticket.claimedBy = interaction.user.id;
        ticket.claimedByName = interaction.user.username;
        saveDB();
        await updateTicketEmbed(interaction.channel, ticket.id);
        await interaction.reply({ content: `${CONFIG.EMOJI_SUCCESS} Ticket assumido! Ninguém tinha assumido ainda.`, flags: 64 });
        await interaction.channel.send(
          `${CONFIG.EMOJI_STAFF} ${interaction.user.username} assumiu este ticket.`
        );
        return;
      }
      if (ticket.claimedBy === interaction.user.id) {
        return interaction.reply({ content: `${CONFIG.EMOJI_WARNING} Já assumiste este ticket!`, flags: 64 });
      }
      const currentStaff = await client.users.fetch(ticket.claimedBy).catch(() => null);
      if (!currentStaff) {
        ticket.claimedBy = interaction.user.id;
        ticket.claimedByName = interaction.user.username;
        saveDB();
        await updateTicketEmbed(interaction.channel, ticket.id);
        await interaction.reply({ content: `${CONFIG.EMOJI_SUCCESS} O staff anterior não foi encontrado. Ticket assumido por ti!`, flags: 64 });
        return;
      }
      await interaction.deferReply({ flags: 64 });
      try {
        const requestEmbed = new EmbedBuilder()
          .setTitle(`${CONFIG.EMOJI_CHAMAR} Pedido de Assumo`)
          .setDescription([
            `${interaction.user.username} pediu assumo do teu ticket.`,
            "",
            `${CONFIG.EMOJI_TICKET} Ticket: #${ticket.id}`,
            `${CONFIG.EMOJI_USER} Criador: ${ticket.username}`,
            `${CONFIG.EMOJI_INFO} Canal: <#${ticket.channelId}>`,
            "",
            `${CONFIG.EMOJI_QUESTION} Queres passar o controlo?`,
          ].join("\n"))
          .setColor(0xff9800)
          .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`aceitar_assumo_${ticket.id}_${interaction.user.id}`).setLabel(`${CONFIG.EMOJI_ACEITAR} Sim, Passar`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recusar_assumo_${ticket.id}_${interaction.user.id}`).setLabel(`${CONFIG.EMOJI_RECUSAR} Não, Ficar`).setStyle(ButtonStyle.Danger),
        );
        await currentStaff.send({ embeds: [requestEmbed], components: [row] });
        await interaction.editReply({ content: `${CONFIG.EMOJI_SUCCESS} Pedido enviado para ${currentStaff.username}! Aguarda resposta...`, flags: 64 });
      } catch (e) {
        ticket.claimedBy = interaction.user.id;
        ticket.claimedByName = interaction.user.username;
        saveDB();
        await updateTicketEmbed(interaction.channel, ticket.id);
        await interaction.editReply({ content: `${CONFIG.EMOJI_SUCCESS} O staff anterior tem DMs desativadas. Ticket assumido por ti!`, flags: 64 });
      }
      return;
    }
    return;
  }

  // ========== SELECT MENUS ==========
  // NAO fazer deferReply aqui — showModal precisa de interacao nao deferida
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_geral") {
      const type = interaction.values[0];
      const labels = {
        bugs: `${CONFIG.EMOJI_BUGS} Bugs`,
        denuncia: `${CONFIG.EMOJI_DENUNCIA} Denúncia`,
        suporte: `${CONFIG.EMOJI_SUPORTE} Suporte`,
        criador: `${CONFIG.EMOJI_CRIADOR} Criador De Conteudo`,
      };
      const { createTicket } = await import("../services/tickets.js");
      await createTicket(interaction, type, labels[type], client);
    } else if (interaction.customId === "ticket_recrutamento") {
      const type = interaction.values[0];
      const labels = {
        recrutamento: `${CONFIG.EMOJI_RECRUTAMENTO} Recrutamento PAT`,
        ajuda: `${CONFIG.EMOJI_AJUDA} Pedir ajuda`,
      };
      const { createTicket } = await import("../services/tickets.js");
      await createTicket(interaction, type, labels[type], client);
    }
    return;
  }

  // ========== BUTTONS ==========
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // /AJUDA - BOTOES
    if (customId === "ajuda_procurar") {
      await handleAjudaProcurar(interaction);
      return;
    }
    if (customId === "ajuda_ticket") {
      await interaction.reply({ content: `${CONFIG.EMOJI_TICKET} Abre um ticket aqui: <#${CONFIG.CANAL_TICKETS_GERAL}>`, flags: 64 });
      return;
    }
    if (customId === "ajuda_nova") {
      await handleAjudaCommand(interaction, client);
      return;
    }

    // ASSISTENTE INTELIGENTE - BOTOES
    if (customId.startsWith("smart_helpful_")) {
      await interaction.update({ content: interaction.message.content + "\n✅ O utilizador confirmou que resolveu!", components: [], embeds: interaction.message.embeds });
      return;
    }
    if (customId.startsWith("smart_not_helpful_")) {
      await interaction.update({ content: "❌ O utilizador indicou que não resolveu. Staff pode ajudar!", components: [] });
      return;
    }
    if (customId.startsWith("smart_search_")) {
      await interaction.update({ content: `${CONFIG.EMOJI_SEARCH} A pesquisar na internet... (funcionalidade em desenvolvimento)`, components: [] });
      return;
    }
    if (customId.startsWith("smart_do_search_")) {
      await interaction.update({ content: `${CONFIG.EMOJI_SEARCH} A pesquisar na internet... (funcionalidade em desenvolvimento)`, components: [] });
      return;
    }
    if (customId === "smart_cancel") {
      await interaction.update({ content: `${CONFIG.EMOJI_CROSS} Pesquisa cancelada.`, components: [] });
      return;
    }

    // RECRUTAMENTO - ACEITAR/RECUSAR REGRAS
    if (customId.startsWith("aceitar_regras_rec_")) {
      await interaction.deferUpdate();
      const parts = customId.split("_");
      const userId = parts[3];
      const nomeTrucky = parts.slice(4).join("_");
      if (interaction.user.id !== userId) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Não podes aceitar por outra pessoa!`, components: [] });
      }
      await criarTicketRecrutamento(interaction, client, nomeTrucky);
      return;
    }
    if (customId.startsWith("recusar_regras_rec_")) {
      await interaction.deferUpdate();
      const userId = customId.split("_")[3];
      if (interaction.user.id !== userId) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Não podes recusar por outra pessoa!`, components: [] });
      }
      await interaction.editReply({
        content: `${CONFIG.EMOJI_CROSS} Recusaste as regras. Não foi criado nenhum ticket de recrutamento.`,
        components: [], embeds: [],
      });
      return;
    }

    // Aceitar Regras
    if (customId === "aceitar_regras") {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const member = interaction.member;
      const userId = member.id;
      const temCargoMembro = member.roles.cache.has(CONFIG.CARGO_MEMBRO) || member.roles.cache.has(CONFIG.CARGO_VERIFICADO);
      const jaAceitou = db.acceptedRules.includes(userId);
      if (jaAceitou && temCargoMembro) {
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_CHECK} Já aceitaste as regras e tens o cargo atribuído!`, flags: 64 });
      }
      try {
        const guildId = interaction.guild.id;
        const isRecrutamentoGuild = guildId === CONFIG.GUILD_ID_RECRUTAMENTO;
        let rolesToAdd;
        if (isRecrutamentoGuild) {
          rolesToAdd = [CONFIG.CARGO_RECRUTAMENTO_1, CONFIG.CARGO_RECRUTAMENTO_2];
        } else {
          rolesToAdd = [CONFIG.CARGO_MEMBRO, CONFIG.CARGO_VERIFICADO];
        }
        const rolesAdded = [];
        const rolesFailed = [];
        for (const roleId of rolesToAdd) {
          if (roleId && roleId !== "ID_CARGO_X") {
            try {
              const role = interaction.guild.roles.cache.get(roleId);
              if (role && !member.roles.cache.has(roleId)) {
                await member.roles.add(roleId);
                rolesAdded.push(role.name);
              }
            } catch (roleError) {
              rolesFailed.push(roleId);
              console.error(`Erro ao adicionar cargo ${roleId}:`, roleError.message);
            }
          }
        }
        if (!db.acceptedRules.includes(userId)) {
          db.acceptedRules.push(userId);
        }
        saveDB();
        let mensagem = `${CONFIG.EMOJI_SUCCESS} Regras aceites! Bem-vindo à comunidade.`;
        if (rolesAdded.length > 0) {
          mensagem += `\n${CONFIG.EMOJI_CHECK} Cargos atribuídos: ${rolesAdded.join(", ")}`;
        }
        await safeEditReply(interaction, { content: mensagem, flags: 64 });
      } catch (error) {
        console.error("Erro ao aceitar regras:", error);
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Ocorreu um erro ao processar. Tenta novamente ou contacta a staff.`, flags: 64 });
      }
      return;
    }

    // Sair do ticket
    if (customId.startsWith("sair_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[1];
      const ticket = db.tickets[ticketId];
      if (ticket && ticket.userId === interaction.user.id) {
        await interaction.channel.permissionOverwrites.delete(interaction.user.id);
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_SAIR} Saíste do ticket. Podes fechá-lo se desejares.`, flags: 64 });
      } else {
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Apenas o criador do ticket pode sair.`, flags: 64 });
      }
      return;
    }

    // Assumir ticket
    if (customId.startsWith("assumir_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[1];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Apenas staff pode assumir tickets.`, flags: 64 });
      }
      if (ticket.claimedBy) {
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_WARNING} Este ticket já foi assumido por ${ticket.claimedByName}.`, flags: 64 });
      }
      ticket.claimedBy = interaction.user.id;
      ticket.claimedByName = interaction.user.username;
      saveDB();
      await updateTicketEmbed(interaction.channel, ticketId);
      await interaction.channel.send(
        `${CONFIG.EMOJI_STAFF} ${interaction.user.username} assumiu este ticket.`,
      );
      await sendLog(ticketId, "claim", client);
      await safeEditReply(interaction, { content: `${CONFIG.EMOJI_SUCCESS} Ticket assumido com sucesso!`, flags: 64 });
      return;
    }

    // Painel Staff - REMOVIDO do botao "Painel Staff" no ticket
    // Agora so via /painelstaff
    if (customId.startsWith("painel_")) {
      await interaction.reply({ 
        content: `${CONFIG.EMOJI_INFO} Usa o comando **/painelstaff** para aceder ao painel de staff.`, 
        flags: 64 
      });
      return;
    }

    // Painel Membro - Novo botao para chamar staff com cooldown
    if (customId.startsWith("painel_membro_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;

      // Verificar cooldown (5 minutos)
      const now = Date.now();
      const lastUse = painelMembroCooldown.get(interaction.user.id);
      if (lastUse && (now - lastUse) < 300000) {
        const remaining = Math.ceil((300000 - (now - lastUse)) / 1000);
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        return interaction.reply({ 
          content: `${CONFIG.EMOJI_TIME} Aguarda ${minutes}m ${seconds}s antes de chamar a staff novamente.`, 
          flags: 64 
        });
      }

      painelMembroCooldown.set(interaction.user.id, now);

      // Notificar staff
      try {
        const staffRole = await interaction.guild.roles.fetch(CONFIG.CARGO_STAFF).catch(() => null);
        if (staffRole) {
          await interaction.channel.send({
            content: `${CONFIG.EMOJI_CHAMAR} ${staffRole} — ${interaction.user.username} está a pedir ajuda no ticket!`,
          });
        }
        await interaction.reply({ 
          content: `${CONFIG.EMOJI_SUCCESS} Staff notificada! Aguarda resposta...`, 
          flags: 64 
        });
      } catch (e) {
        await interaction.reply({ 
          content: `${CONFIG.EMOJI_ERROR} Erro ao notificar staff.`, 
          flags: 64 
        });
      }
      return;
    }

    // DELETAR TICKET
    if (customId.startsWith("deletar_")) {
      const ticketId = customId.split("_")[1];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket não encontrado.`, flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF) && ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff ou o criador pode fechar.`, flags: 64 });
      }
      const deferred = await safeDeferReply(interaction);
      if (!deferred) return;

      // LIMPAR CALL SE EXISTIR
      if (ticket.callActive && ticket.callChannelId) {
        const callChannel = await interaction.guild.channels.fetch(ticket.callChannelId).catch(() => null);
        if (callChannel) await callChannel.delete();
        ticket.callActive = false;
        ticket.callChannelId = null;
      }

      // GERAR TRANSCRIPT COMO FICHEIRO HTML DIRETO
      let transcriptAttachment = null;
      const ticketChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (ticketChannel) {
        const { gerarTranscript } = await import("../utils/transcript.js");
        transcriptAttachment = await gerarTranscript(ticketChannel, ticketId);
        if (transcriptAttachment) {
          ticket.transcriptUrl = transcriptAttachment.fileName;
        }
      }

      // RECRUTAMENTO
      if (ticket.type === "recrutamento") {
        const embedRecrutamento = new EmbedBuilder()
          .setTitle(`${CONFIG.EMOJI_RECRUTAMENTO} Ticket de Recrutamento - Aguardando Decisão`)
          .setDescription([
            `${CONFIG.EMOJI_INFO} Este ticket de recrutamento foi marcado para fecho.`,
            "",
            `${CONFIG.EMOJI_STAFF} Fechado por: ${interaction.user.username}`,
            "",
            `${CONFIG.EMOJI_TIME} Aguardando decisão da staff...`,
            "",
            `${CONFIG.EMOJI_QUESTION} O utilizador foi recrutado?`,
          ].join("\n"))
          .setColor(0xFFA500);
        const rowRecrutamento = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`recrutado_sim_${ticketId}`).setLabel(`${CONFIG.EMOJI_RECRUTADO} Sim - Recrutado`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recrutado_nao_${ticketId}`).setLabel(`${CONFIG.EMOJI_NAO_RECRUTADO} Não - Não Recrutado`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`fechar_definitivo_${ticketId}`).setLabel(`${CONFIG.EMOJI_FECHAR_DEF} Fechar Definitivo`).setStyle(ButtonStyle.Secondary),
        );
        await interaction.channel.send({ embeds: [embedRecrutamento], components: [rowRecrutamento] });
        ticket.closedBy = interaction.user.id;
        ticket.closedByName = interaction.user.username;
        ticket.closedAt = new Date().toISOString();
        ticket.closed = true;
        saveDB();
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_INFO} Ticket de recrutamento aguarda decisão da staff.` });
        return;
      }

      // TICKET NORMAL
      const dataFechamento = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
      const embedFechamento = new EmbedBuilder()
        .setTitle(`${CONFIG.EMOJI_FECHAR} Ticket Fechado`)
        .setDescription([
          `${CONFIG.EMOJI_INFO} Seu ticket foi fechado com sucesso, avalie nosso atendimento enviado no seu privado.`,
          "",
          `${CONFIG.EMOJI_STAFF} Fechado por:`,
          interaction.user.username,
          "",
          `${CONFIG.EMOJI_TIME} Fechado em:`,
          dataFechamento,
          "",
          `${CONFIG.EMOJI_TICKET} Caso necessário, não hesite em abrir ticket novamente!`
        ].join("\n"))
        .setColor(0xFF0000);
      await interaction.channel.send({ embeds: [embedFechamento], content: `${CONFIG.EMOJI_USER} ${ticket.username}` });
      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      ticket.closedAt = new Date().toISOString();
      ticket.closed = true;
      saveDB();
      await enviarAvaliacaoDM(ticket, client);
      await sendLog(ticketId, "close", client);
      await safeEditReply(interaction, { content: `${CONFIG.EMOJI_TIME} Ticket será fechado em 10 segundos...` });
      setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
      }, 10000);
      return;
    }

    // AVALIAÇÃO POR ESTRELAS
    if (customId.startsWith("avaliar_")) {
      const parts = customId.split("_");
      const estrelas = parseInt(parts[1]);
      const ticketId = parts[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket não encontrado.`, flags: 64 });
      }
      if (db.avaliacoes[ticketId] && db.avaliacoes[ticketId].some(a => a.avaliador === interaction.user.id)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_WARNING} Já avaliaste este ticket!`, flags: 64 });
      }
      const modal = new ModalBuilder()
        .setCustomId(`modal_avaliar_${ticketId}_${estrelas}`)
        .setTitle(`${CONFIG.EMOJI_STAR} Avaliação - ${estrelas} Estrelas`);
      const inputMensagem = new TextInputBuilder()
        .setCustomId("mensagem_avaliacao")
        .setLabel("Mensagem (opcional)")
        .setPlaceholder("Deixa uma mensagem sobre o atendimento...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500);
      const actionRow = new ActionRowBuilder().addComponents(inputMensagem);
      modal.addComponents(actionRow);
      await interaction.showModal(modal);
      return;
    }

    // Botões de recrutamento
    if (customId.startsWith("recrutado_sim_")) {
      await interaction.deferUpdate();
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
      if (!mainGuild) return;
      const member = await mainGuild.members.fetch(ticket.userId).catch(() => null);
      if (member && CONFIG.CARGO_RECRUTADO) {
        await member.roles.add(CONFIG.CARGO_RECRUTADO).catch(console.error);
      }
      ticket.recrutado = true;
      saveDB();
      const ticketChannel = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
      if (ticketChannel) {
        await ticketChannel.send(`${CONFIG.EMOJI_SUCCESS} Utilizador recrutado com sucesso!`);
      }
      await sendLog(ticketId, "close", client);
      return;
    }

    if (customId.startsWith("recrutado_nao_")) {
      await interaction.deferUpdate();
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      ticket.recrutado = false;
      saveDB();
      const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
      if (mainGuild) {
        const ticketChannel = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
        if (ticketChannel) {
          await ticketChannel.send(`${CONFIG.EMOJI_CROSS} Utilizador não foi recrutado.`);
        }
      }
      await sendLog(ticketId, "close", client);
      return;
    }

    // Fechar Definitivo
    if (customId.startsWith("fechar_definitivo_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket não encontrado.`, flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff.`, flags: 64 });
      }
      await interaction.deferUpdate();
      const dataFechamento = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
      const embedFechamento = new EmbedBuilder()
        .setTitle(`${CONFIG.EMOJI_LOCK} Ticket Fechado Definitivamente`)
        .setDescription([
          `${CONFIG.EMOJI_INFO} Seu ticket foi fechado com sucesso.`,
          "",
          `${CONFIG.EMOJI_STAFF} Fechado por:`,
          interaction.user.username,
          "",
          `${CONFIG.EMOJI_TIME} Fechado em:`,
          dataFechamento,
        ].join("\n"))
        .setColor(0xFF0000);
      await interaction.channel.send({ embeds: [embedFechamento], content: `${CONFIG.EMOJI_USER} ${ticket.username}` });
      await enviarAvaliacaoDM(ticket, client);
      await sendLog(ticketId, "close", client);
      setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
      }, 10000);
      return;
    }

    // Criar Call
    if (customId.startsWith("criar_call_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      await criarCall(interaction, ticketId, client);
      return;
    }

    // Apagar Call
    if (customId.startsWith("apagar_call_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      await apagarCall(interaction, ticketId, client);
      return;
    }

    // Chamar Membro
    if (customId.startsWith("chamar_membro_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      await chamarMembro(interaction, ticketId, client);
      return;
    }

    // Aceitar Assumo
    if (customId.startsWith("aceitar_assumo_")) {
      await interaction.deferUpdate();
      const parts = customId.split("_");
      const ticketId = parts[2];
      const requesterId = parts[3];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Ticket não encontrado.`, components: [] });
      }
      if (ticket.claimedBy !== interaction.user.id) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Não és o staff atual deste ticket.`, components: [] });
      }
      const oldStaff = ticket.claimedByName;
      ticket.claimedBy = requesterId;
      ticket.claimedByName = (await client.users.fetch(requesterId)).username;
      saveDB();
      const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
      if (mainGuild) {
        const ticketChannel = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
        if (ticketChannel) {
          await ticketChannel.send(
            `${CONFIG.EMOJI_PASSAR} Controlo transferido! ${oldStaff} passou o ticket para ${ticket.claimedByName}.`
          );
        }
      }
      try {
        const requester = await client.users.fetch(requesterId);
        await requester.send(`${CONFIG.EMOJI_SUCCESS} O teu pedido de assumo foi aceite! Agora és o responsável pelo ticket #${ticketId}.`);
      } catch (e) {}
      await interaction.editReply({ content: `${CONFIG.EMOJI_SUCCESS} Passaste o controlo do ticket para ${ticket.claimedByName}.`, components: [] });
      return;
    }

    // Recusar Assumo
    if (customId.startsWith("recusar_assumo_")) {
      await interaction.deferUpdate();
      const parts = customId.split("_");
      const ticketId = parts[2];
      const requesterId = parts[3];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Ticket não encontrado.`, components: [] });
      }
      try {
        const requester = await client.users.fetch(requesterId);
        await requester.send(`${CONFIG.EMOJI_CROSS} O teu pedido de assumo foi recusado. O staff atual mantém o controlo do ticket #${ticketId}.`);
      } catch (e) {}
      await interaction.editReply({ content: `${CONFIG.EMOJI_INFO} Recusaste passar o controlo. O ticket continua contigo.`, components: [] });
      return;
    }

    // Passar Ticket button
    if (customId.startsWith("passar_ticket_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Ticket não encontrado.`, flags: 64 });
      }
      if (ticket.claimedBy !== interaction.user.id) {
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_WARNING} Só quem assumiu pode passar. Usa /pedirassumo.`, flags: 64 });
      }
      await safeEditReply(interaction, { content: `${CONFIG.EMOJI_INFO} Usa o comando /passar @staff para passar o controlo para outro membro da staff.`, flags: 64 });
      return;
    }

    // Re-entrar no Ticket
    if (customId.startsWith("reentrar_ticket_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket não encontrado ou já fechado.`, flags: 64 });
      }
      try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const channel = await guild.channels.fetch(ticket.channelId);
        await channel.permissionOverwrites.edit(interaction.user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        await interaction.reply({ content: `${CONFIG.EMOJI_SUCCESS} Re-entraste no ticket! Acede aqui: <#${ticket.channelId}>`, flags: 64 });
      } catch (e) {
        await interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Erro ao re-entrar no ticket. Contacta a staff.`, flags: 64 });
      }
      return;
    }

    // Adicionar Usuário
    if (customId.startsWith("add_user_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      await interaction.reply({ content: `${CONFIG.EMOJI_INFO} Para adicionar um usuário, menciona-o neste canal e um staff pode adicionar manualmente nas permissões.`, flags: 64 });
      return;
    }

    // Remover Usuário
    if (customId.startsWith("remove_user_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      await interaction.reply({ content: `${CONFIG.EMOJI_INFO} Para remover um usuário, um staff pode remover manualmente nas permissões do canal.`, flags: 64 });
      return;
    }
  }
}
