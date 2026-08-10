import {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { createTicket, criarTicketRecrutamento, handleTruckyVerification, updateTicketEmbed, isClaiming, setClaiming, clearClaiming, findTicketByChannelId } from "../services/tickets.js";
import { sendLog } from "../services/logs.js";
import { sendPainelChamada } from "../services/calls.js";

const processingRegras = new Map();

export async function handleInteractionCreate(interaction, client) {

  // ============ COMANDOS SLASH ============
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "transcript") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && 
          !interaction.member.roles.cache.has(CONFIG.CARGO_STAFF)) {
        return interaction.reply({ 
          content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, 
          flags: 64 
        });
      }

      const ticket = Object.values(db.tickets).find(t => t.channelId === interaction.channelId && !t.closed);
      if (!ticket) {
        return interaction.reply({ content: `⚠️ Nenhum ticket ativo encontrado neste canal.`, flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        const htmlContent = generateTranscriptHTML(sortedMessages, ticket, interaction.guild);
        const buffer = Buffer.from(htmlContent, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-ticket-${ticket.id}.html` });

        let textSummary = `📋 **Transcript do Ticket #${ticket.id}**\n\n`;
        sortedMessages.forEach(msg => {
          const content = msg.content || "[sem texto]";
          textSummary += `\`[${msg.createdAt.toLocaleString('pt-PT')}]\` **${msg.author.tag}**: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}\n`;
        });

        await interaction.editReply({
          content: textSummary.substring(0, 1900),
          files: [attachment],
        });
      } catch (err) {
        console.error("[Transcript] Erro:", err);
        await interaction.editReply({ content: `❌ Erro ao gerar transcript.` });
      }
      return;
    }

    if (interaction.commandName === "painelmembro") {
      return enviarPainelMembro(interaction);
    }

    if (interaction.commandName === "painelstaff") {
      return enviarPainelStaff(interaction, client);
    }

    return;
  }

  // ============ MODAIS ============
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

  // ============ SELECT MENUS ============
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "ticket_geral") {
      const value = interaction.values[0];
      const labels = {
        bugs: `🐛 Bugs`,
        denuncia: `🚨 Denúncia`,
        suporte: `🔧 Suporte`,
        criador: `🎥 Criador De Conteúdo`
      };
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
          .setTitle(`❓ Especificações do Problema`);
        const input = new TextInputBuilder()
          .setCustomId("ajuda_especificacoes")
          .setLabel("Descreve o teu problema ou dúvida")
          .setPlaceholder("Ex: Não consigo instalar o Trucky App...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }

    return;
  }

  // ============ BOTOES ============
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // --- ACEITAR REGRAS ---
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
        const cargoNovo1 = interaction.guild.roles.cache.get("1534970663344017479");
        const cargoNovo2 = interaction.guild.roles.cache.get("1146443166686396476");

        const temMembro = !cargoMembro || member.roles.cache.has(cargoMembro.id);
        const temNovo1 = !cargoNovo1 || member.roles.cache.has(cargoNovo1.id);
        const temNovo2 = !cargoNovo2 || member.roles.cache.has(cargoNovo2.id);

        if (temMembro && temNovo1 && temNovo2) {
          const acceptedAt = db.acceptedRulesAt?.[member.id];
          if (acceptedAt) {
            const ts = Math.floor(new Date(acceptedAt).getTime() / 1000);
            return interaction.editReply({
              content: `✅ As regras ja foram aceites! Aceitaste <t:${ts}:R>.`
            }).catch(() => {});
          }
          return interaction.editReply({
            content: `✅ As regras ja foram aceites anteriormente!`
          }).catch(() => {});
        }

        if (cargoMembro && !member.roles.cache.has(cargoMembro.id)) await member.roles.add(cargoMembro).catch(() => {});
        if (cargoNovo1 && !member.roles.cache.has(cargoNovo1.id)) await member.roles.add(cargoNovo1).catch(() => {});
        if (cargoNovo2 && !member.roles.cache.has(cargoNovo2.id)) await member.roles.add(cargoNovo2).catch(() => {});

        if (!db.acceptedRules) db.acceptedRules = [];
        if (!db.acceptedRules.includes(member.id)) {
          db.acceptedRules.push(member.id);
        }
        if (!db.acceptedRulesAt) db.acceptedRulesAt = {};
        db.acceptedRulesAt[member.id] = new Date().toISOString();
        await saveDB();

        return interaction.editReply({
          content: `✅ Regras aceites com sucesso! Bem-vind@ a comunidade da __**\`Portugal Alfa Community\`**__ 🎉
Aqui podera ver os conteudos do Diego, conversar/conviver com o pessoal e entre outros...`
        }).catch(() => {});
      } catch (err) {
        console.error("[aceitar_regras] Erro:", err);
        return interaction.editReply({ content: `❌ Erro ao processar. Tenta novamente.` }).catch(() => {});
      }
    }

    // --- ACEITAR REGRAS RECRUTAMENTO ---
    if (customId.startsWith("aceitar_regras_rec_")) {
      const parts = customId.split("_");
      const userId = parts[3];
      const nomeTrucky = parts.slice(4).join("_");
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: `⚠️ Este botão não está disponível para ti!`, flags: 64 });
      }
      await interaction.deferReply({ flags: 64 });
      try {
        await criarTicketRecrutamento(interaction, client, nomeTrucky);
        return interaction.editReply({ content: `✅ Ticket de recrutamento criado com sucesso!` });
      } catch (err) {
        console.error("[interactionCreate] Erro criarTicketRecrutamento:", err);
        return interaction.editReply({ content: `❌ Erro ao criar ticket. Contacta a staff.` });
      }
    }

    // --- RECUSAR REGRAS RECRUTAMENTO ---
    if (customId.startsWith("recusar_regras_rec_")) {
      const userId = customId.split("_")[3];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: `⚠️ Este botão não é para ti!`, flags: 64 });
      }
      return interaction.update({
        content: `❌ Recrutamento cancelado. Se mudares de ideias, podes voltar a candidatar-te mais tarde.`,
        embeds: [],
        components: [],
      });
    }

    // --- ASSUMIR TICKET ---
