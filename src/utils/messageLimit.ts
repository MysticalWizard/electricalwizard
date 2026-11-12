// Discord rejects messages and embeds over these lengths, so text that comes
// from users is cut to fit before it's sent.
export const MESSAGE_MAX_LENGTH = 2000;
export const EMBED_TITLE_MAX_LENGTH = 256;
export const EMBED_DESCRIPTION_MAX_LENGTH = 4096;

/** `text` cut to at most `max` characters, ending in an ellipsis if cut. */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Join as many of `parts` as fit in `max` characters. A first part that is
 * too long on its own is clipped.
 */
export function joinWithinLimit(
  parts: string[],
  separator: string,
  max = MESSAGE_MAX_LENGTH,
): string {
  let result = '';
  for (const part of parts) {
    const next = result ? `${result}${separator}${part}` : part;
    if (next.length > max) return result || clip(part, max);
    result = next;
  }
  return result;
}

/**
 * Group `lines` into messages of at most `max` characters each, one line per
 * row. A line too long for a message on its own is clipped.
 */
export function chunkLines(
  lines: string[],
  max = MESSAGE_MAX_LENGTH,
): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const raw of lines) {
    const line = clip(raw, max);
    if (current && current.length + 1 + line.length > max) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
