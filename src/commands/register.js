import {
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
} from "discord.js";
import { CONFIG } from "../config/index.js";

export async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("apagar")
      .setDescription("Apaga mensagens do bot em todos os canais ou em canais específicos")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((option) =>
        option.setName("canais").setDescription("IDs dos canais separados por vírgula (deixe vazio para todos)").setRequired(false),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("ajuda")
      .setDescription("Central de ajuda da Portugal Alfa Community")
      .setDefaultMemberPermissions(null)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("limpar")
      .setDescription("Limpa mensagens do canal e guarda transcript")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((option) =>
        option.setName("quantidade").setDescription("Número de mensagens a apagar (1-100)").setRequired(true).setMinValue(1).setMaxValue(100),
      )
      .addStringOption((option) =>
        option.setName("motivo").setDescription("Motivo da limpeza").setRequired(false),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("status")
      .setDescription("Mostra o status do bot e informações do servidor")
      .setDefaultMemberPermissions(null)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("painelstaff")
      .setDescription("Abre o painel de staff para o ticket atual")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("painelmembro")
      .setDescription("Abre o painel do membro para chamar staff específica")
      .setDefaultMemberPermissions(null)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("passar")
      .setDescription("Passa o controlo do ticket para outro membro da staff")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addUserOption((option) =>
        option.setName("staff").setDescription("Membro da staff para quem passar o ticket").setRequired(true),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("pedirassumo")
      .setDescription("Pedir assumo de um ticket que está com outro staff")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("transcript")
      .setDescription("Gera um transcript completo do canal atual (HTML + TXT) - Apenas Staff")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);

  try {
    console.log("A registar comandos de barra...");
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
      { body: commands },
    );
    console.log("Comandos registados no servidor principal!");
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID_RECRUTAMENTO),
      { body: commands },
    );
    console.log("Comandos registados no servidor de recrutamento!");
  } catch (error) {
    console.error("Erro ao registar comandos:", error);
  }
}
