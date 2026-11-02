import { test, expect } from '@playwright/test';
import {
  FORM_TEMPLATES,
  generateFallbackDocument,
  DocumentSections,
  FormTemplate,
} from '../../../src/lib/templates';

test.describe('Form Creation Regression & Structure Lock-in Suite', () => {
  // ─── Unit Contract Checks for Templates & Fallback Documents ───
  test('Template Contract: Resignation, Leave & Scholarship templates must contain all mandatory fields and sections', () => {
    // 1. Resignation Template
    const resignation = FORM_TEMPLATES.find((t) => t.id === 'resignation');
    expect(resignation).toBeDefined();
    expect(resignation!.requiredSections).toEqual([
      'header',
      'date',
      'subject',
      'salutation',
      'body',
      'closing',
      'signature',
    ]);
    const resFieldKeys = resignation!.fields.map((f) => f.key);
    const expectedResFields = [
      'applicant_name',
      'employee_id',
      'designation',
      'department',
      'organization_name',
      'recipient_title',
      'recipient_address',
      'notice_period',
      'last_working_day',
      'reason',
      'emergency_phone',
    ];
    for (const k of expectedResFields) {
      expect(resFieldKeys, `Missing resignation template field: ${k}`).toContain(k);
    }

    // 2. Leave Application Template
    const leave = FORM_TEMPLATES.find((t) => t.id === 'leave_application');
    expect(leave).toBeDefined();
    expect(leave!.requiredSections).toEqual([
      'header',
      'date',
      'subject',
      'salutation',
      'body',
      'closing',
      'signature',
    ]);
    const leaveFieldKeys = leave!.fields.map((f) => f.key);
    const expectedLeaveFields = [
      'applicant_name',
      'designation_or_roll',
      'organization_name',
      'recipient_title',
      'recipient_address',
      'leave_type',
      'start_date',
      'end_date',
      'reason',
      'emergency_phone',
    ];
    for (const k of expectedLeaveFields) {
      expect(leaveFieldKeys, `Missing leave template field: ${k}`).toContain(k);
    }

    // 3. Scholarship Application Template
    const scholarship = FORM_TEMPLATES.find((t) => t.id === 'scholarship_application');
    expect(scholarship).toBeDefined();
    expect(scholarship!.requiredSections).toEqual([
      'header',
      'date',
      'subject',
      'salutation',
      'body',
      'closing',
      'signature',
      'enclosures',
    ]);
    const scholFieldKeys = scholarship!.fields.map((f) => f.key);
    const expectedScholFields = [
      'applicant_name',
      'father_name',
      'mother_name',
      'dob',
      'email',
      'mobile',
      'address',
      'category_caste',
      'institution_name',
      'course_and_year',
      'annual_income',
      'academic_record',
      'recipient_title',
      'department_or_office',
      'scheme_name',
    ];
    for (const k of expectedScholFields) {
      expect(scholFieldKeys, `Missing scholarship template field: ${k}`).toContain(k);
    }
  });

  test('Snapshot Check: generateFallbackDocument produces full document sections (header, date, subject, body, closing, signature, enclosures)', () => {
    // 1. Resignation Snapshot in English
    const resTmpl = FORM_TEMPLATES.find((t) => t.id === 'resignation')!;
    const resDocEn = generateFallbackDocument(
      resTmpl,
      {
        applicant_name: 'Rahul Sharma',
        employee_id: 'EMP-40918',
        designation: 'Staff Engineer',
        department: 'Platform Core',
        organization_name: 'TechCorp India',
        recipient_title: 'Director of Engineering',
        recipient_address: 'Bangalore, Karnataka',
        notice_period: '60 Days',
        last_working_day: '2026-12-31',
        reason: 'career advancement',
        emergency_phone: '9876543210',
      },
      'en'
    );

    expect(resDocEn.header).toContain('Director of Engineering');
    expect(resDocEn.header).toContain('TechCorp India');
    expect(resDocEn.date).toBeTruthy();
    expect(resDocEn.subject).toContain('Subject: Formal Resignation');
    expect(resDocEn.salutation).toContain('Respected Sir/Madam');
    expect(resDocEn.body).toContain('Staff Engineer');
    expect(resDocEn.body).toContain('EMP-40918');
    expect(resDocEn.body).toContain('60 Days');
    expect(resDocEn.body).toContain('2026-12-31');
    expect(resDocEn.closing).toContain('Yours sincerely');
    expect(resDocEn.signature).toContain('Rahul Sharma');

    // 2. Resignation Snapshot in Hindi
    const resDocHi = generateFallbackDocument(
      resTmpl,
      {
        applicant_name: 'राहुल शर्मा',
        employee_id: 'EMP-40918',
        designation: 'वरिष्ठ अभियंता',
        department: 'आईटी विभाग',
        organization_name: 'टेककॉर्प सोल्यूशंस',
        recipient_title: 'विभागाध्यक्ष',
        recipient_address: 'भोपाल, मध्य प्रदेश',
        notice_period: '30 दिन',
        last_working_day: '2026-11-30',
        reason: 'उच्च अध्ययन',
      },
      'hi'
    );

    expect(resDocHi.header).toContain('सेवा में');
    expect(resDocHi.date).toContain('दिनांक');
    expect(resDocHi.subject).toContain('त्यागपत्र');
    expect(resDocHi.salutation).toContain('महोदय');
    expect(resDocHi.body).toContain('वरिष्ठ अभियंता');
    expect(resDocHi.closing).toContain('भवदीय');
    expect(resDocHi.signature).toContain('राहुल शर्मा');

    // 3. Leave Application Snapshot
    const leaveTmpl = FORM_TEMPLATES.find((t) => t.id === 'leave_application')!;
    const leaveDoc = generateFallbackDocument(
      leaveTmpl,
      {
        applicant_name: 'Anita Roy',
        designation_or_roll: 'Accountant',
        organization_name: 'Finance Dept',
        recipient_title: 'Senior Manager',
        recipient_address: 'New Delhi',
        leave_type: 'Casual Leave',
        start_date: '2026-11-05',
        end_date: '2026-11-07',
        reason: 'family function',
        emergency_phone: '9876543210',
      },
      'en'
    );
    expect(leaveDoc.header).toContain('Senior Manager');
    expect(leaveDoc.subject).toContain('Application for Casual Leave');
    expect(leaveDoc.body).toContain('2026-11-05');
    expect(leaveDoc.body).toContain('2026-11-07');
    expect(leaveDoc.closing).toContain('Yours faithfully');

    // 4. Scholarship Application Snapshot (with enclosures)
    const scholTmpl = FORM_TEMPLATES.find((t) => t.id === 'scholarship_application')!;
    const scholDoc = generateFallbackDocument(
      scholTmpl,
      {
        applicant_name: 'Sunil Kumar',
        father_name: 'Dinesh Kumar',
        recipient_title: 'Welfare Officer',
        department_or_office: 'Minority Affairs',
        scheme_name: 'Merit-cum-Means',
        institution_name: 'Govt Polytechnic',
        course_and_year: 'Civil Engg 2nd Year',
        annual_income: 'Rs. 1,00,000/-',
        category_caste: 'OBC',
        academic_record: '88% in 1st year',
      },
      'en'
    );
    expect(scholDoc.header).toContain('Welfare Officer');
    expect(scholDoc.subject).toContain('Merit-cum-Means');
    expect(scholDoc.body).toContain('Govt Polytechnic');
    expect(scholDoc.enclosures).toBeDefined();
    expect(scholDoc.enclosures!.length).toBeGreaterThan(0);
  });

  // ─── UI Browser Tests on /forms/new ───
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth Session
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'usr_reg_test', name: 'Rajesh Sharma', email: 'rajesh@example.com' },
          expires: '2099-01-01T00:00:00.000Z',
        }),
      });
    });

    // Mock Profile
    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'prof_reg_1',
          user_id: 'usr_reg_test',
          full_name: 'Rajesh Sharma',
          phone: '9876543210',
          email: 'rajesh@example.com',
          address: '42 MG Road',
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          pincode: '462001',
          father_name: 'Ramesh Sharma',
          mother_name: 'Sunita Sharma',
          dob: '1998-05-20',
          date_of_birth: '1998-05-20',
          preferred_language: 'en',
        }),
      });
    });

    // Mock Documents Vault
    await page.route('**/api/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documents: [
            { id: 'doc-vault-photo', file_name: 'My_Photo.jpg', file_type: 'image/jpeg', file_size: 95 * 1024 },
            { id: 'doc-vault-aadhaar', file_name: 'Aadhaar.pdf', file_type: 'application/pdf', file_size: 400 * 1024 },
          ],
        }),
      });
    });
  });

  test('UI Test: Resignation Letter flow renders all template fields and generates full document structure', async ({
    page,
  }) => {
    // Navigate with URL param ?type=resignation
    await page.goto('/forms/new?type=resignation');

    // Verify all resignation template fields are displayed in step 2
    await expect(page.locator('#field-applicant_name')).toBeVisible();
    await expect(page.locator('#field-employee_id')).toBeVisible();
    await expect(page.locator('#field-designation')).toBeVisible();
    await expect(page.locator('#field-department')).toBeVisible();
    await expect(page.locator('#field-organization_name')).toBeVisible();
    await expect(page.locator('#field-recipient_title')).toBeVisible();
    await expect(page.locator('#field-recipient_address')).toBeVisible();
    await expect(page.locator('#field-notice_period')).toBeVisible();
    await expect(page.locator('#field-last_working_day')).toBeVisible();
    await expect(page.locator('#field-reason')).toBeVisible();

    // Verify applicant_name was prefilled from profile
    await expect(page.locator('#field-applicant_name')).toHaveValue('Rajesh Sharma');

    // Fill remaining required fields
    await page.locator('#field-employee_id').fill('EMP-9021');
    await page.locator('#field-designation').fill('Senior Product Engineer');
    await page.locator('#field-department').fill('Engineering');
    await page.locator('#field-organization_name').fill('Acme Corp India');
    await page.locator('#field-recipient_title').fill('Head of Technology');
    await page.locator('#field-recipient_address').fill('Gurugram, Haryana');
    await page.locator('#field-notice_period').selectOption('30 Days');
    await page.locator('#field-last_working_day').fill('2026-11-30');
    await page.locator('#field-reason').fill('Pursuing new professional growth opportunity');

    // Verify button text is "Generate Complete Document"
    const generateBtn = page.locator('#btn-next-step');
    await expect(generateBtn).toContainText('Generate Complete Document');

    // Click "Generate Complete Document"
    await generateBtn.click();

    // Verify Step 4 Review is rendered with complete document structure
    await expect(page.locator('.doc-paper')).toBeVisible();

    // Verify all 6 mandatory document sections are present in preview
    const headerInput = page.locator('#doc-header-text');
    await expect(headerInput).toBeVisible();
    await expect(headerInput).toHaveValue(/Head of Technology/);

    const subjectInput = page.locator('#doc-subject-text');
    await expect(subjectInput).toBeVisible();
    await expect(subjectInput).toHaveValue(/Resignation/i);

    const bodyTextarea = page.locator('#doc-body-text');
    await expect(bodyTextarea).toBeVisible();
    const bodyContent = await bodyTextarea.inputValue();
    expect(bodyContent).toContain('Senior Product Engineer');
    expect(bodyContent).toContain('EMP-9021');
    expect(bodyContent).toContain('30 Days');
    expect(bodyContent).toContain('2026-11-30');

    // Verify closing and signature
    await expect(page.locator('#doc-closing-text')).toBeVisible();
    await expect(page.locator('#doc-signature-text')).toBeVisible();

    // Verify download actions exist
    await expect(page.locator('[data-testid="btn-download-pdf"]')).toBeVisible();
  });

  test('UI Test: Leave Application flow renders all template fields and generates full document without document step', async ({
    page,
  }) => {
    // Navigate to /forms/new?type=leave_application
    await page.goto('/forms/new?type=leave_application');

    // Verify all leave fields are visible
    await expect(page.locator('#field-applicant_name')).toBeVisible();
    await expect(page.locator('#field-designation_or_roll')).toBeVisible();
    await expect(page.locator('#field-organization_name')).toBeVisible();
    await expect(page.locator('#field-recipient_title')).toBeVisible();
    await expect(page.locator('#field-leave_type')).toBeVisible();
    await expect(page.locator('#field-start_date')).toBeVisible();
    await expect(page.locator('#field-end_date')).toBeVisible();
    await expect(page.locator('#field-reason')).toBeVisible();

    // Fill in required leave particulars
    await page.locator('#field-designation_or_roll').fill('Operations Lead');
    await page.locator('#field-organization_name').fill('Global Logistics Pvt Ltd');
    await page.locator('#field-recipient_title').fill('Operations Director');
    await page.locator('#field-recipient_address').fill('Bhopal, M.P.');
    await page.locator('#field-leave_type').selectOption('Medical Leave');
    await page.locator('#field-start_date').fill('2026-11-10');
    await page.locator('#field-end_date').fill('2026-11-12');
    await page.locator('#field-reason').fill('Medical rest as advised by doctor');

    // Verify button text is "Generate Complete Document"
    const generateBtn = page.locator('#btn-next-step');
    await expect(generateBtn).toContainText('Generate Complete Document');

    // Click "Generate Complete Document"
    await generateBtn.click();

    // Verify it transitions directly to review paper without document step
    await expect(page.locator('.doc-paper')).toBeVisible();

    // Verify document sections exist and contain data
    const subjectInput = page.locator('#doc-subject-text');
    await expect(subjectInput).toHaveValue(/Medical Leave/);

    const bodyTextarea = page.locator('#doc-body-text');
    const bodyContent = await bodyTextarea.inputValue();
    expect(bodyContent).toContain('Medical Leave');
    expect(bodyContent).toContain('2026-11-10');
    expect(bodyContent).toContain('2026-11-12');
  });

  test('UI Test: Scholarship Application flow renders all template fields, document checklist slots and generates complete document', async ({
    page,
  }) => {
    // Navigate to /forms/new?type=scholarship_application
    await page.goto('/forms/new?type=scholarship_application');

    // Verify all scholarship template fields are visible
    await expect(page.locator('#field-applicant_name')).toBeVisible();
    await expect(page.locator('#field-father_name')).toBeVisible();
    await expect(page.locator('#field-mother_name')).toBeVisible();
    await expect(page.locator('#field-category_caste')).toBeVisible();
    await expect(page.locator('#field-institution_name')).toBeVisible();
    await expect(page.locator('#field-course_and_year')).toBeVisible();
    await expect(page.locator('#field-annual_income')).toBeVisible();
    await expect(page.locator('#field-academic_record')).toBeVisible();
    await expect(page.locator('#field-recipient_title')).toBeVisible();
    await expect(page.locator('#field-department_or_office')).toBeVisible();
    await expect(page.locator('#field-scheme_name')).toBeVisible();

    // Fill in required fields
    await page.locator('#field-category_caste').fill('General / EWS');
    await page.locator('#field-institution_name').fill('National Institute of Technology');
    await page.locator('#field-course_and_year').fill('B.Tech Mechanical 3rd Year');
    await page.locator('#field-annual_income').fill('Rs. 1,20,000/-');
    await page.locator('#field-academic_record').fill('8.4 CGPA');
    await page.locator('#field-recipient_title').fill('District Welfare Officer');
    await page.locator('#field-department_or_office').fill('Scholarships Division');
    await page.locator('#field-scheme_name').fill('Post-Matric Merit Scheme');

    // Click Next: Document Checklist
    await page.locator('#btn-next-step').click();

    // Verify document slots are displayed
    await expect(page.locator('[data-testid="doc-slot-photo"]')).toBeVisible();
    await expect(page.locator('[data-testid="doc-slot-signature"]')).toBeVisible();
    await expect(page.locator('[data-testid="doc-slot-aadhaar"]')).toBeVisible();
    await expect(page.locator('[data-testid="doc-slot-marksheet"]')).toBeVisible();
    await expect(page.locator('[data-testid="doc-slot-income_certificate"]')).toBeVisible();

    // Attach documents from mock vault
    await page.locator('[data-testid="select-vault-photo"]').selectOption('doc-vault-photo');
    await page.locator('[data-testid="select-vault-signature"]').selectOption('doc-vault-photo'); // reuse photo for test
    await page.locator('[data-testid="select-vault-aadhaar"]').selectOption('doc-vault-aadhaar');
    await page.locator('[data-testid="select-vault-marksheet"]').selectOption('doc-vault-aadhaar');
    await page.locator('[data-testid="select-vault-income_certificate"]').selectOption('doc-vault-aadhaar');

    // Verify button text is "Generate Complete Document"
    const proceedBtn = page.locator('#btn-proceed-review');
    await expect(proceedBtn).toContainText('Generate Complete Document');

    // Click "Generate Complete Document"
    await proceedBtn.click();

    // Verify Step 4 review renders complete document with enclosures
    await expect(page.locator('.doc-paper')).toBeVisible();
    const enclosuresBlock = page.locator('[data-testid="enclosures-list"]');
    await expect(enclosuresBlock).toBeVisible();
    await expect(enclosuresBlock).toContainText('Photo');
    await expect(enclosuresBlock).toContainText('Aadhaar');
  });
});
