// Translation and Read-Aloud helper for TechForm Buddy

export const TRANSLATION_FAILURE_MESSAGES: Record<string, string> = {
  en: 'Translation failed. Could not read in the selected language.',
  hi: 'अनुवाद विफल रहा। सामग्री को हिन्दी में नहीं पढ़ा जा सका।',
  ta: 'மொழிபெயர்ப்பு தோல்வியடைந்தது. தமிழில் வாசிக்க முடியவில்லை.',
  te: 'అనువాదం విఫలమైంది. తెలుగులో చదవడం సాధ్యం కాలేదు.',
  bn: 'অনুবাদ ব্যর্থ হয়েছে। বাংলায় পড়া সম্ভব হয়নি।',
  mr: 'भाषांतर अयशस्वी झाले. मराठीत वाचता आले नाही.',
  gu: 'અનુવાદ નિષ્ફળ રહ્યો. ગુજરાતીમાં વાંચી શકાયું નહીં.',
  kn: 'ಅನುವಾದ ವಿಫಲವಾಗಿದೆ. ಕನ್ನಡದಲ್ಲಿ ಓದಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.',
  ml: 'വിവർത്തനം പരാജയപ്പെട്ടു. മലയാളത്തിൽ വായിക്കാനായില്ല.',
  pa: 'ਅਨੁਵਾਦ ਅਸਫਲ ਰਿਹਾ। ਸਮੱਗਰੀ ਨੂੰ ਪੰਜਾਬੀ ਵਿੱਚ ਨਹੀਂ ਪੜ੍ਹਿਆ ਜਾ ਸਕਿਆ।',
  ur: 'ترجمہ ناکام ہو گیا۔ مواد اردو میں نہیں پڑھا جا سکا۔',
};

export function getTranslationFailureMessage(langCode: string): string {
  return TRANSLATION_FAILURE_MESSAGES[langCode] || TRANSLATION_FAILURE_MESSAGES['en'];
}

// Detect if text contains non-ASCII, foreign, or Indic script characters
export function hasForeignOrIndicScript(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

function getTranslateEndpoint(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/translate`;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/api/translate`;
}

export async function translateToEnglish(text: string, fromLang: string = 'auto'): Promise<string> {
  if (!text || text.trim() === '') return '';
  const trimmed = text.trim();

  // If text is purely ASCII and already designated English, no translation needed
  if (!/[^\x00-\x7F]/.test(trimmed) && fromLang === 'en') {
    return trimmed;
  }

  try {
    const res = await fetch(getTranslateEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: trimmed,
        from: fromLang === 'en' ? 'auto' : (fromLang || 'auto'),
        to: 'en',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.translatedText && data.translatedText.trim() !== '') {
        return data.translatedText.trim();
      }
    }
  } catch (error) {
    console.error('Failed to translate to English:', error);
  }

  // Fallback: return original text if translation network failed
  return text.trim();
}

/**
 * Translates English screen / guidance text to user's selected language.
 * REQUIREMENT 4: If translation fails, returns null (or empty) so that
 * the system says translation failed instead of reading the wrong language.
 */
export async function translateFromEnglish(
  text: string,
  toLang: string
): Promise<{ text: string; success: boolean; isFailureMessage?: boolean }> {
  if (!text || text.trim() === '') {
    return { text: '', success: true };
  }
  const trimmed = text.trim();
  if (toLang === 'en') {
    return { text: trimmed, success: true };
  }

  try {
    const res = await fetch(getTranslateEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: trimmed,
        from: 'en',
        to: toLang,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.translatedText && data.translatedText.trim() !== '') {
        return { text: data.translatedText.trim(), success: true };
      }
    }
  } catch (error) {
    console.error(`Failed to translate from English to ${toLang}:`, error);
  }

  // Translation failed: DO NOT return the English text!
  // Return the localized failure notice per Requirement 4.
  const failureMsg = getTranslationFailureMessage(toLang);
  return {
    text: failureMsg,
    success: false,
    isFailureMessage: true,
  };
}
