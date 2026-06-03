import { Events, type Message } from 'discord.js';
import type { Event } from '@/types.js';
import { findNicknameMatches } from '@/services/nickname.js';
import { addQuote } from '@/services/quote.js';
import {
  translateText,
  getFlagForLang,
  resolveLanguage,
} from '@/services/translation.js';
import {
  formatQuoteDisplay,
  getFormattedUserName,
} from '@/utils/formatName.js';
import { createEmbed } from '@/utils/embeds.js';

const QUOTE_REGEX = /^quote(?:\s+(.+))?$/i;
const TRANSLATE_REGEX = /^(?:translate|tr|tl)(?:\s+(.+))?$/i;

async function handleQuoteReply(
  message: Message<true>,
  context?: string,
): Promise<void> {
  try {
    const referencedMessage = await message.channel.messages.fetch(
      message.reference!.messageId!,
    );

    if (referencedMessage.author.bot) {
      await message.reply({
        content: "I can't quote bot messages.",
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    if (!referencedMessage.content.trim()) {
      await message.reply({
        content: 'That message has no text content to quote.',
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    const authorId = referencedMessage.author.id;
    const year = new Date(referencedMessage.createdTimestamp).getFullYear();

    const { name: authorName, hasName } = await getFormattedUserName(
      authorId,
      referencedMessage.author.username,
    );

    const quote = await addQuote({
      guildId: message.guild.id,
      content: referencedMessage.content,
      authorId,
      authorName,
      year,
      context,
      addedById: message.author.id,
      messageId: referencedMessage.id,
    });

    const displayText = formatQuoteDisplay(
      referencedMessage.content,
      authorName,
      year,
      context,
    );

    let response = `Quote #${quote.quoteNumber} added: ${displayText}`;

    if (!hasName) {
      response += `\n\n*Note: ${referencedMessage.author} doesn't have a name set. An admin can set it with \`/user set\`.*`;
    }

    await message.reply({
      content: response,
      allowedMentions: { repliedUser: false },
    });
  } catch (error) {
    console.error('Error adding quote from reply:', error);
    await message.reply({
      content: 'Failed to add quote. The message may have been deleted.',
      allowedMentions: { repliedUser: false },
    });
  }
}

async function handleTranslateReply(
  message: Message<true>,
  langArg?: string,
): Promise<void> {
  try {
    const referencedMessage = await message.channel.messages.fetch(
      message.reference!.messageId!,
    );

    if (!referencedMessage.content.trim()) {
      await message.reply({
        content: 'That message has no text content to translate.',
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    await message.channel.sendTyping();
    const result = await translateText(
      referencedMessage.content,
      resolveLanguage(langArg ?? 'en'),
    );

    const flag = getFlagForLang(result.targetLang);

    const embed = createEmbed()
      .setTitle(`${flag} Translation to ${result.targetLangName}`)
      .setDescription(result.translatedText)
      .setFooter({
        text: `Detected source: ${result.detectedSourceLangName}`,
      });

    await message.reply({
      embeds: [embed],
      allowedMentions: { repliedUser: false },
    });
  } catch (error) {
    console.error('Error translating message:', error);
    await message.reply({
      content: 'Translation failed. Please try again later.',
      allowedMentions: { repliedUser: false },
    });
  }
}

export const event: Event<Events.MessageCreate> = {
  name: Events.MessageCreate,
  once: false,
  async execute(message) {
    // Ignore bot messages and DMs
    if (message.author.bot || !message.guild) return;

    // Check for quote reply trigger
    if (message.reference?.messageId) {
      const match = message.content.match(QUOTE_REGEX);
      if (match) {
        await handleQuoteReply(
          message as Message<true>,
          match[1]?.trim() || undefined,
        );
        return;
      }

      const translateMatch = message.content.match(TRANSLATE_REGEX);
      if (translateMatch) {
        await handleTranslateReply(
          message as Message<true>,
          translateMatch[1]?.trim().toLowerCase() || undefined,
        );
        return;
      }
    }

    const matches = await findNicknameMatches(
      message.guild.id,
      message.content,
    );

    if (matches.length === 0) return;

    // Build mention string in order of appearance
    const mentions = matches.map((match) => `<@${match.userId}>`).join(' ');

    await message.reply({
      content: `${mentions}, someone is talking about you!`,
      allowedMentions: { users: matches.map((m) => m.userId) },
    });
  },
};
