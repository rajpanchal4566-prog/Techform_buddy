import { NextRequest } from 'next/server';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { createPasswordResetEntry } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email address is required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const ip = getClientIp(request);

    // Rate limit per email + IP
    const rateCheck = checkRateLimit(`pwd_reset_req:${cleanEmail}:${ip}`, RATE_LIMITS.resend);
    if (!rateCheck.allowed) {
      const waitSeconds = Math.ceil(rateCheck.retryAfterMs / 1000);
      return Response.json(
        {
          error: `Please wait ${waitSeconds} seconds before requesting another reset code.`,
          retryAfterSeconds: waitSeconds,
        },
        { status: 429 }
      );
    }

    const result = await createPasswordResetEntry(cleanEmail);

    if (!result.success) {
      if (result.error === 'COOLDOWN') {
        return Response.json(
          {
            error: result.message,
            retryAfterSeconds: result.retryAfterSeconds,
          },
          { status: 429 }
        );
      }
      return Response.json({ error: result.message }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return Response.json(
      { error: 'Something went wrong while requesting reset code. Please try again.' },
      { status: 500 }
    );
  }
}

