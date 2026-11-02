import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getTemplateById,
  FORM_TEMPLATES,
  validateDocumentSections,
  generateFallbackDocument,
  formatSectionsToFullText,
  DocumentSections,
  FormTemplate,
} from '../src/lib/templates';
import {
  generatePdf,
  generateDocx,
  generateTxt,
  getSanitizedFilename,
} from '../src/lib/documentExporter';

// Mock LLM function simulating AI generation responses
function mockLlmGenerate(
  template: FormTemplate,
  fields: Record<string, string>,
  language: 'en' | 'hi',
  scenario: 'good' | 'too_short' = 'good'
): DocumentSections {
  if (scenario === 'too_short') {
    // Deliberately deficient response (resembling the old bug)
    return {
      header: 'To Whom It May Concern',
      date: '2026-10-25',
      subject: 'Leave',
      salutation: 'Sir,',
      body: 'I need leave. Please grant.',
      closing: 'Thanks',
      signature: 'John',
    };
  }

  // Good mocked LLM output with full official structure
  if (language === 'hi') {
    const applicant = fields.applicant_name || fields.student_name || fields.account_holder_name || 'रमेश कुमार';
    return {
      header: `सेवा में,\nसक्षम प्राधिकारी / विभागाध्यक्ष,\nकार्यालय परिसर, भोपाल,\nमध्य प्रदेश - ४६२००१`,
      date: '२५ अक्टूबर २०२६',
      subject: `विषय: ${template.nameHi} के संबंध में औपचारिक प्रार्थना पत्र।`,
      salutation: 'मान्यवर महोदय,',
      body: `सविनय निवेदन है कि प्रार्थी ${applicant} आपके संस्थान / विभाग के अंतर्गत कार्यरत / पंजीकृत नागरिक है। प्रार्थी इस पत्र के माध्यम से सूचित करना चाहता है कि अनिवार्य एवं अपरिहार्य कारणों से यह आवेदन प्रस्तुत किया जाना आवश्यक हो गया है।\n\nउक्त संदर्भ में सभी आवश्यक नियमों एवं शर्तों का पूर्ण रूपेण पालन करते हुए आवश्यक अभिलेख संलग्न किए जा रहे हैं। कृपया प्रस्तुत तथ्यों की सत्यता की समीक्षा करते हुए नियमानुसार उचित एवं त्वरित स्वीकृति प्रदान करने की कृपा करें।\n\nइस संबंध में आपके द्वारा की गई त्वरित सहायता एवं सहानुभूतिपूर्ण विचार के लिए प्रार्थी सदैव आभारी रहेगा।`,
      closing: 'सधन्यवाद,\nभवदीय,',
      signature: `${applicant}\nमोबाइल: +91 9876543210\nपता: हाउस नं. १२, न्यू मार्केट, भोपाल`,
      enclosures: template.id !== 'leave_application' ? ['आधार कार्ड की प्रमाणित प्रति', 'निवास प्रमाण पत्र', 'संबंधित सहायक दस्तावेज़'] : undefined,
    };
  } else {
    const applicant = fields.applicant_name || fields.student_name || fields.account_holder_name || 'Ramesh Kumar';
    return {
      header: `To,\nThe Competent Authority / Department Head,\nAdministrative Office, Bhopal,\nMadhya Pradesh - 462001`,
      date: '25 October 2026',
      subject: `Subject: Formal Application for ${template.name} - reg.`,
      salutation: 'Respected Sir/Madam,',
      body: `I am writing this formal application to respectfully submit my request regarding ${template.name.toLowerCase()}. As a registered applicant (${applicant}), I have fulfilled all prerequisite eligibility criteria and standard procedural formalities prescribed by your department.\n\nDue to compelling and legitimate circumstances, it has become essential to submit this comprehensive representation for your administrative scrutiny. All relevant records, statutory declarations, and supporting documentation have been verified and enclosed herewith for your expeditious consideration.\n\nI therefore humbly request you to kindly review the particulars and grant the requisite approval at the earliest convenience. Your kind cooperation and prompt consideration in this matter shall be deeply appreciated.`,
      closing: 'Yours faithfully,',
      signature: `${applicant}\nContact: +91 9876543210\nAddress: House No. 12, New Market, Bhopal`,
      enclosures: template.id !== 'leave_application' ? ['Copy of Government Photo Identity Proof', 'Domicile / Residence Certificate', 'Relevant Supporting Particulars'] : undefined,
    };
  }
}

