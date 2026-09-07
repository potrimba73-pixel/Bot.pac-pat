// src/services/healthCheck.js
import { EmbedBuilder } from "discord.js";
import { db } from "../utils/db.js";
import { CONFIG } from "../config/index.js";

let lastCheckTime = 0;
const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 horas em milissegundos

/**
 * Executa uma verificação de saúde do bot e envia um log para o canal configurado.
 * @param {Client} client - O cliente do Discord.
 */
export async function performHealthCheck(client) {
    const now = Date.now();
    // Prevenir execuções duplicadas
    if (now - lastCheckTime < CHECK_INTERVAL - 60000) return;
    lastCheckTime = now;

    try {
        // Recolher métricas
        const guilds = client.guilds.cache;
        const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
        const ticketsAbertos = Object.values(db.tickets || {}).filter(t => !t.closed).length;
        const uptimeSeconds = Math.floor(process.uptime());
        const uptimeStr = formatUptime(uptimeSeconds);

        // Status atual do bot (online/idle/dnd)
        const botStatus = client.user?.presence?.status || "offline";

        // Verificar MongoDB
        const mongoStatus = db._mongoConnected ? "✅ Conectado" : "❌ Desconectado";

        // Criar embed
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

        // Enviar para o canal de logs
        const logChannelId = CONFIG.CANAL_LOGS;
        if (logChannelId) {
            const channel = await client.channels.fetch(logChannelId).catch(() => null);
            if (channel) {
                await channel.send({ embeds: [embed] });
                console.log(`[HealthCheck] Log enviado para ${channel.name}`);
            } else {
                console.warn("[HealthCheck] Canal de logs não encontrado.");
            }
        } else {
            console.warn("[HealthCheck] CONFIG.CANAL_LOGS não configurado.");
        }
    } catch (error) {
        console.error("[HealthCheck] Erro ao executar verificação:", error);
    }
}

/**
 * Formata o uptime em dias, horas, minutos e segundos.
 */
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

/**
 * Inicia o agendamento da verificação periódica.
 * @param {Client} client 
 */
export function startHealthCheckScheduler(client) {
    // Executar imediatamente no arranque (para testar)
    setTimeout(() => performHealthCheck(client), 5000);

    // Depois a cada 4 horas
    setInterval(() => performHealthCheck(client), CHECK_INTERVAL);
    console.log(`[HealthCheck] Scheduler iniciado: verificação a cada ${CHECK_INTERVAL/3600000} horas.`);
}
