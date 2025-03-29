import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import QuoteModel, { IQuote } from '@/models/Quote.js';
import { SlashCommand } from '@/types';
import type { PipelineStage } from 'mongoose';

// Configuration
const CONFIG = {
  MAX_SEARCH_RESULTS: 10,
  LEVENSHTEIN_DISTANCE_THRESHOLD: 2,
  AUTOCOMPLETE_LIMIT: 25,
  RELEVANCY_WEIGHTS: {
    exactMatch: 10,
    partialMatch: 5,
    fuzzyMatch: 3,
  },
};

interface QuoteWithRelevance extends IQuote {
  relevance: number;
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Get a random quote or search for a quote')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('random')
        .setDescription('Retrieve random quotes or a quote by ID')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID of the quote to retrieve (n-th entry)')
            .setMinValue(1)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName('author')
            .setDescription('Retrieve quotes from this author')
            .setAutocomplete(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('Number of random quotes to retrieve (1-10)')
            .setMinValue(1)
            .setMaxValue(CONFIG.MAX_SEARCH_RESULTS),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Search for quotes by content, author, or year')
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
            .setName('count')
            .setDescription('Number of quotes to retrieve (1-10)')
            .setMinValue(1)
            .setMaxValue(CONFIG.MAX_SEARCH_RESULTS),
        ),
    ) as SlashCommandBuilder,

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const focusedOption = interaction.options.getFocused(true);

    if (subcommand === 'random') {
      if (focusedOption.name === 'id') {
        await handleRandomAutocomplete(interaction);
      } else if (focusedOption.name === 'author') {
        // Handle author autocomplete for random command
        await handleAuthorAutocomplete(interaction, focusedOption.value);
      }
    } else if (subcommand === 'search') {
      await handleSearchAutocomplete(interaction, focusedOption);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const count = interaction.options.getInteger('count') || 1;

    if (subcommand === 'random') {
      await handleRandomCommand(interaction, count);
    } else if (subcommand === 'search') {
      await handleSearchCommand(interaction, count);
    }
  },
};

/**
 * Handles autocomplete for the quote search command
 * @param interaction - The autocomplete interaction
 * @param focusedOption - The option currently being typed by the user
 */
async function handleSearchAutocomplete(
  interaction: AutocompleteInteraction,
  focusedOption: { name: string; value: string },
): Promise<void> {
  const author = interaction.options.getString('author')?.toLowerCase();
  const year = interaction.options.getInteger('year');
  const query: Record<string, unknown> = {};
  if (author) query.author = new RegExp(author, 'i');
  if (year) query.year = year;

  let choices: { name: string; value: string | number }[];

  switch (focusedOption.name) {
    case 'content':
      choices = await getContentChoices(query, focusedOption.value);
      break;
    case 'author':
      choices = await getAuthorChoices(query, focusedOption.value);
      break;
    case 'year':
      choices = await getYearChoices(query, focusedOption.value);
      break;
    default:
      choices = [];
  }

  await interaction.respond(
    choices.length > 0
      ? choices
      : [{ name: 'No matching entries found', value: 'not_found' }],
  );
}

/**
 * Handles autocomplete for author selections
 * @param interaction - The autocomplete interaction
 * @param value - The value being entered by the user
 */
async function handleAuthorAutocomplete(
  interaction: AutocompleteInteraction,
  value: string,
): Promise<void> {
  const choices = await getAuthorChoices({}, value);

  await interaction.respond(
    choices.length > 0
      ? choices
      : [{ name: 'No matching authors found', value: 'not_found' }],
  );
}

async function getContentChoices(
  query: Record<string, unknown>,
  value: string,
): Promise<{ name: string; value: string }[]> {
  if (!value) {
    const recentQuotes = await QuoteModel.find(query)
      .sort({ _id: -1 })
      .limit(CONFIG.AUTOCOMPLETE_LIMIT)
      .lean<IQuote[]>();
    return recentQuotes.map((quote) => ({
      name: quote.quote.substring(0, 100),
      value: quote.quote,
    }));
  } else {
    query.quote = new RegExp(value, 'i');
    const matchingQuotes = await QuoteModel.find(query)
      .limit(CONFIG.AUTOCOMPLETE_LIMIT)
      .lean<IQuote[]>();
    return matchingQuotes.map((quote) => ({
      name: quote.quote.substring(0, 100),
      value: quote.quote,
    }));
  }
}

