import { test, expect } from '@playwright/test';

test.describe('Form Watch Rework: Scoped Monitoring, Deduplication, Topics, Relevance, Status & On-Visit Alerts', () => {
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth session
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

    // Mock profile endpoint for city opt-in
    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: { city: 'Bengaluru', state: 'Karnataka' },
        }),
      });
    });
  });

  // ── TEST 1: Watch "upsc" monitors ONLY UPSC (Requirement 1 & 7.1) ──
  test('Watch "upsc" monitors ONLY UPSC and pre-selects only the best match', async ({ page }) => {
    let savedSourceIds: string[] = [];

    // Intercept GET to return initial state
    await page.route('**/api/form-watches', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        savedSourceIds = body.sourceIds || (body.sourceId ? [body.sourceId] : []);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            id: 'watch-upsc-1',
            stored: { explanation: 'Watch saved for UPSC only.' },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/form-watch');
    await page.waitForSelector('#fw-search-input', { timeout: 10000 });

    const input = page.locator('#fw-search-input');
    await input.fill('upsc');

    const searchBtn = page.locator('#fw-search-btn');
    await searchBtn.click();

    // Verify source cards appear
    await page.waitForSelector('#fw-matched-sources-list', { timeout: 8000 });

    // Requirement 1: Pre-select ONLY the best name match (e.g. "upsc" -> UPSC)
    const bestMatchCard = page.locator('#fw-matched-sources-list .fw-source-selection-card').first();
    await expect(bestMatchCard).toBeVisible();
    await expect(bestMatchCard.locator('.fw-card-title')).toContainText('UPSC');

    const bestCb = bestMatchCard.locator('input[type="checkbox"]').first();
    await expect(bestCb).toBeChecked();

    // Check that additional matches are grouped under "Add more sources"
    const addMoreSection = page.locator('#fw-add-more-sources-section');
    if (await addMoreSection.count() > 0) {
      await expect(addMoreSection).toBeVisible();
      const toggleAddMoreBtn = page.locator('#fw-toggle-add-more-btn');
      await expect(toggleAddMoreBtn).toBeVisible();
      await toggleAddMoreBtn.click();

      // Checkboxes inside other matches must NOT be checked by default
      const otherCb = addMoreSection.locator('input[type="checkbox"]').first();
      if (await otherCb.count() > 0) {
        await expect(otherCb).not.toBeChecked();
      }
    }

    // Save watch and verify only UPSC source ID was submitted
    const saveBtn = page.locator('#fw-save-watch-btn');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    await page.waitForTimeout(500);
    expect(savedSourceIds.length).toBe(1);
    expect(savedSourceIds).not.toContain('src-mppsc');
    expect(savedSourceIds).not.toContain('src-ssc');
  });

  // ── TEST 2: Duplicate watch creation is blocked & offers update (Requirement 2 & 7.2) ──
  test('Duplicate watch creation is blocked with 409 and can be updated', async ({ page }) => {
    let updateExistingCalled = false;

    await page.route('**/api/form-watches', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'watch-upsc-existing',
              search_query: 'upsc',
              source_id: 'src-upsc',
              source_ids: ['src-upsc'],
              source_name: 'Union Public Service Commission (UPSC)',
              source_url: 'https://upsc.gov.in',
              is_verified: true,
              last_status: 'ok',
              sources_being_checked: ['Union Public Service Commission (UPSC)'],
              sources_detail: [{
                id: 'src-upsc',
                name: 'Union Public Service Commission (UPSC)',
                url: 'https://upsc.gov.in',
                status: 'ok',
                error_reason: null,
                last_success_at: new Date().toISOString(),
                last_checked_at: new Date().toISOString(),
              }],
              unread_alerts_count: 0,
              created_at: new Date().toISOString(),
              alerts: [],
            },
          ]),
        });
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.updateExisting) {
          updateExistingCalled = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              id: 'watch-upsc-existing',
              stored: { explanation: 'Existing watch updated successfully.' },
            }),
          });
        } else {
          // Reject duplicate
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'DUPLICATE_WATCH',
              message: 'A watch for this query or source already exists.',
              existingWatch: { id: 'watch-upsc-existing' },
            }),
          });
        }
      } else {
        await route.continue();
      }
    });

    await page.goto('/form-watch');
    await page.waitForSelector('#fw-search-input', { timeout: 10000 });

    const input = page.locator('#fw-search-input');
    await input.fill('upsc');
    await page.locator('#fw-search-btn').click();

    await page.waitForSelector('#fw-matched-sources-list', { timeout: 8000 });

    // Attempt to save duplicate watch
    const saveBtn = page.locator('#fw-save-watch-btn');
    await saveBtn.click();

    // Verify duplicate warning banner appears
    await page.waitForSelector('#fw-duplicate-banner', { timeout: 5000 });
    const duplicateBanner = page.locator('#fw-duplicate-banner');
    await expect(duplicateBanner).toBeVisible();
    await expect(duplicateBanner).toContainText('A watch for this query or source already exists');

    // Click Update Existing Watch button
    const updateBtn = page.locator('#fw-update-existing-btn');
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();

    await page.waitForTimeout(500);
    expect(updateExistingCalled).toBe(true);
  });

  // ── TEST 3: Simulated new hackathon item creates one alert with "why matched" reason (Requirement 3, 4, 7.3) ──
  test('Simulated new hackathon item creates alert with "why matched" reason and topics filters work', async ({ page }) => {
    // Test topics categories tabs and hackathons panel
    await page.route('**/api/form-watches', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'watch-hackathon-1',
              search_query: 'hackathon',
              category: 'hackathon',
              source_id: 'src-sih',
              source_ids: ['src-sih'],
              source_name: 'Smart India Hackathon',
              source_url: 'https://sih.gov.in',
              is_verified: true,
              last_status: 'ok',
              sources_being_checked: ['Smart India Hackathon'],
              sources_detail: [{
                id: 'src-sih',
                name: 'Smart India Hackathon',
                url: 'https://sih.gov.in',
                status: 'ok',
                error_reason: null,
                last_success_at: new Date().toISOString(),
                last_checked_at: new Date().toISOString(),
              }],
              unread_alerts_count: 1,
              created_at: new Date().toISOString(),
              alerts: [
                {
                  id: 'alert-sih-1',
                  notice_title: 'Smart India Hackathon 2026 Grand Finale - Hardware & Software Edition Registration Open',
                  notice_link: 'https://sih.gov.in/sih2026',
                  classification: 'registration_open',
                  deadline_date: '2026-11-20',
                  source_name: 'Smart India Hackathon',
                  created_at: new Date().toISOString(),
                  is_read: 0,
                  why_matched: 'Matches topic keywords "hackathon" and classified as registration_open with student eligibility.',
                },
              ],
            },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/form-watch');
    await page.waitForSelector('.fw-topics-tabs', { timeout: 10000 });

    // Click Hackathons & Events tab
    const hackathonTab = page.locator('#fw-tab-hackathon');
    await expect(hackathonTab).toBeVisible();
    await hackathonTab.click();

    // Verify Hackathon filters panel renders (mode, city, opt-in profile city, student-eligible, deadline)
    await page.waitForSelector('#fw-hackathon-filters-panel', { timeout: 5000 });
    const filtersPanel = page.locator('#fw-hackathon-filters-panel');
    await expect(filtersPanel).toBeVisible();

    const modeSelect = page.locator('#fw-hackathon-mode-select');
    await expect(modeSelect).toBeVisible();
    await modeSelect.selectOption('online');

    const cityInput = page.locator('#fw-hackathon-city-input');
    await expect(cityInput).toBeVisible();

    // Test Opt-in Profile City fetch
    const useProfileBtn = page.locator('#fw-use-profile-city-btn');
    await expect(useProfileBtn).toBeVisible();
    await useProfileBtn.click();
    await expect(cityInput).toHaveValue('Bengaluru');

    const studentCb = page.locator('#fw-student-eligible-cb');
    await expect(studentCb).toBeVisible();
    await studentCb.check();

    const deadlineSelect = page.locator('#fw-hackathon-deadline-select');
    await expect(deadlineSelect).toBeVisible();
    await deadlineSelect.selectOption('30');

    // Verify Active Watch shows the alert with "Why matched" reason
    const alertCard = page.locator('.fw-alert-item').first();
    await expect(alertCard).toBeVisible();
    await expect(alertCard.locator('.fw-alert-title')).toContainText('Smart India Hackathon 2026 Grand Finale');

    const whyMatched = alertCard.locator('.fw-alert-why-matched');
    await expect(whyMatched).toBeVisible();
    await expect(whyMatched).toContainText('Why matched:');
    await expect(whyMatched).toContainText('Matches topic keywords "hackathon"');
    await expect(whyMatched).toContainText('registration_open');
  });

  // ── TEST 4: Failing source displays its exact reason & retry button (Requirement 5 & 7.4) ──
  test('Failing source displays per-source status (blocked/timeout/error), reason and retry button', async ({ page }) => {
    let retriedSourceId = '';

    await page.route('**/api/form-watches', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'watch-failing-1',
              search_query: 'state exams',
              source_id: 'src-mppsc',
              source_ids: ['src-mppsc'],
              source_name: 'MPPSC',
              source_url: 'https://mppsc.mp.gov.in',
              is_verified: true,
              last_status: 'source_error',
              sources_being_checked: ['Madhya Pradesh Public Service Commission (MPPSC)'],
              sources_detail: [
                {
                  id: 'src-mppsc',
                  name: 'Madhya Pradesh Public Service Commission (MPPSC)',
                  url: 'https://mppsc.mp.gov.in',
                  status: 'blocked',
                  error_reason: 'HTTP 403 Forbidden',
                  last_success_at: '2026-10-30T10:00:00Z',
                  last_checked_at: new Date().toISOString(),
                },
              ],
              unread_alerts_count: 0,
              created_at: new Date().toISOString(),
              alerts: [],
            },
            {
              id: 'watch-all-failed-1',
              search_query: 'unreachable portal',
              source_id: 'src-unreachable',
              source_ids: ['src-unreachable'],
              source_name: 'Unreachable Portal',
              is_verified: true,
              last_status: 'all_failed',
              sources_being_checked: ['Unreachable Portal'],
              sources_detail: [
                {
                  id: 'src-unreachable',
                  name: 'Unreachable Portal',
                  url: 'https://offline-test.gov.in',
                  status: 'timeout',
                  error_reason: 'Connection timed out after 15000ms',
                  last_success_at: null,
                  last_checked_at: new Date().toISOString(),
                },
              ],
              unread_alerts_count: 0,
              created_at: new Date().toISOString(),
              alerts: [],
            },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/watcher/run', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        retriedSourceId = body.sourceId || '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sourcesChecked: 1,
            sourcesSucceeded: 1,
            sourcesFailed: [],
            newNotices: 0,
            alertsCreated: 0,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/form-watch');
    await page.waitForSelector('.fw-watches-list', { timeout: 10000 });

    // Verify per-source status pill for blocked source
    const blockedPill = page.locator('.fw-source-status-pill.fw-status-pill-blocked').first();
    await expect(blockedPill).toBeVisible();
    await expect(blockedPill).toContainText('Blocked (401/403)');

    // Verify error reason is shown
    const errorReason = page.locator('.fw-source-error-reason').first();
    await expect(errorReason).toBeVisible();
    await expect(errorReason).toContainText('HTTP 403 Forbidden');

    // Verify retry button exists and triggers retry
    const retryBtn = page.locator('.fw-retry-source-btn').first();
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    await page.waitForTimeout(500);
    expect(retriedSourceId).toBe('src-mppsc');

    // Verify all-failed message when all sources fail
    const allFailedText = page.getByText('All monitored sources failed to respond. No portals could be reached.');
    await expect(allFailedText).toBeVisible();
  });

  // ── TEST 5: Visiting a watched domain shows the on-visit banner (Requirement 6b & 7.5) ──
  test('Visiting a watched domain shows the on-visit banner with Read Aloud and Highlight Notice Link', async ({ page }) => {
    // Navigate to a mock portal page containing notice links
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Smart India Hackathon Portal</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .notice-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .notice-table th, .notice-table td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            .highlight-target { color: #1d4ed8; text-decoration: underline; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Smart India Hackathon 2026</h1>
          <p>Official Announcement and Registration Center</p>
          <table class="notice-table">
            <tr><th>Date</th><th>Subject</th><th>Link</th></tr>
            <tr>
              <td>2026-10-31</td>
              <td><span id="target-notice-text">Smart India Hackathon 2026 Grand Finale Registration Open</span></td>
              <td><a id="target-notice-link" href="/apply">Apply Online ↗</a></td>
            </tr>
          </table>
        </body>
      </html>
    `);

    // Inject content-portal bundle
    await page.addScriptTag({ path: 'packages/extension/dist/content-portal.js' });

    // Trigger on-visit alert hook
    await page.evaluate(() => {
      if ((window as any).tfbShowOnVisitAlert) {
        (window as any).tfbShowOnVisitAlert('Smart India Hackathon (sih.gov.in)', [
          {
            id: 'alert-sih-live',
            title: 'Smart India Hackathon 2026 Grand Finale Registration Open',
            deadline: '2026-11-20',
            whyMatched: 'Matches topic keywords "hackathon" and is classified as registration_open.',
          },
        ]);
      }
    });

    // Verify On-Visit Banner is displayed
    await page.waitForSelector('#tfb-on-visit-banner', { timeout: 8000 });
    const banner = page.locator('#tfb-on-visit-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Smart India Hackathon (sih.gov.in)');
    await expect(banner).toContainText('Smart India Hackathon 2026 Grand Finale Registration Open');

    // Verify Read Aloud, Highlight on Page, and Mark Seen action buttons
    const readBtn = page.locator('#tfb-on-visit-read-aloud');
    await expect(readBtn).toBeVisible();
    await expect(readBtn).toContainText('Read Aloud');

    const highlightBtn = page.locator('#tfb-on-visit-highlight');
    await expect(highlightBtn).toBeVisible();
    await expect(highlightBtn).toContainText('Highlight on Page');

    const dismissBtn = page.locator('#tfb-on-visit-seen');
    await expect(dismissBtn).toBeVisible();

    // Click Highlight on Page and verify that highlight styles are applied to matching notice element
    await highlightBtn.click();
    await page.waitForTimeout(500);

    const isHighlighted = await page.evaluate(() => {
      const el = document.getElementById('target-notice-text');
      const parent = el?.parentElement;
      return Boolean(
        (el && (el.style.outline !== '' || el.style.backgroundColor !== '')) ||
        (parent && (parent.style.outline !== '' || parent.style.backgroundColor !== ''))
      );
    });
    expect(isHighlighted).toBe(true);

    // Click Mark Seen / Dismiss
    await dismissBtn.click();
    await expect(page.locator('#tfb-on-visit-banner')).toHaveCount(0);
  });
});
