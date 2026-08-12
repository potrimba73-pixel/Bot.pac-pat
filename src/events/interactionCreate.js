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

async function safeReply(interaction, content, ephemeral = true) {
  try {
    if (interaction.deferred) return await interaction.editReply({ content, flags: ephemeral ? 64 : 0 });
    if (interaction.replied) return await interaction.followUp({ content, flags: ephemeral ? 64 : 0 });
    return await interaction.reply({ content, flags: ephemeral ? 64 : 0 });
  } catch (e) { /* Ignora */ }
}

async function withTicketLock(ticketId, fn) {
  const key = String(ticketId);
  while (ticketLocks.has(key)) { await new Promise(r => setTimeout(r, 50)); }
  ticketLocks.set(key, true);
  try { return await fn(); } finally { ticketLocks.delete(key); }
}

function isClosing(ticketId) { return closingTickets.has(String(ticketId)); }
function setClosing(ticketId) { closingTickets.add(String(ticketId)); }
function clearClosing(ticketId) { closingTickets.delete(String(ticketId)); }

export async function handleInteractionCreate(interaction, client) {

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ajuda") {
      await interaction.deferReply({ flags: 64 });
      return handleAjudaCommand(interaction, client);
    }

    if (interaction.commandName === "transcript") {
      if (!isStaff(interaction.member)) {
        return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`);
      }
      const ticket = Object.values(db.tickets || {}).find(t => t.channelId === interaction.channelId && !t.closed);
      if (!ticket) { return safeReply(interaction, `Nenhum ticket ativo encontrado neste canal.`); }
      await interaction.deferReply({ flags: 64 });
      try {
        const messages = await interaction.channel.messages.fetch({ limit: 200 });
        const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        let textSummary = `Transcript do Ticket #${ticket.id}\n\n`;
        let totalChars = 0;
        const MAX_SUMMARY_CHARS = 1900;
        for (const msg of sortedMessages) {
          const content = msg.content || "[sem texto]";
          const line = `[${msg.createdAt.toLocaleString('pt-PT')}] **${escapeHTML(msg.author.tag)}**: ${escapeHTML(content.substring(0, 100))}${content.length > 100 ? '...' : ''}\n`;
          if (totalChars + line.length > MAX_SUMMARY_CHARS) {
            textSummary += `\n... e mais ${sortedMessages.length - textSummary.split('\n').length + 1} mensagens.`;
            break;
          }
          textSummary += line; totalChars += line.length;
        }
        const html = generateTranscriptHTML(sortedMessages, ticket, interaction.guild);
        const attachment = new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-ticket-${ticket.id}.html` });
        await interaction.editReply({ content: textSummary, files: [attachment] });
        const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(`${CONFIG.EMOJI_FILE} Transcript Gerado`)
            .setDescription([
              `${CONFIG.EMOJI_USER} Staff: ${interaction.user.tag}`,
              `${CONFIG.EMOJI_INFO} Ticket: #${ticket.id} (${ticket.label})`,
              `${CONFIG.EMOJI_TIME} Data: ${new Date().toLocaleString("pt-PT")}`,
              `${CONFIG.EMOJI_FILE} Mensagens: ${sortedMessages.length}`
            ].join("\n"))
            .setColor(0x0099ff).setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (err) {
        console.error("[Transcript] Erro:", err);
        await interaction.editReply({ content: `Erro ao gerar transcript: ${err.message}`, flags: 64 });
      }
      return;
    }

    if (interaction.commandName === "painelmembro") { return enviarPainelMembro(interaction); }
    if (interaction.commandName === "painelstaff") {
      if (!isStaff(interaction.member)) { return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`); }
      return enviarPainelStaff(interaction, client);
    }
    if (interaction.commandName === "limpar") {
      if (!isStaff(interaction.member)) { return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`); }
      const { execute } = await import("../commands/limpar.js"); return execute(interaction, client);
    }
    if (interaction.commandName === "status") {
      const { execute } = await import("../commands/status.js"); return execute(interaction, client);
    }
    if (interaction.commandName === "passar") {
      if (!isStaff(interaction.member)) { return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`); }
      const { execute } = await import("../commands/passar.js"); return execute(interaction, client);
    }
    if (interaction.commandName === "pedirassumo") {
      if (!isStaff(interaction.member)) { return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`); }
      const { execute } = await import("../commands/pedirassumo.js"); return execute(interaction, client);
    }
    if (["verificar-inatividade","minhas-cargas","estatisticas-vtc","atualizar-patentes","limpeza","mapa"].includes(interaction.commandName)) {
      const staffCommands = ["verificar-inatividade", "atualizar-patentes", "limpeza"];
      if (staffCommands.includes(interaction.commandName) && !isStaff(interaction.member)) {
        return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`);
      }
      const { handleTruckyCommand } = await import("../commands/truckyCommands.js"); return handleTruckyCommand(interaction, client);
    }
    if (["gerar-foto","minha-foto","gerar-patente","verificar-templates"].includes(interaction.commandName)) {
      if (interaction.commandName === "gerar-patente" && !isStaff(interaction.member)) {
        return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`);
      }
      const { handleTruckyImageCommand } = await import("../commands/truckyImageCommands.js"); return handleTruckyImageCommand(interaction);
    }
    if (interaction.commandName === "mapa-canal") {
      if (!isStaff(interaction.member)) { return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`); }
      const { handleMapaCanalCommand } = await import("../commands/truckyMapaCanal.js"); return handleMapaCanalCommand(interaction, client);
    }
    if (interaction.commandName === "apagar") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas administradores podem usar este comando.`);
      }
      const { execute } = await import("../commands/apagar.js"); return execute(interaction, client);
    }
    if (interaction.commandName === "transcript-full") {
      if (!isStaff(interaction.member)) { return safeReply(interaction, `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`); }
      const { handleTranscriptCommand } = await import("../commands/transcript.js"); return handleTranscriptCommand(interaction, client);
    }
    console.log(`[Interaction] Comando desconhecido: ${interaction.commandName}`);
    return safeReply(interaction, `Comando nao reconhecido.`);
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("modal_trucky_")) { return handleTruckyVerification(interaction, client); }
    if (interaction.customId.startsWith("modal_ajuda_")) {
      const especificacoes = interaction.fields.getTextInputValue("ajuda_especificacoes")?.trim();
      interaction._ajudaEspecificacoes = especificacoes;
      return createTicket(interaction, "ajuda", `Pedir ajuda`, client);
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
      const labels = { bugs: `Bugs`, denuncia: `Denuncia`, suporte: `Suporte`, criador: `Criador De Conteudo` };
      return createTicket(interaction, value, labels[value], client);
    }
    if (interaction.customId === "ticket_recruitamento") {
      const value = interaction.values[0];
      if (value === "recrutamento") { return createTicket(interaction, "recrutamento", `Recrutamento PAT`, client); }
      if (value === "ajuda") {
        const modal = new ModalBuilder().setCustomId(`modal_ajuda_${interaction.user.id}_${Date.now()}`).setTitle(`Especificacoes do Problema`);
        const input = new TextInputBuilder().setCustomId("ajuda_especificacoes").setLabel("Descreve o teu problema ou duvida").setPlaceholder("Ex: Nao consigo instalar o Trucky App...").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
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
        return safeReply(interaction, "Ja estou a processar o teu pedido, aguarda...");
      }
      processingRegras.set(member.id, now);
      try {
        await interaction.deferReply({ flags: 64 });
        const cargoMembro = interaction.guild.roles.cache.get(CONFIG.CARGO_MEMBRO);
        const cargoNovo1 = interaction.guild.roles.cache.get("1534970663344017479");
        const cargoNovo2 = interaction.guild.roles.cache.get("1146443166686396476");
        const temMembro = !cargoMembro || member.roles.cache.has(cargoMembro.id);
        const temNovo1 = !cargoNovo1 || member.roles.cache.has(cargoNovo1.id);
        const temNovo2 = !cargoNovo2 || member.roles.cache.has(cargoNovo2.id);
        if (temMembro && temNovo1 && temNovo2) {
          const acceptedAt = db.acceptedRulesAt?.[member.id];
          if (acceptedAt) {
            const ts = Math.floor(new Date(acceptedAt).getTime() / 1000);
            return interaction.editReply({ content: `As regras ja foram aceites! Aceitaste <t:${ts}:R>.` }).catch(() => {});
          }
          return interaction.editReply({ content: `As regras ja foram aceites anteriormente!` }).catch(() => {});
        }
        if (cargoMembro && !member.roles.cache.has(cargoMembro.id)) await member.roles.add(cargoMembro).catch(() => {});
        if (cargoNovo1 && !member.roles.cache.has(cargoNovo1.id)) await member.roles.add(cargoNovo1).catch(() => {});
        if (cargoNovo2 && !member.roles.cache.has(cargoNovo2.id)) await member.roles.add(cargoNovo2).catch(() => {});
        if (!db.acceptedRules) db.acceptedRules = [];
        if (!db.acceptedRules.includes(member.id)) db.acceptedRules.push(member.id);
        if (!db.acceptedRulesAt) db.acceptedRulesAt = {};
        db.acceptedRulesAt[member.id] = new Date().toISOString();
        await saveDB();
        return interaction.editReply({ content: `Regras aceites com sucesso! Bem-vind@ a comunidade da **Portugal Alfa Community** 🎉\nAqui podera ver os conteudos do Diego, conversar/conviver com o pessoal e entre outros...` }).catch(() => {});
      } catch (err) {
        console.error("[aceitar_regras] Erro:", err);
        return interaction.editReply({ content: `Erro ao processar. Tenta novamente.` }).catch(() => {});
      }
    }

    if (customId.startsWith("aceitar_regras_rec_")) {
      const parts = customId.split("_");
      const userId = parts[3];
      const nomeTrucky = parts.slice(4).join("_");
      if (interaction.user.id !== userId) { return safeReply(interaction, `Este botao nao esta disponivel para ti!`); }
      await interaction.deferReply({ flags: 64 });
      try {
        await criarTicketRecrutamento(interaction, client, nomeTrucky);
        return interaction.editReply({ content: `Ticket de recrutamento criado com sucesso!` }).catch(() => {});
      } catch (err) {
        console.error("[interactionCreate] Erro criarTicketRecrutamento:", err);
        return interaction.editReply({ content: `Erro ao criar ticket. Contacta a staff.` }).catch(() => {});
      }
    }

    if (customId.startsWith("recusar_regras_rec_")) {
      const userId = customId.split("_")[3];
      if (interaction.user.id !== userId) { return safeReply(interaction, `Este botao nao e para ti!`); }
      return interaction.update({ content: `Recrutamento cancelado. Se mudares de ideias, podes voltar a candidatar-te mais tarde.`, embeds: [], components: [] }).catch(() => {});
    }

    if (customId.startsWith("assumir_")) {
      const ticketId = customId.replace("assumir_", "");
      try { await interaction.deferReply({ flags: 64 }); } catch (e) { return; }
      if (!isStaff(interaction.member)) { return interaction.editReply({ content: `Apenas staff pode assumir tickets.` }).catch(() => {}); }
      if (isClaiming(ticketId)) { return interaction.editReply({ content: `Outro staff ja esta a assumir este ticket. Aguarda...` }).catch(() => {}); }
      console.log(`[Assumir] TicketId: ${ticketId}, User: ${interaction.user.id}`);
      let ticket = db.tickets[ticketId];
      if (!ticket && interaction.channelId) { ticket = findTicketByChannelId(interaction.channelId); }
      if (!ticket || ticket.closed) { return interaction.editReply({ content: `Ticket nao encontrado ou ja fechado.` }).catch(() => {}); }
      if (ticket.claimedBy) { return interaction.editReply({ content: `Este ticket ja foi assumido por <@${ticket.claimedBy}>.` }).catch(() => {}); }
      setClaiming(ticketId, interaction.user.id);
      try {
        await withTicketLock(ticketId, async () => {
          const t = db.tickets[ticketId];
          if (!t || t.closed || t.claimedBy) throw new Error("TICKET_ALREADY_CLAIMED");
          t.claimedBy = interaction.user.id;
          t.claimedByName = interaction.user.username;
          await saveDB();
        });
        const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
        if (!channel) { clearClaiming(ticketId); return interaction.editReply({ content: `Erro: Canal do ticket nao encontrado.` }).catch(() => {}); }
        await updateTicketEmbed(channel, ticketId);
        await channel.send(`Ticket assumido com sucesso!\n<@${interaction.user.id}> assumiu o teu ticket. Se precisares de chamar a staff, usa a opcao **Painel Membro**.`);
        return interaction.editReply({ content: `Ola <@${interaction.user.id}>, informo-te que podes usar o **/painelstaff** para teres mais acesso ao ticket se precisares.` }).catch(() => {});
      } catch (err) {
        console.error("[Assumir] Erro:", err);
        if (err.message === "TICKET_ALREADY_CLAIMED") { return interaction.editReply({ content: `Este ticket ja foi assumido.` }).catch(() => {}); }
        return interaction.editReply({ content: `Erro ao assumir ticket. Tenta novamente.` }).catch(() => {});
      } finally { clearClaiming(ticketId); }
    }

    if (customId.startsWith("painel_membro_")) {
      const ticketId = customId.replace("painel_membro_", "");
      try { await interaction.deferReply({ flags: 64 }); } catch (e) { return; }
      let ticket = db.tickets[ticketId];
      if (!ticket && interaction.channelId) { ticket = findTicketByChannelId(interaction.channelId); }
      if (!ticket || ticket.closed) { return interaction.editReply({ content: `Ticket nao encontrado ou ja fechado.` }).catch(() => {}); }
      const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
      if (!guild) { return interaction.editReply({ content: `Erro ao aceder ao servidor.` }).catch(() => {}); }
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) { return interaction.editReply({ content: `Canal nao encontrado.` }).catch(() => {}); }
      const members = await channel.members.fetch();
      const staffList = [];
      for (const [memberId, member] of members) {
        if (memberId === CONFIG.BOT_ID_EXCLUIR) continue;
        if (memberId === ticket.userId) continue;
        const perms = channel.permissionsFor(member);
        if (perms && perms.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages)) {
          const highestRole = member.roles.cache.sort((a, b) => b.position - a.position).first();
          staffList.push({ member, rolePosition: highestRole ? highestRole.position : 0, roleName: highestRole ? highestRole.name : "Sem cargo", displayName: member.user.username });
        }
      }
      staffList.sort((a, b) => { if (b.rolePosition !== a.rolePosition) return b.rolePosition - a.rolePosition; return a.displayName.localeCompare(b.displayName); });
      if (staffList.length === 0) { return interaction.editReply({ content: `Nenhum membro da staff encontrado neste ticket.` }).catch(() => {}); }
      const staffText = staffList.map(s => `**${s.roleName}** | ${s.displayName} | <@${s.member.id}>`).join("\n");
      const embed = new EmbedBuilder().setTitle(`Painel Membro`).setDescription([`Lista de staff disponivel neste ticket:`, "", staffText].join("\n")).setColor(CONFIG.COR_PRINCIPAL);
      return interaction.editReply({ embeds: [embed] }).catch(() => {});
    }

    if (customId.startsWith("sair_")) {
      const ticketId = customId.replace("sair_", "");
      try { await interaction.deferReply({ flags: 64 }); } catch (e) { return; }
      let ticket = db.tickets[ticketId];
      if (!ticket && interaction.channelId) { ticket = findTicketByChannelId(interaction.channelId); }
      if (!ticket || ticket.closed) { return interaction.editReply({ content: `Ticket nao encontrado ou ja fechado.` }).catch(() => {}); }
      if (ticket.userId !== interaction.user.id) { return interaction.editReply({ content: `So quem abriu o ticket pode sair.` }).catch(() => {}); }
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) { return interaction.editReply({ content: `Canal do ticket nao encontrado.` }).catch(() => {}); }
      const overwrite = channel.permissionOverwrites.cache.get(interaction.user.id);
      if (!overwrite) { return interaction.editReply({ content: `Ja saiste deste ticket.` }).catch(() => {}); }
      await channel.permissionOverwrites.delete(interaction.user.id);
      return interaction.editReply({ content: `Saiste do ticket com sucesso.` }).catch(() => {});
    }

    if (customId.startsWith("deletar_")) {
      const ticketId = customId.replace("deletar_", "");
      if (isClosing(ticketId)) { return safeReply(interaction, `Este ticket ja esta a ser fechado. Aguarda...`); }
      let ticket = db.tickets[ticketId];
      if (!ticket && interaction.channelId) { ticket = findTicketByChannelId(interaction.channelId); }
      if (!ticket || ticket.closed) { return safeReply(interaction, `Ticket nao encontrado ou ja fechado.`); }
      if (!isStaff(interaction.member)) { return safeReply(interaction, `Apenas staff pode fechar tickets.`); }
      if (ticket.type === "recrutamento") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`recrutado_sim_${ticketId}`).setLabel(`Sim - Recrutado`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`recrutado_nao_${ticketId}`).setLabel(`Nao - Nao Recrutado`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`fechar_definitivo_${ticketId}`).setLabel(`Fechar Definitivo (Nao Recrutamento)`).setStyle(ButtonStyle.Secondary),
        );
        return interaction.reply({ content: `O candidato foi recrutado?`, components: [row] }).catch(() => {});
      } else {
        return fecharTicket(interaction, ticketId, client, false);
      }
    }

    if (customId.startsWith("recrutado_sim_")) {
      const ticketId = customId.replace("recrutado_sim_", "");
      if (isClosing(ticketId)) { return safeReply(interaction, `Este ticket ja esta a ser fechado.`); }
      let ticket = db.tickets[ticketId];
      if (!ticket && interaction.channelId) { ticket = findTicketByChannelId(interaction.channelId); }
      if (!ticket || ticket.closed || ticket.recrutado) { return safeReply(interaction, `Ticket nao encontrado, ja fechado ou ja recrutado.`); }
      if (!isStaff(interaction.member)) { return safeReply(interaction, `Apenas staff pode confirmar recrutamento.`); }
      const modal = new ModalBuilder().setCustomId(`modal_foto_trucky_${ticketId}`).setTitle(`Nome da Foto do Trucky`);
      const input = new TextInputBuilder().setCustomId("foto_nome").setLabel("Nome da tua foto de perfil do Trucky").setPlaceholder("Ex: Diego").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (customId.startsWith("recrutado_nao_")) {
      const ticketId = customId.replace("recrutado_nao_", "");
      if (!isStaff(interaction.member)) { return safeReply(interaction, `Apenas staff pode marcar como nao recrutado.`); }
      return fecharTicket(interaction, ticketId, client, false);
    }

    if (customId.startsWith("fechar_definitivo_")) {
      const ticketId = customId.replace("fechar_definitivo_", "");
      if (!isStaff(interaction.member)) { return safeReply(interaction, `Apenas staff pode fechar tickets.`); }
      return fecharTicket(interaction, ticketId, client, false);
    }

    if (customId.startsWith("avaliar_")) {
      const parts = customId.split("_");
      const ticketId = parts[1];
      const estrelas = parseInt(parts[2], 10);
      let ticket = db.tickets[ticketId];
      if (!ticket) { return safeReply(interaction, `Ticket nao encontrado.`); }
      if (ticket.rating !== undefined && ticket.rating !== null) { return safeReply(interaction, `Ja avaliaste este ticket!`); }
      ticket.rating = estrelas;
      await saveDB();
      const stars = "⭐".repeat(estrelas);
      const embed = new EmbedBuilder().setTitle(`Obrigado pela tua avaliacao!`).setDescription([`Avaliacao: ${stars} (${estrelas}/5)`, "", `O teu feedback e muito importante para melhorarmos o atendimento.`].join("\n")).setColor(CONFIG.COR_SUCESSO || 0x00ff00).setTimestamp();
      try { await interaction.update({ embeds: [embed], components: [] }); }
      catch (e) { return safeReply(interaction, `Avaliacao registada: ${stars} (${estrelas}/5)`); }
      return;
    }

    if (customId === "ajuda_procurar") { return handleAjudaProcurar(interaction, client); }
    if (customId === "ajuda_ticket") { return createTicket(interaction, "ajuda", `Pedir ajuda`, client); }
    if (customId.startsWith("ajuda_feedback_")) { return handleAjudaFeedback(interaction, client); }

    console.log(`[Interaction] Botao desconhecido: ${customId}`);
    return safeReply(interaction, `Acao nao reconhecida.`);
  }
}

