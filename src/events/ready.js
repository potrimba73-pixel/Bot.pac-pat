// ============================================================
// events/ready.js - Evento de Ready do Bot
// ============================================================

import { Events, EmbedBuilder } from "discord.js";
import { setExternalClient, setupExternalLogChannels } from "../services/externalLogs.js";
import { CONFIG } from "../config/index.js";
import { sendPainelGeral, sendPainelRecrutamento, sendPainelRegras } from "../services/panels.js";
import { db, saveDB } from "../utils/db.js";
import { startTruckyCron } from "./ready/truckyCron.js"; // ✅ ADICIONADO

// ============================================================
// CONSTANTES
// ============================================================
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000;

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export async function handleReady(client) {
  console.log(`[Ready] 🤖 Bot online: ${client.user.tag}`);
  console.log(`[Ready] 📊 Servidores: ${client.guilds.cache.size}`);
  console.log(`[Ready] 👥 Utilizadores: ${client.users.cache.size}`);

  // ===== PRESENÇA =====
  client.user.setPresence({
    activities: [{ 
      name: '/ajuda | Portugal Alfa Community', 
      type: 0,
      state: `📍 ${client.guilds.cache.size} servidores`
    }],
    status: 'online',
  });

  // ===== SETUP EXTERNAL LOGS =====
  setExternalClient(client);

  try {
    const externalGuild = await client.guilds.fetch(CONFIG.EXTERNAL_LOG_GUILD_ID).catch(() => null);
    if (externalGuild) {
      await setupExternalLogChannels(externalGuild);
      console.log("[Ready] ✅ Logs externos configurados");
    } else {
      console.warn("[Ready] ⚠️ Servidor externo de logs não encontrado.");
    }
  } catch (err) {
    console.error("[Ready] ❌ Erro no setup de canais externos:", err.message);
  }

  // ===== LIMPEZA DE TICKETS FANTASMAS =====
  console.log("[Ready] 🧹 A iniciar limpeza de tickets fantasmas...");
  await limparTicketsFantasma(client);

  // ===== AUTO-SETUP DOS PAINÉIS =====
  console.log("[Ready] 📋 A configurar painéis...");
  
  if (!db.painelsHash) {
    db.painelsHash = {};
    await saveDB();
  }

  const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
  if (!guild) {
    console.warn("[Ready] ⚠️ Servidor principal não encontrado. Verifica o CONFIG.GUILD_ID");
    return;
  }

  // ✅ Aguardar inicialização completa do Discord
  await new Promise(r => setTimeout(r, 3000));

  // ✅ Configurar painéis com retry
  await setupPainelComRetry(client, guild, "geral", CONFIG.CANAL_TICKETS_GERAL, sendPainelGeral);
  await setupPainelComRetry(client, guild, "recrutamento", CONFIG.CANAL_TICKETS_RECRUTAMENTO, sendPainelRecrutamento);
  await setupPainelComRetry(client, guild, "regras", CONFIG.CANAL_REGRAS, sendPainelRegras);

  console.log("[Ready] ✅ Setup de painéis concluído!");

  // ===== INICIAR CRON DO TRUCKY =====
  try {
    await startTruckyCron(client);
    console.log("[Ready] ✅ Cron do Trucky iniciado");
  } catch (err) {
    console.error("[Ready] ❌ Erro ao iniciar cron do Trucky:", err.message);
  }

  // ===== LOG FINAL =====
  const stats = {
    tickets: Object.values(db.tickets).filter(t => !t.closed).length,
    acceptedRules: db.acceptedRules?.length || 0,
    guilds: client.guilds.cache.size,
  };

  console.log(`[Ready] 📊 Estatísticas: ${stats.tickets} tickets abertos, ${stats.acceptedRules} utilizadores com regras aceites`);
  console.log(`[Ready] ✅ Bot pronto para usar!`);
}

// ============================================================
// LIMPEZA DE TICKETS FANTASMAS
// ============================================================
async function limparTicketsFantasma(client) {
  if (!db.tickets || Object.keys(db.tickets).length === 0) {
    console.log("[Limpeza] ℹ️ Sem tickets na DB.");
    return;
  }

  let limpos = 0;
  const ticketsToClose = [];

  for (const [ticketId, ticket] of Object.entries(db.tickets)) {
    if (ticket.closed) continue;
    
    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel) {
      console.log(`[Limpeza] 🗑️ Ticket fantasma: ${ticketId} (canal ${ticket.channelId} não existe)`);
      
      ticketsToClose.push({
        id: ticketId,
        ticket: ticket
      });
    }
  }

  // ✅ Fechar tickets em lote
  for (const { id, ticket } of ticketsToClose) {
    ticket.closed = true;
    ticket.closedAt = new Date().toISOString();
    ticket.closedBy = "system";
    ticket.closedByName = "Limpeza Automática";
    limpos++;
  }

  if (limpos > 0) {
    await saveDB();
    console.log(`[Limpeza] ✅ ${limpos} tickets fantasmas limpos.`);
  } else {
    console.log("[Limpeza] ✅ Nenhum ticket fantasma encontrado.");
  }

  return limpos;
}

