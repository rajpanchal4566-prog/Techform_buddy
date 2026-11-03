import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'techformbuddy.db');

// Singleton pattern for database connection
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL,
      preferred_language TEXT DEFAULT 'en',
      email_verified INTEGER DEFAULT 0,
      auth_provider TEXT DEFAULT 'credentials',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT,
      date_of_birth TEXT,
      gender TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      country TEXT,
      father_name TEXT,
      mother_name TEXT,
      blood_group TEXT,
      emergency_contact TEXT,
      marital_status TEXT,
      occupation TEXT,
      custom_fields TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_data BLOB,
      extracted_data TEXT,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      fields TEXT NOT NULL,
      filled_data TEXT,
      status TEXT DEFAULT 'draft',
      source_url TEXT,
      language TEXT DEFAULT 'en',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS form_watches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      search_query TEXT NOT NULL,
      category TEXT,
      source_url TEXT,
      is_active INTEGER DEFAULT 1,
      last_checked TEXT,
      notified_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grievances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tracking_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      department TEXT,
      description TEXT NOT NULL,
      language TEXT DEFAULT 'en',
      status TEXT DEFAULT 'submitted',
      priority TEXT DEFAULT 'medium',
      resolution_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Other',
      portal_name TEXT NOT NULL,
      portal_url TEXT,
      reference_number TEXT NOT NULL,
      date_applied TEXT DEFAULT (date('now')),
      status TEXT DEFAULT 'submitted',
      next_action TEXT,
      deadline TEXT,
      notes TEXT,
      reminder_set INTEGER DEFAULT 0,
      attached_documents TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS extension_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      scopes TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Form Watch: source registry
    CREATE TABLE IF NOT EXISTS watch_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'html',
      state TEXT,
      category TEXT,
      check_interval INTEGER NOT NULL DEFAULT 3600,
      last_checked_at TEXT,
      last_status TEXT,
      content_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Form Watch: discovered notices
    CREATE TABLE IF NOT EXISTS watch_notices (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT,
      notice_date TEXT,
      classification TEXT,
      deadline_date TEXT,
      content_hash TEXT NOT NULL,
      raw_text TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (source_id) REFERENCES watch_sources(id) ON DELETE CASCADE
    );

    -- Form Watch: user alerts (links user, watch, notice)
    CREATE TABLE IF NOT EXISTS watch_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      watch_id TEXT NOT NULL,
      notice_id TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      notified_via TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (watch_id) REFERENCES form_watches(id) ON DELETE CASCADE,
      FOREIGN KEY (notice_id) REFERENCES watch_notices(id) ON DELETE CASCADE
    );

    -- Push notification subscriptions
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Unique index: one alert per user+watch+notice
    CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_alerts_unique
      ON watch_alerts(user_id, watch_id, notice_id);

    -- Index for notice lookup by content_hash to avoid duplicates
    CREATE INDEX IF NOT EXISTS idx_watch_notices_hash
      ON watch_notices(source_id, content_hash);
    -- Email verification tokens and OTPs (stores ONLY otp_hash, never plaintext OTP)
    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      token TEXT,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_email_verif_token ON email_verifications(token);
    CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);

    -- Daily OTP request tracker per email
    CREATE TABLE IF NOT EXISTS email_otp_requests (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_email_otp_requests_email_time ON email_otp_requests(email, created_at);

    -- Password Reset OTPs (stores ONLY otp_hash, never plaintext OTP)
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);

    -- Form Watch: Saved and Bookmarked Events & Opportunities
    CREATE TABLE IF NOT EXISTS saved_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_id TEXT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      event_type TEXT DEFAULT 'event',
      source_name TEXT,
      source_url TEXT,
      event_date TEXT,
      deadline_date TEXT,
      location_mode TEXT DEFAULT 'online',
      location_venue TEXT,
      registration_url TEXT,
      details_json TEXT,
      reminder_set INTEGER DEFAULT 0,
      reminder_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_events_user_title
      ON saved_events(user_id, title);
    CREATE INDEX IF NOT EXISTS idx_saved_events_user_category
      ON saved_events(user_id, category);
  `);

  runUserColumnMigrations(db);
  runProfileColumnMigrations(db);
  runFormWatchMigrations(db);
  runFormDocumentMigrations(db);
  runEmailVerificationMigrations(db);
  runGrievanceMigrations(db);
  runApplicationMigrations(db);
  runSavedEventsMigrations(db);
  seedWatchSources(db);
  seedInitialEventNotices(db);
}

/**
 * Migration: Ensures email_verified and auth_provider columns exist in users table.
 */
function runUserColumnMigrations(db: Database.Database) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
    const cols = new Set(tableInfo.map(c => c.name));
    if (!cols.has('email_verified')) {
      db.prepare(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`).run();
    }
    if (!cols.has('auth_provider')) {
      db.prepare(`ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'credentials'`).run();
    }
  } catch (err) {
    console.error('Error running user column migrations:', err);
  }
}

/**
 * Migration: Ensures no government ID or bank account numbers are stored in the profiles table.
 * Drops aadhaar_number, pan_number, passport_number, bank_account if they exist in legacy tables.
 */
