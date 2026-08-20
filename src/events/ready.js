// ============================================================
// events/ready.js - Evento de Ready do Bot
// ============================================================

import {
  setExternalClient,
  setupExternalLogChannels,
} from "../services/externalLogs.js";

import { CONFIG } from "../config/index.js";

import {
  sendPainelGeral,
  sendPainelRecrutamento,
  sendPainelRegras,
} from "../services/panels.js";

import { db, saveDB } from "../utils/db.js";
import { startTruckyCron } from "./ready/truckyCron.js";
import { MessageAnalyzer } from "../assistant/analyzer.js";

// ============================================================
// CONSTANTES
// ============================================================

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000;

const PANEL_SCAN_LIMIT = 50;
const TICKET_CLEANUP_CONCURRENCY = 10;

const READY_DELAY = 3000;

const DEFAULT_PANEL_VERSION = "1.0.0";

// ============================================================
// ESTADO
// ============================================================

let readyInitializing = false;
let readyInitialized = false;
let truckyCronStarted = false;

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

export async function handleReady(client) {
  if (!client?.user) {
    console.error("[Ready] ❌ Cliente inválido ou ainda não autenticado.");
    return;
  }

  console.log("============================================================");
  console.log(`[Ready] 🤖 Bot online: ${client.user.tag}`);
  console.log(`[Ready] 📊 Servidores: ${client.guilds.cache.size}`);
  console.log(`[Ready] 👥 Utilizadores: ${client.users.cache.size}`);
  console.log("============================================================");

  // ----------------------------------------------------------
  // PROTEÇÃO CONTRA DUPLA INICIALIZAÇÃO
  // ----------------------------------------------------------

  if (readyInitialized) {
    console.log(
      "[Ready] ℹ️ Sistema já inicializado. Ignorando duplicação."
    );

    return;
  }

  if (readyInitializing) {
    console.log(
      "[Ready] ℹ️ Sistema já está a ser inicializado. Ignorando duplicação."
    );

    return;
  }

  readyInitializing = true;

  try {
    // --------------------------------------------------------
    // ANALYZER
    // --------------------------------------------------------

    await inicializarAnalyzer(client);

    // --------------------------------------------------------
    // PRESENÇA
    // --------------------------------------------------------

    configurarPresenca(client);

    // --------------------------------------------------------
    // EXTERNAL LOGS
    // --------------------------------------------------------

    await setupExternalLogs(client);

    // --------------------------------------------------------
    // LIMPEZA DE TICKETS FANTASMAS
    // --------------------------------------------------------

    console.log(
      "[Ready] 🧹 A iniciar limpeza de tickets fantasmas..."
    );

    try {
      await limparTicketsFantasma(client);
    } catch (err) {
      console.error(
        "[Ready] ❌ Erro na limpeza de tickets:",
        err?.message || err
      );
    }

    // --------------------------------------------------------
    // INICIALIZAÇÃO DA DB DOS PAINÉIS
    // --------------------------------------------------------

    await garantirEstruturaPainels();

    // --------------------------------------------------------
    // AGUARDAR ESTABILIZAÇÃO
    // --------------------------------------------------------

    console.log(
      `[Ready] ⏳ A aguardar ${READY_DELAY / 1000}s para estabilização...`
    );

    await delay(READY_DELAY);

    // --------------------------------------------------------
    // SERVIDOR PRINCIPAL
    // --------------------------------------------------------

    const guild = await obterGuildPrincipal(client);

    if (!guild) {
      console.warn(
        "[Ready] ⚠️ Servidor principal não encontrado. " +
        "Verifica CONFIG.GUILD_ID."
      );
    } else {
      await configurarTodosPainels(client, guild);
    }

    // --------------------------------------------------------
    // TRUCKY CRON
    // --------------------------------------------------------

    await inicializarTruckyCron(client);

    // --------------------------------------------------------
    // ESTATÍSTICAS
    // --------------------------------------------------------

    mostrarEstatisticas(client);

    // --------------------------------------------------------
    // CONCLUSÃO
    // --------------------------------------------------------

    readyInitialized = true;

    console.log("============================================================");
    console.log("[Ready] ✅ Bot pronto para usar!");
    console.log("============================================================");
  } catch (err) {
    console.error(
      "[Ready] ❌ Erro fatal durante a inicialização:",
      err?.message || err
    );

    console.error(err);
  } finally {
    readyInitializing = false;
  }
}

