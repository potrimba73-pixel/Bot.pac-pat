import discordTranscripts from "discord-html-transcripts";

export async function gerarTranscript(channel, ticketId) {
  try {
    const attachment = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnType: discordTranscripts.ExportReturnType.Attachment,
      filename: `ticket-${ticketId}.html`,
      saveImages: true,
      saveAssets: true,
      poweredBy: false,
    });

    return { 
      attachment: attachment,
      fileName: `ticket-${ticketId}.html`,
      ticketId 
    };

  } catch (err) {
    console.error(`[Transcript] Falha no ticket #${ticketId}:`, err.message);
    return null;
  }
}
