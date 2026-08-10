// ============================================================
// services/ajuda.js - Sistema de Ajuda Inteligente
// ============================================================

import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,        // ✅ ADICIONADO
  TextInputBuilder,    // ✅ ADICIONADO
  TextInputStyle       // ✅ ADICIONADO
} from "discord.js";
import { CONFIG } from "../config/index.js";
import { safeEditReply } from "../utils/safeReply.js";

// ============================================================
// MEMÓRIA DA IA (em memória, não persistente)
// ============================================================
export const assistantMemory = new Map();

// ============================================================
// FUNÇÃO PRINCIPAL - /ajuda
// ============================================================
export async function handleAjudaCommand(interaction, client) {
  // O deferReply já foi feito no interactionCreate.js
  // Por isso usamos apenas editReply

  const umaHora = 60 * 60 * 1000;
  const agora = Date.now();
  const memoria = assistantMemory.get(interaction.user.id);

  // ✅ Verificar se o utilizador já fez uma pergunta recentemente
  if (memoria && (agora - memoria.timestamp) < umaHora) {
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_INFO} Central de Ajuda`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Já fizeste uma pergunta recentemente.`,
        "",
        `**Pergunta anterior:** ${memoria.pergunta}`,
        `**Resposta:** ${memoria.resposta.substring(0, 500)}${memoria.resposta.length > 500 ? "..." : ""}`,
        "",
        `${CONFIG.EMOJI_TIME} Podes fazer outra pergunta em ${Math.ceil((umaHora - (agora - memoria.timestamp)) / 60000)} minutos.`,
        "",
        `💡 Se precisares de ajuda urgente, abre um ticket.`
      ].join("\n"))
      .setColor(CONFIG.COR_PRINCIPAL || 0x262af1)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ajuda_nova")
        .setLabel("Nova Pergunta")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(CONFIG.EMOJI_AJUDA || "❓"),
      new ButtonBuilder()
        .setCustomId("ajuda_ticket")
        .setLabel("Abrir Ticket")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(CONFIG.EMOJI_TICKET || "🎫"),
    );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row], 
      flags: 64 
    });
    return;
  }

  // ✅ Menu principal
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_AJUDA || "❓"} Central de Ajuda | Portugal Alfa Community`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Bem-vindo à central de ajuda!`,
      "",
      "Aqui podes fazer perguntas sobre a comunidade, regras, sistemas e mais.",
      "",
      "**📋 Como funciona:**",
      "1️⃣ Clica em **Procurar Ajuda**",
      "2️⃣ Escreve a tua pergunta",
      "3️⃣ Recebe uma resposta personalizada",
      "",
      "**📚 Tópicos disponíveis:**",
      "• 🎮 ETS2 / ATS - Servidor, mods, configurações",
      "• 🚛 Recrutamento PAT - Requisitos, Trucky, candidatura",
      "• ⚙️ ETS2LA - Configuração, mods, atualizações",
      "• 🥽 VR - Meta Quest, tutoriais",
      "• 📲 Trucky App - Download, instalação",
      "",
      `${CONFIG.EMOJI_TIME} **Nota:** Apenas 1 pergunta por hora.`
    ].join("\n"))
    .setColor(CONFIG.COR_PRINCIPAL || 0x262af1)
    .setTimestamp()
    .setFooter({ 
      text: "Portugal Alfa Community", 
      iconURL: client?.user?.displayAvatarURL() 
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ajuda_procurar")
      .setLabel("🔍 Procurar Ajuda")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ajuda_ticket")
      .setLabel("🎫 Abrir Ticket")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ajuda_faq")
      .setLabel("📖 FAQ Rápido")
      .setStyle(ButtonStyle.Success),
  );

  await interaction.editReply({ 
    embeds: [embed], 
    components: [row], 
    flags: 64 
  });
}