// ============================================================
// ANALYZER
// ============================================================

async function inicializarAnalyzer(client) {
  try {
    if (client.messageAnalyzer) {
      console.log(
        "[Ready] ℹ️ MessageAnalyzer já estava inicializado."
      );

      return true;
    }

    client.messageAnalyzer = new MessageAnalyzer(client);

    console.log(
      "[Ready] ✅ MessageAnalyzer inicializado."
    );

    return true;
  } catch (err) {
    console.error(
      "[Ready] ❌ Erro ao inicializar MessageAnalyzer:",
      err?.message || err
    );

    return false;
  }
}

// ============================================================
// PRESENÇA
// ============================================================

function configurarPresenca(client) {
  try {
    client.user.setPresence({
      activities: [
        {
          name: "/ajuda | Portugal Alfa Community",
          type: 0,
          state: "Euro Truck Simulator 2",
        },
      ],
      status: "online",
    });

    console.log("[Ready] ✅ Presença configurada.");

    return true;
  } catch (err) {
    console.error(
      "[Ready] ❌ Erro ao configurar presença:",
      err?.message || err
    );

    return false;
  }
}

// ============================================================
// EXTERNAL LOGS
// ============================================================

async function setupExternalLogs(client) {
  try {
    setExternalClient(client);

    if (!CONFIG.EXTERNAL_LOG_GUILD_ID) {
      console.warn(
        "[Ready] ⚠️ EXTERNAL_LOG_GUILD_ID não configurado."
      );

      return false;
    }

    const externalGuild = await client.guilds
      .fetch(CONFIG.EXTERNAL_LOG_GUILD_ID)
      .catch(() => null);

    if (!externalGuild) {
      console.warn(
        "[Ready] ⚠️ Servidor externo de logs não encontrado."
      );

      return false;
    }

    await setupExternalLogChannels(externalGuild);

    console.log(
      "[Ready] ✅ Logs externos configurados."
    );

    return true;
  } catch (err) {
    console.error(
      "[Ready] ❌ Erro no setup dos canais externos:",
      err?.message || err
    );

    return false;
  }
}

// ============================================================
// DB DOS PAINÉIS
// ============================================================

async function garantirEstruturaPainels() {
  if (
    !db.painelsHash ||
    typeof db.painelsHash !== "object" ||
    Array.isArray(db.painelsHash)
  ) {
    db.painelsHash = {};

    await saveDB();

    console.log(
      "[Ready] 💾 Estrutura de painéis criada na DB."
    );

    return;
  }

  console.log(
    "[Ready] 💾 Estrutura de painéis carregada."
  );
}

// ============================================================
// GUILD PRINCIPAL
// ============================================================

async function obterGuildPrincipal(client) {
  if (!CONFIG.GUILD_ID) {
    console.error(
      "[Ready] ❌ CONFIG.GUILD_ID não está configurado."
    );

    return null;
  }

  return client.guilds
    .fetch(CONFIG.GUILD_ID)
    .catch((err) => {
      console.warn(
        "[Ready] ⚠️ Não foi possível obter o servidor principal:",
        err?.message || err
      );

      return null;
    });
}

// ============================================================
// CONFIGURAR TODOS OS PAINÉIS
// ============================================================

