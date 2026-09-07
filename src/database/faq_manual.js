// src/database/faq_manual.js
import { CONFIG } from "../config/index.js";

export const FAQ_MANUAL = [
  {
    keywords: ["mods", "mod", "quais mods", "preciso de mods", "mods para jogar", "coleção", "steam"],
    titulo: "📦 Mods para jogar com a PAC",
    resposta: `🔗 **Coleção oficial de mods da PAC:**  
https://steamcommunity.com/sharedfiles/filedetails/?id=3665511189

📌 **Instruções:**  
1. Subscreve todos os mods da coleção.  
2. No jogo, vai ao Gestor de Mods e ativa-os.  
3. Entra no servidor da PAC (ID: \`85568392935839115\` ou pesquisa "Portugal Alfa Community").

⚠️ **Importante:** Certifica-te de que tens todos os DLCs necessários (geralmente todos) para evitar erros.`
  },
  {
    keywords: ["mapa", "mapas", "espanha", "portugal", "promods", "mapa mod", "dlc"],
    titulo: "🗺️ Mapas (Espanha/Portugal) e DLCs",
    resposta: `Para usar mapas como **Promods** ou **Espanha/Portugal**, precisas de ter **todas as DLCs** do ETS2.

💡 **Opções:**  
• Compra as DLCs em promoção na Steam.  
• Usa apenas mods de carros/camiões (não precisam de DLCs).

🔗 **Site para mods:** https://www.modland.net/euro-truck-simulator-2/cars-bus

📌 **Tutorial de instalação:**  
1. Baixa o mod.  
2. Coloca o ficheiro \`.scs\` na pasta \`Documentos/Euro Truck Simulator 2/mod\`.  
3. Ativa no gestor de mods no jogo.`
  },
  {
    keywords: ["carros", "carro", "automóvel", "veículo", "mod carro"],
    titulo: "🚗 Mods de Carros",
    resposta: `🔗 **Site recomendado:** https://www.modland.net/euro-truck-simulator-2/cars-bus

📌 **Instalação:**  
1. Escolhe o carro que queres.  
2. Faz o download do ficheiro \`.scs\`.  
3. Coloca na pasta \`Documentos/Euro Truck Simulator 2/mod\`.  
4. Ativa no gestor de mods.

⚠️ Alguns carros podem substituir camiões ou precisar de DLCs específicas. Lê a descrição do mod.`
  },
  {
    keywords: ["dinheiro", "economia", "money", "cheat", "trucks book", "ts se tools", "truckers tool"],
    titulo: "💰 Dinheiro / Economia no ETS2",
    resposta: `⚠️ **Aplicações como TS SE Tools já não funcionam nas versões recentes do ETS2.**

💡 **Alternativas:**  
• Usa mods de economia (ex: "Money Mod" no Steam Workshop).  
• Faz entregas longas para ganhar mais dinheiro.  
• Usa o comando \`g_income_factor\` (se tiveres o modo developer ativado).

📺 **Tutorial (TruckersMP Tool):** Pesquisa no YouTube por "Truckers Tool ETS2" para ver tutoriais atualizados.`
  },
  {
    keywords: ["ticket", "abrir ticket", "como abrir", "ticket recrutamento"],
    titulo: "🎫 Como abrir um ticket",
    resposta: `Para abrir um ticket:

1️⃣ Vai ao canal <#${CONFIG.CANAL_TICKETS_GERAL}> ou <#${CONFIG.CANAL_TICKETS_RECRUTAMENTO}>.
2️⃣ Escolhe a opção no menu dropdown (ex: "Suporte", "Recrutamento").
3️⃣ Preenche o formulário com a tua dúvida.

⏳ Aguarda que um membro da staff te atenda.`
  },
  {
    keywords: ["recrutamento", "candidatar", "entrar na pat", "vtc", "trucky", "requisitos"],
    titulo: "🚛 Recrutamento - Portugal Alfa Truckers",
    resposta: `📝 **Requisitos:**  
• Máx. 100 km/h – condução realista.  
• Respeito total.  
• 15.000 km/mês (≈500 km/dia).  
• Trucky App instalado e ligado à tua conta Steam.  
• Discord para comunicação.

📲 **Trucky:** https://hub.truckyapp.com/  

📌 **Processo:**  
1. Instala o Trucky.  
2. Abre um ticket de recrutamento no canal <#${CONFIG.CANAL_TICKETS_RECRUTAMENTO}>.  
3. Aguarda a análise da staff.`
  },
  {
    keywords: ["ets2la", "lane assist", "la", "configurar ets2la"],
    titulo: "⚙️ ETS2LA (Lane Assist)",
    resposta: `📺 **Tutorial base:** https://youtu.be/mDBtpdlwGms

⚠️ **Notas:**  
• Alguns mods do TruckersMP podem não ser compatíveis.  
• Aguarda atualizações após cada patch do jogo.

Se tiveres problemas específicos, abre um ticket.`
  },
  {
    keywords: ["vr", "quest", "meta quest", "realidade virtual", "oculus"],
    titulo: "🥽 VR - Meta Quest",
    resposta: `📺 **Tutorial recomendado:** https://youtu.be/mDBtpdlwGms

💡 **Dicas:**  
• Configura o SteamVR ou Oculus Link.  
• Ajusta as definições gráficas para performance.  
• A configuração do Diego é baseada neste vídeo.

Se precisares de ajuda específica, abre um ticket.`
  },
  {
    keywords: ["128", "limite", "vagas", "aumentar", "max players", "convoy"],
    titulo: "📊 Aumentar limite do comboio para 128",
    resposta: `1️⃣ Fecha o jogo.  
2️⃣ Vai a \`Documentos > Euro Truck Simulator 2\`.  
3️⃣ Abre \`config.cfg\` com o Bloco de Notas.  
4️⃣ Altera: \`uset g_max_convoy_size "128"\`.  
5️⃣ Guarda e inicia o jogo.

📺 **Vídeo:** https://youtu.be/DCavvlEYXmc`
  },
  {
    keywords: ["project alm", "insanux", "rgb", "scania", "mod scania"],
    titulo: "🎨 Project ALM (Insanux)",
    resposta: `🔗 **Site:** https://insanux.com/  

📌 **Passos:**  
1. Faz download do mod.  
2. Coloca na pasta \`mod\` do ETS2.  
3. Ativa no gestor de mods.  
4. Configura o RGB no menu do mod.

📺 **Tutoriais:**  
• https://youtu.be/E9zk5bFRjYU  
• https://youtu.be/59G2ShBJAI1`
  },
  {
    keywords: ["camara zero", "câmera 0", "developer", "console", "numpad", "teletransportar"],
    titulo: "📹 Câmara Zero / Modo Developer",
    resposta: `🛠️ **Ativar:**  
1. Abre \`config.cfg\` em \`Documentos/Euro Truck Simulator 2\`.  
2. Altera:  
   \`uset g_developer "1"\`  
   \`uset g_console "1"\`  
3. Guarda.

🔹 **Com Numpad:**  
• \`0\` ativa.  
• \`8/5/4/6/9/3\` movimentam.

🔹 **Sem Numpad (portáteis):**  
• Altera \`controls.sii\` no teu perfil para usar WASD (tutorial no YouTube).

📺 **Vídeo:** https://youtu.be/DCavvlEYXmc`
  },
  {
    keywords: ["servidor", "entrar no servidor", "id do servidor", "como entrar", "convoy id"],
    titulo: "🎮 Entrar no servidor da PAC",
    resposta: `🆔 **ID do Comboio:** \`85568392935839115\`  
🔍 **Nome:** "Portugal Alfa Community"

📌 **Passos:**  
1. Abre o ETS2 → Comboios → Procurar.  
2. Pesquisa pelo nome ou ID.  
3. Entra e ativa os mods necessários (coleção oficial).

📜 **Regras:** Condução defensiva, distância de segurança, respeito.`
  }
];

export function encontrarRespostaManual(pergunta) {
  const p = pergunta.toLowerCase();
  let melhor = null;
  let melhorScore = 0;

  for (const item of FAQ_MANUAL) {
    let score = 0;
    for (const kw of item.keywords) {
      if (p.includes(kw)) score += 5;
    }
    if (score > melhorScore) {
      melhorScore = score;
      melhor = item;
    }
  }

  if (melhor && melhorScore >= 3) {
    return melhor;
  }
  return null;
}
