import { FormFieldSchema, FormSchema, FieldOption, FieldInputType } from './types';

// Patterns to exclude completely (Hard Rule 2 & 3)
const EXCLUDE_TYPE_PATTERNS = new Set(['password', 'hidden', 'submit', 'button', 'reset', 'image']);

const CAPTCHA_OTP_KEYWORDS = [
  'captcha',
  'recaptcha',
  'hcaptcha',
  'turnstile',
  'g-recaptcha',
  'otp',
  'one-time-code',
  'security_code',
  'verification_code',
  'passcode',
  '2fa',
  'mfa',
];

// Patterns for sensitive fields (Hard Rule 4: Never store or autofill from storage)
// Uses strict word boundaries (\bpan\b, \bcard\b) so "Company", "Expand", "Panel", "Japan" are NOT flagged.
export const SENSITIVE_FIELD_PATTERNS: RegExp[] = [
  // Aadhaar / UIDAI / UID (word boundary or Devanagari)
  /\b(aadhaar|aadhar|uidai|uid)\b/i,
  /आधार/u,

  // PAN / Permanent Account Number (strict word boundary, excludes hyphenated words like Pan-Asian)
  /\b(pan(?!\s*[-–]\s*[a-z])|permanent\s+account\s+number)\b/i,
  /पैन/u,

  // Passport
  /\bpassport\b/i,
  /पासपोर्ट/u,

  // Bank Account / IFSC / Account Number
  /\b(bank\s+acc(ount)?|acc(ount)?\s*no(umber)?|ifsc|micr|iban)\b/i,
  /खाता/u,
  /बैंक\s*खाता/u,

  // Payment Cards
  /\b(card\s*no(umber)?|credit\s*card|debit\s*card|cvv|cvc|cvv2|cid)\b/i,

  // Voter ID / EPIC
  /\b(epic|epic\s*no(umber)?|voter\s*id)\b/i,
  /मतदाता\s*पहचान/u,

  // Credentials / Secrets
  /\b(password|pin|secret|otp|mpin|captcha)\b/i,
];

/**
 * Checks if an element is visible in the document.
 */
function isElementVisible(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
  if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  // Elements with width and height 0 or off-screen might be hidden utility fields
  if (rect.width === 0 && rect.height === 0 && !el.offsetParent) {
    return false;
  }
  return true;
}

/**
 * Checks if an element is a captcha or OTP field.
 */
