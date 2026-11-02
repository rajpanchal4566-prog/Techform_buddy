import { test, expect } from '@playwright/test';
import { validatePassword, getPasswordStrength, hashPassword, verifyPassword } from '../../../src/lib/auth';
import {
  isValidEmailFormat,
  suggestEmailCorrection,
  isDisposableDomain,
} from '../../../src/lib/emailValidation';
import {
  hasMxRecords,
  validateEmailServer,
} from '../../../src/lib/emailServerCheck';
import { checkRateLimit, resetRateLimit, clearAllRateLimits, RATE_LIMITS } from '../../../src/lib/rateLimit';
import { getDb, generateId } from '../../../src/lib/db';
import { authOptions } from '../../../src/lib/authOptions';
import { checkAccountPermission } from '../../../src/lib/authGuard';
import { createVerificationEntry, verifyEmailTokenOrOtp } from '../../../src/lib/emailService';

test.describe('Requirement 3: Password Rules & Strength Meter', () => {
  test('Rejects passwords with fewer than 8 characters', () => {
    const res = validatePassword('Ab1!', 'test@example.com');
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Password must be at least 8 characters');
  });

  test('Requires uppercase, lowercase, number, and special symbol', () => {
    // Missing uppercase
    const noUpper = validatePassword('lowercase1!', 'test@example.com');
    expect(noUpper.valid).toBe(false);
    expect(noUpper.errors).toContain('Password must contain at least one uppercase letter');

    // Missing lowercase
    const noLower = validatePassword('UPPERCASE1!', 'test@example.com');
    expect(noLower.valid).toBe(false);
    expect(noLower.errors).toContain('Password must contain at least one lowercase letter');

    // Missing number
    const noNum = validatePassword('UpperLower!', 'test@example.com');
    expect(noNum.valid).toBe(false);
    expect(noNum.errors).toContain('Password must contain a number');

    // Missing symbol
    const noSym = validatePassword('UpperLower123', 'test@example.com');
    expect(noSym.valid).toBe(false);
    expect(noSym.errors).toContain('Password must contain at least one special character (!@#$%^&* etc.)');
  });

  test('Rejects very common passwords', () => {
    const common1 = validatePassword('password123', 'test@example.com');
    expect(common1.valid).toBe(false);
    expect(common1.errors.some((e) => e.includes('too common'))).toBe(true);

    const common2 = validatePassword('Pa$$w0rd', 'test@example.com');
    expect(common2.valid).toBe(false);
    expect(common2.errors.some((e) => e.includes('too common'))).toBe(true);

    const common3 = validatePassword('India@123', 'test@example.com');
    expect(common3.valid).toBe(false);
    expect(common3.errors.some((e) => e.includes('too common'))).toBe(true);
  });

  test('Rejects passwords containing the email local name', () => {
    const emailRes = validatePassword('RahulSecure#2026', 'rahul@gmail.com');
    expect(emailRes.valid).toBe(false);
    expect(emailRes.errors).toContain('Password must not contain your email username');
  });

  test('Accepts compliant strong passwords', () => {
    const strong = validatePassword('K8$mP#v9Lx!2qR', 'unrelated@gmail.com');
    expect(strong.valid).toBe(true);
    expect(strong.errors.length).toBe(0);
  });

  test('Calculates live password strength score and label correctly', () => {
    expect(getPasswordStrength('').label).toBe('very-weak');
    expect(getPasswordStrength('abc').label).toBe('very-weak');
    expect(getPasswordStrength('Password123').score).toBeLessThanOrEqual(2);
    expect(getPasswordStrength('K8$mP#v9Lx!2qR').label).toBe('very-strong');
    expect(getPasswordStrength('K8$mP#v9Lx!2qR').score).toBe(4);
  });

  test('Hashes passwords using strong bcrypt hash and verifies correctly', async () => {
    const password = 'K8$mP#v9Lx!2qR';
    const hash = await hashPassword(password);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt signature
    expect(hash).not.toContain(password); // Never plain text

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isWrong = await verifyPassword('WrongPassword#1', hash);
    expect(isWrong).toBe(false);
  });
});

