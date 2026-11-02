import { NextRequest } from 'next/server';
import { verifyEmailOtp, verifyEmailTokenOrOtp } from '@/lib/emailService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, otp, email } = body;

    if (!token && (!otp || !email)) {
      return Response.json(
        { error: 'Please provide the 6-digit OTP and your email address.' },
        { status: 400 }
      );
    }

    if (otp && email) {
      const result = verifyEmailOtp(email, otp);
      if (!result.success) {
        return Response.json(
          {
            error: result.message,
            errorCode: result.error,
            attemptsLeft: result.attemptsLeft,
          },
          { status: 400 }
        );
      }

      return Response.json({
        success: true,
        message: result.message,
        userId: result.userId,
      });
    }

    // Token-based fallback
    const result = verifyEmailTokenOrOtp({ token, otp, email });
    if (!result.success) {
      return Response.json(
        { error: result.error || 'Verification failed. The link or code may be invalid or expired.' },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: 'Email verified successfully! You now have full access to TechForm Buddy.',
      userId: result.userId,
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return Response.json(
      { error: 'Something went wrong during verification. Please try again.' },
      { status: 500 }
    );
  }
}
