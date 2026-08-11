import {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder,
} from "discord.js";
import { handleAjudaCommand, handleAjudaFeedback, handleAjudaProcurar } from "../services/ajuda.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { createTicket, criarTicketRecrutamento, handleTruckyVerification, updateTicketEmbed, isClaiming, setClaiming, clearClaiming, findTicketByChannelId } from "../services/tickets.js";
import { sendLog } from "../services/logs.js";
import { sendPainelChamada } from "../services/calls.js";

// ============ PROTECOES GLOBAIS ============
const processingRegras = new Map();
const ticketLocks = new Map();
const closingTickets = new Set();
const recruitingTickets = new Set();

// Limpar entradas antigas do processingRegras a cada 60s
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of processingRegras) {
    if (now - timestamp > 60000) processingRegras.delete(userId);
  }
}, 60000);

function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageMessages)) return true;
  if (member.roles?.cache?.has(CONFIG.CARGO_STAFF)) return true;
  return false;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findTicketLocal(channelId) {
  if (!channelId || !db.tickets) return null;
  return Object.values(db.tickets).find(t => t.channelId === channelId && !t.closed) || null;
}

function tryClaimTicket(ticketId, userId) {
  if (isClaiming(ticketId)) return false;
  setClaiming(ticketId, userId);
  return true;
}

async function withTicketLock(ticketId, fn) {
  const key = String(ticketId);
  while (ticketLocks.has(key)) {
    await new Promise(r => setTimeout(r, 50));
  }
  ticketLocks.set(key, true);
  try {
    return await fn();
  } finally {
    ticketLocks.delete(key);
  }
}

async function persistDB() {
  try {
    await saveDB();
    return true;
  } catch (err) {
    console.error("[DB] Erro ao guardar:", err);
    return false;
  }
}

function getTicket(ticketId, channelId) {
  let ticket = db.tickets?.[ticketId];
  if (!ticket && channelId) {
    ticket = findTicketByChannelId?.(channelId) || findTicketLocal(channelId);
  }
  return ticket || null;
}

function isClosing(ticketId) { return closingTickets.has(String(ticketId)); }
function setClosing(ticketId) { closingTickets.add(String(ticketId)); }
function clearClosing(ticketId) { closingTickets.delete(String(ticketId)); }

function isRecruiting(ticketId) { return recruitingTickets.has(String(ticketId)); }
function setRecruiting(ticketId) { recruitingTickets.add(String(ticketId)); }
function clearRecruiting(ticketId) { recruitingTickets.delete(String(ticketId)); }

