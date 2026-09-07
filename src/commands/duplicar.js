// src/commands/duplicar.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

// Mapeamento da estrutura atual do servidor principal
// (Isto deve ser ajustado conforme a tua estrutura real)
const ESTRUTURA = {
    categorias: [
        { nome: "📋 Tickets", id: CONFIG.CATEGORIA_TICKETS_GERAL },
        { nome: "📝 Recrutamento", id: CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO },
        { nome: "📁 Logs", id: CONFIG.CATEGORIA_LOGS_RECRUTAMENTO || null },
    ],
    canais: [
        { nome: "tickets-geral", tipo: 0, categoria: "📋 Tickets", id: CONFIG.CANAL_TICKETS_GERAL },
        { nome: "recrutamento", tipo: 0, categoria: "📝 Recrutamento", id: CONFIG.CANAL_TICKETS_RECRUTAMENTO },
        { nome: "logs", tipo: 0, categoria: "📁 Logs", id: CONFIG.CANAL_LOGS },
        { nome: "geral", tipo: 0, categoria: null, id: CONFIG.CANAL_GERAL },
        { nome: "regras", tipo: 0, categoria: null, id: CONFIG.CANAL_REGRAS },
    ],
    cargos: [
        { nome: "Staff", cor: "#5865F2", id: CONFIG.CARGO_STAFF },
        { nome: "Membro", cor: "#57F287", id: CONFIG.CARGO_MEMBRO },
        { nome: "Recrutado", cor: "#FEE75C", id: CONFIG.CARGO_RECRUTADO },
        { nome: "Administração", cor: "#ED4245", id: CONFIG.CARGO_ADMINISTRACAO },
    ]
};

export const data = new SlashCommandBuilder()
    .setName("duplicar")
    .setDescription("Duplica a estrutura do servidor (categorias, canais, cargos) neste servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    if (!interaction.guild) {
        return interaction.reply({ content: "❌ Este comando só pode ser usado em servidores.", ephemeral: true });
    }

    // Apenas administradores
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Precisas de permissão de administrador.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const resultados = {
        categorias: {},
        canais: {},
        cargos: {},
        erros: []
    };

    try {
        // 1. CRIAR CATEGORIAS
        for (const cat of ESTRUTURA.categorias) {
            if (!cat.nome) continue;
            try {
                const existing = guild.channels.cache.find(c => c.type === 4 && c.name === cat.nome);
                if (existing) {
                    resultados.categorias[cat.nome] = existing.id;
                    continue;
                }
                const newCat = await guild.channels.create({
                    name: cat.nome,
                    type: 4, // Categoria
                });
                resultados.categorias[cat.nome] = newCat.id;
            } catch (e) {
                resultados.erros.push(`❌ Categoria "${cat.nome}": ${e.message}`);
            }
        }

        // 2. CRIAR CANAIS
        for (const canal of ESTRUTURA.canais) {
            try {
                const parentId = canal.categoria ? resultados.categorias[canal.categoria] : null;
                const existing = guild.channels.cache.find(c => c.type === 0 && c.name === canal.nome);
                if (existing) {
                    resultados.canais[canal.nome] = existing.id;
                    continue;
                }
                const newChannel = await guild.channels.create({
                    name: canal.nome,
                    type: 0, // Texto
                    parent: parentId || undefined,
                });
                resultados.canais[canal.nome] = newChannel.id;
            } catch (e) {
                resultados.erros.push(`❌ Canal "${canal.nome}": ${e.message}`);
            }
        }

        // 3. CRIAR CARGOS
        for (const cargo of ESTRUTURA.cargos) {
            try {
                const existing = guild.roles.cache.find(r => r.name === cargo.nome);
                if (existing) {
                    resultados.cargos[cargo.nome] = existing.id;
                    continue;
                }
                const newRole = await guild.roles.create({
                    name: cargo.nome,
                    color: cargo.cor || "#99AAB5",
                    mentionable: true,
                });
                resultados.cargos[cargo.nome] = newRole.id;
            } catch (e) {
                resultados.erros.push(`❌ Cargo "${cargo.nome}": ${e.message}`);
            }
        }

        // 4. CRIAR EMBED COM RESUMO
        const embed = new EmbedBuilder()
            .setTitle("🏗️ Estrutura Duplicada")
            .setDescription(`Estrutura criada com sucesso no servidor **${guild.name}**!`)
            .setColor(0x57F287)
            .setTimestamp();

        // Adicionar IDs das categorias
        let catText = Object.entries(resultados.categorias)
            .map(([nome, id]) => `• ${nome}: \`${id}\``)
            .join("\n") || "Nenhuma";
        embed.addFields({ name: "📂 Categorias", value: catText, inline: false });

        // Adicionar IDs dos canais
        let chanText = Object.entries(resultados.canais)
            .map(([nome, id]) => `• ${nome}: \`${id}\``)
            .join("\n") || "Nenhum";
        embed.addFields({ name: "💬 Canais", value: chanText, inline: false });

        // Adicionar IDs dos cargos
        let roleText = Object.entries(resultados.cargos)
            .map(([nome, id]) => `• ${nome}: \`${id}\``)
            .join("\n") || "Nenhum";
        embed.addFields({ name: "🎖️ Cargos", value: roleText, inline: false });

        // Erros (se houver)
        if (resultados.erros.length > 0) {
            embed.addFields({
                name: "⚠️ Erros",
                value: resultados.erros.join("\n").slice(0, 1024),
                inline: false
            });
        }

        // 5. Adicionar um campo com o ID do servidor para referência
        embed.addFields({
            name: "🆔 ID do Servidor",
            value: `\`${guild.id}\``,
            inline: true
        });

        await interaction.editReply({ embeds: [embed] });

        // 6. Enviar também para o canal de logs do bot (se existir)
        try {
            const logChannel = await interaction.client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
            if (logChannel) {
                await logChannel.send({
                    content: `🔁 **Servidor duplicado:** ${guild.name} (${guild.id}) por ${interaction.user.tag}`,
                    embeds: [embed]
                });
            }
        } catch (e) { /* ignorar */ }

    } catch (error) {
        console.error("[Duplicar] Erro:", error);
        await interaction.editReply({
            content: `❌ Erro ao duplicar estrutura: ${error.message}`
        });
    }
}
