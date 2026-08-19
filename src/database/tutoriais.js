// src/database/tutoriais.js
export const PAC_TUTORIAIS = {
    "camera_zero": {
        keywords: ["camara", "camera", "câmara", "zero", "0", "developer", "desenvolvedor", "console", "modo desenvolvedor", "ativar", "como ativar", "usar", "como usar", "teletransportar", "teleportar"],
        titulo: "📹 Como Ativar a Câmara Zero no ETS2",
        resumo: `Para ativar a câmara zero no ETS2, precisas de ativar o Modo Desenvolvedor:

**1.** Vai a: Documentos > Euro Truck Simulator 2
**2.** Abre o ficheiro **config.cfg** com o Bloco de Notas
**3.** Procura por:
\`\`\`
uset g_developer "0"
uset g_console "0"
\`\`\`
**4.** Altera para:
\`\`\`
uset g_developer "1"
uset g_console "1"
\`\`\`
**5.** Guarda e fecha o ficheiro

**No jogo:**
• Pressiona a tecla **0** (acima das letras) para ativar a câmera
• Usa o **Numpad** para movimentar a câmera

📖 **Tutorial completo:** Veja o tutorial do Diego gamer na secção TUTORIAIS do Discord`,
        autor: "Diego Gamer",
        canal: "TUTORIAIS"
    },
    "servidor_vagas": {
        keywords: ["vagas", "128", "comboio", "servidor", "lotacao", "lotado", "entrar", "liberar", "aumentar", "slots", "maximo", "jogadores", "limite"],
        titulo: "🚛 Como Liberar 128 Vagas no Comboio",
        resumo: `Para liberar 128 vagas no servidor da PAC:

**1.** Localiza o ficheiro **config.cfg** nos Documentos > Euro Truck Simulator 2
**2.** Procura pela linha: \`uset g_max_convoy_size "8"\`
**3.** Altera para: \`uset g_max_convoy_size "128"\`
**4.** Guarda o ficheiro e reinicia o jogo
**5.** Entra no servidor da PAC e convida os amigos!

📺 **Vídeo tutorial:** Veja o tutorial na secção TUTORIAIS do Discord
📖 **Autor:** Diego Gamer`,
        autor: "Diego Gamer",
        canal: "TUTORIAIS"
    },
    "project_alm": {
        keywords: ["project alm", "project: alm", "alm", "mod", "project", "insanux", "rgb", "scania", "instalar", "como instalar", "instalação", "vidro", "autocolantes", "led", "mods locais"],
        titulo: "🎨 Como Instalar o Project ALM + RGB da Scania",
        resumo: `Para instalar o Project ALM e ativar o RGB:

**1.** Faz download do mod no site oficial: https://insanux.com/
**2.** Coloca o ficheiro na pasta **mod** do ETS2
**3.** Ativa no gestor de mods antes de entrar no jogo
**4.** No jogo, configura o RGB através do menu do mod

📺 **Vídeo tutorial:** [YouTube](https://youtu.be/E9zk5bFRjYU)
📖 **Tutorial completo:** Veja o tutorial do Diego Gamer na secção TUTORIAIS do Discord`,
        autor: "Diego Gamer",
        canal: "TUTORIAIS"
    },
    "project_alm_insanux": {
        keywords: ["project alm insanux", "insanux", "alm do insanux", "project insanux", "download insanux", "site insanux"],
        titulo: "🎨 Como Instalar o Project: ALM do Insanux",
        resumo: `Para instalar o Project ALM do Insanux:

**1.** Acede ao site oficial: https://insanux.com/
**2.** Faz download do mod Project ALM
**3.** Extrai o ficheiro para a pasta **mod** do ETS2
**4.** Ativa o mod no gestor de mods antes de iniciar o jogo

📺 **Vídeo tutorial:** [YouTube](https://youtu.be/59G2ShBJAI1)
📖 **Tutorial completo:** Veja o tutorial do Diego Gamer na secção TUTORIAIS do Discord`,
        autor: "Diego Gamer",
        canal: "TUTORIAIS"
    },
    "trucky": {
        keywords: ["trucky", "app", "instalar", "tracker", "logbook", "registo", "km", "quilometros", "download", "usar", "como usar"],
        titulo: "📲 Como Usar o Trucky App",
        resumo: `O Trucky é essencial para a PAT:

**1.** Faz download em [truckyapp.com](https://truckyapp.com)
**2.** Liga à tua conta Steam
**3.** Regista as viagens automaticamente
**4.** Cumpre os 15.000 KM/mês

💡 Sem o Trucky não é possível fazer parte da Portugal Alfa Truckers!`,
        autor: "Staff PAC",
        canal: "RECRUTAMENTO"
    },
    "ets2la": {
        keywords: ["ets2la", "lane assist", "la", "ets2 la", "configurar", "instalar", "como instalar", "como configurar", "automatico", "piloto automatico"],
        titulo: "⚙️ Como Configurar o ETS2LA",
        resumo: `Para configurar o ETS2LA (Lane Assist):

**1.** Verifica se tens a versão mais recente
**2.** Alguns mods do TruckersMP podem não ser compatíveis
**3.** Aguarda atualizações após updates do jogo

📺 **Tutorial:** [VR Tutoriais Marco Pereira](https://youtu.be/mDBtpdlwGms)

⚠️ Nota: A configuração base é explicada no vídeo acima.`,
        autor: "Marco Pereira",
        canal: "TUTORIAIS"
    },
    "vr": {
        keywords: ["vr", "quest", "meta", "oculos", "realidade virtual", "quest 3", "quest 3s", "configurar", "instalar", "como configurar", "como jogar"],
        titulo: "🥽 VR no ETS2 - Meta Quest",
        resumo: `Para jogar ETS2 em VR com Meta Quest:

**1.** Segue o tutorial: [VR Tutoriais Marco Pereira](https://youtu.be/mDBtpdlwGms)
**2.** Configura o SteamVR ou Oculus Link
**3.** Ajusta as definições gráficas para performance

💡 A configuração do Diego é baseada neste vídeo!`,
        autor: "Marco Pereira",
        canal: "TUTORIAIS"
    },
    // ======= NOVOS TUTORIAIS =======
    "consola_developer": {
        keywords: ["consola", "console", "developer", "g_developer", "g_console", "modo desenvolvedor", "ativar consola"],
        titulo: "🛠️ Ativar Consola e Modo Developer - Passo a Passo",
        resumo: `Para ativar a consola e o modo developer:

1. Vai a Documentos > Euro Truck Simulator 2
2. Abre config.cfg com o Bloco de Notas
3. Altera:
   uset g_developer "0" → "1"
   uset g_console "0" → "1"
4. Guarda e fecha.

📺 Vídeo: https://youtu.be/DCavvlEYXmc`,
        autor: "Diego Gamer",
        canal: "TUTORIAIS"
    },
    "camara_zero_sem_numpad": {
        keywords: ["camara zero sem numpad", "câmera zero notebook", "teclas wasd câmara", "mudar controlos câmara", "controls.sii"],
        titulo: "⌨️ Câmara Zero sem Teclado Numérico (WASD)",
        resumo: `Para usar a câmara zero com teclas WASD (portáteis):

1. Vai a Documentos > Euro Truck Simulator 2 > profiles
2. Abre a pasta do teu perfil ativo
3. Abre controls.sii com o Bloco de Notas
4. Procura por dbgfwd e substitui:
   keyboard.num8 → keyboard.w
   keyboard.num5 → keyboard.s
   keyboard.num4 → keyboard.a
   keyboard.num6 → keyboard.d
   keyboard.num9 → keyboard.q
   keyboard.num3 → keyboard.e

Fica assim:
config_lines[93]: "mix dbgfwd keyboard.w?0"
config_lines[94]: "mix dbgback keyboard.s?0"
config_lines[95]: "mix dbgleft keyboard.a?0"
config_lines[96]: "mix dbgright keyboard.d?0"
config_lines[97]: "mix dbgup keyboard.q?0"
config_lines[98]: "mix dbgdown keyboard.e?0"

5. Guarda e fecha.

📺 Vídeo: https://youtu.be/DCavvlEYXmc`,
        autor: "Diego Gamer",
        canal: "TUTORIAIS"
    },
    "limite_128": {
        keywords: ["128 jogadores", "aumentar limite comboio", "g_max_convoy_size", "max convoy", "128 vagas"],
        titulo: "📊 Como Aumentar o Limite do Comboio para 128",
        resumo: `Para permitir 128 jogadores no comboio:

1. Fecha o jogo
2. Vai a Documentos > Euro Truck Simulator 2
3. Abre config.cfg
4. Altera:
   uset g_max_convoy_size "128"
5. Guarda e inicia o jogo.

Testa: Abre o ETS2 > Comboios > Criar sessão e vê se o limite aparece a 128.

📺 Vídeo: https://youtu.be/DCavvlEYXmc`,
        autor: "Diego Gamer",
        canal: "TUTORIAIS"
    },
    "project_alm_insanux": {
        keywords: ["project alm", "insanux", "project: alm", "rgb", "scania mod", "instalar project alm"],
        titulo: "🎨 Instalar o Project ALM do Insanux (RGB)",
        resumo: `Como instalar o Project ALM:

1. Acede a https://insanux.com/
2. Faz download do mod Project ALM
3. Coloca na pasta mod do ETS2
4. Ativa no gestor de mods
5. Configura o RGB no menu do mod.

📺 Vídeos tutoriais:
• https://youtu.be/E9zk5bFRjYU
• https://www.youtube.com/watch?v=jyB2Y88XTho
• https://youtu.be/59G2ShBJAI1

🔗 Site oficial: https://insanux.com/`,
        autor: "Diego Gamer",
        canal: "TUTORIAIS"
    },
    "recrutamento_pat": {
        keywords: ["recrutamento pat", "requisitos pat", "como entrar pat", "vtc portugal alfa", "trucky", "15.000 km"],
        titulo: "🚛 Recrutamento - Portugal Alfa Truckers",
        resumo: `**Requisitos:**
• Máx. 100 km/h (simulação real)
• Respeito total entre membros
• Disciplina e pontualidade nos comboios
• 15.000 KM/mês (≈ 500 km/dia)
• Foco no ranking nacional
• Trucky App instalado e configurado
• Discord para comunicação

**Processo:**
1. Instala o Trucky: https://hub.truckyapp.com/
2. Solicita vaga no Trucky (vídeo: https://youtu.be/5Te6tmE2tWM)
3. Abre ticket de recrutamento no Discord

⏳ Não cumprimento dos requisitos em 60 dias pode resultar em desligamento da VTC.

📺 Como instalar o Trucky: https://youtu.be/jiGT1pBiLWs`,
        autor: "Diego Gamer",
        canal: "RECRUTAMENTO"
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
        // bónus para palavras específicas
        const specific = ["camara", "camera", "console", "developer", "numpad", "0", "teletransportar", "ctrl f9", "project alm", "insanux"];
        specific.forEach(word => {
            if (p.includes(word)) score += 5;
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
