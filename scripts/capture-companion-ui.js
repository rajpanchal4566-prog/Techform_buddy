const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const artifactDir = 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6';

  // 1. Desktop Viewport
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const desktopPage = await desktopContext.newPage();

  const consoleErrors = [];
  desktopPage.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('Navigating to http://localhost:3000...');
  await desktopPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  // Check launcher visibility
  const launcher = desktopPage.locator('#tfb-launcher-badge');
  await launcher.waitFor({ state: 'visible', timeout: 5000 });
  const launcherBox = await launcher.boundingBox();
  console.log(`Launcher dimensions on desktop: ${launcherBox.width}x${launcherBox.height}px`);

  // Hover over launcher to show tooltip
  await launcher.hover();
  await desktopPage.waitForTimeout(400);

  // Screenshot 1: Desktop with circular mascot launcher
  await desktopPage.screenshot({
    path: path.join(artifactDir, 'mascot-launcher-desktop.png'),
    fullPage: false,
  });
  console.log('Saved mascot-launcher-desktop.png');

  // Click launcher to open companion card
  await launcher.click();
  await desktopPage.waitForTimeout(500);

  const card = desktopPage.locator('#tfb-portal-overlay-host');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  const cardBox = await card.boundingBox();
  console.log(`Companion card dimensions on desktop: ${cardBox.width}x${cardBox.height}px (x: ${cardBox.x}, y: ${cardBox.y})`);

  // Screenshot 2: Desktop with opened companion card
  await desktopPage.screenshot({
    path: path.join(artifactDir, 'companion-card-desktop.png'),
    fullPage: false,
  });
  console.log('Saved companion-card-desktop.png');

  await desktopContext.close();

  // 2. Mobile Viewport (iPhone SE / 375x667)
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  const mobileLauncher = mobilePage.locator('#tfb-launcher-badge');
  await mobileLauncher.waitFor({ state: 'visible', timeout: 5000 });
  const mobileLauncherBox = await mobileLauncher.boundingBox();
  console.log(`Launcher dimensions on mobile: ${mobileLauncherBox.width}x${mobileLauncherBox.height}px`);

  // Screenshot 3: Mobile launcher
  await mobilePage.screenshot({
    path: path.join(artifactDir, 'mascot-launcher-mobile.png'),
    fullPage: false,
  });
  console.log('Saved mascot-launcher-mobile.png');

  // Open companion sheet on mobile
  await mobileLauncher.click();
  await mobilePage.waitForTimeout(500);

  const mobileSheet = mobilePage.locator('#tfb-portal-overlay-host');
  await mobileSheet.waitFor({ state: 'visible', timeout: 5000 });
  const mobileSheetBox = await mobileSheet.boundingBox();
  console.log(`Companion sheet dimensions on mobile: ${mobileSheetBox.width}x${mobileSheetBox.height}px`);

  // Screenshot 4: Mobile bottom sheet
  await mobilePage.screenshot({
    path: path.join(artifactDir, 'companion-sheet-mobile.png'),
    fullPage: false,
  });
  console.log('Saved companion-sheet-mobile.png');

  await mobileContext.close();
  await browser.close();

  const criticalErrors = consoleErrors.filter(e =>
    e.includes('Hydration') || e.includes('hydration') || e.includes('react-hydration-error')
  );
  console.log(`Console hydration errors detected: ${criticalErrors.length}`);
  if (criticalErrors.length > 0) {
    console.error('Hydration errors:', criticalErrors);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
