import { test, expect } from '@playwright/test';
import {
  getTemplateById,
  generateFallbackDocument,
  DocumentSections,
} from '../../../src/lib/templates';
import { generatePdf, generateDocx, generateTxt } from '../../../src/lib/documentExporter';

test.describe('A3: Resume & Document Kinds End-to-End Verification', () => {
  // ── 1. ATS RESUME END-TO-END ──
  test('ATS Single-Column Resume produces valid PDF and DOCX without letter artifacts', async () => {
    const resumeTmpl = getTemplateById('resume');
    expect(resumeTmpl).toBeDefined();
    expect(resumeTmpl?.kind).toBe('resume');

    const sections: DocumentSections = {
      formTitle: 'Resume - Rajesh Kumar',
      date: '',
      subject: 'Curriculum Vitae',
      body: '',
      contactInfo: {
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@example.com',
        phone: '+91 9876543210',
        city: 'Bhopal, Madhya Pradesh',
        linkedin: 'linkedin.com/in/rajesh-kumar',
        github: 'github.com/rajesh-kumar',
      },
      summary: 'Motivated Computer Science graduate with hands-on experience in full-stack web development and cloud architectures. Strong foundation in TypeScript, React, and Python.',
      education: [
        {
          degree: 'B.Tech in Computer Science & Engineering',
          institution: 'Maulana Azad National Institute of Technology, Bhopal',
          year: '2021 - 2025',
          score: 'CGPA 8.7 / 10',
        },
        {
          degree: 'Higher Secondary Certificate (Class XII)',
          institution: 'Govt. Model Higher Secondary School, Bhopal',
          year: '2021',
          score: '91.4%',
        },
      ],
      skills: ['TypeScript', 'React.js', 'Next.js', 'Node.js', 'Python', 'SQL', 'Git', 'Docker'],
      projects: [
        {
          title: 'TechForm Buddy — Multilingual Form Automation Assistant',
          bullets: [
            'Architected client-side browser extension and web companion assisting citizens with online government forms.',
            'Integrated local speech-to-intent NLU with sub-500ms response time across 12 Indian languages.',
          ],
        },
        {
          title: 'Distributed Document Processing Engine',
          bullets: [
            'Built high-throughput PDF parsing and OCR extraction pipeline reducing intake time by 40%.',
          ],
        },
      ],
      experience: [
        {
          role: 'Software Development Intern',
          organization: 'National Informatics Centre (NIC)',
          period: 'June 2024 - August 2024',
          bullets: [
            'Developed citizen-facing dashboard components adhering to WCAG 2.1 AA accessibility guidelines.',
            'Implemented automated schema validation for public grievance attachments.',
          ],
        },
      ],
      certifications: [
        'AWS Certified Cloud Practitioner (2024)',
        'Postman API Fundamentals Student Expert',
      ],
      languages: ['English (Fluent)', 'Hindi (Native)'],
      declaration: 'I hereby declare that all information furnished above is true and correct to the best of my knowledge.',
      signature: 'Rajesh Kumar',
    };

    // Verify sections have NO letter artifacts
    expect(sections.salutation).toBeUndefined();
    expect(sections.header).toBeUndefined();
    expect(sections.closing).toBeUndefined();

    // 1. Generate PDF
    const pdfBuf = await generatePdf('Resume - Rajesh Kumar', sections, 'en', {
      kind: 'resume',
      dateStr: '2026-11-01',
    });
    expect(pdfBuf).toBeDefined();
    expect(pdfBuf.length).toBeGreaterThan(3000);
    // Standard PDF file starts with '%PDF'
    const pdfHeader = pdfBuf.subarray(0, 4).toString('utf8');
    expect(pdfHeader).toBe('%PDF');

    // 2. Generate DOCX
    const docxBuf = await generateDocx('Resume - Rajesh Kumar', sections, 'en', {
      kind: 'resume',
      dateStr: '2026-11-01',
    });
    expect(docxBuf).toBeDefined();
    expect(docxBuf.length).toBeGreaterThan(5000);
    // Standard DOCX (ZIP archive) starts with PK (0x50 0x4B 0x03 0x04)
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);
    expect(docxBuf[2]).toBe(0x03);
    expect(docxBuf[3]).toBe(0x04);

    // 3. Generate TXT
    const txtContent = generateTxt('Resume - Rajesh Kumar', sections, 'en', {
      kind: 'resume',
    });
    expect(txtContent).toContain('Rajesh Kumar');
    expect(txtContent).toContain('KEY SKILLS');
    expect(txtContent).toContain('EDUCATION');
    expect(txtContent).toContain('PROJECTS');
    expect(txtContent).not.toContain('Respected Sir');
    expect(txtContent).not.toContain('To,');
  });

  // ── 2. FORMAL LEAVE APPLICATION (kind: letter) ──
  test('Formal Leave Application renders letter layout in PDF and DOCX', async () => {
    const tmpl = getTemplateById('leave_application');
    expect(tmpl?.kind).toBe('letter');

    const sections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'Pooja Verma',
        designation_or_roll: 'Senior Analyst',
        organization_name: 'Infosys BPM',
        recipient_title: 'The Operations Manager',
        recipient_address: 'Hinjewadi Phase 2, Pune',
        leave_type: 'Medical Leave',
        start_date: '2026-11-05',
        end_date: '2026-11-08',
        reason: 'Viral fever and prescribed medical rest as per physician advice',
      },
      'en'
    );

    // Must have letter sections
    expect(sections.header).toBeDefined();
    expect(sections.header).toContain('The Operations Manager');
    expect(sections.salutation).toBeDefined();
    expect(sections.salutation).toContain('Respected Sir/Madam');
    expect(sections.body).toContain('Medical Leave');
    expect(sections.closing).toContain('Yours faithfully');

    // PDF
    const pdfBuf = await generatePdf('Leave Application', sections, 'en', { kind: 'letter' });
    expect(pdfBuf.subarray(0, 4).toString('utf8')).toBe('%PDF');

    // DOCX
    const docxBuf = await generateDocx('Leave Application', sections, 'en', { kind: 'letter' });
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);
  });

  // ── 3. STUDENT INTERNSHIP (kind: application_form) ──
  test('Student Internship renders structured form layout in PDF and DOCX', async () => {
    const tmpl = getTemplateById('student_internship');
    expect(tmpl?.kind).toBe('application_form');

    const sections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'Ananya Sen',
        father_name: 'Subhash Sen',
        dob: '2004-03-22',
        college: 'Jadavpur University',
        course: 'B.E. Information Technology',
        semester_year: '5th Semester',
        contact: '9830112233',
        email: 'ananya.sen@example.com',
        skills: 'Python, C++, PyTorch, Computer Vision',
        preferred_domain: 'Machine Learning Research',
        duration: '2 Months',
      },
      'en'
    );

    expect(sections.fieldsTable).toBeDefined();
    expect(sections.fieldsTable!.length).toBeGreaterThan(5);
    expect(sections.coverNote).toBeDefined();
    expect(sections.declaration).toBeDefined();

    // PDF
    const pdfBuf = await generatePdf('Student Internship Application', sections, 'en', { kind: 'application_form' });
    expect(pdfBuf.subarray(0, 4).toString('utf8')).toBe('%PDF');

    // DOCX
    const docxBuf = await generateDocx('Student Internship Application', sections, 'en', { kind: 'application_form' });
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);
  });

  // ── 4. SCHOLARSHIP APPLICATION (kind: application_form) ──
  test('Scholarship Application renders application form layout with enclosures', async () => {
    const tmpl = getTemplateById('scholarship_application');
    expect(tmpl?.kind).toBe('application_form');

    const sections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'Vikas Meena',
        father_name: 'Kailash Meena',
        college: 'Govt. Engineering College, Kota',
        course: 'B.Tech Mechanical',
        annual_income: 'Rs. 95,000/-',
      },
      'en'
    );

    expect(sections.fieldsTable).toBeDefined();
    expect(sections.declaration).toBeDefined();

    const pdfBuf = await generatePdf('Scholarship Application', sections, 'en', { kind: 'application_form' });
    expect(pdfBuf.subarray(0, 4).toString('utf8')).toBe('%PDF');

    const docxBuf = await generateDocx('Scholarship Application', sections, 'en', { kind: 'application_form' });
    expect(docxBuf[0]).toBe(0x50);
  });

  // ── 5. COMPLAINT LETTER (kind: letter) ──
  test('Complaint Letter renders formal grievance letter layout in PDF and DOCX', async () => {
    const tmpl = getTemplateById('complaint_letter');
    expect(tmpl?.kind).toBe('letter');

    const sections = generateFallbackDocument(
      tmpl!,
      {
        applicant_name: 'Sunil Sharma',
        applicant_address: '42, Shivaji Nagar, Bhopal, MP',
        recipient_title: 'The Municipal Commissioner',
        authority_name: 'Bhopal Municipal Corporation',
        incident_date: 'Past 10 days',
        complaint_subject: 'Contaminated water supply in Ward 24',
        complaint_details: 'The drinking water supplied through main pipeline is turbid with foul odor.',
        relief_sought: 'Immediate pipeline inspection and resumption of potable water supply.',
      },
      'en'
    );

    expect(sections.header).toContain('The Municipal Commissioner');
    expect(sections.subject).toContain('Contaminated water supply');
    expect(sections.salutation).toBeDefined();
    expect(sections.closing).toBeDefined();

    const pdfBuf = await generatePdf('Complaint Letter', sections, 'en', { kind: 'letter' });
    expect(pdfBuf.subarray(0, 4).toString('utf8')).toBe('%PDF');

    const docxBuf = await generateDocx('Complaint Letter', sections, 'en', { kind: 'letter' });
    expect(docxBuf[0]).toBe(0x50);
  });
});
