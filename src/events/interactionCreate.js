import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";
import { updateTicketEmbed, criarTicketRecrutamento, handleTruckyVerification } from "../services/tickets.js";
import { sendPainelChamada, criarCall, apagarCall, chamarMembro } from "../services/calls.js";
import { sendLog, enviarLogAvaliacao, enviarAvaliacaoDM } from "../services/logs.js";
import { handleAjudaCommand, handleAjudaProcurar, handleAjudaModal, assistantMemory } from "../services/ajuda.js";
import { gerarTranscript } from "../utils/transcript.js";

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
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, flags: 64 });
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
      await safeEditReply(interaction, { content: `${CONFIG.EMOJI_STAR} Obrigado pela sua avaliacao de ${estrelas} estrelas!`, flags: 64 });
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
    if (interaction.customId.startsWith("modal_chamar_staff_")) {
      const ticketId = interaction.customId.split("_")[3];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, flags: 64 });
      }
      const staffId = interaction.fields.getTextInputValue("staff_id");
      const nota = interaction.fields.getTextInputValue("nota_staff") || "Sem nota adicional";

      await interaction.deferReply({ flags: 64 });

      try {
        const staffUser = await client.users.fetch(staffId).catch(() => null);
        if (!staffUser) {
          return safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Staff nao encontrada.`, flags: 64 });
        }

        const embed = new EmbedBuilder()
          .setTitle(`${CONFIG.EMOJI_CHAMAR} Staff a Chamar!`)
          .setDescription([
            `Ola ${staffUser.username}!`,
            "",
            `Um membro da staff esta a chamar-te no teu ticket <#${ticket.channelId}>.`,
            "",
            `${CONFIG.EMOJI_INFO} Motivo: ${ticket.label}`,
            `${CONFIG.EMOJI_STAFF} Staff: ${interaction.user.username}`,
            `${CONFIG.EMOJI_EDIT} Nota: ${nota}`,
            "",
            `${CONFIG.EMOJI_TIME} Importante: Responde o mais breve possivel!`
          ].join("\n"))
          .setColor(0x00ff88)
          .setTimestamp()
          .setFooter({ text: "Portugal Alfa Community", iconURL: client.user?.displayAvatarURL() });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel(`${CONFIG.EMOJI_TICKET} Ir para o Ticket`).setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${CONFIG.GUILD_ID}/${ticket.channelId}`),
        );

        await staffUser.send({ embeds: [embed], components: [row] });

        await interaction.channel.send({
          content: `${CONFIG.EMOJI_CHAMAR} ${interaction.user.username} chamou ${staffUser} no privado.`,
        });

        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_SUCCESS} ${staffUser.username} foi notificado no privado!`, flags: 64 });
      } catch (error) {
        console.error("Erro ao chamar staff:", error);
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Erro ao enviar mensagem no privado. A staff pode ter DMs desativadas.`, flags: 64 });
      }
      return;
    }
  }

  // ========== COMANDOS DE BARRA ==========
  if (interaction.isChatInputCommand()) {
    // /apagar
    if (interaction.commandName === "apagar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas administradores.`, flags: 64 });
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
      await interaction.reply({ content: `${CONFIG.EMOJI_LOADING} A apagar e gerar transcripts...`, flags: 64 });

      let totalApagadas = 0;
      const erros = [];

      for (const canal of canaisParaApagar) {
        try {
          const messages = await canal.messages.fetch({ limit: 100 });
          const botMessages = messages.filter((msg) => msg.author.id === client.user.id);

          let txtContent = `TRANSCRIPT - MENSAGENS DO BOT APAGADAS\n`;
          txtContent += `================================\n`;
          txtContent += `Canal: #${canal.name}\n`;
          txtContent += `Apagado por: ${interaction.user.tag}\n`;
          txtContent += `Data: ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}\n`;
          txtContent += `================================\n\n`;

          const msgsArray = Array.from(botMessages.values()).reverse();
          for (const msg of msgsArray) {
            const data = new Date(msg.createdTimestamp).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
            txtContent += `[${data}] ${msg.author.tag}: ${msg.content || "(sem texto)"}\n`;
            if (msg.attachments.size > 0) {
              txtContent += ` [Anexos: ${msg.attachments.map(a => a.name).join(", ")}]\n`;
            }
            txtContent += `\n`;
          }

          for (const msg of botMessages.values()) {
            await msg.delete().catch(() => {});
            totalApagadas++;
            await new Promise((r) => setTimeout(r, 100));
          }

          let htmlAttachment = null;
          try {
            htmlAttachment = await gerarTranscript(canal, `apagado-${canal.id}-${Date.now()}`);
          } catch (e) {
            console.error("Erro ao gerar HTML:", e);
          }

          const files = [];
          files.push({ attachment: Buffer.from(txtContent, "utf-8"), name: `apagado-${canal.name}-${Date.now()}.txt` });
          if (htmlAttachment) {
            files.push(htmlAttachment.attachment);
          }

          await canal.send({
            content: `${CONFIG.EMOJI_BROOM} ${botMessages.size} mensagens do bot apagadas por ${interaction.user.tag}`,
            files: files
          }).catch(() => {});

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
        `${CONFIG.EMOJI_BROOM} Limpeza concluida!`,
        `${CONFIG.EMOJI_CHECK} Total: ${totalApagadas} mensagens`,
        `${CONFIG.EMOJI_FILE} Transcripts (TXT + HTML) enviados em cada canal`,
        ...(erros.length > 0 ? [`${CONFIG.EMOJI_WARNING} Erros: ${erros.length}`] : []),
      ].join("\n");

      await interaction.editReply({ content: resposta });
      return;
    }

    // /ajuda - CORRIGIDO: deferReply ANTES de chamar handleAjudaCommand
    if (interaction.commandName === "ajuda") {
      await interaction.deferReply({ flags: 64 });
      await handleAjudaCommand(interaction, client);
      return;
    }

    // /limpar
    if (interaction.commandName === "limpar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Nao tens permissao para usar este comando.`, flags: 64 });
      }
      const quantidade = interaction.options.getInteger("quantidade");
      const motivo = interaction.options.getString("motivo") || "Sem motivo especificado";
      await interaction.deferReply({ flags: 64 });

      const messages = await interaction.channel.messages.fetch({ limit: quantidade });

      // Gerar TXT transcript ANTES de apagar
      let txtContent = `TRANSCRIPT - MENSAGENS APAGADAS\n`;
      txtContent += `================================\n`;
      txtContent += `Canal: #${interaction.channel.name}\n`;
      txtContent += `Apagado por: ${interaction.user.tag}\n`;
      txtContent += `Motivo: ${motivo}\n`;
      txtContent += `Quantidade: ${messages.size}\n`;
      txtContent += `Data: ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}\n`;
      txtContent += `================================\n\n`;

      const msgsArray = Array.from(messages.values()).reverse();
      for (const msg of msgsArray) {
        const data = new Date(msg.createdTimestamp).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
        txtContent += `[${data}] ${msg.author.tag}: ${msg.content || "(sem texto)"}\n`;
        if (msg.attachments.size > 0) {
          txtContent += ` [Anexos: ${msg.attachments.map(a => a.name).join(", ")}]\n`;
        }
        txtContent += `\n`;
      }

      // Gerar HTML transcript
      let htmlAttachment = null;
      try {
        htmlAttachment = await gerarTranscript(interaction.channel, `limpo-${interaction.channel.id}-${Date.now()}`);
      } catch (e) {
        console.error("Erro ao gerar HTML transcript:", e);
      }

      // Apagar mensagens
      for (const msg of messages.values()) {
        if (msg.deletable) {
          await msg.delete().catch(() => {});
        }
      }

      // Enviar ficheiros no canal
      const files = [];
      files.push({ attachment: Buffer.from(txtContent, "utf-8"), name: `limpo-${interaction.channel.name}-${Date.now()}.txt` });
      if (htmlAttachment) {
        files.push(htmlAttachment.attachment);
      }

      await interaction.channel.send({
        content: `${CONFIG.EMOJI_BROOM} ${quantidade} mensagens apagadas por ${interaction.user.tag}\n${CONFIG.EMOJI_INFO} Motivo: ${motivo}`,
        files: files
      }).catch(() => {});

      await interaction.editReply({ content: `${CONFIG.EMOJI_BROOM} ${quantidade} mensagens apagadas!\n${CONFIG.EMOJI_INFO} Motivo: ${motivo}\n${CONFIG.EMOJI_FILE} Transcript guardado no canal.`, flags: 64 });
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
          `${CONFIG.EMOJI_TIME} Online desde: `
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
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Este canal nao e um ticket ativo.`, flags: 64 });
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
        `${CONFIG.EMOJI_STAFF} Assumido por: ${ticket.claimedBy ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}` : "Ninguem"}`,
        `${CONFIG.EMOJI_CALL} Call: ${ticket.callActive ? "Ativa" : "Inativa"}`,
        "",
        `${CONFIG.EMOJI_INFO} Seleciona uma opcao abaixo:`,
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

    // /painelmembro
    if (interaction.commandName === "painelmembro") {
      const ticket = Object.values(db.tickets).find(
        t => t.channelId === interaction.channel.id && !t.closed
      );
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Este canal nao e um ticket ativo.`, flags: 64 });
      }
      if (ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas o criador do ticket pode usar este comando.`, flags: 64 });
      }

      const guild = interaction.guild;
      const staffRole = await guild.roles.fetch(CONFIG.CARGO_STAFF).catch(() => null);
      if (!staffRole) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Cargo de staff nao encontrado.`, flags: 64 });
      }

      const staffMembers = staffRole.members.map(m => m).sort((a, b) => a.user.username.localeCompare(b.user.username));
      if (staffMembers.length === 0) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Nenhuma staff online encontrada.`, flags: 64 });
      }

      const options = staffMembers.slice(0, 25).map(m =>
        new StringSelectMenuOptionBuilder()
          .setLabel(m.user.username)
          .setDescription(`Chamar ${m.user.username}`)
          .setValue(m.user.id)
          .setEmoji(CONFIG.EMOJI_STAFF)
      );

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`painelmembro_select_${ticket.id}`)
          .setPlaceholder("Seleciona um membro da staff...")
          .addOptions(options)
      );

      await interaction.reply({
        content: `${CONFIG.EMOJI_PAINEL} Escolhe qual staff pretendes chamar:`,
        components: [row],
        flags: 64
      });
      return;
    }

    // /passar
    if (interaction.commandName === "passar") {
      const ticket = Object.values(db.tickets).find(
        t => t.channelId === interaction.channel.id && !t.closed
      );
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Este canal nao e um ticket ativo.`, flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 });
      }
      if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
        return interaction.reply({ content: `${CONFIG.EMOJI_WARNING} So quem assumiu o ticket pode passa-lo. Usa /pedirassumo primeiro.`, flags: 64 });
      }
      const targetStaff = interaction.options.getUser("staff");
      const targetMember = await interaction.guild.members.fetch(targetStaff.id).catch(() => null);
      if (!targetMember || !targetMember.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} O utilizador selecionado nao e staff.`, flags: 64 });
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
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Este canal nao e um ticket ativo.`, flags: 64 });
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
        await interaction.reply({ content: `${CONFIG.EMOJI_SUCCESS} Ticket assumido! Ninguem tinha assumido ainda.`, flags: 64 });
        await interaction.channel.send(
          `${CONFIG.EMOJI_STAFF} <@${interaction.user.id}> | ${interaction.user.username} assumiu este ticket.`
        );
        return;
      }
      if (ticket.claimedBy === interaction.user.id) {
        return interaction.reply({ content: `${CONFIG.EMOJI_WARNING} Ja assumiste este ticket!`, flags: 64 });
      }
      const currentStaff = await client.users.fetch(ticket.claimedBy).catch(() => null);
      if (!currentStaff) {
        ticket.claimedBy = interaction.user.id;
        ticket.claimedByName = interaction.user.username;
        saveDB();
        await updateTicketEmbed(interaction.channel, ticket.id);
        await interaction.reply({ content: `${CONFIG.EMOJI_SUCCESS} O staff anterior nao foi encontrado. Ticket assumido por ti!`, flags: 64 });
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
            `${CONFIG.EMOJI_QUESTION} Queres passar o controlo?`
          ].join("\n"))
          .setColor(0xff9800)
          .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`aceitar_assumo_${ticket.id}_${interaction.user.id}`).setLabel(`${CONFIG.EMOJI_ACEITAR} Sim, Passar`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recusar_assumo_${ticket.id}_${interaction.user.id}`).setLabel(`${CONFIG.EMOJI_RECUSAR} Nao, Ficar`).setStyle(ButtonStyle.Danger),
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
    // /transcript
    if (interaction.commandName === "transcript") {
      const { handleTranscriptCommand } = await import("../commands/transcript.js");
      await handleTranscriptCommand(interaction, client);
      return;
    }
    return;
  }

  // ========== SELECT MENUS ==========
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_geral") {
      const type = interaction.values[0];
      const labels = {
        bugs: `${CONFIG.EMOJI_BUGS} Bugs`,
        denuncia: `${CONFIG.EMOJI_DENUNCIA} Denuncia`,
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
    } else if (interaction.customId.startsWith("painelmembro_select_")) {
      const ticketId = interaction.customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, flags: 64 });
      }

      const staffId = interaction.values[0];
      const staffUser = await client.users.fetch(staffId).catch(() => null);
      if (!staffUser) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Staff nao encontrada.`, flags: 64 });
      }

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

      // Modal para nota opcional
      const modal = new ModalBuilder()
        .setCustomId(`modal_chamar_staff_${ticketId}`)
        .setTitle(`${CONFIG.EMOJI_CHAMAR} Chamar Staff`);

      const inputStaffId = new TextInputBuilder()
        .setCustomId("staff_id")
        .setLabel("ID da Staff (nao alterar)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(staffId)
        .setMaxLength(50);

      const inputNota = new TextInputBuilder()
        .setCustomId("nota_staff")
        .setLabel("Nota / Motivo (opcional)")
        .setPlaceholder("Deixa uma nota para a staff...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputStaffId),
        new ActionRowBuilder().addComponents(inputNota),
      );

      await interaction.showModal(modal);
      return;
    }
    return;
  }

  // ========== BUTTONS ==========
  if (interaction.isButton()) {
    const customId = interaction.customId;

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
    if (customId.startsWith("smart_helpful_")) {
      await interaction.update({ content: interaction.message.content + "\n✅ O utilizador confirmou que resolveu!", components: [], embeds: interaction.message.embeds });
      return;
    }
    if (customId.startsWith("smart_not_helpful_")) {
      await interaction.update({ content: "❌ O utilizador indicou que nao resolveu. Staff pode ajudar!", components: [] });
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
    if (customId.startsWith("aceitar_regras_rec_")) {
      await interaction.deferUpdate();
      const parts = customId.split("_");
      const userId = parts[3];
      const nomeTrucky = parts.slice(4).join("_");
      if (interaction.user.id !== userId) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Nao podes aceitar por outra pessoa!`, components: [] });
      }
      await criarTicketRecrutamento(interaction, client, nomeTrucky);
      return;
    }
    if (customId.startsWith("recusar_regras_rec_")) {
      await interaction.deferUpdate();
      const userId = customId.split("_")[3];
      if (interaction.user.id !== userId) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Nao podes recusar por outra pessoa!`, components: [] });
      }
      await interaction.editReply({
        content: `${CONFIG.EMOJI_CROSS} Recusaste as regras. Nao foi criado nenhum ticket de recrutamento.`,
        components: [], embeds: [],
      });
      return;
    }
    if (customId === "aceitar_regras") {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const member = interaction.member;
      const userId = member.id;
      const temCargoMembro = member.roles.cache.has(CONFIG.CARGO_MEMBRO) || member.roles.cache.has(CONFIG.CARGO_VERIFICADO);
      const jaAceitou = db.acceptedRules.includes(userId);
      if (jaAceitou && temCargoMembro) {
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_CHECK} Ja aceitaste as regras e tens o cargo atribuido!`, flags: 64 });
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
        for (const roleId of rolesToAdd) {
          if (roleId && roleId !== "ID_CARGO_X") {
            try {
              const role = interaction.guild.roles.cache.get(roleId);
              if (role && !member.roles.cache.has(roleId)) {
                await member.roles.add(roleId);
                rolesAdded.push(role.name);
              }
            } catch (roleError) {
              console.error(`Erro ao adicionar cargo ${roleId}:`, roleError.message);
            }
          }
        }
        if (!db.acceptedRules.includes(userId)) {
          db.acceptedRules.push(userId);
        }
        saveDB();
        let mensagem = `${CONFIG.EMOJI_SUCCESS} Regras aceites! Bem-vindo a comunidade.`;
        if (rolesAdded.length > 0) {
          mensagem += `\n${CONFIG.EMOJI_CHECK} Cargos atribuidos: ${rolesAdded.join(", ")}`;
        }
        await safeEditReply(interaction, { content: mensagem, flags: 64 });
      } catch (error) {
        console.error("Erro ao aceitar regras:", error);
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Ocorreu um erro ao processar. Tenta novamente ou contacta a staff.`, flags: 64 });
      }
      return;
    }
    if (customId.startsWith("sair_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[1];
      const ticket = db.tickets[ticketId];
      if (ticket && ticket.userId === interaction.user.id) {
        await interaction.channel.permissionOverwrites.delete(interaction.user.id);
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_SAIR} Saiste do ticket. Podes fecha-lo se desejares.`, flags: 64 });
      } else {
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Apenas o criador do ticket pode sair.`, flags: 64 });
      }
      return;
    }
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
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_WARNING} Este ticket ja foi assumido por <@${ticket.claimedBy}> | ${ticket.claimedByName}.`, flags: 64 });
      }
      ticket.claimedBy = interaction.user.id;
      ticket.claimedByName = interaction.user.username;
      saveDB();
      await updateTicketEmbed(interaction.channel, ticketId);
      await interaction.channel.send(
        `${CONFIG.EMOJI_STAFF} <@${interaction.user.id}> | ${interaction.user.username} assumiu este ticket.`,
      );
      await sendLog(ticketId, "claim", client);
      await safeEditReply(interaction, { content: `${CONFIG.EMOJI_SUCCESS} Ticket assumido com sucesso!`, flags: 64 });
      return;
    }
    if (customId.startsWith("painel_staff_")) {
      await interaction.reply({
        content: `${CONFIG.EMOJI_INFO} Usa o comando **/painelstaff** para aceder ao painel de staff.`,
        flags: 64
      });
      return;
    }
    if (customId.startsWith("painel_membro_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;

      if (ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas o criador do ticket pode usar o painel membro.`, flags: 64 });
      }

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

      const guild = interaction.guild;
      const staffRole = await guild.roles.fetch(CONFIG.CARGO_STAFF).catch(() => null);
      if (!staffRole) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Cargo de staff nao encontrado.`, flags: 64 });
      }

      const staffMembers = staffRole.members.map(m => m).sort((a, b) => a.user.username.localeCompare(b.user.username));
      if (staffMembers.length === 0) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Nenhuma staff encontrada.`, flags: 64 });
      }

      const options = staffMembers.slice(0, 25).map(m =>
        new StringSelectMenuOptionBuilder()
          .setLabel(m.user.username)
          .setDescription(`Chamar ${m.user.username}`)
          .setValue(m.user.id)
          .setEmoji(CONFIG.EMOJI_STAFF)
      );

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`painelmembro_select_${ticketId}`)
          .setPlaceholder("Seleciona um membro da staff...")
          .addOptions(options)
      );

      await interaction.reply({
        content: `${CONFIG.EMOJI_PAINEL} Escolhe qual staff pretendes chamar:`,
        components: [row],
        flags: 64
      });
      return;
    }
    if (customId.startsWith("deletar_")) {
      const ticketId = customId.split("_")[1];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF) && ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff ou o criador pode fechar.`, flags: 64 });
      }
      const deferred = await safeDeferReply(interaction);
      if (!deferred) return;
      if (ticket.callActive && ticket.callChannelId) {
        const callChannel = await interaction.guild.channels.fetch(ticket.callChannelId).catch(() => null);
        if (callChannel) await callChannel.delete();
        ticket.callActive = false;
        ticket.callChannelId = null;
      }
      let transcriptAttachment = null;
      const ticketChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (ticketChannel) {
        transcriptAttachment = await gerarTranscript(ticketChannel, ticketId);
        if (transcriptAttachment) {
          ticket.transcriptUrl = transcriptAttachment.fileName;
        }
      }
      if (ticket.type === "recrutamento") {
        const embedRecrutamento = new EmbedBuilder()
          .setTitle(`${CONFIG.EMOJI_RECRUTAMENTO} Ticket de Recrutamento - Aguardando Decisao`)
          .setDescription([
            `${CONFIG.EMOJI_INFO} Este ticket de recrutamento foi marcado para fecho.`,
            "",
            `${CONFIG.EMOJI_STAFF} Fechado por: ${interaction.user.username}`,
            "",
            `${CONFIG.EMOJI_TIME} Aguardando decisao da staff...`,
            "",
            `${CONFIG.EMOJI_QUESTION} O utilizador foi recrutado?`
          ].join("\n"))
          .setColor(0xFFA500);
        const rowRecrutamento = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`recrutado_sim_${ticketId}`).setLabel(`${CONFIG.EMOJI_RECRUTADO} Sim - Recrutado`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recrutado_nao_${ticketId}`).setLabel(`${CONFIG.EMOJI_NAO_RECRUTADO} Nao - Nao Recrutado`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`fechar_definitivo_${ticketId}`).setLabel(`${CONFIG.EMOJI_FECHAR_DEF} Fechar Definitivo (Nao Recrutamento)`).setStyle(ButtonStyle.Secondary),
        );
        await interaction.channel.send({ embeds: [embedRecrutamento], components: [rowRecrutamento] });
        ticket.closedBy = interaction.user.id;
        ticket.closedByName = interaction.user.username;
        ticket.closedAt = new Date().toISOString();
        ticket.closed = true;
        saveDB();
        await safeEditReply(interaction, { content: `${CONFIG.EMOJI_INFO} Ticket de recrutamento aguarda decisao da staff.` });
        return;
      }
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
          `${CONFIG.EMOJI_TICKET} Caso necessario, nao hesite em abrir ticket novamente!`
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
      await safeEditReply(interaction, { content: `${CONFIG.EMOJI_TIME} Ticket sera fechado em 10 segundos...` });
      setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
      }, 10000);
      return;
    }
    if (customId.startsWith("avaliar_")) {
      const parts = customId.split("_");
      const estrelas = parseInt(parts[1]);
      const ticketId = parts[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, flags: 64 });
      }
      if (db.avaliacoes[ticketId] && db.avaliacoes[ticketId].some(a => a.avaliador === interaction.user.id)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_WARNING} Ja avaliaste este ticket!`, flags: 64 });
      }
      const modal = new ModalBuilder()
        .setCustomId(`modal_avaliar_${ticketId}_${estrelas}`)
        .setTitle(`${CONFIG.EMOJI_STAR} Avaliacao - ${estrelas} Estrelas`);
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
      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      ticket.closedAt = new Date().toISOString();
      ticket.closed = true;
      saveDB();

      const ticketChannel = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
      if (ticketChannel) {
        await ticketChannel.send(`${CONFIG.EMOJI_SUCCESS} Utilizador recrutado com sucesso! Ticket sera fechado em 10 segundos...`);
      }

      await sendLog(ticketId, "close", client);
      await enviarAvaliacaoDM(ticket, client);

      setTimeout(async () => {
        const ch = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
        if (ch) await ch.delete().catch(() => {});
      }, 10000);
      return;
    }
    if (customId.startsWith("recrutado_nao_")) {
      await interaction.deferUpdate();
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;

      ticket.recrutado = false;
      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      ticket.closedAt = new Date().toISOString();
      ticket.closed = true;
      saveDB();

      const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
      if (mainGuild) {
        const ticketChannel = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
        if (ticketChannel) {
          await ticketChannel.send(`${CONFIG.EMOJI_CROSS} Utilizador nao foi recrutado. Ticket sera fechado em 10 segundos...`);
        }
      }

      await sendLog(ticketId, "close", client);
      await enviarAvaliacaoDM(ticket, client);

      setTimeout(async () => {
        const ch = await client.channels.fetch(ticket.channelId).catch(() => null);
        if (ch) await ch.delete().catch(() => {});
      }, 10000);
      return;
    }
    if (customId.startsWith("fechar_definitivo_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, flags: 64 });
      }
      const member = interaction.member;
      if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff.`, flags: 64 });
      }
      await interaction.deferUpdate();

      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      ticket.closedAt = new Date().toISOString();
      ticket.closed = true;
      saveDB();

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
    if (customId.startsWith("criar_call_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      await criarCall(interaction, ticketId, client);
      return;
    }
    if (customId.startsWith("apagar_call_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      await apagarCall(interaction, ticketId, client);
      return;
    }
    if (customId.startsWith("chamar_membro_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      await chamarMembro(interaction, ticketId, client);
      return;
    }
    if (customId.startsWith("aceitar_assumo_")) {
      await interaction.deferUpdate();
      const parts = customId.split("_");
      const ticketId = parts[2];
      const requesterId = parts[3];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, components: [] });
      }
      if (ticket.claimedBy !== interaction.user.id) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Nao es o staff atual deste ticket.`, components: [] });
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
        await requester.send(`${CONFIG.EMOJI_SUCCESS} O teu pedido de assumo foi aceite! Agora es o responsavel pelo ticket #${ticketId}.`);
      } catch (e) {}
      await interaction.editReply({ content: `${CONFIG.EMOJI_SUCCESS} Passaste o controlo do ticket para ${ticket.claimedByName}.`, components: [] });
      return;
    }
    if (customId.startsWith("recusar_assumo_")) {
      await interaction.deferUpdate();
      const parts = customId.split("_");
      const ticketId = parts[2];
      const requesterId = parts[3];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, components: [] });
      }
      try {
        const requester = await client.users.fetch(requesterId);
        await requester.send(`${CONFIG.EMOJI_CROSS} O teu pedido de assumo foi recusado. O staff atual mantem o controlo do ticket #${ticketId}.`);
      } catch (e) {}
      await interaction.editReply({ content: `${CONFIG.EMOJI_INFO} Recusaste passar o controlo. O ticket continua contigo.`, components: [] });
      return;
    }
    if (customId.startsWith("passar_ticket_")) {
      const deferred = await safeDeferReply(interaction, { flags: 64 });
      if (!deferred) return;
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_ERROR} Ticket nao encontrado.`, flags: 64 });
      }
      if (ticket.claimedBy !== interaction.user.id) {
        return safeEditReply(interaction, { content: `${CONFIG.EMOJI_WARNING} So quem assumiu pode passar. Usa /pedirassumo.`, flags: 64 });
      }
      await safeEditReply(interaction, { content: `${CONFIG.EMOJI_INFO} Usa o comando /passar @staff para passar o controlo para outro membro da staff.`, flags: 64 });
      return;
    }
    if (customId.startsWith("add_user_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      await interaction.reply({ content: `${CONFIG.EMOJI_INFO} Para adicionar um usuario, menciona-o neste canal e um staff pode adicionar manualmente nas permissoes.`, flags: 64 });
      return;
    }
    if (customId.startsWith("remove_user_")) {
      const ticketId = customId.split("_")[2];
      const ticket = db.tickets[ticketId];
      if (!ticket) return;
      await interaction.reply({ content: `${CONFIG.EMOJI_INFO} Para remover um usuario, um staff pode remover manualmente nas permissoes do canal.`, flags: 64 });
      return;
    }
  }
}