async function configurarTodosPainels(client, guild) {
  console.log(
    "[Ready] 📋 A configurar painéis..."
  );

  const paineis = [
    {
      key: "geral",
      canalId: CONFIG.CANAL_TICKETS_GERAL,
      sendFn: sendPainelGeral,
    },
    {
      key: "recrutamento",
      canalId: CONFIG.CANAL_TICKETS_RECRUTAMENTO,
      sendFn: sendPainelRecrutamento,
    },
    {
      key: "regras",
      canalId: CONFIG.CANAL_REGRAS,
      sendFn: sendPainelRegras,
    },
  ];

  let success = 0;
  let failed = 0;

  for (const painel of paineis) {
    const result = await setupPainelComRetry(
      client,
      guild,
      painel.key,
      painel.canalId,
      painel.sendFn
    );

    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(
    `[Ready] 📊 Setup de painéis: ${success} sucesso, ${failed} falhas.`
  );

  if (failed === 0) {
    console.log(
      "[Ready] ✅ Setup de painéis concluído!"
    );
  } else {
    console.warn(
      "[Ready] ⚠️ Alguns painéis não puderam ser configurados."
    );
  }
}

// ============================================================
// TRUCKY CRON
// ============================================================

async function inicializarTruckyCron(client) {
  try {
    if (truckyCronStarted) {
      console.log(
        "[Ready] ℹ️ Cron do Trucky já estava iniciado."
      );

      return true;
    }

    await startTruckyCron(client);

    truckyCronStarted = true;

    console.log(
      "[Ready] ✅ Cron do Trucky iniciado."
    );

    return true;
  } catch (err) {
    console.error(
      "[Ready] ❌ Erro ao iniciar cron do Trucky:",
      err?.message || err
    );

    return false;
  }
}

// ============================================================
// ESTATÍSTICAS
// ============================================================

function mostrarEstatisticas(client) {
  const stats = {
    tickets: Object.values(db.tickets || {}).filter(
      (ticket) => ticket && !ticket.closed
    ).length,

    acceptedRules: Array.isArray(db.acceptedRules)
      ? db.acceptedRules.length
      : 0,

    guilds: client.guilds.cache.size,

    panels: Object.keys(db.painelsHash || {}).length,
  };

  console.log("============================================================");
  console.log(`[Ready] 📊 Tickets abertos: ${stats.tickets}`);
  console.log(
    `[Ready] 📊 Regras aceites: ${stats.acceptedRules}`
  );
  console.log(`[Ready] 📊 Servidores: ${stats.guilds}`);
  console.log(`[Ready] 📊 Painéis registados: ${stats.panels}`);
  console.log("============================================================");
}

// ============================================================
// LIMPEZA DE TICKETS FANTASMAS
// ============================================================

async function limparTicketsFantasma(client) {
  const tickets = db.tickets;

  if (
    !tickets ||
    typeof tickets !== "object" ||
    Array.isArray(tickets)
  ) {
    console.log(
      "[Limpeza] ℹ️ Estrutura de tickets inválida ou inexistente."
    );

    return 0;
  }

  const ticketsAValidar = Object.entries(tickets).filter(
    ([, ticket]) => ticket && !ticket.closed
  );

  if (ticketsAValidar.length === 0) {
    console.log(
      "[Limpeza] ℹ️ Não existem tickets abertos para validar."
    );

    return 0;
  }

  let limpos = 0;

  const resultados = await processarEmLotes(
    ticketsAValidar,
    TICKET_CLEANUP_CONCURRENCY,
    async ([ticketId, ticket]) => {
      if (!ticket?.channelId) {
        console.warn(
          `[Limpeza] ⚠️ Ticket ${ticketId} não possui channelId.`
        );

        return {
          cleaned: false,
        };
      }

      const channel = await client.channels
        .fetch(ticket.channelId)
        .catch(() => null);

      if (channel) {
        return {
          cleaned: false,
        };
      }

      console.log(
        `[Limpeza] 🗑️ Ticket fantasma: ${ticketId} ` +
        `(canal ${ticket.channelId} não existe)`
      );

      ticket.closed = true;
      ticket.closedAt = new Date().toISOString();
      ticket.closedBy = "system";
      ticket.closedByName = "Limpeza Automática";

      return {
        cleaned: true,
      };
    }
  );

  limpos = resultados.filter(
    (result) => result?.cleaned === true
  ).length;

  if (limpos > 0) {
    await saveDB();

    console.log(
      `[Limpeza] ✅ ${limpos} tickets fantasmas limpos.`
    );
  } else {
    console.log(
      "[Limpeza] ✅ Nenhum ticket fantasma encontrado."
    );
  }

  return limpos;
}

// ============================================================
// PROCESSAMENTO EM LOTES
// ============================================================

async function processarEmLotes(
  items,
  concurrency,
  handler
) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const safeConcurrency = Math.max(
    1,
    Number(concurrency) || 1
  );

  const resultados = [];

  for (
    let i = 0;
    i < items.length;
    i += safeConcurrency
  ) {
    const lote = items.slice(
      i,
      i + safeConcurrency
    );

    const loteResultados = await Promise.all(
      lote.map(async (item) => {
        try {
          return await handler(item);
        } catch (err) {
          console.error(
            "[Ready] ❌ Erro ao processar item:",
            err?.message || err
          );

          return null;
        }
      })
    );

    resultados.push(...loteResultados);
  }

  return resultados;
}

