import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { createVerificationEntry } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, lang } = body;

    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const ip = getClientIp(request);

    // Rate limit resend per email and IP
    const rateCheck = checkRateLimit(`resend:${cleanEmail}:${ip}`, RATE_LIMITS.resend);
    if (!rateCheck.allowed) {
      const waitSeconds = Math.ceil(rateCheck.retryAfterMs / 1000);
      return Response.json(
        {
          error: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
          retryAfterSeconds: waitSeconds,
        },
        { status: 429 }
      );
    }

    const db = getDb();
    const user = db
      .prepare('SELECT id, email_verified, preferred_language FROM users WHERE email = ?')
      .get(cleanEmail) as
      | {
          id: string;
          email_verified: number;
          preferred_language?: string;
        }
      | undefined;

    // Only send if user exists and is not yet verified
    if (user && !user.email_verified) {
      const targetLang = lang || user.preferred_language || 'en';
      const otpResult = await createVerificationEntry(user.id, cleanEmail, targetLang);

      if (!otpResult.success) {
        if (otpResult.error === 'COOLDOWN') {
          return Response.json(
            {
              error: otpResult.message,
              retryAfterSeconds: otpResult.retryAfterSeconds,
            },
            { status: 429 }
          );
        }
        if (otpResult.error === 'DAILY_CAP_REACHED') {
          return Response.json(
            {
              error: otpResult.message,
            },
            { status: 429 }
          );
        }
      }
    }

    // Generic response: does not reveal whether the email exists in the system
    return Response.json({
      success: true,
      message: 'If an unverified account exists for this email, a new verification code has been sent.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
