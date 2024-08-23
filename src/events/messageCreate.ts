import { Events, Message } from 'discord.js';
import QuoteModel from '@/models/Quote.js';
import UserModel from '@/models/User.js';
import { Event } from '@/types';
import { formatAuthorName } from '@/utils/helpers.js';

const event: Event<Events.MessageCreate> = {
  name: Events.MessageCreate,
  execute: async (message: Message) => {
    await handleMessageCommands(message);

    if (message.author.bot) return;

    await handleNicknameMentions(message);
  },
};

async function handleMessageCommands(message: Message): Promise<void> {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();

  if (content === 'quote' && message.reference) {
    await handleQuoteCommand(message);
  }
}

async function handleQuoteCommand(message: Message): Promise<void> {
  try {
    const referencedMessage = await message.fetchReference();
    const author = await formatAuthorName(
      referencedMessage.author.id,
      referencedMessage.author.username,
    );

    const newQuote = new QuoteModel({
      quote: referencedMessage.content,
      author: author,
      context: null,
      year: referencedMessage.createdAt.getFullYear(),
    });

    await newQuote.save();

    const quoteCount = await QuoteModel.countDocuments();

    const formattedQuote = `“${referencedMessage.content}” — ${author}, ${newQuote.year}`;

    await message.reply(
      `Quote #${quoteCount} added!\nFormatted quote: ${formattedQuote}`,
    );
  } catch (error) {
    console.error('Error adding quote:', error);
    await message.reply(
      'There was an error while adding the quote. Please try again later.',
    );
  }
}

async function handleNicknameMentions(message: Message): Promise<void> {
  // Fetch all users with nicknames
  const users = await UserModel.find({
    nicknames: { $exists: true, $ne: [] },
  });

  // Create a map of nicknames to user IDs
  const nicknameMap = new Map<string, string>();
  users.forEach((user) => {
    user.nicknames.forEach((nickname) => {
      nicknameMap.set(nickname.toLowerCase(), user.userId);
    });
  });

  // Find all perfectly matched nicknames in the message
  const words = message.content.split(/\s+/);
  const mentionedNicknames = words
    .map((word) => word.replace(/[^\w\s]/g, '').toLowerCase())
    .filter((word) => nicknameMap.has(word));

  // Mention users in the order their nicknames appeared
  if (mentionedNicknames.length > 0) {
    const mentionedUserIds = new Set(
      mentionedNicknames.map((nickname) => nicknameMap.get(nickname)),
    );
    const mentions = Array.from(mentionedUserIds).map(
      (userId) => `<@${userId}>`,
    );

    const mentionMessage = 'someone is talking about you!';
    const mentionNotification = `${mentions.join(', ')}, ${mentionMessage}`;

    await message.reply(mentionNotification);
  }
}

export default event;
