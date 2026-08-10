// ============================================================
// events/ready/truckyCron.js - Cron do Trucky
// ============================================================

import { EmbedBuilder } from "discord.js";
// ✅ CORREÇÃO: Importar a instância padrão
import truckyAPI from "../../utils/truckyAPI.js";
import { TRUCKY_CONFIG } from "../../config/trucky.js";

// ✅ Renomear para usar a instância
const TruckyAPI = truckyAPI;

export async function startTruckyCron(client) {
    console.log("[TruckyCron] 🚛 Sistema de verificação automática iniciado");

    // ✅ Verificar se a configuração está ativa
    if (!TRUCKY_CONFIG.inatividade.verificacaoAuto) {
        console.log("[TruckyCron] ℹ️ Verificação automática desativada na configuração.");
        return;
    }

    // ✅ Verificar credenciais
    if (!TRUCKY_CONFIG.accessToken) {
        console.warn("[TruckyCron] ⚠️ TRUCKY_ACCESS_TOKEN não configurado. Cron não funcionará.");
        return;
    }

    // ✅ Executar imediatamente ao iniciar (para testar)
    setTimeout(async () => {
        await checkScheduledVerification(client);
    }, 10000);

    // ✅ Verificar a cada hora
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

    // ✅ Verificar se é o dia e hora configurados
    if (diaAtual !== TRUCKY_CONFIG.inatividade.diaVerificacao) return;
    if (horaAtual !== horaConfig) return;
    if (minutoAtual < minutoConfig || minutoAtual >= minutoConfig + 5) return;

    console.log("[TruckyCron] 🔍 Iniciando verificação automática de inatividade...");

    try {
        const guild = client.guilds.cache.first();
        if (!guild) {
            console.error("[TruckyCron] ❌ Nenhum servidor encontrado.");
            return;
        }

        const jornalChannel = await client.channels.fetch(TRUCKY_CONFIG.channels.jornalPat).catch(() => null);
        const logsChannel = await client.channels.fetch(TRUCKY_CONFIG.channels.logs).catch(() => null);

        if (!logsChannel) {
            console.error("[TruckyCron] ❌ Canal de logs não encontrado.");
            return;
        }

        // ✅ Usar a instância importada
        const results = await TruckyAPI.checkAllMembersActivity(TRUCKY_CONFIG.inatividade.diasLimite);

        const protegidos = [];
        const inativos = [];

        for (const member of results.inactive) {
            if (!member.discordId) { 
                inativos.push(member); 
                continue; 
            }
            try {
                const discordMember = await guild.members.fetch(member.discordId).catch(() => null);
                if (discordMember) {
                    const isStaff = discordMember.roles.cache.some(role => 
                        TRUCKY_CONFIG.staffRoles.includes(role.id)
                    );
                    if (isStaff) { 
                        protegidos.push(member); 
                    } else { 
                        inativos.push(member); 
                    }
                } else {
                    inativos.push(member);
                }
            } catch {
                inativos.push(member);
            }
        }

        // ✅ Log da verificação
        const logEmbed = new EmbedBuilder()
            .setTitle("📝 Verificação Automática de Inatividade")
            .setDescription("Verificação agendada executada")
            .setColor(TRUCKY_CONFIG.cores?.info || 0x262af1)
            .setTimestamp()
            .addFields(
                { name: "✅ Ativos", value: `${results.active.length}`, inline: true },
                { name: "⚠️ Em Aviso", value: `${results.warning.length}`, inline: true },
                { name: "❌ Inativos", value: `${inativos.length}`, inline: true },
                { name: "🛡️ Protegidos", value: `${protegidos.length}`, inline: true }
            );

        await logsChannel.send({ embeds: [logEmbed] });

        if (inativos.length === 0 && results.warning.length === 0) {
            console.log("[TruckyCron] ℹ️ Nenhum membro inativo encontrado.");
            return;
        }

        // ✅ Aviso no canal #jornal-pat
        if (jornalChannel && (inativos.length > 0 || results.warning.length > 0)) {
            const avisoEmbed = new EmbedBuilder()
                .setTitle("🚨 Aviso de Inatividade - Portugal Alfa Truckers")
                .setDescription(
                    `Caros membros da **Portugal Alfa Truckers**,\n\n` +
                    `Foi realizada a nossa verificação **semanal/mensal** de atividade. ` +
                    `Os seguintes membros estão com inatividade registada e serão ` +
                    `sujeitos a limpeza da empresa se não apresentarem cargas concluídas.\n\n` +
                    `**Prazo: ${TRUCKY_CONFIG.inatividade.diasLimpeza} dias a partir desta data.**`
                )
                .setColor(TRUCKY_CONFIG.cores?.perigo || 0xff0000)
                .setTimestamp()
                .setFooter({ text: "Portugal Alfa Truckers - Sistema Automático" });

            if (inativos.length > 0) {
                let inactiveText = "";
                for (const member of inativos) {
                    const mention = member.discordId ? `<@${member.discordId}>` : `@${member.name}`;
                    const status = member.daysSinceLastJob === Infinity ? "Nunca fez carga" : `${member.daysSinceLastJob} dias sem carga`;
                    inactiveText += `• ${mention} - ${status}\n`;
                }
                avisoEmbed.addFields({ 
                    name: `❌ Membros Inativos (${inativos.length})`, 
                    value: inactiveText.substring(0, 1024), 
                    inline: false 
                });
            }

            if (results.warning.length > 0) {
                let warningText = "";
                for (const member of results.warning) {
                    const mention = member.discordId ? `<@${member.discordId}>` : `@${member.name}`;
                    warningText += `• ${mention} - ${member.daysSinceLastJob} dias sem carga\n`;
                }
                avisoEmbed.addFields({ 
                    name: `⚠️ Membros em Aviso (${results.warning.length})`, 
                    value: warningText.substring(0, 1024), 
                    inline: false 
                });
            }

            const roles = TRUCKY_CONFIG.roles?.recrutamento || [];
            const mentionText = roles.length > 0 ? roles.map(r => `<@&${r}>`).join(" ") : "";

            await jornalChannel.send({
                content: mentionText || "🔔 Aviso de inatividade!",
                embeds: [avisoEmbed]
            });

            console.log(`[TruckyCron] 📢 Aviso publicado! ${inativos.length} inativos, ${results.warning.length} em aviso.`);
        }

    } catch (error) {
        console.error("[TruckyCron] ❌ Erro na verificação automática:", error.message);
        console.error("[TruckyCron] Stack:", error.stack);
    }
}
