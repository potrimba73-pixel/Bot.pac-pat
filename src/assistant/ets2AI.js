import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getFAQ } from "../database/faq.js";
import { getTutorial } from "../database/tutoriais.js";
import { CONFIG } from "../config/index.js";
import { createIALogTopic } from "../services/iaLogs.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;

async function pollinationsAI(pergunta, contexto) {
  try {
    const prompt = `Tu es um assistente especializado em Euro Truck Simulator 2, American Truck Simulator e comboios (ETS2/ATS).\n\nRegras:\n- Responde em portugues (PT-PT)\n- Respostas curtas e diretas (max 3 paragrafos)\n- Nao uses markdown pesado\n- Se nao souberes, diz "Nao tenho essa informacao. Abre um ticket para ajuda personalizada."\n- Usa estas fontes do Diego quando relevantes:\n${contexto}\n\nPergunta: ${pergunta}\n\nResposta:`;
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?seed=${Date.now()}&json=false`;
    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) throw new Error(`Pollinations erro: ${res.status}`);
    return (await res.text()).trim();
  } catch (e) {
    console.error("[Pollinations] Erro:", e.message);
    return null;
  }
}

async function geminiAI(pergunta, contexto) {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `Tu es um assistente especializado em ETS2/ATS e comboios. Responde em portugues, direto, curto (max 3 paragrafos).\n\nFontes do Diego:\n${contexto}\n\nPergunta: ${pergunta}`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
      }),
      timeout: 15000
    });
    if (!res.ok) throw new Error(`Gemini erro: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    console.error("[Gemini] Erro:", e.message);
    return null;
  }
}

export async function processarPerguntaETS2(message, client) {
  if (message.author.bot) return;
  if (!CONFIG.AJUDA_CHANNELS?.includes(message.channel.id)) return;

  const pergunta = message.content.toLowerCase();
  let contexto = "";

  const faq = getFAQ(pergunta);
  if (faq) contexto += `FAQ: ${faq.resposta}\n`;

  const tutorial = getTutorial(pergunta);
  if (tutorial) contexto += `Tutorial: ${tutorial.conteudo}\n`;

  let resposta = await pollinationsAI(message.content, contexto);
  if (!resposta && GEMINI_API_KEY) resposta = await geminiAI(message.content, contexto);
  if (!resposta) resposta = "Nao tenho essa informacao de momento. Abre um ticket para ajuda personalizada.";

  const embed = new EmbedBuilder()
    .setColor(0x262af1)
    .setTitle(`${CONFIG.EMOJI_BOT || "🤖"} Assistente ETS2/ATS`)
    .setDescription(resposta)
    .setFooter({ text: `Pergunta de ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ia_ajudou_${message.author.id}_${Date.now()}`).setLabel("Ajudou").setEmoji("👍").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ia_nao_ajudou_${message.author.id}_${Date.now()}`).setLabel("Nao ajudou").setEmoji("👎").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ia_ticket_${message.author.id}_${Date.now()}`).setLabel("Abrir Ticket").setEmoji("🎫").setStyle(ButtonStyle.Primary)
  );

  const msg = await message.reply({ embeds: [embed], components: [row] });

  try {
    await createIALogTopic({ client, user: message.author, pergunta: message.content, resposta, messageId: msg.id, channelId: message.channel.id });
  } catch (e) {
    console.error("[IA Logs] Erro ao criar topico:", e.message);
  }
}

export async function handleIAFeedback(interaction, client) {
  const { customId } = interaction;

  if (customId.startsWith("ia_ajudou_")) {
    await interaction.reply({ content: `${CONFIG.EMOJI_SUCCESS} Obrigado pelo feedback! Fico contente por ter ajudado.`, flags: 64 });
    return;
  }

  if (customId.startsWith("ia_nao_ajudou_")) {
    await interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Lamento nao ter ajudado. Tens algo para acrescentar? Abre um ticket.`, flags: 64 });
    return;
  }

  if (customId.startsWith("ia_ticket_")) {
    const { criarTicket } = await import("../services/tickets.js");
    await criarTicket(interaction, client, "ajuda_ia");
    return;
  }
}