// ============================================================
// SETUP DE PAINEL COM RETRY
// ============================================================

async function setupPainelComRetry(
  client,
  guild,
  key,
  canalId,
  sendFn,
  attempt = 1
) {
  try {
    const success = await setupPainel(
      client,
      guild,
      key,
      canalId,
      sendFn
    );

    if (success) {
      return true;
    }

    if (attempt >= MAX_RETRY_ATTEMPTS) {
      console.warn(
        `[Ready] ⚠️ Painel ${key} não configurado após ` +
        `${MAX_RETRY_ATTEMPTS} tentativas.`
      );

      return false;
    }

    console.log(
      `[Ready] 🔄 Tentativa ${attempt + 1}/` +
      `${MAX_RETRY_ATTEMPTS} para painel ${key}...`
    );

    await delay(RETRY_DELAY);

    return setupPainelComRetry(
      client,
      guild,
      key,
      canalId,
      sendFn,
      attempt + 1
    );
  } catch (err) {
    console.error(
      `[Ready] ❌ Erro crítico ao configurar painel ${key}:`,
      err?.message || err
    );

    if (attempt >= MAX_RETRY_ATTEMPTS) {
      return false;
    }

    console.log(
      `[Ready] 🔄 Tentativa ${attempt + 1}/` +
      `${MAX_RETRY_ATTEMPTS} para painel ${key}...`
    );

    await delay(RETRY_DELAY);

    return setupPainelComRetry(
      client,
      guild,
      key,
      canalId,
      sendFn,
      attempt + 1
    );
  }
}

// ============================================================
// SETUP DE UM PAINEL INDIVIDUAL
// ============================================================

