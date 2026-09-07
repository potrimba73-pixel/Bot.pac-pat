// src/assistant/ets2AI.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config/index.js";
import { encontrarRespostaManual } from "../database/faq_manual.js";
import { getCachedAnswer, setCachedAnswer } from "../services/iaCache.js";
import { getConversationHistory, addToConversation } from "../services/conversationMemory.js";

// ======================== CONFIGURAÇÕES ========================
const AJUDA_KEYWORDS = [
  "ajuda", "help", "como", "configurar", "wheel", "volante", "ets2", "ats", 
  "mod", "dlc", "crash", "erro", "fps", "lag", "dinheiro", "economia", 
  "save", "perfil", "multiplayer", "tmp", "trucksbook", "vtc", "companhia", 
  "patente", "regra", "ban", "punido", "discord", "bot", "comando", 
  "ticket", "recrutamento", "ets2la", "vr", "grafico", "problema", 
  "nao consigo", "tutorial", "video", "link", "download", "trucky",
  "servidor", "entrar", "comboio", "juntar", "pat", "mods", "mapa", "carro"
];

// ======================== FUNÇÕES AUXILIARES ========================
function isAjudaChannel(channelId) {
  return CONFIG.AJUDA_CHANNELS?.includes(channelId);
}

function matchesAjudaKeywords(content) {
  const lower = content.toLowerCase();
  return AJUDA_KEYWORDS.some(kw => lower.includes(kw));
}

// ======================== PROMPT ENRIQUECIDO ========================
function buildPrompt(question, history = []) {
  let context = "";
  if (history && history.length > 0) {
    context = "**Histórico da conversa (últimas interações):**\n";
    history.forEach((h, i) => {
      context += `Utilizador: ${h.user}\nAssistente: ${h.bot}\n`;
    });
    context += "\n";
  }

  return `
${context}
Você é o assistente oficial da **Portugal Alfa Truckers (PAC)**, uma comunidade portuguesa de ETS2/ATS com cerca de 600 membros.

**Informações essenciais sobre a PAC:**
- Servidor de comboio: ID \`85568392935839115\` ou nome "Portugal Alfa Community".
- Regras: velocidade máxima 100 km/h, respeito, disciplina nos comboios.
- Recrutamento: Trucky obrigatório, 15.000 km/mês, candidatura via ticket.
- Mods recomendados: Project ALM (Insanux), ETS2LA (Lane Assist), coleção Steam oficial (https://steamcommunity.com/sharedfiles/filedetails/?id=3665511189).
- Apoio: tickets no Discord para questões personalizadas.

**Instruções para a resposta:**
- Responde em **português de Portugal**, de forma clara, direta e útil.
- Dá passos práticos sempre que possível.
- Se não souberes, sugere abrir um ticket.
- Limita-te a 600 caracteres.

**Pergunta do utilizador:**
${question}

**Resposta:**
`;
}

// ======================== CHAMADAS À IA ========================
export async function callPollinationsAI(question, history = []) {
  try {
    const prompt = buildPrompt(question, history);
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?seed=${Date.now()}&json=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return text?.trim()?.substring(0, 1000) || null;
  } catch (e) {
    console.error("[Pollinations] Erro:", e.message);
    return null;
  }
}

export async function callGeminiAI(question, history = []) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  try {
    const prompt = buildPrompt(question, history);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const body = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.substring(0, 1000) || null;
  } catch (e) {
    console.error("[Gemini] Erro:", e.message);
    return null;
  }
}

// ======================== ELEMENTOS VISUAIS ========================
function createIAEmbed(question, answer, source) {
  return new EmbedBuilder()
    .setTitle("🤖 Assistente Portugal Alfa")
    .setDescription(answer)
    .setColor(0x3498db)
    .setFooter({ text: `Fonte: ${source} | Clica nos botões para dar feedback` })
    .setTimestamp();
}

function createIAButtons(messageId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ia_ajudou_${messageId}`)
      .setLabel("👍 Ajudou")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ia_nao_ajudou_${messageId}`)
      .setLabel("👎 Não ajudou")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ia_ticket_${messageId}`)
      .setLabel("🎫 Abrir ticket")
      .setStyle(ButtonStyle.Primary)
  );
}

// ======================== PROCESSAMENTO PRINCIPAL ========================
export async function processarPerguntaETS2(message, client) {
  if (message.author.bot) return;
  if (!isAjudaChannel(message.channel.id)) return;
  if (!matchesAjudaKeywords(message.content)) return;
  if (message.content.startsWith("/") || message.content.startsWith("!")) return;

  const question = message.content;
  let answer = null;
  let source = "FAQ Manual";

  // 1. TENTAR FAQ MANUAL (resposta instantânea)
  const manual = encontrarRespostaManual(question);
  if (manual) {
    answer = manual.resposta;
    source = "📖 FAQ Manual";
  }

  // 2. TENTAR CACHE
  if (!answer) {
    const cached = getCachedAnswer(question);
    if (cached) {
      answer = cached;
      source = "💾 Cache local";
    }
  }

  // 3. TENTAR IA (com histórico)
  if (!answer) {
    const history = getConversationHistory(message.channel.id);
    answer = await callPollinationsAI(question, history);
    source = "Pollinations AI";
    if (!answer) {
      answer = await callGeminiAI(question, history);
      source = "Gemini AI";
    }
    // Guardar na cache (se veio da IA)
    if (answer) {
      setCachedAnswer(question, answer, source);
    }
  }

  // 4. FALLBACK
  if (!answer) {
    answer = `🔍 Não encontrei uma resposta exata.

**Sugestões:**
• Reformula a pergunta com mais detalhes.
• Consulta a central de ajuda com \`/ajuda\`.
• Abre um ticket para atendimento personalizado.

**Pergunta:** "${question}"`;
    source = "Fallback";
  }

  // Guardar histórico (última interação)
  if (answer) {
    addToConversation(message.channel.id, question, answer);
  }

  // Enviar resposta
  const embed = createIAEmbed(question, answer, source);
  const buttons = createIAButtons(message.id);

  try {
    const reply = await message.reply({
      embeds: [embed],
      components: [buttons],
      allowedMentions: { repliedUser: false }
    });

    if (CONFIG.IA_LOG_FORUM_ID && client) {
      try {
        const { logIALog } = await import("../services/iaLogs.js");
        await logIALog(client, message.author, question, answer, source, reply.id);
      } catch (e) {
        console.error("[IA Log] Erro:", e.message);
      }
    }
  } catch (e) {
    console.error("[IA Reply] Erro:", e.message);
  }
}

// ======================== FEEDBACK ========================
export async function handleIAFeedback(interaction, client) {
  const customId = interaction.customId;
  const parts = customId.split("_");
  const action = parts[1];
  const messageId = parts[2];

  if (action === "ticket") {
    await interaction.reply({
      content: "Para abrir um ticket, usa o comando /ticket ou clica no botão no canal de tickets.",
      ephemeral: true
    });
    return;
  }

  const feedback = action === "ajudou" ? "👍 Sim" : "👎 Não";

  await interaction.reply({
    content: `Obrigado pelo feedback! (${feedback})`,
    ephemeral: true
  });

  if (CONFIG.IA_LOG_FORUM_ID && client) {
    try {
      const { updateIALogFeedback } = await import("../services/iaLogs.js");
      await updateIALogFeedback(client, messageId, feedback);
    } catch (e) {
      console.error("[IA Feedback] Erro:", e.message);
    }
  }
}
