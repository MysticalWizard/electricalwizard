import { config } from '@/config.js';

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

const LANGUAGE_FLAGS: Record<string, string> = {
  en: '\u{1F1FA}\u{1F1F8}',
  zh: '\u{1F1E8}\u{1F1F3}',
  ko: '\u{1F1F0}\u{1F1F7}',
  ja: '\u{1F1EF}\u{1F1F5}',
  es: '\u{1F1EA}\u{1F1F8}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
  yue: '\u{1F1ED}\u{1F1F0}',
};

export function getFlagForLang(lang: string): string {
  return LANGUAGE_FLAGS[lang.toLowerCase()] ?? '\u{1F310}';
}

interface TranslationResult {
  translatedText: string;
  detectedSourceLang: string;
  detectedSourceLangName: string;
  targetLang: string;
  targetLangName: string;
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
  };

  return {
    translatedText: data.translated_text,
    detectedSourceLang: data.detected_source_lang,
    detectedSourceLangName: data.detected_source_lang_name,
    targetLang: data.target_lang,
    targetLangName: data.target_lang_name,
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
