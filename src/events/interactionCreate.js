import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";
import { updateTicketEmbed } from "../services/tickets.js";
import { sendPainelChamada, criarCall, apagarCall, chamarMembro } from "../services/calls.js";
import { sendLog, enviarLogAvaliacao, enviarAvaliacaoDM } from "../services/logs.js";
import { handleAjudaCommand, handleAjudaProcurar, handleAjudaModal, assistantMemory } from "../services/ajuda.js";
import { handleTruckyVerification } from "../services/tickets.js";

export async function handleInteractionCreate(interaction, client) {
    // ========== MODAL SUBMIT ==========
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith("modal_avaliar_")) {
            const parts = interaction.customId.split("_");
            const ticketId = parts[2];
            const estrelas = parseInt(parts[3]);
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Ticket não encontrado.",
                    flags: 64,
                });
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

            await safeEditReply(interaction, {
                content: `✅ Obrigado pela sua avaliação de ${estrelas} estrelas!`,
                flags: 64,
            });
            return;
        }

        if (interaction.customId === "modal_ajuda") {
            await handleAjudaModal(interaction, client);
            return;
        }

        // Trucky verification modal (NEW)
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
                return interaction.reply({
                    content: "❌ Apenas administradores podem usar este comando.",
                    flags: 64,
                });
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
                canaisParaApagar = guild.channels.cache
                    .filter((ch) => ch.type === 0)
                    .map((ch) => ch);
            }

            await interaction.reply({
                content: `🗑️ A apagar mensagens em ${canaisParaApagar.length} canais...`,
                flags: 64,
            });

            let totalApagadas = 0;
            const erros = [];

            for (const canal of canaisParaApagar) {
                try {
                    const messages = await canal.messages.fetch({ limit: 100 });
                    const botMessages = messages.filter(
                        (msg) => msg.author.id === client.user.id,
                    );

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
                "✅ **Limpeza concluída!**",
                `🗑️ Total de mensagens apagadas: **${totalApagadas}**`,
                ...(erros.length > 0 ? [`⚠️ Erros em ${erros.length} canais`] : []),
                "",
                "💡 **Dica:** Use os comandos manuais para reenviar painéis."
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
                return interaction.reply({
                    content: "❌ Não tens permissão para usar este comando.",
                    flags: 64,
                });
            }

            const quantidade = interaction.options.getInteger("quantidade");
            const motivo = interaction.options.getString("motivo") || "Sem motivo especificado";

            await interaction.deferReply({ flags: 64 });

            const messages = await interaction.channel.messages.fetch({ limit: quantidade });

            // Save transcript before deleting
            const transcriptData = messages.map(m => ({
                author: m.author.tag,
                content: m.content,
                timestamp: m.createdTimestamp,
                attachments: m.attachments.map(a => a.url)
            }));

            // Delete messages
            for (const msg of messages.values()) {
                if (msg.deletable) {
                    await msg.delete().catch(() => {});
                }
            }

            await interaction.editReply({
                content: `✅ **${quantidade} mensagens apagadas!**\n📝 Motivo: ${motivo}\n📄 Transcript guardado no sistema.`,
                flags: 64
            });
            return;
        }

        // /status
        if (interaction.commandName === "status") {
            const embed = new EmbedBuilder()
                .setTitle("📊 Status do Bot")
                .setDescription([
                    `🤖 **Bot:** ${client.user.tag}`,
                    `📡 **Ping:** ${client.ws.ping}ms`,
                    `🎫 **Tickets abertos:** ${Object.values(db.tickets).filter(t => !t.closed).length}`,
                    `👥 **Membros:** ${interaction.guild.memberCount}`,
                    `⏰ **Online desde:** <t:${Math.floor(client.readyTimestamp / 1000)}:R>`
                ].join("\n"))
                .setColor(0x00ff00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        // /painelstaff (NEW)
        if (interaction.commandName === "painelstaff") {
            const ticket = Object.values(db.tickets).find(
                t => t.channelId === interaction.channel.id && !t.closed
            );

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Este canal não é um ticket ativo.",
                    flags: 64,
                });
            }

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
                return interaction.reply({
                    content: "❌ Apenas staff pode usar este comando.",
                    flags: 64,
                });
            }

            await interaction.deferReply({ flags: 64 });

            // Send panel as normal message (NOT embed) with emojis
            const panelText = [
                `:truckersmpWhite: **Painel de Staff — Ticket #${ticket.id}**`,
                "",
                `👤 **Criador:** <@${ticket.userId}>`,
                `📋 **Tipo:** ${ticket.label}`,
                `🔧 **Assumido por:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Ninguém"}`,
                `📞 **Call:** ${ticket.callActive ? "🟢 Ativa" : "🔴 Inativa"}`,
                "",
                "Seleciona uma opção abaixo:",
            ].join("\n");

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`criar_call_${ticket.id}`)
                    .setLabel("🔵 Criar Call")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`apagar_call_${ticket.id}`)
                    .setLabel("🔴 Apagar Call")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`chamar_membro_${ticket.id}`)
                    .setLabel("📢 Chamar Membro")
                    .setStyle(ButtonStyle.Success),
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`passar_ticket_${ticket.id}`)
                    .setLabel("🔄 Passar Ticket")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`add_user_${ticket.id}`)
                    .setLabel("➕ Adicionar User")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`remove_user_${ticket.id}`)
                    .setLabel("➖ Remover User")
                    .setStyle(ButtonStyle.Secondary),
            );

            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`deletar_${ticket.id}`)
                    .setLabel("🗑️ Fechar Ticket")
                    .setStyle(ButtonStyle.Danger),
            );

            await interaction.editReply({
                content: panelText,
                components: [row1, row2, row3],
                flags: 64,
            });
            return;
        }

        // /passar (NEW)
        if (interaction.commandName === "passar") {
            const ticket = Object.values(db.tickets).find(
                t => t.channelId === interaction.channel.id && !t.closed
            );

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Este canal não é um ticket ativo.",
                    flags: 64,
                });
            }

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
                return interaction.reply({
                    content: "❌ Apenas staff pode usar este comando.",
                    flags: 64,
                });
            }

            // Only current claimed staff or admin can pass
            if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
                return interaction.reply({
                    content: "❌ Só quem assumiu o ticket pode passá-lo. Usa /pedirassumo primeiro.",
                    flags: 64,
                });
            }

            const targetStaff = interaction.options.getUser("staff");
            const targetMember = await interaction.guild.members.fetch(targetStaff.id).catch(() => null);

            if (!targetMember || !targetMember.roles.cache.has(CONFIG.CARGO_STAFF)) {
                return interaction.reply({
                    content: "❌ O utilizador selecionado não é staff.",
                    flags: 64,
                });
            }

            await interaction.deferReply({ flags: 64 });

            // Update ticket
            const oldClaimed = ticket.claimedByName;
            ticket.claimedBy = targetStaff.id;
            ticket.claimedByName = targetStaff.username;
            saveDB();

            await updateTicketEmbed(interaction.channel, ticket.id);

            await interaction.channel.send(
                `:repeat: **Ticket passado!** <@${interaction.user.id}> passou o controlo para <@${targetStaff.id}>.`
            );

            await interaction.editReply({
                content: `✅ Ticket passado para <@${targetStaff.id}> com sucesso!`,
                flags: 64,
            });
            return;
        }

        // /pedirassumo (NEW)
        if (interaction.commandName === "pedirassumo") {
            const ticket = Object.values(db.tickets).find(
                t => t.channelId === interaction.channel.id && !t.closed
            );

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Este canal não é um ticket ativo.",
                    flags: 64,
                });
            }

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
                return interaction.reply({
                    content: "❌ Apenas staff pode usar este comando.",
                    flags: 64,
                });
            }

            if (!ticket.claimedBy) {
                // No one claimed - auto claim
                ticket.claimedBy = interaction.user.id;
                ticket.claimedByName = interaction.user.username;
                saveDB();
                await updateTicketEmbed(interaction.channel, ticket.id);

                await interaction.reply({
                    content: `✅ Ticket assumido! Ninguém tinha assumido ainda.`,
                    flags: 64,
                });
                await interaction.channel.send(
                    `:white_check_mark: | <@${interaction.user.id}>/${interaction.user.username} assumiu este ticket.`
                );
                return;
            }

            if (ticket.claimedBy === interaction.user.id) {
                return interaction.reply({
                    content: "❌ Já assumiste este ticket!",
                    flags: 64,
                });
            }

            // Send request to current staff
            const currentStaff = await client.users.fetch(ticket.claimedBy).catch(() => null);
            if (!currentStaff) {
                // Staff not found, auto transfer
                ticket.claimedBy = interaction.user.id;
                ticket.claimedByName = interaction.user.username;
                saveDB();
                await updateTicketEmbed(interaction.channel, ticket.id);

                await interaction.reply({
                    content: `✅ O staff anterior não foi encontrado. Ticket assumido por ti!`,
                    flags: 64,
                });
                return;
            }

            await interaction.deferReply({ flags: 64 });

            // Send DM to current staff
            try {
                const requestEmbed = new EmbedBuilder()
                    .setTitle("🔄 Pedido de Assumo")
                    .setDescription([
                        `👤 **<@${interaction.user.id}>** pediu assumo do teu ticket.`,
                        "",
                        `📋 **Ticket:** #${ticket.id}`,
                        `👤 **Criador:** <@${ticket.userId}>`,
                        `📍 **Canal:** <#${ticket.channelId}>`,
                        "",
                        "Queres passar o controlo?",
                    ].join("\n"))
                    .setColor(0xff9800)
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`aceitar_assumo_${ticket.id}_${interaction.user.id}`)
                        .setLabel("✅ Sim, Passar")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`recusar_assumo_${ticket.id}_${interaction.user.id}`)
                        .setLabel("❌ Não, Ficar")
                        .setStyle(ButtonStyle.Danger),
                );

                await currentStaff.send({ embeds: [requestEmbed], components: [row] });

                await interaction.editReply({
                    content: `⏳ Pedido enviado para <@${ticket.claimedBy}>! Aguarda resposta...`,
                    flags: 64,
                });

            } catch (e) {
                // DMs disabled, auto claim
                ticket.claimedBy = interaction.user.id;
                ticket.claimedByName = interaction.user.username;
                saveDB();
                await updateTicketEmbed(interaction.channel, ticket.id);

                await interaction.editReply({
                    content: `✅ O staff anterior tem DMs desativadas. Ticket assumido por ti!`,
                    flags: 64,
                });
            }
            return;
        }

        return;
    }

    // ========== SELECT MENUS ==========
    if (interaction.isStringSelectMenu()) {
        const deferred = await safeDeferReply(interaction, { flags: 64 });
        if (!deferred) return;

        if (interaction.customId === "ticket_geral") {
            const type = interaction.values[0];
            const labels = {
                bugs: CONFIG.EMOJI_BUGS + " Bugs",
                denuncia: CONFIG.EMOJI_DENUNCIA + " Denúncia",
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

        // ===== SISTEMA /AJUDA - BOTÕES =====
        if (customId === "ajuda_procurar") {
            await handleAjudaProcurar(interaction);
            return;
        }
        if (customId === "ajuda_ticket") {
            await interaction.reply({
                content: "🎫 Abre um ticket aqui: <#" + CONFIG.CANAL_TICKETS_GERAL + ">",
                flags: 64
            });
            return;
        }
        if (customId === "ajuda_nova") {
            await handleAjudaCommand(interaction, client);
            return;
        }

        // ===== ASSISTENTE INTELIGENTE - BOTÕES =====
        if (customId.startsWith("smart_helpful_")) {
            await interaction.update({
                content: interaction.message.content + "\n✅ O utilizador confirmou que resolveu!",
                components: [],
                embeds: interaction.message.embeds
            });
            return;
        }

        if (customId.startsWith("smart_not_helpful_")) {
            await interaction.update({
                content: "❌ O utilizador indicou que não resolveu. Staff pode ajudar!",
                components: []
            });
            return;
        }

        if (customId.startsWith("smart_search_")) {
            await interaction.update({
                content: "🔍 A pesquisar na internet... (funcionalidade em desenvolvimento)",
                components: []
            });
            return;
        }

        if (customId.startsWith("smart_do_search_")) {
            await interaction.update({
                content: "🔍 A pesquisar na internet... (funcionalidade em desenvolvimento)",
                components: []
            });
            return;
        }

        if (customId === "smart_cancel") {
            await interaction.update({
                content: "❌ Pesquisa cancelada.",
                components: []
            });
            return;
        }

        // ===== BOTÕES EXISTENTES (TICKETS, REGRAS, ETC) =====
        // Aceitar Regras
        if (customId === "aceitar_regras") {
            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            const member = interaction.member;
            const userId = member.id;

            const temCargoMembro = member.roles.cache.has(CONFIG.CARGO_MEMBRO) ||
                                   member.roles.cache.has(CONFIG.CARGO_VERIFICADO);
            const jaAceitou = db.acceptedRules.includes(userId);

            if (jaAceitou && temCargoMembro) {
                return safeEditReply(interaction, {
                    content: "✅ Já aceitaste as regras e tens o cargo atribuído!\n",
                    flags: 64,
                });
            }

            try {
                const guildId = interaction.guild.id;
                const isRecrutamentoGuild = guildId === CONFIG.GUILD_ID_RECRUTAMENTO;

                let rolesToAdd;
                if (isRecrutamentoGuild) {
                    rolesToAdd = [
                        CONFIG.CARGO_RECRUTAMENTO_1,
                        CONFIG.CARGO_RECRUTAMENTO_2,
                    ];
                } else {
                    rolesToAdd = [
                        CONFIG.CARGO_MEMBRO,
                        CONFIG.CARGO_VERIFICADO,
                    ];
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

                let mensagem = "✅ Regras aceites! Bem-vindo à comunidade.";
                if (rolesAdded.length > 0) {
                    mensagem += "\n🎉 Cargos atribuídos: " + rolesAdded.join(", ");
                }

                await safeEditReply(interaction, { content: mensagem, flags: 64 });
            } catch (error) {
                console.error("Erro ao aceitar regras:", error);
                await safeEditReply(interaction, {
                    content: "❌ Ocorreu um erro ao processar. Tenta novamente ou contacta a staff.",
                    flags: 64,
                });
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
                await safeEditReply(interaction, {
                    content: "✅ Saíste do ticket. Podes fechá-lo se desejares.",
                    flags: 64,
                });
            } else {
                await safeEditReply(interaction, {
                    content: "❌ Apenas o criador do ticket pode sair.",
                    flags: 64,
                });
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
                return safeEditReply(interaction, {
                    content: "❌ Apenas staff pode assumir tickets.",
                    flags: 64,
                });
            }

            if (ticket.claimedBy) {
                return safeEditReply(interaction, {
                    content: `❌ Este ticket já foi assumido por ${ticket.claimedByName}.`,
                    flags: 64,
                });
            }

            ticket.claimedBy = interaction.user.id;
            ticket.claimedByName = interaction.user.username;
            saveDB();

            await updateTicketEmbed(interaction.channel, ticketId);

            await interaction.channel.send(
                `:white_check_mark: | <@${interaction.user.id}>/${interaction.user.username} assumiu este ticket.`,
            );

            await sendLog(ticketId, "claim", client);

            await safeEditReply(interaction, {
                content: "✅ Ticket assumido com sucesso!",
                flags: 64,
            });
            return;
        }

        // Painel Staff
        if (customId.startsWith("painel_")) {
            const ticketId = customId.split("_")[1];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
                return interaction.reply({
                    content: "❌ Apenas staff pode aceder ao painel.",
                    flags: 64,
                });
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
                return interaction.reply({
                    content: "❌ Ticket não encontrado.",
                    flags: 64,
                });
            }

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF) && ticket.userId !== interaction.user.id) {
                return interaction.reply({
                    content: "❌ Apenas staff ou o criador pode deletar.",
                    flags: 64,
                });
            }

            const deferred = await safeDeferReply(interaction);
            if (!deferred) return;

            // ===== RECRUITMENT TICKET - DON'T CLOSE IMMEDIATELY (NEW) =====
            if (ticket.type === "recrutamento") {
                const embedRecrutamento = new EmbedBuilder()
                    .setTitle("📝 Ticket de Recrutamento - Aguardando Decisão")
                    .setDescription([
                        "⚠️ **Este ticket de recrutamento foi marcado para fecho.**",
                        "",
                        "⚒️ **Fechado por:**",
                        `<@${interaction.user.id}> | ${interaction.user.username}`,
                        "",
                        "🕑 **Aguardando decisão da staff...**",
                        "",
                        "**O utilizador foi recrutado?**",
                        "Clica em **✅ Sim** ou **❌ Não** abaixo.",
                    ].join("\n"))
                    .setColor(0xFFA500);

                const rowRecrutamento = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`recrutado_sim_${ticketId}`)
                        .setLabel("✅ Sim - Recrutado")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`recrutado_nao_${ticketId}`)
                        .setLabel("❌ Não - Não Recrutado")
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`fechar_definitivo_${ticketId}`)
                        .setLabel("🗑️ Fechar Definitivo")
                        .setStyle(ButtonStyle.Secondary),
                );

                await interaction.channel.send({
                    embeds: [embedRecrutamento],
                    components: [rowRecrutamento]
                });

                ticket.closedBy = interaction.user.id;
                ticket.closedByName = interaction.user.username;
                ticket.closedAt = new Date().toISOString();
                ticket.closed = true;
                saveDB();

                await safeEditReply(interaction, {
                    content: "📝 Ticket de recrutamento aguarda decisão da staff. Não será apagado automaticamente.",
                });
                return;
            }

            // Normal ticket closing
            const dataFechamento = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
            const embedFechamento = new EmbedBuilder()
                .setTitle("🎫 Ticket Fechado")
                .setDescription([
                    "Seu ticket foi fechado com sucesso, avalie nosso atendimento enviado no seu privado 😉.",
                    "",
                    "⚒️ **Fechado por:**",
                    `<@${interaction.user.id}> | ${interaction.user.username}`,
                    "",
                    "🕑 **Fechado em:**",
                    dataFechamento,
                    "",
                    "Caso necessário, não hesite em abrir ticket novamente!"
                ].join("\n"))
                .setColor(0xFF0000);

            await interaction.channel.send({
                embeds: [embedFechamento],
                content: `<@${ticket.userId}>`
            });

            ticket.closedBy = interaction.user.id;
            ticket.closedByName = interaction.user.username;
            ticket.closedAt = new Date().toISOString();
            ticket.closed = true;
            saveDB();

            await enviarAvaliacaoDM(ticket, client);
            await sendLog(ticketId, "close", client);

            await safeEditReply(interaction, {
                content: "🗑️ Ticket será fechado em 10 segundos...",
            });

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
                return interaction.reply({
                    content: "❌ Ticket não encontrado.",
                    flags: 64,
                });
            }

            if (db.avaliacoes[ticketId] && db.avaliacoes[ticketId].some(a => a.avaliador === interaction.user.id)) {
                return interaction.reply({
                    content: "❌ Já avaliaste este ticket!",
                    flags: 64,
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_avaliar_${ticketId}_${estrelas}`)
                .setTitle(`Avaliação - ${estrelas} Estrelas`);

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
                await ticketChannel.send("✅ **Utilizador recrutado com sucesso!**\nCargo " + CONFIG.CARGO_RECRUTADO + " atribuído.");
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
                    await ticketChannel.send("❌ **Utilizador não foi recrutado.**");
                }
            }
            await sendLog(ticketId, "close", client);
            return;
        }

        // Fechar Definitivo (NEW - for recruitment tickets after decision)
        if (customId.startsWith("fechar_definitivo_")) {
            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return interaction.reply({ content: "❌ Ticket não encontrado.", flags: 64 });
            }

            const member = interaction.member;
            if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
                return interaction.reply({ content: "❌ Apenas staff.", flags: 64 });
            }

            await interaction.deferUpdate();

            const dataFechamento = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
            const embedFechamento = new EmbedBuilder()
                .setTitle("🎫 Ticket Fechado Definitivamente")
                .setDescription([
                    "Seu ticket foi fechado com sucesso.",
                    "",
                    "⚒️ **Fechado por:**",
                    `<@${interaction.user.id}> | ${interaction.user.username}`,
                    "",
                    "🕑 **Fechado em:**",
                    dataFechamento,
                ].join("\n"))
                .setColor(0xFF0000);

            await interaction.channel.send({
                embeds: [embedFechamento],
                content: `<@${ticket.userId}>`
            });

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

        // Chamar Membro (NEW)
        if (customId.startsWith("chamar_membro_")) {
            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            const ticketId = customId.split("_")[2];
            await chamarMembro(interaction, ticketId, client);
            return;
        }

        // Aceitar Assumo (NEW)
        if (customId.startsWith("aceitar_assumo_")) {
            await interaction.deferUpdate();
            const parts = customId.split("_");
            const ticketId = parts[2];
            const requesterId = parts[3];
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return interaction.editReply({ content: "❌ Ticket não encontrado.", components: [] });
            }

            // Verify the current staff is the one who received the DM
            if (ticket.claimedBy !== interaction.user.id) {
                return interaction.editReply({ content: "❌ Não és o staff atual deste ticket.", components: [] });
            }

            const oldStaff = ticket.claimedByName;
            ticket.claimedBy = requesterId;
            ticket.claimedByName = (await client.users.fetch(requesterId)).username;
            saveDB();

            // Notify in ticket channel
            const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
            if (mainGuild) {
                const ticketChannel = await mainGuild.channels.fetch(ticket.channelId).catch(() => null);
                if (ticketChannel) {
                    await ticketChannel.send(
                        `:repeat: **Controlo transferido!** ${oldStaff} passou o ticket para <@${requesterId}>.`
                    );
                }
            }

            // Notify requester
            try {
                const requester = await client.users.fetch(requesterId);
                await requester.send(`✅ **O teu pedido de assumo foi aceite!** Agora és o responsável pelo ticket #${ticketId}.`);
            } catch (e) {}

            await interaction.editReply({
                content: `✅ Passaste o controlo do ticket para <@${requesterId}>.`,
                components: [],
            });
            return;
        }

        // Recusar Assumo (NEW)
        if (customId.startsWith("recusar_assumo_")) {
            await interaction.deferUpdate();
            const parts = customId.split("_");
            const ticketId = parts[2];
            const requesterId = parts[3];
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return interaction.editReply({ content: "❌ Ticket não encontrado.", components: [] });
            }

            // Notify requester
            try {
                const requester = await client.users.fetch(requesterId);
                await requester.send(`❌ **O teu pedido de assumo foi recusado.** O staff atual mantém o controlo do ticket #${ticketId}.`);
            } catch (e) {}

            await interaction.editReply({
                content: `❌ Recusaste passar o controlo. O ticket continua contigo.`,
                components: [],
            });
            return;
        }

        // Passar Ticket button (NEW)
        if (customId.startsWith("passar_ticket_")) {
            const deferred = await safeDeferReply(interaction, { flags: 64 });
            if (!deferred) return;

            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return safeEditReply(interaction, { content: "❌ Ticket não encontrado.", flags: 64 });
            }

            if (ticket.claimedBy !== interaction.user.id) {
                return safeEditReply(interaction, { content: "❌ Só quem assumiu pode passar. Usa /pedirassumo.", flags: 64 });
            }

            await safeEditReply(interaction, {
                content: "🔄 Usa o comando `/passar @staff` para passar o controlo para outro membro da staff.",
                flags: 64,
            });
            return;
        }

        // Re-entrar no Ticket (from DM)
        if (customId.startsWith("reentrar_ticket_")) {
            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Ticket não encontrado ou já fechado.",
                    flags: 64,
                });
            }

            try {
                const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
                const channel = await guild.channels.fetch(ticket.channelId);

                // Re-add user permissions
                await channel.permissionOverwrites.edit(interaction.user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                });

                await interaction.reply({
                    content: `✅ Re-entraste no ticket! Acede aqui: <#${ticket.channelId}>`,
                    flags: 64,
                });
            } catch (e) {
                await interaction.reply({
                    content: "❌ Erro ao re-entrar no ticket. Contacta a staff.",
                    flags: 64,
                });
            }
            return;
        }

        // Adicionar Usuário
        if (customId.startsWith("add_user_")) {
            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            await interaction.reply({
                content: "💡 Para adicionar um usuário, menciona-o neste canal e um staff pode adicionar manualmente nas permissões.",
                flags: 64,
            });
            return;
        }

        // Remover Usuário
        if (customId.startsWith("remove_user_")) {
            const ticketId = customId.split("_")[2];
            const ticket = db.tickets[ticketId];

            if (!ticket) return;

            await interaction.reply({
                content: "💡 Para remover um usuário, um staff pode remover manualmente nas permissões do canal.",
                flags: 64,
            });
            return;
        }
    }
}
