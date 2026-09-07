// src/commands/status.js

import {
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

import { db } from "../utils/db.js";

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

function getMongoStatus() {
  // Compatível com a implementação atual do db.js
  return db._mongoConnected === true;
}

export async function execute(interaction, client) {
  try {
    const guild = interaction.guild;

    const ticketsAbertos = Object.values(db.tickets || {})
      .filter(ticket => ticket && !ticket.closed)
      .length;

    const regrasAceites = Array.isArray(db.acceptedRules)
      ? db.acceptedRules.length
      : 0;

    const mongoOnline = getMongoStatus();

    const embed = new EmbedBuilder()
      .setTitle("📊 Status — PAC Bot")
      .setDescription("Estado atual do bot e do servidor.")
      .addFields(
        {
          name: "🤖 Bot",
          value: "🟢 Online",
          inline: true,
        },
        {
          name: "⏱️ Uptime",
          value: formatUptime(Math.floor(process.uptime())),
          inline: true,
        },
        {
          name: "🖥️ Servidores",
          value: `${client.guilds.cache.size}`,
          inline: true,
        },
        {
          name: "👥 Membros",
          value: `${guild?.memberCount ?? "N/D"}`,
          inline: true,
        },
        {
          name: "🎫 Tickets abertos",
          value: `${ticketsAbertos}`,
          inline: true,
        },
        {
          name: "📜 Regras aceites",
          value: `${regrasAceites}`,
          inline: true,
        },
        {
          name: "🗄️ MongoDB",
          value: mongoOnline ? "🟢 Ligado" : "🔴 Desligado / Fallback",
          inline: true,
        },
        {
          name: "🏓 Ping",
          value: `${client.ws.ping}ms`,
          inline: true,
        },
      )
      .setColor(mongoOnline ? 0x57f287 : 0xfee75c)
      .setFooter({
        text: `Pedido por ${interaction.user.tag}`,
      })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });

  } catch (error) {
    console.error("[Status] Erro:", error);

    return interaction.editReply({
      content: "❌ Não foi possível obter o estado do bot.",
      embeds: [],
    });
  }
}
