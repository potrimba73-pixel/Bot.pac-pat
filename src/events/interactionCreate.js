// src/events/interactionCreate.js
import {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from "discord.js";

import {
  handleAjudaCommand,
  handleAjudaFeedback,
  handleAjudaProcurar,
  assistantMemory,
} from "../services/ajuda.js";

import { callPollinationsAI, callGeminiAI } from "../assistant/ets2AI.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import {
  createTicket,
  criarTicketRecrutamento,
  handleTruckyVerification,
  updateTicketEmbed,
  isClaiming,
  setClaiming,
  clearClaiming,
  findTicketByChannelId,
  getTicket,
} from "../services/tickets.js";
import { sendLog } from "../services/logs.js";
import {
  sendPainelChamada,
  criarCall,
  apagarCall,
  chamarMembro,
  addUserToCall,
  removeUserFromCall,
  handleAddUserModal,
  handleRemoveUserModal,
} from "../services/calls.js";
import { gerarTranscript } from "../utils/transcript.js";
import { salvarTranscriptSupabase } from "../utils/supabase.js";
import { formatDuration, getDurationEmoji } from "../utils/dateUtils.js";

// ============================================================
// CONSTANTES E CONFIGURAÇÕES
// ============================================================

const COOLDOWN_CHAMAR = 5 * 60 * 1000;
const cooldownChamadas = new Map();

const BOTS_TO_EXCLUDE = new Set([
  "1498462519818326117",
  "1516728761351929886",
  "1394063740755771453",
]);

const ticketLocks = new Map();
const closingTickets = new Set();

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

export function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageMessages)) return true;
  if (CONFIG.CARGO_STAFF && member.roles?.cache?.has(CONFIG.CARGO_STAFF)) return true;
  return false;
}

export async function safeReply(interaction, content, ephemeral = true) {
  try {
    if (interaction.deferred && !interaction.replied) {
      return await interaction.editReply({ content });
    }
    if (interaction.replied) {
      return await interaction.followUp({ content, flags: ephemeral ? 64 : 0 });
    }
    return await interaction.reply({ content, flags: ephemeral ? 64 : 0 });
  } catch {
    return null;
  }
}

export async function safeDefer(interaction) {
  try {
    if (!interaction.isRepliable()) {
      console.warn("[safeDefer] Interação não é repliable.");
      return false;
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
      return true;
    }
    return true;
  } catch (error) {
    if (error.code !== 10062) console.error("[safeDefer] Erro:", error);
    return false;
  }
}

export async function safeEdit(interaction, data) {
  try {
    if (interaction.deferred) return await interaction.editReply(data);
    if (interaction.replied) return await interaction.followUp({ ...data, flags: data.flags ?? 64 });
    return await interaction.reply({ ...data, flags: data.flags ?? 64 });
  } catch {
    return null;
  }
}

export async function persistDB() {
  try {
    await saveDB();
    return true;
  } catch (error) {
    console.error("[DB] Erro ao guardar:", error);
    return false;
  }
}

function getTicketForInteraction(ticketId, channelId) {
  console.log(`[getTicket] ticketId=${ticketId}, channelId=${channelId}`);
  if (ticketId) {
    const ticket = db.tickets?.[String(ticketId)];
    if (ticket && !ticket.closed) return ticket;
  }
  if (channelId) {
    const found = findTicketByChannelId(channelId);
    if (found) return found;
  }
  return null;
}

async function withTicketLock(ticketId, callback) {
  const key = String(ticketId);
  while (ticketLocks.has(key)) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  ticketLocks.set(key, true);
  try {
    return await callback();
  } finally {
    ticketLocks.delete(key);
  }
}

function isClosing(ticketId) { return closingTickets.has(String(ticketId)); }
function setClosing(ticketId) { closingTickets.add(String(ticketId)); }
function clearClosing(ticketId) { closingTickets.delete(String(ticketId)); }

// ============================================================
// FUNÇÕES DE STAFF E CHAMADA
// ============================================================

async function buildStaffList(channel, ticket) {
  await channel.guild.members.fetch().catch(() => null);
  const members = channel.members;
  if (!members || members.size === 0) return [];

  const staffList = [];
  const botId = CONFIG.BOT_ID_EXCLUIR || channel.client.user.id;

  for (const [memberId, member] of members) {
    if (member.user.bot) continue;
    if (BOTS_TO_EXCLUDE.has(memberId)) continue;
    if (memberId === botId) continue;

    const isStaffMember =
      member.permissions.has(PermissionFlagsBits.ManageMessages) ||
      member.roles.cache.has(CONFIG.CARGO_STAFF);
    if (!isStaffMember) continue;

    const highestRole = member.roles.cache.sort((a, b) => b.position - a.position).first();
    const roleName = highestRole?.name || "Staff";
    const presence = member.presence;
    let status = "offline";
    let statusEmoji = "⚫";
    if (presence) {
      const st = presence.status;
      if (st === "online") { status = "Online"; statusEmoji = "🟢"; }
      else if (st === "idle") { status = "Ausente"; statusEmoji = "🟡"; }
      else if (st === "dnd") { status = "Não perturbar"; statusEmoji = "🔴"; }
    }

    let roleEmoji = "🛡️";
    const lowerRole = roleName.toLowerCase();
    if (lowerRole.includes("fundador")) roleEmoji = "👑";
    else if (lowerRole.includes("administrador") || lowerRole.includes("admin")) roleEmoji = "🛡️";
    else if (lowerRole.includes("suporte") || lowerRole.includes("support")) roleEmoji = "🎫";
    else if (lowerRole.includes("moderador") || lowerRole.includes("mod")) roleEmoji = "🛠️";
    else if (lowerRole.includes("desenvolvedor") || lowerRole.includes("dev")) roleEmoji = "💻";

    staffList.push({
      member,
      rolePosition: highestRole?.position || 0,
      roleName,
      roleEmoji,
      displayName: member.displayName || member.user.username,
      username: member.user.username,
      status,
      statusEmoji,
    });
  }

  staffList.sort((a, b) => {
    if (b.rolePosition !== a.rolePosition) return b.rolePosition - a.rolePosition;
    return a.displayName.localeCompare(b.displayName);
  });

  return staffList;
}

