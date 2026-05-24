import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import { CONFIG, ASSISTANT_CONFIG } from "../config/index.js";
import { encontrarRespostaFAQ } from "../database/faq.js";
import { encontrarTutorialPAC } from "../database/tutoriais.js";
import { isTopicoPermitido } from "../database/topicos.js";
import { safeEditReply } from "../utils/safeReply.js";

// ==================== MEMORIA DO ASSISTENTE ====================
export const assistantMemory = {
    diegoHistory: [],
    userCooldowns: new Map(),
    pendingSearches: new Map(),
    recentHelp: new Map(),

    isOnCooldown(userId) {
        const last = this.userCooldowns.get(userId) || 0;
        return (Date.now() - last) < (ASSISTANT_CONFIG.COOLDOWN * 1000);
    },
    setCooldown(userId) {
        this.userCooldowns.set(userId, Date.now());
    }
};

// ==================== SISTEMA /AJUDA ====================
export async function handleAjudaCommand(interaction, client) {
    const umaHora = 60 * 60 * 1000;
    for (const [uid, data] of assistantMemory.recentHelp.entries()) {
        if (Date.now() - data.timestamp > umaHora) {
            assistantMemory.recentHelp.delete(uid);
        }
    }

    const recentes = Array.from(assistantMemory.recentHelp.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

    const descricao = [
        "**Bem-vindo a Central de Ajuda da PAC!**",
        "Sou o assistente inteligente. Posso ajudar-te com:",
        "",
        "🎮 **Servidor** — ID, regras, como entrar",
        "🚛 **Recrutamento** — Requisitos, Trucky, candidatura",
        "⚙️ **ETS2LA** — Configuracao, mods, atualizacoes",
        "🥽 **VR** — Meta Quest, tutoriais",
        "📲 **Trucky** — Download, instalacao",
        "",
        "📋 **Passos para Recrutamento:**",
        "`1.` Instala o Trucky App: https://hub.truckyapp.com/",
        "`2.` Cria conta e liga ao Steam",
        "`3.` Solicita vaga na Portugal Alfa Truckers",
        "`4.` Abre ticket de recrutamento aqui no Discord",
        "",
        "⚠️ **Requisitos PAT:**",
        "• Máx. 100 km/h sempre",
        "• 15.000 KM/mês (≈ 500 km/dia)",
        "• Respeito e disciplina nos comboios",
        "• Foco no ranking nacional 0-100 km/h",
        ...(recentes.length > 0 ? [
            "",
            "**📋 Perguntas recentes:**",
            ...recentes.map((r, i) => {
                const perguntaCurta = r.pergunta.length > 40 ? r.pergunta.substring(0, 40) + "..." : r.pergunta;
                return "`" + (i + 1) + ".` " + perguntaCurta;
            })
        ] : []),
        "",
        "Clica em **🔍 Procurar** para fazer a tua pergunta!"
    ].join("\n");

    const embed = new EmbedBuilder()
        .setTitle("🆘 Central de Ajuda - Portugal Alfa")
        .setDescription(descricao)
        .setColor(0x262af1)
        .setThumbnail(CONFIG.IMAGEM_GERAL)
        .setFooter({ text: "Powered by PAC Bot 🤖", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ajuda_procurar")
            .setLabel("🔍 Procurar ajuda")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("ajuda_ticket")
            .setLabel("🎫 Abrir ticket")
            .setStyle(ButtonStyle.Danger)
    );

    if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: 64 });
    }

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

