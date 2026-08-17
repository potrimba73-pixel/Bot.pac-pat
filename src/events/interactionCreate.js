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
  AttachmentBuilder,
} from "discord.js";

import {
  handleAjudaCommand,
  handleAjudaFeedback,
  handleAjudaProcurar,
} from "../services/ajuda.js";

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
import { sendPainelChamada } from "../services/calls.js";

// ============================================================
// IMPORTAR FUNÇÕES DE DATA
// ============================================================
import { formatDateFull, formatDateShort } from "../utils/dateUtils.js";

// ============================================================
// PROTEÇÕES
// ============================================================

const ticketLocks = new Map();
const closingTickets = new Set();

function isStaff(member) {
  if (!member) return false;

  if (
    member.permissions?.has(
      PermissionFlagsBits.ManageMessages
    )
  ) {
    return true;
  }

  if (
    CONFIG.CARGO_STAFF &&
    member.roles?.cache?.has(
      CONFIG.CARGO_STAFF
    )
  ) {
    return true;
  }

  return false;
}

async function safeReply(
  interaction,
  content,
  ephemeral = true
) {
  try {
    if (
      interaction.deferred &&
      !interaction.replied
    ) {
      return await interaction.editReply({
        content,
      });
    }

    if (interaction.replied) {
      return await interaction.followUp({
        content,
        flags: ephemeral ? 64 : 0,
      });
    }

    return await interaction.reply({
      content,
      flags: ephemeral ? 64 : 0,
    });
  } catch {
    return null;
  }
}

async function safeDefer(
  interaction
) {
  try {
    if (
      !interaction.deferred &&
      !interaction.replied
    ) {
      await interaction.deferReply({
        flags: 64,
      });

      return true;
    }

    return true;
  } catch (error) {
    console.error(
      "[Interaction] Não foi possível deferir:",
      error
    );

    return false;
  }
}

async function safeEdit(
  interaction,
  data
) {
  try {
    if (interaction.deferred) {
      return await interaction.editReply(
        data
      );
    }

    if (interaction.replied) {
      return await interaction.followUp({
        ...data,
        flags: data.flags ?? 64,
      });
    }

    return await interaction.reply({
      ...data,
      flags: data.flags ?? 64,
    });
  } catch {
    return null;
  }
}

async function persistDB() {
  try {
    await saveDB();
    return true;
  } catch (error) {
    console.error(
      "[DB] Erro ao guardar:",
      error
    );

    return false;
  }
}

function getTicketForInteraction(ticketId, channelId) {
  console.log(
    `[DEBUG] getTicketForInteraction: ticketId=${ticketId}, channelId=${channelId}`
  );

  console.log(
    `[DEBUG] db.tickets keys:`,
    Object.keys(db.tickets || {})
  );

  if (ticketId) {
    const ticket = db.tickets?.[String(ticketId)];

    console.log(
      `[DEBUG] Busca por ID:`,
      ticket
        ? `encontrado (closed=${ticket.closed})`
        : "não encontrado"
    );

    if (ticket && !ticket.closed) {
      return ticket;
    }
  }

  if (channelId) {
    const found = findTicketByChannelId(channelId);

    console.log(
      `[DEBUG] Busca por channelId:`,
      found
        ? `encontrado (id=${found.id})`
        : "não encontrado"
    );

    if (found) {
      return found;
    }
  }

  console.log(`[DEBUG] Ticket não encontrado`);

  return null;
}

async function withTicketLock(
  ticketId,
  callback
) {
  const key = String(ticketId);

  while (ticketLocks.has(key)) {
    await new Promise((resolve) =>
      setTimeout(resolve, 50)
    );
  }

  ticketLocks.set(key, true);

  try {
    return await callback();
  } finally {
    ticketLocks.delete(key);
  }
}

function isClosing(ticketId) {
  return closingTickets.has(
    String(ticketId)
  );
}

function setClosing(ticketId) {
  closingTickets.add(
    String(ticketId)
  );
}

function clearClosing(ticketId) {
  closingTickets.delete(
    String(ticketId)
  );
}

// ============================================================
// MAIN INTERACTION
// ============================================================

