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

// ==================== CLIENT SETUP ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
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

// ===== BOT STATUS (NEW) =====
client.on(Events.ClientReady, async () => {
    client.user.setPresence({
        activities: [{
            name: '/ajuda | Portugal Alfa Community',
            type: 0, // Playing
        }],
        status: 'online',
    });
});

// ==================== ERROR HANDLING ====================
client.on(Events.Error, (error) => {
    console.error("❌ Erro do cliente Discord:", error);
});

process.on('unhandledRejection', (error) => {
    console.error("❌ Unhandled Rejection:", error);
});

process.on('uncaughtException', (error) => {
    console.error("❌ Uncaught Exception:", error);
});

// ==================== WEB SERVER (RENDER) ====================
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write("PAC Bot Online! ✅\n");
    res.write(`Uptime: ${Math.floor(process.uptime())}s\n`);
    res.write(`Tickets: ${Object.keys(client.readyTimestamp || {}).length}\n`);
    res.end();
}).listen(process.env.PORT || 3000);

// ==================== LOGIN ====================
client.login(process.env.TOKEN);
