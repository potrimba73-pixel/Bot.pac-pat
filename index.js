// ============================================================
// PAC Bot - Portugal Alfa Community
// ============================================================

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} from "discord.js";
import http from 'node:http';
import { connectDB, db, saveDB } from "./src/utils/db.js";
import { CONFIG } from "./src/config/index.js";
import { handleReady } from "./src/events/ready.js";
import { handleInteractionCreate } from "./src/events/interactionCreate.js";
import { handleGuildMemberAdd } from "./src/events/guildMemberAdd.js";
import { handleGuildMemberRemove } from "./src/events/guildMemberRemove.js";
import { handleMessageCreate } from "./src/events/messageCreate.js";
import { handleMessageDelete } from "./src/events/messageDelete.js";
import { handleMessageUpdate } from "./src/events/messageUpdate.js";
import { sendPainelGeral, sendPainelRecrutamento, sendPainelRegras } from "./src/services/panels.js";
import { registerCommands } from "./src/commands/register.js";

console.log("[DIAG] 🚀 A iniciar bot...");

// ==================== VALIDAR ENV VARS ====================
const requiredEnv = ["TOKEN", "CLIENT_ID"];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
  console.error("[DIAG] ❌ Variaveis em falta:", missing.join(", "));
  process.exit(1);
}
console.log("[DIAG] ✅ ENV vars OK");

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
console.log("[DIAG] ✅ Client criado");

// ==================== LOAD DATABASE ====================
try {
  await connectDB();
  console.log("[DIAG] ✅ Base de dados conectada");
} catch (e) {
  console.error("[DIAG] ❌ Erro na base de dados:", e.message);
}

// ==================== REGISTER SLASH COMMANDS ====================
try {
  await registerCommands();
  console.log("[DIAG] ✅ Comandos slash registados");
} catch (e) {
  console.error("[DIAG] ❌ Erro ao registar comandos:", e.message);
}

// ==================== EVENTS ====================

// Ready
client.once(Events.ClientReady, async () => {
  console.log("[DIAG] ✅ Bot ONLINE:", client.user.tag);
  console.log("[DIAG] ✅ ID:", client.user.id);

  await handleReady(client);

  // Auto-setup dos paineis de tickets
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (guild) {
      // Painel Geral
      const canalGeral = await guild.channels.fetch(CONFIG.CANAL_TICKETS_GERAL).catch(() => null);
      if (canalGeral) {
        const msgs = await canalGeral.messages.fetch({ limit: 10 }).catch(() => null);
        const temPainelGeral = msgs?.some(m => 
          m.author.id === client.user.id && 
          m.components?.length > 0
        );
        if (!temPainelGeral) {
          await sendPainelGeral(canalGeral);
          console.log("[DIAG] ✅ Painel geral enviado");
        } else {
          console.log("[DIAG] ℹ️ Painel geral ja existe");
        }
      } else {
        console.warn("[DIAG] ⚠️ Canal de tickets geral nao encontrado:", CONFIG.CANAL_TICKETS_GERAL);
      }

      // Painel Regras
      const canalRegras = await guild.channels.fetch(CONFIG.CANAL_REGRAS).catch(() => null);
      if (canalRegras) {
        const msgs = await canalRegras.messages.fetch({ limit: 10 }).catch(() => null);
        const temPainelRegras = msgs?.some(m => 
          m.author.id === client.user.id && 
          m.components?.length > 0
        );
        if (!temPainelRegras) {
          await sendPainelRegras(canalRegras);
          console.log("[DIAG] ✅ Painel de regras enviado");
        } else {
          console.log("[DIAG] ℹ️ Painel de regras ja existe");
        }
      } else {
        console.warn("[DIAG] ⚠️ Canal de regras nao encontrado:", CONFIG.CANAL_REGRAS);
      }
    } else {
      console.warn("[DIAG] ⚠️ Servidor principal nao encontrado:", CONFIG.GUILD_ID);
    }

    // Painel Recrutamento (servidor de recrutamento)
    const guildRec = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
    if (guildRec) {
      const canalRec = await guildRec.channels.fetch(CONFIG.CANAL_TICKETS_RECRUTAMENTO).catch(() => null);
      if (canalRec) {
        const msgs = await canalRec.messages.fetch({ limit: 10 }).catch(() => null);
        const temPainelRec = msgs?.some(m => 
          m.author.id === client.user.id && 
          m.components?.length > 0
        );
        if (!temPainelRec) {
          await sendPainelRecrutamento(canalRec);
          console.log("[DIAG] ✅ Painel de recrutamento enviado");
        } else {
          console.log("[DIAG] ℹ️ Painel de recrutamento ja existe");
        }
      } else {
        console.warn("[DIAG] ⚠️ Canal de tickets recrutamento nao encontrado:", CONFIG.CANAL_TICKETS_RECRUTAMENTO);
      }
    } else {
      console.warn("[DIAG] ⚠️ Servidor de recrutamento nao encontrado:", CONFIG.GUILD_ID_RECRUTAMENTO);
    }
  } catch (err) {
    console.error("[DIAG] ❌ Erro no auto-setup dos paineis:", err.message);
  }
});

// Interaction Create (comandos, botoes, dropdowns, modals)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleInteractionCreate(interaction, client);
  } catch (error) {
    console.error("[Interaction] Erro:", error.message);
  }
});

// Guild Member Add
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await handleGuildMemberAdd(member, client);
  } catch (error) {
    console.error("[MemberAdd] Erro:", error.message);
  }
});

// Guild Member Remove
client.on(Events.GuildMemberRemove, async (member) => {
  try {
    await handleGuildMemberRemove(member, client);
  } catch (error) {
    console.error("[MemberRemove] Erro:", error.message);
  }
});

// Message Create (assistente inteligente)
client.on(Events.MessageCreate, async (message) => {
  try {
    await handleMessageCreate(message, client);
  } catch (error) {
    console.error("[MessageCreate] Erro:", error.message);
  }
});

// Message Delete (logs)
client.on(Events.MessageDelete, async (message) => {
  try {
    await handleMessageDelete(message, client);
  } catch (error) {
    console.error("[MessageDelete] Erro:", error.message);
  }
});

// Message Update (logs)
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  try {
    await handleMessageUpdate(oldMessage, newMessage, client);
  } catch (error) {
    console.error("[MessageUpdate] Erro:", error.message);
  }
});

// Error handling
client.on(Events.Error, (error) => {
  console.error("[DIAG] ❌ Erro do cliente Discord:", error.message);
});

process.on('unhandledRejection', (error) => {
  console.error("[DIAG] ❌ Unhandled Rejection:", error?.message || error);
});

process.on('uncaughtException', (error) => {
  console.error("[DIAG] ❌ Uncaught Exception:", error?.message || error);
});

// ==================== WEB SERVER ====================
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write("PAC Bot - Online\n");
  res.write("Uptime: " + Math.floor(process.uptime()) + "s\n");
  res.write("Tickets: " + Object.values(db.tickets).filter(t => !t.closed).length + "\n");
  res.end();
}).listen(process.env.PORT || 3000);

// ==================== LOGIN ====================
console.log("[DIAG] 🔄 A fazer login...");
client.login(process.env.TOKEN)
  .then(() => {
    console.log("[DIAG] ✅ Login iniciado");
  })
  .catch((err) => {
    console.error("[DIAG] ❌ Erro no login:", err.message);
    console.error("[DIAG] Verifica se o TOKEN esta correto no Render");
  });