export async function handleInteractionCreate(
  interaction,
  client
) {
  try {
    // ========================================================
    // SLASH COMMANDS
    // ========================================================

    if (
      interaction.isChatInputCommand()
    ) {
      const command =
        interaction.commandName;

      if (command === "ajuda") {
        if (
          !(await safeDefer(interaction))
        ) {
          return;
        }

        return handleAjudaCommand(
          interaction,
          client
        );
      }

      if (command === "transcript") {
        if (!isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        const ticket =
          getTicketForInteraction(
            null,
            interaction.channelId
          );

        if (!ticket) {
          return safeReply(
            interaction,
            "⚠️ Nenhum ticket ativo encontrado neste canal."
          );
        }

        if (
          !(await safeDefer(interaction))
        ) {
          return;
        }

        try {
          const messages =
            await interaction.channel.messages.fetch(
              { limit: 200 }
            );

          const sorted =
            Array.from(
              messages.values()
            ).sort(
              (a, b) =>
                a.createdTimestamp -
                b.createdTimestamp
            );

          const html =
            generateTranscriptHTML(
              sorted,
              ticket,
              interaction.guild
            );

          const attachment =
            new AttachmentBuilder(
              Buffer.from(
                html,
                "utf-8"
              ),
              {
                name: `transcript-ticket-${ticket.id}.html`,
              }
            );

          await interaction.editReply({
            content: `📋 Transcript do Ticket #${ticket.id}`,
            files: [attachment],
          });

          await sendLog(
            ticket.id,
            "transcript",
            client
          ).catch(() => {});
        } catch (error) {
          console.error(
            "[Transcript] Erro:",
            error
          );

          await safeEdit(
            interaction,
            {
              content:
                "❌ Erro ao gerar o transcript.",
            }
          );
        }

        return;
      }

      if (command === "painelmembro") {
        return enviarPainelMembro(
          interaction
        );
      }

      if (command === "painelstaff") {
        if (!isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        return enviarPainelStaff(
          interaction,
          client
        );
      }

      if (command === "limpar") {
        if (!isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        const { execute } =
          await import(
            "../commands/limpar.js"
          );

        return execute(
          interaction,
          client
        );
      }

      if (command === "status") {
        const { execute } =
          await import(
            "../commands/status.js"
          );

        return execute(
          interaction,
          client
        );
      }

      if (command === "passar") {
        if (!isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        const { execute } =
          await import(
            "../commands/passar.js"
          );

        return execute(
          interaction,
          client
        );
      }

      if (command === "pedirassumo") {
        if (!isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        const { execute } =
          await import(
            "../commands/pedirassumo.js"
          );

        return execute(
          interaction,
          client
        );
      }

      if (
        [
          "verificar-inatividade",
          "minhas-cargas",
          "estatisticas-vtc",
          "atualizar-patentes",
          "limpeza",
          "mapa",
        ].includes(command)
      ) {
        const staffCommands = [
          "verificar-inatividade",
          "atualizar-patentes",
          "limpeza",
        ];

        if (
          staffCommands.includes(
            command
          ) &&
          !isStaff(interaction.member)
        ) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        const {
          handleTruckyCommand,
        } = await import(
          "../commands/truckyCommands.js"
        );

        return handleTruckyCommand(
          interaction,
          client
        );
      }

      if (
        [
          "gerar-foto",
          "minha-foto",
          "gerar-patente",
          "verificar-templates",
        ].includes(command)
      ) {
        if (
          command ===
            "gerar-patente" &&
          !isStaff(interaction.member)
        ) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        const {
          handleTruckyImageCommand,
        } = await import(
          "../commands/truckyImageCommands.js"
        );

        return handleTruckyImageCommand(
          interaction
        );
      }

      if (command === "mapa-canal") {
        if (!isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        const {
          handleMapaCanalCommand,
        } = await import(
          "../commands/truckyMapaCanal.js"
        );

        return handleMapaCanalCommand(
          interaction,
          client
        );
      }

      if (command === "apagar") {
        if (
          !interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          return safeReply(
            interaction,
            "❌ Apenas administradores podem usar este comando."
          );
        }

        const { execute } =
          await import(
            "../commands/apagar.js"
          );

        return execute(
          interaction,
          client
        );
      }

      if (
        command === "transcript-full"
      ) {
        if (!isStaff(interaction.member)) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode usar este comando."
          );
        }

        const {
          handleTranscriptCommand,
        } = await import(
          "../commands/transcript.js"
        );

        return handleTranscriptCommand(
          interaction,
          client
        );
      }

      return safeReply(
        interaction,
        "⚠️ Comando não reconhecido."
      );
    }

    // ========================================================
    // MODALS
    // ========================================================

    if (interaction.isModalSubmit()) {
      if (
        interaction.customId.startsWith(
          "modal_trucky_"
        )
      ) {
        return handleTruckyVerification(
          interaction,
          client
        );
      }

      if (
        interaction.customId.startsWith(
          "modal_ajuda_"
        )
      ) {
        const especificacoes =
          interaction.fields
            .getTextInputValue(
              "ajuda_especificacoes"
            )
            ?.trim();

        interaction._ajudaEspecificacoes =
          especificacoes;

        return createTicket(
          interaction,
          "ajuda",
          "❓ Pedir ajuda",
          client
        );
      }

      if (
        interaction.customId.startsWith(
          "modal_foto_trucky_"
        )
      ) {
        if (
          !(await safeDefer(
            interaction
          ))
        ) {
          return;
        }

        return handleFotoTruckyModal(
          interaction,
          client
        );
      }

      return;
    }

    // ========================================================
    // SELECT MENUS
    // ========================================================

    if (
      interaction.isStringSelectMenu()
    ) {
      if (
        interaction.customId ===
        "ticket_geral"
      ) {
        const value =
          interaction.values[0];

        const labels = {
          bugs: "🐛 Bugs",
          denuncia: "🚨 Denuncia",
          suporte: "🔧 Suporte",
          criador:
            "🎥 Criador De Conteudo",
        };

        if (!labels[value]) {
          return safeReply(
            interaction,
            "❌ Categoria de ticket inválida."
          );
        }

        return createTicket(
          interaction,
          value,
          labels[value],
          client
        );
      }

      if (
        interaction.customId ===
        "ticket_recruitamento"
      ) {
        const value =
          interaction.values[0];

        if (
          value ===
          "recrutamento"
        ) {
          return createTicket(
            interaction,
            "recrutamento",
            "📝 Recrutamento PAT",
            client
          );
        }

        if (value === "ajuda") {
          const modal =
            new ModalBuilder()
              .setCustomId(
                `modal_ajuda_${interaction.user.id}_${Date.now()}`
              )
              .setTitle(
                "❓ Especificações do Problema"
              );

          const input =
            new TextInputBuilder()
              .setCustomId(
                "ajuda_especificacoes"
              )
              .setLabel(
                "Descreve o teu problema ou dúvida"
              )
              .setPlaceholder(
                "Ex: Não consigo instalar o Trucky App..."
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setRequired(true)
              .setMaxLength(1000);

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              input
            )
          );

          try {
            return await interaction.showModal(
              modal
            );
          } catch (error) {
            console.error(
              "[Modal Ajuda] Erro:",
              error
            );
          }
        }
      }

      return;
    }

    // ========================================================
    // BUTTONS
    // ========================================================

    if (interaction.isButton()) {
      const customId =
        interaction.customId;

      // ======================================================
      // REGRAS
      // ======================================================

      if (
        customId ===
        "aceitar_regras"
      ) {
        const member =
          interaction.member;

        if (
          !(await safeDefer(
            interaction
          ))
        ) {
          return;
        }

        try {
const cargos = [
  CONFIG.CARGO_MEMBRO,
  CONFIG.CARGO_REGRAS_EXTRA_1,
  CONFIG.CARGO_REGRAS_EXTRA_2,
  "1534970663344017479",   // ← cargo adicional
].filter(Boolean);

          for (const roleId of cargos) {
            const role =
              interaction.guild.roles.cache.get(
                roleId
              );

            if (
              role &&
              !member.roles.cache.has(
                role.id
              )
            ) {
              await member.roles
                .add(role)
                .catch(() => {});
            }
          }

          if (!db.acceptedRules) {
            db.acceptedRules = [];
          }

          if (
            !db.acceptedRules.includes(
              member.id
            )
          ) {
            db.acceptedRules.push(
              member.id
            );
          }

          if (!db.acceptedRulesAt) {
            db.acceptedRulesAt = {};
          }

          db.acceptedRulesAt[
            member.id
          ] = new Date().toISOString();

          await persistDB();

          return safeEdit(
            interaction,
            {
              content:
                "✅ Regras aceites com sucesso! Bem-vind@ à **Portugal Alfa Community** 🎉",
            }
          );
        } catch (error) {
          console.error(
            "[Regras] Erro:",
            error
          );

          return safeEdit(
            interaction,
            {
              content:
                "❌ Erro ao processar. Tenta novamente.",
            }
          );
        }
      }

      // ======================================================
      // ACEITAR RECRUTAMENTO
      // ======================================================

      if (
        customId.startsWith(
          "aceitar_regras_rec_"
        )
      ) {
        const parts =
          customId.split("_");

        const userId =
          parts[3];

        if (
          interaction.user.id !==
          userId
        ) {
          return safeReply(
            interaction,
            "⚠️ Este botão não está disponível para ti."
          );
        }

        return criarTicketRecrutamento(
          interaction,
          client,
          null
        );
      }

      // ======================================================
      // RECUSAR RECRUTAMENTO
      // ======================================================

      if (
        customId.startsWith(
          "recusar_regras_rec_"
        )
      ) {
        const userId =
          customId.split("_")[3];

        if (
          interaction.user.id !==
          userId
        ) {
          return safeReply(
            interaction,
            "⚠️ Este botão não é para ti."
          );
        }

        try {
          return await interaction.update(
            {
              content:
                "❌ Recrutamento cancelado. Se mudares de ideias, podes voltar a candidatar-te mais tarde.",
              embeds: [],
              components: [],
            }
          );
        } catch {
          return null;
        }
      }

      // ======================================================
      // ASSUMIR
      // ======================================================

      if (
        customId.startsWith(
          "assumir_"
        )
      ) {
        const ticketId =
          customId.substring(
            "assumir_".length
          );

        if (
          !(await safeDefer(
            interaction
          ))
        ) {
          return;
        }

        if (
          !isStaff(
            interaction.member
          )
        ) {
          return safeEdit(
            interaction,
            {
              content:
                "❌ Apenas staff pode assumir tickets.",
            }
          );
        }

        if (
          isClaiming(ticketId)
        ) {
          return safeEdit(
            interaction,
            {
              content:
                "⏳ Outro membro da staff está a assumir este ticket.",
            }
          );
        }

        setClaiming(
          ticketId,
          interaction.user.id
        );

        try {
          const ticket =
            getTicketForInteraction(
              ticketId,
              interaction.channelId
            );

          if (
            !ticket ||
            ticket.closed
          ) {
            return safeEdit(
              interaction,
              {
                content:
                  "⚠️ Ticket não encontrado ou já fechado.",
              }
            );
          }

          if (ticket.claimedBy) {
            return safeEdit(
              interaction,
              {
                content:
                  `⚠️ Este ticket já foi assumido por <@${ticket.claimedBy}>.`,
              }
            );
          }

          await withTicketLock(
            ticket.id,
            async () => {
              const current =
                db.tickets[
                  String(ticket.id)
                ];

              if (
                !current ||
                current.closed
              ) {
                throw new Error(
                  "TICKET_NOT_FOUND"
                );
              }

              if (
                current.claimedBy
              ) {
                throw new Error(
                  "TICKET_ALREADY_CLAIMED"
                );
              }

              current.claimedBy =
                interaction.user.id;

              current.claimedByName =
                interaction.user.username;

              const saved =
                await persistDB();

              if (!saved) {
                throw new Error(
                  "DB_SAVE_FAILED"
                );
              }
            }
          );

          const channel =
            await client.channels
              .fetch(
                ticket.channelId
              )
              .catch(() => null);

          if (!channel) {
            return safeEdit(
              interaction,
              {
                content:
                  "❌ O canal deste ticket já não existe.",
              }
            );
          }

          await updateTicketEmbed(
            channel,
            ticket.id
          );

          await channel.send(
            [
              "🎉 **Ticket assumido com sucesso!**",
              "",
              `👮 <@${interaction.user.id}> assumiu este ticket.`,
              "Se precisares de chamar outro membro da staff, usa o **Painel Membro**.",
            ].join("\n")
          );

          return safeEdit(
            interaction,
            {
              content:
                "✅ Ticket assumido com sucesso!",
            }
          );
        } catch (error) {
          console.error(
            "[Assumir] Erro:",
            error
          );

          if (
            error.message ===
            "TICKET_ALREADY_CLAIMED"
          ) {
            return safeEdit(
              interaction,
              {
                content:
                  "⚠️ Este ticket já foi assumido por outro membro da staff.",
              }
            );
          }

          if (
            error.message ===
            "TICKET_NOT_FOUND"
          ) {
            return safeEdit(
              interaction,
              {
                content:
                  "⚠️ Ticket não encontrado ou já fechado.",
              }
            );
          }

          return safeEdit(
            interaction,
            {
              content:
                "❌ Ocorreu um erro ao assumir o ticket.",
            }
          );
        } finally {
          clearClaiming(
            ticketId
          );
        }
      }

      // ======================================================
      // PAINEL MEMBRO
      // ======================================================

      if (
        customId.startsWith(
          "painel_membro_"
        )
      ) {
        const ticketId =
          customId.substring(
            "painel_membro_".length
          );

        if (
          !(await safeDefer(
            interaction
          ))
        ) {
          return;
        }

        const ticket =
          getTicketForInteraction(
            ticketId,
            interaction.channelId
          );

        if (
          !ticket ||
          ticket.closed
        ) {
          return safeEdit(
            interaction,
            {
              content:
                "⚠️ Ticket não encontrado ou já fechado.",
            }
          );
        }

        const staffList =
          await buildStaffList(
            interaction.channel,
            ticket
          );

        if (
          staffList.length === 0
        ) {
          return safeEdit(
            interaction,
            {
              content:
                "⚠️ Nenhum membro da staff encontrado neste ticket.",
            }
          );
        }

        const staffText =
          staffList
            .map(
              (staff) =>
                `**${staff.roleName}** | ${staff.displayName} | <@${staff.member.id}>`
            )
            .join("\n");

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🛡️ Painel Membro"
            )
            .setDescription(
              [
                "📋 **Lista de staff disponível neste ticket:**",
                "",
                staffText,
              ].join("\n")
            )
            .setColor(0x2629F1);

        return safeEdit(
          interaction,
          {
            embeds: [embed],
          }
        );
      }

      // ======================================================
      // SAIR
      // ======================================================

      if (
        customId.startsWith(
          "sair_"
        )
      ) {
        const ticketId =
          customId.substring(
            "sair_".length
          );

        if (
          !(await safeDefer(
            interaction
          ))
        ) {
          return;
        }

        const ticket =
          getTicketForInteraction(
            ticketId,
            interaction.channelId
          );

        if (
          !ticket ||
          ticket.closed
        ) {
          return safeEdit(
            interaction,
            {
              content:
                "⚠️ Ticket não encontrado ou já fechado.",
            }
          );
        }

        if (
          ticket.userId !==
          interaction.user.id
        ) {
          return safeEdit(
            interaction,
            {
              content:
                "⚠️ Só quem abriu o ticket pode sair.",
            }
          );
        }

        const channel =
          await client.channels
            .fetch(ticket.channelId)
            .catch(() => null);

        if (!channel) {
          return safeEdit(
            interaction,
            {
              content:
                "❌ O canal do ticket já não existe.",
            }
          );
        }

        try {
          await channel.permissionOverwrites.delete(
            interaction.user.id
          );

          return safeEdit(
            interaction,
            {
              content:
                "✅ Saíste do ticket com sucesso.",
            }
          );
        } catch {
          return safeEdit(
            interaction,
            {
              content:
                "❌ Não consegui remover o teu acesso ao ticket.",
            }
          );
        }
      }

      // ======================================================
      // FECHAR
      // ======================================================

      if (
        customId.startsWith(
          "deletar_"
        )
      ) {
        const ticketId =
          customId.substring(
            "deletar_".length
          );

        if (
          !(await safeDefer(
            interaction
          ))
        ) {
          return;
        }

        if (
          !isStaff(
            interaction.member
          )
        ) {
          return safeEdit(
            interaction,
            {
              content:
                "❌ Apenas staff pode fechar tickets.",
            }
          );
        }

        const ticket =
          getTicketForInteraction(
            ticketId,
            interaction.channelId
          );

        if (
          !ticket ||
          ticket.closed
        ) {
          return safeEdit(
            interaction,
            {
              content:
                "⚠️ Ticket não encontrado ou já fechado.",
            }
          );
        }

        if (
          ticket.type ===
          "recrutamento"
        ) {
          const row =
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `recrutado_sim_${ticket.id}`
                )
                .setLabel(
                  "🎉 Sim - Recrutado"
                )
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `recrutado_nao_${ticket.id}`
                )
                .setLabel(
                  "😔 Não - Não Recrutado"
                )
                .setStyle(
                  ButtonStyle.Danger
                ),

              new ButtonBuilder()
                .setCustomId(
                  `fechar_definitivo_${ticket.id}`
                )
                .setLabel(
                  "🔒 Fechar Definitivo"
                )
                .setStyle(
                  ButtonStyle.Secondary
                )
            );

          return safeEdit(
            interaction,
            {
              content:
                "❓ **O candidato foi recrutado?**",
              components: [row],
            }
          );
        }

        return fecharTicket(
          interaction,
          ticket.id,
          client,
          false
        );
      }

      // ======================================================
      // RECRUTADO SIM
      // ======================================================

      if (
        customId.startsWith(
          "recrutado_sim_"
        )
      ) {
        const ticketId =
          customId.substring(
            "recrutado_sim_".length
          );

        if (
          !isStaff(
            interaction.member
          )
        ) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode confirmar o recrutamento."
          );
        }

        const ticket =
          getTicketForInteraction(
            ticketId,
            interaction.channelId
          );

        if (
          !ticket ||
          ticket.closed
        ) {
          return safeReply(
            interaction,
            "⚠️ Ticket não encontrado ou já fechado."
          );
        }

        const modal =
          new ModalBuilder()
            .setCustomId(
              `modal_foto_trucky_${ticket.id}`
            )
            .setTitle(
              "🎉 Nome da Foto do Trucky"
            );

        const input =
          new TextInputBuilder()
            .setCustomId(
              "foto_nome"
            )
            .setLabel(
              "Nome da tua foto de perfil do Trucky"
            )
            .setPlaceholder(
              "Ex: Diego"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(100);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            input
          )
        );

        try {
          return await interaction.showModal(
            modal
          );
        } catch {
          return null;
        }
      }

      // ======================================================
      // RECRUTADO NÃO
      // ======================================================

      if (
        customId.startsWith(
          "recrutado_nao_"
        )
      ) {
        const ticketId =
          customId.substring(
            "recrutado_nao_".length
          );

        if (
          !isStaff(
            interaction.member
          )
        ) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode marcar como não recrutado."
          );
        }

        return fecharTicket(
          interaction,
          ticketId,
          client,
          false
        );
      }

      // ======================================================
      // FECHAR DEFINITIVO
      // ======================================================

      if (
        customId.startsWith(
          "fechar_definitivo_"
        )
      ) {
        const ticketId =
          customId.substring(
            "fechar_definitivo_".length
          );

        if (
          !isStaff(
            interaction.member
          )
        ) {
          return safeReply(
            interaction,
            "❌ Apenas staff pode fechar este ticket."
          );
        }

        return fecharTicket(
          interaction,
          ticketId,
          client,
          false
        );
      }

      // ======================================================
      // AVALIAÇÃO
      // ======================================================

      if (
        customId.startsWith(
          "avaliar_"
        )
      ) {
        const parts =
          customId.split("_");

        const ticketId =
          parts[1];

        const estrelas =
          Number(parts[2]);

        const ticket =
          db.tickets?.[
            String(ticketId)
          ];

        if (!ticket) {
          return safeReply(
            interaction,
            "⚠️ Ticket não encontrado."
          );
        }

        if (
          !Number.isInteger(
            estrelas
          ) ||
          estrelas < 1 ||
          estrelas > 5
        ) {
          return safeReply(
            interaction,
            "⚠️ Avaliação inválida."
          );
        }

        if (
          ticket.rating !== null &&
          ticket.rating !== undefined
        ) {
          return safeReply(
            interaction,
            `⚠️ Já avaliaste este ticket com ${"⭐".repeat(ticket.rating)} (${ticket.rating}/5).`
          );
        }

        ticket.rating =
          estrelas;

        await persistDB();

        const stars =
          "⭐".repeat(
            estrelas
          ) +
          "☆".repeat(
            5 - estrelas
          );

        try {
          return await interaction.update(
            {
              content: [
                "✅ **Obrigado pela tua avaliação!**",
                "",
                `Avaliação: ${stars} (${estrelas}/5)`,
              ].join("\n"),
              components: [],
            }
          );
        } catch {
          return null;
        }
      }

      // ======================================================
      // SISTEMA DE AJUDA
      // ======================================================

      if (
        customId ===
        "ajuda_procurar"
      ) {
        return handleAjudaProcurar(
          interaction
        );
      }

      if (
        customId ===
          "ajuda_ticket" ||
        customId.startsWith(
          "ajuda_ticket_direct_"
        ) ||
        customId ===
          "ajuda_faq" ||
        customId ===
          "ajuda_nova" ||
        customId.startsWith(
          "smart_helpful_"
        ) ||
        customId.startsWith(
          "smart_not_helpful_"
        )
      ) {
        return handleAjudaFeedback(
          interaction
        );
      }

      return safeReply(
        interaction,
        "⚠️ Ação desconhecida."
      );
    }
  } catch (error) {
    console.error(
      "[InteractionCreate] Erro não tratado:",
      error
    );

    try {
      await safeReply(
        interaction,
        "❌ Ocorreu um erro ao processar esta ação."
      );
    } catch {}
  }
}

