// ============================================================
// ready.js - Evento quando o bot fica online
// ============================================================

import { Events } from "discord.js";
import { setExternalClient, setupExternalLogChannels } from "../services/externalLogs.js";
import { sendPainelGeral, sendPainelRecrutamento, sendPainelRegras } from "../services/panels.js";
import { CONFIG } from "../config/index.js";
import { getDb, saveDb } from "../utils/db.js";

export async function handleReady(client) {
  console.log(`[Ready] 🤖 Bot online: ${client.user.tag}`);

  // Configura o estado do bot
  client.user.setPresence({
    activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
    status: 'online',
  });

  // Configura o serviço de logs externo
  setExternalClient(client);

  // Auto-setup dos canais de log no servidor externo
  try {
    const externalGuild = await client.guilds.fetch(CONFIG.EXTERNAL_LOG_GUILD_ID).catch(() => null);
    if (externalGuild) {
      await setupExternalLogChannels(externalGuild);
    } else {
      console.warn("[Ready] Servidor externo de logs não encontrado. Verifica se o bot está no servidor 1510401803974475947");
    }
  } catch (err) {
    console.error("[Ready] Erro no setup de canais externos:", err.message);
  }

  // ===== AUTO-SETUP PAINÉIS (com anti-duplicação via DB) =====
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn("[Ready] Servidor principal não encontrado:", CONFIG.GUILD_ID);
      return;
    }

    const db = getDb();
    if (!db.painels) db.painels = {};

    // === Painel Geral ===
    if (CONFIG.CANAL_TICKETS_GERAL) {
      const canal = await guild.channels.fetch(CONFIG.CANAL_TICKETS_GERAL).catch(() => null);
      if (canal) {
        const painelId = db.painels?.geral;
        let painelExiste = false;
        
        if (painelId) {
          try {
            const msg = await canal.messages.fetch(painelId);
            if (msg) painelExiste = true;
          } catch (e) {
            painelExiste = false;
          }
        }

        if (!painelExiste) {
          const msg = await sendPainelGeral(canal);
          if (msg) {
            db.painels = db.painels || {};
            db.painels.geral = msg.id;
            saveDb(db);
            console.log("[Ready] ✅ Painel geral enviado e guardado na DB");
          }
        } else {
          console.log("[Ready] ℹ️ Painel geral já existe");
        }
      }
    }

    // === Painel Recrutamento ===
    if (CONFIG.CANAL_TICKETS_RECRUTAMENTO) {
      const canal = await guild.channels.fetch(CONFIG.CANAL_TICKETS_RECRUTAMENTO).catch(() => null);
      if (canal) {
        const painelId = db.painels?.recrutamento;
        let painelExiste = false;
        
        if (painelId) {
          try {
            const msg = await canal.messages.fetch(painelId);
            if (msg) painelExiste = true;
          } catch (e) {
            painelExiste = false;
          }
        }

        if (!painelExiste) {
          const msg = await sendPainelRecrutamento(canal);
          if (msg) {
            db.painels = db.painels || {};
            db.painels.recrutamento = msg.id;
            saveDb(db);
            console.log("[Ready] ✅ Painel de recrutamento enviado e guardado na DB");
          }
        } else {
          console.log("[Ready] ℹ️ Painel de recrutamento já existe");
        }
      }
    }

    // === Painel Regras ===
    if (CONFIG.CANAL_REGRAS) {
      const canal = await guild.channels.fetch(CONFIG.CANAL_REGRAS).catch(() => null);
      if (canal) {
        const painelId = db.painels?.regras;
        let painelExiste = false;
        
        if (painelId) {
          try {
            const msg = await canal.messages.fetch(painelId);
            if (msg) painelExiste = true;
          } catch (e) {
            painelExiste = false;
          }
        }

        if (!painelExiste) {
          const msg = await sendPainelRegras(canal);
          if (msg) {
            db.painels = db.painels || {};
            db.painels.regras = msg.id;
            saveDb(db);
            console.log("[Ready] ✅ Painel de regras enviado e guardado na DB");
          }
        } else {
          console.log("[Ready] ℹ️ Painel de regras já existe");
        }
      }
    }

  } catch (err) {
    console.error("[Ready] Erro no auto-setup de painéis:", err.message);
  }
}
