import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
} from "discord.js";
import http from 'node:http';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== FIND SRC PATH ====================
let SRC_PATH = path.join(__dirname, "src");
let ALT_SRC_PATH = path.join(__dirname, "src", "src");

// Verificar qual estrutura existe
const hasDirectSrc = fs.existsSync(path.join(SRC_PATH, "events", "interactionCreate.js"));
const hasNestedSrc = fs.existsSync(path.join(ALT_SRC_PATH, "events", "interactionCreate.js"));

if (hasNestedSrc && !hasDirectSrc) {
    console.log("[Init] Usando estrutura aninhada: src/src/");
    SRC_PATH = ALT_SRC_PATH;
} else {
    console.log("[Init] Usando estrutura direta: src/");
}

function src(file) {
    return path.join(SRC_PATH, file);
}

// ==================== DATABASE ====================
const DB_FILE = "./tickets.json";
let db = { tickets: {}, messages: {}, acceptedRules: [], avaliacoes: {} };

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        } catch (e) {
            console.error("[DB] Erro ao carregar:", e.message);
        }
    }
}

let saving = false;
let pendingSave = false;

async function saveDB() {
    if (saving) {
        pendingSave = true;
        return;
    }
    saving = true;
    try {
        await fs.promises.writeFile(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("[DB] Erro ao guardar:", e.message);
    } finally {
        saving = false;
        if (pendingSave) {
            pendingSave = false;
            await saveDB();
        }
    }
}

loadDB();

// Export db e saveDB para os outros modulos
export { db, saveDB };

// ==================== VALIDAR ENV VARS ====================
const requiredEnv = ["TOKEN", "CLIENT_ID", "GUILD_ID"];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
    console.error("[Init] Variaveis em falta:", missing.join(", "));
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

// ==================== SAFE IMPORT ====================
const moduleCache = new Map();

async function safeImport(filePath) {
    const fullPath = src(filePath);

    if (moduleCache.has(fullPath)) {
        return moduleCache.get(fullPath);
    }

    try {
        const mod = await import("file://" + fullPath);
        moduleCache.set(fullPath, mod);
        console.log("[Import] OK:", filePath);
        return mod;
    } catch (e) {
        console.log("[Import] ERRO:", filePath, "-", e.message);
        return {};
    }
}

// ==================== EVENT HANDLERS ====================
client.once(Events.ClientReady, async () => {
    console.log("[Ready] Bot online:", client.user.tag);

    const ext = await safeImport("services/externalLogs.js");
    if (ext.setExternalClient) ext.setExternalClient(client);

    const ready = await safeImport("events/ready.js");
    if (ready.handleReady) await ready.handleReady(client);

    client.user.setPresence({
        activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
        status: 'online',
    });
});

client.on(Events.GuildMemberAdd, async (member) => {
    const evt = await safeImport("events/guildMemberAdd.js");
    if (evt.handleGuildMemberAdd) await evt.handleGuildMemberAdd(member, client);

    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalMemberJoin) await ext.logExternalMemberJoin(member);
});

client.on(Events.GuildMemberRemove, async (member) => {
    const evt = await safeImport("events/guildMemberRemove.js");
    if (evt.handleGuildMemberRemove) await evt.handleGuildMemberRemove(member, client);

    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalMemberLeave) await ext.logExternalMemberLeave(member);
});

client.on(Events.InteractionCreate, async (interaction) => {
    console.log("[Interaction] Tipo:", interaction.type, "CustomID:", interaction.customId || "N/A");

    const evt = await safeImport("events/interactionCreate.js");
    if (evt.handleInteractionCreate) {
        await evt.handleInteractionCreate(interaction, client);
    } else {
        console.log("[Interaction] handleInteractionCreate NAO ENCONTRADO!");
    }
});

client.on(Events.MessageCreate, async (message) => {
    const evt = await safeImport("events/messageCreate.js");
    if (evt.handleMessageCreate) await evt.handleMessageCreate(message, client);
});

client.on(Events.MessageDelete, async (message) => {
    const evt = await safeImport("events/messageDelete.js");
    if (evt.handleMessageDelete) await evt.handleMessageDelete(message, client);

    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalMessageDelete) await ext.logExternalMessageDelete(message);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    const evt = await safeImport("events/messageUpdate.js");
    if (evt.handleMessageUpdate) await evt.handleMessageUpdate(oldMessage, newMessage, client);

    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalMessageEdit) await ext.logExternalMessageEdit(oldMessage, newMessage);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (oldState.channelId === newState.channelId) return;
    const ext = await safeImport("services/externalLogs.js");
    if (newState.channel && ext.logExternalVoiceJoin) await ext.logExternalVoiceJoin(newState.member, newState.channel);
    if (oldState.channel && ext.logExternalVoiceLeave) await ext.logExternalVoiceLeave(oldState.member, oldState.channel);
});

client.on(Events.ChannelCreate, async (channel) => {
    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalChannelCreate) await ext.logExternalChannelCreate(channel);
});

client.on(Events.ChannelDelete, async (channel) => {
    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalChannelDelete) await ext.logExternalChannelDelete(channel);
});

client.on(Events.GuildRoleCreate, async (role) => {
    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalRoleCreate) await ext.logExternalRoleCreate(role);
});

client.on(Events.GuildRoleDelete, async (role) => {
    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalRoleDelete) await ext.logExternalRoleDelete(role);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalMemberUpdate) await ext.logExternalMemberUpdate(oldMember, newMember);
});

client.on(Events.GuildBanAdd, async (ban) => {
    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalMemberBan) await ext.logExternalMemberBan(ban);
});

client.on(Events.GuildBanRemove, async (ban) => {
    const ext = await safeImport("services/externalLogs.js");
    if (ext.logExternalMemberUnban) await ext.logExternalMemberUnban(ban.user);
});

// ==================== ERROR HANDLING ====================
client.on(Events.Error, (error) => {
    console.error("[Discord] Erro:", error.message);
});

process.on('unhandledRejection', (error) => {
    console.error("[Process] Unhandled Rejection:", error.message);
});

process.on('uncaughtException', (error) => {
    console.error("[Process] Uncaught Exception:", error.message);
});

// ==================== WEB SERVER ====================
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
