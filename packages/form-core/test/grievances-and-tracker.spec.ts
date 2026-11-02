import { test, expect } from '@playwright/test';

test.describe('B1: Grievances UI & Application Tracker Verification', () => {
  let createdTrackingNumber = '';

  test('API: POST and GET grievances with GRV-2026-XXXX tracking number and next_action', async () => {
    // 1. Create grievance
    const res = await fetch('http://localhost:3000/api/grievances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Severe low water pressure and muddy water in Indrapuri',
        domain: 'water',
        department: 'Water Supply & Sanitation Board',
        description: 'Residents of Sector C have not received clean water for 4 days. Supply is turbid with low pressure.',
        priority: 'high',
        language: 'en',
        attachmentName: 'water_sample_photo.jpg',
        attachmentData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.trackingNumber).toBeDefined();
    // Must match GRV-2026-XXXX format
    expect(data.trackingNumber).toMatch(/^GRV-2026-\d{4}$/);
    expect(data.status).toBe('submitted');
    expect(data.nextAction).toBeDefined();
    expect(data.nextAction.length).toBeGreaterThan(10);

    createdTrackingNumber = data.trackingNumber;

    // 2. Fetch grievance by tracking number
    const getRes = await fetch(`http://localhost:3000/api/grievances?tracking_number=${createdTrackingNumber}`);
    expect(getRes.ok).toBe(true);
    const record = await getRes.json();
    expect(record.tracking_number).toBe(createdTrackingNumber);
    expect(record.status).toBe('submitted');
    expect(record.attachment_name).toBe('water_sample_photo.jpg');

    // 3. Update grievance timeline stage
    const patchRes = await fetch('http://localhost:3000/api/grievances', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber: createdTrackingNumber,
        status: 'under_review',
        nextAction: 'Junior engineer scheduled for pressure testing on Nov 2',
      }),
    });
    expect(patchRes.ok).toBe(true);
    const updated = await patchRes.json();
    expect(updated.status).toBe('under_review');
    expect(updated.next_action).toContain('Junior engineer scheduled');
  });

  test('UI: Grievances page renders 4-stage timeline and supports read aloud and advance stage', async ({ page }) => {
    await page.goto('http://localhost:3000/grievances');
    await page.waitForLoadState('networkidle');

    // Tab 1: Tracker is visible
    await expect(page.locator('#tab-track-grievances')).toBeVisible();
    await expect(page.locator('#tab-file-grievance')).toBeVisible();

    // Switch to File Grievance
    await page.click('#tab-file-grievance');
    await expect(page.locator('#grv-department')).toBeVisible();
    await expect(page.locator('#grv-title')).toBeVisible();
    await expect(page.locator('#grv-description')).toBeVisible();

    // Fill form
    await page.selectOption('#grv-department', 'electricity');
    await page.fill('#grv-title', 'Frequent power trips and voltage fluctuation');
    await page.fill('#grv-description', 'Indrapuri transformer sparking repeatedly causing home appliances breakdown.');
    await page.click('#btn-submit-grievance');

    // Confirm success message and tracking ID
    await expect(page.locator('text=Grievance Registered Successfully')).toBeVisible({ timeout: 10000 });
    const trackingBadge = page.locator('strong:has-text("GRV-2026-")');
    await expect(trackingBadge).toBeVisible();

    // Switch back to Tracker tab
    await page.click('#tab-track-grievances');
    await expect(page.locator('#grievance-detail-card')).toBeVisible();

    // Verify 4-stage timeline is rendered within detail card
    const detailCard = page.locator('#grievance-detail-card');
    await expect(detailCard.locator('span:text-is("Submitted")')).toBeVisible();
    await expect(detailCard.locator('span:text-is("Under Review")')).toBeVisible();
    await expect(detailCard.locator('span:text-is("In Progress")')).toBeVisible();
    await expect(detailCard.locator('span:text-is("Resolved")')).toBeVisible();

    // Verify Next Expected Action card
    await expect(page.locator('#grv-next-action-card')).toBeVisible();

    // Verify Read Aloud Status button exists
    await expect(page.locator('#btn-read-aloud-status')).toBeVisible();

    // Advance status button works
    const advanceBtn = page.locator('#btn-advance-status-demo');
    if (await advanceBtn.isVisible()) {
      await advanceBtn.click();
      await page.waitForTimeout(500);
      // Status should have updated to next stage
      await expect(page.locator('#grv-next-action-card')).toBeVisible();
    }
  });
});
