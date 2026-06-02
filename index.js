import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    Options,
} from "discord.js";
import http from 'node:http';
import { loadDB, db, saveDB } from "./src/utils/db.js";
import { handleReady } from "./src/events/ready.js";
import { handleGuildMemberAdd } from "./src/events/guildMemberAdd.js";
import { handleGuildMemberRemove } from "./src/events/guildMemberRemove.js";
import { handleInteractionCreate } from "./src/events/interactionCreate.js";
import { handleMessageCreate } from "./src/events/messageCreate.js";
import { handleMessageDelete } from "./src/events/messageDelete.js";
import { handleMessageUpdate } from "./src/events/messageUpdate.js";

// ==================== VALIDAR ENV VARS ====================
const requiredEnv = ["TOKEN", "CLIENT_ID", "GUILD_ID"];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
    console.error("[FATAL] Variáveis em falta:", missing.join(", "));
    process.exit(1);
}

// ==================== CLIENT SETUP (OTIMIZADO PARA 500 MEMBROS) ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        // REMOVIDO: GatewayIntentBits.GuildPresences — não usado, consome RAM
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
    // Cache otimizado para servidor médio (500 membros)
    makeCache: Options.cacheWithLimits({
        MessageManager: { maxSize: 50, sweepInterval: 300, sweepFilter: Options.Sweepers.filterByLifetime({ lifetime: 1800 }) },
        PresenceManager: 0, // Desativa cache de presenças
        GuildMemberManager: { maxSize: 600, keepOverLimit: member => member.id === client.user?.id },
        UserManager: { maxSize: 600 },
        ReactionManager: 0,
        ReactionUserManager: 0,
    }),
    sweepers: {
        messages: {
            interval: 300, // 5 minutos
            lifetime: 1800, // 30 minutos
        },
        users: {
            interval: 600, // 10 minutos
            filter: () => user => user.bot !== true && user.id !== client.user?.id,
        },
    },
});

// ==================== LOAD DATABASE ====================
try {
    await loadDB();
    console.log("[DB] Base de dados carregada com sucesso.");
} catch (err) {
    console.error("[DB] Erro ao carregar DB:", err.message);
}

// ==================== PRE-CACHE EXTERNAL LOGS (evita import dinâmico repetido) ====================
let externalLogs = null;
async function getExternalLogs() {
    if (!externalLogs) {
        externalLogs = await import("./src/services/externalLogs.js");
    }
    return externalLogs;
}

// ==================== EVENTS ====================
client.once(Events.ClientReady, () => {
    handleReady(client);
    // Status unificado aqui em vez de segundo listener
    client.user.setPresence({
        activities: [{ name: '/ajuda | PAC Bot', type: 0 }],
        status: 'online',
    });
    console.log(`[READY] Bot online como ${client.user.tag}`);
});

client.on(Events.GuildMemberAdd, (member) => handleGuildMemberAdd(member, client));
client.on(Events.GuildMemberRemove, (member) => handleGuildMemberRemove(member, client));
client.on(Events.InteractionCreate, (interaction) => handleInteractionCreate(interaction, client));
client.on(Events.MessageCreate, (message) => handleMessageCreate(message, client));
client.on(Events.MessageDelete, (message) => handleMessageDelete(message, client));
client.on(Events.MessageUpdate, (oldMessage, newMessage) => handleMessageUpdate(oldMessage, newMessage, client));

// Voice state updates for external logging
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (oldState.channelId === newState.channelId) return;
    try {
        const logs = await getExternalLogs();
        if (newState.channel && logs.logExternalVoiceJoin) {
            await logs.logExternalVoiceJoin(newState.member, newState.channel);
        }
        if (oldState.channel && logs.logExternalVoiceLeave) {
            await logs.logExternalVoiceLeave(oldState.member, oldState.channel);
        }
    } catch (e) {
        // Silencioso — não floodar logs
    }
});

// Channel events for external logging
client.on(Events.ChannelCreate, async (channel) => {
    try {
        const logs = await getExternalLogs();
        if (logs.logExternalChannelCreate) await logs.logExternalChannelCreate(channel);
    } catch (e) {}
});

client.on(Events.ChannelDelete, async (channel) => {
    try {
        const logs = await getExternalLogs();
        if (logs.logExternalChannelDelete) await logs.logExternalChannelDelete(channel);
    } catch (e) {}
});

// Role events for external logging
client.on(Events.GuildRoleCreate, async (role) => {
    try {
        const logs = await getExternalLogs();
        if (logs.logExternalRoleCreate) await logs.logExternalRoleCreate(role);
    } catch (e) {}
});

client.on(Events.GuildRoleDelete, async (role) => {
    try {
        const logs = await getExternalLogs();
        if (logs.logExternalRoleDelete) await logs.logExternalRoleDelete(role);
    } catch (e) {}
});

// Member update for external logging
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
        const logs = await getExternalLogs();
        if (logs.logExternalMemberUpdate) await logs.logExternalMemberUpdate(oldMember, newMember);
    } catch (e) {}
});

// Ban/Unban for external logging
client.on(Events.GuildBanAdd, async (ban) => {
    try {
        const logs = await getExternalLogs();
        if (logs.logExternalMemberBan) await logs.logExternalMemberBan(ban);
    } catch (e) {}
});

client.on(Events.GuildBanRemove, async (ban) => {
    try {
        const logs = await getExternalLogs();
        if (logs.logExternalMemberUnban) await logs.logExternalMemberUnban(ban.user);
    } catch (e) {}
});

// ==================== ERROR HANDLING ====================
client.on(Events.Error, (error) => {
    console.error("[Discord Error]", error.message);
});

client.on(Events.ShardError, (error) => {
    console.error("[Shard Error]", error.message);
});

process.on('unhandledRejection', (error) => {
    console.error("[Unhandled Rejection]", error?.message || error);
});

process.on('uncaughtException', (error) => {
    console.error("[Uncaught Exception]", error?.message || error);
    // Graceful shutdown
    client.destroy().finally(() => process.exit(1));
});

// Graceful shutdown on SIGTERM (Render envia isto)
process.on('SIGTERM', async () => {
    console.log('[SIGTERM] A encerrar graciosamente...');
    try {
        await saveDB();
        await client.destroy();
    } catch (e) {
        console.error('[SIGTERM] Erro ao encerrar:', e.message);
    }
    process.exit(0);
});

// ==================== WEB SERVER (RENDER) ====================
const server = http.createServer((req, res) => {
    // Health check para o Render
    if (req.url === '/health') {
        const isReady = client.isReady();
        const ticketsAbertos = Object.values(db.tickets || {}).filter(t => !t.closed).length;
        res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: isReady ? 'ok' : 'starting',
            uptime: Math.floor(process.uptime()),
            ticketsAbertos,
            memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            timestamp: new Date().toISOString(),
        }));
        return;
    }

    // Endpoint raiz — mínimo info
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('PAC Bot Online!');
});

server.listen(process.env.PORT || 3000, () => {
    console.log(`[HTTP] Servidor web na porta ${process.env.PORT || 3000}`);
});

// ==================== LOGIN ====================
client.login(process.env.TOKEN).catch(err => {
    console.error('[FATAL] Falha no login:', err.message);
    process.exit(1);
});
