import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
} from "discord.js";
import http from 'node:http';
import { loadDB, db } from "./src/utils/db.js";

// Lazy-loaded modules (para evitar crash se ficheiros nao existirem)
let externalLogs = null;
async function getExternalLogs() {
    if (!externalLogs) {
        try {
            externalLogs = await import("./src/services/externalLogs.js");
        } catch (e) {
            return null;
        }
    }
    return externalLogs;
}

// ==================== VALIDAR ENV VARS ====================
const requiredEnv = ["TOKEN", "CLIENT_ID", "GUILD_ID"];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
    console.error("Variaveis de ambiente em falta:", missing.join(", "));
    process.exit(1);
}

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

// ==================== LOAD DATABASE ====================
loadDB();

// ==================== EVENT HANDLERS (com lazy import) ====================
async function safeImport(path, fallback) {
    try {
        return await import(path);
    } catch (e) {
        console.log("[Import] Ficheiro nao encontrado:", path);
        return fallback || {};
    }
}

client.once(Events.ClientReady, async () => {
    console.log("Bot online como " + client.user.tag);

    const ext = await getExternalLogs();
    if (ext && ext.setExternalClient) {
        ext.setExternalClient(client);
    }

    const { handleReady } = await safeImport("./src/events/ready.js", {});
    if (handleReady) await handleReady(client);

    client.user.setPresence({
        activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
        status: 'online',
    });
});

client.on(Events.GuildMemberAdd, async (member) => {
    const { handleGuildMemberAdd } = await safeImport("./src/events/guildMemberAdd.js", {});
    if (handleGuildMemberAdd) await handleGuildMemberAdd(member, client);

    const ext = await getExternalLogs();
    if (ext && ext.logExternalMemberJoin) await ext.logExternalMemberJoin(member);
});

client.on(Events.GuildMemberRemove, async (member) => {
    const { handleGuildMemberRemove } = await safeImport("./src/events/guildMemberRemove.js", {});
    if (handleGuildMemberRemove) await handleGuildMemberRemove(member, client);

    const ext = await getExternalLogs();
    if (ext && ext.logExternalMemberLeave) await ext.logExternalMemberLeave(member);
});

client.on(Events.InteractionCreate, async (interaction) => {
    const { handleInteractionCreate } = await safeImport("./src/events/interactionCreate.js", {});
    if (handleInteractionCreate) await handleInteractionCreate(interaction, client);
});

client.on(Events.MessageCreate, async (message) => {
    const { handleMessageCreate } = await safeImport("./src/events/messageCreate.js", {});
    if (handleMessageCreate) await handleMessageCreate(message, client);
});

client.on(Events.MessageDelete, async (message) => {
    const { handleMessageDelete } = await safeImport("./src/events/messageDelete.js", {});
    if (handleMessageDelete) await handleMessageDelete(message, client);

    const ext = await getExternalLogs();
    if (ext && ext.logExternalMessageDelete) await ext.logExternalMessageDelete(message);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    const { handleMessageUpdate } = await safeImport("./src/events/messageUpdate.js", {});
    if (handleMessageUpdate) await handleMessageUpdate(oldMessage, newMessage, client);

    const ext = await getExternalLogs();
    if (ext && ext.logExternalMessageEdit) await ext.logExternalMessageEdit(oldMessage, newMessage);
});

// Voice state updates for external logging
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (oldState.channelId === newState.channelId) return;
    const ext = await getExternalLogs();
    if (!ext) return;
    if (newState.channel && ext.logExternalVoiceJoin) {
        await ext.logExternalVoiceJoin(newState.member, newState.channel);
    }
    if (oldState.channel && ext.logExternalVoiceLeave) {
        await ext.logExternalVoiceLeave(oldState.member, oldState.channel);
    }
});

// Channel events for external logging
client.on(Events.ChannelCreate, async (channel) => {
    const ext = await getExternalLogs();
    if (ext && ext.logExternalChannelCreate) await ext.logExternalChannelCreate(channel);
});

client.on(Events.ChannelDelete, async (channel) => {
    const ext = await getExternalLogs();
    if (ext && ext.logExternalChannelDelete) await ext.logExternalChannelDelete(channel);
});

// Role events for external logging
client.on(Events.GuildRoleCreate, async (role) => {
    const ext = await getExternalLogs();
    if (ext && ext.logExternalRoleCreate) await ext.logExternalRoleCreate(role);
});

client.on(Events.GuildRoleDelete, async (role) => {
    const ext = await getExternalLogs();
    if (ext && ext.logExternalRoleDelete) await ext.logExternalRoleDelete(role);
});

// Member update for external logging
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const ext = await getExternalLogs();
    if (ext && ext.logExternalMemberUpdate) await ext.logExternalMemberUpdate(oldMember, newMember);
});

// Ban/Unban for external logging
client.on(Events.GuildBanAdd, async (ban) => {
    const ext = await getExternalLogs();
    if (ext && ext.logExternalMemberBan) await ext.logExternalMemberBan(ban);
});

client.on(Events.GuildBanRemove, async (ban) => {
    const ext = await getExternalLogs();
    if (ext && ext.logExternalMemberUnban) await ext.logExternalMemberUnban(ban.user);
});

// ==================== ERROR HANDLING ====================
client.on(Events.Error, (error) => {
    console.error("Erro do cliente Discord:", error);
});

process.on('unhandledRejection', (error) => {
    console.error("Unhandled Rejection:", error);
});

process.on('uncaughtException', (error) => {
    console.error("Uncaught Exception:", error);
});

// ==================== WEB SERVER (RENDER) ====================
http.createServer((req, res) => {
    const ticketsAbertos = Object.values(db.tickets || {}).filter(t => !t.closed).length;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write("PAC Bot Online!\n");
    res.write("Uptime: " + Math.floor(process.uptime()) + "s\n");
    res.write("Tickets abertos: " + ticketsAbertos + "\n");
    res.end();
}).listen(process.env.PORT || 3000);

// ==================== LOGIN ====================
client.login(process.env.TOKEN);
