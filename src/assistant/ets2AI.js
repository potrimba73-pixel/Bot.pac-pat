import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config/index.js";

const AJUDA_KEYWORDS = [
  "ajuda", "help", "como", "configurar", "wheel", "volante", "ets2", "ats", 
  "mod", "dlc", "crash", "erro", "fps", "lag", "dinheiro", "economia", 
  "save", "perfil", "multiplayer", "tmp", "trucksbook", "vtc", "companhia", 
  "patente", "regra", "ban", "punido", "discord", "bot", "comando", 
  "ticket", "recrutamento", "ets2la", "vr", "grafico", "problema", 
  "nao consigo", "tutorial", "video", "link", "download", "trucky",
  "servidor", "entrar", "comboio", "juntar", "pat"
];

const FAQ_SIMPLE = {
  "volante": "Para configurar o volante no ETS2/ATS: Vai a Options > Controls > Wizard e segue os passos. Usa o software do teu volante (Logitech G HUB, Thrustmaster, etc) para calibrar antes.",
  "configurar volante": "Para configurar o volante no ETS2/ATS: Vai a Options > Controls > Wizard e segue os passos. Usa o software do teu volante (Logitech G HUB, Thrustmaster, etc) para calibrar antes.",
  "crash": "Se o jogo crasha: 1) Verifica ficheiros na Steam (botao direito no jogo > Propriedades > Ficheiros instalados > Verificar integridade). 2) Remove mods recentes. 3) Atualiza drivers da GPU.",
  "dlc": "Os DLCs do ETS2/ATS sao expansoes pagas. Os mais populares sao: Going East, Scandinavia, Vive la France, Italia, Beyond the Baltic Sea, Road to the Black Sea, Iberia, West Balkans.",
  "multiplayer": "O multiplayer oficial e o TruckersMP (TMP). Precisas de conta Steam com o jogo comprado. Vai a truckersmp.com e segue os passos de registo.",
  "tmp": "O multiplayer oficial e o TruckersMP (TMP). Precisas de conta Steam com o jogo comprado. Vai a truckersmp.com e segue os passos de registo.",
  "patente": "As patentes na Portugal Alfa sao baseadas nas horas de jogo. Consulta o canal de patentes ou fala com um membro da staff para saber os requisitos exatos.",
  "recrutamento": "Para te candidatares a membro da Portugal Alfa: 1) Tens de ter o jogo ETS2/ATS. 2) Usa o comando /recrutamento ou abre um ticket. 3) Preenche o formulario com os teus dados.",
  "ticket": "Para abrir um ticket: usa o comando /ticket ou clica no botao correspondente no canal de tickets. Escolhe a categoria e descreve o teu problema.",
  "ets2la": "ETS2LA (Lane Assist) e um mod de assistencia de conducao. Vai ao Discord oficial do ETS2LA para downloads e tutoriais.",
  "vr": "Para jogar ETS2/ATS em VR: 1) Tens de ter um headset VR compativel (Meta Quest, Valve Index, etc). 2) Ativa VR nas opcoes do jogo. 3) Usa OpenXR ou SteamVR.",
  "grafico": "Para melhorar os graficos: 1) Atualiza drivers da GPU. 2) Aumenta as definicoes no jogo. 3) Usa mods de graficos (Realistic Graphics, etc). 4) Ativa DLSS/FSR se a tua GPU suportar.",
};

function isAjudaChannel(channelId) {
  return CONFIG.AJUDA_CHANNELS?.includes(channelId);
}

function matchesAjudaKeywords(content) {
  const lower = content.toLowerCase();
  return AJUDA_KEYWORDS.some(kw => lower.includes(kw));
}

async function callPollinationsAI(question) {
  try {
    const prompt = `Responde em portugues de Portugal de forma curta e direta (max 500 caracteres) a esta pergunta sobre Euro Truck Simulator 2, American Truck Simulator, ou a comunidade Portugal Alfa Truckers: "${question}"`;
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

async function callGeminiAI(question) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const body = {
      contents: [{
        parts: [{
          text: `Responde em portugues de Portugal de forma curta e direta (max 500 caracteres) a esta pergunta sobre ETS2/ATS: "${question}"`
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

function createIAEmbed(question, answer, source) {
  return new EmbedBuilder()
    .setTitle("🤖 Assistente Portugal Alfa")
    .setDescription(answer)
    .setColor(0x3498db)
    .setFooter({ text: `Fonte: ${source} | Clica nos botoes para dar feedback` })
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
      .setLabel("👎 Nao ajudou")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ia_ticket_${messageId}`)
      .setLabel("🎫 Abrir ticket")
      .setStyle(ButtonStyle.Primary)
  );
}

export async function processarPerguntaETS2(message, client) {
  if (message.author.bot) return;
  if (!isAjudaChannel(message.channel.id)) return;
  if (!matchesAjudaKeywords(message.content)) return;
  if (message.content.startsWith("/") || message.content.startsWith("!")) return;

  const question = message.content;
  let answer = null;
  let source = "FAQ Local";

  // 1. Tentar FAQ local
  const lowerQ = question.toLowerCase();
  for (const [key, value] of Object.entries(FAQ_SIMPLE)) {
    if (lowerQ.includes(key)) {
      answer = value;
      break;
    }
  }

  // 2. Se nao encontrou no FAQ, chamar IA
  if (!answer) {
    answer = await callPollinationsAI(question);
    source = "Pollinations AI";
  }

  // 3. Se Pollinations falhar, tentar Gemini
  if (!answer) {
    answer = await callGeminiAI(question);
    source = "Gemini AI";
  }

  // 4. Se tudo falhar, resposta generica
  if (!answer) {
    answer = "Nao consegui encontrar uma resposta especifica. Tenta reformular a pergunta ou abre um ticket para ajuda personalizada.";
    source = "Padrao";
  }

  const embed = createIAEmbed(question, answer, source);
  const buttons = createIAButtons(message.id);

  try {
    const reply = await message.reply({
      embeds: [embed],
      components: [buttons],
      allowedMentions: { repliedUser: false }
    });

    // Log em topico (se CONFIG.IA_LOG_FORUM_ID estiver definido)
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

export async function handleIAFeedback(interaction, client) {
  const customId = interaction.customId;
  const parts = customId.split("_");
  const action = parts[1];
  const messageId = parts[2];

  if (action === "ticket") {
    await interaction.reply({
      content: "Para abrir um ticket, usa o comando /ticket ou clica no botao no canal de tickets.",
      ephemeral: true
    });
    return;
  }

  const feedback = action === "ajudou" ? "👍 Positivo" : "👎 Negativo";

  await interaction.reply({
    content: `Obrigado pelo feedback! (${feedback})`,
    ephemeral: true
  });

  // Atualizar log com feedback
  if (CONFIG.IA_LOG_FORUM_ID && client) {
    try {
      const { updateIALogFeedback } = await import("../services/iaLogs.js");
      await updateIALogFeedback(client, messageId, feedback);
    } catch (e) {
      console.error("[IA Feedback] Erro:", e.message);
    }
  }
}
