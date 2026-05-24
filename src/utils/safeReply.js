// ==================== SAFE REPLY UTILITIES ====================
export async function safeDeferReply(interaction, options = { flags: 64 }) {
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply(options);
            return true;
        }
        return false;
    } catch (error) {
        if (error.code === 10062 || error.message?.includes("Unknown interaction")) {
            console.log("⚠️ Interação expirada (10062), ignorando...");
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
            return await interaction.followUp(options);
        }
        return null;
    } catch (error) {
        if (error.code === 10062 || error.message?.includes("Unknown interaction")) {
            console.log("⚠️ Interação expirada no editReply, ignorando...");
            return null;
        }
        console.error("Erro no editReply:", error);
        return null;
    }
}
