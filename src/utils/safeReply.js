export async function safeDeferReply(interaction, options = { flags: 64 }) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply(options);
      return true;
    }
    return false;
  } catch (error) {
    if (error.code === 10062 || error.message?.includes("Unknown interaction")) {
      console.log("Interacao expirada (10062), ignorando...");
      return false;
    }
    console.error("Erro no deferReply:", error);
    return false;
  }
}

export async function safeEditReply(interaction, options) {
  try {
    if (interaction.deferred && !interaction.replied) {
      return await interaction.editReply(options);
    } else if (interaction.replied) {
      // Se ja foi replied, tenta editReply primeiro (pode ser um followUp que ainda permite edit)
      try {
        return await interaction.editReply(options);
      } catch {
        // Se editReply falhar, usa followUp
        return await interaction.followUp(options);
      }
    }
    // Se nao foi nem deferred nem replied, responde diretamente
    return await interaction.reply(options);
  } catch (error) {
    if (error.code === 10062 || error.message?.includes("Unknown interaction")) {
      console.log("Interacao expirada no editReply, ignorando...");
      return null;
    }
    // Se for "already replied", tenta followUp
    if (error.message?.includes("already been sent") || error.message?.includes("already replied")) {
      try {
        return await interaction.followUp(options);
      } catch (e) {
        console.error("Erro no followUp fallback:", e);
        return null;
      }
    }
    console.error("Erro no editReply:", error);
    return null;
  }
}