// ============================================================
// HANDLER - BOTÃO "Procurar Ajuda"
// ============================================================
export async function handleAjudaProcurar(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_ajuda_${interaction.user.id}_${Date.now()}`)
    .setTitle(`${CONFIG.EMOJI_AJUDA || "❓"} Pergunta de Ajuda`);

  const inputPergunta = new TextInputBuilder()
    .setCustomId("pergunta_ajuda")
    .setLabel("Qual é a tua pergunta?")
    .setPlaceholder("Ex: Como configuro a câmara 0? Como ando no jogo?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(500);

  const inputDetalhes = new TextInputBuilder()
    .setCustomId("detalhes_ajuda")
    .setLabel("Detalhes adicionais (opcional)")
    .setPlaceholder("Ex: Já tentei X e Y, mas não funcionou...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(inputPergunta),
    new ActionRowBuilder().addComponents(inputDetalhes)
  );

  await interaction.showModal(modal);
}

// ============================================================
// HANDLER - MODAL DE AJUDA
// ============================================================
export async function handleAjudaModal(interaction, client) {
  const pergunta = interaction.fields.getTextInputValue("pergunta_ajuda");
  const detalhes = interaction.fields.getTextInputValue("detalhes_ajuda") || "";

  // ✅ Defer reply (pode demorar a processar)
  await interaction.deferReply({ flags: 64 });

  try {
    // ✅ Gerar resposta baseada na pergunta
    const resposta = gerarRespostaAjuda(pergunta, detalhes);

    // ✅ Guardar na memória
    assistantMemory.set(interaction.user.id, {
      pergunta: pergunta,
      resposta: resposta,
      timestamp: Date.now(),
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_AJUDA || "❓"} Resposta de Ajuda`)
      .setDescription([
        `**📝 Pergunta:**`,
        `> ${pergunta}`,
        "",
        `**💡 Resposta:**`,
        resposta,
        "",
        `${CONFIG.EMOJI_INFO} Esta resposta foi útil?`
      ].join("\n"))
      .setColor(CONFIG.COR_SUCESSO || 0x00ff00)
      .setTimestamp()
      .setFooter({ 
        text: "Portugal Alfa Community • Feedback ajuda a melhorar!", 
        iconURL: client?.user?.displayAvatarURL() 
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`smart_helpful_${interaction.user.id}`)
        .setLabel("✅ Sim, resolveu!")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`smart_not_helpful_${interaction.user.id}`)
        .setLabel("❌ Não, preciso de mais ajuda")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ajuda_ticket_direct_${interaction.user.id}`)
        .setLabel("🎫 Abrir Ticket")
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [row], 
      flags: 64 
    });

  } catch (error) {
    console.error("[AjudaModal] Erro:", error);
    await interaction.editReply({ 
      content: `${CONFIG.EMOJI_ERROR || "💥"} Ocorreu um erro ao processar a tua pergunta. Tenta novamente mais tarde ou abre um ticket.`, 
      flags: 64 
    });
  }
}

// ============================================================
// GERADOR DE RESPOSTAS - BASEADO EM PALAVRAS-CHAVE
// ============================================================
function gerarRespostaAjuda(pergunta, detalhes = "") {
  const perguntaLower = pergunta.toLowerCase();
  const respostas = [];

  // ✅ Função auxiliar para adicionar resposta
  function addResposta(titulo, conteudo) {
    respostas.push(`**${titulo}**\n${conteudo}`);
  }

  // ===== CÂMARA 0 / CONFIGURAR CÂMARA =====
  if (perguntaLower.includes("camara") || perguntaLower.includes("camera") || 
      perguntaLower.includes("configurar camara") || perguntaLower.includes("camera 0") ||
      perguntaLower.includes("camara 0")) {
    addResposta(
      "📹 Configurar Câmara 0 no ETS2/ATS",
      [
        "1️⃣ Abre o jogo e vai a **Opções**",
        "2️⃣ Vai a **Controles** → **Câmara**",
        "3️⃣ Procura **'Câmara 0'** ou **'Câmara de cabine'**",
        "4️⃣ Atribui uma tecla (ex: **F1** ou **1**)",
        "5️⃣ Durante o jogo, pressiona a tecla para mudar para a câmara 0",
        "",
        "💡 **Dica:** A câmara 0 é a vista de dentro da cabine (primeira pessoa).",
        "",
        "📺 **Vídeo tutorial:** [Tutorial de Câmaras](https://youtu.be/mDBtpdlwGms)"
      ].join("\n")
    );
  }

  // ===== COMO ANDAR / MOVER-SE =====
  if (perguntaLower.includes("ando") || perguntaLower.includes("andar") || 
      perguntaLower.includes("mover") || perguntaLower.includes("mover-se") || 
      perguntaLower.includes("como ando") || perguntaLower.includes("como mexo")) {
    addResposta(
      "🎮 Como andar no ETS2/ATS",
      [
        "**Controles básicos:**",
        "• **W** - Acelerar",
        "• **S** - Travar / Andar para trás",
        "• **A** - Virar à esquerda",
        "• **D** - Virar à direita",
        "• **Espaço** - Travar de mão",
        "• **Setas** - Também funcionam para conduzir",
        "",
        "**Controles adicionais:**",
        "• **1-8** - Mudar câmaras",
        "• **F** - Faróis",
        "• **J** - Limpa-vidros",
        "• **L** - Luzes de emergência",
        "",
        "💡 **Dica:** Usa a câmara do tablier (tecla **1**) para uma experiência mais realista."
      ].join("\n")
    );
  }

  // ===== REGRAS =====
  if (perguntaLower.includes("regra") || perguntaLower.includes("regras") || 
      perguntaLower.includes("normas") || perguntaLower.includes("políticas")) {
    addResposta(
      "📋 Regras da Portugal Alfa Community",
      [
        "**1️⃣ Respeito e Convivência**",
        "• Respeita todos os membros e staff",
        "• Ofensas, insultos ou toxicidade não serão tolerados",
        "",
        "**2️⃣ Conteúdo e Identidade**",
        "• Nomes e avatares ofensivos são proibidos",
        "• Conteúdo NSFW/Gore é estritamente proibido",
        "",
        "**3️⃣ Divulgação e Spam**",
        "• Divulgar outros servidores requer autorização",
        "• Spam/Flood não é permitido",
        "",
        "**4️⃣ Canais de Voz**",
        "• Respeita o propósito de cada sala",
        "• Gritar ou saturar o som é proibido",
        "",
        `📖 **Regras completas:** <#${CONFIG.CANAL_REGRAS}>`
      ].join("\n")
    );
  }

  // ===== TICKETS =====
  if (perguntaLower.includes("ticket") || perguntaLower.includes("abrir ticket") || 
      perguntaLower.includes("como abrir") || perguntaLower.includes("sistema de ticket")) {
    addResposta(
      "🎫 Como abrir um ticket",
      [
        `1️⃣ Vai ao canal <#${CONFIG.CANAL_TICKETS_GERAL}>`,
        "2️⃣ Seleciona o tipo de ticket no menu",
        "3️⃣ Descreve o teu problema detalhadamente",
        "4️⃣ Aguarda resposta da staff",
        "",
        "**📋 Tipos de tickets disponíveis:**",
        "• 🐛 **Bugs** - Reportar problemas no jogo",
        "• 🚨 **Denúncia** - Reportar comportamentos inadequados",
        "• 🔧 **Suporte** - Ajuda com problemas técnicos",
        "• 🎥 **Criador de Conteúdo** - Para criadores de conteúdo",
        "",
        "⚠️ **Regras dos tickets:**",
        "• Não menciones (ping) staff sem necessidade",
        "• Mantém linguagem respeitosa",
        "• Apenas 1 ticket por assunto"
      ].join("\n")
    );
  }

  // ===== RECRUTAMENTO =====
  if (perguntaLower.includes("recrutamento") || perguntaLower.includes("recrutar") || 
      perguntaLower.includes("pat") || perguntaLower.includes("entrar") || 
      perguntaLower.includes("candidatar") || perguntaLower.includes("membro")) {
    addResposta(
      "🚛 Recrutamento - Portugal Alfa Truckers",
      [
        "**✅ Requisitos para entrar:**",
        "• Máx. 100 km/h sempre - simulação real",
        "• Respeito total entre membros e jogadores",
        "• Comboios = disciplina + pontualidade",
        "• 15.000 KM/mês (≈ 500 km/dia)",
        "• Trucky App instalado e configurado",
        "• Foco no ranking nacional",
        "",
        "**📋 Como te candidatar:**",
        `1️⃣ Vai ao canal <#${CONFIG.CANAL_TICKETS_RECRUTAMENTO}>`,
        "2️⃣ Seleciona **Recrutamento PAT**",
        "3️⃣ Confirma que tens o Trucky instalado",
        "4️⃣ Aceita as regras da VTC",
        "5️⃣ Aguarda análise da staff",
        "",
        "⚠️ **Aviso:** Incumprimento dos requisitos por 60 dias pode resultar em desligamento.",
        "",
        "📲 **Trucky:** [truckyapp.com](https://truckyapp.com)"
      ].join("\n")
    );
  }

  // ===== ETS2LA =====
  if (perguntaLower.includes("ets2la") || perguntaLower.includes("ets2 la") || 
      perguntaLower.includes("lane assist") || perguntaLower.includes("la")) {
    addResposta(
      "⚙️ Configurar ETS2LA (Lane Assist)",
      [
        "⚠️ **Estado atual:** Alguns mods podem não estar atualizados.",
        "",
        "**💡 Recomendações:**",
        "• Verifica se tens a versão mais recente do ETS2LA",
        "• Alguns mods do TruckersMP podem não ser compatíveis",
        "• Aguarda atualizações após updates do jogo",
        "",
        "**📺 Tutoriais:**",
        "[VR Tutoriais Marco Pereira](https://youtu.be/mDBtpdlwGms)",
        "",
        "**🔧 Configuração básica:**",
        "1. Instala o mod na pasta `mod` do ETS2",
        "2. Ativa no gestor de mods",
        "3. Configura no menu de opções do jogo",
        "",
        "💡 Se precisares de ajuda específica, abre ticket!"
      ].join("\n")
    );
  }

  // ===== VR =====
  if (perguntaLower.includes("vr") || perguntaLower.includes("quest") || 
      perguntaLower.includes("meta") || perguntaLower.includes("oculos") || 
      perguntaLower.includes("realidade virtual") || perguntaLower.includes("quest 3") ||
      perguntaLower.includes("quest 3s")) {
    addResposta(
      "🥽 VR - Meta Quest 3/3S no ETS2",
      [
        "**📺 Tutorial recomendado:**",
        "[VR Tutoriais Marco Pereira](https://youtu.be/mDBtpdlwGms)",
        "",
        "**✅ Passos para configurar:**",
        "1. Instala o SteamVR ou Oculus Link",
        "2. Ativa o modo VR nas opções do ETS2",
        "3. Ajusta as definições gráficas para performance",
        "4. Configura os controladores",
        "",
        "**💡 Dicas:**",
        "• A configuração do Diego é baseada neste vídeo",
        "• Gráficos no Quest 3/3S dependem do PC",
        "• Verifica drivers atualizados",
        "• Usa OpenXR para melhor performance",
        "",
        "⚠️ **Nota:** Se tiveres problemas, abre ticket para ajuda personalizada!"
      ].join("\n")
    );
  }

  // ===== TRUCKY =====
  if (perguntaLower.includes("trucky") || perguntaLower.includes("app") || 
      perguntaLower.includes("aplicação") || perguntaLower.includes("tracker") || 
      perguntaLower.includes("logbook") || perguntaLower.includes("registo") ||
      perguntaLower.includes("km") || perguntaLower.includes("quilometros")) {
    addResposta(
      "📲 Trucky App - Gestão da VTC",
      [
        "**📲 O que é o Trucky?**",
        "É a aplicação essencial para gerir e monitorizar toda a atividade da empresa.",
        "",
        "**🔗 Download:**",
        "[truckyapp.com](https://truckyapp.com)",
        "",
        "**✅ O que fazer:**",
        "1. Instala a app no computador",
        "2. Liga à tua conta Steam/ETS2",
        "3. Regista as viagens automaticamente",
        "4. Cumpre os 15.000 KM/mês",
        "",
        "**💡 Vantagens:**",
        "• Acompanha as tuas estatísticas em tempo real",
        "• Registo automático de todas as cargas",
        "• Ranking da VTC",
        "• Sistema de patentes automático",
        "",
        "❓ **Dúvidas?** Abre ticket para ajuda personalizada!"
      ].join("\n")
    );
  }

  // ===== SERVIDOR / ENTRAR / COMBOIO =====
  if (perguntaLower.includes("servidor") || perguntaLower.includes("entrar") || 
      perguntaLower.includes("comboio") || perguntaLower.includes("convoy") ||
      perguntaLower.includes("id") || perguntaLower.includes("como entrar")) {
    addResposta(
      "🎮 Como entrar no servidor da PAC",
      [
        "**📊 Capacidade:** Até 128 jogadores",
        "🆔 **ID do Comboio:** `85568392935839115`",
        "🔍 **Nome para pesquisar:** Portugal Alfa Community",
        "🔗 **Coleção Steam:** [Clique aqui](https://steamcommunity.com/sharedfiles/filedetails/?id=3665511189)",
        "",
        "**📜 Regras de Condução:**",
        "• Condução defensiva",
        "• Distância de segurança",
        "• Respeito nas zonas de carga",
        "• Zero toxicidade no Rádio CB",
        "",
        "**🔧 Como entrar:**",
        "1. Subscreve a coleção Steam",
        "2. Abre o jogo e vai a Multiplayer",
        "3. Pesquisa por **Portugal Alfa Community**",
        "4. Entra no comboio",
        "",
        "⚠️ Precisas de mais ajuda? Clica em **🎫 Abrir ticket**!"
      ].join("\n")
    );
  }

  // ===== MODS =====
  if (perguntaLower.includes("mod") || perguntaLower.includes("mods") || 
      perguntaLower.includes("atualização") || perguntaLower.includes("atualizacao") ||
      perguntaLower.includes("workshop") || perguntaLower.includes("plugin")) {
    addResposta(
      "📦 Mods e Atualizações",
      [
        "⚠️ **Aviso importante:**",
        "Se sair atualização do TruckersMP, temos que esperar pela versão compatível.",
        "",
        "🔗 **Coleção oficial:**",
        "[Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3665511189)",
        "",
        "💡 **Dicas:**",
        "• Usa sempre a coleção oficial da Steam",
        "• Não instales mods não aprovados",
        "• Verifica a ordem de carregamento dos mods",
        "",
        "**🔧 Se o jogo crashar:**",
        "1. Remove mods recentes",
        "2. Verifica ficheiros na Steam",
        "3. Aguarda compatibilização",
        "4. Atualiza drivers da GPU"
      ].join("\n")
    );
  }

  // ===== RESPOSTA GENÉRICA (fallback) =====
  if (respostas.length === 0) {
    return [
      `${CONFIG.EMOJI_INFO || "ℹ️"} **Obrigado pela tua pergunta!**`,
      "",
      `Não encontrei uma resposta específica para: **"${pergunta}"**`,
      "",
      "**💡 Sugestões:**",
      "• Tenta reformular a pergunta",
      "• Usa palavras-chave como: 'câmara', 'regras', 'ticket', 'recrutamento'",
      "• Sê mais específico no que precisas",
      "",
      "**📚 Tópicos que posso ajudar:**",
      "• 🎮 ETS2 / ATS - Servidor, mods, configurações",
      "• 🚛 Recrutamento PAT - Requisitos, Trucky, candidatura",
      "• ⚙️ ETS2LA - Configuração, mods, atualizações",
      "• 🥽 VR - Meta Quest, tutoriais",
      "• 📲 Trucky App - Download, instalação",
      "",
      `${CONFIG.EMOJI_TICKET || "🎫"} **Alternativa:** Abre um ticket para ajuda personalizada.`
    ].join("\n");
  }

  // ✅ Juntar todas as respostas encontradas
  return respostas.join("\n\n---\n\n");
}

