import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { sendLog } from "./logs.js";

// ========== COOLDOWN COM AUTO-LIMPEZA ==========
const cooldownMap = new Map();

function isOnCooldown(userId) {
  const last = cooldownMap.get(userId);
  if (!last) return false;
  if (Date.now() - last > 3000) {
    cooldownMap.delete(userId);
    return false;
  }
  return true;
}

function setCooldown(userId) {
  cooldownMap.set(userId, Date.now());
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, ts] of cooldownMap) {
    if (now - ts > 3000) cooldownMap.delete(userId);
  }
}, 60000);

// ========== LOCK PARA ASSUMIR TICKET ==========
const claimingLock = new Map(); // ticketId -> { userId, timestamp }

export function isClaiming(ticketId) {
  const now = Date.now();
  const existing = claimingLock.get(ticketId);
  if (existing && now - existing.timestamp < 30000) {
    return true;
  }
  return false;
}

export function setClaiming(ticketId, userId) {
  const now = Date.now();
  claimingLock.set(ticketId, { userId, timestamp: now });
  for (const [tid, data] of claimingLock) {
    if (now - data.timestamp > 30000) claimingLock.delete(tid);
  }
}

export function clearClaiming(ticketId) {
  claimingLock.delete(ticketId);
}

// ========== FALLBACK: ENCONTRAR TICKET POR CHANNEL ID ==========
export function findTicketByChannelId(channelId) {
  return Object.values(db.tickets).find(t => t.channelId === channelId && !t.closed);
}

const REGRAS_RECRUTAMENTO = [
  "Máx. 100 km/h sempre – simulação real acima de tudo.",
  "Respeito total entre membros e jogadores.",
  "Comboios = disciplina + pontualidade.",
  "Cumprir a quilometragem mínima mensal: 15 000 km/mês (~500 km/dia).",
  "Foco no ranking nacional, respeitando a velocidade dos 0 aos 100 km/h.",
  "Uso da aplicação Trucky para gerir e monitorizar toda a atividade da empresa.",
  "Aqui a estrada é amizade, não competição.",
];

function getTruckersMPSearchLink(username) {
  return `https://truckersmp.com/user/search?search=${encodeURIComponent(username)}`;
}

function generateTicketId() {
  return Date.now().toString();
}

// ========== BLOQUEIO: 1 TICKET ATIVO POR UTILIZADOR ==========
function getExistingActiveTicket(userId) {
  return Object.values(db.tickets).find(t => t.userId === userId && !t.closed);
}

export async function createTicket(interaction, type, label, client) {
  const isRecrutamentoGuild = interaction.guildId === CONFIG.GUILD_ID_RECRUTAMENTO;
  const targetGuildId = isRecrutamentoGuild ? CONFIG.GUILD_ID_RECRUTAMENTO : CONFIG.GUILD_ID;

  const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
  if (!guild) {
    return interaction.editReply({
      content: `${CONFIG.EMOJI_ERROR} Erro: Não consegui aceder ao servidor. Verifica se o bot está nos dois servidores.`
    });
  }

  const user = interaction.user;

  // BLOQUEIO: 1 ticket ativo por utilizador
  const existing = getExistingActiveTicket(user.id);
  if (existing) {
    const existingChannel = await client.channels.fetch(existing.channelId).catch(() => null);
    if (existingChannel) {
      return interaction.editReply({ content: `Ja tens um ticket ativo! Usa <#${existing.channelId}> ou aguarda que seja fechado.` }).catch(() => {});
    }
    // Canal nao existe, limpa ticket fantasma
    existing.closed = true;
    existing.closedAt = new Date().toISOString();
    existing.closedBy = "system";
    existing.closedByName = "Limpeza Automatica";
    await saveDB();
  }

  if (type === "recrutamento") {
    return await iniciarFluxoRecrutamento(interaction, client);
  }

  return await criarTicketNormal(interaction, type, label, client, guild, user);
}