async function chamarStaff(interaction, ticket, staffId) {
  try {
    const guild = interaction.guild;
    const staffMember = await guild.members.fetch(staffId).catch(() => null);
    if (!staffMember) {
      return safeReply(interaction, "❌ Staff não encontrado.");
    }

    cooldownChamadas.set(interaction.user.id, Date.now());

    const membro = interaction.user;
    const motivo = ticket.label || "Sem motivo especificado";
    const ticketLink = `https://discord.com/channels/${ticket.guildId}/${ticket.channelId}`;

    const embedDM = new EmbedBuilder()
      .setTitle("📢 Membro a Chamar!")
      .setDescription(
        `Olá <@${staffId}>!\n\n` +
        `👋 Um membro está a chamar-te no ticket **#${ticket.id}**.\n\n` +
        `📋 **Motivo:** ${motivo}\n` +
        `👤 **Membro:** <@${membro.id}> | \`${membro.username}\`\n\n` +
        `⚠️ **Importante:** Responde o mais breve possível!`
      )
      .setColor(0x00ff88)
      .setTimestamp()
      .setFooter({
        text: `Portugal Alfa Community 🚛 • ${new Date().toLocaleString("pt-PT")}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    const rowDM = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("🎫 Ir para o Ticket")
        .setStyle(ButtonStyle.Link)
        .setURL(ticketLink)
    );

    try {
      await staffMember.send({ embeds: [embedDM], components: [rowDM] });
    } catch (dmError) {
      console.warn(`[ChamarStaff] DM para ${staffId} falhou:`, dmError.message);
    }

    await interaction.channel.send({
      content: `<@${staffId}> foi chamado com sucesso no privado.`,
    });

    return safeReply(interaction, {
      content: `✅ Staff <@${staffId}> foi notificado (se tiver DMs abertas). Aguarde resposta.`,
      ephemeral: true,
    });

  } catch (error) {
    console.error("[ChamarStaff] Erro:", error);
    return safeReply(interaction, {
      content: `❌ Não foi possível chamar o staff: ${error.message || "Tente novamente mais tarde."}`,
      ephemeral: true,
    });
  }
}

// ============================================================
// PAINÉIS (Membro / Staff)
// ============================================================

async function enviarPainelMembro(interaction) {
  const deferred = await safeDefer(interaction);
  if (!deferred && !interaction.isRepliable()) {
    console.warn("[enviarPainelMembro] Interação não respondida.");
    return null;
  }
  return responderPainelMembro(interaction, deferred || interaction.deferred || interaction.replied);
}

async function responderPainelMembro(interaction, deferred = false) {
  const ticket = getTicketForInteraction(null, interaction.channelId);
  if (!ticket || ticket.closed) {
    const content = "⚠️ Ticket não encontrado ou já fechado.";
    return deferred ? interaction.editReply({ content }) : interaction.reply({ content, flags: 64 });
  }

  if (interaction.user.id !== ticket.userId) {
    const content = "❌ Apenas o utilizador que abriu o ticket pode chamar staff.";
    return deferred ? interaction.editReply({ content }) : interaction.reply({ content, flags: 64 });
  }

  const staffList = await buildStaffList(interaction.channel, ticket);
  if (staffList.length === 0) {
    const content = "⚠️ Nenhum membro da staff disponível para ser chamado.";
    return deferred ? interaction.editReply({ content }) : interaction.reply({ content, flags: 64 });
  }

  const now = Date.now();
  const lastCall = cooldownChamadas.get(interaction.user.id);
  if (lastCall && (now - lastCall) < COOLDOWN_CHAMAR) {
    const restante = Math.ceil((COOLDOWN_CHAMAR - (now - lastCall)) / 1000);
    const minutos = Math.floor(restante / 60);
    const segundos = restante % 60;
    const content = `⏱️ Aviso: Apenas 1 chamada permitida a cada 5 minutos. Aguarde **${minutos}m ${segundos}s**.`;
    return deferred ? interaction.editReply({ content }) : interaction.reply({ content, flags: 64 });
  }

  const desc = staffList.map((staff) =>
    `${staff.roleEmoji} **${staff.roleName}** • <@${staff.member.id}> | ${staff.displayName} • ${staff.statusEmoji} ${staff.status}`
  ).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🛡️ Painel Membro – Chamar Staff")
    .setDescription(
      `📋 Selecione um membro da staff para chamar:\n\n${desc}\n\n` +
      `⏱️ **Aviso:** Apenas 1 chamada permitida a cada 5 minutos.`
    )
    .setColor(0x2629F1)
    .setFooter({ text: `Ticket #${ticket.id}` })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`chamar_staff_${ticket.id}`)
    .setPlaceholder("🎯 Escolha um staff para chamar")
    .addOptions(
      staffList.map(staff => ({
        label: staff.displayName || staff.username,
        description: `${staff.roleName} • ${staff.status}`,
        value: staff.member.id,
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  if (deferred) {
    return await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    return await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
  }
}

async function enviarPainelStaff(interaction, client) {
  if (!(await safeDefer(interaction))) return;

  const ticket = getTicketForInteraction(null, interaction.channelId);
  if (!ticket) {
    return safeEdit(interaction, { content: "⚠️ Nenhum ticket ativo encontrado neste canal." });
  }

  try {
    return await sendPainelChamada(interaction.channel, ticket.id, interaction);
  } catch (error) {
    console.error("[PainelStaff] Erro:", error);
    return safeEdit(interaction, { content: "❌ Não foi possível abrir o painel de staff." });
  }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

export async function handleInteractionCreate(interaction, client) {
  try {
    if (interaction.isChatInputCommand()) {
      return await handleSlashCommand(interaction, client);
    }
    if (interaction.isModalSubmit()) {
      return await handleModalSubmit(interaction, client);
    }
    if (interaction.isStringSelectMenu()) {
      return await handleSelectMenu(interaction, client);
    }
    if (interaction.isButton()) {
      return await handleButton(interaction, client);
    }
  } catch (error) {
    console.error("[InteractionCreate] Erro não tratado:", error);
    try {
      await safeReply(interaction, "❌ Ocorreu um erro ao processar esta ação.");
    } catch {}
  }
}

// ============================================================
// SLASH COMMANDS
// ============================================================

async function handleSlashCommand(interaction, client) {
  const command = interaction.commandName;
  // 👇 ADICIONA 'ajuda' À LISTA PARA EVITAR DEFER
  const noDeferCommands = ['ajuda'];
  
  let deferred = false;
  if (!noDeferCommands.includes(command)) {
    deferred = await safeDefer(interaction);
    if (!deferred && interaction.isRepliable()) {
      await interaction.reply({ content: "❌ O bot está ocupado, tenta novamente.", flags: 64 });
      return;
    }
  }

  switch (command) {
    case "ajuda":
      return handleAjudaCommand(interaction, client);

    case "transcript":
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const ticket = getTicketForInteraction(null, interaction.channelId);
      if (!ticket) {
        return safeReply(interaction, "⚠️ Nenhum ticket ativo encontrado neste canal.");
      }
      return handleTranscriptCommand(interaction, ticket, client);

    case "painelmembro":
      return enviarPainelMembro(interaction);

    case "painelstaff":
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      return enviarPainelStaff(interaction, client);

    case "limpar":
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const { execute: limparExec } = await import("../commands/limpar.js");
      return limparExec(interaction, client);

    case "status":
      const { execute: statusExec } = await import("../commands/status.js");
      return statusExec(interaction, client);

    case "passar":
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const { execute: passarExec } = await import("../commands/passar.js");
      return passarExec(interaction, client);

    case "pedirassumo":
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const { execute: pedirAssumoExec } = await import("../commands/pedirassumo.js");
      return pedirAssumoExec(interaction, client);

    case "verificar-inatividade":
    case "minhas-cargas":
    case "estatisticas-vtc":
    case "atualizar-patentes":
    case "limpeza":
    case "mapa":
      const staffCommands = ["verificar-inatividade", "atualizar-patentes", "limpeza"];
      if (staffCommands.includes(command) && !isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const { handleTruckyCommand } = await import("../commands/truckyCommands.js");
      return handleTruckyCommand(interaction, client);

    case "gerar-foto":
    case "minha-foto":
    case "gerar-patente":
    case "verificar-templates":
      if (command === "gerar-patente" && !isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const { handleTruckyImageCommand } = await import("../commands/truckyImageCommands.js");
      return handleTruckyImageCommand(interaction);

    case "mapa-canal":
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const { handleMapaCanalCommand } = await import("../commands/truckyMapaCanal.js");
      return handleMapaCanalCommand(interaction, client);

    case "apagar":
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return safeReply(interaction, "❌ Apenas administradores podem usar este comando.");
      }
      const { execute: apagarExec } = await import("../commands/apagar.js");
      return apagarExec(interaction, client);

    case "transcript-full":
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const { handleTranscriptCommand: handleFullTranscript } = await import("../commands/transcript.js");
      return handleFullTranscript(interaction, client);

    case "apgrmsgbot":
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, "❌ Apenas staff pode usar este comando.");
      }
      const { execute: apgrmsgbotExec } = await import("../commands/apgrmsgbot.js");
      return apgrmsgbotExec(interaction, client);

    default:
      return safeReply(interaction, "⚠️ Comando não reconhecido.");
  }
}

// ============================================================
// MODALS
// ============================================================

async function handleModalSubmit(interaction, client) {
  const customId = interaction.customId;

  if (customId.startsWith("modal_trucky_")) {
    return handleTruckyVerification(interaction, client);
  }

  if (customId.startsWith("modal_ajuda_") && interaction.fields.fields.has("ajuda_especificacoes")) {
    const especificacoes = interaction.fields.getTextInputValue("ajuda_especificacoes")?.trim();
    interaction._ajudaEspecificacoes = especificacoes;
    return createTicket(interaction, "ajuda", "❓ Pedir ajuda", client);
  }

  if (customId.startsWith("modal_ajuda_") && interaction.fields.fields.has("pergunta_ajuda")) {
    const { handleAjudaModal } = await import("../services/ajuda.js");
    return handleAjudaModal(interaction, client);
  }

  if (customId.startsWith("modal_foto_trucky_")) {
    if (!(await safeDefer(interaction))) return;
    return handleFotoTruckyModal(interaction, client);
  }

  if (customId.startsWith("modal_add_user_")) {
    return handleAddUserModal(interaction, client);
  }
  if (customId.startsWith("modal_remove_user_")) {
    return handleRemoveUserModal(interaction, client);
  }

  if (customId.startsWith("modal_avaliacao_")) {
    return handleAvaliacaoModal(interaction, client);
  }

  console.warn(`[Modal] CustomId não reconhecido: ${customId}`);
}

// ============================================================
// SELECT MENUS
// ============================================================

async function handleSelectMenu(interaction, client) {
  if (interaction.customId.startsWith("chamar_staff_")) {
    const ticketId = interaction.customId.replace("chamar_staff_", "");
    const staffId = interaction.values[0];

    const ticket = getTicketForInteraction(ticketId, interaction.channelId);
    if (!ticket || ticket.closed) {
      return safeReply(interaction, "⚠️ Ticket não encontrado ou já fechado.");
    }
    if (interaction.user.id !== ticket.userId) {
      return safeReply(interaction, "❌ Apenas o dono do ticket pode chamar staff.");
    }

    const now = Date.now();
    const lastCall = cooldownChamadas.get(interaction.user.id);
    if (lastCall && (now - lastCall) < COOLDOWN_CHAMAR) {
      const restante = Math.ceil((COOLDOWN_CHAMAR - (now - lastCall)) / 1000);
      const minutos = Math.floor(restante / 60);
      const segundos = restante % 60;
      return safeReply(interaction, `⏳ Olá, para chamar novamente a staff espera **${minutos}m ${segundos}s**.`);
    }

    return chamarStaff(interaction, ticket, staffId);
  }

  if (interaction.customId === "ticket_geral") {
    const value = interaction.values[0];
    const labels = {
      bugs: "🐛 Bugs",
      denuncia: "🚨 Denuncia",
      suporte: "🔧 Suporte",
      criador: "🎥 Criador De Conteudo",
    };
    if (!labels[value]) {
      return safeReply(interaction, "❌ Categoria de ticket inválida.");
    }
    return createTicket(interaction, value, labels[value], client);
  }

  if (interaction.customId === "ticket_recruitamento") {
    const value = interaction.values[0];
    if (value === "recrutamento") {
      return createTicket(interaction, "recrutamento", "📝 Recrutamento PAT", client);
    }
    if (value === "ajuda") {
      const modal = new ModalBuilder()
        .setCustomId(`modal_ajuda_${interaction.user.id}_${Date.now()}`)
        .setTitle("❓ Especificações do Problema");

      const input = new TextInputBuilder()
        .setCustomId("ajuda_especificacoes")
        .setLabel("Descreve o teu problema ou dúvida")
        .setPlaceholder("Ex: Não consigo instalar o Trucky App...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      try {
        return await interaction.showModal(modal);
      } catch (error) {
        console.error("[Modal Ajuda] Erro:", error);
        return safeReply(interaction, "❌ Não foi possível abrir o formulário.");
      }
    }
  }

  console.warn(`[SelectMenu] CustomId não reconhecido: ${interaction.customId}`);
}

// ============================================================
// BUTTONS
// ============================================================

async function handleButton(interaction, client) {
  const customId = interaction.customId;
  console.log(`[Button] CustomId: ${customId}`);

  if (customId === "aceitar_regras") {
    return handleAceitarRegras(interaction);
  }

  if (customId.startsWith("aceitar_regras_rec_")) {
    const userId = customId.split("_")[3];
    if (interaction.user.id !== userId) {
      return safeReply(interaction, "⚠️ Este botão não está disponível para ti.");
    }
    return criarTicketRecrutamento(interaction, client, null);
  }

  if (customId.startsWith("recusar_regras_rec_")) {
    const userId = customId.split("_")[3];
    if (interaction.user.id !== userId) {
      return safeReply(interaction, "⚠️ Este botão não é para ti.");
    }
    try {
      return await interaction.update({
        content: "❌ Recrutamento cancelado. Se mudares de ideias, podes voltar a candidatar-te mais tarde.",
        embeds: [],
        components: [],
      });
    } catch {
      return null;
    }
  }

  if (customId.startsWith("assumir_")) {
    return handleAssumirTicket(interaction, client);
  }

  if (customId.startsWith("painel_membro_")) {
    return enviarPainelMembro(interaction);
  }

  if (customId.startsWith("sair_")) {
    return handleSairTicket(interaction, client);
  }

  if (customId.startsWith("deletar_")) {
    return handleFecharTicket(interaction, client);
  }

  if (customId.startsWith("recrutado_sim_")) {
    return handleRecrutadoSim(interaction, client);
  }
  if (customId.startsWith("recrutado_nao_")) {
    if (!isStaff(interaction.member)) {
      return safeReply(interaction, "❌ Apenas staff pode marcar como não recrutado.");
    }
    const ticketId = customId.substring("recrutado_nao_".length);
    return fecharTicket(interaction, ticketId, client, false);
  }

  if (customId.startsWith("fechar_definitivo_")) {
    if (!isStaff(interaction.member)) {
      return safeReply(interaction, "❌ Apenas staff pode fechar este ticket.");
    }
    const ticketId = customId.substring("fechar_definitivo_".length);
    return fecharTicket(interaction, ticketId, client, false);
  }

  if (customId.startsWith("avaliar_")) {
    return handleAvaliacaoButton(interaction);
  }

  if (customId === "ajuda_procurar") {
    return handleAjudaProcurar(interaction);
  }
  if (
    customId === "ajuda_ticket" ||
    customId.startsWith("ajuda_ticket_direct_") ||
    customId === "ajuda_faq" ||
    customId === "ajuda_nova" ||
    customId.startsWith("smart_helpful_") ||
    customId.startsWith("smart_not_helpful_")
  ) {
    return handleAjudaFeedback(interaction);
  }

  if (customId.startsWith("criar_call_")) {
    if (!isStaff(interaction.member)) return safeReply(interaction, "❌ Apenas staff pode criar calls.");
    const ticketId = customId.substring("criar_call_".length);
    return criarCall(interaction, ticketId, client);
  }
  if (customId.startsWith("apagar_call_")) {
    if (!isStaff(interaction.member)) return safeReply(interaction, "❌ Apenas staff pode apagar calls.");
    const ticketId = customId.substring("apagar_call_".length);
    return apagarCall(interaction, ticketId, client);
  }
  if (customId.startsWith("chamar_membro_")) {
    if (!isStaff(interaction.member)) return safeReply(interaction, "❌ Apenas staff pode chamar membros.");
    const ticketId = customId.substring("chamar_membro_".length);
    return chamarMembro(interaction, ticketId, client);
  }
  if (customId.startsWith("add_user_")) {
    if (!isStaff(interaction.member)) return safeReply(interaction, "❌ Apenas staff pode adicionar utilizadores.");
    const ticketId = customId.substring("add_user_".length);
    return addUserToCall?.(interaction, ticketId, client) || safeReply(interaction, "⏳ Funcionalidade em desenvolvimento.");
  }
  if (customId.startsWith("remove_user_")) {
    if (!isStaff(interaction.member)) return safeReply(interaction, "❌ Apenas staff pode remover utilizadores.");
    const ticketId = customId.substring("remove_user_".length);
    return removeUserFromCall?.(interaction, ticketId, client) || safeReply(interaction, "⏳ Funcionalidade em desenvolvimento.");
  }

  if (customId.startsWith("smart_search_") || customId.startsWith("smart_do_search_")) {
    return handleSmartSearch(interaction);
  }

  if (customId === "smart_cancel") {
    return safeReply(interaction, "👍 Pesquisa cancelada.");
  }

  console.warn(`[Button] CustomId não tratado: ${customId}`);
  return safeReply(interaction, "⚠️ Ação desconhecida.");
}

// ============================================================
// HANDLERS ESPECÍFICOS
// ============================================================

async function handleAceitarRegras(interaction) {
  if (!(await safeDefer(interaction))) return;

  const member = interaction.member;
  try {
    const cargos = [
      CONFIG.CARGO_MEMBRO,
      CONFIG.CARGO_REGRAS_EXTRA_1,
      CONFIG.CARGO_REGRAS_EXTRA_2,
      "1534970663344017479",
    ].filter(Boolean);

    for (const roleId of cargos) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(() => {});
      }
    }

    if (!db.acceptedRules) db.acceptedRules = [];
    if (!db.acceptedRules.includes(member.id)) db.acceptedRules.push(member.id);
    if (!db.acceptedRulesAt) db.acceptedRulesAt = {};
    db.acceptedRulesAt[member.id] = new Date().toISOString();

    await persistDB();

    return safeEdit(interaction, {
      content: "✅ Regras aceites com sucesso! Bem-vind@ à **Portugal Alfa Community** 🎉",
    });
  } catch (error) {
    console.error("[Regras] Erro:", error);
    return safeEdit(interaction, { content: "❌ Erro ao processar. Tenta novamente." });
  }
}

// ============================================================
// ASSUMIR TICKET (com log no canal de logs)
// ============================================================

async function handleAssumirTicket(interaction, client) {
  const ticketId = interaction.customId.substring("assumir_".length);
  if (!(await safeDefer(interaction))) return;
  if (!isStaff(interaction.member)) {
    return safeEdit(interaction, { content: "❌ Apenas staff pode assumir tickets." });
  }
  if (isClaiming(ticketId)) {
    return safeEdit(interaction, { content: "⏳ Outro membro da staff está a assumir este ticket." });
  }

  setClaiming(ticketId, interaction.user.id);
  try {
    const ticket = getTicketForInteraction(ticketId, interaction.channelId);
    if (!ticket || ticket.closed) {
      return safeEdit(interaction, { content: "⚠️ Ticket não encontrado ou já fechado." });
    }
    if (ticket.claimedBy) {
      return safeEdit(interaction, { content: `⚠️ Este ticket já foi assumido por <@${ticket.claimedBy}>.` });
    }

    await withTicketLock(ticket.id, async () => {
      const current = db.tickets[String(ticket.id)];
      if (!current || current.closed) throw new Error("TICKET_NOT_FOUND");
      if (current.claimedBy) throw new Error("TICKET_ALREADY_CLAIMED");
      current.claimedBy = interaction.user.id;
      current.claimedByName = interaction.user.username;
      current.claimedAt = new Date().toISOString();
      const saved = await persistDB();
      if (!saved) throw new Error("DB_SAVE_FAILED");
    });

    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel) {
      return safeEdit(interaction, { content: "❌ O canal deste ticket já não existe." });
    }

    await updateTicketEmbed(channel, ticket.id);
    await channel.send(
      `🎉 **Ticket assumido com sucesso!**\n\n👮 <@${interaction.user.id}> assumiu este ticket.\nSe precisares de chamar outro membro da staff, usa o **Painel Membro**.`
    );

    // ===== LOG NO CANAL DE LOGS =====
    try {
      const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
      if (logChannel) {
        const agora = new Date();
        const dataHora = agora.toLocaleString('pt-PT', {
          timeZone: 'Europe/Lisbon',
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const ticketLink = `https://discord.com/channels/${ticket.guildId}/${ticket.channelId}`;

        const embedLog = new EmbedBuilder()
          .setTitle(`⚒️ Staff que Assumiu — #${ticket.id}`)
          .setDescription(
            `👮 **Staff que Assumiu:**\n<@${interaction.user.id}> | \`${interaction.user.username}\`\n\n` +
            `🎫 **Ticket:** #${ticket.id}\n` +
            `📝 **Tipo:** ${ticket.label}\n` +
            `👤 **Utilizador:** <@${ticket.userId}> | \`${ticket.username}\`\n\n` +
            `🕑 **Horário:** ${dataHora}`
          )
          .setColor(0x2629F1)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("🎫 Ir para o Ticket")
            .setStyle(ButtonStyle.Link)
            .setURL(ticketLink)
        );

        await logChannel.send({ embeds: [embedLog], components: [row] });
      }
    } catch (e) {
      console.error("[AssumirTicket] Erro ao enviar log:", e.message);
    }

    return safeEdit(interaction, { content: "✅ Ticket assumido com sucesso!" });
  } catch (error) {
    console.error("[Assumir] Erro:", error);
    const msg = error.message === "TICKET_ALREADY_CLAIMED" ? "⚠️ Este ticket já foi assumido por outro membro da staff." :
                error.message === "TICKET_NOT_FOUND" ? "⚠️ Ticket não encontrado ou já fechado." :
                "❌ Ocorreu um erro ao assumir o ticket.";
    return safeEdit(interaction, { content: msg });
  } finally {
    clearClaiming(ticketId);
  }
}

async function handleSairTicket(interaction, client) {
  const ticketId = interaction.customId.substring("sair_".length);
  if (!(await safeDefer(interaction))) return;

  const ticket = getTicketForInteraction(ticketId, interaction.channelId);
  if (!ticket || ticket.closed) {
    return safeEdit(interaction, { content: "⚠️ Ticket não encontrado ou já fechado." });
  }
  if (ticket.userId !== interaction.user.id) {
    return safeEdit(interaction, { content: "⚠️ Só quem abriu o ticket pode sair." });
  }

  const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel) {
    return safeEdit(interaction, { content: "❌ O canal do ticket já não existe." });
  }

  try {
    await channel.permissionOverwrites.delete(interaction.user.id);
    return safeEdit(interaction, { content: "✅ Saíste do ticket com sucesso." });
  } catch {
    return safeEdit(interaction, { content: "❌ Não consegui remover o teu acesso ao ticket." });
  }
}

async function handleFecharTicket(interaction, client) {
  const ticketId = interaction.customId.substring("deletar_".length);
  if (!(await safeDefer(interaction))) return;
  if (!isStaff(interaction.member)) {
    return safeEdit(interaction, { content: "❌ Apenas staff pode fechar tickets." });
  }

  const ticket = getTicketForInteraction(ticketId, interaction.channelId);
  if (!ticket || ticket.closed) {
    return safeEdit(interaction, { content: "⚠️ Ticket não encontrado ou já fechado." });
  }

  if (ticket.type === "recrutamento") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`recrutado_sim_${ticket.id}`)
        .setLabel("🎉 Sim - Recrutado")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`recrutado_nao_${ticket.id}`)
        .setLabel("😔 Não - Não Recrutado")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`fechar_definitivo_${ticket.id}`)
        .setLabel("🔒 Fechar Definitivo")
        .setStyle(ButtonStyle.Secondary)
    );
    return safeEdit(interaction, { content: "❓ **O candidato foi recrutado?**", components: [row] });
  }

  return fecharTicket(interaction, ticketId, client, false);
}

