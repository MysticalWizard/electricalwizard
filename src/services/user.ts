import type { Guild, User as DiscordUser } from 'discord.js';
import { User } from '#/models/User.js';

/**
 * Create the stored user for a Discord account if it doesn't exist yet, and
 * keep its username current. Existing details are never overwritten.
 */
export async function ensureUser(user: DiscordUser): Promise<void> {
  await User.findOneAndUpdate(
    { discordId: user.id },
    { $set: { username: user.username }, $setOnInsert: { isBot: user.bot } },
    { upsert: true },
  );
}

/**
 * Create stored users for every member of the guild that doesn't have one.
 * Users who have left are kept.
 */
export async function syncGuildMembers(guild: Guild): Promise<number> {
  const members = await guild.members.fetch();
  const existing = await User.find(
    { discordId: { $in: [...members.keys()] } },
    { discordId: 1 },
  ).lean();
  const known = new Set(existing.map((u) => u.discordId));

  const missing = members.filter((m) => !known.has(m.id));
  // One upsert per user, so each insert goes through the change feed.
  for (const member of missing.values()) {
    await ensureUser(member.user);
  }
  return missing.size;
}

/**
 * Give a user a timezone if they don't have one yet, creating the stored user
 * if needed. A timezone the user already set is never replaced. Returns
 * whether the timezone was saved.
 */
export async function setDefaultTimezone(
  discordId: string,
  username: string,
  timezone: string,
): Promise<boolean> {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return false;
  }

  await User.findOneAndUpdate(
    { discordId },
    { $set: { username }, $setOnInsert: { isBot: false } },
    { upsert: true },
  );
  const result = await User.updateOne(
    { discordId, timezone: { $in: [null, ''] } },
    { $set: { timezone } },
  );
  return result.modifiedCount > 0;
}
