import { NextRequest, NextResponse } from 'next/server';

// 17 Supported Language Codes in TechForm Buddy
export const SUPPORTED_LANG_CODES = new Set([
  'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur', 'es', 'fr', 'de', 'ar', 'zh', 'ja',
]);

export const BCP47_TO_LANG_CODE: Record<string, string> = {
  'en-us': 'en',
  'en-gb': 'en',
  'en-in': 'en',
  'hi-in': 'hi',
  'ta-in': 'ta',
  'te-in': 'te',
  'bn-in': 'bn',
  'mr-in': 'mr',
  'gu-in': 'gu',
  'kn-in': 'kn',
  'ml-in': 'ml',
  'pa-in': 'pa',
  'ur-pk': 'ur',
  'ur-in': 'ur',
  'es-es': 'es',
  'es-mx': 'es',
  'fr-fr': 'fr',
  'de-de': 'de',
  'ar-sa': 'ar',
  'zh-cn': 'zh',
  'ja-jp': 'ja',
};

/**
 * Normalizes language codes (e.g. 'hi-IN', 'EN_US', 'HI') into standard supported codes.
 */
export function normalizeLanguageCode(rawLang?: string | null): string | null {
  if (!rawLang || typeof rawLang !== 'string') return 'en';
  const cleaned = rawLang.trim().toLowerCase().replace(/_/g, '-');
  if (SUPPORTED_LANG_CODES.has(cleaned)) {
    return cleaned;
  }
  if (BCP47_TO_LANG_CODE[cleaned]) {
    return BCP47_TO_LANG_CODE[cleaned];
  }
  const base = cleaned.split('-')[0];
  if (SUPPORTED_LANG_CODES.has(base)) {
    return base;
  }
  return null;
}

/**
 * Validates that an audio buffer contains valid audio data and is not an HTML/JSON error page.
 */
export function isValidAudioBuffer(buf: Buffer | Uint8Array): boolean {
  if (!buf || buf.byteLength < 32) return false;

  // Inspect first 16 bytes for text / HTML / JSON error signatures
  const prefix = String.fromCharCode(...buf.slice(0, 16)).trim().toLowerCase();
  if (
    prefix.startsWith('<') ||
    prefix.startsWith('{') ||
    prefix.startsWith('[') ||
    prefix.includes('html') ||
    prefix.includes('doctype')
  ) {
    return false;
  }

  // Check valid audio signatures:
  const b0 = buf[0];
  const b1 = buf[1];
  const b2 = buf[2];

  const isID3 = b0 === 0x49 && b1 === 0x44 && b2 === 0x33; // 'ID3' MP3 tag
  const isMPEGSync = b0 === 0xff && (b1 & 0xe0) === 0xe0; // MPEG frame sync
  const isWAV = b0 === 0x52 && b1 === 0x49 && b2 === 0x46; // 'RIFF' WAV
  const isOGG = b0 === 0x4f && b1 === 0x67 && b2 === 0x67; // 'OggS'

  return isID3 || isMPEGSync || isWAV || isOGG;
}

/**
 * Splits multilingual text into safe chunk sizes (<= 150 chars) respecting sentence and phrase
 * delimiters across Latin, Indic, Arabic/Urdu, and CJK scripts.
 */
