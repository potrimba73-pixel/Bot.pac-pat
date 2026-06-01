import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { logExternalMemberLeave } from "../services/externalLogs.js";

export async function handleGuildMemberRemove(member, client) {
    const userId = member.id;
    const guildId = member.guild.id;

    // Log externo
    await logExternalMemberLeave(member);

    if (guildId !== CONFIG.GUILD_ID) return;

    console.log(`Membro saiu: ${member.user.tag} (${userId})`);

    // Limpar regras aceites se saiu
    if (db.acceptedRules.includes(userId)) {
        db.acceptedRules = db.acceptedRules.filter((id) => id !== userId);
        saveDB();
        console.log(`Registo limpo para ${member.user.tag}`);
    }
}
