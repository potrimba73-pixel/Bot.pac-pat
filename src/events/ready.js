import { Events } from "discord.js";
import { setExternalClient, setupExternalLogChannels } from "../services/externalLogs.js";
import { CONFIG } from "../config/index.js";
import { sendPainelGeral, sendPainelRecrutamento, sendPainelRegras } from "../services/panels.js";
import { db, saveDB } from "../utils/db.js";
import crypto from "crypto";

function hashContent(content) {
  return crypto.createHash("md5").update(JSON.stringify(content)).digest("hex");
}

export async function handleReady(client) {
  console.log(`[Ready] 🤖 Bot online: ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
    status: 'online',
  });

  setExternalClient(client);

  try {
    const externalGuild = await client.guilds.fetch(CONFIG.EXTERNAL_LOG_GUILD_ID).catch(() => null);
    if (externalGuild) {
      await setupExternalLogChannels(externalGuild);
    } else {
      console.warn("[Ready] Servidor externo de logs nao encontrado.");
    }
  } catch (err) {
    console.error("[Ready] Erro no setup de canais externos:", err.message);
  }

  // === LIMPEZA DE TICKETS FANTASMAS ===
  await limparTicketsFantasma(client);

  // === AUTO-SETUP DOS PAINÉIS ===
  if (!db.painelsHash) db.painelsHash = {};

  const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
  if (!guild) {
    console.warn("[Ready] Servidor principal nao encontrado.");
    return;
  }

  await new Promise(r => setTimeout(r, 2000));

  await setupPainel(client, guild, "geral", CONFIG.CANAL_TICKETS_GERAL, sendPainelGeral);
  await setupPainel(client, guild, "recrutamento", CONFIG.CANAL_TICKETS_RECRUTAMENTO, sendPainelRecrutamento);
  await setupPainel(client, guild, "regras", CONFIG.CANAL_REGRAS, sendPainelRegras);

  console.log("[Ready] ✅ Setup de paineis concluido!");
}

async function limparTicketsFantasma(client) {
  if (!db.tickets) return;
  let limpos = 0;

  for (const [ticketId, ticket] of Object.entries(db.tickets)) {
    if (ticket.closed) continue;

    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel) {
      console.log(`[Limpeza] Ticket fantasma: ${ticketId} (canal ${ticket.channelId} nao existe)`);
      ticket.closed = true;
      ticket.closedAt = new Date().toISOString();
      ticket.closedBy = "system";
      ticket.closedByName = "Limpeza Automatica";
      limpos++;
    }
  }

  if (limpos > 0) {
    await saveDB();
    console.log(`[Limpeza] ${limpos} tickets fantasmas limpos.`);
  }
}

async function setupPainel(client, guild, key, canalId, sendFn) {
  try {
    const channel = await client.channels.fetch(canalId).catch(() => null);
    if (!channel) {
      console.warn(`[Ready] Canal ${key} nao encontrado: ${canalId}`);
      return;
    }

    const painelData = db.painelsHash?.[key];
    console.log(`[Ready] Painel ${key} - Dados na DB:`, painelData ? `messageId=${painelData.messageId}` : "NENHUM");

    let shouldSend = true;

    if (painelData && painelData.messageId) {
      try {
        const oldMsg = await channel.messages.fetch(painelData.messageId);
        if (oldMsg && oldMsg.author.id === client.user.id) {
          shouldSend = false;
          console.log(`[Ready] Painel ${key} encontrado no Discord, nao reenviado.`);
        } else {
          console.log(`[Ready] Painel ${key} encontrado mas nao e do bot. Reenviando...`);
        }
      } catch (e) {
        console.log(`[Ready] Painel ${key} messageId=${painelData.messageId} NAO encontrado. Reenviando...`);
      }
    } else {
      console.log(`[Ready] Painel ${key} sem messageId na DB. Reenviando...`);
    }

    if (shouldSend) {
      // Limpa TODAS as mensagens do bot no canal
      try {
        let fetched;
        do {
          fetched = await channel.messages.fetch({ limit: 100 });
          const botMessages = fetched.filter(m => m.author.id === client.user.id);
          console.log(`[Ready] Painel ${key} - ${botMessages.size} mensagens do bot para apagar.`);
          for (const msg of botMessages.values()) {
            await msg.delete().catch(() => {});
            await new Promise(r => setTimeout(r, 350));
          }
        } while (fetched.size >= 100);
      } catch (e) {
        console.warn(`[Ready] Erro ao limpar mensagens no canal ${key}:`, e.message);
      }

      const msg = await sendFn(channel);

      db.painelsHash[key] = {
        messageId: msg.id,
        hash: hashContent({ key, canalId, timestamp: Date.now() }),
        sentAt: new Date().toISOString(),
      };
      await saveDB();

      console.log(`[Ready] Painel ${key} enviado! Novo ID: ${msg.id}`);
    }
  } catch (err) {
    console.error(`[Ready] Erro ao enviar painel ${key}:`, err.message);
  }
}
