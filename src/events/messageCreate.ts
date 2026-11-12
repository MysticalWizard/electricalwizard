import { Events, type Message, type MessageMentionOptions } from 'discord.js';
import type { Event } from '#/types.js';
import { findNicknameMatches } from '#/services/nickname.js';
import { addQuote, findDuplicateQuote } from '#/services/quote.js';
import {
  translateText,
  getFlagForLang,
  resolveLanguage,
  countTranslation,
} from '#/services/translation.js';
import {
  formatQuoteDisplay,
  getFormattedUserName,
} from '#/utils/formatName.js';
import { createEmbed } from '#/utils/embeds.js';
import { Cooldown } from '#/utils/cooldown.js';
import {
  clip,
  EMBED_DESCRIPTION_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
} from '#/utils/messageLimit.js';

const QUOTE_REGEX = /^quote(?:\s+(.+))?$/i;
const TRANSLATE_REGEX = /^(?:translate|tr|tl)(?:\s+(.+))?$/i;

// Replies echo other people's text, so nothing in them may ping anyone. A
// per-message value replaces the client's default rather than merging with
// it, so `parse` has to be repeated here.
const NO_PINGS: MessageMentionOptions = { parse: [], repliedUser: false };

const quoteCooldown = new Cooldown(5_000);

// Each translation is a call to a rate-limited API that can take a while, so
// a user may start one every few seconds and only a few run at once
const translateCooldown = new Cooldown(5_000);
const MAX_ACTIVE_TRANSLATIONS = 3;
let activeTranslations = 0;
// Language names and codes are short; anything longer is a prompt
const MAX_LANG_ARG_LENGTH = 64;

/** Mark a trigger that was ignored for coming too soon. */
async function reactTooSoon(message: Message): Promise<void> {
  await message.react('⏳').catch(() => {});
}

async function handleQuoteReply(
  message: Message<true>,
  context?: string,
): Promise<void> {
  if (quoteCooldown.take(message.author.id) > 0) {
    await reactTooSoon(message);
    return;
  }

  try {
    const referencedMessage = await message.channel.messages.fetch(
      message.reference!.messageId!,
    );

    if (referencedMessage.author.bot) {
      await message.reply({
        content: "I can't quote bot messages.",
        allowedMentions: NO_PINGS,
      });
      return;
    }

    if (!referencedMessage.content.trim()) {
      await message.reply({
        content: 'That message has no text content to quote.',
        allowedMentions: NO_PINGS,
      });
      return;
    }

    const authorId = referencedMessage.author.id;
    const year = new Date(referencedMessage.createdTimestamp).getFullYear();

    const { name: authorName, hasName } = await getFormattedUserName(
      authorId,
      referencedMessage.author.username,
    );

    const duplicate = await findDuplicateQuote(
      message.guild.id,
      referencedMessage.content,
      authorId,
      authorName,
    );
    if (duplicate) {
      await message.reply({
        content: `This quote already exists as #${duplicate.quoteNumber}.`,
        allowedMentions: NO_PINGS,
      });
      return;
    }

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

    const note = hasName
      ? ''
      : `\n\n*Note: ${referencedMessage.author} doesn't have a name set. An admin can set it with \`/user set\`.*`;
    const response =
      clip(
        `Quote #${quote.quoteNumber} added: ${displayText}`,
        MESSAGE_MAX_LENGTH - note.length,
      ) + note;

    await message.reply({
      content: response,
      allowedMentions: NO_PINGS,
    });
  } catch (error) {
    console.error('Error adding quote from reply:', error);
    await message.reply({
      content: 'Failed to add quote. The message may have been deleted.',
      allowedMentions: NO_PINGS,
    });
  }
}

async function handleTranslateReply(
  message: Message<true>,
  langArg?: string,
): Promise<void> {
  if (langArg && langArg.length > MAX_LANG_ARG_LENGTH) {
    await message.reply({
      content: `Give a language name or code of up to ${MAX_LANG_ARG_LENGTH} characters.`,
      allowedMentions: NO_PINGS,
    });
    return;
  }
  if (
    activeTranslations >= MAX_ACTIVE_TRANSLATIONS ||
    translateCooldown.take(message.author.id) > 0
  ) {
    await reactTooSoon(message);
    return;
  }

  activeTranslations++;
  let succeeded = false;
  try {
    const referencedMessage = await message.channel.messages.fetch(
      message.reference!.messageId!,
    );

    if (!referencedMessage.content.trim()) {
      await message.reply({
        content: 'That message has no text content to translate.',
        allowedMentions: NO_PINGS,
      });
      return;
    }

    await message.channel.sendTyping();
    const result = await translateText(
      referencedMessage.content,
      resolveLanguage(langArg ?? 'en'),
    );

    const flag = getFlagForLang(result.targetLang, result.targetLangEmoji);

    const embed = createEmbed()
      .setTitle(`${flag} Translation to ${result.targetLangName}`)
      .setDescription(clip(result.translatedText, EMBED_DESCRIPTION_MAX_LENGTH))
      .setFooter({
        text: `Detected source: ${result.detectedSourceLangName}`,
      });

    await message.reply({
      embeds: [embed],
      allowedMentions: NO_PINGS,
    });
    succeeded = true;
  } catch (error) {
    console.error('Error translating message:', error);
    await message.reply({
      content: 'Translation failed. Please try again later.',
      allowedMentions: NO_PINGS,
    });
  } finally {
    activeTranslations--;
    countTranslation(message.guildId, succeeded).catch((error: unknown) => {
      console.error('Failed to count translation:', error);
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
