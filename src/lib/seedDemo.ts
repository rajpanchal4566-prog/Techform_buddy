import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';

export async function seedDemoData(): Promise<{ success: boolean; message: string; backupPath: string }> {
  const db = getDb();
  const dbPath = path.resolve(process.cwd(), 'data/techformbuddy.db');
  const backupPath = path.resolve(process.cwd(), 'data/techformbuddy.db.bak');

  // 1. Safe Backup of Database before resetting demo data
  try {
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }
  } catch (err) {
    console.warn('[SeedDemo] Backup warning (proceeding):', err);
  }

  const demoEmail = 'demo@techformbuddy.in';
  const demoPassword = 'DemoUser@2026';
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  // 2. Create or update demo user
  let user = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail) as { id: string } | undefined;
  let userId: string;

  if (user) {
    userId = user.id;
    db.prepare('UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?').run(passwordHash, userId);
  } else {
    userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, preferred_language, email_verified, auth_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, demoEmail, passwordHash, 'Aarav Sharma', 'hi', 1, 'credentials');
  }

  // 3. Citizen profile
  const customFields = {
    college: 'Maulana Azad National Institute of Technology',
    degree: 'B.Tech Computer Science',
    semester: '6th Semester',
    category: 'OBC',
    annual_income: '180000',
    skills: 'React, TypeScript, Python, Next.js, Node.js',
    preferred_domain: 'Software Engineering & Accessibility',
    duration: '6 Months',
    languages_known: 'Hindi, English, Marathi',
  };

  const existingProfile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(userId);
  if (existingProfile) {
    db.prepare(`
      UPDATE profiles SET
        full_name = ?, date_of_birth = ?, gender = ?, phone = ?, email = ?,
        address = ?, city = ?, state = ?, pincode = ?, father_name = ?,
        mother_name = ?, occupation = ?, custom_fields = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      'Aarav Sharma',
      '2002-08-15',
      'male',
      '9876543210',
      demoEmail,
      'Flat 302, Shanti Kunj, Sector 14',
      'Bhopal',
      'Madhya Pradesh',
      '462001',
      'Ramesh Sharma',
      'Sunita Sharma',
      'Student',
      JSON.stringify(customFields),
      userId
    );
  } else {
    db.prepare(`
      INSERT INTO profiles (
        id, user_id, full_name, date_of_birth, gender, phone, email,
        address, city, state, pincode, country, father_name, mother_name,
        occupation, custom_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      userId,
      'Aarav Sharma',
      '2002-08-15',
      'male',
      '9876543210',
      demoEmail,
      'Flat 302, Shanti Kunj, Sector 14',
      'Bhopal',
      'Madhya Pradesh',
      '462001',
      'India',
      'Ramesh Sharma',
      'Sunita Sharma',
      'Student',
      JSON.stringify(customFields)
    );
  }

  // 4. Sample forms (Resume + Internship Application)
  const resumeFormId = 'seed-form-resume-1';
  db.prepare('DELETE FROM forms WHERE id = ? OR user_id = ?').run(resumeFormId, userId);

  db.prepare(`
    INSERT INTO forms (id, user_id, title, description, category, fields, filled_data, status, language)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    resumeFormId,
    userId,
    'Aarav Sharma - Professional ATS Resume',
    'Single-column clean ATS resume for tech internship applications',
    'Career',
    JSON.stringify([
      { id: 'full_name', label: 'Full Legal Name', type: 'text' },
      { id: 'email', label: 'Email', type: 'email' },
      { id: 'phone', label: 'Phone', type: 'tel' },
      { id: 'college', label: 'College', type: 'text' },
      { id: 'degree', label: 'Degree', type: 'text' },
      { id: 'skills', label: 'Technical Skills', type: 'text' },
    ]),
    JSON.stringify({
      full_name: 'Aarav Sharma',
      email: demoEmail,
      phone: '9876543210',
      college: 'MANIT Bhopal',
      degree: 'B.Tech in Computer Science & Engineering',
      skills: 'TypeScript, React, Python, Tailwind CSS, Docker, Next.js',
      experience: 'Frontend Developer Intern at CivicTech Labs (Jun 2025 - Aug 2025)',
      education: 'B.Tech in CSE (CGPA: 8.7/10) - MANIT Bhopal (2022 - 2026)',
      projects: 'TechForm Buddy: Multilingual AI Form Assistance Platform',
    }),
    'completed',
    'en'
  );

  const internshipFormId = 'seed-form-internship-1';
  db.prepare(`
    INSERT INTO forms (id, user_id, title, description, category, fields, filled_data, status, language)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    internshipFormId,
    userId,
    'Student Internship Application Form',
    'Official application for summer engineering research internship',
    'Education',
    JSON.stringify([
      { id: 'name', label: 'Student Name', type: 'text' },
      { id: 'father_name', label: "Father's Name", type: 'text' },
      { id: 'college', label: 'College / University', type: 'text' },
      { id: 'duration', label: 'Internship Duration', type: 'text' },
    ]),
    JSON.stringify({
      name: 'Aarav Sharma',
      father_name: 'Ramesh Sharma',
      dob: '2002-08-15',
      college: 'Maulana Azad National Institute of Technology',
      course: 'B.Tech Computer Science',
      semester: '6th Semester',
      contact: '9876543210',
      email: demoEmail,
      skills: 'React, TypeScript, Python',
      preferred_domain: 'Web Development & Accessibility',
      duration: '6 Months',
    }),
    'completed',
    'en'
  );

  // 5. Seed sample Applications in "My Applications" tracker
  try {
    db.prepare('DELETE FROM applications WHERE user_id = ?').run(userId);
    db.prepare(`
      INSERT INTO applications (
        id, user_id, portal_name, application_number, form_title, category, status, portal_url,
        submitted_at, last_status_checked_at, next_action, reminder_enabled, reminder_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
    `).run(
      'seed-app-psk-1',
      userId,
      'Passport Seva Kendra (MEA)',
      'PSK-DEL-2026-9041',
      'Passport Re-issue (Normal 36 Pages)',
      'identity',
      'under_review',
      'https://passportindia.gov.in',
      '2026-02-10 10:30:00',
      'Physical document verification scheduled at Regional Passport Office Bhopal on March 15',
      1,
      '2026-03-14'
    );

    db.prepare(`
      INSERT INTO applications (
        id, user_id, portal_name, application_number, form_title, category, status, portal_url,
        submitted_at, last_status_checked_at, next_action, reminder_enabled, reminder_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
    `).run(
      'seed-app-nsp-1',
      userId,
      'National Scholarship Portal (NSP)',
      'NSP-2026-88123',
      'Post-Matric OBC Scholarship Application',
      'scholarship',
      'verified',
      'https://scholarships.gov.in',
      '2026-01-15 14:20:00',
      'Ministry DBT disbursal processing; bank transfer expected within 10 working days',
      1,
      '2026-03-10'
    );
  } catch (err) {
    console.warn('[SeedDemo] Applications insert warning:', err);
  }

  // 6. Form Watches
  db.prepare('DELETE FROM form_watches WHERE user_id = ?').run(userId);
  db.prepare(`
    INSERT INTO form_watches (id, user_id, search_query, category, source_url, is_active, last_checked)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('watch-sih-2026', userId, 'Smart India Hackathon', 'hackathon', 'https://sih.gov.in', 1);

  db.prepare(`
    INSERT INTO form_watches (id, user_id, search_query, category, source_url, is_active, last_checked)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run('watch-nsp-scholarship', userId, 'National Scholarship Portal', 'scholarship', 'https://scholarships.gov.in', 1);

  // 7. Grievances
  db.prepare('DELETE FROM grievances WHERE user_id = ?').run(userId);
  db.prepare(`
    INSERT INTO grievances (
      id, user_id, tracking_number, title, domain, department, description, status, priority, resolution_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'grievance-elec-1',
    userId,
    'TFB-GOV-849201',
    'Frequent voltage fluctuations in Sector 14 Bhopal',
    'government',
    'electricity',
    'Persistent low voltage and power trips occurring between 6 PM to 10 PM damaging home appliances.',
    'in_progress',
    'high',
    'Complaint acknowledged by Discom Substation 4. Line engineer scheduled for transformer inspection.'
  );

  db.prepare(`
    INSERT INTO grievances (
      id, user_id, tracking_number, title, domain, department, description, status, priority, resolution_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'grievance-edu-1',
    userId,
    'TFB-EDU-981240',
    'Pending NSP Post-Matric OBC Scholarship Disbursal',
    'education',
    'scholarship',
    'Application verified at college and state nodal officer level in January 2026. Disbursal transaction remains pending with DBT cell.',
    'under_review',
    'medium',
    'Forwarded to Ministry of Social Justice DBT verification desk.'
  );

  // 8. In-app notifications
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, is_read, link)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'notif-1',
    userId,
    'Smart India Hackathon 2026 Alert',
    'Registration for Smart India Hackathon Grand Finale is now open on sih.gov.in. Matches your active watch.',
    'info',
    0,
    '/form-watch'
  );

  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, is_read, link)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'notif-2',
    userId,
    'Grievance Status Updated',
    'Grievance TFB-GOV-849201 (Electricity) was marked In Progress: Line engineer scheduled.',
    'success',
    0,
    '/grievances?track=TFB-GOV-849201'
  );

  return {
    success: true,
    message: 'Demo dataset successfully restored for demo@techformbuddy.in',
    backupPath,
  };
}