async function handleRecrutadoSim(interaction, client) {
  const ticketId = interaction.customId.substring("recrutado_sim_".length);
  if (!isStaff(interaction.member)) {
    return safeReply(interaction, "❌ Apenas staff pode confirmar o recrutamento.");
  }

  const ticket = getTicketForInteraction(ticketId, interaction.channelId);
  if (!ticket || ticket.closed) {
    return safeReply(interaction, "⚠️ Ticket não encontrado ou já fechado.");
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_foto_trucky_${ticket.id}`)
    .setTitle("🎉 Nome da Foto do Trucky");

  const input = new TextInputBuilder()
    .setCustomId("foto_nome")
    .setLabel("Nome da tua foto de perfil do Trucky")
    .setPlaceholder("Ex: Diego")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  try {
    return await interaction.showModal(modal);
  } catch {
    return safeReply(interaction, "❌ Não foi possível abrir o modal.");
  }
}

async function handleAvaliacaoButton(interaction) {
  const parts = interaction.customId.split("_");
  const ticketId = parts[1];
  const estrelas = Number(parts[2]);

  const ticket = db.tickets?.[String(ticketId)];
  if (!ticket) {
    return safeReply(interaction, "⚠️ Ticket não encontrado.");
  }
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) {
    return safeReply(interaction, "⚠️ Avaliação inválida.");
  }
  if (ticket.rating !== null && ticket.rating !== undefined) {
    return safeReply(interaction, `⚠️ Já avaliaste este ticket com ${"⭐".repeat(ticket.rating)} (${ticket.rating}/5).`);
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_avaliacao_${ticketId}_${estrelas}`)
    .setTitle(`Avaliação - ${estrelas} ⭐`);

  const input = new TextInputBuilder()
    .setCustomId("avaliacao_comentario")
    .setLabel("Escreve a tua opinião (opcional)")
    .setPlaceholder("Ex: Atendimento excelente!")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  try {
    return await interaction.showModal(modal);
  } catch (error) {
    console.error("[Avaliação Modal] Erro:", error);
    return safeReply(interaction, "❌ Não foi possível abrir o formulário de avaliação.");
  }
}

