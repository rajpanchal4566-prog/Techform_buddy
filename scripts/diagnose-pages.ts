import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = path.resolve('C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/diagnose');
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'forms', path: '/forms' },
  { name: 'forms-new', path: '/forms/new' },
  { name: 'grievances', path: '/grievances' },
  { name: 'status', path: '/status' },
  { name: 'notifications', path: '/notifications' },
  { name: 'form-watch', path: '/form-watch' },
  { name: 'documents', path: '/documents' },
  { name: 'profile', path: '/profile' },
  { name: 'settings', path: '/settings' },
  { name: 'demo-portal', path: '/demo-portal' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
];

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '375x667', width: 375, height: 667 },
];

interface PageDiagnosis {
  page: string;
  viewport: string;
  status: number | null;
  consoleErrors: string[];
  hydrationWarnings: string[];
  failedRequests: string[];
  horizontalOverflow: boolean;
  screenshot: string;
  layoutIssues: string[];
}

async function runDiagnosis() {
  console.log('🚀 Starting deep UI diagnosis across all 13 pages at 1366x768 and 375x667...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results: PageDiagnosis[] = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });

    // Mock NextAuth session for authenticated pages
    await context.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'demo-user-id',
            name: 'Aarav Sharma',
            email: 'demo@techformbuddy.in',
            image: null,
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    for (const p of PAGES) {
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const hydrationWarnings: string[] = [];
      const failedRequests: string[] = [];

      page.on('console', (msg) => {
        const text = msg.text();
        if (msg.type() === 'error') {
          consoleErrors.push(text);
        }
        if (text.includes('hydration') || text.includes('Hydration') || text.includes('did not match')) {
          hydrationWarnings.push(text);
        }
      });

      page.on('requestfailed', (req) => {
        failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
      });

      let resStatus: number | null = null;
      try {
        const response = await page.goto(`http://localhost:3000${p.path}`, {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
        resStatus = response ? response.status() : null;
      } catch (err: any) {
        console.error(`Error loading ${p.path} at ${vp.name}:`, err.message);
      }

      await page.waitForTimeout(1000);

      // Check horizontal overflow
      const horizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });

      // Check layout issues
      const layoutIssues: string[] = [];
      const issues = await page.evaluate(() => {
        const found: string[] = [];
        // Check if sidebar exists and has 0 width or wrong positioning
        const sidebar = document.querySelector('.sidebar') || document.querySelector('aside');
        if (sidebar) {
          const rect = sidebar.getBoundingClientRect();
          if (rect.width === 0 && window.innerWidth > 768) {
            found.push('Sidebar has 0px width on desktop');
          }
        }

        // Check if widget covers center content
        const widgetBadge = document.getElementById('tfb-launcher-badge');
        if (widgetBadge) {
          const rect = widgetBadge.getBoundingClientRect();
          if (rect.width > 200) {
            found.push('Widget badge is larger than 200px (not compact launcher)');
          }
        }

        // Check if content is empty
        const main = document.querySelector('main');
        if (main && (main.textContent || '').trim().length < 20) {
          found.push('Main content area appears empty (< 20 text chars)');
        }

        return found;
      });
      layoutIssues.push(...issues);

      // Save screenshot
      const shotPath = path.join(ARTIFACT_DIR, `${p.name}-${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });

      results.push({
        page: p.path,
        viewport: vp.name,
        status: resStatus,
        consoleErrors,
        hydrationWarnings,
        failedRequests,
        horizontalOverflow,
        screenshot: shotPath,
        layoutIssues,
      });

      console.log(`✓ ${p.path} [${vp.name}] - Status: ${resStatus}, Err: ${consoleErrors.length}, Hydration: ${hydrationWarnings.length}, Overflow: ${horizontalOverflow}`);
      await page.close();
    }

    await context.close();
  }

  await browser.close();

  const reportPath = path.join(ARTIFACT_DIR, 'diagnosis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n🎉 Diagnosis complete! Report saved to: ${reportPath}`);
}

runDiagnosis().catch((err) => {
  console.error('Diagnosis failed:', err);
  process.exit(1);
});

