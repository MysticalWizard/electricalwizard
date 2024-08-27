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
        .setDescription('id of the quote to link to. (optional)')
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('override')
        .setDescription('id of the quote to override. (Use with caution!)')
        .setAutocomplete(true),
    ) as SlashCommandBuilder,
  cooldown: 5,

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'author') {
      await handleAuthorAutocomplete(interaction, focusedOption.value);
    } else if (
      focusedOption.name === 'link' ||
      focusedOption.name === 'override'
    ) {
      await handleQuoteAutocomplete(interaction, 5);
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
    const overrideId = interaction.options.getString('override');

    try {
      if (overrideId) {
        // Check if the quote to override exists
        const existingQuote = await QuoteModel.findById(overrideId);
        if (!existingQuote) {
          await interaction.editReply('Error: Quote to override not found.');
          return;
        }

        // Update the existing quote
        existingQuote.quote = quoteContent;
        existingQuote.author = author;
        existingQuote.year = year;
        if (context) {
          existingQuote.context = context;
        }
        if (linkId) {
          existingQuote.link = new Types.ObjectId(linkId);
        }

        await existingQuote.save();

        const formattedQuote = `"${quoteContent}" — ${author}${context ? `, ${context}` : ''}, ${year}`;
        await interaction.editReply(
          `Quote #${overrideId} updated!\nFormatted quote: ${formattedQuote}`,
        );
      } else {
        // Existing code for adding a new quote
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
      }
    } catch (error) {
      console.error('Error adding or updating quote:', error);
      await interaction.editReply({
        content:
          'There was an error while adding or updating the quote. Please try again later.',
      });
    }
  },
};

async function handleAuthorAutocomplete(
  interaction: AutocompleteInteraction,
  focusedValue: string,
) {
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
}

async function handleQuoteAutocomplete(
  interaction: AutocompleteInteraction,
  count: number,
) {
  // Fetch the 5 most recent quotes
  const recentQuotes = await QuoteModel.find()
    .sort({ _id: -1 })
    .limit(count)
    .lean();

  const choices = recentQuotes.map((quote) => ({
    name: `${quote.quote.substring(0, 50)}...`,
    value: quote._id.toString(),
  }));

  await interaction.respond(choices);
}

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
