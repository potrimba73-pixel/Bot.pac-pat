import {
  Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { createTicket, criarTicketRecrutamento, handleTruckyVerification, updateTicketEmbed } from "../services/tickets.js";
import { sendLog } from "../services/logs.js";

export async function handleInteractionCreate(interaction, client) {

  // ============ COMANDOS SLASH ============
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "transcript") {
      const ticket = Object.values(db.tickets).find(t => t.channelId === interaction.channelId && !t.closed);
      if (!ticket) {
        return interaction.reply({ content: `⚠️ Nenhum ticket ativo encontrado neste canal.`, flags: 64 });
      }

      await interaction.deferReply({ flags: 64 });

      try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        // Gerar HTML profissional
        const htmlContent = generateTranscriptHTML(sortedMessages, ticket, interaction.guild);
        const buffer = Buffer.from(htmlContent, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-ticket-${ticket.id}.html` });

        // Resumo em texto
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
      if (!db.acceptedRules) db.acceptedRules = [];

      // Verifica se já aceitou
      if (db.acceptedRules.includes(member.id)) {
        const acceptedAt = db.acceptedRulesAt?.[member.id];
        if (acceptedAt) {
          const ts = Math.floor(new Date(acceptedAt).getTime() / 1000);
          return interaction.reply({ 
            content: `✅ As regras já foram aceites! Aceitaste <t:${ts}:R>.`, 
            flags: 64 
          });
        }
        return interaction.reply({ 
          content: `✅ As regras já foram aceites anteriormente!`, 
          flags: 64 
        });
      }

      // Primeira vez que aceita
      db.acceptedRules.push(member.id);
      if (!db.acceptedRulesAt) db.acceptedRulesAt = {};
      db.acceptedRulesAt[member.id] = new Date().toISOString();
      await saveDB();

      const cargoMembro = interaction.guild.roles.cache.get(CONFIG.CARGO_MEMBRO);
      const cargoVerificado = interaction.guild.roles.cache.get(CONFIG.CARGO_VERIFICADO);
      if (cargoMembro) await member.roles.add(cargoMembro).catch(() => {});
      if (cargoVerificado) await member.roles.add(cargoVerificado).catch(() => {});

      return interaction.reply({ 
        content: `✅ Regras aceites com sucesso! Bem-vindo à comunidade 🎉.`, 
        flags: 64 
      });
    }

    // --- ACEITAR REGRAS RECRUTAMENTO ---
    if (customId.startsWith("aceitar_regras_rec_")) {
      const parts = customId.split("_");
      const userId = parts[3];
      const nomeTrucky = parts.slice(4).join("_");
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: `⚠️ Este botão não é para ti!`, flags: 64 });
      }
      // DEFER imediatamente — criar canal pode demorar
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
      const ticket = db.tickets[ticketId];
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket não encontrado ou já fechado.`, flags: 64 });
      }
      if (ticket.claimedBy) {
        return interaction.reply({ content: `⚠️ Este ticket já foi assumido por <@${ticket.claimedBy}>.`, flags: 64 });
      }

      ticket.claimedBy = interaction.user.id;
      ticket.claimedByName = interaction.user.username;
      await saveDB();

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: `❌ Erro: Canal do ticket não encontrado.`, flags: 64 });
      }

      await updateTicketEmbed(channel, ticketId);
      await channel.send(`👮 <@${interaction.user.id}> | ${interaction.user.username} assumiu este ticket. Se precisares de chamar a staff, usa a opção **Painel Membro**.`);
      return interaction.reply({
        content: `🎉 Ticket assumido com sucesso!\n\nOlá <@${interaction.user.id}>, sabias que podes usar o **/painelstaff** para teres mais acesso ao ticket.\nSe precisares de chamar a staff, usa a opção **Painel Membro**.`,
        flags: 64
      });
    }

    // --- PAINEL MEMBRO ---
    if (customId.startsWith("painel_membro_")) {
      const ticketId = customId.replace("painel_membro_", "");
      const ticket = db.tickets[ticketId];
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket não encontrado ou já fechado.`, flags: 64 });
      }

      const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
      if (!guild) {
        return interaction.reply({ content: `❌ Erro ao aceder ao servidor.`, flags: 64 });
      }

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: `❌ Canal não encontrado.`, flags: 64 });
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
          `📋 Lista de staff disponível neste ticket:`,
          "",
          staffText
        ].join("\n"))
        .setColor(CONFIG.COR_PRINCIPAL);

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // --- SAIR DO TICKET ---
    if (customId.startsWith("sair_")) {
      const ticketId = customId.replace("sair_", "");
      const ticket = db.tickets[ticketId];
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket não encontrado ou já fechado.`, flags: 64 });
      }
      if (ticket.userId !== interaction.user.id) {
        return interaction.reply({ content: `⚠️ Só quem abriu o ticket pode sair.`, flags: 64 });
      }

      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: `❌ Canal do ticket não encontrado.`, flags: 64 });
      }

      await channel.permissionOverwrites.delete(interaction.user.id);
      return interaction.reply({ content: `✅ Saíste do ticket com sucesso.`, flags: 64 });
    }

    // --- FECHAR TICKET ---
    if (customId.startsWith("deletar_")) {
      const ticketId = customId.replace("deletar_", "");
      const ticket = db.tickets[ticketId];
      if (!ticket || ticket.closed) {
        return interaction.reply({ content: `⚠️ Ticket não encontrado ou já fechado.`, flags: 64 });
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
      const ticket = db.tickets[ticketId];
      if (!ticket) {
        return interaction.reply({ content: `⚠️ Ticket não encontrado.`, flags: 64 });
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
      return fecharTicket(interaction, ticketId, client, false);
    }

    // --- FECHAR DEFINITIVO ---
    if (customId.startsWith("fechar_definitivo_")) {
      const ticketId = customId.replace("fechar_definitivo_", "");
      return fecharTicket(interaction, ticketId, client, false);
    }

    // Botao desconhecido
    return interaction.reply({ content: `⚠️ Ação desconhecida.`, flags: 64 }).catch(() => {});
  }
}

