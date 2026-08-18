// src/commands/apgrmsgbot.js
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { gerarTranscript } from "../utils/transcript.js";
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";

// ID do bot alvo (bot de música)
const TARGET_BOT_ID = "412347553141751808";

export async function execute(interaction, client) {
  // Verificar permissão
  if (!interaction.member.permissions.has("ManageMessages")) {
    return interaction.reply({
      content: "❌ Precisas da permissão `Gerenciar Mensagens`.",
      flags: 64
    });
  }

  const quantidade = interaction.options.getInteger("quantidade") || 50;
  const motivo = interaction.options.getString("motivo") || "Limpeza de mensagens do bot";

  // Deferir a resposta
  const deferred = await safeDeferReply(interaction);
  if (!deferred) {
    return interaction.reply({ content: "⏳ A processar...", flags: 64 });
  }

  const channel = interaction.channel;

  try {
    // Buscar mensagens
    const messages = await channel.messages.fetch({ limit: Math.min(quantidade, 100) });
    const botMessages = messages.filter(msg => msg.author.id === TARGET_BOT_ID);

    if (botMessages.size === 0) {
      return await safeEditReply(interaction, {
        content: `ℹ️ Nenhuma mensagem do bot <@${TARGET_BOT_ID}> encontrada.`,
        flags: 64
      });
    }

    // ===== GERAR TRANSCRIPT (HTML + TXT) =====
    let transcriptResult = null;
    try {
      transcriptResult = await gerarTranscript(channel, `bot-clean-${Date.now()}`);
      console.log("[Apgrmsgbot] Transcript gerado:", transcriptResult ? "OK" : "Falhou");
    } catch (err) {
      console.error("[Apgrmsgbot] Erro ao gerar transcript:", err.message);
    }

    // ===== PREPARAR FICHEIROS =====
    const files = [];

    if (transcriptResult && transcriptResult.attachment && transcriptResult.txtAttachment) {
      files.push(transcriptResult.attachment);      // HTML
      files.push(transcriptResult.txtAttachment);   // TXT
    } else {
      // Fallback: TXT simples
      let txtFallback = `🧹 MENSAGENS DO BOT APAGADAS\n`;
      txtFallback += `================================\n`;
      txtFallback += `Canal: ${channel.name}\n`;
      txtFallback += `Staff: ${interaction.user.username}\n`;
      txtFallback += `Motivo: ${motivo}\n`;
      txtFallback += `Bot alvo: ${TARGET_BOT_ID}\n`;
      txtFallback += `Quantidade: ${botMessages.size}\n`;
      txtFallback += `Data: ${new Date().toLocaleString("pt-PT")}\n`;
      txtFallback += `================================\n\n`;

      for (const msg of botMessages.values()) {
        txtFallback += `[${msg.createdAt.toLocaleString("pt-PT")}] ${msg.author.username}: ${msg.content || "(sem texto)"}\n`;
      }

      const txtBuffer = Buffer.from(txtFallback, "utf-8");
      files.push(new AttachmentBuilder(txtBuffer, { name: `bot-transcript-${Date.now()}.txt` }));
    }

    // ===== APAGAR MENSAGENS =====
    for (const msg of botMessages.values()) {
      await msg.delete().catch(() => {});
    }

    // ===== ENVIAR EMBED COM RESULTADO =====
    const embed = new EmbedBuilder()
      .setTitle("🧹 Mensagens do BOT apagadas")
      .setDescription(
        `📊 **Quantidade:** ${botMessages.size}\n` +
        `🤖 **Bot alvo:** <@${TARGET_BOT_ID}>\n` +
        `📅 **Data:** ${new Date().toLocaleString("pt-PT")}\n` +
        `👮 **Staff:** <@${interaction.user.id}>\n` +
        `ℹ️ **Motivo:** ${motivo}`
      )
      .setColor(0xff6b6b)
      .setFooter({ text: "Transcript gerado automaticamente" })
      .setTimestamp();

    await channel.send({ embeds: [embed], files });

    // ===== RESPONDER AO UTILIZADOR =====
    await safeEditReply(interaction, {
      content: `✅ ${botMessages.size} mensagens apagadas. Transcript enviado no canal.`,
      flags: 64
    });

  } catch (error) {
    console.error("[Apgrmsgbot] Erro:", error);
    await safeEditReply(interaction, {
      content: `❌ Erro: ${error.message || "tente novamente."}`,
      flags: 64
    });
  }
}
