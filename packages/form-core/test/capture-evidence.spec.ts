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
});