async function iniciarFluxoRecrutamento(interaction, client) {
  const user = interaction.user;

  const existingTicket = Object.values(db.tickets).find(
    (t) => t.userId === user.id && !t.closed && t.type === "recrutamento",
  );

  if (existingTicket) {
    const existingChannel = await client.channels.fetch(existingTicket.channelId).catch(() => null);
    if (existingChannel) {
      return interaction.editReply({
        content: `${CONFIG.EMOJI_WARNING} Ja tens um processo de recrutamento em aberto!`
      });
    }
    existingTicket.closed = true;
    existingTicket.closedAt = new Date().toISOString();
    existingTicket.closedBy = "system";
    existingTicket.closedByName = "Limpeza";
    await saveDB();
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_trucky_${user.id}_${Date.now()}`)
    .setTitle(`${CONFIG.EMOJI_TRUCK} Verificacao - Trucky App`);

  const inputTrucky = new TextInputBuilder()
    .setCustomId("trucky_instalado")
    .setLabel("Tens o Trucky App instalado? (Sim/Nao)")
    .setPlaceholder("Escreve: Sim ou Nao")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const inputNome = new TextInputBuilder()
    .setCustomId("trucky_nome")
    .setLabel("Nome de utilizador no Trucky")
    .setPlaceholder("Ex: Diego")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50);

  const inputLink = new TextInputBuilder()
    .setCustomId("trucky_link")
    .setLabel("Link do teu perfil Trucky (opcional)")
    .setPlaceholder("https://truckyapp.com/profile/12345")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder().addComponents(inputTrucky),
    new ActionRowBuilder().addComponents(inputNome),
    new ActionRowBuilder().addComponents(inputLink),
  );

  await interaction.showModal(modal);
}

export async function handleTruckyVerification(interaction, client) {
  // DEFER FIRST - antes de qualquer operacao
  await interaction.deferReply({ flags: 64 });

  const temTrucky = interaction.fields.getTextInputValue("trucky_instalado").toLowerCase().trim();
  const nomeTrucky = interaction.fields.getTextInputValue("trucky_nome")?.trim() || "Nao informado";
  const linkTrucky = interaction.fields.getTextInputValue("trucky_link")?.trim() || null;

  if (temTrucky.includes("nao") || temTrucky.includes("não") || temTrucky.startsWith("n")) {
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_TRUCK} Trucky App - Instalacao Necessaria`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Precisas de instalar o Trucky App antes de te candidatares!`,
        "",
        `${CONFIG.EMOJI_CHECK} Passos:`,
        `1. Acede a: https://hub.truckyapp.com/`,
        `2. Cria a tua conta e liga ao Steam`,
        `3. Instala a app no computador`,
        "",
        `${CONFIG.EMOJI_TIME} Depois de instalado, volta a abrir o ticket de recrutamento!`
      ].join("\n"))
      .setColor(0xff9800)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel(`${CONFIG.EMOJI_TRUCK} Trucky App`).setStyle(ButtonStyle.Link).setURL("https://hub.truckyapp.com/"),
    );

    return interaction.editReply({ embeds: [embed], components: [row], flags: 64 });
  }

  await mostrarRegrasRecrutamento(interaction, client, nomeTrucky, linkTrucky);
}

