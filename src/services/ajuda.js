import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config/index.js";
import { safeEditReply } from "../utils/safeReply.js";

// Memoria da IA (em memoria, nao persistente)
export const assistantMemory = new Map();

export async function handleAjudaCommand(interaction, client) {
  // NOTA: O deferReply ja foi feito no interactionCreate.js antes de chamar esta funcao
  // Por isso usamos apenas editReply aqui

  const umaHora = 60 * 60 * 1000;
  const agora = Date.now();
  const memoria = assistantMemory.get(interaction.user.id);

  if (memoria && (agora - memoria.timestamp) < umaHora) {
    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_INFO} Central de Ajuda`)
      .setDescription([
        `${CONFIG.EMOJI_INFO} Ja fizeste uma pergunta recentemente.`,
        "",
        `**Pergunta anterior:** ${memoria.pergunta}`,
        `**Resposta:** ${memoria.resposta.substring(0, 500)}${memoria.resposta.length > 500 ? "..." : ""}`,
        "",
        `${CONFIG.EMOJI_TIME} Podes fazer outra pergunta em ${Math.ceil((umaHora - (agora - memoria.timestamp)) / 60000)} minutos.`,
      ].join("\n"))
      .setColor(0x262af1)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ajuda_nova").setLabel("Nova Pergunta").setStyle(ButtonStyle.Primary).setEmoji(CONFIG.EMOJI_AJUDA),
      new ButtonBuilder().setCustomId("ajuda_ticket").setLabel("Abrir Ticket").setStyle(ButtonStyle.Secondary).setEmoji(CONFIG.EMOJI_TICKET),
    );

    await interaction.editReply({ embeds: [embed], components: [row], flags: 64 });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_AJUDA} Central de Ajuda | Portugal Alfa Community`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Bem-vindo a central de ajuda!`,
      "",
      "Aqui podes fazer perguntas sobre a comunidade, regras, sistemas e mais.",
      "",
      `${CONFIG.EMOJI_INFO} **Como funciona:**`,
      "1. Clica em 'Procurar Ajuda'",
      "2. Escreve a tua pergunta",
      "3. Recebe uma resposta personalizada",
      "",
      `${CONFIG.EMOJI_TIME} **Nota:** So podes fazer 1 pergunta por hora.`,
    ].join("\n"))
    .setColor(0x262af1)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ajuda_procurar").setLabel("Procurar Ajuda").setStyle(ButtonStyle.Primary).setEmoji(CONFIG.EMOJI_SEARCH),
    new ButtonBuilder().setCustomId("ajuda_ticket").setLabel("Abrir Ticket").setStyle(ButtonStyle.Secondary).setEmoji(CONFIG.EMOJI_TICKET),
  );

  await interaction.editReply({ embeds: [embed], components: [row], flags: 64 });
}

export async function handleAjudaProcurar(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("modal_ajuda")
    .setTitle(`${CONFIG.EMOJI_AJUDA} Pergunta de Ajuda`);

  const inputPergunta = new TextInputBuilder()
    .setCustomId("pergunta_ajuda")
    .setLabel("Qual e a tua pergunta?")
    .setPlaceholder("Ex: Como configuro a camara 0? Como ando no jogo?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(inputPergunta));
  await interaction.showModal(modal);
}

export async function handleAjudaModal(interaction, client) {
  const pergunta = interaction.fields.getTextInputValue("pergunta_ajuda");

  await interaction.deferReply({ flags: 64 });

  try {
    // Resposta automatica baseada em palavras-chave
    let resposta = gerarRespostaAjuda(pergunta);

    // Guardar na memoria
    assistantMemory.set(interaction.user.id, {
      pergunta: pergunta,
      resposta: resposta,
      timestamp: Date.now(),
    });

    const embed = new EmbedBuilder()
      .setTitle(`${CONFIG.EMOJI_AJUDA} Resposta de Ajuda`)
      .setDescription([
        `**Pergunta:** ${pergunta}`,
        "",
        `**Resposta:**`,
        resposta,
        "",
        `${CONFIG.EMOJI_INFO} Esta resposta foi util?`,
      ].join("\n"))
      .setColor(0x00ff00)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`smart_helpful_${interaction.user.id}`).setLabel("Sim, resolveu!").setStyle(ButtonStyle.Success).setEmoji("✅"),
      new ButtonBuilder().setCustomId(`smart_not_helpful_${interaction.user.id}`).setLabel("Nao, preciso de mais ajuda").setStyle(ButtonStyle.Danger).setEmoji("❌"),
    );

    await interaction.editReply({ embeds: [embed], components: [row], flags: 64 });
  } catch (error) {
    console.error("Erro no handleAjudaModal:", error);
    await interaction.editReply({ content: `${CONFIG.EMOJI_ERROR} Ocorreu um erro ao processar a tua pergunta. Tenta novamente mais tarde.`, flags: 64 });
  }
}

function gerarRespostaAjuda(pergunta) {
  const perguntaLower = pergunta.toLowerCase();

  // Camara 0 / Configurar camara
  if (perguntaLower.includes("camara") || perguntaLower.includes("camera") || perguntaLower.includes("configurar camara") || perguntaLower.includes("camera 0")) {
    return [
      `${CONFIG.EMOJI_INFO} **Configurar Camara 0 no ETS2/ATS:**`,
      "",
      "1. Abre o jogo e vai a **Opcoes**",
      "2. Vai a **Controles** -> **Camara**",
      "3. Procura **'Camara 0'** ou **'Camara de cabine'**",
      "4. Atribui uma tecla (ex: **F1** ou **1**)",
      "5. Durante o jogo, pressiona a tecla para mudar para a camara 0",
      "",
      `${CONFIG.EMOJI_INFO} **Dica:** A camara 0 e a vista de dentro da cabine (primeira pessoa).`,
      "",
      `${CONFIG.EMOJI_INFO} Se precisares de mais ajuda, abre um ticket!`,
    ].join("\n");
  }

  // Como andar / mover-se
  if (perguntaLower.includes("ando") || perguntaLower.includes("andar") || perguntaLower.includes("mover") || perguntaLower.includes("mover-se") || perguntaLower.includes("como ando")) {
    return [
      `${CONFIG.EMOJI_INFO} **Como andar no ETS2/ATS:**`,
      "",
      "1. **W** - Acelerar",
      "2. **S** - Travar / Andar para tras",
      "3. **A** - Virar a esquerda",
      "4. **D** - Virar a direita",
      "5. **Espaco** - Travar de mao",
      "6. **Setas** - Tambem funcionam para conduzir",
      "",
      `${CONFIG.EMOJI_INFO} **Dica:** Usa a camara do tablier (tecla **1**) para uma experiencia mais realista.`,
      "",
      `${CONFIG.EMOJI_INFO} Se precisares de mais ajuda, abre um ticket!`,
    ].join("\n");
  }

  // Regras
  if (perguntaLower.includes("regra") || perguntaLower.includes("regras")) {
    return [
      `${CONFIG.EMOJI_INFO} **Regras da Portugal Alfa Community:**`,
      "",
      "1. Respeita todos os membros e staff",
      "2. Nao partilhes conteudo inapropriado (NSFW/Gore)",
      "3. Nao facas spam ou flood",
      "4. Usa os canais corretos para cada tema",
      "5. Nao divulgues outros servidores sem autorizacao",
      "6. Cumpre as regras de conducao (max 100 km/h)",
      "",
      `${CONFIG.EMOJI_INFO} Le as regras completas no canal <#${CONFIG.CANAL_REGRAS}>`,
    ].join("\n");
  }

  // Tickets
  if (perguntaLower.includes("ticket") || perguntaLower.includes("abrir ticket")) {
    return [
      `${CONFIG.EMOJI_INFO} **Como abrir um ticket:**`,
      "",
      `1. Vai ao canal <#${CONFIG.CANAL_TICKETS_GERAL}>`,
      "2. Seleciona o tipo de ticket no menu",
      "3. Descreve o teu problema",
      "4. Aguarda resposta da staff",
      "",
      `${CONFIG.EMOJI_INFO} Tipos de tickets: Bugs, Denuncia, Suporte, Criador de Conteudo`,
    ].join("\n");
  }

  // Recrutamento
  if (perguntaLower.includes("recrutamento") || perguntaLower.includes("recrutar") || perguntaLower.includes("pat")) {
    return [
      `${CONFIG.EMOJI_INFO} **Recrutamento Portugal Alfa Truckers:**`,
      "",
      "**Requisitos:**",
      "- Max. 100 km/h sempre",
      "- Respeito total entre membros",
      "- Comboios = disciplina + pontualidade",
      "- 15.000 KM/mes (aprox. 500 km/dia)",
      "- Trucky para gerir atividade",
      "",
      `1. Vai ao servidor de recrutamento`,
      "2. Aceita as regras",
      "3. Abre um ticket de recrutamento",
      "4. Segue as instrucoes da staff",
      "",
      `${CONFIG.EMOJI_INFO} Boa sorte na tua candidatura!`,
    ].join("\n");
  }

  // Resposta generica
  return [
    `${CONFIG.EMOJI_INFO} **Obrigado pela tua pergunta!**`,
    "",
    `Nao encontrei uma resposta especifica para: "${pergunta}"`,
    "",
    `${CONFIG.EMOJI_INFO} **Sugestoes:**`,
    "- Tenta reformular a pergunta",
    "- Usa palavras-chave como 'camara', 'regras', 'ticket', 'recrutamento'",
    "- Abre um ticket para ajuda personalizada",
    "",
    `${CONFIG.EMOJI_TICKET} Clica em 'Abrir Ticket' para falar com a staff.`,
  ].join("\n");
}
