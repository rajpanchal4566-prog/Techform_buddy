/**
 * Autofill Mode Engine
 *
 * Provides shared autofill mode logic for both the Web App and Chrome Extension:
 * 1. Mode toggle & per-user persistence
 * 2. One-time consent per site/form type
 * 3. Safe field scanning, classification & confidence mapping
 * 4. Strict exclusion of passwords, OTPs, captchas, and sensitive IDs/bank numbers
 * 5. Formatting & event dispatching (text, date, email, phone, select, radio, checkbox)
 * 6. Detailed audit summary (Filled N, Skipped M with reasons)
 * 7. Per-field and global Undo functionality
 * 8. Voice step-by-step walk-through state machine
 */

import { normalizeDateValue } from '../../packages/form-core/src/applyFill';

export interface AutofillFieldItem {
  id: string;
  name: string;
  label: string;
  type: string;
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  selector?: string;
  status: 'filled' | 'skipped';
  reason?: 'sensitive' | 'no saved value' | 'low confidence';
  confidence: number;
  mappedKey?: string;
  mappedValue?: string;
  previousValue?: string;
}

export interface AutofillSummary {
  filledCount: number;
  skippedCount: number;
  items: AutofillFieldItem[];
}

export interface SensitivityCheckResult {
  isSensitive: boolean;
  reason?: 'password' | 'otp' | 'captcha' | 'sensitive_id' | 'bank_account';
  message: string;
}

/**
 * 1. TOGGLE & PERSISTENCE
 */
export function getAutofillMode(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem('tfb_autofill_mode');
    if (val === null) return true; // Default ON
    return val === 'true';
  } catch {
    return true;
  }
}

export function setAutofillMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('tfb_autofill_mode', String(enabled));
    window.dispatchEvent(
      new CustomEvent('tfb-autofill-mode-changed', { detail: { enabled } })
    );
  } catch {}
}

/**
 * 2. ONE-TIME CONSENT PER SITE OR FORM TYPE
 */
export function getSiteOrFormKey(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    return window.location.hostname || 'app';
  } catch {
    return 'default';
  }
}

export function hasAutofillConsent(siteOrForm = getSiteOrFormKey()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`tfb_autofill_consent_${siteOrForm}`) === 'true';
  } catch {
    return false;
  }
}

export function setAutofillConsent(siteOrForm = getSiteOrFormKey(), consented = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`tfb_autofill_consent_${siteOrForm}`, String(consented));
  } catch {}
}

/**
 * 3. STRICT SENSITIVITY DETECTION
 * Passwords, OTPs, Captchas, Aadhaar, PAN, and Bank/Card numbers must NEVER be filled.
 */
