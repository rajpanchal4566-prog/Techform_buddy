import { test, expect } from '@playwright/test';

test.describe('Status Dashboard & Demo Readiness (B7)', () => {
  test('Health API endpoint returns database connected and operational status', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.service).toBe('TechForm Buddy API');
    expect(json.database).toBe('connected');
    expect(typeof json.uptimeSeconds).toBe('number');
  });

  test('/status dashboard renders operational indicators and subsystems matrix', async ({ page }) => {
    await page.goto('/status');
    await page.waitForLoadState('networkidle');

    // Verify main page title and status indicator
    await expect(page.locator('h1')).toContainText('System Status');
    const statusIndicator = page.locator('#system-status-indicator');
    await expect(statusIndicator).toBeVisible();
    await expect(statusIndicator).toContainText('All Systems Operational');

    // Verify Subsystems Probes entries
    await expect(page.getByText('Persistent Database Subsystem')).toBeVisible();
    await expect(page.getByText('Natural Language Understanding & OCR Planner')).toBeVisible();
    await expect(page.getByText('SMTP Email Delivery Provider')).toBeVisible();
    await expect(page.getByText('Web Push Notification Engine (VAPID)')).toBeVisible();
    await expect(page.getByText('Form Watch & Portal Monitor Scheduler')).toBeVisible();
    await expect(page.getByText('Manifest V3 Chrome Extension Bridge')).toBeVisible();

    // Verify Reset Demo Data button exists
    const resetBtn = page.locator('#reset-demo-btn');
    await expect(resetBtn).toBeVisible();

    // Verify Tab switching to PS-15 Domain Coverage
    const ps15Tab = page.getByRole('button', { name: /PS-15 Domain Coverage/i });
    await ps15Tab.click();
    await expect(page.getByText('Government Citizen Services')).toBeVisible();
    await expect(page.getByText('Education & Admissions')).toBeVisible();
    await expect(page.getByText('Healthcare & Welfare')).toBeVisible();
    await expect(page.getByText('Banking & Financial')).toBeVisible();
    await expect(page.getByText('Business & MSME')).toBeVisible();

    // Verify Tab switching to Runtime Environment
    const envTab = page.getByRole('button', { name: /Runtime Environment/i });
    await envTab.click();
    await expect(page.getByText('Next.js 16.3.8 (App Router)')).toBeVisible();
    await expect(page.getByText('better-sqlite3 v13.0.3 (WAL Mode)')).toBeVisible();
  });
});

