import { ChannelType } from "discord.js";
import { ASSISTANT_CONFIG } from "../config/index.js";
import { assistantMemory } from "../services/ajuda.js";

export class MessageAnalyzer {
    constructor(client) {
        this.client = client;
    }

    async fetchExpertHistory(guild, userId, limit = 200) {
        const history = [];
        const textChannels = guild.channels.cache.filter(
            c => c.type === ChannelType.GuildText
        );

        for (const [, channel] of textChannels) {
            try {
                const messages = await channel.messages.fetch({ limit: 100 });
                const expertMsgs = messages.filter(m => m.author.id === userId);

                expertMsgs.forEach(msg => {
                    const allMsgs = Array.from(messages.values())
                        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                    const idx = allMsgs.findIndex(m => m.id === msg.id);

                    const context = [];
                    if (idx > 0) {
                        context.push({
                            author: allMsgs[idx-1].author.username,
                            content: allMsgs[idx-1].content
                        });
                    }
                    context.push({
                        author: msg.author.username,
                        content: msg.content
                    });

                    history.push({
                        content: msg.content,
                        channel: channel.name,
                        timestamp: msg.createdTimestamp,
                        context,
                        hasLinks: this.extractLinks(msg.content),
                        isHelpful: this.isHelpfulMessage(msg.content)
                    });
                });
            } catch (e) {
                console.log(`Erro ao buscar ${channel.name}:`, e.message);
            }
        }

        history.sort((a, b) => b.timestamp - a.timestamp);
        assistantMemory.diegoHistory = history.slice(0, limit);
        return assistantMemory.diegoHistory;
    }

    extractLinks(content) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return content.match(urlRegex) || [];
    }

    isHelpfulMessage(content) {
        const helpIndicators = [
            "podes", "posso", "ajuda", "configurar", "instalar",
            "link", "vídeo", "tutorial", "faz assim", "tenta",
            "precisas de", "baixa", "download", "mod", "plugin",
            "usa", "experimenta", "tens que", "deves", "recomendo"
        ];
        return helpIndicators.some(word => content.toLowerCase().includes(word));
    }

    findSimilarResponses(question) {
        const history = assistantMemory.diegoHistory;
        if (history.length === 0) return [];

        const questionLower = question.toLowerCase();
        const qWords = questionLower.split(/\s+/).filter(w => w.length > 3);

        const scored = history.map(h => {
            let score = 0;
            const contentLower = h.content.toLowerCase();

            qWords.forEach(word => {
                if (contentLower.includes(word)) score += 3;
            });

            if (h.isHelpful) score += 5;
            if (h.hasLinks.length > 0) score += 4;

            h.context.forEach(ctx => {
                qWords.forEach(word => {
                    if (ctx.content.toLowerCase().includes(word)) score += 2;
                });
            });

            return { ...h, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.filter(s => s.score > 5).slice(0, 3);
    }
}
