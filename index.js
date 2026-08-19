// ============================================================
// index.js - Ponto de entrada principal do PAC Bot
// ============================================================

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} from "discord.js";
import http from "node:http";
import { db, connectDB, saveDB } from "./src/utils/db.js";

// ===== HANDLERS PRINCIPAIS =====
import { handleReady } from "./src/events/ready.js";
import { handleGuildMemberAdd } from "./src/events/guildMemberAdd.js";
import { handleGuildMemberRemove } from "./src/events/guildMemberRemove.js";
import { handleInteractionCreate } from "./src/events/interactionCreate.js";
import { handleMessageCreate } from "./src/events/messageCreate.js";
import { handleMessageDelete } from "./src/events/messageDelete.js";
import { handleMessageUpdate } from "./src/events/messageUpdate.js";

// ===== HANDLERS ADICIONAIS (IMPORTANTES - CORRIGIDOS) =====
import guildMemberUpdate from "./src/events/guildMemberUpdate.js";
import voiceStateUpdate from "./src/events/voiceStateUpdate.js";

// ===== SERVIÇOS EXTERNOS =====
import {
  setExternalClient,
  logExternalChannelCreate,
  logExternalChannelDelete,
  logExternalRoleCreate,
  logExternalRoleDelete,
  logExternalMemberBan,
  logExternalMemberUnban,
} from "./src/services/externalLogs.js";

// ============================================================
// 1. VALIDAÇÃO DAS VARIÁVEIS DE AMBIENTE
// ============================================================
const requiredEnv = ["TOKEN", "CLIENT_ID"];
const missing = requiredEnv.filter((e) => !process.env[e]);
if (missing.length > 0) {
  console.error("❌ Variáveis em falta:", missing.join(", "));
  process.exit(1);
}

// ============================================================
// 2. CONFIGURAÇÃO DO CLIENTE DISCORD
// ============================================================
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

// ============================================================
// 3. CONEXÃO À BASE DE DADOS (com espera)
// ============================================================
await connectDB().catch((err) =>
  console.error("[DB] Erro ao conectar:", err)
);

// ============================================================
// 4. REGISTO DOS EVENTOS
// ============================================================

// ---- READY ----
client.once(Events.ClientReady, () => {
  handleReady(client);
  setExternalClient(client);
});

// ---- MEMBROS ----
client.on(Events.GuildMemberAdd, (member) =>
  handleGuildMemberAdd(member, client)
);
client.on(Events.GuildMemberRemove, (member) =>
  handleGuildMemberRemove(member, client)
);

// ---- ATUALIZAÇÃO DE MEMBRO (cargos/nickname) ----
client.on(Events.GuildMemberUpdate, (oldMember, newMember) =>
  guildMemberUpdate.execute(oldMember, newMember, client)
);

// ---- INTERAÇÕES (comandos, botões, menus, modais) ----
client.on(Events.InteractionCreate, (interaction) =>
  handleInteractionCreate(interaction, client)
);

// ---- MENSAGENS ----
client.on(Events.MessageCreate, (message) =>
  handleMessageCreate(message, client)
);
client.on(Events.MessageDelete, (message) =>
  handleMessageDelete(message, client)
);
client.on(Events.MessageUpdate, (oldMessage, newMessage) =>
  handleMessageUpdate(oldMessage, newMessage, client)
);

// ---- ESTADO DE VOZ ----
client.on(Events.VoiceStateUpdate, (oldState, newState) =>
  voiceStateUpdate.execute(oldState, newState, client)
);

// ---- LOGS EXTERNOS: CANAIS ----
client.on(Events.ChannelCreate, async (channel) => {
  try {
    await logExternalChannelCreate(channel);
  } catch (e) {
    /* silencioso */
  }
});
client.on(Events.ChannelDelete, async (channel) => {
  try {
    await logExternalChannelDelete(channel);
  } catch (e) {
    /* silencioso */
  }
});

// ---- LOGS EXTERNOS: CARGOS ----
client.on(Events.GuildRoleCreate, async (role) => {
  try {
    await logExternalRoleCreate(role);
  } catch (e) {
    /* silencioso */
  }
});
client.on(Events.GuildRoleDelete, async (role) => {
  try {
    await logExternalRoleDelete(role);
  } catch (e) {
    /* silencioso */
  }
});

// ---- LOGS EXTERNOS: BANS ----
client.on(Events.GuildBanAdd, async (ban) => {
  try {
    await logExternalMemberBan(ban);
  } catch (e) {
    /* silencioso */
  }
});
client.on(Events.GuildBanRemove, async (ban) => {
  try {
    await logExternalMemberUnban(ban.user, ban.guild);
  } catch (e) {
    /* silencioso */
  }
});

// ============================================================
// 5. SERVIDOR HTTP (para health checks no Render)
// ============================================================
const server = http.createServer((req, res) => {
  const ticketsAbertos = Object.values(db.tickets || {}).filter(
    (t) => !t.closed
  ).length;

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write("✅ PAC Bot Online!\n");
  res.write(`⏱️ Uptime: ${Math.floor(process.uptime())}s\n`);
  res.write(`🎫 Tickets abertos: ${ticketsAbertos}\n`);
  res.end();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[INDEX] 🌐 Servidor HTTP a escutar na porta ${PORT}`);
});

// ============================================================
// 6. TRATAMENTO DE ERROS GLOBAIS
// ============================================================
client.on(Events.Error, (error) =>
  console.error("[DISCORD] Erro no cliente:", error)
);

process.on("unhandledRejection", (error) =>
  console.error("[INDEX] Unhandled Rejection:", error)
);
process.on("uncaughtException", (error) =>
  console.error("[INDEX] Uncaught Exception:", error)
);

// ============================================================
// 7. LOGIN (com async/await e tratamento robusto)
// ============================================================
(async () => {
  try {
    console.log("[INDEX] 🔑 A iniciar sessão no Discord...");
    await client.login(process.env.TOKEN);
    console.log("[INDEX] ✅ Login efetuado com sucesso!");
  } catch (error) {
    console.error("[INDEX] ❌ Erro fatal no login:", error);
    process.exit(1);
  }
})();

// ============================================================
// 8. SALVAMENTO PERIÓDICO DA BASE DE DADOS (opcional)
// ============================================================
setInterval(() => {
  saveDB().catch((err) =>
    console.error("[INDEX] Erro ao guardar DB periódico:", err)
  );
}, 5 * 60 * 1000); // a cada 5 minutos

console.log("[INDEX] 🚀 Bot iniciado com sucesso! (aguardando eventos...)");
