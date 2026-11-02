import { test, expect } from '@playwright/test';

test.describe('Form Watch: Source Registry Search, Selection Cards, Discovery & Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth session so Form Watch page renders without redirecting to /login
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user-id', name: 'Dev Tester', email: 'tester@techformbuddy.local' },
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    });

    // Mock initial empty watches & sources if needed or let pass through
    await page.route('**/api/form-watches', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/form-watch');
    await page.waitForSelector('#fw-search-input', { timeout: 10000 });
  });

  // Requirement 7.1: Typing "mppsc" returns the MPPSC source card with official URL, verified badge & checkboxes
  test('Typing "mppsc" returns the MPPSC source card, official govt URL, watch checkboxes, and live notices discovery', async ({ page }) => {
    const input = page.locator('#fw-search-input');
    await input.fill('mppsc');

    const searchBtn = page.locator('#fw-search-btn');
    await searchBtn.click();

    // Verify source card container appears
    await page.waitForSelector('#fw-matched-sources-list', { timeout: 8000 });

    const card = page.locator('#fw-matched-sources-list .fw-source-selection-card').first();
    await expect(card).toBeVisible();

    // Verify Organization name contains MPPSC
    const title = await card.locator('.fw-card-title').textContent();
    expect(title).toContain('Madhya Pradesh Public Service Commission');
    expect(title).toContain('MPPSC');

    // Verify official URL points to MPPSC gov portal
    const urlLink = card.locator('.fw-card-url');
    await expect(urlLink).toHaveAttribute('href', 'https://mppsc.mp.gov.in/notificationAndAdvertisement');

    // Verify Verified badge
    const badge = card.locator('.fw-badge-verified');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Verified Govt Portal');

    // Verify watch checkboxes are present (Recruitment, Notification, Admit Card, Result, Syllabus)
    const checkboxes = card.locator('.fw-checkbox-label');
    const checkboxTexts = await checkboxes.allTextContents();
    const joined = checkboxTexts.join(' ');
    expect(joined).toContain('Recruitment / Vacancy');
    expect(joined).toContain('Notification / Advt');
    expect(joined).toContain('Admit Card');
    expect(joined).toContain('Result');
    expect(joined).toContain('Syllabus / Exam Calendar');

    // Test Requirement 5: Discovery flow after picking a source
    const selectBtn = card.locator('.fw-select-source-btn');
    await selectBtn.click();

    // Verify Discovery panel appears with discovered notices
    await page.waitForSelector('#fw-discovery-section', { timeout: 10000 });
    await page.waitForSelector('#fw-discovered-notices-list .fw-notice-item', { timeout: 15000 });
    const noticeItems = page.locator('#fw-discovered-notices-list .fw-notice-item');
    const noticeCount = await noticeItems.count();
    expect(noticeCount).toBeGreaterThan(0);

    // Verify that exam names like "State Service Examination 2026" or similar are present
    const noticeTexts = await noticeItems.allTextContents();
    const noticesString = noticeTexts.join(' ');
    expect(
      noticesString.includes('State Service') ||
      noticesString.includes('Examination') ||
      noticesString.includes('Recruitment')
    ).toBe(true);

    // Verify save button is available
    const saveBtn = page.locator('#fw-save-watch-btn');
    await expect(saveBtn).toBeVisible();
  });

  // Requirement 7.2: Typing "scholarship" returns narrowing options first, then matching sources
  test('Typing "scholarship" returns narrowing category options first, followed by matching sources', async ({ page }) => {
    const input = page.locator('#fw-search-input');
    await input.fill('scholarship');

    const searchBtn = page.locator('#fw-search-btn');
    await searchBtn.click();

    // Verify broad categories section appears
    await page.waitForSelector('#fw-broad-categories', { timeout: 8000 });
    const broadPanel = page.locator('#fw-broad-categories');
    await expect(broadPanel).toBeVisible();

    // Verify broad categories: State, Education Level, Govt/Private
    const catLabels = await broadPanel.locator('.fw-filter-label').allTextContents();
    const joinedLabels = catLabels.join(' ');
    expect(joinedLabels).toContain('State / Region');
    expect(joinedLabels).toContain('Education Level');
    expect(joinedLabels).toContain('Govt / Private');

    // Verify that matching source cards (like NSP) also render below the categories
    await page.waitForSelector('#fw-matched-sources-list', { timeout: 8000 });
    const matchedList = page.locator('#fw-matched-sources-list');
    await expect(matchedList).toBeVisible();
    const matchedText = await matchedList.textContent();
    expect(matchedText).toContain('National Scholarship Portal');
  });

  // Requirement 7.3: Unknown text returns the unverified flow with suggestion and custom URL option
  test('Unknown query returns unverified flow with suggestions and custom URL with warning', async ({ page }) => {
    const input = page.locator('#fw-search-input');
    await input.fill('unknownportalxyz999');

    const searchBtn = page.locator('#fw-search-btn');
    await searchBtn.click();

    // Verify no-match banner appears
    await page.waitForSelector('#fw-no-match-banner', { timeout: 8000 });
    const banner = page.locator('#fw-no-match-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('No Verified Registry Match');

    // Verify suggested official sites are marked Unverified
    const unverifiedBadge = page.locator('.fw-badge-unverified').first();
    await expect(unverifiedBadge).toBeVisible();
    await expect(unverifiedBadge).toContainText('Unverified');

    // Verify custom URL toggle button
    const toggleBtn = page.locator('#fw-toggle-custom-btn');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Verify custom URL box appears with clear warning and confirmation checkbox
    await page.waitForSelector('#fw-custom-url-box', { timeout: 5000 });
    const warningBox = page.locator('#fw-custom-url-box');
    await expect(warningBox).toContainText('Security Warning: Custom / Unverified URL');
    await expect(warningBox).toContainText('Never enter URLs of login pages, banking sites, or credential portals');

    const confirmCb = page.locator('#fw-confirm-custom-cb');
    await expect(confirmCb).toBeVisible();

    const useCustomBtn = page.locator('#fw-use-custom-btn');
    // Button is disabled until URL and confirmation checkbox are checked
    await expect(useCustomBtn).toBeDisabled();
  });

  // Requirement 7.4: Failing lookup displays an error message in the UI instead of silently showing nothing
  test('Failing search lookup displays error banner in UI instead of silently failing', async ({ page }) => {
    // Intercept search API to simulate server error
    await page.route('**/api/form-watches/search*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Registry database temporarily unavailable. Please retry shortly.' }),
      });
    });

    const input = page.locator('#fw-search-input');
    await input.fill('mppsc');

    const searchBtn = page.locator('#fw-search-btn');
    await searchBtn.click();

    // Verify error banner appears with message
    await page.waitForSelector('#fw-lookup-error', { timeout: 8000 });
    const errorBanner = page.locator('#fw-lookup-error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Lookup Failed');
    await expect(errorBanner).toContainText('Registry database temporarily unavailable');
  });
});

