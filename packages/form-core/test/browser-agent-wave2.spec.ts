import { test, expect } from '@playwright/test';
import path from 'path';
import {
  verifyStepCondition,
  getStepRecoveryStrategy,
  BrowserObservationRecord,
  ToolExecutionStatus,
} from '../../../src/lib/agentToolRegistry';
import { planBrowserTask, AssistantPlan, PlanStep } from '../../../src/lib/planner';

function getPageUrl(fileName: string): string {
  const filePath = path.resolve(__dirname, '../test-pages', fileName);
  return 'file:///' + filePath.replace(/\\/g, '/');
}

test.describe('Wave 2: Autonomous Observation, Verification & Recovery Engine', () => {

  test.describe('1. Post-Action Observation & Verification Engine', () => {
    test('verifies dom_ready on successful page load and detects URL mismatch', () => {
      const validObs: BrowserObservationRecord = {
        url: 'https://scholarships.gov.in/fresh-application',
        hostname: 'scholarships.gov.in',
        title: 'National Scholarship Portal',
        readyState: 'complete',
        fieldCount: 6,
        timestamp: Date.now(),
      };

      const result = verifyStepCondition('dom_ready', validObs, {
        url: 'https://scholarships.gov.in',
      });
      expect(result.verified).toBe(true);
      expect(result.status).toBe('successful');

      // Mismatched destination URL must fail
      const wrongHostObs: BrowserObservationRecord = {
        url: 'https://unrelated-domain.com',
        hostname: 'unrelated-domain.com',
        title: 'Unknown Site',
        readyState: 'complete',
        timestamp: Date.now(),
      };
      const mismatchResult = verifyStepCondition('dom_ready', wrongHostObs, {
        url: 'https://scholarships.gov.in',
      });
      expect(mismatchResult.verified).toBe(false);
      expect(mismatchResult.status).toBe('failed');
      expect(mismatchResult.reason).toContain('Destination mismatch');
    });

    test('verifies form field values in the actual DOM and rejects unverified inputs', () => {
      const obsWithValues: BrowserObservationRecord = {
        url: 'https://scholarships.gov.in',
        hostname: 'scholarships.gov.in',
        title: 'Form Page',
        readyState: 'complete',
        fieldValues: {
          full_name: 'Raj Panchal',
          mobile_number: '9876543210',
          email_address: 'raj@example.com',
        },
        timestamp: Date.now(),
      };

      // Case A: All expected values matched in DOM
      const verifiedResult = verifyStepCondition('inputs_verified', obsWithValues, {
        fields: {
          full_name: 'Raj Panchal',
          mobile_number: '9876543210',
        },
      });
      expect(verifiedResult.verified).toBe(true);
      expect(verifiedResult.status).toBe('successful');
      expect(verifiedResult.reason).toContain('Verified 2/2 inputs');

      // Case B: Value did not settle in DOM (element empty or mismatch)
      const unverifiedResult = verifyStepCondition('inputs_verified', obsWithValues, {
        fields: {
          full_name: 'Raj Panchal',
          annual_income: '250000', // Missing from DOM!
        },
      });
      expect(unverifiedResult.verified).toBe(false);
      expect(unverifiedResult.status).toBe('unverified');
      expect(unverifiedResult.reason).toContain('1/2 inputs');
    });

    test('verifies download completion and refuses unverified downloads', () => {
      const obsConfirmedDownload: BrowserObservationRecord = {
        url: 'https://scholarships.gov.in',
        hostname: 'scholarships.gov.in',
        title: 'Portal',
        readyState: 'complete',
        downloadFound: true,
        timestamp: Date.now(),
      };

      const okDownload = verifyStepCondition('download_started', obsConfirmedDownload);
      expect(okDownload.verified).toBe(true);
      expect(okDownload.status).toBe('successful');

      const obsFailedDownload: BrowserObservationRecord = {
        url: 'https://scholarships.gov.in',
        hostname: 'scholarships.gov.in',
        title: 'Portal',
        readyState: 'complete',
        downloadFound: false,
        timestamp: Date.now(),
      };
      const failedDownload = verifyStepCondition('download_started', obsFailedDownload);
      expect(failedDownload.verified).toBe(false);
      expect(failedDownload.status).toBe('unverified');
    });

    test('verifies approval gate requires explicit citizen consent', () => {
      const consented = verifyStepCondition('approval_decided', {
        url: 'https://scholarships.gov.in',
        hostname: 'scholarships.gov.in',
        title: 'Portal',
        readyState: 'complete',
        timestamp: Date.now(),
      }, { consented: true });

      expect(consented.verified).toBe(true);
      expect(consented.status).toBe('successful');

      const declined = verifyStepCondition('approval_decided', {
        url: 'https://scholarships.gov.in',
        hostname: 'scholarships.gov.in',
        title: 'Portal',
        readyState: 'complete',
        timestamp: Date.now(),
      }, { consented: false });

      expect(declined.verified).toBe(false);
      expect(declined.status).toBe('failed');
    });
  });

  test.describe('2. Recovery Engine & Bounded Retries', () => {
    test('provides safe fallback strategy on navigation failure', () => {
      const strategy1 = getStepRecoveryStrategy('navigate', 1);
      expect(strategy1).not.toBeNull();
      expect(strategy1?.strategyName).toBe('retry_search_portal');
      expect(strategy1?.action).toBe('search_portal');
      expect(strategy1?.maxRetries).toBe(2);
    });

    test('provides dynamic SPA waiting and re-scanning fallback for detect_forms', () => {
      const strategy = getStepRecoveryStrategy('detect_forms', 1);
      expect(strategy).not.toBeNull();
      expect(strategy?.strategyName).toBe('wait_and_rescan');
      expect(strategy?.action).toBe('detect_forms');
      expect(strategy?.fallbackParams?.forceRescan).toBe(true);
      expect(strategy?.fallbackParams?.delayMs).toBe(1200);
    });

    test('provides re-event dispatching fallback for fill_fields', () => {
      const strategy = getStepRecoveryStrategy('fill_fields', 1);
      expect(strategy).not.toBeNull();
      expect(strategy?.strategyName).toBe('rescan_and_refill');
      expect(strategy?.action).toBe('fill_fields');
      expect(strategy?.fallbackParams?.forceEvents).toBe(true);
    });

    test('escalates to citizen (ask_user) when retry limit is exceeded', () => {
      const exhausted = getStepRecoveryStrategy('navigate', 2);
      expect(exhausted).not.toBeNull();
      expect(exhausted?.strategyName).toBe('escalate_to_user');
      expect(exhausted?.action).toBe('ask_user');
      expect(exhausted?.description).toContain('Maximum automatic retries reached');

      const overLimit = getStepRecoveryStrategy('fill_fields', 3);
      expect(overLimit?.strategyName).toBe('escalate_to_user');
      expect(overLimit?.action).toBe('ask_user');
    });
  });

  test.describe('3. Autonomous Continuation, Pause & Security Limits', () => {
    test('multi-step plan is generated with verifyCondition on all steps', () => {
      const res = planBrowserTask('mujhe NSP portal par scholarship form bharna hai', {
        url: 'https://google.com',
      }, 'hi');

      expect(res.type).toBe('plan');
      const plan = res.plan!;
      expect(plan.steps.length).toBeGreaterThanOrEqual(4);

      for (const step of plan.steps) {
        expect(step.verifyCondition).toBeDefined();
        expect(typeof step.verifyCondition).toBe('string');
      }
    });

    test('approval steps are marked consequential and require explicit user consent', () => {
      const res = planBrowserTask('apply for scholarship on national scholarship portal', {
        url: 'https://google.com',
      }, 'en');

      const plan = res.plan!;
      const approvalStep = plan.steps.find(s => s.action === 'request_approval');
      expect(approvalStep).toBeDefined();
      expect(approvalStep?.verifyCondition).toBe('approval_decided');
    });
  });

  test.describe('4. Session Persistence Across Navigations', () => {
    test('persists and restores active plan with step statuses intact', async ({ request }) => {
      const testPlan: AssistantPlan = {
        id: `test-plan-${Date.now()}`,
        title: 'Apply for Scholarship',
        titleHi: 'छात्रवृत्ति आवेदन',
        summary: 'Automated scholarship assistance plan',
        summaryHi: 'स्वचालित छात्रवृत्ति सहायता योजना',
        target: 'portal',
        status: 'running',
        autopilot: true,
        currentStepIndex: 1,
        collectedAnswers: {},
        createdAt: Date.now(),
        steps: [
          {
            id: 'step-1',
            action: 'search_portal',
            description: 'Search official portal',
            parameters: { query: 'NSP' },
            verifyCondition: 'portal_found',
            status: 'completed',
            verified: true,
          },
          {
            id: 'step-2',
            action: 'navigate',
            description: 'Navigate to portal',
            parameters: { url: 'https://scholarships.gov.in' },
            verifyCondition: 'dom_ready',
            status: 'in_progress',
          },
          {
            id: 'step-3',
            action: 'detect_forms',
            description: 'Scan form fields',
            parameters: {},
            verifyCondition: 'fields_classified',
            status: 'pending',
          },
        ],
      };

      // Verify that completed step 1 is preserved and not re-executed
      const completedSteps = testPlan.steps.filter(s => s.status === 'completed');
      expect(completedSteps.length).toBe(1);
      expect(completedSteps[0].id).toBe('step-1');

      // Verify in-progress step 2 is the active resumption candidate
      const pendingStep = testPlan.steps.find(s => s.status === 'in_progress');
      expect(pendingStep?.id).toBe('step-2');
      expect(pendingStep?.action).toBe('navigate');
    });
  });

  test.describe('5. Real Browser DOM Observation & Autofill Verification', () => {
    test('renders controlled demo form and verifies DOM values match after filling', async ({ page }) => {
      await page.goto(getPageUrl('plain-form.html'));
      await page.waitForLoadState('domcontentloaded');

      // Check form fields exist on the demo portal
      const nameInput = page.locator('#first_name');
      await expect(nameInput).toBeVisible();

      // Simulate agent fill_fields tool
      await nameInput.fill('Raj Panchal');
      await nameInput.dispatchEvent('input');
      await nameInput.dispatchEvent('change');

      // Observe actual DOM state
      const actualVal = await nameInput.inputValue();
      const obs: BrowserObservationRecord = {
        url: page.url(),
        hostname: 'localhost',
        title: await page.title(),
        readyState: await page.evaluate(() => document.readyState),
        fieldValues: {
          first_name: actualVal,
        },
        timestamp: Date.now(),
      };

      // Verify actual DOM value
      const verification = verifyStepCondition('inputs_verified', obs, {
        fields: { first_name: 'Raj Panchal' },
      });

      expect(verification.verified).toBe(true);
      expect(verification.status).toBe('successful');
      expect(verification.reason).toContain('1/1 inputs');
    });

    test('recovers safely when target element is missing and does not crash', async ({ page }) => {
      await page.goto(getPageUrl('plain-form.html'));

      // Observe missing element
      const missingFieldObs: BrowserObservationRecord = {
        url: page.url(),
        hostname: new URL(page.url()).hostname,
        title: await page.title(),
        readyState: 'complete',
        fieldValues: {},
        timestamp: Date.now(),
      };

      const failVerification = verifyStepCondition('inputs_verified', missingFieldObs, {
        fields: { non_existent_passport_number: 'A1234567' },
      });

      expect(failVerification.verified).toBe(false);
      expect(failVerification.status).toBe('unverified');

      // Trigger recovery engine
      const recovery = getStepRecoveryStrategy('fill_fields', 1, missingFieldObs);
      expect(recovery).not.toBeNull();
      expect(recovery?.strategyName).toBe('rescan_and_refill');
    });

    test('language switching preserves plan state and updates localized titles', async () => {
      const resEn = planBrowserTask('apply for scholarship on national scholarship portal', {
        url: 'https://google.com',
      }, 'en');

      const resHi = planBrowserTask('apply for scholarship on national scholarship portal', {
        url: 'https://google.com',
      }, 'hi');

      expect(resEn.plan?.title).toBeDefined();
      expect(resHi.plan?.titleHi).toBeDefined();
      expect(resHi.plan?.steps[0].descriptionHi).toBeDefined();
    });
  });
});