if (customId.startsWith("assumir_")) {
  const ticketId = customId.replace("assumir_", "");

  // DEFER IMMEDIATELY
  await interaction.deferReply({ flags: 64 });

  // ✅ CORREÇÃO: VERIFICAR STAFF
  if (!isStaff(interaction.member)) {
    return interaction.editReply({ 
      content: `❌ Apenas staff pode assumir tickets.`, 
      flags: 64 
    });
  }

  console.log(`[Assumir] TicketId: ${ticketId}, User: ${interaction.user.id}`);

  if (isClaiming(ticketId)) {
    return interaction.editReply({ content: `⏳ Outro staff ja esta a assumir este ticket. Aguarda...` });
  }

  let ticket = db.tickets[ticketId];

  if (!ticket && interaction.channelId) {
    ticket = findTicketByChannelId(interaction.channelId);
    if (ticket) {
      console.log(`[Assumir] Ticket encontrado por channelId fallback: ${ticket.id}`);
    }
  }

  if (!ticket || ticket.closed) {
    return interaction.editReply({ content: `⚠️ Ticket nao encontrado ou ja fechado.` });
  }
  if (ticket.claimedBy) {
    return interaction.editReply({ content: `⚠️ Este ticket ja foi assumido por <@${ticket.claimedBy}>.` });
  }

  setClaiming(ticketId, interaction.user.id);

  try {
    ticket.claimedBy = interaction.user.id;
    ticket.claimedByName = interaction.user.username;
    await saveDB();

    const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
    if (!channel) {
      clearClaiming(ticketId);
      return interaction.editReply({ content: `❌ Erro: Canal do ticket nao encontrado.` });
    }

    await updateTicketEmbed(channel, ticketId);

    await channel.send(`🎉 Ticket assumido com sucesso!\n👮 <@${interaction.user.id}> assumiu o teu ticket. Se precisares de chamar a staff, usa a opcao **Painel Membro**.`);

    return interaction.editReply({
      content: `Olá <@${interaction.user.id}>, informo-te que podes usar o **/painelstaff** para teres mais acesso ao ticket se precisares.`,
    });
  } catch (err) {
    console.error("[Assumir] Erro:", err);
    return interaction.editReply({ content: `❌ Erro ao assumir ticket. Tenta novamente.` });
  } finally {
    clearClaiming(ticketId);
  }
}

    // --- PAINEL MEMBRO ---
    if (customId.startsWith("painel_membro_")) {
      const ticketId = customId.replace("painel_membro_", "");
      let ticket = db.tickets[ticketId];

      // Fallback por channelId
      if (!ticket && interaction.channelId) {
        ticket = findTicketByChannelId(interaction.channelId);
      }

      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket nao encontrado ou ja fechado.`, flags: 64 });
      }

      const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
      if (!guild) {
        return interaction.reply({ content: `❌ Erro ao aceder ao servidor.`, flags: 64 });
      }

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: `❌ Canal nao encontrado.`, flags: 64 });
      }

      const members = await channel.members.fetch();
      const staffList = [];

      for (const [memberId, member] of members) {
        if (memberId === CONFIG.BOT_ID_EXCLUIR) continue;
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

      if (staffList.length === 0) {
        return interaction.reply({ content: `⚠️ Nenhum membro da staff encontrado neste ticket.`, flags: 64 });
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

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // --- SAIR DO TICKET ---
    if (customId.startsWith("sair_")) {
      const ticketId = customId.replace("sair_", "");
      let ticket = db.tickets[ticketId];

      if (!ticket && interaction.channelId) {
        ticket = findTicketByChannelId(interaction.channelId);
      }

      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket nao encontrado ou ja fechado.`, flags: 64 });
      }
      if (ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: `⚠️ So quem abriu o ticket pode sair.`, flags: 64 });
      }

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: `❌ Canal do ticket nao encontrado.`, flags: 64 });
      }

      await channel.permissionOverwrites.delete(interaction.user.id);
      return interaction.reply({ content: `✅ Saíste do ticket com sucesso.`, flags: 64 });
    }