async function getAuthorChoices(
  query: Record<string, unknown>,
  value: string,
): Promise<{ name: string; value: string }[]> {
  if (!value) {
    // Get distinct authors, sorted alphabetically
    const authors = await QuoteModel.aggregate<{ _id: string }>([
      { $match: query },
      { $group: { _id: '$author' } },
      { $sort: { _id: 1 } },
      { $limit: CONFIG.AUTOCOMPLETE_LIMIT },
    ]);
    return authors.map((author) => ({
      name: author._id,
      value: author._id,
    }));
  } else {
    // Find authors matching the value
    query.author = new RegExp(value, 'i');
    const matchingAuthors = await QuoteModel.distinct('author', query);
    return matchingAuthors
      .sort()
      .slice(0, CONFIG.AUTOCOMPLETE_LIMIT)
      .map((author) => ({
        name: author,
        value: author,
      }));
  }
}

async function getYearChoices(
  query: Record<string, unknown>,
  value: string,
): Promise<{ name: string; value: number }[]> {
  if (!value) {
    const years = await QuoteModel.distinct('year', query);
    return years
      .filter((year): year is number => typeof year === 'number')
      .sort((a, b) => b - a)
      .slice(0, CONFIG.AUTOCOMPLETE_LIMIT)
      .map((year) => ({
        name: year.toString(),
        value: year,
      }));
  } else {
    const yearValue = parseInt(value);
    if (!isNaN(yearValue)) {
      query.year = { $lte: yearValue };
      const matchingYears = await QuoteModel.distinct('year', query);
      return matchingYears
        .filter((year): year is number => typeof year === 'number')
        .sort((a, b) => b - a)
        .slice(0, CONFIG.AUTOCOMPLETE_LIMIT)
        .map((year) => ({
          name: year.toString(),
          value: year,
        }));
    }
    return [];
  }
}

/**
 * Handles autocomplete for the quote random command
 * @param interaction - The autocomplete interaction
 */
async function handleRandomAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  try {
    // Get the total count of quotes
    const totalQuotes = await QuoteModel.countDocuments();

    // Fetch multiple quotes in a single query with proper sorting
    const quotes = await QuoteModel.aggregate([
      { $sort: { _id: 1 } },
      { $limit: Math.min(CONFIG.AUTOCOMPLETE_LIMIT, totalQuotes) },
    ]);

    const choices = quotes.map((quote, index) => ({
      name: `#${index + 1}: "${quote.quote.substring(0, 50)}${quote.quote.length > 50 ? '...' : ''}"`,
      value: index + 1,
    }));

    await interaction.respond(choices);
  } catch (error) {
    console.error('Error in random autocomplete:', error);
    await interaction.respond([{ name: 'Error retrieving quotes', value: 0 }]);
  }
}

async function handleRandomCommand(
  interaction: ChatInputCommandInteraction,
  n: number,
) {
  await interaction.deferReply();

  const id = interaction.options.getInteger('id');
  const author = interaction.options.getString('author');
  let quotes: IQuote[];

  try {
    if (id) {
      // When ID is specified, we should use aggregation with $skip instead of findOne().skip()
      // This is more reliable when dealing with database changes
      const quote = await QuoteModel.aggregate([
        { $sort: { _id: 1 } },
        { $skip: id - 1 },
        { $limit: 1 },
      ]);
      quotes = quote.length > 0 ? quote : [];
    } else {
      // Use aggregation for efficient random selection
      const aggregation: PipelineStage[] = [];

      // Add match stage if author is specified
      if (author) {
        aggregation.push({
          $match: { author: new RegExp(`^${author}$`, 'i') },
        } as PipelineStage);
      }

      // Add sample stage for random selection
      aggregation.push({
        $sample: { size: n },
      } as PipelineStage);

      quotes = await QuoteModel.aggregate(aggregation);
    }

    if (quotes.length > 0) {
      const response = formatRandomQuotes(quotes);
      await interaction.editReply(response);
    } else {
      const noQuotesMessage = author
        ? `No quotes found for author "${author}".`
        : 'No quotes found.';

      await interaction.editReply({
        content: noQuotesMessage,
      });
    }
  } catch (error) {
    console.error('Error retrieving random quotes:', error);
    await interaction.editReply({
      content:
        'An error occurred while retrieving quotes. Please try again later.',
    });
  }
}

