import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { logMemberJoin } from "../services/recruitmentLogs.js";

export async function handleGuildMemberAdd(member, client) {
    const userId = member.id;
    const guildId = member.guild.id;

    // Log for recruitment server
    if (guildId === CONFIG.GUILD_ID_RECRUTAMENTO) {
        await logMemberJoin(member, client);
    }

    if (guildId !== CONFIG.GUILD_ID) return;

    console.log(`👋 Novo membro entrou: ${member.user.tag} (${userId})`);

    if (db.acceptedRules.includes(userId)) {
        db.acceptedRules = db.acceptedRules.filter((id) => id !== userId);
        saveDB();
        console.log(`🧹 Registo antigo limpo para ${member.user.tag}`);
    }

    console.log(`✅ ${member.user.tag} pode clicar em "Aceitar Regras"`);
}
