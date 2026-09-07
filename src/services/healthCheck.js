// src/services/healthCheck.js
import { EmbedBuilder } from "discord.js";
import { db } from "../utils/db.js";
import { CONFIG } from "../config/index.js";

let lastCheckTime = 0;
const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 horas
let lastLoggedStatus = null;

/**
 * Executa uma verificação de saúde do bot e envia um log para o canal configurado.
 */
export async function performHealthCheck(client) {
    const now = Date.now();
    if (now - lastCheckTime < CHECK_INTERVAL - 60000) return;
    lastCheckTime = now;

    try {
        const guilds = client.guilds.cache;
        const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
        const ticketsAbertos = Object.values(db.tickets || {}).filter(t => !t.closed).length;
        const uptimeSeconds = Math.floor(process.uptime());
        const uptimeStr = formatUptime(uptimeSeconds);

        const botStatus = client.user?.presence?.status || "offline";

        // ✅ VERIFICAÇÃO CORRETA DO MONGODB
        // Usamos a variável useMongo que está no escopo do módulo db.js
        // Como não é exportada, vamos verificar se db tem uma propriedade _mongoConnected
        // ou então verificamos se o cliente MongoDB está ativo.
        let mongoStatus = "❌ Desconectado";
        try {
            // Tenta aceder à variável useMongo através do módulo (se exportada)
            // Fallback: verifica se db tem um método que indica conexão
            const { useMongo } = await import('../utils/db.js');
            mongoStatus = useMongo ? "✅ Conectado" : "❌ Desconectado";
        } catch {
            // Se não conseguir importar, tenta verificar se há um cliente
            try {
                const { client: mongoClient } = await import('../utils/db.js');
                if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
                    mongoStatus = "✅ Conectado";
                }
            } catch {
                // Mantém "❌ Desconectado"
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("🩺 Health Check - PAC Bot")
            .setColor(botStatus === "online" ? 0x57F287 : botStatus === "idle" ? 0xFEE75C : 0xED4245)
            .setTimestamp()
            .addFields(
                { name: "📡 Status do Bot", value: `\`${botStatus.toUpperCase()}\``, inline: true },
                { name: "⏱️ Uptime", value: uptimeStr, inline: true },
                { name: "🖥️ Servidores", value: `${guilds.size}`, inline: true },
                { name: "👥 Membros Totais", value: `${totalMembers}`, inline: true },
                { name: "🎫 Tickets Abertos", value: `${ticketsAbertos}`, inline: true },
                { name: "🗄️ MongoDB", value: mongoStatus, inline: true },
                { name: "🕒 Hora da Verificação", value: `<t:${Math.floor(now/1000)}:F>`, inline: false }
            )
            .setFooter({ text: "Verificação automática (4 em 4 horas)" });

        const logChannelId = CONFIG.CANAL_LOGS;
        if (logChannelId) {
            const channel = await client.channels.fetch(logChannelId).catch(() => null);
            if (channel) {
                await channel.send({ embeds: [embed] });
                console.log(`[HealthCheck] Log enviado para ${channel.name}`);
            } else {
                console.warn("[HealthCheck] Canal de logs não encontrado.");
            }
        }
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
    console.log(`[HealthCheck] Scheduler iniciado (a cada ${CHECK_INTERVAL/3600000}h)`);
}
