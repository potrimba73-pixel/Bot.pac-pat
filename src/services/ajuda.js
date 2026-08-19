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
  TextInputStyle
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { safeEditReply } from "../utils/safeReply.js";

// ============================================================
// MEMÓRIA DA IA (em memória, não persistente)
// ============================================================
export const assistantMemory = new Map();

// ============================================================
// FUNÇÃO PRINCIPAL - /ajuda
// ============================================================
export async function handleAjudaCommand(interaction, client) {
  const umaHora = 60 * 60 * 1000;
  const agora = Date.now();
  const memoria = assistantMemory.get(interaction.user.id);

  if (memoria && (agora - memoria.timestamp) < umaHora) {
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_INFO} Central de Ajuda`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Já fizeste uma pergunta recentemente.`,
        "",
        `**Pergunta anterior:** ${memoria.pergunta}`,
        `**Resposta:** ${memoria.resposta.substring(0, 500)}${memoria.resposta.length > 500 ? "..." : ""}`,
        "",
        `${CONFIG.EMOJI_TIME} Podes fazer outra pergunta em ${Math.ceil((umaHora - (agora - memoria.timestamp)) / 60000)} minutos.`,
        "",
        `💡 Se precisares de ajuda urgente, abre um ticket.`
      ].join("\n"))
      .setColor(CONFIG.COR_PRINCIPAL || 0x262af1)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ajuda_nova")
        .setLabel("Nova Pergunta")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(CONFIG.EMOJI_AJUDA || "❓"),
      new ButtonBuilder()
        .setCustomId("ajuda_ticket")
        .setLabel("Abrir Ticket")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(CONFIG.EMOJI_TICKET || "🎫"),
    );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row], 
      flags: 64 
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_AJUDA || "❓"} Central de Ajuda | Portugal Alfa Community`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Bem-vindo à central de ajuda!`,
      "",
      "Aqui podes fazer perguntas sobre a comunidade, regras, sistemas e mais.",
      "",
      "**📋 Como funciona:**",
      "1️⃣ Clica em **Procurar Ajuda**",
      "2️⃣ Escreve a tua pergunta",
      "3️⃣ Recebe uma resposta personalizada",
      "",
      "**📚 Tópicos disponíveis:**",
      "• 🎮 ETS2 / ATS - Servidor, mods, configurações",
      "• 🚛 Recrutamento PAT - Requisitos, Trucky, candidatura",
      "• ⚙️ ETS2LA - Configuração, mods, atualizações",
      "• 🥽 VR - Meta Quest, tutoriais",
      "• 📲 Trucky App - Download, instalação",
      "",
      `${CONFIG.EMOJI_TIME} **Nota:** Apenas 1 pergunta por hora.`
    ].join("\n"))
    .setColor(CONFIG.COR_PRINCIPAL || 0x262af1)
    .setTimestamp()
    .setFooter({ 
      text: "Portugal Alfa Community", 
      iconURL: client?.user?.displayAvatarURL() 
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ajuda_procurar")
      .setLabel("🔍 Procurar Ajuda")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ajuda_ticket")
      .setLabel("🎫 Abrir Ticket")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ajuda_faq")
      .setLabel("📖 FAQ Rápido")
      .setStyle(ButtonStyle.Success),
  );

  await interaction.editReply({ 
    embeds: [embed], 
    components: [row], 
    flags: 64 
  });
}

