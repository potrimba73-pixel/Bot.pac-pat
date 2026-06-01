import { Events } from "discord.js";
import { setExternalClient } from "../services/externalLogs.js";

export async function handleReady(client) {
    console.log(`[Ready] Bot online: ${client.user.tag}`);

    // Configura o estado do bot
    client.user.setPresence({
        activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
        status: 'online',
    });

    // Configura o serviço de logs externo
    setExternalClient(client);
}
