import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import TruckyAPI from "../utils/truckyAPI.js";
import { TRUCKY_CONFIG } from "../config/trucky.js";

const mapaIntervals = new Map();

export const mapaCanalSlashCommands = [
    new SlashCommandBuilder()
        .setName("mapa-canal")
        .setDescription("Ativa/desativa mapa da frota num canal dedicado (Staff)")
        .addChannelOption(option =>
            option.setName("canal")
                .setDescription("Canal onde mostrar o mapa (deixa vazio para desativar)")
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName("atualizar")
                .setDescription("Minutos entre atualizacoes (padrao: 5)")
                .setMinValue(1).setMaxValue(60).setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),
];

export async function handleMapaCanalCommand(interaction, client) {
    if (interaction.commandName !== "mapa-canal") return false;

    await interaction.deferReply({ ephemeral: true });

    const canal = interaction.options.getChannel("canal");
    const minutos = interaction.options.getInteger("atualizar") || 5;

    if (!canal) {
        const guildId = interaction.guildId;
        if (mapaIntervals.has(guildId)) {
            clearInterval(mapaIntervals.get(guildId));
            mapaIntervals.delete(guildId);
            return interaction.editReply({ content: "🗺️ Mapa do canal **DESATIVADO**." });
        }
        return interaction.editReply({ content: "❌ Nenhum mapa ativo para desativar." });
    }

    const guildId = interaction.guildId;
    if (mapaIntervals.has(guildId)) {
        clearInterval(mapaIntervals.get(guildId));
        mapaIntervals.delete(guildId);
    }

    const msg = await enviarMapaEmbed(canal);

    const interval = setInterval(async () => {
        try { await atualizarMapaEmbed(canal, msg.id); }
        catch (err) { console.error("[MapaCanal] Erro ao atualizar:", err); }
    }, minutos * 60 * 1000);

    mapaIntervals.set(guildId, interval);

    await interaction.editReply({
        content: `🗺️ Mapa ativado no canal <#${canal.id}>! Atualiza a cada **${minutos} minutos**.\nUse /mapa-canal sem canal para desativar.`
    });

    return true;
}

async function enviarMapaEmbed(canal) {
    const members = await TruckyAPI.getCompanyMembers();
    const onlineDrivers = [];

    for (const member of members) {
        const location = await TruckyAPI.getMemberLocation(member.id);
        if (location && location.online) {
            onlineDrivers.push({
                name: member.name, discordId: member.discord_id, avatar: member.avatar_url,
                city: location.city_name || "Desconhecido", country: location.country_name || "",
                speed: location.speed || 0, game: location.game_id === 1 ? "ETS2" : "ATS",
                heading: location.heading
            });
        }
    }

    const embed = new EmbedBuilder()
        .setTitle("🗺️ Mapa da Frota - Portugal Alfa Truckers")
        .setDescription(`Motoristas online: **${onlineDrivers.length}** | Total VTC: **${members.length}**`)
        .setColor(TRUCKY_CONFIG.cores.trucky)
        .setImage("https://map.truckyapp.com/ets2/map.png")
        .setTimestamp()
        .setFooter({ text: "Atualiza automaticamente | Portugal Alfa Truckers" });

    if (onlineDrivers.length > 0) {
        let driversText = "";
        for (const driver of onlineDrivers) {
            const mention = driver.discordId ? `<@${driver.discordId}>` : driver.name;
            const speedEmoji = driver.speed > 0 ? "🚛" : "🅿️";
            const direction = getDirectionEmoji(driver.heading);
            driversText += `${speedEmoji} ${direction} ${mention} - ${driver.city} (${Math.round(driver.speed)} km/h) [${driver.game}]\n`;
        }
        embed.addFields({ name: "🚛 Motoristas Online", value: driversText.substring(0, 1024), inline: false });
    } else {
        embed.addFields({ name: "🚛 Motoristas Online", value: "Nenhum motorista online de momento. 🛣️", inline: false });
    }

    embed.addFields({
        name: "🔗 Links",
        value: `[Mapa ETS2](https://map.truckyapp.com/ets2) | [Mapa ATS](https://map.truckyapp.com/ats) | [Mapa VTC](${TruckyAPI.getCompanyMapUrl()})`,
        inline: false
    });

    return await canal.send({ embeds: [embed] });
}

async function atualizarMapaEmbed(canal, messageId) {
    try {
        const msg = await canal.messages.fetch(messageId);
        if (!msg) return;

        const members = await TruckyAPI.getCompanyMembers();
        const onlineDrivers = [];

        for (const member of members) {
            const location = await TruckyAPI.getMemberLocation(member.id);
            if (location && location.online) {
                onlineDrivers.push({
                    name: member.name, discordId: member.discord_id, avatar: member.avatar_url,
                    city: location.city_name || "Desconhecido", country: location.country_name || "",
                    speed: location.speed || 0, game: location.game_id === 1 ? "ETS2" : "ATS",
                    heading: location.heading
                });
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("🗺️ Mapa da Frota - Portugal Alfa Truckers")
            .setDescription(`Motoristas online: **${onlineDrivers.length}** | Total VTC: **${members.length}**`)
            .setColor(TRUCKY_CONFIG.cores.trucky)
            .setImage("https://map.truckyapp.com/ets2/map.png")
            .setTimestamp()
            .setFooter({ text: "Atualiza automaticamente | Portugal Alfa Truckers" });

        if (onlineDrivers.length > 0) {
            let driversText = "";
            for (const driver of onlineDrivers) {
                const mention = driver.discordId ? `<@${driver.discordId}>` : driver.name;
                const speedEmoji = driver.speed > 0 ? "🚛" : "🅿️";
                const direction = getDirectionEmoji(driver.heading);
                driversText += `${speedEmoji} ${direction} ${mention} - ${driver.city} (${Math.round(driver.speed)} km/h) [${driver.game}]\n`;
            }
            embed.addFields({ name: "🚛 Motoristas Online", value: driversText.substring(0, 1024), inline: false });
        } else {
            embed.addFields({ name: "🚛 Motoristas Online", value: "Nenhum motorista online de momento. 🛣️", inline: false });
        }

        embed.addFields({
            name: "🔗 Links",
            value: `[Mapa ETS2](https://map.truckyapp.com/ets2) | [Mapa ATS](https://map.truckyapp.com/ats) | [Mapa VTC](${TruckyAPI.getCompanyMapUrl()})`,
            inline: false
        });

        await msg.edit({ embeds: [embed] });
    } catch (err) {
        console.error("[MapaCanal] Erro ao atualizar mensagem:", err);
    }
}

function getDirectionEmoji(heading) {
    if (heading === undefined) return "⬆️";
    if (heading >= 337.5 || heading < 22.5) return "⬆️";
    if (heading >= 22.5 && heading < 67.5) return "↗️";
    if (heading >= 67.5 && heading < 112.5) return "➡️";
    if (heading >= 112.5 && heading < 157.5) return "↘️";
    if (heading >= 157.5 && heading < 202.5) return "⬇️";
    if (heading >= 202.5 && heading < 247.5) return "↙️";
    if (heading >= 247.5 && heading < 292.5) return "⬅️";
    if (heading >= 292.5 && heading < 337.5) return "↖️";
    return "⬆️";
}
