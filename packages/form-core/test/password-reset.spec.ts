import { test, expect } from '@playwright/test';
import { getDb, generateId } from '../../../src/lib/db';
import { hashPassword, verifyPassword } from '../../../src/lib/auth';
import {
  createPasswordResetEntry,
  resetPasswordWithOtp,
} from '../../../src/lib/emailService';
import {
  setEmailProvider,
  EmailProvider,
  EmailPayload,
  EmailSendResult,
} from '../../../src/lib/emailSender';
import {
  generatePasswordResetEmailContent,
  generateVerificationEmailContent,
} from '../../../src/lib/emailTemplate';

test.describe('Password Reset & English Email Suite', () => {
  let db: ReturnType<typeof getDb>;
  let capturedEmails: EmailPayload[] = [];

  class MockResetEmailProvider implements EmailProvider {
    async sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
      capturedEmails.push(payload);
      return { success: true, messageId: 'mock-reset-' + Date.now() };
    }
  }

  test.beforeAll(() => {
    db = getDb();
  });

  test.beforeEach(() => {
    capturedEmails = [];
    setEmailProvider(new MockResetEmailProvider());
  });

  test.afterAll(() => {
    setEmailProvider(null);
  });

  async function createTestAccount(email: string, passwordPlain = 'Initial@Pass123') {
    const userId = generateId();
    const hash = await hashPassword(passwordPlain);

    db.prepare('DELETE FROM users WHERE email = ?').run(email);
    db.prepare('DELETE FROM password_resets WHERE LOWER(email) = LOWER(?)').run(email);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, email_verified, auth_provider)
      VALUES (?, ?, ?, 'Reset Tester', 1, 'credentials')
    `).run(userId, email, hash);

    return { userId, hash };
  }

  test('Requirement 1: Email templates for Gmail are delivered in English', () => {
    // 1. Password reset email template is strictly in English
    const resetEmail = generatePasswordResetEmailContent('654321');
    expect(resetEmail.subject).toBe('TechForm Buddy - Password Reset Code');
    expect(resetEmail.html).toContain('Reset Your Password');
    expect(resetEmail.html).toContain('654321');
    expect(resetEmail.html).toContain('10 minutes');
    expect(resetEmail.html).toContain('If you did not request a password reset, you can safely ignore this email.');
    expect(resetEmail.text).toContain('Password Reset Code: 654321');

    // 2. Verification email defaults to English
    const verifEmail = generateVerificationEmailContent('123456', 'en');
    expect(verifEmail.subject).toBe('Your TechForm Buddy Verification Code');
    expect(verifEmail.html).toContain('TechForm Buddy Verification');
    expect(verifEmail.html).toContain('123456');
    expect(verifEmail.html).toContain('10 minutes');
    expect(verifEmail.html).toContain('If you did not request this code, please ignore this email.');
  });

  test('Requirement 2: Forgot password flow requests code in Gmail and updates password', async () => {
    const testEmail = `forgot_pass_${Date.now()}@example.com`;
    const { userId, hash: oldHash } = await createTestAccount(testEmail, 'OldPassword@123');

    // Step 1: Request reset code
    const reqResult = await createPasswordResetEntry(testEmail);
    expect(reqResult.success).toBe(true);
    expect(reqResult.otp).toBeDefined();
    expect(reqResult.otp).toMatch(/^\d{6}$/);

    // Verify email was sent in English
    expect(capturedEmails.length).toBe(1);
    expect(capturedEmails[0].to).toBe(testEmail);
    expect(capturedEmails[0].subject).toContain('Password Reset Code');
    expect(capturedEmails[0].text).toContain(reqResult.otp!);

    // Verify hash is stored in database, not plaintext
    const row = db.prepare('SELECT * FROM password_resets WHERE LOWER(email) = LOWER(?)').get(testEmail) as any;
    expect(row).toBeDefined();
    expect(row.user_id).toBe(userId);
    expect(row.otp_hash).not.toBe(reqResult.otp!);

    // Step 2: Try wrong OTP first
    const wrongAttempt = await resetPasswordWithOtp(testEmail, '000000', 'NewSecure@456!');
    expect(wrongAttempt.success).toBe(false);
    expect(wrongAttempt.error).toBe('WRONG_OTP');
    expect(wrongAttempt.attemptsLeft).toBe(4);

    // Step 3: Confirm with correct OTP and valid new password
    const confirmResult = await resetPasswordWithOtp(testEmail, reqResult.otp!, 'NewSecure@456!');
    expect(confirmResult.success).toBe(true);

    // Verify password has been updated in database to a new bcrypt hash
    const updatedUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any;
    expect(updatedUser.password_hash).not.toBe(oldHash);

    // Verify user can authenticate with the new password
    const verifyOld = await verifyPassword('OldPassword@123', updatedUser.password_hash);
    expect(verifyOld).toBe(false);

    const verifyNew = await verifyPassword('NewSecure@456!', updatedUser.password_hash);
    expect(verifyNew).toBe(true);

    // Verify reset record is cleaned up from database
    const remainingRow = db.prepare('SELECT * FROM password_resets WHERE LOWER(email) = LOWER(?)').get(testEmail);
    expect(remainingRow).toBeUndefined();
  });

  test('Requirement 2: Enforces 60-second cooldown on password reset request', async () => {
    const testEmail = `cooldown_reset_${Date.now()}@example.com`;
    await createTestAccount(testEmail);

    const first = await createPasswordResetEntry(testEmail);
    expect(first.success).toBe(true);

    const second = await createPasswordResetEntry(testEmail);
    expect(second.success).toBe(false);
    expect(second.error).toBe('COOLDOWN');
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('Requirement 2: Max 5 wrong OTP attempts invalidates the reset code', async () => {
    const testEmail = `max_wrong_reset_${Date.now()}@example.com`;
    await createTestAccount(testEmail);

    const reqResult = await createPasswordResetEntry(testEmail);
    const correctOtp = reqResult.otp!;

    // 4 wrong attempts
    for (let i = 1; i <= 4; i++) {
      const res = await resetPasswordWithOtp(testEmail, '999999', 'NewSecure@456!');
      expect(res.success).toBe(false);
      expect(res.attemptsLeft).toBe(5 - i);
    }

    // 5th wrong attempt invalidates
    const fifth = await resetPasswordWithOtp(testEmail, '999999', 'NewSecure@456!');
    expect(fifth.success).toBe(false);
    expect(fifth.error).toBe('TOO_MANY_ATTEMPTS');

    // Even submitting correct OTP fails now
    const after = await resetPasswordWithOtp(testEmail, correctOtp, 'NewSecure@456!');
    expect(after.success).toBe(false);
    expect(after.error).toBe('NOT_FOUND_OR_EXPIRED');
  });

  test('Requirement 2: Rejects weak new passwords during reset', async () => {
    const testEmail = `weak_pass_reset_${Date.now()}@example.com`;
    await createTestAccount(testEmail);

    const reqResult = await createPasswordResetEntry(testEmail);

    // Password lacking symbol/number/uppercase
    const weakAttempt = await resetPasswordWithOtp(testEmail, reqResult.otp!, 'weak');
    expect(weakAttempt.success).toBe(false);
    expect(weakAttempt.error).toBe('INVALID_PASSWORD');
    expect(weakAttempt.errors).toBeDefined();
  });
});

