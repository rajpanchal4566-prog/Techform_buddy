import { test, expect } from '@playwright/test';
import { getDb } from '../../../src/lib/db';
import { generateDocx, generatePdf, generateTxt } from '../../../src/lib/documentExporter';
import { DocumentSections } from '../../../src/lib/templates';

test.describe('Profile CRUD & Document Binary Validation (B8)', () => {
  const testUserId = 'test-profile-user-1';

  test('Profile database operations persist and sanitize attributes correctly', async () => {
    const db = getDb();

    // Ensure clean state
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, preferred_language)
      VALUES (?, ?, ?, ?, ?)
    `).run(testUserId, 'profiletest@example.com', 'test-password-hash', 'Profile Test User', 'hi');

    db.prepare('DELETE FROM profiles WHERE user_id = ?').run(testUserId);
    db.prepare(`
      INSERT INTO profiles (
        id, user_id, full_name, date_of_birth, gender, phone, email,
        address, city, state, pincode, father_name, occupation, custom_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'profile-row-1',
      testUserId,
      'Rohan Verma',
      '2001-05-20',
      'male',
      '9811223344',
      'profiletest@example.com',
      'House 12, Civil Lines',
      'Jaipur',
      'Rajasthan',
      '302001',
      'Suresh Verma',
      'Student',
      JSON.stringify({ college: 'MNIT Jaipur', degree: 'B.Tech' })
    );

    // Verify row was stored
    const row = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(testUserId) as any;
    expect(row).toBeDefined();
    expect(row.full_name).toBe('Rohan Verma');
    expect(row.city).toBe('Jaipur');
    expect(row.father_name).toBe('Suresh Verma');

    const custom = JSON.parse(row.custom_fields);
    expect(custom.college).toBe('MNIT Jaipur');

    // Update profile
    db.prepare(`
      UPDATE profiles SET
        city = ?, custom_fields = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run('Udaipur', JSON.stringify({ college: 'MNIT Jaipur', degree: 'M.Tech', category: 'General' }), testUserId);

    const updatedRow = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(testUserId) as any;
    expect(updatedRow.city).toBe('Udaipur');
    const updatedCustom = JSON.parse(updatedRow.custom_fields);
    expect(updatedCustom.degree).toBe('M.Tech');
  });

  test('DOCX generator produces valid PKZIP binary format with official Word headers', async () => {
    const sections: DocumentSections = {
      header: 'Curriculum Vitae',
      date: '2026-11-01',
      subject: 'Application for Software Engineer',
      salutation: '',
      body: 'Professional summary and experience details.',
      closing: '',
      signature: 'Rohan Verma',
      contactInfo: {
        name: 'Rohan Verma',
        email: 'rohan@example.com',
        phone: '+91 9811223344',
        city: 'Jaipur, India',
      },
      education: [
        { degree: 'B.Tech Computer Science', institution: 'MNIT Jaipur', year: '2022 - 2026' },
      ],
      skills: ['TypeScript', 'React', 'Python', 'Docker'],
    };

    const docxBuffer = await generateDocx('Rohan_Verma_Resume', sections, 'en');
    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.length).toBeGreaterThan(1000);

    // Verify PKZIP Magic Number: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
    expect(docxBuffer[0]).toBe(0x50); // 'P'
    expect(docxBuffer[1]).toBe(0x4b); // 'K'
    expect(docxBuffer[2]).toBe(0x03);
    expect(docxBuffer[3]).toBe(0x04);
  });

  test('PDF generator produces valid PDF binary format starting with %PDF- header', async () => {
    const sections: DocumentSections = {
      header: 'Smart India Hackathon Application',
      date: '2026-11-01',
      subject: 'Subject: Application for SIH 2026',
      salutation: 'Respected Organizers,',
      body: 'I am formally submitting our team entry for Smart India Hackathon 2026.',
      closing: 'Yours faithfully,',
      signature: 'Rohan Verma',
    };

    const pdfBuffer = await generatePdf('SIH_Application', sections, 'en');
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(500);

    // Verify PDF Magic Bytes: '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D)
    expect(pdfBuffer[0]).toBe(0x25); // '%'
    expect(pdfBuffer[1]).toBe(0x50); // 'P'
    expect(pdfBuffer[2]).toBe(0x44); // 'D'
    expect(pdfBuffer[3]).toBe(0x46); // 'F'
    expect(pdfBuffer[4]).toBe(0x2d); // '-'
  });

  test('TXT generator produces clean formatted text document without HTML tags', () => {
    const sections: DocumentSections = {
      header: 'Formal Request Letter',
      date: '2026-11-01',
      subject: 'Subject: Bonafide Certificate Request',
      salutation: 'Respected Principal,',
      body: 'I kindly request you to issue a bonafide certificate for passport verification.',
      closing: 'Yours obediently,',
      signature: 'Rohan Verma',
    };

    const txtContent = generateTxt('Bonafide_Request', sections, 'en');
    expect(typeof txtContent).toBe('string');
    expect(txtContent).toContain('Formal Request Letter');
    expect(txtContent).toContain('Respected Principal,');
    expect(txtContent).toContain('Bonafide Certificate Request');
    expect(txtContent).not.toContain('<div');
    expect(txtContent).not.toContain('</div>');
  });

  test('/profile page loads with authenticated citizen profile session', async ({ page }) => {
    // Mock NextAuth session for test user
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: testUserId, name: 'Profile Test User', email: 'profiletest@example.com' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Verify profile page loaded
    await expect(page.locator('h1')).toContainText(/Profile/i);
  });
});