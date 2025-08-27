import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import QuoteModel, { IQuote } from '@/models/Quote.js';
import { SlashCommand } from '@/types';
import config from '@/config.js';
import type { PipelineStage } from 'mongoose';
import { PaginationManager, PaginationItem } from '@/utils/pagination.js';

// Configuration
const CONFIG = {
  AUTOCOMPLETE_LIMIT: 25,
  PAGINATION_ITEMS_PER_PAGE: 5,
  RELEVANCY_WEIGHTS: {
    exactMatch: 10,
    partialMatch: 5,
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
            .setMaxValue(10),
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
        ),
    ) as SlashCommandBuilder,

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const focusedOption = interaction.options.getFocused(true);

    if (subcommand === 'random') {
      if (focusedOption.name === 'id') {
        await handleRandomIdAutocomplete(interaction);
      } else if (focusedOption.name === 'author') {
        // For random subcommand, we don't have other filters to consider
        await handleAuthorAutocomplete(interaction, focusedOption.value);
      }
    } else if (subcommand === 'search') {
      await handleSearchAutocomplete(interaction, focusedOption);
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'random') {
      const count = interaction.options.getInteger('count') || 1;
      await handleRandomCommand(interaction, count);
    } else if (subcommand === 'search') {
      await handleSearchCommand(interaction);
    }
  },
};

/**
 * Handles autocomplete for the random ID option with dynamic filtering
 * @param interaction - The autocomplete interaction
 */
async function handleRandomIdAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const startTime = Date.now();
  try {
    // Get the author if already selected
    const selectedAuthor = interaction.options.getString('author');

    // Build query based on selected options
    const matchQuery: Record<string, unknown> = {};
    if (selectedAuthor) {
      matchQuery.author = new RegExp(`^${selectedAuthor}$`, 'i');
    }

    // Get total count with filter
    const totalQuotes = await QuoteModel.countDocuments(matchQuery);

    if (totalQuotes === 0) {
      await interaction.respond([
        {
          name: selectedAuthor
            ? `No quotes found for author "${selectedAuthor}"`
            : 'No quotes found',
          value: 0,
        },
      ]);
      return;
    }

    // Fetch quotes with proper filtering and sorting (projection optimized)
    const quotes = await QuoteModel.aggregate([
      { $match: matchQuery },
      { $sort: { _id: 1 } },
      {
        $project: {
          quote: { $substr: ['$quote', 0, 40] },
          author: 1,
          _id: 1,
        },
      },
      { $limit: Math.min(CONFIG.AUTOCOMPLETE_LIMIT, totalQuotes) },
    ]);

    // Add position numbers for each quote
    const choices = quotes.map((quote, index) => {
      const position = index + 1;
      // Quote is already truncated by projection, but handle edge cases
      const preview =
        quote.quote.length === 40 ? `${quote.quote}...` : quote.quote;

      return {
        name: `#${position}: "${preview}" - ${quote.author}`,
        value: position,
      };
    });

    await interaction.respond(choices);

    const duration = Date.now() - startTime;
    if (config.logging.performance) {
      console.log(
        `Random ID autocomplete took ${duration}ms (author: ${interaction.options.getString('author')}, results: ${choices.length})`,
      );
    }
  } catch (error) {
    console.error('Error in random ID autocomplete:', error);
    const duration = Date.now() - startTime;
    if (config.logging.debug) {
      console.log(`Random ID autocomplete failed after ${duration}ms:`, error);
    }
    await interaction.respond([{ name: 'Error retrieving quotes', value: 0 }]);
  }
}

/**
 * Handles autocomplete for the quote search command with dynamic filtering
 * @param interaction - The autocomplete interaction
 * @param focusedOption - The option currently being typed by the user
 */
