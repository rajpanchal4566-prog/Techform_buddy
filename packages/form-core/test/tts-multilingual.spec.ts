import { test, expect } from '@playwright/test';
import {
  normalizeLanguageCode,
  isValidAudioBuffer,
  splitIntoChunks,
  SUPPORTED_LANG_CODES,
  BCP47_TO_LANG_CODE,
} from '../../../src/app/api/tts/route';

test.describe('Multilingual TTS System & Audio Pipeline', () => {
  // Test phrase catalogue for all 17 supported languages
  const TEST_PHRASES: Record<string, string> = {
    en: 'Hello! This is TechForm Buddy speaking in English. Your voice is configured.',
    hi: 'नमस्ते! यह टेकफॉर्म बडी है। आपकी हिन्दी आवाज़ सफलतापूर्वक सेट हो गई है।',
    ta: 'வணக்கம்! இது டெக்ஃபார்ம் படி. உங்கள் தமிழ் குரல் வெற்றிகரமாக அமைக்கப்பட்டது.',
    te: 'నమస్కారం! ఇది టెక్ఫార్మ్ బడ్డీ. మీ తెలుగు వాయిస్ విజయవంతంగా సెట్ చేయబడింది.',
    bn: 'নমস্কার! এটি টেকফর্ম বাডি। আপনার বাংলা ভয়েস সফলভাবে সেট করা হয়েছে।',
    mr: 'नमस्कार! हे टेकफॉर्म बडी आहे. तुमचा मराठी आवाज यशस्वीरित्या बदलला आहे.',
    gu: 'નમસ્તે! આ ટેકફોર્મ બડી છે. તમારો ગુજરાતી અવાજ સફળતાપૂર્વક સેટ થઈ ગયો છે.',
    kn: 'ನಮಸ್ಕಾರ! ಇದು ಟೆಕ್‌ಫಾರ್ಮ್ ಬಡ್ಡಿ. ನಿಮ್ಮ ಧ್ವನಿ ಯಶಸ್ವಿಯಾಗಿ ಹೊಂದಿಸಲಾಗಿದೆ.',
    ml: 'നമസ്കാരം! ഇത് ടെക്ഫോം ബഡി ആണ്. നിങ്ങളുടെ ശബ്ദം വിജയകരമായി സജ്ജീകരിച്ചു.',
    pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਇਹ ਟੈਕਫਾਰਮ ਬੱਡੀ ਹੈ। ਤੁਹਾਡੀ ਆਵਾਜ਼ ਸਫਲਤਾਪੂਰਵਕ ਸੈੱਟ ਹੋ ਗਈ ਹੈ।',
    ur: 'السلام علیکم! یہ ٹیک فارم بڈی ہے۔ آپ کی آواز کامیابی سے تبدیل ہو گئی ہے۔',
    es: '¡Hola! Este es TechForm Buddy hablando en español. Tu voz está configurada correctamente.',
    fr: "Bonjour! C'est TechForm Buddy en français. Votre voix est configurée avec succès.",
    de: 'Hallo! Dies ist TechForm Buddy auf Deutsch. Ihre Stimme wurde erfolgreich eingerichtet.',
    ar: 'مرحباً! هذا تيك فورم بودي يتحدث بالعربية. تم ضبط الصوت بنجاح.',
    zh: '您好！这是 TechForm Buddy 中文语音。您的语音已成功配置。',
    ja: 'こんにちは！TechForm Buddyです。日本語の音声が正常に設定されました。',
  };

  test('Requirement 3: Discover and verify all 17 supported languages', () => {
    expect(SUPPORTED_LANG_CODES.size).toBe(17);
    const expected = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur', 'es', 'fr', 'de', 'ar', 'zh', 'ja'];
    for (const code of expected) {
      expect(SUPPORTED_LANG_CODES.has(code)).toBe(true);
      expect(TEST_PHRASES[code]).toBeDefined();
    }
  });

  test('Requirement 3: Language code normalization handles regional and uppercase codes', () => {
    expect(normalizeLanguageCode('en-US')).toBe('en');
    expect(normalizeLanguageCode('en_GB')).toBe('en');
    expect(normalizeLanguageCode('hi-IN')).toBe('hi');
    expect(normalizeLanguageCode('ta_IN')).toBe('ta');
    expect(normalizeLanguageCode('ZH-CN')).toBe('zh');
    expect(normalizeLanguageCode('JA-JP')).toBe('ja');
    expect(normalizeLanguageCode('es-ES')).toBe('es');
    expect(normalizeLanguageCode('fr-FR')).toBe('fr');
    expect(normalizeLanguageCode('de-DE')).toBe('de');
    expect(normalizeLanguageCode('ar-SA')).toBe('ar');
    expect(normalizeLanguageCode('ur-PK')).toBe('ur');

    // Invalid codes
    expect(normalizeLanguageCode('unknown-lang')).toBeNull();
    expect(normalizeLanguageCode('xyz123')).toBeNull();
  });

  test('Requirement 2: Audio response validation detects empty, malformed, or HTML/JSON bodies', () => {
    // 1. Valid MP3 header (MPEG sync 0xFF 0xF3)
    const validMp3Sync = Buffer.from([0xff, 0xf3, 0x84, 0xc4, ...new Array(30).fill(0)]);
    expect(isValidAudioBuffer(validMp3Sync)).toBe(true);

    // 2. Valid ID3 header
    const validId3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, ...new Array(30).fill(0)]);
    expect(isValidAudioBuffer(validId3)).toBe(true);

    // 3. HTML Error page with HTTP 200 (must be rejected!)
    const htmlResponse = Buffer.from('<!DOCTYPE html><html><body>Captcha Required</body></html>');
    expect(isValidAudioBuffer(htmlResponse)).toBe(false);

    // 4. JSON Error response with HTTP 200 (must be rejected!)
    const jsonResponse = Buffer.from('{"error": "Upstream quota exceeded", "status": 429}');
    expect(isValidAudioBuffer(jsonResponse)).toBe(false);

    // 5. Empty or truncated buffer
    expect(isValidAudioBuffer(Buffer.from([]))).toBe(false);
    expect(isValidAudioBuffer(Buffer.from([0xff, 0xf3]))).toBe(false); // < 32 bytes
  });

  test('Requirement 2 & 3: Multilingual text chunking handles diverse scripts within safe size limits', () => {
    // English long sentence
    const enText = 'This is a test of the chunking algorithm. It splits long paragraphs into smaller sentences so upstream providers do not reject the request due to text length constraints.';
    const enChunks = splitIntoChunks(enText, 80);
    expect(enChunks.length).toBeGreaterThan(1);
    for (const c of enChunks) {
      expect(c.length).toBeLessThanOrEqual(80);
    }

    // Indic script with Danda (।)
    const hiText = 'पहला वाक्य यहाँ समाप्त होता है। दूसरा वाक्य यहाँ है। तीसरा वाक्य भी यहाँ उपलब्ध है।';
    const hiChunks = splitIntoChunks(hiText, 45);
    expect(hiChunks.length).toBeGreaterThan(1);
    for (const c of hiChunks) {
      expect(c.length).toBeLessThanOrEqual(45);
    }

    // Arabic script with Arabic question mark (؟) and comma (،)
    const arText = 'هل ترغب في ملء النموذج الآن؟ يرجى إدخال البيانات، ثم الضغط على زر الحفظ للمتابعة.';
    const arChunks = splitIntoChunks(arText, 45);
    expect(arChunks.length).toBeGreaterThan(1);
    for (const c of arChunks) {
      expect(c.length).toBeLessThanOrEqual(45);
    }

    // Chinese text without whitespace
    const zhText = '这是一段非常长的连续中文字符串用来测试分块逻辑是否能在没有空格的情况下安全切分文本。每一段都不能超过最大长度限制！';
    const zhChunks = splitIntoChunks(zhText, 30);
    expect(zhChunks.length).toBeGreaterThan(1);
    for (const c of zhChunks) {
      expect(c.length).toBeLessThanOrEqual(30);
    }
  });

  test('Requirement 1 & 2: /api/tts endpoint rejects empty text and invalid languages with 400', async ({ request }) => {
    // Empty text
    const emptyRes = await request.get('/api/tts?lang=en&text=');
    expect(emptyRes.status()).toBe(400);
    const emptyJson = await emptyRes.json();
    expect(emptyJson.code).toBe('EMPTY_TEXT');

    // Invalid language
    const invalidRes = await request.get('/api/tts?lang=invalid_xyz&text=Hello');
    expect(invalidRes.status()).toBe(400);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.code).toBe('INVALID_LANGUAGE');
  });

  test('Requirement 1, 2 & 3: /api/tts returns valid audio/mpeg for ALL 17 supported languages', async ({ request }) => {
    for (const [lang, phrase] of Object.entries(TEST_PHRASES)) {
      const res = await request.post('/api/tts', {
        data: { lang, text: phrase },
      });

      expect(res.status(), `Failed for language: ${lang}`).toBe(200);
      const contentType = res.headers()['content-type'] || '';
      expect(contentType).toContain('audio/mpeg');

      const body = await res.body();
      expect(body.byteLength, `Audio too small for language: ${lang}`).toBeGreaterThan(100);
      expect(isValidAudioBuffer(body)).toBe(true);

      const provider = res.headers()['x-tts-provider'];
      expect(provider).toBeDefined();
    }
  });

  test('Requirement 2: /api/tts handles long multi-chunk text via POST and returns concatenated audio', async ({ request }) => {
    const longHindi = 'नमस्ते! टेकफॉर्म बडी में आपका स्वागत है। आप अपनी मातृभाषा में बोलकर सरकारी, स्वास्थ्य, बैंकिंग और शिक्षा के फॉर्म भर सकते हैं। हमारी प्रणाली आपकी आवाज़ को सुनकर फ़ील्ड्स को सही तरीके से भरती है। शुरू करने के लिए अपना पसंदीदा फॉर्म चुनें।';

    const res = await request.post('/api/tts', {
      data: { lang: 'hi', text: longHindi },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('audio/mpeg');
    const chunks = parseInt(res.headers()['x-tts-chunks'] || '1', 10);
    expect(chunks).toBeGreaterThanOrEqual(2);

    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(5000);
    expect(isValidAudioBuffer(body)).toBe(true);
  });

  test('Requirement 2 & 4: In-Browser speech synthesis and audio stream verification', async ({ page }) => {
    // Navigate to public landing page where AccessibilityHelper and speech.ts are mounted
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for __TechFormBuddySpeech to be attached
    await page.waitForFunction(() => typeof (window as any).__TechFormBuddySpeech !== 'undefined');

    // Verify speech diagnostics and API client execution in real browser context
    const diagnostics = await page.evaluate(() => {
      const speech = (window as any).__TechFormBuddySpeech;
      return speech.getSpeechDiagnostics();
    });

    expect(diagnostics.supportedLanguagesCount).toBe(17);
    expect(diagnostics.isAudioActive).toBe(false);

    // Test concurrency & cancellation in browser: rapidly triggering speech stops previous audio
    const concurrencyResult = await page.evaluate(async () => {
      const speech = (window as any).__TechFormBuddySpeech;

      // Start first playback
      speech.speakText('First text that should be cancelled', 'en');

      // Rapidly call second speech
      speech.speakText('Second text that takes precedence', 'hi');

      // Stop all speaking
      speech.stopSpeaking();
      const isSpeakingAfterStop = speech.isSpeaking();

      return {
        isSpeakingAfterStop,
        diag: speech.getSpeechDiagnostics(),
      };
    });

    expect(concurrencyResult.isSpeakingAfterStop).toBe(false);
  });

  test('Requirement 3 & 7: Verify all 17 supported languages in browser runtime', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof (window as any).__TechFormBuddySpeech !== 'undefined');

    const langs: { code: string; label: string; nativeName: string; bcp47: string }[] = await page.evaluate(() => {
      return (window as any).__TechFormBuddySpeech.SUPPORTED_LANGUAGES;
    });

    expect(langs.length).toBe(17);

    // Verify key regional Indic and International languages
    const hindi = langs.find(l => l.code === 'hi');
    expect(hindi).toBeDefined();
    expect(hindi?.nativeName).toBe('हिन्दी');
    expect(hindi?.bcp47).toBe('hi-IN');

    const tamil = langs.find(l => l.code === 'ta');
    expect(tamil).toBeDefined();
    expect(tamil?.nativeName).toBe('தமிழ்');
    expect(tamil?.bcp47).toBe('ta-IN');

    const telugu = langs.find(l => l.code === 'te');
    expect(telugu).toBeDefined();
    expect(telugu?.nativeName).toBe('తెలుగు');

    const bengali = langs.find(l => l.code === 'bn');
    expect(bengali).toBeDefined();
    expect(bengali?.nativeName).toBe('বাংলা');

    const arabic = langs.find(l => l.code === 'ar');
    expect(arabic).toBeDefined();
    expect(arabic?.nativeName).toBe('العربية');

    const spanish = langs.find(l => l.code === 'es');
    expect(spanish).toBeDefined();
    expect(spanish?.nativeName).toBe('Español');

    const japanese = langs.find(l => l.code === 'ja');
    expect(japanese).toBeDefined();
    expect(japanese?.nativeName).toBe('日本語');
  });
});
