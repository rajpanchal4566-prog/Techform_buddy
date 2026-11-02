import { test, expect } from '@playwright/test';
import {
  BROWSER_TOOL_REGISTRY,
  validateToolParams,
  createExecutionResult,
  normalizeToolName,
  BrowserToolName,
} from '../../../src/lib/agentToolRegistry';
import { planBrowserTask, checkSafetyLimits } from '../../../src/lib/planner';

test.describe('Wave 1: Browser Agent Core & Protocol', () => {

  test.describe('1. Validated Tool Registry & Schemas', () => {
    test('all 9 core tools are registered with schemas', () => {
      const expectedTools: BrowserToolName[] = [
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

      for (const toolName of expectedTools) {
        const schema = BROWSER_TOOL_REGISTRY[toolName];
        expect(schema, `Schema for ${toolName} should exist`).toBeDefined();
        expect(schema.name).toBe(toolName);
        expect(typeof schema.description).toBe('string');
        expect(typeof schema.parameters).toBe('object');
        expect(typeof schema.isReadOnly).toBe('boolean');
        expect(typeof schema.isConsequential).toBe('boolean');
        expect(typeof schema.defaultVerifyCondition).toBe('string');
      }
    });

    test('validates required parameters for tools', () => {
      // search_portal requires 'query'
      expect(validateToolParams('search_portal', {}).valid).toBe(false);
      expect(validateToolParams('search_portal', { query: 'NSP scholarship' }).valid).toBe(true);

      // ask_user requires 'question'
      expect(validateToolParams('ask_user', {}).valid).toBe(false);
      expect(validateToolParams('ask_user', { question: 'What is your annual income?' }).valid).toBe(true);

      // request_approval requires 'actionDescription' and 'targetAction'
      expect(validateToolParams('request_approval', {}).valid).toBe(false);
      expect(validateToolParams('request_approval', { actionDescription: 'Review form' }).valid).toBe(false);
      expect(validateToolParams('request_approval', {
        actionDescription: 'Review form before manual submit',
        targetAction: 'manual_submit',
      }).valid).toBe(true);

      // speak requires 'text'
      expect(validateToolParams('speak', {}).valid).toBe(false);
      expect(validateToolParams('speak', { text: 'Hello' }).valid).toBe(true);
    });

    test('rejects unknown tools and invalid parameter types', () => {
      expect(validateToolParams('non_existent_tool' as any, {}).valid).toBe(false);
      expect(validateToolParams('search_portal', { query: 12345 as any }).valid).toBe(false);
      expect(validateToolParams('fill_fields', { autofillAll: 'not_a_boolean' as any }).valid).toBe(false);
    });

    test('normalizes legacy tool aliases', () => {
      expect(normalizeToolName('fill')).toBe('fill_fields');
      expect(normalizeToolName('download')).toBe('download_document');
      expect(normalizeToolName('read_snapshot')).toBe('inspect_page');
      expect(validateToolParams('fill', { autofillAll: true }).valid).toBe(true);
      expect(validateToolParams('download', { filename: 'form.pdf' }).valid).toBe(true);
    });
  });

  test.describe('2. Structured ToolExecutionResult Protocol', () => {
    test('createExecutionResult generates valid status contract', () => {
      const successful = createExecutionResult(
        'search_portal',
        'successful',
        'Found official portal',
        {
          messageHi: 'आधिकारिक पोर्टल मिला',
          data: { url: 'https://scholarships.gov.in' },
          verification: { verified: true, condition: 'portal_found' },
        }
      );

      expect(successful.toolName).toBe('search_portal');
      expect(successful.status).toBe('successful');
      expect(successful.message).toContain('Found official portal');
      expect(successful.messageHi).toContain('आधिकारिक पोर्टल');
      expect(successful.verification?.verified).toBe(true);
      expect(successful.timestamp).toBeGreaterThan(0);

      const attempted = createExecutionResult(
        'navigate',
        'attempted',
        'Navigating to target URL...',
        {
          verification: { verified: false, condition: 'dom_ready' },
        }
      );
      expect(attempted.status).toBe('attempted');
      expect(attempted.verification?.verified).toBe(false);

      const unverified = createExecutionResult(
        'search_portal',
        'unverified',
        'Search query returned zero matches',
        {
          verification: { verified: false, condition: 'portal_found' },
          recoveryAdvice: 'Try with exact portal keywords.',
        }
      );
      expect(unverified.status).toBe('unverified');
      expect(unverified.recoveryAdvice).toBeDefined();

      const failed = createExecutionResult(
        'fill_fields',
        'failed',
        'No fillable form fields found',
        { error: 'NO_FIELDS' }
      );
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('NO_FIELDS');
    });
  });

  test.describe('3. Multi-Step NLU Browser Task Planning', () => {
    test('plans complete multi-step lifecycle for scholarship goal (English)', () => {
      const planResult = planBrowserTask('I want to apply for scholarship on national scholarship portal', {
        url: 'https://google.com',
      }, 'en');

      expect(planResult).toBeDefined();
      expect(planResult?.type).toBe('plan');
      expect(planResult?.plan).toBeDefined();
      expect(planResult?.confidence).toBeGreaterThan(0.9);

      const plan = planResult!.plan!;
      expect(plan.steps.length).toBeGreaterThanOrEqual(4);

      // Verify sequence: search -> navigate -> detect -> fill -> review
      const actions = plan.steps.map(s => s.action);
      expect(actions).toContain('search_portal');
      expect(actions).toContain('navigate');
      expect(actions).toContain('detect_forms');
      expect(actions).toContain('fill_fields');
      expect(actions).toContain('request_approval');

      // Verify each step has expectedResult and verifyCondition for Wave 2
      for (const step of plan.steps) {
        expect(step.expectedResult).toBeDefined();
        expect(step.verifyCondition).toBeDefined();
        expect(step.status).toBe('pending');
      }
    });

    test('plans complete multi-step lifecycle for scholarship goal (Hindi / Hinglish)', () => {
      const planResult = planBrowserTask('mujhe NSP portal par scholarship form bharna hai', {
        url: 'https://google.com',
      }, 'hi');

      expect(planResult).toBeDefined();
      expect(planResult?.type).toBe('plan');
      const plan = planResult!.plan!;

      expect(plan.titleHi).toBeDefined();
      expect(plan.summaryHi).toBeDefined();
      expect(plan.steps.length).toBeGreaterThanOrEqual(4);

      for (const step of plan.steps) {
        expect(step.descriptionHi).toBeDefined();
        expect(step.expectedResultHi).toBeDefined();
      }
    });

    test('plans form autofill on current page if form is detected', () => {
      const planResult = planBrowserTask('fill this form using my profile data', {
        url: 'https://scholarships.gov.in/fresh-application',
        formFieldsCount: 8,
        hasFillValues: true,
      }, 'en');

      expect(planResult).toBeDefined();
      expect(planResult?.type).toBe('plan');
      const actions = planResult!.plan!.steps.map(s => s.action);
      expect(actions).toContain('detect_forms');
      expect(actions).toContain('fill_fields');
      expect(actions).toContain('request_approval');
    });

    test('plans document download when user asks to download official form', () => {
      const planResult = planBrowserTask('download scholarship guideline pdf', {
        url: 'https://scholarships.gov.in',
      }, 'en');

      expect(planResult).toBeDefined();
      expect(planResult?.type).toBe('plan');
      const actions = planResult!.plan!.steps.map(s => s.action);
      expect(actions).toContain('inspect_page');
      expect(actions).toContain('download_document');
    });
  });

  test.describe('4. Hard Safety Limits & Autonomous Boundaries', () => {
    test('strictly refuses auto-submit requests', () => {
      const safety = checkSafetyLimits('submit this form automatically and pay fee');
      expect(safety).not.toBeNull();
      expect(safety?.isForbidden).toBe(true);
      expect(safety?.reason.toLowerCase()).toContain('never submit');
    });

    test('strictly refuses password or OTP requests', () => {
      const safetyOtp = checkSafetyLimits('enter my OTP 123456');
      expect(safetyOtp).not.toBeNull();
      expect(safetyOtp?.isForbidden).toBe(true);

      const safetyPass = checkSafetyLimits('save and fill my banking password');
      expect(safetyPass).not.toBeNull();
      expect(safetyPass?.isForbidden).toBe(true);
    });

    test('browser planning never includes auto-submit actions', () => {
      const planResult = planBrowserTask('submit form and pay fee', {}, 'en');
      // Either blocked or returned refusal plan
      if (planResult?.plan) {
        const actions = planResult.plan.steps.map(s => s.action);
        expect(actions).not.toContain('submit');
        expect(actions).not.toContain('pay');
      }
    });
  });

  test.describe('5. Live API Integration (/api/assistant/chat)', () => {
    test('returns structured plan directly to browser extension', async ({ request }) => {
      const response = await request.post('/api/assistant/chat', {
        data: {
          messages: [{ role: 'user', content: 'I want to apply for scholarship on national scholarship portal' }],
          language: 'en',
        },
      });

      expect(response.ok()).toBe(true);
      const json = await response.json();
      expect(json.type).toBe('plan');
      expect(json.plan).toBeDefined();
      expect(json.plan.steps.length).toBeGreaterThanOrEqual(4);
      expect(json.proposedTool).toBeDefined();
      expect(json.proposedTool.name).toBe('search_portal');
      expect(json.proposedTool.args.query).toContain('Scholarship');
    });

    test('returns Hindi plan with Hindi descriptions when requested in Hindi', async ({ request }) => {
      const response = await request.post('/api/assistant/chat', {
        data: {
          messages: [{ role: 'user', content: 'mujhe NSP portal par scholarship form bharna hai' }],
          language: 'hi',
        },
      });

      expect(response.ok()).toBe(true);
      const json = await response.json();
      expect(json.type).toBe('plan');
      expect(json.plan).toBeDefined();
      expect(json.plan.titleHi).toBeDefined();
      expect(json.reply).toBeDefined();
    });
  });
});
