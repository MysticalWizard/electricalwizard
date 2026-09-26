import { Guild } from '#/models/Guild.js';
import { Nickname, type INickname } from '#/models/Nickname.js';
import { User } from '#/models/User.js';

export interface NicknameMatch {
  nickname: string;
  userId: string;
  index: number;
}

interface GuildNicknames {
  announce: boolean;
  nicknames: Array<{ nickname: string; lower: string; userId: string }>;
}

// Nickname matching runs on every message, so its inputs are cached in memory.
// Entries are dropped when the underlying models change, including writes from
// the dashboard API (see invalidateNicknameCache). Promises are cached so that
// concurrent messages share one load.
const guildCache = new Map<string, Promise<GuildNicknames>>();
let optedOutCache: Promise<Set<string>> | null = null;

function loadGuildNicknames(guildId: string): Promise<GuildNicknames> {
  const cached = guildCache.get(guildId);
  if (cached) return cached;

  const loading = Promise.all([
    Guild.findOne({ guildId }, { nicknameAnnounce: 1 }).lean(),
    Nickname.find({ guildId }, { nickname: 1, userId: 1 }).lean(),
  ]).then(([guild, nicknames]) => ({
    announce: guild?.nicknameAnnounce ?? true,
    nicknames: nicknames.map((n) => ({
      nickname: n.nickname,
      lower: n.nickname.toLowerCase(),
      userId: n.userId,
    })),
  }));

  guildCache.set(guildId, loading);
  loading.catch(() => {
    if (guildCache.get(guildId) === loading) guildCache.delete(guildId);
  });
  return loading;
}

/** Discord IDs of users who turned their nickname announcements off. */
function loadOptedOutUsers(): Promise<Set<string>> {
  if (optedOutCache) return optedOutCache;

  const loading = User.find({ nicknameAnnounce: false }, { discordId: 1 })
    .lean()
    .then((users) => new Set(users.map((u) => u.discordId)));

  optedOutCache = loading;
  loading.catch(() => {
    if (optedOutCache === loading) optedOutCache = null;
  });
  return loading;
}

/**
 * Drop cached data derived from `modelName`. Called for every change feed
 * entry and directly after this module's own writes.
 */
export function invalidateNicknameCache(modelName: string): void {
  if (modelName === Nickname.modelName || modelName === Guild.modelName) {
    guildCache.clear();
  } else if (modelName === User.modelName) {
    optedOutCache = null;
  }
}

/**
 * Find all nickname mentions in a message, ordered by their position in the
 * text. Returns nothing when the guild has announcements off, and skips users
 * who turned them off for themselves.
 */
export async function findNicknameMatches(
  guildId: string,
  content: string,
): Promise<NicknameMatch[]> {
  const { announce, nicknames } = await loadGuildNicknames(guildId);

  if (!announce || nicknames.length === 0) return [];

  const matches: NicknameMatch[] = [];
  const contentLower = content.toLowerCase();

  for (const nick of nicknames) {
    const nickLower = nick.lower;
    let searchIndex = 0;

    // Find all occurrences of this nickname in the message
    while (searchIndex < contentLower.length) {
      const index = contentLower.indexOf(nickLower, searchIndex);
      if (index === -1) break;

      // Check word boundaries to avoid partial matches
      const charBefore = index > 0 ? contentLower.charAt(index - 1) : ' ';
      const charAfter =
        index + nickLower.length < contentLower.length
          ? contentLower.charAt(index + nickLower.length)
          : ' ';

      const isWordBoundaryBefore = !/\w/.test(charBefore);
      const isWordBoundaryAfter = !/\w/.test(charAfter);

      if (isWordBoundaryBefore && isWordBoundaryAfter) {
        matches.push({
          nickname: nick.nickname,
          userId: nick.userId,
          index,
        });
      }

      searchIndex = index + 1;
    }
  }

  if (matches.length === 0) return [];

  // Sort by position in message and deduplicate users
  matches.sort((a, b) => a.index - b.index);

  // Remove opted-out users and duplicate user mentions, keeping only the
  // first occurrence
  const optedOut = await loadOptedOutUsers();
  const seenUsers = new Set<string>();
  return matches.filter((match) => {
    if (optedOut.has(match.userId) || seenUsers.has(match.userId)) {
      return false;
    }
    seenUsers.add(match.userId);
    return true;
  });
}

/**
 * Add a nickname for a user in a guild
 */
export async function addNickname(
  guildId: string,
  userId: string,
  nickname: string,
): Promise<INickname> {
  const doc = await Nickname.create({ guildId, userId, nickname });
  invalidateNicknameCache(Nickname.modelName);
  return doc;
}

/**
 * Remove a nickname from a guild
 */
export async function removeNickname(
  guildId: string,
  nickname: string,
): Promise<boolean> {
  const result = await Nickname.deleteOne({
    guildId,
    nickname: { $regex: new RegExp(`^${escapeRegex(nickname)}$`, 'i') },
  });
  invalidateNicknameCache(Nickname.modelName);
  return result.deletedCount > 0;
}

/**
 * Get the owner of a nickname
 */
export async function getNicknameOwner(
  guildId: string,
  nickname: string,
): Promise<string | null> {
  const doc = await Nickname.findOne({
    guildId,
    nickname: { $regex: new RegExp(`^${escapeRegex(nickname)}$`, 'i') },
  }).lean();
  return doc?.userId ?? null;
}

/**
 * Get all nicknames for a user in a guild
 */
export async function getUserNicknames(
  guildId: string,
  userId: string,
): Promise<INickname[]> {
  return Nickname.find({ guildId, userId }).lean();
}

/**
 * Get all nicknames in a guild
 */
export async function getGuildNicknames(guildId: string): Promise<INickname[]> {
  return Nickname.find({ guildId }).lean();
}

/**
 * Check if a nickname already exists in a guild
 */
export async function nicknameExists(
  guildId: string,
  nickname: string,
): Promise<boolean> {
  const existing = await Nickname.findOne({
    guildId,
    nickname: { $regex: new RegExp(`^${escapeRegex(nickname)}$`, 'i') },
  });
  return existing !== null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get nickname announce setting for a guild
 */
export async function getNicknameAnnounce(guildId: string): Promise<boolean> {
  const guild = await Guild.findOne({ guildId }).lean();
  return guild?.nicknameAnnounce ?? true;
}

/**
 * Set nickname announce setting for a guild
 */
export async function setNicknameAnnounce(
  guildId: string,
  enabled: boolean,
): Promise<void> {
  await Guild.findOneAndUpdate(
    { guildId },
    { nicknameAnnounce: enabled },
    { upsert: true },
  );
  invalidateNicknameCache(Guild.modelName);
}

/**
 * Get user's nickname announce preference
 */
export async function getUserNicknameAnnounce(
  discordId: string,
): Promise<boolean> {
  const user = await User.findOne({ discordId }).lean();
  return user?.nicknameAnnounce ?? true;
}

/**
 * Toggle user's nickname announce preference, returns new state
 */
export async function toggleUserNicknameAnnounce(
  discordId: string,
  username: string,
): Promise<boolean> {
  const user = await User.findOne({ discordId });
  const newState = !(user?.nicknameAnnounce ?? true);

  await User.findOneAndUpdate(
    { discordId },
    { discordId, username, nicknameAnnounce: newState },
    { upsert: true },
  );
  invalidateNicknameCache(User.modelName);

  return newState;
}
