import { test } from '@playwright/test';
import path from 'path';

test('Capture Evidence Screenshots', async ({ page }) => {
  const popupHtmlPath = 'file:///' + path.resolve(__dirname, '../../extension/dist/popup.html').replace(/\\/g, '/');

  // 1. Popup Autofill View
  await page.setViewportSize({ width: 400, height: 600 });
  await page.goto(popupHtmlPath);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/popup-autofill.png' });

  // 2. Popup Profile View
  await page.click('#tab-nav-profile');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/popup-profile.png' });

  // 3. Popup Vault View
  await page.click('#tab-nav-vault');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/popup-vault.png' });

  // 4. Web App Landing Page
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/landing-current.png' });

  // 5. Web App Login Page
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/login-current.png' });

  // 6. Web App Dashboard Page
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/dashboard-current.png' });

  // Mock session for Form Watch
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'ce93fcbf-0795-4774-9d9e-e24bbb5e9483', name: 'Raj Panchal', email: 'rajpanchal4566@gmail.com' },
        expires: '2099-01-01T00:00:00.000Z',
      }),
    });
  });

  // 7. Form Watch Active Watches View
  await page.goto('http://localhost:3000/form-watch');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/form-watch-active.png' });

  // 8. Form Watch Events Hub View
  await page.locator('#fw-view-events').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/form-watch-events.png' });

  // 9. Form Watch Saved Events View
  await page.locator('#fw-view-saved').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/evidence/form-watch-saved.png' });
});
