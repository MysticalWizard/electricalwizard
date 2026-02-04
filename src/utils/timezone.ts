import type { ChatInputCommandInteraction } from 'discord.js';
import { User } from '@/models/User.js';

/**
 * Validate if a string is a valid IANA timezone
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all supported IANA timezones
 */
export function getSupportedTimezones(): string[] {
  return Intl.supportedValuesOf('timeZone');
}

/**
 * Validate a timezone string and send an ephemeral error if invalid.
 * Returns true if the timezone is valid (or null/undefined), false if invalid.
 */
export async function validateTimezone(
  interaction: ChatInputCommandInteraction,
  timezone: string | null | undefined,
): Promise<boolean> {
  if (!timezone) return true;

  if (!isValidTimezone(timezone)) {
    await interaction.reply({
      content: `Invalid timezone: \`${timezone}\`. Use a valid IANA timezone like \`America/New_York\`.`,
      ephemeral: true,
    });
    return false;
  }

  return true;
}

/**
 * Resolve a timezone: returns `provided` if set, otherwise queries the User model
 * for the user's saved timezone.
 */
export async function resolveTimezone(
  userId: string,
  provided?: string | null,
): Promise<string | undefined> {
  if (provided) return provided;

  const user = await User.findOne({ discordId: userId }).lean();
  return user?.timezone;
}
