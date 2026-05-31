import { Events } from "discord.js";
import { setExternalClient } from "../services/externalLogs.js";

export default {
    name: Events.ClientReady,
    once: true, // Este evento só corre uma vez quando o bot liga
    async execute(client) {
        console.log(`Bot online: ${client.user.tag}`);
        
        // Configura o estado do bot (o que tinhas no código original)
        client.user.setPresence({
            activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
            status: 'online',
        });

        // Configura o teu serviço de logs externo
        setExternalClient(client);
    },
};
