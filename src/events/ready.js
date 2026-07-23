// ============================================================
// ready.js - Evento quando o bot fica online
// ============================================================

import { Events } from "discord.js";
import { setExternalClient, setupExternalLogChannels } from "../services/externalLogs.js";
import { sendPainelGeral, sendPainelRecrutamento, sendPainelRegras } from "../services/panels.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js"; // ← CORRIGIDO

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
      console.warn("[Ready] Servidor externo de logs não encontrado.");
    }
  } catch (err) {
    console.error("[Ready] Erro no setup de canais externos:", err.message);
  }

  // ===== AUTO-SETUP DOS PAINÉIS (com anti-duplicação) =====
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn("[Ready] Servidor principal não encontrado:", CONFIG.GUILD_ID);
      return;
    }

    // Usar db diretamente (já importado)
    if (!db.painels) db.painels = {};

    // ===== PAINEL GERAL =====
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
            console.log("[Ready] ℹ️ Painel geral anterior não encontrado (foi apagado)");
          }
        }

        if (!painelExiste) {
          // Apagar mensagens antigas do bot no canal
          const msgs = await canal.messages.fetch({ limit: 10 });
          const botMsgs = msgs.filter(m => m.author.id === client.user.id);
          for (const msg of botMsgs.values()) {
            await msg.delete().catch(() => {});
          }

          const msg = await sendPainelGeral(canal);
          if (msg) {
            db.painels.geral = msg.id;
            saveDB(db); // ← CORRIGIDO
            console.log("[Ready] ✅ Painel geral enviado e guardado na DB");
          }
        } else {
          console.log("[Ready] ℹ️ Painel geral já existe (ID: " + painelId + ")");
        }
      }
    }

    // ===== PAINEL DE RECRUTAMENTO =====
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
            console.log("[Ready] ℹ️ Painel de recrutamento anterior não encontrado");
          }
        }

        if (!painelExiste) {
          const msgs = await canal.messages.fetch({ limit: 10 });
          const botMsgs = msgs.filter(m => m.author.id === client.user.id);
          for (const msg of botMsgs.values()) {
            await msg.delete().catch(() => {});
          }

          const msg = await sendPainelRecrutamento(canal);
          if (msg) {
            db.painels.recrutamento = msg.id;
            saveDB(db); // ← CORRIGIDO
            console.log("[Ready] ✅ Painel de recrutamento enviado e guardado na DB");
          }
        } else {
          console.log("[Ready] ℹ️ Painel de recrutamento já existe (ID: " + painelId + ")");
        }
      }
    }

    // ===== PAINEL DE REGRAS =====
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
            console.log("[Ready] ℹ️ Painel de regras anterior não encontrado");
          }
        }

        if (!painelExiste) {
          const msgs = await canal.messages.fetch({ limit: 10 });
          const botMsgs = msgs.filter(m => m.author.id === client.user.id);
          for (const msg of botMsgs.values()) {
            await msg.delete().catch(() => {});
          }

          const msg = await sendPainelRegras(canal);
          if (msg) {
            db.painels.regras = msg.id;
            saveDB(db); // ← CORRIGIDO
            console.log("[Ready] ✅ Painel de regras enviado e guardado na DB");
          }
        } else {
          console.log("[Ready] ℹ️ Painel de regras já existe (ID: " + painelId + ")");
        }
      }
    }

  } catch (err) {
    console.error("[Ready] Erro no auto-setup de painéis:", err.message);
  }
}
