// src/services/ajuda.js
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

// ============================================================
// MEMÓRIA DA IA (em memória)
// ============================================================
export const assistantMemory = {
  diegoHistory: [],
  cooldowns: new Map(),
  pendingSearches: new Map(),
  isOnCooldown(userId) {
    const last = this.cooldowns.get(userId);
    if (!last) return false;
    return (Date.now() - last) < (ASSISTANT_CONFIG?.COOLDOWN || 10) * 1000;
  },
  setCooldown(userId) {
    this.cooldowns.set(userId, Date.now());
  }
};

// ============================================================
// FUNÇÃO PRINCIPAL - /ajuda
// ============================================================
export async function handleAjudaCommand(interaction, client) {
  const umaHora = 60 * 60 * 1000;
  const agora = Date.now();
  const memoria = assistantMemory.cooldowns.get(interaction.user.id);

  if (memoria && (agora - memoria) < umaHora) {
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_INFO} Central de Ajuda`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Já fizeste uma pergunta recentemente.`,
        "",
        `${CONFIG.EMOJI_TIME} Podes fazer outra pergunta em ${Math.ceil((umaHora - (agora - memoria)) / 60000)} minutos.`,
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
        .setEmoji(CONFIG.EMOJI_TICKET || "🎫")
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
      "• 🛠️ Câmara Zero / Consola - Ativação, teclas, teletransporte",
      "• 🎨 Project ALM - Instalação, RGB",
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
      .setStyle(ButtonStyle.Success)
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
  const modal = new ModalBuilder()
    .setCustomId(`modal_ajuda_${interaction.user.id}_${Date.now()}`)
    .setTitle(`${CONFIG.EMOJI_AJUDA || "❓"} Pergunta de Ajuda`);

  const inputPergunta = new TextInputBuilder()
    .setCustomId("pergunta_ajuda")
    .setLabel("Qual é a tua pergunta?")
    .setPlaceholder("Ex: Como configuro a câmara 0?")
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

  await interaction.showModal(modal);
}

// ============================================================
// HANDLER - MODAL DE AJUDA
// ============================================================
export async function handleAjudaModal(interaction, client) {
  const pergunta = interaction.fields.getTextInputValue("pergunta_ajuda");
  const detalhes = interaction.fields.getTextInputValue("detalhes_ajuda") || "";

  await interaction.deferReply({ flags: 64 });

  try {
    const resposta = await gerarRespostaPersonalizada(pergunta, client);
    assistantMemory.setCooldown(interaction.user.id);

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
        .setCustomId(`smart_helpful_${interaction.user.id}_${interaction.id}`)
        .setLabel("✅ Sim, resolveu!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`smart_not_helpful_${interaction.user.id}_${interaction.id}`)
        .setLabel("❌ Não, preciso de mais ajuda")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ajuda_ticket_direct_${interaction.user.id}`)
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    // Guardar no pendingSearches usando o ID da interação como chave
    if (!assistantMemory.pendingSearches) assistantMemory.pendingSearches = new Map();
    assistantMemory.pendingSearches.set(interaction.id, {
      question: pergunta,
      answer: resposta,
      messageId: interaction.id, // será usado para referência
      channelId: interaction.channelId
    });

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
// GERADOR DE RESPOSTAS (fallback para o modal)
// ============================================================
async function gerarRespostaPersonalizada(pergunta, client) {
  const { encontrarTutorialPAC } = await import("../database/tutoriais.js");
  const tutorial = encontrarTutorialPAC(pergunta);
  if (tutorial) return tutorial.resumo;

  const { encontrarRespostaFAQ } = await import("../database/faq.js");
  const faq = encontrarRespostaFAQ(pergunta);
  if (faq.found) return faq.texto;

  const { callPollinationsAI, callGeminiAI } = await import("../assistant/ets2AI.js");
  let resposta = await callPollinationsAI(pergunta);
  if (!resposta) resposta = await callGeminiAI(pergunta);
  if (resposta) return resposta;

  return "Não consegui encontrar uma resposta específica. Tenta reformular a pergunta ou abre um ticket para ajuda personalizada.";
}

// ============================================================
// HANDLER - FEEDBACK
// ============================================================
export async function handleAjudaFeedback(interaction) {
  const customId = interaction.customId;

  // --- Outros casos ---
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

  // --- Feedback dos botões smart_helpful / smart_not_helpful ---
  if (customId.startsWith("smart_helpful_") || customId.startsWith("smart_not_helpful_")) {
    const parts = customId.split("_");
    // Formato: smart_helpful_USERID_MESSAGEID
    const userId = parts[2];
    const messageId = parts[3]; // ID da mensagem ou da interação

    // Verifica se é o mesmo utilizador
    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: `⚠️ Este feedback não é para ti!`,
        flags: 64
      });
    }

    const isHelpful = customId.startsWith("smart_helpful_");
    const feedback = isHelpful ? "✅ Positivo" : "❌ Negativo";

    // Buscar pergunta e resposta da memória
    let question = "N/A";
    let answer = "N/A";
    if (assistantMemory.pendingSearches?.has(messageId)) {
      const data = assistantMemory.pendingSearches.get(messageId);
      question = data.question || "N/A";
      answer = data.answer || "N/A";
    }

    // Resposta ao utilizador
    await interaction.reply({
      content: `📝 Obrigado pelo feedback! (${feedback})\n\n${isHelpful ? '🎉 Ainda bem que conseguimos ajudar!' : '😔 Vamos melhorar! Se precisares, abre um ticket para ajuda personalizada.'}`,
      flags: 64
    });

    // --- LOG no canal de logs com a hora curta e pergunta/resposta ---
    try {
      const logChannel = await interaction.client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
      if (logChannel) {
        const now = Math.floor(Date.now() / 1000);
        const logEmbed = new EmbedBuilder()
          .setTitle("📊 Feedback da Ajuda")
          .setDescription([
            `👤 Utilizador: <@${interaction.user.id}> | \`${interaction.user.tag}\``,
            `📝 Avaliação: ${feedback}`,
            `💬 Comentário: ${question} → ${answer}`,
            `🕐 Hora: <t:${now}:t>`  // mostra apenas a hora, ex: 18:58
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
