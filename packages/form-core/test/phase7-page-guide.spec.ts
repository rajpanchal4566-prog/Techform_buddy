import { test, expect } from '@playwright/test';
import path from 'path';

const VOTERS_HOME_PAGE_URL = 'file:///' + path.resolve(__dirname, '../test-pages/voters-home-sample.html').replace(/\\/g, '/');
const REAL_FORM_PAGE_URL = 'file:///' + path.resolve(__dirname, '../test-pages/portal-sample.html').replace(/\\/g, '/');
const SCRIPT_PATH = path.resolve(__dirname, '../../extension/dist/content-portal.js');
const CORE_IIFE_PATH = path.resolve(__dirname, '../dist/form-core.iife.js');

test.describe('Phase 7: Page Guide Mode, Task Handoff & Detection Refinements', () => {

  // Test (a): Home page with language dropdown and cards -> page guide mode, no "Field 1 of N"
  test('(a) Home page with language dropdown and search box enters Page Guide mode, never reporting "Field 1 of N"', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: true, language: 'en', taskName: 'New Voter Registration' });
            } else if (msg.type === 'TFB_PAGE_GUIDE' || msg.type === 'TFB_ASSISTANT_QUERY') {
              callback({
                success: true,
                data: {
                  title: 'New Voter Registration (ECI Form 6)',
                  summary: 'Welcome to the Voter Services Portal. Follow the guidance below to apply.',
                  guideSteps: [
                    { stepNumber: 1, text: 'Click on "Fill Form 6" to begin your registration.', targetText: 'Fill Form 6' },
                    { stepNumber: 2, text: 'Sign in with your mobile number and OTP.', targetText: undefined },
                  ],
                },
              });
            } else {
              if (callback) callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    await page.goto(VOTERS_HOME_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // 1. Verify launcher badge indicates "Page Guide" rather than form fields
    await page.waitForSelector('#tfb-launcher-badge');
    const badgeText = await page.textContent('#tfb-launcher-badge');
    expect(badgeText).toContain('TechForm Buddy');
    expect(badgeText).toContain('Page Guide');
    expect(badgeText).not.toContain('fields');

    // 2. Click launcher to open overlay
    await page.click('#tfb-launcher-badge');
    await page.waitForSelector('#tfb-active-task-name');

    const overlayText = await page.textContent('#tfb-portal-overlay-host');

    // 3. Must NOT report "Field 1 of N" or treat language switcher as form field
    expect(overlayText).not.toMatch(/Field \d+ of \d+/i);
    expect(overlayText).not.toContain('Select Language, Manual Entry');
    expect(overlayText).not.toContain('Auto-Fill Verified Fields');

    // 4. Must show Page Guide content
    expect(overlayText).toContain('Step 1 of 2');
    expect(overlayText).toContain('Fill Form 6');
  });

  // Test (b): Page with a real multi-field form -> fill mode
  test('(b) Page with a real multi-field form (>= 3 fields) enters Form Fill mode', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: true, language: 'en', appUrl: 'http://localhost:3000' });
            } else if (msg.type === 'TFB_GET_FILL_VALUES') {
              callback({
                success: true,
                fillValues: {
                  full_name: 'Rahul Sharma',
                  email: 'rahul.sharma@example.com',
                  phone: '9876543210',
                },
              });
            } else if (msg.type === 'TFB_MAP_FORM') {
              callback({
                success: true,
                mappings: [
                  { fieldId: 'applicant_name', profileKey: 'full_name', confidence: 0.95 },
                  { fieldId: 'applicant_email', profileKey: 'email', confidence: 0.92 },
                  { fieldId: 'applicant_phone', profileKey: 'phone', confidence: 0.90 },
                ],
              });
            } else {
              if (callback) callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    await page.goto(REAL_FORM_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // 1. Verify launcher badge reflects field count on real multi-field form
    await page.waitForSelector('#tfb-launcher-badge');
    const badgeText = await page.textContent('#tfb-launcher-badge');
    expect(badgeText).toContain('5 fields');

    // 2. Open overlay
    await page.click('#tfb-launcher-badge');
    await page.waitForSelector('#tfb-fill-btn');

    // 3. Confirm Form Fill mode elements are present
    const overlayHtml = await page.innerHTML('#tfb-portal-overlay-host');
    expect(overlayHtml).toContain('Auto-Fill Verified Fields');
    expect(overlayHtml).toContain('5 Form Fields Detected');
  });

  // Test (c): Highlighted element is the one returned by the backend
  test('(c) Highlighted element matches target returned by backend assistant and receives outline', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: true, language: 'en', taskName: 'New Voter Registration' });
            } else if (msg.type === 'TFB_PAGE_GUIDE' || msg.type === 'TFB_ASSISTANT_QUERY') {
              callback({
                success: true,
                data: {
                  title: 'New Voter Registration',
                  summary: 'Start by clicking the registration button.',
                  guideSteps: [
                    { stepNumber: 1, text: 'Click on "Fill Form 6" to begin.', targetText: 'Fill Form 6' },
                    { stepNumber: 2, text: 'Check your application status by clicking "Track Status".', targetText: 'Track Status' },
                  ],
                },
              });
            } else {
              if (callback) callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    await page.goto(VOTERS_HOME_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // Open overlay
    await page.waitForSelector('#tfb-launcher-badge');
    await page.click('#tfb-launcher-badge');
    await page.waitForSelector('#tfb-guide-next-btn');

    // Step 1: Exactly the "Fill Form 6" button (#btn-fill-form-6) must be highlighted!
    const step1BtnHighlighted = await page.$eval('#btn-fill-form-6', (el: HTMLElement) => {
      return el.getAttribute('data-tfb-highlighted') === 'true' && el.style.outline.includes('rgb(37, 99, 235)');
    });
    expect(step1BtnHighlighted).toBe(true);

    // Track status button should NOT be highlighted yet
    const trackBtnInitial = await page.$eval('#btn-track-status', (el: HTMLElement) => {
      return el.getAttribute('data-tfb-highlighted') === 'true';
    });
    expect(trackBtnInitial).toBe(false);

    // Click Next Step
    await page.click('#tfb-guide-next-btn');

    // Step 2: Now "Track Status" (#btn-track-status) must be highlighted, and Form 6 cleared!
    const form6Cleared = await page.$eval('#btn-fill-form-6', (el: HTMLElement) => {
      return el.getAttribute('data-tfb-highlighted') !== 'true';
    });
    expect(form6Cleared).toBe(true);

    const trackBtnHighlighted = await page.$eval('#btn-track-status', (el: HTMLElement) => {
      return el.getAttribute('data-tfb-highlighted') === 'true' && el.style.outline.includes('rgb(37, 99, 235)');
    });
    expect(trackBtnHighlighted).toBe(true);
  });

  // Test (d): Language from the app is used and task name is displayed at the top
  test('(d) Language selected in app is automatically used, and task name appears at top', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({
                connected: true,
                language: 'hi',
                taskName: 'नया मतदाता पंजीकरण (New Voter Registration)',
                appUrl: 'http://localhost:3000',
              });
            } else if (msg.type === 'TFB_PAGE_GUIDE' || msg.type === 'TFB_ASSISTANT_QUERY') {
              callback({
                success: true,
                data: {
                  title: 'नया मतदाता पंजीकरण (Form 6)',
                  summary: 'मतदाता सेवा पोर्टल में आपका स्वागत है।',
                  guideSteps: [
                    { stepNumber: 1, text: 'पंजीकरण शुरू करने के लिए "Fill Form 6" पर क्लिक करें।', targetText: 'Fill Form 6' },
                  ],
                },
              });
            } else {
              if (callback) callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    await page.goto(VOTERS_HOME_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    await page.waitForSelector('#tfb-launcher-badge');
    await page.click('#tfb-launcher-badge');
    await page.waitForSelector('#tfb-active-task-name');

    // 1. Task name appears at the top of the overlay
    const taskNameText = await page.textContent('#tfb-active-task-name');
    expect(taskNameText).toContain('नया मतदाता पंजीकरण');

    // 2. Language selector has Hindi ('hi') pre-selected
    const selectedLang = await page.$eval('#tfb-overlay-lang-select', (el: any) => el.value);
    expect(selectedLang).toBe('hi');

    // 3. Overlay title and action buttons rendered in Hindi
    const overlayHtml = await page.innerHTML('#tfb-portal-overlay-host');
    expect(overlayHtml).toContain('टेकफॉर्म बडी सहायक');
    expect(overlayHtml).toContain('बोलकर सुनाएं');
  });

  // Test (e): Read aloud calls speechSynthesis with the right language
  test('(e) Read aloud invokes speechSynthesis with matching language (hi-IN for Hindi)', async ({ page }) => {
    await page.addInitScript(() => {
      // Setup mocked speechSynthesis
      const spokenUtterances: { text: string; lang: string; voiceLang?: string }[] = [];
      (window as any).__spokenUtterances = spokenUtterances;

      const mockVoices = [
        { name: 'Google US English', lang: 'en-US', default: true },
        { name: 'Google हिन्दी', lang: 'hi-IN', default: false },
      ];

      const mockSpeech = {
        speaking: false,
        paused: false,
        pending: false,
        cancel: () => {},
        getVoices: () => mockVoices,
        speak: (utter: any) => {
          spokenUtterances.push({
            text: utter.text,
            lang: utter.lang,
            voiceLang: utter.voice ? utter.voice.lang : undefined,
          });
          if (utter.onend) setTimeout(utter.onend, 10);
        },
      };

      Object.defineProperty(window, 'speechSynthesis', {
        value: mockSpeech,
        configurable: true,
        writable: true,
      });

      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: true, language: 'hi', taskName: 'New Voter Registration' });
            } else if (msg.type === 'TFB_PAGE_GUIDE' || msg.type === 'TFB_ASSISTANT_QUERY') {
              callback({
                success: true,
                data: {
                  title: 'New Voter Registration',
                  summary: 'Welcome.',
                  guideSteps: [
                    { stepNumber: 1, text: 'पंजीकरण शुरू करने के लिए "Fill Form 6" पर क्लिक करें।', targetText: 'Fill Form 6' },
                  ],
                },
              });
            } else if (msg.type === 'TFB_ASSISTANT_CHAT') {
              callback({
                success: true,
                reply: 'पंजीकरण शुरू करने के लिए Fill Form 6 पर क्लिक करें।',
              });
            } else if (msg.type === 'TFB_TRANSLATE_TO_LANGUAGE') {
              callback({
                success: true,
                translatedText: msg.text || 'पंजीकरण शुरू करने के लिए Fill Form 6 पर क्लिक करें।',
              });
            } else {
              if (callback) callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    page.on('console', msg => console.log('PAGE_LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE_ERROR:', err));

    await page.goto(VOTERS_HOME_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // Open overlay
    await page.waitForSelector('#tfb-launcher-badge');
    await page.click('#tfb-launcher-badge');

    // Click Read Aloud button
    await page.waitForSelector('#tfb-tts-btn');
    await page.click('#tfb-tts-btn');

    // Wait for async speech processing
    await page.waitForTimeout(600);

    // Check that speechSynthesis.speak was invoked with hi-IN language!
    const spoken = await page.evaluate(() => (window as any).__spokenUtterances);
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken[0].lang).toBe('hi-IN');
    if (spoken[0].voiceLang) {
      expect(spoken[0].voiceLang).toBe('hi-IN');
    }
    const hasGuideText = spoken.some((s: any) => s.text.includes('Fill Form 6'));
    expect(hasGuideText).toBe(true);

    // Test missing voice notice: when no voice for selected language exists
    const missingVoiceNoticeShown = await page.evaluate(async () => {
      // Change mock voices to English only
      (window as any).speechSynthesis.getVoices = () => [{ name: 'Google US English', lang: 'en-US' }];
      // Trigger speak on step in Hindi
      const btn = document.getElementById('tfb-tts-btn') as HTMLButtonElement;
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 50));
      const host = document.getElementById('tfb-portal-overlay-host');
      return host ? host.innerHTML.includes('Notice: No voice installed') || host.innerHTML.includes('कोई आवाज नहीं') : false;
    });
    expect(missingVoiceNoticeShown).toBe(true);

    // Test auto-read toggle checkbox
    const autoReadCheckbox = await page.$('#tfb-auto-read-toggle');
    expect(autoReadCheckbox).not.toBeNull();
    await page.check('#tfb-auto-read-toggle');
    const isChecked = await page.$eval('#tfb-auto-read-toggle', (el: any) => el.checked);
    expect(isChecked).toBe(true);
  });

});
