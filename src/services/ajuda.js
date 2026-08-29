// src/services/ajuda.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder
} from 'discord.js';

// ============================================================
// IMPORTAR DADOS (CommonJS) usando require()
// ============================================================
const faqData = require('../database/faq.js');
const tutoriaisData = require('../database/tutoriais.js');
const config = require('../config/index.js');

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const COOLDOWN_SECONDS = config.HELP_COOLDOWN || 3600; // 1 hora por defeito
const cooldownMap = new Map();

// ============================================================
// 🆕 EXPORTAR assistantMemory (para ser usado pelo analyzer.js)
// ============================================================
export const assistantMemory = {
  pendingSearches: new Map(),
  // podes adicionar mais propriedades aqui se necessário
};

// ============================================================
// INTENÇÕES (base de conhecimento para deteção)
// ============================================================
const intents = [
  {
    id: 'ets2_convoy',
    category: 'ETS2',
    keywords: ['servidor', 'convoy', 'convoys', 'jogar', 'euro truck', 'ets2', 'entrar', 'multiplayer', 'online', 'comboio', 'jogar convosco', 'jogar com vocês'],
    response: `🚛 **Como participar nos nossos convoys no Euro Truck Simulator 2**

Se estás a falar de jogar ETS2 connosco num convoy, **não precisas de fazer candidatura** à Portugal Alfa Truckers.

1️⃣ Abre o Euro Truck Simulator 2  
2️⃣ Entra no modo **Convoy**  
3️⃣ Procura o convoy/evento da Portugal Alfa Truckers  
4️⃣ Entra no convoy e segue as instruções dadas pela organização.

📌 **Importante:** Se estás a falar de outra coisa, como entrar na PAT como membro, diz-me e explico o processo de candidatura.`
  },
  {
    id: 'pat_recrutamento',
    category: 'Recrutamento',
    keywords: ['candidatura', 'recrutamento', 'entrar para a pat', 'ser membro', 'recruta', 'candidatar', 'quero ser pat'],
    response: `🛡️ **Recrutamento Portugal Alfa Truckers**

Para te candidatares à PAT, deves seguir os passos abaixo:

1️⃣ Lê as **regras** no canal #regras.  
2️⃣ Abre um ticket em <#ticket-channel> e segue as instruções.  
3️⃣ Aguarda que um recrutador te contacte.

📌 **Atenção:** Este processo é apenas para **entrar na equipa** da PAT, não para participar em convoys. Se queres apenas jogar connosco, não precisas de te candidatar.`
  },
  {
    id: 'trucky',
    category: 'Trucky',
    keywords: ['trucky', 'app', 'instalar', 'baixar', 'trucky app', 'telemetria'],
    response: `📱 **Trucky – App de Telemetria**

Para usares o Trucky nos nossos convoys:

1️⃣ Transfere a app em [truckyapp.com](https://truckyapp.com)  
2️⃣ Instala e faz login com a tua conta Discord  
3️⃣ No ETS2/ATS, ativa a telemetria e conecta ao Trucky.

🔗 **Tutorial completo:** <#tutoriais-trucky> (se tiveres um canal específico)`
  },
  {
    id: 'ets2la',
    category: 'ETS2LA',
    keywords: ['ets2la', 'launcher', 'não funciona', 'erro', 'problema', 'crash'],
    response: `⚙️ **ETS2LA – Launcher**

Se estás com problemas no ETS2LA:

1️⃣ Verifica se tens a versão mais recente.  
2️⃣ Executa como administrador.  
3️⃣ Desativa o antivírus/firewall temporariamente.  
4️⃣ Se persistir, abre um ticket com o ficheiro de log.

📌 **Suporte dedicado:** canal <#suporte-ets2la>`
  },
  // Adiciona mais categorias: VR, Project ALM, etc.
];

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
function detectIntent(query) {
  const words = query.toLowerCase().split(/\s+/);
  let bestIntent = null;
  let maxScore = 0;

  for (const intent of intents) {
    let score = 0;
    for (const kw of intent.keywords) {
      if (words.some(w => w.includes(kw) || kw.includes(w))) score++;
    }
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  if (maxScore >= 2) return { intent: bestIntent, confidence: 'high' };
  if (maxScore === 1) return { intent: bestIntent, confidence: 'medium' };
  return { intent: null, confidence: 'low' };
}

function isOnCooldown(userId) {
  const last = cooldownMap.get(userId);
  if (!last) return false;
  return (Date.now() - last) < COOLDOWN_SECONDS * 1000;
}

function setCooldown(userId) {
  cooldownMap.set(userId, Date.now());
}

// ============================================================
// GERADORES DE COMPONENTES (Embeds, Botões)
// ============================================================
function createMainMenuEmbed() {
  return new EmbedBuilder()
    .setColor(0x00A2E8)
    .setTitle('❓ Central de Ajuda – Portugal Alfa Truckers')
    .setDescription('Seleciona uma categoria para obter ajuda ou faz uma pesquisa personalizada.')
    .addFields(
      { name: '🚛 ETS2 / ATS', value: 'Convoys, servidor, Trucky, ETS2LA', inline: true },
      { name: '🛡️ Recrutamento PAT', value: 'Candidaturas e regras', inline: true },
      { name: '📱 Trucky', value: 'Instalação e configuração', inline: true },
      { name: '⚙️ ETS2LA', value: 'Problemas com o launcher', inline: true },
      { name: '🥽 VR / Meta Quest', value: 'Configuração para RV', inline: true },
      { name: '🎨 Project ALM', value: 'Informações sobre o mod', inline: true },
      { name: '🎫 Tickets', value: 'Abrir ticket de suporte', inline: true },
      { name: '🤖 Assistente IA', value: 'Pergunta à nossa IA', inline: true }
    )
    .setFooter({ text: 'Usa os botões abaixo para navegar ou pesquisar.' });
}

function createCategoryEmbed(category) {
  const faqs = faqData.filter(f => f.categoria === category);
  const tutoriais = tutoriaisData.filter(t => t.categoria === category);

  let description = `Aqui estão os recursos disponíveis para **${category}**:\n\n`;
  if (faqs.length) {
    description += '📖 **FAQ:**\n';
    faqs.forEach(f => description += `• ${f.pergunta}\n`);
  }
  if (tutoriais.length) {
    description += '\n📚 **Tutoriais:**\n';
    tutoriais.forEach(t => description += `• [${t.titulo}](${t.link})\n`);
  }
  if (!faqs.length && !tutoriais.length) {
    description += 'Nenhuma informação específica encontrada. Tenta usar a pesquisa ou a IA.';
  }

  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`📂 Categoria: ${category}`)
    .setDescription(description)
    .setFooter({ text: '🔍 Para pesquisar, usa o botão "Pesquisar" abaixo.' });
}

