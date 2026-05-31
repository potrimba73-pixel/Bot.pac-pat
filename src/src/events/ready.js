import { setExternalClient } from "../services/externalLogs.js";

export async function handleReady(client) {
    console.log(`Bot online: ${client.user.tag}`);
    setExternalClient(client);
}
