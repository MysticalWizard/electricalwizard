/**
 * Truncate a string to a specified length and add ellipsis
 */
export function truncate(
  str: string,
  maxLength: number,
  ellipsis = '...',
): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + ellipsis;
}

/**
 * Truncate a string without adding ellipsis if it fits exactly
 */
export function smartTruncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}

/**
 * Format a quote for display
 */
export function formatQuote(
  quote: string,
  author: string,
  year: number,
  context?: string,
): string {
  const contextPart = context ? `, ${context}` : '';
  return `"${quote}" — ${author}${contextPart}, ${year}`;
}