export async function handleAjudaProcurar(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("modal_ajuda")
        .setTitle("🔍 O que precisas?");

    const input = new TextInputBuilder()
        .setCustomId("pergunta_ajuda")
        .setLabel("Descreve o que precisas")
        .setPlaceholder("Ex: como entrar no servidor, configurar ETS2LA, juntar a PAT...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(200);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

export async function handleAjudaModal(interaction, client) {
    const pergunta = interaction.fields.getTextInputValue("pergunta_ajuda").toLowerCase();

    await interaction.deferReply({ flags: 64 });

    if (!isTopicoPermitido(pergunta)) {
        const embed = new EmbedBuilder()
            .setTitle("❌ Fora do Ambito")
            .setDescription([
                "Desculpa, mas so posso ajudar com temas relacionados com:",
                "",
                "🎮 **Euro Truck Simulator 2 / American Truck Simulator**",
                "🚛 **Portugal Alfa Truckers / VTC**",
                "⚙️ **Mods, Configuracoes, Tutoriais**",
                "📲 **Trucky, TruckersMP, Steam**",
                "",
                "A tua pergunta parece nao estar relacionada com estes temas.",
                "",
                "💡 **Exemplos do que posso ajudar:**",
                "• Como ativar a camara zero",
                "• Como entrar no servidor da PAC",
                "• Como instalar mods",
                "• Problemas com o Trucky",
                "• Configurar VR / ETS2LA",
                "",
                "Se precisares de ajuda com outro assunto, clica em **🎫 Abrir ticket**."
            ].join("\n"))
            .setColor(0xff0000)
            .setFooter({ text: "Powered by PAC Bot 🤖", iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ajuda_nova")
                .setLabel("🔄 Nova pergunta")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("ajuda_ticket")
                .setLabel("🎫 Abrir ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
        return;
    }

    const tutorial = encontrarTutorialPAC(pergunta);
    if (tutorial) {
        assistantMemory.recentHelp.set(interaction.user.id, {
            pergunta: pergunta,
            resposta: tutorial.titulo,
            timestamp: Date.now()
        });

        const descricao = [
            tutorial.resumo,
            "",
            "👤 **Autor:** " + tutorial.autor,
            "📌 **Canal:** " + tutorial.canal,
            "",
            "💡 Se ainda tiveres duvidas, clica em **🎫 Abrir ticket** para falar com a staff."
        ].join("\n");

        const embed = new EmbedBuilder()
            .setTitle(tutorial.titulo)
            .setDescription(descricao)
            .setColor(0x9b59b6)
            .setFooter({ text: "Tutorial da PAC 📚 • Por " + tutorial.autor, iconURL: client.user?.displayAvatarURL() })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ajuda_nova")
                .setLabel("🔄 Nova pergunta")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("ajuda_ticket")
                .setLabel("🎫 Abrir ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
        return;
    }

    const resposta = encontrarRespostaFAQ(pergunta);

    assistantMemory.recentHelp.set(interaction.user.id, {
        pergunta: pergunta,
        resposta: resposta.titulo,
        timestamp: Date.now()
    });

    if (resposta.found) {
        const embed = new EmbedBuilder()
            .setTitle(resposta.titulo)
            .setDescription(resposta.texto(CONFIG))
            .setColor(0x00ff00)
            .setFooter({ text: "⚠️ Informacao automatica — pode nao estar 100% atualizada" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ajuda_nova")
                .setLabel("🔄 Nova pergunta")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("ajuda_ticket")
                .setLabel("🎫 Abrir ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle("❓ Nao encontrei resultados")
        .setDescription([
            "Nao encontrei informacoes sobre: **\"" + pergunta + "\"**",
            "",
            "**O que podes fazer:**",
            "• Reformular a pergunta com palavras-chave (ex: servidor, recrutamento, ETS2LA, mods, VR, Trucky)",
            "• Verificar os tutoriais no canal <#" + CONFIG.CANAL_REGRAS + ">",
            "• Abrir um ticket para ajuda personalizada",
            "",
            "💡 **Dica:** Escreve de forma simples, por exemplo:",
            "`como entrar no servidor` ou `como juntar a PAT`"
        ].join("\n"))
        .setColor(0xff9800)
        .setFooter({ text: "Powered by PAC Bot 🤖", iconURL: client.user?.displayAvatarURL() })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ajuda_nova")
            .setLabel("🔄 Nova pergunta")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("ajuda_ticket")
            .setLabel("🎫 Abrir ticket")
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}
