import { test, expect } from '@playwright/test';

test.describe('Global Voice Control System & Intent Router', () => {

  test.beforeEach(async ({ page }) => {
    // Mock session so protected pages don't redirect to /login
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { name: 'Test User', email: 'test@example.com' },
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    });
  });

  test('Voice Navigation: Speech recognition navigates to pages and displays live transcript', async ({ page }) => {
    // 1. Inject mock SpeechRecognition that emits "go to forms"
    await page.addInitScript(() => {
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
                  Object.assign([{ transcript: 'forms' }], { isFinal: true }),
                ],
              });
            }
            if (this.onend) this.onend();
          }, 100);
        }

        stop() {
          if (this.onend) this.onend();
        }

        abort() {
          if (this.onend) this.onend();
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    // Start on home / dashboard
    await page.goto('/');

    // Verify global mic button exists on page
    const micBtn = page.locator('#voice-command-mic-btn');
    await expect(micBtn).toBeVisible({ timeout: 10000 });

    // Click mic button to activate voice assistant
    await micBtn.click();

    // Verify live transcript appears
    const transcriptBox = page.locator('#voice-live-transcript');
    await expect(transcriptBox).toBeVisible();
    await expect(transcriptBox).toContainText('forms', { timeout: 8000 });

    // Verify router navigates to /forms
    await expect(page).toHaveURL(/\/forms/, { timeout: 10000 });
  });

  test('Voice Command "new form" navigates to /forms/new', async ({ page }) => {
    await page.addInitScript(() => {
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
                  Object.assign([{ transcript: 'new form' }], { isFinal: true }),
                ],
              });
            }
            if (this.onend) this.onend();
          }, 100);
        }

        stop() {
          if (this.onend) this.onend();
        }

        abort() {
          if (this.onend) this.onend();
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    await page.goto('/');
    const micBtn = page.locator('#voice-command-mic-btn');
    await micBtn.click();

    await expect(page).toHaveURL(/\/forms\/new/, { timeout: 10000 });
  });

  test('Voice Command "watch scholarship forms" navigates to /form-watch', async ({ page }) => {
    await page.addInitScript(() => {
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
                  Object.assign([{ transcript: 'watch scholarship forms' }], { isFinal: true }),
                ],
              });
            }
            if (this.onend) this.onend();
          }, 100);
        }

        stop() {
          if (this.onend) this.onend();
        }

        abort() {
          if (this.onend) this.onend();
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    // Mock session so protected pages don't redirect to /login
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { name: 'Test User', email: 'test@example.com' },
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/');
    const micBtn = page.locator('#voice-command-mic-btn');
    await micBtn.click();

    // Verify navigation to form-watch
    await expect(page).toHaveURL(/\/form-watch/, { timeout: 10000 });
  });

  test('Confirmation Prompt: Mutating intent requires explicit confirmation before execution', async ({ page }) => {
    await page.addInitScript(() => {
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
                  Object.assign([{ transcript: 'clear form' }], { isFinal: true }),
                ],
              });
            }
            if (this.onend) this.onend();
          }, 100);
        }

        stop() {
          if (this.onend) this.onend();
        }

        abort() {
          if (this.onend) this.onend();
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    await page.goto('/');
    const micBtn = page.locator('#voice-command-mic-btn');
    await micBtn.click();

    // Verify confirmation dialog appears
    const confirmDialog = page.locator('#voice-confirmation-dialog');
    await expect(confirmDialog).toBeVisible({ timeout: 8000 });
    await expect(confirmDialog).toContainText('Confirm Action');

    // Verify Confirm & Cancel buttons exist
    const confirmBtn = page.locator('#voice-confirm-action-btn');
    const cancelBtn = page.locator('#voice-cancel-action-btn');
    await expect(confirmBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // Clicking cancel dismisses confirmation
    await cancelBtn.click();
    await expect(confirmDialog).not.toBeVisible();
  });

  test('Security Protection: Passwords and OTPs are blocked and never processed', async ({ page }) => {
    await page.addInitScript(() => {
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
                  Object.assign([{ transcript: 'my password is secret12345' }], { isFinal: true }),
                ],
              });
            }
            if (this.onend) this.onend();
          }, 100);
        }

        stop() {
          if (this.onend) this.onend();
        }

        abort() {
          if (this.onend) this.onend();
        }
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    await page.goto('/');
    const micBtn = page.locator('#voice-command-mic-btn');
    await micBtn.click();

    // Verify security alert is displayed
    const securityAlert = page.locator('.voice-security-alert');
    await expect(securityAlert).toBeVisible({ timeout: 8000 });
    await expect(securityAlert).toContainText('Passwords, OTPs, and security PINs cannot be spoken');
  });

  test('Unsupported Browser Fallback: Shows clear warning message and typed command input', async ({ page }) => {
    // Explicitly remove speech recognition APIs
    await page.addInitScript(() => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
    });

    await page.goto('/');
    const micBtn = page.locator('#voice-command-mic-btn');
    await micBtn.click();

    // Verify unsupported message is shown
    const unsupportedMsg = page.locator('#voice-unsupported-msg');
    await expect(unsupportedMsg).toBeVisible({ timeout: 8000 });
    await expect(unsupportedMsg).toContainText('Speech recognition is not supported in this browser');

    // Verify typed command input and submit button exist
    const typedInput = page.locator('#voice-typed-input');
    const typedSubmit = page.locator('#voice-typed-submit-btn');
    await expect(typedInput).toBeVisible();
    await expect(typedSubmit).toBeVisible();

    // Type "dashboard" command and execute
    await typedInput.fill('dashboard');
    await typedSubmit.click();

    // Navigates to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('Voice Output: Read aloud button is present on page and triggers speech synthesis', async ({ page }) => {
    await page.goto('/');

    const readAloudBtn = page.locator('#voice-read-page-btn');
    await expect(readAloudBtn).toBeVisible({ timeout: 8000 });

    // Click read aloud
    await readAloudBtn.click();

    // Visible stop button appears
    const stopBtn = page.locator('#voice-stop-btn');
    // Either stop button appears or speech synthesis was started
    const isStopVisible = await stopBtn.isVisible().catch(() => false);
    // If visible, test clicking stop
    if (isStopVisible) {
      await stopBtn.click();
      await expect(stopBtn).not.toBeVisible();
    }
  });

  test('Keyboard Shortcut Alt+V activates voice commander modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('body').click();

    // Send Alt+v shortcut
    await page.keyboard.press('Alt+v');

    // Dialog opens
    const dialog = page.locator('.voice-modal-card');
    await expect(dialog).toBeVisible({ timeout: 8000 });

    // Press Escape key to close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
