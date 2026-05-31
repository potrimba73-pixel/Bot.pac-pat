import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
} from "discord.js";
import http from 'node:http';
import fs from "fs";

// ==================== DATABASE SIMPLES ====================
const DB_FILE = "./tickets.json";
let db = { tickets: {}, messages: {}, acceptedRules: [], avaliacoes: {} };

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        } catch (e) {
            console.error("Erro ao carregar DB:", e.message);
        }
    }
}

let saving = false;
let pendingSave = false;

async function saveDB() {
    if (saving) {
        pendingSave = true;
        return;
    }
    saving = true;
    try {
        await fs.promises.writeFile(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Erro ao guardar DB:", e.message);
    } finally {
        saving = false;
        if (pendingSave) {
            pendingSave = false;
            await saveDB();
        }
    }
}

loadDB();

// ==================== VALIDAR ENV VARS ====================
const requiredEnv = ["TOKEN", "CLIENT_ID", "GUILD_ID"];
const missing = requiredEnv.filter(e => !process.env[e]);
if (missing.length > 0) {
    console.error("Variaveis em falta:", missing.join(", "));
    process.exit(1);
}

const CONFIG = {
    GUILD_ID: process.env.GUILD_ID,
    CARGO_STAFF: process.env.CARGO_STAFF || "",
    CANAL_LOGS: process.env.CANAL_LOGS || "",
    CANAL_AVALIACOES: process.env.CANAL_AVALIACOES || "",
    CATEGORIA_TICKETS_GERAL: process.env.CATEGORIA_TICKETS_GERAL || "",
    CATEGORIA_TICKETS_RECRUTAMENTO: process.env.CATEGORIA_TICKETS_RECRUTAMENTO || "",
};

// ==================== CLIENT SETUP ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ==================== TICKET SYSTEM (INLINE) ====================
const cooldown = new Set();

async function createTicket(interaction, type, label) {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
    if (!guild) {
        return interaction.reply({ content: "Erro: servidor nao encontrado.", flags: 64 });
    }
    const user = interaction.user;

    if (cooldown.has(user.id)) {
        return interaction.reply({ content: "Espera 3 segundos...", flags: 64 });
    }

    const existingTicket = Object.values(db.tickets).find(
        (t) => t.userId === user.id && !t.closed
    );
    if (existingTicket) {
        return interaction.reply({ content: "Ja tens um ticket aberto!", flags: 64 });
    }

    cooldown.add(user.id);
    setTimeout(() => cooldown.delete(user.id), 3000);

    const typePrefix = type === "recrutamento" ? "rec" : 
                       type === "bugs" ? "bug" : 
                       type === "denuncia" ? "den" : 
                       type === "suporte" ? "sup" : 
                       type === "criador" ? "cri" : 
                       type === "ajuda" ? "ajd" : "tk";

    const channelName = `${typePrefix}-${user.username}-${user.id.slice(0, 4)}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .substring(0, 25);

    let categoria = type === "recrutamento" ? CONFIG.CATEGORIA_TICKETS_RECRUTAMENTO : CONFIG.CATEGORIA_TICKETS_GERAL;

    const channelData = {
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            { id: guild.id, type: 0, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, type: 1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ],
    };

    if (CONFIG.CARGO_STAFF) {
        channelData.permissionOverwrites.push({
            id: CONFIG.CARGO_STAFF,
            type: 0,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
    }

    if (categoria) {
        const cat = await guild.channels.fetch(categoria).catch(() => null);
        if (cat) channelData.parent = categoria;
    }

    const channel = await guild.channels.create(channelData);

    const ticketId = Date.now().toString();
    db.tickets[ticketId] = {
        id: ticketId,
        channelId: channel.id,
        userId: user.id,
        username: user.username,
        type: type,
        label: label,
        openedAt: new Date().toISOString(),
        closedAt: null,
        claimedBy: null,
        claimedByName: null,
        closedBy: null,
        closedByName: null,
        callActive: false,
        callChannelId: null,
        rating: null,
        panelMessageId: null,
    };
    await saveDB();

    const embed = new EmbedBuilder()
        .setTitle("Sistema de Ticket | Portugal Alfa Community")
        .setDescription([
            `Motivo: ${label}`,
            `Assumido: Aguardando staff...`,
            "",
            `Ola ${user.username}, aguarde ser atendido.`,
        ].join("\n"))
        .setColor(0x262af1);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`assumir_${ticketId}`).setLabel("Assumir").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`painel_${ticketId}`).setLabel("Painel Staff").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`sair_${ticketId}`).setLabel("Sair").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`deletar_${ticketId}`).setLabel("Fechar").setStyle(ButtonStyle.Danger),
    );

    await channel.send({ content: `${user.username}`, embeds: [embed], components: [row] });

    await interaction.reply({
        content: `Ticket criado: ${channel}`,
        flags: 64,
    });
}

// ==================== INTERACTION HANDLER (INLINE) ====================
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId.startsWith("ticket_")) {
                const type = customId.replace("ticket_", "");
                const labels = {
                    recrutamento: "Recrutamento PAT",
                    bugs: "Reportar Bug",
                    denuncia: "Denuncia",
                    suporte: "Suporte Tecnico",
                    criador: "Criador de Conteudo",
                    ajuda: "Ajuda Geral",
                };
                await createTicket(interaction, type, labels[type] || "Ticket");
                return;
            }

            if (customId.startsWith("assumir_")) {
                const ticketId = customId.split("_")[1];
                const ticket = db.tickets[ticketId];
                if (!ticket) return interaction.reply({ content: "Ticket nao encontrado.", flags: 64 });
                if (ticket.claimedBy) return interaction.reply({ content: "Ja assumido.", flags: 64 });

                ticket.claimedBy = interaction.user.id;
                ticket.claimedByName = interaction.user.username;
                await saveDB();
                await interaction.reply({ content: `Assumido por ${interaction.user.username}`, flags: 64 });
                return;
            }

            if (customId.startsWith("deletar_")) {
                const ticketId = customId.split("_")[1];
                const ticket = db.tickets[ticketId];
                if (!ticket) return interaction.reply({ content: "Ticket nao encontrado.", flags: 64 });

                ticket.closedBy = interaction.user.id;
                ticket.closedByName = interaction.user.username;
                ticket.closedAt = new Date().toISOString();
                ticket.closed = true;
                await saveDB();

                await interaction.reply({ content: "Ticket fechado. A apagar em 10 segundos..." });
                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => {});
                }, 10000);
                return;
            }

            if (customId.startsWith("sair_")) {
                const ticketId = customId.split("_")[1];
                const ticket = db.tickets[ticketId];
                if (!ticket) return;
                if (ticket.userId !== interaction.user.id) {
                    return interaction.reply({ content: "So o criador pode sair.", flags: 64 });
                }
                await interaction.channel.permissionOverwrites.delete(interaction.user.id);
                await interaction.reply({ content: "Saiu do ticket.", flags: 64 });
                return;
            }
        }

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === "ajuda") {
                await interaction.reply({
                    content: "Comando de ajuda em desenvolvimento.",
                    flags: 64,
                });
            }
        }
    } catch (error) {
        console.error("Erro na interacao:", error.message);
    }
});

// ==================== READY ====================
client.once(Events.ClientReady, async () => {
    console.log("Bot online: " + client.user.tag);
    client.user.setPresence({
        activities: [{ name: '/ajuda | Portugal Alfa Community', type: 0 }],
        status: 'online',
    });
});

// ==================== ERROR HANDLING ====================
client.on(Events.Error, (error) => {
    console.error("Erro Discord:", error.message);
});

process.on('unhandledRejection', (error) => {
    console.error("Unhandled Rejection:", error.message);
});

process.on('uncaughtException', (error) => {
    console.error("Uncaught Exception:", error.message);
});

// ==================== WEB SERVER ====================
http.createServer((req, res) => {
    const ticketsAbertos = Object.values(db.tickets || {}).filter(t => !t.closed).length;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write("PAC Bot Online!\n");
    res.write("Uptime: " + Math.floor(process.uptime()) + "s\n");
    res.write("Tickets abertos: " + ticketsAbertos + "\n");
    res.end();
}).listen(process.env.PORT || 3000);

// ==================== LOGIN ====================
client.login(process.env.TOKEN);
