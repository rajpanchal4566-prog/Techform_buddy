/**
 * ONE shared language configuration for TechForm Buddy.
 * Used across the web app, extension popup, Buddy widget, and portal overlay.
 *
 * Supported languages:
 * 1. English (India)
 * And the ten Indian languages:
 * 2. Hindi (hi)
 * 3. Tamil (ta)
 * 4. Telugu (te)
 * 5. Bengali (bn)
 * 6. Marathi (mr)
 * 7. Gujarati (gu)
 * 8. Kannada (kn)
 * 9. Malayalam (ml)
 * 10. Punjabi (pa)
 * 11. Urdu (ur)
 *
 * Non-Indian languages (Spanish, French, German, Arabic, Chinese, Japanese, etc.)
 * are completely removed. Any existing user who saved a removed language falls back to English ('en').
 */

export interface LanguageOption {
  code: string;
  label: string;
  nativeName: string;
  bcp47: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English (India)', nativeName: 'English', bcp47: 'en-IN' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', bcp47: 'bn-IN' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी', bcp47: 'mr-IN' },
  { code: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી', bcp47: 'gu-IN' },
  { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
  { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം', bcp47: 'ml-IN' },
  { code: 'pa', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', bcp47: 'pa-IN' },
  { code: 'ur', label: 'Urdu', nativeName: 'اردو', bcp47: 'ur-IN' },
] as const;

export const ALLOWED_LANGUAGE_CODES: ReadonlySet<string> = new Set(
  SUPPORTED_LANGUAGES.map((l) => l.code)
);

export function isSupportedLanguage(code?: string | null): boolean {
  if (!code) return false;
  return ALLOWED_LANGUAGE_CODES.has(code.trim().toLowerCase());
}

/**
 * Validates a language code. If the code is missing or represents a removed
 * non-Indian language (e.g. 'es', 'fr', 'de', 'ar', 'zh', 'ja', 'as'),
 * it falls back to 'en'.
 */
export function sanitizeLanguage(code?: string | null): string {
  if (!code || typeof code !== 'string') return 'en';
  const clean = code.trim().toLowerCase().split(/[-_]/)[0];
  if (ALLOWED_LANGUAGE_CODES.has(clean)) {
    return clean;
  }
  return 'en';
}

export function getLanguageBcp47(code?: string | null): string {
  const safeCode = sanitizeLanguage(code);
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === safeCode);
  return match?.bcp47 || 'en-IN';
}

export function getLanguageOption(code?: string | null): LanguageOption {
  const safeCode = sanitizeLanguage(code);
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === safeCode);
  return match || SUPPORTED_LANGUAGES[0];
}

export const LANG_CODE_TO_LABEL: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.label])
);

export const LANG_CODE_TO_NATIVE: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.nativeName])
);