function isCaptchaOrOtp(el: HTMLElement): boolean {
  const checkString = `${el.id} ${el.getAttribute('name') || ''} ${el.className || ''} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
  return CAPTCHA_OTP_KEYWORDS.some(kw => checkString.includes(kw));
}

/**
 * Checks if a field is sensitive (Aadhaar, PAN, Passport, Bank, Card, EPIC).
 * Enforces Hard Rule 4 and word boundaries to prevent false positives.
 */
export function isSensitiveField(label: string, name: string, id: string): boolean {
  const combined = `${label} ${name} ${id}`;
  return SENSITIVE_FIELD_PATTERNS.some(rx => rx.test(combined));
}

export const KNOWN_LANGUAGE_NAMES = new Set([
  'english', 'hindi', 'हिन्दी', 'bengali', 'বাংলা', 'telugu', 'తెలుగు',
  'marathi', 'मराठी', 'tamil', 'தமிழ்', 'urdu', 'اردو', 'gujarati', 'ગુજરાતી',
  'kannada', 'ಕನ್ನಡ', 'odia', 'ଓଡ଼ିଆ', 'malayalam', 'മലയാളം', 'punjabi', 'ਪੰਜਾਬੀ',
  'assamese', 'অসমীয়া', 'maithili', 'santali', 'kashmiri', 'nepali', 'sindhi',
  'konkani', 'dogri', 'manipuri', 'bodo', 'sanskrit', 'french', 'spanish', 'german', 'japanese', 'chinese'
]);

/**
 * Checks if a control is a language switcher (select with language options, or lang attributes/labels).
 */
export function isLanguageControl(el: HTMLElement): boolean {
  // 1. Check if <select> options are language names
  if (el instanceof HTMLSelectElement) {
    const options = Array.from(el.options);
    if (options.length > 0) {
      let langMatchCount = 0;
      for (const opt of options) {
        const text = opt.text.trim().toLowerCase();
        const val = opt.value.trim().toLowerCase();
        if (KNOWN_LANGUAGE_NAMES.has(text) || KNOWN_LANGUAGE_NAMES.has(val)) {
          langMatchCount++;
        }
      }
      if (langMatchCount >= 2 || (options.length > 0 && langMatchCount / options.length >= 0.4)) {
        return true;
      }
    }
  }

  // 2. Attribute / ID / Name inspection
  const attrString = `${el.id} ${el.getAttribute('name') || ''} ${el.className || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.toLowerCase();
  if (/\b(lang|language|bhasha|locale|select_language|language_select|lang_choice)\b/i.test(attrString)) {
    return true;
  }

  // 3. Container / parent class inspection
  const parent = el.closest('.language-selector, .lang-picker, .language-dropdown, #language, [id*="language" i], [class*="language" i], [class*="goog-te-combo"]');
  if (parent) {
    return true;
  }

  const parentLabel = el.closest('label');
  if (parentLabel && /\b(language|select\s+language|choose\s+language|भाषा)\b/i.test(parentLabel.textContent || '')) {
    return true;
  }

  return false;
}

/**
 * Checks if a control is a site search box or global search input.
 */
export function isSearchControl(el: HTMLElement): boolean {
  const type = (el.getAttribute('type') || '').toLowerCase();
  if (type === 'search') return true;

  const role = (el.getAttribute('role') || '').toLowerCase();
  if (role === 'search') return true;

  const attrString = `${el.id} ${el.getAttribute('name') || ''} ${el.className || ''} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
  if (/\b(search|site_search|globalsearch|topsearch|search_query|searchbox|searchbar|search_input)\b/i.test(attrString)) {
    return true;
  }

  if (el.closest('[role="search"], form.search, form[action*="search" i]')) {
    return true;
  }

  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase().trim();
  if (/^search(\s+here|\s+portal|\s+site|\.\.\.)?$/i.test(placeholder)) {
    return true;
  }

  return false;
}

/**
 * Checks if a control belongs to site header, navigation bar, footer, or metadata bar.
 */
export function isNavigationOrHeaderFooterControl(el: HTMLElement): boolean {
  return Boolean(
    el.closest('header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"], .navbar, .site-header, .site-footer, .header, .footer')
  );
}

/**
 * Checks if detected fields represent a genuine multi-field application form (>= 3 fields).
 */
export function isRealForm(fields: FormFieldSchema[]): boolean {
  return Boolean(fields && fields.length >= 3);
}

/**
 * Generates a stable and unique CSS selector for an element.
 */
export function generateSelector(el: HTMLElement, doc: Document = document): string {
  // 1. Unique ID
  if (el.id && /^[A-Za-z0-9_-]+$/.test(el.id)) {
    try {
      const matches = doc.querySelectorAll(`#${CSS.escape(el.id)}`);
      if (matches.length === 1) {
        return `#${CSS.escape(el.id)}`;
      }
    } catch {
      // Fallback if escape failed
    }
  }

  // 2. Unique name within form or document
  const name = el.getAttribute('name');
  if (name && el.getAttribute('type') !== 'radio') {
    try {
      const matches = doc.querySelectorAll(`[name="${CSS.escape(name)}"]`);
      if (matches.length === 1) {
        return `[name="${CSS.escape(name)}"]`;
      }
    } catch {
      // Fallback
    }
  }

  // 3. Radio with name + value
  if (el.getAttribute('type') === 'radio' && name) {
    const val = el.getAttribute('value') || '';
    return `input[type="radio"][name="${CSS.escape(name)}"][value="${CSS.escape(val)}"]`;
  }

  // 4. Structural CSS path
  const path: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== doc.body && current !== doc.documentElement) {
    let selector = current.nodeName.toLowerCase();
    if (current.id && /^[A-Za-z0-9_-]+$/.test(current.id)) {
      selector += `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    } else {
      let sibling = current;
      let nth = 1;
      while (sibling.previousElementSibling) {
        sibling = sibling.previousElementSibling as HTMLElement;
        if (sibling.nodeName === current.nodeName) {
          nth++;
        }
      }
      selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ') || el.nodeName.toLowerCase();
}

/**
 * Extracts the closest section heading or fieldset legend for an element.
 */
function extractSectionHeading(el: HTMLElement, doc: Document): string {
  // Check fieldset legend
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend && legend.textContent) {
      return legend.textContent.trim();
    }
  }

  // Walk backwards in DOM order to find closest heading
  let node: Node | null = el;
  while (node && node !== doc.body) {
    let prev = node.previousSibling;
    while (prev) {
      if (prev instanceof HTMLElement) {
        if (/^H[1-6]$/i.test(prev.tagName)) {
          return prev.textContent?.trim() || '';
        }
        const headingInside = prev.querySelector('h1, h2, h3, h4, h5, h6');
        if (headingInside) {
          return headingInside.textContent?.trim() || '';
        }
      }
      prev = prev.previousSibling;
    }
    node = node.parentNode;
  }

  return '';
}

/**
 * Resolves the most accurate human-readable label for a form field.
 */
function resolveFieldLabel(el: HTMLElement, doc: Document): string {
  const id = el.id;

  // 1. label[for="id"]
  if (id) {
    try {
      const labelEl = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (labelEl && labelEl.textContent?.trim()) {
        return cleanLabelText(labelEl.textContent);
      }
    } catch {
      // ignore
    }
  }

  // 2. Enclosing <label> ancestor
  const parentLabel = el.closest('label');
  if (parentLabel) {
    // Clone to remove inputs inside and extract only label text
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea, button').forEach(c => c.remove());
    if (clone.textContent?.trim()) {
      return cleanLabelText(clone.textContent);
    }
  }

  // 3. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelNodes = labelledBy
      .split(/\s+/)
      .map(refId => doc.getElementById(refId)?.textContent?.trim())
      .filter(Boolean);
    if (labelNodes.length > 0) {
      return cleanLabelText(labelNodes.join(' '));
    }
  }

  // 4. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) {
    return cleanLabelText(ariaLabel);
  }

  // 5. placeholder attribute
  const placeholder = el.getAttribute('placeholder');
  if (placeholder && placeholder.trim()) {
    return cleanLabelText(placeholder);
  }

  // 6. Preceding sibling or nearby text node
  let prev = el.previousElementSibling;
  while (prev) {
    if (prev instanceof HTMLElement && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'P' || prev.tagName === 'STRONG' || prev.className.includes('label'))) {
      if (prev.textContent?.trim()) {
        return cleanLabelText(prev.textContent);
      }
    }
    prev = prev.previousElementSibling;
  }

  // 7. Table header if inside a table cell
  const td = el.closest('td');
  if (td && td.parentElement) {
    const cellIndex = Array.from(td.parentElement.children).indexOf(td);
    const table = td.closest('table');
    if (table) {
      const th = table.querySelector(`thead th:nth-child(${cellIndex + 1})`);
      if (th && th.textContent?.trim()) {
        return cleanLabelText(th.textContent);
      }
    }
  }

  // 8. Clean fallback from name or id
  const fallback = el.getAttribute('name') || el.id || '';
  return cleanLabelFallback(fallback);
}

function cleanLabelText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[*:]+$/, '')
    .trim();
}

function cleanLabelFallback(val: string): string {
  if (!val) return 'Unnamed Field';
  return val
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Normalizes input element type.
 */
function normalizeType(el: HTMLElement): FieldInputType {
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'textarea';

  const type = (el.getAttribute('type') || 'text').toLowerCase();
  switch (type) {
    case 'email':
      return 'email';
    case 'tel':
      return 'tel';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'radio':
      return 'radio';
    case 'checkbox':
      return 'checkbox';
    case 'file':
      return 'file';
    case 'url':
      return 'url';
    default:
      return 'text';
  }
}

/**
 * Collects elements recursively from shadow roots and same-origin iframes.
 */
function collectFormElements(root: Document | ShadowRoot | Element): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const selector = 'input, select, textarea';

  const nodes = root.querySelectorAll<HTMLElement>(selector);
  nodes.forEach(el => elements.push(el));

  // 1. Search open shadow roots
  const allElements = root.querySelectorAll<HTMLElement>('*');
  allElements.forEach(el => {
    if (el.shadowRoot) {
      elements.push(...collectFormElements(el.shadowRoot));
    }
  });

  // 2. Search same-origin iframes
  const iframes = root.querySelectorAll<HTMLIFrameElement>('iframe');
  iframes.forEach(iframe => {
    try {
      if (iframe.contentDocument) {
        elements.push(...collectFormElements(iframe.contentDocument));
      }
    } catch {
      // Cross-origin iframe blocked by SOP - skip gracefully
    }
  });

  return elements;
}

/**
 * Primary readForm function.
 * Scans the current page/document and returns a structured, safe FormSchema.
 * Strictly adheres to all privacy and safety Hard Rules.
 */
export function readForm(root: Document | ShadowRoot | Element = document): FormSchema {
  const doc = root instanceof Document ? root : root.ownerDocument || document;
  const rawElements = collectFormElements(root);

  const fields: FormFieldSchema[] = [];
  const radioGroupMap = new Map<string, FormFieldSchema>();

  let fieldCounter = 1;

  for (const el of rawElements) {
    // 1. Hard Rule 3: Skip password and hidden fields
    const rawType = (el.getAttribute('type') || '').toLowerCase();
    if (EXCLUDE_TYPE_PATTERNS.has(rawType)) {
      continue;
    }

    // 2. Hard Rule 3: Skip invisible, captcha, and OTP fields
    if (!isElementVisible(el)) continue;
    if (isCaptchaOrOtp(el)) continue;

    // 3. Skip buttons/submit elements
    if (el.tagName.toLowerCase() === 'button') continue;

    // 4. Ignore non-form controls: language switchers, search boxes, header/footer/nav
    if (isLanguageControl(el)) continue;
    if (isSearchControl(el)) continue;
    if (isNavigationOrHeaderFooterControl(el)) continue;

    const normalizedType = normalizeType(el);
    const label = resolveFieldLabel(el, doc);
    const name = el.getAttribute('name') || '';
    const id = el.id || `tfb_field_${fieldCounter++}`;
    const selector = generateSelector(el, doc);
    const section = extractSectionHeading(el, doc);

    const isFile = normalizedType === 'file';
    // Hard Rule 4: Flag sensitive fields (only text/number inputs asking for credentials/IDs, not file attachments)
    const sensitive = !isFile && isSensitiveField(label, name, id);
    const manual = isFile || sensitive;

    const accept = isFile ? (el.getAttribute('accept') || undefined) : undefined;
    const canAttachDoc = isFile;

    // Handle options for Select elements
    let options: FieldOption[] | undefined;
    if (normalizedType === 'select' && el instanceof HTMLSelectElement) {
      options = Array.from(el.options)
        .filter(opt => opt.value !== '' || opt.text.trim() !== '')
        .map(opt => ({
          label: opt.text.trim(),
          value: opt.value.trim(),
        }));
    }

    // Handle radio groups (group multiple radios with the same name into one logical field schema)
    if (normalizedType === 'radio') {
      const groupName = name || id;
      const optionVal = el.getAttribute('value') || label;
      const optItem: FieldOption = { label, value: optionVal };

      if (radioGroupMap.has(groupName)) {
        const existing = radioGroupMap.get(groupName)!;
        existing.options = existing.options || [];
        if (!existing.options.some(o => o.value === optionVal)) {
          existing.options.push(optItem);
        }
        continue;
      } else {
        const radioField: FormFieldSchema = {
          id: groupName,
          selector,
          type: 'radio',
          label: name ? cleanLabelFallback(name) : label,
          section,
          options: [optItem],
          required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
          manual,
          sensitive,
          groupName,
        };
        radioGroupMap.set(groupName, radioField);
        fields.push(radioField);
        continue;
      }
    }

    const required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
    const maxLength = el.hasAttribute('maxlength') ? parseInt(el.getAttribute('maxlength')!, 10) : undefined;
    const pattern = el.getAttribute('pattern') || undefined;
    const min = el.getAttribute('min') || undefined;
    const max = el.getAttribute('max') || undefined;

    fields.push({
      id,
      selector,
      type: normalizedType,
      label,
      section,
      options,
      required,
      maxLength: isNaN(maxLength!) ? undefined : maxLength,
      pattern,
      min,
      max,
      manual,
      sensitive,
      canAttachDoc,
      accept,
    });
  }

  return {
    url: typeof window !== 'undefined' ? window.location.href : '',
    title: typeof document !== 'undefined' ? document.title : 'Page Form',
    fields,
    scannedAt: Date.now(),
    isRealForm: isRealForm(fields),
  };
}
