import {
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder,
} from "discord.js";
import { CONFIG } from "../config/index.js";

export async function sendPainelGeral(channel) {
  const embed = new EmbedBuilder()
    .setTitle(`🎫 Sistema de Tickets | Portugal Alfa Community`)
    .setDescription([
      `ℹ️ Olá! Seja bem-vindo ao sistema oficial de tickets da Portugal Alfa Community.`,
      ``,
      `ℹ️ Através deste sistema poderás contactar a nossa equipa para solicitar suporte, reportar problemas, apresentar denúncias ou esclarecer qualquer dúvida relacionada com a comunidade.`,
      ``,
      `⚠️ Regras do Sistema`,
      ``,
      `❌ ➜ Não menciones (ping) membros da equipa sem necessidade.`,
      `❌ ➜ Não partilhes links, ficheiros ou qualquer conteúdo inadequado.`,
      `❌ ➜ Mantém uma linguagem respeitosa durante todo o atendimento.`,
      `❌ ➜ Abre apenas um ticket por assunto.`,
      ``,
      `⚠️ Importante`,
      ``,
      `O incumprimento destas regras poderá resultar no encerramento do ticket sem aviso prévio e, consoante a gravidade da situação, na aplicação das medidas disciplinares consideradas adequadas pela equipa.`,
      ``,
      `ℹ️ Agradecemos a tua colaboração e desejamos-te boas viagens!`
    ].join("\n"))
    .setColor(0x262af1)
    .setImage(CONFIG.IMAGEM_GERAL);

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_geral")
      .setPlaceholder(`🎫 Selecione uma função`)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel(`🐛 Bugs`).setDescription("Clica aqui para abrir ticket de Bugs!").setValue("bugs").setEmoji("🐛"),
        new StringSelectMenuOptionBuilder().setLabel(`🚨 Denúncia`).setDescription("Clica aqui para abrir ticket de Denúncias!").setValue("denuncia").setEmoji("🚨"),
        new StringSelectMenuOptionBuilder().setLabel(`🔧 Suporte`).setDescription("Clica aqui para abrir ticket de Suporte!").setValue("suporte").setEmoji("🔧"),
        new StringSelectMenuOptionBuilder().setLabel(`🎥 Criador De Conteúdo`).setDescription("Clica aqui para abrir ticket de Criador!").setValue("criador").setEmoji("🎥"),
      ),
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  return msg;
}

export async function sendPainelRecrutamento(channel) {
  const embed = new EmbedBuilder()
    .setTitle(`📝 Sistema de Recrutamento | Portugal Alfa Truckers`)
    .setDescription([
      `ℹ️ Bem-vindo ao sistema oficial de recrutamento da Portugal Alfa Truckers.`,
      ``,
      `❤️ A amizade é o combustível que mantém a nossa VTC em movimento.`,
      ``,
      `Se pretendes fazer parte da nossa VTC, consulta os requisitos abaixo e certifica-te de que estás preparado para cumprir as normas e objetivos da empresa.`,
      ``,
      `⚠️ Requisitos de Adesão`,
      ``,
      `➜ Velocidade: Respeitar o limite máximo de 100 km/h, privilegiando uma condução realista.`,
      `➜ Conduta: Manter uma atitude respeitosa para com todos os membros e restantes jogadores.`,
      `➜ Comboios: Participar nos comboios com disciplina, pontualidade e espírito de equipa.`,
      `➜ Quilometragem: Cumprir a meta mínima de 15.000 km por mês (≈ 500 km/dia).`,
      `➜ Ranking: Contribuir para o desempenho da empresa no ranking nacional, respeitando sempre o limite de velocidade.`,
      `➜ Trucky: Utilização obrigatória para o registo e acompanhamento da atividade da empresa.`,
      ``,
      `⚠️ Aviso Importante`,
      ``,
      `O incumprimento dos requisitos mínimos durante um período de 60 dias poderá resultar na remoção da VTC. No entanto, o membro continuará a ter acesso às restantes áreas da comunidade e ao servidor Discord.`,
      ``,
      `ℹ️ Obrigado pelo teu interesse. Esperamos ver-te em breve na estrada!`
    ].join("\n"))
    .setColor(0x262af1)
    .setImage(CONFIG.IMAGEM_RECRUTAMENTO);

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_recruitamento")
      .setPlaceholder(`🎫 Selecione uma opção`)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel(`📝 Recrutamento PAT`).setDescription("Clique aqui para abrir ticket de Recrutamento!").setValue("recrutamento").setEmoji("📝"),
        new StringSelectMenuOptionBuilder().setLabel(`❓ Pedir ajuda`).setDescription("Clique aqui para abrir ticket de ajuda use se não entender algo do recrutamento ou no trucky").setValue("ajuda").setEmoji("❓"),
      ),
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  return msg;
}

