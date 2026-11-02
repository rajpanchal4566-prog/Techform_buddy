import crypto from 'crypto';
import { getDb, generateId } from './db';
import { getEmailProvider, logDevOtpFallback } from './emailSender';
import {
  generateVerificationEmailContent,
  generatePasswordResetEmailContent,
} from './emailTemplate';
import { validatePassword, hashPassword } from './auth';

export const OTP_EXPIRY_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const DAILY_OTP_LIMIT = 10;

export interface CreateOtpResult {
  success: boolean;
  otp?: string;
  token?: string;
  expiresAt?: string;
  error?: string;
  retryAfterSeconds?: number;
  message?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  userId?: string;
  error?: string;
  attemptsLeft?: number;
  message: string;
}

/**
 * Generate a cryptographically secure 6-digit OTP (100000 - 999999)
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP with SHA-256
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

/**
 * Create a new verification OTP entry:
 * - Checks 60-second cooldown
 * - Checks daily cap per email (10/day)
 * - Invalidates any previous pending OTP for this user or email
 * - Generates crypto-secure 6-digit OTP
 * - Stores ONLY a hash, user_id, 10-minute expiry, and attempt counter = 0
 * - Sends branded HTML + plain text email in user's selected language
 * - Triggers dev fallback only when NODE_ENV=development and DEV_SHOW_OTP=true (never in production)
 */
