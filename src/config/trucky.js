import { CONFIG } from "./config.js";

// ============================================================
// CONFIGURAÇÃO TRUCKY VTC - Portugal Alfa Truckers
// ============================================================
// Company ID: 46961
// Página: https://hub.truckyapp.com/vtc/truckycompanyy
// ============================================================

export const TRUCKY_CONFIG = {
    // --- API Trucky ---
    companyId: "46961",
    accessToken: "COLOCAR_TOKEN_AQUI",  // ← Obter no Trucky: Company Settings → API → Claim Token

    baseURL: "https://api.truckyapp.com/v2",

    // --- Canais Discord ---
    channels: {
        staff: "1146441860462690445",      // #staff
        geral: "1200170007418642502",      // #geral
        jornalPat: "1201616183435215008",  // #jornal-pat
    },

    // --- Cargos de Staff (protegidos, nunca removidos) ---
    staffRoles: [
        "1200459899583336458",  // CARGO_STAFF
    ],

    // --- Cargos de Membro VTC (removidos na limpeza) ---
    // Adiciona aqui o cargo de "Membro VTC" se tiveres
    vtcMemberRole: null,  // "ID_CARGO_MEMBRO_VTC" quando criares

    // --- Sistema de Patentes (DESATIVADO - não tens cargos no Discord) ---
    // Para ativar, cria os cargos no Discord e preenche os IDs aqui
    patentes: [],

    // --- Configurações de Inatividade ---
    inatividade: {
        diasAviso: 15,      // Aviso após X dias sem cargas
        diasLimpeza: 30,    // Considerado inativo após X dias
        kmMinimoMes: 0,     // KM mínimo por mês (0 = desativado)
    },

    // --- Mapa ---
    mapa: {
        atualizarMinutos: 5,  // Intervalo de atualização do mapa-canal
        jogoPadrao: "ets2",   // ets2 ou ats
    },

    // --- Templates de Imagem ---
    templates: {
        padrao: "template-padrao.png",
        fonte: "Arturo-Bold.ttf",
    },
};

// Helper: verifica se um membro é staff
export function isStaff(member) {
    return member.roles.cache.some(role => 
        TRUCKY_CONFIG.staffRoles.includes(role.id)
    );
}

// Helper: verifica se um membro tem cargo de staff pat
export function isStaffPat(member) {
    return member.roles.cache.some(role => 
        TRUCKY_CONFIG.staffRoles.includes(role.id)
    );
}
