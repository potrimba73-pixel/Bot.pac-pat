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
import { sendLog } from "./logs.js";

const cooldown = new Set();

export async function createTicket(interaction, type, label, client) {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!guild) {
        return safeEditReply(interaction, {
            content: "❌ Erro: Não consegui aceder ao servidor principal.",
            flags: 64,
        });
    }
    const user = interaction.user;

    // ===== TRUCKY VERIFICATION FOR RECRUITMENT (NEW) =====
    if (type === "recrutamento") {
        // Show Trucky verification modal
        const modal = new ModalBuilder()
            .setCustomId(`modal_trucky_${user.id}_${Date.now()}`)
            .setTitle("🚛 Verificação - Trucky App");

        const inputTrucky = new TextInputBuilder()
            .setCustomId("trucky_instalado")
            .setLabel("Tens o Trucky App instalado?")
            .setPlaceholder("Escreve: Sim ou Não")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10);

        const inputNome = new TextInputBuilder()
            .setCustomId("trucky_nome")
            .setLabel("Nome de utilizador no Trucky (se tiveres)")
            .setPlaceholder("Ex: DiegoGamer")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(50);

        const row1 = new ActionRowBuilder().addComponents(inputTrucky);
        const row2 = new ActionRowBuilder().addComponents(inputNome);
        modal.addComponents(row1, row2);

        await interaction.showModal(modal);
        return;
    }

    if (cooldown.has(user.id)) {
        return safeEditReply(interaction, {
            content: "⏳ Espera um pouco antes de abrir outro ticket (3 segundos).",
            flags: 64,
        });
    }

    const existingTicket = Object.values(db.tickets).find(
        (t) => t.userId === user.id && !t.closed,
    );
    if (existingTicket) {
        const existingChannel = await guild.channels
            .fetch(existingTicket.channelId)
            .catch(() => null);
        if (existingChannel) {
            return safeEditReply(interaction, {
                content: "❌ Já tens um ticket aberto!",
                flags: 64,
            });
        } else {
            existingTicket.closed = true;
            existingTicket.closedAt = new Date().toISOString();
            existingTicket.closedBy = "Sistema (Canal Apagado)";
            existingTicket.closedByName = "Sistema";
            saveDB();
        }
    }

    cooldown.add(user.id);
    setTimeout(() => cooldown.delete(user.id), 3000);

    // Channel name with category/type
    const typePrefix = type === "recrutamento" ? "rec" : 
                       type === "bugs" ? "bug" : 
                       type === "denuncia" ? "den" : 
                       type === "suporte" ? "sup" : 
                       type === "criador" ? "cri" : 
                       type === "ajuda" ? "ajd" : "tk";

    const channelName = `${typePrefix}-${user.username}-${user.id.slice(0, 4)}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .substring(0, 25);

    let categoria = CONFIG.CATEGORIA_TICKETS_GERAL;
    if (type === "recrutamento" || type === "ajuda") {
        categoria = CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO;
    }

    if (categoria) {
        const categoriaExiste = await guild.channels.fetch(categoria).catch(() => null);
        if (!categoriaExiste) {
            console.log(`⚠️ Categoria ${categoria} não encontrada, criando sem categoria...`);
            categoria = null;
        }
    }

    let staffRoleId = CONFIG.CARGO_STAFF;
    try {
        const staffRole = await guild.roles.fetch(CONFIG.CARGO_STAFF).catch(() => null);
        if (staffRole) staffRoleId = staffRole.id;
    } catch (e) {
        console.log("⚠️ Não foi possível fetch o cargo staff");
    }

    const channelData = {
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            {
                id: guild.id,
                type: 0,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                type: 1,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
            {
                id: staffRoleId,
                type: 0,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
        ],
    };

    if (categoria) {
        channelData.parent = categoria;
    }

    const channel = await guild.channels.create(channelData);

    const ticketId = Date.now().toString();
    db.tickets[ticketId] = {
        id: ticketId,
        channelId: channel.id,
        userId: user.id,
        username: user.username,
        type: type,
        label: label,
        openedAt: new Date().toISOString(),
        closedAt: null,
        claimedBy: null,
        claimedByName: null,
        closedBy: null,
        closedByName: null,
        callActive: false,
        callChannelId: null,
        rating: null,
        panelMessageId: null,
        recrutado: null,
        fotoNome: null,
    };
    saveDB();

    const embed = new EmbedBuilder()
        .setTitle("🎫 Sistema de Ticket | Portugal Alfa Truckers")
        .setDescription([
            `:trucky: **Motivo:** ${label}`,
            `:ets2: **Assumido:** Aguardando staff...`,
            "",
            `👋 Olá <@${user.id}>, aguarde ser atendido. Um membro da staff irá assumir o teu ticket brevemente.`,
            "",
            "⚠️ **Lembre-se:** Qualquer descumprimento das regras levará ao encerramento do ticket sem aviso prévio!"
        ].join("\n"))
        .setColor(0x262af1);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`assumir_${ticketId}`)
            .setLabel("✅ Assumir")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`painel_${ticketId}`)
            .setLabel("🛡️ Painel Staff")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`sair_${ticketId}`)
            .setLabel("🚪 Sair")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`deletar_${ticketId}`)
            .setLabel("🗑️ Deletar")
            .setStyle(ButtonStyle.Danger),
    );

    const panelMsg = await channel.send({
        content: `<@${user.id}>`,
        embeds: [embed],
        components: [row],
    });
    db.tickets[ticketId].panelMessageId = panelMsg.id;
    saveDB();

    await sendLog(ticketId, "open", client);

    const ticketGuildId = CONFIG.GUILD_ID;
    const rowIrTicket = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Ir para o Ticket")
            .setStyle(ButtonStyle.Link)
            .setURL(
                `https://discord.com/channels/${ticketGuildId}/${channel.id}`,
            ),
    );

    await safeEditReply(interaction, {
        content: `✅ O teu ticket foi criado com sucesso! Podes aceder aqui:`,
        components: [rowIrTicket],
        flags: 64,
    });
}

