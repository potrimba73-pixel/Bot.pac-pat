import { Events } from "discord.js";
import { setExternalClient, setupExternalLogChannels } from "../services/externalLogs.js";
import { CONFIG } from "../config/index.js";
import { startTruckyCron } from "./ready/truckyCron.js";

export async function handleReady(client) {
 console.log(`[Ready] 🤖 Bot online: ${client.user.tag}`);

 // Configura o estado do bot
 client.user.setPresence({
 activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
 status: 'online',
 });

 // Configura o serviço de logs externo
 setExternalClient(client);

 // Auto-setup dos canais de log no servidor externo
 try {
 const externalGuild = await client.guilds.fetch(CONFIG.EXTERNAL_LOG_GUILD_ID).catch(() => null);
 if (externalGuild) {
 await setupExternalLogChannels(externalGuild);
 } else {
 console.warn("[Ready] Servidor externo de logs não encontrado. Verifica se o bot está no servidor 1510401803974475947");
 }
 } catch (err) {
 console.error("[Ready] Erro no setup de canais externos:", err.message);
 }

 // Inicia o cron do Trucky (verificacao automatica de inatividade)
 try {
 startTruckyCron(client);
 console.log("[Ready] ✅ Cron do Trucky iniciado!");
 } catch (err) {
 console.error("[Ready] ❌ Erro ao iniciar cron do Trucky:", err.message);
 }
}
