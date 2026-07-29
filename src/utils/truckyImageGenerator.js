import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { AttachmentBuilder } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// TENTAR VÁRIOS CAMINHOS PARA OS ASSETS
// ============================================
function encontrarAsset(nomeFicheiro) {
    const caminhosPossiveis = [
        path.join(__dirname, "../../assets", nomeFicheiro),
        path.join(__dirname, "../assets", nomeFicheiro),
        path.join(process.cwd(), "src/assets", nomeFicheiro),
        path.join(process.cwd(), "assets", nomeFicheiro),
        path.join("/app/src/assets", nomeFicheiro),
        path.join("/app/assets", nomeFicheiro),
    ];
    
    for (const caminho of caminhosPossiveis) {
        if (fs.existsSync(caminho)) {
            console.log(`[ImageGen] Encontrado ${nomeFicheiro} em:`, caminho);
            return caminho;
        }
    }
    
    console.error(`[ImageGen] ${nomeFicheiro} NAO encontrado!`);
    return null;
}

// ============================================
// DIAGNOSTICO
// ============================================
console.log("[ImageGen] ========== DIAGNOSTICO ==========");
console.log("[ImageGen] __dirname:", __dirname);
console.log("[ImageGen] process.cwd():", process.cwd());

try {
    const cwdFiles = fs.readdirSync(process.cwd());
    console.log("[ImageGen] Ficheiros na raiz:", cwdFiles.join(", "));
} catch (e) {
    console.error("[ImageGen] Erro ao listar raiz:", e.message);
}

try {
    const srcPath = path.join(process.cwd(), "src");
    if (fs.existsSync(srcPath)) {
        console.log("[ImageGen] Ficheiros em src/:", fs.readdirSync(srcPath).join(", "));
    }
} catch (e) {}

const TEMPLATE_PATH = encontrarAsset("template-padrao.png");
const arturoPath = encontrarAsset("fonts/Arturo.ttf");

// ============================================
// FONTES
// ============================================
let FONT_FAMILY = "Impact";

if (arturoPath) {
    try {
        GlobalFonts.registerFromPath(arturoPath, "Arturo");
        FONT_FAMILY = "Arturo";
        console.log("[ImageGen] Fonte Arturo registada!");
    } catch (e) {
        console.error("[ImageGen] Erro ao registar Arturo:", e.message);
    }
} else {
    console.log("[ImageGen] Arturo nao encontrada, usando Impact");
}

console.log("[ImageGen] Fonte final:", FONT_FAMILY);
console.log("[ImageGen] Template:", TEMPLATE_PATH || "NAO ENCONTRADO");
console.log("[ImageGen] ========================================");

// ============================================
// GERAR FOTO DE MEMBRO
// ============================================

export async function gerarFotoMembro(nome, options = {}) {
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
    if (TEMPLATE_PATH) {
        try {
            const template = await loadImage(TEMPLATE_PATH);
            templateWidth = template.width;
            templateHeight = template.height;
            canvas = createCanvas(templateWidth, templateHeight);
            ctx = canvas.getContext("2d");
            ctx.drawImage(template, 0, 0);
            templateLoaded = true;
        } catch (e) {
            console.error("[ImageGen] Erro ao carregar template:", e.message);
        }
    }

    // Fallback
    if (!templateLoaded) {
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

    const buffer = await canvas.encode("png");
    return new AttachmentBuilder(buffer, { 
        name: `pat-${nome.toLowerCase().replace(/\s+/g, "-")}.png` 
    });
}

// ============================================
// GERAR FOTO DE PATENTE
// ============================================

export async function gerarFotoPatente(nome, patente, km, kmProxima) {
    let template;
    
    if (TEMPLATE_PATH) {
        try {
            template = await loadImage(TEMPLATE_PATH);
        } catch (e) {
            console.log("[ImageGen] Template nao disponivel para patente");
        }
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
// GERAR FOTO DE BOAS-VINDAS
// ============================================

export async function gerarFotoBoasVindas(nome, patente = "Novo Membro") {
    let template;
    
    if (TEMPLATE_PATH) {
        try {
            template = await loadImage(TEMPLATE_PATH);
        } catch (e) {
            console.log("[ImageGen] Template nao disponivel para boas-vindas");
        }
    }

    const w = template ? template.width : 500;
    const h = template ? template.height : 500;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");

    if (template) {
        ctx.drawImage(template, 0, 0);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, "#1a1a2e");
        gradient.addColorStop(1, "#0f3460");
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
    ctx.strokeText(nome, w/2, h*0.45);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(nome, w/2, h*0.45);

    // Patente
    fontSize = 28;
    ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    ctx.fillStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(patente, w/2, h*0.58);
    ctx.fillText(patente, w/2, h*0.58);

    // Texto
    fontSize = 18;
    ctx.font = `bold ${fontSize}px "${FONT_FAMILY}"`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Bem-vindo a Portugal Alfa!", w/2, h*0.70);

    const buffer = await canvas.encode("png");
    return new AttachmentBuilder(buffer, { 
        name: `boasvindas-${nome.toLowerCase().replace(/\s+/g, "-")}.png` 
    });
}

// ============================================
// VERIFICACAO
// ============================================

export function verificarTemplate() {
    return fs.existsSync(TEMPLATE_PATH || "");
}

export function getTemplatePath() {
    return TEMPLATE_PATH;
}
