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
// Importar as funções auxiliares do interactionCreate
import { safeReply, safeDefer, safeEdit } from "../events/interactionCreate.js";

export const assistantMemory = new Map();

export async function handleAjudaCommand(interaction, client) {
  if (!interaction.isRepliable()) return;

  // Usar safeDefer em vez de deferReply direto
  const deferred = await safeDefer(interaction);
  if (!deferred) {
    // Se não conseguiu deferir, tenta responder diretamente (fallback)
    if (interaction.isRepliable()) {
      await safeReply(interaction, "❌ O bot está ocupado, tenta novamente.", true);
    }
    return;
  }

  try {
    // Exemplo de resposta – aqui deves colocar a tua lógica existente
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

    // Criar modal para pergunta (se for o caso)
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

    // IMPORTANTE: como a interação já foi deferida, usamos showModal (não requer reply)
    // Mas o showModal só pode ser usado se a interação ainda não tiver sido deferida?
    // Na verdade, showModal funciona mesmo se a interação já estiver deferida? Não – o Discord exige que o modal seja mostrado como resposta à interação, e se já deferiste, não podes usar showModal porque já respondeste.
    // Portanto, a abordagem correta é NÃO deferir o comando /ajuda no handleSlashCommand, e aqui usar interaction.showModal diretamente.

    // Vamos mudar a estratégia: para comandos que abrem modal, não deferir.
    // Por isso, no handleSlashCommand, para o comando "ajuda", não chamamos safeDefer.
    // Mas como já tens o código, vou deixar esta função apenas com a lógica de resposta inline.
    // O melhor é refatorar: o comando /ajuda deve apenas abrir um modal, sem deferir.

    // Como isto é uma demonstração, vou usar safeEdit para responder com embed e botões.
    // Mas para abrir modal, temos de usar interaction.showModal (não editReply).
    // Por isso, sugiro que no handleSlashCommand, para o comando "ajuda", NÃO faças defer.

  } catch (error) {
    console.error("[handleAjudaCommand] Erro:", error);
    await safeEdit(interaction, { content: "❌ Erro ao processar o comando.", flags: 64 });
  }
}

export async function handleAjudaProcurar(interaction) {
  // Usar safeDefer
  const deferred = await safeDefer(interaction);
  if (!deferred) return;

  try {
    // Lógica de pesquisa – exemplo
    const embed = new EmbedBuilder()
      .setTitle("🔍 Pesquisa de Ajuda")
      .setDescription("Escreve a tua pergunta no modal que vai abrir.")
      .setColor(0x3498db);

    // Abrir modal (não pode ser usado se já deferiste, por isso este comando também não deve deferir)
    // Para evitar problemas, este botão deve abrir um modal via interaction.showModal,
    // mas se já deferiste, não podes. A solução é não deferir quando vais abrir modal.
    // Vou assumir que este comando é para pesquisa, e faremos reply com um link ou instrução.

    await safeEdit(interaction, {
      content: "🔍 Para pesquisar, usa o comando `/ajuda` e escreve a tua pergunta no modal.",
      flags: 64,
    });
  } catch (error) {
    console.error("[handleAjudaProcurar] Erro:", error);
    await safeEdit(interaction, { content: "❌ Erro ao pesquisar.", flags: 64 });
  }
}

export async function handleAjudaModal(interaction, client) {
  // O modal já é uma resposta à interação, portanto não precisamos de deferir
  // Mas podemos usar safeDefer para garantir que temos tempo
  const deferred = await safeDefer(interaction);
  if (!deferred) {
    // Se não conseguiu deferir, tenta responder diretamente (fallback)
    if (interaction.isRepliable()) {
      await safeReply(interaction, "❌ O bot está ocupado, tenta novamente.", true);
    }
    return;
  }

  try {
    const pergunta = interaction.fields.getTextInputValue("pergunta_ajuda");
    const detalhes = interaction.fields.getTextInputValue("detalhes_ajuda") || "";

    // Criar thread de log
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

    // Usar safeEdit porque a interação já está deferida
    await safeEdit(interaction, { embeds: [embed], components: [row], flags: 64 });

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
    await safeEdit(interaction, { content: "❌ Ocorreu um erro ao processar a tua pergunta.", flags: 64 });
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
      await safeReply(
        interaction,
        `🎫 Para abrir um ticket, vai ao canal <#${CONFIG.CANAL_TICKETS_GERAL}>.`,
        true
      );
      return;
    }

    if (customId === "ajuda_faq") {
      await safeReply(interaction, "📖 **FAQ Rápido:** ...", true);
      return;
    }

    if (customId === "ajuda_nova") {
      await safeReply(interaction, "🔍 Clica em **Procurar Ajuda** para fazer uma nova pergunta.", true);
      return;
    }

    if (customId === "ajuda_procurar") {
      return handleAjudaProcurar(interaction);
    }

    if (customId.startsWith("smart_helpful_") || customId.startsWith("smart_not_helpful_")) {
      const isHelpful = customId.startsWith("smart_helpful_");
      const userId = customId.split("_")[2];
      if (interaction.user.id !== userId) {
        await safeReply(interaction, "⚠️ Este feedback não é para ti!", true);
        return;
      }

      const feedback = isHelpful ? "✅ Positivo" : "❌ Negativo";
      await safeReply(interaction, `📝 Obrigado pelo feedback! (${feedback})`, true);

      // Atualizar log com feedback
      const threadId = assistantMemory.get(`thread_${interaction.user.id}`);
      if (threadId) {
        await logger.updateThreadWithFeedback(interaction.client, threadId, feedback);
        await logger.logToThread(interaction.client, threadId, `📊 **Feedback:** ${feedback}`);
      }

      // Log no canal de logs interno
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

    await safeReply(interaction, "❌ Ação desconhecida.", true);
  } catch (error) {
    if (error.code !== 10062) console.error("[AjudaFeedback] Erro:", error);
  }
}
