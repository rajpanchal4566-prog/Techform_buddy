import { test, expect } from '@playwright/test';

test.describe('App Shell Infinite Loop Guard & Render Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated NextAuth session
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
    { name: 'Dashboard', path: '/dashboard', expectedTitle: 'Dashboard' },
    { name: 'Forms', path: '/forms', expectedTitle: 'Forms' },
    { name: 'Forms New', path: '/forms/new', expectedTitle: 'New Form & Official Letter' },
    { name: 'Grievances', path: '/grievances', expectedTitle: 'Grievance Redressal & Tracker' },
    { name: 'Applications Tracker', path: '/applications', expectedTitle: 'My Applications Tracker' },
    { name: 'System Status', path: '/status', expectedTitle: 'System Status & Subsystem Health' },
    { name: 'Notifications (Alerts)', path: '/notifications', expectedTitle: 'Notifications' },
    { name: 'Form Watch', path: '/form-watch', expectedTitle: 'Form Watch' },
    { name: 'Document Vault', path: '/documents', expectedTitle: 'Document Understanding & Vault' },
    { name: 'Citizen Profile', path: '/profile', expectedTitle: 'Profile' },
    { name: 'Settings', path: '/settings', expectedTitle: 'Settings & Preferences' },
    { name: 'Demo Portal', path: '/demo-portal', expectedTitle: 'Interactive Practice Portal' },
    { name: 'Browser Portal Launcher', path: '/browser', expectedTitle: 'Official Portal Launcher' },
  ];

  for (const p of signedInPages) {
    test(`Page: ${p.name} (${p.path}) renders with zero loop errors and correct title`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      await page.setViewportSize({ width: 1366, height: 768 });
      const response = await page.goto(p.path);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('domcontentloaded');

      // Allow any async state updates / effects to settle
      await page.waitForTimeout(600);

      // 1. Assert NO "Maximum update depth exceeded" or loop errors in console
      const loopErrors = consoleErrors.filter((e) =>
        e.toLowerCase().includes('maximum update depth') ||
        e.toLowerCase().includes('too many re-renders')
      );
      expect(loopErrors).toEqual([]);

      // 2. Assert NO Next.js error overlay dialog
      const errorOverlay = page.locator('[data-nextjs-dialog-overlay], .nextjs-container-errors, [data-nextjs-dialog-header], #nextjs-error-overlay');
      await expect(errorOverlay).toHaveCount(0);

      // 3. Assert header title renders correctly
      const headerTitle = page.locator('#app-header-title');
      await expect(headerTitle).toBeVisible();
      const titleText = await headerTitle.textContent();
      expect(titleText?.trim()).toContain(p.expectedTitle);

      // 4. Assert shell render count stays low and controlled (threshold <= 8 with StrictMode double-rendering)
      const renderCount = await page.evaluate(() => (window as any).__SHELL_RENDER_COUNT__ || 0);
      expect(renderCount).toBeGreaterThanOrEqual(1);
      expect(renderCount).toBeLessThanOrEqual(8);

      // 5. Assert actions slot container is attached to DOM
      const actionsSlot = page.locator('#app-header-actions');
      await expect(actionsSlot).toBeAttached();
    });
  }

  test('Client-side navigation across multiple pages maintains low render count and zero errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1366, height: 768 });

    // Step 1: Start on /forms
    await page.goto('/forms');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const initialRenderCount = await page.evaluate(() => (window as any).__SHELL_RENDER_COUNT__ || 0);
    expect(initialRenderCount).toBeLessThanOrEqual(5);
    await expect(page.locator('#app-header-title')).toContainText('Forms');

    // Step 2: Client-side click to /grievances
    const grievancesLink = page.locator('aside.sidebar nav a[href="/grievances"]');
    await grievancesLink.click();
    await page.waitForURL('**/grievances');
    await page.waitForTimeout(500);

    await expect(page.locator('#app-header-title')).toContainText('Grievance Redressal & Tracker');

    // Step 3: Client-side click to /dashboard
    const dashboardLink = page.locator('aside.sidebar nav a[href="/dashboard"]');
    await dashboardLink.click();
    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(500);

    await expect(page.locator('#app-header-title')).toContainText('Dashboard');

    // Step 4: Client-side click to /status
    const statusLink = page.locator('aside.sidebar nav a[href="/status"]');
    await statusLink.click();
    await page.waitForURL('**/status');
    await page.waitForTimeout(500);

    await expect(page.locator('#app-header-title')).toContainText('System Status & Subsystem Health');

    // Step 5: Client-side click back to /forms
    const formsLink = page.locator('aside.sidebar nav a[href="/forms"]');
    await formsLink.click();
    await page.waitForURL('**/forms');
    await page.waitForTimeout(500);

    await expect(page.locator('#app-header-title')).toContainText('Forms');

    // Final checks across entire client-side navigation chain:
    // Zero loop errors
    const loopErrors = consoleErrors.filter((e) =>
      e.toLowerCase().includes('maximum update depth') ||
      e.toLowerCase().includes('too many re-renders')
    );
    expect(loopErrors).toEqual([]);

    // Zero Next.js error overlays
    const errorOverlay = page.locator('[data-nextjs-dialog-overlay], .nextjs-container-errors, [data-nextjs-dialog-header], #nextjs-error-overlay');
    await expect(errorOverlay).toHaveCount(0);

    // Total shell render count remains bounded (under 20 across 5 full client navigations in dev StrictMode)
    const finalRenderCount = await page.evaluate(() => (window as any).__SHELL_RENDER_COUNT__ || 0);
    expect(finalRenderCount).toBeLessThanOrEqual(20);
  });
});