async function mostrarRegrasRecrutamento(interaction, client, nomeTrucky, linkTrucky = null) {
  const regrasTexto = REGRAS_RECRUTAMENTO.map((r, i) => `${CONFIG.EMOJI_CHECK} ${i + 1}. ${r}`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_RECRUTAMENTO} Regras da Portugal Alfa Truckers`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Antes de prosseguires, le atentamente as regras:`,
      "",
      regrasTexto,
      "",
      `${CONFIG.EMOJI_AJUDA} Aceitas cumprir todas as regras acima?`
    ].join("\n"))
    .setColor(0x262af1)
    .setTimestamp();

  if (!client._tempRecrutamento) client._tempRecrutamento = {};
  client._tempRecrutamento[interaction.user.id] = {
    nomeTrucky,
    linkTrucky
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aceitar_regras_rec_${interaction.user.id}_${nomeTrucky}`)
      .setLabel(`${CONFIG.EMOJI_ACEITAR} Aceito as Regras`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`recusar_regras_rec_${interaction.user.id}`)
      .setLabel(`${CONFIG.EMOJI_RECUSAR} Nao Aceito`)
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({ embeds: [embed], components: [row], flags: 64 });
}

export async function criarTicketRecrutamento(interaction, client, nomeTrucky) {
  const isRecrutamentoGuild = interaction.guildId === CONFIG.GUILD_ID_RECRUTAMENTO;
  const targetGuildId = isRecrutamentoGuild ? CONFIG.GUILD_ID_RECRUTAMENTO : CONFIG.GUILD_ID;

  const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
  const user = interaction.user;

  if (!guild) {
    return interaction.editReply({
      content: `${CONFIG.EMOJI_ERROR} Erro: Nao consegui aceder ao servidor para criar o ticket.`,
      components: [],
      embeds: []
    });
  }

  if (isOnCooldown(user.id)) {
    return interaction.editReply({
      content: `${CONFIG.EMOJI_TIME} Espera um pouco antes de abrir outro ticket (3 segundos).`,
      components: [],
      embeds: []
    });
  }

  setCooldown(user.id);

  const tempData = client._tempRecrutamento?.[user.id] || {};
  const nomeFinal = tempData.nomeTrucky || nomeTrucky || "Nao informado";
  const linkTrucky = tempData.linkTrucky || null;

  if (client._tempRecrutamento) {
    delete client._tempRecrutamento[user.id];
  }

  const channelName = `rec-${user.username}-${user.id.slice(0, 4)}`.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 25);

  let categoria = CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO;
  if (categoria) {
    const categoriaExiste = await guild.channels.fetch(categoria).catch(() => null);
    if (!categoriaExiste) categoria = null;
  }

  let staffRoleId = CONFIG.CARGO_STAFF;
  try {
    const staffRole = await guild.roles.fetch(CONFIG.CARGO_STAFF).catch(() => null);
    if (staffRole) staffRoleId = staffRole.id;
  } catch (e) {}

  const channelData = {
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id, type: 0, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, type: 1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: staffRoleId, type: 0, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
  };

  if (categoria) channelData.parent = categoria;

  try {
    const channel = await guild.channels.create(channelData);
    const ticketId = generateTicketId();

    let truckyDisplay;
    if (linkTrucky && (linkTrucky.startsWith("http://") || linkTrucky.startsWith("https://"))) {
      truckyDisplay = `[${nomeFinal}](${linkTrucky})`;
    } else {
      const searchLink = getTruckersMPSearchLink(nomeFinal);
      truckyDisplay = `[${nomeFinal}](${searchLink})`;
    }

    db.tickets[ticketId] = {
      id: ticketId,
      channelId: channel.id,
      userId: user.id,
      username: user.username,
      type: "recrutamento",
      label: `${CONFIG.EMOJI_RECRUTAMENTO} Recrutamento PAT`,
      openedAt: new Date().toISOString(),
      closedAt: null,
      claimedBy: null,
      claimedByName: null,
      closedBy: null,
      closedByName: null,
      callActive: false,
      callChannelId: null,
      rating: null,
      panelMessageId: null,
      recrutado: null,
      fotoNome: null,
      truckyNome: nomeFinal,
      truckyLink: linkTrucky,
      regrasAceites: true,
      guildId: targetGuildId,
    };

    await saveDB();

    const timestamp = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setTitle(`<@&${CONFIG.CARGO_ADMINISTRACAO}>`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Motivo: ${CONFIG.EMOJI_RECRUTAMENTO} Recrutamento PAT`,
        `${CONFIG.EMOJI_STAFF} Assumido: Aguardando staff...`,
        "",
        `${CONFIG.EMOJI_USER} Ola <@${user.id}>, aguarde ate ser atendido por alguem da staff.`,
        "",
        `${CONFIG.EMOJI_TRUCK} Trucky: ${truckyDisplay}`,
        "",
        `${CONFIG.EMOJI_CHECK} Regras aceites: Sim`
      ].join("\n"))
      .setColor(0x262af1);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`assumir_${ticketId}`).setLabel(`${CONFIG.EMOJI_ASSUMIR} Assumir`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`painel_membro_${ticketId}`).setLabel(`${CONFIG.EMOJI_PAINEL} Painel Membro`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`sair_${ticketId}`).setLabel(`${CONFIG.EMOJI_SAIR} Sair`).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`deletar_${ticketId}`).setLabel(`${CONFIG.EMOJI_FECHAR} Fechar`).setStyle(ButtonStyle.Danger),
    );

    const panelMsg = await channel.send({
      content: `🧑‍💼 <@&${CONFIG.CARGO_ADMINISTRACAO}> | 👤 <@${user.id}>`,
      embeds: [embed],
      components: [row]
    });
    db.tickets[ticketId].panelMessageId = panelMsg.id;
    await saveDB();
    await sendLog(ticketId, "open", client);

    const rowIrTicket = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel(`${CONFIG.EMOJI_TICKET} Ir para o Ticket`).setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${targetGuildId}/${channel.id}`),
    );

    await interaction.editReply({
      content: `${CONFIG.EMOJI_SUCCESS} O seu ticket de recrutamento foi criado com sucesso!`,
      components: [rowIrTicket],
      embeds: []
    });

  } catch (error) {
    console.error("Erro ao criar ticket de recrutamento:", error);
    await interaction.editReply({
      content: `${CONFIG.EMOJI_ERROR} Erro ao criar o ticket. Contacta a staff.`,
      components: [],
      embeds: []
    });
  }
}

async function criarTicketNormal(interaction, type, label, client, guild, user) {
  if (isOnCooldown(user.id)) {
    return interaction.editReply({ content: `${CONFIG.EMOJI_TIME} Espera um pouco antes de abrir outro ticket (3 segundos).` }).catch(() => {});
  }

  // BLOQUEIO: 1 ticket ativo por utilizador
  const existing = getExistingActiveTicket(user.id);
  if (existing) {
    const existingChannel = await guild.channels.fetch(existing.channelId).catch(() => null);
    if (existingChannel) {
      return interaction.editReply({ content: `Ja tens um ticket ativo! Usa <#${existing.channelId}> ou aguarda que seja fechado.` }).catch(() => {});
    }
    existing.closed = true;
    existing.closedAt = new Date().toISOString();
    existing.closedBy = "system";
    existing.closedByName = "Limpeza Automatica";
    await saveDB();
  }

  setCooldown(user.id);

  const typePrefix = type === "bugs" ? "bug" : type === "denuncia" ? "den" : type === "suporte" ? "sup" : type === "criador" ? "cri" : type === "ajuda" ? "ajd" : "tk";
  const channelName = `${typePrefix}-${user.username}-${user.id.slice(0, 4)}`.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 25);

  let categoria = CONFIG.CATEGORIA_TICKETS_GERAL;
  if (type === "ajuda") categoria = CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO;
  if (categoria) {
    const categoriaExiste = await guild.channels.fetch(categoria).catch(() => null);
    if (!categoriaExiste) categoria = null;
  }

  let staffRoleId = CONFIG.CARGO_STAFF;
  try {
    const staffRole = await guild.roles.fetch(CONFIG.CARGO_STAFF).catch(() => null);
    if (staffRole) staffRoleId = staffRole.id;
  } catch (e) {}

  const channelData = {
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id, type: 0, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, type: 1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: staffRoleId, type: 0, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
  };

  if (categoria) channelData.parent = categoria;

  const channel = await guild.channels.create(channelData);
  const ticketId = generateTicketId();

  let descricaoExtra = "";
  if (type === "ajuda" && interaction._ajudaEspecificacoes) {
    descricaoExtra = `\n${CONFIG.EMOJI_INFO} Especificacoes: ${interaction._ajudaEspecificacoes}`;
  }

  db.tickets[ticketId] = {
    id: ticketId,
    channelId: channel.id,
    userId: user.id,
    username: user.username,
    type: type,
    label: label,
    openedAt: new Date().toISOString(),
    closedAt: null,
    claimedBy: null,
    claimedByName: null,
    closedBy: null,
    closedByName: null,
    callActive: false,
    callChannelId: null,
    rating: null,
    panelMessageId: null,
    recrutado: null,
    fotoNome: null,
    guildId: guild.id,
    especificacoes: interaction._ajudaEspecificacoes || null,
  };

  await saveDB();

  const timestamp = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setTitle(`Ticket Aberto - #${ticketId}`)
    .setDescription([
      `Utilizador: ${user} | ${user.username}`,
      `Tipo: ${label}`,
      `Abertura: <t:${timestamp}:F>`,
    ].join("\n"))
    .setColor(CONFIG.COR_PRINCIPAL)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`assumir_${ticketId}`).setLabel(`${CONFIG.EMOJI_ASSUMIR} Assumir`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`painel_membro_${ticketId}`).setLabel(`${CONFIG.EMOJI_PAINEL} Painel Membro`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`sair_${ticketId}`).setLabel(`${CONFIG.EMOJI_SAIR} Sair`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`deletar_${ticketId}`).setLabel(`${CONFIG.EMOJI_FECHAR} Fechar`).setStyle(ButtonStyle.Danger),
  );

  const panelMsg = await channel.send({
    content: `🧑‍💼 <@&${CONFIG.CARGO_ADMINISTRACAO}> | 👤 <@${user.id}>`,
    embeds: [embed],
    components: [row]
  });
  db.tickets[ticketId].panelMessageId = panelMsg.id;
  await saveDB();
  await sendLog(ticketId, "open", client);

  const rowIrTicket = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(`${CONFIG.EMOJI_TICKET} Ir para o Ticket`).setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guild.id}/${channel.id}`),
  );

  await interaction.editReply({ content: `${CONFIG.EMOJI_SUCCESS} O teu ticket foi criado com sucesso!`, components: [rowIrTicket] }).catch(() => {});
}

export async function updateTicketEmbed(channel, ticketId) {
  const ticket = db.tickets[ticketId];
  if (!ticket || !ticket.panelMessageId) return;

  try {
    const panelMsg = await channel.messages.fetch(ticket.panelMessageId);
    if (!panelMsg) return;

    const claimedText = ticket.claimedBy
      ? `<@${ticket.claimedBy}> | ${ticket.claimedByName}`
      : `${CONFIG.EMOJI_TIME} Aguardando staff...`;

    const embed = new EmbedBuilder()
      .setTitle(`<@&${CONFIG.CARGO_ADMINISTRACAO}>`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Motivo: ${ticket.label}`,
        `${CONFIG.EMOJI_STAFF} Assumido: ${claimedText}`,
        "",
        `${CONFIG.EMOJI_USER} Ola <@${ticket.userId}>, aguarde ate ser atendido por alguem da staff.`,
        "",
        `${CONFIG.EMOJI_WARNING} Lembra-te: Qualquer incumprimento das regras levara ao encerramento do ticket sem aviso previo!`
      ].join("\n"))
      .setColor(ticket.claimedBy ? 0x00ff00 : 0x040021);

    if (ticket.claimedBy) {
      const newRow = new ActionRowBuilder();
      const oldButtons = panelMsg.components[0]?.components || [];

      for (const btn of oldButtons) {
        const newBtn = ButtonBuilder.from(btn);
        if (btn.customId?.startsWith("assumir_")) {
          newBtn.setDisabled(true).setLabel(`${CONFIG.EMOJI_ASSUMIR} Assumido`);
        }
        newRow.addComponents(newBtn);
      }

      await panelMsg.edit({ embeds: [embed], components: [newRow] });
    } else {
      await panelMsg.edit({ embeds: [embed] });
    }
  } catch (e) {
    console.log("Erro ao atualizar embed:", e);
  }
}
