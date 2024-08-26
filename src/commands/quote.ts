import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import QuoteModel, { IQuote } from '@/models/Quote.js';
import { SlashCommand } from '@/types';

// Configuration
const CONFIG = {
  MAX_SEARCH_RESULTS: 5,
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
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('Number of random quotes to retrieve (1-5)')
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
            .setDescription('Number of quotes to retrieve (1-5)')
            .setMinValue(1)
            .setMaxValue(CONFIG.MAX_SEARCH_RESULTS),
        ),
    ) as SlashCommandBuilder,

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const focusedOption = interaction.options.getFocused(true);

    if (subcommand === 'random' && focusedOption.name === 'id') {
      await handleRandomAutocomplete(interaction);
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
    const recentAuthors = await QuoteModel.aggregate<{ _id: string }>([
      { $match: query },
      { $group: { _id: '$author' } },
      { $sort: { _id: 1 } },
      { $limit: CONFIG.AUTOCOMPLETE_LIMIT },
    ]);
    return recentAuthors.map((author) => ({
      name: author._id,
      value: author._id,
    }));
  } else {
    query.author = new RegExp(value, 'i');
    const matchingAuthors = await QuoteModel.distinct('author', query);
    return matchingAuthors
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
  const totalQuotes = await QuoteModel.countDocuments();
  const choices: { name: string; value: number }[] = [];

  for (let i = 1; i <= Math.min(CONFIG.AUTOCOMPLETE_LIMIT, totalQuotes); i++) {
    const quote = await QuoteModel.findOne()
      .skip(i - 1)
      .lean<IQuote>();
    if (quote) {
      choices.push({
        name: `#${i}: ${quote.quote.substring(0, 50)}...`,
        value: i,
      });
    }
  }

  await interaction.respond(choices);
}

async function handleRandomCommand(
  interaction: ChatInputCommandInteraction,
  n: number,
) {
  const id = interaction.options.getInteger('id');
  let quotes: IQuote[];

  if (id) {
    const quote = await QuoteModel.findOne()
      .skip(id - 1)
      .lean<IQuote>();
    quotes = quote ? [quote] : [];
  } else {
    const totalQuotes = await QuoteModel.countDocuments();
    const randomIndices = Array.from({ length: n }, () =>
      Math.floor(Math.random() * totalQuotes),
    );
    const randomQuotes = await Promise.all(
      randomIndices.map((index) =>
        QuoteModel.findOne().skip(index).lean<IQuote>(),
      ),
    );
    quotes = randomQuotes.filter((quote): quote is IQuote => quote !== null);
  }

  if (quotes.length > 0) {
    const response = formatRandomQuotes(quotes);
    await interaction.reply(response);
  } else {
    await interaction.reply({
      content: 'No quotes found.',
      ephemeral: true,
    });
  }
}

function formatRandomQuotes(quotes: IQuote[]): string {
  return quotes
    .map((quote) => {
      const context = quote.context ? `, ${quote.context}` : '';
      return `“${quote.quote}” — ${quote.author}${context}, ${quote.year}`;
    })
    .join('\n\n');
}

async function handleSearchCommand(
  interaction: ChatInputCommandInteraction,
  n: number,
) {
  const content = interaction.options.getString('content') ?? undefined;
  const author = interaction.options.getString('author') ?? undefined;
  const year = interaction.options.getInteger('year') ?? undefined;

  if (!content && !author && !year) {
    await interaction.reply({
      content: 'Please provide at least one search parameter.',
      ephemeral: true,
    });
    return;
  }

  const searchResults = await searchQuotes(content, author, year, n);

  if (searchResults.length > 0) {
    const response = await formatSearchResults(searchResults);
    await interaction.reply(response);
  } else {
    await interaction.reply({
      content: 'No matching quotes found.',
      ephemeral: true,
    });
  }
}

async function searchQuotes(
  content?: string,
  author?: string,
  year?: number,
  count: number = 1,
): Promise<QuoteWithRelevance[]> {
  const query: Record<string, unknown> = {};

  if (content) query.quote = new RegExp(content, 'i');
  if (author) query.author = new RegExp(author, 'i');
  if (year) query.year = year;

  const quotes = await QuoteModel.find(query).limit(count).lean<IQuote[]>();

  return quotes.map(
    (quote: IQuote) =>
      ({
        ...quote,
        relevance: calculateRelevance(quote, content, author, year),
      }) as QuoteWithRelevance,
  );
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

async function formatSearchResults(
  quotes: QuoteWithRelevance[],
): Promise<string> {
  return quotes
    .map(
      (quote) =>
        `**${quote.author}**, ${quote.year}\n> ${quote.quote} (Relevance: ${quote.relevance})`,
    )
    .join('\n\n');
}

export default command;
