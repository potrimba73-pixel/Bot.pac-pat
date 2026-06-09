import { 
  EmbedBuilder, 
  PermissionFlagsBits,
  AttachmentBuilder
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { gerarTranscript } from "../utils/transcript.js";
import { salvarTranscriptSupabase, buscarTranscriptSupabase } from "../utils/supabase.js";

export async function handleTranscriptCommand(interaction, client) {
  // ========== VERIFICAR PERMISSÃO STAFF ==========
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && 
      !interaction.member.roles.cache.has(CONFIG.CARGO_STAFF)) {
    return interaction.reply({ 
      content: `${CONFIG.EMOJI_ERROR} Apenas staff pode usar este comando.`, 
      flags: 64 
    });
  }

  await interaction.deferReply({ flags: 64 });

  const canal = interaction.channel;
  const guild = interaction.guild;

  try {
    // ========== GERAR HTML BONITO ==========
    let htmlAttachment = null;
    try {
      htmlAttachment = await gerarTranscript(canal, `transcript-${canal.id}-${Date.now()}`);
    } catch (e) {
      console.error("[Transcript] Erro ao gerar HTML:", e.message);
    }

    // ========== GERAR TXT ==========
    const messages = await canal.messages.fetch({ limit: 100 });
    const msgsArray = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    
    let txtContent = `═══════════════════════════════════════════════════════════════\n`;
    txtContent += `  TRANSCRIPT - PORTUGAL ALFA COMMUNITY\n`;
    txtContent += `═══════════════════════════════════════════════════════════════\n`;
    txtContent += `Canal:        #${canal.name}\n`;
    txtContent += `ID do Canal:  ${canal.id}\n`;
    txtContent += `Servidor:     ${guild.name}\n`;
    txtContent += `Gerado por:   ${interaction.user.tag}\n`;
    txtContent += `Data:         ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}\n`;
    txtContent += `Total msgs:   ${msgsArray.length}\n`;
    txtContent += `═══════════════════════════════════════════════════════════════\n\n`;

    for (const msg of msgsArray) {
      const data = new Date(msg.createdTimestamp).toLocaleString("pt-PT", { 
        timeZone: "Europe/Lisbon",
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      
      txtContent += `[${data}] ${msg.author.tag} (${msg.author.id})\n`;
      
      if (msg.content) {
        txtContent += `  ${msg.content}\n`;
      }
      
      if (msg.attachments.size > 0) {
        txtContent += `  [Anexos: ${msg.attachments.map(a => `${a.name} (${a.url})`).join(", ")}]\n`;
      }
      
      if (msg.embeds.length > 0) {
        txtContent += `  [Embed: ${msg.embeds.length} embed(s)]\n`;
      }
      
      txtContent += `\n`;
    }

    txtContent += `═══════════════════════════════════════════════════════════════\n`;
    txtContent += `  FIM DO TRANSCRIPT\n`;
    txtContent += `═══════════════════════════════════════════════════════════════\n`;

    // ========== CRIAR ATTACHMENTS ==========
    const files = [];
    
    // TXT
    const txtBuffer = Buffer.from(txtContent, "utf-8");
    files.push(new AttachmentBuilder(txtBuffer, { name: `transcript-${canal.name}-${Date.now()}.txt` }));

    // HTML
    if (htmlAttachment) {
      files.push(new AttachmentBuilder(htmlAttachment.attachment.attachment, { 
        name: htmlAttachment.fileName 
      }));
    }

    // ========== ENVIAR PARA O UTILIZADOR (DM) ==========
    const embedDM = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_FILE} Transcript Gerado`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Aqui está o transcript do canal **#${canal.name}**.`,
        ``,
        `${CONFIG.EMOJI_USER} Gerado por: ${interaction.user.tag}`,
        `${CONFIG.EMOJI_TIME} Data: ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`,
        ``,
        `${CONFIG.EMOJI_CHECK} Ficheiros:`,
        `• TXT - Versão texto simples`,
        htmlAttachment ? `• HTML - Versão visual bonita` : `• HTML - Erro ao gerar`
      ].join("\n"))
      .setColor(0x262af1)
      .setTimestamp();

    await interaction.user.send({ embeds: [embedDM], files }).catch(() => {
      return interaction.editReply({ 
        content: `${CONFIG.EMOJI_ERROR} Não consegui enviar os ficheiros no teu privado. Verifica se tens DMs abertas.`, 
        flags: 64 
      });
    });

    // ========== GUARDAR NO SUPABASE ==========
    const transcriptData = {
      id: `transcript-${canal.id}-${Date.now()}`,
      canalId: canal.id,
      canalNome: canal.name,
      guildId: guild.id,
      guildNome: guild.name,
      geradoPor: interaction.user.id,
      geradoPorTag: interaction.user.tag,
      data: new Date().toISOString(),
      totalMensagens: msgsArray.length,
      txtConteudo: txtContent,
      htmlFileName: htmlAttachment ? htmlAttachment.fileName : null,
    };

    await salvarTranscriptSupabase(transcriptData);

    // ========== CONFIRMAÇÃO NO CANAL ==========
    const embedConfirm = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_SUCCESS} Transcript Gerado com Sucesso`)
      .setDescription([
        `${CONFIG.EMOJI_CHECK} O transcript foi enviado no teu privado!`,
        ``,
        `${CONFIG.EMOJI_FILE} Ficheiros gerados:`,
        `• 📄 TXT (texto simples)`,
        htmlAttachment ? `• 🌐 HTML (visual bonito)` : `• ❌ HTML (erro ao gerar)`,
        ``,
        `${CONFIG.EMOJI_DATABASE} Guardado na base de dados com sucesso.`
      ].join("\n"))
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embedConfirm], flags: 64 });

    // ========== LOG NO CANAL DE LOGS ==========
    const logChannel = await client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
    if (logChannel) {
      const embedLog = new EmbedBuilder()
        .setTitle(`${CONFIG.EMOJI_FILE} Transcript Gerado`)
        .setDescription([
          `${CONFIG.EMOJI_USER} Staff: ${interaction.user.tag} (${interaction.user.id})`,
          `${CONFIG.EMOJI_INFO} Canal: <#${canal.id}> (${canal.id})`,
          `${CONFIG.EMOJI_TIME} Data: ${new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`,
          `${CONFIG.EMOJI_FILE} Mensagens: ${msgsArray.length}`
        ].join("\n"))
        .setColor(0x0099ff)
        .setTimestamp();
      
      await logChannel.send({ embeds: [embedLog] });
    }

  } catch (error) {
    console.error("[Transcript] Erro:", error);
    await interaction.editReply({ 
      content: `${CONFIG.EMOJI_ERROR} Erro ao gerar transcript: ${error.message}`, 
      flags: 64 
    });
  }
}