export function isFieldSensitive(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  label = ''
): SensitivityCheckResult {
  const type = (element.getAttribute('type') || (element as any).type || '').toLowerCase();
  const name = (element.name || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase();
  const placeholder = 'placeholder' in element ? (element as HTMLInputElement).placeholder || '' : '';
  const textContext = `${label} ${name} ${id} ${autocomplete} ${placeholder}`.toLowerCase();

  // A. Passwords
  if (
    type === 'password' ||
    autocomplete.includes('password') ||
    textContext.includes('password') ||
    textContext.includes('passwd') ||
    textContext.includes('passcode')
  ) {
    return {
      isSensitive: true,
      reason: 'password',
      message: 'Password fields are never auto-filled for your security.',
    };
  }

  // B. OTP / Verification codes
  if (
    autocomplete.includes('one-time-code') ||
    textContext.includes('otp') ||
    textContext.includes('one-time') ||
    textContext.includes('verification code') ||
    textContext.includes('security code') ||
    textContext.includes('auth code')
  ) {
    return {
      isSensitive: true,
      reason: 'otp',
      message: 'OTP and verification codes are never auto-filled.',
    };
  }

  // C. Captcha
  if (textContext.includes('captcha') || textContext.includes('security question')) {
    return {
      isSensitive: true,
      reason: 'captcha',
      message: 'Captcha inputs must be solved manually.',
    };
  }

  // D. Aadhaar, PAN & Official sensitive ID numbers
  if (
    textContext.includes('aadhaar') ||
    textContext.includes('aadhar') ||
    textContext.includes('uidai') ||
    textContext.includes('pan number') ||
    textContext.includes('pan card') ||
    textContext.includes('pan_no') ||
    textContext.includes('pancard') ||
    textContext.includes('voter id') ||
    textContext.includes('epic no') ||
    textContext.includes('passport no')
  ) {
    return {
      isSensitive: true,
      reason: 'sensitive_id',
      message: 'Sensitive ID numbers (Aadhaar, PAN, Passport) are left for manual entry.',
    };
  }

  // E. Bank account & card credentials
  if (
    textContext.includes('account number') ||
    textContext.includes('account_no') ||
    textContext.includes('bank account') ||
    textContext.includes('card number') ||
    textContext.includes('cvv') ||
    textContext.includes('cvc') ||
    textContext.includes('debit card') ||
    textContext.includes('credit card') ||
    textContext.includes('ifsc')
  ) {
    return {
      isSensitive: true,
      reason: 'bank_account',
      message: 'Bank account and payment details are never auto-filled.',
    };
  }

  return { isSensitive: false, message: '' };
}

/**
 * 4. FIELD LABEL EXTRACTION
 */
export function findFieldLabel(el: HTMLElement): string {
  if (el.id) {
    const labelElem = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (labelElem && labelElem.textContent?.trim()) {
      return labelElem.textContent.trim();
    }
  }

  const parentLabel = el.closest('label');
  if (parentLabel && parentLabel.textContent?.trim()) {
    return parentLabel.textContent.replace(el.textContent || '', '').trim();
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder && placeholder.trim()) return placeholder.trim();

  const name = (el as any).name;
  if (name && name.trim()) {
    return name.replace(/[_-]/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  }

  return '';
}

/**
 * 5. PROFILE MATCHING & CONFIDENCE SCORE
 */
export function mapFieldToProfile(
  label: string,
  element: HTMLElement,
  profile: Record<string, any>
): { profileKey: string | null; value: string | null; confidence: number } {
  const norm = `${label} ${(element as any).name || ''} ${element.id || ''} ${(element as any).placeholder || ''}`.toLowerCase();

  // Full Name
  if (
    norm.includes('name') &&
    !norm.includes('father') &&
    !norm.includes('mother') &&
    !norm.includes('guardian') &&
    !norm.includes('college') &&
    !norm.includes('school') &&
    !norm.includes('company') &&
    !norm.includes('bank') &&
    !norm.includes('scheme')
  ) {
    const val = profile.full_name || profile.name || '';
    if (val) return { profileKey: 'full_name', value: val, confidence: 0.95 };
  }

  // Father Name
  if (norm.includes('father') || norm.includes('guardian')) {
    const val = profile.father_name || '';
    if (val) return { profileKey: 'father_name', value: val, confidence: 0.95 };
  }

  // Mother Name
  if (norm.includes('mother')) {
    const val = profile.mother_name || '';
    if (val) return { profileKey: 'mother_name', value: val, confidence: 0.95 };
  }

  // Email
  if (norm.includes('email') || (element as HTMLInputElement).type === 'email') {
    const val = profile.email || '';
    if (val) return { profileKey: 'email', value: val, confidence: 0.98 };
  }

  // Phone / Mobile
  if (
    norm.includes('phone') ||
    norm.includes('mobile') ||
    norm.includes('contact') ||
    (element as HTMLInputElement).type === 'tel'
  ) {
    const val = profile.phone || '';
    if (val) return { profileKey: 'phone', value: val, confidence: 0.95 };
  }

  // Date of Birth
  if (
    norm.includes('dob') ||
    norm.includes('birth') ||
    (element as HTMLInputElement).type === 'date'
  ) {
    const val = profile.date_of_birth || profile.dob || '';
    if (val) return { profileKey: 'date_of_birth', value: val, confidence: 0.9 };
  }

  // Pincode
  if (norm.includes('pin') || norm.includes('postal') || norm.includes('zip')) {
    const val = profile.pincode || profile.postal_code || '';
    if (val) return { profileKey: 'pincode', value: val, confidence: 0.95 };
  }

  // City
  if (norm.includes('city') || norm.includes('district')) {
    const val = profile.city || '';
    if (val) return { profileKey: 'city', value: val, confidence: 0.9 };
  }

  // State
  if (norm.includes('state') || norm.includes('province')) {
    const val = profile.state || '';
    if (val) return { profileKey: 'state', value: val, confidence: 0.9 };
  }

  // Address
  if (norm.includes('address') || norm.includes('street') || norm.includes('residence')) {
    const parts = [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean);
    const val = profile.address || (parts.length > 0 ? parts.join(', ') : '');
    if (val) return { profileKey: 'address', value: val, confidence: 0.88 };
  }

  // Gender
  if (norm.includes('gender') || norm.includes('sex')) {
    const val = profile.gender || '';
    if (val) return { profileKey: 'gender', value: val, confidence: 0.85 };
  }

  // Generic fallback if low similarity
  return { profileKey: null, value: null, confidence: 0.3 };
}

/**
 * 6. NATIVE VALUE SETTER & EVENT FIRING
 * Ensures frameworks (React, Angular, Vue, Next.js) register values immediately.
 */
export function setNativeFieldValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string
): void {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  // Dispatch lifecycle events with bubbles and composed true
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
}

/**
 * 7. DATE CONVERSION FOR FIELD FORMATS
 */
export function formatFieldValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  rawValue: string,
  label = ''
): string {
  const type = (element.getAttribute('type') || (element as any).type || '').toLowerCase();
  const isDate = type === 'date' || label.toLowerCase().includes('date') || label.toLowerCase().includes('dob');

  if (isDate) {
    if (type === 'date') {
      const res = normalizeDateValue(rawValue, 'YYYY-MM-DD');
      return res.formatted;
    }

    const placeholder = (element as HTMLInputElement).placeholder || '';
    if (/dd[-/.]mm[-/.]yyyy/i.test(placeholder) || /dd[-/.]mm[-/.]yyyy/i.test(label)) {
      const sep = placeholder.includes('-') || label.includes('-') ? 'DD-MM-YYYY' : 'DD/MM/YYYY';
      return normalizeDateValue(rawValue, sep).formatted;
    }

    return normalizeDateValue(rawValue, 'DD/MM/YYYY').formatted;
  }

  return rawValue;
}

