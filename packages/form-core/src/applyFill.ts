import { FieldFillResult, FillSummary, FormFieldSchema } from './types';

export interface NormalizedDateResult {
  formatted: string;
  confidence: 'high' | 'low';
  detectedDay: number;
  detectedMonth: number;
  detectedYear: number;
}

/**
 * Format a date string to the target field's expected format.
 * - Assumes DD/MM/YYYY (India standard).
 * - Treats ambiguous dates (both parts <= 12) as DD/MM and marks confidence "low".
 * - Uses MM/DD only if first number <= 12 and second number > 12 (clearly not a month).
 * - For text inputs, respects target format patterns.
 */
export function normalizeDateValue(
  rawDate: string,
  targetFormatOrSchema: string | FormFieldSchema = 'YYYY-MM-DD'
): NormalizedDateResult {
  if (!rawDate) {
    return { formatted: '', confidence: 'high', detectedDay: 0, detectedMonth: 0, detectedYear: 0 };
  }

  const trimmed = rawDate.trim();
  let day = 0;
  let month = 0;
  let year = 0;
  let confidence: 'high' | 'low' = 'high';

  // 1. Already ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
    confidence = 'high';
  } else {
    // 2. Parse N1 / N2 / N3 (separated by /, -, or .)
    const partsMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (partsMatch) {
      const n1 = parseInt(partsMatch[1], 10);
      const n2 = parseInt(partsMatch[2], 10);
      let n3 = parseInt(partsMatch[3], 10);
      if (n3 < 100) n3 = n3 > 50 ? 1900 + n3 : 2000 + n3;
      year = n3;

      if (n1 > 12 && n2 <= 12) {
        // n1 > 12 cannot be month -> definitely DD/MM/YYYY
        day = n1;
        month = n2;
        confidence = 'high';
      } else if (n1 <= 12 && n2 > 12) {
        // n2 > 12 cannot be month -> clearly MM/DD/YYYY
        month = n1;
        day = n2;
        confidence = 'high';
      } else if (n1 <= 12 && n2 <= 12) {
        // Ambiguous! (e.g. 05/10/1995 or 10/05/1995)
        // Assume Indian DD/MM/YYYY standard, but mark confidence "low"
        day = n1;
        month = n2;
        confidence = 'low';
      } else {
        day = n1;
        month = n2;
      }
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        year = parsed.getFullYear();
        month = parsed.getMonth() + 1;
        day = parsed.getDate();
        confidence = 'high';
      }
    }
  }

  // 3. Determine target format
  let targetFormat = 'YYYY-MM-DD';

  if (typeof targetFormatOrSchema === 'string') {
    targetFormat = targetFormatOrSchema;
  } else if (targetFormatOrSchema && typeof targetFormatOrSchema === 'object') {
    if (targetFormatOrSchema.type === 'date') {
      targetFormat = 'YYYY-MM-DD';
    } else {
      const pat = (targetFormatOrSchema.pattern || '').toLowerCase();
      const combined = `${targetFormatOrSchema.label} ${pat} ${targetFormatOrSchema.id}`.toLowerCase();

      if (/dd[-/.]mm[-/.]yyyy/i.test(combined) || /dd[-/.]mm[-/.]yyyy/i.test(pat)) {
        targetFormat = combined.includes('-') ? 'DD-MM-YYYY' : 'DD/MM/YYYY';
      } else if (/yyyy[-/.]mm[-/.]dd/i.test(combined) || /yyyy[-/.]mm[-/.]dd/i.test(pat)) {
        targetFormat = 'YYYY-MM-DD';
      } else if (/mm[-/.]dd[-/.]yyyy/i.test(combined)) {
        targetFormat = 'MM/DD/YYYY';
      } else {
        targetFormat = 'DD/MM/YYYY';
      }
    }
  }

  const ddStr = String(day).padStart(2, '0');
  const mmStr = String(month).padStart(2, '0');
  const yyyyStr = String(year);

  let formatted = `${yyyyStr}-${mmStr}-${ddStr}`;
  if (targetFormat === 'DD/MM/YYYY') formatted = `${ddStr}/${mmStr}/${yyyyStr}`;
  else if (targetFormat === 'DD-MM-YYYY') formatted = `${ddStr}-${mmStr}-${yyyyStr}`;
  else if (targetFormat === 'MM/DD/YYYY') formatted = `${mmStr}/${ddStr}/${yyyyStr}`;
  else if (targetFormat === 'YYYY/MM/DD') formatted = `${yyyyStr}/${mmStr}/${ddStr}`;

  return {
    formatted,
    confidence,
    detectedDay: day,
    detectedMonth: month,
    detectedYear: year,
  };
}

