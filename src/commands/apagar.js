// ===== MELHORIA: Apagar mensagens do BOT com transcript =====
// No ficheiro commands/apagar.js

export async function execute(interaction, client) {
  const quantidade = interaction.options.getInteger('quantidade') || 10;
  const motivo = interaction.options.getString('motivo') || 'Sem motivo especificado';
  const channel = interaction.channel;

  await interaction.deferReply({ flags: 64 });

  try {
    // Buscar mensagens do BOT
    const messages = await channel.messages.fetch({ limit: Math.min(quantidade, 100) });
    const botMessages = messages.filter(msg => msg.author.id === client.user.id);

    if (botMessages.size === 0) {
      return interaction.editReply({
        content: 'ℹ️ Nenhuma mensagem do BOT encontrada neste canal.',
        flags: 64
      });
    }

    // Gerar transcript
    let transcript = `🧹 MENSAGENS DO BOT APAGADAS\n`;
    transcript += `================================\n`;
    transcript += `Canal: ${channel.name}\n`;
    transcript += `Staff: ${interaction.user.username}\n`;
    transcript += `Motivo: ${motivo}\n`;
    transcript += `Quantidade: ${botMessages.size}\n`;
    transcript += `Data: ${new Date().toLocaleString('pt-PT')}\n`;
    transcript += `================================\n\n`;

    for (const msg of botMessages.values()) {
      transcript += `[${msg.createdAt.toLocaleString('pt-PT')}] `;
      transcript += `${msg.author.username}: `;
      transcript += msg.content || '(sem texto)';
      if (msg.attachments.size > 0) {
        transcript += ` [Anexos: ${msg.attachments.map(a => a.url).join(', ')}]`;
      }
      transcript += '\n';
    }

    // Apagar mensagens
    for (const msg of botMessages.values()) {
      await msg.delete().catch(() => {});
    }

    // Enviar transcript
    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🧹 Mensagens do BOT apagadas')
        .setDescription(
          `📊 **Quantidade:** ${botMessages.size}\n` +
          `📅 **Data:** ${new Date().toLocaleString('pt-PT')}\n` +
          `👮 **Staff:** <@${interaction.user.id}>\n` +
          `ℹ️ **Motivo:** ${motivo}`
        )
        .setColor(0xff6b6b)
        .setFooter({ text: 'Transcript gerado automaticamente' })
        .setTimestamp()
      ],
      files: [{
        attachment: Buffer.from(transcript, 'utf-8'),
        name: `bot-transcript-${Date.now()}.txt`
      }]
    });

    await interaction.editReply({
      content: `✅ ${botMessages.size} mensagens do BOT apagadas com sucesso! Transcript enviado no canal.`,
      flags: 64
    });

  } catch (error) {
    console.error('[Apagar] Erro:', error.message);
    await interaction.editReply({
      content: '❌ Ocorreu um erro ao apagar as mensagens.',
      flags: 64
    });
  }
}
