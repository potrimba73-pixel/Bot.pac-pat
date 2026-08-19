// src/assistant/analyzer.js
import { ChannelType, PermissionsBitField } from "discord.js";
import { ASSISTANT_CONFIG } from "../config/index.js";
import { assistantMemory } from "../services/ajuda.js";

const HISTORY_CACHE_TTL = 3600000; // 1 hora
let lastHistoryFetch = 0;

export class MessageAnalyzer {
    constructor(client) {
        this.client = client;
        this.rateLimitQueue = [];
    }

    async rateLimitDelay() {
        const now = Date.now();
        this.rateLimitQueue = this.rateLimitQueue.filter(t => now - t < 1000);
        if (this.rateLimitQueue.length >= 5) {
            await new Promise(r => setTimeout(r, 1000));
        }
        this.rateLimitQueue.push(now);
    }

    async fetchExpertHistory(guild, userId, limit = 50) {
        if (Date.now() - lastHistoryFetch < HISTORY_CACHE_TTL && assistantMemory.diegoHistory?.length > 0) {
            return assistantMemory.diegoHistory;
        }

        const history = [];
        const textChannels = guild.channels.cache.filter(
            c => c.type === ChannelType.GuildText && 
                 c.permissionsFor(this.client.user)?.has(PermissionsBitField.Flags.ViewChannel)
        );

        const channelsToFetch = Array.from(textChannels.values()).slice(0, 10);

        for (const channel of channelsToFetch) {
            try {
                await this.rateLimitDelay();
                if (!channel.permissionsFor(this.client.user)?.has(PermissionsBitField.Flags.ReadMessageHistory)) {
                    continue;
                }
                const messages = await channel.messages.fetch({ limit: 100 });
                const expertMsgs = messages.filter(m => m.author.id === userId && m.content.length > 10);

                expertMsgs.forEach(msg => {
                    const allMsgs = Array.from(messages.values())
                        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                    const idx = allMsgs.findIndex(m => m.id === msg.id);

                    const context = [];
                    if (idx > 0) {
                        context.push({
                            author: allMsgs[idx-1].author.username,
                            content: allMsgs[idx-1].content.substring(0, 200)
                        });
                    }
                    context.push({
                        author: msg.author.username,
                        content: msg.content.substring(0, 500)
                    });

                    history.push({
                        content: msg.content.substring(0, 500),
                        channel: channel.name,
                        timestamp: msg.createdTimestamp,
                        context,
                        hasLinks: this.extractLinks(msg.content),
                        isHelpful: this.isHelpfulMessage(msg.content)
                    });
                });
            } catch (e) {
                if (e.code !== 50001 && e.code !== 50013) {
                    console.log(`[Analyzer] Erro em ${channel.name}:`, e.message);
                }
            }
        }

        history.sort((a, b) => b.timestamp - a.timestamp);
        assistantMemory.diegoHistory = history.slice(0, limit);
        lastHistoryFetch = Date.now();
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
        if (!history || history.length === 0) return [];

        const questionLower = question.toLowerCase();
        const qWords = questionLower.split(/\s+/).filter(w => w.length > 3);
        if (qWords.length === 0) return [];

        const scored = history.map(h => {
            let score = 0;
            const contentLower = h.content.toLowerCase();

            qWords.forEach(word => {
                if (contentLower.includes(word)) score += 3;
            });

            if (h.isHelpful) score += 5;
            if (h.hasLinks.length > 0) score += 4;

            // Palavras específicas (câmara, console, etc.)
            const specificWords = ["camara", "camera", "console", "developer", "config.cfg", "numpad", "0", "teletransportar", "ctrl f9", "project alm", "insanux"];
            specificWords.forEach(word => {
                if (questionLower.includes(word) && contentLower.includes(word)) {
                    score += 15;
                }
            });

            h.context.forEach(ctx => {
                qWords.forEach(word => {
                    if (ctx.content.toLowerCase().includes(word)) score += 2;
                });
            });

            return { ...h, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.filter(s => s.score > 3).slice(0, 3);
    }
}
