import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

export async function logIALog(client, user, question, answer, source, replyId) {
  try {
    const forumId = CONFIG.IA_LOG_FORUM_ID;
    if (!forumId) return;

    const forum = await client.channels.fetch(forumId).catch(() => null);
    if (!forum) {
      console.warn("[IA Logs] Forum nao encontrado:", forumId);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🤖 Interacao IA")
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: "Pergunta", value: question.substring(0, 1024), inline: false },
        { name: "Resposta", value: answer.substring(0, 1024), inline: false },
        { name: "Fonte", value: source, inline: true },
        { name: "Reply ID", value: replyId, inline: true }
      )
      .setColor(0x9b59b6)
      .setTimestamp();

    const threadName = `IA - ${user.username} - ${new Date().toLocaleDateString("pt-PT")}`;

    // Procurar topico existente de hoje para este user
    const threads = await forum.threads.fetchActive().catch(() => ({ threads: new Map() }));
    const existingThread = Array.from(threads.threads?.values() || []).find(t => 
      t.name.includes(user.username) && 
      t.createdTimestamp > Date.now() - 86400000
    );

    if (existingThread) {
      await existingThread.send({ embeds: [embed] });
    } else {
      await forum.threads.create({
        name: threadName,
        message: { embeds: [embed] },
        autoArchiveDuration: 1440
      });
    }
  } catch (e) {
    console.error("[IA Logs] Erro:", e.message);
  }
}

export async function updateIALogFeedback(client, replyId, feedback) {
  console.log(`[IA Feedback] Reply ${replyId}: ${feedback}`);
  // Implementacao futura: procurar mensagem pelo replyId e editar para adicionar feedback
}