function generateTranscriptHTML(messages, ticket, guild) {
  const msgs = messages.map(m => {
    const time = new Date(m.createdTimestamp).toLocaleString('pt-PT');
    const avatar = m.author.displayAvatarURL({ size: 64 });
    let content = escapeHTML(m.content) || ''; 
    if (m.attachments.size > 0) {
      content += '<br>' + Array.from(m.attachments.values()).map(a => {
        if (a.contentType?.startsWith('image/')) { return `<img src="${a.url}" style="max-width:300px;border-radius:8px;margin-top:5px;">`; }
        return `<a href="${a.url}" target="_blank">📎 ${escapeHTML(a.name)}</a>`;
      }).join('<br>');
    }
    if (m.embeds.length > 0) {
      content += '<br><div style="border-left:4px solid #5865F2;padding:8px;margin-top:5px;background:#2f3136;border-radius:4px;">' +
        m.embeds.map(e => {
          let html = '';
          if (e.title) html += `<div style="font-weight:bold;color:#fff;">${escapeHTML(e.title)}</div>`;
          if (e.description) html += `<div style="color:#dcddde;margin-top:4px;">${escapeHTML(e.description).replace(/\n/g, '<br>')}</div>`;
          return html;
        }).join('') + '</div>';
    }
    return `<div style="display:flex;gap:12px;margin-bottom:12px;"><img src="${avatar}" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;"><div style="flex:1;"><div style="font-weight:bold;color:#fff;">${escapeHTML(m.author.tag)} <span style="color:#72767d;font-size:12px;font-weight:normal;">${time}</span></div><div style="color:#dcddde;word-break:break-word;">${content}</div></div></div>`;
  }).join('');
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>Transcript Ticket #${ticket.id}</title><style>body{background:#36393f;color:#dcddde;font-family:'Segoe UI',sans-serif;margin:0;padding:20px;}.header{background:#2f3136;padding:20px;border-radius:8px;margin-bottom:20px;}.header h1{margin:0;color:#fff;font-size:20px;}.header p{margin:8px 0 0;color:#b9bbbe;font-size:14px;}.messages{background:#2f3136;padding:20px;border-radius:8px;}</style></head><body><div class="header"><h1>Transcript - Ticket #${ticket.id}</h1><p>Tipo: ${escapeHTML(ticket.label)} | Utilizador: ${escapeHTML(ticket.username)} | Servidor: ${escapeHTML(guild?.name || 'N/A')}</p></div><div class="messages">${msgs}</div></body></html>`;
}