test.describe('Requirement 2: Email Check & Typo Suggestions', () => {
  test('Validates format on client & server', () => {
    expect(isValidEmailFormat('user@example.com')).toBe(true);
    expect(isValidEmailFormat('valid.name+tag@sub.domain.gov.in')).toBe(true);
    expect(isValidEmailFormat('invalid-email')).toBe(false);
    expect(isValidEmailFormat('user@')).toBe(false);
    expect(isValidEmailFormat('@domain.com')).toBe(false);
    expect(isValidEmailFormat('user@domain')).toBe(false);
  });

  test('Suggests corrections for common domain typos', () => {
    expect(suggestEmailCorrection('user@gmial.com')).toBe('user@gmail.com');
    expect(suggestEmailCorrection('user@gmaill.com')).toBe('user@gmail.com');
    expect(suggestEmailCorrection('user@hotmial.com')).toBe('user@hotmail.com');
    expect(suggestEmailCorrection('user@outlok.com')).toBe('user@outlook.com');
    expect(suggestEmailCorrection('user@yaho.com')).toBe('user@yahoo.com');
    expect(suggestEmailCorrection('user@gmail.com')).toBeNull(); // Correct already
  });

  test('Rejects known disposable email domains', () => {
    expect(isDisposableDomain('spam@mailinator.com')).toBe(true);
    expect(isDisposableDomain('temp@guerrillamail.com')).toBe(true);
    expect(isDisposableDomain('fake@yopmail.com')).toBe(true);
    expect(isDisposableDomain('real@gmail.com')).toBe(false);
  });

  test('Checks MX records on server', async () => {
    const hasGoogleMx = await hasMxRecords('test@gmail.com');
    expect(hasGoogleMx).toBe(true);

    const fakeDomainMx = await hasMxRecords('fake@nonexistent-domain-xyz-12345.com');
    expect(fakeDomainMx).toBe(false);
  });

  test('Full server-side validation catches typos and disposable emails', async () => {
    const typoRes = await validateEmailServer('test@gmial.com');
    expect(typoRes.valid).toBe(false);
    expect(typoRes.suggestion).toBe('test@gmail.com');

    const dispRes = await validateEmailServer('test@mailinator.com');
    expect(dispRes.valid).toBe(false);
    expect(dispRes.error).toContain('Disposable email');
  });
});

test.describe('Requirement 2 & 5: Unverified Account Limits & Verification Flow', () => {
  const db = getDb();
  const testUserId = `test-user-${Date.now()}`;
  const testEmail = `unverified-${Date.now()}@example.com`;

  test.beforeAll(() => {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, email_verified, auth_provider)
      VALUES (?, ?, ?, ?, 0, 'credentials')
    `).run(testUserId, testEmail, 'mock-hash', 'Test User');
  });

  test.afterAll(() => {
    db.prepare('DELETE FROM forms WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  test('Unverified account can create 1 form draft but is blocked on second form', () => {
    // 0 forms created -> allowed
    const perm1 = checkAccountPermission(testUserId, 'create_form');
    expect(perm1.allowed).toBe(true);

    // Insert 1 form
    db.prepare(`
      INSERT INTO forms (id, user_id, title, fields, status)
      VALUES (?, ?, ?, ?, 'draft')
    `).run(`form-1-${Date.now()}`, testUserId, 'Draft Form 1', '[]');

    // Now has 1 form -> 2nd form is blocked
    const perm2 = checkAccountPermission(testUserId, 'create_form');
    expect(perm2.allowed).toBe(false);
    expect(perm2.reason).toContain('Unverified accounts are limited to 1 form');
  });

  test('Unverified account is blocked from submitting grievances and watches', () => {
    const grievPerm = checkAccountPermission(testUserId, 'submit_grievance');
    expect(grievPerm.allowed).toBe(false);
    expect(grievPerm.reason).toContain('Email verification required');

    const watchPerm = checkAccountPermission(testUserId, 'create_watch');
    expect(watchPerm.allowed).toBe(false);
  });

  test('Verification with OTP unlocks verified status and full access', async () => {
    const { token, otp } = await createVerificationEntry(testUserId, testEmail);
    expect(otp?.length).toBe(6);
    expect(token?.length).toBe(64);

    const verifyResult = verifyEmailTokenOrOtp({ email: testEmail, otp: otp! });
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.userId).toBe(testUserId);

    // Verify user is now marked verified in DB
    const u = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(testUserId) as any;
    expect(Boolean(u.email_verified)).toBe(true);

    // Now permitted to create additional forms
    const permAfter = checkAccountPermission(testUserId, 'create_form');
    expect(permAfter.allowed).toBe(true);
  });
});

test.describe('Requirement 1 & 5: Google Login Creating & Linking Accounts', () => {
  const db = getDb();
  const testGoogleEmail = `google-test-${Date.now()}@gmail.com`;

  test.afterEach(() => {
    db.prepare('DELETE FROM profiles WHERE email = ?').run(testGoogleEmail);
    db.prepare('DELETE FROM users WHERE email = ?').run(testGoogleEmail);
  });

  test('Google login creates new account with email_verified = 1', async () => {
    const signInCallback = authOptions.callbacks?.signIn;
    expect(signInCallback).toBeDefined();

    const mockGoogleUser = {
      id: 'temp-id',
      email: testGoogleEmail,
      name: 'Google User',
    };
    const mockGoogleAccount = {
      provider: 'google',
      type: 'oauth',
    } as any;

    const result = await (signInCallback as any)({
      user: mockGoogleUser,
      account: mockGoogleAccount,
    });
    expect(result).toBe(true);

    // Verify created in DB
    const created = db.prepare('SELECT * FROM users WHERE email = ?').get(testGoogleEmail) as any;
    expect(created).toBeDefined();
    expect(created.email_verified).toBe(1); // Google emails count as verified
    expect(created.auth_provider).toBe('google');
  });

  test('Google login links to existing credentials account by email (no duplicate)', async () => {
    // 1. Existing user registered with credentials
    const existingId = `cred-user-${Date.now()}`;
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, email_verified, auth_provider)
      VALUES (?, ?, ?, ?, 0, 'credentials')
    `).run(existingId, testGoogleEmail, 'mock-hash', 'Original Credentials Name');

    const signInCallback = authOptions.callbacks?.signIn;
    const mockGoogleUser = {
      id: 'random-oauth-id',
      email: testGoogleEmail,
      name: 'Google Name',
    };
    const mockGoogleAccount = {
      provider: 'google',
      type: 'oauth',
    } as any;

    const result = await (signInCallback as any)({
      user: mockGoogleUser,
      account: mockGoogleAccount,
    });
    expect(result).toBe(true);

    // Verify linked to existing user ID and NOT duplicated
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users WHERE email = ?').get(testGoogleEmail) as any).c;
    expect(userCount).toBe(1);

    const linked = db.prepare('SELECT * FROM users WHERE email = ?').get(testGoogleEmail) as any;
    expect(linked.id).toBe(existingId); // Same account ID linked
    expect(linked.email_verified).toBe(1); // Google marks verified
    expect(linked.auth_provider).toBe('both');
  });
});

