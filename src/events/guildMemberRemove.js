import { CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { logMemberLeave } from "../services/recruitmentLogs.js";
import { logExternalMemberLeave } from "../services/externalLogs.js";

export async function handleGuildMemberRemove(member, client) {
    const userId = member.id;
    const guildId = member.guild.id;

    // Log externo
    await logExternalMemberLeave(member);

    // Log for recruitment server
    if (guildId === CONFIG.GUILD_ID_RECRUTAMENTO) {
        await logMemberLeave(member, client);
    }

    if (guildId !== CONFIG.GUILD_ID) return;

    console.log(`Membro saiu: ${member.user.tag} (${userId})`);

    if (db.acceptedRules.includes(userId)) {
        db.acceptedRules = db.acceptedRules.filter((id) => id !== userId);
        saveDB();
        console.log(`Registo de regras removido para ${member.user.tag}`);
    }

    const userTickets = Object.values(db.tickets).filter(
        (t) => t.userId === userId && !t.closed && (t.type !== "recrutamento" && t.type !== "ajuda"),
    );
    for (const ticket of userTickets) {
        ticket.closed = true;
        ticket.closedAt = new Date().toISOString();
        ticket.closedBy = client.user.id;
        ticket.closedByName = "Sistema (Membro Saiu)";

        try {
            const ticketChannel = await member.guild.channels
                .fetch(ticket.channelId)
                .catch(() => null);
            if (ticketChannel) {
                await ticketChannel.delete();
                console.log(`Ticket de ${member.user.tag} apagado`);
            }
        } catch (e) {
            console.log(`Não foi possível apagar ticket de ${member.user.tag}:`, e.message);
        }
    }

    if (userTickets.length > 0) {
        saveDB();
        console.log(`${userTickets.length} ticket(s) de ${member.user.tag} fechado(s)`);
    }
}
