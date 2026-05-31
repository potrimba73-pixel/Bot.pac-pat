import { EmbedBuilder } from "discord.js";

const EXTERNAL_GUILD_ID = "1510401803974475947";
const EXTERNAL_CHANNELS = {
    default: "1510402475444928594",
    member: "1510402595087450314",
    server: "1510402475444928594",
    voice: "1510402716008972520",
    message: "1510402518629482587",
    joinleave: "1510402500950360210",
};

let externalClient = null;

export function setExternalClient(client) {
    externalClient = client;
}

async function sendExternalLog(channelId, embed) {
    if (!externalClient) return;
    try {
        const guild = await externalClient.guilds.fetch(EXTERNAL_GUILD_ID).catch(() => null);
        if (!guild) return;
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) return;
        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error("[ExternalLog] Erro:", e.message);
    }
}

export async function logExternalMemberJoin(member) {
    const embed = new EmbedBuilder()
        .setTitle("Novo Membro")
        .setDescription([`Nome: ${member.user.username}`, `ID: ${member.user.id}`, `Conta criada: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`].join("\n"))
        .setColor(0x00ff00).setThumbnail(member.user.displayAvatarURL()).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.joinleave, embed);
}

export async function logExternalMemberLeave(member) {
    const embed = new EmbedBuilder()
        .setTitle("Membro Saiu")
        .setDescription([`Nome: ${member.user.username}`, `ID: ${member.user.id}`].join("\n"))
        .setColor(0xff0000).setThumbnail(member.user.displayAvatarURL()).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.joinleave, embed);
}

export async function logExternalMessageDelete(message) {
    if (message.author?.bot) return;
    const embed = new EmbedBuilder()
        .setTitle("Mensagem Apagada")
        .setDescription([`Autor: ${message.author?.username || "Desconhecido"}`, `Conteudo: ${message.content || "(sem texto)"}`, `Canal: ${message.channel?.name || "DM"}`].join("\n"))
        .setColor(0xff9800).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.message, embed);
}

export async function logExternalMessageEdit(oldMessage, newMessage) {
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const embed = new EmbedBuilder()
        .setTitle("Mensagem Editada")
        .setDescription([`Autor: ${newMessage.author?.username}`, `Canal: ${newMessage.channel?.name}`, `Antes: ${oldMessage.content || "(sem texto)"}`, `Depois: ${newMessage.content || "(sem texto)"}`].join("\n"))
        .setColor(0x2196F3).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.message, embed);
}

export async function logExternalChannelCreate(channel) {
    const embed = new EmbedBuilder().setTitle("Canal Criado").setDescription(`Nome: ${channel.name}\nTipo: ${channel.type}`).setColor(0x00ff00).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.server, embed);
}

export async function logExternalChannelDelete(channel) {
    const embed = new EmbedBuilder().setTitle("Canal Apagado").setDescription(`Nome: ${channel.name}`).setColor(0xff0000).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.server, embed);
}

export async function logExternalRoleCreate(role) {
    const embed = new EmbedBuilder().setTitle("Cargo Criado").setDescription(`Nome: ${role.name}`).setColor(0x00ff00).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.server, embed);
}

export async function logExternalRoleDelete(role) {
    const embed = new EmbedBuilder().setTitle("Cargo Apagado").setDescription(`Nome: ${role.name}`).setColor(0xff0000).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.server, embed);
}

export async function logExternalVoiceJoin(member, channel) {
    const embed = new EmbedBuilder().setTitle("Entrou em Voice").setDescription(`${member.user.username} entrou em ${channel.name}`).setColor(0x00ff00).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.voice, embed);
}

export async function logExternalVoiceLeave(member, channel) {
    const embed = new EmbedBuilder().setTitle("Saiu de Voice").setDescription(`${member.user.username} saiu de ${channel.name}`).setColor(0xff0000).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.voice, embed);
}

export async function logExternalMemberUpdate(oldMember, newMember) {
    const changes = [];
    if (oldMember.nickname !== newMember.nickname) {
        changes.push(`Nickname: ${oldMember.nickname || "Nenhum"} → ${newMember.nickname || "Nenhum"}`);
    }
    const oldRoles = oldMember.roles.cache.map(r => r.id);
    const newRoles = newMember.roles.cache.map(r => r.id);
    const added = newRoles.filter(r => !oldRoles.includes(r));
    const removed = oldRoles.filter(r => !newRoles.includes(r));
    if (added.length) changes.push(`Cargos adicionados: ${added.map(r => `<@&${r}>`).join(", ")}`);
    if (removed.length) changes.push(`Cargos removidos: ${removed.map(r => `<@&${r}>`).join(", ")}`);
    if (!changes.length) return;
    const embed = new EmbedBuilder()
        .setTitle("Membro Atualizado")
        .setDescription([`Utilizador: ${newMember.user.username}`, ...changes].join("\n"))
        .setColor(0x9C27B0).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.member, embed);
}

export async function logExternalMemberBan(ban) {
    const embed = new EmbedBuilder().setTitle("Membro Banido").setDescription(`Nome: ${ban.user.username}\nID: ${ban.user.id}`).setColor(0xff0000).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.member, embed);
}

export async function logExternalMemberUnban(user) {
    const embed = new EmbedBuilder().setTitle("Membro Desbanido").setDescription(`Nome: ${user.username}\nID: ${user.id}`).setColor(0x00ff00).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.member, embed);
}

export async function logExternalSearch(user, query) {
    const embed = new EmbedBuilder()
        .setTitle("Pesquisa sem Resultados")
        .setDescription([`Utilizador: ${user.username}`, `ID: ${user.id}`, `Pergunta: ${query}`].join("\n"))
        .setColor(0xff9800).setTimestamp();
    await sendExternalLog(EXTERNAL_CHANNELS.default, embed);
}
