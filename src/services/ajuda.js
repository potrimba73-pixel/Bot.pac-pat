// ============================================================
// services/ajuda.js - Sistema de Ajuda Inteligente
// ============================================================

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import logger from "../utils/logger.js";

// ✅ CORREÇÃO: importar do ficheiro correto
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";

export const assistantMemory = new Map();

export async function handleAjudaCommand(interaction, client) {
  if (!interaction.isRepliable()) return;

  // ✅ Usar safeDeferReply em vez de safeDefer
  const deferred = await safeDeferReply(interaction);
  if (!deferred) {
    if (interaction.isRepliable()) {
      await interaction.reply({ content: "❌ O bot está ocupado, tenta novamente.", flags: 64 });
    }
    return;
  }

  try {
    const embed = new EmbedBuilder()
      .setTitle("❓ Como posso ajudar?")
      .setDescription(
        "👋 Olá! Eu posso ajudar-te com:\n" +
        "• Dúvidas sobre o servidor\n" +
        "• Configuração do Trucky App\n" +
        "• Regras e recrutamento\n\n" +
        "**Escreve a tua pergunta abaixo:**"
      )
      .setColor(0x00ff88)
      .setTimestamp();

    const modal = new ModalBuilder()
      .setCustomId(`modal_ajuda_${interaction.user.id}_${Date.now()}`)
      .setTitle("Nova Pergunta de Ajuda");

    const inputPergunta = new TextInputBuilder()
      .setCustomId("pergunta_ajuda")
      .setLabel("Escreve a tua pergunta")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    const inputDetalhes = new TextInputBuilder()
      .setCustomId("detalhes_ajuda")
      .setLabel("Detalhes adicionais (opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputPergunta),
      new ActionRowBuilder().addComponents(inputDetalhes)
    );

    // Nota: Para comandos que abrem modal, NÃO se deve deferir.
    // Por isso, esta função deve ser chamada sem defer (apenas no comando /ajuda).
    // Se já deferiste, não podes usar showModal.
    // Vou responder com um aviso, mas o ideal é ajustar no interactionCreate para não deferir o /ajuda.
    await safeEditReply(interaction, {
      content: "ℹ️ Por favor, usa o comando `/ajuda` novamente para abrir o formulário.",
      flags: 64,
    });
  } catch (error) {
    console.error("[handleAjudaCommand] Erro:", error);
    await safeEditReply(interaction, { content: "❌ Erro ao processar o comando.", flags: 64 });
  }
}

export async function handleAjudaProcurar(interaction) {
  const deferred = await safeDeferReply(interaction);
  if (!deferred) return;

  try {
    await safeEditReply(interaction, {
      content: "🔍 Para pesquisar, usa o comando `/ajuda` e escreve a tua pergunta no modal.",
      flags: 64,
    });
  } catch (error) {
    console.error("[handleAjudaProcurar] Erro:", error);
    await safeEditReply(interaction, { content: "❌ Erro ao pesquisar.", flags: 64 });
  }
}