async function handleSmartSearch(interaction) {
  const parts = interaction.customId.split("_");
  const messageId = parts[2];
  const pending = assistantMemory.pendingSearches?.get(messageId);
  if (!pending) {
    return safeReply(interaction, "❓ Não encontrei a pergunta associada. Tenta novamente.");
  }

  const question = pending.question;
  await safeDefer(interaction);

  try {
    let answer = await callPollinationsAI(question) || await callGeminiAI(question);
    if (answer) {
      const embed = new EmbedBuilder()
        .setTitle("🤖 Resultado da pesquisa")
        .setDescription(answer)
        .setColor(0x3498db)
        .setFooter({ text: "Fonte: IA externa" })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({
        content: `🔍 Não consegui encontrar uma resposta para: "${question}"\n\nTenta reformular ou abre um ticket.`
      });
    }
  } catch (err) {
    console.error("[SmartSearch] Erro:", err);
    await interaction.editReply({ content: "❌ Erro ao pesquisar. Tenta mais tarde." });
  }

  assistantMemory.pendingSearches?.delete(messageId);
}

// ============================================================
// AVALIAÇÃO MODAL (handler) - SEM COMENTÁRIO NA RESPOSTA AO UTILIZADOR
// ============================================================

async function handleAvaliacaoModal(interaction, client) {
  const parts = interaction.customId.split("_");
  const ticketId = parts[2];
  const estrelas = parseInt(parts[3]);

  const comentario = interaction.fields.getTextInputValue("avaliacao_comentario")?.trim() || "Sem comentário";

  const ticket = db.tickets?.[String(ticketId)];
  if (!ticket) {
    return safeReply(interaction, "⚠️ Ticket não encontrado.");
  }
  if (ticket.rating !== null && ticket.rating !== undefined) {
    return safeReply(interaction, `⚠️ Já avaliaste este ticket com ${"⭐".repeat(ticket.rating)} (${ticket.rating}/5).`);
  }

  ticket.rating = estrelas;
  ticket.ratingComment = comentario;
  await persistDB();

  // Buscar quem atendeu o ticket (staff que assumiu ou fechou)
  const staffAtendeu = ticket.claimedByName || ticket.closedByName || "Staff";
  const staffId = ticket.claimedBy || ticket.closedBy;

  try {
    const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
    if (logChannel) {
      const stars = "⭐".repeat(estrelas) + "☆".repeat(5 - estrelas);
      
      const agora = new Date();
      const dataHora = agora.toLocaleString('pt-PT', {
        timeZone: 'Europe/Lisbon',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const embed = new EmbedBuilder()
        .setTitle("Portugal Alfa Community - Avaliação Recebida")
        .setDescription(
          `👤 **Utilizador:**\n<@${interaction.user.id}> | \`${interaction.user.username}\`\n\n` +
          `🎫 **Ticket:**\n\`#${ticket.id}\` (${ticket.label})\n\n` +
          `⭐️ **Avaliação:**\n\`${stars}\` (${estrelas}/5)\n\n` +
          `${staffId ? `⚒️ **Atendido por**\n<@${staffId}>\n\n` : ''}` +
          `🖊️ **Mensagem**\n\`${comentario}\`\n\n` +
          `🕜 **Horário:** ${dataHora}`
        )
        .setColor(0x2629F1)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error("[Avaliação] Erro ao enviar log:", e.message);
  }

  const stars = "⭐".repeat(estrelas) + "☆".repeat(5 - estrelas);
  // Resposta completa após avaliação (sem chamada para avaliar novamente)
  const now = new Date();
  const dataHoraFinal = now.toLocaleString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const staffName = ticket.closedByName || interaction.user.username;

  const mensagemFinal =
    `✅ **Obrigado pela tua avaliação!**\n\n` +
    `Avaliação: ${stars} (${estrelas}/5)\n\n` +
    `🎫 **Ticket Fechado**\n` +
    `ℹ️ O seu ticket foi fechado com sucesso!\n\n` +
    `🎫 **Ticket:** #${ticket.id}\n` +
    `📝 **Tipo:** ${ticket.label}\n\n` +
    `⚒️ **Fechado por:** ${staffName}\n` +
    `🕚 **Fechado em:** ${dataHoraFinal}\n\n` +
    `🎫 Caso seja necessário, não hesite em abrir um novo ticket!`;

  try {
    await interaction.update({
      content: mensagemFinal,
      components: [],
    });
  } catch {
    await safeReply(interaction, {
      content: mensagemFinal,
      ephemeral: true,
    });
  }
}

// ============================================================
// FOTO TRUCKY (recrutamento concluído)
// ============================================================

async function handleFotoTruckyModal(interaction, client) {
  if (!isStaff(interaction.member)) {
    return safeEdit(interaction, { content: "❌ Apenas staff pode completar o recrutamento." });
  }

  const ticketId = interaction.customId.replace("modal_foto_trucky_", "");
  if (isClosing(ticketId)) {
    return safeEdit(interaction, { content: "⏳ Este ticket já está a ser fechado." });
  }

  setClosing(ticketId);
  try {
    const ticket = getTicketForInteraction(ticketId, interaction.channelId);
    if (!ticket || ticket.closed || ticket.recrutado) {
      return safeEdit(interaction, { content: "⚠️ Ticket não encontrado, já fechado ou já recrutado." });
    }

    let fotoNome = interaction.fields.getTextInputValue("foto_nome")?.trim() || "Não informado";
    fotoNome = fotoNome.replace(/\.[^/.]+$/, "");

    await withTicketLock(ticket.id, async () => {
      const current = db.tickets[String(ticket.id)];
      if (!current || current.closed || current.recrutado) throw new Error("INVALID_STATE");
      current.fotoNome = fotoNome;
      current.recrutado = true;
      current.closed = true;
      current.closedBy = interaction.user.id;
      current.closedByName = interaction.user.username;
      current.closedAt = new Date().toISOString();
      const saved = await persistDB();
      if (!saved) throw new Error("DB_SAVE_FAILED");
    });

    const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(ticket.userId).catch(() => null);
      if (member) {
        const roles = [CONFIG.CARGO_RECRUTADO, CONFIG.CARGO_RECRUTAMENTO_1].filter(Boolean);
        for (const roleId of roles) {
          const role = guild.roles.cache.get(roleId);
          if (role) await member.roles.add(role).catch(() => {});
        }
      }
    }

    if (CONFIG.CANAL_GERAL) {
      const canalGeral = await client.channels.fetch(CONFIG.CANAL_GERAL).catch(() => null);
      if (canalGeral) {
        await canalGeral.send(
          `🎉 **Bem-vindo a Portugal Alfa Truckers!**\n\nParabéns <@${ticket.userId}>! Foste recrutado com sucesso.\n\n🚛 Segue as regras em <#1200170228093550712> e diverte-te com bons quilómetros!`
        ).catch(() => {});
      }
    }

    await sendLog(ticket.id, "close", client).catch(() => {});

    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎉 Recrutamento concluído")
            .setDescription(
              `✅ <@${ticket.userId}> foi recrutado com sucesso!\n\n📸 Foto do Trucky: **${fotoNome}**\n\n👮 Processado por: ${interaction.user.username}`
            )
            .setColor(0x00ff00),
        ],
      }).catch(() => {});
      setTimeout(() => channel.delete().catch(() => {}), 10000);
    }

    return safeEdit(interaction, {
      content: `✅ Utilizador recrutado com sucesso!\n📸 Foto do Trucky: **${fotoNome}**\n🗑️ O ticket será apagado em 10 segundos.`,
    });
  } catch (error) {
    console.error("[Recrutamento] Erro:", error);
    return safeEdit(interaction, { content: "❌ Ocorreu um erro ao concluir o recrutamento." });
  } finally {
    clearClosing(ticketId);
  }
}

