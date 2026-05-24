import discordTranscripts from "discord-html-transcripts";

export async function gerarTranscript(channel, ticketId) {
    try {
        const attachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            returnType: "attachment",
            filename: `ticket-${ticketId}.html`,
            saveImages: true,
            poweredBy: false,
        });
        return attachment;
    } catch (err) {
        console.error("Erro ao gerar transcript:", err);
        return null;
    }
}