// ===== HANDLE TRUCKY VERIFICATION (NEW) =====
export async function handleTruckyVerification(interaction, client) {
    const customId = interaction.customId;
    const parts = customId.split("_");
    const userId = parts[2];

    const temTrucky = interaction.fields.getTextInputValue("trucky_instalado").toLowerCase();
    const nomeTrucky = interaction.fields.getTextInputValue("trucky_nome") || "Não informado";

    await interaction.deferReply({ flags: 64 });

    if (temTrucky.includes("não") || temTrucky.includes("nao") || temTrucky.includes("no")) {
        // User doesn't have Trucky - send help
        const embed = new EmbedBuilder()
            .setTitle("📲 Trucky App - Instalação Necessária")
            .setDescription([
                "⚠️ **Precisas de instalar o Trucky App antes de te candidatares!**",
                "",
                "📋 **Passos:**",
                "**1.** Acede a: https://hub.truckyapp.com/",
                "**2.** Cria a tua conta e liga ao Steam",
                "**3.** Instala a app no computador",
                "",
                "📺 **Tutorial:** https://www.youtube.com/watch?v=jiGT1pBiLWs",
                "",
                "📝 **Como solicitar vaga:** https://www.youtube.com/watch?v=5Te6tmE2tWM",
                "",
                "💡 Depois de instalado, volta a abrir o ticket de recrutamento!",
            ].join("\n"))
            .setColor(0xff9800)
            .setThumbnail(CONFIG.IMAGEM_RECRUTAMENTO)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("🔗 Trucky App")
                .setStyle(ButtonStyle.Link)
                .setURL("https://hub.truckyapp.com/"),
            new ButtonBuilder()
                .setLabel("📺 Tutorial Instalação")
                .setStyle(ButtonStyle.Link)
                .setURL("https://www.youtube.com/watch?v=jiGT1pBiLWs"),
            new ButtonBuilder()
                .setLabel("📝 Como Solicitar Vaga")
                .setStyle(ButtonStyle.Link)
                .setURL("https://www.youtube.com/watch?v=5Te6tmE2tWM"),
        );

        await interaction.editReply({
            embeds: [embed],
            components: [row],
            flags: 64,
        });

        // Send log to recruitment topic
        try {
            const recrutamentoGuild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
            if (recrutamentoGuild && CONFIG.TOPICO_RECRUTAMENTO_TRUCKY) {
                const topicChannel = await recrutamentoGuild.channels.fetch(CONFIG.CANAL_LOG_RECRUTAMENTO_MSG).catch(() => null);
                if (topicChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle("📝 Tentativa de Recrutamento - Sem Trucky")
                        .setDescription([
                            `👤 **Utilizador:** <@${interaction.user.id}>`,
                            `📝 **Nome no Discord:** ${interaction.user.username}`,
                            `❌ **Tem Trucky:** Não`,
                            `⏰ **Data:** ${new Date().toLocaleString("pt-PT")}`,
                        ].join("\n"))
                        .setColor(0xff0000)
                        .setTimestamp();
                    await topicChannel.send({ embeds: [logEmbed] });
                }
            }
        } catch (e) {
            console.log("Erro ao enviar log de recrutamento:", e.message);
        }

        return;
    }

    // User has Trucky - proceed with ticket creation
    await interaction.editReply({
        content: "✅ Verificação concluída! A criar o teu ticket de recrutamento...",
        flags: 64,
    });

    // Create the ticket with Trucky info
    await createTicketAfterTruckyCheck(interaction, client, nomeTrucky);
}

