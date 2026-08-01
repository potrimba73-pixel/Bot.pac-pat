import { Events } from "discord.js";
import { setExternalClient, setupExternalLogChannels } from "../services/externalLogs.js";
import { CONFIG } from "../config/index.js";
import { sendPainelGeral, sendPainelRecrutamento, sendPainelRegras } from "../services/panels.js";
import { db, saveDB } from "../utils/db.js";

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
  console.log("[Ready] A iniciar limpeza de tickets fantasmas...");
  await limparTicketsFantasma(client);

  // === AUTO-SETUP DOS PAINÉIS ===
  if (!db.painelsHash) db.painelsHash = {};

  const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
  if (!guild) {
    console.warn("[Ready] Servidor principal nao encontrado.");
    return;
  }

  await new Promise(r => setTimeout(r, 3000));

  await setupPainel(client, guild, "geral", CONFIG.CANAL_TICKETS_GERAL, sendPainelGeral);
  await setupPainel(client, guild, "recrutamento", CONFIG.CANAL_TICKETS_RECRUTAMENTO, sendPainelRecrutamento);
  await setupPainel(client, guild, "regras", CONFIG.CANAL_REGRAS, sendPainelRegras);

  console.log("[Ready] ✅ Setup de paineis concluido!");
}

async function limparTicketsFantasma(client) {
  if (!db.tickets) {
    console.log("[Limpeza] Sem tickets na DB.");
    return;
  }

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
    console.log(`[Limpeza] ✅ ${limpos} tickets fantasmas limpos.`);
  }
}

async function setupPainel(client, guild, key, canalId, sendFn) {
  try {
    const channel = await client.channels.fetch(canalId).catch(() => null);
    if (!channel) {
      console.warn(`[Ready] Canal ${key} nao encontrado: ${canalId}`);
      return;
    }

    // === ESTRATÉGIA: Procurar painel existente do bot no canal ===
    // 1. Primeiro tenta o messageId guardado na DB
    // 2. Se nao encontrar, procura nas ultimas 50 mensagens do canal
    // 3. So reenvia se NAO encontrar NENHUM painel do bot

    let painelExistente = null;

    // Tentativa 1: messageId na DB
    const painelData = db.painelsHash?.[key];
    if (painelData?.messageId) {
      try {
        const msg = await channel.messages.fetch(painelData.messageId);
        if (msg && msg.author.id === client.user.id) {
          painelExistente = msg;
          console.log(`[Ready] Painel ${key} encontrado via DB (ID: ${msg.id}). Nao reenviado.`);
        }
      } catch (e) {
        console.log(`[Ready] Painel ${key} na DB nao encontrado no Discord.`);
      }
    }

    // Tentativa 2: Procurar nas ultimas mensagens do canal
    if (!painelExistente) {
      try {
        const messages = await channel.messages.fetch({ limit: 50 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        if (botMessages.size > 0) {
          // Pega a mensagem mais recente do bot (provavelmente o painel)
          painelExistente = botMessages.first();
          console.log(`[Ready] Painel ${key} encontrado via scan (ID: ${painelExistente.id}). Nao reenviado.`);
          
          // Atualiza a DB com o ID correto
          db.painelsHash[key] = {
            messageId: painelExistente.id,
            sentAt: new Date().toISOString(),
          };
          await saveDB();
        }
      } catch (e) {
        console.log(`[Ready] Erro ao procurar painel ${key} no canal:`, e.message);
      }
    }

    // Se encontrou painel, NAO faz nada mais
    if (painelExistente) {
      return;
    }

    // === SO REENVIA SE NAO HOUVER PAINEL ===
    console.log(`[Ready] Painel ${key} NAO encontrado. Enviando novo...`);

    const msg = await sendFn(channel);

    db.painelsHash[key] = {
      messageId: msg.id,
      sentAt: new Date().toISOString(),
    };
    await saveDB();

    console.log(`[Ready] Painel ${key} enviado! ID: ${msg.id}`);

  } catch (err) {
    console.error(`[Ready] Erro ao enviar painel ${key}:`, err.message);
  }
}
