import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { AttachmentBuilder } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// PATHS
// ============================================
const ASSETS_DIR = path.join(__dirname, "../../assets");
const FONTS_DIR = path.join(ASSETS_DIR, "fonts");
const TEMPLATE_PATH = path.join(ASSETS_DIR, "template-padrao.png");

// ============================================
// DIAGNOSTICO NO ARRANQUE
// ============================================
console.log("[ImageGen] ========== DIAGNOSTICO ==========");
console.log("[ImageGen] __dirname:", __dirname);
console.log("[ImageGen] ASSETS_DIR:", ASSETS_DIR);
console.log("[ImageGen] TEMPLATE_PATH:", TEMPLATE_PATH);

try {
    const assetsFiles = fs.readdirSync(ASSETS_DIR);
    console.log("[ImageGen] Ficheiros em src/assets:", assetsFiles.join(", "));
} catch (e) {
    console.error("[ImageGen] ERRO: Pasta src/assets nao existe!", e.message);
}

try {
    const fontFiles = fs.readdirSync(FONTS_DIR);
    console.log("[ImageGen] Ficheiros em src/assets/fonts:", fontFiles.join(", "));
} catch (e) {
    console.error("[ImageGen] ERRO: Pasta src/assets/fonts nao existe!", e.message);
}

console.log("[ImageGen] Template existe?", fs.existsSync(TEMPLATE_PATH));
console.log("[ImageGen] ========================================");

// ============================================
// FONTES
// ============================================
let FONT_FAMILY = "Impact";
try {
    const arturoPath = path.join(FONTS_DIR, "Arturo.ttf");
    if (fs.existsSync(arturoPath)) {
        GlobalFonts.registerFromPath(arturoPath, "Arturo");
        FONT_FAMILY = "Arturo";
        console.log("[ImageGen] Fonte Arturo carregada com sucesso!");
    } else {
        console.log("[ImageGen] Arturo.ttf nao encontrado, usando Impact");
    }
} catch (e) {
    console.error("[ImageGen] ERRO ao carregar fonte:", e.message);
}

// ============================================
// GERAR FOTO DE MEMBRO
// ============================================

export async function gerarFotoMembro(nome, options = {}) {
    console.log("[ImageGen] gerarFotoMembro() chamado para:", nome);
    
    const {
        corTexto = "#FFFFFF",
        efeito = "outline",
        tamanhoFonte = null,
    } = options;

    let canvas, ctx;
    let templateLoaded = false;
    let templateWidth = 500;
    let templateHeight = 500;

    // Tenta carregar template
    try {
        if (fs.existsSync(TEMPLATE_PATH)) {
            console.log("[ImageGen] A carregar template...");
            const template = await loadImage(TEMPLATE_PATH);
            templateWidth = template.width;
            templateHeight = template.height;
            canvas = createCanvas(templateWidth, templateHeight);
            ctx = canvas.getContext("2d");
            ctx.drawImage(template, 0, 0);
            templateLoaded = true;
            console.log("[ImageGen] Template carregado:", templateWidth, "x", templateHeight);
        } else {
            console.log("[ImageGen] Template nao encontrado em:", TEMPLATE_PATH);
        }
    } catch (e) {
        console.error("[ImageGen] ERRO ao carregar template:", e.message);
    }

    // Fallback: imagem gerada do zero
    if (!templateLoaded) {
        console.log("[ImageGen] A usar fallback (sem template)");
        canvas = createCanvas(500, 500);
        ctx = canvas.getContext("2d");
        
        const gradient = ctx.createLinearGradient(0, 0, 500, 500);
        gradient.addColorStop(0, "#1a1a2e");
        gradient.addColorStop(0.5, "#16213e");
        gradient.addColorStop(1, "#0f3460");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 500, 500);

        ctx.strokeStyle = "#e94560";
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, 480, 480);
    }

    try {
        // Texto
        let fontSize = tamanhoFonte || 72;
        ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const centerX = templateWidth / 2;
        const centerY = templateHeight / 2;
        const maxWidth = templateLoaded ? 280 : 400;

        while (ctx.measureText(nome).width > maxWidth && fontSize > 24) {
            fontSize -= 4;
            ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
        }

        // Efeitos
        if (efeito === "outline") {
            ctx.lineWidth = Math.max(fontSize * 0.12, 4);
            ctx.strokeStyle = "#000000";
            ctx.lineJoin = "round";
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

        console.log("[ImageGen] A gerar PNG...");
        const buffer = await canvas.encode("png");
        console.log("[ImageGen] PNG gerado! Tamanho:", buffer.length, "bytes");
        
        return new AttachmentBuilder(buffer, { 
            name: `pat-${nome.toLowerCase().replace(/\s+/g, "-")}.png` 
        });
    } catch (e) {
        console.error("[ImageGen] ERRO ao gerar imagem:", e.message);
        console.error("[ImageGen] Stack:", e.stack);
        throw e;
    }
}

// ============================================
// GERAR FOTO DE PATENTE
// ============================================

export async function gerarFotoPatente(nome, patente, km, kmProxima) {
    console.log("[ImageGen] gerarFotoPatente() chamado");
    
    let template;
    try {
        if (fs.existsSync(TEMPLATE_PATH)) {
            template = await loadImage(TEMPLATE_PATH);
        }
    } catch (e) {
        console.log("[ImageGen] Template nao disponivel para patente");
    }

    const w = template ? template.width : 500;
    const h = template ? template.height : 500;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");

    if (template) {
        ctx.drawImage(template, 0, 0);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, "#0d1b2a");
        gradient.addColorStop(1, "#415a77");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    // Nome
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
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(nome, w/2, h*0.42);

    // Patente
    fontSize = 32;
    ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    ctx.fillStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(patente, w/2, h*0.55);
    ctx.fillText(patente, w/2, h*0.55);

    // KM
    fontSize = 22;
    ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`${Math.round(km).toLocaleString("pt-PT")} km`, w/2, h*0.65);

    // Barra progresso
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
        ctx.fillText("Patente Maxima!", w/2, h*0.75);
    }

    const buffer = await canvas.encode("png");
    return new AttachmentBuilder(buffer, { 
        name: `patente-${nome.toLowerCase().replace(/\s+/g, "-")}.png` 
    });
}

// ============================================
// VERIFICACAO
// ============================================

export function verificarTemplate() {
    return fs.existsSync(TEMPLATE_PATH);
}

export function getTemplatePath() {
    return TEMPLATE_PATH;
}
