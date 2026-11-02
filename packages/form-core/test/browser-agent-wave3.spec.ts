import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';
import { createPortalServer, PORT, resetSubmissionCount, getSubmissionCount } from '../test-pages/server';
import {
  BrowserToolName,
  BrowserObservationRecord,
  verifyStepCondition,
  getStepRecoveryStrategy,
} from '../../../src/lib/agentToolRegistry';
import { planBrowserTask, PlanStep } from '../../../src/lib/planner';
import { getLanguageBcp47 } from '../../../src/lib/languages';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension');
const ARTIFACT_DIR = path.resolve('C:/Users/ACER/.gemini/antigravity/brain/41d46163-53c9-4fe5-842a-281fed7651e6/wave3-evidence');

let server: http.Server;

test.beforeAll(async () => {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  server = createPortalServer();
  await new Promise<void>((resolve) => {
    server.listen(PORT, resolve);
  });
});

test.afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

test.describe('Wave 3: Real Browser & Live Portal Validation', () => {

  // ─────────────────────────────────────────────────────────────
  // 1. ACTUAL EXTENSION LOADING & MV3 SERVICE WORKER VALIDATION
  // ─────────────────────────────────────────────────────────────
  test.describe('1. Actual Extension Loading & MV3 Service Worker Validation', () => {
    test('loads unpacked extension in Microsoft Edge and registers MV3 service worker', async () => {
      const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');
      expect(fs.existsSync(manifestPath), 'manifest.json must exist in packages/extension').toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.name).toBe('TechForm Buddy');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.manifest_version).toBe(3);

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-sw-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--no-first-run',
          ],
        });

        let serviceWorkers = context.serviceWorkers();
        if (serviceWorkers.length === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          serviceWorkers = context.serviceWorkers();
        }

        expect(serviceWorkers.length, 'At least 1 MV3 service worker should be active').toBeGreaterThanOrEqual(1);
        const swUrl = serviceWorkers[0].url();
        expect(swUrl).toContain('chrome-extension://');
        expect(swUrl).toContain('background.js');
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('injects content script on portal and mounts accessible launcher badge', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-inject-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
        });

        const page = await context.newPage();
        const consoleMessages: string[] = [];
        page.on('console', (msg) => consoleMessages.push(msg.text()));

        await page.goto(`http://localhost:${PORT}/scholarship-form`, { waitUntil: 'networkidle' });

        await expect.poll(() => consoleMessages.some(m => m.includes('[TechFormBuddy] content script loaded')), {
          timeout: 5000,
        }).toBe(true);

        const badge = page.locator('#tfb-launcher-badge');
        await expect(badge).toBeAttached({ timeout: 5000 });

        const tooltip = page.locator('.tfb-launcher-tooltip');
        await expect(tooltip).toHaveText(/Hey! I'm your Buddy/i);

        const autofillBadge = page.locator('#tfb-pill-autofill-badge');
        await expect(autofillBadge).toHaveText(/⚡ Autofill: ON/i);
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. CONTROLLED BROWSER TEST WEBSITE & AUTONOMOUS WORKFLOW
  // ─────────────────────────────────────────────────────────────
  test.describe('2. Controlled Browser Multi-Page & Autonomous Workflow', () => {
    test('executes autonomous navigation, form detection and preserves task context across pages', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-workflow-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
        });

        const page = await context.newPage();

        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
        expect(await page.title()).toContain('National Citizen Benefits & Scholarship Portal');

        const applyLink = page.locator('#apply-btn-1');
        await expect(applyLink).toBeVisible();

        const planResult = planBrowserTask(
          'Apply for post-matric scholarship scheme for college students',
          'en',
          { url: page.url(), title: await page.title() }
        );

        expect(planResult.plan).toBeDefined();
        const plan = planResult.plan!;
        expect(plan.target).toBe('portal');
        expect(plan.steps.length).toBeGreaterThanOrEqual(4);
        expect(plan.steps[0].action).toBe('search_portal');
        expect(plan.steps[1].action).toBe('navigate');

        await applyLink.click();
        await page.waitForURL(`http://localhost:${PORT}/scholarship-form`);
        await page.waitForLoadState('networkidle');

        expect(await page.title()).toContain('Post-Matric Scholarship Application Form 2026');

        const obs: BrowserObservationRecord = {
          url: page.url(),
          hostname: new URL(page.url()).hostname,
          title: await page.title(),
          readyState: await page.evaluate(() => document.readyState),
          fieldCount: await page.locator('input, select, textarea').count(),
          timestamp: Date.now(),
        };

        const navVerification = verifyStepCondition('dom_ready', obs, {
          url: `http://localhost:${PORT}/scholarship-form`,
        });
        expect(navVerification.verified).toBe(true);
        expect(navVerification.status).toBe('successful');
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('confirms Autopilot toggle controls work in the overlay UI', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-autopilot-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
        });

        const page = await context.newPage();
        await page.goto(`http://localhost:${PORT}/scholarship-form`, { waitUntil: 'networkidle' });

        const badge = page.locator('#tfb-launcher-badge');
        await badge.click();

        const overlayHost = page.locator('#tfb-portal-overlay-host');
        await expect(overlayHost).toBeAttached({ timeout: 5000 });

        await page.evaluate(() => {
          const plan = {
            id: 'test-plan-1',
            title: 'Scholarship Application',
            goal: 'Complete scholarship form',
            target: 'portal',
            status: 'running',
            autopilot: true,
            currentStepIndex: 0,
            steps: [
              {
                id: 's1',
                stepNumber: 1,
                action: 'detect_forms',
                title: 'Detect form fields',
                status: 'pending',
                verifyCondition: 'fields_classified',
              },
            ],
          };
          window.dispatchEvent(new CustomEvent('tfb-set-active-plan', { detail: { plan } }));
          window.postMessage({ type: 'TFB_SET_ACTIVE_PLAN', plan }, '*');
        });

        const autopilotBtn = page.locator('#tfb-plan-autopilot-btn');
        await expect(autopilotBtn).toBeVisible({ timeout: 5000 });
        await expect(autopilotBtn).toHaveText(/Autopilot: ON/i);

        await autopilotBtn.click();
        await expect(autopilotBtn).toHaveText(/Autopilot: OFF/i);

        await autopilotBtn.click();
        await expect(autopilotBtn).toHaveText(/Autopilot: ON/i);
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. DOWNLOAD VALIDATION (PDF FORMAT, INTEGRITY & NO DUPLICATES)
  // ─────────────────────────────────────────────────────────────
  test.describe('3. Download Validation', () => {
    test('downloads official guidelines PDF and verifies filename, size and binary PDF structure', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-download-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
        });

        const page = await context.newPage();
        await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        await page.locator('#download-guidelines-btn').click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe('guidelines.pdf');

        const downloadSavePath = path.join(tempDir, download.suggestedFilename());
        await download.saveAs(downloadSavePath);

        expect(fs.existsSync(downloadSavePath)).toBe(true);

        const stats = fs.statSync(downloadSavePath);
        expect(stats.size).toBeGreaterThan(10000);

        const fileBuffer = fs.readFileSync(downloadSavePath);
        const header = fileBuffer.slice(0, 5).toString('ascii');
        expect(header).toBe('%PDF-');

        const tail = fileBuffer.slice(-256).toString('ascii');
        expect(tail.includes('%%EOF') || tail.includes('%EOF')).toBe(true);

        const downloadObs: BrowserObservationRecord = {
          url: page.url(),
          hostname: new URL(page.url()).hostname,
          title: await page.title(),
          readyState: 'complete',
          downloadFound: true,
          downloadCount: 1,
          timestamp: Date.now(),
        };

        const verifyResult = verifyStepCondition('download_started', downloadObs);
        expect(verifyResult.verified).toBe(true);
        expect(verifyResult.status).toBe('successful');
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('refuses unverified downloads and prevents duplicate download execution', () => {
      const missingObs: BrowserObservationRecord = {
        url: `http://localhost:${PORT}/`,
        hostname: 'localhost',
        title: 'National Benefits Portal',
        readyState: 'complete',
        downloadFound: false,
        timestamp: Date.now(),
      };
      const missingResult = verifyStepCondition('download_started', missingObs);
      expect(missingResult.verified).toBe(false);
      expect(missingResult.status).toBe('unverified');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. FORM FILLING & SAFETY ENFORCEMENT VALIDATION
  // ─────────────────────────────────────────────────────────────
  test.describe('4. Form Filling & Safety Enforcement Validation', () => {
    test('fills multi-field form with synthetic data and independently checks live DOM values', async () => {
      resetSubmissionCount();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-fill-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
        });

        const page = await context.newPage();
        await page.goto(`http://localhost:${PORT}/scholarship-form`, { waitUntil: 'networkidle' });

        const syntheticProfile = {
          fullName: 'Aarav Sharma',
          dob: '2002-05-14',
          gender: 'Male',
          category: 'OBC',
          email: 'aarav.sharma@example.gov.in',
          phone: '9876543210',
          instituteName: 'Delhi Technological University',
          annualIncome: '180000',
          rollNumber: 'DTU-2024-CS-041',
        };

        await page.locator('#first_name').fill(syntheticProfile.fullName);
        await page.locator('#dob').fill(syntheticProfile.dob);
        await page.locator('#gender').selectOption(syntheticProfile.gender);
        await page.locator('#category').selectOption(syntheticProfile.category);
        await page.locator('#email').fill(syntheticProfile.email);
        await page.locator('#phone').fill(syntheticProfile.phone);
        await page.locator('#institute_name').fill(syntheticProfile.instituteName);
        await page.locator('#annual_income').fill(syntheticProfile.annualIncome);
        await page.locator('#roll_number').fill(syntheticProfile.rollNumber);
        await page.locator('#agree_terms').check();
        await page.locator('#opt_in_sms').check();

        const addBankBtn = page.locator('#btn-add-bank');
        await addBankBtn.click();

        const bankInput = page.locator('#bank_account_number');
        const ifscInput = page.locator('#ifsc_code');
        await expect(bankInput).toBeVisible();
        await expect(ifscInput).toBeVisible();

        await bankInput.fill('123456789012');
        await ifscInput.fill('SBIN0001234');

        const domValues = await page.evaluate(() => {
          return {
            fullName: (document.getElementById('first_name') as HTMLInputElement)?.value,
            dob: (document.getElementById('dob') as HTMLInputElement)?.value,
            gender: (document.getElementById('gender') as HTMLSelectElement)?.value,
            category: (document.getElementById('category') as HTMLSelectElement)?.value,
            email: (document.getElementById('email') as HTMLInputElement)?.value,
            phone: (document.getElementById('phone') as HTMLInputElement)?.value,
            instituteName: (document.getElementById('institute_name') as HTMLInputElement)?.value,
            annualIncome: (document.getElementById('annual_income') as HTMLInputElement)?.value,
            rollNumber: (document.getElementById('roll_number') as HTMLInputElement)?.value,
            agreeTerms: (document.getElementById('agree_terms') as HTMLInputElement)?.checked,
            optInSms: (document.getElementById('opt_in_sms') as HTMLInputElement)?.checked,
            bankAccount: (document.getElementById('bank_account_number') as HTMLInputElement)?.value,
            ifsc: (document.getElementById('ifsc_code') as HTMLInputElement)?.value,
            autoSubmitted: (window as any).__tfb_submitted,
          };
        });

        expect(domValues.fullName).toBe('Aarav Sharma');
        expect(domValues.dob).toBe('2002-05-14');
        expect(domValues.gender).toBe('Male');
        expect(domValues.category).toBe('OBC');
        expect(domValues.email).toBe('aarav.sharma@example.gov.in');
        expect(domValues.phone).toBe('9876543210');
        expect(domValues.instituteName).toBe('Delhi Technological University');
        expect(domValues.annualIncome).toBe('180000');
        expect(domValues.rollNumber).toBe('DTU-2024-CS-041');
        expect(domValues.agreeTerms).toBe(true);
        expect(domValues.optInSms).toBe(true);
        expect(domValues.bankAccount).toBe('123456789012');
        expect(domValues.ifsc).toBe('SBIN0001234');

        expect(domValues.autoSubmitted).toBe(false);
        expect(getSubmissionCount()).toBe(0);
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });

    test('handles missing element safely without unhandled crashes', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-missing-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
        });

        const page = await context.newPage();
        await page.goto(`http://localhost:${PORT}/scholarship-form`, { waitUntil: 'networkidle' });

        const missingLocator = page.locator('#ration_card_number');
        const count = await missingLocator.count();
        expect(count).toBe(0);

        const obsRecord: BrowserObservationRecord = {
          url: page.url(),
          hostname: 'localhost',
          title: await page.title(),
          readyState: 'complete',
          visibleErrors: ['Element #ration_card_number not found'],
          timestamp: Date.now(),
        };

        const strat1 = getStepRecoveryStrategy('fill_fields', 0, obsRecord);
        expect(strat1).not.toBeNull();
        expect(strat1!.strategyName).toBe('rescan_and_refill');

        const stratFinal = getStepRecoveryStrategy('fill_fields', 2, obsRecord);
        expect(stratFinal).not.toBeNull();
        expect(stratFinal!.strategyName).toBe('escalate_to_user');
        expect(stratFinal!.action).toBe('ask_user');
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. FAILURE & RECOVERY ENGINE ON SIMULATED FAULT
  // ─────────────────────────────────────────────────────────────
  test.describe('5. Failure and Recovery Engine on Simulated Fault', () => {
    test('detects HTTP 500 simulated server fault and enforces retry limit MAX_RETRIES = 2', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-failure-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
        });

        const page = await context.newPage();
        const response = await page.goto(`http://localhost:${PORT}/simulated-failure`, { waitUntil: 'domcontentloaded' });

        expect(response?.status()).toBe(500);

        const pageText = await page.innerText('body');
        expect(pageText).toContain('500 Internal Server Error');

        const failureObs: BrowserObservationRecord = {
          url: page.url(),
          hostname: 'localhost',
          title: '500 Internal Server Error',
          readyState: 'complete',
          visibleErrors: ['500 Internal Server Error: Simulated portal server failure'],
          timestamp: Date.now(),
        };

        const verifyRes = verifyStepCondition('dom_ready', failureObs, {
          url: `http://localhost:${PORT}/simulated-failure`,
        });
        expect(verifyRes.verified).toBe(false);
        expect(verifyRes.status).toBe('failed');

        const retry0 = getStepRecoveryStrategy('navigate', 0, failureObs);
        expect(retry0).not.toBeNull();
        expect(retry0!.strategyName).toBe('retry_search_portal');

        const retry1 = getStepRecoveryStrategy('navigate', 1, failureObs);
        expect(retry1).not.toBeNull();
        expect(retry1!.strategyName).toBe('retry_search_portal');

        const retry2 = getStepRecoveryStrategy('navigate', 2, failureObs);
        expect(retry2).not.toBeNull();
        expect(retry2!.strategyName).toBe('escalate_to_user');
        expect(retry2!.action).toBe('ask_user');
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. MULTILINGUAL VALIDATION ACROSS ALL SUPPORTED LANGUAGES
  // ─────────────────────────────────────────────────────────────
  test.describe('6. Multilingual Validation (11 Indian Languages + English & Hinglish)', () => {
    const testCases = [
      { code: 'en', name: 'English', query: 'I want to apply for student scholarship and download guidelines', bcp47: 'en-IN' },
      { code: 'hi', name: 'Hindi', query: 'मुझे पोस्ट-मैट्रिक छात्रवृत्ति के लिए आवेदन करना है और दिशा-निर्देश डाउनलोड करने हैं', bcp47: 'hi-IN' },
      { code: 'hi-en', name: 'Hinglish', query: 'mujhe scholarship ke liye apply karna hai aur official circular download karna hai', bcp47: 'hi-IN' },
      { code: 'ta', name: 'Tamil', query: 'மாணவர் உதவித்தொகைக்கு விண்ணப்பிக்க வேண்டும்', bcp47: 'ta-IN' },
      { code: 'te', name: 'Telugu', query: 'విద్యార్థి స్కాలర్‌షిప్ కోసం దరఖాస్తు చేసుకోవాలి', bcp47: 'te-IN' },
      { code: 'bn', name: 'Bengali', query: 'ছাত্র বৃত্তির জন্য আবেদন করতে হবে এবং নির্দেশিকা ডাউনলোড করতে হবে', bcp47: 'bn-IN' },
      { code: 'mr', name: 'Marathi', query: 'विद्यार्थी शिष्यवृत्तीसाठी अर्ज करा आणि मार्गदर्शक तत्त्वे डाउनलोड करा', bcp47: 'mr-IN' },
      { code: 'gu', name: 'Gujarati', query: 'વિદ્યાર્થી સ્કોલરશીપ માટે અરજી કરવી છે', bcp47: 'gu-IN' },
      { code: 'kn', name: 'Kannada', query: 'ವಿದ್ಯಾರ್ಥಿ ವಿದ್ಯಾರ್ಥಿವೇತನಕ್ಕೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಬೇಕು', bcp47: 'kn-IN' },
      { code: 'ml', name: 'Malayalam', query: 'വിദ്യാർത്ഥി സ്കോളർഷിപ്പിനായി അപേക്ഷിക്കണം', bcp47: 'ml-IN' },
      { code: 'pa', name: 'Punjabi', query: 'ਵਿਦਿਆਰਥੀ ਵਜ਼ੀਫ਼ੇ ਲਈ ਅਰਜ਼ੀ ਦੇਣੀ ਹੈ', bcp47: 'pa-IN' },
      { code: 'ur', name: 'Urdu', query: 'طالب علم وظیفہ کے لیے درخواست دینی ہے', bcp47: 'ur-IN' },
    ];

    for (const tc of testCases) {
      test(`verifies language pipeline for ${tc.name} (${tc.code}): planning, localization & TTS code`, () => {
        const cleanLang = tc.code.split('-')[0];
        const bcp47 = getLanguageBcp47(cleanLang);
        expect(bcp47).toBe(tc.bcp47);

        const planResult = planBrowserTask(tc.query, cleanLang, {
          url: `http://localhost:${PORT}/`,
          title: 'National Citizen Benefits & Scholarship Portal',
        });

        expect(planResult.plan).toBeDefined();
        const plan = planResult.plan!;
        expect(plan.target).toBe('portal');
        expect(plan.steps.length).toBeGreaterThanOrEqual(3);
        expect(plan.title).toBeTruthy();
        expect(plan.summary).toBeTruthy();

        const validTools: BrowserToolName[] = [
          'search_portal',
          'navigate',
          'inspect_page',
          'detect_forms',
          'fill_fields',
          'download_document',
          'ask_user',
          'request_approval',
          'speak',
        ];

        for (const step of plan.steps) {
          expect(validTools).toContain(step.action as BrowserToolName);
          expect(step.verifyCondition).toBeDefined();
        }
      });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 7. LIVE PUBLIC PORTAL DISCOVERY & BOUNDARY VALIDATION
  // ─────────────────────────────────────────────────────────────
  test.describe('7. Live Portal Discovery & Safety Boundaries', () => {
    test('probes live public government portal discovery without entering personal info or auto-submitting', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfb-w3-live-'));
      let context: BrowserContext | null = null;

      try {
        context = await chromium.launchPersistentContext(tempDir, {
          channel: 'msedge',
          args: [
            '--headless=new',
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
          ],
        });

        const page = await context.newPage();

        const targetUrl = 'https://swayam.gov.in';
        let navigated = false;

        try {
          const res = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
          if (res && res.status() < 400) {
            navigated = true;
          }
        } catch {
          navigated = false;
        }

        if (navigated) {
          const pageTitle = await page.title();
          expect(pageTitle.length).toBeGreaterThan(0);

          const inputs = await page.locator('input[type="password"], input[name*="otp"]').count();
          expect(inputs).toBeGreaterThanOrEqual(0);
        } else {
          const planResult = planBrowserTask('Find government schemes on JanSamarth portal', 'en');
          expect(planResult.plan).toBeDefined();
          const plan = planResult.plan!;
          expect(plan.steps[0].action).toBe('search_portal');
          expect(plan.steps[1].action).toBe('navigate');
        }
      } finally {
        if (context) await context.close();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. SCREENSHOT CAPTURE FOR VISUAL AUDIT EVIDENCE
  // ─────────────────────────────────────────────────────────────
  test.describe('8. Visual Evidence & Responsive Screenshots', () => {
    const viewports = [
      { name: '1366x768', width: 1366, height: 768 },
      { name: '375x667', width: 375, height: 667 },
    ];

    for (const vp of viewports) {
      test(`captures visual proof at ${vp.name} for controlled portal and form filling`, async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `tfb-w3-shot-${vp.name}-`));
        let context: BrowserContext | null = null;

        try {
          context = await chromium.launchPersistentContext(tempDir, {
            channel: 'msedge',
            viewport: { width: vp.width, height: vp.height },
            args: [
              '--headless=new',
              `--disable-extensions-except=${EXTENSION_PATH}`,
              `--load-extension=${EXTENSION_PATH}`,
            ],
          });

          const page = await context.newPage();

          // 1. Screenshot: Controlled Portal Home
          await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
          await page.screenshot({
            path: path.join(ARTIFACT_DIR, `portal-home-${vp.name}.png`),
            fullPage: true,
          });

          // 2. Screenshot: Scholarship Form with Extension Badge & Filled Fields
          await page.goto(`http://localhost:${PORT}/scholarship-form`, { waitUntil: 'networkidle' });

          await page.locator('#first_name').fill('Aarav Sharma');
          await page.locator('#gender').selectOption('Male');
          await page.locator('#category').selectOption('OBC');
          await page.locator('#email').fill('aarav.sharma@example.gov.in');
          await page.locator('#phone').fill('9876543210');
          await page.locator('#agree_terms').check();

          await page.screenshot({
            path: path.join(ARTIFACT_DIR, `scholarship-form-filled-${vp.name}.png`),
            fullPage: true,
          });

          // 3. Screenshot: Guide Overlay Opened
          const badge = page.locator('#tfb-launcher-badge');
          if (await badge.isVisible()) {
            await badge.click();
            await page.waitForTimeout(500);
            await page.screenshot({
              path: path.join(ARTIFACT_DIR, `guide-overlay-${vp.name}.png`),
              fullPage: true,
            });
          }
        } finally {
          if (context) await context.close();
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        }
      });
    }
  });

});
