import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";
import { updateTicketEmbed } from "../services/tickets.js";
import { sendPainelChamada, criarCall, apagarCall, chamarMembro } from "../services/calls.js";
import { sendLog, enviarLogAvaliacao, enviarAvaliacaoDM } from "../services/logs.js";
import { handleAjudaCommand, handleAjudaProcurar, handleAjudaModal, assistantMemory } from "../services/ajuda.js";
import { handleTruckyVerification, criarTicketRecrutamento } from "../services/tickets.js";

export async function handleInteractionCreate(interaction, client) {
  // ========== MODAL SUBMIT ==========
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("modal_avaliar_")) {
      const parts = interaction.customId.split("_");
      const ticketId = parts[2];
      const estrelas = parseInt(parts[3]);
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: "Ticket nao encontrado.", flags: 64 });
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
      await safeEditReply(interaction, { content: `Obrigado pela sua avaliacao de ${estrelas} estrelas!`, flags: 64 });
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
        return interaction.reply({ content: "Apenas administradores podem usar este comando.", flags: 64 });
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
      await interaction.reply({ content: `A apagar mensagens em ${canaisParaApagar.length} canais...`, flags: 64 });
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
        "Limpeza concluida!",
        `Total de mensagens apagadas: ${totalApagadas}`,
        ...(erros.length > 0 ? [`Erros em ${erros.length} canais`] : []),
        "",
        "Dica: Use os comandos manuais para reenviar paineis."
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
        return interaction.reply({ content: "Nao tens permissao para usar este comando.", flags: 64 });
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
      await interaction.editReply({ content: `${quantidade} mensagens apagadas!\nMotivo: ${motivo}\nTranscript guardado no sistema.`, flags: 64 });
      return;
    }

    // /status
    if (interaction.commandName === "status") {
      const embed = new EmbedBuilder()
        .setTitle("Status do Bot")
        .setDescription([
          `Bot: ${client.user.tag}`,
          `Ping: ${client.ws.ping}ms`,
          `Tickets abertos: ${Object.values(db.tickets).filter(t => !t.closed).length}`,
          `Membros: ${interaction.guild.memberCount}`,
          `Online desde: <t:${Math.floor(client.readyTimestamp / 1000)}:R>`
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
        return interaction.reply({ content: "Este canal nao e um ticket ativo.", flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: "Apenas staff pode usar este comando.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const panelText = [
        `Painel de Staff — Ticket #${ticket.id}`,
        "",
        `Criador: ${ticket.username}`,
        `Tipo: ${ticket.label}`,
        `Assumido por: ${ticket.claimedBy ? ticket.claimedByName : "Ninguem"}`,
        `Call: ${ticket.callActive ? "Ativa" : "Inativa"}`,
        "",
        "Seleciona uma opcao abaixo:",
      ].join("\n");
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`criar_call_${ticket.id}`).setLabel("Criar Call").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`apagar_call_${ticket.id}`).setLabel("Apagar Call").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`chamar_membro_${ticket.id}`).setLabel("Chamar Membro").setStyle(ButtonStyle.Success),
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`passar_ticket_${ticket.id}`).setLabel("Passar Ticket").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`add_user_${ticket.id}`).setLabel("Adicionar User").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`remove_user_${ticket.id}`).setLabel("Remover User").setStyle(ButtonStyle.Secondary),
      );
      const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`deletar_${ticket.id}`).setLabel("Fechar Ticket").setStyle(ButtonStyle.Danger),
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
        return interaction.reply({ content: "Este canal nao e um ticket ativo.", flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: "Apenas staff pode usar este comando.", flags: 64 });
      }
      if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
        return interaction.reply({ content: "So quem assumiu o ticket pode passá-lo. Usa /pedirassumo primeiro.", flags: 64 });
      }
      const targetStaff = interaction.options.getUser("staff");
      const targetMember = await interaction.guild.members.fetch(targetStaff.id).catch(() => null);
      if (!targetMember || !targetMember.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: "O utilizador selecionado nao e staff.", flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      const oldClaimed = ticket.claimedByName;
      ticket.claimedBy = targetStaff.id;
      ticket.claimedByName = targetStaff.username;
      saveDB();
      await updateTicketEmbed(interaction.channel, ticket.id);
      await interaction.channel.send(
        `Ticket passado! ${interaction.user.username} passou o controlo para ${targetStaff.username}.`
      );
      await interaction.editReply({ content: `Ticket passado para ${targetStaff.username} com sucesso!`, flags: 64 });
      return;
    }

    // /pedirassumo
    if (interaction.commandName === "pedirassumo") {
      const ticket = Object.values(db.tickets).find(
        t => t.channelId === interaction.channel.id && !t.closed
      );
      if (!ticket) {
        return interaction.reply({ content: "Este canal nao e um ticket ativo.", flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: "Apenas staff pode usar este comando.", flags: 64 });
      }
      if (!ticket.claimedBy) {
        ticket.claimedBy = interaction.user.id;
        ticket.claimedByName = interaction.user.username;
        saveDB();
        await updateTicketEmbed(interaction.channel, ticket.id);
        await interaction.reply({ content: "Ticket assumido! Ninguem tinha assumido ainda.", flags: 64 });
        await interaction.channel.send(
          `${interaction.user.username} assumiu este ticket.`
        );
        return;
      }
      if (ticket.claimedBy === interaction.user.id) {
        return interaction.reply({ content: "Ja assumiste este ticket!", flags: 64 });
      }
      const currentStaff = await client.users.fetch(ticket.claimedBy).catch(() => null);
      if (!currentStaff) {
        ticket.claimedBy = interaction.user.id;
        ticket.claimedByName = interaction.user.username;
        saveDB();
        await updateTicketEmbed(interaction.channel, ticket.id);
        await interaction.reply({ content: "O staff anterior nao foi encontrado. Ticket assumido por ti!", flags: 64 });
        return;
      }
      await interaction.deferReply({ flags: 64 });
      try {
        const requestEmbed = new EmbedBuilder()
          .setTitle("Pedido de Assumo")
          .setDescription([
            `${interaction.user.username} pediu assumo do teu ticket.`,
            "",
            `Ticket: #${ticket.id}`,
            `Criador: ${ticket.username}`,
            `Canal: <#${ticket.channelId}>`,
            "",
            "Queres passar o controlo?",
          ].join("\n"))
          .setColor(0xff9800)
          .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`aceitar_assumo_${ticket.id}_${interaction.user.id}`).setLabel("Sim, Passar").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recusar_assumo_${ticket.id}_${interaction.user.id}`).setLabel("Nao, Ficar").setStyle(ButtonStyle.Danger),
        );
        await currentStaff.send({ embeds: [requestEmbed], components: [row] });
        await interaction.editReply({ content: `Pedido enviado para ${currentStaff.username}! Aguarda resposta...`, flags: 64 });
      } catch (e) {
        ticket.claimedBy = interaction.user.id;
        ticket.claimedByName = interaction.user.username;
        saveDB();
        await updateTicketEmbed(interaction.channel, ticket.id);
        await interaction.editReply({ content: "O staff anterior tem DMs desativadas. Ticket assumido por ti!", flags: 64 });
      }
      return;
    }
    return;
  }

  // ========== SELECT MENUS ==========
  if (interaction.isStringSelectMenu()) {
    // NAO fazer deferReply aqui — showModal precisa de interacao nao deferida
    if (interaction.customId === "ticket_geral") {
      const type = interaction.values[0];
      const labels = {
        bugs: CONFIG.EMOJI_BUGS + " Bugs",
        denuncia: CONFIG.EMOJI_DENUNCIA + " Denuncia",
        suporte: CONFIG.EMOJI_SUPORTE + " Suporte",
        criador: CONFIG.EMOJI_CRIADOR + " Criador De Conteudo",
      };
      const { createTicket } = await import("../services/tickets.js");
      await createTicket(interaction, type, labels[type], client);
    } else if (interaction.customId === "ticket_recrutamento") {
      const type = interaction.values[0];
      const labels = {
        recrutamento: CONFIG.EMOJI_RECRUTAMENTO + " Recrutamento PAT",
        ajuda: CONFIG.EMOJI_AJUDA + " Pedir ajuda",
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
      await interaction.reply({ content: `Abre um ticket aqui: <#${CONFIG.CANAL_TICKETS_GERAL}>`, flags: 64 });
      return;
    }
    if (customId === "ajuda_nova") {
      await handleAjudaCommand(interaction, client);
      return;
    }

    // ASSISTENTE INTELIGENTE - BOTOES
    if (customId.startsWith("smart_helpful_")) {
      await interaction.update({ content: interaction.message.content + "\nO utilizador confirmou que resolveu!", components: [], embeds: interaction.message.embeds });
      return;
    }
    if (customId.startsWith("smart_not_helpful_")) {
      await interaction.update({ content: "O utilizador indicou que nao resolveu. Staff pode ajudar!", components: [] });
      return;
    }
    if (customId.startsWith("smart_search_")) {
      await interaction.update({ content: "A pesquisar na internet... (funcionalidade em desenvolvimento)", components: [] });
      return;
    }
    if (customId.startsWith("smart_do_search_")) {
      await interaction.update({ content: "A pesquisar na internet... (funcionalidade em desenvolvimento)", components: [] });
      return;
    }
    if (customId === "smart_cancel") {
      await interaction.update({ content: "Pesquisa cancelada.", components: [] });
      return;
    }

    // RECRUTAMENTO - ACEITAR/RECUSAR REGRAS
    if (customId.startsWith("aceitar_regras_rec_")) {
      await interaction.deferUpdate();
      const parts = customId.split("_");
      const userId = parts[3];
      const nomeTrucky = parts.slice(4).join("_");
      if (interaction.user.id !== userId) {
        return interaction.editReply({ content: "Nao podes aceitar por outra pessoa!", components: [] });
      }
      await criarTicketRecrutamento(interaction, client, nomeTrucky);
      return;
    }
    if (customId.startsWith("recusar_regras_rec_")) {
      await interaction.deferUpdate();
      const userId = customId.split("_")[3];
      if (interaction.user.id !== userId) {
        return interaction.editReply({ content: "Nao podes recusar por outra pessoa!", components: [] });
      }
      await interaction.editReply({
        content: "Recusaste as regras. Nao foi criado nenhum ticket de recrutamento.",
        components: [], embeds: [],
      });
      return;
    }

    // Aceitar Regras
    if (customId === "aceitar_regras") {
      const member = interaction.member;
      const userId = member.id;
      const temCargoMembro = member.roles.cache.has(CONFIG.CARGO_MEMBRO) || member.roles.cache.has(CONFIG.CARGO_VERIFICADO);
      const jaAceitou = db.acceptedRules.includes(userId);
      if (jaAceitou && temCargoMembro) {
        return interaction.reply({ content: "Ja aceitaste as regras e tens o cargo atribuido!", flags: 64 });
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
        let mensagem = "Regras aceites! Bem-vindo a comunidade.";
        if (rolesAdded.length > 0) {
          mensagem += `\nCargos atribuidos: ${rolesAdded.join(", ")}`;
        }
        await interaction.reply({ content: mensagem, flags: 64 });
      } catch (error) {
        console.error("Erro ao aceitar regras:", error);
        await interaction.reply({ content: "Ocorreu um erro ao processar. Tenta novamente ou contacta a staff.", flags: 64 });
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
        await safeEditReply(interaction, { content: "Saiste do ticket. Podes fecha-lo se desejares.", flags: 64 });
      } else {
        await safeEditReply(interaction, { content: "Apenas o criador do ticket pode sair.", flags: 64 });
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
        return safeEditReply(interaction, { content: "Apenas staff pode assumir tickets.", flags: 64 });
      }
      if (ticket.claimedBy) {
        return safeEditReply(interaction, { content: `Este ticket ja foi assumido por ${ticket.claimedByName}.`, flags: 64 });
      }
      ticket.claimedBy = interaction.user.id;
      ticket.claimedByName = interaction.user.username;
      saveDB();
      await updateTicketEmbed(interaction.channel, ticketId);
      await interaction.channel.send(
        `${interaction.user.username} assumiu este ticket.`,
      );
      await sendLog(ticketId, "claim", client);
      await safeEditReply(interaction, { content: "Ticket assumido com sucesso!", flags: 64 });
      return;
    }

    // Painel Staff
    if (customId.startsWith("painel_")) {
      const ticketId = customId.split("_")[1];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: "Apenas staff pode aceder ao painel.", flags: 64 });
      }
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      await sendPainelChamada(interaction.channel, ticketId, interaction);
      return;
    }

    // DELETAR TICKET
    if (customId.startsWith("deletar_")) {
      const ticketId = customId.split("_")[1];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: "Ticket nao encontrado.", flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF) && ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: "Apenas staff ou o criador pode fechar.", flags: 64 });
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

      // GERAR TRANSCRIPT ANTES DE APAGAR
      let transcriptData = null;
      const ticketChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (ticketChannel) {
        const { gerarTranscript } = await import("../utils/transcript.js");
        transcriptData = await gerarTranscript(ticketChannel, ticketId);
        if (transcriptData) {
          ticket.transcriptUrl = transcriptData.url;
        }
      }

      // RECRUTAMENTO
      if (ticket.type === "recrutamento") {
        const embedRecrutamento = new EmbedBuilder()
          .setTitle("Ticket de Recrutamento - Aguardando Decisao")
          .setDescription([
            "Este ticket de recrutamento foi marcado para fecho.",
            "",
            `Fechado por: ${interaction.user.username}`,
            "",
            "Aguardando decisao da staff...",
            "",
            "O utilizador foi recrutado?",
          ].join("\n"))
          .setColor(0xFFA500);
        const rowRecrutamento = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`recrutado_sim_${ticketId}`).setLabel("Sim - Recrutado").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recrutado_nao_${ticketId}`).setLabel("Nao - Nao Recrutado").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`fechar_definitivo_${ticketId}`).setLabel("Fechar Definitivo").setStyle(ButtonStyle.Secondary),
        );
        await interaction.channel.send({ embeds: [embedRecrutamento], components: [rowRecrutamento] });
        ticket.closedBy = interaction.user.id;
        ticket.closedByName = interaction.user.username;
        ticket.closedAt = new Date().toISOString();
        ticket.closed = true;
        saveDB();
        await safeEditReply(interaction, { content: "Ticket de recrutamento aguarda decisao da staff." });
        return;
      }

      // TICKET NORMAL
      const dataFechamento = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
      const embedFechamento = new EmbedBuilder()
        .setTitle("Ticket Fechado")
        .setDescription([
          "Seu ticket foi fechado com sucesso, avalie nosso atendimento enviado no seu privado.",
          "",
          "Fechado por:",
          interaction.user.username,
          "",
          "Fechado em:",
          dataFechamento,
          "",
          "Caso necessario, nao hesite em abrir ticket novamente!"
        ].join("\n"))
        .setColor(0xFF0000);
      await interaction.channel.send({ embeds: [embedFechamento], content: `${ticket.username}` });
      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      ticket.closedAt = new Date().toISOString();
      ticket.closed = true;
      saveDB();
      await enviarAvaliacaoDM(ticket, client);
      await sendLog(ticketId, "close", client);
      await safeEditReply(interaction, { content: "Ticket sera fechado em 10 segundos..." });
      setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
      }, 10000);
      return;
    }

    // AVALIACAO POR ESTRELAS
    if (customId.startsWith("avaliar_")) {
      const parts = customId.split("_");
      const estrelas = parseInt(parts[1]);
      const ticketId = parts[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: "Ticket nao encontrado.", flags: 64 });
      }
      if (db.avaliacoes[ticketId] && db.avaliacoes[ticketId].some(a => a.avaliador === interaction.user.id)) {
        return interaction.reply({ content: "Ja avaliaste este ticket!", flags: 64 });
      }
      const modal = new ModalBuilder()
        .setCustomId(`modal_avaliar_${ticketId}_${estrelas}`)
        .setTitle(`Avaliacao - ${estrelas} Estrelas`);
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

    // Botoes de recrutamento
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
        await ticketChannel.send("Utilizador recrutado com sucesso!");
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
          await ticketChannel.send("Utilizador nao foi recrutado.");
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
        return interaction.reply({ content: "Ticket nao encontrado.", flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: "Apenas staff.", flags: 64 });
      }
      await interaction.deferUpdate();
      const dataFechamento = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
      const embedFechamento = new EmbedBuilder()
        .setTitle("Ticket Fechado Definitivamente")
        .setDescription([
          "Seu ticket foi fechado com sucesso.",
          "",
          "Fechado por:",
          interaction.user.username,
          "",
          "Fechado em:",
          dataFechamento,
        ].join("\n"))
        .setColor(0xFF0000);
      await interaction.channel.send({ embeds: [embedFechamento], content: `${ticket.username}` });
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
        return interaction.editReply({ content: "Ticket nao encontrado.", components: [] });
      }
      if (ticket.claimedBy !== interaction.user.id) {
        return interaction.editReply({ content: "Nao es o staff atual deste ticket.", components: [] });
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
            `Controlo transferido! ${oldStaff} passou o ticket para ${ticket.claimedByName}.`
          );
        }
      }
      try {
        const requester = await client.users.fetch(requesterId);
        await requester.send(`O teu pedido de assumo foi aceite! Agora es o responsavel pelo ticket #${ticketId}.`);
      } catch (e) {}
      await interaction.editReply({ content: `Passaste o controlo do ticket para ${ticket.claimedByName}.`, components: [] });
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
        return interaction.editReply({ content: "Ticket nao encontrado.", components: [] });
      }
      try {
        const requester = await client.users.fetch(requesterId);
        await requester.send(`O teu pedido de assumo foi recusado. O staff atual mantem o controlo do ticket #${ticketId}.`);
      } catch (e) {}
      await interaction.editReply({ content: "Recusaste passar o controlo. O ticket continua contigo.", components: [] });
      return;
    }

    // Passar Ticket button
    if (customId.startsWith("passar_ticket_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return safeEditReply(interaction, { content: "Ticket nao encontrado.", flags: 64 });
      }
      if (ticket.claimedBy !== interaction.user.id) {
        return safeEditReply(interaction, { content: "So quem assumiu pode passar. Usa /pedirassumo.", flags: 64 });
      }
      await safeEditReply(interaction, { content: "Usa o comando /passar @staff para passar o controlo para outro membro da staff.", flags: 64 });
      return;
    }

    // Re-entrar no Ticket
    if (customId.startsWith("reentrar_ticket_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: "Ticket nao encontrado ou ja fechado.", flags: 64 });
      }
      try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
        const channel = await guild.channels.fetch(ticket.channelId);
        await channel.permissionOverwrites.edit(interaction.user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        await interaction.reply({ content: `Re-entraste no ticket! Acede aqui: <#${ticket.channelId}>`, flags: 64 });
      } catch (e) {
        await interaction.reply({ content: "Erro ao re-entrar no ticket. Contacta a staff.", flags: 64 });
      }
      return;
    }

    // Adicionar Usuario
    if (customId.startsWith("add_user_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      await interaction.reply({ content: "Para adicionar um usuario, menciona-o neste canal e um staff pode adicionar manualmente nas permissoes.", flags: 64 });
      return;
    }

    // Remover Usuario
    if (customId.startsWith("remove_user_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      await interaction.reply({ content: "Para remover um usuario, um staff pode remover manualmente nas permissoes do canal.", flags: 64 });
      return;
    }
  }
}