async function setupPainel(
  client,
  guild,
  key,
  canalId,
  sendFn
) {
  try {
    // --------------------------------------------------------
    // VALIDAÇÃO DOS ARGUMENTOS
    // --------------------------------------------------------

    if (!key) {
      throw new Error("Chave do painel não definida.");
    }

    if (!canalId) {
      console.warn(
        `[Ready] ⚠️ Canal ${key} não configurado.`
      );

      return false;
    }

    if (typeof sendFn !== "function") {
      throw new Error(
        `sendFn do painel ${key} não é uma função válida.`
      );
    }

    // --------------------------------------------------------
    // BUSCAR CANAL
    // --------------------------------------------------------

    const channel = await client.channels
      .fetch(canalId)
      .catch(() => null);

    if (!channel) {
      console.warn(
        `[Ready] ⚠️ Canal ${key} não encontrado: ${canalId}`
      );

      return false;
    }

    // --------------------------------------------------------
    // GARANTIR QUE O CANAL PERTENCE À GUILD
    // --------------------------------------------------------

    if (
      channel.guildId &&
      String(channel.guildId) !== String(guild.id)
    ) {
      console.warn(
        `[Ready] ⚠️ Canal ${key} pertence a outro servidor.`
      );

      return false;
    }

    // --------------------------------------------------------
    // VERIFICAR PERMISSÕES
    // --------------------------------------------------------

    const botMember = await guild.members
      .fetch(client.user.id)
      .catch(() => null);

    if (!botMember) {
      console.warn(
        "[Ready] ⚠️ Não foi possível obter o membro do bot."
      );

      return false;
    }

    const perms = channel.permissionsFor(botMember);

    const requiredPermissions = [
      "ViewChannel",
      "SendMessages",
      "EmbedLinks",
    ];

    if (!perms?.has(requiredPermissions)) {
      console.warn(
        `[Ready] ⚠️ Bot sem permissões no canal ${key} (${canalId}).`
      );

      return false;
    }

    // --------------------------------------------------------
    // DADOS DA DB
    // --------------------------------------------------------

    const currentVersion =
      CONFIG.PANEL_VERSION || DEFAULT_PANEL_VERSION;

    const painelData =
      db.painelsHash?.[key];

    // --------------------------------------------------------
    // PROCURAR PAINEL EXISTENTE
    // --------------------------------------------------------

    let painelExistente = null;

    // --------------------------------------------------------
    // MÉTODO 1: MESSAGE ID NA DB
    // --------------------------------------------------------

    if (painelData?.messageId) {
      try {
        const msg = await channel.messages.fetch(
          painelData.messageId
        );

        if (
          msg &&
          msg.author?.id === client.user.id &&
          mensagemParecePainel(msg)
        ) {
          painelExistente = msg;

          console.log(
            `[Ready] ✅ Painel ${key} encontrado via DB ` +
            `(ID: ${msg.id}).`
          );
        }
      } catch {
        console.log(
          `[Ready] ℹ️ Painel ${key} registado na DB ` +
          "não foi encontrado no Discord."
        );
      }
    }

    // --------------------------------------------------------
    // MÉTODO 2: SCAN DO CANAL
    // --------------------------------------------------------

    if (!painelExistente) {
      try {
        const messages =
          await channel.messages.fetch({
            limit: PANEL_SCAN_LIMIT,
          });

        const botMessages =
          messages.filter(
            (message) =>
              message.author?.id === client.user.id &&
              mensagemParecePainel(message)
          );

        painelExistente =
          encontrarPainelPorKey(
            botMessages,
            key
          );

        if (painelExistente) {
          console.log(
            `[Ready] ✅ Painel ${key} encontrado via scan ` +
            `(ID: ${painelExistente.id}).`
          );

          db.painelsHash[key] = {
            messageId: painelExistente.id,
            sentAt:
              painelData?.sentAt ||
              new Date().toISOString(),
            version:
              painelData?.version ||
              currentVersion,
          };

          await saveDB();
        }
      } catch (err) {
        console.warn(
          `[Ready] ⚠️ Erro ao procurar painel ${key}:`,
          err?.message || err
        );
      }
    }

    // --------------------------------------------------------
    // VERIFICAR VERSÃO
    // --------------------------------------------------------

    if (painelExistente) {
      const savedVersion =
        db.painelsHash?.[key]?.version ||
        painelData?.version;

      const needsUpdate =
        savedVersion !== currentVersion;

      if (needsUpdate) {
        console.log(
          `[Ready] 🔄 Painel ${key} desatualizado ` +
          `(${savedVersion || "sem versão"} → ${currentVersion}).`
        );

        await painelExistente
          .delete()
          .catch(() => {});

        painelExistente = null;
      } else {
        console.log(
          `[Ready] ✅ Painel ${key} já está atualizado.`
        );

        return true;
      }
    }

    // --------------------------------------------------------
    // ENVIAR NOVO PAINEL
    // --------------------------------------------------------

    console.log(
      `[Ready] 📤 Enviando novo painel ${key}...`
    );

    const msg = await sendFn(channel);

    if (!msg?.id) {
      throw new Error(
        `sendFn do painel ${key} não retornou uma ` +
        "mensagem válida."
      );
    }

    // --------------------------------------------------------
    // GUARDAR NA DB
    // --------------------------------------------------------

    db.painelsHash[key] = {
      messageId: msg.id,
      sentAt: new Date().toISOString(),
      version: currentVersion,
    };

    await saveDB();

    console.log(
      `[Ready] ✅ Painel ${key} enviado! ID: ${msg.id}`
    );

    return true;
  } catch (err) {
    console.error(
      `[Ready] ❌ Erro ao configurar painel ${key}:`,
      err?.message || err
    );

    return false;
  }
}

