// src/commands/apgrmsgbot.js
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { gerarTranscript } from "../utils/transcript.js";
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";

export async function execute(interaction, client) {
  // Verificar permissão
  if (!interaction.member.permissions.has("ManageMessages")) {
    return interaction.reply({
      content: "❌ Precisas da permissão `Gerenciar Mensagens` para usar este comando.",
      flags: 64
    });
  }

  const quantidade = interaction.options.getInteger("quantidade") || 50;
  const motivo = interaction.options.getString("motivo") || "Limpeza de mensagens do bot";

  // Deferir com a função segura
  const deferred = await safeDeferReply(interaction);
  if (!deferred) {
    // Se não foi possível deferir, talvez já tenha respondido, tentamos reply direto
    return interaction.reply({ content: "⏳ A processar...", flags: 64 }).catch(() => {});
  }

  const channel = interaction.channel;

  try {
    const messages = await channel.messages.fetch({ limit: Math.min(quantidade, 100) });
    const botMessages = messages.filter(msg => msg.author.id === client.user.id);

    if (botMessages.size === 0) {
      return await safeEditReply(interaction, {
        content: "ℹ️ Nenhuma mensagem do BOT encontrada neste canal.",
        flags: 64
      });
    }

    // Gerar transcript
    let transcriptResult = null;
    try {
      transcriptResult = await gerarTranscript(channel, `bot-clean-${Date.now()}`);
    } catch (err) {
      console.error("[Apgrmsgbot] Erro ao gerar transcript:", err.message);
    }

    const files = [];
    if (transcriptResult) {
      files.push(transcriptResult.attachment);
      files.push(transcriptResult.txtAttachment);
    } else {
      // Fallback TXT
      let txtFallback = `🧹 MENSAGENS DO BOT APAGADAS\n`;
      txtFallback += `================================\n`;
      txtFallback += `Canal: ${channel.name}\n`;
      txtFallback += `Staff: ${interaction.user.username}\n`;
      txtFallback += `Motivo: ${motivo}\n`;
      txtFallback += `Quantidade: ${botMessages.size}\n`;
      txtFallback += `Data: ${new Date().toLocaleString("pt-PT")}\n`;
      txtFallback += `================================\n\n`;
      for (const msg of botMessages.values()) {
        txtFallback += `[${msg.createdAt.toLocaleString("pt-PT")}] ${msg.author.username}: ${msg.content || "(sem texto)"}`;
        if (msg.attachments.size > 0) {
          txtFallback += ` [Anexos: ${msg.attachments.map(a => a.name).join(", ")}]`;
        }
        txtFallback += "\n";
      }
      const txtBuffer = Buffer.from(txtFallback, "utf-8");
      files.push(new AttachmentBuilder(txtBuffer, { name: `bot-transcript-${Date.now()}.txt` }));
    }

    // Apagar mensagens
    for (const msg of botMessages.values()) {
      await msg.delete().catch(() => {});
    }

    // Embed de resumo
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

    await channel.send({ embeds: [embed], files });

    await safeEditReply(interaction, {
      content: `✅ ${botMessages.size} mensagens do BOT apagadas com sucesso! Transcript enviado no canal.`,
      flags: 64
    });

  } catch (error) {
    console.error("[Apgrmsgbot] Erro:", error);
    await safeEditReply(interaction, {
      content: "❌ Ocorreu um erro ao processar o comando.",
      flags: 64
    });
  }
}