/**
 * 8. SELECT, RADIO & CHECKBOX MATCHING
 */
export function fillSelectOption(select: HTMLSelectElement, targetValue: string): boolean {
  const normTarget = targetValue.toLowerCase().trim();
  const options = Array.from(select.options);

  // 1. Exact value
  let matched = options.find(o => o.value.toLowerCase().trim() === normTarget);
  // 2. Exact text
  if (!matched) {
    matched = options.find(o => o.text.toLowerCase().trim() === normTarget);
  }
  // 3. Substring
  if (!matched) {
    matched = options.find(o => {
      const t = o.text.toLowerCase().trim();
      const v = o.value.toLowerCase().trim();
      return (t && (t.includes(normTarget) || normTarget.includes(t))) || (v && normTarget.includes(v));
    });
  }

  if (matched) {
    select.value = matched.value;
    setNativeFieldValue(select, matched.value);
    return true;
  }
  return false;
}

export function fillRadioGroup(name: string, targetValue: string, doc: Document = document): boolean {
  const norm = targetValue.toLowerCase().trim();
  const radios = Array.from(doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`));

  for (const r of radios) {
    const val = (r.value || '').toLowerCase().trim();
    const lbl = (r.parentElement?.textContent || r.getAttribute('aria-label') || '').toLowerCase().trim();
    if (val === norm || lbl === norm || lbl.includes(norm) || norm.includes(lbl)) {
      r.checked = true;
      r.click();
      r.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

export function fillCheckbox(checkbox: HTMLInputElement, targetValue: string): boolean {
  const isPositive = /^(true|1|yes|y|on|checked)$/i.test(targetValue.trim());
  if (checkbox.checked !== isPositive) {
    checkbox.click();
  }
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/**
 * 9. AUTOFILL RUN EXECUTOR
 * Scans, evaluates confidence, fills high-confidence, skips sensitive and unknown ones,
 * and returns full audit summary.
 */
export function executeAutofillRun(
  root: Document | HTMLElement = document,
  profile: Record<string, any> = {}
): AutofillSummary {
  const doc = root instanceof Document ? root : root.ownerDocument || document;
  const elements = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea'
    )
  ).filter(el => {
    // Ignore internal Buddy elements
    if (el.closest('#tfb-portal-overlay-host') || el.closest('#tfb-launcher-badge')) return false;
    return !el.disabled;
  });

  const items: AutofillFieldItem[] = [];
  let filledCount = 0;
  let skippedCount = 0;

  for (const el of elements) {
    const label = findFieldLabel(el);
    const fieldId = el.id || el.name || `field_${items.length}`;
    const fieldName = el.name || el.id || '';
    const type = (el.getAttribute('type') || (el as any).type || el.tagName).toLowerCase();

    // Check sensitive exclusion
    const sens = isFieldSensitive(el, label);
    if (sens.isSensitive) {
      skippedCount++;
      items.push({
        id: fieldId,
        name: fieldName,
        label: label || 'Sensitive Credential',
        type,
        element: el,
        status: 'skipped',
        reason: 'sensitive',
        confidence: 0,
      });
      // Visually mark sensitive fields
      el.setAttribute('data-tfb-skipped-reason', 'sensitive');
      continue;
    }

    // Map to profile
    const mapping = mapFieldToProfile(label, el, profile);

    if (!mapping.value || !mapping.value.trim()) {
      skippedCount++;
      items.push({
        id: fieldId,
        name: fieldName,
        label: label || 'Unmatched Field',
        type,
        element: el,
        status: 'skipped',
        reason: 'no saved value',
        confidence: mapping.confidence,
      });
      el.setAttribute('data-tfb-skipped-reason', 'no saved value');
      continue;
    }

    // Low confidence threshold (< 0.75)
    if (mapping.confidence < 0.75) {
      skippedCount++;
      items.push({
        id: fieldId,
        name: fieldName,
        label: label || 'Low Confidence Field',
        type,
        element: el,
        status: 'skipped',
        reason: 'low confidence',
        confidence: mapping.confidence,
        mappedValue: mapping.value,
      });
      el.setAttribute('data-tfb-skipped-reason', 'low confidence');
      continue;
    }

    // High confidence: proceed to fill
    const previousVal = (el as HTMLInputElement).value || '';
    const valueToFill = formatFieldValue(el, mapping.value, label);

    let success = false;
    if (el instanceof HTMLSelectElement) {
      success = fillSelectOption(el, valueToFill);
    } else if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      success = fillRadioGroup(el.name, valueToFill, doc);
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      success = fillCheckbox(el, valueToFill);
    } else {
      setNativeFieldValue(el, valueToFill);
      success = true;
    }

    if (success) {
      filledCount++;
      el.style.outline = '2px solid #10b981';
      el.style.backgroundColor = '#ecfdf5';
      el.setAttribute('data-tfb-autofilled', 'true');
      items.push({
        id: fieldId,
        name: fieldName,
        label: label || 'Form Field',
        type,
        element: el,
        status: 'filled',
        confidence: mapping.confidence,
        mappedKey: mapping.profileKey || undefined,
        mappedValue: valueToFill,
        previousValue: previousVal,
      });
    } else {
      skippedCount++;
      items.push({
        id: fieldId,
        name: fieldName,
        label: label || 'Option Mismatch',
        type,
        element: el,
        status: 'skipped',
        reason: 'low confidence',
        confidence: mapping.confidence,
      });
    }
  }

  return {
    filledCount,
    skippedCount,
    items,
  };
}

/**
 * 10. UNDO FUNCTIONALITY
 */
export function undoAutofillItem(item: AutofillFieldItem): void {
  if (item.status === 'filled' && item.element) {
    setNativeFieldValue(item.element, item.previousValue || '');
    item.element.style.outline = '';
    item.element.style.backgroundColor = '';
    item.element.removeAttribute('data-tfb-autofilled');
    item.status = 'skipped';
    item.reason = 'no saved value';
  }
}

export function undoAllAutofill(summary: AutofillSummary): void {
  for (const item of summary.items) {
    if (item.status === 'filled') {
      undoAutofillItem(item);
    }
  }
  summary.filledCount = 0;
  summary.skippedCount = summary.items.length;
}
