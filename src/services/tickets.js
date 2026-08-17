import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { safeEditReply } from "../utils/safeReply.js";
import { sendLog } from "./logs.js";
import { formatDateSimple, getClockEmoji } from "../utils/dateUtils.js";

// ============================================================
// PROTEÇÕES
// ============================================================

// Utilizadores que estão neste momento a criar um ticket.
// IMPORTANTE: é colocado ANTES dos await.
const ticketCreationLocks = new Set();

// Interactions já processadas.
// Evita que a mesma interação Discord seja executada duas vezes.
const processedInteractions = new Set();

// Locks de recrutamento.
const recruitmentLocks = new Set();

// Limpeza periódica dos interaction IDs.
setInterval(() => {
  if (processedInteractions.size > 5000) {
    processedInteractions.clear();
  }
}, 10 * 60 * 1000);

// ============================================================
// REGRAS DE RECRUTAMENTO
// ============================================================

const REGRAS_RECRUTAMENTO = [
  "Máx. 100 km/h sempre – simulação real acima de tudo.",
  "Respeito total entre membros e jogadores.",
  "Comboios = disciplina + pontualidade.",
  "Cumprir a quilometragem mínima mensal: 15 000 km/mês (~500 km/dia).",
  "Foco no ranking nacional, respeitando a velocidade dos 0 aos 100 km/h.",
  "Uso da aplicação Trucky para gerir e monitorizar toda a atividade da empresa.",
  "Aqui a estrada é amizade, não competição.",
];

// ============================================================
// HELPERS
// ============================================================

function ensureTicketsDB() {
  if (!db.tickets || typeof db.tickets !== "object") {
    db.tickets = {};
  }

  return db.tickets;
}

function getActiveTicketsByUser(userId) {
  ensureTicketsDB();

  return Object.values(db.tickets).filter(
    (ticket) =>
      ticket &&
      ticket.userId === userId &&
      ticket.closed !== true
  );
}

export function findTicketByChannelId(channelId) {
  if (!channelId) return null;

  ensureTicketsDB();

  return (
    Object.values(db.tickets).find(
      (ticket) =>
        ticket &&
        ticket.channelId === channelId &&
        ticket.closed !== true
    ) || null
  );
}

export function getTicket(ticketId, channelId = null) {
  ensureTicketsDB();

  if (ticketId && db.tickets[String(ticketId)]) {
    const ticket = db.tickets[String(ticketId)];

    if (!ticket.closed) {
      return ticket;
    }
  }

  if (channelId) {
    return findTicketByChannelId(channelId);
  }

  return null;
}

export function isTicketCreating(userId) {
  return ticketCreationLocks.has(String(userId));
}

function lockTicketCreation(userId) {
  ticketCreationLocks.add(String(userId));
}

function unlockTicketCreation(userId) {
  ticketCreationLocks.delete(String(userId));
}

function hasProcessedInteraction(interaction) {
  if (!interaction?.id) return false;

  if (processedInteractions.has(interaction.id)) {
    return true;
  }

  processedInteractions.add(interaction.id);
  return false;
}

function generateTicketId() {
  // ID numérico simples.
  // Exemplo: 1786491430...
  return Date.now().toString();
}

function getTicketPrefix(type) {
  const prefixes = {
    bugs: "bug",
    denuncia: "den",
    suporte: "sup",
    criador: "cri",
    ajuda: "ajd",
    recrutamento: "rec",
  };

  return prefixes[type] || "tk";
}

function makeChannelName(type, user) {
  const prefix = getTicketPrefix(type);

  const username = String(user.username || "utilizador")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .substring(0, 18);

  const suffix = String(user.id).slice(-4);

  return `${prefix}-${username}-${suffix}`.substring(0, 25);
}

async function getGuildForInteraction(interaction, client) {
  const isRecruitmentGuild =
    interaction.guildId === CONFIG.GUILD_ID_RECRUTAMENTO;

  const targetGuildId = isRecruitmentGuild
    ? CONFIG.GUILD_ID_RECRUTAMENTO
    : CONFIG.GUILD_ID;

  return (
    (await client.guilds.fetch(targetGuildId).catch(() => null)) ||
    (interaction.guild || null)
  );
}