// ============================================================
// FECHAR TICKET (COM TRANSCRIPT, AVALIAÇÃO E LOG MELHORADO E UNIFICADO)
// ============================================================

async function fecharTicket(interaction, ticketId, client, recrutado = false) {
  if (isClosing(ticketId)) {
    return safeReply(interaction, "⏳ Este ticket já está a ser fechado.");
  }

  setClosing(ticketId);

  let evaluationSent = false;
  let transcriptResult = null;
  let ticket = null;

  try {
    ticket = getTicketForInteraction(ticketId, interaction.channelId);
    if (!ticket || ticket.closed) {
      return safeReply(interaction, "⚠️ Ticket não encontrado ou já fechado.");
    }

    await withTicketLock(ticket.id, async () => {
      const current = db.tickets[String(ticket.id)];
      if (!current || current.closed) throw new Error("ALREADY_CLOSED");
      current.closed = true;
      current.recrutado = recrutado;
      current.closedBy = interaction.user.id;
      current.closedByName = interaction.user.username;
      current.closedAt = new Date().toISOString();
      const saved = await persistDB();
      if (!saved) throw new Error("DB_SAVE_FAILED");
    });

    await sendLog(ticket.id, "close", client).catch(() => {});

    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel) {
      return safeReply(interaction, "❌ O canal do ticket já não existe.");
    }

    // Embed de fecho no canal do ticket
    const duracao = formatDuration(ticket.openedAt, new Date());
    const duracaoEmoji = getDurationEmoji(ticket.openedAt, new Date());

    let desc = `🔴 **Ticket Fechado**\n\nEste ticket foi encerrado por <@${interaction.user.id}>.\n\n`;
    desc += `📁 **Informações:**\n• **Aberto por:** <@${ticket.userId}>\n• **Motivo:** ${ticket.label}\n\n`;
    desc += `${duracaoEmoji} **Duração:** ${duracao}\n\n⏳ Este canal será eliminado automaticamente em **5 segundos**...`;

    const embedFecho = new EmbedBuilder().setDescription(desc).setColor(0xFF0000).setTimestamp();
    await channel.send({ embeds: [embedFecho] }).catch(() => {});

    // --- GERAR TRANSCRIPT ---
    try {
      const additionalInfo = {
        openedBy: ticket.username,
        openedAt: ticket.openedAt ? new Date(ticket.openedAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }) : "—",
        closedBy: interaction.user.username,
        closedAt: new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }),
        claimedBy: ticket.claimedByName || null,
        ticketLabel: ticket.label,
        duration: duracao,
        evaluationSent: undefined,
        evaluation: ticket.rating ? "⭐".repeat(ticket.rating) + "☆".repeat(5 - ticket.rating) : undefined,
        evaluationComment: ticket.ratingComment || undefined,
        recrutado: ticket.type === "recrutamento" ? recrutado : undefined,
        fotoNome: ticket.fotoNome || undefined,
      };

      transcriptResult = await gerarTranscript(channel, ticket.id, additionalInfo);

      if (transcriptResult) {
        // Enviar para logs
        const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
        if (logChannel) {
          const embedLog = new EmbedBuilder()
            .setTitle(`📋 Transcript do Ticket #${ticket.id}`)
            .setDescription(
              `**Ticket:** #${ticket.id}\n**Tipo:** ${ticket.label}\n**Aberto por:** <@${ticket.userId}>\n` +
              `**Fechado por:** ${interaction.user.tag}\n**Mensagens:** ${transcriptResult.messageCount}\n**Ficheiros:** 2 anexo(s)`
            )
            .setColor(0x0099ff)
            .setTimestamp();

          const files = [
            transcriptResult.attachment,
            transcriptResult.txtAttachment,
          ];

          await logChannel.send({ embeds: [embedLog], files }).catch(() => {});
        }

        // Guardar no Supabase
        const transcriptData = {
          id: transcriptResult.ticketId,
          canalId: channel.id,
          canalNome: channel.name,
          guildId: interaction.guild.id,
          guildNome: interaction.guild.name,
          geradoPor: interaction.user.id,
          geradoPorTag: interaction.user.tag,
          data: new Date().toISOString(),
          totalMensagens: transcriptResult.messageCount,
          txtConteudo: transcriptResult.txt,
          htmlFileName: transcriptResult.fileName,
        };
        await salvarTranscriptSupabase(transcriptData).catch(e => console.error("[Supabase] Erro:", e));
      }
    } catch (error) {
      console.error("[Transcript Auto] Erro geral:", error.message);
    }

    // --- DM DE AVALIAÇÃO (com verificação REAL) ---
    try {
      const user = await client.users.fetch(ticket.userId);
      if (user) {
        const now = new Date();
        const dataHora = now.toLocaleString('pt-PT', {
          timeZone: 'Europe/Lisbon',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        let staffDisplayName = interaction.user.username;
        try {
          const guildMember = await interaction.guild.members.fetch(interaction.user.id);
          staffDisplayName = guildMember.displayName || interaction.user.username;
        } catch {}

        const embedDM = new EmbedBuilder()
          .setTitle('🎫 Ticket Fechado')
          .setDescription(
            `ℹ️ O seu ticket foi fechado com sucesso!\n\n` +
            `🎫 **Ticket:** #${ticket.id}\n📝 **Tipo:** ${ticket.label}\n\n` +
            `⚒️ **Fechado por:** ${staffDisplayName}\n🕚 **Fechado em:** ${dataHora}\n\n` +
            `🎫 Caso seja necessário, não hesite em abrir um novo ticket!`
          )
          .setColor(0xFF0000)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`avaliar_${ticket.id}_1`).setLabel("1 ⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticket.id}_2`).setLabel("2 ⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticket.id}_3`).setLabel("3 ⭐⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticket.id}_4`).setLabel("4 ⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticket.id}_5`).setLabel("5 ⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary)
        );

        await user.send({ embeds: [embedDM], components: [row] });
        evaluationSent = true;
        console.log(`[Avaliação] DM enviada com sucesso para ${ticket.userId}`);
      }
    } catch (error) {
      evaluationSent = false;
      console.log(`[Avaliação] DM NÃO enviada para ${ticket.userId}: ${error.message}`);
    }

    // Guardar no DB se a avaliação foi enviada
    if (evaluationSent !== undefined) {
      try {
        db.tickets[String(ticket.id)].evaluationSent = evaluationSent;
        await persistDB();
      } catch (e) {
        console.error("[DB] Erro ao guardar evaluationSent:", e.message);
      }
    }

    // --- LOG DE FECHO MELHORADO E UNIFICADO (SEM BOTÃO) ---
    try {
      const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
      if (logChannel && ticket) {
        const agora = new Date();
        const dataFecho = agora.toLocaleString('pt-PT', {
          timeZone: 'Europe/Lisbon',
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          // second: '2-digit',  // REMOVIDO
        });

        const dataAbertura = ticket.openedAt
          ? new Date(ticket.openedAt).toLocaleString('pt-PT', {
              timeZone: 'Europe/Lisbon',
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              // second: '2-digit',  // REMOVIDO
            })
          : '—';

        // Montar a descrição unificada
        let descUnificada = '';
        descUnificada += `👤 **Aberto por:** <@${ticket.userId}> | \`${ticket.username}\`\n`;
        descUnificada += `🚛 **Trucky:** ${ticket.fotoNome || 'Não informado'}\n`;
        descUnificada += `📝 **Tipo:** ${ticket.label}\n\n`;
        descUnificada += `⚒️ **Assumido por:** ${ticket.claimedByName ? `<@${ticket.claimedBy}>` : 'Ninguém'}\n`;
        descUnificada += `👮 **Fechado por:** <@${interaction.user.id}>\n\n`;
        descUnificada += `📅 **Horário:** ${dataFecho}\n\n`;
        descUnificada += `↕ **Informações Adicionais**\n`;
        descUnificada += `🕑 **Horários:**\n`;
        descUnificada += `• 🕛 Abertura: ${dataAbertura}\n`;
        descUnificada += `• 🕛 Fechamento: ${dataFecho}\n`;
        descUnificada += `• 🕛 Duração: ${duracao}\n\n`;
        descUnificada += `🚛 **Nome no Trucky:**\n`;
        descUnificada += `• ${ticket.fotoNome || 'Não informado'}\n\n`;
        descUnificada += `💼 **Recrutado:**\n`;
        descUnificada += `• ${ticket.type === 'recrutamento' ? (recrutado ? '✅ Sim' : '❌ Não') : 'N/A'}\n\n`;
        descUnificada += `📨 **Avaliação Enviada:**\n`;
        descUnificada += `• ${evaluationSent ? '✅ Sim' : '❌ Não'}`;

        const embedUnificado = new EmbedBuilder()
          .setTitle(`🗑️ Ticket Fechado — #${ticket.id}`)
          .setDescription(descUnificada)
          .setColor(0x2629F1)
          .setTimestamp();

        // SEM BOTÃO "IR PARA O TICKET" – O CANAL JÁ FOI ELIMINADO!
        await logChannel.send({
          embeds: [embedUnificado],
        });
      }
    } catch (e) {
      console.error("[FecharTicket] Erro ao enviar log de fecho:", e.message);
    }

    // Apagar canal após 10 segundos
    setTimeout(() => channel.delete().catch(() => {}), 10000);

    return safeReply(interaction, "✅ Ticket fechado com sucesso.");

  } catch (error) {
    console.error("[FecharTicket] Erro:", error);
    if (error.message === "ALREADY_CLOSED") {
      return safeReply(interaction, "⚠️ Este ticket já foi fechado.");
    }
    return safeReply(interaction, "❌ Ocorreu um erro ao fechar o ticket.");
  } finally {
    clearClosing(ticketId);
  }
}

