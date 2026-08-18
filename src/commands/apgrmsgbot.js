// src/commands/apgrmsgbot.js
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { gerarTranscript } from "../utils/transcript.js";

export async function execute(interaction, client) {
  // Verificar permissão (já garantida pelo slash, mas reforçar)
  if (!interaction.member.permissions.has("ManageMessages")) {
    return interaction.reply({
      content: "❌ Precisas da permissão `Gerenciar Mensagens` para usar este comando.",
      flags: 64
    });
  }

  const quantidade = interaction.options.getInteger("quantidade") || 50;
  const motivo = interaction.options.getString("motivo") || "Limpeza de mensagens do bot";

  await interaction.deferReply({ flags: 64 });

  const channel = interaction.channel;

  try {
    // Buscar mensagens do canal
    const messages = await channel.messages.fetch({ limit: Math.min(quantidade, 100) });
    const botMessages = messages.filter(msg => msg.author.id === client.user.id);

    if (botMessages.size === 0) {
      return interaction.editReply({
        content: "ℹ️ Nenhuma mensagem do BOT encontrada neste canal.",
        flags: 64
      });
    }

    // ----- Gerar transcript (HTML + TXT) -----
    let transcriptResult = null;
    try {
      // Usa a função já existente que gera HTML e TXT
      transcriptResult = await gerarTranscript(channel, `bot-clean-${Date.now()}`);
    } catch (err) {
      console.error("[Apgrmsgbot] Erro ao gerar transcript:", err.message);
    }

    // ----- Preparar ficheiros -----
    const files = [];

    // Se o transcript foi gerado com sucesso, adiciona os anexos
    if (transcriptResult) {
      files.push(transcriptResult.attachment);      // HTML
      files.push(transcriptResult.txtAttachment);   // TXT
    } else {
      // Fallback: gerar apenas um TXT simples
      let txtFallback = `🧹 MENSAGENS DO BOT APAGADAS\n`;
      txtFallback += `================================\n`;
      txtFallback += `Canal: ${channel.name}\n`;
      txtFallback += `Staff: ${interaction.user.username}\n`;
      txtFallback += `Motivo: ${motivo}\n`;
      txtFallback += `Quantidade: ${botMessages.size}\n`;
      txtFallback += `Data: ${new Date().toLocaleString("pt-PT")}\n`;
      txtFallback += `================================\n\n`;

      for (const msg of botMessages.values()) {
        txtFallback += `[${msg.createdAt.toLocaleString("pt-PT")}] `;
        txtFallback += `${msg.author.username}: `;
        txtFallback += msg.content || "(sem texto)";
        if (msg.attachments.size > 0) {
          txtFallback += ` [Anexos: ${msg.attachments.map(a => a.name).join(", ")}]`;
        }
        txtFallback += "\n";
      }

      const txtBuffer = Buffer.from(txtFallback, "utf-8");
      files.push(new AttachmentBuilder(txtBuffer, { name: `bot-transcript-${Date.now()}.txt` }));
    }

    // ----- Apagar as mensagens do bot -----
    for (const msg of botMessages.values()) {
      await msg.delete().catch(() => {});
    }

    // ----- Enviar resultado no canal -----
    const embed = new EmbedBuilder()
      .setTitle("🧹 Mensagens do BOT apagadas")
      .setDescription(
        `📊 **Quantidade:** ${botMessages.size}\n` +
        `📅 **Data:** ${new Date().toLocaleString("pt-PT")}\n` +
        `👮 **Staff:** <@${interaction.user.id}>\n` +
        `ℹ️ **Motivo:** ${motivo}`
      )
      .setColor(0xff6b6b)
      .setFooter({ text: "Transcript gerado automaticamente" })
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      files: files
    });

    // ----- Responder ao utilizador -----
    await interaction.editReply({
      content: `✅ ${botMessages.size} mensagens do BOT apagadas com sucesso! Transcript enviado no canal.`,
      flags: 64
    });

  } catch (error) {
    console.error("[Apgrmsgbot] Erro:", error);
    await interaction.editReply({
      content: "❌ Ocorreu um erro ao processar o comando.",
      flags: 64
    });
  }
}
