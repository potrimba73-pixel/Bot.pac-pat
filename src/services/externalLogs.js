import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";

let externalClient = null;

export function setExternalClient(client) {
    externalClient = client;
}

function getLogChannel(channelId) {
    if (!externalClient || !channelId) return null;
    return externalClient.channels.fetch(channelId).catch(() => null);
}

// ========== SEARCH LOG ==========
export async function logExternalSearch(user, query, results) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOGS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("🔍 Pesquisa Realizada")
            .setDescription(`${user.tag} fez uma pesquisa.`)
            .addFields(
                { name: "Query", value: query.substring(0, 1024), inline: false },
                { name: "Resultados", value: results ? String(results) : "Nenhum", inline: true }
            )
            .setColor(0x0099ff)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar pesquisa:", err.message);
    }
}

// ========== MEMBER EVENTS ==========
export async function logExternalMemberJoin(member) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("👤 Novo Membro")
            .setDescription(`${member.user.tag} entrou no servidor.`)
            .addFields(
                { name: "ID", value: member.id, inline: true },
                { name: "Servidor", value: member.guild.name, inline: true },
                { name: "Conta criada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false }
            )
            .setColor(0x00ff00)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar entrada:", err.message);
    }
}

export async function logExternalMemberLeave(member) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("👋 Membro Saiu")
            .setDescription(`${member.user.tag} saiu do servidor.`)
            .addFields(
                { name: "ID", value: member.id, inline: true },
                { name: "Servidor", value: member.guild.name, inline: true }
            )
            .setColor(0xff0000)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar saída:", err.message);
    }
}

export async function logExternalMemberUpdate(oldMember, newMember) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const changes = [];
        if (oldMember.nickname !== newMember.nickname) {
            changes.push(`Nickname: ${oldMember.nickname || "Nenhum"} → ${newMember.nickname || "Nenhum"}`);
        }
        const oldRoles = oldMember.roles.cache.map(r => r.name);
        const newRoles = newMember.roles.cache.map(r => r.name);
        const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
        const removedRoles = oldRoles.filter(r => !newRoles.includes(r));
        if (addedRoles.length > 0) changes.push(`Cargos adicionados: ${addedRoles.join(", ")}`);
        if (removedRoles.length > 0) changes.push(`Cargos removidos: ${removedRoles.join(", ")}`);
        if (changes.length === 0) return;
        const embed = new EmbedBuilder()
            .setTitle("📝 Membro Atualizado")
            .setDescription(`${newMember.user.tag} foi atualizado.`)
            .addFields({ name: "Alterações", value: changes.join("\n"), inline: false })
            .setColor(0xffff00)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar update:", err.message);
    }
}

export async function logExternalMemberBan(ban) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("🔨 Membro Banido")
            .setDescription(`${ban.user.tag} foi banido.`)
            .addFields(
                { name: "ID", value: ban.user.id, inline: true },
                { name: "Servidor", value: ban.guild.name, inline: true }
            )
            .setColor(0xff0000)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar ban:", err.message);
    }
}

export async function logExternalMemberUnban(user) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("🔓 Membro Desbanido")
            .setDescription(`${user.tag} foi desbanido.`)
            .addFields({ name: "ID", value: user.id, inline: true })
            .setColor(0x00ff00)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar unban:", err.message);
    }
}

// ========== VOICE EVENTS ==========
export async function logExternalVoiceJoin(member, channel) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("🔊 Entrou em Canal de Voz")
            .setDescription(`${member.user.tag} entrou em ${channel.name}.`)
            .setColor(0x00ff00)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar voice join:", err.message);
    }
}

export async function logExternalVoiceLeave(member, channel) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("🔊 Saiu de Canal de Voz")
            .setDescription(`${member.user.tag} saiu de ${channel.name}.`)
            .setColor(0xff6600)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar voice leave:", err.message);
    }
}

// ========== CHANNEL EVENTS ==========
export async function logExternalChannelCreate(channel) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("📁 Canal Criado")
            .setDescription(`#${channel.name} foi criado.`)
            .addFields(
                { name: "Tipo", value: channel.type.toString(), inline: true },
                { name: "ID", value: channel.id, inline: true }
            )
            .setColor(0x00ff00)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar channel create:", err.message);
    }
}

export async function logExternalChannelDelete(channel) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("🗑️ Canal Apagado")
            .setDescription(`#${channel.name} foi apagado.`)
            .addFields(
                { name: "Tipo", value: channel.type.toString(), inline: true },
                { name: "ID", value: channel.id, inline: true }
            )
            .setColor(0xff0000)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar channel delete:", err.message);
    }
}

// ========== ROLE EVENTS ==========
export async function logExternalRoleCreate(role) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("🏷️ Cargo Criado")
            .setDescription(`@${role.name} foi criado.`)
            .addFields(
                { name: "Cor", value: role.hexColor, inline: true },
                { name: "ID", value: role.id, inline: true }
            )
            .setColor(0x00ff00)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar role create:", err.message);
    }
}

export async function logExternalRoleDelete(role) {
    try {
        const logChannel = await getLogChannel(CONFIG.CANAL_LOG_RECRUTAMENTO_ENTRADAS);
        if (!logChannel) return;
        const embed = new EmbedBuilder()
            .setTitle("🗑️ Cargo Apagado")
            .setDescription(`@${role.name} foi apagado.`)
            .addFields({ name: "ID", value: role.id, inline: true })
            .setColor(0xff0000)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[ExternalLogs] Erro ao logar role delete:", err.message);
    }
}
