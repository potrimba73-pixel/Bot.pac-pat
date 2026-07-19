import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from "discord.js";
import { setExternalClient, setupExternalLogChannels } from "../services/externalLogs.js";
import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { registerCommands } from "../commands/register.js";

export async function handleReady(client) {
  console.log(`[Ready] 🤖 Bot online: ${client.user.tag}`);

  // Configura o estado do bot
  client.user.setPresence({
    activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
    status: 'online',
  });

  // Configura o servico de logs externo
  setExternalClient(client);

  // Registar comandos de barra
  try {
    await registerCommands();
    console.log("[Ready] ✅ Comandos slash registados");
  } catch (err) {
    console.error("[Ready] ❌ Erro ao registar comandos:", err.message);
  }

  // Auto-setup dos canais de log no servidor externo
  try {
    const externalGuild = await client.guilds.fetch(CONFIG.EXTERNAL_LOG_GUILD_ID).catch(() => null);
    if (externalGuild) {
      await setupExternalLogChannels(externalGuild);
      console.log("[Ready] ✅ Canais de log externos configurados");
    } else {
      console.warn("[Ready] ⚠️ Servidor externo de logs nao encontrado");
    }
  } catch (err) {
    console.error("[Ready] ❌ Erro no setup de canais externos:", err.message);
  }

  // ========== AUTO-SETUP PAINEL GERAL ==========
  try {
    const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!mainGuild) {
      console.warn("[Ready] ⚠️ Servidor principal nao encontrado!");
    } else {
      console.log("[Ready] ✅ Servidor principal:", mainGuild.name);

      // Painel de tickets geral
      const canalGeral = await client.channels.fetch(CONFIG.CANAL_TICKETS_GERAL).catch(() => null);
      if (canalGeral) {
        const painelExiste = db.messages?.painelGeral;
        if (painelExiste) {
          try {
            await canalGeral.messages.fetch(painelExiste);
            console.log("[Ready] ℹ️ Painel geral ja existe");
          } catch {
            await enviarPainelGeral(canalGeral);
          }
        } else {
          await enviarPainelGeral(canalGeral);
        }
      }

      // Painel de regras
      const canalRegras = await client.channels.fetch(CONFIG.CANAL_REGRAS).catch(() => null);
      if (canalRegras) {
        const regrasExiste = db.messages?.painelRegras;
        if (regrasExiste) {
          try {
            await canalRegras.messages.fetch(regrasExiste);
            console.log("[Ready] ℹ️ Painel de regras ja existe");
          } catch {
            await enviarPainelRegras(canalRegras);
          }
        } else {
          await enviarPainelRegras(canalRegras);
        }
      }
    }
  } catch (err) {
    console.error("[Ready] ❌ Erro no auto-setup do servidor principal:", err.message);
  }

  // ========== AUTO-SETUP PAINEL RECRUTAMENTO ==========
  try {
    if (!CONFIG.GUILD_ID_RECRUTAMENTO || CONFIG.GUILD_ID_RECRUTAMENTO === "undefined" || CONFIG.GUILD_ID_RECRUTAMENTO === "") {
      console.log("[Ready] ℹ️ GUILD_ID_RECRUTAMENTO nao definido, a ignorar servidor de recrutamento");
      return;
    }

    const recGuild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
    if (!recGuild) {
      console.warn("[Ready] ⚠️ Servidor de recrutamento nao encontrado. ID:", CONFIG.GUILD_ID_RECRUTAMENTO);
      return;
    }

    console.log("[Ready] ✅ Servidor de recrutamento:", recGuild.name);

    // Painel de tickets recrutamento
    const canalRec = await client.channels.fetch(CONFIG.CANAL_TICKETS_RECRUTAMENTO).catch(() => null);
    if (canalRec) {
      const painelRecExiste = db.messages?.painelRecrutamento;
      if (painelRecExiste) {
        try {
          await canalRec.messages.fetch(painelRecExiste);
          console.log("[Ready] ℹ️ Painel de recrutamento ja existe");
        } catch {
          await enviarPainelRecrutamento(canalRec);
        }
      } else {
        await enviarPainelRecrutamento(canalRec);
      }
    }

    // Painel de regras recrutamento
    const canalRegrasRec = await client.channels.fetch(CONFIG.CANAL_REGRAS_RECRUTAMENTO).catch(() => null);
    if (canalRegrasRec) {
      const regrasRecExiste = db.messages?.painelRegrasRecrutamento;
      if (regrasRecExiste) {
        try {
          await canalRegrasRec.messages.fetch(regrasRecExiste);
          console.log("[Ready] ℹ️ Painel de regras recrutamento ja existe");
        } catch {
          await enviarPainelRegrasRecrutamento(canalRegrasRec);
        }
      } else {
        await enviarPainelRegrasRecrutamento(canalRegrasRec);
      }
    }
  } catch (err) {
    console.error("[Ready] ❌ Erro no auto-setup do servidor de recrutamento:", err.message);
  }
}

