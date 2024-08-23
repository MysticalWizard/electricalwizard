import {
  AutocompleteInteraction,
  CommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
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
    ) as SlashCommandBuilder,
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focusedValue = interaction.options.getFocused();

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
  },
  execute: async (interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const quoteContent = interaction.options.getString('quote', true);
    const author = interaction.options.getString('author', true);
    const year = interaction.options.getInteger('year', true);
    const context = interaction.options.getString('context');

    try {
      const newQuote = new QuoteModel({
        quote: quoteContent,
        author,
        year,
        context,
      });

      await newQuote.save();

      const quoteCount = await QuoteModel.countDocuments();
      const formattedQuote = `“${quoteContent}” — ${author}${context ? `, ${context}` : ''}, ${year}`;

      await interaction.editReply(
        `Quote #${quoteCount} added!\nFormatted quote: ${formattedQuote}`,
      );
    } catch (error) {
      console.error('Error adding quote:', error);
      await interaction.editReply({
        content:
          'There was an error while adding the quote. Please try again later.',
      });
    }
  },
};

export default command;
