import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeEditReply } from "../utils/safeReply.js";
import { sendLog } from "./logs.js";

const cooldown = new Set();

const REGRAS_RECRUTAMENTO = [
  "Máx. 100 km/h sempre – simulação real acima de tudo.",
  "Respeito total entre membros e jogadores.",
  "Comboios = disciplina + pontualidade.",
  "Cumprir 15.000 KM/mês (≈ 500 km/dia).",
  "Foco no ranking nacional respeitando os 0 aos 100 km/h.",
  "Trucky App instalado e ativo.",
  "Aqui a estrada é amizade, não competição.",
];

export async function createTicket(interaction, type, label, client) {
  // Determinar qual servidor estamos
  const isRecrutamentoGuild = interaction.guildId === CONFIG.GUILD_ID_RECRUTAMENTO;
  const targetGuildId = isRecrutamentoGuild ? CONFIG.GUILD_ID_RECRUTAMENTO : CONFIG.GUILD_ID;
  
  const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
  if (!guild) {
    return safeEditReply(interaction, { 
      content: "Erro: Não consegui aceder ao servidor. Verifica se o bot está nos dois servidores.", 
      flags: 64 
    });
  }
  
  const user = interaction.user;
  
  if (type === "recrutamento") {
    return await iniciarFluxoRecrutamento(interaction, client);
  }
  
  return await criarTicketNormal(interaction, type, label, client, guild, user);
}

async function iniciarFluxoRecrutamento(interaction, client) {
  const user = interaction.user;
  
  // Verificar se já tem ticket de recrutamento aberto em QUALQUER servidor
  const existingTicket = Object.values(db.tickets).find(
    (t) => t.userId === user.id && !t.closed && t.type === "recrutamento",
  );
  
  if (existingTicket) {
    return safeEditReply(interaction, { 
      content: "Já tens um processo de recrutamento em aberto!", 
      flags: 64 
    });
  }
  
  const modal = new ModalBuilder()
    .setCustomId(`modal_trucky_${user.id}_${Date.now()}`)
    .setTitle("Verificação - Trucky App");
    
  const inputTrucky = new TextInputBuilder()
    .setCustomId("trucky_instalado")
    .setLabel("Tens o Trucky App instalado? (Sim/Não)")
    .setPlaceholder("Escreve: Sim ou Não")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);
    
  const inputNome = new TextInputBuilder()
    .setCustomId("trucky_nome")
    .setLabel("Nome de utilizador no Trucky")
    .setPlaceholder("Ex: DiegoGamer")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50);
    
  modal.addComponents(
    new ActionRowBuilder().addComponents(inputTrucky),
    new ActionRowBuilder().addComponents(inputNome),
  );
  
  await interaction.showModal(modal);
}

export async function handleTruckyVerification(interaction, client) {
  const temTrucky = interaction.fields.getTextInputValue("trucky_instalado").toLowerCase().trim();
  const nomeTrucky = interaction.fields.getTextInputValue("trucky_nome")?.trim() || "Não informado";
  
  // NÃO fazer deferReply aqui — modal submit já está deferido automaticamente
  // Usar reply normal ou followUp
  
  if (temTrucky.includes("não") || temTrucky.includes("nao") || temTrucky.startsWith("n")) {
    const embed = new EmbedBuilder()
      .setTitle("Trucky App - Instalação Necessária")
      .setDescription([
        "Precisas de instalar o Trucky App antes de te candidatares!", 
        "", 
        "Passos:", 
        "1. Acede a: https://hub.truckyapp.com/", 
        "2. Cria a tua conta e liga ao Steam", 
        "3. Instala a app no computador", 
        "", 
        "Depois de instalado, volta a abrir o ticket de recrutamento!"
      ].join("\n"))
      .setColor(0xff9800)
      .setImage(CONFIG.IMAGEM_RECRUTAMENTO)
      .setTimestamp();
      
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Trucky App").setStyle(ButtonStyle.Link).setURL("https://hub.truckyapp.com/"),
    );
    
    // Usar reply em vez de editReply porque modal não vem deferido
    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    return;
  }
  
  await mostrarRegrasRecrutamento(interaction, client, nomeTrucky);
}