// ============================================================
// FECHAR TICKET (com novo formato)
// ============================================================

async function fecharTicket(
  interaction,
  ticketId,
  client,
  recrutado = false
) {
  if (isClosing(ticketId)) {
    return safeReply(
      interaction,
      "⏳ Este ticket já está a ser fechado."
    );
  }

  setClosing(ticketId);

  try {
    const ticket =
      getTicketForInteraction(
        ticketId,
        interaction.channelId
      );

    if (
      !ticket ||
      ticket.closed
    ) {
      return safeReply(
        interaction,
        "⚠️ Ticket não encontrado ou já fechado."
      );
    }

    await withTicketLock(
      ticket.id,
      async () => {
        const current =
          db.tickets[
            String(ticket.id)
          ];

        if (
          !current ||
          current.closed
        ) {
          throw new Error(
            "ALREADY_CLOSED"
          );
        }

        current.closed = true;
        current.recrutado =
          recrutado;

        current.closedBy =
          interaction.user.id;

        current.closedByName =
          interaction.user.username;

        current.closedAt =
          new Date().toISOString();

        const saved =
          await persistDB();

        if (!saved) {
          throw new Error(
            "DB_SAVE_FAILED"
          );
        }
      }
    );

    await sendLog(
      ticket.id,
      "close",
      client
    ).catch(() => {});

    const channel =
      await client.channels
        .fetch(ticket.channelId)
        .catch(() => null);

    if (channel) {
      // ------------------------------------------------------
      // EMBED DE FECHO NO CANAL (NOVO FORMATO)
      // ------------------------------------------------------
      const isRecruitment = ticket.type === 'recrutamento';
      const recrutadoText = ticket.recrutado === true ? '✅ Sim' : ticket.recrutado === false ? '❌ Não' : 'N/A';

      let desc = `👤 **Aberto por:** <@${ticket.userId}> | \`${ticket.username}\``;
      if (isRecruitment && ticket.truckyNome) {
        desc += `\n🚛 **Trucky:** \`${ticket.truckyNome}\``;
      }
      desc += `\n📝 **Tipo:** ${ticket.label}`;
      desc += `\n\n⚒️ **Assumido por:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Não assumido'}`;
      desc += `\n⚒️ **Fechado por:** ${interaction.user ? `<@${interaction.user.id}>` : 'Sistema'}`;
      desc += `\n\n↕ **Informações Adicionais:**`;
      desc += `\n🕑 **Horários:**`;
      desc += `\n• **Abertura:** ${formatDateFull(ticket.openedAt)}`;
      desc += `\n• **Fechamento:** ${formatDateFull(new Date())}`;

      if (isRecruitment) {
        desc += `\n🚛 **Nome no Trucky:**`;
        desc += `\n• \`${ticket.truckyNome || 'Não informado'}\``;
        desc += `\n💼 **Recrutado:**`;
        desc += `\n• ${recrutadoText}`;
        if (ticket.fotoNome) {
          desc += `\n📷 **Nome para Foto:**`;
          desc += `\n• \`${ticket.fotoNome}\``;
        }
      }

      const embed =
        new EmbedBuilder()
          .setTitle(`🗑️ Ticket Fechado - #${ticket.id}`)
          .setDescription(desc)
          .setColor(0x2629F1)
          .setTimestamp();

      await channel.send({
        embeds: [embed],
      }).catch(() => {});

      // ------------------------------------------------------
      // DM DE AVALIAÇÃO (NOVO FORMATO)
      // ------------------------------------------------------
      try {
        const user =
          await client.users.fetch(
            ticket.userId
          );

        const embedDM =
          new EmbedBuilder()
            .setTitle('🎫 Ticket Fechado')
            .setDescription(
              `ℹ️ O seu ticket foi fechado com sucesso! Avalie o nosso atendimento clicando nas estrelas abaixo.` +
              `\n\n🎫 **Ticket:** #${ticket.id}` +
              `\n📝 **Tipo:** ${ticket.label}` +
              `\n\n⚒️ **Fechado por:** ${interaction.user.username}` +
              `\n🕑 **Fechado em:** ${formatDateShort(new Date())}` +
              `\n\n🎫 Caso seja necessário, não hesite em abrir um novo ticket!`
            )
            .setColor(0xFF0000)
            .setTimestamp();

        const row =
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(
                `avaliar_${ticket.id}_1`
              )
              .setLabel(
                "1 ⭐"
              )
              .setStyle(
                ButtonStyle.Secondary
              ),

            new ButtonBuilder()
              .setCustomId(
                `avaliar_${ticket.id}_2`
              )
              .setLabel(
                "2 ⭐⭐"
              )
              .setStyle(
                ButtonStyle.Secondary
              ),

            new ButtonBuilder()
              .setCustomId(
                `avaliar_${ticket.id}_3`
              )
              .setLabel(
                "3 ⭐⭐⭐"
              )
              .setStyle(
                ButtonStyle.Secondary
              ),

            new ButtonBuilder()
              .setCustomId(
                `avaliar_${ticket.id}_4`
              )
              .setLabel(
                "4 ⭐⭐⭐⭐"
              )
              .setStyle(
                ButtonStyle.Secondary
              ),

            new ButtonBuilder()
              .setCustomId(
                `avaliar_${ticket.id}_5`
              )
              .setLabel(
                "5 ⭐⭐⭐⭐⭐"
              )
              .setStyle(
                ButtonStyle.Secondary
              )
          );

        await user.send({
          embeds: [embedDM],
          components: [row],
        });
      } catch (error) {
        console.log(
          "[Tickets] Não foi possível enviar DM:",
          error.message
        );
      }

      // ------------------------------------------------------
      // APAGAR CANAL
      // ------------------------------------------------------
      setTimeout(async () => {
        await channel
          .delete()
          .catch(() => {});
      }, 10000);
    }

    return safeReply(
      interaction,
      "✅ Ticket fechado com sucesso."
    );
  } catch (error) {
    console.error(
      "[FecharTicket] Erro:",
      error
    );

    if (
      error.message ===
      "ALREADY_CLOSED"
    ) {
      return safeReply(
        interaction,
        "⚠️ Este ticket já foi fechado."
      );
    }

    return safeReply(
      interaction,
      "❌ Ocorreu um erro ao fechar o ticket."
    );
  } finally {
    clearClosing(ticketId);
  }
}

