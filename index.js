// ============================================================
// DIAGNOSTICO - Coloca isto temporariamente no index.js
// para ver onde o bot está a crashar
// ============================================================

import {
 Client,
 GatewayIntentBits,
 Partials,
 Events,
} from "discord.js";
import http from 'node:http';
import { connectDB, db } from "./src/utils/db.js";

console.log("[DIAG] 🚀 A iniciar bot...");

// ==================== VALIDAR ENV VARS ====================
const requiredEnv = ["TOKEN", "CLIENT_ID"];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
 console.error("[DIAG] ❌ Variaveis em falta:", missing.join(", "));
 process.exit(1);
}
console.log("[DIAG] ✅ ENV vars OK");

// ==================== CLIENT SETUP ====================
const client = new Client({
 intents: [
 GatewayIntentBits.Guilds,
 GatewayIntentBits.GuildMessages,
 GatewayIntentBits.GuildMembers,
 GatewayIntentBits.MessageContent,
 GatewayIntentBits.DirectMessages,
 GatewayIntentBits.GuildPresences,
 GatewayIntentBits.GuildVoiceStates,
 ],
 partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});
console.log("[DIAG] ✅ Client criado");

// ==================== LOAD DATABASE ====================
try {
 await connectDB();
 console.log("[DIAG] ✅ MongoDB conectado");
} catch (e) {
 console.error("[DIAG] ❌ Erro MongoDB:", e.message);
}

// ==================== EVENTS ====================
client.once(Events.ClientReady, () => {
 console.log("[DIAG] ✅ Bot ONLINE:", client.user.tag);
 console.log("[DIAG] ✅ ID:", client.user.id);
});

client.on(Events.Error, (error) => {
 console.error("[DIAG] ❌ Erro do cliente Discord:", error.message);
});

process.on('unhandledRejection', (error) => {
 console.error("[DIAG] ❌ Unhandled Rejection:", error.message);
});

process.on('uncaughtException', (error) => {
 console.error("[DIAG] ❌ Uncaught Exception:", error.message);
});

// ==================== WEB SERVER ====================
http.createServer((req, res) => {
 res.writeHead(200, { 'Content-Type': 'text/plain' });
 res.write("PAC Bot - Modo Diagnostico\n");
 res.write("Uptime: " + Math.floor(process.uptime()) + "s\n");
 res.end();
}).listen(process.env.PORT || 3000);

// ==================== LOGIN ====================
console.log("[DIAG] 🔄 A fazer login...");
client.login(process.env.TOKEN)
 .then(() => {
 console.log("[DIAG] ✅ Login iniciado");
 })
 .catch((err) => {
 console.error("[DIAG] ❌ Erro no login:", err.message);
 console.error("[DIAG] Verifica se o TOKEN está correto no Render");
 });
