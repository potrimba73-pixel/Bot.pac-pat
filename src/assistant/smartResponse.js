// src/assistant/smartResponse.js
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { ASSISTANT_CONFIG } from "../config/index.js";
import { encontrarRespostaFAQ } from "../database/faq.js";
import { encontrarTutorialPAC } from "../database/tutoriais.js";
import { encontrarRespostaManual } from "../database/faq_manual.js"; // NOVO
import { assistantMemory } from "../services/ajuda.js";
import { MessageAnalyzer } from "./analyzer.js";
import { callPollinationsAI, callGeminiAI } from "./ets2AI.js";
import { getCachedAnswer, setCachedAnswer } from "../services/iaCache.js"; // NOVO
import { getConversationHistory, addToConversation } from "../services/conversationMemory.js"; // NOVO

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
  if (assistantMemory.isOnCooldown?.(message.author.id) ?? false) return;

  const contentLower = message.content.toLowerCase();

  // Filtro inteligente
  const questionWords = ["como", "onde", "quando", "porque", "pq", "?", "ajuda", "help", "duvida", "sabe", "sabes", "consegues", "podes", "posso", "qual", "quais"];
  const isQuestion = questionWords.some(qw => contentLower.includes(qw));

  const gameKeywords = ["ets2", "ats", "truck", "trucky", "truckersmp", "mod", "skin", "comboio", "convoy", "servidor", "recrutamento", "pat", "vtc", "km", "viagem", "carga", "ets", "american truck", "euro truck"];
  const isGameRelated = gameKeywords.some(kw => contentLower.includes(kw));

  const techKeywords = ["configurar", "instalar", "problema", "erro", "crash", "lag", "fps", "grafico", "vr", "volante", "g29", "g920", "shifter", "camera", "camara", "câmara", "mod", "dlc", "save", "perfil", "steam", "workshop", "console", "developer", "numpad", "teletransportar", "ctrl f9", "project alm", "insanux"];
  const isTechRelated = techKeywords.some(kw => contentLower.includes(kw));

  const mentionsDiego = message.mentions.users.has(ASSISTANT_CONFIG.EXPERT_USER_ID);

  const shouldRespond = (isQuestion && (isGameRelated || isTechRelated)) || mentionsDiego;
  if (!shouldRespond) return;

  if (assistantMemory.setCooldown) {
    assistantMemory.setCooldown(message.author.id);
  }

  const question = message.content.replace(/<@!?\d+>/g, "").trim();

  // ----------------------------------------------------------
  // 1. TENTAR TUTORIAIS
  // ----------------------------------------------------------
  const tutorial = encontrarTutorialPAC(question);
  if (tutorial) {
    const embed = new EmbedBuilder()
      .setTitle(tutorial.titulo)
      .setDescription(tutorial.resumo)
      .setColor(0x00aaff)
      .setFooter({ text: `Autor: ${tutorial.autor} | Canal: ${tutorial.canal}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`smart_helpful_${message.author.id}_${message.id}`)
        .setLabel("✅ Resolveu!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`smart_not_helpful_${message.author.id}_${message.id}`)
        .setLabel("❌ Não é isto")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`smart_search_${message.author.id}_${message.id}`)
        .setLabel("🔍 Pesquisar na net")
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const sent = await message.reply({
        embeds: [embed],
        components: [row],
        allowedMentions: { repliedUser: false }
      });
      if (!assistantMemory.pendingSearches) assistantMemory.pendingSearches = new Map();
      assistantMemory.pendingSearches.set(message.id, {
        question: question,
        answer: tutorial.resumo,
        messageId: sent.id,
        channelId: message.channel.id
      });
      return;
    } catch (err) {
      console.error("[SmartResponse] Erro ao enviar tutorial:", err.message);
    }
  }

  // ----------------------------------------------------------
  // 2. TENTAR FAQ MANUAL (NOVO)
  // ----------------------------------------------------------
  const manual = encontrarRespostaManual(question);
  if (manual) {
    const embed = new EmbedBuilder()
      .setTitle(manual.titulo)
      .setDescription(manual.resposta)
      .setColor(0x00ff00)
      .setFooter({ text: "Resposta automática (FAQ manual)" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`smart_helpful_${message.author.id}_${message.id}`)
        .setLabel("✅ Resolveu!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`smart_not_helpful_${message.author.id}_${message.id}`)
        .setLabel("❌ Não é isto")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`smart_search_${message.author.id}_${message.id}`)
        .setLabel("🔍 Pesquisar na net")
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const sent = await message.reply({
        embeds: [embed],
        components: [row],
        allowedMentions: { repliedUser: false }
      });
      if (!assistantMemory.pendingSearches) assistantMemory.pendingSearches = new Map();
      assistantMemory.pendingSearches.set(message.id, {
        question: question,
        answer: manual.resposta,
        messageId: sent.id,
        channelId: message.channel.id
      });
      return;
    } catch (err) {
      console.error("[SmartResponse] Erro ao enviar FAQ manual:", err.message);
    }
  }

  // ----------------------------------------------------------
  // 3. TENTAR FAQ (base de dados antiga)
  // ----------------------------------------------------------
  const faqResposta = encontrarRespostaFAQ(question);
  if (faqResposta.found) {
    const embed = new EmbedBuilder()
      .setTitle(faqResposta.titulo)
      .setDescription(faqResposta.texto)
      .setColor(0x00ff00)
      .setFooter({ text: "Resposta automática — Info pode não estar 100% atualizada" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`smart_helpful_${message.author.id}_${message.id}`)
        .setLabel("✅ Resolveu!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`smart_not_helpful_${message.author.id}_${message.id}`)
        .setLabel("❌ Não é isto")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`smart_search_${message.author.id}_${message.id}`)
        .setLabel("🔍 Pesquisar na net")
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const sent = await message.reply({
        embeds: [embed],
        components: [row],
        allowedMentions: { repliedUser: false }
      });
      if (!assistantMemory.pendingSearches) assistantMemory.pendingSearches = new Map();
      assistantMemory.pendingSearches.set(message.id, {
        question: question,
        answer: faqResposta.texto,
        messageId: sent.id,
        channelId: message.channel.id
      });
      return;
    } catch (err) {
      console.error("[SmartResponse] Erro ao enviar FAQ:", err.message);
    }
  }

  // ----------------------------------------------------------
  // 4. TENTAR HISTÓRICO DO ESPECIALISTA
  // ----------------------------------------------------------
  try {
    const analyzer = new MessageAnalyzer(client);
    const similar = analyzer.findSimilarResponses(question);

    if (similar.length > 0) {
      const best = similar[0];
      let texto = `**Baseado no que o <@${ASSISTANT_CONFIG.EXPERT_USER_ID}> já respondeu:**\n\n`;
      texto += `> ${best.content}\n\n`;

      if (best.hasLinks && best.hasLinks.length > 0) {
        texto += "**🔗 Links mencionados:**\n";
        best.hasLinks.forEach(link => {
          texto += `• ${link}\n`;
        });
        texto += "\n";
      }

      texto += "*Esta resposta foi baseada no histórico de mensagens. Pode não estar 100% atualizada.*";

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`smart_helpful_${message.author.id}_${message.id}`)
          .setLabel("✅ Resolveu!")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`smart_not_helpful_${message.author.id}_${message.id}`)
          .setLabel("❌ Não é isto")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`smart_search_${message.author.id}_${message.id}`)
          .setLabel("🔍 Pesquisar na net")
          .setStyle(ButtonStyle.Primary)
      );

      const sent = await message.reply({
        content: texto,
        components: [row],
        allowedMentions: { repliedUser: false }
      });
      if (!assistantMemory.pendingSearches) assistantMemory.pendingSearches = new Map();
      assistantMemory.pendingSearches.set(message.id, {
        question: question,
        answer: best.content,
        messageId: sent.id,
        channelId: message.channel.id
      });
      return;
    }
  } catch (err) {
    console.error("[SmartResponse] Erro no analyzer:", err.message);
  }

  // ----------------------------------------------------------
  // 5. CHAMAR IA EXTERNA (com cache e histórico)
  // ----------------------------------------------------------
  let answer = null;
  let source = "Pollinations AI";

  // 5.1 Verificar cache
  const cached = getCachedAnswer(question);
  if (cached) {
    answer = cached;
    source = "💾 Cache";
  }

  // 5.2 Se não houver cache, chamar IAs
  if (!answer) {
    answer = await callPollinationsAI(question);
    source = "Pollinations AI";
  }
  if (!answer) {
    answer = await callGeminiAI(question);
    source = "Gemini AI";
  }

  // 5.3 Se obteve resposta, guardar cache e histórico
  if (answer) {
    setCachedAnswer(question, answer, source);
    addToConversation(message.channel.id, question, answer);

    const embed = new EmbedBuilder()
      .setTitle("🤖 Assistente Portugal Alfa")
      .setDescription(answer)
      .setColor(0x3498db)
      .setFooter({ text: `Fonte: ${source} | Clica nos botões para dar feedback` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`smart_helpful_${message.author.id}_${message.id}`)
        .setLabel("✅ Resolveu!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`smart_not_helpful_${message.author.id}_${message.id}`)
        .setLabel("❌ Não ajudou")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`smart_search_${message.author.id}_${message.id}`)
        .setLabel("🔍 Pesquisar na net")
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const sent = await message.reply({
        embeds: [embed],
        components: [row],
        allowedMentions: { repliedUser: false }
      });
      if (!assistantMemory.pendingSearches) assistantMemory.pendingSearches = new Map();
      assistantMemory.pendingSearches.set(message.id, {
        question: question,
        answer: answer,
        messageId: sent.id,
        channelId: message.channel.id
      });
      return;
    } catch (err) {
      console.error("[SmartResponse] Erro ao enviar IA:", err.message);
    }
  }

  // ----------------------------------------------------------
  // 6. FALLBACK MELHORADO
  // ----------------------------------------------------------
  const fallbackMsg = `🔍 **Não encontrei uma resposta exata para a tua pergunta.**

**Sugestões:**
• Reformula a pergunta com mais detalhes (ex: "Como instalo mods?").
• Usa o comando \`/ajuda\` para aceder à central de ajuda.
• Se precisares de assistência personalizada, abre um ticket com \`/ticket\`.

**Pergunta original:** "${question}"`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`smart_do_search_${message.author.id}_${message.id}`)
      .setLabel("🔍 Pesquisar na internet")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("smart_cancel")
      .setLabel("❌ Cancelar")
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    const sent = await message.reply({
      content: fallbackMsg,
      components: [row],
      allowedMentions: { repliedUser: false }
    });
    if (!assistantMemory.pendingSearches) assistantMemory.pendingSearches = new Map();
    assistantMemory.pendingSearches.set(message.id, {
      question: question,
      answer: "Sem resposta",
      messageId: sent.id,
      channelId: message.channel.id
    });
  } catch (err) {
    console.error("[SmartResponse] Erro ao enviar fallback:", err.message);
  }
}