async function handleSearchAutocomplete(
  interaction: AutocompleteInteraction,
  focusedOption: { name: string; value: string },
): Promise<void> {
  const startTime = Date.now();
  // Get all current option values
  const currentContent = interaction.options.getString('content');
  const currentAuthor = interaction.options.getString('author');
  const currentYear = interaction.options.getInteger('year');

  // Build base query from non-focused filled options
  const baseQuery: Record<string, unknown> = {};

  // Only add to base query if it's not the currently focused field
  if (currentAuthor && focusedOption.name !== 'author') {
    baseQuery.author = new RegExp(currentAuthor, 'i');
  }
  if (currentYear && focusedOption.name !== 'year') {
    baseQuery.year = currentYear;
  }
  if (currentContent && focusedOption.name !== 'content') {
    baseQuery.quote = new RegExp(currentContent, 'i');
  }

  let choices: { name: string; value: string | number }[];

  switch (focusedOption.name) {
    case 'content':
      choices = await getDynamicContentChoices(baseQuery, focusedOption.value);
      break;
    case 'author':
      choices = await getDynamicAuthorChoices(baseQuery, focusedOption.value);
      break;
    case 'year':
      choices = await getDynamicYearChoices(
        baseQuery,
        focusedOption.value,
        currentAuthor,
      );
      break;
    default:
      choices = [];
  }

  await interaction.respond(
    choices.length > 0
      ? choices
      : [{ name: 'No matching entries found', value: 'not_found' }],
  );

  const duration = Date.now() - startTime;
  if (config.logging.performance) {
    console.log(
      `Search autocomplete took ${duration}ms (${focusedOption.name}: ${focusedOption.value}, results: ${choices.length})`,
    );
  }
}

