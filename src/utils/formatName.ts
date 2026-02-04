import { User } from '@/models/User.js';

/**
 * Join first and last name parts into a full name string.
 * Returns the fallback (default 'Unknown') if both parts are empty.
 */
export function formatFullName(
  first?: string,
  last?: string,
  fallback = 'Unknown',
): string {
  return [first, last].filter(Boolean).join(' ') || fallback;
}

/**
 * Truncate text to a maximum length, appending '...' if truncated.
 */
export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

/**
 * Format a name with first initial and last name
 * Format: "J. Smith" or just "Smith" if no first name
 */
export function formatNameWithInitials(
  firstName?: string,
  lastName?: string,
): string {
  const parts: string[] = [];

  if (firstName) {
    parts.push(`${firstName.charAt(0).toUpperCase()}.`);
  }

  if (lastName) {
    parts.push(lastName);
  }

  return parts.join(' ') || 'Unknown';
}

/**
 * Format a complete quote for display
 * Format: "[quote]" —J. Smith, 2024, context
 */
export function formatQuoteDisplay(
  content: string,
  authorName: string,
  year: number,
  context?: string,
): string {
  const parts = [authorName, year.toString()];

  if (context) {
    parts.push(context);
  }

  return `"${content}" —${parts.join(', ')}`;
}

/**
 * Get formatted name for a Discord user from the User model
 * Falls back to provided fallback (usually username) if no name is set
 */
export async function getFormattedUserName(
  discordId: string,
  fallbackUsername: string,
): Promise<{ name: string; hasName: boolean }> {
  const user = await User.findOne({ discordId }).lean();

  if (user?.name?.first || user?.name?.last) {
    return {
      name: formatNameWithInitials(user.name.first, user.name.last),
      hasName: true,
    };
  }

  return {
    name: fallbackUsername,
    hasName: false,
  };
}
