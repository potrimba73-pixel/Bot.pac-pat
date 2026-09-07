// src/services/healthCheck.js
import { db } from "../utils/db.js";

const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 horas

export async function performHealthCheck(client) {
    const now = Date.now();

    try {
        const guilds = client.guilds.cache;
        const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
        const ticketsAbertos = Object.values(db.tickets || {}).filter(t => !t.closed).length;
        const uptimeSeconds = Math.floor(process.uptime());
        const uptimeStr = formatUptime(uptimeSeconds);
        const botStatus = client.user?.presence?.status || "offline";
        const mongoStatus = db._mongoConnected ? "✅ Conectado" : "❌ Desconectado";

        console.log(`
═══════════════════════════════════════════════════
🩺 HEALTH CHECK - PAC BOT (${new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })})
───────────────────────────────────────────────────
📡 Status: ${botStatus.toUpperCase()}
⏱️ Uptime: ${uptimeStr}
🖥️ Servidores: ${guilds.size}
👥 Membros: ${totalMembers}
🎫 Tickets abertos: ${ticketsAbertos}
🗄️ MongoDB: ${mongoStatus}
═══════════════════════════════════════════════════
        `);
    } catch (error) {
        console.error("[HealthCheck] Erro:", error);
    }
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(' ');
}

export function startHealthCheckScheduler(client) {
    setTimeout(() => performHealthCheck(client), 5000);
    setInterval(() => performHealthCheck(client), CHECK_INTERVAL);
    console.log(`[HealthCheck] Scheduler iniciado: a cada ${CHECK_INTERVAL / 3600000} horas (apenas console).`);
}