async function mostrarRegrasRecrutamento(interaction, client, nomeTrucky) {
  const regrasTexto = REGRAS_RECRUTAMENTO.map((r, i) => `${i + 1}. ${r}`).join("\n");
  
  const embed = new EmbedBuilder()
    .setTitle("Regras da Portugal Alfa Truckers")
    .setDescription([
      "Antes de prosseguires, lê atentamente as regras:", 
      "", 
      regrasTexto, 
      "", 
      "Aceitas cumprir todas as regras acima?"
    ].join("\n"))
    .setColor(0x262af1)
    .setImage(CONFIG.IMAGEM_RECRUTAMENTO)
    .setTimestamp();
    
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aceitar_regras_rec_${interaction.user.id}_${nomeTrucky}`)
      .setLabel("Aceito as Regras")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`recusar_regras_rec_${interaction.user.id}`)
      .setLabel("Não Aceito")
      .setStyle(ButtonStyle.Danger),
  );
  
  // Usar reply porque vem do modal
  await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
}

export async function criarTicketRecrutamento(interaction, client, nomeTrucky) {
  // Determinar servidor correto
  const isRecrutamentoGuild = interaction.guildId === CONFIG.GUILD_ID_RECRUTAMENTO;
  const targetGuildId = isRecrutamentoGuild ? CONFIG.GUILD_ID_RECRUTAMENTO : CONFIG.GUILD_ID;
  const targetCategoria = isRecrutamentoGuild ? CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO : CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO;
  
  const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
  const user = interaction.user;
  
  if (!guild) {
    return interaction.editReply({ 
      content: "Erro: Não consegui aceder ao servidor para criar o ticket.", 
      components: [], 
      embeds: [] 
    });
  }
  
  if (cooldown.has(user.id)) {
    return interaction.editReply({ 
      content: "Espera um pouco antes de abrir outro ticket (3 segundos).", 
      components: [], 
      embeds: [] 
    });
  }
  
  cooldown.add(user.id);
  setTimeout(() => cooldown.delete(user.id), 3000);
  
  const channelName = `rec-${user.username}-${user.id.slice(0, 4)}`.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 25);
  
  let categoria = targetCategoria;
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
    const ticketId = Date.now().toString();
    
    db.tickets[ticketId] = {
      id: ticketId, 
      channelId: channel.id, 
      userId: user.id, 
      username: user.username,
      type: "recrutamento", 
      label: "Recrutamento PAT", 
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
      truckyNome: nomeTrucky, 
      regrasAceites: true,
      guildId: targetGuildId, // Guardar qual servidor
    };
    
    await saveDB();
    
    const embed = new EmbedBuilder()
      .setTitle("Sistema de Ticket | Portugal Alfa Truckers")
      .setDescription([
        `Motivo: Recrutamento PAT`, 
        `Assumido: Aguardando staff...`, 
        "", 
        `Olá ${user.username}, aguarde ser atendido.`, 
        "", 
        `Trucky: ${nomeTrucky}`, 
        "", 
        "Regras aceites: Sim"
      ].join("\n"))
      .setColor(0x262af1);
      
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`assumir_${ticketId}`).setLabel("Assumir").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`painel_${ticketId}`).setLabel("Painel Staff").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`sair_${ticketId}`).setLabel("Sair").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`deletar_${ticketId}`).setLabel("Fechar").setStyle(ButtonStyle.Danger),
    );
    
    const panelMsg = await channel.send({ content: `${user.username}`, embeds: [embed], components: [row] });
    db.tickets[ticketId].panelMessageId = panelMsg.id;
    await saveDB();
    await sendLog(ticketId, "open", client);
    
    const rowIrTicket = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Ir para o Ticket").setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${targetGuildId}/${channel.id}`),
    );
    
    // Usar editReply porque o botão já fez deferUpdate
    await interaction.editReply({ 
      content: "O teu ticket de recrutamento foi criado!", 
      components: [rowIrTicket], 
      embeds: [] 
    });
    
  } catch (error) {
    console.error("Erro ao criar ticket de recrutamento:", error);
    await interaction.editReply({ 
      content: "Erro ao criar o ticket. Contacta a staff.", 
      components: [], 
      embeds: [] 
    });
  }
}
