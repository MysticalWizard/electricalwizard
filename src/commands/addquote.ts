import {
  AutocompleteInteraction,
  CommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { Types } from 'mongoose';
import QuoteModel from '@/models/Quote.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('addquote')
    .setDescription('Adds a quote.')
    .addStringOption((option) =>
      option
        .setName('quote')
        .setDescription('The infamous quote to be recorded in history.')
        .setMaxLength(1000)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('author')
        .setDescription('The GOAT author of this priceless quote.')
        .setMaxLength(40)
        .setAutocomplete(true)
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('year')
        .setDescription('The year when this quote was born.')
        .setMinValue(0)
        .setMaxValue(new Date().getFullYear() + 1)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('context')
        .setDescription('Give context for this quowote. (optional)'),
    )
    .addStringOption((option) =>
      option
        .setName('link')
        .setDescription('Allows chaining this quote to another quote.')
        .setAutocomplete(true),
    ) as SlashCommandBuilder,
  cooldown: 5,

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'author') {
      // Existing author autocomplete logic
      const focusedValue = focusedOption.value;

      // Fetch the 5 most popular authors
      const popularAuthors = await QuoteModel.aggregate([
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, author: '$_id' } },
      ]);

      // Fetch the most recent author
      const recentAuthor = await QuoteModel.findOne()
        .sort({ _id: -1 })
        .select('author');

      // Combine popular authors and recent author, removing duplicates
      const choices = [
        ...new Set([
          ...popularAuthors.map((a) => a.author),
          recentAuthor ? recentAuthor.author : '',
        ]),
      ].filter(Boolean);

      const filtered = choices.filter((choice) =>
        choice.toLowerCase().startsWith(focusedValue.toLowerCase()),
      );
      await interaction.respond(
        filtered.map((choice) => ({ name: choice, value: choice })),
      );
    } else if (focusedOption.name === 'link') {
      // Fetch the 5 most recent quotes
      const recentQuotes = await QuoteModel.find()
        .sort({ _id: -1 })
        .limit(5)
        .lean();

      const choices = recentQuotes.map((quote) => ({
        name: `${quote.quote.substring(0, 50)}...`,
        value: quote._id.toString(),
      }));

      await interaction.respond(choices);
    }
  },

  execute: async (interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const quoteContent = interaction.options.getString('quote', true);
    const author = interaction.options.getString('author', true);
    const year = interaction.options.getInteger('year', true);
    const context = interaction.options.getString('context');
    const linkId = interaction.options.getString('link');

    try {
      if (linkId) {
        // Check for double links
        const existingLink = await QuoteModel.findOne({ link: linkId });
        if (existingLink) {
          await interaction.editReply(
            'Error: Double link. This quote is already linked to another quote.',
          );
          return;
        }

        // Check for circular links and maximum chain length
        const chainLength = await checkCircularAndChainLength(linkId);
        if (chainLength === -1) {
          await interaction.editReply('Error: Circular link detected.');
          return;
        }
        if (chainLength >= 5) {
          await interaction.editReply(
            'Error: Maximum chain length (5) reached.',
          );
          return;
        }
      }

      const newQuote = new QuoteModel({
        quote: quoteContent,
        author,
        year,
        context,
        link: linkId ? new Types.ObjectId(linkId) : undefined,
      });

      await newQuote.save();

      const quoteCount = await QuoteModel.countDocuments();
      const formattedQuote = `"${quoteContent}" — ${author}${context ? `, ${context}` : ''}, ${year}`;

      let replyContent = `Quote #${quoteCount} added!\nFormatted quote: ${formattedQuote}`;

      if (linkId) {
        const linkedQuote = await QuoteModel.findById(linkId);
        if (linkedQuote) {
          const truncatedQuote =
            linkedQuote.quote.length > 50
              ? `${linkedQuote.quote.substring(0, 50)}...`
              : linkedQuote.quote;
          replyContent += `\nLinked to: "${truncatedQuote}" (#${linkedQuote._id})`;
        }
      }

      await interaction.editReply(replyContent);
    } catch (error) {
      console.error('Error adding quote:', error);
      await interaction.editReply({
        content:
          'There was an error while adding the quote. Please try again later.',
      });
    }
  },
};

async function checkCircularAndChainLength(
  quoteId: string,
  visited: Set<string> = new Set(),
): Promise<number> {
  if (visited.has(quoteId)) {
    return -1; // Circular link detected
  }

  visited.add(quoteId);
  const quote = await QuoteModel.findById(quoteId);

  if (!quote || !quote.link) {
    return visited.size;
  }

  return checkCircularAndChainLength(quote.link.toString(), visited);
}

export default command;