// ============ FUNCOES AUXILIARES ============

function generateTranscriptHTML(messages, ticket, guild) {
  const msgs = messages.map(m => {
    const avatar = m.author.displayAvatarURL({ format: 'png', size: 64 });
    const attachments = m.attachments.map(a => `<a href="${a.url}" target="_blank">📎 ${a.name}</a>`).join(' ');
    const embeds = m.embeds.length > 0 ? `<span class="embed">[${m.embeds.length} embed(s)]</span>` : '';
    const time = m.createdAt.toLocaleString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = m.createdAt.toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return `
    <div class="message">
      <img src="${avatar}" class="avatar" alt="${m.author.tag}">
      <div class="content">
        <div class="header">
          <span class="username" style="color: ${m.member?.displayHexColor || '#fff'}">${m.author.tag}</span>
          <span class="timestamp">${date} às ${time}</span>
        </div>
        <div class="text">${m.content || ''}</div>
        <div class="attachments">${attachments}</div>
        ${embeds}
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Transcript - Ticket #${ticket.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #36393f; color: #dcddde; font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
    .header { background: #2f3136; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #5865f2; }
    .header h1 { color: #fff; font-size: 24px; margin-bottom: 10px; }
    .header p { color: #b9bbbe; font-size: 14px; }
    .message { display: flex; padding: 8px 16px; margin: 2px 0; border-radius: 4px; transition: background 0.1s; }
    .message:hover { background: rgba(255,255,255,0.03); }
    .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 16px; flex-shrink: 0; }
    .content { flex: 1; }
    .header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; background: transparent; padding: 0; border: none; }
    .username { font-weight: 600; font-size: 16px; }
    .timestamp { color: #72767d; font-size: 12px; }
    .text { color: #dcddde; font-size: 15px; line-height: 1.4; word-wrap: break-word; }
    .attachments { margin-top: 4px; }
    .attachments a { color: #00b0f4; text-decoration: none; font-size: 14px; }
    .attachments a:hover { text-decoration: underline; }
    .embed { color: #72767d; font-size: 12px; font-style: italic; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #40444b; text-align: center; color: #72767d; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎫 Transcript do Ticket #${ticket.id}</h1>
    <p>📋 Tipo: ${ticket.label} | 👤 Utilizador: ${ticket.username} | 🏢 Servidor: ${guild?.name || 'N/A'}</p>
    <p>⏰ Abertura: ${new Date(ticket.openedAt).toLocaleString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>
  ${msgs}
  <div class="footer">
    <p>Transcript gerado automaticamente por Portugal Alfa Community Bot</p>
    <p>${new Date().toLocaleString('pt-PT')}</p>
  </div>
</body>
</html>`;
}

async function handleFotoTruckyModal(interaction, client) {
  const ticketId = interaction.customId.replace("modal_foto_trucky_", "");
  const ticket = db.tickets[ticketId];
  if (!ticket) return interaction.reply({ content: `⚠️ Ticket não encontrado.`, flags: 64 });

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
      `✅ Segue as regras da empresa e diverte-te!`,
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
          `🎫 Ticket ID: #${ticket.id}`,
          `📝 Tipo: ${ticket.label}`,
          ``,
          `👮 Fechado por:`,
          `${interaction.user.username}`,
          ``,
          `⏰ Fechado em:`,
          `${new Date().toLocaleString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          ``,
          `🎫 Caso necessário, não hesite em abrir ticket novamente!`
        ].join("\n"))
        .setColor(CONFIG.COR_PRINCIPAL);

      await user.send({ embeds: [embedDM] });
    } catch (e) {
      console.log("Não foi possível enviar DM ao user:", e.message);
    }

    setTimeout(async () => {
      await channel.delete().catch(() => {});
    }, 10000);
  }

  return interaction.reply({
    content: `✅ Utilizador recrutado com sucesso! Foto do Trucky: **${fotoNome}**.\n🗑️ Ticket será fechado em 10 segundos...`,
    flags: 64
  });
}

async function fecharTicket(interaction, ticketId, client, recrutado) {
  const ticket = db.tickets[ticketId];
  if (!ticket) return interaction.reply({ content: `⚠️ Ticket não encontrado.`, flags: 64 });

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
          `🎫 Ticket ID: #${ticket.id}`,
          `📝 Tipo: ${ticket.label}`,
          ``,
          `👮 Fechado por:`,
          `${interaction.user.username}`,
          ``,
          `⏰ Fechado em:`,
          `${new Date().toLocaleString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          ``,
          `🎫 Caso necessário, não hesite em abrir ticket novamente!`
        ].join("\n"))
        .setColor(CONFIG.COR_PRINCIPAL);

      await user.send({ embeds: [embedDM] });
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
      `📋 Lista de staff disponível neste ticket:`,
      "",
      staffText
    ].join("\n"))
    .setColor(CONFIG.COR_PRINCIPAL);

  return interaction.reply({ embeds: [embed], flags: 64 });
}
