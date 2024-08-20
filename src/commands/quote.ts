import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import QuoteModel from '@/models/Quote.js';
import { SlashCommand } from '@/types';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Retrieve or search for quotes')
    .addIntegerOption((option) =>
      option
        .setName('id')
        .setDescription('ID of the quote to retrieve (n-th entry)')
        .setMinValue(1)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('content')
        .setDescription('Search for quotes containing this text')
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName('author')
        .setDescription('Search for quotes by this author')
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('year')
        .setDescription('Search for quotes from this year')
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('n')
        .setDescription('Number of random quotes to retrieve (1-10)')
        .setMinValue(1)
        .setMaxValue(10),
    ) as SlashCommandBuilder,

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    const otherOptions = interaction.options.data.filter(
      (option) => option.name !== focusedOption.name,
    );

    let choices: { name: string; value: string | number }[] = [];

    const query: Record<string, unknown> = {};
    const totalCount = await QuoteModel.countDocuments(query);
    otherOptions.forEach((option) => {
      if (option.value) {
        if (option.name === 'content' || option.name === 'author') {
          query[option.name] = new RegExp(option.value as string, 'i');
        } else {
          query[option.name] = option.value;
        }
      }
    });

    try {
      switch (focusedOption.name) {
        case 'id':
          if (focusedOption.value === '') {
            const oldestQuotes = await QuoteModel.find(query)
              .sort({ _id: 1 })
              .limit(25)
              .lean();
            choices = oldestQuotes.map((quote, index) => ({
              name: `${index + 1}: ${quote.quote.substring(0, 50)}...`,
              value: index + 1,
            }));
          } else {
            const entryNumber = parseInt(focusedOption.value as string);
            if (!isNaN(entryNumber) && entryNumber <= totalCount) {
              const matchingQuote = await QuoteModel.findOne(query)
                .skip(entryNumber - 1)
                .limit(1)
                .lean();
              if (matchingQuote) {
                choices = [
                  {
                    name: `${entryNumber}: ${matchingQuote.quote.substring(0, 50)}...`,
                    value: entryNumber,
                  },
                ];
              }
            }
          }
          break;

        case 'content':
          if (focusedOption.value === '') {
            const randomQuotes = await QuoteModel.aggregate([
              { $match: query },
              { $sample: { size: 25 } },
            ]);
            choices = randomQuotes.map((quote) => ({
              name: quote.quote.substring(0, 100),
              value: quote.quote,
            }));
          } else {
            query.quote = new RegExp(focusedOption.value as string, 'i');
            const matchingQuotes = await QuoteModel.find(query)
              .limit(25)
              .lean();
            choices = matchingQuotes.map((quote) => ({
              name: quote.quote.substring(0, 100),
              value: quote.quote,
            }));
          }
          break;

        case 'author':
          if (focusedOption.value === '') {
            const popularAuthors = await QuoteModel.aggregate([
              { $match: query },
              { $group: { _id: '$author', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 25 },
            ]);
            choices = popularAuthors.map((author) => ({
              name: `${author._id} (${author.count} quotes)`,
              value: author._id,
            }));
          } else {
            query.author = new RegExp(focusedOption.value as string, 'i');
            const matchingAuthors = await QuoteModel.distinct('author', query);
            choices = matchingAuthors.slice(0, 25).map((author) => ({
              name: author,
              value: author,
            }));
          }
          break;

        case 'year':
          if (focusedOption.value === '') {
            const popularYears = await QuoteModel.aggregate([
              { $match: query },
              { $group: { _id: '$year', count: { $sum: 1 } } },
              { $sort: { _id: -1 } },
              { $limit: 25 },
            ]);
            choices = popularYears
              .filter(
                (year): year is { _id: number; count: number } =>
                  typeof year._id === 'number' && year._id !== null,
              )
              .map((year) => ({
                name: `${year._id} (${year.count} quotes)`,
                value: year._id,
              }));
          } else {
            const yearValue = parseInt(focusedOption.value as string);
            if (!isNaN(yearValue)) {
              query.year = yearValue;
              const matchingYears = await QuoteModel.distinct('year', query);
              choices = matchingYears
                .filter(
                  (year): year is number =>
                    typeof year === 'number' && year !== null,
                )
                .slice(0, 25)
                .map((year) => ({
                  name: year.toString(),
                  value: year,
                }));
            }
          }
          break;
      }

      await interaction.respond(
        choices.length > 0
          ? choices
          : [{ name: 'No matching entries found', value: 'not_found' }],
      );
    } catch (error) {
      console.error('Error in autocomplete:', error);
      await interaction.respond([{ name: 'Error occurred', value: 'error' }]);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const n = interaction.options.getInteger('n') || 1;
    const id = interaction.options.getInteger('id');
    const content = interaction.options.getString('content');
    const author = interaction.options.getString('author');
    const year = interaction.options.getInteger('year');

    const formatQuote = (q: typeof QuoteModel.prototype) => {
      const quoteString = `"${q.quote}"`;
      const authorString = `${q.author}`;
      const contextString = q.context ? `, ${q.context}` : '';
      const yearString = q.year ? `, ${q.year}` : '';

      return `${quoteString} — ${authorString}${contextString}${yearString}`;
    };

    let quotes;

    // Check if any search options are provided
    if (id || content || author || year) {
      const query: Record<string, unknown> = {};
      if (id) {
        quotes = [await QuoteModel.findOne().skip(id - 1)];
      } else {
        if (content) query.quote = new RegExp(content, 'i');
        if (author) query.author = new RegExp(author, 'i');
        if (year !== null) query.year = year;
        quotes = await QuoteModel.find(query).limit(n);
      }
    } else {
      // If no search options are provided, get random quotes
      const count = await QuoteModel.countDocuments();
      quotes = await QuoteModel.aggregate([
        { $sample: { size: Math.min(n, count) } },
      ]);
    }

    if (quotes && quotes.length > 0) {
      const response = quotes.map(formatQuote).join('\n\n');
      await interaction.reply(response);
    } else {
      await interaction.reply({
        content: 'No quotes found matching your criteria.',
        ephemeral: true,
      });
    }
  },
};

export default command;
