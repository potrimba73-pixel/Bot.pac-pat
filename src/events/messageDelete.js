import { EmbedBuilder } from "discord.js";
import { CONFIG } from "../config/index.js";
import { logExternalMessageDelete } from "../services/externalLogs.js";

export async function handleMessageDelete(message) {
  if (message.author?.bot) return;
  if (!message.guild) return;

  // Log externo
  try {
    await logExternalMessageDelete(message);
  } catch (e) {
    // Silencioso - não crasha se o log externo falhar
  }

  // Obter o canal de logs interno do bot
  const logChannel = await message.guild.channels.fetch(CONFIG.CANAL_LOGS).catch(() => null);
  if (!logChannel) return;

  const author = message.author;
  const conteudo = message.content ? `\`\`\`\n${message.content}\n\`\`\`` : "`Sem conteúdo de texto`";

  // Criar o Embed estilo Loritta
  const embed = new EmbedBuilder()
    .setColor(0xED4245) // Cor Vermelha
    .setAuthor({ 
      name: `@${author.username}`, 
      iconURL: author.displayAvatarURL({ dynamic: true }) 
    })
    .setTitle("📝 Mensagem de texto deletada")
    .addFields(
      { name: "Canal de texto:", value: `🔊・${message.channel.name}`, inline: false },
      { name: "Mensagem:", value: conteudo, inline: false }
    );

  // Se a mensagem tiver imagens ou ficheiros anexados
  if (message.attachments.size > 0) {
    const anexosLista = message.attachments.map(a => `🔗 [${a.name}](${a.url})`).join("\n");
    embed.addFields({ name: "Arquivos anexados:", value: anexosLista, inline: false });

    // Define a primeira imagem como preview visual no Embed
    const primeiraImagem = message.attachments.find(a => a.contentType?.startsWith("image/"));
    if (primeiraImagem) {
      embed.setImage(primeiraImagem.url);
    }
  }

  // Rodapé com ID e Data
  embed.setFooter({ text: `ID do usuário: ${author.id}` });
  embed.setTimestamp(message.createdAt);

  return logChannel.send({ embeds: [embed] });
}
