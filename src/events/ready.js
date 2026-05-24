import { CONFIG, ASSISTANT_CONFIG } from "../config/index.js";
import { db, saveDB } from "../utils/db.js";
import { sendPainelGeral, sendPainelRecrutamento, sendPainelRegras } from "../services/panels.js";
import { MessageAnalyzer } from "../assistant/analyzer.js";
import { assistantMemory } from "../services/ajuda.js";

export async function handleReady(client) {
    console.log(`✅ Bot online como ${client.user.tag}`);

    const { registerCommands } = await import("../commands/register.js");
    await registerCommands();

    // Carregar histórico do Diego
    const mainGuild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (mainGuild) {
        console.log("📚 A carregar histórico do Diego...");
        const analyzer = new MessageAnalyzer(client);
        await analyzer.fetchExpertHistory(mainGuild, ASSISTANT_CONFIG.EXPERT_USER_ID, 200);
        console.log(`✅ ${assistantMemory.diegoHistory.length} mensagens do Diego carregadas.`);
    }

    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
        const guildRecrutamento = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);

        if (guild) {
            const canalTicketsGeral = await guild.channels.fetch(CONFIG.CANAL_TICKETS_GERAL).catch(() => null);
            if (canalTicketsGeral) {
                const existingBotMsg = await botHasMessageInChannel(canalTicketsGeral, client);
                if (existingBotMsg) {
                    console.log("ℹ️ Painel Geral já existe no canal, não reenviado.");
                    db.messages.painelGeral = existingBotMsg.id;
                    saveDB();
                } else {
                    const msg = await sendPainelGeral(canalTicketsGeral);
                    db.messages.painelGeral = msg.id;
                    saveDB();
                    console.log("✅ Painel Geral enviado!");
                }
            }
        }

        if (guild) {
            const canalTicketsRecrutamento = await guild.channels.fetch(CONFIG.CANAL_TICKETS_RECRUTAMENTO).catch(() => null);
            if (canalTicketsRecrutamento) {
                const existingBotMsg = await botHasMessageInChannel(canalTicketsRecrutamento, client);
                if (existingBotMsg) {
                    console.log("ℹ️ Painel Recrutamento já existe no canal, não reenviado.");
                    db.messages.painelRecrutamento = existingBotMsg.id;
                    saveDB();
                } else {
                    const msg = await sendPainelRecrutamento(canalTicketsRecrutamento);
                    db.messages.painelRecrutamento = msg.id;
                    saveDB();
                    console.log("✅ Painel Recrutamento enviado!");
                }
            }
        }

        if (guild) {
            const canalRegras = await guild.channels.fetch(CONFIG.CANAL_REGRAS).catch(() => null);
            if (canalRegras) {
                const existingBotMsg = await botHasMessageInChannel(canalRegras, client);
                if (existingBotMsg) {
                    console.log("ℹ️ Painel Regras já existe no canal, não reenviado.");
                    db.messages.painelRegras = existingBotMsg.id;
                    saveDB();
                } else {
                    const msg = await sendPainelRegras(canalRegras);
                    db.messages.painelRegras = msg.id;
                    saveDB();
                    console.log("✅ Painel Regras enviado!");
                }
            }
        }

        if (guildRecrutamento && CONFIG.CANAL_REGRAS_RECRUTAMENTO !== CONFIG.CANAL_REGRAS) {
            const canalRegrasRec = await guildRecrutamento.channels.fetch(CONFIG.CANAL_REGRAS_RECRUTAMENTO).catch(() => null);
            if (canalRegrasRec) {
                const existingBotMsg = await botHasMessageInChannel(canalRegrasRec, client);
                if (existingBotMsg) {
                    console.log("ℹ️ Painel Regras Recrutamento já existe no canal, não reenviado.");
                    db.messages.painelRegrasRecrutamento = existingBotMsg.id;
                    saveDB();
                } else {
                    const msg = await sendPainelRegras(canalRegrasRec);
                    db.messages.painelRegrasRecrutamento = msg.id;
                    saveDB();
                    console.log("✅ Painel Regras Recrutamento enviado!");
                }
            }
        }

    } catch (error) {
        console.error("❌ Erro ao enviar painéis:", error);
    }
}

async function botHasMessageInChannel(channel, client) {
    try {
        const messages = await channel.messages.fetch({ limit: 50 });
        const botMessage = messages.find(msg => msg.author.id === client.user.id);
        return botMessage || null;
    } catch (e) {
        return null;
    }
}