async function handleFotoTruckyModal(interaction, client) {
  const ticketId = interaction.customId.replace("modal_foto_trucky_", "");
  const fotoNome = interaction.fields.getTextInputValue("foto_nome")?.trim();
  let ticket = db.tickets[ticketId];
  if (!ticket && interaction.channelId) { ticket = findTicketByChannelId(interaction.channelId); }
  if (!ticket || ticket.closed) { return interaction.editReply({ content: `Ticket nao encontrado ou ja fechado.`, flags: 64 }).catch(() => {}); }
  try {
    await withTicketLock(ticketId, async () => {
      const t = db.tickets[ticketId];
      if (!t || t.closed) throw new Error("TICKET_CLOSED");
      t.fotoNome = fotoNome;
      t.recrutado = true;
      await saveDB();
    });
    const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(ticket.userId).catch(() => null);
      if (member) {
        if (CONFIG.CARGO_RECRUTADO) await member.roles.add(CONFIG.CARGO_RECRUTADO).catch(() => {});
        if (CONFIG.CARGO_RECRUTAMENTO_1) await member.roles.add(CONFIG.CARGO_RECRUTAMENTO_1).catch(() => {});
      }
    }
    try {
      const geral = await client.channels.fetch(CONFIG.CANAL_GERAL).catch(() => null);
      if (geral) {
        const welcomeEmbed = new EmbedBuilder().setTitle(`Bem-vindo a Portugal Alfa Truckers!`).setDescription([`Parabens <@${ticket.userId}>!`,`Foste recrutado com sucesso para a Portugal Alfa Truckers.`,``,`Nome Trucky: **${escapeHTML(fotoNome)}**`].join("\n")).setColor(CONFIG.COR_SUCESSO || 0x00ff00).setTimestamp();
        await geral.send({ embeds: [welcomeEmbed] });
      }
    } catch (e) { console.error("[handleFotoTruckyModal] Erro boas-vindas:", e); }
    await fecharTicket(interaction, ticketId, client, true);
    return interaction.editReply({ content: `Recrutamento confirmado! Ticket fechado.`, flags: 64 }).catch(() => {});
  } catch (err) {
    console.error("[handleFotoTruckyModal] Erro:", err);
    return interaction.editReply({ content: `Erro ao processar recrutamento.`, flags: 64 }).catch(() => {});
  }
}