async function getStaffRoleId(guild) {
  if (!CONFIG.CARGO_STAFF) return null;

  const role = await guild.roles
    .fetch(CONFIG.CARGO_STAFF)
    .catch(() => null);

  return role?.id || CONFIG.CARGO_STAFF;
}

async function getCategory(guild, categoryId) {
  if (!categoryId) return null;

  return guild.channels
    .fetch(categoryId)
    .catch(() => null);
}

function buildTicketButtons(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`assumir_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_ASSUMIR || "👮"} Assumir`)
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`painel_membro_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_PAINEL || "🛡️"} Painel Membro`)
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`sair_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_SAIR || "🚪"} Sair`)
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`deletar_${ticketId}`)
      .setLabel(`${CONFIG.EMOJI_FECHAR || "🗑️"} Fechar`)
      .setStyle(ButtonStyle.Danger)
  );
}

// ============================================================
// BUILD TICKET EMBED (NOVO FORMATO)
// ============================================================

function buildTicketEmbed(ticket, user) {
  const openedAt = ticket.openedAt ? new Date(ticket.openedAt) : new Date();
  const clockEmoji = getClockEmoji(openedAt);

  const claimedText = ticket.claimedBy
    ? `<@${ticket.claimedBy}>`
    : `${clockEmoji} Aguardando staff...`;

  const isRecruitment = ticket.type === "recrutamento";

  let description = `ℹ️ **Motivo:** ${ticket.label}`;
  
  if (isRecruitment && ticket.truckyNome) {
    description += `\n🚛 **Trucky:** \`${ticket.truckyNome}\``;
  }
  
  description += `\n\n👮 **Responsável:** ${claimedText}`;
  description += `\n👤 **Utilizador:** <@${user.id}> | \`${user.username}\``;
  description += `\n\n${clockEmoji} **Abertura:** ${formatDateSimple(openedAt)}`;
  description += `\n\n👤 Olá <@${user.id}>, aguarde até ser atendido por alguém da staff.`;
  description += `\n\n⚠️ Lembra-te: qualquer incumprimento das regras levará ao encerramento do ticket sem aviso prévio!`;

  if (ticket.especificacoes) {
    description += `\n\nℹ️ **Especificações:** ${ticket.especificacoes}`;
  }

  return new EmbedBuilder()
    .setTitle(`<@&${CONFIG.CARGO_ADMINISTRACAO}>`)
    .setDescription(description)
    .setColor(ticket.claimedBy ? 0x00ff00 : 0x2629F1)
    .setTimestamp(openedAt);
}

// ============================================================
// UPDATE EMBED
// ============================================================

export async function updateTicketEmbed(channel, ticketId) {
  const ticket = db.tickets?.[String(ticketId)];

  if (!ticket || ticket.closed) return false;

  try {
    let panelMessage = null;

    if (ticket.panelMessageId) {
      panelMessage = await channel.messages
        .fetch(ticket.panelMessageId)
        .catch(() => null);
    }

    if (!panelMessage) {
      const messages = await channel.messages
        .fetch({ limit: 20 })
        .catch(() => null);

      if (messages) {
        panelMessage = messages.find(
          (message) =>
            message.author?.bot &&
            message.embeds?.length > 0 &&
            message.components?.length > 0
        );
      }
    }

    const user = await channel.client.users
      .fetch(ticket.userId)
      .catch(() => null);

    if (!user) return false;

    const embed = buildTicketEmbed(ticket, user);

    const row = buildTicketButtons(ticket.id);

    if (ticket.claimedBy) {
      const components = row.components.map((button) => {
        if (
          button.data?.custom_id === `assumir_${ticket.id}`
        ) {
          return ButtonBuilder.from(button)
            .setDisabled(true)
            .setLabel(
              `${CONFIG.EMOJI_ASSUMIR || "👮"} Assumido`
            );
        }

        return button;
      });

      const newRow = new ActionRowBuilder().addComponents(
        components
      );

      if (panelMessage) {
        await panelMessage.edit({
          embeds: [embed],
          components: [newRow],
        });

        return true;
      }
    }

    if (panelMessage) {
      await panelMessage.edit({
        embeds: [embed],
        components: [row],
      });

      return true;
    }

    const newMessage = await channel.send({
      content: `<@${ticket.userId}> | ID: \`${ticket.userId}\``,
      embeds: [embed],
      components: [row],
    });

    ticket.panelMessageId = newMessage.id;
    await saveDB();

    return true;
  } catch (error) {
    console.error(
      "[Tickets] Erro ao atualizar embed:",
      error
    );

    return false;
  }
}

