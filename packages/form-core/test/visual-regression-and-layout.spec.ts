import { test, expect } from '@playwright/test';

test.describe('Visual Regression & Layout Isolation (Desktop & Mobile)', () => {
  // Test user session mock for authenticated pages
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            name: 'Aarav Sharma',
            email: 'demo@techformbuddy.in',
            image: null,
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    });
  });

  const testPages = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'My Applications', path: '/applications' },
    { name: 'Grievances', path: '/grievances' },
    { name: 'System Status', path: '/status' },
    { name: 'Document Vault', path: '/documents' },
    { name: 'Form Watch', path: '/form-watch' },
    { name: 'Citizen Profile', path: '/profile' },
    { name: 'Settings', path: '/settings' },
  ];

  for (const p of testPages) {
    test(`Desktop 1366x768 layout: ${p.name} has no horizontal overflow & valid 260px sidebar`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('404')) {
          consoleErrors.push(msg.text());
        }
      });

      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(p.path);
      await page.waitForLoadState('domcontentloaded');

      // Assert no horizontal scrollbar overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // Assert sidebar computed width is 260px on desktop
      const sidebar = page.locator('aside.sidebar');
      if (await sidebar.count() > 0) {
        await expect(sidebar).toBeVisible();
        const sidebarBox = await sidebar.boundingBox();
        expect(sidebarBox).not.toBeNull();
        if (sidebarBox) {
          expect(Math.round(sidebarBox.width)).toBe(260);
        }
      }

      // Assert companion launcher is circular 56px and doesn't overlap text
      const launcher = page.locator('#tfb-launcher-badge');
      if (await launcher.count() > 0) {
        await expect(launcher).toBeVisible();
        const box = await launcher.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(Math.round(box.width)).toBe(56);
          expect(Math.round(box.height)).toBe(56);
        }
      }

      // Zero fatal unhandled script crashes
      const fatalErrors = consoleErrors.filter(
        (e) => !e.includes('Hydration') && !e.includes('401') && !e.includes('Unauthorized')
      );
      expect(fatalErrors).toEqual([]);
    });

    test(`Mobile 375x667 layout: ${p.name} has no horizontal overflow & full-width main content`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(p.path);
      await page.waitForLoadState('domcontentloaded');

      // Assert no horizontal scrollbar overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // Assert main content has 0 margin-left on mobile
      const mainContent = page.locator('main.main-content');
      if (await mainContent.count() > 0) {
        const marginLeft = await mainContent.evaluate((el) => window.getComputedStyle(el).marginLeft);
        expect(marginLeft).toBe('0px');
      }
    });
  }

  test('Demo Reset API safely backs up SQLite and re-seeds dataset', async ({ request }) => {
    const res = await request.post('/api/demo/reset');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.backupPath).toContain('techformbuddy.db.bak');
  });
});