export async function handleInteractionCreate(interaction, client) {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "ajuda") {
      await interaction.deferReply({ flags: 64 });
      return handleAjudaCommand(interaction, client);
    }

    if (interaction.commandName === "transcript") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      const ticket = Object.values(db.tickets || {}).find(t => t.channelId === interaction.channelId && !t.closed);
      if (!ticket) {
        return interaction.reply({ content: `⚠️ Nenhum ticket ativo encontrado neste canal.`, flags: 64 }).catch(() => {});
      }
      await interaction.deferReply({ flags: 64 });
      try {
        const messages = await interaction.channel.messages.fetch({ limit: 200 });
        const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        let textSummary = `📋 **Transcript do Ticket #${ticket.id}**\n\n`;
        let totalChars = 0;
        const MAX_SUMMARY_CHARS = 1900;
        for (const msg of sortedMessages) {
          const content = msg.content || "[sem texto]";
          const line = `\`[${msg.createdAt.toLocaleString('pt-PT')}]\` **${escapeHTML(msg.author.tag)}**: ${escapeHTML(content.substring(0, 100))}${content.length > 100 ? '...' : ''}\n`;
          if (totalChars + line.length > MAX_SUMMARY_CHARS) {
            textSummary += `\n... e mais ${sortedMessages.length - textSummary.split('\n').length + 1} mensagens.`;
            break;
          }
          textSummary += line;
          totalChars += line.length;
        }
        const html = generateTranscriptHTML(sortedMessages, ticket, interaction.guild);
        const attachment = new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-ticket-${ticket.id}.html` });
        await interaction.editReply({ content: textSummary, files: [attachment] });
        const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(`${CONFIG.EMOJI_FILE} Transcript Gerado`)
            .setDescription([`${CONFIG.EMOJI_USER} Staff: ${interaction.user.tag}`,`${CONFIG.EMOJI_INFO} Ticket: #${ticket.id} (${ticket.label})`,`${CONFIG.EMOJI_TIME} Data: ${new Date().toLocaleString("pt-PT")}`,`${CONFIG.EMOJI_FILE} Mensagens: ${sortedMessages.length}`].join("\n"))
            .setColor(0x0099ff).setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (err) {
        console.error("[Transcript] Erro:", err);
        await interaction.editReply({ content: `❌ Erro ao gerar transcript: ${err.message}`, flags: 64 }).catch(() => {});
      }
      return;
    }

    if (interaction.commandName === "painelmembro") {
      return enviarPainelMembro(interaction);
    }

    if (interaction.commandName === "painelstaff") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      return enviarPainelStaff(interaction, client);
    }

    if (interaction.commandName === "limpar") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      const { execute } = await import("../commands/limpar.js");
      return execute(interaction, client);
    }

    if (interaction.commandName === "status") {
      const { execute } = await import("../commands/status.js");
      return execute(interaction, client);
    }

    if (interaction.commandName === "passar") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      const { execute } = await import("../commands/passar.js");
      return execute(interaction, client);
    }

    if (interaction.commandName === "pedirassumo") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      const { execute } = await import("../commands/pedirassumo.js");
      return execute(interaction, client);
    }

    if (["verificar-inatividade","minhas-cargas","estatisticas-vtc","atualizar-patentes","limpeza","mapa"].includes(interaction.commandName)) {
      const staffCommands = ["verificar-inatividade", "atualizar-patentes", "limpeza"];
      if (staffCommands.includes(interaction.commandName) && !isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      const { handleTruckyCommand } = await import("../commands/truckyCommands.js");
      return handleTruckyCommand(interaction, client);
    }

    if (["gerar-foto","minha-foto","gerar-patente","verificar-templates"].includes(interaction.commandName)) {
      if (interaction.commandName === "gerar-patente" && !isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      const { handleTruckyImageCommand } = await import("../commands/truckyImageCommands.js");
      return handleTruckyImageCommand(interaction);
    }

    if (interaction.commandName === "mapa-canal") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      const { handleMapaCanalCommand } = await import("../commands/truckyMapaCanal.js");
      return handleMapaCanalCommand(interaction, client);
    }

    if (interaction.commandName === "apagar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas administradores podem usar este comando.`, flags: 64 }).catch(() => {});
      }
      const { execute } = await import("../commands/apagar.js");
      return execute(interaction, client);
    }

    if (interaction.commandName === "transcript-full") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, flags: 64 }).catch(() => {});
      }
      const { handleTranscriptCommand } = await import("../commands/transcript.js");
      return handleTranscriptCommand(interaction, client);
    }

    console.log(`[Interaction] Comando desconhecido: ${interaction.commandName}`);
    return interaction.reply({ content: `❌ Comando nao reconhecido.`, flags: 64 }).catch(() => {});
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("modal_trucky_")) {
      return handleTruckyVerification(interaction, client);
    }
    if (interaction.customId.startsWith("modal_ajuda_")) {
      const especificacoes = interaction.fields.getTextInputValue("ajuda_especificacoes")?.trim();
      interaction._ajudaEspecificacoes = especificacoes;
      return createTicket(interaction, "ajuda", `❓ Pedir ajuda`, client);
    }
    if (interaction.customId.startsWith("modal_foto_trucky_")) {
      await interaction.deferReply({ flags: 64 });
      return handleFotoTruckyModal(interaction, client);
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_geral") {
      const value = interaction.values[0];
      const labels = { bugs: `🐛 Bugs`, denuncia: `🚨 Denuncia`, suporte: `🔧 Suporte`, criador: `🎥 Criador De Conteudo` };
      return createTicket(interaction, value, labels[value], client);
    }
    if (interaction.customId === "ticket_recruitamento") {
      const value = interaction.values[0];
      if (value === "recrutamento") {
        return createTicket(interaction, "recrutamento", `📝 Recrutamento PAT`, client);
      }
      if (value === "ajuda") {
        const modal = new ModalBuilder()
          .setCustomId(`modal_ajuda_${interaction.user.id}_${Date.now()}`)
          .setTitle(`❓ Especificacoes do Problema`);
        const input = new TextInputBuilder()
          .setCustomId("ajuda_especificacoes")
          .setLabel("Descreve o teu problema ou duvida")
          .setPlaceholder("Ex: Nao consigo instalar o Trucky App...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId === "aceitar_regras") {
      const member = interaction.member;
      const now = Date.now();
      const lastProcess = processingRegras.get(member.id);
      if (lastProcess && (now - lastProcess) < 15000) {
        return interaction.reply({ content: "⏳ Ja estou a processar o teu pedido, aguarda...", flags: 64 }).catch(() => {});
      }
      processingRegras.set(member.id, now);
      try {
        await interaction.deferReply({ flags: 64 });
        const cargoMembro = interaction.guild.roles.cache.get(CONFIG.CARGO_MEMBRO);
        const cargoNovo1 = interaction.guild.roles.cache.get(CONFIG.CARGO_REGRAS_EXTRA_1 || "1534970663344017479");
        const cargoNovo2 = interaction.guild.roles.cache.get(CONFIG.CARGO_REGRAS_EXTRA_2 || "1146443166686396476");
        const temMembro = !cargoMembro || member.roles.cache.has(cargoMembro.id);
        const temNovo1 = !cargoNovo1 || member.roles.cache.has(cargoNovo1.id);
        const temNovo2 = !cargoNovo2 || member.roles.cache.has(cargoNovo2.id);
        if (temMembro && temNovo1 && temNovo2) {
          const acceptedAt = db.acceptedRulesAt?.[member.id];
          if (acceptedAt) {
            const ts = Math.floor(new Date(acceptedAt).getTime() / 1000);
            return interaction.editReply({ content: `✅ As regras ja foram aceites! Aceitaste <t:${ts}:R>.` }).catch(() => {});
          }
          return interaction.editReply({ content: `✅ As regras ja foram aceites anteriormente!` }).catch(() => {});
        }
        if (cargoMembro && !member.roles.cache.has(cargoMembro.id)) await member.roles.add(cargoMembro).catch(() => {});
        if (cargoNovo1 && !member.roles.cache.has(cargoNovo1.id)) await member.roles.add(cargoNovo1).catch(() => {});
        if (cargoNovo2 && !member.roles.cache.has(cargoNovo2.id)) await member.roles.add(cargoNovo2).catch(() => {});
        if (!db.acceptedRules) db.acceptedRules = [];
        if (!db.acceptedRules.includes(member.id)) db.acceptedRules.push(member.id);
        if (!db.acceptedRulesAt) db.acceptedRulesAt = {};
        db.acceptedRulesAt[member.id] = new Date().toISOString();
        await persistDB();
        return interaction.editReply({
          content: `✅ Regras aceites com sucesso! Bem-vind@ a comunidade da __**\`Portugal Alfa Community\`**__ 🎉\nAqui podera ver os conteudos do Diego, conversar/conviver com o pessoal e entre outros...`
        }).catch(() => {});
      } catch (err) {
        console.error("[aceitar_regras] Erro:", err);
        return interaction.editReply({ content: `❌ Erro ao processar. Tenta novamente.` }).catch(() => {});
      }
    }

    if (customId.startsWith("aceitar_regras_rec_")) {
      const parts = customId.split("_");
      const userId = parts[3];
      const nomeTrucky = parts.slice(4).join("_");
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: `⚠️ Este botao nao esta disponivel para ti!`, flags: 64 }).catch(() => {});
      }
      await interaction.deferReply({ flags: 64 });
      try {
        await criarTicketRecrutamento(interaction, client, nomeTrucky);
        return interaction.editReply({ content: `✅ Ticket de recrutamento criado com sucesso!` }).catch(() => {});
      } catch (err) {
        console.error("[interactionCreate] Erro criarTicketRecrutamento:", err);
        return interaction.editReply({ content: `❌ Erro ao criar ticket. Contacta a staff.` }).catch(() => {});
      }
    }

    if (customId.startsWith("recusar_regras_rec_")) {
      const userId = customId.split("_")[3];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: `⚠️ Este botao nao e para ti!`, flags: 64 }).catch(() => {});
      }
      return interaction.update({
        content: `❌ Recrutamento cancelado. Se mudares de ideias, podes voltar a candidatar-te mais tarde.`,
        embeds: [], components: [],
      }).catch(() => {});
    }

    if (customId.startsWith("assumir_")) {
      const ticketId = customId.replace("assumir_", "");
      await interaction.deferReply({ flags: 64 });
      if (!isStaff(interaction.member)) {
        return interaction.editReply({ content: `❌ Apenas staff pode assumir tickets.`, flags: 64 }).catch(() => {});
      }
      const canClaim = tryClaimTicket(ticketId, interaction.user.id);
      if (!canClaim) {
        return interaction.editReply({ content: `⏳ Outro staff ja esta a assumir este ticket. Aguarda...` }).catch(() => {});
      }
      console.log(`[Assumir] TicketId: ${ticketId}, User: ${interaction.user.id}`);
      let ticket = getTicket(ticketId, interaction.channelId);
      if (!ticket || ticket.closed) {
        clearClaiming(ticketId);
        return interaction.editReply({ content: `⚠️ Ticket nao encontrado ou ja fechado.` }).catch(() => {});
      }
      if (ticket.claimedBy) {
        clearClaiming(ticketId);
        return interaction.editReply({ content: `⚠️ Este ticket ja foi assumido por <@${ticket.claimedBy}>.` }).catch(() => {});
      }
      try {
        await withTicketLock(ticketId, async () => {
          const t = db.tickets[ticketId];
          if (!t || t.closed || t.claimedBy) throw new Error("TICKET_ALREADY_CLAIMED");
          t.claimedBy = interaction.user.id;
          t.claimedByName = interaction.user.username;
          const saved = await persistDB();
          if (!saved) throw new Error("DB_SAVE_FAILED");
        });
        const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
        if (!channel) {
          clearClaiming(ticketId);
          return interaction.editReply({ content: `❌ Erro: Canal do ticket nao encontrado.` }).catch(() => {});
        }
        await updateTicketEmbed(channel, ticketId);
        await channel.send(`🎉 Ticket assumido com sucesso!\n👮 <@${interaction.user.id}> assumiu o teu ticket. Se precisares de chamar a staff, usa a opcao **Painel Membro**.`);
        return interaction.editReply({
          content: `Ola <@${interaction.user.id}>, informo-te que podes usar o **/painelstaff** para teres mais acesso ao ticket se precisares.`,
        }).catch(() => {});
      } catch (err) {
        console.error("[Assumir] Erro:", err);
        if (err.message === "TICKET_ALREADY_CLAIMED") {
          return interaction.editReply({ content: `⚠️ Este ticket ja foi assumido.` }).catch(() => {});
        }
        return interaction.editReply({ content: `❌ Erro ao assumir ticket. Tenta novamente.` }).catch(() => {});
      } finally {
        clearClaiming(ticketId);
      }
    }

    if (customId.startsWith("painel_membro_")) {
      const ticketId = customId.replace("painel_membro_", "");
      let ticket = getTicket(ticketId, interaction.channelId);
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket nao encontrado ou ja fechado.`, flags: 64 }).catch(() => {});
      }
      const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
      if (!guild) return interaction.reply({ content: `❌ Erro ao aceder ao servidor.`, flags: 64 }).catch(() => {});
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) return interaction.reply({ content: `❌ Canal nao encontrado.`, flags: 64 }).catch(() => {});
      const staffList = await buildStaffList(channel, ticket);
      if (staffList.length === 0) {
        return interaction.reply({ content: `⚠️ Nenhum membro da staff encontrado neste ticket.`, flags: 64 }).catch(() => {});
      }
      const staffText = staffList.map(s => `**${s.roleName}** | ${s.displayName} | <@${s.member.id}>`).join("\n");
      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Painel Membro`)
        .setDescription([`📋 Lista de staff disponivel neste ticket:`, "", staffText].join("\n"))
        .setColor(CONFIG.COR_PRINCIPAL);
      return interaction.reply({ embeds: [embed], flags: 64 }).catch(() => {});
    }

    if (customId.startsWith("sair_")) {
      const ticketId = customId.replace("sair_", "");
      let ticket = getTicket(ticketId, interaction.channelId);
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket nao encontrado ou ja fechado.`, flags: 64 }).catch(() => {});
      }
      if (ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: `⚠️ So quem abriu o ticket pode sair.`, flags: 64 }).catch(() => {});
      }
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: `❌ Canal do ticket nao encontrado.`, flags: 64 }).catch(() => {});
      }
      const overwrite = channel.permissionOverwrites.cache.get(interaction.user.id);
      if (!overwrite) {
        return interaction.reply({ content: `⚠️ Ja saiste deste ticket.`, flags: 64 }).catch(() => {});
      }
      await channel.permissionOverwrites.delete(interaction.user.id);
      return interaction.reply({ content: `✅ Saiste do ticket com sucesso.`, flags: 64 }).catch(() => {});
    }

    if (customId.startsWith("deletar_")) {
      const ticketId = customId.replace("deletar_", "");
      if (isClosing(ticketId)) {
        return interaction.reply({ content: `⏳ Este ticket ja esta a ser fechado. Aguarda...`, flags: 64 }).catch(() => {});
      }
      let ticket = getTicket(ticketId, interaction.channelId);
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket nao encontrado ou ja fechado.`, flags: 64 }).catch(() => {});
      }
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `❌ Apenas staff pode fechar tickets.`, flags: 64 }).catch(() => {});
      }
      if (ticket.type === "recrutamento") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`recrutado_sim_${ticketId}`).setLabel(`🎉 Sim - Recrutado`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recrutado_nao_${ticketId}`).setLabel(`😔 Nao - Nao Recrutado`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`fechar_definitivo_${ticketId}`).setLabel(`🔒 Fechar Definitivo (Nao Recrutamento)`).setStyle(ButtonStyle.Secondary),
        );
        return interaction.reply({ content: `❓ O candidato foi recrutado?`, components: [row] }).catch(() => {});
      } else {
        return fecharTicket(interaction, ticketId, client, false);
      }
    }

    if (customId.startsWith("recrutado_sim_")) {
      const ticketId = customId.replace("recrutado_sim_", "");
      if (isClosing(ticketId)) {
        return interaction.reply({ content: `⏳ Este ticket ja esta a ser fechado.`, flags: 64 }).catch(() => {});
      }
      let ticket = getTicket(ticketId, interaction.channelId);
      if (!ticket || ticket.closed || ticket.recrutado) {
        return interaction.reply({ content: `⚠️ Ticket nao encontrado, ja fechado ou ja recrutado.`, flags: 64 }).catch(() => {});
      }
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `❌ Apenas staff pode confirmar recrutamento.`, flags: 64 }).catch(() => {});
      }
      const modal = new ModalBuilder()
        .setCustomId(`modal_foto_trucky_${ticketId}`)
        .setTitle(`🎉 Nome da Foto do Trucky`);
      const input = new TextInputBuilder()
        .setCustomId("foto_nome")
        .setLabel("Nome da tua foto de perfil do Trucky")
        .setPlaceholder("Ex: Diego")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (customId.startsWith("recrutado_nao_")) {
      const ticketId = customId.replace("recrutado_nao_", "");
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `❌ Apenas staff pode marcar como nao recrutado.`, flags: 64 }).catch(() => {});
      }
      return fecharTicket(interaction, ticketId, client, false);
    }

    if (customId.startsWith("fechar_definitivo_")) {
      const ticketId = customId.replace("fechar_definitivo_", "");
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: `❌ Apenas staff pode fechar tickets definitivamente.`, flags: 64 }).catch(() => {});
      }
      return fecharTicket(interaction, ticketId, client, false);
    }

    if (customId.startsWith("avaliar_")) {
      const parts = customId.split("_");
      const ticketId = parts[1];
      const estrelas = parseInt(parts[2]);
      let ticket = db.tickets?.[ticketId];
      if (!ticket && interaction.channelId) {
        ticket = findTicketByChannelId?.(interaction.channelId) || findTicketLocal(interaction.channelId);
      }
      if (!ticket) return interaction.reply({ content: `⚠️ Ticket nao encontrado.`, flags: 64 }).catch(() => {});
      if (ticket.rating !== undefined && ticket.rating !== null) {
        const stars = "⭐".repeat(ticket.rating) + "☆".repeat(5 - ticket.rating);
        return interaction.reply({ content: `⚠️ Ja avaliaste este ticket com ${stars} (${ticket.rating}/5).`, flags: 64 }).catch(() => {});
      }
      ticket.rating = estrelas;
      await persistDB();
      const stars = "⭐".repeat(estrelas) + "☆".repeat(5 - estrelas);
      return interaction.update({
        content: `✅ Obrigado pela tua avaliacao!\n\n**Avaliacao:** ${stars} (${estrelas}/5)`,
        components: [],
      }).catch(() => {});
    }

    if (customId === "ajuda_procurar") {
      return handleAjudaProcurar(interaction);
    }
    if (customId === "ajuda_ticket" || customId.startsWith("ajuda_ticket_direct_") || 
        customId === "ajuda_faq" || customId === "ajuda_nova" ||
        customId.startsWith("smart_helpful_") || customId.startsWith("smart_not_helpful_")) {
      return handleAjudaFeedback(interaction);
    }

    return interaction.reply({ content: `⚠️ Acao desconhecida.`, flags: 64 }).catch(() => {});
  }
}

// ============ FUNCOES AUXILIARES ============

function generateTranscriptHTML(messages, ticket, guild) {
  const msgs = messages.map(m => {
    const avatar = m.author.displayAvatarURL({ format: 'png', size: 64 });
    const attachments = m.attachments.map(a => {
      const isImage = a.contentType?.startsWith('image/');
      if (isImage) {
        return `<a href="${escapeHTML(a.url)}" target="_blank" class="attachment-image"><img src="${escapeHTML(a.url)}" alt="${escapeHTML(a.name)}" loading="lazy"></a>`;
      }
      return `<a href="${escapeHTML(a.url)}" target="_blank" class="attachment-file">📎 ${escapeHTML(a.name)}</a>`;
    }).join(' ');
    const embeds = m.embeds.length > 0 ? `[${m.embeds.length} embed(s)]` : '';
    const time = m.createdAt.toLocaleString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = m.createdAt.toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return `
      <div class="message">
        <img src="${escapeHTML(avatar)}" class="avatar" alt="${escapeHTML(m.author.tag)}">
        <div class="message-content">
          <div class="message-header">
            <span class="author">${escapeHTML(m.author.tag)}</span>
            <span class="timestamp">${escapeHTML(date)} as ${escapeHTML(time)}</span>
          </div>
          <div class="message-body">${m.content ? escapeHTML(m.content).replace(/\n/g, '<br>') : '<em class="empty">[sem texto]</em>'}</div>
          ${attachments ? `<div class="attachments">${attachments}</div>` : ''}
          ${embeds ? `<div class="embeds-info">${escapeHTML(embeds)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript - Ticket #${ticket.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #36393f; color: #dcddde; min-height: 100vh; }
    .header { background: #202225; padding: 20px; text-align: center; border-bottom: 1px solid #40444b; }
    .header h1 { color: #fff; font-size: 24px; margin-bottom: 8px; }
    .header .meta { color: #b9bbbe; font-size: 14px; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .message { display: flex; padding: 12px 0; border-bottom: 1px solid #40444b; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 12px; flex-shrink: 0; }
    .message-content { flex: 1; }
    .message-header { margin-bottom: 4px; }
    .author { color: #fff; font-weight: 600; font-size: 15px; }
    .timestamp { color: #72767d; font-size: 12px; margin-left: 8px; }
    .message-body { color: #dcddde; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
    .message-body .empty { color: #72767d; font-style: italic; }
    .attachments { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
    .attachment-image img { max-width: 300px; max-height: 200px; border-radius: 4px; cursor: pointer; transition: transform 0.2s; }
    .attachment-image img:hover { transform: scale(1.02); }
    .attachment-file { background: #40444b; color: #00b0f4; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 13px; }
    .attachment-file:hover { text-decoration: underline; }
    .embeds-info { color: #72767d; font-size: 12px; margin-top: 4px; }
    @media (max-width: 600px) { .container { padding: 10px; } .attachment-image img { max-width: 100%; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎫 Transcript - Ticket #${ticket.id}</h1>
    <div class="meta">${guild?.name || 'Servidor'} | ${ticket.label} | Aberto por ${ticket.username}</div>
  </div>
  <div class="container">
    ${msgs}
  </div>
</body>
</html>`;
}

async function handleFotoTruckyModal(interaction, client) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: `❌ Apenas staff pode completar o recrutamento.`, flags: 64 }).catch(() => {});
  }

  const ticketId = interaction.customId.replace("modal_foto_trucky_", "");

  if (isClosing(ticketId)) {
    return interaction.editReply({ content: `⏳ Este ticket ja esta a ser fechado.` }).catch(() => {});
  }
  setClosing(ticketId);

  let ticket = getTicket(ticketId, interaction.channelId);

  if (!ticket || ticket.closed || ticket.recrutado) {
    clearClosing(ticketId);
    return interaction.editReply({ content: `⚠️ Ticket nao encontrado, ja fechado ou ja recrutado.` }).catch(() => {});
  }

  let fotoNome = interaction.fields.getTextInputValue("foto_nome")?.trim() || "Nao informado";
  fotoNome = fotoNome.replace(/\.[^/.]+$/, "");

  try {
    await withTicketLock(ticketId, async () => {
      const t = db.tickets[ticketId];
      if (!t || t.closed || t.recrutado) {
        throw new Error("TICKET_INVALID_STATE");
      }

      t.fotoNome = fotoNome;
      t.recrutado = true;
      t.closedBy = interaction.user.id;
      t.closedByName = interaction.user.username;
      t.closedAt = new Date().toISOString();

      const saved = await persistDB();
      if (!saved) throw new Error("DB_SAVE_FAILED");
    });

    const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);

    if (guild) {
      const member = await guild.members.fetch(ticket.userId).catch(() => null);
      if (member) {
        const cargoRecrutado = guild.roles.cache.get(CONFIG.CARGO_RECRUTADO);
        const cargoRecrutamento1 = guild.roles.cache.get(CONFIG.CARGO_RECRUTAMENTO_1);
        if (cargoRecrutado) await member.roles.add(cargoRecrutado).catch(() => {});
        if (cargoRecrutamento1) await member.roles.add(cargoRecrutamento1).catch(() => {});
      }
    }

    const canalGeral = await client.channels.fetch(CONFIG.CANAL_GERAL).catch(() => null);
    if (canalGeral) {
      await canalGeral.send([
        `🎉 Bem-vindo a Portugal Alfa Truckers!`,
        ``,
        `Parabens <@${ticket.userId}>! Foste recrutado com sucesso.`,
        `✅ Segue as <#1200170228093550712> e diverte-te!`,
        `🚛 A tua foto de perfil para o Trucky ficara disponivel em <#${CONFIG.CANAL_TEMPLATE_FOTO}>.`,
        `ℹ️ Caso precises de ajuda, abre um ticket ou coloca a tua duvida num chat aberto.`
      ].join("\n"));
    }

    await sendLog(ticketId, "close", client);

    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) {
      const embedFechamento = new EmbedBuilder()
        .setTitle(`🗑️ Ticket Fechado`)
        .setDescription([
          `ℹ️ O teu ticket foi fechado com sucesso.`,
          ``,
          `👮 Fechado por: ${interaction.user.username}`,
          `⏰ Fechado em: ${new Date().toLocaleString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
        ].join("\n"))
        .setColor(CONFIG.COR_ERRO);

      await channel.send({ embeds: [embedFechamento] });

      try {
        const user = await client.users.fetch(ticket.userId);
        const embedDM = new EmbedBuilder()
          .setTitle(`⭐ Ticket Fechado`)
          .setDescription([
            `ℹ️ O teu ticket foi fechado com sucesso, avalia o nosso atendimento clicando nas estrelas abaixo.`,
            ``,
            `🎫 Ticket: #${ticket.id}`,
            `ℹ️ Tipo: ${ticket.label}`,
            ``,
            `👮 Fechado por:`,
            `${interaction.user.username}`,
            ``,
            `⏰ Fechado em:`,
            `${new Date().toLocaleString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
            ``,
            `🎫 Caso necessario, nao hesite em abrir ticket novamente!`
          ].join("\n"))
          .setColor(0xFF0000);

        const rowStars = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_1`).setLabel("1 ⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_2`).setLabel("2 ⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_3`).setLabel("3 ⭐⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_4`).setLabel("4 ⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_5`).setLabel("5 ⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
        );

        await user.send({ embeds: [embedDM], components: [rowStars] });
      } catch (e) {
        console.log("Nao foi possivel enviar DM ao user:", e.message);
      }

      setTimeout(async () => {
        await channel.delete().catch(() => {});
      }, 10000);
    }

    return interaction.editReply({
      content: `✅ Utilizador recrutado com sucesso! Foto do Trucky: **${fotoNome}**.\n🗑️ Ticket sera fechado em 10 segundos...`,
    }).catch(() => {});

  } catch (err) {
    console.error("[handleFotoTruckyModal] Erro:", err);
    if (err.message === "TICKET_INVALID_STATE") {
      return interaction.editReply({ content: `⚠️ Ticket ja foi processado.` }).catch(() => {});
    }
    return interaction.editReply({ content: `❌ Erro ao processar recrutamento.` }).catch(() => {});
  } finally {
    clearClosing(ticketId);
  }
}

