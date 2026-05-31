import discordTranscripts from "discord.js-html-transcript";
import { Octokit } from "@octokit/rest";
import { Base64 } from "js-base64";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO || "bot-transcripts";
const BRANCH = "main";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

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

        const content = attachment.toString("utf-8");
        const path = `transcripts/ticket-${ticketId}.html`;
        const message = `Transcript Ticket #${ticketId} — ${channel.guild.name}`;

        let sha;
        try {
            const { data } = await octokit.rest.repos.getContent({
                owner: OWNER, repo: REPO, path, ref: BRANCH,
            });
            sha = data.sha;
        } catch (e) {
            sha = undefined;
        }

        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER, repo: REPO, path, message,
            content: Base64.encode(content), sha, branch: BRANCH,
        });

        await updateIndex(ticketId, channel.guild.name);

        const pagesUrl = `https://${OWNER}.github.io/${REPO}/transcripts/ticket-${ticketId}.html`;
        return { url: pagesUrl, githubUrl: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${path}`, ticketId };

    } catch (err) {
        console.error(`[Transcript] Falha no ticket #${ticketId}:`, err.message);
        return null;
    }
}

async function updateIndex(ticketId, guildName) {
    try {
        const indexPath = "index.html";
        let existingContent = "";
        let sha;

        try {
            const { data } = await octokit.rest.repos.getContent({
                owner: OWNER, repo: REPO, path: indexPath, ref: BRANCH,
            });
            existingContent = Buffer.from(data.content, "base64").toString("utf-8");
            sha = data.sha;
        } catch (e) {
            existingContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>PAC Transcripts</title>
<style>body{font-family:Arial,sans-serif;background:#1a1a2e;color:#eee;padding:40px}h1{color:#5865F2}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:12px;text-align:left;border-bottom:1px solid #333}th{background:#5865F2}a{color:#00d4aa;text-decoration:none}a:hover{text-decoration:underline}</style>
</head><body><h1>Portugal Alfa Community - Transcripts</h1>
<table><thead><tr><th>Ticket ID</th><th>Servidor</th><th>Data</th><th>Link</th></tr></thead><tbody></tbody></table></body></html>`;
        }

        const now = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });
        const newRow = `            <tr><td>#${ticketId}</td><td>${guildName}</td><td>${now}</td><td><a href="transcripts/ticket-${ticketId}.html" target="_blank">Ver Transcript</a></td></tr>`;
        const tbodyEnd = existingContent.indexOf("</tbody>");
        const newContent = existingContent.slice(0, tbodyEnd) + newRow + "\n" + existingContent.slice(tbodyEnd);

        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER, repo: REPO, path: indexPath,
            message: `Update index - Ticket #${ticketId}`,
            content: Base64.encode(newContent), sha, branch: BRANCH,
        });
    } catch (err) {
        console.error("[Transcript] Erro ao atualizar indice:", err.message);
    }
}