// ============================================================
// CREATE NORMAL TICKET
// ============================================================

export async function createTicket(
  interaction,
  type,
  label,
  client
) {
  const user = interaction.user;

  // ----------------------------------------------------------
  // PRIMEIRA PROTEÇÃO: INTERACTION DUPLICADA
  // ----------------------------------------------------------

  if (hasProcessedInteraction(interaction)) {
    console.warn(`[Tickets] Interaction duplicada ignorada: ${interaction.id}`);
    return null;
  }

  // ----------------------------------------------------------
  // RESPONDER IMEDIATAMENTE (ANTES DE QUALQUER OPERAÇÃO)
  // ----------------------------------------------------------

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }
  } catch (error) {
    console.error("[Tickets] Não foi possível deferir:", error);
    return null;
  }

  // ----------------------------------------------------------
  // SEGUNDA PROTEÇÃO: LOCK
  // ----------------------------------------------------------

  if (isTicketCreating(user.id)) {
    await safeEditReply(interaction, {
      content: "⏳ Já estou a processar o teu pedido. Aguarda alguns segundos.",
      flags: 64,
    });
    return null;
  }

  lockTicketCreation(user.id);

  try {
    ensureTicketsDB();

    const guild = await getGuildForInteraction(
      interaction,
      client
    );

    if (!guild) {
      await safeEditReply(interaction, {
        content:
          "❌ Não consegui aceder ao servidor. Contacta a administração.",
        flags: 64,
      });

      return null;
    }

    // --------------------------------------------------------
    // TERCEIRA PROTEÇÃO:
    // VERIFICAR DB ENQUANTO O LOCK ESTÁ ATIVO.
    // --------------------------------------------------------

    const activeTickets = getActiveTicketsByUser(user.id);

    if (activeTickets.length > 0) {
      // Procurar canal real.
      for (const existingTicket of activeTickets) {
        const existingChannel = await client.channels
          .fetch(existingTicket.channelId)
          .catch(() => null);

        if (existingChannel) {
          const clockEmoji = getClockEmoji(new Date(existingTicket.openedAt));
          
          const rowIrTicket = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel(`${CONFIG.EMOJI_TICKET || "🎫"} Ir para o Ticket`)
              .setStyle(ButtonStyle.Link)
              .setURL(
                `https://discord.com/channels/${guild.id}/${existingTicket.channelId}`
              )
          );

          await safeEditReply(interaction, {
            content: [
              `⚠️ **Já tens um ticket aberto!**`,
              ``,
              `🎫 Ticket: <#${existingTicket.channelId}>`,
              `🆔 ID: \`${existingTicket.id}\``,
              `${clockEmoji} **Abertura:** ${formatDateSimple(existingTicket.openedAt)}`,
              ``,
              `Fecha o ticket atual antes de abrir outro.`,
            ].join("\n"),
            components: [rowIrTicket],
            flags: 64,
          });

          return existingTicket;
        }

        // Canal já não existe.
        existingTicket.closed = true;
        existingTicket.closedAt = new Date().toISOString();
        existingTicket.closedBy = "system";
        existingTicket.closedByName = "Limpeza automática";
      }

      await saveDB();
    }

    // --------------------------------------------------------
    // RECRUTAMENTO
    // --------------------------------------------------------

    if (type === "recrutamento") {
      return await iniciarFluxoRecrutamento(
        interaction,
        client,
        guild
      );
    }

    // --------------------------------------------------------
    // CATEGORIA
    // --------------------------------------------------------

    let categoriaId = CONFIG.CATEGORIA_TICKETS_GERAL;

    if (type === "ajuda") {
      categoriaId =
        CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO ||
        CONFIG.CATEGORIA_TICKETS_GERAL;
    }

    const categoria = await getCategory(
      guild,
      categoriaId
    );

    // --------------------------------------------------------
    // STAFF ROLE
    // --------------------------------------------------------

    const staffRoleId = await getStaffRoleId(guild);

    if (!staffRoleId) {
      console.warn(
        "[Tickets] CONFIG.CARGO_STAFF não configurado."
      );
    }

    // --------------------------------------------------------
    // CRIAR CANAL
    // --------------------------------------------------------

    const channelData = {
      name: makeChannelName(type, user),
      type: ChannelType.GuildText,

      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },

        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },

        ...(staffRoleId
          ? [
              {
                id: staffRoleId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageMessages,
                ],
              },
            ]
          : []),
      ],
    };

    if (categoria) {
      channelData.parent = categoria.id;
    }

    let channel;

    try {
      channel = await guild.channels.create(channelData);
    } catch (error) {
      console.error(
        "[Tickets] Erro ao criar canal:",
        error
      );

      await safeEditReply(interaction, {
        content:
          "❌ Não consegui criar o canal do ticket. Contacta a administração.",
        flags: 64,
      });

      return null;
    }

    // --------------------------------------------------------
    // ID
    // --------------------------------------------------------

    const ticketId = generateTicketId();

    const openedAt = new Date();

    // --------------------------------------------------------
    // TICKET DB
    // --------------------------------------------------------

    const ticket = {
      id: ticketId,
      channelId: channel.id,
      guildId: guild.id,

      userId: user.id,
      username: user.username,

      type,
      label,

      openedAt: openedAt.toISOString(),
      createdAt: openedAt.toISOString(),

      closed: false,
      closedAt: null,
      closedBy: null,
      closedByName: null,

      claimedBy: null,
      claimedByName: null,

      rating: null,

      recrutado: null,
      fotoNome: null,

      callActive: false,
      callChannelId: null,

      panelMessageId: null,

      especificacoes:
        interaction._ajudaEspecificacoes || null,

      guildId: guild.id,
    };

    db.tickets[ticketId] = ticket;

    // GUARDAR ANTES DE ENVIAR MAIS COISAS.
    await saveDB();

    // --------------------------------------------------------
    // EMBED
    // --------------------------------------------------------

    const embed = buildTicketEmbed(ticket, user);

    const row = buildTicketButtons(ticketId);

    // --------------------------------------------------------
    // MENSAGEM
    // --------------------------------------------------------

    const panelMessage = await channel.send({
      content: `<@${user.id}> | ID: \`${user.id}\``,
      embeds: [embed],
      components: [row],
    });

    ticket.panelMessageId = panelMessage.id;

    await saveDB();

    // --------------------------------------------------------
    // LOG
    // --------------------------------------------------------

    await sendLog(
      ticketId,
      "open",
      client
    ).catch((error) => {
      console.error(
        "[Tickets] Erro no log de abertura:",
        error
      );
    });

    // --------------------------------------------------------
    // RESPOSTA AO UTILIZADOR (NOVO FORMATO)
    // --------------------------------------------------------

    const clockEmoji = getClockEmoji(openedAt);

    const rowIrTicket = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`${CONFIG.EMOJI_TICKET || "🎫"} Ir para o Ticket`)
        .setStyle(ButtonStyle.Link)
        .setURL(
          `https://discord.com/channels/${guild.id}/${channel.id}`
        )
    );

    await safeEditReply(interaction, {
      content: [
        `🎉 **Ticket criado com sucesso!**`,
        ``,
        `🎫 <#${channel.id}>`,
        `🆔 ID: \`${ticketId}\``,
        `${clockEmoji} **Abertura:** ${formatDateSimple(openedAt)}`,
      ].join("\n"),
      components: [rowIrTicket],
      flags: 64,
    });

    console.log(
      `[Tickets] Ticket criado: ${ticketId} | User: ${user.id} | Channel: ${channel.id}`
    );

    return ticket;
  } catch (error) {
    console.error(
      "[Tickets] Erro geral ao criar ticket:",
      error
    );

    await safeEditReply(interaction, {
      content:
        "❌ Ocorreu um erro ao criar o ticket. Contacta a staff.",
      flags: 64,
    }).catch(() => {});

    return null;
  } finally {
    // LIBERTAR O LOCK SÓ NO FINAL.
    unlockTicketCreation(user.id);
  }
}