async function createTicketAfterTruckyCheck(interaction, client, nomeTrucky) {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    const user = interaction.user;

    // Check cooldown and existing ticket (same as original)
    if (cooldown.has(user.id)) {
        return interaction.editReply({
            content: "⏳ Espera um pouco antes de abrir outro ticket (3 segundos).",
            flags: 64,
        });
    }

    const existingTicket = Object.values(db.tickets).find(
        (t) => t.userId === user.id && !t.closed,
    );
    if (existingTicket) {
        const existingChannel = await guild.channels
            .fetch(existingTicket.channelId)
            .catch(() => null);
        if (existingChannel) {
            return interaction.editReply({
                content: "❌ Já tens um ticket aberto!",
                flags: 64,
            });
        } else {
            existingTicket.closed = true;
            existingTicket.closedAt = new Date().toISOString();
            existingTicket.closedBy = "Sistema (Canal Apagado)";
            existingTicket.closedByName = "Sistema";
            saveDB();
        }
    }

    cooldown.add(user.id);
    setTimeout(() => cooldown.delete(user.id), 3000);

    const channelName = `rec-${user.username}-${user.id.slice(0, 4)}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .substring(0, 25);

    let categoria = CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO;
    if (categoria) {
        const categoriaExiste = await guild.channels.fetch(categoria).catch(() => null);
        if (!categoriaExiste) categoria = null;
    }

    let staffRoleId = CONFIG.CARGO_STAFF;
    try {
        const staffRole = await guild.roles.fetch(CONFIG.CARGO_STAFF).catch(() => null);
        if (staffRole) staffRoleId = staffRole.id;
    } catch (e) {
        console.log("⚠️ Não foi possível fetch o cargo staff");
    }

    const channelData = {
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            {
                id: guild.id,
                type: 0,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                type: 1,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
            {
                id: staffRoleId,
                type: 0,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
        ],
    };

    if (categoria) channelData.parent = categoria;

    const channel = await guild.channels.create(channelData);

    const ticketId = Date.now().toString();
    db.tickets[ticketId] = {
        id: ticketId,
        channelId: channel.id,
        userId: user.id,
        username: user.username,
        type: "recrutamento",
        label: "📝 Recrutamento PAT",
        openedAt: new Date().toISOString(),
        closedAt: null,
        claimedBy: null,
        claimedByName: null,
        closedBy: null,
        closedByName: null,
        callActive: false,
        callChannelId: null,
        rating: null,
        panelMessageId: null,
        recrutado: null,
        fotoNome: null,
        truckyNome: nomeTrucky,
    };
    saveDB();

    // Enhanced embed for recruitment
    const embed = new EmbedBuilder()
        .setTitle("🎫 Sistema de Ticket | Portugal Alfa Truckers")
        .setDescription([
            "📋 **Motivo:** 📝 Recrutamento PAT",
            "🔧 **Assumido:** Aguardando staff...",
            "",
            `👋 Olá <@${user.id}>, aguarde ser atendido. Um membro da staff irá assumir o teu ticket brevemente.`,
            "",
            `📲 **Trucky:** ${nomeTrucky}`,
            "",
            "⚠️ **Lembre-se:**",
            "• Máx. 100 km/h sempre – simulação real acima de tudo.",
            "• Respeito total entre membros e jogadores.",
            "• Comboios = disciplina + pontualidade.",
            "• Cumprir 15.000 KM/mês (≈ 500 km/dia).",
            "",
            "Qualquer descumprimento das regras levará ao encerramento do ticket sem aviso prévio!"
        ].join("\n"))
        .setColor(0x262af1);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`assumir_${ticketId}`)
            .setLabel("✅ Assumir")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`painel_${ticketId}`)
            .setLabel("🛡️ Painel Staff")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`sair_${ticketId}`)
            .setLabel("🚪 Sair")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`deletar_${ticketId}`)
            .setLabel("🗑️ Deletar")
            .setStyle(ButtonStyle.Danger),
    );

    const panelMsg = await channel.send({
        content: `<@${user.id}>`,
        embeds: [embed],
        components: [row],
    });
    db.tickets[ticketId].panelMessageId = panelMsg.id;
    saveDB();

    // Send log
    const { sendLog } = await import("./logs.js");
    await sendLog(ticketId, "open", client);

    // Send to recruitment topic
    try {
        const recrutamentoGuild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
        if (recrutamentoGuild && CONFIG.TOPICO_RECRUTAMENTO_TRUCKY) {
            const topicChannel = await recrutamentoGuild.channels.fetch(CONFIG.CANAL_LOG_RECRUTAMENTO_MSG).catch(() => null);
            if (topicChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("📝 Novo Recrutamento")
                    .setDescription([
                        `👤 **Utilizador:** <@${user.id}>`,
                        `📝 **Nome:** ${user.username}`,
                        `📲 **Trucky:** ${nomeTrucky}`,
                        `⏰ **Data:** ${new Date().toLocaleString("pt-PT")}`,
                    ].join("\n"))
                    .setColor(0x00ff00)
                    .setTimestamp();
                await topicChannel.send({ embeds: [logEmbed] });
            }
        }
    } catch (e) {
        console.log("Erro ao enviar log de recrutamento:", e.message);
    }

    const ticketGuildId = CONFIG.GUILD_ID;
    const rowIrTicket = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Ir para o Ticket")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${ticketGuildId}/${channel.id}`),
    );

    await interaction.editReply({
        content: `✅ O teu ticket de recrutamento foi criado!`,
        components: [rowIrTicket],
        flags: 64,
    });
}

