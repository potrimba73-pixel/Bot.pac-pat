import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { CONFIG } from "../config/index.js";
import discordTranscripts from "discord-html-transcripts";

export async function handleApagarCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: `${CONFIG.EMOJI_ERROR} Apenas administradores.`, flags: 64 });
  }

  const canaisInput = interaction.options.getString("canais");
  const guild = interaction.guild;
  let canaisParaApagar = [];

  if (canaisInput) {
    const ids = canaisInput.split(",").map((id) => id.trim());
    for (const id of ids) {
      const canal = await guild.channels.fetch(id).catch(() => null);
      if (canal) canaisParaApagar.push(canal);
    }
  } else {
    canaisParaApagar = guild.channels.cache.filter((ch) => ch.type === 0).map((ch) => ch);
  }

  await interaction.reply({ content: `${CONFIG.EMOJI_LOADING} A apagar e gerar transcripts...`, flags: 64 });

  let totalApagadas = 0;
  const erros = [];

  for (const canal of canaisParaApagar) {
    try {
      const messages = await canal.messages.fetch({ limit: 100 });
      const botMessages = messages.filter((msg) => msg.author.id === interaction.client.user.id);
      
      // Criar TXT antes de apagar
      let txtContent = `TRANSCRIPT - MENSAGENS DO BOT APAGADAS\n`;
      txtContent += `================================\n`;
      txtContent += `Canal: #${canal.name}\n`;
      txtContent += `Apagado por: ${interaction.user.tag}\n`;
      txtContent += `Data: ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}\n`;
      txtContent += `================================\n\n`;

      const msgsArray = Array.from(botMessages.values()).reverse();
      for (const msg of msgsArray) {
        const data = new Date(msg.createdTimestamp).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
        txtContent += `[${data}] ${msg.author.tag}: ${msg.content || "(sem texto)"}\n`;
        if (msg.attachments.size > 0) {
          txtContent += `  [Anexos: ${msg.attachments.map(a => a.name).join(", ")}]\n`;
        }
        txtContent += `\n`;
      }

      // Apagar
      for (const msg of botMessages.values()) {
        await msg.delete().catch(() => {});
        totalApagadas++;
        await new Promise((r) => setTimeout(r, 100));
      }

      // Gerar HTML
      let htmlAttachment = null;
      try {
        htmlAttachment = await discordTranscripts.createTranscript(canal, {
          limit: 100,
          returnType: discordTranscripts.ExportReturnType.Attachment,
          filename: `apagado-${canal.id}-${Date.now()}.html`,
          saveImages: true,
          poweredBy: false,
        });
      } catch (e) {}

      // Enviar ficheiros no canal
      const files = [];
      files.push({ attachment: Buffer.from(txtContent, "utf-8"), name: `apagado-${canal.name}-${Date.now()}.txt` });
      if (htmlAttachment) files.push(htmlAttachment);

      await canal.send({
        content: `${CONFIG.EMOJI_BROOM} ${botMessages.size} mensagens do bot apagadas por ${interaction.user.tag}`,
        files: files
      }).catch(() => {});

    } catch (e) {
      erros.push(`${canal.name}: ${e.message}`);
    }
  }

  // Limpar DB
  if (!canaisInput) {
    interaction.client.db.messages = {};
  } else {
    const ids = canaisInput.split(",").map((id) => id.trim());
    for (const id of ids) {
      if (interaction.client.db.messages.painelGeral && id === CONFIG.CANAL_TICKETS_GERAL)
        delete interaction.client.db.messages.painelGeral;
      if (interaction.client.db.messages.painelRecrutamento && id === CONFIG.CANAL_TICKETS_RECRUTAMENTO)
        delete interaction.client.db.messages.painelRecrutamento;
      if (interaction.client.db.messages.painelRegras && id === CONFIG.CANAL_REGRAS)
        delete interaction.client.db.messages.painelRegras;
      if (interaction.client.db.messages.painelRegrasRecrutamento && id === CONFIG.CANAL_REGRAS_RECRUTAMENTO)
        delete interaction.client.db.messages.painelRegrasRecrutamento;
    }
  }
  interaction.client.db.saveDB();

  const resposta = [
    `${CONFIG.EMOJI_BROOM} Limpeza concluída!`,
    `${CONFIG.EMOJI_CHECK} Total: ${totalApagadas} mensagens`,
    `${CONFIG.EMOJI_FILE} Transcripts (TXT + HTML) enviados em cada canal`,
    ...(erros.length > 0 ? [`${CONFIG.EMOJI_WARNING} Erros: ${erros.length}`] : []),
  ].join("\n");

  await interaction.editReply({ content: resposta });
}
