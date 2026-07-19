import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from "discord.js";
import { getFAQ } from "../database/faq.js";
import { getTutorial } from "../database/tutoriais.js";
import { CONFIG } from "../config/index.js";
import { createIALogTopic } from "../services/iaLogs.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;

// ===== POLLINATIONS AI (principal) =====
async function pollinationsAI(pergunta, contexto) {
  try {
    const prompt = `Tu es um assistente especializado em Euro Truck Simulator 2, American Truck Simulator e comboios (ETS2/ATS).

Regras:
- Responde em portugues (PT-PT)
- Respostas curtas e diretas (max 3 paragrafos)
- Nao uses markdown pesado
- Se nao souberes, diz "Nao tenho essa informacao. Abre um ticket para ajuda personalizada."
- Usa estas fontes do Diego quando relevantes:
${contexto}

Pergunta: ${pergunta}

Resposta:`;

    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?seed=${Date.now()}&json=false`;
    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) throw new Error(`Pollinations erro: ${res.status}`);
    const texto = await res.text();
    return texto.trim();
  } catch (e) {
    console.error("[Pollinations] Erro:", e.message);
    return null;
  }
}

// ===== GEMINI AI (fallback) =====
async function geminiAI(pergunta, contexto) {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `Tu es um assistente especializado em ETS2/ATS e comboios. Responde em portugues, direto, curto (max 3 paragrafos).

Fontes do Diego:
${contexto}

Pergunta: ${pergunta}`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
        }),
        timeout: 15000
      }
    );
    if (!res.ok) throw new Error(`Gemini erro: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    console.error("[Gemini] Erro:", e.message);
    return null;
  }
}

// ===== IA COMPLETA =====
export async function processarPerguntaETS2(message, client) {
  if (message.author.bot) return;
  if (!CONFIG.AJUDA_CHANNELS?.includes(message.channel.id)) return;

  const pergunta = message.content.toLowerCase();
  let contexto = "";

  // 1. Verificar FAQ local
  const faq = getFAQ(pergunta);
  if (faq) {
    contexto += `FAQ: ${faq.resposta}\n`;
  }

  // 2. Verificar Tutorial local
  const tutorial = getTutorial(pergunta);
  if (tutorial) {
    contexto += `Tutorial: ${tutorial.conteudo}\n`;
  }

  // 3. Tentar Pollinations AI
  let resposta = await pollinationsAI(message.content, contexto);

  // 4. Fallback Gemini
  if (!resposta && GEMINI_API_KEY) {
    resposta = await geminiAI(message.content, contexto);
  }

  // 5. Resposta genérica
  if (!resposta) {
    resposta = "Nao tenho essa informacao de momento. Abre um ticket para ajuda personalizada.";
  }

  // Criar embed
  const embed = new EmbedBuilder()
    .setColor(CONFIG.COLORS.PRIMARY)
    .setTitle(`${CONFIG.EMOJI_BOT} Assistente ETS2/ATS`)
    .setDescription(resposta)
    .setFooter({ text: `Pergunta de ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
    .setTimestamp();

  // Botões
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ia_ajudou_${message.author.id}_${Date.now()}`)
      .setLabel("Ajudou")
      .setEmoji("👍")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ia_nao_ajudou_${message.author.id}_${Date.now()}`)
      .setLabel("Nao ajudou")
      .setEmoji("👎")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ia_ticket_${message.author.id}_${Date.now()}`)
      .setLabel("Abrir Ticket")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Primary)
  );

  const msg = await message.reply({ embeds: [embed], components: [row] });

  // Criar log em tópico
  try {
    await createIALogTopic({
      client,
      user: message.author,
      pergunta: message.content,
      resposta,
      messageId: msg.id,
      channelId: message.channel.id
    });
  } catch (e) {
    console.error("[IA Logs] Erro ao criar topico:", e.message);
  }
}

// ===== HANDLER DE FEEDBACK =====
export async function handleIAFeedback(interaction, client) {
  const { customId, user } = interaction;

  if (customId.startsWith("ia_ajudou_")) {
    await interaction.reply({
      content: `${CONFIG.EMOJI_SUCCESS} Obrigado pelo feedback! Fico contente por ter ajudado.`,
      flags: 64
    });
    // Adicionar reacao no topico de log
    try {
      const parts = customId.split("_");
      const userId = parts[2];
      const timestamp = parts[3];
      // Procurar topico correspondente e reagir
      const guild = await client.guilds.fetch(CONFIG.LOG_SERVER_ID);
      const forum = await guild.channels.fetch(CONFIG.IA_LOG_FORUM_ID);
      if (forum?.threads) {
        const threads = await forum.threads.fetchActive();
        const thread = threads.threads.find(t => t.name.includes(userId) && t.name.includes(timestamp));
        if (thread) {
          const msgs = await thread.messages.fetch({ limit: 1 });
          const logMsg = msgs.first();
          if (logMsg) await logMsg.react("✅");
        }
      }
    } catch (e) {
      console.error("[IA Feedback] Erro:", e.message);
    }
    return;
  }

  if (customId.startsWith("ia_nao_ajudou_")) {
    await interaction.reply({
      content: `${CONFIG.EMOJI_ERROR} Lamento nao ter ajudado. Tens algo para acrescentar ou sugerir? Abre um ticket para ajuda personalizada.`,
      flags: 64
    });
    try {
      const parts = customId.split("_");
      const userId = parts[3];
      const timestamp = parts[4];
      const guild = await client.guilds.fetch(CONFIG.LOG_SERVER_ID);
      const forum = await guild.channels.fetch(CONFIG.IA_LOG_FORUM_ID);
      if (forum?.threads) {
        const threads = await forum.threads.fetchActive();
        const thread = threads.threads.find(t => t.name.includes(userId) && t.name.includes(timestamp));
        if (thread) {
          const msgs = await thread.messages.fetch({ limit: 1 });
          const logMsg = msgs.first();
          if (logMsg) await logMsg.react("❌");
        }
      }
    } catch (e) {
      console.error("[IA Feedback] Erro:", e.message);
    }
    return;
  }

  if (customId.startsWith("ia_ticket_")) {
    // Abrir ticket de ajuda
    const { criarTicket } = await import("../services/tickets.js");
    await criarTicket(interaction, client, "ajuda_ia");
    return;
  }
}