test.describe('Requirement 4: Abuse Protection & Rate Limiting', () => {
  test.beforeEach(() => {
    clearAllRateLimits();
  });

  test('Enforces rate limit for login attempts and blocks excess', () => {
    const key = 'login:attacker@example.com';
    for (let i = 0; i < RATE_LIMITS.login.maxAttempts; i++) {
      const res = checkRateLimit(key, RATE_LIMITS.login);
      expect(res.allowed).toBe(true);
    }

    // Next attempt must be blocked
    const blocked = checkRateLimit(key, RATE_LIMITS.login);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  test('Enforces signup rate limit', () => {
    const key = 'signup:192.168.1.100';
    for (let i = 0; i < RATE_LIMITS.signup.maxAttempts; i++) {
      const res = checkRateLimit(key, RATE_LIMITS.signup);
      expect(res.allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, RATE_LIMITS.signup);
    expect(blocked.allowed).toBe(false);
  });

  test('Enforces 60-second cooldown for resend verification', () => {
    const key = 'resend:user@example.com:127.0.0.1';
    const first = checkRateLimit(key, RATE_LIMITS.resend);
    expect(first.allowed).toBe(true);

    // Immediate second attempt within 60s is blocked
    const second = checkRateLimit(key, RATE_LIMITS.resend);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs).toBeGreaterThan(0);
  });

  test('Credentials authorize throws generic error to prevent email enumeration', async () => {
    const credentialsProvider = authOptions.providers.find(
      (p: any) => p.id === 'credentials' || p.name === 'credentials'
    ) as any;
    expect(credentialsProvider).toBeDefined();

    // In NextAuth, credentials provider returns null for invalid credentials
    const authResult = await credentialsProvider.authorize({
      email: 'nobody-exists-here-999@example.com',
      password: 'SomePassword123!',
    }, {} as any);
    expect(authResult).toBeNull();

    // Custom authorize handler rejects with generic "Invalid email or password" (never "No account found")
    if (credentialsProvider.options?.authorize) {
      await expect(
        credentialsProvider.options.authorize({
          email: 'nobody-exists-here-999@example.com',
          password: 'SomePassword123!',
        }, {} as any)
      ).rejects.toThrow('Invalid email or password');
    }
  });
});
