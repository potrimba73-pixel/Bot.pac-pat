import discordTranscripts from "discord-html-transcripts";
import fs from "fs";
import path from "path";

const TRANSCRIPTS_DIR = "./transcripts";

// Criar pasta se nao existir
if (!fs.existsSync(TRANSCRIPTS_DIR)) {
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}

export async function gerarTranscript(channel, ticketId) {
  try {
    const attachment = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnType: discordTranscripts.ExportReturnType.Buffer,
      filename: `ticket-${ticketId}.html`,
      saveImages: true,
      saveAssets: true,
      poweredBy: false,
    });

    const filePath = path.join(TRANSCRIPTS_DIR, `ticket-${ticketId}.html`);
    fs.writeFileSync(filePath, attachment);

    // Retornar URL local (o bot pode enviar como ficheiro no Discord)
    return { 
      url: filePath, 
      fileName: `ticket-${ticketId}.html`,
      ticketId 
    };

  } catch (err) {
    console.error(`[Transcript] Falha no ticket #${ticketId}:`, err.message);
    return null;
  }
}

export async function enviarTranscriptComoFicheiro(channel, ticketId, client) {
  try {
    const filePath = path.join(TRANSCRIPTS_DIR, `ticket-${ticketId}.html`);
    if (!fs.existsSync(filePath)) {
      console.error(`[Transcript] Ficheiro nao encontrado: ${filePath}`);
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const attachment = { 
      attachment: fileBuffer, 
      name: `ticket-${ticketId}.html` 
    };

    const sent = await channel.send({
      content: `📄 **Transcript do Ticket #${ticketId}**`,
      files: [attachment]
    });

    return { messageId: sent.id, url: sent.attachments.first()?.url };
  } catch (err) {
    console.error(`[Transcript] Erro ao enviar ficheiro:`, err.message);
    return null;
  }
}
