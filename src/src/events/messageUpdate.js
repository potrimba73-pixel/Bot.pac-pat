import { CONFIG } from "../config/index.js";
import { logExternalMessageEdit } from "../services/externalLogs.js";
import { messageCache } from "./messageCreate.js";

export async function handleMessageUpdate(oldMessage, newMessage, client) {
    if (oldMessage.author && oldMessage.author.bot) return;
    if (!oldMessage.guild) return;

    // Log externo
    await logExternalMessageEdit(oldMessage, newMessage);

    // Log for recruitment server
    if (oldMessage.guild.id === CONFIG.GUILD_ID_RECRUTAMENTO) {
        const { logMessageEdit } = await import("../services/recruitmentLogs.js");
        await logMessageEdit(oldMessage, newMessage, client);
    }

    if (messageCache.has(newMessage.id)) {
        messageCache.set(newMessage.id, {
            content: newMessage.content,
            author: newMessage.author,
            channel: newMessage.channel,
            timestamp: newMessage.createdTimestamp,
        });
    }
}
