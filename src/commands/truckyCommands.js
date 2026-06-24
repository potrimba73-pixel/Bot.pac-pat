import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ComponentType
} from "discord.js";
import TruckyAPI from "../utils/truckyAPI.js";
import { TRUCKY_CONFIG } from "../config/trucky.js";

export const truckySlashCommands = [
    new SlashCommandBuilder()
        .setName("verificar-inatividade")
        .setDescription("Verifica membros inativos na VTC do Trucky (Staff)")
        .addIntegerOption(option =>
            option.setName("dias")
                .setDescription("Dias sem carga para considerar inativo (padrao: 30)")
                .setMinValue(7).setMaxValue(90).setRequired(false))
        .addBooleanOption(option =>
            option.setName("publicar")
                .setDescription("Publicar resultado no canal #jornal-pat?")
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),

    new SlashCommandBuilder()
        .setName("minhas-cargas")
        .setDescription("Verifica as tuas estatisticas na VTC do Trucky")
        .addUserOption(option =>
            option.setName("membro")
                .setDescription("Ver estatisticas de outro membro (apenas staff)")
                .setRequired(false))
        .setDefaultMemberPermissions(null)
        .toJSON(),

    new SlashCommandBuilder()
        .setName("estatisticas-vtc")
        .setDescription("Mostra estatisticas da VTC Portugal Alfa Truckers")
        .addStringOption(option =>
            option.setName("periodo")
                .setDescription("Periodo das estatisticas")
                .addChoices(
                    { name: "Este Mes", value: "month" },
                    { name: "Esta Semana", value: "week" },
                    { name: "Sempre", value: "all" }
                ).setRequired(false))
        .setDefaultMemberPermissions(null)
        .toJSON(),

    new SlashCommandBuilder()
        .setName("atualizar-patentes")
        .setDescription("Atualiza automaticamente os cargos de patentes por KM (Staff)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),

    new SlashCommandBuilder()
        .setName("limpeza")
        .setDescription("Inicia processo de limpeza de membros inativos com confirmacao (Staff)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),

    new SlashCommandBuilder()
        .setName("mapa")
        .setDescription("Mostra o mapa da frota Portugal Alfa Truckers")
        .addStringOption(option =>
            option.setName("jogo")
                .setDescription("Qual mapa mostrar?")
                .addChoices(
                    { name: "Euro Truck Simulator 2", value: "ets2" },
                    { name: "American Truck Simulator", value: "ats" }
                ).setRequired(false))
        .setDefaultMemberPermissions(null)
        .toJSON(),
];

export async function handleTruckyCommand(interaction, client) {
    const commandName = interaction.commandName;

    try {
        switch (commandName) {
            case "verificar-inatividade":
                await handleVerificarInatividade(interaction);
                break;
            case "minhas-cargas":
                await handleMinhasCargas(interaction);
                break;
            case "estatisticas-vtc":
                await handleEstatisticasVTC(interaction);
                break;
            case "atualizar-patentes":
                await handleAtualizarPatentes(interaction);
                break;
            case "limpeza":
                await handleLimpeza(interaction, client);
                break;
            case "mapa":
                await handleMapa(interaction);
                break;
        }
    } catch (error) {
        console.error(`[TruckyCommand] Erro em ${commandName}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Erro ao executar comando.", ephemeral: true });
        } else {
            await interaction.editReply({ content: "❌ Erro ao executar comando." });
        }
    }
}

async function handleVerificarInatividade(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const dias = interaction.options.getInteger("dias") || TRUCKY_CONFIG.inatividade.diasLimite;
    const publicar = interaction.options.getBoolean("publicar") || false;

    await interaction.editReply({ content: "🔍 A verificar atividade dos membros na VTC..." });

    const results = await TruckyAPI.checkAllMembersActivity(dias);

    const embed = new EmbedBuilder()
        .setTitle("📋 Relatorio de Atividade - Portugal Alfa Truckers")
        .setDescription(`Verificacao de inatividade: **${dias} dias** sem carga`)
        .setColor(TRUCKY_CONFIG.cores.info)
        .setTimestamp()
        .setFooter({ text: `Verificado por ${interaction.user.tag}` })
        .addFields(
            { name: "✅ Ativos", value: `${results.active.length} membros`, inline: true },
            { name: "⚠️ Em Aviso", value: `${results.warning.length} membros`, inline: true },
            { name: "❌ Inativos", value: `${results.inactive.length} membros`, inline: true }
        );

    if (results.inactive.length > 0) {
        let inactiveText = "";
        for (const member of results.inactive) {
            const discordMention = member.discordId ? `<@${member.discordId}>` : member.name;
            const lastJob = member.lastJobDate ? `(${member.daysSinceLastJob} dias)` : "(Nunca fez carga)";
            inactiveText += `• ${discordMention} ${lastJob}\n`;
        }
        embed.addFields({ name: `❌ Membros Inativos (${results.inactive.length})`, value: inactiveText.substring(0, 1024) || "Nenhum", inline: false });
    }

    if (results.warning.length > 0) {
        let warningText = "";
        for (const member of results.warning) {
            const discordMention = member.discordId ? `<@${member.discordId}>` : member.name;
            warningText += `• ${discordMention} (${member.daysSinceLastJob} dias)\n`;
        }
        embed.addFields({ name: `⚠️ Membros em Aviso (${results.warning.length})`, value: warningText.substring(0, 1024) || "Nenhum", inline: false });
    }

    await interaction.editReply({
        content: `✅ Verificacao concluida! **${results.inactive.length}** inativos encontrados.`,
        embeds: [embed]
    });

    if (publicar && results.inactive.length > 0) {
        const jornalChannel = await interaction.client.channels.fetch(TRUCKY_CONFIG.channels.jornalPat);

        const avisoEmbed = new EmbedBuilder()
            .setTitle("🚨 Aviso de Inatividade - Portugal Alfa Truckers")
            .setDescription(
                `Caros membros,\n\n` +
                `Foi realizada uma verificacao de atividade na nossa VTC. ` +
                `Os seguintes membros estao **INATIVOS** ha mais de **${dias} dias** ` +
                `e serao sujeitos a limpeza se nao apresentarem cargas ate ` +
                `**${TRUCKY_CONFIG.inatividade.diasLimpeza} dias** a partir desta data.`
            )
            .setColor(TRUCKY_CONFIG.cores.perigo)
            .setTimestamp();

        let membrosText = "";
        for (const member of results.inactive) {
            const discordMention = member.discordId ? `<@${member.discordId}>` : `@${member.name}`;
            const status = member.daysSinceLastJob === Infinity ? "Nunca fez carga" : `${member.daysSinceLastJob} dias sem carga`;
            membrosText += `• ${discordMention} - ${status}\n`;
        }

        avisoEmbed.addFields({ name: "❌ Lista de Inativos", value: membrosText.substring(0, 1024), inline: false });

        avisoEmbed.addFields({
            name: "📋 Instrucoes",
            value: `Para evitar a remocao da empresa, por favor:\n1. Faca pelo menos uma carga no Trucky\n2. Verifique o seu status com /minhas-cargas\n3. Contacte a administracao se tiver problemas`,
            inline: false
        });

        await jornalChannel.send({
            content: `<@&${TRUCKY_CONFIG.roles.recrutamento[0]}> Aviso de inatividade!`,
            embeds: [avisoEmbed]
        });

        await interaction.followUp({ content: "✅ Aviso publicado no canal #jornal-pat!", ephemeral: true });
    }
}

async function handleMinhasCargas(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("membro") || interaction.user;

    const isStaff = interaction.member.roles.cache.some(role => 
        TRUCKY_CONFIG.staffRoles.includes(role.id)
    ) || interaction.member.permissions.has(PermissionFlagsBits.ManageRoles);

    if (targetUser.id !== interaction.user.id && !isStaff) {
        return interaction.editReply({ content: "❌ So podes ver as tuas proprias estatisticas! Contacta a staff se precisares de ajuda." });
    }

    const members = await TruckyAPI.getCompanyMembers();
    const member = members.find(m => m.discord_id === targetUser.id);

    if (!member) {
        return interaction.editReply({
            content: `❌ ${targetUser.tag} nao esta registado na VTC do Trucky!\nVerifica se ligaste a tua conta do Discord no Trucky.`
        });
    }

    const stats = await TruckyAPI.getMemberStats(member.id);
    const activity = await TruckyAPI.checkMemberActivity(member.id, TRUCKY_CONFIG.inatividade.diasLimite);

    const totalKm = stats?.total_driven_distance_km || 0;
    let patenteAtual = "Sem Patente";
    let proximaPatente = null;
    let kmFaltam = 0;

    for (const patente of TRUCKY_CONFIG.patentes) {
        if (totalKm >= patente.kmMin && totalKm <= patente.kmMax) {
            patenteAtual = patente.nome;
            break;
        }
    }

    for (const patente of TRUCKY_CONFIG.patentes) {
        if (totalKm < patente.kmMin) {
            proximaPatente = patente.nome;
            kmFaltam = patente.kmMin - totalKm;
            break;
        }
    }

    let statusEmoji = "✅", statusText = "Ativo", statusColor = TRUCKY_CONFIG.cores.sucesso;

    if (activity.daysSinceLastJob === Infinity) {
        statusEmoji = "❌"; statusText = "Nunca fez carga"; statusColor = TRUCKY_CONFIG.cores.perigo;
    } else if (activity.daysSinceLastJob > TRUCKY_CONFIG.inatividade.diasLimite) {
        statusEmoji = "❌"; statusText = `Inativo ha ${activity.daysSinceLastJob} dias`; statusColor = TRUCKY_CONFIG.cores.perigo;
    } else if (activity.daysSinceLastJob > TRUCKY_CONFIG.inatividade.diasAviso) {
        statusEmoji = "⚠️"; statusText = `Em aviso (${activity.daysSinceLastJob} dias)`; statusColor = TRUCKY_CONFIG.cores.aviso;
    }

    const titulo = targetUser.id !== interaction.user.id ? `🚛 Estatisticas de ${member.name} (visto por staff)` : `🚛 As tuas Estatisticas`;

    const embed = new EmbedBuilder()
        .setTitle(titulo)
        .setDescription(`Membro da **Portugal Alfa Truckers**`)
        .setColor(statusColor)
        .setThumbnail(member.avatar || targetUser.displayAvatarURL())
        .setTimestamp()
        .addFields(
            { name: "📊 Status", value: `${statusEmoji} ${statusText}`, inline: true },
            { name: "🎖️ Patente", value: patenteAtual, inline: true },
            { name: "👤 Cargo VTC", value: member.role?.name || "Membro", inline: true },
            { name: "📏 KM Total", value: `${Math.round(totalKm).toLocaleString("pt-PT")} km`, inline: true },
            { name: "📦 Cargas Total", value: `${activity.totalJobs}`, inline: true },
            { name: "💰 Receita Total", value: `${(stats?.total_revenue || 0).toLocaleString("pt-PT")} T¢`, inline: true }
        );

    const monthKm = stats?.month_driven_distance_km || 0;
    const monthJobs = stats?.month_jobs || 0;

    embed.addFields({ name: "📅 Este Mes", value: `${Math.round(monthKm).toLocaleString("pt-PT")} km | ${monthJobs} cargas`, inline: false });

    if (activity.lastJobDate) {
        const lastJobDate = new Date(activity.lastJobDate);
        embed.addFields({ name: "🕐 Ultima Carga", value: `${lastJobDate.toLocaleDateString("pt-PT")} (${activity.daysSinceLastJob} dias atras)`, inline: true });
    } else {
        embed.addFields({ name: "🕐 Ultima Carga", value: "Nunca fez carga", inline: true });
    }

    if (proximaPatente) {
        embed.addFields({ name: "🎯 Proxima Patente", value: `${proximaPatente} (faltam ${Math.round(kmFaltam).toLocaleString("pt-PT")} km)`, inline: true });
    } else {
        embed.addFields({ name: "🎯 Proxima Patente", value: "Ja atingiste a patente maxima! 🏆", inline: true });
    }

    if (activity.daysSinceLastJob > TRUCKY_CONFIG.inatividade.diasAviso) {
        embed.addFields({ name: "⚠️ Aviso Importante", value: `Estas ha mais de ${TRUCKY_CONFIG.inatividade.diasAviso} dias sem fazer cargas!\nSe nao fizeres uma carga em breve, poderas ser removido da empresa.`, inline: false });
    }

    if (isStaff && targetUser.id !== interaction.user.id) {
        embed.addFields({ name: "🔧 Info Staff", value: `Trucky ID: \`${member.id}\`\nDiscord ID: \`${member.discord_id}\`\nRole ID: \`${member.role_id}\``, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleEstatisticasVTC(interaction) {
    await interaction.deferReply();

    const periodo = interaction.options.getString("periodo") || "month";
    const periodoNome = periodo === "month" ? "Este Mes" : periodo === "week" ? "Esta Semana" : "Sempre";

    const companyInfo = await TruckyAPI.getCompanyInfo();
    const stats = await TruckyAPI.getCompanyStats(periodo);
    const leaderboard = await TruckyAPI.getLeaderboard(periodo, 5);
    const members = await TruckyAPI.getCompanyMembers();

    const embed = new EmbedBuilder()
        .setTitle(`📊 Estatisticas da VTC - ${periodoNome}`)
        .setDescription(`**Portugal Alfa Truckers**`)
        .setColor(TRUCKY_CONFIG.cores.pat)
        .setThumbnail(companyInfo?.avatar_url || null)
        .setTimestamp()
        .addFields(
            { name: "👥 Membros", value: `${members.length}`, inline: true },
            { name: "📏 KM Totais", value: `${Math.round(stats?.total_driven_distance_km || 0).toLocaleString("pt-PT")} km`, inline: true },
            { name: "📦 Trabalhos", value: `${stats?.total_jobs || 0}`, inline: true },
            { name: "💰 Receita", value: `${(stats?.total_revenue || 0).toLocaleString("pt-PT")} T¢`, inline: true },
            { name: "🚛 Cargas Ativas", value: `${stats?.active_jobs || 0}`, inline: true },
            { name: "📅 Periodo", value: periodoNome, inline: true }
        );

    if (leaderboard.length > 0) {
        let topText = "";
        const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
        for (let i = 0; i < leaderboard.length; i++) {
            const driver = leaderboard[i];
            topText += `${medals[i] || "🔹"} **${driver.name}** - ${Math.round(driver.monthKm).toLocaleString("pt-PT")} km (${driver.monthJobs} cargas)\n`;
        }
        embed.addFields({ name: "🏆 Top Motoristas", value: topText, inline: false });
    }

    embed.addFields({ name: "🔗 Links", value: `[Trucky VTC](https://truckyapp.com/vtc/${TRUCKY_CONFIG.companyId}) | [Discord](${companyInfo?.discord || ""})`, inline: false });

    await interaction.editReply({ embeds: [embed] });
}

async function handleAtualizarPatentes(interaction) {
    await interaction.deferReply();

    const members = await TruckyAPI.getCompanyMembers();
    const guild = interaction.guild;

    let atualizados = 0, erros = 0, relatorio = "";

    for (const member of members) {
        if (!member.discord_id) continue;

        const stats = await TruckyAPI.getMemberStats(member.id);
        if (!stats) continue;

        const totalKm = stats.total_driven_distance_km || 0;
        let patenteNome = null, cargoId = null;

        for (const patente of TRUCKY_CONFIG.patentes) {
            if (totalKm >= patente.kmMin && totalKm <= patente.kmMax) {
                patenteNome = patente.nome; cargoId = patente.cargoDiscord; break;
            }
        }

        if (!patenteNome) {
            for (const cargo of TRUCKY_CONFIG.cargosBase) {
                if (totalKm <= cargo.kmMax) { patenteNome = cargo.nome; cargoId = cargo.cargoDiscord; break; }
            }
        }

        if (!cargoId || cargoId === "ID_CARGO") continue;

        try {
            const discordMember = await guild.members.fetch(member.discord_id);
            const cargoRole = await guild.roles.fetch(cargoId);
            if (!discordMember || !cargoRole) continue;
            if (discordMember.roles.cache.has(cargoId)) continue;

            const todosCargos = [...TRUCKY_CONFIG.patentes.map(p => p.cargoDiscord), ...TRUCKY_CONFIG.cargosBase.map(c => c.cargoDiscord)];
            for (const oldCargoId of todosCargos) {
                if (oldCargoId && oldCargoId !== "ID_CARGO" && discordMember.roles.cache.has(oldCargoId)) {
                    await discordMember.roles.remove(oldCargoId);
                }
            }

            await discordMember.roles.add(cargoId);
            atualizados++;
            relatorio += `✅ ${member.name} -> ${patenteNome} (${Math.round(totalKm).toLocaleString("pt-PT")} km)\n`;
        } catch (err) { erros++; relatorio += `❌ ${member.name} -> Erro\n`; }
    }

    const embed = new EmbedBuilder()
        .setTitle("🎖️ Atualizacao de Patentes Concluida")
        .setDescription(`Processados ${members.length} membros da VTC`)
        .setColor(TRUCKY_CONFIG.cores.sucesso)
        .setTimestamp()
        .addFields(
            { name: "✅ Atualizados", value: `${atualizados}`, inline: true },
            { name: "❌ Erros", value: `${erros}`, inline: true },
            { name: "📊 Total", value: `${members.length}`, inline: true }
        );

    if (relatorio.length > 0) {
        embed.addFields({ name: "📋 Relatorio", value: relatorio.substring(0, 1024) || "Nenhuma alteracao", inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleLimpeza(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const results = await TruckyAPI.checkAllMembersActivity(TRUCKY_CONFIG.inatividade.diasLimite);

    if (results.inactive.length === 0) {
        return interaction.editReply({ content: "✅ Nao ha membros inativos para limpar!" });
    }

    const protegidos = [];
    const inativosParaLimpar = [];

    for (const member of results.inactive) {
        if (!member.discordId) { inativosParaLimpar.push(member); continue; }

        try {
            const discordMember = await interaction.guild.members.fetch(member.discordId);
            const isStaff = discordMember.roles.cache.some(role => TRUCKY_CONFIG.staffRoles.includes(role.id));
            if (isStaff) { protegidos.push({ ...member, reason: "Membro da Staff - protegido" }); }
            else { inativosParaLimpar.push(member); }
        } catch (err) { inativosParaLimpar.push(member); }
    }

    const confirmEmbed = new EmbedBuilder()
        .setTitle("🚨 Confirmacao de Limpeza - Portugal Alfa Truckers")
        .setDescription(`**${inativosParaLimpar.length}** membros serao removidos da VTC e do Discord.\n\n**${protegidos.length}** membros estao protegidos (staff).\n\nClique em **CONFIRMAR** para prosseguir ou **CANCELAR** para abortar.`)
        .setColor(TRUCKY_CONFIG.cores.perigo)
        .setTimestamp();

    if (inativosParaLimpar.length > 0) {
        let removeText = "";
        for (const member of inativosParaLimpar) {
            const mention = member.discordId ? `<@${member.discordId}>` : member.name;
            const status = member.daysSinceLastJob === Infinity ? "Nunca fez carga" : `${member.daysSinceLastJob} dias sem carga`;
            removeText += `• ${mention} - ${status}\n`;
        }
        confirmEmbed.addFields({ name: `❌ A Remover (${inativosParaLimpar.length})`, value: removeText.substring(0, 1024), inline: false });
    }

    if (protegidos.length > 0) {
        let protectedText = "";
        for (const member of protegidos) {
            const mention = member.discordId ? `<@${member.discordId}>` : member.name;
            protectedText += `• ${mention} - ${member.reason}\n`;
        }
        confirmEmbed.addFields({ name: `🛡️ Protegidos (${protegidos.length})`, value: protectedText.substring(0, 1024), inline: false });
    }

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId("limpeza_confirmar").setLabel("✅ CONFIRMAR LIMPEZA").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("limpeza_cancelar").setLabel("❌ CANCELAR").setStyle(ButtonStyle.Secondary)
        );

    const staffChannel = await client.channels.fetch(TRUCKY_CONFIG.channels.staff);

    const confirmMessage = await staffChannel.send({
        content: `<@&${TRUCKY_CONFIG.roles.recrutamento[0]}> <@&${TRUCKY_CONFIG.roles.recrutamento[1]}> **Pedido de Limpeza** por ${interaction.user}`,
        embeds: [confirmEmbed],
        components: [row]
    });

    await interaction.editReply({ content: `✅ Pedido de limpeza enviado para o canal <#${TRUCKY_CONFIG.channels.staff}>! Aguarda confirmacao da staff.` });

    const collector = confirmMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 24 * 60 * 60 * 1000 });

    let confirmadoPor = [];

    collector.on("collect", async (i) => {
        if (i.customId === "limpeza_cancelar") {
            await i.update({ content: "❌ Limpeza **CANCELADA** por " + i.user.tag, embeds: [], components: [] });
            collector.stop("cancelled"); return;
        }

        if (i.customId === "limpeza_confirmar") {
            if (confirmadoPor.includes(i.user.id)) { await i.reply({ content: "❌ Ja confirmaste!", ephemeral: true }); return; }

            confirmadoPor.push(i.user.id);
            const minConfirmacoes = i.user.id === interaction.user.id ? 1 : 2;

            if (confirmadoPor.length >= minConfirmacoes) {
                collector.stop("confirmed");
                await i.update({ content: `✅ Limpeza **CONFIRMADA** por: ${confirmadoPor.map(id => `<@${id}>`).join(", ")}`, embeds: [], components: [] });
                await executarLimpeza(interaction, inativosParaLimpar, protegidos);
            } else {
                await i.reply({ content: `✅ Confirmado por ${i.user.tag}. Falta **${minConfirmacoes - confirmadoPor.length}** confirmacao(oes).`, ephemeral: true });
            }
        }
    });

    collector.on("end", async (collected, reason) => {
        if (reason === "time") { await confirmMessage.edit({ content: "⏰ Tempo esgotado. Limpeza **NAO EXECUTADA**.", embeds: [], components: [] }); }
    });
}

async function executarLimpeza(interaction, inativosParaLimpar, protegidos) {
    const jornalChannel = await interaction.client.channels.fetch(TRUCKY_CONFIG.channels.jornalPat);
    const logsChannel = await interaction.client.channels.fetch(TRUCKY_CONFIG.channels.logs);

    const resultEmbed = new EmbedBuilder()
        .setTitle("🧹 Resultado da Limpeza - Portugal Alfa Truckers")
        .setDescription("Processo de limpeza executado automaticamente")
        .setColor(TRUCKY_CONFIG.cores.info)
        .setTimestamp();

    let removidos = [], erros = [], patentesRemovidas = 0;

    for (const member of inativosParaLimpar) {
        if (!member.discordId) { erros.push({ name: member.name, reason: "Sem Discord ID" }); continue; }

        try {
            const discordMember = await interaction.guild.members.fetch(member.discordId);

            const todosCargosPatentes = [...TRUCKY_CONFIG.patentes.map(p => p.cargoDiscord), ...TRUCKY_CONFIG.cargosBase.map(c => c.cargoDiscord)];

            for (const cargoId of todosCargosPatentes) {
                if (cargoId && cargoId !== "ID_CARGO" && discordMember.roles.cache.has(cargoId)) {
                    await discordMember.roles.remove(cargoId); patentesRemovidas++;
                }
            }

            if (TRUCKY_CONFIG.cargoMembroVTC && discordMember.roles.cache.has(TRUCKY_CONFIG.cargoMembroVTC)) {
                await discordMember.roles.remove(TRUCKY_CONFIG.cargoMembroVTC);
            }

            removidos.push({ name: member.name, discordId: member.discordId, daysInactive: member.daysSinceLastJob });
        } catch (err) { erros.push({ name: member.name, reason: err.message }); }
    }

    resultEmbed.addFields(
        { name: "✅ Removidos", value: `${removidos.length}`, inline: true },
        { name: "🛡️ Protegidos", value: `${protegidos.length}`, inline: true },
        { name: "❌ Erros", value: `${erros.length}`, inline: true },
        { name: "🎖️ Patentes Removidas", value: `${patentesRemovidas}`, inline: true }
    );

    if (removidos.length > 0) {
        let removedText = "";
        for (const r of removidos) { const status = r.daysInactive === Infinity ? "Nunca fez carga" : `${r.daysInactive} dias`; removedText += `• <@${r.discordId}> - ${status}\n`; }
        resultEmbed.addFields({ name: "📋 Membros Removidos", value: removedText.substring(0, 1024), inline: false });
    }

    await logsChannel.send({ embeds: [resultEmbed] });

    const avisoEmbed = new EmbedBuilder()
        .setTitle("🧹 Limpeza de Membros Concluida")
        .setDescription(`Foi realizada uma limpeza de membros inativos na **Portugal Alfa Truckers**.\n\n**${removidos.length}** membros foram removidos por inatividade.\n**${protegidos.length}** membros da staff foram mantidos (protegidos).\n\nPara evitar remocao futura, mantenham-se ativos fazendo cargas regularmente!`)
        .setColor(TRUCKY_CONFIG.cores.aviso)
        .setTimestamp();

    await jornalChannel.send({ embeds: [avisoEmbed] });
}

async function handleMapa(interaction) {
    await interaction.deferReply();

    const jogo = interaction.options.getString("jogo") || "ets2";
    const isETS2 = jogo === "ets2";

    try {
        const members = await TruckyAPI.getCompanyMembers();
        const onlineDrivers = [];

        for (const member of members) {
            const location = await TruckyAPI.getMemberLocation(member.id);
            if (location && location.online) {
                onlineDrivers.push({
                    name: member.name, discordId: member.discord_id, avatar: member.avatar_url,
                    city: location.city_name || "Desconhecido", country: location.country_name || "",
                    speed: location.speed || 0, game: location.game_id === 1 ? "ETS2" : "ATS"
                });
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`🗺️ Mapa da Frota - Portugal Alfa Truckers`)
            .setDescription(`**${isETS2 ? "Euro Truck Simulator 2" : "American Truck Simulator"}**\n\nMotoristas online: **${onlineDrivers.length}** | Total VTC: **${members.length}**`)
            .setColor(TRUCKY_CONFIG.cores.trucky)
            .setTimestamp();

        if (onlineDrivers.length > 0) {
            let driversText = "";
            for (const driver of onlineDrivers) {
                const mention = driver.discordId ? `<@${driver.discordId}>` : driver.name;
                const speedEmoji = driver.speed > 0 ? "🚛" : "🅿️";
                driversText += `${speedEmoji} ${mention} - ${driver.city} (${Math.round(driver.speed)} km/h) [${driver.game}]\n`;
            }
            embed.addFields({ name: "🚛 Motoristas Online", value: driversText.substring(0, 1024), inline: false });
        } else {
            embed.addFields({ name: "🚛 Motoristas Online", value: "Nenhum motorista online de momento.", inline: false });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setLabel("🗺️ Mapa ETS2").setURL("https://map.truckyapp.com/ets2").setStyle(ButtonStyle.Link),
                new ButtonBuilder().setLabel("🗺️ Mapa ATS").setURL("https://map.truckyapp.com/ats").setStyle(ButtonStyle.Link),
                new ButtonBuilder().setLabel("📍 Mapa da VTC").setURL(TruckyAPI.getCompanyMapUrl()).setStyle(ButtonStyle.Link)
            );

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error("[Mapa] Erro:", error);
        const embed = new EmbedBuilder().setTitle("🗺️ Mapa da Frota - Portugal Alfa Truckers").setDescription(`Nao foi possivel obter dados em tempo real, mas podes aceder aos mapas:`).setColor(TRUCKY_CONFIG.cores.info).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("🗺️ Mapa ETS2").setURL("https://map.truckyapp.com/ets2").setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel("🗺️ Mapa ATS").setURL("https://map.truckyapp.com/ats").setStyle(ButtonStyle.Link)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
}
