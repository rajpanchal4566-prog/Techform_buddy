import { NextRequest, NextResponse } from 'next/server';

// Server-side in-memory translation cache (per text + language)
// Bounded to 5,000 entries to prevent memory leaks
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 5000;

function getCacheKey(text: string, from: string, to: string): string {
  return `${from.toLowerCase()}->${to.toLowerCase()}:${text.trim()}`;
}

// Token protection for proper nouns, form numbers, IDs, amounts, and dates
const PROTECTED_PATTERNS = [
  // Proper nouns / brand / portal names
  /\b(TechForm\s*Buddy|Parivahan|Sarathi|DigiLocker|Aadhaar|UIDAI|PM-JAY|EPFO|Passport\s*Seva|NSDL|UTIITSL)\b/gi,
  // Form numbers / official form titles (e.g. Form 6, Form 49A, Form 16, ITR-1)
  /\b(Form\s*[0-9]+[A-Za-z]*|ITR-[0-9]+[A-Za-z]*)\b/gi,
  // Alphanumeric IDs and codes (e.g. DL-12345, ABCDE1234F, UAN1234)
  /\b([A-Z]{2,}[0-9]{2,}[A-Z0-9]*)\b/g,
  // Currency amounts (e.g. ₹500, Rs. 1,000, Rs 500, INR 1500)
  /(?:₹|Rs\.?|INR|\$)\s*[0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?/gi,
  // Dates (e.g. 15/08/1947, 2024-05-12, 12-05-2024)
  /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
  /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g,
];

interface ProtectedToken {
  placeholder: string;
  original: string;
}

function protectTokens(text: string): { maskedText: string; tokens: ProtectedToken[] } {
  const tokens: ProtectedToken[] = [];
  let counter = 0;
  let masked = text;

  for (const pattern of PROTECTED_PATTERNS) {
    masked = masked.replace(pattern, (match) => {
      const placeholder = `__TFB_TOKEN_${counter++}__`;
      tokens.push({ placeholder, original: match });
      return placeholder;
    });
  }

  return { maskedText: masked, tokens };
}

function restoreTokens(text: string, tokens: ProtectedToken[]): string {
  let restored = text;
  for (const token of tokens) {
    // Replace placeholder with original value (case-insensitive in case translation altered casing)
    const rx = new RegExp(token.placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    restored = restored.replace(rx, token.original);
  }
  return restored;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, from = 'auto', to = 'en' } = body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ translatedText: '', success: true });
    }

    const trimmed = text.trim();

    // If source and target are the same, return as-is
    if (from === to && from !== 'auto') {
      return NextResponse.json({ translatedText: trimmed, success: true });
    }

    // 1. Check in-memory cache
    const cacheKey = getCacheKey(trimmed, from, to);
    if (translationCache.has(cacheKey)) {
      return NextResponse.json({
        translatedText: translationCache.get(cacheKey)!,
        sourceLanguage: from,
        targetLanguage: to,
        cached: true,
        success: true,
      });
    }

    // 2. Protect proper nouns, form numbers, IDs, amounts, and dates
    const { maskedText, tokens } = protectTokens(trimmed);

    // 3. Call translation engine
    const encoded = encodeURIComponent(maskedText);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encoded}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      // REQUIREMENT 4: "If translation fails, say so instead of reading the wrong language."
      // Do NOT silently return the original English text!
      console.warn(`[Translate API] HTTP ${res.status} upstream failure for lang: ${to}`);
      return NextResponse.json(
        {
          error: 'TRANSLATION_FAILED',
          message: `Translation failed for target language ${to}`,
          translatedText: '',
          success: false,
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    let rawTranslated = '';

    if (Array.isArray(data) && Array.isArray(data[0])) {
      rawTranslated = data[0].map((item: any) => (item && item[0] ? item[0] : '')).join('');
    }

    if (!rawTranslated.trim()) {
      return NextResponse.json(
        {
          error: 'TRANSLATION_EMPTY',
          message: `Translation returned empty output for ${to}`,
          translatedText: '',
          success: false,
        },
        { status: 502 }
      );
    }

    // 4. Restore protected proper nouns, numbers, IDs, amounts, and dates
    const finalTranslated = restoreTokens(rawTranslated.trim(), tokens);

    // 5. Store in cache
    if (translationCache.size >= MAX_CACHE_SIZE) {
      // Evict oldest entry
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }
    translationCache.set(cacheKey, finalTranslated);

    return NextResponse.json({
      translatedText: finalTranslated,
      sourceLanguage: from,
      targetLanguage: to,
      cached: false,
      success: true,
    });
  } catch (error) {
    console.error('[Translate API] Internal Error:', error);
    return NextResponse.json(
      {
        error: 'TRANSLATION_FAILED',
        message: 'Internal translation processing error',
        translatedText: '',
        success: false,
      },
      { status: 500 }
    );
  }
}
