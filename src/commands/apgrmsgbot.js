// src/commands/apgrmsgbot.js
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { gerarTranscript } from "../utils/transcript.js";
import { safeDeferReply, safeEditReply } from "../utils/safeReply.js";

// ============================================================
// ID DO BOT QUE QUEREMOS APAGAR (bot de música)
// ============================================================
const TARGET_BOT_ID = "412347553141751808";

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
export async function execute(interaction, client) {
  // ===== VERIFICAR PERMISSÃO =====
  if (!interaction.member.permissions.has("ManageMessages")) {
    return interaction.reply({
      content: "❌ Precisas da permissão `Gerenciar Mensagens` para usar este comando.",
      flags: 64
    });
  }

  // ===== OPÇÕES =====
  const quantidade = interaction.options.getInteger("quantidade") || 50;
  const motivo = interaction.options.getString("motivo") || "Limpeza de mensagens do bot";

  // ===== DEFERIR COM SEGURANÇA =====
  const deferred = await safeDeferReply(interaction);
  if (!deferred) {
    return interaction.reply({ content: "⏳ A processar...", flags: 64 });
  }

  const channel = interaction.channel;

  try {
    // ===== BUSCAR MENSAGENS =====
    const messages = await channel.messages.fetch({ limit: Math.min(quantidade, 100) });

    // ===== FILTRAR APENAS AS MENSAGENS DO BOT ALVO =====
    const botMessages = messages.filter(msg => msg.author.id === TARGET_BOT_ID);

    console.log(`[Apgrmsgbot] Encontradas ${botMessages.size} mensagens do bot ${TARGET_BOT_ID} no canal ${channel.name}`);

    if (botMessages.size === 0) {
      return await safeEditReply(interaction, {
        content: `ℹ️ Nenhuma mensagem do bot <@${TARGET_BOT_ID}> encontrada neste canal.`,
        flags: 64
      });
    }

    // ===== GERAR TRANSCRIPT (HTML + TXT) =====
    let transcriptResult = null;
    try {
      transcriptResult = await gerarTranscript(channel, `bot-clean-${Date.now()}`);
    } catch (err) {
      console.error("[Apgrmsgbot] Erro ao gerar transcript:", err.message);
    }

    // ===== PREPARAR FICHEIROS =====
    const files = [];

    if (transcriptResult) {
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

    // ===== APAGAR MENSAGENS DO BOT =====
    for (const msg of botMessages.values()) {
      await msg.delete().catch(() => {});
    }

    // ===== ENVIAR RESULTADO NO CANAL =====
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

    await channel.send({
      embeds: [embed],
      files: files
    });

    // ===== RESPONDER AO UTILIZADOR =====
    await safeEditReply(interaction, {
      content: `✅ ${botMessages.size} mensagens do bot apagadas com sucesso! Transcript enviado no canal.`,
      flags: 64
    });

  } catch (error) {
    console.error("[Apgrmsgbot] Erro:", error);
    await safeEditReply(interaction, {
      content: `❌ Ocorreu um erro: ${error.message || "tente novamente."}`,
      flags: 64
    });
  }
}
