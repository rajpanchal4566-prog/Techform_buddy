import { chromium } from '@playwright/test';

async function verifyDashboard() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const allLogs = [];

  page.on('console', (msg) => {
    const text = msg.text();
    allLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  console.log('Navigating to http://localhost:3000/dashboard...');
  const response = await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
  console.log('Response status:', response?.status());

  await page.waitForTimeout(2000);

  console.log('\n--- Console Logs ---');
  allLogs.forEach(l => console.log(l));

  console.log('\n--- Console Errors Count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  console.log('\n--- Console Warnings Count:', consoleWarnings.length);
  if (consoleWarnings.length > 0) {
    console.log('Warnings:', consoleWarnings);
  }

  await browser.close();

  if (consoleErrors.length > 0) {
    process.exit(1);
  } else {
    console.log('\n✓ Dashboard loaded successfully with NO console errors!');
  }
}

verifyDashboard().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
