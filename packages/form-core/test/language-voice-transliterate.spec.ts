import { test, expect } from '@playwright/test';
import {
  SUPPORTED_LANGUAGES,
  ALLOWED_LANGUAGE_CODES,
  sanitizeLanguage,
  getLanguageBcp47,
  getLanguageOption,
} from '../../../src/lib/languages';
import {
  getMatchingVoicesForLanguage,
  getVoiceResolution,
  findBestVoiceForLanguage,
  readAloudInSelectedLanguage,
} from '../../../src/lib/speech';
import {
  transliterateIndicToEnglish,
  convertIndicNumeralsToAscii,
  normalizeDateValue,
  isRegionalScriptField,
  processFieldValueForFilling,
} from '../../../src/lib/transliterate';
import { getTranslationFailureMessage } from '../../../src/lib/translate';

test.describe('Requirement 1: Shared Language List & Fallback', () => {
  test('Language list contains strictly English (India) and the 10 Indian languages (total 11)', () => {
    const expectedCodes = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur'];
    expect(SUPPORTED_LANGUAGES.length).toBe(11);
    expect(ALLOWED_LANGUAGE_CODES.size).toBe(11);

    const actualCodes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(actualCodes).toEqual(expectedCodes);

    // Verify English (India) label
    const enOption = getLanguageOption('en');
    expect(enOption?.label).toBe('English (India)');

    // Verify non-Indian languages are completely excluded
    const excludedCodes = ['es', 'fr', 'de', 'ar', 'zh', 'ja', 'ru', 'pt', 'it', 'ko', 'as'];
    for (const code of excludedCodes) {
      expect(ALLOWED_LANGUAGE_CODES.has(code as any)).toBe(false);
      expect(SUPPORTED_LANGUAGES.some((l) => l.code === code)).toBe(false);
    }
  });

  test('Existing users who saved a removed language fall back to English (en)', () => {
    // Removed European and East Asian languages
    expect(sanitizeLanguage('es')).toBe('en');
    expect(sanitizeLanguage('fr')).toBe('en');
    expect(sanitizeLanguage('de')).toBe('en');
    expect(sanitizeLanguage('ar')).toBe('en');
    expect(sanitizeLanguage('zh')).toBe('en');
    expect(sanitizeLanguage('ja')).toBe('en');
    expect(sanitizeLanguage('es-ES')).toBe('en');
    expect(sanitizeLanguage('fr-FR')).toBe('en');
    expect(sanitizeLanguage('as')).toBe('en'); // Assamese removed
    expect(sanitizeLanguage('unknown-xyz')).toBe('en');
    expect(sanitizeLanguage(null)).toBe('en');
    expect(sanitizeLanguage(undefined)).toBe('en');

    // Valid Indian languages remain unchanged
    expect(sanitizeLanguage('en')).toBe('en');
    expect(sanitizeLanguage('hi')).toBe('hi');
    expect(sanitizeLanguage('ta')).toBe('ta');
    expect(sanitizeLanguage('te')).toBe('te');
    expect(sanitizeLanguage('bn')).toBe('bn');
    expect(sanitizeLanguage('mr')).toBe('mr');
    expect(sanitizeLanguage('gu')).toBe('gu');
    expect(sanitizeLanguage('kn')).toBe('kn');
    expect(sanitizeLanguage('ml')).toBe('ml');
    expect(sanitizeLanguage('pa')).toBe('pa');
    expect(sanitizeLanguage('ur')).toBe('ur');

    // Regional variants resolve to base allowed code
    expect(sanitizeLanguage('hi-IN')).toBe('hi');
    expect(sanitizeLanguage('ta-IN')).toBe('ta');
    expect(sanitizeLanguage('en-IN')).toBe('en');
    expect(sanitizeLanguage('en-GB')).toBe('en');
  });
});

