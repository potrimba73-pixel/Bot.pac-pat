// ============================================
// CONFIG TRUCKY VTC - Portugal Alfa Truckers
// Company ID: 46961
// ============================================
import { CONFIG } from "./index.js";

export const TRUCKY_CONFIG = {
    companyId: "46961",
    accessToken: process.env.TRUCKY_ACCESS_TOKEN || "COLOCAR_TOKEN_AQUI",

    channels: {
        jornalPat: "1201616183435215008",   // #jornal-pat
        logs: CONFIG.CANAL_LOGS || "1457144182954266634",
        staff: "1146441860462690445",       // #staff
        geral: "1200170007418642502",       // #geral
        fotosMembros: "1204160547092697088",
    },

    roles: {
        recrutamento: [CONFIG.CARGO_RECRUTAMENTO_1, CONFIG.CARGO_RECRUTAMENTO_2].filter(Boolean),
    },

    staffRoles: [
        "1200459899583336458",  // CARGO_STAFF
    ],

    cargoMembroVTC: CONFIG.CARGO_MEMBRO || "ID_CARGO_MEMBRO_VTC",

    inatividade: {
        diasLimite: 30,
        diasAviso: 15,
        diasLimpeza: 7,
        verificacaoAuto: true,
        diaVerificacao: 0,
        horaVerificacao: "20:00"
    },

    patentes: [
        { nome: "Alfa Junior", kmMin: 50000, kmMax: 99999, cargoDiscord: "ID_CARGO_ALFA_JUNIOR" },
        { nome: "Especialista de Carga", kmMin: 100000, kmMax: 249999, cargoDiscord: "ID_CARGO_ESPECIALISTA" },
        { nome: "Senior PAT", kmMin: 250000, kmMax: 499999, cargoDiscord: "ID_CARGO_SENIOR" },
        { nome: "Veterano PAT", kmMin: 500000, kmMax: 999999, cargoDiscord: "ID_CARGO_VETERANO" },
        { nome: "Lenda da Estrada", kmMin: 1000000, kmMax: 999999999, cargoDiscord: "ID_CARGO_LENDA" }
    ],

    cargosBase: [
        { nome: "Motorista Estagiario", kmMax: 4999, cargoDiscord: "ID_CARGO_ESTAGIARIO" },
        { nome: "Motorista Profissional", kmMin: 5000, kmMax: 49999, cargoDiscord: "ID_CARGO_PROFISSIONAL" }
    ],

    cores: {
        sucesso: 0x00FF00,
        aviso: 0xFFA500,
        perigo: 0xFF0000,
        info: 0x0099FF,
        pat: 0xFFD700,
        trucky: 0x00B4D8
    },

    mapa: {
        atualizacaoAutomatica: true,
        intervaloMinutos: 5
    }
};