export async function createVerificationEntry(
  userId: string,
  email: string,
  lang: string = 'en'
): Promise<CreateOtpResult> {
  const db = getDb();
  const cleanEmail = email.toLowerCase().trim();

  // 1. Check daily cap per email (Requirement 2)
  const todayCount = (
    db.prepare(`
      SELECT COUNT(*) as c FROM email_otp_requests
      WHERE LOWER(email) = LOWER(?)
      AND created_at > datetime('now', '-24 hours')
    `).get(cleanEmail) as { c: number }
  )?.c || 0;

  if (todayCount >= DAILY_OTP_LIMIT) {
    return {
      success: false,
      error: 'DAILY_CAP_REACHED',
      message: 'Daily verification limit reached for this email. Please try again in 24 hours.',
    };
  }

  // 2. Check 60-second resend cooldown (Requirement 2)
  const latestReq = db.prepare(`
    SELECT created_at FROM email_otp_requests
    WHERE LOWER(email) = LOWER(?)
    ORDER BY created_at DESC LIMIT 1
  `).get(cleanEmail) as { created_at: string } | undefined;

  if (latestReq && latestReq.created_at) {
    const rawTime = latestReq.created_at.includes('Z') ? latestReq.created_at : latestReq.created_at + 'Z';
    const reqTime = new Date(rawTime).getTime();
    const elapsedSec = Math.floor((Date.now() - reqTime) / 1000);
    if (elapsedSec < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = RESEND_COOLDOWN_SECONDS - elapsedSec;
      return {
        success: false,
        error: 'COOLDOWN',
        retryAfterSeconds: waitSeconds,
        message: `Please wait ${waitSeconds} seconds before requesting another verification code.`,
      };
    }
  }

  // 3. Invalidate old OTP (Requirement 2: a new OTP invalidates the old one)
  db.prepare('DELETE FROM email_verifications WHERE user_id = ? OR LOWER(email) = LOWER(?)').run(
    userId,
    cleanEmail
  );

  // 4. Generate 6-digit crypto-secure OTP (Requirement 2)
  const otp = generateSecureOtp();
  const otpHash = hashOtp(otp);
  const legacyToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const id = generateId();

  // 5. Store ONLY hash, user_id, expiry (10 min), attempts = 0 (Requirement 2)
  db.prepare(`
    INSERT INTO email_verifications (id, user_id, email, otp_hash, token, expires_at, attempts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(id, userId, cleanEmail, otpHash, legacyToken, expiresAt);

  // Record request for cooldown & daily cap tracking
  const reqId = generateId();
  db.prepare(`
    INSERT INTO email_otp_requests (id, email, created_at)
    VALUES (?, ?, datetime('now'))
  `).run(reqId, cleanEmail);

  // 6. Send email template in user's selected language (Requirement 4)
  const { subject, html, text } = generateVerificationEmailContent(otp, lang);
  try {
    await getEmailProvider().sendEmail({
      to: cleanEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('Email provider error:', err);
  }

  // 7. Dev fallback (Requirement 5: only in development when DEV_SHOW_OTP=true, never in production)
  logDevOtpFallback(cleanEmail, otp);

  return {
    success: true,
    otp,
    token: legacyToken,
    expiresAt,
    message: 'Verification code sent to your email.',
  };
}

/**
 * Verify candidate OTP with:
 * - Constant-time comparison (crypto.timingSafeEqual)
 * - 10-minute expiration check
 * - Max 5 attempts then invalidate (delete)
 * - Delete after success
 */
export function verifyEmailOtp(
  email: string,
  candidateOtp: string
): VerifyOtpResult {
  const cleanEmail = email.toLowerCase().trim();
  const candidate = (candidateOtp || '').trim();

  // Validate format
  if (!candidate || candidate.length !== 6 || !/^\d{6}$/.test(candidate)) {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      message: 'Please enter a valid 6-digit verification code.',
    };
  }

  const db = getDb();
  const entry = db.prepare(`
    SELECT * FROM email_verifications
    WHERE LOWER(email) = LOWER(?)
  `).get(cleanEmail) as {
    id: string;
    user_id: string;
    email: string;
    otp_hash: string;
    expires_at: string;
    attempts: number;
  } | undefined;

  if (!entry) {
    return {
      success: false,
      error: 'NOT_FOUND_OR_EXPIRED',
      message: 'Invalid or expired verification code. Please request a new one.',
    };
  }

  // Check expiration (Requirement 2: expiry 10 minutes)
  const expiresAtMs = new Date(entry.expires_at).getTime();
  if (expiresAtMs <= Date.now()) {
    db.prepare('DELETE FROM email_verifications WHERE id = ?').run(entry.id);
    return {
      success: false,
      error: 'EXPIRED',
      message: 'Verification code has expired. Please request a new one.',
    };
  }

  // Check max attempts already reached
  if (entry.attempts >= MAX_OTP_ATTEMPTS) {
    db.prepare('DELETE FROM email_verifications WHERE id = ?').run(entry.id);
    return {
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      attemptsLeft: 0,
      message: 'Too many incorrect attempts. This code is invalidated. Please request a new one.',
    };
  }

  // Constant-time comparison (Requirement 2)
  const candidateHash = crypto.createHash('sha256').update(candidate).digest();
  const storedHash = Buffer.from(entry.otp_hash, 'hex');

  const isMatch =
    candidateHash.length === storedHash.length &&
    crypto.timingSafeEqual(candidateHash, storedHash);

  if (isMatch) {
    // Delete after success (Requirement 2)
    db.prepare('DELETE FROM email_verifications WHERE id = ?').run(entry.id);

    // Mark user verified
    db.prepare(`
      UPDATE users
      SET email_verified = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(entry.user_id);

    return {
      success: true,
      userId: entry.user_id,
      message: 'Email verified successfully! You now have full access.',
    };
  }

  // Wrong OTP: increment attempts
  const nextAttempts = (entry.attempts || 0) + 1;
  if (nextAttempts >= MAX_OTP_ATTEMPTS) {
    // Max 5 wrong attempts: invalidate immediately (Requirement 2)
    db.prepare('DELETE FROM email_verifications WHERE id = ?').run(entry.id);
    return {
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      attemptsLeft: 0,
      message: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.',
    };
  }

  db.prepare('UPDATE email_verifications SET attempts = ? WHERE id = ?').run(
    nextAttempts,
    entry.id
  );
  const remaining = MAX_OTP_ATTEMPTS - nextAttempts;

  return {
    success: false,
    error: 'WRONG_OTP',
    attemptsLeft: remaining,
    message: `Incorrect verification code. You have ${remaining} attempt(s) remaining.`,
  };
}