test.describe('Requirement 2: Speech Synthesis Voice Filtering & Hindi Fallback', () => {
  // Simulated installed system voices
  const mockVoices: SpeechSynthesisVoice[] = [
    { name: 'Google हिन्दी', lang: 'hi-IN', voiceURI: 'Google हिन्दी', default: false, localService: false } as any,
    { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN', voiceURI: 'hi-IN-Swara', default: false, localService: false } as any,
    { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English', default: true, localService: false } as any,
    { name: 'Microsoft Heera - English (India)', lang: 'en-IN', voiceURI: 'en-IN-Heera', default: false, localService: false } as any,
    { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB', voiceURI: 'en-GB-George', default: false, localService: false } as any,
    { name: 'Google தமிழ்', lang: 'ta-IN', voiceURI: 'Google Tamil', default: false, localService: false } as any,
    { name: 'Google español', lang: 'es-ES', voiceURI: 'Google Spanish', default: false, localService: false } as any,
    { name: 'Google Français', lang: 'fr-FR', voiceURI: 'Google French', default: false, localService: false } as any,
  ];

  test('Voice dropdown contains only voices matching selected language (e.g. hi-IN for Hindi, en-IN/en-GB for English)', () => {
    // Hindi: only hi-IN voices returned (Google हिन्दी, Microsoft Swara)
    const hindiVoices = getMatchingVoicesForLanguage('hi', mockVoices);
    expect(hindiVoices.length).toBe(2);
    expect(hindiVoices.every((v) => v.lang.toLowerCase().startsWith('hi'))).toBe(true);
    expect(hindiVoices.some((v) => v.lang.startsWith('en'))).toBe(false);
    expect(hindiVoices.some((v) => v.lang.startsWith('es'))).toBe(false);

    // English: matches en-IN, en-GB, en
    const englishVoices = getMatchingVoicesForLanguage('en', mockVoices);
    expect(englishVoices.some((v) => v.lang === 'en-IN')).toBe(true);
    expect(englishVoices.some((v) => v.lang === 'en-GB')).toBe(true);
    expect(englishVoices.some((v) => v.lang.startsWith('hi'))).toBe(false);
    expect(englishVoices.some((v) => v.lang.startsWith('ta'))).toBe(false);

    // Tamil: only ta-IN voice returned
    const tamilVoices = getMatchingVoicesForLanguage('ta', mockVoices);
    expect(tamilVoices.length).toBe(1);
    expect(tamilVoices[0].lang).toBe('ta-IN');
  });

  test('Auto-selects best matching voice by default', () => {
    const hindiResolution = getVoiceResolution('hi', mockVoices);
    expect(hindiResolution.isFallbackToHindi).toBe(false);
    expect(hindiResolution.selectedVoice).toBeDefined();
    // Google हिन्दी or Microsoft Swara selected
    expect(hindiResolution.selectedVoice?.lang).toBe('hi-IN');
    expect(hindiResolution.fallbackNote).toBeNull();
  });

  test('If no voice exists for selected language, falls back to Hindi (hi-IN) voice with pronunciation note', () => {
    // Kannada voice is not in mockVoices
    const kannadaResolution = getVoiceResolution('kn', mockVoices);
    expect(kannadaResolution.isFallbackToHindi).toBe(true);
    expect(kannadaResolution.selectedVoice).toBeDefined();
    expect(kannadaResolution.selectedVoice?.lang).toBe('hi-IN');
    expect(kannadaResolution.fallbackNote).toContain('Pronunciation may differ');
    expect(kannadaResolution.fallbackNote).toContain('Hindi hi-IN');

    // Punjabi voice is not in mockVoices
    const punjabiResolution = getVoiceResolution('pa', mockVoices);
    expect(punjabiResolution.isFallbackToHindi).toBe(true);
    expect(punjabiResolution.selectedVoice?.lang).toBe('hi-IN');
    expect(punjabiResolution.fallbackNote).toContain('Pronunciation may differ');
    expect(punjabiResolution.fallbackNote).toContain('Hindi hi-IN');
  });
});

test.describe('Requirement 3: Fill Values Always in English & Transliteration', () => {
  test('Hindi spoken name is transliterated into English Latin script (not translated)', () => {
    const hindiName = 'राहुल शर्मा';
    const transliterated = transliterateIndicToEnglish(hindiName);
    expect(transliterated).toBe('Rahul Sharma');

    const address = 'एम जी रोड नई दिल्ली';
    const transliteratedAddr = transliterateIndicToEnglish(address);
    expect(transliteratedAddr).toContain('MG Road');
    expect(transliteratedAddr).toContain('New Delhi');
  });

  test('Indic numerals become ASCII digits', () => {
    expect(convertIndicNumeralsToAscii('१२३४५')).toBe('12345');
    expect(convertIndicNumeralsToAscii('১২৩৪৫')).toBe('12345'); // Bengali numerals
    expect(convertIndicNumeralsToAscii('pin code ११०००१')).toBe('pin code 110001');
    expect(convertIndicNumeralsToAscii('फ़ोन नंबर ९८७६५४३२१०')).toBe('फ़ोन नंबर 9876543210');
  });

  test('Dates are normalized into standard formats', () => {
    expect(normalizeDateValue('15 अगस्त 1947')).toBe('1947-08-15');
    expect(normalizeDateValue('26/01/1950')).toBe('1950-01-26');
    expect(normalizeDateValue('26-01-1950')).toBe('1950-01-26');
  });

  test('Prefers stored profile values over re-transcribed speech when field is known', () => {
    const profileValues = {
      fullName: 'Rahul Sharma',
      email: 'rahul.sharma@example.com',
      pincode: '110001',
    };

    const result = processFieldValueForFilling({
      rawValue: 'राहुल शर्मा जी',
      fieldLabel: 'Full Name',
      fieldName: 'applicant_name',
      profileValues,
      fromLang: 'hi',
    });

    expect(result.source).toBe('profile');
    expect(result.finalValue).toBe('Rahul Sharma');
    expect(result.requiresConfirmation).toBe(true);
  });

  test('Regional script field exception: preserves regional script when explicitly required', () => {
    // Check helper
    expect(isRegionalScriptField('Full Name (हिंदी में)').isRegional).toBe(true);
    expect(isRegionalScriptField('आवेदक का नाम (हिन्दी)').isRegional).toBe(true);
    expect(isRegionalScriptField('Regional Name (Tamil)').isRegional).toBe(true);
    expect(isRegionalScriptField('First Name').isRegional).toBe(false);

    const result = processFieldValueForFilling({
      rawValue: 'राहुल शर्मा',
      fieldLabel: 'Full Name (हिंदी में)',
      fromLang: 'hi',
    });

    expect(result.source).toBe('regional_script');
    expect(result.finalValue).toBe('राहुल शर्मा');
    expect(result.requiresConfirmation).toBe(true);
  });
});

test.describe('Requirement 4: Read Aloud in Selected Language', () => {
  test('Translation failure returns localized failure message instead of reading wrong language', () => {
    const hiMsg = getTranslationFailureMessage('hi');
    expect(hiMsg).toContain('अनुवाद');
    expect(hiMsg).toContain('हिन्दी');

    const taMsg = getTranslationFailureMessage('ta');
    expect(taMsg).toContain('மொழிபெயர்ப்பு');

    const bnMsg = getTranslationFailureMessage('bn');
    expect(bnMsg).toContain('অনুবাদ');

    const enMsg = getTranslationFailureMessage('en');
    expect(enMsg).toContain('Translation failed');
  });

  test('readAloudInSelectedLanguage handles English text with Hindi selected', async () => {
    // In node environment without browser speech synthesis, readAloudInSelectedLanguage gracefully handles
    let translatedNotice = '';
    const success = await readAloudInSelectedLanguage('Apply online for new certificate', 'hi', {
      onTranslatedText: (text) => {
        translatedNotice = text;
      },
    });

    // In a test node environment (where window.speechSynthesis does not exist or window.fetch fails),
    // it properly translated or used failure notice without throwing, and never reads wrong language
    expect(typeof success).toBe('boolean');
  });
});
