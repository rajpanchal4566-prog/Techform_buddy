import nodemailer from 'nodemailer';

/**
 * Payload required to send an email
 */
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Result returned by email sending operations
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Provider interface for email sending
 */
export interface EmailProvider {
  sendEmail(payload: EmailPayload): Promise<EmailSendResult>;
}

/**
 * SMTP implementation using nodemailer.
 * Configured strictly via environment variables:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM_NAME, MAIL_FROM_ADDRESS.
 */
export class SmtpEmailProvider implements EmailProvider {
  private getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (!host || !user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return {
        success: false,
        error: 'SMTP credentials not configured (requires SMTP_HOST, SMTP_USER, SMTP_PASS)',
      };
    }

    const fromName = process.env.MAIL_FROM_NAME || 'TechForm Buddy';
    const fromAddress =
      process.env.MAIL_FROM_ADDRESS ||
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      process.env.GMAIL_USER ||
      'noreply@techformbuddy.com';
    const from = `"${fromName.replace(/"/g, '')}" <${fromAddress}>`;

    try {
      const info = await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to send email via SMTP',
      };
    }
  }
}

// Active provider instance (defaults to SmtpEmailProvider, mockable in tests)
let activeProvider: EmailProvider = new SmtpEmailProvider();

export function setEmailProvider(provider: EmailProvider | null): void {
  activeProvider = provider || new SmtpEmailProvider();
}

export function getEmailProvider(): EmailProvider {
  return activeProvider;
}

/**
 * Requirement 5: Dev Fallback
 * Only when process.env.NODE_ENV === 'development' AND process.env.DEV_SHOW_OTP === 'true',
 * log the OTP to the server console.
 * Strictly impossible to run in production.
 */
export function logDevOtpFallback(email: string, otp: string): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (process.env.NODE_ENV === 'development' && process.env.DEV_SHOW_OTP === 'true') {
    console.log(`[TechFormBuddy Dev OTP Fallback] To: ${email} | OTP: ${otp} (valid for 10 minutes)`);
    return true;
  }
  return false;
}