// ============================================================
// RECRUTAMENTO
// ============================================================

async function iniciarFluxoRecrutamento(
  interaction,
  client,
  guild
) {
  const user = interaction.user;

  const existingRecruitment =
    getActiveTicketsByUser(user.id).find(
      (ticket) =>
        ticket.type === "recrutamento"
    );

  if (existingRecruitment) {
    const channel = await client.channels
      .fetch(existingRecruitment.channelId)
      .catch(() => null);

    if (channel) {
      await safeEditReply(interaction, {
        content:
          "⚠️ Já tens um processo de recrutamento aberto.",
        flags: 64,
      });

      return existingRecruitment;
    }

    existingRecruitment.closed = true;
    existingRecruitment.closedAt =
      new Date().toISOString();

    await saveDB();
  }

  const modal = new ModalBuilder()
    .setCustomId(
      `modal_trucky_${user.id}_${Date.now()}`
    )
    .setTitle(
      `${CONFIG.EMOJI_TRUCK || "🚛"} Verificação - Trucky App`
    );

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
    .setPlaceholder("Ex: Diego")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(50);

  const inputLink = new TextInputBuilder()
    .setCustomId("trucky_link")
    .setLabel("Link do teu perfil Trucky (opcional)")
    .setPlaceholder(
      "https://truckyapp.com/profile/12345"
    )
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder().addComponents(inputTrucky),
    new ActionRowBuilder().addComponents(inputNome),
    new ActionRowBuilder().addComponents(inputLink)
  );

  // showModal é a resposta à interaction.
  // Não fazer deferReply aqui.
  try {
    await interaction.showModal(modal);
  } catch (error) {
    console.error(
      "[Recruitment] Erro ao mostrar modal:",
      error
    );
  }

  return null;
}