async function fecharTicket(interaction, ticketId, client, recrutado) {
  if (isClosing(ticketId)) {
    return interaction.reply({ content: `⏳ Este ticket ja esta a ser fechado.`, flags: 64 }).catch(() => {});
  }
  setClosing(ticketId);

  let ticket = getTicket(ticketId, interaction.channelId);

  if (!ticket || ticket.closed) {
    clearClosing(ticketId);
    return interaction.reply({ content: `⚠️ Ticket nao encontrado ou ja fechado.`, flags: 64 }).catch(() => {});
  }

  try {
    await withTicketLock(ticketId, async () => {
      const t = db.tickets[ticketId];
      if (!t || t.closed) {
        throw new Error("TICKET_ALREADY_CLOSED");
      }

      t.closed = true;
      t.recrutado = recrutado;
      t.closedBy = interaction.user.id;
      t.closedByName = interaction.user.username;
      t.closedAt = new Date().toISOString();

      const saved = await persistDB();
      if (!saved) throw new Error("DB_SAVE_FAILED");
    });

    await sendLog(ticketId, "close", client);

    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) {
      const embedFechamento = new EmbedBuilder()
        .setTitle(`🗑️ Ticket Fechado`)
        .setDescription([
          `ℹ️ O teu ticket foi fechado com sucesso.`,
          ``,
          `👮 Fechado por: ${interaction.user.username}`,
          `⏰ Fechado em: ${new Date().toLocaleString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
        ].join("\n"))
        .setColor(CONFIG.COR_ERRO);

      await channel.send({ embeds: [embedFechamento] });

      try {
        const user = await client.users.fetch(ticket.userId);
        const embedDM = new EmbedBuilder()
          .setTitle(`⭐ Ticket Fechado`)
          .setDescription([
            `ℹ️ O teu ticket foi fechado com sucesso, avalia o nosso atendimento clicando nas estrelas abaixo.`,
            ``,
            `🎫 Ticket: #${ticket.id}`,
            `ℹ️ Tipo: ${ticket.label}`,
            ``,
            `👮 Fechado por:`,
            `${interaction.user.username}`,
            ``,
            `⏰ Fechado em:`,
            `${new Date().toLocaleString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
            ``,
            `🎫 Caso necessario, nao hesite em abrir ticket novamente!`
          ].join("\n"))
          .setColor(0xFF0000);

        const rowStars = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_1`).setLabel("1 ⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_2`).setLabel("2 ⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_3`).setLabel("3 ⭐⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_4`).setLabel("4 ⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_5`).setLabel("5 ⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
        );

        await user.send({ embeds: [embedDM], components: [rowStars] });
      } catch (e) {
        console.log("Nao foi possivel enviar DM ao user:", e.message);
      }

      setTimeout(async () => {
        await channel.delete().catch(() => {});
      }, 10000);
    }

    return interaction.reply({ content: `✅ Ticket fechado com sucesso!`, flags: 64 }).catch(() => {});

  } catch (err) {
    console.error("[fecharTicket] Erro:", err);
    if (err.message === "TICKET_ALREADY_CLOSED") {
      return interaction.reply({ content: `⚠️ Ticket ja foi fechado.`, flags: 64 }).catch(() => {});
    }
    return interaction.reply({ content: `❌ Erro ao fechar ticket.`, flags: 64 }).catch(() => {});
  } finally {
    clearClosing(ticketId);
  }
}

