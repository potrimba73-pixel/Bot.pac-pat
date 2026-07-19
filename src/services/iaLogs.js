import { CONFIG } from "../config/index.js";

export async function createIALogTopic({ client, user, pergunta, resposta, messageId, channelId }) {
  try {
    const guild = await client.guilds.fetch(CONFIG.EXTERNAL_LOG_GUILD_ID);
    const forum = await guild.channels.fetch(CONFIG.IA_LOG_FORUM_ID);
    if (!forum || !forum.threads) {
      console.error("[IA Logs] Forum nao encontrado:", CONFIG.IA_LOG_FORUM_ID);
      return;
    }

    const threadName = `${pergunta.substring(0, 40).replace(/[^a-zA-Z0-9\s]/g, "")} | ${user.username}`;

    const thread = await forum.threads.create({
      name: threadName.substring(0, 100),
      message: {
        content: `**Pergunta:** ${pergunta}\n**User:** <@${user.id}> | ${user.tag}\n**Canal:** <#${channelId}>\n**Msg ID:** ${messageId}`
      }
    });

    const wh = await thread.createWebhook({
      name: user.username,
      avatar: user.displayAvatarURL({ extension: "png", size: 128 })
    });

    await wh.send({
      content: resposta.length > 1900 ? resposta.substring(0, 1900) + "..." : resposta,
      username: user.username,
      avatarURL: user.displayAvatarURL({ extension: "png", size: 128 })
    });

    const starterMsg = await thread.fetchStarterMessage();
    if (starterMsg) {
      await starterMsg.react("👍");
      await starterMsg.react("👎");
    }

    console.log(`[IA Logs] Topico criado: ${thread.name} (${thread.id})`);
  } catch (e) {
    console.error("[IA Logs] Erro:", e.message);
  }
}
