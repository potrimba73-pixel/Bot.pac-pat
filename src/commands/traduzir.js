// src/commands/traduzir.js
import { SlashCommandBuilder } from '@discordjs/builders';
import { startSession, endSession, getSession } from '../utils/translationSessions.js';

export const data = new SlashCommandBuilder()
  .setName('traduzir')
  .setDescription('Inicia/termina sessão de tradução com um utilizador estrangeiro')
  .addUserOption(option =>
    option.setName('utilizador')
      .setDescription('Utilizador alvo (deixar vazio para terminar)')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('idioma')
      .setDescription('Idioma do utilizador')
      .setRequired(false)
      .addChoices(
        { name: 'Inglês', value: 'en' },
        { name: 'Espanhol', value: 'es' },
        { name: 'Francês', value: 'fr' },
        { name: 'Alemão', value: 'de' },
        { name: 'Italiano', value: 'it' },
        { name: 'Russo', value: 'ru' }
      ));

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channelId = interaction.channelId;
  const staffId = interaction.user.id;
  let targetUser = interaction.options.getUser('utilizador');
  let lang = interaction.options.getString('idioma') || 'en';

  // Se não mencionou ninguém, mas respondeu a uma mensagem, usa o autor dela
  if (!targetUser && interaction.message?.reference) {
    try {
      const replied = await interaction.channel.messages.fetch(interaction.message.reference.messageId);
      if (replied && !replied.author.bot) targetUser = replied.author;
    } catch (_) {}
  }

  // Se ainda não há target, termina a sessão (se existir) ou avisa
  if (!targetUser) {
    const session = await getSession(channelId);
    if (session) {
      await endSession(channelId);
      await interaction.editReply('✅ Sessão de tradução terminada.');
    } else {
      await interaction.editReply('ℹ️ Não há sessão ativa. Mencione um utilizador para começar.');
    }
    return;
  }

  // Verificar se o utilizador está no servidor
  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    return interaction.editReply('❌ Utilizador não encontrado neste servidor.');
  }

  await startSession(channelId, staffId, targetUser.id, lang);
  await interaction.editReply(
    `🌐 **Sessão iniciada com ${targetUser.username}**\n` +
    `Idioma: ${lang.toUpperCase()}\n` +
    `Use \`/traduzir\` sem menção para terminar.`
  );
}
