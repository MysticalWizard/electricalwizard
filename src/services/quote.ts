import {
  Counter,
  Quote,
  quoteContentKey,
  type IQuote,
} from '#/models/Quote.js';
import { User } from '#/models/User.js';
import { formatNameWithInitials } from '#/utils/formatName.js';
import { cacheFor } from '#/utils/cacheFor.js';

// Autocomplete runs on every keystroke, so its lists are reused for a minute
const AUTOCOMPLETE_TTL_MS = 60_000;

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
  const query: Record<string, unknown> = {
    guildId,
    contentKey: quoteContentKey(content),
  };
  if (authorId) query.authorId = authorId;

  // The indexed lookup leaves only the few quotes with this text; the author
  // name is compared here, ignoring case, rather than with a regex
  const candidates = await Quote.find(query).lean();
  if (authorId || !authorName) return candidates[0] ?? null;
  const name = authorName.toLowerCase();
  return candidates.find((q) => q.authorName?.toLowerCase() === name) ?? null;
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
export const getUsersWithNames = cacheFor(
  AUTOCOMPLETE_TTL_MS,
  async (): Promise<Array<{ discordId: string; displayName: string }>> => {
    const users = await User.find({
      $or: [
        {
          'name.first': { $exists: true },
          $and: [
            { 'name.first': { $ne: null } },
            { 'name.first': { $ne: '' } },
          ],
        },
        {
          'name.last': { $exists: true },
          $and: [{ 'name.last': { $ne: null } }, { 'name.last': { $ne: '' } }],
        },
      ],
    })
      .select({ discordId: 1, name: 1 })
      .lean();

    return users.map((user) => ({
      discordId: user.discordId,
      displayName: formatNameWithInitials(user.name?.first, user.name?.last),
    }));
  },
);

export interface QuoteAuthor {
  authorId: string;
  count: number;
  /** The author's name if set, otherwise their username. */
  displayName: string;
}

/**
 * Users who have quotes in a guild, most quoted first, for autocomplete
 */
export const getQuoteAuthors = cacheFor(
  AUTOCOMPLETE_TTL_MS,
  async (guildId: string): Promise<QuoteAuthor[]> => {
    const authors: Array<{ authorId: string; count: number }> =
      await Quote.aggregate([
        { $match: { guildId, authorId: { $exists: true, $ne: null } } },
        { $group: { _id: '$authorId', count: { $sum: 1 } } },
        { $project: { authorId: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]);
    const users = await User.find(
      { discordId: { $in: authors.map((a) => a.authorId) } },
      { discordId: 1, username: 1, name: 1 },
    ).lean();
    const usersById = new Map(users.map((u) => [u.discordId, u]));

    return authors.map((author) => {
      const user = usersById.get(author.authorId);
      return {
        ...author,
        displayName: user?.name?.first
          ? formatNameWithInitials(user.name.first, user.name.last)
          : (user?.username ?? 'Unknown'),
      };
    });
  },
);

/**
 * Fill in contentKey for quotes saved before it existed. Runs at startup and
 * does nothing once every quote has one. Writes directly to the collection,
 * since the field isn't shown on the dashboard.
 */
export async function backfillQuoteContentKeys(): Promise<void> {
  const quotes = await Quote.find(
    { contentKey: { $exists: false } },
    { content: 1 },
  ).lean();
  if (quotes.length === 0) return;

  await Quote.bulkWrite(
    quotes.map((q) => ({
      updateOne: {
        filter: { _id: q._id },
        update: { $set: { contentKey: quoteContentKey(q.content) } },
      },
    })),
  );
  console.log(`Backfilled contentKey for ${quotes.length} quote(s)`);
}