// ============================================================
// TRUCKY VERIFICATION
// ============================================================

export async function handleTruckyVerification(
  interaction,
  client
) {
  try {
    if (
      !interaction.deferred &&
      !interaction.replied
    ) {
      await interaction.deferReply({
        flags: 64,
      });
    }

    const temTrucky = interaction.fields
      .getTextInputValue("trucky_instalado")
      .toLowerCase()
      .trim();

    const nomeTrucky =
      interaction.fields
        .getTextInputValue("trucky_nome")
        ?.trim() ||
      "Não informado";

    const linkTrucky =
      interaction.fields
        .getTextInputValue("trucky_link")
        ?.trim() ||
      null;

    if (
      temTrucky.includes("não") ||
      temTrucky.includes("nao") ||
      temTrucky.startsWith("n")
    ) {
      const embed = new EmbedBuilder()
        .setTitle(
          `${CONFIG.EMOJI_TRUCK || "🚛"} Trucky App - Instalação Necessária`
        )
        .setDescription(
          [
            `${CONFIG.EMOJI_INFO || "ℹ️"} Precisas de instalar o Trucky App antes de te candidatares!`,
            "",
            `${CONFIG.EMOJI_CHECK || "✅"} Passos:`,
            "1. Acede a: https://hub.truckyapp.com/",
            "2. Cria a tua conta e liga ao Steam",
            "3. Instala a app no computador",
            "",
            `${CONFIG.EMOJI_TIME || "⏰"} Depois de instalado, volta a abrir o processo de recrutamento!`,
          ].join("\n")
        )
        .setColor(0xff9800)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(
            `${CONFIG.EMOJI_TRUCK || "🚛"} Trucky App`
          )
          .setStyle(ButtonStyle.Link)
          .setURL(
            "https://hub.truckyapp.com/"
          )
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      return;
    }

    if (!client._tempRecrutamento) {
      client._tempRecrutamento = {};
    }

    client._tempRecrutamento[
      interaction.user.id
    ] = {
      nomeTrucky,
      linkTrucky,
    };

    await mostrarRegrasRecrutamento(
      interaction,
      client,
      nomeTrucky,
      linkTrucky
    );
  } catch (error) {
    console.error(
      "[TruckyVerification] Erro:",
      error
    );

    await safeEditReply(interaction, {
      content:
        "❌ Ocorreu um erro durante a verificação.",
      flags: 64,
    }).catch(() => {});
  }
}

