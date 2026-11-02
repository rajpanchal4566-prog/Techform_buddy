import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { GameTestHook } from '../../../src/game/test-hook';

declare global {
  interface Window {
    __tfbGame?: GameTestHook;
  }
}

const screenshotDirectory = path.resolve(process.cwd(), 'artifacts/arena-screenshots');
const viewports = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 375, height: 667 },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('tfb_buddy_defender_sound', 'false'); } catch { }
  });
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'arena-test', name: 'Test Player', email: 'arena@example.invalid', image: null },
        expires: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
  });
});

test('captures the requested game states at desktop, wide and mobile sizes', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(screenshotDirectory, { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/arena');
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDirectory, `${viewport.width}x${viewport.height}-start.png`) });

    await page.getByRole('button', { name: 'Start Game' }).click();
    await page.evaluate(() => {
      window.__tfbGame?.spawnEnemy('cube', 680, 250);
      window.__tfbGame?.spawnEnemy('triangle', 300, 240);
      window.__tfbGame?.spawnEnemy('circle', 680, 430);
      window.__tfbGame?.spawnEnemy('hexagon', 730, 390);
    });
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getActiveBulletCount() ?? 0)).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(screenshotDirectory, `${viewport.width}x${viewport.height}-mid-wave.png`) });

    await page.reload();
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getState().phase), { timeout: 90_000 }).toBe('wave-complete');
    await page.screenshot({ path: path.join(screenshotDirectory, `${viewport.width}x${viewport.height}-wave-complete.png`) });

    await page.reload();
    await page.getByRole('button', { name: 'Start Game' }).click();
    await page.evaluate(() => {
      for (let i = 0; i < 6; i++) window.__tfbGame?.spawnEnemy('shadow', 480, 270);
    });
    await expect(page.getByText('GAME OVER')).toBeVisible({ timeout: 12_000 });
    await page.screenshot({ path: path.join(screenshotDirectory, `${viewport.width}x${viewport.height}-game-over.png`) });
  }

  console.log(`RAW SCREENSHOT DIRECTORY: ${screenshotDirectory}`);
});

test('measures frame rate with 60 active enemies', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/arena');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.evaluate(() => {
    window.__tfbGame?.resetPerformance();
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      window.__tfbGame?.spawnEnemy('cube', 480 + Math.cos(angle) * 250, 270 + Math.sin(angle) * 200);
    }
  });
  await page.waitForTimeout(5_000);
  const performance = await page.evaluate(() => window.__tfbGame?.getPerformance());
  expect(performance?.averageFps).toBeGreaterThan(0);
  console.log(`RAW ARENA FPS (60 enemies): ${performance?.averageFps.toFixed(2)}; effects reduced: ${performance?.effectsReduced}`);
});
