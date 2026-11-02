import { NextRequest } from 'next/server';
import { getDb, generateId } from '@/lib/db';
import { hashPassword, validatePassword } from '@/lib/auth';
import { validateEmailServer } from '@/lib/emailServerCheck';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { createVerificationEntry, sendVerificationEmail } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    // 1. Abuse Protection: Rate limit signup per IP
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`signup:${ip}`, RATE_LIMITS.signup);
    if (!rateCheck.allowed) {
      const retryMinutes = Math.ceil(rateCheck.retryAfterMs / 60000);
      return Response.json(
        { error: `Too many signup attempts. Please try again in ${retryMinutes} minute(s).` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, password } = body;

    // Validation
    if (!name || !email || !password) {
      return Response.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // 2. Email validation: format, typo suggestions, disposable domains, MX records
    const emailCheck = await validateEmailServer(cleanEmail);
    if (!emailCheck.valid) {
      return Response.json(
        {
          error: emailCheck.error,
          suggestion: emailCheck.suggestion,
        },
        { status: 400 }
      );
    }

    // 3. Password Rules: min 8, upper, lower, number, symbol, no common passwords, no email local part
    const passwordValidation = validatePassword(password, cleanEmail);
    if (!passwordValidation.valid) {
      return Response.json(
        {
          error: passwordValidation.message,
          errors: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if user exists (generic response per Requirement 4)
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);

    if (existingUser) {
      return Response.json(
        { error: 'Unable to register this email. If you already have an account, please sign in.' },
        { status: 400 }
      );
    }

    // Create unverified user and profile in a transaction
    const hashedPassword = await hashPassword(password);
    const userId = generateId();
    const profileId = generateId();

    const userLang = typeof body.language === 'string' ? body.language.toLowerCase().trim() : 'en';

    const createUser = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, preferred_language, email_verified, auth_provider)
        VALUES (?, ?, ?, ?, ?, 0, 'credentials')
      `).run(userId, cleanEmail, hashedPassword, name.trim(), userLang);

      db.prepare(`
        INSERT INTO profiles (id, user_id, full_name, email)
        VALUES (?, ?, ?, ?)
      `).run(profileId, userId, name.trim(), cleanEmail);
    });

    createUser();

    // Send verification email with 6-digit OTP in user's selected language
    await createVerificationEntry(userId, cleanEmail, userLang);

    return Response.json(
      {
        message: 'Account created successfully. Please verify your email to continue.',
        userId,
        email: cleanEmail,
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