// ============================================================
// COMANDO TRANSCRIPT (slash)
// ============================================================

async function handleTranscriptCommand(interaction, ticket, client) {
  try {
    const additionalInfo = {
      openedBy: ticket.username,
      openedAt: ticket.openedAt ? new Date(ticket.openedAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }) : undefined,
      ticketLabel: ticket.label,
      claimedBy: ticket.claimedByName || undefined,
      closedBy: ticket.closedByName || undefined,
      closedAt: ticket.closedAt ? new Date(ticket.closedAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }) : undefined,
      evaluation: ticket.rating ? "⭐".repeat(ticket.rating) + "☆".repeat(5 - ticket.rating) : undefined,
      evaluationComment: ticket.ratingComment || undefined,
      evaluationSent: ticket.evaluationSent,
      recrutado: ticket.recrutado,
      fotoNome: ticket.fotoNome || undefined,
    };

    const result = await gerarTranscript(interaction.channel, ticket.id, additionalInfo);
    if (result) {
      await interaction.editReply({
        content: `📋 Transcript do Ticket #${ticket.id} — ${result.messageCount} mensagens`,
        files: [result.attachment, result.txtAttachment],
      });

      const transcriptData = {
        id: result.ticketId,
        canalId: interaction.channel.id,
        canalNome: interaction.channel.name,
        guildId: interaction.guild.id,
        guildNome: interaction.guild.name,
        geradoPor: interaction.user.id,
        geradoPorTag: interaction.user.tag,
        data: new Date().toISOString(),
        totalMensagens: result.messageCount,
        txtConteudo: result.txt,
        htmlFileName: result.fileName,
      };
      await salvarTranscriptSupabase(transcriptData).catch(e => console.error("[Supabase] Erro:", e));
    } else {
      await safeEdit(interaction, { content: "❌ Erro ao gerar o transcript." });
    }

    await sendLog(ticket.id, "transcript", client).catch(() => {});
  } catch (error) {
    console.error("[Transcript] Erro:", error);
    await safeEdit(interaction, { content: "❌ Erro ao gerar o transcript." });
  }
}