export async function handleAjudaModal(interaction, client) {
  const deferred = await safeDeferReply(interaction);
  if (!deferred) {
    if (interaction.isRepliable()) {
      await interaction.reply({ content: "❌ O bot está ocupado, tenta novamente.", flags: 64 });
    }
    return;
  }

  try {
    const pergunta = interaction.fields.getTextInputValue("pergunta_ajuda");
    const detalhes = interaction.fields.getTextInputValue("detalhes_ajuda") || "";

    let logThread = null;
    try {
      logThread = await logger.createUserThread(
        client,
        interaction.user.id,
        interaction.user.username,
        pergunta
      );
      if (logThread) {
        await logger.logToThread(
          client,
          logThread.id,
          `📩 **Pergunta:** ${pergunta}\n📝 **Detalhes:** ${detalhes || "Nenhum"}`
        );
      }
    } catch (e) {
      console.warn("[AjudaModal] Erro ao criar thread de log:", e.message);
    }

    const resposta = await gerarRespostaInteligente(pergunta, interaction, client);
    assistantMemory.set(interaction.user.id, { pergunta, resposta, timestamp: Date.now() });

    const embed = new EmbedBuilder()
      .setTitle("❓ Resposta de Ajuda")
      .setDescription(
        `**📝 Pergunta:**\n> ${pergunta}\n\n` +
        `**💡 Resposta:**\n${resposta}\n\n` +
        "ℹ️ Esta resposta foi útil?"
      )
      .setColor(0x00ff00)
      .setTimestamp()
      .setFooter({ text: "Portugal Alfa Community • Feedback ajuda a melhorar!" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`smart_helpful_${interaction.user.id}`)
        .setLabel("✅ Sim, resolveu!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`smart_not_helpful_${interaction.user.id}`)
        .setLabel("❌ Não, preciso de mais ajuda")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ajuda_ticket_direct_${interaction.user.id}`)
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await safeEditReply(interaction, { embeds: [embed], components: [row], flags: 64 });

    if (logThread) {
      await logger.logToThread(
        client,
        logThread.id,
        `💬 **Resposta enviada:** ${resposta.substring(0, 300)}...`
      );
      assistantMemory.set(`thread_${interaction.user.id}`, logThread.id);
    }
  } catch (error) {
    console.error("[AjudaModal] Erro:", error);
    await safeEditReply(interaction, { content: "❌ Ocorreu um erro ao processar a tua pergunta.", flags: 64 });
  }
}

async function gerarRespostaInteligente(pergunta, interaction, client) {
  // 1. Histórico do Diego
  try {
    const { MessageAnalyzer } = await import("../assistant/analyzer.js");
    const analyzer = client.messageAnalyzer || new MessageAnalyzer(client);
    const guild = interaction.guild;
    const userId = "849132183112384573";
    if (!assistantMemory.diegoHistory || assistantMemory.diegoHistory.length === 0) {
      await analyzer.fetchExpertHistory(guild, userId, 50);
    }
    const similar = analyzer.findSimilarResponses(pergunta);
    if (similar.length > 0) {
      const best = similar[0];
      let texto = `**Baseado no que o <@${userId}> já respondeu:**\n\n> ${best.content}\n\n`;
      if (best.hasLinks && best.hasLinks.length > 0) {
        texto += "**Links mencionados:**\n" + best.hasLinks.map(l => `• ${l}`).join("\n") + "\n\n";
      }
      texto += "*Esta resposta foi baseada no histórico de mensagens. Pode não estar 100% atualizada.*";
      return texto;
    }
  } catch (err) {
    console.warn("[gerarRespostaInteligente] Erro no histórico:", err.message);
  }

  // 2. FAQ
  try {
    const { encontrarRespostaFAQ } = await import("../database/faq.js");
    const faq = encontrarRespostaFAQ(pergunta);
    if (faq.found) return faq.texto;
  } catch (err) {
    console.warn("[gerarRespostaInteligente] Erro no FAQ:", err.message);
  }

  // 3. IA externa
  try {
    const { callPollinationsAI, callGeminiAI } = await import("../assistant/ets2AI.js");
    let answer = await callPollinationsAI(pergunta) || await callGeminiAI(pergunta);
    if (answer) return answer;
  } catch (err) {
    console.warn("[gerarRespostaInteligente] Erro na IA:", err.message);
  }

  // 4. Fallback
  return (
    "ℹ️ **Não encontrei uma resposta específica.**\n" +
    "💡 Tenta reformular ou usar palavras-chave como 'câmara', 'regras', 'ticket', 'recrutamento'.\n" +
    "🎫 **Alternativa:** Abre um ticket para ajuda personalizada."
  );
}

export async function handleAjudaFeedback(interaction) {
  if (!interaction.isRepliable()) return;

  const customId = interaction.customId;

  try {
    if (customId === "ajuda_ticket" || customId.startsWith("ajuda_ticket_direct_")) {
      await interaction.reply({
        content: `🎫 Para abrir um ticket, vai ao canal <#${CONFIG.CANAL_TICKETS_GERAL}>.`,
        flags: 64,
      });
      return;
    }

    if (customId === "ajuda_faq") {
      await interaction.reply({
        content: "📖 **FAQ Rápido:** ...",
        flags: 64,
      });
      return;
    }

    if (customId === "ajuda_nova") {
      await interaction.reply({
        content: "🔍 Clica em **Procurar Ajuda** para fazer uma nova pergunta.",
        flags: 64,
      });
      return;
    }

    if (customId === "ajuda_procurar") {
      return handleAjudaProcurar(interaction);
    }

    if (customId.startsWith("smart_helpful_") || customId.startsWith("smart_not_helpful_")) {
      const isHelpful = customId.startsWith("smart_helpful_");
      const userId = customId.split("_")[2];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: "⚠️ Este feedback não é para ti!", flags: 64 });
        return;
      }

      const feedback = isHelpful ? "✅ Positivo" : "❌ Negativo";
      await interaction.reply({ content: `📝 Obrigado pelo feedback! (${feedback})`, flags: 64 });

      const threadId = assistantMemory.get(`thread_${interaction.user.id}`);
      if (threadId) {
        await logger.updateThreadWithFeedback(interaction.client, threadId, feedback);
        await logger.logToThread(interaction.client, threadId, `📊 **Feedback:** ${feedback}`);
      }

      try {
        const logChannel = await interaction.client.channels
          .fetch(CONFIG.CANAL_LOGS)
          .catch(() => null);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle("📊 Feedback da Ajuda")
            .setDescription(
              `👤 Utilizador: ${interaction.user.tag}\n📝 Feedback: ${feedback}`
            )
            .setColor(isHelpful ? 0x00ff00 : 0xff0000)
            .setTimestamp();
          await logChannel.send({ embeds: [embed] });
        }
      } catch (e) {
        console.warn("[AjudaFeedback] Erro ao enviar log:", e.message);
      }
      return;
    }

    await interaction.reply({ content: "❌ Ação desconhecida.", flags: 64 });
  } catch (error) {
    if (error.code !== 10062) console.error("[AjudaFeedback] Erro:", error);
  }
}