// --- FECHAR TICKET ---
if (customId.startsWith("deletar_")) {
  const ticketId = customId.replace("deletar_", "");
  let ticket = db.tickets[ticketId];

  if (!ticket && interaction.channelId) {
    ticket = findTicketByChannelId(interaction.channelId);
  }

  if (!ticket || ticket.closed) {
    return interaction.reply({ content: `⚠️ Ticket nao encontrado ou ja fechado.`, flags: 64 });
  }

  // ✅ CORREÇÃO: VERIFICAR STAFF
  if (!isStaff(interaction.member)) {
    return interaction.reply({ 
      content: `❌ Apenas staff pode fechar tickets.`, 
      flags: 64 
    });
  }

  if (ticket.type === "recrutamento") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`recrutado_sim_${ticketId}`).setLabel(`🎉 Sim - Recrutado`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`recrutado_nao_${ticketId}`).setLabel(`😔 Não - Não Recrutado`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`fechar_definitivo_${ticketId}`).setLabel(`🔒 Fechar Definitivo (Não Recrutamento)`).setStyle(ButtonStyle.Secondary),
    );

    return interaction.reply({
      content: `❓ O candidato foi recrutado?`,
      components: [row],
    });
  } else {
    return fecharTicket(interaction, ticketId, client, false);
  }
}

    // --- RECRUTADO SIM ---
