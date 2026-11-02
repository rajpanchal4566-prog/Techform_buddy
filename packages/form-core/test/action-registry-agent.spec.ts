import { test, expect } from '@playwright/test';
import { validateActionParams, ActionDefinition } from '../../../src/lib/actionRegistry';

test.describe('Action Registry & Conversational Buddy Agent', () => {
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

    // Mock forms API
    await page.route('**/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'form-101',
            title: 'Post-Matric Scholarship 2026',
            category: 'Scholarship',
            status: 'draft',
            language: 'en',
            updated_at: '2026-10-31T00:00:00Z',
          },
        ]),
      });
    });

    // Mock form detail API
    await page.route('**/api/forms/form-101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'form-101',
          title: 'Post-Matric Scholarship 2026',
          category: 'Scholarship',
          status: 'draft',
          fields: JSON.stringify([
            { id: 'full_name', label: 'Full Name', type: 'text', required: true },
          ]),
          filled_data: '{}',
        }),
      });
    });

    // Mock speech synthesis and utterances
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

      const mockSpeech = {
        speaking: false,
        paused: false,
        pending: false,
        cancel: () => {},
        getVoices: () => [
          { name: 'Google US English', lang: 'en-US', voiceURI: 'google-en', default: true },
          { name: 'Google Hindi', lang: 'hi-IN', voiceURI: 'google-hi', default: true },
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
  });

  // TEST 1: "change language to Hindi" asks for confirmation then updates the setting and supports undo
  test('Requirement 7.1: "change language to Hindi" asks for confirmation then updates the setting with undo', async ({ page }) => {
    // Mock /api/assistant/chat to return set_language action proposal
    await page.route('**/api/assistant/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'Do you want to change the application language to Hindi (हिन्दी)?',
          proposedAction: {
            name: 'set_language',
            parameters: { lang: 'hi' },
            confirmationPrompt: 'Do you want to change the application language to Hindi (हिन्दी)?',
          },
        }),
      });
    });

    await page.goto('/forms');
    await page.waitForLoadState('networkidle');

    // Open voice commander
    const badge = page.locator('#tfb-launcher-badge');
    await badge.click();

    // Type "change language to Hindi" into fallback input
    const typedInput = page.locator('#voice-typed-input');
    await typedInput.fill('change language to Hindi');
    await page.locator('#voice-typed-submit-btn').click();

    // 1. Verify confirmation dialog appears with plain words prompt
    const confirmDialog = page.locator('#voice-confirmation-dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Do you want to change the application language to Hindi');

    // Verify language has NOT changed yet in localStorage
    const langBefore = await page.evaluate(() => localStorage.getItem('tfb_lang'));
    expect(langBefore).not.toBe('hi');

    // 2. Click "Confirm & Proceed"
    const confirmBtn = page.locator('#voice-confirm-action-btn');
    await confirmBtn.click();

    // Verify language is now updated to 'hi' in localStorage
    await page.waitForTimeout(300);
    const langAfter = await page.evaluate(() => localStorage.getItem('tfb_lang'));
    expect(langAfter).toBe('hi');

    // Verify feedback announces language changed
    const feedbackBox = page.locator('#voice-intent-result');
    await expect(feedbackBox).toContainText('Language changed to');

    // 3. Open Action Log tab to verify entry and test Undo
    const actionLogTab = page.locator('#tfb-tab-actions');
    await actionLogTab.click();

    const logPanel = page.locator('#voice-action-log');
    await expect(logPanel).toBeVisible();
    await expect(logPanel).toContainText('set_language');
    await expect(logPanel).toContainText('SUCCESS');

    // Verify Undo button exists and click it
    const undoBtn = page.locator('.btn-undo-action').first();
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    // Verify undo restored previous language
    await page.waitForTimeout(300);
    const langAfterUndo = await page.evaluate(() => localStorage.getItem('tfb_lang'));
    expect(langAfterUndo).not.toBe('hi');
  });

  // TEST 2: "download PDF" works through the registry (no DOM selectors)
  test('Requirement 7.2: "download PDF" works through the registry (no DOM selectors)', async ({ page }) => {
    // Track calls to action registry
    await page.addInitScript(() => {
      (window as any).__downloadRegistryExecuted = false;
      window.addEventListener('tfb-action-executed', (e: any) => {
        if (e.detail?.name === 'download_pdf') {
          (window as any).__downloadRegistryExecuted = true;
        }
      });
    });

    // Mock /api/assistant/chat to return download_pdf action proposal
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

    await page.goto('/forms');
    await page.waitForLoadState('networkidle');

    // Open voice commander
    const badge = page.locator('#tfb-launcher-badge');
    await badge.click();

    // Submit "download PDF"
    const typedInput = page.locator('#voice-typed-input');
    await typedInput.fill('download PDF');
    await page.locator('#voice-typed-submit-btn').click();

    // Verify confirmation prompt is presented
    const confirmDialog = page.locator('#voice-confirmation-dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Download');

    // Confirm action
    const confirmBtn = page.locator('#voice-confirm-action-btn');
    await confirmBtn.click();

    // Give time for registry handler execution
    await page.waitForTimeout(400);

    // Verify feedback announces PDF downloaded through registry
    const feedbackBox = page.locator('#voice-intent-result');
    await expect(feedbackBox).toContainText('Downloaded PDF');

    // Verify entry in Action Log
    const actionLogTab = page.locator('#tfb-tab-actions');
    await actionLogTab.click();
    const logPanel = page.locator('#voice-action-log');
    await expect(logPanel).toContainText('download_pdf');
  });

  // TEST 3: Unknown request gets an answer, not an echoed command
  test('Requirement 7.3: Unknown request gets an answer, not an echoed command', async ({ page }) => {
    await page.route('**/api/assistant/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'I am your TechForm Buddy form assistant. I do not have specific information about that on this page. You can ask me to navigate, explain this page, fill form fields, or download a PDF.',
          proposedAction: null,
        }),
      });
    });

    await page.goto('/forms');
    await page.waitForLoadState('networkidle');

    // Open voice commander
    const badge = page.locator('#tfb-launcher-badge');
    await badge.click();

    const unknownQuery = 'quantum computing in bharat 2099';
    const typedInput = page.locator('#voice-typed-input');
    await typedInput.fill(unknownQuery);
    await page.locator('#voice-typed-submit-btn').click();

    // Verify answer box contains informative reply
    const answerBox = page.locator('#voice-qa-answer');
    await expect(answerBox).toBeVisible();
    await expect(answerBox).toContainText('I am your TechForm Buddy form assistant');

    // CRITICAL: Ensure it is NEVER echoed as Command: "..."
    const textContent = await answerBox.textContent();
    expect(textContent).not.toContain(`Command: "${unknownQuery}"`);
    expect(textContent).not.toContain(`Command: ${unknownQuery}`);
  });

  // TEST 4: An action with invalid parameters is rejected
  test('Requirement 7.4: An action with invalid parameters is rejected', async ({ page }) => {
    // 1. Direct unit test of validateActionParams
    const testAction: ActionDefinition = {
      name: 'set_language',
      description: 'Change language',
      parameters: {
        lang: {
          type: 'string',
          required: true,
          enum: ['en', 'hi', 'bn', 'te'],
        },
      },
      handler: async () => {},
    };

    // Missing required parameter
    const missingRes = validateActionParams(testAction, {});
    expect(missingRes.valid).toBe(false);
    expect(missingRes.error).toContain('Missing required parameter');

    // Invalid enum value
    const enumRes = validateActionParams(testAction, { lang: 'french_not_allowed' });
    expect(enumRes.valid).toBe(false);
    expect(enumRes.error).toContain('Invalid value');

    // Wrong type (number instead of string)
    const typeRes = validateActionParams(testAction, { lang: 12345 });
    expect(typeRes.valid).toBe(false);
    expect(typeRes.error).toContain('must be a string');

    // Valid parameters
    const validRes = validateActionParams(testAction, { lang: 'hi' });
    expect(validRes.valid).toBe(true);

    // 2. Integration test via agent loop: backend returns invalid parameters
    await page.route('**/api/assistant/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'Proposing language change with invalid parameters...',
          proposedAction: {
            name: 'set_language',
            parameters: { lang: 'unsupported_language_123' }, // Invalid enum!
          },
        }),
      });
    });

    await page.goto('/forms');
    await page.waitForLoadState('networkidle');

    // Open voice commander
    const badge = page.locator('#tfb-launcher-badge');
    await badge.click();

    const typedInput = page.locator('#voice-typed-input');
    await typedInput.fill('switch to unsupported language');
    await page.locator('#voice-typed-submit-btn').click();

    // Verify rejection feedback appears
    const feedbackBox = page.locator('#voice-intent-result');
    await expect(feedbackBox).toBeVisible();
    await expect(feedbackBox).toContainText('Action rejected');

    // Verify confirmation dialog did NOT open for invalid parameters
    const confirmDialog = page.locator('#voice-confirmation-dialog');
    await expect(confirmDialog).toHaveCount(0);
  });

  // TEST 5: Complete Guide mode explains purpose, steps, preparation, and next step offer
  test('Requirement 5: "complete guide" explains purpose, steps in order, and preparation', async ({ page }) => {
    await page.goto('/forms');
    await page.waitForLoadState('networkidle');

    const badge = page.locator('#tfb-launcher-badge');
    await badge.click();

    const typedInput = page.locator('#voice-typed-input');
    await typedInput.fill('complete guide');
    await page.locator('#voice-typed-submit-btn').click();

    const answerBox = page.locator('#voice-qa-answer');
    await expect(answerBox).toBeVisible();
    const answer = await answerBox.textContent();

    // Verify (a) Purpose
    expect(answer).toContain('(a) Purpose:');
    // Verify (b) Ordered Steps
    expect(answer).toContain('(b) Ordered Steps:');
    // Verify (c) Preparation
    expect(answer).toContain('(c) Preparation:');
    // Verify (d) Next Step offer
    expect(answer).toContain('(d) Next Step:');
  });
});

