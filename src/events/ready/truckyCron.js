import { EmbedBuilder } from "discord.js";
import TruckyAPI from "../../utils/truckyAPI.js";
import { TRUCKY_CONFIG } from "../../config/trucky.js";

export async function startTruckyCron(client) {
    console.log("[TruckyCron] Sistema de verificacao automatica iniciado");

    setInterval(async () => {
        await checkScheduledVerification(client);
    }, 60 * 60 * 1000);
}

async function checkScheduledVerification(client) {
    if (!TRUCKY_CONFIG.inatividade.verificacaoAuto) return;

    const now = new Date();
    const diaAtual = now.getDay();
    const horaAtual = now.getHours();
    const minutoAtual = now.getMinutes();

    const [horaConfig, minutoConfig] = TRUCKY_CONFIG.inatividade.horaVerificacao.split(":").map(Number);

    if (diaAtual !== TRUCKY_CONFIG.inatividade.diaVerificacao) return;
    if (horaAtual !== horaConfig) return;
    if (minutoAtual < minutoConfig || minutoAtual >= minutoConfig + 5) return;

    console.log("[TruckyCron] Iniciando verificacao automatica de inatividade...");

    try {
        const jornalChannel = await client.channels.fetch(TRUCKY_CONFIG.channels.jornalPat);
        const logsChannel = await client.channels.fetch(TRUCKY_CONFIG.channels.logs);

        const results = await TruckyAPI.checkAllMembersActivity(TRUCKY_CONFIG.inatividade.diasLimite);

        const protegidos = [];
        const inativos = [];

        for (const member of results.inactive) {
            if (!member.discordId) { inativos.push(member); continue; }
            try {
                const guild = await client.guilds.fetch(client.guilds.cache.first().id);
                const discordMember = await guild.members.fetch(member.discordId);
                const isStaff = discordMember.roles.cache.some(role => TRUCKY_CONFIG.staffRoles.includes(role.id));
                if (isStaff) { protegidos.push(member); } else { inativos.push(member); }
            } catch { inativos.push(member); }
        }

        const logEmbed = new EmbedBuilder()
            .setTitle("📝 Verificacao Automatica de Inatividade")
            .setDescription("Verificacao agendada executada")
            .setColor(TRUCKY_CONFIG.cores.info)
            .setTimestamp()
            .addFields(
                { name: "✅ Ativos", value: `${results.active.length}`, inline: true },
                { name: "⚠️ Em Aviso", value: `${results.warning.length}`, inline: true },
                { name: "❌ Inativos", value: `${inativos.length}`, inline: true },
                { name: "🛡️ Protegidos", value: `${protegidos.length}`, inline: true }
            );

        await logsChannel.send({ embeds: [logEmbed] });

        if (inativos.length === 0 && results.warning.length === 0) {
            console.log("[TruckyCron] Nenhum membro inativo encontrado.");
            return;
        }

        const avisoEmbed = new EmbedBuilder()
            .setTitle("🚨 Aviso de Inatividade - Portugal Alfa Truckers")
            .setDescription(
                `Caros membros da **Portugal Alfa Truckers**,\n\n` +
                `Foi realizada a nossa verificacao **semanal/mensal** de atividade. ` +
                `Os seguintes membros estao com inatividade registada e serao ` +
                `sujeitos a limpeza da empresa se nao apresentarem cargas concluidas.\n\n` +
                `**Prazo: ${TRUCKY_CONFIG.inatividade.diasLimpeza} dias a partir desta data.**`
            )
            .setColor(TRUCKY_CONFIG.cores.perigo)
            .setTimestamp()
            .setFooter({ text: "Portugal Alfa Truckers - Sistema Automatico" });

        if (inativos.length > 0) {
            let inactiveText = "";
            for (const member of inativos) {
                const mention = member.discordId ? `<@${member.discordId}>` : `@${member.name}`;
                const status = member.daysSinceLastJob === Infinity ? "Nunca fez carga" : `${member.daysSinceLastJob} dias sem carga`;
                inactiveText += `• ${mention} - ${status}\n`;
            }
            avisoEmbed.addFields({ name: `❌ Membros Inativos (${inativos.length})`, value: inactiveText.substring(0, 1024), inline: false });
        }

        if (results.warning.length > 0) {
            let warningText = "";
            for (const member of results.warning) {
                const mention = member.discordId ? `<@${member.discordId}>` : `@${member.name}`;
                warningText += `• ${mention} - ${member.daysSinceLastJob} dias sem carga\n`;
            }
            avisoEmbed.addFields({ name: `⚠️ Membros em Aviso (${results.warning.length})`, value: warningText.substring(0, 1024), inline: false });
        }

        avisoEmbed.addFields({
            name: "📋 Como evitar a remocao",
            value: `1. Faca pelo menos uma carga no Euro Truck Simulator 2 / American Truck Simulator\n2. Use o Trucky Tracker para registar automaticamente\n3. Verifique o seu status com /minhas-cargas\n4. Contacte a administracao se tiver problemas tecnicos`,
            inline: false
        });

        await jornalChannel.send({
            content: `<@&${TRUCKY_CONFIG.roles.recrutamento[0]}> Aviso de inatividade automatico!`,
            embeds: [avisoEmbed]
        });

        console.log(`[TruckyCron] Aviso publicado! ${inativos.length} inativos, ${results.warning.length} em aviso.`);

    } catch (error) {
        console.error("[TruckyCron] Erro na verificacao automatica:", error);
    }
}