// ============================================================
// FOTO TRUCKY / RECRUTAMENTO CONCLUÍDO
// ============================================================

async function handleFotoTruckyModal(
  interaction,
  client
) {
  if (
    !isStaff(interaction.member)
  ) {
    return safeEdit(
      interaction,
      {
        content:
          "❌ Apenas staff pode completar o recrutamento.",
      }
    );
  }

  const ticketId =
    interaction.customId.replace(
      "modal_foto_trucky_",
      ""
    );

  if (isClosing(ticketId)) {
    return safeEdit(
      interaction,
      {
        content:
          "⏳ Este ticket já está a ser fechado.",
      }
    );
  }

  setClosing(ticketId);

  try {
    const ticket =
      getTicketForInteraction(
        ticketId,
        interaction.channelId
      );

    if (
      !ticket ||
      ticket.closed ||
      ticket.recrutado
    ) {
      return safeEdit(
        interaction,
        {
          content:
            "⚠️ Ticket não encontrado, já fechado ou já recrutado.",
        }
      );
    }

    let fotoNome =
      interaction.fields
        .getTextInputValue(
          "foto_nome"
        )
        ?.trim() ||
      "Não informado";

    fotoNome =
      fotoNome.replace(
        /\.[^/.]+$/,
        ""
      );

    await withTicketLock(
      ticket.id,
      async () => {
        const current =
          db.tickets[
            String(ticket.id)
          ];

        if (
          !current ||
          current.closed ||
          current.recrutado
        ) {
          throw new Error(
            "INVALID_STATE"
          );
        }

        current.fotoNome =
          fotoNome;

        current.recrutado =
          true;

        current.closed = true;

        current.closedBy =
          interaction.user.id;

        current.closedByName =
          interaction.user.username;

        current.closedAt =
          new Date().toISOString();

        const saved =
          await persistDB();

        if (!saved) {
          throw new Error(
            "DB_SAVE_FAILED"
          );
        }
      }
    );

    // --------------------------------------------------------
    // DAR CARGOS
    // --------------------------------------------------------

    const guild =
      await client.guilds.fetch(
        ticket.guildId
      ).catch(() => null);

    if (guild) {
      const member =
        await guild.members
          .fetch(ticket.userId)
          .catch(() => null);

      if (member) {
        const roles = [
          CONFIG.CARGO_RECRUTADO,
          CONFIG.CARGO_RECRUTAMENTO_1,
        ].filter(Boolean);

        for (const roleId of roles) {
          const role =
            guild.roles.cache.get(
              roleId
            );

          if (role) {
            await member.roles
              .add(role)
              .catch(() => {});
          }
        }
      }
    }

    // --------------------------------------------------------
    // MENSAGEM GERAL
    // --------------------------------------------------------

    if (CONFIG.CANAL_GERAL) {
      const canalGeral =
        await client.channels
          .fetch(
            CONFIG.CANAL_GERAL
          )
          .catch(() => null);

      if (canalGeral) {
        await canalGeral.send(
          [
            "🎉 **Bem-vindo a Portugal Alfa Truckers!**",
            "",
            `Parabéns <@${ticket.userId}>! Foste recrutado com sucesso.`,
            "",
            `📸 Foto do Trucky: **${fotoNome}**`,
            "",
            "🚛 Diverte-te e bons quilómetros!",
          ].join("\n")
        ).catch(() => {});
      }
    }

    await sendLog(
      ticket.id,
      "close",
      client
    ).catch(() => {});

    const channel =
      await client.channels
        .fetch(ticket.channelId)
        .catch(() => null);

    if (channel) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "🎉 Recrutamento concluído"
            )
            .setDescription(
              [
                `✅ <@${ticket.userId}> foi recrutado com sucesso!`,
                "",
                `📸 Foto do Trucky: **${fotoNome}**`,
                "",
                `👮 Processado por: ${interaction.user.username}`,
              ].join("\n")
            )
            .setColor(0x00ff00),
        ],
      }).catch(() => {});

      setTimeout(async () => {
        await channel
          .delete()
          .catch(() => {});
      }, 10000);
    }

    return safeEdit(
      interaction,
      {
        content:
          `✅ Utilizador recrutado com sucesso!\n📸 Foto do Trucky: **${fotoNome}**\n🗑️ O ticket será apagado em 10 segundos.`,
      }
    );
  } catch (error) {
    console.error(
      "[Recrutamento] Erro:",
      error
    );

    return safeEdit(
      interaction,
      {
        content:
          "❌ Ocorreu um erro ao concluir o recrutamento.",
      }
    );
  } finally {
    clearClosing(ticketId);
  }
}