async function fecharTicket(interaction, ticketId, client, recrutado = false) {
  if (isClosing(ticketId)) { return safeReply(interaction, `Este ticket ja esta a ser fechado. Aguarda...`); }
  setClosing(ticketId);
  let ticket = db.tickets[ticketId];
  if (!ticket && interaction.channelId) { ticket = findTicketByChannelId(interaction.channelId); }
  if (!ticket || ticket.closed) { clearClosing(ticketId); return safeReply(interaction, `Ticket nao encontrado ou ja fechado.`); }
  try {
    await withTicketLock(ticketId, async () => {
      const t = db.tickets[ticketId];
      if (!t || t.closed) throw new Error("TICKET_ALREADY_CLOSED");
      t.closed = true;
      t.closedBy = interaction.user.id;
      t.closedByName = interaction.user.username;
      t.closedAt = new Date().toISOString();
      t.recrutado = recrutado;
      await saveDB();
    });
    await sendLog(ticketId, "close", client);
    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (channel) {
      const closeEmbed = new EmbedBuilder().setTitle(`Ticket Fechado - #${ticketId}`).setDescription([
        `Ticket fechado por <@${interaction.user.id}> | ${interaction.user.username}`,
        `Tipo: ${ticket.label}`,
        `Fechado: <t:${Math.floor(Date.now() / 1000)}:F>`,
      ].join("\n")).setColor(0xFF0000).setTimestamp();
      await channel.send({ embeds: [closeEmbed] }).catch(() => {});
    }
    try {
      const user = await client.users.fetch(ticket.userId);
      if (user) {
        const dmEmbed = new EmbedBuilder().setTitle(`Ticket Fechado`).setDescription([
          `Ola <@${ticket.userId}>!`,
          ``,
          `O teu ticket **#${ticketId}** foi fechado.`,
          `Tipo: ${ticket.label}`,
          `Fechado por: ${ticket.closedByName}`,
          `Data: <t:${Math.floor(Date.now() / 1000)}:F>`,
          ``,
          `Queres avaliar o atendimento? Clica numa das estrelas abaixo:`
        ].join("\n")).setColor(0xFF0000).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_1`).setLabel("1").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_2`).setLabel("2").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_3`).setLabel("3").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_4`).setLabel("4").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`avaliar_${ticketId}_5`).setLabel("5").setStyle(ButtonStyle.Secondary),
        );
        await user.send({ embeds: [dmEmbed], components: [row] }).catch(() => {});
      }
    } catch (e) { console.error("[fecharTicket] Erro ao enviar DM:", e); }
    if (channel) { setTimeout(() => { channel.delete().catch(() => {}); }, 10000); }
    return safeReply(interaction, `Ticket #${ticketId} fechado com sucesso.`);
  } catch (err) {
    console.error("[fecharTicket] Erro:", err);
    clearClosing(ticketId);
    return safeReply(interaction, `Erro ao fechar ticket. Tenta novamente.`);
  } finally { setTimeout(() => clearClosing(ticketId), 15000); }
}