async function enviarPainelMembro(interaction) {
  const ticket = Object.values(db.tickets || {}).find(t => t.channelId === interaction.channelId && !t.closed);
  if (!ticket) {
    return interaction.reply({ content: `⚠️ Nenhum ticket ativo encontrado neste canal.`, flags: 64 }).catch(() => {});
  }

  const guild = interaction.guild;
  const channel = interaction.channel;

  const staffList = await buildStaffList(channel, ticket);

  if (staffList.length === 0) {
    return interaction.reply({ content: `⚠️ Nenhum membro da staff encontrado neste ticket.`, flags: 64 }).catch(() => {});
  }

  const staffText = staffList.map(s => `**${s.roleName}** | ${s.displayName} | <@${s.member.id}>`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ Painel Membro`)
    .setDescription([
      `📋 Lista de staff disponivel neste ticket:`,
      "",
      staffText
    ].join("\n"))
    .setColor(CONFIG.COR_PRINCIPAL);

  return interaction.reply({ embeds: [embed], flags: 64 }).catch(() => {});
}

async function enviarPainelStaff(interaction, client) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ 
      content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, 
      flags: 64 
    }).catch(() => {});
  }

  const ticket = Object.values(db.tickets || {}).find(t => t.channelId === interaction.channelId && !t.closed);
  if (!ticket) {
    return interaction.reply({ content: `⚠️ Nenhum ticket ativo encontrado neste canal.`, flags: 64 }).catch(() => {});
  }

  return sendPainelChamada(interaction.channel, ticket.id, interaction);
}

async function buildStaffList(channel, ticket) {
  const members = await channel.members.fetch();
  const staffList = [];
  const botId = CONFIG.BOT_ID_EXCLUIR || channel.client.user.id;

  for (const [memberId, member] of members) {
    if (memberId === botId) continue;
    if (memberId === ticket.userId) continue;

    const perms = channel.permissionsFor(member);
    if (perms && perms.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages)) {
      const highestRole = member.roles.cache.sort((a, b) => b.position - a.position).first();
      staffList.push({
        member,
        rolePosition: highestRole ? highestRole.position : 0,
        roleName: highestRole ? highestRole.name : "Sem cargo",
        displayName: member.displayName || member.user.username,
      });
    }
  }

  staffList.sort((a, b) => {
    if (b.rolePosition !== a.rolePosition) return b.rolePosition - a.rolePosition;
    return a.displayName.localeCompare(b.displayName);
  });

  return staffList;
}