if (customId.startsWith("recrutado_sim_")) {
  const ticketId = customId.replace("recrutado_sim_", "");
  let ticket = db.tickets[ticketId];
  
  if (!ticket && interaction.channelId) {
    ticket = findTicketByChannelId(interaction.channelId);
  }
  
  if (!ticket) {
    return interaction.reply({ content: `⚠️ Ticket nao encontrado.`, flags: 64 });
  }

  // ✅ CORREÇÃO: VERIFICAR STAFF
  if (!isStaff(interaction.member)) {
    return interaction.reply({ 
      content: `❌ Apenas staff pode confirmar recrutamento.`, 
      flags: 64 
    });
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
// --- RECRUTADO NAO ---
if (customId.startsWith("recrutado_nao_")) {
  const ticketId = customId.replace("recrutado_nao_", "");
  
  // ✅ CORREÇÃO: VERIFICAR STAFF
  if (!isStaff(interaction.member)) {
    return interaction.reply({ 
      content: `❌ Apenas staff pode marcar como não recrutado.`, 
      flags: 64 
    });
  }
  
  return fecharTicket(interaction, ticketId, client, false);
}
// --- FECHAR DEFINITIVO ---
if (customId.startsWith("fechar_definitivo_")) {
  const ticketId = customId.replace("fechar_definitivo_", "");
  
  // ✅ CORREÇÃO: VERIFICAR STAFF
  if (!isStaff(interaction.member)) {
    return interaction.reply({ 
      content: `❌ Apenas staff pode fechar tickets definitivamente.`, 
      flags: 64 
    });
  }
  
  return fecharTicket(interaction, ticketId, client, false);
}
    // --- AVALIACAO ESTRELAS ---
    if (customId.startsWith("avaliar_")) {
      const parts = customId.split("_");
      const ticketId = parts[1];
      const estrelas = parseInt(parts[2]);
      const ticket = db.tickets[ticketId];
      if (!ticket) return interaction.reply({ content: `⚠️ Ticket nao encontrado.`, flags: 64 });

      ticket.rating = estrelas;
      await saveDB();

      const stars = "⭐".repeat(estrelas) + "☆".repeat(5 - estrelas);
      return interaction.update({
        content: `✅ Obrigado pela tua avaliação!\n\n**Avaliação:** ${stars} (${estrelas}/5)`,
        components: [],
      });
    }

    return interaction.reply({ content: `⚠️ Ação desconhecida.`, flags: 64 }).catch(() => {});
  }
}

// ============ FUNCOES AUXILIARES ============