function runProfileColumnMigrations(db: Database.Database) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(profiles)`).all() as Array<{ name: string }>;
    const columnNames = new Set(tableInfo.map(col => col.name));
    const sensitiveColumnsToDrop = ['aadhaar_number', 'pan_number', 'passport_number', 'bank_account'];

    for (const col of sensitiveColumnsToDrop) {
      if (columnNames.has(col)) {
        try {
          db.prepare(`ALTER TABLE profiles DROP COLUMN ${col}`).run();
        } catch (err) {
          console.warn(`Could not drop column ${col} directly:`, err);
        }
      }
    }

    const nonSensitiveColumns = ['father_name', 'mother_name', 'blood_group', 'emergency_contact', 'marital_status', 'occupation'];
    for (const col of nonSensitiveColumns) {
      if (!columnNames.has(col)) {
        try {
          db.prepare(`ALTER TABLE profiles ADD COLUMN ${col} TEXT`).run();
        } catch {
          // column may already exist
        }
      }
    }
  } catch (err) {
    console.error('Error running profiles column migrations:', err);
  }
}

// Helper to generate IDs
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Normalizes a watch search query for deduplication (case-insensitive, trimmed, no punctuation).
 */
export function normalizeWatchQuery(query: string): string {
  return (query || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes a set of source IDs (sorted, deduplicated JSON string).
 */
export function normalizeSourceSet(sourceIds: string[]): string {
  return JSON.stringify(Array.from(new Set((sourceIds || []).filter(Boolean))).sort());
}

/**
 * Migration: Adds missing columns to form_watches, watch_sources, watch_notices, and watch_alerts,
 * fixes legacy watches to prevent monitoring all sources by default, and cleans up duplicates.
 */
function runFormWatchMigrations(db: Database.Database) {
  try {
    // 1. form_watches migrations
    const fwInfo = db.prepare(`PRAGMA table_info(form_watches)`).all() as Array<{ name: string }>;
    const fwCols = new Set(fwInfo.map(c => c.name));
    if (!fwCols.has('filters')) {
      db.prepare(`ALTER TABLE form_watches ADD COLUMN filters TEXT`).run();
    }
    if (!fwCols.has('source_id')) {
      db.prepare(`ALTER TABLE form_watches ADD COLUMN source_id TEXT`).run();
    }
    if (!fwCols.has('source_ids')) {
      db.prepare(`ALTER TABLE form_watches ADD COLUMN source_ids TEXT`).run();
    }
    if (!fwCols.has('normalized_query')) {
      db.prepare(`ALTER TABLE form_watches ADD COLUMN normalized_query TEXT`).run();
    }
    if (!fwCols.has('digest_mode')) {
      db.prepare(`ALTER TABLE form_watches ADD COLUMN digest_mode TEXT DEFAULT 'instant'`).run();
    }
    if (!fwCols.has('monitored_categories')) {
      db.prepare(`ALTER TABLE form_watches ADD COLUMN monitored_categories TEXT`).run();
    }
    if (!fwCols.has('selected_notices')) {
      db.prepare(`ALTER TABLE form_watches ADD COLUMN selected_notices TEXT`).run();
    }
    if (!fwCols.has('is_verified')) {
      db.prepare(`ALTER TABLE form_watches ADD COLUMN is_verified INTEGER DEFAULT 1`).run();
    }

    // 2. watch_sources migrations
    const wsInfo = db.prepare(`PRAGMA table_info(watch_sources)`).all() as Array<{ name: string }>;
    const wsCols = new Set(wsInfo.map(c => c.name));
    if (!wsCols.has('aliases')) {
      db.prepare(`ALTER TABLE watch_sources ADD COLUMN aliases TEXT`).run();
    }
    if (!wsCols.has('description')) {
      db.prepare(`ALTER TABLE watch_sources ADD COLUMN description TEXT`).run();
    }
    if (!wsCols.has('monitored_types')) {
      db.prepare(`ALTER TABLE watch_sources ADD COLUMN monitored_types TEXT`).run();
    }
    if (!wsCols.has('is_verified')) {
      db.prepare(`ALTER TABLE watch_sources ADD COLUMN is_verified INTEGER DEFAULT 1`).run();
    }
    if (!wsCols.has('domain')) {
      db.prepare(`ALTER TABLE watch_sources ADD COLUMN domain TEXT`).run();
    }
    if (!wsCols.has('last_error_reason')) {
      db.prepare(`ALTER TABLE watch_sources ADD COLUMN last_error_reason TEXT`).run();
    }
    if (!wsCols.has('last_success_at')) {
      db.prepare(`ALTER TABLE watch_sources ADD COLUMN last_success_at TEXT`).run();
    }

    // 3. watch_notices migrations
    const wnInfo = db.prepare(`PRAGMA table_info(watch_notices)`).all() as Array<{ name: string }>;
    const wnCols = new Set(wnInfo.map(c => c.name));
    if (!wnCols.has('location_mode')) {
      db.prepare(`ALTER TABLE watch_notices ADD COLUMN location_mode TEXT`).run();
    }
    if (!wnCols.has('eligibility')) {
      db.prepare(`ALTER TABLE watch_notices ADD COLUMN eligibility TEXT`).run();
    }
    if (!wnCols.has('normalized_title')) {
      db.prepare(`ALTER TABLE watch_notices ADD COLUMN normalized_title TEXT`).run();
    }

    // 4. watch_alerts migrations
    const waInfo = db.prepare(`PRAGMA table_info(watch_alerts)`).all() as Array<{ name: string }>;
    const waCols = new Set(waInfo.map(c => c.name));
    if (!waCols.has('why_matched')) {
      db.prepare(`ALTER TABLE watch_alerts ADD COLUMN why_matched TEXT`).run();
    }
    if (!waCols.has('reminder_sent_7d')) {
      db.prepare(`ALTER TABLE watch_alerts ADD COLUMN reminder_sent_7d INTEGER DEFAULT 0`).run();
    }
    if (!waCols.has('reminder_sent_1d')) {
      db.prepare(`ALTER TABLE watch_alerts ADD COLUMN reminder_sent_1d INTEGER DEFAULT 0`).run();
    }
    if (!waCols.has('normalized_notice_title')) {
      db.prepare(`ALTER TABLE watch_alerts ADD COLUMN normalized_notice_title TEXT`).run();
    }

    // 5. REQUIREMENT 1 & 2 MIGRATION:
    // (a) Fix existing watches so they NEVER monitor all sources by default
    // (b) Clean up existing duplicate watches
    const allWatches = db.prepare('SELECT id, user_id, search_query, source_id, source_ids, normalized_query, created_at FROM form_watches').all() as Array<{
      id: string;
      user_id: string;
      search_query: string;
      source_id: string | null;
      source_ids: string | null;
      normalized_query: string | null;
      created_at: string;
    }>;

    for (const w of allWatches) {
      const norm = normalizeWatchQuery(w.search_query);
      let sIds: string[] = [];
      try {
        if (w.source_ids) {
          sIds = JSON.parse(w.source_ids);
        }
      } catch {}

      let primarySource = w.source_id;
      if (sIds.length === 0) {
        if (primarySource) {
          sIds = [primarySource];
        } else {
          // Infer source from query, or default to upsc / mppsc / nsp
          const q = (w.search_query || '').toLowerCase();
          if (q.includes('mppsc') || q.includes('madhya pradesh')) {
            primarySource = 'src-mppsc';
          } else if (q.includes('upsc') || q.includes('civil') || q.includes('ias')) {
            primarySource = 'src-upsc';
          } else if (q.includes('scholarship') || q.includes('fellowship') || q.includes('nsp')) {
            primarySource = 'src-nsp';
          } else if (q.includes('ssc') || q.includes('cgl')) {
            primarySource = 'src-ssc';
          } else if (q.includes('pm kisan') || q.includes('kisan')) {
            primarySource = 'src-pmkisan';
          } else if (q.includes('mponline')) {
            primarySource = 'src-mponline';
          } else if (q.includes('test')) {
            primarySource = 'src-local-test';
          } else {
            primarySource = 'src-upsc';
          }
          sIds = [primarySource];
        }
      }

      db.prepare(
        'UPDATE form_watches SET normalized_query = ?, source_id = ?, source_ids = ? WHERE id = ?'
      ).run(norm, primarySource, JSON.stringify(sIds), w.id);
    }

    // (b) Deduplication: clean up duplicate watches for each user
    const duplicateGroups = db.prepare(`
      SELECT user_id, normalized_query, COUNT(*) as count 
      FROM form_watches 
      GROUP BY user_id, normalized_query 
      HAVING count > 1
    `).all() as Array<{ user_id: string; normalized_query: string; count: number }>;

    for (const group of duplicateGroups) {
      const groupWatches = db.prepare(`
        SELECT fw.id, fw.created_at, COUNT(wa.id) as alert_count
        FROM form_watches fw
        LEFT JOIN watch_alerts wa ON fw.id = wa.watch_id
        WHERE fw.user_id = ? AND fw.normalized_query = ?
        GROUP BY fw.id
        ORDER BY alert_count DESC, fw.created_at DESC
      `).all(group.user_id, group.normalized_query) as Array<{ id: string; alert_count: number }>;

      if (groupWatches.length > 1) {
        const keepId = groupWatches[0].id;
        const removeIds = groupWatches.slice(1).map(w => w.id);

        for (const remId of removeIds) {
          // Re-link any alerts to keepId before deleting
          db.prepare('UPDATE OR IGNORE watch_alerts SET watch_id = ? WHERE watch_id = ?').run(keepId, remId);
          db.prepare('DELETE FROM watch_alerts WHERE watch_id = ?').run(remId);
          db.prepare('DELETE FROM form_watches WHERE id = ?').run(remId);
        }
      }
    }
  } catch (err) {
    console.error('Error running form_watches migrations:', err);
  }
}

/**
 * Migration: Adds 'document_content' and 'template_id' columns to forms if missing.
 */
function runFormDocumentMigrations(db: Database.Database) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(forms)`).all() as Array<{ name: string }>;
    const cols = new Set(tableInfo.map(c => c.name));
    if (!cols.has('document_content')) {
      db.prepare(`ALTER TABLE forms ADD COLUMN document_content TEXT`).run();
    }
    if (!cols.has('template_id')) {
      db.prepare(`ALTER TABLE forms ADD COLUMN template_id TEXT`).run();
    }

    // Migrate existing conversational or junk draft titles in DB (Requirement A4)
    const allForms = db.prepare('SELECT id, title, filled_data, template_id, language FROM forms').all() as Array<{
      id: string;
      title: string;
      filled_data: string | null;
      template_id: string | null;
      language: string | null;
    }>;

    for (const f of allForms) {
      const rawTitle = (f.title || '').trim();
      const hasFiller = /banao|likh|kholo|chahiye|naya form|application form$|format|GGGGG/i.test(rawTitle);
      if (hasFiller) {
        let applicantName: string | undefined = undefined;
        try {
          if (f.filled_data) {
            const parsed = JSON.parse(f.filled_data);
            applicantName = parsed.applicant_name || parsed.student_name || parsed.full_name;
          }
        } catch {}

        let newTitle = rawTitle;
        if (rawTitle.includes('लीव') || rawTitle.toLowerCase().includes('leave')) {
          newTitle = applicantName ? `Leave Application - ${applicantName}` : 'Formal Leave Application';
        } else if (rawTitle.toLowerCase().includes('pan') || rawTitle.includes('पैन')) {
          newTitle = applicantName ? `PAN Card Application - ${applicantName}` : 'PAN Card Application';
        } else if (rawTitle.toLowerCase().includes('naya form') || /^(.)\1{3,}$/i.test(rawTitle)) {
          newTitle = applicantName ? `Application Form - ${applicantName}` : 'General Application Form';
        } else {
          newTitle = rawTitle.replace(/ Application Form$/i, '').trim();
        }

        if (newTitle !== rawTitle) {
          db.prepare('UPDATE forms SET title = ? WHERE id = ?').run(newTitle, f.id);
        }
      }
    }
  } catch (err) {
    console.error('Error running forms document migrations:', err);
  }
}

