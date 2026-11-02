import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../test-results/shell-consistency');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Requirement 4: Shared App Shell & Design Token Consistency', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'demo-user-1',
            name: 'Aarav Sharma',
            email: 'demo@techformbuddy.in',
            image: null,
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    });
  });

  const signedInPages = [
    { name: 'Forms (Baseline)', path: '/forms', slug: 'forms' },
    { name: 'Dashboard', path: '/dashboard', slug: 'dashboard' },
    { name: 'Forms New', path: '/forms/new', slug: 'forms-new' },
    { name: 'Grievances', path: '/grievances', slug: 'grievances' },
    { name: 'Applications Tracker', path: '/applications', slug: 'applications' },
    { name: 'System Status', path: '/status', slug: 'status' },
    { name: 'Notifications (Alerts)', path: '/notifications', slug: 'notifications' },
    { name: 'Form Watch', path: '/form-watch', slug: 'form-watch' },
    { name: 'Document Vault', path: '/documents', slug: 'documents' },
    { name: 'Citizen Profile', path: '/profile', slug: 'profile' },
    { name: 'Settings', path: '/settings', slug: 'settings' },
    { name: 'Demo Portal', path: '/demo-portal', slug: 'demo-portal' },
    { name: 'Browser Portal Launcher', path: '/browser', slug: 'browser' },
  ];

  // Baseline metrics recorded from /forms
  let baselineMetrics = {
    fontFamily: '',
    headerHeight: 80,
    bodyBg: '',
    cardBorderColor: '',
  };

  test('Step 0: Measure Baseline Shell Metrics on /forms', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const response = await page.goto('/forms');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('domcontentloaded');

    const metrics = await page.evaluate(() => {
      const body = document.body;
      const header = document.querySelector('header.main-header');
      const card = document.querySelector('.card');
      const bodyStyle = window.getComputedStyle(body);
      const headerStyle = header ? window.getComputedStyle(header) : null;
      const cardStyle = card ? window.getComputedStyle(card) : null;

      return {
        fontFamily: bodyStyle.fontFamily,
        bodyBg: bodyStyle.backgroundColor,
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 80,
        headerBg: headerStyle ? headerStyle.backgroundColor : '',
        headerBorderBottom: headerStyle ? headerStyle.borderBottomColor : '',
        cardBorderColor: cardStyle ? cardStyle.borderColor : '',
      };
    });

    baselineMetrics = {
      fontFamily: metrics.fontFamily,
      headerHeight: metrics.headerHeight,
      bodyBg: metrics.bodyBg,
      cardBorderColor: metrics.cardBorderColor || 'rgb(228, 228, 231)',
    };

    expect(baselineMetrics.fontFamily).toBeTruthy();
    expect(baselineMetrics.headerHeight).toBeGreaterThanOrEqual(70);
    expect(baselineMetrics.headerHeight).toBeLessThanOrEqual(120);
  });

  for (const p of signedInPages) {
    test(`Desktop (1366x768): ${p.name} verifies shell, 260px sidebar, baseline tokens & no overlap`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('404')) {
          consoleErrors.push(msg.text());
        }
      });

      await page.setViewportSize({ width: 1366, height: 768 });
      const response = await page.goto(p.path);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('domcontentloaded');

      // 1. Assert no Next.js error overlays
      const overlayCount = await page.locator('[data-nextjs-dialog-overlay], .nextjs-container-errors, [data-nextjs-dialog-header], #nextjs-error-overlay').count();
      expect(overlayCount).toBe(0);

      // 2. Assert no fatal console errors
      const fatalErrors = consoleErrors.filter(
        (e) => !e.includes('Hydration') && !e.includes('401') && !e.includes('403') && !e.includes('ResizeObserver')
      );
      expect(fatalErrors).toEqual([]);

      // 3. Assert desktop sidebar is exactly 260px wide
      const sidebar = page.locator('aside.sidebar');
      await expect(sidebar).toBeVisible();
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox).not.toBeNull();
      if (sidebarBox) {
        expect(Math.round(sidebarBox.width)).toBe(260);
      }

      // 4. Assert main content starts at 260px (no overlap by sidebar)
      const mainContent = page.locator('main.main-content');
      await expect(mainContent).toBeVisible();
      const mainBox = await mainContent.boundingBox();
      expect(mainBox).not.toBeNull();
      if (mainBox) {
        expect(Math.round(mainBox.x)).toBeGreaterThanOrEqual(260);
      }

      // 5. Assert design tokens & shell metrics match baseline (/forms)
      const pageMetrics = await page.evaluate(() => {
        const body = document.body;
        const header = document.querySelector('header.main-header');
        const card = document.querySelector('.card');
        const bodyStyle = window.getComputedStyle(body);
        const headerStyle = header ? window.getComputedStyle(header) : null;
        const cardStyle = card ? window.getComputedStyle(card) : null;

        return {
          fontFamily: bodyStyle.fontFamily,
          bodyBg: bodyStyle.backgroundColor,
          headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
          headerBg: headerStyle ? headerStyle.backgroundColor : '',
          cardBorderColor: cardStyle ? cardStyle.borderColor : null,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });

      // Page background matches baseline
      if (baselineMetrics.bodyBg) {
        expect(pageMetrics.bodyBg).toBe(baselineMetrics.bodyBg);
      }

      // Header height is identical to /forms baseline (shared shell)
      expect(pageMetrics.headerHeight).toBe(baselineMetrics.headerHeight);

      // Card border color matches design token (#e4e4e7 / rgb(228, 228, 231)) if present
      if (pageMetrics.cardBorderColor && baselineMetrics.cardBorderColor) {
        expect(pageMetrics.cardBorderColor).toBe(baselineMetrics.cardBorderColor);
      }

      // 6. Assert no horizontal overflow
      expect(pageMetrics.scrollWidth).toBeLessThanOrEqual(pageMetrics.innerWidth);

      // 7. Save full-page desktop screenshot
      const shotPath = path.join(SCREENSHOT_DIR, `${p.slug}-1366x768.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      expect(fs.existsSync(shotPath)).toBe(true);
    });

    test(`Mobile (375x667): ${p.name} verifies closed drawer, hamburger button & responsive shell`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const response = await page.goto(p.path);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('domcontentloaded');

      // 1. Assert no Next.js error overlays
      const overlayCount = await page.locator('[data-nextjs-dialog-overlay], .nextjs-container-errors, [data-nextjs-dialog-header], #nextjs-error-overlay').count();
      expect(overlayCount).toBe(0);

      // 2. Assert hamburger button is present and visible
      const mobileMenuBtn = page.locator('.mobile-menu-btn');
      await expect(mobileMenuBtn).toBeVisible();

      // 3. Assert sidebar drawer is closed (offscreen) on mobile
      const isSidebarOffscreen = await page.evaluate(() => {
        const sidebar = document.querySelector('aside.sidebar');
        if (!sidebar) return true;
        const rect = sidebar.getBoundingClientRect();
        return rect.right <= 0 || rect.x < 0;
      });
      expect(isSidebarOffscreen).toBe(true);

      // 4. Assert main content takes full mobile width (margin-left: 0)
      const mainContent = page.locator('main.main-content');
      await expect(mainContent).toBeVisible();
      const marginLeft = await mainContent.evaluate((el) => window.getComputedStyle(el).marginLeft);
      expect(marginLeft).toBe('0px');

      // 5. Assert no horizontal scrollbar overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // 6. Save full-page mobile screenshot
      const shotPath = path.join(SCREENSHOT_DIR, `${p.slug}-375x667.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      expect(fs.existsSync(shotPath)).toBe(true);
    });
  }
});