// ============================================================
// PAINEL MEMBRO
// ============================================================

async function enviarPainelMembro(
  interaction
) {
  if (
    !(await safeDefer(
      interaction
    ))
  ) {
    return;
  }

  const ticket =
    getTicketForInteraction(
      null,
      interaction.channelId
    );

  if (!ticket) {
    return safeEdit(
      interaction,
      {
        content:
          "⚠️ Nenhum ticket ativo encontrado neste canal.",
      }
    );
  }

  const staffList =
    await buildStaffList(
      interaction.channel,
      ticket
    );

  if (
    staffList.length === 0
  ) {
    return safeEdit(
      interaction,
      {
        content:
          "⚠️ Nenhum membro da staff encontrado neste ticket.",
      }
    );
  }

  const text =
    staffList
      .map(
        (staff) =>
          `**${staff.roleName}** | ${staff.displayName} | <@${staff.member.id}>`
      )
      .join("\n");

  const embed =
    new EmbedBuilder()
      .setTitle(
        "🛡️ Painel Membro"
      )
      .setDescription(
        [
          "📋 **Lista de staff disponível neste ticket:**",
          "",
          text,
        ].join("\n")
      )
      .setColor(0x2629F1);

  return safeEdit(
    interaction,
    {
      embeds: [embed],
    }
  );
}

