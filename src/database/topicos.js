// ==================== TÓPICOS PERMITIDOS ====================
export const TOPICOS_PERMITIDOS = [
    "ets2", "ats", "euro truck", "american truck", "truck", "camião", "camiao",
    "trucky", "vtc", "comboio", "convoy", "servidor", "server", "mp", "multiplayer",
    "truckersmp", "mod", "mods", "modding", "skin", "paint", "dlc", "mapa",
    "ets2la", "lane assist", "la", "ets2 la", "configurar", "instalar", "tutorial",
    "recrutamento", "pat", "portugal alfa", "pac", "ranking", "km", "quilometros",
    "regras", "rules", "ban", "kick", "report", "denuncia", "bug", "problema",
    "crash", "lag", "fps", "grafico", "graficos", "wheel", "volante", "g29", "g920",
    "shifter", "manual", "automatico", "scania", "volvo", "mercedes", "man", "daf",
    "iveco", "renault", "promods", "tsl", "steam", "workshop", "save", "perfil",
    "economia", "empresa", "motor", "transmissao", "suspensao", "pneu", "roda",
    "camera", "camara", "câmara", "console", "developer", "desenvolvedor", "zero",
    "developer camera", "fly cam", "free cam"
];

export function isTopicoPermitido(pergunta) {
    const p = pergunta.toLowerCase();
    return TOPICOS_PERMITIDOS.some(t => p.includes(t));
}
