import { createCanvas, loadImage, registerFont } from "canvas";
import { AttachmentBuilder } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONTS_DIR = path.join(__dirname, "../../assets/fonts");
const TEMPLATES_DIR = path.join(__dirname, "../../assets");

let FONT_FAMILY = "Impact";
try {
    const arturoPath = path.join(FONTS_DIR, "Arturo-Bold.ttf");
    if (fs.existsSync(arturoPath)) {
        registerFont(arturoPath, { family: "Arturo", weight: "bold" });
        FONT_FAMILY = "Arturo";
        console.log("[ImageGen] Fonte Arturo-Bold carregada!");
    }
} catch (e) {
    console.log("[ImageGen] Arturo nao encontrada, usando Impact");
}

const TEMPLATES = {
    padrao: path.join(TEMPLATES_DIR, "template-padrao.png"),
};

export async function gerarFotoMembro(nome, options = {}) {
    const {
        corTexto = "#FFFFFF",
        efeito = "outline",
        tamanhoFonte = null,
    } = options;

    const templatePath = TEMPLATES.padrao;
    let template;

    try {
        template = await loadImage(templatePath);
    } catch (e) {
        console.error("[ImageGen] Template nao encontrado:", templatePath);
        throw new Error("Template nao encontrado. Coloca 'template-padrao.png' em src/assets/");
    }

    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(template, 0, 0);

    const centerX = template.width / 2;
    const centerY = template.height / 2;

    let fontSize = tamanhoFonte || 72;
    ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxWidth = 280;
    while (ctx.measureText(nome).width > maxWidth && fontSize > 24) {
        fontSize -= 4;
        ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    }

    if (efeito === "outline") {
        ctx.lineWidth = Math.max(fontSize * 0.12, 4);
        ctx.strokeStyle = "#000000";
        ctx.lineJoin = "round";
        ctx.strokeText(nome, centerX, centerY);

        ctx.lineWidth = Math.max(fontSize * 0.06, 2);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.strokeText(nome, centerX, centerY);

    } else if (efeito === "shadow") {
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
    } else if (efeito === "glow") {
        ctx.shadowColor = corTexto;
        ctx.shadowBlur = 15;
    }

    ctx.fillStyle = corTexto;
    ctx.fillText(nome, centerX, centerY);
    ctx.shadowColor = "transparent";

    const buffer = canvas.toBuffer("image/png");
    return new AttachmentBuilder(buffer, { 
        name: `pat-${nome.toLowerCase().replace(/\s+/g, "-")}.png` 
    });
}

export async function gerarFotoPatente(nome, patente, km, kmProxima) {
    const templatePath = TEMPLATES.padrao;
    let template;

    try {
        template = await loadImage(templatePath);
    } catch (e) {
        throw new Error("Template nao encontrado");
    }

    const w = template.width;
    const h = template.height;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(template, 0, 0);

    let fontSize = 60;
    ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    while (ctx.measureText(nome).width > 260 && fontSize > 24) {
        fontSize -= 4;
        ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    }

    ctx.lineWidth = Math.max(fontSize * 0.12, 4);
    ctx.strokeStyle = "#000000";
    ctx.lineJoin = "round";
    ctx.strokeText(nome, w/2, h*0.42);
    ctx.lineWidth = Math.max(fontSize * 0.06, 2);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.strokeText(nome, w/2, h*0.42);

    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(nome, w/2, h*0.42);

    fontSize = 32;
    ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    ctx.fillStyle = "#FFD700";

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(patente, w/2, h*0.55);
    ctx.fillText(patente, w/2, h*0.55);

    fontSize = 22;
    ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`${Math.round(km).toLocaleString("pt-PT")} km`, w/2, h*0.65);

    if (kmProxima > 0) {
        const progresso = Math.min(km / kmProxima, 1);
        const barWidth = 200;
        const barHeight = 12;
        const barX = w/2 - barWidth/2;
        const barY = h * 0.72;

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = "#FFD700";
        ctx.fillRect(barX, barY, barWidth * progresso, barHeight);

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        fontSize = 16;
        ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`${Math.round(progresso * 100)}%`, w/2, h*0.78);
    } else {
        fontSize = 24;
        ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
        ctx.fillStyle = "#FFD700";
        ctx.fillText("🏆 Patente Maxima!", w/2, h*0.75);
    }

    const buffer = canvas.toBuffer("image/png");
    return new AttachmentBuilder(buffer, { 
        name: `patente-${nome.toLowerCase().replace(/\s+/g, "-")}.png` 
    });
}

export function verificarTemplate() {
    return fs.existsSync(TEMPLATES.padrao);
}
