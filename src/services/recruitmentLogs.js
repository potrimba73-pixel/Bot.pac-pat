import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

// ===== LOGGING FOR RECRUITMENT SERVER =====

export async function logMemberJoin(member, client) {
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
        if (!guild) return;

        const logChannel = await guild.channels.fetch(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle("📥 Novo Membro Entrou")
            .setDescription([
                `👤 **Utilizador:** <@${member.id}>`,
                `📝 **Nome:** ${member.user.username}`,
                `🆔 **ID:** ${member.id}`,
                `📅 **Conta criada:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                `⏰ **Entrou em:** ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`,
            ].join("\n"))
            .setColor(0x00ff00)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Erro ao logar entrada:", e);
    }
}

export async function logMemberLeave(member, client) {
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
        if (!guild) return;

        const logChannel = await guild.channels.fetch(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle("📤 Membro Saiu")
            .setDescription([
                `👤 **Utilizador:** ${member.user.username}`,
                `🆔 **ID:** ${member.id}`,
                `⏰ **Saiu em:** ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`,
            ].join("\n"))
            .setColor(0xff0000)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Erro ao logar saída:", e);
    }
}

export async function logMessageDelete(message, client) {
    try {
        if (message.author.bot) return;

        const guild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
        if (!guild) return;

        const logChannel = await guild.channels.fetch(CONFIG.CANAL_LOG_RECRUTAMENTO_MSG).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle("🗑️ Mensagem Apagada")
            .setDescription([
                `👤 **Autor:** <@${message.author.id}>`,
                `📝 **Conteúdo:** ${message.content || "(sem texto)"}`,
                `📍 **Canal:** <#${message.channel.id}>`,
                `⏰ **Apagada em:** ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`,
            ].join("\n"))
            .setColor(0xff9800)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Erro ao logar mensagem apagada:", e);
    }
}

export async function logMessageEdit(oldMessage, newMessage, client) {
    try {
        if (oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const guild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
        if (!guild) return;

        const logChannel = await guild.channels.fetch(CONFIG.CANAL_LOG_RECRUTAMENTO_MSG).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle("✏️ Mensagem Editada")
            .setDescription([
                `👤 **Autor:** <@${newMessage.author.id}>`,
                `📍 **Canal:** <#${newMessage.channel.id}>`,
                `⏰ **Editada em:** ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`,
                "",
                "**Antes:**",
                `\`\`\`${oldMessage.content || "(sem texto)"}\`\`\``,
                "",
                "**Depois:**",
                `\`\`\`${newMessage.content || "(sem texto)"}\`\`\``,
            ].join("\n"))
            .setColor(0x2196F3)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Erro ao logar mensagem editada:", e);
    }
}

export async function logServerEvent(eventType, details, client) {
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
        if (!guild) return;

        const logChannel = await guild.channels.fetch(CONFIG.CANAL_LOG_RECRUTAMENTO_MODS).catch(() => null);
        if (!logChannel) return;

        const colors = {
            channelCreate: 0x00ff00,
            channelDelete: 0xff0000,
            channelUpdate: 0xff9800,
            roleCreate: 0x00ff00,
            roleDelete: 0xff0000,
            roleUpdate: 0xff9800,
        };

        const embed = new EmbedBuilder()
            .setTitle(`🔧 ${eventType}`)
            .setDescription(details)
            .setColor(colors[eventType] || 0x808080)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Erro ao logar evento do servidor:", e);
    }
}

export async function logMemberUpdate(oldMember, newMember, client) {
    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID_RECRUTAMENTO).catch(() => null);
        if (!guild) return;

        const logChannel = await guild.channels.fetch(CONFIG.CANAL_LOG_RECRUTAMENTO_MEMBROS).catch(() => null);
        if (!logChannel) return;

        const changes = [];

        if (oldMember.nickname !== newMember.nickname) {
            changes.push(`📝 **Nickname:** ${oldMember.nickname || "Nenhum"} → ${newMember.nickname || "Nenhum"}`);
        }

        const oldRoles = oldMember.roles.cache.map(r => r.id);
        const newRoles = newMember.roles.cache.map(r => r.id);
        const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
        const removedRoles = oldRoles.filter(r => !newRoles.includes(r));

        if (addedRoles.length > 0) {
            const roleMentions = addedRoles.map(r => `<@&${r}>`).join(", ");
            changes.push(`🟢 **Cargos adicionados:** ${roleMentions}`);
        }
        if (removedRoles.length > 0) {
            const roleMentions = removedRoles.map(r => `<@&${r}>`).join(", ");
            changes.push(`🔴 **Cargos removidos:** ${roleMentions}`);
        }

        if (changes.length === 0) return;

        const embed = new EmbedBuilder()
            .setTitle("👤 Membro Atualizado")
            .setDescription([
                `👤 **Utilizador:** <@${newMember.id}>`,
                ...changes,
                `⏰ **Data:** ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`,
            ].join("\n"))
            .setColor(0x9C27B0)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error("Erro ao logar atualização de membro:", e);
    }
}
