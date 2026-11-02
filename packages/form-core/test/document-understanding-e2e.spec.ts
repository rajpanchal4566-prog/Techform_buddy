import { test, expect } from '@playwright/test';
import { analyzeDocumentContent, extractTextFromBuffer, extractDocumentTextAsync } from '../../../src/lib/documentUnderstanding';

test.describe('B2: Document Understanding E2E & Multimodal Verification', () => {
  test('extractDocumentTextAsync correctly handles plain text and PDF/Image buffers', async () => {
    // 1. Text buffer
    const textBuffer = Buffer.from('Scholarship Award Letter: Candidate Amit Patel, Grant Amount ₹50,000, Last Date: 15-Dec-2026, Ref: SCH/2026/9021');
    const textResult = await extractDocumentTextAsync(textBuffer, 'Award_Letter.txt', 'text/plain');
    expect(textResult).toContain('Amit Patel');
    expect(textResult).toContain('₹50,000');

    // 2. Image buffer fallback / extraction
    const mockImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
    const imgResult = await extractDocumentTextAsync(mockImageBuffer, 'Govt_Marksheet_Notice.png', 'image/png');
    expect(imgResult).toBeTruthy();
  });

  test('analyzeDocumentContent generates all 5 required parts across multiple document types', async () => {
    const documents = [
      {
        name: 'Income_Certificate_Tehsil.pdf',
        text: 'GOVERNMENT OF MADHYA PRADESH - REVENUE DEPARTMENT\nTehsil Huzur Bhopal\nINCOME CERTIFICATE\nCertificate No: INC/2026/5541\nDate: 05/09/2026\nThis is to certify that annual family income of Shri Ramesh Kumar, Son of Dayaram Kumar, DOB: 12/03/1998, resident of Ward 12 Bhopal, is ₹85,000.\nValid for academic year 2026-2027.',
        expectedType: 'Income Certificate',
        expectedName: 'Ramesh Kumar',
        expectedAmount: '₹85,000',
      },
      {
        name: 'Bank_Sanction_Letter.pdf',
        text: 'STATE BANK OF INDIA - SME LOAN DIVISION\nSanction Letter Ref: SBI/LOAN/2026/771\nDate: 22/08/2026\nDear Sunita Devi, We are pleased to sanction an education grant of ₹2,50,000 under the Higher Education Support Scheme.\nLast date to accept terms: 30-Nov-2026.',
        expectedType: 'Bank Letter / Statement',
        expectedName: 'Sunita Devi',
        expectedAmount: '₹2,50,000',
      },
      {
        name: 'Public_Exam_Notice.pdf',
        text: 'STAFF SELECTION BOARD - PUBLIC NOTICE\nNotice No: SSB/EXAM/2026/330\nIssue Date: 01/10/2026\nOnline registration closes on 25-Nov-2026.\nApplication fee is ₹250.\nCandidates must present original admit card and government photo ID.',
        expectedType: 'Government Public Notice',
        expectedName: '',
        expectedAmount: '₹250',
      }
    ];

    for (const doc of documents) {
      const res = await analyzeDocumentContent(doc.text, doc.name, 'en');

      // 1. Plain-Language Summary
      expect(res.summary).toBeTruthy();
      expect(res.summary.length).toBeGreaterThan(20);

      // 2. Key Facts
      expect(res.keyFacts).toBeDefined();
      expect(res.keyFacts.dates.length).toBeGreaterThan(0);
      expect(res.keyFacts.amounts.length).toBeGreaterThan(0);
      expect(res.keyFacts.referenceNumbers.length).toBeGreaterThan(0);

      // 3. What You Need to Do Next
      expect(res.nextSteps.length).toBeGreaterThan(0);

      // 4. Risks & Warnings
      expect(res.risksAndWarnings.length).toBeGreaterThan(0);

      // 5. Candidate Profile Fields
      expect(res.candidateProfileFields).toBeDefined();
    }
  });

  test('UI supports language change and profile confirmation flow in browser', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'u-b2-test', name: 'Pooja Verma', email: 'pooja@example.com' } }),
      });
    });

    await page.route('**/api/documents', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'doc-b2-01',
              file_name: 'Domicile_and_Income_Certificate.pdf',
              file_type: 'application/pdf',
              file_size: 64000,
              extracted_data: JSON.stringify({ documentType: 'Income Certificate' }),
              uploaded_at: '2026-10-20T10:00:00Z',
            },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    let syncPayload: any = null;
    await page.route('**/api/documents/analyze', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            analysis: {
              docType: 'Income Certificate',
              confidence: 0.96,
              summary: 'This is an official Income Certificate issued by local revenue authorities certifying family income for Pooja Verma as ₹95,000.',
              translatedSummary: 'यह स्थानीय राजस्व अधिकारियों द्वारा जारी एक आधिकारिक आय प्रमाण पत्र है जो पूजा वर्मा की पारिवारिक आय ₹95,000 प्रमाणित करता है।',
              targetLanguage: 'hi',
              keyFacts: {
                names: ['Pooja Verma'],
                dates: ['15/09/2026'],
                deadlines: ['31-Dec-2026'],
                amounts: ['₹95,000'],
                referenceNumbers: ['REV/2026/8812'],
              },
              nextSteps: [
                'Ensure the certificate has a valid digital signature or official revenue seal.',
                'Save the certificate reference number to your TechForm Buddy profile for instant autofill.',
              ],
              risksAndWarnings: [
                'Validity Period: Many government schemes require income certificates issued within the current financial year.',
              ],
              candidateProfileFields: [
                { key: 'fullName', label: 'Full Name', value: 'Pooja Verma', confidence: 0.95, sensitive: false, selected: true },
                { key: 'annualIncome', label: 'Annual Family Income', value: '₹95,000', confidence: 0.92, sensitive: false, selected: true },
                { key: 'aadhaarNumber', label: 'Aadhaar Number (Sensitive ID)', value: 'XXXX-XXXX-9912', confidence: 0.98, sensitive: true, selected: false },
              ],
            },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        syncPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile updated with confirmed document values',
            savedFields: syncPayload.fieldsToSave,
          }),
        });
      }
    });

    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    // Click "Understand"
    await page.locator('button:has-text("Understand")').click();

    // Verify card rendered
    const card = page.locator('#document-understanding-card');
    await expect(card).toBeVisible();

    // Verify language select exists
    const langSelect = page.locator('#analysis-language-select');
    await expect(langSelect).toBeVisible();

    // Verify Summary & Translation
    await expect(card).toContainText('Pooja Verma');
    await expect(card).toContainText('आय प्रमाण पत्र'); // Hindi translation rendered

    // Verify Key Facts
    await expect(card).toContainText('₹95,000');
    await expect(card).toContainText('31-Dec-2026');
    await expect(card).toContainText('REV/2026/8812');

    // Verify Next Steps and Warnings
    await expect(card).toContainText('What You Need to Do Next');
    await expect(card).toContainText('Validity Period');

    // Verify sensitive field is locked/masked
    await expect(card).toContainText('Sensitive ID - Manual entry only');

    // Modify a field value
    const nameInput = page.locator('input[value="Pooja Verma"]');
    await nameInput.fill('Pooja R. Verma');

    // Click confirm & save to profile
    await page.locator('#save-profile-sync-btn').click();

    // Verify feedback
    await expect(card).toContainText('Successfully saved confirmed values');
    expect(syncPayload.fieldsToSave.fullName).toBe('Pooja R. Verma');
    expect(syncPayload.fieldsToSave.annualIncome).toBe('₹95,000');
    expect(syncPayload.fieldsToSave.aadhaarNumber).toBeUndefined(); // Sensitive never submitted
  });
});

