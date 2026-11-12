import { config } from '#/config.js';
import { TranslationCount } from '#/models/TranslationCount.js';

const LANGUAGE_ALIAS_OVERRIDES: Record<string, string> = {
  kr: 'ko',
  jp: 'ja',
  cn: 'zh',
  eng: 'en',
  canton: 'yue',
  cantonese: 'yue',
  mandarin: 'zh',
};

export function resolveLanguage(input: string): string {
  return LANGUAGE_ALIAS_OVERRIDES[input.toLowerCase()] ?? input.toLowerCase();
}

/**
 * Flag of the country where a language is most likely spoken (en → 🇺🇸,
 * pt → 🇧🇷, en-gb → 🇬🇧), or null if the code isn't a language with one.
 */
function flagFromLocale(lang: string): string | null {
  if (lang === 'und') return null;
  let region: string | undefined;
  try {
    region = new Intl.Locale(lang).maximize().region;
  } catch {
    return null;
  }
  // Skip numeric UN regions such as 001 (world), used for Esperanto.
  if (!region || !/^[A-Z]{2}$/.test(region)) return null;
  return String.fromCodePoint(
    ...[...region].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export function getFlagForLang(lang: string, emoji?: string | null): string {
  return emoji ?? flagFromLocale(lang.toLowerCase()) ?? '\u{1F310}';
}

interface TranslationResult {
  translatedText: string;
  detectedSourceLang: string;
  detectedSourceLangName: string;
  targetLang: string;
  targetLangName: string;
  /** Emoji the API picked for a custom target, if any. */
  targetLangEmoji: string | null;
}

// Long enough for a long message, short enough that the user is still waiting
const REQUEST_TIMEOUT_MS = 30_000;

async function fetchTranslation(
  text: string,
  targetLang: string,
): Promise<TranslationResult> {
  const response = await fetch(`${config.translationApiUrl}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.translationApiKey}`,
    },
    body: JSON.stringify({ text, target_lang: targetLang }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      (error as { error?: string })?.error ??
        `Translation API returned ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    translated_text: string;
    detected_source_lang: string;
    detected_source_lang_name: string;
    target_lang: string;
    target_lang_name: string;
    target_lang_emoji?: string | null;
  };

  return {
    translatedText: data.translated_text,
    detectedSourceLang: data.detected_source_lang,
    detectedSourceLangName: data.detected_source_lang_name,
    targetLang: data.target_lang,
    targetLangName: data.target_lang_name,
    targetLangEmoji: data.target_lang_emoji ?? null,
  };
}

export async function translateText(
  text: string,
  targetLang: string,
): Promise<TranslationResult> {
  try {
    return await fetchTranslation(text, targetLang);
  } catch (error) {
    console.error('Translation attempt 1 failed, retrying:', error);
    await new Promise((r) => setTimeout(r, 2000));
    return await fetchTranslation(text, targetLang);
  }
}

/** Count one translation request for today (UTC) in the guild. */
export async function countTranslation(
  guildId: string,
  succeeded: boolean,
): Promise<void> {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  await TranslationCount.updateOne(
    { guildId, date },
    { $inc: { [succeeded ? 'success' : 'failed']: 1 } },
    { upsert: true },
  );
}

export interface TranslationCountPoint {
  date: string;
  success: number;
  failed: number;
}

const DATE_FORMATS: Record<string, string> = {
  day: '%Y-%m-%d',
  week: '%Y-W%V',
  month: '%Y-%m',
};

/**
 * Translation requests across all guilds, summed per day, ISO week or month.
 * `dateFrom` and `dateTo` are inclusive.
 */
export async function getTranslationCounts(options: {
  groupBy?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}): Promise<TranslationCountPoint[]> {
  const date: Record<string, Date> = {};
  if (options.dateFrom) date.$gte = new Date(options.dateFrom);
  if (options.dateTo) date.$lte = new Date(options.dateTo);

  const results = await TranslationCount.aggregate<TranslationCountPoint>([
    ...(Object.keys(date).length ? [{ $match: { date } }] : []),
    {
      $group: {
        _id: {
          $dateToString: {
            format: DATE_FORMATS[options.groupBy ?? 'day'] ?? DATE_FORMATS.day,
            date: '$date',
          },
        },
        success: { $sum: { $ifNull: ['$success', 0] } },
        failed: { $sum: { $ifNull: ['$failed', 0] } },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', success: 1, failed: 1 } },
  ]);
  return results;
}
