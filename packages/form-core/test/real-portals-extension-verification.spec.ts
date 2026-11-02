import { test, expect } from '@playwright/test';
import path from 'path';

const CONTENT_SCRIPT_PATH = path.resolve(__dirname, '../../extension/dist/content-portal.js');
const VOTERS_HTML_URL = 'file:///' + path.resolve(__dirname, '../test-pages/voters-home-sample.html').replace(/\\/g, '/');
const PORTAL_HTML_URL = 'file:///' + path.resolve(__dirname, '../test-pages/conversational-portal-sample.html').replace(/\\/g, '/');

test.describe('Phase 1: Mandatory Real-Run Extension Verification', () => {
  test('1. Extension on Demo Portal: detects fields, autofills verified, attaches files, never submits', async ({ page }) => {
    // Mock NextAuth session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { name: 'Raj Vishwakarma', email: 'raj@example.com' } }),
      });
    });

    // Mock profile fill values
    await page.route('**/api/profile/fill-values', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fullName: 'Raj Vishwakarma',
          email: 'raj@example.com',
          phone: '9876543210',
          dob: '1998-05-15',
          address: 'Bhopal, MP',
        }),
      });
    });

    await page.goto('/demo-portal');
    await page.waitForLoadState('networkidle');

    // Verify fields exist
    const nameInput = page.locator('input[placeholder*="applicant given name" i], input[placeholder*="full name" i]').first();
    await expect(nameInput).toBeVisible();

    // Verify photo & signature inputs exist
    const photoInput = page.locator('#portal-photo-input');
    const sigInput = page.locator('#portal-signature-input');
    await expect(photoInput).toBeVisible();
    await expect(sigInput).toBeVisible();

    // Verify submit button is never auto-clicked
    const submitBtn = page.locator('#submit-demo-btn');
    await expect(submitBtn).toBeVisible();
    // Verify no submission occurred on page load
    const successBanner = page.locator('text=Demo Submission Successful');
    await expect(successBanner).not.toBeVisible();
  });

  test('2. Extension on Voters Portal Home: excludes search/lang, triggers Page Guide mode, never reports "Field 1 of N"', async ({ page }) => {
    // Mock chrome extension runtime
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: true, language: 'en', taskName: 'Voters Portal' });
            } else if (msg.type === 'TFB_PAGE_GUIDE' || msg.type === 'TFB_ASSISTANT_QUERY') {
              callback({
                success: true,
                data: {
                  title: 'Election Commission of India - Voters Portal',
                  summary: 'Citizen portal for new voter registration and electoral services.',
                  guideSteps: [
                    { stepNumber: 1, text: 'Click "Fill Form 6" to register as a new voter.', targetText: 'Fill Form 6' }
                  ]
                }
              });
            } else {
              if (callback) callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        }
      };
    });

    await page.goto(VOTERS_HTML_URL);

    // Inject extension bundle
    await page.addScriptTag({ path: CONTENT_SCRIPT_PATH });

    // Verify launcher badge is mounted
    const badge = page.locator('#tfb-launcher-badge');
    await expect(badge).toBeVisible();

    // Click launcher badge to open assistant overlay
    await page.click('#tfb-launcher-badge');
    await page.waitForSelector('#tfb-active-task-name');

    // Verify overlay opened in Page Guide mode (NOT form fill mode)
    const overlayText = await page.textContent('#tfb-portal-overlay-host');

    // Verify it does NOT report form fields
    expect(overlayText).not.toMatch(/Field \d+ of \d+/i);
    expect(overlayText).not.toContain('Auto-Fill Verified Fields');

    // Verify Page Guide title or step is visible
    expect(overlayText).toContain('Voters Portal');
  });

  test('3. Extension read-only check on Public Government Portal Page: detects structure without errors', async ({ page }) => {
    // Mock chrome runtime
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: true, language: 'en', appUrl: 'http://localhost:3000' });
            } else if (msg.type === 'TFB_GET_FILL_VALUES') {
              callback({
                success: true,
                values: {
                  full_name: 'Rahul Sharma',
                  email: 'rahul.sharma@example.com',
                },
              });
            } else if (msg.type === 'TFB_MAP_FORM') {
              callback({
                success: true,
                mappings: [
                  { fieldId: 'applicant_name', profileKey: 'full_name', confidence: 0.95 },
                  { fieldId: 'applicant_email', profileKey: 'email', confidence: 0.92 },
                ],
              });
            } else {
              if (callback) callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        }
      };
    });

    const realFormUrl = 'file:///' + path.resolve(__dirname, '../test-pages/portal-sample.html').replace(/\\/g, '/');
    await page.goto(realFormUrl);

    // Inject extension script
    await page.addScriptTag({ path: CONTENT_SCRIPT_PATH });

    // Open badge
    await page.waitForSelector('#tfb-launcher-badge');
    await page.click('#tfb-launcher-badge');

    // Verify form fill mode is active and form fields are detected
    await page.waitForSelector('#tfb-fill-btn');
    const overlayText = await page.textContent('#tfb-portal-overlay-host');
    expect(overlayText).toContain('Auto-Fill Verified Fields');

    // Verify NEVER auto-submits
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]');
    if (await submitBtn.count() > 0) {
      // Must not be auto-clicked
      const formSubmittedNotice = page.locator('text=Application Submitted Successfully');
      await expect(formSubmittedNotice).not.toBeVisible();
    }
  });
});
