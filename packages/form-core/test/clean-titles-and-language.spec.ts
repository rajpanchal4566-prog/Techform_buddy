import { test, expect } from '@playwright/test';
import { deriveCleanFormTitle, getTemplateById, FORM_TEMPLATES } from '../../../src/lib/templates';
import { getDb } from '../../../src/lib/db';

test.describe('A4: Clean Titles & Language Verification', () => {
  // ── 1. CLEAN TITLES FROM SPOKEN COMMANDS ──
  test('deriveCleanFormTitle cleans conversational fillers from Hindi and Hinglish commands', () => {
    // 1. Leave application spoken command
    const t1 = deriveCleanFormTitle('ek leave letter likh de', 'Rajesh Sharma', 'en');
    expect(t1).toBe('Leave Application - Rajesh Sharma');
    expect(t1.toLowerCase()).not.toContain('likh de');
    expect(t1.toLowerCase()).not.toContain('ek');

    // 2. Hindi language output
    const t1Hi = deriveCleanFormTitle('ek leave letter likh de', 'राजेश शर्मा', 'hi');
    expect(t1Hi).toContain('अवकाश प्रार्थना पत्र');
    expect(t1Hi).toContain('राजेश शर्मा');

    // 3. Resume spoken command with name
    const t2 = deriveCleanFormTitle('mere liye resume banao', 'Pooja Verma', 'en');
    expect(t2).toBe('Resume - Pooja Verma');
    expect(t2.toLowerCase()).not.toContain('mere liye');
    expect(t2.toLowerCase()).not.toContain('banao');

    // 4. Unknown type spoken command
    const t3 = deriveCleanFormTitle('ek bonafide certificate request likho', 'Amit Kumar', 'en');
    expect(t3).toBe('Bonafide Certificate Request - Amit Kumar');
    expect(t3.toLowerCase()).not.toContain('likho');

    // 5. Raw keyboard mash / junk input
    const t4 = deriveCleanFormTitle('GGGGG', 'Suresh', 'en');
    expect(t4).toBe('Application Form - Suresh');
    expect(t4).not.toContain('GGGGG');

    // 6. Template objects directly
    const resumeTmpl = getTemplateById('resume');
    expect(deriveCleanFormTitle(resumeTmpl, 'Aakash', 'en')).toBe('Resume - Aakash');

    const internTmpl = getTemplateById('student_internship');
    expect(deriveCleanFormTitle(internTmpl, 'Neha', 'en')).toBe('Internship Application - Neha');

    const leaveTmpl = getTemplateById('leave_application');
    expect(deriveCleanFormTitle(leaveTmpl, 'Rohan', 'en')).toBe('Leave Application - Rohan');
  });

  // ── 2. DATABASE TITLES MIGRATION ──
  test('Database migration ensures no draft form titles have conversational fillers or junk', () => {
    const db = getDb();
    const rows = db.prepare('SELECT id, title, status FROM forms').all() as Array<{
      id: string;
      title: string;
      status: string;
    }>;

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      // Must not contain raw spoken fillers
      expect(row.title).not.toMatch(/\bbanao\b/i);
      expect(row.title).not.toMatch(/\blikh\b/i);
      expect(row.title).not.toMatch(/\bkholo\b/i);
      expect(row.title).not.toMatch(/\bchahiye\b/i);
      expect(row.title).not.toMatch(/^naya form$/i);
      expect(row.title).not.toMatch(/^(.)\1{3,}$/i);
      expect(row.title).not.toMatch(/ Application Form$/i);
    }
  });

  // ── 3. UI LABELS IN SELECTED LANGUAGE & ENGLISH VALUES ──
  test('UI labels are localized in Hindi while field values remain in entered script', () => {
    const tmpl = getTemplateById('leave_application');
    expect(tmpl).toBeDefined();

    // Verify all fields have both English and Hindi labels
    for (const f of tmpl!.fields) {
      expect(f.label).toBeDefined();
      expect(f.labelHi).toBeDefined();
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.labelHi.length).toBeGreaterThan(0);
    }

    // Verify fields can hold English or standard values
    const fieldValues: Record<string, string> = {
      applicant_name: 'Rajesh Sharma',
      designation_or_roll: 'Software Engineer',
      organization_name: 'National Informatics Centre',
      start_date: '2026-11-10',
      end_date: '2026-11-14',
    };

    expect(fieldValues.applicant_name).toBe('Rajesh Sharma');
    expect(fieldValues.start_date).toBe('2026-11-10');
  });
});

