import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/landing-evidence';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function verifyLanding() {
  const browser = await chromium.launch({ channel: 'msedge' });

  // 1. Desktop (1366x768)
  const pageDesktop = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await pageDesktop.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const desktopShot = path.join(ARTIFACT_DIR, 'landing-desktop-1366x768.png');
  await pageDesktop.screenshot({ path: desktopShot, fullPage: false });
  console.log('✓ Captured desktop screenshot:', desktopShot);

  // 2. Mobile (375x667)
  const pageMobile = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await pageMobile.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  const mobileShot = path.join(ARTIFACT_DIR, 'landing-mobile-375x667.png');
  await pageMobile.screenshot({ path: mobileShot, fullPage: false });
  console.log('✓ Captured mobile screenshot:', mobileShot);

  await browser.close();
  console.log('Landing page verification finished successfully!');
}

verifyLanding().catch((err) => {
  console.error('Error during landing verification:', err);
  process.exit(1);
});
