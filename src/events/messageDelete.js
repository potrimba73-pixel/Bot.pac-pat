import { CONFIG } from "../config/index.js";
import { logMessageDelete } from "../services/recruitmentLogs.js";
import { messageCache } from "./messageCreate.js";

export async function handleMessageDelete(message, client) {
    if (message.author && message.author.bot) return;
    if (!message.guild) return;

    // Log for recruitment server
    if (message.guild.id === CONFIG.GUILD_ID_RECRUTAMENTO) {
        await logMessageDelete(message, client);
    }

    // Clean cache
    if (messageCache.has(message.id)) {
        messageCache.delete(message.id);
    }
}
