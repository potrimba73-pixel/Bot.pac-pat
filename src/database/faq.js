// ==================== FAQ DATABASE ====================
export const FAQ_DATABASE = {
    // ✅ NOVA ENTRADA: CÂMARA 0 (prioridade alta)
    "camara0": {
        keywords: ["camara", "camera", "0", "configurar camara", "camara 0", "camera 0", "console", "developer", "config.cfg", "modo desenvolvedor", "ativar camara", "camera livre", "tecla 0", "numpad", "teleportar", "g_developer", "g_console"],
        titulo: "🎥 Como ativar e usar a Câmara 0 (câmara livre) no ETS2/ATS",
        resposta: (cfg) => `**📹 Como ativar a Câmara 0 no ETS2/ATS**

**1️⃣ Ativar o Console e o Modo Desenvolvedor**
• Vai a: \`Documentos \\ Euro Truck Simulator 2\` (ou \`American Truck Simulator\`)
• Abre o ficheiro \`config.cfg\` com o Bloco de Notas
• Procura por:
  \`uset g_developer "0"\` → muda para \`uset g_developer "1"\`
  \`uset g_console "0"\` → muda para \`uset g_console "1"\`
• Guarda e fecha o ficheiro

**2️⃣ Dentro do jogo**
• Pressiona a tecla **0** (zero, em cima das letras) para ativar a câmara livre.
• Usa o **Teclado Numérico (Numpad)** para movimentar:
  • **8 / 5** – Frente / Trás
  • **4 / 6** – Esquerda / Direita
  • **9 / 3** – Subir / Descer
  • **Mouse** – Olhar para os lados
  • **Scroll do Mouse** – Aumenta/diminui a velocidade da câmara

**3️⃣ Teletransportar o caminhão**
• Leva a câmara até ao local desejado (bem perto do chão).
• Pressiona **Ctrl + F9** para teletransportar o caminhão.

📺 **Tutorial em vídeo:** https://www.youtube.com/watch?v=aqmX0DuzalA`
    },

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

📲 **Trucky:** [Download aqui](https://hub.truckyapp.com/)
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

🔗 **Download:** [hub.truckyapp.com](https://hub.truckyapp.com/)

📺 **Como instalar:** https://www.youtube.com/watch?v=jiGT1pBiLWs

📺 **Como solicitar vaga:** https://www.youtube.com/watch?v=5Te6tmE2tWM

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

        const textoCompleto = (data.titulo + " placeholder").toLowerCase();
        palavras.forEach(palavra => {
            if (textoCompleto.includes(palavra.toLowerCase())) score += 2;
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
