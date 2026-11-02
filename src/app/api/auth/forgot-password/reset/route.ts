import { NextRequest } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { resetPasswordWithOtp } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body;

    if (!email || !otp || !newPassword) {
      return Response.json(
        { error: 'Email, 6-digit reset code, and new password are all required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const ip = getClientIp(request);

    // Rate limit password reset submissions per IP
    const rateCheck = checkRateLimit(`pwd_reset_confirm:${ip}`, RATE_LIMITS.login);
    if (!rateCheck.allowed) {
      return Response.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const result = await resetPasswordWithOtp(cleanEmail, otp, newPassword);

    if (!result.success) {
      return Response.json(
        {
          error: result.message,
          errors: result.errors,
          attemptsLeft: result.attemptsLeft,
          errorCode: result.error,
        },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return Response.json(
      { error: 'Something went wrong while resetting password. Please try again.' },
      { status: 500 }
    );
  }
}

