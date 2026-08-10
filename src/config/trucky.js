// ✅ CORREÇÃO: ADICIONAR PATENTES E CONFIGURAÇÕES
export const TRUCKY_CONFIG = {
  // --- API Trucky ---
  companyId: "46961",
  accessToken: process.env.TRUCKY_ACCESS_TOKEN || "",

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
  // ✅ CORREÇÃO: UNIFICAR NOMES
  vtcMemberRole: "ID_DO_CARGO_MEMBRO_VTC",

  // --- Sistema de Patentes ---
  // ✅ CORREÇÃO: ADICIONAR PATENTES REAIS
  patentes: [
    { nome: "Motorista", kmMin: 0, kmMax: 10000, cargoDiscord: "ID_CARGO_MOTORISTA" },
    { nome: "Motorista Sénior", kmMin: 10000, kmMax: 25000, cargoDiscord: "ID_CARGO_SENIOR" },
    { nome: "Especialista", kmMin: 25000, kmMax: 50000, cargoDiscord: "ID_CARGO_ESPECIALISTA" },
    { nome: "Mestre", kmMin: 50000, kmMax: 100000, cargoDiscord: "ID_CARGO_MESTRE" },
    { nome: "Lenda", kmMin: 100000, kmMax: Infinity, cargoDiscord: "ID_CARGO_LENDA" },
  ],
  cargosBase: [
    { nome: "Recruta", kmMax: 0, cargoDiscord: "ID_CARGO_RECRUTA" }
  ],

  // --- Configuracoes de Inatividade ---
  inatividade: {
    verificacaoAuto: true, // ✅ ATIVAR
    diaVerificacao: 0, // Domingo
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
    pat: 0x262af1,
    trucky: 0x3498db,
  },

  // --- Roles de Recrutamento ---
  roles: {
    recrutamento: ["1200459899583336458"],
  },
};

// ✅ CORREÇÃO: HELPER PARA STAFF
export function isStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageRoles)) return true;
  return member.roles?.cache?.some(role =>
    TRUCKY_CONFIG.staffRoles.includes(role.id)
  ) || false;
}
