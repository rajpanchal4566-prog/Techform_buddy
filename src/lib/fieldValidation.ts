/**
 * Form Field Format Validation Utility (Requirement 2)
 *
 * Validates standard field formats including:
 * - Email format
 * - 10-digit Indian Mobile number
 * - 6-digit Indian Postal Pin Code
 * - Calendar Date (YYYY-MM-DD or DD/MM/YYYY)
 */

import { validateInputQuality } from './templates';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalizedValue?: string;
}

export function validateEmail(email: string, lang: 'en' | 'hi' = 'en'): ValidationResult {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return { valid: false, error: lang === 'hi' ? 'ईमेल आवश्यक है।' : 'Email is required.' };
  }
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(trimmed)) {
    return {
      valid: false,
      error:
        lang === 'hi'
          ? 'अमान्य ईमेल पता। कृपया सही ईमेल दर्ज करें (उदा. user@example.com)।'
          : 'Invalid email format. Enter a valid email address (e.g. user@example.com).',
    };
  }
  return { valid: true, normalizedValue: trimmed.toLowerCase() };
}

export function validateMobile(mobile: string, lang: 'en' | 'hi' = 'en'): ValidationResult {
  const raw = (mobile || '').trim();
  const digits = raw.replace(/\D/g, '');
  // Normalize if +91 or 91 country code prefix was included
  const tenDigits = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;

  if (!/^[6-9]\d{9}$/.test(tenDigits)) {
    return {
      valid: false,
      error:
        lang === 'hi'
          ? 'अमान्य मोबाइल नंबर। 10 अंकों का वैध भारतीय नंबर दर्ज करें (उदा. 9876543210)।'
          : 'Invalid mobile number. Enter a valid 10-digit Indian mobile number (e.g. 9876543210).',
    };
  }
  return { valid: true, normalizedValue: tenDigits };
}

export function validatePincode(pincode: string, lang: 'en' | 'hi' = 'en'): ValidationResult {
  const trimmed = (pincode || '').trim();
  if (!/^[1-9]\d{5}$/.test(trimmed)) {
    return {
      valid: false,
      error:
        lang === 'hi'
          ? 'अमान्य पिन कोड। 6 अंकों का सही पोस्टल पिन कोड दर्ज करें (उदा. 462001)।'
          : 'Invalid pin code. Enter a 6-digit Indian postal pin code (e.g. 462001).',
    };
  }
  return { valid: true, normalizedValue: trimmed };
}

export function validateDate(dateStr: string, lang: 'en' | 'hi' = 'en'): ValidationResult {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) {
    return { valid: false, error: lang === 'hi' ? 'दिनांक आवश्यक है।' : 'Date is required.' };
  }

  let year: number;
  let month: number;
  let day: number;

  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);

  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3], 10);
  } else {
    return {
      valid: false,
      error:
        lang === 'hi'
          ? 'अमान्य दिनांक प्रारूप। कृपया YYYY-MM-DD प्रारूप का उपयोग करें।'
          : 'Invalid date format. Please use YYYY-MM-DD.',
    };
  }

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return {
      valid: false,
      error: lang === 'hi' ? 'अमान्य कैलेंडर दिनांक दर्ज की गई है।' : 'Invalid calendar date entered.',
    };
  }

  const normalized = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { valid: true, normalizedValue: normalized };
}

export function validateFieldBySchema(
  key: string,
  type: string,
  value: string,
  lang: 'en' | 'hi' = 'en'
): ValidationResult {
  const k = key.toLowerCase();
  const t = type.toLowerCase();

  if (t === 'email' || k.includes('email')) {
    return validateEmail(value, lang);
  }
  if (t === 'tel' || k.includes('mobile') || k.includes('phone') || k.includes('contact')) {
    return validateMobile(value, lang);
  }
  if (k.includes('pincode') || k.includes('pin_code') || k === 'pin') {
    return validatePincode(value, lang);
  }
  if (t === 'date' || k.includes('date') || k === 'dob') {
    return validateDate(value, lang);
  }
  if (!value || !value.trim()) {
    return { valid: false, error: lang === 'hi' ? 'यह फ़ील्ड आवश्यक है।' : 'This field is required.' };
  }

  const quality = validateInputQuality(value, key.replace(/_/g, ' '), true);
  if (!quality.isValid && quality.error) {
    return { valid: false, error: quality.error };
  }

  return { valid: true, normalizedValue: value.trim() };
}