/**
 * Handles author autocomplete for the random subcommand
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

async function getDynamicContentChoices(
  baseQuery: Record<string, unknown>,
  value: string,
): Promise<{ name: string; value: string }[]> {
  const query = { ...baseQuery };

  if (value) {
    query.quote = new RegExp(value, 'i');
  }

  const quotes = await QuoteModel.aggregate([
    { $match: query },
    { $sort: { _id: -1 } },
    {
      $project: {
        quote: { $substr: ['$quote', 0, 80] },
        author: 1,
        year: 1,
      },
    },
    { $limit: CONFIG.AUTOCOMPLETE_LIMIT },
  ]);

  return quotes.map((quote) => {
    // Quote is already truncated by projection
    const preview = quote.quote;
    const suffix = baseQuery.author
      ? ` (${quote.year})`
      : ` - ${quote.author} (${quote.year})`;

    return {
      name: `${preview}${preview.length === 80 ? '...' : ''}${suffix}`,
      value: quote.quote,
    };
  });
}

async function getDynamicAuthorChoices(
  baseQuery: Record<string, unknown>,
  value: string,
): Promise<{ name: string; value: string }[]> {
  const matchStage = { ...baseQuery };

  if (value) {
    matchStage.author = new RegExp(value, 'i');
  }

  // Aggregate to get authors with quote counts
  const authors = await QuoteModel.aggregate<{
    _id: string;
    count: number;
    years: number[];
  }>([
    { $match: matchStage },
    {
      $group: {
        _id: '$author',
        count: { $sum: 1 },
        years: { $addToSet: '$year' },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: CONFIG.AUTOCOMPLETE_LIMIT },
  ]);

  return authors.map((author) => {
    let displayName = author._id;

    // If year is already selected in base query, don't show years
    if (baseQuery.year) {
      displayName += ` (${author.count} quote${author.count > 1 ? 's' : ''})`;
    } else {
      // Show year range and count
      const yearInfo =
        author.years.length > 1
          ? `${Math.min(...author.years)}-${Math.max(...author.years)}`
          : `${author.years[0]}`;
      displayName += ` (${yearInfo}) - ${author.count} quote${author.count > 1 ? 's' : ''}`;
    }

    return {
      name: displayName,
      value: author._id,
    };
  });
}

async function getDynamicYearChoices(
  baseQuery: Record<string, unknown>,
  value: string,
  currentAuthor?: string | null,
): Promise<{ name: string; value: number }[]> {
  const pipeline: PipelineStage[] = [{ $match: baseQuery }];

  // If searching for specific year digits
  if (value) {
    const yearNum = parseInt(value);
    if (!isNaN(yearNum)) {
      pipeline.push({
        $match: {
          year: {
            $gte: yearNum * Math.pow(10, 4 - value.length),
            $lt: (yearNum + 1) * Math.pow(10, 4 - value.length),
          },
        },
      });
    }
  }

  // Group by year and count
  pipeline.push(
    {
      $group: {
        _id: '$year',
        count: { $sum: 1 },
        authors: { $addToSet: '$author' },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: CONFIG.AUTOCOMPLETE_LIMIT },
  );

  const years = await QuoteModel.aggregate<{
    _id: number;
    count: number;
    authors: string[];
  }>(pipeline);

  return years.map((year) => {
    const info = currentAuthor
      ? `${year.count} quote${year.count > 1 ? 's' : ''}`
      : `${year.count} quote${year.count > 1 ? 's' : ''} by ${year.authors.length} author${year.authors.length > 1 ? 's' : ''}`;

    return {
      name: `${year._id} - ${info}`,
      value: year._id,
    };
  });
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

async function handleRandomCommand(
  interaction: ChatInputCommandInteraction,
  n: number,
) {
  const startTime = Date.now();
  await interaction.deferReply();

  const id = interaction.options.getInteger('id');
  const author = interaction.options.getString('author');
  let quotes: IQuote[];

  try {
    if (id) {
      // Build the match query based on author if specified
      const matchQuery: Record<string, unknown> = {};
      if (author) {
        matchQuery.author = new RegExp(`^${author}$`, 'i');
      }

      // Use aggregation with dynamic filtering
      const quote = await QuoteModel.aggregate([
        { $match: matchQuery },
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

    const duration = Date.now() - startTime;
    if (config.logging.performance) {
      console.log(
        `Random quote command took ${duration}ms (${n} quotes, id: ${id}, author: ${author})`,
      );
    }
  } catch (error) {
    console.error('Error retrieving random quotes:', error);
    const duration = Date.now() - startTime;
    if (config.logging.debug) {
      console.log(`Random quote command failed after ${duration}ms:`, error);
    }
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

async function handleSearchCommand(interaction: ChatInputCommandInteraction) {
  const startTime = Date.now();
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
    const searchResults = await searchQuotes(content, author, year);

    if (searchResults.length > 0) {
      // Convert quotes to pagination items
      const paginationItems: PaginationItem[] = searchResults.map((quote) => {
        const context = quote.context ? `, ${quote.context}` : '';
        const formattedQuote = `"${quote.quote}" — ${quote.author}${context}, ${quote.year}`;

        return {
          id: quote._id.toString(),
          title: `${quote.author} (${quote.year})`,
          description: formattedQuote,
        };
      });

      // Create search parameters summary
      const searchParams = [];
      if (content) searchParams.push(`content: "${content}"`);
      if (author) searchParams.push(`author: "${author}"`);
      if (year) searchParams.push(`year: ${year}`);

      const embedTitle = `Quote Search Results - ${searchParams.join(', ')}`;

      // Set up pagination
      const pagination = new PaginationManager(paginationItems, {
        itemsPerPage: CONFIG.PAGINATION_ITEMS_PER_PAGE,
        embedTitle,
        embedColor: 0x0099ff,
        showPageNumbers: true,
        showItemCount: true,
        timeout: 300000, // 5 minutes
      });

      await interaction.editReply({ content: 'Setting up results...' });
      const message = await interaction.fetchReply();
      await pagination.start(message);
    } else {
      await interaction.editReply({
        content: 'No matching quotes found.',
      });
    }

    const duration = Date.now() - startTime;
    if (config.logging.performance) {
      console.log(
        `Search command took ${duration}ms (content: ${content}, author: ${author}, year: ${year}, results: ${searchResults.length})`,
      );
    }
  } catch (error) {
    console.error('Error searching quotes:', error);
    const duration = Date.now() - startTime;
    if (config.logging.debug) {
      console.log(`Search command failed after ${duration}ms:`, error);
    }
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
): Promise<QuoteWithRelevance[]> {
  // Build the aggregation pipeline
  const pipeline: PipelineStage[] = [];

  // Match stage for filtering
  const matchStage: Record<string, unknown> = {};

  // Use regex for content matching (same as autocomplete)
  if (content) {
    matchStage.quote = new RegExp(content, 'i');
  }

  // Safely create regex patterns for author
  try {
    if (author) matchStage.author = new RegExp(author, 'i');
  } catch (error) {
    console.error('Invalid regex pattern:', error);
    if (author) matchStage.author = author;
  }

  if (year) matchStage.year = year;

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage } as PipelineStage);
  }

  // Sort by _id for consistent ordering
  pipeline.push({ $sort: { _id: -1 } } as PipelineStage);

  // No limit - return all matching results

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

  // Calculate content relevance
  if (content) {
    const quoteLower = quote.quote.toLowerCase();
    const contentLower = content.toLowerCase();

    if (quoteLower === contentLower) {
      relevance += CONFIG.RELEVANCY_WEIGHTS.exactMatch;
    } else if (quoteLower.includes(contentLower)) {
      relevance += CONFIG.RELEVANCY_WEIGHTS.partialMatch;
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

export default command;