// ========== FUNCOES AUXILIARES ==========

async function enviarPainelGeral(canal) {
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_TICKET} Sistema de Tickets | Portugal Alfa Community`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Bem-vindo ao sistema de tickets!`,
      "",
      "Seleciona o tipo de ticket que pretendes abrir:",
      "",
      `${CONFIG.EMOJI_BUGS} **Bugs** - Reportar bugs`,
      `${CONFIG.EMOJI_DENUNCIA} **Denuncia** - Denunciar comportamento`,
      `${CONFIG.EMOJI_SUPORTE} **Suporte** - Ajuda geral`,
      `${CONFIG.EMOJI_CRIADOR} **Criador** - Criador de conteudo`,
    ].join("\n"))
    .setImage(CONFIG.IMAGEM_GERAL)
    .setColor(0x262af1)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_geral")
      .setPlaceholder("Seleciona o tipo de ticket...")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("Bugs").setValue("bugs").setDescription("Reportar bugs").setEmoji(CONFIG.EMOJI_BUGS),
        new StringSelectMenuOptionBuilder().setLabel("Denuncia").setValue("denuncia").setDescription("Denunciar comportamento").setEmoji(CONFIG.EMOJI_DENUNCIA),
        new StringSelectMenuOptionBuilder().setLabel("Suporte").setValue("suporte").setDescription("Ajuda geral").setEmoji(CONFIG.EMOJI_SUPORTE),
        new StringSelectMenuOptionBuilder().setLabel("Criador de Conteudo").setValue("criador").setDescription("Criador de conteudo").setEmoji(CONFIG.EMOJI_CRIADOR),
      )
  );

  const msg = await canal.send({ embeds: [embed], components: [row] });
  if (!db.messages) db.messages = {};
  db.messages.painelGeral = msg.id;
  await saveDB();
  console.log("[Ready] ✅ Painel geral enviado");
}

async function enviarPainelRegras(canal) {
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_INFO} Regras | Portugal Alfa Community`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Le atentamente as regras antes de aceitares.`,
      "",
      "Clica no botao abaixo para aceitar as regras e obteres acesso a Comunidade.",
    ].join("\n"))
    .setImage(CONFIG.IMAGEM_REGRAS)
    .setColor(0x262af1)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("aceitar_regras")
      .setLabel("Aceitar Regras")
      .setStyle(ButtonStyle.Success)
      .setEmoji(CONFIG.EMOJI_CHECK),
  );

  const msg = await canal.send({ embeds: [embed], components: [row] });
  if (!db.messages) db.messages = {};
  db.messages.painelRegras = msg.id;
  await saveDB();
  console.log("[Ready] ✅ Painel de regras enviado");
}

async function enviarPainelRecrutamento(canal) {
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_RECRUTAMENTO} Sistema de Tickets | Portugal Alfa Truckers`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Bem-vindo ao sistema de recrutamento!`,
      "",
      "Seleciona o tipo de ticket:",
      "",
      `${CONFIG.EMOJI_RECRUTAMENTO} **Recrutamento PAT** - Candidatar-se a PAT`,
      `${CONFIG.EMOJI_AJUDA} **Pedir ajuda** - Ajuda geral`,
    ].join("\n"))
    .setImage(CONFIG.IMAGEM_RECRUTAMENTO)
    .setColor(0x262af1)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_recrutamento")
      .setPlaceholder("Seleciona o tipo de ticket...")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("Recrutamento PAT").setValue("recrutamento").setDescription("Candidatar-se a PAT").setEmoji(CONFIG.EMOJI_RECRUTAMENTO),
        new StringSelectMenuOptionBuilder().setLabel("Pedir ajuda").setValue("ajuda").setDescription("Ajuda geral").setEmoji(CONFIG.EMOJI_AJUDA),
      )
  );

  const msg = await canal.send({ embeds: [embed], components: [row] });
  if (!db.messages) db.messages = {};
  db.messages.painelRecrutamento = msg.id;
  await saveDB();
  console.log("[Ready] ✅ Painel de recrutamento enviado");
}

async function enviarPainelRegrasRecrutamento(canal) {
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_INFO} Regras | Portugal Alfa Truckers`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Le atentamente as regras antes de aceitares.`,
      "",
      "Clica no botao abaixo para aceitar as regras e obteres acesso ao servidor de recrutamento.",
    ].join("\n"))
    .setImage(CONFIG.IMAGEM_REGRAS)
    .setColor(0x262af1)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("aceitar_regras")
      .setLabel("Aceitar Regras")
      .setStyle(ButtonStyle.Success)
      .setEmoji(CONFIG.EMOJI_CHECK),
  );

  const msg = await canal.send({ embeds: [embed], components: [row] });
  if (!db.messages) db.messages = {};
  db.messages.painelRegrasRecrutamento = msg.id;
  await saveDB();
  console.log("[Ready] ✅ Painel de regras recrutamento enviado");
}