/**
 * Native value setter that bypasses React/Angular synthetic property trackers.
 */
function setNativeValue(element: HTMLElement, value: string): void {
  let valueSetter: ((v: any) => void) | undefined;

  if (element instanceof HTMLInputElement) {
    valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  } else if (element instanceof HTMLTextAreaElement) {
    valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  } else if (element instanceof HTMLSelectElement) {
    valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
  }

  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    (element as HTMLInputElement).value = value;
  }

  // Dispatch full lifecycle events with bubbles: true and composed: true
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
}

/**
 * Highlight a filled element visually according to Phase 1 spec.
 */
function highlightFilledElement(el: HTMLElement): void {
  el.style.setProperty('outline', '2px solid #22c55e', 'important');
  el.style.setProperty('outline-offset', '1px', 'important');
  el.setAttribute('data-tfb-filled', 'true');
}

/**
 * Fuzzy option matcher for <select> elements.
 */
function selectMatchingOption(select: HTMLSelectElement, targetValue: string): boolean {
  const normTarget = targetValue.toLowerCase().trim();
  const options = Array.from(select.options);

  // 1. Exact value match
  let matched = options.find(opt => opt.value.toLowerCase().trim() === normTarget);

  // 2. Exact text match
  if (!matched) {
    matched = options.find(opt => opt.text.toLowerCase().trim() === normTarget);
  }

  // 3. Substring match
  if (!matched) {
    matched = options.find(opt => {
      const optText = opt.text.toLowerCase().trim();
      const optVal = opt.value.toLowerCase().trim();
      return (
        (normTarget.length > 2 && (optText.includes(normTarget) || normTarget.includes(optText))) ||
        (optVal && normTarget.includes(optVal))
      );
    });
  }

  if (matched) {
    select.value = matched.value;
    setNativeValue(select, matched.value);
    return true;
  }

  return false;
}

/**
 * Fills matching radio button in group.
 */
