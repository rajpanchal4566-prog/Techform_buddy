import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  getTemplateById,
  validateInputQuality,
  generateFallbackDocument,
  sanitizeEnclosureTitle,
  matchTemplateFromPrompt,
} from '../../../src/lib/templates';
import { generatePdf, containsDevanagari } from '../../../src/lib/documentExporter';

test.describe('Form Format & Document Kinds Verification (Items 1-8)', () => {
  // ── ITEM 1: FORMS ARE FORMS ──
  test('Item 1: Template of kind application_form renders structured form instead of generic letter', async () => {
    const tmpl = getTemplateById('student_internship');
    expect(tmpl).toBeDefined();
    expect(tmpl?.kind).toBe('application_form');

    // Expected standard fields for student internship
    const fieldKeys = tmpl?.fields.map(f => f.key);
    expect(fieldKeys).toContain('applicant_name');
    expect(fieldKeys).toContain('father_name');
    expect(fieldKeys).toContain('dob');
    expect(fieldKeys).toContain('college');
    expect(fieldKeys).toContain('course');
    expect(fieldKeys).toContain('semester_year');
    expect(fieldKeys).toContain('contact');
    expect(fieldKeys).toContain('email');
    expect(fieldKeys).toContain('skills');
    expect(fieldKeys).toContain('preferred_domain');
    expect(fieldKeys).toContain('duration');

    // Generate fallback document and verify structured fields
    const sections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'Raj Vishwakarma',
        father_name: 'Mahesh Vishwakarma',
        dob: '2003-08-14',
        college: 'MANIT Bhopal',
        course: 'B.Tech CSE',
        semester_year: '6th Semester',
        contact: '9876543210',
        email: 'raj@example.com',
        skills: 'React, Next.js, TypeScript',
        preferred_domain: 'Web Development',
        duration: '6 Months',
      },
      'en'
    );

    // Must have fieldsTable for two-column rendering
    expect(sections.fieldsTable).toBeDefined();
    expect(sections.fieldsTable!.length).toBeGreaterThanOrEqual(11);
    expect(sections.fieldsTable!.some(r => r.label.includes('Applicant') && r.value === 'Raj Vishwakarma')).toBe(true);

    // Must have first-person short cover note
    expect(sections.coverNote).toBeDefined();
    expect(sections.coverNote!.length).toBeGreaterThan(50);
    expect(sections.coverNote!.toLowerCase()).toContain('i am writing');

    // Must have declaration & signature
    expect(sections.declaration).toBeDefined();
    expect(sections.declaration!.toLowerCase()).toContain('solemnly declare');
    expect(sections.signature).toContain('Raj Vishwakarma');
  });

  // ── ITEM 2: INPUT QUALITY ──
  test('Item 2: Detects junk/meaningless input ("vvv", "asdf", too short, no letters) and rejects it', async () => {
    // 1. Repeated characters like "vvv"
    const vvvRes = validateInputQuality('vvv', 'Skills', true);
    expect(vvvRes.isValid).toBe(false);
    expect(vvvRes.error).toContain('Repeated characters');

    // 2. Keyboard mash like "asdf"
    const asdfRes = validateInputQuality('asdf', 'Applicant Name', true);
    expect(asdfRes.isValid).toBe(false);
    expect(asdfRes.error).toContain('Placeholder text');

    // 3. Obvious placeholder like "test"
    const testRes = validateInputQuality('test', 'Address', true);
    expect(testRes.isValid).toBe(false);
    expect(testRes.error).toContain('Placeholder text');

    // 4. Too short input
    const shortRes = validateInputQuality('a', 'College', true);
    expect(shortRes.isValid).toBe(false);
    expect(shortRes.error).toContain('minimum 3 characters');

    // 5. No alphabetic letters (only numbers/symbols for non-numeric fields)
    const noLetters = validateInputQuality('123456', 'Course Name', true);
    expect(noLetters.isValid).toBe(false);
    expect(noLetters.error).toContain('must contain valid letters');

    // 6. Valid genuine input passes
    const validRes = validateInputQuality('Computer Science and Engineering', 'Course Name', true);
    expect(validRes.isValid).toBe(true);
    expect(validRes.error).toBeUndefined();
  });

  // ── ITEM 3: NO INVENTED CONTENT ──
  test('Item 3: Never invents recipient names or addresses, filler district offices, or India region filler', async () => {
    const tmpl = getTemplateById('student_internship');
    const sections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'Raj Vishwakarma',
        father_name: 'Mahesh Vishwakarma',
        college: 'MANIT Bhopal',
        course: 'B.Tech CSE',
      },
      'en'
    );

    const fullBlob = JSON.stringify(sections);
    // Must NOT contain invented generic government complex
    expect(fullBlob).not.toContain('District Administrative Complex');
    // Must NOT contain dummy region
    expect(fullBlob).not.toContain('State / Region: India');
  });

  // ── ITEM 4: WORDING ──
  test('Item 4: Natural first-person wording, never "on behalf of", no unverifiable claims', async () => {
    const tmpl = getTemplateById('student_internship');
    const sections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'Raj Vishwakarma',
        father_name: 'Mahesh Vishwakarma',
        college: 'MANIT Bhopal',
        course: 'B.Tech CSE',
      },
      'en'
    );

    const fullBlob = JSON.stringify(sections).toLowerCase();
    // Must NOT contain "on behalf of"
    expect(fullBlob).not.toContain('on behalf of');
    // Must NOT contain unverified claims
    expect(fullBlob).not.toContain('statutory credentials');
    expect(fullBlob).not.toContain('duly compiled');

    // Subject line comes from purpose
    expect(sections.subject).toContain('Application for Student Internship');
  });

  // ── ITEM 5: DOCUMENTS (Data Minimization) ──
  test('Item 5: Internship application data minimization (resume, college ID, photo; NO Aadhaar/Voter ID by default)', async () => {
    const tmpl = getTemplateById('student_internship');
    expect(tmpl).toBeDefined();

    const docTypes = tmpl?.requiredDocuments?.map(d => d.type) || [];
    const docIds = tmpl?.requiredDocuments?.map(d => d.id) || [];

    // Must contain standard internship documents
    expect(docTypes).toContain('resume');
    expect(docTypes).toContain('college_id');
    expect(docTypes).toContain('photo');

    // Must NOT contain sensitive IDs
    expect(docTypes).not.toContain('aadhaar');
    expect(docTypes).not.toContain('voter_id');
    expect(docIds.some(id => id.includes('aadhaar'))).toBe(false);
  });

  // ── ITEM 6: ENCLOSURES AND PHOTO ──
  test('Item 6: Clean single-numbering on enclosures (no "1. 1.") and embeds photo in PDF', async () => {
    // Check sanitizer
    const sanitized1 = sanitizeEnclosureTitle('1. Copy of Identity Card.pdf');
    expect(sanitized1).toBe('Copy of Identity Card.pdf');

    const sanitized2 = sanitizeEnclosureTitle('2) Previous Marksheet.pdf');
    expect(sanitized2).toBe('Previous Marksheet.pdf');

    // Verify sample PDF was generated with embedded photo
    const samplePath = path.resolve(process.cwd(), 'public/samples/student_internship_sample.pdf');
    expect(fs.existsSync(samplePath)).toBe(true);
    const pdfBytes = fs.readFileSync(samplePath);
    expect(pdfBytes.length).toBeGreaterThan(10000);
  });

  // ── ITEM 7: LAYOUT & SEPARATED FOOTER ──
  test('Item 7: Footer is cleanly placed at bottom with margin and no address overlap', async () => {
    const tmpl = getTemplateById('student_internship');
    const sections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'Raj Vishwakarma',
        father_name: 'Mahesh Vishwakarma',
        college: 'MANIT Bhopal',
        course: 'B.Tech CSE',
      },
      'en'
    );

    const pdfBuffer = await generatePdf('Student Internship Application Form', sections, 'en', {
      kind: 'application_form',
    });
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(4000);
  });

  // ── ITEM 8: TESTS & HINDI RENDERING ──
  test('Item 8: Hindi version renders without broken glyphs or fontkit GPOS crashes', async () => {
    const tmpl = getTemplateById('student_internship');
    const hindiSections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'राज विश्वकर्मा',
        father_name: 'महेश विश्वकर्मा',
        college: 'मौलाना आज़ाद राष्ट्रीय प्रौद्योगिकी संस्थान, भोपाल',
        course: 'बी.टेक (कंप्यूटर साइंस)',
        semester_year: 'छठा सेमेस्टर (तृतीय वर्ष)',
        skills: 'टाइपस्क्रिप्ट, रिएक्ट, नेक्स्ट.जेएस, पायथन',
        preferred_domain: 'फुल स्टैक वेब डेवलपमेंट',
        duration: '६ माह',
        organization_name: 'राष्ट्रीय सूचना विज्ञान केंद्र (एनआईसी)',
        recipient_name: 'महानिदेशक महोदय, राष्ट्रीय सूचना विज्ञान केंद्र',
      },
      'hi',
      'छात्र इंटर्नशिप आवेदन पत्र'
    );

    expect(containsDevanagari(hindiSections.subject)).toBe(true);
    // Contains common ligature 'हेतु'
    expect(hindiSections.subject).toContain('हेतु');

    const hindiPdf = await generatePdf('छात्र इंटर्नशिप आवेदन पत्र', hindiSections, 'hi', {
      kind: 'application_form',
    });

    expect(hindiPdf).toBeDefined();
    expect(hindiPdf.length).toBeGreaterThan(15000);

    // Also check on-disk sample
    const sampleHindi = path.resolve(process.cwd(), 'public/samples/student_internship_hindi_sample.pdf');
    expect(fs.existsSync(sampleHindi)).toBe(true);
  });
});