// ============================================================
// VERIFICAR SE MENSAGEM PARECE SER UM PAINEL
// ============================================================

function mensagemParecePainel(message) {
  return Boolean(
    message &&
    (
      message.embeds?.length > 0 ||
      message.components?.length > 0
    )
  );
}

// ============================================================
// ENCONTRAR PAINEL POR IDENTIFICADOR
// ============================================================

function encontrarPainelPorKey(messages, key) {
  if (!messages || !key) {
    return null;
  }

  const possibleCustomIds = new Set([
    `painel_${key}`,
    `panel_${key}`,
    `ticket_${key}`,
    `tickets_${key}`,
  ]);

  for (const message of messages.values()) {
    for (const row of message.components || []) {
      for (const component of row.components || []) {
        if (
          component.customId &&
          possibleCustomIds.has(component.customId)
        ) {
          return message;
        }
      }
    }
  }

  return null;
}

// ============================================================
// REENVIAR TODOS OS PAINÉIS
// ============================================================

export async function reenviarTodosPainels(client) {
  console.log(
    "[Ready] 🔄 A reenviar todos os painéis (forçado)..."
  );

  const guild = await obterGuildPrincipal(client);

  if (!guild) {
    console.error(
      "[Ready] ❌ Servidor principal não encontrado."
    );

    return false;
  }

  const paineis = [
    {
      key: "geral",
      canalId: CONFIG.CANAL_TICKETS_GERAL,
      sendFn: sendPainelGeral,
    },
    {
      key: "recrutamento",
      canalId: CONFIG.CANAL_TICKETS_RECRUTAMENTO,
      sendFn: sendPainelRecrutamento,
    },
    {
      key: "regras",
      canalId: CONFIG.CANAL_REGRAS,
      sendFn: sendPainelRegras,
    },
  ];

  let success = 0;
  let failed = 0;

  const currentVersion =
    CONFIG.PANEL_VERSION || DEFAULT_PANEL_VERSION;

  for (const {
    key,
    canalId,
    sendFn,
  } of paineis) {
    try {
      if (!canalId) {
        throw new Error(
          `Canal não configurado para ${key}.`
        );
      }

      const channel =
        await client.channels.fetch(canalId);

      if (!channel) {
        throw new Error(
          `Canal não encontrado: ${canalId}`
        );
      }

      if (
        channel.guildId &&
        String(channel.guildId) !== String(guild.id)
      ) {
        throw new Error(
          `Canal ${key} pertence a outro servidor.`
        );
      }

      // ------------------------------------------------------
      // APAGAR PAINEL ANTIGO
      // ------------------------------------------------------

      const oldData =
        db.painelsHash?.[key];

      if (oldData?.messageId) {
        try {
          const oldMessage =
            await channel.messages.fetch(
              oldData.messageId
            );

          if (
            oldMessage.author?.id === client.user.id
          ) {
            await oldMessage.delete();

            console.log(
              `[Ready] 🗑️ Painel ${key} antigo removido.`
            );
          }
        } catch {
          console.log(
            `[Ready] ℹ️ Painel antigo ${key} já não existia.`
          );
        }
      }

      // ------------------------------------------------------
      // LIMPAR REFERÊNCIA ANTIGA
      // ------------------------------------------------------

      delete db.painelsHash[key];

      // ------------------------------------------------------
      // ENVIAR NOVO
      // ------------------------------------------------------

      const msg = await sendFn(channel);

      if (!msg?.id) {
        throw new Error(
          `Painel ${key} não retornou uma mensagem válida.`
        );
      }

      // ------------------------------------------------------
      // GUARDAR
      // ------------------------------------------------------

      db.painelsHash[key] = {
        messageId: msg.id,
        sentAt: new Date().toISOString(),
        version: currentVersion,
      };

      await saveDB();

      success++;

      console.log(
        `[Ready] ✅ Painel ${key} reenviado!`
      );
    } catch (err) {
      failed++;

      console.error(
        `[Ready] ❌ Erro ao reenviar painel ${key}:`,
        err?.message || err
      );
    }

    await delay(1000);
  }

  console.log(
    `[Ready] 📊 Painéis reenviados: ` +
    `${success} sucesso, ${failed} falhas.`
  );

  return failed === 0;
}