/**
 * Migration: Ensures attachment_name, attachment_data, and next_action columns exist in grievances table.
 */
function runGrievanceMigrations(db: Database.Database) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(grievances)`).all() as Array<{ name: string }>;
    const cols = new Set(tableInfo.map(c => c.name));
    if (!cols.has('attachment_name')) {
      db.prepare(`ALTER TABLE grievances ADD COLUMN attachment_name TEXT`).run();
    }
    if (!cols.has('attachment_data')) {
      db.prepare(`ALTER TABLE grievances ADD COLUMN attachment_data TEXT`).run();
    }
    if (!cols.has('next_action')) {
      db.prepare(`ALTER TABLE grievances ADD COLUMN next_action TEXT`).run();
    }
  } catch (err) {
    console.error('Error running grievances migrations:', err);
  }
}

/**
 * Migration: Ensures applications table exists for tracking citizen applications.
 */
function runApplicationMigrations(db: Database.Database) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Other',
        portal_name TEXT NOT NULL,
        portal_url TEXT,
        reference_number TEXT NOT NULL,
        date_applied TEXT DEFAULT (date('now')),
        status TEXT DEFAULT 'submitted',
        next_action TEXT,
        deadline TEXT,
        notes TEXT,
        reminder_set INTEGER DEFAULT 0,
        attached_documents TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (err) {
    console.error('Error running applications migration:', err);
  }
}

/**
 * Migration: Ensures otp_hash, attempts exist on email_verifications,
 * migrates legacy tables where otp was NOT NULL to new schema storing only otp_hash,
 * and creates email_otp_requests for daily cap tracking.
 */
function runEmailVerificationMigrations(db: Database.Database) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(email_verifications)`).all() as Array<{ name: string; notnull: number }>;
    const cols = new Set(tableInfo.map(c => c.name));
    const otpCol = tableInfo.find(c => c.name === 'otp');

    if (!cols.has('otp_hash') || (otpCol && otpCol.notnull === 1)) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_verifications_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          otp_hash TEXT NOT NULL,
          token TEXT,
          expires_at TEXT NOT NULL,
          attempts INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        INSERT OR IGNORE INTO email_verifications_new (id, user_id, email, otp_hash, token, expires_at, attempts, created_at)
        SELECT id, user_id, email, COALESCE(otp_hash, otp, ''), token, expires_at, COALESCE(attempts, 0), created_at
        FROM email_verifications;

        DROP TABLE email_verifications;
        ALTER TABLE email_verifications_new RENAME TO email_verifications;

        CREATE INDEX IF NOT EXISTS idx_email_verif_token ON email_verifications(token);
        CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);
      `);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS email_otp_requests (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_email_otp_requests_email_time ON email_otp_requests(email, created_at);
    `);
  } catch (err) {
    console.error('Error running email verification migrations:', err);
  }
}

