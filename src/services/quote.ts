import { Counter, Quote, type IQuote } from '@/models/Quote.js';
import { User } from '@/models/User.js';
import { formatNameWithInitials } from '@/utils/formatName.js';

export interface AddQuoteData {
  guildId: string;
  content: string;
  authorId?: string | undefined;
  authorName?: string | undefined;
  year: number;
  context?: string | undefined;
  addedById?: string | undefined;
  messageId?: string | undefined;
}

/**
 * Check if a duplicate quote exists (same content + author)
 */
export async function findDuplicateQuote(
  guildId: string,
  content: string,
  authorId?: string,
  authorName?: string,
): Promise<IQuote | null> {
  const normalizedContent = content.trim().toLowerCase();

  const query: Record<string, unknown> = {
    guildId,
  };

  if (authorId) {
    query.authorId = authorId;
  } else if (authorName) {
    query.authorName = {
      $regex: new RegExp(
        `^${authorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i',
      ),
    };
  }

  const quotes = await Quote.find(query).lean();

  return (
    quotes.find((q) => q.content.trim().toLowerCase() === normalizedContent) ??
    null
  );
}

/**
 * Add a new quote to a guild
 */
export async function addQuote(data: AddQuoteData): Promise<IQuote> {
  const quote = new Quote({
    guildId: data.guildId,
    content: data.content,
    year: data.year,
    authorId: data.authorId,
    authorName: data.authorName,
    context: data.context,
    addedById: data.addedById,
    messageId: data.messageId,
  });

  return quote.save();
}

/**
 * Get a specific quote by number
 */
export async function getQuoteByNumber(
  guildId: string,
  quoteNumber: number,
): Promise<IQuote | null> {
  return Quote.findOne({ guildId, quoteNumber }).lean();
}

/**
 * Get random quotes from a guild
 */
export async function getRandomQuotes(
  guildId: string,
  count: number = 1,
): Promise<IQuote[]> {
  return Quote.aggregate([
    { $match: { guildId } },
    { $sample: { size: count } },
  ]);
}

/**
 * Get quotes filtered by author
 */
export async function getQuotesByAuthor(
  guildId: string,
  authorId: string,
  count: number = 1,
): Promise<IQuote[]> {
  return Quote.aggregate([
    { $match: { guildId, authorId } },
    { $sample: { size: count } },
  ]);
}

/**
 * Get quotes filtered by year
 */
export async function getQuotesByYear(
  guildId: string,
  year: number,
  count: number = 1,
): Promise<IQuote[]> {
  return Quote.aggregate([
    { $match: { guildId, year } },
    { $sample: { size: count } },
  ]);
}

/**
 * Get quotes filtered by both author and year
 */
export async function getQuotesByAuthorAndYear(
  guildId: string,
  authorId: string,
  year: number,
  count: number = 1,
): Promise<IQuote[]> {
  return Quote.aggregate([
    { $match: { guildId, authorId, year } },
    { $sample: { size: count } },
  ]);
}

export interface DeleteQuoteResult {
  deleted: boolean;
  slotsFreed: number;
}

/**
 * Delete a quote by number
 * Frees up trailing IDs if there are gaps at the end
 */
export async function deleteQuote(
  guildId: string,
  quoteNumber: number,
): Promise<DeleteQuoteResult> {
  const result = await Quote.deleteOne({ guildId, quoteNumber });

  if (result.deletedCount > 0) {
    const counter = await Counter.findById(`quote_${guildId}`);
    const oldSeq = counter?.seq ?? 0;

    const highestQuote = await Quote.findOne({ guildId })
      .sort({ quoteNumber: -1 })
      .select('quoteNumber')
      .lean();

    const newSeq = highestQuote?.quoteNumber ?? 0;
    await Counter.findByIdAndUpdate(`quote_${guildId}`, { seq: newSeq });

    return { deleted: true, slotsFreed: oldSeq - newSeq };
  }

  return { deleted: false, slotsFreed: 0 };
}

/**
 * Check if a user can delete a quote
 * Returns true if user is the author, adder, or server admin
 */
export function canDeleteQuote(
  quote: IQuote,
  userId: string,
  isAdmin: boolean,
): boolean {
  return isAdmin || quote.authorId === userId || quote.addedById === userId;
}

/**
 * Get users with names set for autocomplete
 */
export async function getUsersWithNames(): Promise<
  Array<{ discordId: string; displayName: string }>
> {
  const users = await User.find({
    $or: [
      {
        'name.first': { $exists: true },
        $and: [{ 'name.first': { $ne: null } }, { 'name.first': { $ne: '' } }],
      },
      {
        'name.last': { $exists: true },
        $and: [{ 'name.last': { $ne: null } }, { 'name.last': { $ne: '' } }],
      },
    ],
  }).lean();

  return users.map((user) => ({
    discordId: user.discordId,
    displayName: formatNameWithInitials(user.name?.first, user.name?.last),
  }));
}

/**
 * Get quote authors for autocomplete (users who have quotes)
 */
export async function getQuoteAuthors(
  guildId: string,
): Promise<Array<{ authorId: string; count: number }>> {
  return Quote.aggregate([
    { $match: { guildId, authorId: { $exists: true, $ne: null } } },
    { $group: { _id: '$authorId', count: { $sum: 1 } } },
    { $project: { authorId: '$_id', count: 1, _id: 0 } },
    { $sort: { count: -1 } },
  ]);
}