async function enviarPainelMembro(interaction) {
  try { await interaction.deferReply({ flags: 64 }); } catch (e) { return; }
  let ticket = Object.values(db.tickets || {}).find(t => t.channelId === interaction.channelId && !t.closed);
  if (!ticket) { return interaction.editReply({ content: `Nenhum ticket ativo encontrado neste canal.`, flags: 64 }).catch(() => {}); }
  const channel = interaction.channel;
  const members = await channel.members.fetch();
  const staffList = [];
  for (const [memberId, member] of members) {
    if (memberId === CONFIG.BOT_ID_EXCLUIR) continue;
    if (memberId === ticket.userId) continue;
    const perms = channel.permissionsFor(member);
    if (perms && perms.has(PermissionFlagsBits.ViewChannel) && perms.has(PermissionFlagsBits.SendMessages)) {
      const highestRole = member.roles.cache.sort((a, b) => b.position - a.position).first();
      staffList.push({ member, rolePosition: highestRole ? highestRole.position : 0, roleName: highestRole ? highestRole.name : "Sem cargo", displayName: member.user.username });
    }
  }
  staffList.sort((a, b) => { if (b.rolePosition !== a.rolePosition) return b.rolePosition - a.rolePosition; return a.displayName.localeCompare(b.displayName); });
  if (staffList.length === 0) { return interaction.editReply({ content: `Nenhum membro da staff encontrado neste ticket.`, flags: 64 }).catch(() => {}); }
  const staffText = staffList.map(s => `**${s.roleName}** | ${s.displayName} | <@${s.member.id}>`).join("\n");
  const embed = new EmbedBuilder().setTitle(`Painel Membro`).setDescription([`Lista de staff disponivel neste ticket:`, "", staffText].join("\n")).setColor(CONFIG.COR_PRINCIPAL);
  return interaction.editReply({ embeds: [embed], flags: 64 }).catch(() => {});
}

async function enviarPainelStaff(interaction, client) {
  try { await interaction.deferReply({ flags: 64 }); } catch (e) { return; }
  let ticket = Object.values(db.tickets || {}).find(t => t.channelId === interaction.channelId && !t.closed);
  if (!ticket) { return interaction.editReply({ content: `Nenhum ticket ativo encontrado neste canal.`, flags: 64 }).catch(() => {}); }
  await sendPainelChamada(interaction.channel, ticket.id, interaction);
  return interaction.editReply({ content: `Painel de chamada enviado.`, flags: 64 }).catch(() => {});
}
