// ============================================================
// utils/logger.js - Sistema de Logs para servidor externo
// ============================================================

import { EmbedBuilder, WebhookClient } from "discord.js";

// IDs fixos
const EXTERNAL_GUILD_ID = "1510401803974475947";
const EXTERNAL_CHANNEL_ID = "1510402537000276058"; // canal ou fórum

// Cache de webhooks por canal (para reutilizar)
const webhookCache = new Map();

/**
 * Obtém um webhook para o canal externo (cria se não existir)
 */
async function getExternalWebhook(client) {
    const cacheKey = EXTERNAL_CHANNEL_ID;
    if (webhookCache.has(cacheKey)) {
        return webhookCache.get(cacheKey);
    }

    try {
        const guild = await client.guilds.fetch(EXTERNAL_GUILD_ID);
        const channel = await guild.channels.fetch(EXTERNAL_CHANNEL_ID);

        // Se for um fórum, tentar criar webhook no fórum (não é suportado diretamente)
        // Em vez disso, vamos usar o cliente para enviar mensagens diretamente
        // ou criar webhook no canal pai se for thread.
        // Vamos optar por enviar mensagens diretamente no canal usando o client.
        // Guardamos o canal na cache para reutilizar.
        webhookCache.set(cacheKey, { type: 'channel', channel });
        return { type: 'channel', channel };
    } catch (e) {
        console.error("[Logger] Erro ao obter canal externo:", e.message);
        return null;
    }
}

/**
 * Cria uma thread (postagem) para um utilizador no canal de logs
 */
async function createUserThread(client, userId, userName, question) {
    try {
        const guild = await client.guilds.fetch(EXTERNAL_GUILD_ID);
        const channel = await guild.channels.fetch(EXTERNAL_CHANNEL_ID);

        // Verificar se o canal é um fórum (ChannelType.GuildForum)
        if (channel.type === 15) { // GuildForum
            const threadName = `🎫 ${userName} - ${new Date().toLocaleDateString('pt-PT')}`;
            const embed = new EmbedBuilder()
                .setTitle("📝 Nova Interação")
                .setDescription(`**Utilizador:** <@${userId}> | \`${userName}\`\n**Pergunta:** ${question}`)
                .setColor(0x0099ff)
                .setTimestamp();

            const thread = await channel.threads.create({
                name: threadName,
                message: { embeds: [embed] },
                autoArchiveDuration: 1440, // 24h
            });
            return thread;
        } else {
            // Canal de texto normal – enviar uma mensagem e criar thread (se permitido)
            const embed = new EmbedBuilder()
                .setTitle(`📝 Interação de ${userName}`)
                .setDescription(`**Utilizador:** <@${userId}> | \`${userName}\`\n**Pergunta:** ${question}`)
                .setColor(0x0099ff)
                .setTimestamp();

            const msg = await channel.send({ embeds: [embed] });
            // Criar thread a partir da mensagem
            const thread = await msg.startThread({
                name: `${userName} - ${new Date().toLocaleDateString('pt-PT')}`,
                autoArchiveDuration: 1440,
            });
            return thread;
        }
    } catch (e) {
        console.error("[Logger] Erro ao criar thread:", e.message);
        return null;
    }
}

/**
 * Envia uma mensagem de log para a thread do utilizador
 */
async function logToThread(client, threadId, content, embed = null) {
    try {
        const guild = await client.guilds.fetch(EXTERNAL_GUILD_ID);
        const thread = await guild.channels.fetch(threadId);
        if (!thread) return;

        if (embed) {
            await thread.send({ embeds: [embed] });
        } else {
            await thread.send(content);
        }
    } catch (e) {
        console.error("[Logger] Erro ao enviar para thread:", e.message);
    }
}

/**
 * Atualiza a mensagem inicial da thread com o feedback
 */
async function updateThreadWithFeedback(client, threadId, feedback, comment = "") {
    try {
        const guild = await client.guilds.fetch(EXTERNAL_GUILD_ID);
        const thread = await guild.channels.fetch(threadId);
        if (!thread) return;

        // Buscar a primeira mensagem da thread (a inicial)
        const messages = await thread.messages.fetch({ limit: 1 });
        const firstMsg = messages.first();
        if (!firstMsg) return;

        const embed = firstMsg.embeds[0];
        if (!embed) return;

        // Atualizar o embed com o feedback
        const newEmbed = EmbedBuilder.from(embed)
            .addFields({ name: "📊 Feedback", value: `${feedback} ${comment ? `\n✏️ ${comment}` : ''}`, inline: false });

        await firstMsg.edit({ embeds: [newEmbed] });
    } catch (e) {
        console.error("[Logger] Erro ao atualizar thread:", e.message);
    }
}

export default {
    createUserThread,
    logToThread,
    updateThreadWithFeedback,
    getExternalWebhook,
};
