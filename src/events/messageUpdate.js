import { CONFIG } from "../config/index.js";
import { logMessageEdit } from "../services/recruitmentLogs.js";
import { messageCache } from "./messageCreate.js";

export async function handleMessageUpdate(oldMessage, newMessage, client) {
    if (oldMessage.author && oldMessage.author.bot) return;
    if (!oldMessage.guild) return;

    // Log for recruitment server
    if (oldMessage.guild.id === CONFIG.GUILD_ID_RECRUTAMENTO) {
        await logMessageEdit(oldMessage, newMessage, client);
    }

    // Update cache
    if (messageCache.has(newMessage.id)) {
        messageCache.set(newMessage.id, {
            content: newMessage.content,
            author: newMessage.author,
            channel: newMessage.channel,
            timestamp: newMessage.createdTimestamp,
        });
    }
}