function createSearchEmbed(query, result) {
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('🔍 Resultado da Pesquisa')
    .setDescription(result.response || 'Não encontrei informação suficiente.');

  if (result.source) {
    embed.addFields({ name: '📚 Fonte', value: result.source, inline: true });
  }
  embed.setFooter({ text: '❓ Esta resposta resolveu o teu problema?' });
  return embed;
}

function createResponseButtons(customIdPrefix = 'help_') {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`${customIdPrefix}resolvido`)
        .setLabel('✅ Resolvido')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${customIdPrefix}mais_ajuda`)
        .setLabel('❌ Preciso de mais ajuda')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${customIdPrefix}ticket`)
        .setLabel('🎫 Ticket')
        .setStyle(ButtonStyle.Danger)
    );
  return row;
}

function createNavigationButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_home')
        .setLabel('🏠 Início')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_back')
        .setLabel('◀️ Voltar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_search')
        .setLabel('🔍 Pesquisar')
        .setStyle(ButtonStyle.Primary)
    );
}

// ============================================================
// COMANDO PRINCIPAL: /ajuda
// ============================================================
export async function handleHelpCommand(interaction) {
  const userId = interaction.user.id;

  if (isOnCooldown(userId)) {
    const timeLeft = Math.ceil((COOLDOWN_SECONDS - (Date.now() - cooldownMap.get(userId)) / 1000));
    return interaction.reply({
      content: `⏳ Aguarda **${timeLeft} segundos** antes de usar o comando novamente.`,
      ephemeral: true
    });
  }
  setCooldown(userId);

  const embed = createMainMenuEmbed();
  const navRow = createNavigationButtons();
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId('help_category_select')
    .setPlaceholder('Seleciona uma categoria')
    .addOptions([
      { label: '🚛 ETS2 / ATS', value: 'ETS2' },
      { label: '🛡️ Recrutamento PAT', value: 'Recrutamento' },
      { label: '📱 Trucky', value: 'Trucky' },
      { label: '⚙️ ETS2LA', value: 'ETS2LA' },
      { label: '🥽 VR / Meta Quest', value: 'VR' },
      { label: '🎨 Project ALM', value: 'Project ALM' },
      { label: '🎫 Tickets', value: 'Tickets' },
      { label: '🤖 Assistente IA', value: 'IA' },
    ]);

  const rowSelect = new ActionRowBuilder().addComponents(categorySelect);

  await interaction.reply({
    embeds: [embed],
    components: [rowSelect, navRow],
    ephemeral: false
  });
}

