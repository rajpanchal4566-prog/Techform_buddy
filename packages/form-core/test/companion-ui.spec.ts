import { test, expect } from '@playwright/test';
import path from 'path';

const PORTAL_PAGE_URL = 'file:///' + path.resolve(__dirname, '../test-pages/portal-sample.html').replace(/\\/g, '/');
const SCRIPT_PATH = path.resolve(__dirname, '../../extension/dist/content-portal.js');

test.describe('TechForm Buddy: Compact AI Companion UI Redesign', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chrome = {
        runtime: {
          sendMessage: (msg: any, callback: any) => {
            if (msg.type === 'TFB_GET_STATUS') {
              callback({ connected: true, language: 'en', appUrl: 'http://localhost:3000', taskName: 'Citizen Verification' });
            } else if (msg.type === 'TFB_GET_FILL_VALUES') {
              callback({
                success: true,
                fillValues: {
                  full_name: 'Pooja Verma',
                  ward: 'Ward 12 South',
                },
              });
            } else if (msg.type === 'TFB_MAP_FORM') {
              callback({
                success: true,
                mappings: [
                  { fieldId: 'applicant_name', profileKey: 'full_name', confidence: 0.95 },
                  { fieldId: 'custom_ward_zone', profileKey: 'ward', confidence: 0.85 },
                ],
              });
            } else {
              callback({ success: true });
            }
          },
          onMessage: { addListener: () => {} },
          getManifest: () => ({ version: '1.0.0' }),
        },
      };
    });
  });

  // TEST 1: Desktop: Launcher is 52-60px circular button, Panel opens at ~310x410px (never 100vh)
  test('Desktop: Compact circular launcher (52-60px) and compact companion card (310x410px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // 1. Verify Floating Circular Launcher
    const launcher = page.locator('#tfb-launcher-badge');
    await expect(launcher).toBeVisible();

    const box = await launcher.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(52);
      expect(box.width).toBeLessThanOrEqual(60);
      expect(box.height).toBeGreaterThanOrEqual(52);
      expect(box.height).toBeLessThanOrEqual(60);
    }

    // Check title / tooltip attribute
    const titleAttr = await launcher.getAttribute('title');
    expect(titleAttr).toBe("Hey! I'm your Buddy");

    // 2. Open Companion Panel
    await launcher.click();
    const panel = page.locator('#tfb-sidebar-container');
    await expect(panel).toBeVisible();

    // Verify Panel Dimensions (never full 100vh, ~360px x min(640px, 85vh))
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    if (panelBox) {
      expect(panelBox.width).toBeGreaterThanOrEqual(280);
      expect(panelBox.width).toBeLessThanOrEqual(380);
      expect(panelBox.height).toBeGreaterThanOrEqual(380);
      expect(panelBox.height).toBeLessThanOrEqual(650);
      expect(panelBox.height).toBeLessThan(750); // Strictly NOT 100vh full-page overlay
    }

    // Verify Mascot Header & Greeting
    await expect(panel).toContainText("Hey! I'm your Buddy");
    await expect(panel.locator('.tfb-header-mascot svg')).toBeVisible();
  });

  // TEST 2: Desktop: Minimize companion to circular pill and restore
  test('Desktop: Panel minimizes and restores cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // Open Companion
    await page.click('#tfb-launcher-badge');
    const panel = page.locator('#tfb-sidebar-container');
    await expect(panel).toBeVisible();

    // Click Minimize button
    const minBtn = page.locator('#tfb-overlay-minimize-btn');
    await expect(minBtn).toBeVisible();
    await minBtn.click();

    // Panel collapses to minimized pill
    const pill = page.locator('#tfb-minimized-pill');
    await expect(pill).toBeVisible();
    const pillBox = await pill.boundingBox();
    expect(pillBox).not.toBeNull();
    if (pillBox) {
      expect(pillBox.width).toBeGreaterThanOrEqual(50);
      expect(pillBox.width).toBeLessThanOrEqual(60);
    }

    // Click pill to restore panel
    await pill.click();
    await expect(panel).toBeVisible();
  });

  // TEST 3: Mobile Viewport (375x667): Compact bottom sheet responsive layout
  test('Mobile: Responsive compact bottom sheet layout within viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    const launcher = page.locator('#tfb-launcher-badge');
    await expect(launcher).toBeVisible();
    const lBox = await launcher.boundingBox();
    expect(lBox).not.toBeNull();
    if (lBox) {
      expect(lBox.width).toBeGreaterThanOrEqual(48);
      expect(lBox.width).toBeLessThanOrEqual(56);
    }

    // Open companion in mobile viewport
    await launcher.click();
    const panel = page.locator('#tfb-sidebar-container');
    await expect(panel).toBeVisible();

    const pBox = await panel.boundingBox();
    expect(pBox).not.toBeNull();
    if (pBox) {
      // Must fit within 375px mobile screen width with side padding
      expect(pBox.width).toBeLessThanOrEqual(375);
      // Must not exceed 70vh of 667px (~466px)
      expect(pBox.height).toBeLessThanOrEqual(460);
    }
  });

  // TEST 4: Mascot states: Expressive SVG with antenna orb, ears, screen visor
  test('Mascot: Cute robot silhouette with stateful eyes (idle, listening, thinking, success)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // Mascot SVG in floating launcher
    const mascotSvg = page.locator('#tfb-launcher-badge .tfb-mascot-svg');
    await expect(mascotSvg).toBeVisible();

    // Check SVG components: Cyan antenna orb (cx=50, cy=7), ear audio nodes, rounded chassis
    const svgHtml = await mascotSvg.innerHTML();
    expect(svgHtml).toContain('cx="50" cy="7"'); // Antenna orb
    expect(svgHtml).toContain('tfb-m-grad-'); // Gradient chassis
    expect(svgHtml).toContain('tfb-m-visor-'); // Visor screen
  });

  // TEST 5: Quick Actions: 4 Core Actions (Fill Form, Explain Page, Ask Buddy, My Forms)
  test('Quick Actions: Grid provides immediate one-click actions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PORTAL_PAGE_URL);
    await page.addScriptTag({ path: SCRIPT_PATH });

    // Open companion
    await page.click('#tfb-launcher-badge');
    await expect(page.locator('#tfb-sidebar-container')).toBeVisible();

    // 1. Fill Form Quick Action
    const fillBtn = page.locator('#tfb-fill-btn').first();
    await expect(fillBtn).toBeVisible();
    await fillBtn.click();

    // Verify fields were filled
    const nameVal = await page.inputValue('#applicant_name');
    expect(nameVal).toBe('Pooja Verma');

    // 2. Explain Page Quick Action
    const guideBtn = page.locator('#tfb-quick-guide-btn');
    await expect(guideBtn).toBeVisible();
    await guideBtn.click();
    await expect(page.locator('#tfb-tab-guide')).toBeVisible();

    // 3. Ask Buddy Quick Action
    const askBtn = page.locator('#tfb-tab-assistant');
    await expect(askBtn).toBeVisible();
    await askBtn.click();
    await expect(page.locator('#tfb-assistant-input')).toBeVisible();

    // 4. My Forms Quick Action
    const myFormsBtn = page.locator('#tfb-open-app-btn');
    await expect(myFormsBtn).toBeVisible();
  });
});

