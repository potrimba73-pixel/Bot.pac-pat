// src/commands/traduzir.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { startSession, endSession, getSession } = require('../utils/translationSessions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('traduzir')
    .setDescription('Inicia/termina sessão de tradução')
    .addUserOption(option =>
      option.setName('utilizador')
        .setDescription('Utilizador estrangeiro (deixar vazio para terminar)')
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
        )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.channelId;
    const staffId = interaction.user.id;
    let targetUser = interaction.options.getUser('utilizador');
    let lang = interaction.options.getString('idioma') || 'en';

    // Detectar automaticamente se respondeu a uma mensagem
    if (!targetUser && interaction.message?.reference) {
      try {
        const replied = await interaction.channel.messages.fetch(interaction.message.reference.messageId);
        if (replied && !replied.author.bot) targetUser = replied.author;
      } catch (e) {}
    }

    if (!targetUser) {
      const session = await getSession(channelId);
      if (session) {
        await endSession(channelId);
        await interaction.editReply('✅ Sessão terminada.');
      } else {
        await interaction.editReply('ℹ️ Não há sessão ativa. Mencione um utilizador para começar.');
      }
      return;
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.editReply('❌ Utilizador não encontrado.');
    }

    await startSession(channelId, staffId, targetUser.id, lang);
    await interaction.editReply(
      `🌐 **Sessão iniciada com ${targetUser.username}**\n` +
      `Idioma: ${lang.toUpperCase()}\n` +
      `Use /traduzir sem menção para terminar.`
    );
  }
};
