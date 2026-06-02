import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { ASSISTANT_CONFIG } from "../config/index.js";
import { encontrarRespostaFAQ } from "../database/faq.js";
import { assistantMemory } from "../services/ajuda.js";
import { MessageAnalyzer } from "./analyzer.js";

// Helper para gerar Custom IDs seguros (max 100 chars)
function safeCustomId(prefix, messageId, extra = "") {
    const base = `${prefix}_${messageId}`;
    if (extra) {
        const hash = simpleHash(extra).toString(36).substring(0, 8);
        return `${base}_${hash}`.substring(0, 100);
    }
    return base.substring(0, 100);
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

export async function handleSmartResponse(message, client) {
    if (message.author.bot) return;
    if (!ASSISTANT_CONFIG.ALLOWED_CHANNELS.includes(message.channel.id)) return;
    if (assistantMemory.isOnCooldown(message.author.id)) return;

    const contentLower = message.content.toLowerCase();

    // ===== IMPROVED FILTERING =====
    const questionWords = ["como", "onde", "quando", "porque", "pq", "?", "ajuda", "help", "dúvida", "duvida", "sabe", "sabes", "consegues", "podes", "posso", "qual", "quais"];
    const isQuestion = questionWords.some(qw => contentLower.includes(qw));

    const gameKeywords = ["ets2", "ats", "truck", "trucky", "truckersmp", "mod", "skin", "comboio", "convoy", "servidor", "recrutamento", "pat", "vtc", "km", "viagem", "carga", "ets", "american truck", "euro truck"];
    const isGameRelated = gameKeywords.some(kw => contentLower.includes(kw));

    const techKeywords = ["configurar", "instalar", "problema", "erro", "crash", "lag", "fps", "grafico", "vr", "volante", "g29", "g920", "shifter", "camera", "mod", "dlc", "save", "perfil", "steam", "workshop"];
    const isTechRelated = techKeywords.some(kw => contentLower.includes(kw));

    const mentionsDiego = message.mentions.users.has(ASSISTANT_CONFIG.EXPERT_USER_ID);

    const shouldRespond = (isQuestion && (isGameRelated || isTechRelated)) || mentionsDiego;
    if (!shouldRespond) return;

    assistantMemory.setCooldown(message.author.id);

    const question = message.content.replace(/<@!?\d+>/g, "").trim();

    // 1. Tentar FAQ primeiro
    const faqResposta = encontrarRespostaFAQ(question);
    if (faqResposta.found) {
        const embed = new EmbedBuilder()
            .setTitle(faqResposta.titulo)
            .setDescription(faqResposta.texto)
            .setColor(0x00ff00)
            .setFooter({ text: "🤖 Resposta automática — Info pode não estar 100% atualizada" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(safeCustomId("smart_helpful", message.id))
                .setLabel("✅ Resolveu!")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(safeCustomId("smart_not_helpful", message.id))
                .setLabel("❌ Não é isto")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(safeCustomId("smart_search", message.id, question))
                .setLabel("🔍 Pesquisar na net")
                .setStyle(ButtonStyle.Primary)
        );

        try {
            const sent = await message.reply({
                embeds: [embed],
                components: [row]
            });

            assistantMemory.pendingSearches.set(message.id, {
                question: question,
                messageId: sent.id,
                channelId: message.channel.id
            });
        } catch (err) {
            console.error("[SmartResponse] Erro ao enviar FAQ:", err.message);
        }
        return;
    }

    // 2. Tentar histórico do Diego
    try {
        const analyzer = new MessageAnalyzer(client);
        const similar = analyzer.findSimilarResponses(question);

        if (similar.length > 0) {
            const best = similar[0];
            let texto = "💡 **Baseado no que o <@" + ASSISTANT_CONFIG.EXPERT_USER_ID + "> já respondeu:**\n\n";
            texto += "> " + best.content + "\n\n";

            if (best.hasLinks.length > 0) {
                texto += "🔗 **Links mencionados:**\n";
                best.hasLinks.forEach(link => {
                    texto += "• " + link + "\n";
                });
                texto += "\n";
            }

            texto += "⚠️ *Esta resposta foi baseada no histórico de mensagens. Pode não estar 100% atualizada.*";

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(safeCustomId("smart_helpful", message.id))
                    .setLabel("✅ Resolveu!")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(safeCustomId("smart_not_helpful", message.id))
                    .setLabel("❌ Não é isto")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(safeCustomId("smart_search", message.id, question))
                    .setLabel("🔍 Pesquisar na net")
                    .setStyle(ButtonStyle.Primary)
            );

            const sent = await message.reply({ content: texto, components: [row] });

            assistantMemory.pendingSearches.set(message.id, {
                question: question,
                messageId: sent.id,
                channelId: message.channel.id
            });
            return;
        }
    } catch (err) {
        console.error("[SmartResponse] Erro no analyzer:", err.message);
    }

    // 3. Se não encontrou nada, sugere pesquisa
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(safeCustomId("smart_do_search", message.id, question))
            .setLabel("🔍 Pesquisar na internet")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("smart_cancel")
            .setLabel("✖️ Cancelar")
            .setStyle(ButtonStyle.Secondary)
    );

    try {
        const sent = await message.reply({
            content: "🤔 **Não encontrei nenhuma resposta no histórico nem no FAQ.**\n\nQueres que eu **pesquise na internet** por: "" + question + ""?",
            components: [row]
        });

        assistantMemory.pendingSearches.set(message.id, {
            question: question,
            messageId: sent.id,
            channelId: message.channel.id
        });
    } catch (err) {
        console.error("[SmartResponse] Erro ao enviar sugestão:", err.message);
    }
}