// 5 Selected Templates to test
const TEST_TEMPLATE_IDS = [
  'leave_application',
  'scholarship_application',
  'bank_kyc_letter',
  'complaint_letter',
  'rti_application',
];

// Sample form field inputs for each template
const SAMPLE_FIELDS: Record<string, Record<string, string>> = {
  leave_application: {
    applicant_name: 'Aarav Sharma',
    designation: 'Senior Analyst',
    leave_type: 'Medical Leave',
    start_date: '2026-11-01',
    end_date: '2026-11-05',
    reason: 'Undergoing medical treatment and prescribed rest by consulting physician.',
    handover_person: 'Pooja Verma',
    emergency_phone: '+91 9876543210',
  },
  scholarship_application: {
    student_name: 'Priya Patel',
    father_name: 'Mahesh Patel',
    course_name: 'B.Tech Computer Science',
    institution_name: 'National Institute of Technology',
    roll_number: 'NITB-2024-889',
    annual_income: 'INR 1,80,000',
    scholarship_scheme: 'Post-Matric Merit Scholarship Scheme',
    applicant_phone: '+91 9876543211',
  },
  bank_kyc_letter: {
    account_holder_name: 'Sunil Kumar Gupta',
    account_number: '109823456789',
    branch_name: 'Arera Colony Branch, Bhopal',
    kyc_reason: 'Periodic mandatory KYC re-validation and address verification update',
    id_proof_type: 'Aadhaar Card and PAN Card',
    registered_phone: '+91 9876543212',
    residential_address: 'Plot 45, Arera Colony, Bhopal, MP - 462016',
  },
  complaint_letter: {
    complainant_name: 'Vikram Singh',
    authority_designation: 'Chief Municipal Officer',
    organization_name: 'Bhopal Municipal Corporation',
    issue_category: 'Persistent water supply disruption and contamination',
    incident_date: '2026-10-20',
    incident_location: 'Ward 24, Zone 7, Kolar Road, Bhopal',
    detailed_facts: 'The piped municipal water connection has been discharging untreated, muddy water for over 5 consecutive days, causing severe hardship to over 150 resident households.',
    expected_relief: 'Immediate physical inspection by municipal engineers, repair of damaged supply pipeline, and restoration of clean potable water supply within 24 hours.',
    complainant_phone: '+91 9876543213',
  },
  rti_application: {
    applicant_name: 'Ananya Deshmukh',
    pio_designation: 'Public Information Officer (PIO)',
    public_authority: 'Madhya Pradesh Public Service Commission (MPPSC)',
    office_address: 'Residency Area, Daly College Road, Indore, MP',
    subject_matter: 'Inspection of certified answer sheets and cutoff marks of State Service Exam',
    information_period: 'Calendar Year 2025-2026',
    specific_questions: '1. Certified copy of evaluated marksheet of Roll No. 54201.\n2. Official category-wise cutoff marks for Mains Examination.\n3. Model answer key utilized for normalization.',
    fee_details: 'IPO No. 34F-982310 for Rs. 10/- attached',
    bpl_status: 'No (General Applicant)',
    applicant_address: 'B-14, Civil Lines, Bhopal, MP - 462002',
    applicant_phone: '+91 9876543214',
  },
};

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Starting Form/Letter Generation & Multi-Format Download Tests');
  console.log('================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  // ── TEST SUITE 1: 5 Templates in English and Hindi with Mocked LLM ──
  console.log('--- TEST SUITE 1: 5 Templates x English & Hindi Generation ---');

  for (const templateId of TEST_TEMPLATE_IDS) {
    const template = getTemplateById(templateId);
    assert(template, `Template ${templateId} must exist in registry`);

    for (const language of ['en', 'hi'] as const) {
      totalTests++;
      const testName = `[${templateId}] Language: ${language.toUpperCase()}`;
      console.log(`Testing ${testName}...`);

      const fields = SAMPLE_FIELDS[templateId] || {};

      // 1. Mocked LLM Generation
      const doc = mockLlmGenerate(template, fields, language, 'good');

      // Assert all sections are present
      assert.ok(doc.header && doc.header.length > 5, `${testName}: Header must be present`);
      assert.ok(doc.date && doc.date.length > 3, `${testName}: Date must be present`);
      assert.ok(doc.subject && doc.subject.length > 5, `${testName}: Subject must be present`);
      assert.ok(doc.salutation && doc.salutation.length > 2, `${testName}: Salutation must be present`);
      assert.ok(doc.body && doc.body.length > 150, `${testName}: Body must have comprehensive paragraphs`);
      assert.ok(doc.closing && doc.closing.length > 3, `${testName}: Closing must be present`);
      assert.ok(doc.signature && doc.signature.length > 5, `${testName}: Signature must be present`);

      if (template.fields.some(f => f.key.includes('enclosure') || f.key.includes('proof') || template.category === 'government')) {
        // Enclosures check where relevant
        if (doc.enclosures) {
          assert.ok(Array.isArray(doc.enclosures) && doc.enclosures.length > 0, `${testName}: Enclosures must be an array`);
        }
      }

      // 2. Validate document with validator
      const validation = validateDocumentSections(doc, template);
      assert.strictEqual(validation.valid, true, `${testName}: Document must pass validation rules: ${validation.errors.join(', ')}`);
      assert.ok(validation.charCount >= template.minLengthChars, `${testName}: Char count (${validation.charCount}) must meet min (${template.minLengthChars})`);

      // 3. Fallback generator verification (ensures robust offline/fallback fidelity)
      const fallbackDoc = generateFallbackDocument(template, fields, language);
      const fallbackVal = validateDocumentSections(fallbackDoc, template);
      assert.strictEqual(fallbackVal.valid, true, `${testName} fallback must be valid: ${fallbackVal.errors.join(', ')}`);
      assert.ok(fallbackVal.charCount >= template.minLengthChars, `${testName} fallback char count (${fallbackVal.charCount}) >= ${template.minLengthChars}`);

      passedTests++;
      console.log(`  ✓ Passed: ${validation.charCount} characters, all sections present.\n`);
    }
  }

  // ── TEST SUITE 2: Validation Failure & Single Automatic Retry Simulation ──
  console.log('--- TEST SUITE 2: Deficient Generation Validation & Single Auto-Retry ---');
  totalTests++;
  {
    const template = getTemplateById('leave_application')!;
    const fields = SAMPLE_FIELDS['leave_application'];

    // 1. Simulating short result (the old bug: only a few words)
    const shortDoc = mockLlmGenerate(template, fields, 'en', 'too_short');
    const firstValidation = validateDocumentSections(shortDoc, template);

    assert.strictEqual(firstValidation.valid, false, 'Short document must be flagged as invalid');
    assert.ok(
      firstValidation.errors.some(e => e.includes('insufficient') || e.includes('too brief') || e.includes('too short')),
      `Error must mention insufficient length or brief body: ${firstValidation.errors.join(', ')}`
    );
    console.log(`  ✓ Correctly rejected deficient document (${firstValidation.charCount} chars < ${template.minLengthChars} min)`);

    // 2. Simulating automatic retry once
    const retryDoc = mockLlmGenerate(template, fields, 'en', 'good');
    const retryValidation = validateDocumentSections(retryDoc, template);
    assert.strictEqual(retryValidation.valid, true, 'Retry document must pass validation');
    console.log(`  ✓ Automatic regeneration produced valid document (${retryValidation.charCount} chars)`);
    passedTests++;
  }

  // ── TEST SUITE 3: Hindi PDF Rendering & Embedded Devanagari Font ──
  console.log('\n--- TEST SUITE 3: Hindi PDF Rendering & Devanagari Font Integrity ---');
  totalTests++;
  {
    const template = getTemplateById('rti_application')!;
    const hindiDoc = mockLlmGenerate(template, SAMPLE_FIELDS['rti_application'], 'hi', 'good');

    const pdfBuffer = await generatePdf(
      template.nameHi,
      hindiDoc,
      'hi'
    );

    assert.ok(Buffer.isBuffer(pdfBuffer), 'PDF export must return a Buffer');
    assert.ok(pdfBuffer.length > 10000, `PDF buffer (${pdfBuffer.length} bytes) must contain embedded font & content`);

    // Verify PDF header
    const pdfHead = pdfBuffer.slice(0, 5).toString('ascii');
    assert.strictEqual(pdfHead, '%PDF-', 'Buffer must start with %PDF-');

    // Verify PDF binary structure contains Devanagari font references
    const pdfStr = pdfBuffer.toString('latin1');
    const hasDevanagariRef = pdfStr.includes('NotoSansDevanagari') || pdfStr.includes('Identity-H') || pdfStr.includes('FontDescriptor');
    assert.ok(hasDevanagariRef, 'PDF must contain embedded Noto Sans Devanagari font or FontDescriptor dictionary');

    // Verify no missing character markers (replacement char \uFFFD)
    const hasReplacementGlyph = pdfBuffer.includes(Buffer.from([0xEF, 0xBF, 0xBD])); // UTF-8 replacement char
    assert.strictEqual(hasReplacementGlyph, false, 'PDF must not contain Unicode replacement character (missing glyph marker)');

    console.log(`  ✓ Rendered Hindi PDF (${pdfBuffer.length} bytes) successfully without missing glyphs.`);
    passedTests++;
  }

  // ── TEST SUITE 4: DOCX & TXT Generation and Filename Formatting ──
  console.log('\n--- TEST SUITE 4: DOCX, TXT & Filename Verification ---');
  totalTests++;
  {
    const template = getTemplateById('scholarship_application')!;
    const hindiDoc = mockLlmGenerate(template, SAMPLE_FIELDS['scholarship_application'], 'hi', 'good');

    // 1. DOCX Generation
    const docxBuffer = await generateDocx(
      template.nameHi,
      hindiDoc,
      'hi'
    );

    assert.ok(Buffer.isBuffer(docxBuffer), 'DOCX export must return a Buffer');
    // Word files are zip archives starting with PK\x03\x04
    assert.strictEqual(docxBuffer[0], 0x50, 'DOCX must have PK zip header byte 0');
    assert.strictEqual(docxBuffer[1], 0x4b, 'DOCX must have PK zip header byte 1');
    assert.ok(docxBuffer.length > 5000, `DOCX buffer (${docxBuffer.length} bytes) is substantial`);

    // 2. TXT Generation
    const txtString = generateTxt(
      template.nameHi,
      hindiDoc,
      'hi'
    );
    assert.ok(txtString.includes('छात्रवृत्ति'), 'TXT must include Hindi text');
    assert.ok(txtString.includes(hindiDoc.subject), 'TXT must include Subject line');
    assert.ok(txtString.includes(hindiDoc.salutation || ''), 'TXT must include Salutation');

    // 3. Filename format: form title + date
    const testDate = new Date();
    const isoDate = testDate.toISOString().split('T')[0];
    const pdfFilename = getSanitizedFilename('Leave Application', isoDate, 'pdf');
    const docxFilename = getSanitizedFilename('छात्रवृत्ति आवेदन', isoDate, 'docx');

    assert.strictEqual(pdfFilename, `Leave_Application_${isoDate}.pdf`, 'Filename must be title + date + ext');
    assert.ok(docxFilename.includes(`_${isoDate}.docx`), 'Devanagari filename must include date and ext');

    console.log(`  ✓ DOCX created (${docxBuffer.length} bytes) with PK zip container.`);
    console.log(`  ✓ TXT created (${txtString.length} chars) with clean UTF-8 text.`);
    console.log(`  ✓ Filenames correctly formatted: "${pdfFilename}", "${docxFilename}".`);
    passedTests++;
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL TESTS PASSED: ${passedTests} / ${totalTests} test suites succeeded!`);
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
