import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} from "discord.js";
import http from 'node:http';
import { loadDB, db } from "./src/utils/db.js";
import { handleReady } from "./src/events/ready.js";
import { handleGuildMemberAdd } from "./src/events/guildMemberAdd.js";
import { handleGuildMemberRemove } from "./src/events/guildMemberRemove.js";
import { handleInteractionCreate } from "./src/events/interactionCreate.js";
import { handleMessageCreate } from "./src/events/messageCreate.js";
import { handleMessageDelete } from "./src/events/messageDelete.js";
import { handleMessageUpdate } from "./src/events/messageUpdate.js";
import { setExternalClient } from "./src/services/externalLogs.js";

// ==================== VALIDAR ENV VARS ====================
const requiredEnv = ["TOKEN", "CLIENT_ID", "GUILD_ID"];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
  console.error("Variaveis em falta:", missing.join(", "));
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
  sweepers: {
    messages: {
      interval: 300,
      lifetime: 1800,
    },
  },
});

// ==================== LOAD DATABASE ====================
loadDB();

// ==================== EVENTS ====================
client.once(Events.ClientReady, () => {
  handleReady(client);
  setExternalClient(client);
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
    const { logExternalVoiceJoin, logExternalVoiceLeave } = await import("./src/services/externalLogs.js");
    if (newState.channel) logExternalVoiceJoin(newState.member, newState.channel);
    if (oldState.channel) logExternalVoiceLeave(oldState.member, oldState.channel);
  } catch (e) {}
});

// Channel events for external logging
client.on(Events.ChannelCreate, async (channel) => {
  try {
    const { logExternalChannelCreate } = await import("./src/services/externalLogs.js");
    logExternalChannelCreate(channel);
  } catch (e) {}
});

client.on(Events.ChannelDelete, async (channel) => {
  try {
    const { logExternalChannelDelete } = await import("./src/services/externalLogs.js");
    logExternalChannelDelete(channel);
  } catch (e) {}
});

// Role events for external logging
client.on(Events.GuildRoleCreate, async (role) => {
  try {
    const { logExternalRoleCreate } = await import("./src/services/externalLogs.js");
    logExternalRoleCreate(role);
  } catch (e) {}
});

client.on(Events.GuildRoleDelete, async (role) => {
  try {
    const { logExternalRoleDelete } = await import("./src/services/externalLogs.js");
    logExternalRoleDelete(role);
  } catch (e) {}
});

// Member update for external logging
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    const { logExternalMemberUpdate } = await import("./src/services/externalLogs.js");
    logExternalMemberUpdate(oldMember, newMember);
  } catch (e) {}
});

// Ban/Unban for external logging
client.on(Events.GuildBanAdd, async (ban) => {
  try {
    const { logExternalMemberBan } = await import("./src/services/externalLogs.js");
    logExternalMemberBan(ban);
  } catch (e) {}
});

client.on(Events.GuildBanRemove, async (ban) => {
  try {
    const { logExternalMemberUnban } = await import("./src/services/externalLogs.js");
    logExternalMemberUnban(ban.user);
  } catch (e) {}
});

// ===== BOT STATUS =====
client.on(Events.ClientReady, async () => {
  client.user.setPresence({
    activities: [{ name: '/ajuda novo comando!', type: 0 }],
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
  res.write("PAC Bot Online!\n");
  res.write("Uptime: " + Math.floor(process.uptime()) + "s\n");
  res.write("Tickets abertos: " + ticketsAbertos + "\n");
  res.end();
}).listen(process.env.PORT || 3000);

// ==================== LOGIN ====================
client.login(process.env.TOKEN);
