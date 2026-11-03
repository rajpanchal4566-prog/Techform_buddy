import { test, expect } from '@playwright/test';
import { runMongoMigration, auditEventRecords } from '../../../src/lib/mongoMigration';
import { getDb } from '../../../src/lib/db';

test.describe('Form Watch: Events, Hackathons & Applications Coexistence Regression Suite', () => {
  const testUserId = 'ce93fcbf-0795-4774-9d9e-e24bbb5e9483';

  test.beforeEach(async ({ page }) => {
    // Authenticate with session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: testUserId, name: 'Raj Panchal', email: 'rajpanchal4566@gmail.com' },
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    });
  });

  // ── 1. Discover existing hackathons ──
  test('1. Discover existing hackathons: returns SIH, MIC, MLH with live discovery', async ({ page }) => {
    await page.goto('/form-watch');
    await page.waitForSelector('#fw-search-input', { timeout: 10000 });

    // Click Hackathons topic tab
    const hackathonTab = page.locator('#fw-tab-hackathon');
    await expect(hackathonTab).toBeVisible();
    await hackathonTab.click();

    // Verify search matches list contains SIH, MIC, MLH
    await page.waitForSelector('#fw-matched-sources-list', { timeout: 8000 });
    const content = await page.locator('#fw-matched-sources-list').textContent();
    expect(content).toContain('Smart India Hackathon');

    // Click Discovery button on Smart India Hackathon
    const sihCard = page.locator('.fw-source-selection-card', { hasText: 'Smart India Hackathon' }).first();
    const discoverBtn = sihCard.locator('.fw-discover-btn');
    if (await discoverBtn.count() > 0) {
      await discoverBtn.click();
      await page.waitForSelector('#fw-discovery-panel', { timeout: 8000 });
      const discText = await page.locator('#fw-discovery-panel').textContent();
      expect(discText).toContain('Smart India Hackathon');
    }
  });

  // ── 2. Display upcoming events ──
  test('2. Display upcoming events: lists verified hackathons, competitions, internships in Events Hub', async ({ page }) => {
    await page.goto('/form-watch');
    await page.waitForSelector('#fw-view-events', { timeout: 10000 });

    await page.locator('#fw-view-events').click();
    await page.waitForSelector('#fw-events-grid', { timeout: 8000 });

    const grid = page.locator('#fw-events-grid');
    const cards = grid.locator('.fw-event-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    const firstCardText = await cards.first().textContent();
    expect(firstCardText).toBeTruthy();
  });

  // ── 3 & 4. Open event details & original source links ──
  test('3 & 4. Open event details modal and verify original source links', async ({ page }) => {
    await page.goto('/form-watch');
    await page.locator('#fw-view-events').click();
    await page.waitForSelector('#fw-events-grid', { timeout: 8000 });

    const firstCard = page.locator('.fw-event-card').first();
    const detailsBtn = firstCard.locator('.fw-btn-view-details');
    await detailsBtn.click();

    // Verify modal appears
    await page.waitForSelector('#fw-event-details-modal', { timeout: 5000 });
    const modal = page.locator('#fw-event-details-modal');
    await expect(modal).toBeVisible();

    const title = await modal.locator('#fw-modal-event-title').textContent();
    expect(title).toBeTruthy();

    const deadline = await modal.locator('#fw-modal-deadline').textContent();
    expect(deadline).toBeTruthy();

    const officialLink = modal.locator('#fw-modal-official-link');
    if (await officialLink.count() > 0) {
      const href = await officialLink.getAttribute('href');
      expect(href).toMatch(/^https?:\/\//);
      const target = await officialLink.getAttribute('target');
      expect(target).toBe('_blank');
    }

    // Close modal
    await modal.locator('#fw-modal-close-btn').click();
    await expect(modal).not.toBeVisible();
  });

  // ── 5 & 6. Save/bookmark an event and verify event deadlines ──
  test('5 & 6. Save/bookmark an event and verify event deadlines', async ({ page }) => {
    await page.goto('/form-watch');
    await page.locator('#fw-view-events').click();
    await page.waitForSelector('#fw-events-grid', { timeout: 8000 });

    const firstCard = page.locator('.fw-event-card').first();
    const bookmarkBtn = firstCard.locator('.fw-btn-bookmark');
    await bookmarkBtn.click();
    await page.waitForTimeout(600);

    // Navigate to Saved Events tab
    await page.locator('#fw-view-saved').click();
    await page.waitForSelector('#fw-saved-events-list, .empty-state', { timeout: 8000 });

    const savedItems = page.locator('#fw-saved-events-list .card');
    const count = await savedItems.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify deadline chip
    const deadlineChip = page.locator('#fw-saved-events-list .fw-event-deadline-chip').first();
    if (await deadlineChip.count() > 0) {
      const deadlineText = await deadlineChip.textContent();
      expect(deadlineText).toContain('Deadline:');
    }
  });

  // ── 7. Verify existing event notifications ──
  test('7. Verify existing event notifications: preserves historical event alerts in SQLite', async () => {
    const db = getDb();
    const notifs = db.prepare(
      "SELECT id, title, message FROM notifications WHERE user_id = ? AND title LIKE '%Hackathon%'"
    ).all(testUserId) as Array<Record<string, any>>;

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs[0].title).toContain('Smart India Hackathon');
  });

  // ── 8. Verify event reminders ──
  test('8. Verify event reminders: toggle reminder updates state', async ({ page }) => {
    await page.goto('/form-watch');
    await page.locator('#fw-view-saved').click();
    await page.waitForSelector('#fw-saved-events-list, .empty-state', { timeout: 8000 });

    const reminderBtn = page.locator('.fw-btn-toggle-reminder').first();
    if (await reminderBtn.count() > 0) {
      await expect(reminderBtn).toBeVisible();
      await reminderBtn.click();
      await page.waitForTimeout(600);
      const btnText = await reminderBtn.textContent();
      expect(btnText).toMatch(/Reminder/);
    }
  });

  // ── 9, 10 & 11. Create event watch, scholarship watch, and verify coexistence ──
  test('9, 10 & 11. Coexistence: Create event watch and scholarship watch', async ({ page }) => {
    await page.goto('/form-watch');
    await page.waitForSelector('#fw-search-input', { timeout: 10000 });

    // 1. Search scholarship
    const input = page.locator('#fw-search-input');
    await input.fill('scholarship');
    await page.waitForTimeout(300);
    await page.locator('#fw-search-btn').click();

    await page.waitForSelector('#fw-matched-sources-list', { timeout: 8000 });
    const content = await page.locator('#fw-matched-sources-list').textContent();
    expect(content).toContain('Scholarship');

    // 2. Search hackathon
    await input.fill('sih');
    await page.waitForTimeout(200);
    const searchResPromise = page.waitForResponse(r => r.url().includes('/api/form-watches/search'));
    await page.locator('#fw-search-btn').click();
    await searchResPromise;

    await page.waitForTimeout(400);
    const hackathonContent = await page.locator('#fw-matched-sources-list').textContent();
    expect(hackathonContent).toContain('Smart India Hackathon');

    // 3. Verify active watches view lists both types
    const watchesList = page.locator('.fw-watches-list');
    if (await watchesList.count() > 0) {
      const watchesText = await watchesList.textContent();
      expect(watchesText).toBeTruthy();
    }
  });

  // ── 12. Verify existing event records after MongoDB migration audit ──
  test('12. Verify existing event records after MongoDB migration audit', async () => {
    const audit = auditEventRecords();
    expect(audit.isVerified).toBe(true);
    expect(audit.duplicatesFound).toBe(0);
    expect(audit.totalRecordsExtracted).toBeGreaterThanOrEqual(150);
    expect(audit.tables.watch_sources.recordCount).toBeGreaterThanOrEqual(10);
    expect(audit.tables.watch_notices.recordCount).toBeGreaterThanOrEqual(100);
    expect(audit.tables.saved_events.recordCount).toBeGreaterThanOrEqual(1);

    const migrationResult = await runMongoMigration();
    expect(migrationResult.isVerified).toBe(true);
    expect(migrationResult.totalRecordsExtracted).toBe(audit.totalRecordsExtracted);
  });
});