// ============================================================
// FALLBACK: gerar HTML manual (apenas para emergência)
// ============================================================

function escapeHTML(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function generateFallbackTranscriptHTML(messages, ticket, guild) {
  const content = messages.map((message) => {
    const avatar = message.author.displayAvatarURL({ extension: "png", size: 64 });
    const date = message.createdAt.toLocaleString("pt-PT");
    const text = message.content ? escapeHTML(message.content).replace(/\n/g, "<br>") : "<em>[sem texto]</em>";
    const attachments = Array.from(message.attachments.values())
      .map((a) => `<a href="${escapeHTML(a.url)}" target="_blank">${escapeHTML(a.name)}</a>`)
      .join("<br>");

    return `
<div class="message">
  <img class="avatar" src="${escapeHTML(avatar)}">
  <div class="content">
    <div><strong>${escapeHTML(message.author.tag)}</strong> <span class="time">${escapeHTML(date)}</span></div>
    <div class="body">${text}</div>
    ${attachments ? `<div class="attachments">${attachments}</div>` : ""}
  </div>
</div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcript - Ticket #${escapeHTML(ticket.id)}</title>
<style>
body { background: #36393f; color: #dcddde; font-family: Arial, sans-serif; margin: 0; padding: 20px; }
.header { background: #202225; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
.header h1 { color: white; margin: 0 0 10px; }
.header p { color: #aaa; }
.message { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #40444b; }
.avatar { width: 40px; height: 40px; border-radius: 50%; }
.content { flex: 1; }
.time { color: #72767d; font-size: 12px; margin-left: 8px; }
.body { margin-top: 5px; line-height: 1.5; word-break: break-word; }
.attachments { margin-top: 8px; }
.attachments a { color: #00aff4; }
</style>
</head>
<body>
<div class="header">
  <h1>🎫 Ticket #${escapeHTML(ticket.id)}</h1>
  <p>Servidor: ${escapeHTML(guild?.name || "Servidor")}<br>Tipo: ${escapeHTML(ticket.label)}<br>Utilizador: ${escapeHTML(ticket.username)}</p>
</div>
${content}
</body>
</html>`;
}
