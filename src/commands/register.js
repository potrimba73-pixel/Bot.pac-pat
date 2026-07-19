import {
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
} from "discord.js";
import { CONFIG } from "../config/index.js";

export async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("apagar")
      .setDescription("Apaga mensagens do bot em todos os canais ou em canais especificos")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((option) =>
        option.setName("canais").setDescription("IDs dos canais separados por virgula (deixe vazio para todos)").setRequired(false),
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
        option.setName("quantidade").setDescription("Numero de mensagens a apagar (1-100)").setRequired(true).setMinValue(1).setMaxValue(100),
      )
      .addStringOption((option) =>
        option.setName("motivo").setDescription("Motivo da limpeza").setRequired(false),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("status")
      .setDescription("Mostra o status do bot e informacoes do servidor")
      .setDefaultMemberPermissions(null)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("painelstaff")
      .setDescription("Abre o painel de staff para o ticket atual")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("painelmembro")
      .setDescription("Abre o painel do membro para chamar staff especifica")
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
      .setDescription("Pedir assumo de um ticket que esta com outro staff")
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
    console.log("[Register] A registar comandos de barra...");

    // Servidor principal (sempre)
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
      { body: commands },
    );
    console.log("[Register] ✅ Comandos registados no servidor principal!");

    // Servidor de recrutamento (so se GUILD_ID_RECRUTAMENTO estiver definido e diferente do principal)
    if (CONFIG.GUILD_ID_RECRUTAMENTO && CONFIG.GUILD_ID_RECRUTAMENTO !== "undefined" && CONFIG.GUILD_ID_RECRUTAMENTO !== "" && CONFIG.GUILD_ID_RECRUTAMENTO !== CONFIG.GUILD_ID) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID_RECRUTAMENTO),
          { body: commands },
        );
        console.log("[Register] ✅ Comandos registados no servidor de recrutamento!");
      } catch (recError) {
        console.warn("[Register] ⚠️ Nao foi possivel registar comandos no servidor de recrutamento:", recError.message);
      }
    } else {
      console.log("[Register] ℹ️ Servidor de recrutamento ignorado (nao configurado)");
    }
  } catch (error) {
    console.error("[Register] ❌ Erro ao registar comandos:", error);
  }
}