export async function sendPainelRegras(channel) {
  const embed = new EmbedBuilder()
    .setTitle(`📋 Regras Gerais e Sistemas | Portugal Alfa Community`)
    .setDescription([
      `**1. Respeito e Convivência**`,
      `• 1.1 Respeita todos os membros e a equipa de administração (Staff). Ofensas, insultos ou toxicidade não serão tolerados.`,
      `• 1.2 Divergências de opinião são permitidas, desde que tratadas com maturidade e educação.`,
      `• 1.3 Evita comportamentos excessivos ou provocações (trollagem) que possam incomodar os outros.`,
      ``,
      `**2. Identidade e Conteúdo**`,
      `• 2.1 Nomes de utilizador e avatares ofensivos ou com conteúdo explícito são proibidos.`,
      `• 2.2 É estritamente proibido partilhar imagens, vídeos ou links inapropriados (NSFW/Gore).`,
      `• 2.3 Mantém o conteúdo de acordo com o tema de cada canal.`,
      ``,
      `**3. Divulgação e Spam**`,
      `• 3.1 Divulgar outros servidores ou comunidades requer autorização prévia da Administração.`,
      `• 3.2 A publicidade a produtos ou eventos só é permitida com autorização expressa.`,
      `• 3.3 Não envies mensagens repetitivas ou desnecessárias (Spam/Flood).`,
      ``,
      `**4. Canais de Voz e Texto**`,
      `• 4.1 Respeita o propósito de cada sala. Não prejudiques a experiência dos outros membros.`,
      `• 4.2 É proibido gritar ao microfone, usar modificadores de áudio irritantes ou saturar o som.`,
      `• 4.3 Os canais de suporte devem ser usados apenas para questões reais e relevantes.`,
      ``,
      `**5. Privacidade e Segurança**`,
      `• 5.1 Gravar conversas ou expor conteúdos de terceiros sem autorização é estritamente proibido.`,
      `• 5.2 Não partilhes informações pessoais (moradas, fotos, número de telemóvel) tuas ou de outros membros.`,
      ``,
      `**6. Tolerância Zero**`,
      `• 6.1 Racismo, xenofobia, homofobia ou qualquer forma de discriminação resultarão em banimento imediato.`,
      `• 6.2 Discurso de ódio ou piadas ofensivas não serão tolerados.`,
      ``,
      `**7. Conduta e Penalidades**`,
      `• 7.1 Modera o uso de linguagem obscena ou palavrões.`,
      `• 7.2 As infrações serão analisadas pela Staff e podem resultar em: Aviso -> Mute -> Kick -> Ban.`,
      `• 7.3 A Staff reserva-se o direito de ajustar estas regras a qualquer momento para garantir um ambiente saudável.`,
      ``,
      `**Aceitação das Regras**`,
      `Ao clicares no botão abaixo e permaneceres nesta comunidade, confirmas que leste e aceitas todas as regras. O incumprimento das mesmas resultará na aplicação da sanção adequada.`
    ].join("\n"))
    .setColor(0x262af1)
    .setImage(CONFIG.IMAGEM_REGRAS);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("aceitar_regras").setLabel(`✅ Aceitar Regras`).setStyle(ButtonStyle.Success),
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  return msg;
}
