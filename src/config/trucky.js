import { CONFIG } from "./index.js";

// ============================================================
// CONFIGURACAO TRUCKY VTC - Portugal Alfa Truckers
// ============================================================
// Company ID: 46961
// Pagina: https://hub.truckyapp.com/vtc/truckycompanyy
// ============================================================

export const TRUCKY_CONFIG = {
  // --- API Trucky ---
  companyId: "46961",
  accessToken: process.env.TRUCKY_ACCESS_TOKEN || "", // Token do Trucky (Company Settings -> API -> Claim Token)

  baseURL: "https://api.truckyapp.com/v2",

  // --- Canais Discord ---
  channels: {
    staff: "1146441860462690445",
    geral: "1200170007418642502",
    jornalPat: "1201616183435215008",
    logs: "1457144182954266634",
  },

  // --- Cargos de Staff (protegidos, nunca removidos) ---
  staffRoles: [
    "1200459899583336458",
  ],

  // --- Cargos de Membro VTC ---
  vtcMemberRole: null,

  // --- Sistema de Patentes ---
  patentes: [],

  // --- Configuracoes de Inatividade ---
  inatividade: {
    verificacaoAuto: false,
    diaVerificacao: 0,
    horaVerificacao: "20:00",
    diasAviso: 15,
    diasLimite: 30,
    diasLimpeza: 30,
    kmMinimoMes: 0,
  },

  // --- Mapa ---
  mapa: {
    atualizarMinutos: 5,
    jogoPadrao: "ets2",
  },

  // --- Templates de Imagem ---
  templates: {
    padrao: "template-padrao.png",
    fonte: "Arturo-Bold.ttf",
  },

  // --- Cores ---
  cores: {
    sucesso: 0x00ff00,
    perigo: 0xff0000,
    aviso: 0xffa500,
    info: 0x262af1,
  },

  // --- Roles de Recrutamento ---
  roles: {
    recrutamento: ["1200459899583336458"],
  },
};

// Helper: verifica se um membro e staff
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
