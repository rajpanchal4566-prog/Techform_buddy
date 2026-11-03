import { test, expect } from '@playwright/test';
import {
  readForm,
  applyFill,
  dontFill,
  clearHighlights,
  analyzeField,
  analyzeForm,
  detectDocumentType,
  createFileFromVaultDoc,
  attachFileToInput,
  VaultDocument,
  ExtensionUserProfile,
} from '../src';

test.describe('Smart Autofill + Extension-Level User Profile Verification', () => {
  test('1. User Decision: FILL correctly populates fields, documents, and verifies DOM', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Scholarship Application Form</title></head>
      <body>
        <form id="scholarship-form">
          <h2>Personal Details</h2>
          <label for="cand_name">Candidate Full Name:</label>
          <input type="text" id="cand_name" name="cand_name" />

          <label for="cand_dob">Date of Birth:</label>
          <input type="date" id="cand_dob" name="cand_dob" />

          <label for="cand_gender">Gender:</label>
          <select id="cand_gender" name="cand_gender">
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <label for="cand_email">Email Address:</label>
          <input type="email" id="cand_email" name="cand_email" />

          <label for="cand_phone">Mobile Number:</label>
          <input type="tel" id="cand_phone" name="cand_phone" />

          <h2>Academic Qualification</h2>
          <label for="inst_name">College / University Name:</label>
          <input type="text" id="inst_name" name="inst_name" />

          <label for="inst_course">Course Enrolled:</label>
          <input type="text" id="inst_course" name="inst_course" />

          <label for="inst_roll">Examination Roll Number:</label>
          <input type="text" id="inst_roll" name="inst_roll" />

          <label for="inst_reg">Enrollment / Registration Number:</label>
          <input type="text" id="inst_reg" name="inst_reg" />

          <h2>Social Category</h2>
          <label for="cand_category">Category:</label>
          <select id="cand_category" name="cand_category">
            <option value="General">General</option>
            <option value="OBC">OBC</option>
            <option value="SC">SC</option>
            <option value="ST">ST</option>
          </select>

          <h2>Document Uploads</h2>
          <label for="doc_aadhaar_file">Upload Aadhaar Card (PDF/Image):</label>
          <input type="file" id="doc_aadhaar_file" name="doc_aadhaar_file" accept=".pdf,image/*" />

          <label for="doc_photo_file">Upload Passport Photo:</label>
          <input type="file" id="doc_photo_file" name="doc_photo_file" accept="image/*" />

          <h2>Sensitive ID Verification (Text Number)</h2>
          <label for="aadhaar_number">Aadhaar 12-Digit Number (Manual):</label>
          <input type="text" id="aadhaar_number" name="aadhaar_number" />

          <button type="submit" id="submit-btn">Submit Application</button>
        </form>
      </body>
      </html>
    `);
    await page.addScriptTag({ path: 'packages/form-core/dist/form-core.iife.js' });

    // Profile values stored at extension level
    const userProfileValues: Record<string, string> = {
      full_name: 'Vikram Aditya Rathore',
      date_of_birth: '2001-08-15',
      gender: 'Male',
      email: 'vikram.rathore@example.com',
      phone: '9876543210',
      college: 'Vikrant Institute of Technology',
      course: 'B.Tech Computer Science',
      roll_number: 'CS2021-089',
      enrollment_number: 'ENR-98745612',
      category: 'OBC',
    };

    // User documents saved in Extension Vault
    const vaultDocs: VaultDocument[] = [
      {
        id: 'doc_1',
        name: 'Aadhaar_Card_Verified.pdf',
        docType: 'aadhaar',
        fileType: 'application/pdf',
        fileSize: 45000,
        lastUpdated: Date.now(),
      },
      {
        id: 'doc_2',
        name: 'Passport_Size_Photograph.jpg',
        docType: 'photo',
        fileType: 'image/jpeg',
        fileSize: 22000,
        lastUpdated: Date.now(),
      },
    ];

    const fillSummary = await page.evaluate(
      ({ userProfileValues, vaultDocs }) => {
        // Access global form-core functions
        const core = (window as any).TechFormBuddyCore;
        const schema = core.readForm();

        // Build mappings from analyzer
        const availableKeys = Object.keys(userProfileValues);
        const analysis = core.analyzeForm(schema.fields, availableKeys);
        const mapping: Record<string, string> = {};
        for (const f of analysis.fields) {
          if (f.profileKey) {
            mapping[f.fieldId] = f.profileKey;
          }
        }

        // Apply FILL
        return core.applyFill(mapping, userProfileValues, schema.fields, document, vaultDocs);
      },
      { userProfileValues, vaultDocs }
    );

    // 1. Check fill execution
    expect(fillSummary.success).toBe(true);
    expect(fillSummary.filledCount).toBeGreaterThanOrEqual(8);
    expect(fillSummary.documentCount).toBeGreaterThanOrEqual(1);

    // 2. Check DOM actual values
    const candName = await page.inputValue('#cand_name');
    expect(candName).toBe('Vikram Aditya Rathore');

    const candGender = await page.inputValue('#cand_gender');
    expect(candGender).toBe('Male');

    const candCollege = await page.inputValue('#inst_name');
    expect(candCollege).toBe('Vikrant Institute of Technology');

    const candRoll = await page.inputValue('#inst_roll');
    expect(candRoll).toBe('CS2021-089');

    const candReg = await page.inputValue('#inst_reg');
    expect(candReg).toBe('ENR-98745612');

    const candCat = await page.inputValue('#cand_category');
    expect(candCat).toBe('OBC');

    // 3. Sensitive text ID field MUST remain EMPTY (Hard Rule 4)
    const aadhaarNumber = await page.inputValue('#aadhaar_number');
    expect(aadhaarNumber).toBe('');

    // 4. Document upload inputs should have attached files
    const fileCount = await page.evaluate(() => {
      const el = document.getElementById('doc_aadhaar_file') as HTMLInputElement;
      return el?.files?.length || 0;
    });
    expect(fileCount).toBeGreaterThanOrEqual(1);

    // 5. Verification: Form was NEVER submitted automatically
    const pageUrl = page.url();
    expect(pageUrl).not.toContain('submit');
  });

  test('2. User Decision: DON’T FILL guarantees 100% untouched form state', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <form id="sample-form">
          <input type="text" id="uname" value="Original User Input" />
          <input type="email" id="uemail" value="original@site.com" />
          <select id="ucity"><option value="delhi">Delhi</option></select>
        </form>
      </body>
      </html>
    `);
    await page.addScriptTag({ path: 'packages/form-core/dist/form-core.iife.js' });

    const summary = await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      return core.dontFill(document);
    });

    expect(summary.success).toBe(true);
    expect(summary.filledCount).toBe(0);

    // Check DOM remains completely untouched
    expect(await page.inputValue('#uname')).toBe('Original User Input');
    expect(await page.inputValue('#uemail')).toBe('original@site.com');
  });

  test('3. Document Type Identification recognizes various patterns and keywords', () => {
    expect(detectDocumentType('Upload Aadhaar Card Copy')).toBe('aadhaar');
    expect(detectDocumentType('UIDAI Document (PDF)')).toBe('aadhaar');
    expect(detectDocumentType('PAN Card Proof')).toBe('pan');
    expect(detectDocumentType('Permanent Account Number Card')).toBe('pan');
    expect(detectDocumentType('Passport Size Photograph')).toBe('photo');
    expect(detectDocumentType('Candidate Photo')).toBe('photo');
    expect(detectDocumentType('Signature of the Applicant')).toBe('signature');
    expect(detectDocumentType('Candidate Signature Scan')).toBe('signature');
    expect(detectDocumentType('10th Standard Marksheet')).toBe('marksheet');
    expect(detectDocumentType('Degree Certificate Copy')).toBe('certificate');
    expect(detectDocumentType('Upload Resume / CV')).toBe('resume');
  });

  test('4. React Framework Compatibility: property setters trigger synthetic updates', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="root">
          <label for="controlled-name">Name</label>
          <input id="controlled-name" />
          <span id="mirror-value"></span>
        </div>
        <script>
          const input = document.getElementById('controlled-name');
          const mirror = document.getElementById('mirror-value');
          input.addEventListener('input', (e) => {
            mirror.textContent = e.target.value;
          });
        </script>
      </body>
      </html>
    `);
    await page.addScriptTag({ path: 'packages/form-core/dist/form-core.iife.js' });

    await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();
      core.applyFill({ 'controlled-name': 'full_name' }, { full_name: 'Ananya Sharma' }, schema.fields, document);
    });

    // Check that input and mirror have synchronized
    expect(await page.inputValue('#controlled-name')).toBe('Ananya Sharma');
    expect(await page.textContent('#mirror-value')).toBe('Ananya Sharma');
  });
});