// ============================================================
// MANIPULADORES DE INTERAÇÕES (exportados)
// ============================================================
export async function handleHelpInteraction(interaction) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

  const customId = interaction.customId;

  // SELECT MENU (Categoria)
  if (customId === 'help_category_select' && interaction.isStringSelectMenu()) {
    const selected = interaction.values[0];
    if (selected === 'IA') {
      const modal = new ModalBuilder()
        .setCustomId('help_ia_modal')
        .setTitle('🤖 Pergunta à IA')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('ia_question')
              .setLabel('Escreve a tua pergunta')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Descreve o teu problema com o máximo de detalhe...')
              .setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }

    const embed = createCategoryEmbed(selected);
    const navRow = createNavigationButtons();
    await interaction.update({
      embeds: [embed],
      components: [navRow],
    });
  }

  // BOTÃO "Pesquisar"
  if (customId === 'help_search' && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId('help_search_modal')
      .setTitle('🔍 Pesquisa Personalizada')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('search_query')
            .setLabel('🔍 O que precisas de saber?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Descreve o problema com o máximo de detalhe possível.')
            .setRequired(true)
        )
      );
    return interaction.showModal(modal);
  }

  // BOTÃO "Início"
  if (customId === 'help_home' && interaction.isButton()) {
    const embed = createMainMenuEmbed();
    const navRow = createNavigationButtons();
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('help_category_select')
      .setPlaceholder('Seleciona uma categoria')
      .addOptions([
        { label: '🚛 ETS2 / ATS', value: 'ETS2' },
        { label: '🛡️ Recrutamento PAT', value: 'Recrutamento' },
        { label: '📱 Trucky', value: 'Trucky' },
        { label: '⚙️ ETS2LA', value: 'ETS2LA' },
        { label: '🥽 VR / Meta Quest', value: 'VR' },
        { label: '🎨 Project ALM', value: 'Project ALM' },
        { label: '🎫 Tickets', value: 'Tickets' },
        { label: '🤖 Assistente IA', value: 'IA' },
      ]);
    const rowSelect = new ActionRowBuilder().addComponents(categorySelect);
    return interaction.update({
      embeds: [embed],
      components: [rowSelect, navRow],
    });
  }

  // BOTÃO "Voltar"
  if (customId === 'help_back' && interaction.isButton()) {
    const embed = createMainMenuEmbed();
    const navRow = createNavigationButtons();
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('help_category_select')
      .setPlaceholder('Seleciona uma categoria')
      .addOptions([
        { label: '🚛 ETS2 / ATS', value: 'ETS2' },
        { label: '🛡️ Recrutamento PAT', value: 'Recrutamento' },
        { label: '📱 Trucky', value: 'Trucky' },
        { label: '⚙️ ETS2LA', value: 'ETS2LA' },
        { label: '🥽 VR / Meta Quest', value: 'VR' },
        { label: '🎨 Project ALM', value: 'Project ALM' },
        { label: '🎫 Tickets', value: 'Tickets' },
        { label: '🤖 Assistente IA', value: 'IA' },
      ]);
    const rowSelect = new ActionRowBuilder().addComponents(categorySelect);
    return interaction.update({
      embeds: [embed],
      components: [rowSelect, navRow],
    });
  }

  // MODAL: Pesquisa
  if (customId === 'help_search_modal' && interaction.isModalSubmit()) {
    const query = interaction.fields.getTextInputValue('search_query');
    const { intent, confidence } = detectIntent(query);

    let result = { response: '', source: '' };

    if (confidence === 'high' && intent) {
      result.response = intent.response;
      result.source = '🧠 Intenção reconhecida';
    } else {
      const faqMatch = faqData.find(f => query.toLowerCase().includes(f.pergunta.toLowerCase()) || f.pergunta.toLowerCase().includes(query.toLowerCase()));
      if (faqMatch) {
        result.response = `📖 **FAQ:** ${faqMatch.resposta}`;
        result.source = '📖 FAQ';
      } else {
        const tutorialMatch = tutoriaisData.find(t => query.toLowerCase().includes(t.titulo.toLowerCase()) || t.titulo.toLowerCase().includes(query.toLowerCase()));
        if (tutorialMatch) {
          result.response = `📚 **Tutorial:** [${tutorialMatch.titulo}](${tutorialMatch.link})\n${tutorialMatch.descricao}`;
          result.source = '📚 Tutorial';
        } else {
          result.response = 'Não encontrei informação suficiente. Por favor, abre um ticket para ajuda personalizada.';
          result.source = '📌 Sugestão';
        }
      }
    }

    if (confidence === 'medium' && intent) {
      result.response += '\n\n🤔 **Não tenho a certeza se percebi bem.** Estás à procura de ajuda sobre:\n' +
        '🚛 ETS2 / Convoys\n🛡️ Recrutamento PAT\n📱 Trucky\n⚙️ Problemas técnicos\n🎫 Tickets\n\n' +
        'Se nenhuma destas opções se adequar, usa o botão "Ticket" abaixo.';
    }

    const embed = createSearchEmbed(query, result);
    const buttons = createResponseButtons();
    const navRow = createNavigationButtons();

    await interaction.update({
      embeds: [embed],
      components: [buttons, navRow],
    });
  }

  // MODAL: IA
  if (customId === 'help_ia_modal' && interaction.isModalSubmit()) {
    const question = interaction.fields.getTextInputValue('ia_question');
    const response = 'A IA não está configurada. Por favor, usa a pesquisa ou abre um ticket.';
    const source = '📌 Aviso';

    const embed = createSearchEmbed(question, { response, source });
    const buttons = createResponseButtons();
    const navRow = createNavigationButtons();

    await interaction.update({
      embeds: [embed],
      components: [buttons, navRow],
    });
  }

  // BOTÕES DE FEEDBACK (Resolvido, Mais ajuda, Ticket)
  if (interaction.isButton() && customId.startsWith('help_')) {
    const action = customId.replace('help_', '');
    if (action === 'resolvido') {
      await interaction.update({
        content: '✅ Fico feliz em saber que a ajuda foi útil! Se precisares de mais alguma coisa, estamos aqui.',
        embeds: [],
        components: [],
      });
    } else if (action === 'mais_ajuda') {
      await interaction.update({
        content: '❌ Vamos tentar novamente. Usa a pesquisa com mais detalhes ou abre um ticket.',
        embeds: [],
        components: [createNavigationButtons()],
      });
    } else if (action === 'ticket') {
      await interaction.update({
        content: '🎫 A abrir ticket... Aguarda que um membro da equipa te atenderá em breve.',
        embeds: [],
        components: [],
      });
    }
  }
}