// ============================================================
// PAINEL STAFF
// ============================================================

async function enviarPainelStaff(
  interaction,
  client
) {
  if (
    !(await safeDefer(
      interaction
    ))
  ) {
    return;
  }

  const ticket =
    getTicketForInteraction(
      null,
      interaction.channelId
    );

  if (!ticket) {
    return safeEdit(
      interaction,
      {
        content:
          "⚠️ Nenhum ticket ativo encontrado neste canal.",
      }
    );
  }

  try {
    return await sendPainelChamada(
      interaction.channel,
      ticket.id,
      interaction
    );
  } catch (error) {
    console.error(
      "[PainelStaff] Erro:",
      error
    );

    return safeEdit(
      interaction,
      {
        content:
          "❌ Não foi possível abrir o painel de staff.",
      }
    );
  }
}

// ============================================================
// STAFF LIST
// ============================================================

async function buildStaffList(
  channel,
  ticket
) {
  const members =
    await channel.members
      .fetch()
      .catch(() => null);

  if (!members) return [];

  const staffList = [];

  const botId =
    CONFIG.BOT_ID_EXCLUIR ||
    channel.client.user.id;

  for (
    const [
      memberId,
      member,
    ] of members
  ) {
    if (
      memberId === botId
    ) {
      continue;
    }

    if (
      memberId === ticket.userId
    ) {
      continue;
    }

    const permissions =
      channel.permissionsFor(
        member
      );

    if (
      !permissions?.has(
        PermissionFlagsBits.ViewChannel
      ) ||
      !permissions?.has(
        PermissionFlagsBits.SendMessages
      )
    ) {
      continue;
    }

    const highestRole =
      member.roles.cache
        .sort(
          (a, b) =>
            b.position -
            a.position
        )
        .first();

    staffList.push({
      member,
      rolePosition:
        highestRole?.position ||
        0,
      roleName:
        highestRole?.name ||
        "Sem cargo",
      displayName:
        member.displayName ||
        member.user.username,
    });
  }

  staffList.sort(
    (a, b) => {
      if (
        b.rolePosition !==
        a.rolePosition
      ) {
        return (
          b.rolePosition -
          a.rolePosition
        );
      }

      return a.displayName.localeCompare(
        b.displayName
      );
    }
  );

  return staffList;
}

