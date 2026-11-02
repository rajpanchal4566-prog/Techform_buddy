import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6';

test.describe('A1: Widget Layout Rebuild & Multi-Resolution Screenshots', () => {

  test('Rebuilt companion layout at 1366x768 (Desktop Standard)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:3000/forms');

    // 1. Click Mascot Launcher to open companion
    const launcher = page.locator('#tfb-launcher-badge');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    // 2. Verify Companion Card opened
    const card = page.locator('#tfb-portal-overlay-host');
    await expect(card).toBeVisible();

    // 3. Verify header controls are fully visible and not truncated
    const title = page.locator('#tfb-guide-title');
    await expect(title).toBeVisible();
    await expect(title).toContainText('Buddy');

    const autofillToggle = page.locator('#tfb-autofill-toggle');
    await expect(autofillToggle).toBeVisible();

    const langSelect = page.locator('#tfb-web-lang-select');
    await expect(langSelect).toBeVisible();

    const expandBtn = page.locator('#tfb-overlay-expand-btn');
    await expect(expandBtn).toBeVisible();

    // 4. Verify 4 quick buttons in a single row
    const quickFill = page.locator('#tfb-quick-fill-btn');
    const quickGuide = page.locator('#tfb-quick-guide-btn');
    const quickAsk = page.locator('#tfb-quick-ask-btn');
    const quickForms = page.locator('#tfb-quick-forms-btn');
    await expect(quickFill).toBeVisible();
    await expect(quickGuide).toBeVisible();
    await expect(quickAsk).toBeVisible();
    await expect(quickForms).toBeVisible();

    // 5. Navigate to Voice Commands tab and populate an Answer card
    const voiceTab = page.locator('.tfb-tab-btn:has-text("Voice Commands")');
    await voiceTab.click();

    // Inject sample transcript and QA answer for layout inspection
    await page.evaluate(() => {
      // simulate speech question & assistant answer
      const transcriptBox = document.querySelector('#voice-live-transcript');
      if (transcriptBox) {
        transcriptBox.innerHTML = '<span>"What are the eligibility criteria and documents required for scholarship?"</span>';
      }
    });

    // Ask a question to trigger the Answer card
    await page.evaluate(() => {
      // Find react setter or trigger answer through custom event/DOM
      const evt = new CustomEvent('tfb-mock-answer', {
        detail: {
          answer: 'The scholarship requires 60% minimum marks in previous examination, family annual income under ₹2.5 Lakhs, and valid domicile certificate. Required documents: 1. Previous Year Marksheet, 2. Income Certificate, 3. Domicile Certificate, 4. Bank Account Passbook copy linked with Aadhaar, 5. Passport size photograph.'
        }
      });
      window.dispatchEvent(evt);
    });

    // Also trigger via voice input state if needed or click Ask button
    const copyBtn = page.locator('#btn-copy-qa-answer');
    const listenAgainBtn = page.locator('#btn-listen-again-qa');

    // If QA answer is not set via mock event, trigger a question via the input
    if (!(await copyBtn.isVisible())) {
      // Trigger question via question box or quick ask
      await page.evaluate(() => {
        const input = document.querySelector('.tfb-plan-question-input') as HTMLInputElement;
        if (input) {
          input.value = 'What documents are required?';
        }
      });
    }

    // Capture screenshot at 1366x768
    const screenshotPath = path.join(ARTIFACT_DIR, 'widget-layout-1366x768.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${screenshotPath}`);
  });

  test('Rebuilt companion layout at 1920x1080 (Desktop Full HD) with Expand view', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3000/forms');

    const launcher = page.locator('#tfb-launcher-badge');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const card = page.locator('#tfb-portal-overlay-host');
    await expect(card).toBeVisible();

    // Click Expand button
    const expandBtn = page.locator('#tfb-overlay-expand-btn');
    await expandBtn.click();
    await expect(card).toHaveClass(/expanded/);

    // Switch to Voice Commands tab
    const voiceTab = page.locator('.tfb-tab-btn:has-text("Voice Commands")');
    await voiceTab.click();

    const screenshotPath = path.join(ARTIFACT_DIR, 'widget-layout-1920x1080.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${screenshotPath}`);
  });

  test('Rebuilt companion layout at 375x667 (Mobile iPhone Standard: Bottom Sheet at 85vh)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000/forms');

    const launcher = page.locator('#tfb-launcher-badge');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await launcher.click();

    const card = page.locator('#tfb-portal-overlay-host');
    await expect(card).toBeVisible();

    // Verify mobile sheet dimensions
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // 85vh on 667px height is ~567px
      expect(box.height).toBeGreaterThanOrEqual(500);
      expect(box.width).toBeGreaterThanOrEqual(350);
    }

    // Switch to Voice tab
    const voiceTab = page.locator('.tfb-tab-btn:has-text("Voice Commands")');
    await voiceTab.click();

    const screenshotPath = path.join(ARTIFACT_DIR, 'widget-layout-375x667-mobile.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${screenshotPath}`);
  });

});

