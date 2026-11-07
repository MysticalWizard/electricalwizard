import { config } from '#/config.js';

const LANGUAGE_ALIASES: Record<string, string> = {
  kr: 'ko',
  jp: 'ja',
  cn: 'zh',
  eng: 'en',
  canton: 'yue',
  cantonese: 'yue',
  mandarin: 'zh',
};

export function resolveLanguage(input: string): string {
  return LANGUAGE_ALIASES[input.toLowerCase()] ?? input.toLowerCase();
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
    signal: AbortSignal.timeout(120_000),
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
