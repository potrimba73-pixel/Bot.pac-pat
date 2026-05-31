// ==================== PAC TUTORIAIS DATABASE ====================
export const PAC_TUTORIAIS = {
    "camera_zero": {
        keywords: ["camara", "camera", "câmara", "zero", "0", "developer", "desenvolvedor", "console", "modo desenvolvedor", "ativar", "como ativar", "usar", "como usar", "teletransportar", "teleportar"],
        titulo: "📹 Como Ativar a Câmara Zero no ETS2",
        resumo: `Para ativar a câmara zero no ETS2, precisas de ativar o Modo Desenvolvedor:

` +
                `**1.** Vai a: Documentos > Euro Truck Simulator 2
` +
                `**2.** Abre o ficheiro **config.cfg** com o Bloco de Notas
` +
                `**3.** Procura por:
` +
                `\`\`\`
uset_g_developer "0"
uset_g_console "0"
\`\`\`
` +
                `**4.** Altera para:
` +
                `\`\`\`
uset_g_developer "1"
uset_g_console "1"
\`\`\`
` +
                `**5.** Guarda e fecha o ficheiro

` +
                `**No jogo:**
` +
                `• Pressiona a tecla **0** (acima das letras) para ativar a câmera
` +
                `• Usa o **Numpad** para movimentar a câmera

` +
                `📖 **Tutorial completo:** Veja o tutorial do Diego gamer na secção TUTORIAIS do Discord`,
        autor: "Diego gamer",
        canal: "TUTORIAIS"
    },
    "servidor_vagas": {
        keywords: ["vagas", "128", "comboio", "servidor", "lotacao", "lotado", "entrar", "liberar", "aumentar", "slots", "maximo", "jogadores", "limite"],
        titulo: "🚛 Como Liberar 128 Vagas no Comboio",
        resumo: `Para liberar 128 vagas no servidor da PAC:

` +
                `**1.** Localiza o ficheiro **config.cfg** nos Documentos > Euro Truck Simulator 2
` +
                `**2.** Procura pela linha: \`\`\`uset g_max_convoy_size "8"\`\`\`
` +
                `**3.** Altera para: \`\`\`uset g_max_convoy_size "128"\`\`\`
` +
                `**4.** Guarda o ficheiro e reinicia o jogo
` +
                `**5.** Entra no servidor da PAC e convida os amigos!

` +
                `📺 **Vídeo tutorial:** Veja o tutorial na secção TUTORIAIS do Discord
` +
                `📖 **Autor:** Diego gamer`,
        autor: "Diego gamer",
        canal: "TUTORIAIS"
    },
    "project_alm": {
        keywords: ["project alm", "project: alm", "alm", "mod", "project", "insanux", "rgb", "scania", "instalar", "como instalar", "instalação", "vidro", "autocolantes", "led", "mods locais"],
        titulo: "🎨 Como Instalar o Project ALM + RGB da Scania",
        resumo: `Para instalar o Project ALM e ativar o RGB:

` +
                `**1.** Faz download do mod no site oficial: https://insanux.com/
` +
                `**2.** Coloca o ficheiro na pasta **mod** do ETS2
` +
                `**3.** Ativa no gestor de mods antes de entrar no jogo
` +
                `**4.** No jogo, configura o RGB através do menu do mod

` +
                `📺 **Vídeo tutorial:** [YouTube](https://youtu.be/E9zk5bFRjYU)
` +
                `📖 **Tutorial completo:** Veja o tutorial do Diego gamer na secção TUTORIAIS do Discord`,
        autor: "Diego gamer",
        canal: "TUTORIAIS"
    },
    "project_alm_insanux": {
        keywords: ["project alm insanux", "insanux", "alm do insanux", "project insanux", "download insanux", "site insanux"],
        titulo: "🎨 Como Instalar o Project: ALM do Insanux",
        resumo: `Para instalar o Project ALM do Insanux:

` +
                `**1.** Acede ao site oficial: https://insanux.com/
` +
                `**2.** Faz download do mod Project ALM
` +
                `**3.** Extrai o ficheiro para a pasta **mod** do ETS2
` +
                `**4.** Ativa o mod no gestor de mods antes de iniciar o jogo

` +
                `📺 **Vídeo tutorial:** [YouTube](https://youtu.be/59G2ShBJAI1)
` +
                `📖 **Tutorial completo:** Veja o tutorial do Diego gamer na secção TUTORIAIS do Discord`,
        autor: "Diego gamer",
        canal: "TUTORIAIS"
    },
    "trucky": {
        keywords: ["trucky", "app", "instalar", "tracker", "logbook", "registo", "km", "quilometros", "download", "usar", "como usar"],
        titulo: "📲 Como Usar o Trucky App",
        resumo: `O Trucky é essencial para a PAT:

` +
                `**1.** Faz download em [truckyapp.com](https://truckyapp.com)
` +
                `**2.** Liga à tua conta Steam
` +
                `**3.** Regista as viagens automaticamente
` +
                `**4.** Cumpre os 15.000 KM/mês

` +
                `💡 Sem o Trucky não é possível fazer parte da Portugal Alfa Truckers!`,
        autor: "Staff PAC",
        canal: "RECRUTAMENTO"
    },
    "ets2la": {
        keywords: ["ets2la", "lane assist", "la", "ets2 la", "configurar", "instalar", "como instalar", "como configurar", "automatico", "piloto automatico"],
        titulo: "⚙️ Como Configurar o ETS2LA",
        resumo: `Para configurar o ETS2LA (Lane Assist):

` +
                `**1.** Verifica se tens a versão mais recente
` +
                `**2.** Alguns mods do TruckersMP podem não ser compatíveis
` +
                `**3.** Aguarda atualizações após updates do jogo

` +
                `📺 **Tutorial:** [VR Tutoriais Marco Pereira](https://youtu.be/mDBtpdlwGms)

` +
                `⚠️ Nota: A configuração base é explicada no vídeo acima.`,
        autor: "Marco Pereira",
        canal: "TUTORIAIS"
    },
    "vr": {
        keywords: ["vr", "quest", "meta", "oculos", "realidade virtual", "quest 3", "quest 3s", "configurar", "instalar", "como configurar", "como jogar"],
        titulo: "🥽 VR no ETS2 - Meta Quest",
        resumo: `Para jogar ETS2 em VR com Meta Quest:

` +
                `**1.** Segue o tutorial: [VR Tutoriais Marco Pereira](https://youtu.be/mDBtpdlwGms)
` +
                `**2.** Configura o SteamVR ou Oculus Link
` +
                `**3.** Ajusta as definições gráficas para performance

` +
                `💡 A configuração do Diego é baseada neste vídeo!`,
        autor: "Marco Pereira",
        canal: "TUTORIAIS"
    }
};

export function encontrarTutorialPAC(pergunta) {
    const p = pergunta.toLowerCase();
    let melhorMatch = null;
    let melhorScore = 0;

    for (const [key, data] of Object.entries(PAC_TUTORIAIS)) {
        let score = 0;
        data.keywords.forEach(kw => {
            if (p.includes(kw.toLowerCase())) score += 10;
        });
        if (score > melhorScore) {
            melhorScore = score;
            melhorMatch = data;
        }
    }

    if (melhorMatch && melhorScore >= 10) {
        return melhorMatch;
    }
    return null;
}