function selectMatchingRadio(name: string, targetValue: string, doc: Document): boolean {
  const normTarget = targetValue.toLowerCase().trim();
  const radios = Array.from(doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`));

  // Pass 1: Exact match on value or label
  for (const radio of radios) {
    const val = (radio.value || '').toLowerCase().trim();
    const label = (radio.parentElement?.textContent || radio.getAttribute('aria-label') || '').toLowerCase().trim();

    if (val === normTarget || label === normTarget) {
      radio.checked = true;
      radio.click();
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      highlightFilledElement(radio);
      return true;
    }
  }

  // Pass 2: Word boundary regex match on label
  for (const radio of radios) {
    const label = (radio.parentElement?.textContent || radio.getAttribute('aria-label') || '').toLowerCase().trim();
    const wordRegex = new RegExp(`\\b${normTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (wordRegex.test(label)) {
      radio.checked = true;
      radio.click();
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      highlightFilledElement(radio);
      return true;
    }
  }

  return false;
}

/**
 * Fills checkbox.
 */
function setCheckboxState(checkbox: HTMLInputElement, targetValue: string): boolean {
  const isPositive = /^(true|1|yes|y|on|checked)$/i.test(targetValue.trim());
  if (checkbox.checked !== isPositive) {
    checkbox.click();
  }
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  highlightFilledElement(checkbox);
  return true;
}

/**
 * Safely attaches a File object to an <input type="file"> using DataTransfer API.
 * Dispatches synthetic 'input' and 'change' events.
 * Returns true if input.files was successfully populated, false if blocked or unsupported.
 */
export function attachFileToInput(input: HTMLInputElement, file: File): boolean {
  if (!input || input.type !== 'file') return false;
  try {
    if (typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      highlightFilledElement(input);
      return (input.files?.length || 0) > 0;
    }
  } catch (err) {
    console.warn('[TechFormBuddy] Programmatic file attachment failed:', err);
  }
  return false;
}

/**
 * Primary applyFill function.
 * Sets values correctly on real website DOMs (including React and Angular),
 * enforces Hard Rules, highlights filled inputs, and returns a detailed per-field audit summary.
 *
 * @param mapping Record<fieldId, profileKey> Mapping returned from backend / LLM schema resolution
 * @param values Record<profileKey, string> Plain values stored locally in user profile
 * @param root Document or Root element
 */
export function applyFill(
  mapping: Record<string, string>,
  values: Record<string, string>,
  fieldSchemas: FormFieldSchema[] = [],
  root: Document | ShadowRoot | Element = document
): FillSummary {
  const doc = root instanceof Document ? root : root.ownerDocument || document;
  const results: FieldFillResult[] = [];

  let filledCount = 0;
  let skippedCount = 0;
  let manualCount = 0;

  // Build schema map for fast lookup
  const schemaMap = new Map<string, FormFieldSchema>();
  fieldSchemas.forEach(f => schemaMap.set(f.id, f));

  for (const [fieldId, profileKey] of Object.entries(mapping)) {
    const schema = schemaMap.get(fieldId);
    const selector = schema?.selector || `#${fieldId}`;

    // Hard Rule 4 & 5: Check if field is manual / sensitive
    if (schema?.manual || schema?.sensitive) {
      manualCount++;
      results.push({
        fieldId,
        selector,
        status: 'manual',
        reason: schema.sensitive
          ? 'Sensitive field (Aadhaar/PAN/Passport/Card/Bank) - Please type this yourself.'
          : 'File upload or manual input required.',
      });
      continue;
    }

    // If profileKey is empty or not in user's values: skip
    if (!profileKey || !values[profileKey] || values[profileKey].trim() === '') {
      skippedCount++;
      results.push({
        fieldId,
        selector,
        status: 'skipped',
        reason: 'No matching profile value found.',
      });
      continue;
    }

    const rawValue = values[profileKey].trim();

    // Locate DOM element
    let el: HTMLElement | null = null;
    try {
      el = doc.querySelector<HTMLElement>(selector);
    } catch {
      // invalid selector fallback
    }

    if (!el && schema?.id) {
      el = doc.getElementById(schema.id);
    }

    if (!el) {
      skippedCount++;
      results.push({
        fieldId,
        selector,
        status: 'skipped',
        reason: 'Element not found in DOM.',
      });
      continue;
    }

    // Handle Radio groups
    if (schema?.type === 'radio' && schema.groupName) {
      const radioSuccess = selectMatchingRadio(schema.groupName, rawValue, doc);
      if (radioSuccess) {
        filledCount++;
        results.push({
          fieldId,
          selector,
          status: 'filled',
          valueApplied: rawValue,
        });
      } else {
        skippedCount++;
        results.push({
          fieldId,
          selector,
          status: 'skipped',
          reason: 'No matching radio option found.',
        });
      }
      continue;
    }

    // Handle Checkbox
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      setCheckboxState(el, rawValue);
      filledCount++;
      results.push({
        fieldId,
        selector,
        status: 'filled',
        valueApplied: rawValue,
      });
      continue;
    }

    // Handle Select
    if (el instanceof HTMLSelectElement) {
      const selectSuccess = selectMatchingOption(el, rawValue);
      if (selectSuccess) {
        filledCount++;
        highlightFilledElement(el);
        results.push({
          fieldId,
          selector,
          status: 'filled',
          valueApplied: el.value,
        });
      } else {
        skippedCount++;
        results.push({
          fieldId,
          selector,
          status: 'skipped',
          reason: 'No matching select option found.',
        });
      }
      continue;
    }

    // Handle Date input (or text input representing a date)
    if (
      (el instanceof HTMLInputElement && el.type === 'date') ||
      (schema?.type === 'date' && el instanceof HTMLInputElement)
    ) {
      const isNativeDateInput = el instanceof HTMLInputElement && el.type === 'date';
      const dateResult = normalizeDateValue(rawValue, isNativeDateInput ? 'YYYY-MM-DD' : schema);
      setNativeValue(el, dateResult.formatted);
      highlightFilledElement(el);
      filledCount++;
      results.push({
        fieldId,
        selector,
        status: 'filled',
        valueApplied: dateResult.formatted,
        reason: dateResult.confidence === 'low'
          ? 'Date format ambiguous; assumed DD/MM/YYYY (low confidence)'
          : undefined,
      });
      continue;
    }

    // Standard text / email / tel / number / textarea
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      setNativeValue(el, rawValue);
      highlightFilledElement(el);
      filledCount++;
      results.push({
        fieldId,
        selector,
        status: 'filled',
        valueApplied: rawValue,
      });
      continue;
    }

    skippedCount++;
    results.push({
      fieldId,
      selector,
      status: 'skipped',
      reason: 'Unsupported element type for auto-fill.',
    });
  }

  return {
    success: filledCount > 0,
    results,
    filledCount,
    skippedCount,
    manualCount,
  };
}

/**
 * Remove visual highlights from filled fields.
 */
export function clearHighlights(root: Document | ShadowRoot | Element = document): void {
  const filled = root.querySelectorAll<HTMLElement>('[data-tfb-filled="true"]');
  filled.forEach(el => {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.removeAttribute('data-tfb-filled');
  });
}