async function mostrarRegrasRecrutamento(
  interaction,
  client,
  nomeTrucky,
  linkTrucky
) {
  const regrasTexto =
    REGRAS_RECRUTAMENTO
      .map(
        (regra, index) =>
          `${CONFIG.EMOJI_CHECK || "✅"} ${index + 1}. ${regra}`
      )
      .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(
      `${CONFIG.EMOJI_RECRUTAMENTO || "📝"} Regras da Portugal Alfa Truckers`
    )
    .setDescription(
      [
        `${CONFIG.EMOJI_INFO || "ℹ️"} Antes de prosseguires, lê atentamente as regras:`,
        "",
        regrasTexto,
        "",
        `${CONFIG.EMOJI_AJUDA || "❓"} Aceitas cumprir todas as regras acima?`,
      ].join("\n")
    )
    .setColor(0x262af1)
    .setTimestamp();

  if (!client._tempRecrutamento) {
    client._tempRecrutamento = {};
  }

  client._tempRecrutamento[
    interaction.user.id
  ] = {
    nomeTrucky,
    linkTrucky,
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(
        `aceitar_regras_rec_${interaction.user.id}`
      )
      .setLabel(
        `${CONFIG.EMOJI_ACEITAR || "✅"} Aceito as Regras`
      )
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(
        `recusar_regras_rec_${interaction.user.id}`
      )
      .setLabel(
        `${CONFIG.EMOJI_RECUSAR || "❌"} Não Aceito`
      )
      .setStyle(ButtonStyle.Danger)
  );

  await safeEditReply(interaction, {
    embeds: [embed],
    components: [row],
    flags: 64,
  });
}

// ============================================================
// CRIAR TICKET DE RECRUTAMENTO
// ============================================================

