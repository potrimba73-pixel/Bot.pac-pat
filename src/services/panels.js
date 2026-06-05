import {
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder,
} from "discord.js";
import { CONFIG } from "../config/index.js";

export async function sendPainelGeral(channel) {
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_TICKET} Sistema de Tickets | Portugal Alfa Community`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Olá! Seja Bem-vindo ao nosso sistema de tickets oficial do Portugal Alfa Community!`,
      `${CONFIG.EMOJI_INFO} Aqui poderás abrir qualquer tipo de tickets e poder falar com um dos nossos administradores da comunidade!`,
      `${CONFIG.EMOJI_INFO} Toda a informação que for dada dentro da sala dos tickets será recolhida e analisada e será depositada em banco de dados encriptados!`,
      "",
      `${CONFIG.EMOJI_WARNING} Regras a cumprir:`,
      `${CONFIG.EMOJI_CROSS} -> Não mencionar cargo de administrador ou membro;`,
      `${CONFIG.EMOJI_CROSS} -> Não divulgar links inapropriados durante o processo;`,
      `${CONFIG.EMOJI_CROSS} -> Entre Outros….`,
      "",
      `${CONFIG.EMOJI_WARNING} Qualquer descumprimento destas regras levará ao encerramento do ticket sem aviso prévio e dependendo das situações será usado a opção de timeout de um tempo indeterminado!`,
      `${CONFIG.EMOJI_INFO} Use mas não Abuse!`
    ].join("\n"))
    .setColor(0x262af1)
    .setImage(CONFIG.IMAGEM_GERAL);
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_geral")
      .setPlaceholder(`${CONFIG.EMOJI_TICKET} Selecione uma função`)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel(`${CONFIG.EMOJI_BUGS} Bugs`).setDescription("Clica Aqui para abrir ticket de Bugs!").setValue("bugs").setEmoji(CONFIG.EMOJI_BUGS),
        new StringSelectMenuOptionBuilder().setLabel(`${CONFIG.EMOJI_DENUNCIA} Denúncia`).setDescription("Clica Aqui para abrir ticket de Denúncias!").setValue("denuncia").setEmoji(CONFIG.EMOJI_DENUNCIA),
        new StringSelectMenuOptionBuilder().setLabel(`${CONFIG.EMOJI_SUPORTE} Suporte`).setDescription("Clica Aqui para abrir ticket de Suporte!").setValue("suporte").setEmoji(CONFIG.EMOJI_SUPORTE),
        new StringSelectMenuOptionBuilder().setLabel(`${CONFIG.EMOJI_CRIADOR} Criador De Conteudo`).setDescription("Clica Aqui para abrir ticket de Criador!").setValue("criador").setEmoji(CONFIG.EMOJI_CRIADOR),
      ),
  );
  const msg = await channel.send({ embeds: [embed], components: [row] });
  return msg;
}

