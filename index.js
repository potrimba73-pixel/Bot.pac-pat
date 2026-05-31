import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
} from "discord.js";
import http from 'node:http';
import { loadDB } from "./src/utils/db.js";
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
    console.error("Variáveis de ambiente em falta:", missing.join(", "));
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

// ==================== EVENTS ====================
client.once(Events.ClientReady, () => handleReady(client));
client.on(Events.GuildMemberAdd, (member) => handleGuildMemberAdd(member, client));
client.on(Events.GuildMemberRemove, (member) => handleGuildMemberRemove(member, client));
client.on(Events.InteractionCreate, (interaction) => handleInteractionCreate(interaction, client));
client.on(Events.MessageCreate, (message) => handleMessageCreate(message, client));
client.on(Events.MessageDelete, (message) => handleMessageDelete(message, client));
client.on(Events.MessageUpdate, (oldMessage, newMessage) => handleMessageUpdate(oldMessage, newMessage, client));

// Voice state updates for external logging
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    if (oldState.channelId === newState.channelId) return;
    const { logExternalVoiceJoin, logExternalVoiceLeave } = require("./src/services/externalLogs.js");
    if (newState.channel) logExternalVoiceJoin(newState.member, newState.channel);
    if (oldState.channel) logExternalVoiceLeave(oldState.member, oldState.channel);
});

// Channel events for external logging
client.on(Events.ChannelCreate, (channel) => {
    const { logExternalChannelCreate } = require("./src/services/externalLogs.js");
    logExternalChannelCreate(channel);
});
client.on(Events.ChannelDelete, (channel) => {
    const { logExternalChannelDelete } = require("./src/services/externalLogs.js");
    logExternalChannelDelete(channel);
});

// Role events for external logging
client.on(Events.GuildRoleCreate, (role) => {
    const { logExternalRoleCreate } = require("./src/services/externalLogs.js");
    logExternalRoleCreate(role);
});
client.on(Events.GuildRoleDelete, (role) => {
    const { logExternalRoleDelete } = require("./src/services/externalLogs.js");
    logExternalRoleDelete(role);
});

// Member update for external logging
client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    const { logExternalMemberUpdate } = require("./src/services/externalLogs.js");
    logExternalMemberUpdate(oldMember, newMember);
});

// Ban/Unban for external logging
client.on(Events.GuildBanAdd, (ban) => {
    const { logExternalMemberBan } = require("./src/services/externalLogs.js");
    logExternalMemberBan(ban);
});
client.on(Events.GuildBanRemove, (ban) => {
    const { logExternalMemberUnban } = require("./src/services/externalLogs.js");
    logExternalMemberUnban(ban.user);
});

// ===== BOT STATUS =====
client.on(Events.ClientReady, async () => {
    client.user.setPresence({
        activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
        status: 'online',
    });
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
    res.write("PAC Bot Online!
");
    res.write(`Uptime: ${Math.floor(process.uptime())}s
`);
    res.write(`Tickets abertos: ${ticketsAbertos}
`);
    res.end();
}).listen(process.env.PORT || 3000);

// ==================== LOGIN ====================
client.login(process.env.TOKEN);