export async function criarTicketRecrutamento(
  interaction,
  client,
  nomeTrucky = null
) {
  const user = interaction.user;

  if (hasProcessedInteraction(interaction)) {
    console.warn(
      `[Recruitment] Interaction duplicada ignorada: ${interaction.id}`
    );

    return null;
  }

  if (
    !interaction.deferred &&
    !interaction.replied
  ) {
    try {
      await interaction.deferReply({
        flags: 64,
      });
    } catch {
      return null;
    }
  }

  if (recruitmentLocks.has(user.id)) {
    await safeEditReply(interaction, {
      content:
        "⏳ Já estou a processar o teu recrutamento.",
      flags: 64,
    });

    return null;
  }

  recruitmentLocks.add(user.id);

  try {
    ensureTicketsDB();

    const active = getActiveTicketsByUser(user.id);

    if (active.length > 0) {
      const existing = active[0];

      const channel = await client.channels
        .fetch(existing.channelId)
        .catch(() => null);

      if (channel) {
        await safeEditReply(interaction, {
          content:
            `⚠️ Já tens um ticket aberto: <#${existing.channelId}>`,
          flags: 64,
        });

        return existing;
      }

      existing.closed = true;
      existing.closedAt =
        new Date().toISOString();

      await saveDB();
    }

    const guild =
      (await client.guilds.fetch(
        CONFIG.GUILD_ID_RECRUTAMENTO ||
          CONFIG.GUILD_ID
      ).catch(() => null)) ||
      interaction.guild;

    if (!guild) {
      await safeEditReply(interaction, {
        content:
          "❌ Não consegui encontrar o servidor.",
        flags: 64,
      });

      return null;
    }

    const temp =
      client._tempRecrutamento?.[user.id] ||
      {};

    const nomeFinal =
      temp.nomeTrucky ||
      nomeTrucky ||
      "Não informado";

    const linkTrucky =
      temp.linkTrucky || null;

    delete client._tempRecrutamento?.[
      user.id
    ];

    const category =
      await getCategory(
        guild,
        CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO
      );

    const staffRoleId =
      await getStaffRoleId(guild);

    const channelData = {
      name: makeChannelName(
        "recrutamento",
        user
      ),
      type: ChannelType.GuildText,

      permissionOverwrites: [
        {
          id: guild.id,
          deny: [
            PermissionFlagsBits.ViewChannel,
          ],
        },

        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },

        ...(staffRoleId
          ? [
              {
                id: staffRoleId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageMessages,
                ],
              },
            ]
          : []),
      ],
    };

    if (category) {
      channelData.parent = category.id;
    }

    const channel =
      await guild.channels.create(
        channelData
      );

    const ticketId =
      generateTicketId();

    const openedAt = new Date();

    let truckyDisplay =
      nomeFinal;

    if (
      linkTrucky &&
      /^https?:\/\//i.test(linkTrucky)
    ) {
      truckyDisplay =
        `[${nomeFinal}](${linkTrucky})`;
    }

    const ticket = {
      id: ticketId,
      channelId: channel.id,
      guildId: guild.id,

      userId: user.id,
      username: user.username,

      type: "recrutamento",
      label: `${
        CONFIG.EMOJI_RECRUTAMENTO || "📝"
      } Recrutamento PAT`,

      openedAt: openedAt.toISOString(),
      createdAt: openedAt.toISOString(),

      closed: false,
      closedAt: null,
      closedBy: null,
      closedByName: null,

      claimedBy: null,
      claimedByName: null,

      rating: null,

      recrutado: null,
      fotoNome: null,

      truckyNome: nomeFinal,
      truckyLink: linkTrucky,

      regrasAceites: true,

      callActive: false,
      callChannelId: null,

      panelMessageId: null,
    };

    db.tickets[ticketId] = ticket;

    await saveDB();

    // ============================================================
    // EMBED DO TICKET DE RECRUTAMENTO (NOVO FORMATO)
    // ============================================================

    const clockEmoji = getClockEmoji(openedAt);

    const embed = new EmbedBuilder()
      .setTitle(`<@&${CONFIG.CARGO_ADMINISTRACAO}>`)
      .setDescription(
        `ℹ️ **Motivo:** 📝 Recrutamento PAT` +
        `\n🚛 **Trucky:** \`${nomeFinal}\`` +
        `\n\n👮 **Responsável:** ${clockEmoji} Aguardando staff...` +
        `\n👤 **Utilizador:** <@${user.id}> | \`${user.username}\`` +
        `\n\n${clockEmoji} **Abertura:** ${formatDateSimple(openedAt)}` +
        `\n\n👤 Olá <@${user.id}>, aguarde até ser atendido por alguém da staff.` +
        `\n\n⚠️ Lembra-te: qualquer incumprimento das regras levará ao encerramento do ticket sem aviso prévio!`
      )
      .setColor(0x2629F1)
      .setTimestamp(openedAt);

    const row =
      buildTicketButtons(ticketId);

    const panelMessage =
      await channel.send({
        content: `<@${user.id}> | ID: \`${user.id}\``,
        embeds: [embed],
        components: [row],
      });

    ticket.panelMessageId =
      panelMessage.id;

    await saveDB();

    await sendLog(
      ticketId,
      "open",
      client
    ).catch(() => {});

    // ============================================================
    // RESPOSTA DO RECRUTAMENTO (NOVO FORMATO)
    // ============================================================

    const rowIrTicket = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`${CONFIG.EMOJI_TICKET || "🎫"} Ir para o Ticket`)
        .setStyle(ButtonStyle.Link)
        .setURL(
          `https://discord.com/channels/${guild.id}/${channel.id}`
        )
    );

    await safeEditReply(interaction, {
      content: [
        `🎉 **Ticket de recrutamento criado com sucesso!**`,
        ``,
        `🎫 <#${channel.id}>`,
        `🆔 ID: \`${ticketId}\``,
        `${clockEmoji} **Abertura:** ${formatDateSimple(openedAt)}`,
      ].join("\n"),
      components: [rowIrTicket],
      flags: 64,
    });

    return ticket;
  } catch (error) {
    console.error(
      "[Recruitment] Erro:",
      error
    );

    await safeEditReply(interaction, {
      content:
        "❌ Erro ao criar o ticket. Contacta a staff.",
      components: [],
      embeds: [],
      flags: 64,
    }).catch(() => {});

    return null;
  } finally {
    recruitmentLocks.delete(user.id);
  }
}

// ============================================================
// CLAIMING HELPERS
// ============================================================

const claimingTickets = new Map();

export function isClaiming(ticketId) {
  return claimingTickets.has(
    String(ticketId)
  );
}

export function setClaiming(
  ticketId,
  userId
) {
  claimingTickets.set(
    String(ticketId),
    String(userId)
  );
}

export function clearClaiming(ticketId) {
  claimingTickets.delete(
    String(ticketId)
  );
}
