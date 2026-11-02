/**
 * PII Sanitizer and Security Utilities
 * Redacts personal identifiable information (Aadhaar, PAN, phone, email, card numbers)
 * and detects prompt injection attempts from untrusted page text or user queries.
 */

export const SENSITIVE_CREDENTIAL_PATTERNS = [
  /password/i,
  /passcode/i,
  /secret[\s_-]?key/i,
  /pin[\s_-]?code/i,
  /\botp\b/i,
  /one[\s_-]?time[\s_-]?password/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /पासवर्ड/i,
  /ओटीपी/i,
  /पिन/i,
];

export const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+|previous\s+|prior\s+)?instructions/i,
  /disregard\s+(all\s+|previous\s+|prior\s+)?instructions/i,
  /disregard\s+safety/i,
  /bypass\s+security/i,
  /system\s+prompt/i,
  /override\s+system/i,
  /act\s+as\s+an\s+unrestricted/i,
  /jailbreak/i,
  /fill\s+aadhaar\s+with/i,
  /send\s+password/i,
];

/**
 * Redact sensitive PII from text before transmitting to AI / backend models.
 * Ensures Aadhaar, PAN, Card numbers, Indian mobile numbers, and emails are never exposed.
 */
export function redactPII(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // 1. Credit / Debit card numbers (16 digits in 4x4 or continuous)
    .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[REDACTED_CARD]')
    // 2. Aadhaar numbers (12 digits, continuous or 4-4-4)
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_AADHAAR]')
    // 3. Indian PAN Card numbers (5 alphabetic + 4 numeric + 1 alphabetic)
    .replace(/\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g, '[REDACTED_PAN]')
    // 4. Phone numbers (10 digits starting with 6-9, with optional +91/0 prefix)
    .replace(/(?:\+91[\s-]?)?(?:0)?[6-9]\d{9}\b/g, '[REDACTED_PHONE]')
    // 5. Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
}

/**
 * Checks whether text contains prompt injection attempts or system override attacks.
 */
export function containsPromptInjection(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return PROMPT_INJECTION_PATTERNS.some((pat) => pat.test(text));
}

