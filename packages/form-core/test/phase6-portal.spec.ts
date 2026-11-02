import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const PORTAL_PAGE_URL = 'file:///' + path.resolve(__dirname, '../test-pages/portal-sample.html').replace(/\\/g, '/');
const IFRAME_PAGE_URL = 'file:///' + path.resolve(__dirname, '../test-pages/portal-iframe-test.html').replace(/\\/g, '/');
const SCRIPT_PATH = path.resolve(__dirname, '../../extension/dist/content-portal.js');

test.describe('Phase 6: Portal Content Script, Language Handoff & Auto-Fill Parity', () => {

  // 1. Diagnosis & Injection Verification: Console log [TechFormBuddy] content script loaded
  test('Requirement 1: Content script injects on portal page and outputs visible log', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    // Inject mock chrome runtime before scripts run
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (_msg: any, callback: any) => {
            if (callback) callback({ connected: true, language: 'en' });
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // Verify mandatory console log
    const hasLog = consoleLogs.some((log) => log.includes('[TechFormBuddy] content script loaded'));
    expect(hasLog).toBe(true);

    // Verify launcher badge is mounted for detected fields
    await page.waitForSelector('#tfb-launcher-badge');
    const badgeText = await page.textContent('#tfb-launcher-badge');
    expect(badgeText).toContain('TechForm Buddy');
  });

  // 2. Iframe Injection Verification (all_frames: true)
  test('Requirement 1 & 6: Content script injects inside iframes with all_frames: true', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (_msg: any, callback: any) => {
            if (callback) callback({ connected: true, language: 'en' });
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    await page.goto(IFRAME_PAGE_URL);

    // Wait for the iframe to load
    const frameElement = await page.waitForSelector('#portal-frame');
    const frame = await frameElement.contentFrame();
    expect(frame).not.toBeNull();

    // Inject script into iframe frame
    await frame!.addScriptTag({ path: SCRIPT_PATH });

    // Verify console log indicates iframe injection
    const hasLog = consoleLogs.some(
      (log) => log.includes('[TechFormBuddy]') && (log.includes('content script loaded') || log.includes('(iframe)'))
    );
    expect(hasLog).toBe(true);
  });

  // 3. Language Handoff: Saved language is automatically used without prompting
  test('Requirement 2: Language from app is automatically used in overlay without asking', async ({ page }) => {
    // Mock background worker returning Hindi ('hi')
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: true, language: 'hi', appUrl: 'http://localhost:3000' });
            } else if (msg.type === 'TFB_GET_FILL_VALUES') {
              callback({ success: true, fillValues: { full_name: 'अमित कुमार' } });
            } else if (msg.type === 'TFB_MAP_FORM') {
              callback({
                success: true,
                mappings: [{ fieldId: 'applicant_name', profileKey: 'full_name', confidence: 0.95 }],
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

    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // Click floating badge to open overlay
    await page.waitForSelector('#tfb-launcher-badge');
    await page.click('#tfb-launcher-badge');

    // Verify overlay opened directly in Hindi without any language prompt
    await page.waitForSelector('#tfb-overlay-lang-select');
    const overlayHtml = await page.innerHTML('#tfb-portal-overlay-host');

    // Title should be Hindi "टेकफॉर्म बडी सहायक"
    expect(overlayHtml).toContain('टेकफॉर्म बडी सहायक');
    // Button should be Hindi "सत्यापित फ़ील्ड स्वतः भरें"
    expect(overlayHtml).toContain('सत्यापित फ़ील्ड स्वतः भरें');

    // Verify language switcher has 'hi' selected
    const selectedLang = await page.$eval('#tfb-overlay-lang-select', (el: any) => el.value);
    expect(selectedLang).toBe('hi');
  });

  // 4. Feature Parity & Fill with Mapped Values
  test('Requirement 3: Autofill fills mapped values and dispatches synthetic input events', async ({ page }) => {
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
                  full_name: 'Pooja Verma',
                  email: 'pooja.verma@example.com',
                  phone: '9876543210',
                  dob: '1995-08-20',
                },
              });
            } else if (msg.type === 'TFB_MAP_FORM') {
              callback({
                success: true,
                mappings: [
                  { fieldId: 'applicant_name', profileKey: 'full_name', confidence: 0.92 },
                  { fieldId: 'applicant_email', profileKey: 'email', confidence: 0.94 },
                  { fieldId: 'applicant_phone', profileKey: 'phone', confidence: 0.89 },
                  { fieldId: 'applicant_dob', profileKey: 'dob', confidence: 0.86 },
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

    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // Open overlay
    await page.waitForSelector('#tfb-launcher-badge');
    await page.click('#tfb-launcher-badge');
    await page.waitForSelector('#tfb-fill-btn');

    // Click Auto-Fill Verified Fields
    await page.click('#tfb-fill-btn');

    // Assert inputs on page are filled
    const nameVal = await page.inputValue('#applicant_name');
    const emailVal = await page.inputValue('#applicant_email');
    const phoneVal = await page.inputValue('#applicant_phone');
    const dobVal = await page.inputValue('#applicant_dob');

    expect(nameVal).toBe('Pooja Verma');
    expect(emailVal).toBe('pooja.verma@example.com');
    expect(phoneVal).toBe('9876543210');
    expect(dobVal).toBe('1995-08-20');
  });

  // 5. Auth Requirement: If not paired, displays "Open TechForm Buddy and sign in"
  test('Requirement 4: When unauthenticated, displays "Open TechForm Buddy and sign in" banner', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: false, language: 'en', appUrl: 'http://localhost:3000' });
            } else {
              callback({ error: 'NO_AUTH', message: 'Open TechForm Buddy and sign in' });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    await page.waitForSelector('#tfb-launcher-badge');
    await page.click('#tfb-launcher-badge');

    // Verify clear sign-in warning
    await page.waitForSelector('#tfb-open-app-btn');
    const overlayText = await page.textContent('#tfb-portal-overlay-host');
    expect(overlayText).toContain('Open TechForm Buddy and sign in');
  });

  // 6. Safety Requirement 5: Strict sensitive field exclusion, low-confidence prompt, and zero submit
  test('Requirement 5: Sensitive fields (password/OTP) are NEVER filled, low-confidence requires confirm, and form NEVER auto-submits', async ({ page }) => {
    let submitTriggered = false;

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
                  full_name: 'Pooja Verma',
                  ward: 'Ward 12 South',
                  password: 'SecretPassword123',
                  otp: '123456',
                },
              });
            } else if (msg.type === 'TFB_MAP_FORM') {
              callback({
                success: true,
                mappings: [
                  { fieldId: 'applicant_name', profileKey: 'full_name', confidence: 0.95 },
                  // Low confidence mapping (0.60 < 0.75)
                  { fieldId: 'custom_ward_zone', profileKey: 'ward', confidence: 0.60 },
                ],
              });
            } else {
              callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });

    await page.goto(PORTAL_PAGE_URL);

    // Track if form submit ever triggers
    await page.evaluate(() => {
      document.querySelector('form')?.addEventListener('submit', (e) => {
        (window as any).__submitFired = true;
        e.preventDefault();
      });
    });

    await page.addScriptTag({ path: SCRIPT_PATH });

    await page.waitForSelector('#tfb-launcher-badge');
    await page.click('#tfb-launcher-badge');

    // 1. Verify sensitive fields (password, otp) are NOT in the overlay detected list
    const overlayHtml = await page.innerHTML('#tfb-portal-overlay-host');
    expect(overlayHtml).not.toContain('Portal Password');
    expect(overlayHtml).not.toContain('portal_password');
    expect(overlayHtml).not.toContain('One Time Password');
    expect(overlayHtml).not.toContain('portal_otp');

    // 2. Click Auto-Fill without confirming low-confidence field
    await page.click('#tfb-fill-btn');

    // High confidence field is filled
    expect(await page.inputValue('#applicant_name')).toBe('Pooja Verma');

    // Low confidence field MUST NOT be filled yet!
    expect(await page.inputValue('#custom_ward_zone')).toBe('');

    // Sensitive fields MUST remain completely empty!
    expect(await page.inputValue('#portal_password')).toBe('');
    expect(await page.inputValue('#portal_otp')).toBe('');

    // 3. User clicks "Confirm Fill" on the low-confidence field
    await page.waitForSelector('.tfb-conf-btn');
    await page.click('.tfb-conf-btn');

    // Now click Auto-Fill again
    await page.click('#tfb-fill-btn');
    expect(await page.inputValue('#custom_ward_zone')).toBe('Ward 12 South');

    // 4. Zero Auto-Submit: verify form submit was NEVER triggered
    const wasSubmitted = await page.evaluate(() => (window as any).__submitFired === true);
    expect(wasSubmitted).toBe(false);
  });
});