// ============================================================
// SETUP DE PAINEL COM RETRY
// ============================================================
async function setupPainelComRetry(client, guild, key, canalId, sendFn, attempt = 1) {
  try {
    const success = await setupPainel(client, guild, key, canalId, sendFn);
    
    if (success) {
      return true;
    }

    // ✅ Se falhou e ainda há tentativas, aguardar e tentar novamente
    if (attempt < MAX_RETRY_ATTEMPTS) {
      console.log(`[Ready] 🔄 Tentativa ${attempt + 1}/${MAX_RETRY_ATTEMPTS} para painel ${key}...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return setupPainelComRetry(client, guild, key, canalId, sendFn, attempt + 1);
    }

    console.warn(`[Ready] ⚠️ Painel ${key} não configurado após ${MAX_RETRY_ATTEMPTS} tentativas.`);
    return false;

  } catch (err) {
    console.error(`[Ready] ❌ Erro crítico ao configurar painel ${key}:`, err.message);
    
    if (attempt < MAX_RETRY_ATTEMPTS) {
      console.log(`[Ready] 🔄 Tentativa ${attempt + 1}/${MAX_RETRY_ATTEMPTS} para painel ${key}...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return setupPainelComRetry(client, guild, key, canalId, sendFn, attempt + 1);
    }
    
    return false;
  }
}

// ============================================================
// SETUP DE UM PAINEL INDIVIDUAL
// ============================================================
async function setupPainel(client, guild, key, canalId, sendFn) {
  try {
    // ✅ Buscar canal
    const channel = await client.channels.fetch(canalId).catch(() => null);
    if (!channel) {
      console.warn(`[Ready] ⚠️ Canal ${key} não encontrado: ${canalId}`);
      return false;
    }

    // ✅ Verificar permissões do bot no canal
    const botMember = await guild.members.fetch(client.user.id);
    const perms = channel.permissionsFor(botMember);
    
    if (!perms?.has(['ViewChannel', 'SendMessages', 'EmbedLinks', 'UseApplicationCommands'])) {
      console.warn(`[Ready] ⚠️ Bot sem permissões no canal ${key} (${canalId})`);
      return false;
    }

    // ===== PROCURAR PAINEL EXISTENTE =====
    let painelExistente = null;

    // ✅ Tentativa 1: messageId na DB
    const painelData = db.painelsHash?.[key];
    if (painelData?.messageId) {
      try {
        const msg = await channel.messages.fetch(painelData.messageId);
        if (msg && msg.author.id === client.user.id) {
          painelExistente = msg;
          console.log(`[Ready] ✅ Painel ${key} encontrado via DB (ID: ${msg.id}).`);
        }
      } catch (e) {
        console.log(`[Ready] ℹ️ Painel ${key} na DB não encontrado no Discord.`);
      }
    }

    // ✅ Tentativa 2: Procurar nas últimas mensagens do canal
    if (!painelExistente) {
      try {
        const messages = await channel.messages.fetch({ limit: 50 });
        const botMessages = messages.filter(m => 
          m.author.id === client.user.id && 
          (m.embeds?.length > 0 || m.components?.length > 0)
        );
        
        if (botMessages.size > 0) {
          painelExistente = botMessages.first();
          console.log(`[Ready] ✅ Painel ${key} encontrado via scan (ID: ${painelExistente.id}).`);

          // ✅ Atualizar DB com o ID encontrado
          db.painelsHash[key] = {
            messageId: painelExistente.id,
            sentAt: new Date().toISOString(),
          };
          await saveDB();
        }
      } catch (e) {
        console.log(`[Ready] ℹ️ Erro ao procurar painel ${key} no canal:`, e.message);
      }
    }

    // ✅ Se encontrou painel, verificar se está atualizado
    if (painelExistente) {
      // ✅ Verificar se o painel precisa de ser reenviado (ex: versão desatualizada)
      const needsUpdate = painelData?.version !== CONFIG.PANEL_VERSION;
      
      if (needsUpdate) {
        console.log(`[Ready] 🔄 Painel ${key} desatualizado. A reenviar...`);
        await painelExistente.delete().catch(() => {});
        painelExistente = null;
      } else {
        return true; // Painel encontrado e atualizado
      }
    }

    // ===== ENVIAR NOVO PAINEL =====
    console.log(`[Ready] 📤 Enviando novo painel ${key}...`);

    const msg = await sendFn(channel);

    // ✅ Guardar no DB
    db.painelsHash[key] = {
      messageId: msg.id,
      sentAt: new Date().toISOString(),
      version: CONFIG.PANEL_VERSION || "1.0.0",
    };
    await saveDB();

    console.log(`[Ready] ✅ Painel ${key} enviado! ID: ${msg.id}`);
    return true;

  } catch (err) {
    console.error(`[Ready] ❌ Erro ao configurar painel ${key}:`, err.message);
    return false;
  }
}

// ============================================================
// FUNÇÃO PARA REENVIAR TODOS OS PAINÉIS (FORÇADO)
// ============================================================
export async function reenviarTodosPainels(client) {
  console.log("[Ready] 🔄 A reenviar todos os painéis (forçado)...");

  const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
  if (!guild) {
    console.error("[Ready] ❌ Servidor principal não encontrado.");
    return false;
  }

  const paineis = [
    { key: "geral", canalId: CONFIG.CANAL_TICKETS_GERAL, sendFn: sendPainelGeral },
    { key: "recrutamento", canalId: CONFIG.CANAL_TICKETS_RECRUTAMENTO, sendFn: sendPainelRecrutamento },
    { key: "regras", canalId: CONFIG.CANAL_REGRAS, sendFn: sendPainelRegras },
  ];

  let success = 0;
  let failed = 0;

  for (const { key, canalId, sendFn } of paineis) {
    try {
      // ✅ Apagar painel antigo
      const oldData = db.painelsHash?.[key];
      if (oldData?.messageId) {
        try {
          const channel = await client.channels.fetch(canalId);
          const msg = await channel.messages.fetch(oldData.messageId);
          await msg.delete().catch(() => {});
          console.log(`[Ready] 🗑️ Painel ${key} antigo removido`);
        } catch (e) {
          // Ignorar se não encontrar
        }
      }

      // ✅ Enviar novo
      const channel = await client.channels.fetch(canalId);
      const msg = await sendFn(channel);
      
      db.painelsHash[key] = {
        messageId: msg.id,
        sentAt: new Date().toISOString(),
        version: CONFIG.PANEL_VERSION || "1.0.0",
      };
      await saveDB();
      
      success++;
      console.log(`[Ready] ✅ Painel ${key} reenviado!`);
    } catch (err) {
      failed++;
      console.error(`[Ready] ❌ Erro ao reenviar painel ${key}:`, err.message);
    }

    // ✅ Pequeno delay entre envios
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[Ready] 📊 Painéis reenviados: ${success} sucesso, ${failed} falhas`);
  return success > 0;
}

// ============================================================
// FUNÇÃO DE VALIDAÇÃO DOS PAINÉIS
// ============================================================
export async function validarPainels(client) {
  console.log("[Ready] 🔍 A validar painéis...");

  const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
  if (!guild) {
    console.error("[Ready] ❌ Servidor principal não encontrado.");
    return false;
  }

  const paineis = [
    { key: "geral", canalId: CONFIG.CANAL_TICKETS_GERAL },
    { key: "recrutamento", canalId: CONFIG.CANAL_TICKETS_RECRUTAMENTO },
    { key: "regras", canalId: CONFIG.CANAL_REGRAS },
  ];

  let validos = 0;
  let invalidos = 0;

  for (const { key, canalId } of paineis) {
    const data = db.painelsHash?.[key];
    if (!data?.messageId) {
      console.log(`[Ready] ❌ Painel ${key} não registado na DB`);
      invalidos++;
      continue;
    }

    try {
      const channel = await client.channels.fetch(canalId);
      const msg = await channel.messages.fetch(data.messageId);
      
      if (msg && msg.author.id === client.user.id) {
        console.log(`[Ready] ✅ Painel ${key} válido (ID: ${msg.id})`);
        validos++;
      } else {
        console.log(`[Ready] ❌ Painel ${key} inválido (mensagem não encontrada ou de outro autor)`);
        invalidos++;
      }
    } catch (e) {
      console.log(`[Ready] ❌ Painel ${key} inválido: ${e.message}`);
      invalidos++;
    }
  }

  console.log(`[Ready] 📊 Validação: ${validos} válidos, ${invalidos} inválidos`);
  return invalidos === 0;
}