export async function updateTicketEmbed(channel, ticketId) {
    const ticket = db.tickets[ticketId];
    if (!ticket || !ticket.panelMessageId) return;

    try {
        const panelMsg = await channel.messages.fetch(ticket.panelMessageId);
        if (!panelMsg) return;

        const claimedText = ticket.claimedBy
            ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}`
            : "Aguardando staff...";

        const embed = new EmbedBuilder()
            .setTitle("🎫 Sistema de Ticket | Portugal Alfa Community")
            .setDescription([
                "📋 **Motivo:** " + ticket.label,
                "🔧 **Assumido:** " + claimedText,
                "",
                "👋 Olá, aguarde ser atendido. Um membro da staff irá assumir o teu ticket brevemente.",
                "",
                "⚠️ **Lembre-se:** Qualquer descumprimento das regras levará ao encerramento do ticket sem aviso prévio!"
            ].join("\n"))
            .setColor(0x040021);

        if (ticket.claimedBy) {
            const oldComponents = panelMsg.components;
            if (oldComponents && oldComponents[0]) {
                const newRow = new ActionRowBuilder();
                const oldButtons = oldComponents[0].components;

                for (const btn of oldButtons) {
                    const newBtn = ButtonBuilder.from(btn);
                    if (btn.customId && btn.customId.startsWith("assumir_")) {
                        newBtn.setDisabled(true);
                        newBtn.setLabel("✅ Assumido");
                    }
                    newRow.addComponents(newBtn);
                }

                await panelMsg.edit({ embeds: [embed], components: [newRow] });
                return;
            }
        }

        await panelMsg.edit({ embeds: [embed] });
    } catch (e) {
        console.log("Erro ao atualizar embed:", e);
    }
}
