import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BUNDLE_PATH = path.resolve(__dirname, '../dist/form-core.iife.js');

function getPageUrl(fileName: string): string {
  const filePath = path.resolve(__dirname, '../test-pages', fileName);
  return 'file:///' + filePath.replace(/\\/g, '/');
}

test.describe('Form Core Library - Phase 1 Verification', () => {

  test.beforeAll(() => {
    expect(fs.existsSync(BUNDLE_PATH)).toBeTruthy();
  });

  test('Plain HTML Form: readForm() scans fields, sections, shadow DOM, iframe and enforces Hard Rules', async ({ page }) => {
    await page.goto(getPageUrl('plain-form.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    // Execute readForm in page context
    const schema = await page.evaluate(() => {
      return (window as any).TechFormBuddyCore.readForm();
    });

    expect(schema).toBeDefined();
    expect(schema.fields.length).toBeGreaterThan(0);

    const fieldMap = new Map<string, any>(schema.fields.map((f: any) => [f.id, f]));

    // 1. Standard Fields Check
    expect(fieldMap.has('first_name')).toBeTruthy();
    const fn = fieldMap.get('first_name');
    expect(fn.type).toBe('text');
    expect(fn.required).toBe(true);
    expect(fn.section).toBe('Applicant Particulars'); // extracted from fieldset legend

    expect(fieldMap.has('dob')).toBeTruthy();
    expect(fieldMap.get('dob').type).toBe('date');

    // 2. Radio Group (Gender)
    expect(fieldMap.has('gender')).toBeTruthy();
    const genderField = fieldMap.get('gender');
    expect(genderField.type).toBe('radio');
    expect(genderField.options?.length).toBe(3);
    expect(genderField.options?.map((o: any) => o.value)).toEqual(['male', 'female', 'other']);

    // 3. Select Dropdown (State)
    expect(fieldMap.has('state_select')).toBeTruthy();
    const stateField = fieldMap.get('state_select');
    expect(stateField.type).toBe('select');
    expect(stateField.options?.length).toBe(6); // 1 placeholder + 5 states

    // 4. Section headings check
    const emailField = fieldMap.get('email_address');
    expect(emailField.section).toBe('Contact Information');

    // 5. HARD RULE 2 & 3: Excluded fields MUST NOT be present in schema
    const allIds = schema.fields.map((f: any) => f.id.toLowerCase());
    const allTypes = schema.fields.map((f: any) => f.type.toLowerCase());

    // Password must be skipped
    expect(allIds.includes('portal_password')).toBeFalsy();
    expect(allTypes.includes('password')).toBeFalsy();

    // Captcha must be skipped
    expect(allIds.includes('captcha_input')).toBeFalsy();

    // Hidden CSRF must be skipped
    expect(allIds.includes('csrf_token')).toBeFalsy();

    // Submit button must be skipped
    expect(allIds.includes('submit_button')).toBeFalsy();

    // 6. File Upload: MUST return manual: true
    expect(fieldMap.has('id_proof')).toBeTruthy();
    const fileField = fieldMap.get('id_proof');
    expect(fileField.type).toBe('file');
    expect(fileField.manual).toBe(true);

    // 7. HARD RULE 4: Sensitive fields MUST return sensitive: true, manual: true
    expect(fieldMap.has('aadhaar_input')).toBeTruthy();
    const aadhaarField = fieldMap.get('aadhaar_input');
    expect(aadhaarField.sensitive).toBe(true);
    expect(aadhaarField.manual).toBe(true);

    expect(fieldMap.has('pan_input')).toBeTruthy();
    const panField = fieldMap.get('pan_input');
    expect(panField.sensitive).toBe(true);
    expect(panField.manual).toBe(true);

    // 8. Open Shadow DOM field traversal
    const shadowField = schema.fields.find((f: any) => f.id === 'shadow_field');
    expect(shadowField).toBeDefined();

    // 9. Same-origin iframe field traversal
    const iframeField = schema.fields.find((f: any) => f.id === 'iframe_field');
    expect(iframeField).toBeDefined();
  });

  test('Plain HTML Form: applyFill() populates inputs, handles select/radio/checkbox/dates and enforces outline highlights', async ({ page }) => {
    await page.goto(getPageUrl('plain-form.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    const fillResult = await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();

      const mapping: Record<string, string> = {
        first_name: 'firstName',
        last_name: 'lastName',
        dob: 'birthDate',
        gender: 'gender',
        email_address: 'email',
        phone_number: 'mobile',
        state_select: 'state',
        residential_address: 'address',
        subscribe_updates: 'subscribe',
        id_proof: 'resume', // file input: should be marked manual
        aadhaar_input: 'aadhaar', // sensitive input: should be marked manual
      };

      const values: Record<string, string> = {
        firstName: 'Vikram',
        lastName: 'Singhania',
        birthDate: '15/08/1990', // formatted automatically to 1990-08-15
        gender: 'female',
        email: 'vikram.singhania@example.com',
        mobile: '+91 9876543210',
        state: 'Maharashtra', // fuzzy matched to value 'MH'
        address: '42 Marine Drive, Mumbai 400020',
        subscribe: 'yes',
        resume: 'C:/docs/id.pdf',
        aadhaar: '1234-5678-9012',
      };

      return core.applyFill(mapping, values, schema.fields);
    });

    expect(fillResult.success).toBe(true);
    expect(fillResult.filledCount).toBe(9); // 9 fields: firstName, lastName, dob, gender, email, phone, state, address, subscribe
    expect(fillResult.manualCount).toBe(2); // id_proof (file) and aadhaar_input (sensitive)

    // Verify DOM values and outline highlight
    const fnVal = await page.inputValue('#first_name');
    expect(fnVal).toBe('Vikram');

    const fnOutline = await page.$eval('#first_name', (el: any) => el.style.outline);
    expect(fnOutline).toContain('rgb(34, 197, 94)'); // #22c55e in rgb

    const dobVal = await page.inputValue('#dob');
    expect(dobVal).toBe('1990-08-15');

    const stateVal = await page.inputValue('#state_select');
    expect(stateVal).toBe('MH'); // fuzzy matched Maharashtra to MH

    const femaleRadioChecked = await page.$eval('input[value="female"]', (el: any) => el.checked);
    expect(femaleRadioChecked).toBe(true);

    const subscribeChecked = await page.$eval('#subscribe_updates', (el: any) => el.checked);
    expect(subscribeChecked).toBe(true);

    // Verify sensitive field was NOT filled (Hard Rule 4)
    const aadhaarVal = await page.inputValue('#aadhaar_input');
    expect(aadhaarVal).toBe('');
  });

  test('React Form: applyFill() works on controlled inputs using native setter and synchronizes React state', async ({ page }) => {
    await page.goto(getPageUrl('react-form.html'));
    await page.waitForSelector('#react-form');
    await page.addScriptTag({ path: BUNDLE_PATH });

    const fillResult = await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();

      const mapping: Record<string, string> = {
        'react-name': 'fullName',
        'react-email': 'email',
        'react-occupation': 'role',
        'react-agree': 'agree',
      };

      const values: Record<string, string> = {
        fullName: 'Devika Sharma',
        email: 'devika.sharma@techcorp.in',
        role: 'doctor', // matches Medical Doctor
        agree: 'true',
      };

      return core.applyFill(mapping, values, schema.fields);
    });

    expect(fillResult.success).toBe(true);
    expect(fillResult.filledCount).toBe(4);

    // Verify that React state updated in the live state preview box
    const namePreview = await page.textContent('#state-preview-name');
    expect(namePreview).toContain('Devika Sharma');

    const emailPreview = await page.textContent('#state-preview-email');
    expect(emailPreview).toContain('devika.sharma@techcorp.in');

    const occPreview = await page.textContent('#state-preview-occupation');
    expect(occPreview).toContain('doctor');

    const agreePreview = await page.textContent('#state-preview-agree');
    expect(agreePreview).toContain('YES');
  });

  test('Multi-Step Form: FormChangeObserver detects DOM mutations and URL hash navigation', async ({ page }) => {
    await page.goto(getPageUrl('multistep-form.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    // Step 1 readForm
    const step1Schema = await page.evaluate(() => {
      return (window as any).TechFormBuddyCore.readForm();
    });
    expect(step1Schema.fields.some((f: any) => f.id === 'step1-fullname')).toBe(true);
    expect(step1Schema.fields.some((f: any) => f.id === 'step2-city')).toBe(false);

    // Setup FormChangeObserver
    await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      (window as any).__observerFiredCount = 0;
      (window as any).__observerReasons = [];

      const observer = new core.FormChangeObserver(50);
      observer.observe((reason: string) => {
        (window as any).__observerFiredCount++;
        (window as any).__observerReasons.push(reason);
      });
      (window as any).__currentObserver = observer;
    });

    // Click Next to navigate to Step 2
    await page.click('#next-to-step2');
    await page.waitForSelector('#step-2');

    // Wait for debounced observer
    await page.waitForTimeout(300);

    const observerInfo = await page.evaluate(() => {
      return {
        count: (window as any).__observerFiredCount,
        reasons: (window as any).__observerReasons,
      };
    });

    expect(observerInfo.count).toBeGreaterThan(0);

    // Re-scan Step 2
    const step2Schema = await page.evaluate(() => {
      return (window as any).TechFormBuddyCore.readForm();
    });

    expect(step2Schema.fields.some((f: any) => f.id === 'step2-city')).toBe(true);
    expect(step2Schema.fields.some((f: any) => f.id === 'step2-pincode')).toBe(true);

    // Test fill on Step 2
    const fillResult = await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();

      const mapping = {
        'step2-city': 'city',
        'step2-pincode': 'pincode',
      };
      const values = {
        city: 'Bengaluru',
        pincode: '560001',
      };
      return core.applyFill(mapping, values, schema.fields);
    });

    expect(fillResult.filledCount).toBe(2);
    expect(await page.inputValue('#step2-city')).toBe('Bengaluru');
    expect(await page.inputValue('#step2-pincode')).toBe('560001');
  });

  test('Bridge Abstraction: MockBridge, ChromeExtensionBridge, and AndroidInAppBrowserBridge meet IBridge interface', async () => {
    // Test in Node context
    const { MockBridge, createBridge, ChromeExtensionBridge, AndroidInAppBrowserBridge } = await import('../src/bridge');

    const mock = new MockBridge();
    let receivedPayload: any = null;

    mock.onMessage((msg) => {
      receivedPayload = msg.payload;
    });

    mock.registerResponseHandler('SCAN_REQUEST', () => {
      return { status: 'scanned', count: 5 };
    });

    const response = await mock.send('SCAN_REQUEST', { url: 'https://example.com' });
    expect(response).toEqual({ status: 'scanned', count: 5 });
    expect(mock.sentMessages.length).toBe(1);

    mock.simulateIncomingMessage('DOM_MUTATED', { step: 2 });
    expect(receivedPayload).toEqual({ step: 2 });

    mock.disconnect();

    // Verify factory creation
    const autoBridge = createBridge('mock');
    expect(autoBridge).toBeInstanceOf(MockBridge);

    const chromeBridge = new ChromeExtensionBridge();
    expect(chromeBridge).toBeDefined();

    const androidBridge = new AndroidInAppBrowserBridge();
    expect(androidBridge).toBeDefined();
  });

  test('Analyzing Layer: accurately detects correct profile placement, rejects mismatched fields, and enforces Hard Rules 4 & 6', async () => {
    const { analyzeField, analyzeForm, generateSafeMapping } = await import('../src/analyzer');

    const availableProfileKeys = [
      'full_name',
      'email',
      'phone',
      'date_of_birth',
      'gender',
      'address',
      'city',
      'state',
      'pincode',
      'father_name',
    ];

    // 1. Correct Match: Full Name
    const fullNameField: any = {
      id: 'applicant_full_name',
      selector: '#applicant_full_name',
      label: 'Full Name of the Applicant',
      type: 'text',
      section: 'Personal Details',
      required: true,
      manual: false,
      sensitive: false,
    };
    const fnResult = analyzeField(fullNameField, availableProfileKeys);
    expect(fnResult.canFill).toBe(true);
    expect(fnResult.profileKey).toBe('full_name');
    expect(fnResult.confidence).toBeGreaterThanOrEqual(0.8);

    // 2. Disqualifier Check: Company/Organization Name MUST NOT match full_name
    const orgField: any = {
      id: 'company_name',
      selector: '#company_name',
      label: 'Company Name / Employer Name',
      type: 'text',
      section: 'Employment',
      required: true,
      manual: false,
      sensitive: false,
    };
    const orgResult = analyzeField(orgField, availableProfileKeys);
    expect(orgResult.canFill).toBe(false);
    expect(orgResult.profileKey).toBeNull(); // Disqualified by negative keyword 'company'/'employer'

    // 3. Disqualifier Check: Father's Name MUST match father_name, NOT applicant full_name
    const fatherField: any = {
      id: 'father_name_input',
      selector: '#father_name_input',
      label: "Father's Name",
      type: 'text',
      section: 'Family Particulars',
      required: true,
      manual: false,
      sensitive: false,
    };
    const fatherResult = analyzeField(fatherField, availableProfileKeys);
    expect(fatherResult.canFill).toBe(true);
    expect(fatherResult.profileKey).toBe('father_name'); // Strict role isolation

    // 4. Disqualifier Check: Date of Issue MUST NOT match date_of_birth
    const issueDateField: any = {
      id: 'doc_issue_date',
      selector: '#doc_issue_date',
      label: 'Date of Issue',
      type: 'date',
      section: 'Document Verification',
      required: true,
      manual: false,
      sensitive: false,
    };
    const issueDateResult = analyzeField(issueDateField, availableProfileKeys);
    expect(issueDateResult.canFill).toBe(false);
    expect(issueDateResult.profileKey).toBeNull(); // Disqualified by negative keyword 'issue'

    // 5. Negative Check: Email Address MUST NOT match physical address
    const emailField: any = {
      id: 'email_address',
      selector: '#email_address',
      label: 'Email Address',
      type: 'email',
      section: 'Contact Info',
      required: true,
      manual: false,
      sensitive: false,
    };
    const emailResult = analyzeField(emailField, availableProfileKeys);
    expect(emailResult.canFill).toBe(true);
    expect(emailResult.profileKey).toBe('email');

    // 6. Hard Rule 4: Sensitive identification/financial fields MUST be manual
    const aadhaarField: any = {
      id: 'aadhaar_num',
      selector: '#aadhaar_num',
      label: 'Aadhaar Number (12 digits)',
      type: 'text',
      section: 'Identity Verification',
      required: true,
      manual: false,
      sensitive: false,
    };
    const aadhaarResult = analyzeField(aadhaarField, availableProfileKeys);
    expect(aadhaarResult.canFill).toBe(false);
    expect(aadhaarResult.sensitive).toBe(true);
    expect(aadhaarResult.manual).toBe(true);
    expect(aadhaarResult.profileKey).toBeNull();
    expect(aadhaarResult.whatToEnter).toContain('Please type this yourself');

    const bankField: any = {
      id: 'bank_account_no',
      selector: '#bank_account_no',
      label: 'Bank Account Number',
      type: 'text',
      section: 'Bank Details',
      required: true,
      manual: false,
      sensitive: false,
    };
    const bankResult = analyzeField(bankField, availableProfileKeys);
    expect(bankResult.canFill).toBe(false);
    expect(bankResult.sensitive).toBe(true);
    expect(bankResult.manual).toBe(true);

    // 7. Hard Rule 6: Ambiguous / unknown field left blank (never guessed)
    const unknownField: any = {
      id: 'survey_khasra_no',
      selector: '#survey_khasra_no',
      label: 'Survey or Khasra Number of Agricultural Land',
      type: 'text',
      section: 'Land Records',
      required: false,
      manual: false,
      sensitive: false,
    };
    const unknownResult = analyzeField(unknownField, availableProfileKeys);
    expect(unknownResult.canFill).toBe(false);
    expect(unknownResult.profileKey).toBeNull();
    expect(unknownResult.confidence).toBeLessThan(0.8);

    // 8. Safe mapping generation test
    const allFields = [fullNameField, orgField, fatherField, issueDateField, emailField, aadhaarField, unknownField];
    const mapping = generateSafeMapping(allFields, availableProfileKeys);

    expect(mapping['applicant_full_name']).toBe('full_name');
    expect(mapping['father_name_input']).toBe('father_name');
    expect(mapping['email_address']).toBe('email');
    expect(mapping['company_name']).toBeUndefined();
    expect(mapping['doc_issue_date']).toBeUndefined();
    expect(mapping['aadhaar_num']).toBeUndefined();
    expect(mapping['survey_khasra_no']).toBeUndefined();
  });

  test('Sensitive-Field Detection: word-boundary matching avoids false-positives (Company, Expand, Panel, Japan) and catches true-positives (Aadhaar, PAN, EPIC, Devanagari)', async ({ page }) => {
    await page.goto(getPageUrl('sensitive-test.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    const schema = await page.evaluate(() => {
      return (window as any).TechFormBuddyCore.readForm();
    });

    const fieldMap = new Map<string, any>(schema.fields.map((f: any) => [f.id, f]));

    // False Positives MUST NOT be flagged
    expect(fieldMap.get('fp_company').sensitive).toBe(false);
    expect(fieldMap.get('fp_expand').sensitive).toBe(false);
    expect(fieldMap.get('fp_panel').sensitive).toBe(false);
    expect(fieldMap.get('fp_japan').sensitive).toBe(false);
    expect(fieldMap.get('fp_pan_asian').sensitive).toBe(false);
    expect(fieldMap.get('fp_cardboard').sensitive).toBe(false);

    // True Positives MUST be flagged
    expect(fieldMap.get('tp_pan').sensitive).toBe(true);
    expect(fieldMap.get('tp_aadhaar').sensitive).toBe(true);
    expect(fieldMap.get('tp_uid').sensitive).toBe(true);
    expect(fieldMap.get('tp_epic').sensitive).toBe(true);
    expect(fieldMap.get('tp_bank').sensitive).toBe(true);
    expect(fieldMap.get('tp_card').sensitive).toBe(true);
    expect(fieldMap.get('tp_hi_aadhaar').sensitive).toBe(true);
    expect(fieldMap.get('tp_hi_pan').sensitive).toBe(true);
    expect(fieldMap.get('tp_hi_khata').sensitive).toBe(true);
    expect(fieldMap.get('tp_hi_passport').sensitive).toBe(true);
  });

  test('Date Handling: Indian standard (DD/MM), ambiguous date confidence, and target format patterns', async () => {
    const { normalizeDateValue } = await import('../src/applyFill');

    // 1. Explicit DD/MM/YYYY (first number > 12)
    const res1 = normalizeDateValue('25/08/1990');
    expect(res1.formatted).toBe('1990-08-25');
    expect(res1.confidence).toBe('high');

    // 2. Explicit MM/DD/YYYY (second number > 12)
    const res2 = normalizeDateValue('08/25/1990');
    expect(res2.formatted).toBe('1990-08-25');
    expect(res2.confidence).toBe('high');

    // 3. Ambiguous date (both numbers <= 12): assumes Indian standard DD/MM and marks confidence "low"
    const res3 = normalizeDateValue('05/10/1995');
    expect(res3.detectedDay).toBe(5);
    expect(res3.detectedMonth).toBe(10);
    expect(res3.formatted).toBe('1995-10-05');
    expect(res3.confidence).toBe('low');

    // 4. Target text format patterns
    const textSchema: any = {
      id: 'custom_date',
      label: 'Date of Application (DD-MM-YYYY)',
      type: 'text',
      pattern: '\\d{2}-\\d{2}-\\d{4}',
    };
    const res4 = normalizeDateValue('15/08/1990', textSchema);
    expect(res4.formatted).toBe('15-08-1990');
  });

  test('Injection Idempotency: guarded with window.__tfbLoaded, no double-patching, and clean destroy()', async ({ page }) => {
    await page.goto(getPageUrl('plain-form.html'));

    // Inject first time
    await page.addScriptTag({ path: BUNDLE_PATH });
    const isLoaded1 = await page.evaluate(() => (window as any).__tfbLoaded);
    expect(isLoaded1).toBe(true);

    // Inject second time: should not throw or duplicate
    await page.addScriptTag({ path: BUNDLE_PATH });
    const isLoaded2 = await page.evaluate(() => (window as any).__tfbLoaded);
    expect(isLoaded2).toBe(true);

    // Test destroy()
    await page.evaluate(() => {
      (window as any).TechFormBuddyCore.destroy();
    });

    const isLoadedAfterDestroy = await page.evaluate(() => (window as any).__tfbLoaded);
    expect(isLoadedAfterDestroy).toBe(false);
  });

  test('AndroidInAppBrowserBridge: marked UNVERIFIED with runtime detection error when no host channel exists', async () => {
    const { AndroidInAppBrowserBridge } = await import('../src/bridge');
    const bridge = new AndroidInAppBrowserBridge();

    expect(bridge.hasHostChannel()).toBe(false);

    let errorThrown: any = null;
    try {
      await bridge.send('SCAN_REQUEST', { test: true });
    } catch (err: any) {
      errorThrown = err;
    }

    expect(errorThrown).toBeDefined();
    expect(errorThrown.message).toContain('[UNVERIFIED]');
    expect(errorThrown.message).toContain('Host message channel is not available');
  });

  test('Phase 2 Guide Overlay: renders in Shadow DOM, mobile/drawer responsive, language switching, and step guidance', async ({ page }) => {
    await page.goto(getPageUrl('plain-form.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    // Mount overlay and load form data
    const overlayState = await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();
      const availableKeys = ['full_name', 'email', 'phone', 'date_of_birth', 'father_name'];
      const analysis = core.analyzeForm(schema.fields, availableKeys);

      const overlay = core.mountOverlay({ language: 'en' });
      overlay.setData(schema.fields, analysis.fields, {
        full_name: 'Ananya Roy',
        email: 'ananya@example.com',
      });

      const host = document.getElementById('tfb-guide-overlay-host');
      const hasShadow = Boolean(host && host.shadowRoot);
      const noticeText = host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();
      const progressText = host?.shadowRoot?.querySelector('.tfb-progress-header')?.textContent?.trim();

      return {
        hasShadow,
        noticeText,
        progressText,
      };
    });

    // 1. Verify Shadow DOM encapsulation
    expect(overlayState.hasShadow).toBe(true);

    // 2. Verify Hard Rule notice is visible
    expect(overlayState.noticeText).toContain('Login, OTP and captcha are done by you.');

    // 3. Verify Progress Indicator
    expect(overlayState.progressText).toContain('Field 1 of');

    // 4. Test Language Switching (Hindi)
    const hindiTitle = await page.evaluate(() => {
      const host = document.getElementById('tfb-guide-overlay-host');
      const select = host?.shadowRoot?.getElementById('tfb-lang-dropdown') as HTMLSelectElement;
      if (select) {
        select.value = 'hi';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();
    });
    expect(hindiTitle).toContain('लॉगिन, ओटीपी और कैप्चा आपको स्वयं भरना है।');

    // 5. Test Fill This and Navigation
    await page.evaluate(() => {
      const host = document.getElementById('tfb-guide-overlay-host');
      const fillThisBtn = host?.shadowRoot?.getElementById('tfb-fill-this-btn') as HTMLButtonElement;
      fillThisBtn?.click();
    });

    // 6. Test Fill All and Completion state notice (Hard Rule 2) in Hindi
    const completionNoticeHi = await page.evaluate(() => {
      const host = document.getElementById('tfb-guide-overlay-host');
      const fillAllBtn = host?.shadowRoot?.getElementById('tfb-fill-all-btn') as HTMLButtonElement;
      fillAllBtn?.click();

      const cardText = host?.shadowRoot?.querySelector('.tfb-completion-card')?.textContent?.trim();
      return cardText;
    });

    expect(completionNoticeHi).toContain('वेबसाइट पर स्वयं सबमिट दबाएं');
    expect(completionNoticeHi).toContain('कभी भी स्वचालित रूप से सबमिट');

    // 7. Switch back to English and verify English completion text
    const completionNoticeEn = await page.evaluate(() => {
      const host = document.getElementById('tfb-guide-overlay-host');
      const select = host?.shadowRoot?.getElementById('tfb-lang-dropdown') as HTMLSelectElement;
      if (select) {
        select.value = 'en';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return host?.shadowRoot?.querySelector('.tfb-completion-card')?.textContent?.trim();
    });

    expect(completionNoticeEn).toContain('Review everything on the page, then press Submit yourself on the website.');
    expect(completionNoticeEn).toContain('TechForm Buddy never auto-submits forms');
  });

  test('Sensitive Test Page: "Fill all" strictly SKIPS every sensitive or manual field', async ({ page }) => {
    await page.goto(getPageUrl('sensitive-test.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    // Mount overlay, provide dummy profile data, and trigger "Fill all"
    const fillResult = await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();
      const profileData: Record<string, string> = {
        full_name: 'Ananya Roy',
        doc_upload: 'passport.pdf',
        company: 'Starlight Enterprises',
        pan: 'ABCDE1234F',
        aadhaar: '123456789012',
        uid: '998877665544',
        epic: 'WBF1234567',
        bank_account: '987654321098',
        card_number: '4111111111111111',
        aadhaar_hi: '123456789012',
        pan_hi: 'ABCDE1234F',
        khata_hi: '987654321098',
        passport_hi: 'Z9876543',
      };

      const analysis = core.analyzeForm(schema.fields, Object.keys(profileData));
      const overlay = core.mountOverlay({ language: 'en' });
      overlay.setData(schema.fields, analysis.fields, profileData);

      // Trigger "Fill all"
      overlay.fillAllFields();

      // Read values of all inputs on sensitive-test.html
      const getVal = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value || '';

      return {
        // Non-sensitive standard field (Must be filled)
        applicantNameVal: getVal('applicant_name'),
        // Manual file upload field (Must NOT be touched)
        docUploadVal: getVal('doc_upload'),
        // Sensitive fields (MUST REMAIN COMPLETELY EMPTY)
        panVal: getVal('tp_pan'),
        aadhaarVal: getVal('tp_aadhaar'),
        uidVal: getVal('tp_uid'),
        epicVal: getVal('tp_epic'),
        bankVal: getVal('tp_bank'),
        cardVal: getVal('tp_card'),
        hiAadhaarVal: getVal('tp_hi_aadhaar'),
        hiPanVal: getVal('tp_hi_pan'),
        hiKhataVal: getVal('tp_hi_khata'),
        hiPassportVal: getVal('tp_hi_passport'),
      };
    });

    // 1. Non-sensitive candidate was filled
    expect(fillResult.applicantNameVal).toBe('Ananya Roy');

    // 2. Manual file upload field was skipped
    expect(fillResult.docUploadVal).toBe('');

    // 3. Strict Hard Rule Check: ALL sensitive fields MUST REMAIN COMPLETELY EMPTY!
    expect(fillResult.panVal).toBe('');
    expect(fillResult.aadhaarVal).toBe('');
    expect(fillResult.uidVal).toBe('');
    expect(fillResult.epicVal).toBe('');
    expect(fillResult.bankVal).toBe('');
    expect(fillResult.cardVal).toBe('');
    expect(fillResult.hiAadhaarVal).toBe('');
    expect(fillResult.hiPanVal).toBe('');
    expect(fillResult.hiKhataVal).toBe('');
    expect(fillResult.hiPassportVal).toBe('');
  });

  test('Overlay Minimize and Expand: floating pill collapses sheet so inputs are never obstructed', async ({ page }) => {
    await page.goto(getPageUrl('plain-form.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();
      const overlay = core.mountOverlay({ language: 'en' });
      overlay.setData(schema.fields, [], {});
    });

    // 1. Initially open and not minimized
    const initialState = await page.evaluate(() => {
      const host = document.getElementById('tfb-guide-overlay-host');
      const sheet = host?.shadowRoot?.querySelector('.tfb-sheet');
      const pill = host?.shadowRoot?.getElementById('tfb-minimized-pill');
      return {
        sheetOpen: sheet?.classList.contains('open'),
        pillVisible: pill?.classList.contains('visible'),
      };
    });
    expect(initialState.sheetOpen).toBe(true);
    expect(initialState.pillVisible).toBe(false);

    // 2. Click minimize button
    const minimizedState = await page.evaluate(() => {
      const host = document.getElementById('tfb-guide-overlay-host');
      const minBtn = host?.shadowRoot?.getElementById('tfb-minimize-btn') as HTMLButtonElement;
      minBtn?.click();

      const sheet = host?.shadowRoot?.querySelector('.tfb-sheet');
      const pill = host?.shadowRoot?.getElementById('tfb-minimized-pill');
      return {
        sheetOpen: sheet?.classList.contains('open'),
        pillVisible: pill?.classList.contains('visible'),
      };
    });
    expect(minimizedState.sheetOpen).toBe(false);
    expect(minimizedState.pillVisible).toBe(true);

    // 3. Click floating pill to expand
    const expandedState = await page.evaluate(() => {
      const host = document.getElementById('tfb-guide-overlay-host');
      const pill = host?.shadowRoot?.getElementById('tfb-minimized-pill') as HTMLElement;
      pill?.click();

      // Query re-rendered elements from shadowRoot
      const sheet = host?.shadowRoot?.querySelector('.tfb-sheet');
      const freshPill = host?.shadowRoot?.getElementById('tfb-minimized-pill');
      return {
        sheetOpen: sheet?.classList.contains('open'),
        pillVisible: freshPill?.classList.contains('visible'),
      };
    });
    expect(expandedState.sheetOpen).toBe(true);
    expect(expandedState.pillVisible).toBe(false);
  });

  test('Regional Indian Languages: mr, gu, as, kn, ml, pa and dynamic registerTranslations extensibility', async ({ page }) => {
    await page.goto(getPageUrl('plain-form.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    const translationsCheck = await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const overlay = core.mountOverlay({ language: 'mr' });
      const host = document.getElementById('tfb-guide-overlay-host');

      // Marathi
      const mrNotice = host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();

      // Switch to Gujarati
      overlay.setLanguage('gu');
      const guNotice = host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();

      // Switch to Kannada
      overlay.setLanguage('kn');
      const knNotice = host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();

      // Switch to Malayalam
      overlay.setLanguage('ml');
      const mlNotice = host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();

      // Switch to Punjabi
      overlay.setLanguage('pa');
      const paNotice = host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();

      // Switch to Assamese
      overlay.setLanguage('as');
      const asNotice = host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();

      // Test extensible registerTranslations
      core.registerTranslations('od', {
        title: 'ଟେକଫର୍ମ ବଡି',
        loginOtpNotice: 'ଲଗଇନ୍ ଏବଂ ଓଟିପି ନିଜେ କରନ୍ତୁ।',
        fieldProgress: (c: number, t: number) => `କ୍ଷେତ୍ର ${c} / ${t}`,
        btnFillThis: 'ଏହା ଭରନ୍ତୁ',
        btnFillAll: 'ସମସ୍ତ ଭରନ୍ତୁ',
        btnNext: 'ପରବର୍ତ୍ତୀ',
        btnPrev: 'ପୂର୍ବବର୍ତ୍ତୀ',
        btnReadAloud: 'ଶୁଣନ୍ତୁ',
        btnStopAudio: 'ବନ୍ଦ କରନ୍ତୁ',
        btnDone: 'ସମାପ୍ତ',
        sensitiveFieldWarning: 'ସମ୍ବେଦନଶୀଳ ତଥ୍ୟ: ନିଜେ ଟାଇପ୍ କରନ୍ତୁ।',
        reviewAndSubmitMessage: 'ନିଜେ ଯାଞ୍ଚ କରି ସବମିଟ୍ କରନ୍ତୁ।',
        noAutoSubmitNotice: 'ଅଟୋ-ସବମିଟ୍ କରେ ନାହିଁ।',
        manualActionRequired: 'ମାନୁଆଲ୍ ଆକ୍ସନ୍ ଆବଶ୍ୟକ।',
        completedTitle: 'ପ୍ରସ୍ତୁତ!',
      });
      overlay.setLanguage('od');
      const odNotice = host?.shadowRoot?.querySelector('.tfb-notice-bar')?.textContent?.trim();

      return {
        mrNotice,
        guNotice,
        knNotice,
        mlNotice,
        paNotice,
        asNotice,
        odNotice,
      };
    });

    expect(translationsCheck.mrNotice).toContain('लॉगिन, ओटीपी आणि कॅप्चा तुम्हाला स्वतः भरायचे आहेत');
    expect(translationsCheck.guNotice).toContain('લૉગિન, OTP અને કૅપ્ચા તમારે જાતે જ ભરવાના રહેશે');
    expect(translationsCheck.knNotice).toContain('ಲಾಗಿನ್, OTP ಮತ್ತು ಕ್ಯಾಪ್ಚಾ ನೀವೇ ಸ್ವತಃ ಭರ್ತಿ ಮಾಡಬೇಕು');
    expect(translationsCheck.mlNotice).toContain('ലോഗിൻ, OTP, ക്യാപ്‌ച എന്നിവ നിങ്ങൾ സ്വയം ചെയ്യേണ്ടതാണ്');
    expect(translationsCheck.paNotice).toContain('ਲਾਗਇਨ, OTP ਅਤੇ ਕੈਪਚਾ ਤੁਹਾਨੂੰ ਖੁਦ ਭਰਨਾ ਪਵੇਗਾ');
    expect(translationsCheck.asNotice).toContain('লগইন, অ’টিপি আৰু কেপচা আপুনি নিজেই কৰিব লাগিব');
    expect(translationsCheck.odNotice).toContain('ଲଗଇନ୍ ଏବଂ ଓଟିପି ନିଜେ କରନ୍ତୁ');
  });
});