function formatRandomQuotes(quotes: IQuote[]): string {
  return quotes
    .map((quote) => {
      const context = quote.context ? `, ${quote.context}` : '';
      // Preserve any newlines in the original quote
      return `"${quote.quote}" — ${quote.author}${context}, ${quote.year}`;
    })
    .join('\n\n');
}

async function handleSearchCommand(
  interaction: ChatInputCommandInteraction,
  n: number,
) {
  await interaction.deferReply();

  const content = interaction.options.getString('content') ?? undefined;
  const author = interaction.options.getString('author') ?? undefined;
  const year = interaction.options.getInteger('year') ?? undefined;

  // Handle the case where autocomplete returned not_found
  if (content === 'not_found' || author === 'not_found') {
    await interaction.editReply({
      content: 'Please provide valid search parameters.',
    });
    return;
  }

  if (!content && !author && !year) {
    await interaction.editReply({
      content: 'Please provide at least one search parameter.',
    });
    return;
  }

  try {
    const searchResults = await searchQuotes(content, author, year, n);

    if (searchResults.length > 0) {
      const response = formatSearchResults(searchResults);
      await interaction.editReply(response);
    } else {
      await interaction.editReply({
        content: 'No matching quotes found.',
      });
    }
  } catch (error) {
    console.error('Error searching quotes:', error);
    await interaction.editReply({
      content:
        'An error occurred while searching quotes. Please try again later.',
    });
  }
}

async function searchQuotes(
  content?: string,
  author?: string,
  year?: number,
  count: number = 1,
): Promise<QuoteWithRelevance[]> {
  // Build the aggregation pipeline
  const pipeline: PipelineStage[] = [];

  // Match stage for filtering
  const matchStage: Record<string, unknown> = {};

  // Safely create regex patterns
  try {
    if (content) matchStage.quote = new RegExp(content, 'i');
    if (author) matchStage.author = new RegExp(author, 'i');
  } catch (error) {
    console.error('Invalid regex pattern:', error);
    // Default to something that can be searched safely
    if (content) matchStage.quote = content;
    if (author) matchStage.author = author;
  }

  if (year) matchStage.year = year;

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage } as PipelineStage);
  }

  // Add limit
  pipeline.push({ $limit: count } as PipelineStage);

  // Execute the pipeline
  const quotes = await QuoteModel.aggregate(pipeline);

  // Calculate relevance scores for sorting
  return quotes
    .map(
      (quote: IQuote) =>
        ({
          ...quote,
          relevance: calculateRelevance(quote, content, author, year),
        }) as QuoteWithRelevance,
    )
    .sort((a, b) => b.relevance - a.relevance);
}

function calculateRelevance(
  quote: IQuote,
  content?: string,
  author?: string,
  year?: number,
): number {
  let relevance = 0;

  if (content) {
    const quoteLower = quote.quote.toLowerCase();
    const contentLower = content.toLowerCase();

    if (quoteLower === contentLower) {
      relevance += CONFIG.RELEVANCY_WEIGHTS.exactMatch;
    } else if (quoteLower.includes(contentLower)) {
      relevance += CONFIG.RELEVANCY_WEIGHTS.partialMatch;
    } else if (
      levenshteinDistance(quoteLower, contentLower) <=
      CONFIG.LEVENSHTEIN_DISTANCE_THRESHOLD
    ) {
      relevance += CONFIG.RELEVANCY_WEIGHTS.fuzzyMatch;
    }
  }

  if (author && quote.author.toLowerCase() === author.toLowerCase()) {
    relevance += CONFIG.RELEVANCY_WEIGHTS.exactMatch;
  }

  if (year && quote.year === year) {
    relevance += CONFIG.RELEVANCY_WEIGHTS.exactMatch;
  }

  return relevance;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j] + 1,
        );
      }
    }
  }

  return dp[m][n];
}

function formatSearchResults(quotes: QuoteWithRelevance[]): string {
  return quotes
    .map((quote) => {
      // For multi-line quotes, handle each line with a quote marker
      const quoteLines = quote.quote.split('\n');
      const formattedQuote = quoteLines.map((line) => `> "${line}"`).join('\n');

      return `**${quote.author}**, ${quote.year}\n${formattedQuote}`;
    })
    .join('\n\n');
}

export default command;
