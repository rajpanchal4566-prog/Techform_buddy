import { test, expect } from '@playwright/test';

test.describe('Voice Selector & Hydration Mismatch Fixes', () => {
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth session so all protected pages load without redirection
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { name: 'Raj Vishwakarma', email: 'raj@example.com' },
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    });

    // Mock form-watches and watcher APIs
    await page.route('**/api/form-watches**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/watcher/run**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sources: [] }),
      });
    });

    // Mock documents API
    await page.route('**/api/documents**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [] }),
      });
    });

    // Mock profile API
    await page.route('**/api/profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ fullName: 'Raj Vishwakarma', email: 'raj@example.com' }),
      });
    });

    // Mock /api/assistant/chat so Agent Loop returns download_pdf proposal on voice command
    await page.route('**/api/assistant/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'Do you want to download the application form as a PDF document?',
          proposedAction: {
            name: 'download_pdf',
            parameters: { formId: 'form-101' },
            confirmationPrompt: 'Download the application form as PDF?',
          },
        }),
      });
    });
  });

  // TEST 1: Voice command "download PDF" on /forms works without SyntaxError
  test('Voice command "download PDF" executes safely with valid CSS selector', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Mock Speech & Window.print tracking
    await page.addInitScript(() => {
      (window as any).__printCalled = false;
      window.print = () => {
        (window as any).__printCalled = true;
      };

      const spokenUtterances: { text: string; lang: string }[] = [];
      (window as any).__spokenUtterances = spokenUtterances;

      class MockSpeechSynthesisUtterance {
        text: string;
        lang: string = 'en-US';
        voice: any = null;
        rate = 1;
        pitch = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

      class MockSpeechRecognition {
        continuous = false;
        interimResults = true;
        lang = 'en-US';
        onstart: (() => void) | null = null;
        onresult: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          if (this.onstart) this.onstart();
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                resultIndex: 0,
                results: [
                  Object.assign([{ transcript: 'download PDF' }], { isFinal: true }),
                ],
              });
            }
            if (this.onend) this.onend();
          }, 80);
        }

        stop() { if (this.onend) this.onend(); }
        abort() { if (this.onend) this.onend(); }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;

      const mockSpeech = {
        speaking: false,
        paused: false,
        pending: false,
        cancel: () => {},
        getVoices: () => [
          { name: 'Google US English', lang: 'en-US', voiceURI: 'google-en', default: true },
        ],
        speak: (utter: any) => {
          spokenUtterances.push({ text: utter.text, lang: utter.lang });
          if (utter.onend) setTimeout(utter.onend, 10);
        },
      };

      Object.defineProperty(window, 'speechSynthesis', {
        value: mockSpeech,
        configurable: true,
        writable: true,
      });
    });

    await page.goto('/forms');
    await page.waitForLoadState('networkidle');

    // Click mic button on Buddy badge
    const micBtn = page.locator('#voice-command-mic-btn');
    await expect(micBtn).toBeVisible();
    await micBtn.click();

    // Allow speech recognition mock to fire and download handler to execute
    await page.waitForTimeout(600);

    // Prompt 10 Action Registry policy requires confirmation for download_pdf
    const confirmBtn = page.locator('#voice-confirm-action-btn');
    await confirmBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => null);
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }

    // Verify window.print() or download handler was reached
    const printWasCalled = await page.evaluate(() => (window as any).__printCalled);
    expect(printWasCalled).toBe(true);

    // CRITICAL: Ensure NO DOMException or SyntaxError was logged!
    const syntaxErrors = consoleErrors.filter(
      (e) => e.includes('has-text') || e.includes('not a valid selector') || e.includes('SyntaxError')
    );
    expect(syntaxErrors).toHaveLength(0);
  });

  // TEST 2: Fail-safe try/catch handles action failures without crashing or console overlay
  test('Voice intent execution wraps in try/catch and announces "I could not do that"', async ({ page }) => {
    await page.addInitScript(() => {
      const spokenUtterances: { text: string; lang: string }[] = [];
      (window as any).__spokenUtterances = spokenUtterances;

      class MockSpeechSynthesisUtterance {
        text: string;
        lang: string = 'en-US';
        voice: any = null;
        rate = 1;
        pitch = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

      class MockSpeechRecognition {
        continuous = false;
        interimResults = true;
        lang = 'en-US';
        onstart: (() => void) | null = null;
        onresult: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        onend: (() => void) | null = null;

        start() {
          if (this.onstart) this.onstart();
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                resultIndex: 0,
                results: [
                  Object.assign([{ transcript: 'next step' }], { isFinal: true }),
                ],
              });
            }
            if (this.onend) this.onend();
          }, 80);
        }

        stop() { if (this.onend) this.onend(); }
        abort() { if (this.onend) this.onend(); }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;

      const mockSpeech = {
        speaking: false,
        paused: false,
        pending: false,
        cancel: () => {},
        getVoices: () => [
          { name: 'Google US English', lang: 'en-US', voiceURI: 'google-en', default: true },
        ],
        speak: (utter: any) => {
          spokenUtterances.push({ text: utter.text, lang: utter.lang });
          if (utter.onend) setTimeout(utter.onend, 10);
        },
      };
      Object.defineProperty(window, 'speechSynthesis', {
        value: mockSpeech,
        configurable: true,
        writable: true,
      });

      // Intentionally cause window.dispatchEvent to throw when STEP_NEXT tries to fire
      const origDispatch = window.dispatchEvent.bind(window);
      window.dispatchEvent = (event: any) => {
        if (event.type === 'tfb-step-change') {
          throw new Error('Simulated DOM event exception');
        }
        return origDispatch(event);
      };
    });

    await page.goto('/forms');
    await page.waitForLoadState('networkidle');

    // Click mic button to trigger recognition of "next step"
    const micBtn = page.locator('#voice-command-mic-btn');
    await expect(micBtn).toBeVisible();
    await micBtn.click();

    // Allow execution to fail and catch block to run
    await page.waitForTimeout(600);

    // Verify spoken message contains "I could not do that."
    const spoken = await page.evaluate(() => (window as any).__spokenUtterances);
    expect(spoken.some((s: any) => s.text.includes('I could not do that'))).toBe(true);

    // Verify visible feedback is updated
    const intentResult = page.locator('#voice-intent-result');
    await expect(intentResult).toContainText('I could not do that');

    // Ensure Next.js error overlay dialog was NOT triggered
    const errorDialog = page.locator('[data-nextjs-dialog-header], .nextjs-container-errors');
    await expect(errorDialog).toHaveCount(0);
  });

  // TEST 3: Zero hydration warnings & zero console errors across all main pages
  test('No hydration warnings or console errors across pages', async ({ page }) => {
    const hydrationErrors: string[] = [];
    const runtimeErrors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('Hydration failed') ||
        text.includes('Text content did not match') ||
        text.includes("server rendered HTML didn't match") ||
        text.includes('Warning: Prop `') ||
        text.includes('did not match. Server:')
      ) {
        hydrationErrors.push(text);
      }
      if (msg.type() === 'error') {
        runtimeErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      runtimeErrors.push(err.message);
    });

    const routesToCheck = [
      '/',
      '/forms',
      '/dashboard',
      '/documents',
      '/browser',
      '/settings',
      '/form-watch',
      '/profile',
      '/login',
      '/register',
    ];

    for (const route of routesToCheck) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(300);

      // Verify the Smart Briefing button deterministic attributes
      const briefingBtn = page.locator('#voice-read-page-btn');
      if (await briefingBtn.count() > 0) {
        const title = await briefingBtn.getAttribute('title');
        const ariaLabel = await briefingBtn.getAttribute('aria-label');
        expect(title).toBeTruthy();
        expect(ariaLabel).toBeTruthy();
      }
    }

    // Filter out expected 401s if unauthenticated API calls happen during testing
    const criticalErrors = runtimeErrors.filter(
      (err) =>
        !err.includes('401') &&
        !err.includes('status of 404') &&
        !err.includes('favicon.ico')
    );

    // Assert strictly ZERO hydration mismatch errors
    expect(hydrationErrors).toHaveLength(0);
    // Assert strictly ZERO critical runtime exceptions
    expect(criticalErrors).toHaveLength(0);
  });
});
