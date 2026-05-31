import { CONFIG } from "../config/index.js";
import { logExternalMessageDelete } from "../services/externalLogs.js";
import { messageCache } from "./messageCreate.js";

export async function handleMessageDelete(message, client) {
    if (message.author && message.author.bot) return;
    if (!message.guild) return;

    // Log externo
    await logExternalMessageDelete(message);

    // Log for recruitment server
    if (message.guild.id === CONFIG.GUILD_ID_RECRUTAMENTO) {
        const { logMessageDelete } = await import("../services/recruitmentLogs.js");
        await logMessageDelete(message, client);
    }

    if (messageCache.has(message.id)) {
        messageCache.delete(message.id);
    }
}