export async function sendPainelRecrutamento(channel) {
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_RECRUTAMENTO} Sistema de Recrutamento | Portugal Alfa Truckers`)
    .setDescription([
      `${CONFIG.EMOJI_INFO} Bem-vindo ao centro de recrutamento da Portugal Alfa Truckers!`,
      `${CONFIG.EMOJI_HEART} A amizade é o combustível que mantém a nossa VTC sempre em movimento.`,
      "",
      `${CONFIG.EMOJI_WARNING} Requisitos:`,
      `${CONFIG.EMOJI_CHECK} • Máx. 100 km/h sempre – simulação real acima de tudo.`,
      `${CONFIG.EMOJI_CHECK} • Respeito total entre membros e jogadores.`,
      `${CONFIG.EMOJI_CHECK} • Comboios = disciplina + pontualidade.`,
      `${CONFIG.EMOJI_CHECK} • Cumprir quilometragem mínima mensal: 15.000 KM/mês (≈ 500 km/dia).`,
      `${CONFIG.EMOJI_CHECK} • Foco no ranking nacional respeitando os 0 aos 100 km/h.`,
      `${CONFIG.EMOJI_CHECK} • Trucky para gerir e monitorizar toda a atividade da empresa.`,
      `${CONFIG.EMOJI_CHECK} • Aqui a estrada é amizade, não competição.`,
      "",
      `${CONFIG.EMOJI_WARNING} Aviso Importante:`,
      `${CONFIG.EMOJI_INFO} Não cumprimento dos requisitos mínimos em 60 dias pode resultar no desligamento das atividades da empresa; após esse período, o membro poderá continuar participando normalmente das demais atividades do Discord.`
    ].join("\n"))
    .setColor(0x262af1)
    .setImage(CONFIG.IMAGEM_RECRUTAMENTO);
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_recrutamento")
      .setPlaceholder(`${CONFIG.EMOJI_TICKET} Selecione uma opção`)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel(`${CONFIG.EMOJI_RECRUTAMENTO} Recrutamento PAT`).setDescription("Clique aqui para abrir ticket de Recrutamento!").setValue("recrutamento").setEmoji(CONFIG.EMOJI_RECRUTAMENTO),
        new StringSelectMenuOptionBuilder().setLabel(`${CONFIG.EMOJI_AJUDA} Pedir ajuda`).setDescription("Clique aqui para abrir ticket de ajuda use se não entender algo do recrutamento ou no trucky").setValue("ajuda").setEmoji(CONFIG.EMOJI_AJUDA),
      ),
  );
  const msg = await channel.send({ embeds: [embed], components: [row] });
  return msg;
}

export async function sendPainelRegras(channel) {
  const embed = new EmbedBuilder()
    .setTitle(`${CONFIG.EMOJI_REGRAS} Regras Gerais | Portugal Alfa Community`)
    .setDescription([
      `${CONFIG.EMOJI_CHECK} 1. Respeito e Convivência`,
      `${CONFIG.EMOJI_INFO} 1.1 Respeita todos os membros e a Equipa (Staff). Ofensas, insultos ou toxicidade não serão tolerados.`,
      `${CONFIG.EMOJI_INFO} 1.2 Diferenças de opinião são permitidas, desde que tratadas com maturidade e educação.`,
      `${CONFIG.EMOJI_INFO} 1.3 Evita comportamentos excessivos ou trollagem que possam incomodar os outros.`,
      "",
      `${CONFIG.EMOJI_CHECK} 2. Identidade e Conteúdo`,
      `${CONFIG.EMOJI_INFO} 2.1 Nomes de utilizador e avatares ofensivos ou com conteúdo explícito são proibidos.`,
      `${CONFIG.EMOJI_INFO} 2.2 É estritamente proibido partilhar imagens, vídeos ou links inapropriados (NSFW/Gore).`,
      `${CONFIG.EMOJI_INFO} 2.3 Mantém o conteúdo de acordo com o tema de cada canal.`,
      "",
      `${CONFIG.EMOJI_CHECK} 3. Divulgação e Spam`,
      `${CONFIG.EMOJI_INFO} 3.1 Divulgar outros servidores ou comunidades requer autorização prévia da Administração.`,
      `${CONFIG.EMOJI_INFO} 3.2 Publicidade de produtos ou eventos só é permitida com permissão.`,
      `${CONFIG.EMOJI_INFO} 3.3 Não envies mensagens repetitivas ou desnecessárias (Spam/Flood).`,
      "",
      `${CONFIG.EMOJI_CHECK} 4. Canais de Voz e Texto`,
      `${CONFIG.EMOJI_INFO} 4.1 Respeita o propósito de cada sala. Não perturbes a experiência dos outros membros.`,
      `${CONFIG.EMOJI_INFO} 4.2 É proibido gritar ao microfone, usar modificadores de áudio irritantes ou saturar o som.`,
      `${CONFIG.EMOJI_INFO} 4.3 Canais de suporte devem ser usados apenas para questões reais e relevantes.`,
      "",
      `${CONFIG.EMOJI_CHECK} 5. Privacidade e Segurança`,
      `${CONFIG.EMOJI_INFO} 5.1 Gravar conversas ou expor conteúdos de terceiros sem autorização é proibido.`,
      `${CONFIG.EMOJI_INFO} 5.2 Não partilhes informações pessoais (moradas, fotos, telemóvel) tuas ou de outros.`,
      "",
      `${CONFIG.EMOJI_CHECK} 6. Tolerância Zero`,
      `${CONFIG.EMOJI_INFO} 6.1 Racismo, xenofobia, homofobia ou qualquer forma de discriminação resultam em banimento imediato.`,
      `${CONFIG.EMOJI_INFO} 6.2 Discursos de ódio ou piadas ofensivas não serão tolerados.`,
      "",
      `${CONFIG.EMOJI_CHECK} 7. Conduta e Penalidades`,
      `${CONFIG.EMOJI_INFO} 7.1 Modera o uso de linguagem obscena ou palavrões.`,
      `${CONFIG.EMOJI_INFO} 7.2 As violações serão analisadas pela Staff e podem resultar em: Aviso → Mute → Kick → Ban.`,
      `${CONFIG.EMOJI_INFO} 7.3 A Staff reserva-se o direito de ajustar estas regras para garantir um ambiente saudável.`,
      "",
      `${CONFIG.EMOJI_ACEITAR} Aceitação das Regras`,
      `${CONFIG.EMOJI_INFO} Ao clicares no botão abaixo e permaneceres nesta comunidade, aceitas todos os termos de serviço. O incumprimento das regras resultará na sanção adequada.`
    ].join("\n"))
    .setColor(0x262af1)
    .setImage(CONFIG.IMAGEM_REGRAS);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("aceitar_regras").setLabel(`${CONFIG.EMOJI_ACEITAR} Aceitar Regras`).setStyle(ButtonStyle.Success),
  );
  const msg = await channel.send({ embeds: [embed], components: [row] });
  return msg;
}
