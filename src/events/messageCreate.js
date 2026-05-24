import { handleSmartResponse } from "../assistant/smartResponse.js";
import { CONFIG } from "../config/index.js";
import { db } from "../utils/db.js";
import { logMessageDelete, logMessageEdit } from "../services/recruitmentLogs.js";

// Store messages for logging
const messageCache = new Map();

export async function handleMessageCreate(message, client) {
    if (message.author.bot) return;

    // Cache message for edit/delete logging
    messageCache.set(message.id, {
        content: message.content,
        author: message.author,
        channel: message.channel,
        timestamp: message.createdTimestamp,
    });

    // Clean old cache (keep last 1000)
    if (messageCache.size > 1000) {
        const firstKey = messageCache.keys().next().value;
        messageCache.delete(firstKey);
    }

    // Assistente inteligente - resposta automática
    await handleSmartResponse(message, client);

    // Log messages in recruitment server
    if (message.guild && message.guild.id === CONFIG.GUILD_ID_RECRUTAMENTO) {
        // Messages are logged on delete/edit, not on create
    }

    // Comando Notificar
    if (message.content.startsWith("!notificar")) {
        const member = message.member;
        if (!member.roles.cache.has(CONFIG.CARGO_STAFF)) {
            return message.reply("❌ Apenas staff pode usar este comando.");
        }

        const ticket = Object.values(db.tickets).find(
            t => t.channelId === message.channel.id && !t.closed
        );

        if (!ticket) {
            return message.reply("❌ Este canal não é um ticket ativo.");
        }

        const user = await client.users.fetch(ticket.userId).catch(() => null);
        if (user) {
            await user.send(
                "👋 Olá, tem um staff a chamar-te num ticket.\n\n" +
                "🔗 **Link:** https://discord.com/channels/" + CONFIG.GUILD_ID + "/" + ticket.channelId
            ).catch(() => message.reply("❌ Erro DM."));
            await message.reply("✅ | Usuário notificado!");
        }
    }
}

// Export for use in messageDelete and messageUpdate events
export { messageCache };