export function splitIntoChunks(text: string, maxLen: number = 150): string[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  // Comprehensive sentence & phrase delimiters:
  // Indic: । (U+0964), ॥ (U+0965)
  // Arabic/Urdu: ۔ (U+06D4), ؟ (U+061F), ، (U+060C), ؛ (U+061B)
  // CJK: 。 (U+3002), ！ (U+FF01), ？ (U+FF1F), ； (U+FF1B), ， (U+FF0C), 、 (U+3001)
  // Latin & Standard: . ? ! ; : \n \r
  const delimiterRegex = /([^।॥۔؟،؛。！？；，、.?!\n\r;:,"'()]+[।॥۔؟،؛。！？；，、.?!\n\r;:,"'()]*)/gu;
  const segments: string[] = [];
  let match;

  while ((match = delimiterRegex.exec(trimmed)) !== null) {
    const s = match[0].trim();
    if (s) segments.push(s);
  }

  if (segments.length === 0) {
    segments.push(trimmed);
  }

  const atomicParts: string[] = [];
  for (const seg of segments) {
    if (seg.length <= maxLen) {
      atomicParts.push(seg);
    } else if (seg.includes(' ')) {
      // Script with whitespace word boundaries
      const words = seg.split(/\s+/);
      let buf = '';
      for (const w of words) {
        if (!w) continue;
        if (buf.length + w.length + 1 <= maxLen) {
          buf = buf ? `${buf} ${w}` : w;
        } else {
          if (buf) atomicParts.push(buf);
          if (w.length > maxLen) {
            for (let i = 0; i < w.length; i += maxLen) {
              atomicParts.push(w.slice(i, i + maxLen));
            }
            buf = '';
          } else {
            buf = w;
          }
        }
      }
      if (buf) atomicParts.push(buf);
    } else {
      // Continuous script without spaces (e.g. Chinese, Japanese)
      const chars = Array.from(seg);
      for (let i = 0; i < chars.length; i += maxLen) {
        atomicParts.push(chars.slice(i, i + maxLen).join(''));
      }
    }
  }

  const chunks: string[] = [];
  let currentChunk = '';
  for (const part of atomicParts) {
    if (!currentChunk) {
      currentChunk = part;
    } else if (currentChunk.length + part.length + 1 <= maxLen) {
      currentChunk += ' ' + part;
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = part;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Attempts to fetch speech audio for an individual chunk from primary provider,
 * falling back to secondary upstream provider if primary fails or returns invalid audio.
 */
async function fetchChunkAudio(
  chunk: string,
  lang: string
): Promise<{ buffer: Buffer; provider: string } | null> {
  // Provider 1 (Primary): Google Translate TTS (tw-ob)
  try {
    const primaryUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
      lang
    )}&client=tw-ob&q=${encodeURIComponent(chunk)}`;

    const res = await fetch(primaryUrl, {
      headers: {
        Referer: 'https://translate.google.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('audio') || contentType.includes('mpeg') || contentType.includes('octet-stream')) {
        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (isValidAudioBuffer(buf)) {
          return { buffer: buf, provider: 'google-tw-ob' };
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[TTS Route] Primary provider returned non-audio or status ${res.status} for lang ${lang}, attempting fallback.`);
    }
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[TTS Route] Primary provider error for lang ${lang}: ${(err as Error)?.message || err}, attempting fallback.`);
    }
  }

  // Provider 2 (Fallback): Google Translate API TTS (gtx)
  try {
    const fallbackUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${encodeURIComponent(
      lang
    )}&q=${encodeURIComponent(chunk)}`;

    const res = await fetch(fallbackUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('audio') || contentType.includes('mpeg') || contentType.includes('octet-stream')) {
        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (isValidAudioBuffer(buf)) {
          return { buffer: buf, provider: 'google-gtx' };
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[TTS Route] Fallback provider returned non-audio or status ${res.status} for lang ${lang}`);
    }
  } catch (err: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[TTS Route] Fallback provider error for lang ${lang}: ${(err as Error)?.message || err}`);
    }
  }

  return null;
}

async function handleTTS(text: string, rawLang: string) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return NextResponse.json(
      { error: 'Text parameter is required and cannot be empty', code: 'EMPTY_TEXT' },
      { status: 400 }
    );
  }

  const normalizedLang = normalizeLanguageCode(rawLang);
  if (!normalizedLang) {
    return NextResponse.json(
      { error: `Unsupported or invalid language code: ${rawLang}`, code: 'INVALID_LANGUAGE' },
      { status: 400 }
    );
  }

  const chunks = splitIntoChunks(trimmed, 150);
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: 'Text parameter contains no speakable content', code: 'EMPTY_CHUNKS' },
      { status: 400 }
    );
  }

  const buffers: Buffer[] = [];
  const providersUsed = new Set<string>();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkResult = await fetchChunkAudio(chunk, normalizedLang);

    if (!chunkResult || !chunkResult.buffer || chunkResult.buffer.byteLength === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[TTS Route] Failed to synthesize chunk ${i + 1}/${chunks.length} for lang ${normalizedLang}`);
      }
      return NextResponse.json(
        {
          error: `Text-to-speech audio generation failed for chunk ${i + 1}/${chunks.length}`,
          code: 'TTS_UPSTREAM_FAILED',
        },
        { status: 502 }
      );
    }

    buffers.push(chunkResult.buffer);
    providersUsed.add(chunkResult.provider);
  }

  const combined = Buffer.concat(buffers);
  if (combined.byteLength === 0 || !isValidAudioBuffer(combined)) {
    return NextResponse.json(
      { error: 'Assembled audio payload is empty or invalid', code: 'INVALID_AUDIO_PAYLOAD' },
      { status: 502 }
    );
  }

  const providerHeader = Array.from(providersUsed).join('+') || 'google-tw-ob';

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[TTS Route] Generated audio: lang=${normalizedLang}, chunks=${chunks.length}, bytes=${combined.byteLength}, provider=${providerHeader}`
    );
  }

  return new Response(combined, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(combined.byteLength),
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-TTS-Provider': providerHeader,
      'X-TTS-Language': normalizedLang,
      'X-TTS-Chunks': String(chunks.length),
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const text = searchParams.get('text') || '';
    const lang = searchParams.get('lang') || 'en';

    return await handleTTS(text, lang);
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[TTS Route] Error processing GET request:', error);
    }
    return NextResponse.json(
      { error: (error as Error)?.message || 'TTS Processing Error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = body.text || '';
    const lang = body.lang || 'en';

    return await handleTTS(text, lang);
  } catch (error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[TTS Route] Error processing POST request:', error);
    }
    return NextResponse.json(
      { error: (error as Error)?.message || 'TTS Processing Error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