// ============================================================
// HANDLER - BOTÃO "Procurar Ajuda"
// ============================================================
export async function handleAjudaProcurar(interaction) {
  // ✅ Verificar se a interação ainda é válida
  if (!interaction.isRepliable()) {
    console.log("[Ajuda] Interação não é repliable, ignorando.");
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_ajuda_${interaction.user.id}`) // ✅ sem timestamp para consistência
    .setTitle(`${CONFIG.EMOJI_AJUDA || "❓"} Pergunta de Ajuda`);

  const inputPergunta = new TextInputBuilder()
    .setCustomId("pergunta_ajuda") // ✅ nome consistente
    .setLabel("Qual é a tua pergunta?")
    .setPlaceholder("Ex: Como configuro a câmara 0? Como ando no jogo?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(500);

  const inputDetalhes = new TextInputBuilder()
    .setCustomId("detalhes_ajuda")
    .setLabel("Detalhes adicionais (opcional)")
    .setPlaceholder("Ex: Já tentei X e Y, mas não funcionou...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(inputPergunta),
    new ActionRowBuilder().addComponents(inputDetalhes)
  );

  try {
    await interaction.showModal(modal);
  } catch (error) {
    console.error("[Ajuda] Erro ao mostrar modal:", error);
    // Fallback: responder com erro
    try {
      await interaction.reply({ 
        content: "❌ Não foi possível abrir o formulário. Tenta novamente.", 
        flags: 64 
      });
    } catch (e) {}
  }
}

// ============================================================
// HANDLER - MODAL DE AJUDA (com histórico do Diego + IA)
// ============================================================
export async function handleAjudaModal(interaction, client) {
  // ✅ Verificar se a interação ainda é válida
  if (!interaction.isRepliable()) {
    console.log("[AjudaModal] Interação não é repliable, ignorando.");
    return;
  }

  // ✅ Deferir a resposta para ganhar tempo
  await interaction.deferReply({ flags: 64 });

  try {
    const pergunta = interaction.fields.getTextInputValue("pergunta_ajuda");
    const detalhes = interaction.fields.getTextInputValue("detalhes_ajuda") || "";

    // ✅ Gerar resposta com prioridade: Histórico do Diego > FAQ > IA externa
    const resposta = await gerarRespostaInteligente(pergunta, interaction, client);

    // ✅ Guardar na memória
    assistantMemory.set(interaction.user.id, {
      pergunta: pergunta,
      resposta: resposta,
      timestamp: Date.now(),
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_AJUDA || "❓"} Resposta de Ajuda`)
      .setDescription([
        `**📝 Pergunta:**`,
        `> ${pergunta}`,
        "",
        `**💡 Resposta:**`,
        resposta,
        "",
        `${CONFIG.EMOJI_INFO} Esta resposta foi útil?`
      ].join("\n"))
      .setColor(CONFIG.COR_SUCESSO || 0x00ff00)
      .setTimestamp()
      .setFooter({ 
        text: "Portugal Alfa Community • Feedback ajuda a melhorar!", 
        iconURL: client?.user?.displayAvatarURL() 
      });

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
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row], 
      flags: 64 
    });

  } catch (error) {
    console.error("[AjudaModal] Erro:", error);
    await interaction.editReply({ 
      content: `${CONFIG.EMOJI_ERROR || "💥"} Ocorreu um erro ao processar a tua pergunta. Tenta novamente mais tarde ou abre um ticket.`, 
      flags: 64 
    });
  }
}

// ============================================================
// GERADOR DE RESPOSTA INTELIGENTE (Histórico > FAQ > IA)
// ============================================================
async function gerarRespostaInteligente(pergunta, interaction, client) {
  // ===== 1. TENTAR HISTÓRICO DO DIEGO =====
  try {
    const { MessageAnalyzer } = await import("../assistant/analyzer.js");
    const analyzer = client.messageAnalyzer || new MessageAnalyzer(client);
    const guild = interaction.guild;
    const userId = "849132183112384573"; // Diego

    // Se o histórico não estiver em cache, forçar fetch
    if (!assistantMemory.diegoHistory || assistantMemory.diegoHistory.length === 0) {
      console.log("[Ajuda] A carregar histórico do Diego...");
      await analyzer.fetchExpertHistory(guild, userId, 50);
    }

    const similar = analyzer.findSimilarResponses(pergunta);
    if (similar.length > 0) {
      const best = similar[0];
      let texto = `**Baseado no que o <@${userId}> já respondeu:**\n\n`;
      texto += `> ${best.content}\n\n`;
      if (best.hasLinks.length > 0) {
        texto += `**Links mencionados:**\n`;
        best.hasLinks.forEach(link => {
          texto += `• ${link}\n`;
        });
        texto += "\n";
      }
      texto += "*Esta resposta foi baseada no histórico de mensagens. Pode não estar 100% atualizada.*";
      return texto;
    }
  } catch (err) {
    console.error("[Ajuda] Erro ao buscar histórico:", err.message);
  }

  // ===== 2. TENTAR FAQ LOCAL =====
  try {
    const { encontrarRespostaFAQ } = await import("../database/faq.js");
    const faq = encontrarRespostaFAQ(pergunta);
    if (faq.found) {
      return faq.texto;
    }
  } catch (err) {
    console.error("[Ajuda] Erro no FAQ:", err.message);
  }

  // ===== 3. TENTAR IA EXTERNA (se configurada) =====
  try {
    const { callPollinationsAI, callGeminiAI } = await import("../assistant/ets2AI.js");
    let answer = await callPollinationsAI(pergunta) || await callGeminiAI(pergunta);
    if (answer) {
      return answer;
    }
  } catch (err) {
    console.error("[Ajuda] Erro na IA:", err.message);
  }

  // ===== 4. FALLBACK GENÉRICO =====
  return [
    `${CONFIG.EMOJI_INFO || "ℹ️"} **Não encontrei uma resposta específica para:** "${pergunta}"`,
    "",
    "**💡 Sugestões:**",
    "• Tenta reformular a pergunta",
    "• Usa palavras-chave como: 'câmara', 'regras', 'ticket', 'recrutamento'",
    "• Sê mais específico no que precisas",
    "",
    `${CONFIG.EMOJI_TICKET || "🎫"} **Alternativa:** Abre um ticket para ajuda personalizada.`
  ].join("\n");
}

