// ==================== FAQ DATABASE ====================
export const FAQ_DATABASE = {
    "servidor": {
        keywords: ["servidor", "entrar", "comboio", "id", "steam", "workshop", "regras", "condução", "jogar", "server"],
        titulo: "🎮 Como entrar no servidor da PAC",
        resposta: (cfg) => `📊 **Capacidade:** Até 128 jogadores
🆔 **ID do Comboio:** \`85568392935839115\`
🔍 **Nome para pesquisar:** Portugal Alfa Community
🔗 **Coleção Steam:** [Clique aqui para subscrever](https://steamcommunity.com/sharedfiles/filedetails/?id=3665511189)

📜 **Regras de Condução:**
• Condução defensiva
• Distância de segurança por causa do lag
• Respeito nas zonas de carga
• Zero toxicidade no Rádio CB

⚠️ Precisas de mais ajuda? Clica em **🎫 Abrir ticket** em baixo!`
    },
    "recrutamento": {
        keywords: ["recrutamento", "juntar", "pat", "trucky", "candidatar", "empresa", "vtc", "truckers", "membro"],
        titulo: "🚛 Juntar-se à Portugal Alfa Truckers",
        resposta: (cfg) => `✅ **Requisitos:**
• Trucky App instalado
• Máx. 100 km/h sempre – simulação real
• Respeito total entre membros e jogadores
• Comboios = disciplina + pontualidade
• Cumprir quilometragem mínima: 15.000 KM/mês (≈ 500 km/dia)
• Foco no ranking nacional respeitando os 0 aos 100 km/h

📲 **Trucky:** [Download aqui](https://truckyapp.com)
📝 **Candidatura:** <#${cfg.CANAL_TICKETS_RECRUTAMENTO}>

⏳ **Aviso:** Não cumprimento dos requisitos em 60 dias pode resultar no desligamento. Após esse período, podes continuar nas outras atividades do Discord.

🎉 Boa sorte e bem-vindo à estrada!`
    },
    "ets2la": {
        keywords: ["ets2la", "configurar", "la", "lane", "assist", "ets2 la", "ets la"],
        titulo: "⚙️ Configurar ETS2LA",
        resposta: (cfg) => `⚠️ **Estado actual:** Alguns mods podem não estar atualizados. Temos mesmo que esperar pelas atualizações.

💡 **Recomendação:**
• Verifica se tens a versão mais recente do ETS2LA
• Alguns mods do trucksmp podem não ser compatíveis de imediato
• Quando sair atualização do trucksmp, será feito na versão mais recente

📺 **Tutorial base:** [VR Tutoriais Marco Pereira](https://youtu.be/mDBtpdlwGms)

Se precisares de ajuda específica, abre ticket!`
    },
    "mods": {
        keywords: ["mods", "mod", "atualização", "trucksmp", "workshop", "plugin", "addon"],
        titulo: "📦 Mods e Atualizações",
        resposta: (cfg) => `⚠️ **Aviso importante:** Se sair atualização do trucksmp, temos mesmo que esperar pela versão compatível.

🔗 **Coleção oficial:** [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3665511189)

💡 **Dicas:**
• Usa sempre a coleção oficial da Steam
• Não instales mods não aprovados para evitar incompatibilidades
• Verifica a ordem de carregamento dos mods se tiveres problemas

Se o jogo crashar após atualização, aguarda pela compatibilização!`
    },
    "vr": {
        keywords: ["vr", "quest", "meta", "óculos", "realidade virtual", "quest 3", "quest 3s"],
        titulo: "🥽 VR - Meta Quest 3/3S",
        resposta: (cfg) => `📺 **Tutorial recomendado:** [VR Tutoriais Marco Pereira](https://youtu.be/mDBtpdlwGms)

💡 **Como jogar Euro Truck em VR e mostrar no monitor:**
O vídeo acima explica a configuração base completa.

📝 **Nota:** A configuração do Diego é baseada neste vídeo. Se precisares de ajuda específica com a tua configuração, o melhor é veres o tutorial no YouTube.

⚠️ Gráficos no Meta Quest 3/3S dependem muito da configuração do PC. Verifica drivers atualizados!`
    },
    "trucky": {
        keywords: ["trucky", "app", "aplicação", "tracker", "logbook", "registo"],
        titulo: "📲 Trucky App",
        resposta: (cfg) => `📲 **Trucky** é essencial para gerir e monitorizar toda a atividade da empresa.

🔗 **Download:** [truckyapp.com](https://truckyapp.com)

✅ **O que fazer:**
• Instala a app
• Liga-a ao teu perfil Steam/ETS2
• Regista as tuas viagens automaticamente
• Cumpre os 15.000 KM/mês

💡 Sem o Trucky não é possível fazer parte da Portugal Alfa Truckers!

❓ Dúvidas? Abre ticket em <#${cfg.CANAL_TICKETS_RECRUTAMENTO}>`
    },
    "geral": {
        keywords: ["ajuda", "duvida", "dúvida", "help", "suporte", "problema", "erro"],
        titulo: "🆘 Central de Ajuda",
        resposta: (cfg) => `Olá! Sou o assistente inteligente da PAC. Posso ajudar-te com:

🎮 **Servidor** — ID, regras, como entrar
🚛 **Recrutamento** — Requisitos, Trucky, candidatura
⚙️ **ETS2LA** — Configuração, mods, atualizações
🥽 **VR** — Meta Quest, tutoriais
📲 **Trucky** — Download, instalação

Escreve a tua pergunta específica ou clica em **🔍 Procurar**!`
    },
    // ===== NOVAS ENTRADAS =====
    "consola": {
        keywords: ["consola", "console", "developer", "desenvolvedor", "modo desenvolvedor", "g_developer", "g_console"],
        titulo: "🛠️ Ativar Consola e Modo Developer",
        resposta: (cfg) => `Para ativar a consola e o modo developer no ETS2/ATS:

1️⃣ Vai a: \`Documentos > Euro Truck Simulator 2\`
2️⃣ Abre o ficheiro \`config.cfg\` com o Bloco de Notas
3️⃣ Procura por estas duas linhas e muda o valor para \`1\`:
   \`\`\`
   uset g_developer "1"
   uset g_console "1"
   \`\`\`
4️⃣ Guarda e fecha o ficheiro.

📺 **Vídeo tutorial:** https://youtu.be/DCavvlEYXmc
🔧 Depois de ativado, pressiona a tecla \`0\` no jogo para usar a câmara livre.`
    },
    "camara_zero": {
        keywords: ["camara zero", "câmera zero", "camera 0", "câmara 0", "developer camera", "fly cam", "sem numpad", "sem teclado numérico", "notebook", "teclas wasd"],
        titulo: "📹 Câmara Zero – Com ou sem Teclado Numérico",
        resposta: (cfg) => `**Com teclado numérico (Numpad):**
• \`0\` – Ativar câmara
• \`8 / 5\` – Frente/Trás
• \`4 / 6\` – Esquerda/Direita
• \`9 / 3\` – Subir/Descer
• \`Mouse\` – Olhar
• \`Scroll\` – Velocidade da câmara

**Sem Numpad (portáteis):**
1️⃣ Vai a \`Documentos > Euro Truck Simulator 2 > profiles\`
2️⃣ Abre a pasta do teu perfil ativo
3️⃣ Abre o ficheiro \`controls.sii\` com o Bloco de Notas
4️⃣ Procura por \`dbgfwd\` e altera as linhas para:
   \`\`\`
   config_lines[93]: "mix dbgfwd keyboard.w?0"
   config_lines[94]: "mix dbgback keyboard.s?0"
   config_lines[95]: "mix dbgleft keyboard.a?0"
   config_lines[96]: "mix dbgright keyboard.d?0"
   config_lines[97]: "mix dbgup keyboard.q?0"
   config_lines[98]: "mix dbgdown keyboard.e?0"
   \`\`\`
5️⃣ Guarda e fecha.

📺 **Vídeo:** https://youtu.be/DCavvlEYXmc`
    },
    "teletransporte": {
        keywords: ["teletransportar", "teleportar", "ctrl f9", "ctrl+f9", "levar camião", "mover camião"],
        titulo: "🚛 Como Teletransportar o Camião",
        resposta: (cfg) => `Com a câmara livre ativa (tecla \`0\`):

1️⃣ Leva a câmara até ao local desejado
2️⃣ Posiciona a câmara **bem próxima do chão** (para não danificar o camião)
3️⃣ Pressiona \`Ctrl + F9\`

O camião será teletransportado para a posição da câmara.

📺 **Vídeo:** https://www.youtube.com/watch?v=aqmX0DuzalA`
    },
    "limite_comboio": {
        keywords: ["128", "128 jogadores", "limite comboio", "aumentar vagas", "g_max_convoy_size", "maximo jogadores", "lotação"],
        titulo: "📊 Aumentar Limite do Comboio para 128 Jogadores",
        resposta: (cfg) => `Para permitir 128 jogadores no teu comboio:

1️⃣ Fecha o jogo
2️⃣ Vai a \`Documentos > Euro Truck Simulator 2\`
3️⃣ Abre o \`config.cfg\` com o Bloco de Notas
4️⃣ Procura por \`g_max_convoy_size\` e altera para:
   \`\`\`
   uset g_max_convoy_size "128"
   \`\`\`
5️⃣ Guarda e inicia o jogo

**Como testar:**
• Abre o ETS2 > Comboios > Criar sessão
• Verifica se o seletor de jogadores permite até 128

📺 **Vídeo:** https://youtu.be/DCavvlEYXmc`
    },
    "project_alm": {
        keywords: ["project alm", "project: alm", "alm insanux", "insanux", "rgb scania", "mod scania", "instalar project alm"],
        titulo: "🎨 Instalar o Project ALM (Insanux)",
        resposta: (cfg) => `**Passos para instalar o Project ALM:**

1️⃣ Acede ao site oficial: https://insanux.com/
2️⃣ Faz download do mod \`Project ALM\`
3️⃣ Coloca o ficheiro na pasta \`mod\` do ETS2
4️⃣ Ativa o mod no gestor de mods antes de entrar no jogo
5️⃣ No jogo, configura o RGB através do menu do mod

📺 **Tutoriais em vídeo:**
• https://youtu.be/E9zk5bFRjYU
• https://www.youtube.com/watch?v=jyB2Y88XTho
• https://youtu.be/59G2ShBJAI1

🔗 **Site:** https://insanux.com/`
    }
};

export function encontrarRespostaFAQ(pergunta) {
    const palavras = pergunta.split(/\s+/).filter(p => p.length > 2);
    let melhorMatch = null;
    let melhorScore = 0;

    for (const [key, data] of Object.entries(FAQ_DATABASE)) {
        let score = 0;

        data.keywords.forEach(kw => {
            if (pergunta.toLowerCase().includes(kw.toLowerCase())) score += 5;
        });

        const textoCompleto = (data.titulo + " " + data.resposta).toLowerCase();
        palavras.forEach(palavra => {
            if (textoCompleto.includes(palavra)) score += 2;
        });

        if (score > melhorScore) {
            melhorScore = score;
            melhorMatch = data;
        }
    }

    if (melhorMatch && melhorScore >= 5) {
        return {
            found: true,
            titulo: melhorMatch.titulo,
            texto: melhorMatch.resposta
        };
    }

    return {
        found: false,
        titulo: "🔍 A pesquisar...",
        texto: "A procurar informações na internet..."
    };
}