function generateTranscriptHTML(messages, ticket, guild) {
  const msgs = messages.map(m => {
    const avatar = m.author.displayAvatarURL({ format: 'png', size: 64 });
    const attachments = m.attachments.map(a => {
      const isImage = a.contentType?.startsWith('image/');
      if (isImage) {
        return `<a href="${a.url}" target="_blank" class="attachment-image"><img src="${a.url}" alt="${a.name}" loading="lazy"></a>`;
      }
      return `<a href="${a.url}" target="_blank" class="attachment-file">📎 ${a.name}</a>`;
    }).join(' ');
    const embeds = m.embeds.length > 0 ? `[${m.embeds.length} embed(s)]` : '';
    const time = m.createdAt.toLocaleString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = m.createdAt.toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return `
      <div class="message">
        <img src="${avatar}" class="avatar" alt="${m.author.tag}">
        <div class="message-content">
          <div class="message-header">
            <span class="author">${m.author.tag}</span>
            <span class="timestamp">${date} às ${time}</span>
          </div>
          <div class="message-body">${m.content ? m.content.replace(/\n/g, '<br>') : '<em class="empty">[sem texto]</em>'}</div>
          ${attachments ? `<div class="attachments">${attachments}</div>` : ''}
          ${embeds ? `<div class="embeds-info">${embeds}</div>` : ''}
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
  const ticketId = interaction.customId.replace("modal_foto_trucky_", "");
  let ticket = db.tickets[ticketId];
  if (!ticket && interaction.channelId) {
    ticket = findTicketByChannelId(interaction.channelId);
  }
  if (!ticket) return interaction.editReply({ content: `⚠️ Ticket nao encontrado.` }).catch(() => {});

  let fotoNome = interaction.fields.getTextInputValue("foto_nome")?.trim() || "Não informado";
  fotoNome = fotoNome.replace(/\.[^/.]+$/, "");

  ticket.fotoNome = fotoNome;
  ticket.recrutado = true;
  ticket.closedBy = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  ticket.closedAt = new Date().toISOString();
  await saveDB();

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
      `🎉 Bem-vindo à Portugal Alfa Truckers!`,
      ``,
      `Parabéns <@${ticket.userId}>! Foste recrutado com sucesso.`,
      `✅ Segue as <#1200170228093550712> e diverte-te!`,
      `🚛 A tua foto de perfil para o Trucky ficará disponível em <#${CONFIG.CANAL_TEMPLATE_FOTO}>.`,
      `ℹ️ Caso precises de ajuda, abre um ticket ou coloca a tua dúvida num chat aberto.`
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
          `🎫 Caso necessário, não hesite em abrir ticket novamente!`
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
      console.log("Não foi possível enviar DM ao user:", e.message);
    }

    setTimeout(async () => {
      await channel.delete().catch(() => {});
    }, 10000);
  }

  return interaction.editReply({
    content: `✅ Utilizador recrutado com sucesso! Foto do Trucky: **${fotoNome}**.\n🗑️ Ticket será fechado em 10 segundos...`,
  }).catch(() => {});
}

async function fecharTicket(interaction, ticketId, client, recrutado) {
  let ticket = db.tickets[ticketId];
  if (!ticket && interaction.channelId) {
    ticket = findTicketByChannelId(interaction.channelId);
  }
  if (!ticket) return interaction.reply({ content: `⚠️ Ticket nao encontrado.`, flags: 64 });

  ticket.closed = true;
  ticket.recrutado = recrutado;
  ticket.closedBy = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  ticket.closedAt = new Date().toISOString();
  await saveDB();

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
          `🎫 Caso necessário, não hesite em abrir ticket novamente!`
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
      console.log("Não foi possível enviar DM ao user:", e.message);
    }

    setTimeout(async () => {
      await channel.delete().catch(() => {});
    }, 10000);
  }

  return interaction.reply({ content: `✅ Ticket fechado com sucesso!`, flags: 64 });
}

async function enviarPainelMembro(interaction) {
  const ticket = Object.values(db.tickets).find(t => t.channelId === interaction.channelId && !t.closed);
  if (!ticket) {
    return interaction.reply({ content: `⚠️ Nenhum ticket ativo encontrado neste canal.`, flags: 64 });
  }

  const guild = interaction.guild;
  const channel = interaction.channel;

  const members = await channel.members.fetch();
  const staffList = [];

  for (const [memberId, member] of members) {
    if (memberId === CONFIG.BOT_ID_EXCLUIR) continue;
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

  if (staffList.length === 0) {
    return interaction.reply({ content: `⚠️ Nenhum membro da staff encontrado neste ticket.`, flags: 64 });
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

  return interaction.reply({ embeds: [embed], flags: 64 });
}

async function enviarPainelStaff(interaction, client) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && 
      !interaction.member.roles.cache.has(CONFIG.CARGO_STAFF)) {
    return interaction.reply({ 
      content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, 
      flags: 64 
    });
  }

  const ticket = Object.values(db.tickets).find(t => t.channelId === interaction.channelId && !t.closed);
  if (!ticket) {
    return interaction.reply({ content: `⚠️ Nenhum ticket ativo encontrado neste canal.`, flags: 64 });
  }

  return sendPainelChamada(interaction.channel, ticket.id, interaction);
}
