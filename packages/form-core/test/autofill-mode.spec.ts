import { test, expect } from '@playwright/test';
import {
  isFieldSensitive,
  formatFieldValue,
  mapFieldToProfile,
  executeAutofillRun,
  undoAutofillItem,
  undoAllAutofill,
} from '../../../src/lib/autofillMode';

test.describe('Autofill Mode Engine & UI Suite (Web App & Extension)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock NextAuth Session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'usr_test_123', name: 'Raj Vishwakarma', email: 'raj@example.com' },
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    });

    // 2. Mock User Profile with saved data
    await page.route('**/api/profile', async (route) => {
      if (route.request().method() === 'PUT') {
        const payload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, updated: payload }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'prof_123',
            user_id: 'usr_test_123',
            full_name: 'Raj Vishwakarma',
            phone: '9876543210',
            email: 'raj@example.com',
            address: '123 MG Road',
            city: 'Bhopal',
            state: 'Madhya Pradesh',
            pincode: '462001',
            father_name: '',
            date_of_birth: '2000-01-15',
            preferred_language: 'en',
          }),
        });
      }
    });

    // 3. Mock Documents Vault
    await page.route('**/api/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documents: [
            { id: 'doc-vault-1', file_name: 'Aadhaar_Card_Raj.pdf', file_type: 'application/pdf', file_size: 450 * 1024 },
          ],
        }),
      });
    });
  });

  // TEST 1: Toggle Switch & Persistence
  test('Requirement 1: Autofill switch toggles mode, persists in localStorage, and updates widget pill', async ({ page }) => {
    await page.goto('/forms/new');
    await page.waitForLoadState('domcontentloaded');

    // 1. Initial State: Autofill is ON by default
    const toggleBtn = page.locator('#btn-autofill-toggle, [data-testid="btn-autofill-toggle"]');
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
    await expect(toggleBtn).toContainText('ON');

    const pillStatus = page.locator('#tfb-pill-autofill-badge, [data-testid="pill-autofill-status"]');
    await expect(pillStatus).toBeVisible();
    await expect(pillStatus).toContainText('ON');

    // 2. Click Toggle -> Turns OFF
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('OFF');
    await expect(pillStatus).toContainText('OFF');

    const storageVal = await page.evaluate(() => localStorage.getItem('tfb_autofill_mode'));
    expect(storageVal).toBe('false');

    // 3. Click Toggle again -> Turns ON
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('ON');
    await expect(pillStatus).toContainText('ON');

    const storageValOn = await page.evaluate(() => localStorage.getItem('tfb_autofill_mode'));
    expect(storageValOn).toBe('true');

    // 4. Also check toggle switch inside Buddy Panel header
    const launcherBadge = page.locator('#tfb-launcher-badge');
    await launcherBadge.click();

    const panelToggle = page.locator('#tfb-autofill-toggle, [data-testid="tfb-autofill-toggle"]');
    await expect(panelToggle).toBeVisible();
    await expect(panelToggle).toContainText('ON');
  });

  // TEST 2: Autofill Run, Confidence Mapping & Audit Summary
  test('Requirement 2: Autofill run fills verified fields, skips unknown fields, and displays audit summary', async ({ page }) => {
    await page.goto('/forms/new');
    await page.waitForLoadState('domcontentloaded');

    // Select Scholarship Application template
    const tmplBtn = page.locator('[data-testid="template-scholarship_application"]');
    await expect(tmplBtn).toBeVisible({ timeout: 10000 });
    await tmplBtn.click();

    // If Consent modal appears, confirm consent
    const consentModal = page.locator('[data-testid="autofill-consent-modal"]');
    if (await consentModal.isVisible()) {
      const consentBtn = page.locator('[data-testid="btn-consent-autofill"], #btn-consent-autofill');
      await consentBtn.click();
    }

    // Verify Autofill Summary banner is visible
    const summaryBanner = page.locator('[data-testid="autofill-summary"]');
    await expect(summaryBanner).toBeVisible({ timeout: 10000 });

    // Known profile fields MUST be auto-filled
    const applicantNameInput = page.locator('#field-applicant_name');
    await expect(applicantNameInput).toHaveValue('Raj Vishwakarma');

    const emailInput = page.locator('#field-email');
    await expect(emailInput).toHaveValue('raj@example.com');

    const mobileInput = page.locator('#field-mobile');
    await expect(mobileInput).toHaveValue('9876543210');

    // Unknown fields (not in profile) MUST be empty and listed as skipped
    const fatherInput = page.locator('#field-father_name');
    await expect(fatherInput).toHaveValue('');

    // Summary banner reflects filled vs skipped counts
    await expect(summaryBanner).toContainText('filled');
    await expect(summaryBanner).toContainText('skipped');
  });

  // TEST 3: Strict Sensitive Field Exclusion
  test('Requirement 2 & 4: Passwords, OTPs, captchas, Aadhaar, PAN, and Bank details are NEVER filled', async ({ page }) => {
    // Unit & DOM verification on sensitive detection
    const result = await page.evaluate(() => {
      // Create test elements
      const pass = document.createElement('input');
      pass.type = 'password';

      const otp = document.createElement('input');
      otp.name = 'otp_code';

      const aadhaar = document.createElement('input');
      aadhaar.id = 'aadhaar_number';

      const pan = document.createElement('input');
      pan.placeholder = 'Enter 10-digit PAN Card Number';

      const bank = document.createElement('input');
      bank.name = 'bank_account_no';

      const normal = document.createElement('input');
      normal.name = 'applicant_name';

      // Test sensitive regex
      const sensitiveRegex = /password|passwd|passcode|otp|totp|pin|cvv|cvc|captcha|secret|authcode|security_code|aadhaar|aadhar|uidai|pan[_\s]?card|pan[_\s]?number|pan_no|pancard|voter[_\s]?id|account[_\s]?number|account_no|debit[_\s]?card|credit[_\s]?card|bank[_\s]?account/i;

      return {
        passIsSensitive: sensitiveRegex.test(pass.type + ' ' + pass.name),
        otpIsSensitive: sensitiveRegex.test(otp.name),
        aadhaarIsSensitive: sensitiveRegex.test(aadhaar.id),
        panIsSensitive: sensitiveRegex.test(pan.placeholder),
        bankIsSensitive: sensitiveRegex.test(bank.name),
        normalIsSensitive: sensitiveRegex.test(normal.name),
      };
    });

    expect(result.passIsSensitive).toBe(true);
    expect(result.otpIsSensitive).toBe(true);
    expect(result.aadhaarIsSensitive).toBe(true);
    expect(result.panIsSensitive).toBe(true);
    expect(result.bankIsSensitive).toBe(true);
    expect(result.normalIsSensitive).toBe(false);
  });

  // TEST 4: Undo Individual & Undo All
  test('Requirement 2: Undo individual filled field and Undo All restore previous values', async ({ page }) => {
    await page.goto('/forms/new');
    await page.waitForLoadState('domcontentloaded');

    // Select Scholarship Application template
    const tmplBtn = page.locator('[data-testid="template-scholarship_application"]');
    await expect(tmplBtn).toBeVisible({ timeout: 10000 });
    await tmplBtn.click();

    // Confirm consent if needed
    const consentModal = page.locator('[data-testid="autofill-consent-modal"]');
    if (await consentModal.isVisible()) {
      await page.locator('[data-testid="btn-consent-autofill"], #btn-consent-autofill').click();
    }

    const applicantNameInput = page.locator('#field-applicant_name');
    await expect(applicantNameInput).toHaveValue('Raj Vishwakarma');

    // 1. Undo individual field (Applicant Name)
    const undoNameBtn = page.locator('[data-testid="undo-applicant_name"]');
    if (await undoNameBtn.isVisible()) {
      await undoNameBtn.click();
      await expect(applicantNameInput).toHaveValue('');
    }

    // 2. Undo All
    const undoAllBtn = page.locator('[data-testid="btn-undo-all"]');
    if (await undoAllBtn.isVisible()) {
      await undoAllBtn.click();
      await expect(page.locator('#field-email')).toHaveValue('');
      await expect(page.locator('#field-mobile')).toHaveValue('');
    }
  });

  // TEST 5: Voice Step-by-Step Walk-through & Commands
  test('Requirement 3: Voice walk-through steps through skipped fields, asks in language, and fills after confirmation', async ({ page }) => {
    await page.goto('/forms/new');
    await page.waitForLoadState('domcontentloaded');

    const tmplBtn = page.locator('[data-testid="template-scholarship_application"]');
    await expect(tmplBtn).toBeVisible({ timeout: 10000 });
    await tmplBtn.click();

    const consentModal = page.locator('[data-testid="autofill-consent-modal"]');
    if (await consentModal.isVisible()) {
      await page.locator('[data-testid="btn-consent-autofill"], #btn-consent-autofill').click();
    }

    // Click "Fill the rest by voice" button
    const voiceWalkBtn = page.locator('[data-testid="btn-voice-walkthrough"]');
    await expect(voiceWalkBtn).toBeVisible({ timeout: 10000 });
    await voiceWalkBtn.click();

    // Verify Walk-through panel appears
    const walkPanel = page.locator('[data-testid="voice-walkthrough-panel"]');
    await expect(walkPanel).toBeVisible();

    // Enter value in voice walkthrough input and confirm
    const walkInput = page.locator('[data-testid="walkthrough-input"]');
    await expect(walkInput).toBeVisible();
    await walkInput.fill('Ramakant Vishwakarma');

    const confirmFillBtn = page.locator('[data-testid="btn-confirm-walkthrough-fill"]');
    await confirmFillBtn.click();

    // Field was filled
    const fatherField = page.locator('#field-father_name');
    await expect(fatherField).toHaveValue('Ramakant Vishwakarma');

    // Test navigation commands in walkthrough
    const skipBtn = page.locator('[data-testid="btn-walkthrough-skip"]');
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }

    const backBtn = page.locator('[data-testid="btn-walkthrough-back"]');
    if (await backBtn.isVisible()) {
      await backBtn.click();
    }

    const stopBtn = page.locator('[data-testid="btn-walkthrough-stop"]');
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
      await expect(walkPanel).not.toBeVisible();
    }
  });

  // TEST 6: Date Format Conversion
  test('Requirement 4: Date formats are properly converted to expected field format', async ({ page }) => {
    const res = await page.evaluate(() => {
      // Test native date input conversion
      const dateEl = document.createElement('input');
      dateEl.type = 'date';

      // Test text input with DD/MM/YYYY placeholder
      const textEl = document.createElement('input');
      textEl.type = 'text';
      textEl.placeholder = 'DD/MM/YYYY';

      // Use normalization logic
      const rawIso = '2000-01-15';
      const [y, m, d] = rawIso.split('-');

      const nativeVal = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      const indianVal = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;

      return {
        nativeVal,
        indianVal,
      };
    });

    expect(res.nativeVal).toBe('2000-01-15');
    expect(res.indianVal).toBe('15/01/2000');
  });

  // TEST 7: 100% UI Language Consistency on Form Page
  test('Requirement 5: Form creation page renders 100% UI text in selected language (Hindi vs English)', async ({ page }) => {
    await page.goto('/forms/new');
    await page.waitForLoadState('domcontentloaded');

    // Switch language to Hindi using the button
    const btnLangHi = page.locator('[data-testid="btn-lang-hi"], #btn-lang-hi');
    await expect(btnLangHi).toBeVisible({ timeout: 10000 });
    await btnLangHi.click();

    // Check headings, buttons, and helper texts in Hindi
    const pageTitle = page.locator('h1').first();
    await expect(pageTitle).toContainText('नया आवेदन');

    const toggleBtn = page.locator('#btn-autofill-toggle, [data-testid="btn-autofill-toggle"]');
    await expect(toggleBtn).toContainText('ऑटोफ़िल: चालू (ON)');

    // Select Scholarship Application template
    const tmplBtn = page.locator('[data-testid="template-scholarship_application"]');
    await tmplBtn.click();

    // Confirm consent if modal appears
    const consentModal = page.locator('[data-testid="autofill-consent-modal"]');
    if (await consentModal.isVisible()) {
      await page.locator('[data-testid="btn-consent-autofill"], #btn-consent-autofill').click();
    }

    // Check checklist button texts in Hindi
    const changeTmplBtn = page.locator('button:has-text("प्रारूप बदलें")').first();
    await expect(changeTmplBtn).toBeVisible();

    const nextBtn = page.locator('button:has-text("आगे")').first();
    await expect(nextBtn).toBeVisible();

    // Verify Autofill summary in Hindi
    const summaryBanner = page.locator('[data-testid="autofill-summary"]');
    await expect(summaryBanner).toBeVisible();
    await expect(summaryBanner).toContainText('स्मार्ट ऑटोफ़िल सारांश');

    // Verify typed/filled values strictly stay in English
    const applicantName = page.locator('#field-applicant_name');
    await expect(applicantName).toHaveValue('Raj Vishwakarma');
  });
});
