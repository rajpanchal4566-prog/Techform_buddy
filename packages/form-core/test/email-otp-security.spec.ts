import { test, expect } from '@playwright/test';
import { getDb, generateId } from '../../../src/lib/db';
import {
  createVerificationEntry,
  verifyEmailOtp,
  hashOtp,
  generateSecureOtp,
  OTP_EXPIRY_MINUTES,
  MAX_OTP_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
} from '../../../src/lib/emailService';
import {
  setEmailProvider,
  getEmailProvider,
  EmailProvider,
  EmailPayload,
  EmailSendResult,
  logDevOtpFallback,
} from '../../../src/lib/emailSender';
import { generateVerificationEmailContent, EMAIL_I18N } from '../../../src/lib/emailTemplate';

test.describe('Email OTP Verification & Security Suite', () => {
  let db: ReturnType<typeof getDb>;
  let sentEmails: EmailPayload[] = [];

  // Mock Email Provider for testing
  class MockEmailProvider implements EmailProvider {
    async sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
      sentEmails.push(payload);
      return { success: true, messageId: 'mock-' + Date.now() };
    }
  }

  test.beforeAll(() => {
    db = getDb();
  });

  test.beforeEach(() => {
    sentEmails = [];
    setEmailProvider(new MockEmailProvider());
  });

  test.afterAll(() => {
    // Restore default provider
    setEmailProvider(null);
  });

  // Helper to create a test user
  function createTestUser(email: string, name = 'Test User') {
    const userId = generateId();
    db.prepare('DELETE FROM users WHERE email = ?').run(email);
    db.prepare('DELETE FROM email_verifications WHERE LOWER(email) = LOWER(?)').run(email);
    db.prepare('DELETE FROM email_otp_requests WHERE LOWER(email) = LOWER(?)').run(email);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, email_verified, auth_provider)
      VALUES (?, ?, 'mockhash', ?, 0, 'credentials')
    `).run(userId, email, name);

    return userId;
  }

  test('Requirement 1 & 4: Mock email sender receives branded HTML & plain-text template with OTP and expiry', async () => {
    const testEmail = `mocktest_${Date.now()}@example.com`;
    const userId = createTestUser(testEmail);

    const result = await createVerificationEntry(userId, testEmail, 'hi');
    expect(result.success).toBe(true);
    expect(result.otp).toBeDefined();
    expect(result.otp).toMatch(/^\d{6}$/);

    // Verify mock sender captured the email
    expect(sentEmails.length).toBe(1);
    const sent = sentEmails[0];
    expect(sent.to).toBe(testEmail.toLowerCase());
    expect(sent.subject).toBe(EMAIL_I18N.hi.subject);
    expect(sent.html).toContain(result.otp!);
    expect(sent.html).toContain('10'); // 10 minutes expiry
    expect(sent.html).toContain('TechForm Buddy');
    expect(sent.text).toContain(result.otp!);
    expect(sent.text).toContain('10');
  });

  test('Requirement 2: OTP is stored ONLY as a hash, not plaintext, in the database', async () => {
    const testEmail = `hashtest_${Date.now()}@example.com`;
    const userId = createTestUser(testEmail);

    const result = await createVerificationEntry(userId, testEmail);
    expect(result.success).toBe(true);
    const otp = result.otp!;

    // Query SQLite directly
    const row = db.prepare('SELECT * FROM email_verifications WHERE LOWER(email) = LOWER(?)').get(testEmail) as any;
    expect(row).toBeDefined();
    expect(row.user_id).toBe(userId);
    expect(row.attempts).toBe(0);

    // Ensure hash is stored and matches sha256 of OTP
    expect(row.otp_hash).toBe(hashOtp(otp));
    // The plaintext OTP must NOT be stored in otp_hash
    expect(row.otp_hash).not.toBe(otp);

    // Check expiry is ~10 minutes in the future
    const expiresMs = new Date(row.expires_at).getTime();
    const diffMin = (expiresMs - Date.now()) / (60 * 1000);
    expect(diffMin).toBeGreaterThan(9.5);
    expect(diffMin).toBeLessThanOrEqual(10.1);
  });

  test('Requirement 2 & 6: Correct OTP verifies user, sets email_verified = 1, and deletes record from DB', async () => {
    const testEmail = `correct_otp_${Date.now()}@example.com`;
    const userId = createTestUser(testEmail);

    const createRes = await createVerificationEntry(userId, testEmail);
    const otp = createRes.otp!;

    // Verify with correct OTP
    const verifyRes = verifyEmailOtp(testEmail, otp);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.userId).toBe(userId);

    // Check user is marked email_verified = 1 in database
    const user = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(userId) as any;
    expect(user.email_verified).toBe(1);

    // Check record is deleted from email_verifications after success (Requirement 2)
    const verificationRow = db.prepare('SELECT * FROM email_verifications WHERE LOWER(email) = LOWER(?)').get(testEmail);
    expect(verificationRow).toBeUndefined();
  });

  test('Requirement 2 & 6: Wrong OTP increments attempt counter and reports remaining attempts', async () => {
    const testEmail = `wrong_otp_${Date.now()}@example.com`;
    const userId = createTestUser(testEmail);

    const createRes = await createVerificationEntry(userId, testEmail);
    const correctOtp = createRes.otp!;
    const wrongOtp = correctOtp === '123456' ? '654321' : '123456';

    const verifyRes = verifyEmailOtp(testEmail, wrongOtp);
    expect(verifyRes.success).toBe(false);
    expect(verifyRes.error).toBe('WRONG_OTP');
    expect(verifyRes.attemptsLeft).toBe(4);

    // Verify attempts counter in DB
    const row = db.prepare('SELECT attempts FROM email_verifications WHERE LOWER(email) = LOWER(?)').get(testEmail) as any;
    expect(row.attempts).toBe(1);

    // User is still unverified
    const user = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(userId) as any;
    expect(user.email_verified).toBe(0);
  });

  test('Requirement 2 & 6: Max 5 wrong attempts invalidates and deletes the OTP record', async () => {
    const testEmail = `max_attempts_${Date.now()}@example.com`;
    const userId = createTestUser(testEmail);

    const createRes = await createVerificationEntry(userId, testEmail);
    const correctOtp = createRes.otp!;
    const wrongOtp = '000000';

    // Submit 4 incorrect attempts
    for (let i = 1; i <= 4; i++) {
      const res = verifyEmailOtp(testEmail, wrongOtp);
      expect(res.success).toBe(false);
      expect(res.attemptsLeft).toBe(5 - i);
    }

    // 5th incorrect attempt invalidates the OTP
    const fifthRes = verifyEmailOtp(testEmail, wrongOtp);
    expect(fifthRes.success).toBe(false);
    expect(fifthRes.error).toBe('TOO_MANY_ATTEMPTS');
    expect(fifthRes.attemptsLeft).toBe(0);

    // Check record has been deleted from DB (invalidated)
    const row = db.prepare('SELECT * FROM email_verifications WHERE LOWER(email) = LOWER(?)').get(testEmail);
    expect(row).toBeUndefined();

    // Now even submitting the correct OTP fails because the entry was invalidated!
    const subsequentRes = verifyEmailOtp(testEmail, correctOtp);
    expect(subsequentRes.success).toBe(false);
    expect(subsequentRes.error).toBe('NOT_FOUND_OR_EXPIRED');
  });

  test('Requirement 2 & 6: Expired OTP is rejected and deleted from DB', async () => {
    const testEmail = `expired_otp_${Date.now()}@example.com`;
    const userId = createTestUser(testEmail);

    const createRes = await createVerificationEntry(userId, testEmail);
    const otp = createRes.otp!;

    // Artificially expire the OTP by updating expires_at to 1 second ago
    const pastDate = new Date(Date.now() - 5000).toISOString();
    db.prepare('UPDATE email_verifications SET expires_at = ? WHERE LOWER(email) = LOWER(?)').run(pastDate, testEmail);

    // Verification attempt
    const verifyRes = verifyEmailOtp(testEmail, otp);
    expect(verifyRes.success).toBe(false);
    expect(verifyRes.error).toBe('EXPIRED');

    // Entry should be cleaned up
    const row = db.prepare('SELECT * FROM email_verifications WHERE LOWER(email) = LOWER(?)').get(testEmail);
    expect(row).toBeUndefined();
  });

  test('Requirement 2 & 6: Resend cooldown of 60 seconds is enforced', async () => {
    const testEmail = `cooldown_${Date.now()}@example.com`;
    const userId = createTestUser(testEmail);

    // Initial request
    const firstRes = await createVerificationEntry(userId, testEmail);
    expect(firstRes.success).toBe(true);

    // Immediate second request within 60 seconds should be blocked
    const secondRes = await createVerificationEntry(userId, testEmail);
    expect(secondRes.success).toBe(false);
    expect(secondRes.error).toBe('COOLDOWN');
    expect(secondRes.retryAfterSeconds).toBeGreaterThan(0);
    expect(secondRes.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  test('Requirement 2 & 6: New OTP invalidates old OTP', async () => {
    const testEmail = `new_invalidates_old_${Date.now()}@example.com`;
    const userId = createTestUser(testEmail);

    // First request
    const firstRes = await createVerificationEntry(userId, testEmail);
    const oldOtp = firstRes.otp!;

    // Fast-forward request timestamp by modifying email_otp_requests so cooldown passes
    db.prepare(`
      UPDATE email_otp_requests
      SET created_at = datetime('now', '-70 seconds')
      WHERE LOWER(email) = LOWER(?)
    `).run(testEmail);

    // Request new OTP
    const secondRes = await createVerificationEntry(userId, testEmail);
    expect(secondRes.success).toBe(true);
    const newOtp = secondRes.otp!;
    expect(newOtp).toBeDefined();

    // The old OTP must be invalid now!
    const tryOld = verifyEmailOtp(testEmail, oldOtp);
    // If the random OTP happened to be different (probability 99.9999%):
    if (oldOtp !== newOtp) {
      expect(tryOld.success).toBe(false);
      expect(tryOld.error).toBe('WRONG_OTP');
    }

    // The new OTP succeeds
    const tryNew = verifyEmailOtp(testEmail, newOtp);
    expect(tryNew.success).toBe(true);
  });

  test('Requirement 5: Dev fallback strictly disabled in production', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalShowOtp = process.env.DEV_SHOW_OTP;

    try {
      // 1. In production, even if DEV_SHOW_OTP is 'true', fallback MUST NOT run
      (process.env as any).NODE_ENV = 'production';
      process.env.DEV_SHOW_OTP = 'true';
      const prodResult = logDevOtpFallback('user@example.com', '123456');
      expect(prodResult).toBe(false);

      // 2. In development with DEV_SHOW_OTP='false', fallback does not run
      (process.env as any).NODE_ENV = 'development';
      process.env.DEV_SHOW_OTP = 'false';
      const devFalseResult = logDevOtpFallback('user@example.com', '123456');
      expect(devFalseResult).toBe(false);

      // 3. In development with DEV_SHOW_OTP='true', fallback runs
      (process.env as any).NODE_ENV = 'development';
      process.env.DEV_SHOW_OTP = 'true';
      const devTrueResult = logDevOtpFallback('user@example.com', '123456');
      expect(devTrueResult).toBe(true);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.DEV_SHOW_OTP = originalShowOtp;
    }
  });
});