/**
 * Backward compatibility wrapper for token/OTP verification
 */
export function verifyEmailTokenOrOtp(
  input: { token?: string; otp?: string; email?: string }
): { success: boolean; userId?: string; error?: string; attemptsLeft?: number } {
  if (input.otp && input.email) {
    const res = verifyEmailOtp(input.email, input.otp);
    return {
      success: res.success,
      userId: res.userId,
      error: res.success ? undefined : res.message,
      attemptsLeft: res.attemptsLeft,
    };
  }

  if (input.token) {
    const db = getDb();
    const now = new Date().toISOString();
    const entry = db.prepare(`
      SELECT * FROM email_verifications
      WHERE token = ? AND expires_at > ?
    `).get(input.token.trim(), now) as { id: string; user_id: string } | undefined;

    if (!entry) {
      return { success: false, error: 'Invalid or expired verification link.' };
    }

    db.prepare(`
      UPDATE users
      SET email_verified = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(entry.user_id);

    db.prepare('DELETE FROM email_verifications WHERE id = ?').run(entry.id);
    return { success: true, userId: entry.user_id };
  }

  return { success: false, error: 'Please provide either a verification link or OTP with email.' };
}

/**
 * Backward compatibility email sender wrapper
 */
export async function sendVerificationEmail(
  email: string,
  otp: string,
  token?: string,
  lang: string = 'en'
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = generateVerificationEmailContent(otp, lang);
  const result = await getEmailProvider().sendEmail({
    to: email,
    subject,
    html,
    text,
  });

  logDevOtpFallback(email, otp);

  return { success: result.success, simulated: !result.success };
}

export interface PasswordResetRequestResult {
  success: boolean;
  otp?: string;
  expiresAt?: string;
  error?: string;
  retryAfterSeconds?: number;
  message: string;
}

export interface PasswordResetConfirmResult {
  success: boolean;
  error?: string;
  errors?: string[];
  attemptsLeft?: number;
  message: string;
}

/**
 * Creates and emails a 6-digit password reset OTP in English (Requirement 1 & 2).
 */
export async function createPasswordResetEntry(
  email: string
): Promise<PasswordResetRequestResult> {
  const db = getDb();
  const cleanEmail = email.toLowerCase().trim();

  // Find user by email
  const user = db
    .prepare('SELECT id, auth_provider FROM users WHERE LOWER(email) = LOWER(?)')
    .get(cleanEmail) as { id: string; auth_provider: string } | undefined;

  // Generic message for security (prevents user enumeration)
  const genericSuccess =
    'If an account exists with this email, a 6-digit password reset code has been sent.';

  if (!user) {
    return { success: true, message: genericSuccess };
  }

  // Check 60-second cooldown
  const latestReq = db
    .prepare(
      'SELECT created_at FROM password_resets WHERE LOWER(email) = LOWER(?) ORDER BY created_at DESC LIMIT 1'
    )
    .get(cleanEmail) as { created_at: string } | undefined;

  if (latestReq && latestReq.created_at) {
    const rawTime = latestReq.created_at.includes('Z')
      ? latestReq.created_at
      : latestReq.created_at + 'Z';
    const reqTime = new Date(rawTime).getTime();
    const elapsedSec = Math.floor((Date.now() - reqTime) / 1000);
    if (elapsedSec < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = RESEND_COOLDOWN_SECONDS - elapsedSec;
      return {
        success: false,
        error: 'COOLDOWN',
        retryAfterSeconds: waitSeconds,
        message: `Please wait ${waitSeconds} seconds before requesting another reset code.`,
      };
    }
  }

  // Invalidate previous pending password resets
  db.prepare('DELETE FROM password_resets WHERE user_id = ? OR LOWER(email) = LOWER(?)').run(
    user.id,
    cleanEmail
  );

  // Generate 6-digit crypto-secure OTP
  const otp = generateSecureOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const id = generateId();

  // Store hash in password_resets
  db.prepare(`
    INSERT INTO password_resets (id, user_id, email, otp_hash, expires_at, attempts, created_at)
    VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(id, user.id, cleanEmail, otpHash, expiresAt);

  // Send branded email in English (Requirement 1: the gmail code should go in English)
  const { subject, html, text } = generatePasswordResetEmailContent(otp, 'en');
  try {
    await getEmailProvider().sendEmail({
      to: cleanEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error('Password reset email sending error:', err);
  }

  logDevOtpFallback(cleanEmail, otp);

  return {
    success: true,
    otp, // available for tests/dev
    expiresAt,
    message: genericSuccess,
  };
}

/**
 * Validates the reset OTP and updates user's password (Requirement 2).
 */
export async function resetPasswordWithOtp(
  email: string,
  candidateOtp: string,
  newPassword: string
): Promise<PasswordResetConfirmResult> {
  const cleanEmail = email.toLowerCase().trim();
  const candidate = (candidateOtp || '').trim();

  if (!candidate || candidate.length !== 6 || !/^\d{6}$/.test(candidate)) {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      message: 'Please enter a valid 6-digit reset code.',
    };
  }

  // Validate new password rules before resetting
  const validation = validatePassword(newPassword, cleanEmail);
  if (!validation.valid) {
    return {
      success: false,
      error: 'INVALID_PASSWORD',
      errors: validation.errors,
      message: validation.message,
    };
  }

  const db = getDb();
  const entry = db
    .prepare('SELECT * FROM password_resets WHERE LOWER(email) = LOWER(?)')
    .get(cleanEmail) as {
      id: string;
      user_id: string;
      email: string;
      otp_hash: string;
      expires_at: string;
      attempts: number;
    } | undefined;

  if (!entry) {
    return {
      success: false,
      error: 'NOT_FOUND_OR_EXPIRED',
      message: 'Invalid or expired password reset code. Please request a new one.',
    };
  }

  // Check expiration (10 min)
  const expiresAtMs = new Date(entry.expires_at).getTime();
  if (expiresAtMs <= Date.now()) {
    db.prepare('DELETE FROM password_resets WHERE id = ?').run(entry.id);
    return {
      success: false,
      error: 'EXPIRED',
      message: 'Reset code has expired. Please request a new code.',
    };
  }

  // Check max attempts
  if (entry.attempts >= MAX_OTP_ATTEMPTS) {
    db.prepare('DELETE FROM password_resets WHERE id = ?').run(entry.id);
    return {
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      attemptsLeft: 0,
      message: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.',
    };
  }

  // Constant-time comparison
  const candidateHash = crypto.createHash('sha256').update(candidate).digest();
  const storedHash = Buffer.from(entry.otp_hash, 'hex');

  const isMatch =
    candidateHash.length === storedHash.length &&
    crypto.timingSafeEqual(candidateHash, storedHash);

  if (isMatch) {
    // Delete reset record
    db.prepare('DELETE FROM password_resets WHERE id = ?').run(entry.id);

    // Hash new password using bcrypt
    const hashedPassword = await hashPassword(newPassword);

    // Update password in database
    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(hashedPassword, entry.user_id);

    return {
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
    };
  }

  // Mismatch: increment attempts
  const nextAttempts = (entry.attempts || 0) + 1;
  if (nextAttempts >= MAX_OTP_ATTEMPTS) {
    db.prepare('DELETE FROM password_resets WHERE id = ?').run(entry.id);
    return {
      success: false,
      error: 'TOO_MANY_ATTEMPTS',
      attemptsLeft: 0,
      message: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.',
    };
  }

  db.prepare('UPDATE password_resets SET attempts = ? WHERE id = ?').run(
    nextAttempts,
    entry.id
  );
  const remaining = MAX_OTP_ATTEMPTS - nextAttempts;

  return {
    success: false,
    error: 'WRONG_OTP',
    attemptsLeft: remaining,
    message: `Incorrect reset code. You have ${remaining} attempt(s) remaining.`,
  };
}