// ============================================================
// VALIDAR PAINÉIS
// ============================================================

export async function validarPainels(client) {
  console.log(
    "[Ready] 🔍 A validar painéis..."
  );

  const guild = await obterGuildPrincipal(client);

  if (!guild) {
    console.error(
      "[Ready] ❌ Servidor principal não encontrado."
    );

    return false;
  }

  const paineis = [
    {
      key: "geral",
      canalId: CONFIG.CANAL_TICKETS_GERAL,
    },
    {
      key: "recrutamento",
      canalId: CONFIG.CANAL_TICKETS_RECRUTAMENTO,
    },
    {
      key: "regras",
      canalId: CONFIG.CANAL_REGRAS,
    },
  ];

  let validos = 0;
  let invalidos = 0;

  const currentVersion =
    CONFIG.PANEL_VERSION || DEFAULT_PANEL_VERSION;

  for (const {
    key,
    canalId,
  } of paineis) {
    const data =
      db.painelsHash?.[key];

    if (!data?.messageId) {
      console.log(
        `[Ready] ❌ Painel ${key} não registado na DB.`
      );

      invalidos++;
      continue;
    }

    if (!canalId) {
      console.log(
        `[Ready] ❌ Canal do painel ${key} não configurado.`
      );

      invalidos++;
      continue;
    }

    try {
      const channel =
        await client.channels.fetch(canalId);

      if (!channel) {
        throw new Error(
          "Canal não encontrado."
        );
      }

      if (
        channel.guildId &&
        String(channel.guildId) !== String(guild.id)
      ) {
        throw new Error(
          "Canal pertence a outro servidor."
        );
      }

      const msg =
        await channel.messages.fetch(
          data.messageId
        );

      if (!msg) {
        throw new Error(
          "Mensagem não encontrada."
        );
      }

      if (
        msg.author?.id !== client.user.id
      ) {
        throw new Error(
          "Mensagem pertence a outro autor."
        );
      }

      if (!mensagemParecePainel(msg)) {
        throw new Error(
          "Mensagem não possui componentes ou embeds."
        );
      }

      const versionValid =
        data.version === currentVersion;

      if (!versionValid) {
        console.log(
          `[Ready] ⚠️ Painel ${key} encontrado, ` +
          `mas versão desatualizada ` +
          `(${data.version || "sem versão"} → ${currentVersion}).`
        );

        invalidos++;
        continue;
      }

      const identifiedPanel =
        encontrarPainelPorKey(
          new Map([[msg.id, msg]]),
          key
        );

      if (!identifiedPanel) {
        throw new Error(
          "Mensagem encontrada, mas o identificador do painel não foi encontrado."
        );
      }

      console.log(
        `[Ready] ✅ Painel ${key} válido ` +
        `(ID: ${msg.id}, versão: ${data.version}).`
      );

      validos++;
    } catch (err) {
      console.log(
        `[Ready] ❌ Painel ${key} inválido:`,
        err?.message || err
      );

      invalidos++;
    }
  }

  console.log(
    `[Ready] 📊 Validação: ${validos} válidos, ` +
    `${invalidos} inválidos.`
  );

  return invalidos === 0;
}

// ============================================================
// UTIL
// ============================================================

function delay(ms) {
  const safeMs = Math.max(
    0,
    Number(ms) || 0
  );

  return new Promise((resolve) => {
    setTimeout(resolve, safeMs);
  });
}