// ============================================================
// HANDLER - FEEDBACK DA AJUDA
// ============================================================
export async function handleAjudaFeedback(interaction) {
  // ✅ Verificar se a interação ainda é válida
  if (!interaction.isRepliable()) {
    console.log("[AjudaFeedback] Interação não é repliable, ignorando.");
    return;
  }

  const customId = interaction.customId;
  
  if (customId === "ajuda_ticket" || customId.startsWith("ajuda_ticket_direct_")) {
    await interaction.reply({
      content: `🎫 Para abrir um ticket, vai ao canal <#${CONFIG.CANAL_TICKETS_GERAL}> e seleciona a opção adequada.`,
      flags: 64
    });
    return;
  }

  if (customId === "ajuda_faq") {
    await interaction.reply({
      content: `📖 **FAQ Rápido:**\n\n` +
               `• **Como entro no servidor?** Usa o ID: \`85568392935839115\`\n` +
               `• **Como me candidato?** Vai ao canal de recrutamento\n` +
               `• **Preciso de Trucky?** Sim, é obrigatório\n` +
               `• **Tenho problemas técnicos?** Abre um ticket\n` +
               `• **Regras?** Vê o canal #regras\n\n` +
               `❓ Para mais perguntas, usa **Procurar Ajuda**!`,
      flags: 64
    });
    return;
  }

  if (customId === "ajuda_nova") {
    await interaction.reply({
      content: `🔍 Clica em **Procurar Ajuda** para fazer uma nova pergunta.`,
      flags: 64
    });
    return;
  }

  if (customId === "ajuda_procurar") {
    return handleAjudaProcurar(interaction);
  }

  // ✅ Feedback dos botões smart_helpful / smart_not_helpful
  if (customId.startsWith("smart_helpful_") || customId.startsWith("smart_not_helpful_")) {
    const isHelpful = customId.startsWith("smart_helpful_");
    const userId = customId.split("_")[2];
    
    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: `⚠️ Este feedback não é para ti!`,
        flags: 64
      });
    }

    const feedback = isHelpful ? "✅ Positivo" : "❌ Negativo";
    
    await interaction.reply({
      content: `📝 Obrigado pelo feedback! (${feedback})\n\n${isHelpful ? '🎉 Ainda bem que conseguimos ajudar!' : '😔 Vamos melhorar! Se precisares, abre um ticket para ajuda personalizada.'}`,
      flags: 64
    });

    // Log do feedback
    try {
      const logChannel = await interaction.client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle("📊 Feedback da Ajuda")
          .setDescription([
            `👤 Utilizador: ${interaction.user.tag}`,
            `📝 Feedback: ${feedback}`,
            `🕐 Data: ${new Date().toLocaleString("pt-PT")}`
          ].join("\n"))
          .setColor(isHelpful ? 0x00ff00 : 0xff0000)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch (e) {
      // Silencioso
    }
    
    return;
  }

  // Fallback
  await interaction.reply({
    content: `❌ Ação desconhecida.`,
    flags: 64
  });
}
