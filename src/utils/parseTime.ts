import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

interface ParsedTime {
  date: Date;
  relative: boolean;
}

/**
 * Parse a time string into a Date object
 * Supports formats like:
 * - Relative: "1h", "30m", "2d", "1h30m", "13hr 43m", "73m"
 * - Absolute: "2026-03-29", "2026-03-29 14:30"
 */
export function parseTimeInput(input: string, tz?: string): ParsedTime | null {
  const trimmed = input.trim().toLowerCase();

  // Try relative time first
  const relativeResult = parseRelativeTime(trimmed);
  if (relativeResult) {
    return { date: relativeResult, relative: true };
  }

  // Try absolute time
  const absoluteResult = parseAbsoluteTime(trimmed, tz);
  if (absoluteResult) {
    return { date: absoluteResult, relative: false };
  }

  return null;
}

/**
 * Parse relative time strings like "1h", "30m", "2d", "1h30m", "13hr 43m"
 */
function parseRelativeTime(input: string): Date | null {
  // Match patterns like: 1h, 30m, 2d, 1h30m, 13hr 43m, 1 hour, 2 hours 30 minutes
  const pattern =
    /(?:(\d+)\s*(?:d|days?))?\s*(?:(\d+)\s*(?:h|hrs?|hours?))?\s*(?:(\d+)\s*(?:m|mins?|minutes?))?/i;

  const match = input.match(pattern);
  if (!match || (!match[1] && !match[2] && !match[3])) {
    return null;
  }

  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);

  if (days === 0 && hours === 0 && minutes === 0) {
    return null;
  }

  const now = dayjs();
  const target = now.add(days, 'day').add(hours, 'hour').add(minutes, 'minute');

  return target.toDate();
}

/**
 * Parse absolute time strings like "2026-03-29", "2026-03-29 14:30"
 */
function parseAbsoluteTime(input: string, tz?: string): Date | null {
  const formats = [
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD HH:mm',
    'YYYY-MM-DD',
    'YYYY/MM/DD HH:mm:ss',
    'YYYY/MM/DD HH:mm',
    'YYYY/MM/DD',
    'YYYY.MM.DD HH:mm:ss',
    'YYYY.MM.DD HH:mm',
    'YYYY.MM.DD',
    'MM-DD-YYYY HH:mm',
    'MM-DD-YYYY',
    'MM/DD/YYYY HH:mm',
    'MM/DD/YYYY',
  ];

  for (const format of formats) {
    try {
      let parsed: dayjs.Dayjs;

      if (tz) {
        parsed = dayjs.tz(input, format, tz);
      } else {
        parsed = dayjs(input, format, true);
      }

      if (parsed.isValid()) {
        // If only date is provided (no time), set to current time of that day
        if (!input.includes(':')) {
          const now = dayjs();
          parsed = parsed.hour(now.hour()).minute(now.minute());
        }

        // Convert to UTC for storage
        return parsed.toDate();
      }
    } catch {
      // Continue to next format if parsing fails
      continue;
    }
  }

  return null;
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (parts.length === 0 && seconds > 0) parts.push(`${seconds}s`);

  return parts.join(' ') || '< 1s';
}

/**
 * Format a date for display in a specific timezone
 */
export function formatDateInTimezone(date: Date, tz?: string): string {
  const d = tz ? dayjs(date).tz(tz) : dayjs(date);
  return d.format('YYYY-MM-DD HH:mm');
}
