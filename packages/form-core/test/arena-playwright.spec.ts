import { expect, test } from '@playwright/test';
import type { GameTestHook } from '../../../src/game/test-hook';

declare global {
  interface Window {
    __tfbGame?: GameTestHook;
  }
}

test.describe('Buddy Defender browser flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('tfb_buddy_defender_sound', 'true'); } catch { }
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

  test('starts combat, shows distinct enemy shapes, damage/healing, controls, game over and restart', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/arena');
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getState().phase)).toBe('running');

    await page.evaluate(() => {
      window.__tfbGame?.spawnEnemy('cube', 620, 250);
      window.__tfbGame?.spawnEnemy('triangle', 340, 250);
      window.__tfbGame?.spawnEnemy('circle', 480, 430);
    });
    await expect.poll(() => page.evaluate(() => {
      const state = window.__tfbGame?.getState();
      return state ? Object.values(state.enemyTypeCounts).filter((count) => count > 0).length : 0;
    })).toBeGreaterThanOrEqual(3);
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getState().enemiesDefeated ?? 0), { timeout: 12_000 }).toBeGreaterThan(0);

    await page.evaluate(() => window.__tfbGame?.spawnEnemy('hexagon', 480, 270));
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getState().hp ?? 100)).toBeLessThan(100);
    const damagedHp = await page.evaluate(() => window.__tfbGame?.getState().hp ?? 100);
    await page.evaluate(() => window.__tfbGame?.spawnHeal(480, 270));
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getState().hp ?? 0)).toBeGreaterThan(damagedHp);
    await expect(page.getByText('Healing pickup: none')).toBeVisible();

    const soundButton = page.getByRole('button', { name: /Sound/ });
    await soundButton.click();
    await expect(soundButton).toHaveAttribute('aria-pressed', 'false');
    await soundButton.click();
    await expect(soundButton).toHaveAttribute('aria-pressed', 'true');
    const voiceButton = page.getByRole('button', { name: /Voice/ });
    await voiceButton.click();
    await expect(voiceButton).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getState().phase)).toBe('paused');
    const pausedAt = await page.evaluate(() => window.__tfbGame?.getState().gameTime ?? 0);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__tfbGame?.getState().gameTime ?? 0)).toBe(pausedAt);
    await page.getByRole('button', { name: 'Resume Game' }).click();
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getState().gameTime ?? 0)).toBeGreaterThan(pausedAt);

    await page.evaluate(() => {
      for (let i = 0; i < 6; i++) window.__tfbGame?.spawnEnemy('shadow', 480, 270);
    });
    await expect(page.getByText('GAME OVER')).toBeVisible({ timeout: 12_000 });
    await page.getByRole('button', { name: 'Restart' }).click();
    await expect.poll(() => page.evaluate(() => window.__tfbGame?.getState().phase)).toBe('start');
    const restarted = await page.evaluate(() => window.__tfbGame?.getState());
    expect(restarted?.score).toBe(0);
    expect(restarted?.wave).toBe(1);
    expect(restarted?.hp).toBe(100);
    expect(errors.filter((error) => /hydration|maximum update depth|too many re-renders/i.test(error))).toEqual([]);
  });

  test('mobile layout fits the viewport and Buddy returns after leaving the arena', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/arena');
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: /Pulse/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Upgrade/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await expect(page.locator('#tfb-launcher-badge')).toBeHidden();
    await page.goto('/dashboard');
    await expect(page.locator('#tfb-launcher-badge')).toBeVisible();
  });
});