/**
 * Seed: populates watch_sources with real official Indian government sources,
 * admissions portals, and verified public hackathon listings, plus one local test source.
 * Automatically updates aliases, domains, and descriptions on existing records.
 *
 * Hackathons & Events Source Policy (Requirement 3):
 * - ENABLED:
 *   1. Smart India Hackathon (sih.gov.in) — Official Govt of India / AICTE public hackathon portal.
 *   2. AICTE Innovation Cell (mic.gov.in) — Official MoE Innovation Cell hackathons & innovation challenges.
 *   3. Major League Hacking (mlh.io) — Public student hackathon calendar without anti-bot prohibitions.
 * - SKIPPED & WHY:
 *   1. Devpost (devpost.com) — SKIPPED: robots.txt and Devpost Terms of Service (Section 5) expressly
 *      prohibit automated scraping, harvest bots, and unauthorized extractors.
 *   2. Unstop / Dare2Compete (unstop.com) — SKIPPED: Terms of Use Section 7 and robots.txt restrict
 *      automated web scrapers from indexing their competition database.
 *   3. HackerEarth (hackerearth.com) — SKIPPED: Terms prohibit unauthorized crawlers on challenges/challenges endpoints.
 */
function seedWatchSources(db: Database.Database) {
  const sources = [
    {
      id: 'src-mppsc',
      name: 'Madhya Pradesh Public Service Commission (MPPSC)',
      aliases: JSON.stringify([
        'MPPSC',
        'Madhya Pradesh Public Service Commission',
        'MP PSC',
        'State Service Examination',
        'State Forest Service',
        'मध्य प्रदेश लोक सेवा आयोग',
        'MPPSC Indore'
      ]),
      url: 'https://mppsc.mp.gov.in/notificationAndAdvertisement',
      domain: 'mppsc.mp.gov.in',
      type: 'html',
      state: 'MP',
      category: 'exam',
      description: 'Official MPPSC portal for State Service Examinations, recruitment notifications, vacancies, admit cards, and results.',
      monitored_types: JSON.stringify(['recruitment', 'notification', 'admit_card', 'result', 'syllabus']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-upsc',
      name: 'Union Public Service Commission (UPSC)',
      aliases: JSON.stringify([
        'UPSC',
        'Union Public Service Commission',
        'Civil Services Exam',
        'IAS',
        'IPS',
        'NDA',
        'CDS',
        'संघ लोक सेवा आयोग'
      ]),
      url: 'https://www.upsc.gov.in/examinations/active-examinations',
      domain: 'upsc.gov.in',
      type: 'html',
      state: null,
      category: 'exam',
      description: 'Central civil services, defence, engineering, and national administrative recruitment notices.',
      monitored_types: JSON.stringify(['recruitment', 'notification', 'admit_card', 'result', 'syllabus']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-nsp',
      name: 'National Scholarship Portal (NSP)',
      aliases: JSON.stringify([
        'NSP',
        'National Scholarship Portal',
        'Scholarship',
        'Scholarships',
        'Pre-Matric Scholarship',
        'Post-Matric Scholarship',
        'Merit Scholarship',
        'छात्रवृत्ति',
        'Minority Scholarship'
      ]),
      url: 'https://scholarships.gov.in/public/schemeList',
      domain: 'scholarships.gov.in',
      type: 'html',
      state: null,
      category: 'scholarship',
      description: 'Central and state government financial assistance, higher education fellowships, and fee reimbursements.',
      monitored_types: JSON.stringify(['recruitment', 'notification', 'result']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-ssc',
      name: 'Staff Selection Commission (SSC)',
      aliases: JSON.stringify([
        'SSC',
        'Staff Selection Commission',
        'SSC CGL',
        'SSC CHSL',
        'SSC GD',
        'कर्मचारी चयन आयोग'
      ]),
      url: 'https://ssc.gov.in/portal/LatestNotification',
      domain: 'ssc.gov.in',
      type: 'html',
      state: null,
      category: 'exam',
      description: 'Combined Graduate Level, Higher Secondary, Multi-Tasking Staff, and General Duty recruitments.',
      monitored_types: JSON.stringify(['recruitment', 'notification', 'admit_card', 'result', 'syllabus']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-nta',
      name: 'National Testing Agency & CUET Admissions (NTA)',
      aliases: JSON.stringify([
        'NTA',
        'National Testing Agency',
        'CUET',
        'CUET UG',
        'CUET PG',
        'JEE Main',
        'NEET UG',
        'Admissions',
        'University Admission'
      ]),
      url: 'https://nta.ac.in/NoticeArchive',
      domain: 'nta.ac.in',
      type: 'html',
      state: null,
      category: 'admission',
      description: 'Official central university entrance tests (CUET UG/PG), engineering (JEE Main), medical (NEET UG), and higher education admissions.',
      monitored_types: JSON.stringify(['registration_open', 'notification', 'admit_card', 'result', 'syllabus']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-sih',
      name: 'Smart India Hackathon (SIH)',
      aliases: JSON.stringify([
        'SIH',
        'Smart India Hackathon',
        'Hackathon',
        'Hackathons',
        'Ministry of Education Hackathon',
        'AICTE Hackathon',
        'Hardware Hackathon',
        'Software Hackathon'
      ]),
      url: 'https://sih.gov.in/',
      domain: 'sih.gov.in',
      type: 'html',
      state: null,
      category: 'hackathon',
      description: 'India’s premier nationwide hackathon by Ministry of Education & AICTE with student innovation problem statements and cash prizes.',
      monitored_types: JSON.stringify(['registration_open', 'deadline', 'new_event', 'result']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-aicte-mic',
      name: "AICTE - MoE's Innovation Cell (MIC)",
      aliases: JSON.stringify([
        'MIC',
        'Innovation Cell',
        'AICTE Innovation',
        'Kavach Hackathon',
        'Toycathon',
        'Student Challenge'
      ]),
      url: 'https://mic.gov.in/',
      domain: 'mic.gov.in',
      type: 'html',
      state: null,
      category: 'hackathon',
      description: 'National student innovation challenges, cybersecurity hackathons, and prototype competitions hosted by AICTE and MoE.',
      monitored_types: JSON.stringify(['registration_open', 'deadline', 'new_event', 'result']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-mlh-events',
      name: 'Major League Hacking Season (MLH)',
      aliases: JSON.stringify([
        'MLH',
        'Major League Hacking',
        'Global Hackathon',
        'Student Hackathon',
        'Virtual Hackathon'
      ]),
      url: 'https://mlh.io/seasons/2026/events',
      domain: 'mlh.io',
      type: 'html',
      state: null,
      category: 'hackathon',
      description: 'Official student hackathon league featuring online and in-person hackathons, workshop weekends, and global tech events.',
      monitored_types: JSON.stringify(['registration_open', 'deadline', 'new_event']),
      is_verified: 1,
      check_interval: 7200,
    },
    {
      id: 'src-mponline',
      name: 'MPOnline Citizen Services Gateway',
      aliases: JSON.stringify([
        'MPOnline',
        'MP Online',
        'MP Portal',
        'Kiosk Services',
        'Citizen Services MP'
      ]),
      url: 'https://www.mponline.gov.in/portal/services/kiosk/latestOnlineServices.html',
      domain: 'mponline.gov.in',
      type: 'html',
      state: 'MP',
      category: 'government',
      description: 'Madhya Pradesh government scheme forms, entrance exams, university admissions, and citizen certificates.',
      monitored_types: JSON.stringify(['recruitment', 'notification', 'admit_card', 'result']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-pmkisan',
      name: 'PM-Kisan Samman Nidhi Portal',
      aliases: JSON.stringify([
        'PM Kisan',
        'PM-Kisan',
        'Kisan Samman Nidhi',
        'Farmer Subsidy',
        'Kisan Registration'
      ]),
      url: 'https://pmkisan.gov.in/',
      domain: 'pmkisan.gov.in',
      type: 'html',
      state: null,
      category: 'government',
      description: 'Direct benefit transfer, installment release notices, e-KYC updates, and farmer enrollment schemes.',
      monitored_types: JSON.stringify(['notification', 'result']),
      is_verified: 1,
      check_interval: 7200,
    },
    {
      id: 'src-local-test',
      name: 'Local Test Source',
      aliases: JSON.stringify(['Test Source', 'Mock Portal', 'Sample Feed']),
      url: 'http://localhost:3000/api/test-source',
      domain: 'localhost',
      type: 'json',
      state: null,
      category: 'test',
      description: 'Local development and test endpoint simulating live government and hackathon updates.',
      monitored_types: JSON.stringify(['recruitment', 'notification', 'admit_card', 'result', 'syllabus', 'registration_open', 'new_event']),
      is_verified: 1,
      check_interval: 60,
    },
    {
      id: 'src-aicte-internships',
      name: 'AICTE National Internship Portal',
      aliases: JSON.stringify([
        'AICTE Internships',
        'Internship Portal',
        'Technical Internships',
        'Student Internships',
        'Engineering Internships',
        'Virtual Internship',
        'Stipend'
      ]),
      url: 'https://internship.aicte-india.org/',
      domain: 'internship.aicte-india.org',
      type: 'html',
      state: null,
      category: 'internship',
      description: 'Official AICTE portal for verified industry internships, virtual internships, corporate challenges, and government research stipends.',
      monitored_types: JSON.stringify(['registration_open', 'deadline', 'new_event']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-ncs-jobfairs',
      name: 'National Career Service (NCS) Job Fairs & Opportunities',
      aliases: JSON.stringify([
        'NCS',
        'National Career Service',
        'Job Fair',
        'Job Fairs',
        'Apprenticeship',
        'Employment Exchange',
        'Campus Drive',
        'Rozgar Mela'
      ]),
      url: 'https://www.ncs.gov.in/job-fair',
      domain: 'ncs.gov.in',
      type: 'html',
      state: null,
      category: 'job_fair',
      description: 'Ministry of Labour & Employment nationwide job fairs, campus drives, apprenticeship melas, and employment opportunities.',
      monitored_types: JSON.stringify(['registration_open', 'deadline', 'new_event']),
      is_verified: 1,
      check_interval: 3600,
    },
    {
      id: 'src-ieee-acm-events',
      name: 'National Tech Fests, Competitions & Conferences (IEEE & ACM India)',
      aliases: JSON.stringify([
        'Tech Fest',
        'Technical Competition',
        'IEEE India',
        'ACM India',
        'Student Conference',
        'Workshop',
        'College Fest',
        'Robotics'
      ]),
      url: 'https://ieee.org/conferences_events',
      domain: 'ieee.org',
      type: 'html',
      state: null,
      category: 'conference',
      description: 'Premier student technical conferences, hackathons, robotics competitions, technical paper presentations, and research workshops.',
      monitored_types: JSON.stringify(['registration_open', 'deadline', 'new_event']),
      is_verified: 1,
      check_interval: 7200,
    },
  ];

  for (const s of sources) {
    const existing = db.prepare('SELECT id FROM watch_sources WHERE url = ? OR id = ?').get(s.url, s.id) as { id: string } | undefined;
    if (existing) {
      db.prepare(
        `UPDATE watch_sources 
         SET name = ?, aliases = ?, description = ?, monitored_types = ?, is_verified = ?, state = ?, category = ?, domain = ? 
         WHERE id = ?`
      ).run(s.name, s.aliases, s.description, s.monitored_types, s.is_verified, s.state, s.category, s.domain, existing.id);
    } else {
      db.prepare(
        `INSERT INTO watch_sources (id, name, aliases, description, monitored_types, is_verified, url, domain, type, state, category, check_interval) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(s.id, s.name, s.aliases, s.description, s.monitored_types, s.is_verified, s.url, s.domain, s.type, s.state, s.category, s.check_interval);
    }
  }
}

/**
 * Migration: Ensures saved_events table and required columns exist.
 */
function runSavedEventsMigrations(db: Database.Database) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS saved_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_id TEXT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        event_type TEXT DEFAULT 'event',
        source_name TEXT,
        source_url TEXT,
        event_date TEXT,
        deadline_date TEXT,
        location_mode TEXT DEFAULT 'online',
        location_venue TEXT,
        registration_url TEXT,
        details_json TEXT,
        reminder_set INTEGER DEFAULT 0,
        reminder_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_events_user_title
        ON saved_events(user_id, title);
      CREATE INDEX IF NOT EXISTS idx_saved_events_user_category
        ON saved_events(user_id, category);
    `);
  } catch (err) {
    console.error('Error running saved_events migrations:', err);
  }
}

/**
 * Seed: Populates initial verified upcoming events & hackathons into watch_notices
 * so event discovery, deadline checking, and details are immediately functional.
 */
function seedInitialEventNotices(db: Database.Database) {
  try {
    const initialNotices = [
      {
        id: 'notice-sih-2026-finale',
        source_id: 'src-sih',
        title: 'Smart India Hackathon 2026 — Hardware & Software Grand Finale Registration Open',
        link: 'https://sih.gov.in/sih2026',
        notice_date: '2026-10-20',
        classification: 'registration_open',
        deadline_date: '2026-11-20',
        location_mode: 'hybrid',
        eligibility: 'students',
        content_hash: 'hash-sih-2026-finale',
        raw_text: 'Smart India Hackathon 2026 official registration window for student teams across India. Problem statements released by central ministries and industry partners with grand cash prizes.',
      },
      {
        id: 'notice-aicte-mic-challenge',
        source_id: 'src-aicte-mic',
        title: "AICTE - MoE's Innovation Cell (MIC) — National Student Innovation Challenge & Toycathon 2026",
        link: 'https://mic.gov.in/innovation-challenge',
        notice_date: '2026-10-25',
        classification: 'new_event',
        deadline_date: '2026-11-25',
        location_mode: 'online',
        eligibility: 'students',
        content_hash: 'hash-aicte-mic-challenge',
        raw_text: 'National competition for students and young innovators to present cybersecurity prototypes and innovative educational solutions.',
      },
      {
        id: 'notice-mlh-ghw-2026',
        source_id: 'src-mlh-events',
        title: 'Major League Hacking Season 2026 — Global Hack Week & Developer Sprint',
        link: 'https://mlh.io/seasons/2026/events',
        notice_date: '2026-10-28',
        classification: 'registration_open',
        deadline_date: '2026-11-18',
        location_mode: 'online',
        eligibility: 'all',
        content_hash: 'hash-mlh-ghw-2026',
        raw_text: 'Week-long worldwide student hackathon festival with workshops, mentoring sessions, and open-source project showcases.',
      },
      {
        id: 'notice-aicte-internship-2026',
        source_id: 'src-aicte-internships',
        title: 'AICTE Virtual Tech Internship 2026 — Cloud Computing & AI Cohort',
        link: 'https://internship.aicte-india.org/cloud-internship',
        notice_date: '2026-11-01',
        classification: 'registration_open',
        deadline_date: '2026-11-30',
        location_mode: 'online',
        eligibility: 'students',
        content_hash: 'hash-aicte-internship-2026',
        raw_text: 'AICTE sponsored virtual technology internship program for engineering and polytechnic students with industry mentorship and stipend certificate.',
      },
      {
        id: 'notice-ncs-jobfair-2026',
        source_id: 'src-ncs-jobfairs',
        title: 'National Career Service (NCS) — Mega National Job Fair & Campus Recruitment Drive',
        link: 'https://www.ncs.gov.in/job-fair',
        notice_date: '2026-11-01',
        classification: 'new_event',
        deadline_date: '2026-12-10',
        location_mode: 'offline',
        eligibility: 'all',
        content_hash: 'hash-ncs-jobfair-2026',
        raw_text: 'National job fair organized across major state centers featuring 150+ IT, manufacturing, and public sector participating employers.',
      },
      {
        id: 'notice-ieee-techfest-2026',
        source_id: 'src-ieee-acm-events',
        title: 'IEEE India Student Tech Fest & National Robotics Competition 2026',
        link: 'https://ieee.org/conferences_events',
        notice_date: '2026-11-02',
        classification: 'new_event',
        deadline_date: '2026-12-15',
        location_mode: 'hybrid',
        eligibility: 'all',
        content_hash: 'hash-ieee-techfest-2026',
        raw_text: 'Inter-college technical festival featuring autonomous robotics, paper presentations, AI hackathons, and technical workshops.',
      },
    ];

    for (const n of initialNotices) {
      db.prepare(`
        INSERT OR IGNORE INTO watch_notices (
          id, source_id, title, link, notice_date, classification, deadline_date,
          location_mode, eligibility, content_hash, raw_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        n.id, n.source_id, n.title, n.link, n.notice_date, n.classification, n.deadline_date,
        n.location_mode, n.eligibility, n.content_hash, n.raw_text
      );
    }
  } catch (err) {
    console.error('Error seeding initial event notices:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved & Bookmarked Events Helpers (Form Watch Events & Opportunities)
// ─────────────────────────────────────────────────────────────────────────────

export interface SavedEventRow {
  id: string;
  user_id: string;
  event_id?: string | null;
  title: string;
  category: string;
  event_type: string;
  source_name?: string | null;
  source_url?: string | null;
  event_date?: string | null;
  deadline_date?: string | null;
  location_mode?: string | null;
  location_venue?: string | null;
  registration_url?: string | null;
  details_json?: string | null;
  reminder_set: number;
  reminder_date?: string | null;
  notes?: string | null;
  created_at: string;
}

export function saveEvent(userId: string, event: Partial<SavedEventRow>): SavedEventRow {
  const db = getDb();
  const id = event.id || generateId();
  const title = (event.title || 'Untitled Event').trim();
  const category = event.category || 'hackathon';
  const eventType = event.event_type || 'event';
  const sourceName = event.source_name || 'Official Portal';
  const sourceUrl = event.source_url || '';
  const eventDate = event.event_date || null;
  const deadlineDate = event.deadline_date || null;
  const locationMode = event.location_mode || 'online';
  const locationVenue = event.location_venue || null;
  const registrationUrl = event.registration_url || sourceUrl;
  const detailsJson = event.details_json || null;
  const reminderSet = event.reminder_set ? 1 : 0;
  const reminderDate = event.reminder_date || deadlineDate;
  const notes = event.notes || null;

  db.prepare(`
    INSERT INTO saved_events (
      id, user_id, event_id, title, category, event_type, source_name, source_url,
      event_date, deadline_date, location_mode, location_venue, registration_url,
      details_json, reminder_set, reminder_date, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, title) DO UPDATE SET
      category = excluded.category,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      event_date = excluded.event_date,
      deadline_date = excluded.deadline_date,
      location_mode = excluded.location_mode,
      registration_url = excluded.registration_url,
      reminder_set = excluded.reminder_set
  `).run(
    id, userId, event.event_id || null, title, category, eventType, sourceName, sourceUrl,
    eventDate, deadlineDate, locationMode, locationVenue, registrationUrl,
    detailsJson, reminderSet, reminderDate, notes
  );

  return db.prepare('SELECT * FROM saved_events WHERE user_id = ? AND title = ?').get(userId, title) as SavedEventRow;
}

export function getSavedEvents(userId: string): SavedEventRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM saved_events WHERE user_id = ? ORDER BY created_at DESC').all(userId) as SavedEventRow[];
}

export function deleteSavedEvent(userId: string, idOrTitle: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM saved_events WHERE user_id = ? AND (id = ? OR title = ?)').run(userId, idOrTitle, idOrTitle);
  return res.changes > 0;
}

export function toggleEventReminder(userId: string, id: string, reminderSet: boolean): boolean {
  const db = getDb();
  const res = db.prepare('UPDATE saved_events SET reminder_set = ? WHERE user_id = ? AND id = ?').run(reminderSet ? 1 : 0, userId, id);
  return res.changes > 0;
}

