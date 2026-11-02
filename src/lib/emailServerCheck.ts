import dns from 'dns';
import { promisify } from 'util';
import {
  isValidEmailFormat,
  suggestEmailCorrection,
  isDisposableDomain,
} from './emailValidation';

const resolveMx = promisify(dns.resolveMx);

/**
 * Server-side: Check if the email domain has MX records.
 */
export async function hasMxRecords(email: string): Promise<boolean> {
  const parts = email.trim().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  try {
    const records = await resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Full server-side email validation:
 * format + typo check + disposable check + MX check.
 */
export async function validateEmailServer(email: string): Promise<{
  valid: boolean;
  error?: string;
  suggestion?: string;
}> {
  const trimmed = email.trim().toLowerCase();

  if (!isValidEmailFormat(trimmed)) {
    return { valid: false, error: 'Invalid email format.' };
  }

  const suggestion = suggestEmailCorrection(trimmed);
  if (suggestion) {
    return { valid: false, error: `Did you mean ${suggestion}?`, suggestion };
  }

  if (isDisposableDomain(trimmed)) {
    return { valid: false, error: 'Disposable email addresses are not allowed. Please use a permanent email.' };
  }

  const hasMx = await hasMxRecords(trimmed);
  if (!hasMx) {
    return { valid: false, error: 'This email domain does not appear to accept mail. Please check the address.' };
  }

  return { valid: true };
}