// ============================================================
// HANDLER - FEEDBACK DA AJUDA
// ============================================================
export async function handleAjudaFeedback(interaction) {
  const customId = interaction.customId;
  
  if (customId === "ajuda_ticket" || customId.startsWith("ajuda_ticket_direct_")) {
    await interaction.reply({
      content: `🎫 Para abrir um ticket, vai ao canal <#${CONFIG.CANAL_TICKETS_GERAL}> e seleciona a opção adequada.`,
      flags: 64
    });
    return;
  }

  if (customId === "ajuda_faq") {
    await interaction.reply({
      content: `📖 **FAQ Rápido:**\n\n` +
               `• **Como entro no servidor?** Usa o ID: \`85568392935839115\`\n` +
               `• **Como me candidato?** Vai ao canal de recrutamento\n` +
               `• **Preciso de Trucky?** Sim, é obrigatório\n` +
               `• **Tenho problemas técnicos?** Abre um ticket\n` +
               `• **Regras?** Vê o canal #regras\n\n` +
               `❓ Para mais perguntas, usa **Procurar Ajuda**!`,
      flags: 64
    });
    return;
  }

  if (customId === "ajuda_nova") {
    await interaction.reply({
      content: `🔍 Clica em **Procurar Ajuda** para fazer uma nova pergunta.`,
      flags: 64
    });
    return;
  }

  if (customId === "ajuda_procurar") {
    return handleAjudaProcurar(interaction);
  }

  // ✅ Feedback dos botões smart_helpful / smart_not_helpful
  if (customId.startsWith("smart_helpful_") || customId.startsWith("smart_not_helpful_")) {
    const isHelpful = customId.startsWith("smart_helpful_");
    const userId = customId.split("_")[2];
    
    // Verificar se é o mesmo utilizador
    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: `⚠️ Este feedback não é para ti!`,
        flags: 64
      });
    }

    const feedback = isHelpful ? "✅ Positivo" : "❌ Negativo";
    
    await interaction.reply({
      content: `📝 Obrigado pelo feedback! (${feedback})\n\n${isHelpful ? '🎉 Ainda bem que conseguimos ajudar!' : '😔 Vamos melhorar! Se precisares, abre um ticket para ajuda personalizada.'}`,
      flags: 64
    });

    // ✅ Log do feedback (opcional)
    try {
      const logChannel = await interaction.client.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle("📊 Feedback da Ajuda")
          .setDescription([
            `👤 Utilizador: ${interaction.user.tag}`,
            `📝 Feedback: ${feedback}`,
            `🕐 Data: ${new Date().toLocaleString("pt-PT")}`
          ].join("\n"))
          .setColor(isHelpful ? 0x00ff00 : 0xff0000)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch (e) {
      // Silencioso
    }
    
    return;
  }

  // Fallback
  await interaction.reply({
    content: `❌ Ação desconhecida.`,
    flags: 64
  });
}
