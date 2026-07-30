// ============================================================
// ready.js - Evento quando o bot fica online
// ============================================================

import { Events } from "discord.js";
import { setExternalClient, setupExternalLogChannels } from "../services/externalLogs.js";
import { sendPainelGeral, sendPainelRecrutamento, sendPainelRegras } from "../services/panels.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { registerCommands } from "../commands/register.js";
import crypto from "crypto";

// Função para calcular hash do conteúdo de um embed
function hashPainel(embed, components) {
  const data = JSON.stringify({
    title: embed.data?.title || "",
    description: embed.data?.description || "",
    image: embed.data?.image?.url || "",
    color: embed.data?.color || 0,
    components: components.map(c => c.toJSON())
  });
  return crypto.createHash("md5").update(data).digest("hex");
}

export async function handleReady(client) {
  console.log(`[Ready] Bot online: ${client.user.tag}`);

  // ===== REGISTAR COMANDOS SLASH =====
  try {
    await registerCommands();
    console.log("[Ready] Comandos slash registados com sucesso!");
  } catch (err) {
    console.error("[Ready] Erro ao registar comandos:", err.message);
  }

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
      console.warn("[Ready] Servidor externo de logs nao encontrado.");
    }
  } catch (err) {
    console.error("[Ready] Erro no setup de canais externos:", err.message);
  }

  // ===== AUTO-SETUP DOS PAINÉIS (com anti-duplicação + verificação de conteúdo) =====
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn("[Ready] Servidor principal nao encontrado:", CONFIG.GUILD_ID);
      return;
    }

    if (!db.painels) db.painels = {};
    if (!db.painelsHash) db.painelsHash = {};

    // ===== PAINEL GERAL =====
    if (CONFIG.CANAL_TICKETS_GERAL) {
      await verificarEPainel(
        client, guild, CONFIG.CANAL_TICKETS_GERAL,
        "geral", sendPainelGeral
      );
    }

    // ===== PAINEL DE RECRUTAMENTO =====
    if (CONFIG.CANAL_TICKETS_RECRUTAMENTO) {
      await verificarEPainel(
        client, guild, CONFIG.CANAL_TICKETS_RECRUTAMENTO,
        "recrutamento", sendPainelRecrutamento
      );
    }

    // ===== PAINEL DE REGRAS =====
    if (CONFIG.CANAL_REGRAS) {
      await verificarEPainel(
        client, guild, CONFIG.CANAL_REGRAS,
        "regras", sendPainelRegras
      );
    }

  } catch (err) {
    console.error("[Ready] Erro no auto-setup de paineis:", err.message);
  }
}

// ===== FUNÇÃO AUXILIAR: Verificar e enviar painel =====
async function verificarEPainel(client, guild, canalId, tipo, sendFn) {
  const canal = await guild.channels.fetch(canalId).catch(() => null);
  if (!canal) {
    console.warn(`[Ready] Canal ${tipo} não encontrado:`, canalId);
    return;
  }

  const painelId = db.painels?.[tipo];
  let painelExiste = false;
  let precisaReenviar = false;

  // 1. Verificar se a mensagem ainda existe
  if (painelId) {
    try {
      const msg = await canal.messages.fetch(painelId);
      if (msg) {
        painelExiste = true;

        // 2. Verificar se o conteúdo mudou (comparar hash)
        const embedAtual = msg.embeds[0];
        const componentsAtual = msg.components;
        if (embedAtual) {
          const hashAtual = hashPainel(embedAtual, componentsAtual);
          const hashGuardado = db.painelsHash?.[tipo];

          if (hashGuardado && hashAtual !== hashGuardado) {
            console.log(`[Ready] Painel ${tipo} mudou de conteúdo. A reenviar...`);
            precisaReenviar = true;
            // Apagar a mensagem antiga
            await msg.delete().catch(() => {});
          } else {
            console.log(`[Ready] Painel ${tipo} já existe e está atualizado (ID: ${painelId})`);
          }
        }
      }
    } catch (e) {
      painelExiste = false;
      precisaReenviar = true;
      console.log(`[Ready] Painel ${tipo} anterior não encontrado (foi apagado)`);
    }
  } else {
    precisaReenviar = true;
  }

  // 3. Se não existe ou precisa reenviar, enviar novo
  if (!painelExiste || precisaReenviar) {
    // Apagar mensagens antigas do bot no canal (só as dos últimos 10)
    try {
      const msgs = await canal.messages.fetch({ limit: 10 });
      const botMsgs = msgs.filter(m => m.author.id === client.user.id);
      for (const msg of botMsgs.values()) {
        await msg.delete().catch(() => {});
      }
    } catch (e) {
      // ignorar erro
    }

    // Enviar novo painel
    const msg = await sendFn(canal);
    if (msg) {
      db.painels[tipo] = msg.id;

      // Guardar hash do novo painel
      const embedNovo = msg.embeds[0];
      const componentsNovo = msg.components;
      if (embedNovo) {
        db.painelsHash[tipo] = hashPainel(embedNovo, componentsNovo);
      }

      await saveDB();
      console.log(`[Ready] Painel ${tipo} enviado e guardado na DB (ID: ${msg.id})`);
    }
  }
}
