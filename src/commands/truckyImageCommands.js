import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { gerarFotoMembro, gerarFotoPatente, verificarTemplate } from "../utils/truckyImageGenerator.js";
import TruckyAPI from "../utils/truckyAPI.js";
import { TRUCKY_CONFIG } from "../config/trucky.js";

export const truckyImageSlashCommands = [
    new SlashCommandBuilder()
        .setName("gerar-foto")
        .setDescription("Gera foto de membro PAT com template (como nas fotos do canal)")
        .addStringOption(option =>
            option.setName("nome")
                .setDescription("Nome do motorista (ex: BALEIA07, Mar)")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("cor")
                .setDescription("Cor do texto (hex, ex: #FFFFFF)")
                .setRequired(false))
        .addStringOption(option =>
            option.setName("efeito")
                .setDescription("Efeito do texto")
                .addChoices(
                    { name: "Outline", value: "outline" },
                    { name: "Sombra", value: "shadow" },
                    { name: "Glow", value: "glow" },
                    { name: "Nenhum", value: "none" }
                ).setRequired(false))
        .setDefaultMemberPermissions(null)
        .toJSON(),

    new SlashCommandBuilder()
        .setName("minha-foto")
        .setDescription("Gera a tua foto de membro PAT automaticamente com dados do Trucky")
        .setDefaultMemberPermissions(null)
        .toJSON(),

    new SlashCommandBuilder()
        .setName("gerar-patente")
        .setDescription("Gera imagem de patente com progresso de KM")
        .addStringOption(option =>
            option.setName("nome")
                .setDescription("Nome do motorista")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("patente")
                .setDescription("Nome da patente")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("km")
                .setDescription("KM totais")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("km-proxima")
                .setDescription("KM para proxima patente (0 = maxima)")
                .setRequired(false))
        .setDefaultMemberPermissions(null)
        .toJSON(),

    new SlashCommandBuilder()
        .setName("verificar-templates")
        .setDescription("Verifica se os templates de imagem existem (Staff)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),
];

export async function handleTruckyImageCommand(interaction) {
    const commandName = interaction.commandName;

    try {
        switch (commandName) {
            case "gerar-foto": await handleGerarFoto(interaction); break;
            case "minha-foto": await handleMinhaFoto(interaction); break;
            case "gerar-patente": await handleGerarPatente(interaction); break;
            case "verificar-templates": await handleVerificarTemplates(interaction); break;
            default: return false;
        }
        return true;
    } catch (error) {
        console.error(`[TruckyImage] Erro em ${commandName}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Erro ao gerar imagem.", ephemeral: true });
        } else {
            await interaction.editReply({ content: "❌ Erro ao gerar imagem." });
        }
        return true;
    }
}

async function handleGerarFoto(interaction) {
    await interaction.deferReply();

    const nome = interaction.options.getString("nome");
    const cor = interaction.options.getString("cor") || "#FFFFFF";
    const efeito = interaction.options.getString("efeito") || "outline";

    const attachment = await gerarFotoMembro(nome, {
        corTexto: cor,
        efeito,
        sombra: efeito === "shadow" ? 6 : 0,
    });

    await interaction.editReply({
        content: `🎨 Foto gerada para **${nome}**!`,
        files: [attachment]
    });
}

async function handleMinhaFoto(interaction) {
    await interaction.deferReply();

    const members = await TruckyAPI.getCompanyMembers();
    const member = members.find(m => m.discord_id === interaction.user.id);

    if (!member) {
        return interaction.editReply({
            content: `❌ Nao encontrado na VTC do Trucky! Verifica se ligaste a tua conta do Discord.`
        });
    }

    const stats = await TruckyAPI.getMemberStats(member.id);
    const totalKm = stats?.total_driven_distance_km || 0;

    let patenteAtual = "Membro";
    for (const p of TRUCKY_CONFIG.patentes) {
        if (totalKm >= p.kmMin && totalKm <= p.kmMax) { patenteAtual = p.nome; break; }
    }

    const attachment = await gerarFotoMembro(member.name, {
        corTexto: "#FFFFFF",
        efeito: "outline",
    });

    await interaction.editReply({
        content: `🎨 Foto de membro gerada para **${member.name}**!\n🎖️ Patente: ${patenteAtual} (${Math.round(totalKm).toLocaleString("pt-PT")} km)`,
        files: [attachment]
    });
}

async function handleGerarPatente(interaction) {
    await interaction.deferReply();

    const nome = interaction.options.getString("nome");
    const patente = interaction.options.getString("patente");
    const km = interaction.options.getInteger("km");
    const kmProxima = interaction.options.getInteger("km-proxima") || 0;

    const attachment = await gerarFotoPatente(nome, patente, km, kmProxima);

    await interaction.editReply({
        content: `🎖️ Imagem de patente gerada para **${nome}** - ${patente}!`,
        files: [attachment]
    });
}

async function handleVerificarTemplates(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const existe = verificarTemplate();

    let status = `📁 Template padrao: ${existe ? "✅ Encontrado" : "❌ Em falta"}\n\n`;

    if (!existe) {
        status += "⚠️ Template em falta! O bot usara fallback (imagem gerada do zero).\n";
        status += "💡 Coloca 'template-padrao.png' em src/assets/ para usar o template personalizado.\n";
    }

    status += "\n🎨 A fonte Arturo-Bold.ttf pode ser colocada em src/assets/fonts/ para melhor qualidade.";

    await interaction.editReply({ content: status });
}