// ============================================================
// TRANSCRIPT HTML
// ============================================================

function escapeHTML(value) {
  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    );
}

function generateTranscriptHTML(
  messages,
  ticket,
  guild
) {
  const content =
    messages
      .map((message) => {
        const avatar =
          message.author.displayAvatarURL(
            {
              extension: "png",
              size: 64,
            }
          );

        const date =
          message.createdAt.toLocaleString(
            "pt-PT"
          );

        const text =
          message.content
            ? escapeHTML(
                message.content
              ).replace(
                /\n/g,
                "<br>"
              )
            : "<em>[sem texto]</em>";

        const attachments =
          Array.from(
            message.attachments.values()
          )
            .map(
              (attachment) =>
                `<a href="${escapeHTML(
                  attachment.url
                )}" target="_blank">${escapeHTML(
                  attachment.name
                )}</a>`
            )
            .join("<br>");

        return `
<div class="message">
  <img class="avatar" src="${escapeHTML(
    avatar
  )}">
  <div class="content">
    <div>
      <strong>${escapeHTML(
        message.author.tag
      )}</strong>
      <span class="time">${escapeHTML(
        date
      )}</span>
    </div>

    <div class="body">
      ${text}
    </div>

    ${
      attachments
        ? `<div class="attachments">${attachments}</div>`
        : ""
    }
  </div>
</div>`;
      })
      .join("\n");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcript - Ticket #${escapeHTML(
    ticket.id
  )}</title>

<style>
body {
  background: #36393f;
  color: #dcddde;
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
}

.header {
  background: #202225;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.header h1 {
  color: white;
  margin: 0 0 10px;
}

.header p {
  color: #aaa;
}

.message {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #40444b;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.content {
  flex: 1;
}

.time {
  color: #72767d;
  font-size: 12px;
  margin-left: 8px;
}

.body {
  margin-top: 5px;
  line-height: 1.5;
  word-break: break-word;
}

.attachments {
  margin-top: 8px;
}

.attachments a {
  color: #00aff4;
}
</style>
</head>

<body>

<div class="header">
  <h1>🎫 Ticket #${escapeHTML(
    ticket.id
  )}</h1>

  <p>
    Servidor: ${escapeHTML(
      guild?.name || "Servidor"
    )}
    <br>
    Tipo: ${escapeHTML(
      ticket.label
    )}
    <br>
    Utilizador: ${escapeHTML(
      ticket.username
    )}
  </p>
</div>

${content}

</body>
</html>`;
}
