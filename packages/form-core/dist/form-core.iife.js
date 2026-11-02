"use strict";
var TechFormBuddyCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // packages/form-core/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    AndroidInAppBrowserBridge: () => AndroidInAppBrowserBridge,
    ChromeExtensionBridge: () => ChromeExtensionBridge,
    FormChangeObserver: () => FormChangeObserver,
    GuideOverlay: () => GuideOverlay,
    KNOWN_LANGUAGE_NAMES: () => KNOWN_LANGUAGE_NAMES,
    MockBridge: () => MockBridge,
    OVERLAY_TRANSLATIONS: () => OVERLAY_TRANSLATIONS,
    SEMANTIC_TAXONOMY: () => SEMANTIC_TAXONOMY,
    SENSITIVE_FIELD_PATTERNS: () => SENSITIVE_FIELD_PATTERNS,
    TechFormBuddyCore: () => TechFormBuddyCore,
    analyzeField: () => analyzeField,
    analyzeForm: () => analyzeForm,
    applyFill: () => applyFill,
    attachFileToInput: () => attachFileToInput,
    clearHighlights: () => clearHighlights,
    createBridge: () => createBridge,
    default: () => index_default,
    destroy: () => destroy,
    detectSensitiveField: () => detectSensitiveField,
    generateSafeMapping: () => generateSafeMapping,
    generateSelector: () => generateSelector,
    isLanguageControl: () => isLanguageControl,
    isNavigationOrHeaderFooterControl: () => isNavigationOrHeaderFooterControl,
    isRealForm: () => isRealForm,
    isSearchControl: () => isSearchControl,
    isSensitiveField: () => isSensitiveField,
    mountOverlay: () => mountOverlay,
    normalizeDateValue: () => normalizeDateValue,
    patchHistoryOnce: () => patchHistoryOnce,
    readForm: () => readForm,
    registerTranslations: () => registerTranslations,
    unpatchHistory: () => unpatchHistory
  });

  // packages/form-core/src/readForm.ts
  var EXCLUDE_TYPE_PATTERNS = /* @__PURE__ */ new Set(["password", "hidden", "submit", "button", "reset", "image"]);
  var CAPTCHA_OTP_KEYWORDS = [
    "captcha",
    "recaptcha",
    "hcaptcha",
    "turnstile",
    "g-recaptcha",
    "otp",
    "one-time-code",
    "security_code",
    "verification_code",
    "passcode",
    "2fa",
    "mfa"
  ];
  var SENSITIVE_FIELD_PATTERNS = [
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
    /\b(password|pin|secret|otp|mpin|captcha)\b/i
  ];
  function isElementVisible(el) {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    if (el.style.display === "none" || el.style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && !el.offsetParent) {
      return false;
    }
    return true;
  }
  function isCaptchaOrOtp(el) {
    const checkString = `${el.id} ${el.getAttribute("name") || ""} ${el.className || ""} ${el.getAttribute("placeholder") || ""} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
    return CAPTCHA_OTP_KEYWORDS.some((kw) => checkString.includes(kw));
  }
  function isSensitiveField(label, name, id) {
    const combined = `${label} ${name} ${id}`;
    return SENSITIVE_FIELD_PATTERNS.some((rx) => rx.test(combined));
  }
  var KNOWN_LANGUAGE_NAMES = /* @__PURE__ */ new Set([
    "english",
    "hindi",
    "\u0939\u093F\u0928\u094D\u0926\u0940",
    "bengali",
    "\u09AC\u09BE\u0982\u09B2\u09BE",
    "telugu",
    "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41",
    "marathi",
    "\u092E\u0930\u093E\u0920\u0940",
    "tamil",
    "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD",
    "urdu",
    "\u0627\u0631\u062F\u0648",
    "gujarati",
    "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0",
    "kannada",
    "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1",
    "odia",
    "\u0B13\u0B21\u0B3C\u0B3F\u0B06",
    "malayalam",
    "\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02",
    "punjabi",
    "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40",
    "assamese",
    "\u0985\u09B8\u09AE\u09C0\u09AF\u09BC\u09BE",
    "maithili",
    "santali",
    "kashmiri",
    "nepali",
    "sindhi",
    "konkani",
    "dogri",
    "manipuri",
    "bodo",
    "sanskrit",
    "french",
    "spanish",
    "german",
    "japanese",
    "chinese"
  ]);
  function isLanguageControl(el) {
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
        if (langMatchCount >= 2 || options.length > 0 && langMatchCount / options.length >= 0.4) {
          return true;
        }
      }
    }
    const attrString = `${el.id} ${el.getAttribute("name") || ""} ${el.className || ""} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`.toLowerCase();
    if (/\b(lang|language|bhasha|locale|select_language|language_select|lang_choice)\b/i.test(attrString)) {
      return true;
    }
    const parent = el.closest('.language-selector, .lang-picker, .language-dropdown, #language, [id*="language" i], [class*="language" i], [class*="goog-te-combo"]');
    if (parent) {
      return true;
    }
    const parentLabel = el.closest("label");
    if (parentLabel && /\b(language|select\s+language|choose\s+language|भाषा)\b/i.test(parentLabel.textContent || "")) {
      return true;
    }
    return false;
  }
  function isSearchControl(el) {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "search") return true;
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (role === "search") return true;
    const attrString = `${el.id} ${el.getAttribute("name") || ""} ${el.className || ""} ${el.getAttribute("placeholder") || ""} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
    if (/\b(search|site_search|globalsearch|topsearch|search_query|searchbox|searchbar|search_input)\b/i.test(attrString)) {
      return true;
    }
    if (el.closest('[role="search"], form.search, form[action*="search" i]')) {
      return true;
    }
    const placeholder = (el.getAttribute("placeholder") || "").toLowerCase().trim();
    if (/^search(\s+here|\s+portal|\s+site|\.\.\.)?$/i.test(placeholder)) {
      return true;
    }
    return false;
  }
  function isNavigationOrHeaderFooterControl(el) {
    return Boolean(
      el.closest('header, nav, footer, [role="banner"], [role="navigation"], [role="contentinfo"], .navbar, .site-header, .site-footer, .header, .footer')
    );
  }
  function isRealForm(fields) {
    return Boolean(fields && fields.length >= 3);
  }
  function generateSelector(el, doc = document) {
    if (el.id && /^[A-Za-z0-9_-]+$/.test(el.id)) {
      try {
        const matches = doc.querySelectorAll(`#${CSS.escape(el.id)}`);
        if (matches.length === 1) {
          return `#${CSS.escape(el.id)}`;
        }
      } catch {
      }
    }
    const name = el.getAttribute("name");
    if (name && el.getAttribute("type") !== "radio") {
      try {
        const matches = doc.querySelectorAll(`[name="${CSS.escape(name)}"]`);
        if (matches.length === 1) {
          return `[name="${CSS.escape(name)}"]`;
        }
      } catch {
      }
    }
    if (el.getAttribute("type") === "radio" && name) {
      const val = el.getAttribute("value") || "";
      return `input[type="radio"][name="${CSS.escape(name)}"][value="${CSS.escape(val)}"]`;
    }
    const path = [];
    let current = el;
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
          sibling = sibling.previousElementSibling;
          if (sibling.nodeName === current.nodeName) {
            nth++;
          }
        }
        selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(" > ") || el.nodeName.toLowerCase();
  }
  function extractSectionHeading(el, doc) {
    const fieldset = el.closest("fieldset");
    if (fieldset) {
      const legend = fieldset.querySelector("legend");
      if (legend && legend.textContent) {
        return legend.textContent.trim();
      }
    }
    let node = el;
    while (node && node !== doc.body) {
      let prev = node.previousSibling;
      while (prev) {
        if (prev instanceof HTMLElement) {
          if (/^H[1-6]$/i.test(prev.tagName)) {
            return prev.textContent?.trim() || "";
          }
          const headingInside = prev.querySelector("h1, h2, h3, h4, h5, h6");
          if (headingInside) {
            return headingInside.textContent?.trim() || "";
          }
        }
        prev = prev.previousSibling;
      }
      node = node.parentNode;
    }
    return "";
  }
  function resolveFieldLabel(el, doc) {
    const id = el.id;
    if (id) {
      try {
        const labelEl = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (labelEl && labelEl.textContent?.trim()) {
          return cleanLabelText(labelEl.textContent);
        }
      } catch {
      }
    }
    const parentLabel = el.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input, select, textarea, button").forEach((c) => c.remove());
      if (clone.textContent?.trim()) {
        return cleanLabelText(clone.textContent);
      }
    }
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelNodes = labelledBy.split(/\s+/).map((refId) => doc.getElementById(refId)?.textContent?.trim()).filter(Boolean);
      if (labelNodes.length > 0) {
        return cleanLabelText(labelNodes.join(" "));
      }
    }
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      return cleanLabelText(ariaLabel);
    }
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && placeholder.trim()) {
      return cleanLabelText(placeholder);
    }
    let prev = el.previousElementSibling;
    while (prev) {
      if (prev instanceof HTMLElement && (prev.tagName === "LABEL" || prev.tagName === "SPAN" || prev.tagName === "P" || prev.tagName === "STRONG" || prev.className.includes("label"))) {
        if (prev.textContent?.trim()) {
          return cleanLabelText(prev.textContent);
        }
      }
      prev = prev.previousElementSibling;
    }
    const td = el.closest("td");
    if (td && td.parentElement) {
      const cellIndex = Array.from(td.parentElement.children).indexOf(td);
      const table = td.closest("table");
      if (table) {
        const th = table.querySelector(`thead th:nth-child(${cellIndex + 1})`);
        if (th && th.textContent?.trim()) {
          return cleanLabelText(th.textContent);
        }
      }
    }
    const fallback = el.getAttribute("name") || el.id || "";
    return cleanLabelFallback(fallback);
  }
  function cleanLabelText(text) {
    return text.replace(/\s+/g, " ").replace(/[*:]+$/, "").trim();
  }
  function cleanLabelFallback(val) {
    if (!val) return "Unnamed Field";
    return val.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }
  function normalizeType(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") return "select";
    if (tag === "textarea") return "textarea";
    const type = (el.getAttribute("type") || "text").toLowerCase();
    switch (type) {
      case "email":
        return "email";
      case "tel":
        return "tel";
      case "number":
        return "number";
      case "date":
        return "date";
      case "time":
        return "time";
      case "radio":
        return "radio";
      case "checkbox":
        return "checkbox";
      case "file":
        return "file";
      case "url":
        return "url";
      default:
        return "text";
    }
  }
  function collectFormElements(root) {
    const elements = [];
    const selector = "input, select, textarea";
    const nodes = root.querySelectorAll(selector);
    nodes.forEach((el) => elements.push(el));
    const allElements = root.querySelectorAll("*");
    allElements.forEach((el) => {
      if (el.shadowRoot) {
        elements.push(...collectFormElements(el.shadowRoot));
      }
    });
    const iframes = root.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        if (iframe.contentDocument) {
          elements.push(...collectFormElements(iframe.contentDocument));
        }
      } catch {
      }
    });
    return elements;
  }
  function readForm(root = document) {
    const doc = root instanceof Document ? root : root.ownerDocument || document;
    const rawElements = collectFormElements(root);
    const fields = [];
    const radioGroupMap = /* @__PURE__ */ new Map();
    let fieldCounter = 1;
    for (const el of rawElements) {
      const rawType = (el.getAttribute("type") || "").toLowerCase();
      if (EXCLUDE_TYPE_PATTERNS.has(rawType)) {
        continue;
      }
      if (!isElementVisible(el)) continue;
      if (isCaptchaOrOtp(el)) continue;
      if (el.tagName.toLowerCase() === "button") continue;
      if (isLanguageControl(el)) continue;
      if (isSearchControl(el)) continue;
      if (isNavigationOrHeaderFooterControl(el)) continue;
      const normalizedType = normalizeType(el);
      const label = resolveFieldLabel(el, doc);
      const name = el.getAttribute("name") || "";
      const id = el.id || `tfb_field_${fieldCounter++}`;
      const selector = generateSelector(el, doc);
      const section = extractSectionHeading(el, doc);
      const sensitive = isSensitiveField(label, name, id);
      const isFile = normalizedType === "file";
      const manual = isFile || sensitive;
      let options;
      if (normalizedType === "select" && el instanceof HTMLSelectElement) {
        options = Array.from(el.options).filter((opt) => opt.value !== "" || opt.text.trim() !== "").map((opt) => ({
          label: opt.text.trim(),
          value: opt.value.trim()
        }));
      }
      if (normalizedType === "radio") {
        const groupName = name || id;
        const optionVal = el.getAttribute("value") || label;
        const optItem = { label, value: optionVal };
        if (radioGroupMap.has(groupName)) {
          const existing = radioGroupMap.get(groupName);
          existing.options = existing.options || [];
          if (!existing.options.some((o) => o.value === optionVal)) {
            existing.options.push(optItem);
          }
          continue;
        } else {
          const radioField = {
            id: groupName,
            selector,
            type: "radio",
            label: name ? cleanLabelFallback(name) : label,
            section,
            options: [optItem],
            required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
            manual,
            sensitive,
            groupName
          };
          radioGroupMap.set(groupName, radioField);
          fields.push(radioField);
          continue;
        }
      }
      const required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true";
      const maxLength = el.hasAttribute("maxlength") ? parseInt(el.getAttribute("maxlength"), 10) : void 0;
      const pattern = el.getAttribute("pattern") || void 0;
      const min = el.getAttribute("min") || void 0;
      const max = el.getAttribute("max") || void 0;
      fields.push({
        id,
        selector,
        type: normalizedType,
        label,
        section,
        options,
        required,
        maxLength: isNaN(maxLength) ? void 0 : maxLength,
        pattern,
        min,
        max,
        manual,
        sensitive
      });
    }
    return {
      url: typeof window !== "undefined" ? window.location.href : "",
      title: typeof document !== "undefined" ? document.title : "Page Form",
      fields,
      scannedAt: Date.now(),
      isRealForm: isRealForm(fields)
    };
  }

  // packages/form-core/src/applyFill.ts
  function normalizeDateValue(rawDate, targetFormatOrSchema = "YYYY-MM-DD") {
    if (!rawDate) {
      return { formatted: "", confidence: "high", detectedDay: 0, detectedMonth: 0, detectedYear: 0 };
    }
    const trimmed = rawDate.trim();
    let day = 0;
    let month = 0;
    let year = 0;
    let confidence = "high";
    const isoMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
      confidence = "high";
    } else {
      const partsMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
      if (partsMatch) {
        const n1 = parseInt(partsMatch[1], 10);
        const n2 = parseInt(partsMatch[2], 10);
        let n3 = parseInt(partsMatch[3], 10);
        if (n3 < 100) n3 = n3 > 50 ? 1900 + n3 : 2e3 + n3;
        year = n3;
        if (n1 > 12 && n2 <= 12) {
          day = n1;
          month = n2;
          confidence = "high";
        } else if (n1 <= 12 && n2 > 12) {
          month = n1;
          day = n2;
          confidence = "high";
        } else if (n1 <= 12 && n2 <= 12) {
          day = n1;
          month = n2;
          confidence = "low";
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
          confidence = "high";
        }
      }
    }
    let targetFormat = "YYYY-MM-DD";
    if (typeof targetFormatOrSchema === "string") {
      targetFormat = targetFormatOrSchema;
    } else if (targetFormatOrSchema && typeof targetFormatOrSchema === "object") {
      if (targetFormatOrSchema.type === "date") {
        targetFormat = "YYYY-MM-DD";
      } else {
        const pat = (targetFormatOrSchema.pattern || "").toLowerCase();
        const combined = `${targetFormatOrSchema.label} ${pat} ${targetFormatOrSchema.id}`.toLowerCase();
        if (/dd[-/.]mm[-/.]yyyy/i.test(combined) || /dd[-/.]mm[-/.]yyyy/i.test(pat)) {
          targetFormat = combined.includes("-") ? "DD-MM-YYYY" : "DD/MM/YYYY";
        } else if (/yyyy[-/.]mm[-/.]dd/i.test(combined) || /yyyy[-/.]mm[-/.]dd/i.test(pat)) {
          targetFormat = "YYYY-MM-DD";
        } else if (/mm[-/.]dd[-/.]yyyy/i.test(combined)) {
          targetFormat = "MM/DD/YYYY";
        } else {
          targetFormat = "DD/MM/YYYY";
        }
      }
    }
    const ddStr = String(day).padStart(2, "0");
    const mmStr = String(month).padStart(2, "0");
    const yyyyStr = String(year);
    let formatted = `${yyyyStr}-${mmStr}-${ddStr}`;
    if (targetFormat === "DD/MM/YYYY") formatted = `${ddStr}/${mmStr}/${yyyyStr}`;
    else if (targetFormat === "DD-MM-YYYY") formatted = `${ddStr}-${mmStr}-${yyyyStr}`;
    else if (targetFormat === "MM/DD/YYYY") formatted = `${mmStr}/${ddStr}/${yyyyStr}`;
    else if (targetFormat === "YYYY/MM/DD") formatted = `${yyyyStr}/${mmStr}/${ddStr}`;
    return {
      formatted,
      confidence,
      detectedDay: day,
      detectedMonth: month,
      detectedYear: year
    };
  }
  function setNativeValue(element, value) {
    let valueSetter;
    if (element instanceof HTMLInputElement) {
      valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    } else if (element instanceof HTMLTextAreaElement) {
      valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    } else if (element instanceof HTMLSelectElement) {
      valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    }
    if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
  }
  function highlightFilledElement(el) {
    el.style.setProperty("outline", "2px solid #22c55e", "important");
    el.style.setProperty("outline-offset", "1px", "important");
    el.setAttribute("data-tfb-filled", "true");
  }
  function selectMatchingOption(select, targetValue) {
    const normTarget = targetValue.toLowerCase().trim();
    const options = Array.from(select.options);
    let matched = options.find((opt) => opt.value.toLowerCase().trim() === normTarget);
    if (!matched) {
      matched = options.find((opt) => opt.text.toLowerCase().trim() === normTarget);
    }
    if (!matched) {
      matched = options.find((opt) => {
        const optText = opt.text.toLowerCase().trim();
        const optVal = opt.value.toLowerCase().trim();
        return normTarget.length > 2 && (optText.includes(normTarget) || normTarget.includes(optText)) || optVal && normTarget.includes(optVal);
      });
    }
    if (matched) {
      select.value = matched.value;
      setNativeValue(select, matched.value);
      return true;
    }
    return false;
  }
  function selectMatchingRadio(name, targetValue, doc) {
    const normTarget = targetValue.toLowerCase().trim();
    const radios = Array.from(doc.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`));
    for (const radio of radios) {
      const val = (radio.value || "").toLowerCase().trim();
      const label = (radio.parentElement?.textContent || radio.getAttribute("aria-label") || "").toLowerCase().trim();
      if (val === normTarget || label === normTarget) {
        radio.checked = true;
        radio.click();
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        highlightFilledElement(radio);
        return true;
      }
    }
    for (const radio of radios) {
      const label = (radio.parentElement?.textContent || radio.getAttribute("aria-label") || "").toLowerCase().trim();
      const wordRegex = new RegExp(`\\b${normTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (wordRegex.test(label)) {
        radio.checked = true;
        radio.click();
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        highlightFilledElement(radio);
        return true;
      }
    }
    return false;
  }
  function setCheckboxState(checkbox, targetValue) {
    const isPositive = /^(true|1|yes|y|on|checked)$/i.test(targetValue.trim());
    if (checkbox.checked !== isPositive) {
      checkbox.click();
    }
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    highlightFilledElement(checkbox);
    return true;
  }
  function attachFileToInput(input, file) {
    if (!input || input.type !== "file") return false;
    try {
      if (typeof DataTransfer !== "undefined") {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        highlightFilledElement(input);
        return (input.files?.length || 0) > 0;
      }
    } catch (err) {
      console.warn("[TechFormBuddy] Programmatic file attachment failed:", err);
    }
    return false;
  }
  function applyFill(mapping, values, fieldSchemas = [], root = document) {
    const doc = root instanceof Document ? root : root.ownerDocument || document;
    const results = [];
    let filledCount = 0;
    let skippedCount = 0;
    let manualCount = 0;
    const schemaMap = /* @__PURE__ */ new Map();
    fieldSchemas.forEach((f) => schemaMap.set(f.id, f));
    for (const [fieldId, profileKey] of Object.entries(mapping)) {
      const schema = schemaMap.get(fieldId);
      const selector = schema?.selector || `#${fieldId}`;
      if (schema?.manual || schema?.sensitive) {
        manualCount++;
        results.push({
          fieldId,
          selector,
          status: "manual",
          reason: schema.sensitive ? "Sensitive field (Aadhaar/PAN/Passport/Card/Bank) - Please type this yourself." : "File upload or manual input required."
        });
        continue;
      }
      if (!profileKey || !values[profileKey] || values[profileKey].trim() === "") {
        skippedCount++;
        results.push({
          fieldId,
          selector,
          status: "skipped",
          reason: "No matching profile value found."
        });
        continue;
      }
      const rawValue = values[profileKey].trim();
      let el = null;
      try {
        el = doc.querySelector(selector);
      } catch {
      }
      if (!el && schema?.id) {
        el = doc.getElementById(schema.id);
      }
      if (!el) {
        skippedCount++;
        results.push({
          fieldId,
          selector,
          status: "skipped",
          reason: "Element not found in DOM."
        });
        continue;
      }
      if (schema?.type === "radio" && schema.groupName) {
        const radioSuccess = selectMatchingRadio(schema.groupName, rawValue, doc);
        if (radioSuccess) {
          filledCount++;
          results.push({
            fieldId,
            selector,
            status: "filled",
            valueApplied: rawValue
          });
        } else {
          skippedCount++;
          results.push({
            fieldId,
            selector,
            status: "skipped",
            reason: "No matching radio option found."
          });
        }
        continue;
      }
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        setCheckboxState(el, rawValue);
        filledCount++;
        results.push({
          fieldId,
          selector,
          status: "filled",
          valueApplied: rawValue
        });
        continue;
      }
      if (el instanceof HTMLSelectElement) {
        const selectSuccess = selectMatchingOption(el, rawValue);
        if (selectSuccess) {
          filledCount++;
          highlightFilledElement(el);
          results.push({
            fieldId,
            selector,
            status: "filled",
            valueApplied: el.value
          });
        } else {
          skippedCount++;
          results.push({
            fieldId,
            selector,
            status: "skipped",
            reason: "No matching select option found."
          });
        }
        continue;
      }
      if (el instanceof HTMLInputElement && el.type === "date" || schema?.type === "date" && el instanceof HTMLInputElement) {
        const isNativeDateInput = el instanceof HTMLInputElement && el.type === "date";
        const dateResult = normalizeDateValue(rawValue, isNativeDateInput ? "YYYY-MM-DD" : schema);
        setNativeValue(el, dateResult.formatted);
        highlightFilledElement(el);
        filledCount++;
        results.push({
          fieldId,
          selector,
          status: "filled",
          valueApplied: dateResult.formatted,
          reason: dateResult.confidence === "low" ? "Date format ambiguous; assumed DD/MM/YYYY (low confidence)" : void 0
        });
        continue;
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        setNativeValue(el, rawValue);
        highlightFilledElement(el);
        filledCount++;
        results.push({
          fieldId,
          selector,
          status: "filled",
          valueApplied: rawValue
        });
        continue;
      }
      skippedCount++;
      results.push({
        fieldId,
        selector,
        status: "skipped",
        reason: "Unsupported element type for auto-fill."
      });
    }
    return {
      success: filledCount > 0,
      results,
      filledCount,
      skippedCount,
      manualCount
    };
  }
  function clearHighlights(root = document) {
    const filled = root.querySelectorAll('[data-tfb-filled="true"]');
    filled.forEach((el) => {
      el.style.removeProperty("outline");
      el.style.removeProperty("outline-offset");
      el.removeAttribute("data-tfb-filled");
    });
  }

  // packages/form-core/src/observer.ts
  var isHistoryPatched = false;
  var globalOriginalPushState = null;
  var globalOriginalReplaceState = null;
  var activeUrlCallbacks = /* @__PURE__ */ new Set();
  var activeObservers = /* @__PURE__ */ new Set();
  function patchHistoryOnce() {
    if (typeof window === "undefined" || isHistoryPatched) return;
    globalOriginalPushState = history.pushState;
    globalOriginalReplaceState = history.replaceState;
    history.pushState = function(...args) {
      const result = globalOriginalPushState.apply(this, args);
      activeUrlCallbacks.forEach((cb) => cb());
      return result;
    };
    history.replaceState = function(...args) {
      const result = globalOriginalReplaceState.apply(this, args);
      activeUrlCallbacks.forEach((cb) => cb());
      return result;
    };
    isHistoryPatched = true;
  }
  function unpatchHistory() {
    if (typeof window === "undefined" || !isHistoryPatched) return;
    if (globalOriginalPushState) history.pushState = globalOriginalPushState;
    if (globalOriginalReplaceState) history.replaceState = globalOriginalReplaceState;
    globalOriginalPushState = null;
    globalOriginalReplaceState = null;
    isHistoryPatched = false;
    activeUrlCallbacks.clear();
  }
  var FormChangeObserver = class {
    constructor(debounceMs = 400) {
      this.debounceMs = debounceMs;
    }
    debounceMs;
    observer = null;
    currentUrl = "";
    debounceTimer = null;
    callback = null;
    observe(callback, targetNode = document.body) {
      this.callback = callback;
      if (typeof window === "undefined") return;
      activeObservers.add(this);
      this.currentUrl = window.location.href;
      if (typeof MutationObserver !== "undefined" && targetNode) {
        this.observer = new MutationObserver((mutations) => {
          let hasRelevantChange = false;
          for (const m of mutations) {
            if (m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
              for (const node of Array.from(m.addedNodes)) {
                if (node instanceof HTMLElement) {
                  if (node.matches("input, select, textarea, form") || node.querySelector("input, select, textarea, form")) {
                    hasRelevantChange = true;
                    break;
                  }
                }
              }
            }
            if (hasRelevantChange) break;
          }
          if (hasRelevantChange) {
            this.triggerDebounced("mutation");
          }
        });
        this.observer.observe(targetNode, {
          childList: true,
          subtree: true
        });
      }
      window.addEventListener("popstate", this.handleUrlChange);
      window.addEventListener("hashchange", this.handleUrlChange);
      patchHistoryOnce();
      activeUrlCallbacks.add(this.handleUrlChange);
    }
    handleUrlChange = () => {
      if (typeof window === "undefined") return;
      const newUrl = window.location.href;
      if (newUrl !== this.currentUrl) {
        this.currentUrl = newUrl;
        this.triggerDebounced("url_change");
      }
    };
    triggerDebounced(reason) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.callback?.(reason);
      }, this.debounceMs);
    }
    disconnect() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("popstate", this.handleUrlChange);
        window.removeEventListener("hashchange", this.handleUrlChange);
        activeUrlCallbacks.delete(this.handleUrlChange);
      }
      activeObservers.delete(this);
      this.callback = null;
    }
    static disconnectAll() {
      for (const obs of Array.from(activeObservers)) {
        obs.disconnect();
      }
      unpatchHistory();
    }
  };

  // packages/form-core/src/bridge.ts
  function createMessage(type, payload) {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      timestamp: Date.now()
    };
  }
  var ChromeExtensionBridge = class {
    listeners = /* @__PURE__ */ new Set();
    chromeListener = null;
    constructor() {
      this.initListener();
    }
    initListener() {
      if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
        this.chromeListener = (msg) => {
          if (msg && typeof msg === "object" && msg.type) {
            this.listeners.forEach((handler) => handler(msg));
          }
        };
        chrome.runtime.onMessage.addListener(this.chromeListener);
      }
    }
    async send(type, payload) {
      const message = createMessage(type, payload);
      return new Promise((resolve, reject) => {
        if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
          reject(new Error("chrome.runtime.sendMessage is not available in current environment."));
          return;
        }
        chrome.runtime.sendMessage(message, (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message || "Chrome runtime message error"));
            return;
          }
          resolve(response);
        });
      });
    }
    onMessage(handler) {
      this.listeners.add(handler);
      return () => {
        this.listeners.delete(handler);
      };
    }
    disconnect() {
      if (this.chromeListener && typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(this.chromeListener);
        this.chromeListener = null;
      }
      this.listeners.clear();
    }
  };
  var AndroidInAppBrowserBridge = class {
    listeners = /* @__PURE__ */ new Set();
    windowMessageListener = null;
    constructor() {
      this.initListener();
    }
    /**
     * Runtime feature detection to verify whether any Android host communication channel is available.
     */
    hasHostChannel() {
      if (typeof window === "undefined") return false;
      const win = window;
      return Boolean(
        win.messageFromWebview?.postMessage || win._capgoInAppBrowser?.postMessage || win.webkit?.messageHandlers?.messageFromWebview?.postMessage
      );
    }
    initListener() {
      if (typeof window === "undefined") return;
      this.windowMessageListener = (event) => {
        let data = event.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
          }
        }
        if (data && typeof data === "object" && data.type) {
          this.listeners.forEach((handler) => handler(data));
        }
      };
      window.addEventListener("message", this.windowMessageListener);
      window.__techformHostBridgeCallback = (msg) => {
        this.listeners.forEach((handler) => handler(msg));
      };
    }
    async send(type, payload) {
      const message = createMessage(type, payload);
      return new Promise((resolve, reject) => {
        try {
          if (typeof window === "undefined") {
            return reject(
              new Error(
                "AndroidInAppBrowserBridge [UNVERIFIED]: Host message channel is not available (window is undefined)"
              )
            );
          }
          const win = window;
          if (win.messageFromWebview?.postMessage) {
            win.messageFromWebview.postMessage(JSON.stringify(message));
            return resolve({ sent: true });
          }
          if (win._capgoInAppBrowser?.postMessage) {
            win._capgoInAppBrowser.postMessage(JSON.stringify(message));
            return resolve({ sent: true });
          }
          if (win.webkit?.messageHandlers?.messageFromWebview?.postMessage) {
            win.webkit.messageHandlers.messageFromWebview.postMessage(message);
            return resolve({ sent: true });
          }
          return reject(
            new Error(
              "AndroidInAppBrowserBridge [UNVERIFIED]: Host message channel is not available in the current environment. No messageFromWebview or _capgoInAppBrowser interface detected."
            )
          );
        } catch (err) {
          reject(err);
        }
      });
    }
    onMessage(handler) {
      this.listeners.add(handler);
      return () => {
        this.listeners.delete(handler);
      };
    }
    disconnect() {
      if (this.windowMessageListener && typeof window !== "undefined") {
        window.removeEventListener("message", this.windowMessageListener);
        this.windowMessageListener = null;
        delete window.__techformHostBridgeCallback;
      }
      this.listeners.clear();
    }
  };
  var MockBridge = class {
    listeners = /* @__PURE__ */ new Set();
    sentMessages = [];
    responseHandlers = /* @__PURE__ */ new Map();
    registerResponseHandler(type, handler) {
      this.responseHandlers.set(type, handler);
    }
    async send(type, payload) {
      const message = createMessage(type, payload);
      this.sentMessages.push(message);
      if (this.responseHandlers.has(type)) {
        const handler = this.responseHandlers.get(type);
        return handler(payload);
      }
      return { ack: true, id: message.id };
    }
    simulateIncomingMessage(type, payload) {
      const msg = createMessage(type, payload);
      this.listeners.forEach((handler) => handler(msg));
    }
    onMessage(handler) {
      this.listeners.add(handler);
      return () => {
        this.listeners.delete(handler);
      };
    }
    disconnect() {
      this.listeners.clear();
      this.sentMessages = [];
    }
  };
  function createBridge(type) {
    if (type === "chrome") return new ChromeExtensionBridge();
    if (type === "android") return new AndroidInAppBrowserBridge();
    if (type === "mock") return new MockBridge();
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      return new ChromeExtensionBridge();
    }
    if (typeof window !== "undefined" && (window.messageFromWebview || window.webkit?.messageHandlers?.messageFromWebview)) {
      return new AndroidInAppBrowserBridge();
    }
    return new MockBridge();
  }

  // packages/form-core/src/analyzer.ts
  var SEMANTIC_TAXONOMY = [
    // 1. Applicant First Name
    {
      category: "APPLICANT_FIRST_NAME",
      candidateProfileKeys: ["first_name", "firstName"],
      allowedInputTypes: ["text"],
      positivePatterns: [
        /\bfirst[\s_-]?name\b/i,
        /\bgiven[\s_-]?name\b/i,
        /\bforename\b/i,
        /\bप्रथम[\s_-]?नाम\b/i
      ],
      negativePatterns: [
        /\b(last|middle|father|mother|parent|spouse|guardian|nominee|witness|bank|branch|college|school|company|hospital|doctor|user|login)\b/i
      ],
      explanationEn: "Applicant's official first name as shown on government ID.",
      whatToEnterEn: "Enter your legal first name only."
    },
    // 2. Applicant Last Name
    {
      category: "APPLICANT_LAST_NAME",
      candidateProfileKeys: ["last_name", "lastName", "surname"],
      allowedInputTypes: ["text"],
      positivePatterns: [
        /\blast[\s_-]?name\b/i,
        /\bsurname\b/i,
        /\bfamily[\s_-]?name\b/i,
        /\bउपनाम\b/i
      ],
      negativePatterns: [
        /\b(first|middle|father|mother|parent|spouse|guardian|nominee|witness|bank|branch|college|school|company|hospital|doctor|user|login)\b/i
      ],
      explanationEn: "Applicant's surname or family name.",
      whatToEnterEn: "Enter your legal surname / last name."
    },
    // 3. Applicant Full Name (Strict: must NOT be father/mother/organization/school/bank/username)
    {
      category: "APPLICANT_FULL_NAME",
      candidateProfileKeys: ["full_name", "fullName", "name"],
      allowedInputTypes: ["text"],
      positivePatterns: [
        /\bfull[\s_-]?name\b/i,
        /\bapplicant[\s_-]?name\b/i,
        /\bcandidate[\s_-]?name\b/i,
        /\bstudent[\s_-]?name\b/i,
        /\bname\s+of\s+(the\s+)?applicant\b/i,
        /\bname\s+of\s+(the\s+)?candidate\b/i,
        /\bनाम\b/i,
        /\bपूरा[\s_-]?नाम\b/i,
        /^name$/i
      ],
      negativePatterns: [
        /\b(first|last|middle|father|mother|parent|spouse|husband|wife|guardian|nominee|witness|employer|company|firm|org|organization|bank|branch|college|school|university|institute|hospital|doctor|ref|reference|user|username|login|scheme|service|project|file|document)\b/i
      ],
      sectionNegative: [
        /\b(father|mother|parent|guardian|spouse|nominee|witness|bank|employer|office)\b/i
      ],
      explanationEn: "Applicant's complete legal name as registered in profile.",
      whatToEnterEn: "Enter your full legal name as per government records."
    },
    // 4. Father's Name (Strict role isolation)
    {
      category: "FATHER_NAME",
      candidateProfileKeys: ["father_name", "fatherName"],
      allowedInputTypes: ["text"],
      positivePatterns: [
        /\bfather('?s)?[\s_-]?name\b/i,
        /\bपिता[\s_-]?का[\s_-]?नाम\b/i,
        /\bपिता\b/i
      ],
      negativePatterns: [
        /\b(mother|spouse|guardian|applicant|wife|husband|nominee)\b/i
      ],
      explanationEn: "Father's official legal name.",
      whatToEnterEn: "Enter your father's full name."
    },
    // 5. Mother's Name (Strict role isolation)
    {
      category: "MOTHER_NAME",
      candidateProfileKeys: ["mother_name", "motherName"],
      allowedInputTypes: ["text"],
      positivePatterns: [
        /\bmother('?s)?[\s_-]?name\b/i,
        /\bमाता[\s_-]?का[\s_-]?नाम\b/i,
        /\bमाता\b/i
      ],
      negativePatterns: [
        /\b(father|spouse|guardian|applicant|wife|husband|nominee)\b/i
      ],
      explanationEn: "Mother's official legal name.",
      whatToEnterEn: "Enter your mother's full name."
    },
    // 6. Spouse Name
    {
      category: "SPOUSE_NAME",
      candidateProfileKeys: ["spouse_name", "spouseName", "husband_name", "wife_name"],
      allowedInputTypes: ["text"],
      positivePatterns: [
        /\bspouse('?s)?[\s_-]?name\b/i,
        /\bhusband('?s)?[\s_-]?name\b/i,
        /\bwife('?s)?[\s_-]?name\b/i,
        /\bपति\/?पत्नी\b/i
      ],
      negativePatterns: [
        /\b(father|mother|applicant)\b/i
      ],
      explanationEn: "Spouse's legal name.",
      whatToEnterEn: "Enter your spouse's name if married."
    },
    // 7. Email Address (Must NOT be physical address, web URL, or phone)
    {
      category: "EMAIL_ADDRESS",
      candidateProfileKeys: ["email", "email_address", "emailAddress"],
      allowedInputTypes: ["email", "text"],
      positivePatterns: [
        /\be[\s_-]?mail(\s+id|\s+address)?\b/i,
        /\bईमेल\b/i
      ],
      negativePatterns: [
        /\b(phone|mobile|fax|street|residential|permanent|postal|pin|office|employer|father|mother)\b/i
      ],
      explanationEn: "Primary contact email address for alerts and notifications.",
      whatToEnterEn: "Enter your active email address (e.g. name@example.com)."
    },
    // 8. Mobile / Phone Number (Must NOT be fax, landline, emergency contact, or parent's phone)
    {
      category: "PRIMARY_MOBILE",
      candidateProfileKeys: ["phone", "mobile", "phone_number", "mobile_number", "phoneNumber", "mobileNumber"],
      allowedInputTypes: ["tel", "text", "number"],
      positivePatterns: [
        /\bmobile(\s+no|\s+num|\s+number)?\b/i,
        /\bphone(\s+no|\s+num|\s+number)?\b/i,
        /\bcontact[\s_-]?number\b/i,
        /\bcell[\s_-]?phone\b/i,
        /\bमोबाइल(\s+नंबर)?\b/i,
        /\bदूरभाष\b/i
      ],
      negativePatterns: [
        /\b(fax|emergency|alternate|alt|secondary|father|mother|guardian|office|work|landline|pincode)\b/i
      ],
      explanationEn: "Primary 10-digit mobile number for communication.",
      whatToEnterEn: "Enter your 10-digit mobile phone number."
    },
    // 9. Date of Birth (Must NOT be issue date, expiry date, registration date, or admission date)
    {
      category: "DATE_OF_BIRTH",
      candidateProfileKeys: ["date_of_birth", "dob", "birth_date", "dateOfBirth"],
      allowedInputTypes: ["date", "text"],
      positivePatterns: [
        /\bdate\s+of\s+birth\b/i,
        /\bbirth[\s_-]?date\b/i,
        /\bd\.?o\.?b\.?\b/i,
        /\bजन्म[\s_-]?तिथि\b/i,
        /\bजन्म[\s_-]?तारीख\b/i
      ],
      negativePatterns: [
        /\b(issue|expiry|expire|validity|valid|registration|admission|joining|leaving|event|today|transaction|receipt|dispatch|order|invoice)\b/i
      ],
      explanationEn: "Official date of birth according to birth certificate or matriculation marksheet.",
      whatToEnterEn: "Enter your date of birth (DD/MM/YYYY)."
    },
    // 10. Gender
    {
      category: "GENDER",
      candidateProfileKeys: ["gender", "sex"],
      allowedInputTypes: ["select", "radio", "text"],
      positivePatterns: [
        /\bgender\b/i,
        /\bsex\b/i,
        /\bलिंग\b/i
      ],
      negativePatterns: [],
      explanationEn: "Gender identity (Male / Female / Transgender / Other).",
      whatToEnterEn: "Select or specify your gender."
    },
    // 11. Blood Group
    {
      category: "BLOOD_GROUP",
      candidateProfileKeys: ["blood_group", "bloodGroup"],
      allowedInputTypes: ["select", "text"],
      positivePatterns: [
        /\bblood[\s_-]?group\b/i,
        /\bblood[\s_-]?type\b/i,
        /\bरक्त[\s_-]?समूह\b/i
      ],
      negativePatterns: [],
      explanationEn: "Medical blood group classification (e.g. O+, A+, B+).",
      whatToEnterEn: "Select your blood group."
    },
    // 12. Marital Status
    {
      category: "MARITAL_STATUS",
      candidateProfileKeys: ["marital_status", "maritalStatus"],
      allowedInputTypes: ["select", "radio", "text"],
      positivePatterns: [
        /\bmarital[\s_-]?status\b/i,
        /\bवैवाहिक[\s_-]?स्थिति\b/i
      ],
      negativePatterns: [],
      explanationEn: "Marital status (Single, Married, Divorced, Widowed).",
      whatToEnterEn: "Select your marital status."
    },
    // 13. Occupation / Profession
    {
      category: "OCCUPATION",
      candidateProfileKeys: ["occupation", "profession", "job"],
      allowedInputTypes: ["text", "select"],
      positivePatterns: [
        /\boccupation\b/i,
        /\bprofession\b/i,
        /\bव्यवसाय\b/i,
        /\bपेशा\b/i
      ],
      negativePatterns: [
        /\b(father|mother|spouse)\b/i
      ],
      explanationEn: "Current employment or professional occupation.",
      whatToEnterEn: "Enter your current occupation / profession."
    },
    // 14. Full Residential Address (Must NOT be email address, office address, or permanent if looking for present)
    {
      category: "FULL_ADDRESS",
      candidateProfileKeys: ["address", "residential_address", "full_address"],
      allowedInputTypes: ["textarea", "text"],
      positivePatterns: [
        /\bresidential[\s_-]?address\b/i,
        /\bpresent[\s_-]?address\b/i,
        /\bcurrent[\s_-]?address\b/i,
        /\bcommunication[\s_-]?address\b/i,
        /\bcorrespondence[\s_-]?address\b/i,
        /\bfull[\s_-]?address\b/i,
        /\baddress[\s_-]?line\b/i,
        /\bपता\b/i,
        /\bवर्तमान[\s_-]?पता\b/i,
        /\bनिवास[\s_-]?का[\s_-]?पता\b/i,
        /^address$/i
      ],
      negativePatterns: [
        /\b(email|web|ip|mac|url|office|work|employer|permanent|native|hospital|school|college|branch|bank)\b/i
      ],
      sectionNegative: [
        /\b(office|employer|permanent|bank)\b/i
      ],
      explanationEn: "Full residential street address with house number and locality.",
      whatToEnterEn: "Enter your complete postal / residential address."
    },
    // 15. City / District
    {
      category: "CITY",
      candidateProfileKeys: ["city", "district"],
      allowedInputTypes: ["text", "select"],
      positivePatterns: [
        /\bcity\b/i,
        /\btown\b/i,
        /\bdistrict\b/i,
        /\bशहर\b/i,
        /\bजिला\b/i
      ],
      negativePatterns: [
        /\b(state|country|pincode|zip|address|street)\b/i
      ],
      explanationEn: "City, town or administrative district name.",
      whatToEnterEn: "Enter your city or district name."
    },
    // 16. State / Union Territory
    {
      category: "STATE",
      candidateProfileKeys: ["state", "province", "ut"],
      allowedInputTypes: ["select", "text"],
      positivePatterns: [
        /\bstate\b/i,
        /\bunion[\s_-]?territory\b/i,
        /\bprovince\b/i,
        /\bराज्य\b/i
      ],
      negativePatterns: [
        /\b(statement|status|static|estate|city|country|pincode|zip)\b/i
      ],
      explanationEn: "State or Union Territory of residence.",
      whatToEnterEn: "Select or type your State / UT."
    },
    // 17. Pincode / Postal Code / Zip
    {
      category: "PINCODE",
      candidateProfileKeys: ["pincode", "postal_code", "zip", "pinCode", "postalCode"],
      allowedInputTypes: ["text", "number"],
      positivePatterns: [
        /\bpin[\s_-]?code\b/i,
        /\bpostal[\s_-]?code\b/i,
        /\bzip[\s_-]?code\b/i,
        /\bपिनकोड\b/i,
        /\bडाक[\s_-]?कोड\b/i
      ],
      negativePatterns: [
        /\b(state|city|country|phone|mobile)\b/i
      ],
      explanationEn: "6-digit postal index number (PIN code).",
      whatToEnterEn: "Enter your 6-digit postal PIN code."
    },
    // 18. Country / Nationality
    {
      category: "COUNTRY",
      candidateProfileKeys: ["country", "nationality"],
      allowedInputTypes: ["select", "text"],
      positivePatterns: [
        /\bcountry\b/i,
        /\bnationality\b/i,
        /\bदेश\b/i,
        /\bराष्ट्रीयता\b/i
      ],
      negativePatterns: [
        /\b(state|city|district|county|pincode)\b/i
      ],
      explanationEn: "Country of residence or legal citizenship.",
      whatToEnterEn: "Select or enter your country (e.g. India)."
    }
  ];
  var SENSITIVE_PATTERNS = [
    { name: "Aadhaar", pattern: /\b(aadhaar|aadhar|uidai|uid)\b|आधार/i },
    { name: "PAN", pattern: /\b(pan(?!\s*[-–]\s*[a-z])|permanent\s+account\s+number)\b|पैन/i },
    { name: "Passport", pattern: /\bpassport\b|पासपोर्ट/i },
    { name: "Bank Account", pattern: /\b(bank\s+acc(ount)?|acc(ount)?\s*no(umber)?|ifsc|micr|iban)\b|खाता|बैंक/i },
    { name: "Payment Card", pattern: /\b(card\s*no(umber)?|credit\s*card|debit\s*card|cvv|cvc|cvv2|cid)\b/i },
    { name: "Voter ID (EPIC)", pattern: /\b(epic|epic\s*no(umber)?|voter\s*id)\b|मतदाता/i },
    { name: "Credential / Secret", pattern: /\b(password|pin|secret|otp|mpin|captcha)\b/i }
  ];
  function detectSensitiveField(field) {
    const combined = `${field.label} ${field.id} ${field.selector} ${field.section}`.toLowerCase();
    for (const s of SENSITIVE_PATTERNS) {
      if (s.pattern.test(combined)) {
        return { isSensitive: true, kind: s.name };
      }
    }
    return { isSensitive: false };
  }
  function analyzeField(field, availableProfileKeys) {
    const sensitiveCheck = detectSensitiveField(field);
    if (sensitiveCheck.isSensitive || field.sensitive) {
      return {
        fieldId: field.id,
        selector: field.selector,
        label: field.label,
        type: field.type,
        profileKey: null,
        confidence: 1,
        canFill: false,
        manual: true,
        sensitive: true,
        explanation: `This is a sensitive ${sensitiveCheck.kind || "identity/financial"} field.`,
        whatToEnter: "Please type this yourself on the official website. For your security, TechForm Buddy never stores or autofills ID/card/bank numbers.",
        reason: "Sensitive field (Hard Rule 4 enforced)"
      };
    }
    if (field.type === "file" || field.manual) {
      return {
        fieldId: field.id,
        selector: field.selector,
        label: field.label,
        type: field.type,
        profileKey: null,
        confidence: 1,
        canFill: false,
        manual: true,
        sensitive: false,
        explanation: "File upload field requires choosing an actual file from your device.",
        whatToEnter: "Click browse and select your file manually.",
        reason: "File upload (Manual action required)"
      };
    }
    const textCorpus = `${field.label} ${field.id}`.toLowerCase();
    const sectionText = (field.section || "").toLowerCase();
    let bestRule = null;
    let bestScore = 0;
    let matchedProfileKey = null;
    for (const rule of SEMANTIC_TAXONOMY) {
      if (!rule.allowedInputTypes.includes(field.type)) {
        continue;
      }
      const hasDisqualifier = rule.negativePatterns.some((pat) => pat.test(textCorpus));
      if (hasDisqualifier) {
        continue;
      }
      if (rule.sectionNegative && rule.sectionNegative.some((pat) => pat.test(sectionText))) {
        continue;
      }
      let score = 0;
      const positiveMatched = rule.positivePatterns.some((pat) => pat.test(textCorpus));
      if (positiveMatched) {
        score += 0.85;
        if (rule.sectionPositive && rule.sectionPositive.some((pat) => pat.test(sectionText))) {
          score += 0.1;
        }
        if (rule.positivePatterns.some((pat) => pat.source.startsWith("^") && pat.test(field.label))) {
          score += 0.1;
        }
      }
      if (score > bestScore) {
        const candidateKey = rule.candidateProfileKeys.find((k) => availableProfileKeys.includes(k));
        if (candidateKey) {
          bestScore = Math.min(1, score);
          bestRule = rule;
          matchedProfileKey = candidateKey;
        }
      }
    }
    const CONFIDENCE_THRESHOLD = 0.8;
    if (bestRule && matchedProfileKey && bestScore >= CONFIDENCE_THRESHOLD) {
      return {
        fieldId: field.id,
        selector: field.selector,
        label: field.label,
        type: field.type,
        profileKey: matchedProfileKey,
        confidence: Number(bestScore.toFixed(2)),
        canFill: true,
        manual: false,
        sensitive: false,
        explanation: bestRule.explanationEn,
        whatToEnter: bestRule.whatToEnterEn
      };
    }
    return {
      fieldId: field.id,
      selector: field.selector,
      label: field.label,
      type: field.type,
      profileKey: null,
      confidence: Number(bestScore.toFixed(2)),
      canFill: false,
      manual: true,
      sensitive: false,
      explanation: `Field "${field.label}" does not have a reliable, high-confidence match in your profile.`,
      whatToEnter: "Please enter this value manually if required.",
      reason: "Confidence below threshold (< 0.80) or ambiguous field (Hard Rule 6: never guess)"
    };
  }
  function analyzeForm(fields, availableProfileKeys) {
    const analysisResults = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let manualCount = 0;
    let sensitiveCount = 0;
    for (const field of fields) {
      const res = analyzeField(field, availableProfileKeys);
      analysisResults.push(res);
      if (res.sensitive) {
        sensitiveCount++;
        manualCount++;
      } else if (res.canFill) {
        matchedCount++;
      } else if (res.manual) {
        manualCount++;
      } else {
        unmatchedCount++;
      }
    }
    return {
      fields: analysisResults,
      matchedCount,
      unmatchedCount,
      manualCount,
      sensitiveCount
    };
  }
  function generateSafeMapping(fields, availableProfileKeys) {
    const summary = analyzeForm(fields, availableProfileKeys);
    const mapping = {};
    for (const res of summary.fields) {
      if (res.canFill && res.profileKey && res.confidence >= 0.8 && !res.sensitive && !res.manual) {
        mapping[res.fieldId] = res.profileKey;
      }
    }
    return mapping;
  }

  // src/lib/languages.ts
  var SUPPORTED_LANGUAGES = [
    { code: "en", label: "English (India)", nativeName: "English", bcp47: "en-IN" },
    { code: "hi", label: "Hindi", nativeName: "\u0939\u093F\u0928\u094D\u0926\u0940", bcp47: "hi-IN" },
    { code: "ta", label: "Tamil", nativeName: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD", bcp47: "ta-IN" },
    { code: "te", label: "Telugu", nativeName: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41", bcp47: "te-IN" },
    { code: "bn", label: "Bengali", nativeName: "\u09AC\u09BE\u0982\u09B2\u09BE", bcp47: "bn-IN" },
    { code: "mr", label: "Marathi", nativeName: "\u092E\u0930\u093E\u0920\u0940", bcp47: "mr-IN" },
    { code: "gu", label: "Gujarati", nativeName: "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0", bcp47: "gu-IN" },
    { code: "kn", label: "Kannada", nativeName: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1", bcp47: "kn-IN" },
    { code: "ml", label: "Malayalam", nativeName: "\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02", bcp47: "ml-IN" },
    { code: "pa", label: "Punjabi", nativeName: "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40", bcp47: "pa-IN" },
    { code: "ur", label: "Urdu", nativeName: "\u0627\u0631\u062F\u0648", bcp47: "ur-IN" }
  ];
  var ALLOWED_LANGUAGE_CODES = new Set(
    SUPPORTED_LANGUAGES.map((l) => l.code)
  );
  function sanitizeLanguage(code) {
    if (!code || typeof code !== "string") return "en";
    const clean = code.trim().toLowerCase().split(/[-_]/)[0];
    if (ALLOWED_LANGUAGE_CODES.has(clean)) {
      return clean;
    }
    return "en";
  }
  function getLanguageBcp47(code) {
    const safeCode = sanitizeLanguage(code);
    const match = SUPPORTED_LANGUAGES.find((l) => l.code === safeCode);
    return match?.bcp47 || "en-IN";
  }
  var LANG_CODE_TO_LABEL = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((l) => [l.code, l.label])
  );
  var LANG_CODE_TO_NATIVE = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((l) => [l.code, l.nativeName])
  );

  // packages/form-core/src/overlay.ts
  var OVERLAY_TRANSLATIONS = {
    en: {
      title: "TechForm Buddy Guide",
      loginOtpNotice: "Login, OTP and captcha are done by you.",
      fieldProgress: (c, t) => `Field ${c} of ${t}`,
      stepProgress: (c, t) => `Step ${c} of ${t}`,
      pageGuideTitle: "Portal Navigation Guide",
      autoReadToggle: "Auto-read each step",
      noVoiceNotice: (l) => `Notice: No voice installed for ${l} on this system. Audio may use default synthesizer.`,
      activeTaskLabel: "Active Task",
      guideElementHighlighted: "Click highlighted element",
      btnFillThis: "Fill this",
      btnFillAll: "Fill all",
      btnNext: "Next",
      btnPrev: "Previous",
      btnReadAloud: "Read aloud",
      btnStopAudio: "Stop audio",
      btnDone: "Done",
      sensitiveFieldWarning: "Sensitive ID / Financial field: Please type this yourself.",
      reviewAndSubmitMessage: "Review everything on the page, then press Submit yourself on the website.",
      noAutoSubmitNotice: "TechForm Buddy never auto-submits forms or clicks payment buttons.",
      manualActionRequired: "Manual action required (file upload or document).",
      completedTitle: "Form Review Ready!"
    },
    hi: {
      title: "\u091F\u0947\u0915\u092B\u0949\u0930\u094D\u092E \u092C\u0921\u0940 \u0917\u093E\u0907\u0921",
      loginOtpNotice: "\u0932\u0949\u0917\u093F\u0928, \u0913\u091F\u0940\u092A\u0940 \u0914\u0930 \u0915\u0948\u092A\u094D\u091A\u093E \u0906\u092A\u0915\u094B \u0938\u094D\u0935\u092F\u0902 \u092D\u0930\u0928\u093E \u0939\u0948\u0964",
      fieldProgress: (c, t) => `\u092B\u093C\u0940\u0932\u094D\u0921 ${c} / ${t}`,
      stepProgress: (c, t) => `\u091A\u0930\u0923 ${c} / ${t}`,
      pageGuideTitle: "\u092A\u094B\u0930\u094D\u091F\u0932 \u0928\u0947\u0935\u093F\u0917\u0947\u0936\u0928 \u0917\u093E\u0907\u0921",
      autoReadToggle: "\u092A\u094D\u0930\u0924\u094D\u092F\u0947\u0915 \u091A\u0930\u0923 \u092C\u094B\u0932\u0915\u0930 \u0938\u0941\u0928\u093E\u090F\u0902",
      noVoiceNotice: (l) => `\u0938\u0942\u091A\u0928\u093E: \u0907\u0938 \u0938\u093F\u0938\u094D\u091F\u092E \u092A\u0930 ${l} \u0915\u0947 \u0932\u093F\u090F \u0915\u094B\u0908 \u0906\u0935\u093E\u091C \u0928\u0939\u0940\u0902 \u092E\u093F\u0932\u0940\u0964`,
      activeTaskLabel: "\u0938\u0915\u094D\u0930\u093F\u092F \u0915\u093E\u0930\u094D\u092F",
      guideElementHighlighted: "\u0939\u093E\u0907\u0932\u093E\u0907\u091F \u0915\u093F\u090F \u0917\u090F \u0935\u093F\u0915\u0932\u094D\u092A \u092A\u0930 \u0915\u094D\u0932\u093F\u0915 \u0915\u0930\u0947\u0902",
      btnFillThis: "\u092F\u0939 \u092D\u0930\u0947\u0902",
      btnFillAll: "\u0938\u092D\u0940 \u092D\u0930\u0947\u0902",
      btnNext: "\u0906\u0917\u0947",
      btnPrev: "\u092A\u0940\u091B\u0947",
      btnReadAloud: "\u092C\u094B\u0932\u0915\u0930 \u0938\u0941\u0928\u093E\u090F\u0902",
      btnStopAudio: "\u0930\u094B\u0915\u0947\u0902",
      btnDone: "\u092A\u0942\u0930\u094D\u0923",
      sensitiveFieldWarning: "\u0938\u0902\u0935\u0947\u0926\u0928\u0936\u0940\u0932 \u092A\u0939\u091A\u093E\u0928/\u0935\u093F\u0924\u094D\u0924\u0940\u092F \u092B\u093C\u0940\u0932\u094D\u0921: \u0915\u0943\u092A\u092F\u093E \u0907\u0938\u0947 \u0938\u094D\u0935\u092F\u0902 \u091F\u093E\u0907\u092A \u0915\u0930\u0947\u0902\u0964",
      reviewAndSubmitMessage: "\u092A\u0943\u0937\u094D\u0920 \u092A\u0930 \u0938\u092C \u0915\u0941\u091B \u091C\u093E\u0902\u091A\u0947\u0902, \u092B\u093F\u0930 \u0935\u0947\u092C\u0938\u093E\u0907\u091F \u092A\u0930 \u0938\u094D\u0935\u092F\u0902 \u0938\u092C\u092E\u093F\u091F \u0926\u092C\u093E\u090F\u0902\u0964",
      noAutoSubmitNotice: "\u091F\u0947\u0915\u092B\u0949\u0930\u094D\u092E \u092C\u0921\u0940 \u0915\u092D\u0940 \u092D\u0940 \u0938\u094D\u0935\u091A\u093E\u0932\u093F\u0924 \u0930\u0942\u092A \u0938\u0947 \u0938\u092C\u092E\u093F\u091F \u092F\u093E \u092D\u0941\u0917\u0924\u093E\u0928 \u0928\u0939\u0940\u0902 \u0915\u0930\u0924\u093E \u0939\u0948\u0964",
      manualActionRequired: "\u092E\u0948\u0928\u094D\u092F\u0941\u0905\u0932 \u0915\u093E\u0930\u094D\u0930\u0935\u093E\u0908 \u0906\u0935\u0936\u094D\u092F\u0915 \u0939\u0948 (\u092B\u093C\u093E\u0907\u0932 \u0905\u092A\u0932\u094B\u0921)\u0964",
      completedTitle: "\u0938\u092E\u0940\u0915\u094D\u0937\u093E \u0924\u0948\u092F\u093E\u0930 \u0939\u0948!"
    },
    bn: {
      title: "\u099F\u09C7\u0995\u09AB\u09B0\u09CD\u09AE \u09AC\u09BE\u09A1\u09BF \u0997\u09BE\u0987\u09A1",
      loginOtpNotice: "\u09B2\u0997\u0987\u09A8, \u0993\u099F\u09BF\u09AA\u09BF \u098F\u09AC\u0982 \u0995\u09CD\u09AF\u09BE\u09AA\u099A\u09BE \u0986\u09AA\u09A8\u09BE\u09B0 \u09A8\u09BF\u099C\u09C7\u09B0 \u0995\u09B0\u09A4\u09C7 \u09B9\u09AC\u09C7\u0964",
      fieldProgress: (c, t) => `\u0995\u09CD\u09B7\u09C7\u09A4\u09CD\u09B0 ${c} / ${t}`,
      btnFillThis: "\u098F\u099F\u09BF \u09AA\u09C2\u09B0\u09A3 \u0995\u09B0\u09C1\u09A8",
      btnFillAll: "\u09B8\u09AC \u09AA\u09C2\u09B0\u09A3 \u0995\u09B0\u09C1\u09A8",
      btnNext: "\u09AA\u09B0\u09AC\u09B0\u09CD\u09A4\u09C0",
      btnPrev: "\u09AA\u09C2\u09B0\u09CD\u09AC\u09AC\u09B0\u09CD\u09A4\u09C0",
      btnReadAloud: "\u09AA\u09DC\u09C7 \u09B6\u09C1\u09A8\u09C1\u09A8",
      btnStopAudio: "\u09A5\u09BE\u09AE\u09BE\u09A8",
      btnDone: "\u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8",
      sensitiveFieldWarning: "\u09B8\u0982\u09AC\u09C7\u09A6\u09A8\u09B6\u09C0\u09B2 \u09A4\u09A5\u09CD\u09AF: \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u098F\u099F\u09BF \u09A8\u09BF\u099C\u09C7 \u099F\u09BE\u0987\u09AA \u0995\u09B0\u09C1\u09A8\u0964",
      reviewAndSubmitMessage: "\u09AA\u09C3\u09B7\u09CD\u09A0\u09BE\u09B0 \u09B8\u09AC\u0995\u09BF\u099B\u09C1 \u09AA\u09B0\u09CD\u09AF\u09BE\u09B2\u09CB\u099A\u09A8\u09BE \u0995\u09B0\u09C1\u09A8, \u09A4\u09BE\u09B0\u09AA\u09B0 \u0993\u09AF\u09BC\u09C7\u09AC\u09B8\u09BE\u0987\u099F\u09C7 \u09A8\u09BF\u099C\u09C7 \u099C\u09AE\u09BE \u09A6\u09BF\u09A8\u0964",
      noAutoSubmitNotice: "\u099F\u09C7\u0995\u09AB\u09B0\u09CD\u09AE \u09AC\u09BE\u09A1\u09BF \u0995\u0996\u09A8\u0987 \u09B8\u09CD\u09AC\u09AF\u09BC\u0982\u0995\u09CD\u09B0\u09BF\u09AF\u09BC\u09AD\u09BE\u09AC\u09C7 \u09AB\u09B0\u09CD\u09AE \u099C\u09AE\u09BE \u09A6\u09C7\u09AF\u09BC \u09A8\u09BE\u0964",
      manualActionRequired: "\u09AE\u09CD\u09AF\u09BE\u09A8\u09C1\u09AF\u09BC\u09BE\u09B2 \u09AA\u09A6\u0995\u09CD\u09B7\u09C7\u09AA \u09AA\u09CD\u09B0\u09AF\u09BC\u09CB\u099C\u09A8\u0964",
      completedTitle: "\u09AA\u09B0\u09CD\u09AF\u09BE\u09B2\u09CB\u099A\u09A8\u09BE \u09AA\u09CD\u09B0\u09B8\u09CD\u09A4\u09C1\u09A4!"
    },
    ta: {
      title: "\u0B9F\u0BC6\u0B95\u0BCD\u0B83\u0BAA\u0BBE\u0BB0\u0BCD\u0BAE\u0BCD \u0BAA\u0B9F\u0BBF \u0BB5\u0BB4\u0BBF\u0B95\u0BBE\u0B9F\u0BCD\u0B9F\u0BBF",
      loginOtpNotice: "\u0B89\u0BB3\u0BCD\u0BA8\u0BC1\u0BB4\u0BC8\u0BB5\u0BC1, OTP \u0BAE\u0BB1\u0BCD\u0BB1\u0BC1\u0BAE\u0BCD \u0B95\u0BC7\u0BAA\u0BCD\u0B9F\u0BCD\u0B9A\u0BBE \u0BA8\u0BC0\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BA4\u0BBE\u0BA9\u0BCD \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD.",
      fieldProgress: (c, t) => `\u0BAA\u0BC1\u0BB2\u0BAE\u0BCD ${c} / ${t}`,
      btnFillThis: "\u0B87\u0BA4\u0BC8 \u0BA8\u0BBF\u0BB0\u0BAA\u0BCD\u0BAA\u0BB5\u0BC1\u0BAE\u0BCD",
      btnFillAll: "\u0B85\u0BA9\u0BC8\u0BA4\u0BCD\u0BA4\u0BC8\u0BAF\u0BC1\u0BAE\u0BCD \u0BA8\u0BBF\u0BB0\u0BAA\u0BCD\u0BAA\u0BB5\u0BC1\u0BAE\u0BCD",
      btnNext: "\u0B85\u0B9F\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1",
      btnPrev: "\u0BAE\u0BC1\u0BA8\u0BCD\u0BA4\u0BC8\u0BAF\u0BA4\u0BC1",
      btnReadAloud: "\u0BB5\u0BBE\u0B9A\u0BBF\u0BA4\u0BCD\u0BA4\u0BC1 \u0B95\u0BBE\u0B9F\u0BCD\u0B9F\u0BC1",
      btnStopAudio: "\u0BA8\u0BBF\u0BB1\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1",
      btnDone: "\u0BAE\u0BC1\u0B9F\u0BBF\u0BA8\u0BCD\u0BA4\u0BA4\u0BC1",
      sensitiveFieldWarning: "\u0BAE\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BAF \u0B86\u0BB5\u0BA3\u0BAE\u0BCD: \u0BA4\u0BAF\u0BB5\u0BC1\u0B9A\u0BC6\u0BAF\u0BCD\u0BA4\u0BC1 \u0B87\u0BA4\u0BC8 \u0BA8\u0BC0\u0B99\u0BCD\u0B95\u0BB3\u0BC7 \u0BA4\u0B9F\u0BCD\u0B9F\u0B9A\u0BCD\u0B9A\u0BC1 \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF\u0BB5\u0BC1\u0BAE\u0BCD.",
      reviewAndSubmitMessage: "\u0BAA\u0B95\u0BCD\u0B95\u0BA4\u0BCD\u0BA4\u0BBF\u0BB2\u0BCD \u0B89\u0BB3\u0BCD\u0BB3 \u0B85\u0BA9\u0BC8\u0BA4\u0BCD\u0BA4\u0BC8\u0BAF\u0BC1\u0BAE\u0BCD \u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BBE\u0BAF\u0BCD\u0BB5\u0BC1 \u0B9A\u0BC6\u0BAF\u0BCD\u0BA4\u0BC1, \u0BA8\u0BC0\u0B99\u0BCD\u0B95\u0BB3\u0BC7 \u0B9A\u0BAE\u0BB0\u0BCD\u0BAA\u0BCD\u0BAA\u0BBF\u0B95\u0BCD\u0B95\u0BB5\u0BC1\u0BAE\u0BCD.",
      noAutoSubmitNotice: "\u0B9F\u0BC6\u0B95\u0BCD\u0B83\u0BAA\u0BBE\u0BB0\u0BCD\u0BAE\u0BCD \u0BAA\u0B9F\u0BBF \u0BA4\u0BBE\u0BA9\u0BBE\u0B95 \u0BAA\u0B9F\u0BBF\u0BB5\u0BA4\u0BCD\u0BA4\u0BC8 \u0B9A\u0BAE\u0BB0\u0BCD\u0BAA\u0BCD\u0BAA\u0BBF\u0B95\u0BCD\u0B95\u0BBE\u0BA4\u0BC1.",
      manualActionRequired: "\u0B95\u0BC8\u0BAE\u0BC1\u0BB1\u0BC8\u0BAF\u0BBE\u0B95 \u0B89\u0BB3\u0BCD\u0BB3\u0BBF\u0B9F \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD.",
      completedTitle: "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BBE\u0BAF\u0BCD\u0BB5\u0BC1 \u0BA4\u0BAF\u0BBE\u0BB0\u0BCD!"
    },
    te: {
      title: "\u0C1F\u0C46\u0C15\u0C4D\u0C2B\u0C3E\u0C2E\u0C4D \u0C2C\u0C21\u0C4D\u0C21\u0C40 \u0C17\u0C48\u0C21\u0C4D",
      loginOtpNotice: "\u0C32\u0C3E\u0C17\u0C3F\u0C28\u0C4D, OTP \u0C2E\u0C30\u0C3F\u0C2F\u0C41 \u0C15\u0C4D\u0C2F\u0C3E\u0C2A\u0C4D\u0C1A\u0C3E \u0C2E\u0C40\u0C30\u0C47 \u0C1A\u0C47\u0C2F\u0C3E\u0C32\u0C3F.",
      fieldProgress: (c, t) => `\u0C2B\u0C40\u0C32\u0C4D\u0C21\u0C4D ${c} / ${t}`,
      btnFillThis: "\u0C07\u0C26\u0C3F \u0C28\u0C3F\u0C02\u0C2A\u0C02\u0C21\u0C3F",
      btnFillAll: "\u0C05\u0C28\u0C4D\u0C28\u0C40 \u0C28\u0C3F\u0C02\u0C2A\u0C02\u0C21\u0C3F",
      btnNext: "\u0C24\u0C30\u0C41\u0C35\u0C3E\u0C24",
      btnPrev: "\u0C2E\u0C41\u0C28\u0C41\u0C2A\u0C1F\u0C3F",
      btnReadAloud: "\u0C35\u0C3F\u0C28\u0C02\u0C21\u0C3F",
      btnStopAudio: "\u0C06\u0C2A\u0C02\u0C21\u0C3F",
      btnDone: "\u0C2A\u0C42\u0C30\u0C4D\u0C24\u0C2F\u0C3F\u0C02\u0C26\u0C3F",
      sensitiveFieldWarning: "\u0C38\u0C41\u0C28\u0C4D\u0C28\u0C3F\u0C24\u0C2E\u0C48\u0C28 \u0C35\u0C3F\u0C35\u0C30\u0C3E\u0C32\u0C41: \u0C26\u0C2F\u0C1A\u0C47\u0C38\u0C3F \u0C26\u0C40\u0C28\u0C4D\u0C28\u0C3F \u0C2E\u0C40\u0C30\u0C47 \u0C1F\u0C48\u0C2A\u0C4D \u0C1A\u0C47\u0C2F\u0C02\u0C21\u0C3F.",
      reviewAndSubmitMessage: "\u0C05\u0C28\u0C4D\u0C28\u0C40 \u0C38\u0C2E\u0C40\u0C15\u0C4D\u0C37\u0C3F\u0C02\u0C1A\u0C02\u0C21\u0C3F, \u0C24\u0C30\u0C4D\u0C35\u0C3E\u0C24 \u0C35\u0C46\u0C2C\u0C4D\u200C\u0C38\u0C48\u0C1F\u0C4D\u200C\u0C32\u0C4B \u0C2E\u0C40\u0C30\u0C47 \u0C38\u0C2C\u0C4D\u0C2E\u0C3F\u0C1F\u0C4D \u0C28\u0C4A\u0C15\u0C4D\u0C15\u0C02\u0C21\u0C3F.",
      noAutoSubmitNotice: "\u0C1F\u0C46\u0C15\u0C4D\u0C2B\u0C3E\u0C2E\u0C4D \u0C2C\u0C21\u0C4D\u0C21\u0C40 \u0C0E\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C42 \u0C06\u0C1F\u0C4B-\u0C38\u0C2C\u0C4D\u0C2E\u0C3F\u0C1F\u0C4D \u0C1A\u0C47\u0C2F\u0C26\u0C41.",
      manualActionRequired: "\u0C2E\u0C3E\u0C28\u0C4D\u0C2F\u0C41\u0C35\u0C32\u0C4D \u0C1A\u0C30\u0C4D\u0C2F \u0C05\u0C35\u0C38\u0C30\u0C02.",
      completedTitle: "\u0C38\u0C2E\u0C40\u0C15\u0C4D\u0C37 \u0C38\u0C3F\u0C26\u0C4D\u0C27\u0C02\u0C17\u0C3E \u0C09\u0C02\u0C26\u0C3F!"
    },
    mr: {
      title: "\u091F\u0947\u0915\u092B\u0949\u0930\u094D\u092E \u092C\u0921\u0940 \u092E\u093E\u0930\u094D\u0917\u0926\u0930\u094D\u0936\u0915",
      loginOtpNotice: "\u0932\u0949\u0917\u093F\u0928, \u0913\u091F\u0940\u092A\u0940 \u0906\u0923\u093F \u0915\u0945\u092A\u094D\u091A\u093E \u0924\u0941\u092E\u094D\u0939\u093E\u0932\u093E \u0938\u094D\u0935\u0924\u0903 \u092D\u0930\u093E\u092F\u091A\u0947 \u0906\u0939\u0947\u0924.",
      fieldProgress: (c, t) => `\u092B\u0940\u0932\u094D\u0921 ${c} / ${t}`,
      btnFillThis: "\u0939\u0947 \u092D\u0930\u093E",
      btnFillAll: "\u0938\u0930\u094D\u0935 \u092D\u0930\u093E",
      btnNext: "\u092A\u0941\u0922\u0947",
      btnPrev: "\u092E\u093E\u0917\u0947",
      btnReadAloud: "\u0935\u093E\u091A\u0942\u0928 \u0926\u093E\u0916\u0935\u093E",
      btnStopAudio: "\u0925\u093E\u0902\u092C\u0935\u093E",
      btnDone: "\u092A\u0942\u0930\u094D\u0923",
      sensitiveFieldWarning: "\u0938\u0902\u0935\u0947\u0926\u0928\u0936\u0940\u0932 \u0913\u0933\u0916/\u0906\u0930\u094D\u0925\u093F\u0915 \u092E\u093E\u0939\u093F\u0924\u0940: \u0915\u0943\u092A\u092F\u093E \u0939\u0947 \u0938\u094D\u0935\u0924\u0903 \u091F\u093E\u0907\u092A \u0915\u0930\u093E.",
      reviewAndSubmitMessage: "\u092A\u0943\u0937\u094D\u0920\u093E\u0935\u0930\u0940\u0932 \u0938\u0930\u094D\u0935 \u092E\u093E\u0939\u093F\u0924\u0940 \u0924\u092A\u093E\u0938\u093E, \u0928\u0902\u0924\u0930 \u0935\u0947\u092C\u0938\u093E\u0907\u091F\u0935\u0930 \u0938\u094D\u0935\u0924\u0903 \u0938\u092C\u092E\u093F\u091F \u0926\u093E\u092C\u093E.",
      noAutoSubmitNotice: "\u091F\u0947\u0915\u092B\u0949\u0930\u094D\u092E \u092C\u0921\u0940 \u0915\u0927\u0940\u0939\u0940 \u0906\u092A\u094B\u0906\u092A \u0938\u092C\u092E\u093F\u091F \u0915\u093F\u0902\u0935\u093E \u092A\u0947\u092E\u0947\u0902\u091F \u092C\u091F\u0923\u0947 \u0926\u093E\u092C\u0924 \u0928\u093E\u0939\u0940.",
      manualActionRequired: "\u092E\u0945\u0928\u094D\u092F\u0941\u0905\u0932 \u0915\u0943\u0924\u0940 \u0906\u0935\u0936\u094D\u092F\u0915 (\u0926\u0938\u094D\u0924\u0910\u0935\u091C/\u092B\u093E\u0907\u0932 \u0905\u092A\u0932\u094B\u0921).",
      completedTitle: "\u092A\u0941\u0928\u0930\u093E\u0935\u0932\u094B\u0915\u0928 \u0924\u092F\u093E\u0930 \u0906\u0939\u0947!"
    },
    gu: {
      title: "\u0A9F\u0AC7\u0A95\u0AAB\u0ACB\u0AB0\u0ACD\u0AAE \u0AAC\u0AA1\u0AC0 \u0AAE\u0ABE\u0AB0\u0ACD\u0A97\u0AA6\u0AB0\u0ACD\u0AB6\u0ABF\u0A95\u0ABE",
      loginOtpNotice: "\u0AB2\u0AC9\u0A97\u0ABF\u0AA8, OTP \u0A85\u0AA8\u0AC7 \u0A95\u0AC5\u0AAA\u0ACD\u0A9A\u0ABE \u0AA4\u0AAE\u0ABE\u0AB0\u0AC7 \u0A9C\u0ABE\u0AA4\u0AC7 \u0A9C \u0AAD\u0AB0\u0AB5\u0ABE\u0AA8\u0ABE \u0AB0\u0AB9\u0AC7\u0AB6\u0AC7.",
      fieldProgress: (c, t) => `\u0A95\u0ACD\u0AB7\u0AC7\u0AA4\u0ACD\u0AB0 ${c} / ${t}`,
      btnFillThis: "\u0A86 \u0AAD\u0AB0\u0ACB",
      btnFillAll: "\u0AAC\u0AA7\u0AC1\u0A82 \u0AAD\u0AB0\u0ACB",
      btnNext: "\u0A86\u0A97\u0AB3",
      btnPrev: "\u0AAA\u0ABE\u0A9B\u0AB3",
      btnReadAloud: "\u0AB5\u0ABE\u0A82\u0A9A\u0AC0 \u0AB8\u0A82\u0AAD\u0AB3\u0ABE\u0AB5\u0ACB",
      btnStopAudio: "\u0AAC\u0A82\u0AA7 \u0A95\u0AB0\u0ACB",
      btnDone: "\u0AB8\u0A82\u0AAA\u0AA8\u0ACD\u0AA8",
      sensitiveFieldWarning: "\u0AB8\u0A82\u0AB5\u0AC7\u0AA6\u0AA8\u0AB6\u0AC0\u0AB2 \u0A93\u0AB3\u0A96/\u0AA8\u0ABE\u0AA3\u0ABE\u0A95\u0AC0\u0AAF \u0A95\u0ACD\u0AB7\u0AC7\u0AA4\u0ACD\u0AB0: \u0A95\u0AC3\u0AAA\u0ABE \u0A95\u0AB0\u0AC0\u0AA8\u0AC7 \u0A86 \u0A9C\u0ABE\u0AA4\u0AC7 \u0A9F\u0ABE\u0A87\u0AAA \u0A95\u0AB0\u0ACB.",
      reviewAndSubmitMessage: "\u0AAA\u0AC3\u0AB7\u0ACD\u0AA0 \u0AAA\u0AB0 \u0AAC\u0AA7\u0AC1\u0A82 \u0A9A\u0A95\u0ABE\u0AB8\u0ACB, \u0AAA\u0A9B\u0AC0 \u0AB5\u0AC7\u0AAC\u0AB8\u0ABE\u0A87\u0A9F \u0AAA\u0AB0 \u0A9C\u0ABE\u0AA4\u0AC7 \u0AB8\u0AAC\u0AAE\u0ABF\u0A9F \u0AA6\u0AAC\u0ABE\u0AB5\u0ACB.",
      noAutoSubmitNotice: "\u0A9F\u0AC7\u0A95\u0AAB\u0ACB\u0AB0\u0ACD\u0AAE \u0AAC\u0AA1\u0AC0 \u0A95\u0ACD\u0AAF\u0ABE\u0AB0\u0AC7\u0AAF \u0A86\u0AAA\u0AAE\u0AC7\u0AB3\u0AC7 \u0AB8\u0AAC\u0AAE\u0ABF\u0A9F \u0A95\u0AB0\u0AA4\u0AC1\u0A82 \u0AA8\u0AA5\u0AC0.",
      manualActionRequired: "\u0AAE\u0AC7\u0AA8\u0ACD\u0AAF\u0AC1\u0A85\u0AB2 \u0A95\u0ACD\u0AB0\u0ABF\u0AAF\u0ABE \u0A9C\u0AB0\u0AC2\u0AB0\u0AC0.",
      completedTitle: "\u0AB8\u0AAE\u0AC0\u0A95\u0ACD\u0AB7\u0ABE \u0AA4\u0AC8\u0AAF\u0ABE\u0AB0 \u0A9B\u0AC7!"
    },
    as: {
      title: "\u099F\u09C7\u0995\u09AB\u09F0\u09CD\u09AE \u09AC\u09BE\u09A1\u09C0 \u09B8\u09B9\u09BE\u09DF\u09BF\u0995\u09BE",
      loginOtpNotice: "\u09B2\u0997\u0987\u09A8, \u0985\u2019\u099F\u09BF\u09AA\u09BF \u0986\u09F0\u09C1 \u0995\u09C7\u09AA\u099A\u09BE \u0986\u09AA\u09C1\u09A8\u09BF \u09A8\u09BF\u099C\u09C7\u0987 \u0995\u09F0\u09BF\u09AC \u09B2\u09BE\u0997\u09BF\u09AC\u0964",
      fieldProgress: (c, t) => `\u0995\u09CD\u09B7\u09C7\u09A4\u09CD\u09F0 ${c} / ${t}`,
      btnFillThis: "\u098F\u0987\u099F\u09CB \u09AA\u09C2\u09F0\u09A3 \u0995\u09F0\u0995",
      btnFillAll: "\u09B8\u0995\u09B2\u09CB \u09AA\u09C2\u09F0\u09A3 \u0995\u09F0\u0995",
      btnNext: "\u09AA\u09BF\u099B\u09F0",
      btnPrev: "\u0986\u0997\u09B2\u09C8",
      btnReadAloud: "\u09AA\u09DD\u09BF \u09B6\u09C1\u09A8\u0995",
      btnStopAudio: "\u09AC\u09A8\u09CD\u09A7 \u0995\u09F0\u0995",
      btnDone: "\u09B8\u09AE\u09CD\u09AA\u09C2\u09F0\u09CD\u09A3",
      sensitiveFieldWarning: "\u09B8\u0982\u09AC\u09C7\u09A6\u09A8\u09B6\u09C0\u09B2 \u09A4\u09A5\u09CD\u09AF: \u0985\u09A8\u09C1\u0997\u09CD\u09F0\u09B9 \u0995\u09F0\u09BF \u09A8\u09BF\u099C\u09C7\u0987 \u099F\u09BE\u0987\u09AA \u0995\u09F0\u0995\u0964",
      reviewAndSubmitMessage: "\u09AA\u09C3\u09B7\u09CD\u09A0\u09BE\u099F\u09CB \u09AD\u09BE\u09B2\u09A6\u09F0\u09C7 \u09AA\u09F0\u09C0\u0A95\u0ACD\u0AB7\u0ABE \u0995\u09F0\u0995, \u09A4\u09BE\u09F0 \u09AA\u09BF\u099B\u09A4 \u09F1\u09C7\u09AC\u099B\u09BE\u0987\u099F\u09A4 \u09A8\u09BF\u099C\u09C7\u0987 \u099A\u09BE\u09AC\u09AE\u09BF\u099F \u0995\u09F0\u0995\u0964",
      noAutoSubmitNotice: "\u099F\u09C7\u0995\u09AB\u09F0\u09CD\u09AE \u09AC\u09BE\u09A1\u09C0\u09DF\u09C7 \u0995\u09C7\u09A4\u09BF\u09DF\u09BE\u0993 \u09B8\u09CD\u09AC\u09DF\u0982\u0995\u09CD\u09F0\u09BF\u09DF\u09AD\u09BE\u09F1\u09C7 \u099A\u09BE\u09AC\u09AE\u09BF\u099F \u09A8\u0995\u09F0\u09C7\u0964",
      manualActionRequired: "\u09AE\u09C7\u09A8\u09C1\u09F1\u09C7\u09B2 \u09AC\u09CD\u09AF\u09F1\u09B8\u09CD\u09A5\u09BE \u09AA\u09CD\u09F0\u09DF\u09CB\u099C\u09A8\u0964",
      completedTitle: "\u09AA\u09F0\u09CD\u09AF\u09BE\u09B2\u09CB\u099A\u09A8\u09BE \u09B8\u09BE\u099C\u09C1!"
    },
    kn: {
      title: "\u0C9F\u0CC6\u0C95\u0CCD\u200C\u0CAB\u0CBE\u0CB0\u0CCD\u0CAE\u0CCD \u0CAC\u0CA1\u0CCD\u0CA1\u0CBF \u0CAE\u0CBE\u0CB0\u0CCD\u0C97\u0CA6\u0CB0\u0CCD\u0CB6\u0CBF",
      loginOtpNotice: "\u0CB2\u0CBE\u0C97\u0CBF\u0CA8\u0CCD, OTP \u0CAE\u0CA4\u0CCD\u0CA4\u0CC1 \u0C95\u0CCD\u0CAF\u0CBE\u0CAA\u0CCD\u0C9A\u0CBE \u0CA8\u0CC0\u0CB5\u0CC7 \u0CB8\u0CCD\u0CB5\u0CA4\u0C83 \u0CAD\u0CB0\u0CCD\u0CA4\u0CBF \u0CAE\u0CBE\u0CA1\u0CAC\u0CC7\u0C95\u0CC1.",
      fieldProgress: (c, t) => `\u0C95\u0CCD\u0CB7\u0CC7\u0CA4\u0CCD\u0CB0 ${c} / ${t}`,
      btnFillThis: "\u0C87\u0CA6\u0CA8\u0CCD\u0CA8\u0CC1 \u0CAD\u0CB0\u0CCD\u0CA4\u0CBF \u0CAE\u0CBE\u0CA1\u0CBF",
      btnFillAll: "\u0C8E\u0CB2\u0CCD\u0CB2\u0CB5\u0CA8\u0CCD\u0CA8\u0CC2 \u0CAD\u0CB0\u0CCD\u0CA4\u0CBF \u0CAE\u0CBE\u0CA1\u0CBF",
      btnNext: "\u0CAE\u0CC1\u0C82\u0CA6\u0CC6",
      btnPrev: "\u0CB9\u0CBF\u0C82\u0CA6\u0CC6",
      btnReadAloud: "\u0C93\u0CA6\u0CBF \u0C95\u0CC7\u0CB3\u0CBF",
      btnStopAudio: "\u0CA8\u0CBF\u0CB2\u0CCD\u0CB2\u0CBF\u0CB8\u0CBF",
      btnDone: "\u0CAA\u0CC2\u0CB0\u0CCD\u0CA3\u0C97\u0CCA\u0C82\u0CA1\u0CBF\u0CA6\u0CC6",
      sensitiveFieldWarning: "\u0CB8\u0CC2\u0C95\u0CCD\u0CB7\u0CCD\u0CAE \u0CB5\u0CBF\u0CB5\u0CB0\u0C97\u0CB3\u0CC1: \u0CA6\u0CAF\u0CB5\u0CBF\u0C9F\u0CCD\u0C9F\u0CC1 \u0CA8\u0CC0\u0CB5\u0CC7 \u0CB8\u0CCD\u0CB5\u0CA4\u0C83 \u0C9F\u0CC8\u0CAA\u0CCD \u0CAE\u0CBE\u0CA1\u0CBF.",
      reviewAndSubmitMessage: "\u0CAA\u0CC1\u0C9F\u0CA6\u0CB2\u0CCD\u0CB2\u0CBF \u0C8E\u0CB2\u0CCD\u0CB2\u0CB5\u0CA8\u0CCD\u0CA8\u0CC2 \u0CAA\u0CB0\u0CBF\u0CB6\u0CC0\u0CB2\u0CBF\u0CB8\u0CBF, \u0CA8\u0C82\u0CA4\u0CB0 \u0CB5\u0CC6\u0CAC\u0CCD\u200C\u0CB8\u0CC8\u0C9F\u0CCD\u200C\u0CA8\u0CB2\u0CCD\u0CB2\u0CBF \u0CA8\u0CC0\u0CB5\u0CC7 \u0CB8\u0CAC\u0CCD\u0CAE\u0CBF\u0C9F\u0CCD \u0C92\u0CA4\u0CCD\u0CA4\u0CBF.",
      noAutoSubmitNotice: "\u0C9F\u0CC6\u0C95\u0CCD\u200C\u0CAB\u0CBE\u0CB0\u0CCD\u0CAE\u0CCD \u0CAC\u0CA1\u0CCD\u0CA1\u0CBF \u0C8E\u0C82\u0CA6\u0CBF\u0C97\u0CC2 \u0CB8\u0CCD\u0CB5\u0CAF\u0C82\u0C9A\u0CBE\u0CB2\u0CBF\u0CA4\u0CB5\u0CBE\u0C97\u0CBF \u0CB8\u0CAC\u0CCD\u0CAE\u0CBF\u0C9F\u0CCD \u0CAE\u0CBE\u0CA1\u0CC1\u0CB5\u0CC1\u0CA6\u0CBF\u0CB2\u0CCD\u0CB2.",
      manualActionRequired: "\u0CB9\u0CB8\u0CCD\u0CA4\u0C9A\u0CBE\u0CB2\u0CBF\u0CA4 \u0C95\u0CCD\u0CB0\u0CBF\u0CAF\u0CC6 \u0C85\u0C97\u0CA4\u0CCD\u0CAF\u0CB5\u0CBF\u0CA6\u0CC6.",
      completedTitle: "\u0CAA\u0CB0\u0CBF\u0CB6\u0CC0\u0CB2\u0CA8\u0CC6 \u0CB8\u0CBF\u0CA6\u0CCD\u0CA7\u0CB5\u0CBE\u0C97\u0CBF\u0CA6\u0CC6!"
    },
    ml: {
      title: "\u0D1F\u0D46\u0D15\u0D4D\u0D2B\u0D4B\u0D02 \u0D2C\u0D21\u0D4D\u0D21\u0D3F \u0D17\u0D48\u0D21\u0D4D",
      loginOtpNotice: "\u0D32\u0D4B\u0D17\u0D3F\u0D7B, OTP, \u0D15\u0D4D\u0D2F\u0D3E\u0D2A\u0D4D\u200C\u0D1A \u0D0E\u0D28\u0D4D\u0D28\u0D3F\u0D35 \u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D7E \u0D38\u0D4D\u0D35\u0D2F\u0D02 \u0D1A\u0D46\u0D2F\u0D4D\u0D2F\u0D47\u0D23\u0D4D\u0D1F\u0D24\u0D3E\u0D23\u0D4D.",
      fieldProgress: (c, t) => `\u0D2B\u0D40\u0D7D\u0D21\u0D4D ${c} / ${t}`,
      btnFillThis: "\u0D07\u0D24\u0D4D \u0D2A\u0D42\u0D30\u0D3F\u0D2A\u0D4D\u0D2A\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15",
      btnFillAll: "\u0D0E\u0D32\u0D4D\u0D32\u0D3E\u0D02 \u0D2A\u0D42\u0D30\u0D3F\u0D2A\u0D4D\u0D2A\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15",
      btnNext: "\u0D05\u0D1F\u0D41\u0D24\u0D4D\u0D24\u0D24\u0D4D",
      btnPrev: "\u0D2E\u0D41\u0D2E\u0D4D\u0D2A\u0D24\u0D4D\u0D24\u0D47\u0D24\u0D4D",
      btnReadAloud: "\u0D35\u0D3E\u0D2F\u0D3F\u0D1A\u0D4D\u0D1A\u0D41 \u0D15\u0D47\u0D7E\u0D15\u0D4D\u0D15\u0D41\u0D15",
      btnStopAudio: "\u0D28\u0D3F\u0D7C\u0D24\u0D4D\u0D24\u0D41\u0D15",
      btnDone: "\u0D2A\u0D42\u0D7C\u0D24\u0D4D\u0D24\u0D3F\u0D2F\u0D3E\u0D2F\u0D3F",
      sensitiveFieldWarning: "\u0D2A\u0D4D\u0D30\u0D27\u0D3E\u0D28 \u0D35\u0D3F\u0D35\u0D30\u0D19\u0D4D\u0D19\u0D7E: \u0D26\u0D2F\u0D35\u0D3E\u0D2F\u0D3F \u0D07\u0D24\u0D4D \u0D38\u0D4D\u0D35\u0D2F\u0D02 \u0D1F\u0D48\u0D2A\u0D4D\u0D2A\u0D4D \u0D1A\u0D46\u0D2F\u0D4D\u0D2F\u0D41\u0D15.",
      reviewAndSubmitMessage: "\u0D2A\u0D47\u0D1C\u0D3F\u0D32\u0D46 \u0D35\u0D3F\u0D35\u0D30\u0D19\u0D4D\u0D19\u0D7E \u0D2A\u0D30\u0D3F\u0D36\u0D4B\u0D27\u0D3F\u0D1A\u0D4D\u0D1A\u0D4D \u0D35\u0D46\u0D2C\u0D4D\u0D38\u0D48\u0D31\u0D4D\u0D31\u0D3F\u0D7D \u0D38\u0D4D\u0D35\u0D2F\u0D02 \u0D38\u0D2E\u0D7C\u0D2A\u0D4D\u0D2A\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15.",
      noAutoSubmitNotice: "\u0D1F\u0D46\u0D15\u0D4D\u0D2B\u0D4B\u0D02 \u0D2C\u0D21\u0D4D\u0D21\u0D3F \u0D38\u0D4D\u0D35\u0D2F\u0D02 \u0D2B\u0D4B\u0D02 \u0D38\u0D2E\u0D7C\u0D2A\u0D4D\u0D2A\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15\u0D2F\u0D3F\u0D32\u0D4D\u0D32.",
      manualActionRequired: "\u0D2E\u0D3E\u0D28\u0D41\u0D35\u0D7D \u0D28\u0D1F\u0D2A\u0D1F\u0D3F \u0D06\u0D35\u0D36\u0D4D\u0D2F\u0D2E\u0D3E\u0D23\u0D4D.",
      completedTitle: "\u0D2A\u0D30\u0D3F\u0D36\u0D4B\u0D27\u0D28 \u0D24\u0D2F\u0D4D\u0D2F\u0D3E\u0D31\u0D3E\u0D23\u0D4D!"
    },
    pa: {
      title: "\u0A1F\u0A48\u0A71\u0A15\u0A2B\u0A3E\u0A30\u0A2E \u0A2C\u0A71\u0A21\u0A40 \u0A17\u0A3E\u0A08\u0A21",
      loginOtpNotice: "\u0A32\u0A3E\u0A17\u0A07\u0A28, OTP \u0A05\u0A24\u0A47 \u0A15\u0A48\u0A2A\u0A1A\u0A3E \u0A24\u0A41\u0A39\u0A3E\u0A28\u0A42\u0A70 \u0A16\u0A41\u0A26 \u0A2D\u0A30\u0A28\u0A3E \u0A2A\u0A35\u0A47\u0A17\u0A3E\u0964",
      fieldProgress: (c, t) => `\u0A16\u0A47\u0A24\u0A30 ${c} / ${t}`,
      btnFillThis: "\u0A07\u0A39 \u0A2D\u0A30\u0A4B",
      btnFillAll: "\u0A38\u0A3E\u0A30\u0A47 \u0A2D\u0A30\u0A4B",
      btnNext: "\u0A05\u0A17\u0A32\u0A3E",
      btnPrev: "\u0A2A\u0A3F\u0A1B\u0A32\u0A3E",
      btnReadAloud: "\u0A2C\u0A4B\u0A32 \u0A15\u0A47 \u0A38\u0A41\u0A23\u0A3E\u0A13",
      btnStopAudio: "\u0A30\u0A4B\u0A15\u0A4B",
      btnDone: "\u0A2E\u0A41\u0A15\u0A70\u0A2E\u0A32",
      sensitiveFieldWarning: "\u0A38\u0A70\u0A35\u0A47\u0A26\u0A28\u0A38\u0A3C\u0A40\u0A32 \u0A2A\u0A1B\u0A3E\u0A23/\u0A35\u0A3F\u0A71\u0A24\u0A40 \u0A16\u0A47\u0A24\u0A30: \u0A15\u0A3F\u0A30\u0A2A\u0A3E \u0A15\u0A30\u0A15\u0A47 \u0A07\u0A38\u0A28\u0A42\u0A70 \u0A16\u0A41\u0A26 \u0A1F\u0A3E\u0A08\u0A2A \u0A15\u0A30\u0A4B\u0964",
      reviewAndSubmitMessage: "\u0A2A\u0A70\u0A28\u0A47 \u0A26\u0A40 \u0A1A\u0A70\u0A17\u0A40 \u0A24\u0A30\u0A4D\u0A39\u0A3E\u0A02 \u0A1C\u0A3E\u0A02\u0A1A \u0A15\u0A30\u0A4B, \u0A2B\u0A3F\u0A30 \u0A35\u0A48\u0A71\u0A2C\u0A38\u0A3E\u0A08\u0A1F \u0A24\u0A47 \u0A16\u0A41\u0A26 \u0A38\u0A2C\u0A2E\u0A3F\u0A1F \u0A26\u0A2C\u0A3E\u0A13\u0964",
      noAutoSubmitNotice: "\u0A1F\u0A48\u0A71\u0A15\u0A2B\u0A3E\u0A30\u0A2E \u0A2C\u0A71\u0A21\u0A40 \u0A15\u0A26\u0A47 \u0A35\u0A40 \u0A06\u0A1F\u0A4B-\u0A38\u0A2C\u0A2E\u0A3F\u0A1F \u0A28\u0A39\u0A40\u0A02 \u0A15\u0A30\u0A26\u0A3E\u0964",
      manualActionRequired: "\u0A2E\u0A48\u0A28\u0A42\u0A05\u0A32 \u0A15\u0A3E\u0A30\u0A35\u0A3E\u0A08 \u0A26\u0A40 \u0A32\u0A4B\u0A5C \u0A39\u0A48\u0964",
      completedTitle: "\u0A38\u0A2E\u0A40\u0A16\u0A3F\u0A06 \u0A24\u0A3F\u0A06\u0A30 \u0A39\u0A48!"
    }
  };
  function registerTranslations(langCode, strings) {
    OVERLAY_TRANSLATIONS[langCode] = strings;
  }
  var OVERLAY_CSS = `
:host {
  all: initial;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color-scheme: dark;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.tfb-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  z-index: 2147483646;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.tfb-backdrop.visible {
  opacity: 1;
  pointer-events: auto;
}

/* Mobile-First: Bottom Sheet */
.tfb-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 85vh;
  background: #0f172a;
  color: #f8fafc;
  border-radius: 20px 20px 0 0;
  border-top: 1px solid #334155;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.tfb-sheet.open {
  transform: translateY(0);
}

/* Wide screen: Right-side Drawer */
@media (min-width: 768px) {
  .tfb-sheet {
    left: auto;
    right: 0;
    top: 0;
    bottom: 0;
    width: 420px;
    max-height: 100vh;
    border-radius: 16px 0 0 16px;
    border-top: none;
    border-left: 1px solid #334155;
    box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
    transform: translateX(100%);
  }
  .tfb-sheet.open {
    transform: translateX(0);
  }
}

/* Drag pill for mobile sheet */
.tfb-handle-bar {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}
.tfb-handle-pill {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #475569;
}
@media (min-width: 768px) {
  .tfb-handle-bar { display: none; }
}

/* Header */
.tfb-header {
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #1e293b;
  background: #0b1120;
}

.tfb-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tfb-logo-badge {
  background: linear-gradient(135deg, #2563eb, #10b981);
  color: #fff;
  font-weight: 800;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.tfb-header-title {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
}

.tfb-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tfb-lang-select {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}
.tfb-lang-select:focus {
  border-color: #3b82f6;
}

.tfb-icon-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.tfb-icon-btn:hover {
  background: #1e293b;
  color: #f8fafc;
}

/* Hard Rule Notice Banner */
.tfb-notice-bar {
  background: #172554;
  border-bottom: 1px solid #1e3a8a;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #93c5fd;
  font-weight: 500;
}
.tfb-notice-icon {
  font-size: 14px;
}

/* Progress bar */
.tfb-progress-container {
  padding: 12px 18px 4px;
}
.tfb-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}
.tfb-progress-track {
  height: 6px;
  background: #1e293b;
  border-radius: 3px;
  overflow: hidden;
}
.tfb-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width 0.25s ease;
  border-radius: 3px;
}

/* Content Area */
.tfb-body {
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
}

.tfb-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tfb-field-badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tfb-section-tag {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.tfb-status-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
}
.tfb-status-pill.autofill {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.tfb-status-pill.sensitive {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.tfb-status-pill.manual {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.tfb-field-label {
  font-size: 17px;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.3;
}

.tfb-explanation-box {
  background: #0f172a;
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid #3b82f6;
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.5;
}

.tfb-instruction-box {
  font-size: 13px;
  color: #94a3b8;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.4;
}

.tfb-alert-box {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

/* Completion Card */
.tfb-completion-card {
  background: #064e3b;
  border: 1px solid #059669;
  color: #ecfdf5;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tfb-completion-title {
  font-size: 18px;
  font-weight: 800;
  color: #34d399;
}
.tfb-completion-text {
  font-size: 14px;
  line-height: 1.5;
  color: #a7f3d0;
}
.tfb-rule-reminder {
  font-size: 12px;
  color: #6ee7b7;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 4px;
}

/* Footer / Action Buttons */
.tfb-footer {
  padding: 14px 18px 20px;
  background: #0b1120;
  border-top: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tfb-btn-row-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tfb-btn-row-nav {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
}

/* Buttons */
.tfb-btn {
  height: 48px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  transition: transform 0.1s, opacity 0.15s, background 0.15s;
  user-select: none;
  padding: 0 16px;
}
.tfb-btn:active {
  transform: scale(0.98);
}
.tfb-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.tfb-btn-primary {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
.tfb-btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #34d399, #10b981);
}

.tfb-btn-secondary {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}
.tfb-btn-secondary:hover:not(:disabled) {
  background: #3b82f6;
}

.tfb-btn-outline {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
}
.tfb-btn-outline:hover:not(:disabled) {
  background: #334155;
  color: #f8fafc;
}

.tfb-btn-speak {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}
.tfb-btn-speak:hover:not(:disabled) {
  background: #6366f1;
}

.tfb-btn-speak.active {
  background: #dc2626;
}

/* Minimized Floating Pill */
.tfb-minimized-pill {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  color: #f8fafc;
  border: 1px solid #334155;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  border-radius: 9999px;
  padding: 8px 16px;
  display: none;
  align-items: center;
  gap: 10px;
  z-index: 2147483647;
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s, box-shadow 0.2s;
}
.tfb-minimized-pill.visible {
  display: flex;
}
.tfb-minimized-pill:hover {
  transform: translateY(-2px);
  border-color: #3b82f6;
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.3);
}
.tfb-pill-badge {
  background: linear-gradient(135deg, #2563eb, #10b981);
  color: #fff;
  font-weight: 800;
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 9999px;
}
.tfb-pill-info {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tfb-pill-action {
  font-size: 12px;
  color: #60a5fa;
  font-weight: 700;
}

/* Page Guide Mode CSS */
.tfb-task-banner {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.tfb-task-icon {
  font-size: 16px;
}
.tfb-task-label {
  color: #94a3b8;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.tfb-task-title {
  color: #38bdf8;
  font-weight: 700;
  font-size: 13px;
}
.tfb-step-active-card {
  border-left: 4px solid #3b82f6 !important;
}
.tfb-step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.tfb-step-pill {
  background: #2563eb;
  color: #ffffff;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 800;
}
.tfb-step-body {
  font-size: 14px;
  line-height: 1.5;
  color: #f8fafc;
  font-weight: 600;
}
.tfb-target-hint {
  margin-top: 10px;
  background: #1e1b4b;
  border: 1px solid #4338ca;
  color: #c7d2fe;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.tfb-voice-notice-box {
  margin-top: 10px;
  background: #451a03;
  border: 1px solid #b45309;
  color: #fde68a;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.tfb-options-row {
  display: flex;
  justify-content: flex-end;
  padding: 4px 6px 0;
}
.tfb-auto-read-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}
.tfb-auto-read-label input {
  cursor: pointer;
  accent-color: #3b82f6;
}
`;
  var GuideOverlay = class {
    host = null;
    shadow = null;
    fields = [];
    analysis = [];
    profileValues = {};
    currentIndex = 0;
    language = "en";
    bridge;
    isSpeaking = false;
    isOpen = false;
    isMinimized = false;
    isComplete = false;
    onClose;
    onComplete;
    // Page Guide Mode Extensions
    mode = "fill";
    taskName = "";
    guideData = null;
    guideStepIndex = 0;
    autoReadEnabled = false;
    voiceNotice = "";
    currentlyHighlightedElement = null;
    constructor(options = {}) {
      this.bridge = options.bridge;
      this.language = sanitizeLanguage(options.language || "en");
      this.taskName = options.taskName || "";
      this.mode = options.mode || "fill";
      if (options.guideData) {
        this.guideData = options.guideData;
        this.mode = "guide";
      }
      this.onClose = options.onClose;
      this.onComplete = options.onComplete;
    }
    setTaskName(task) {
      this.taskName = task;
      this.render();
    }
    getTaskName() {
      return this.taskName;
    }
    getMode() {
      return this.mode;
    }
    setMode(mode) {
      this.mode = mode;
      this.render();
    }
    setGuideData(data) {
      this.guideData = data;
      this.mode = "guide";
      this.guideStepIndex = 0;
      if (data.taskName) {
        this.taskName = data.taskName;
      }
      this.render();
      this.highlightCurrentGuideStep();
    }
    getGuideData() {
      return this.guideData;
    }
    setAutoRead(enabled) {
      this.autoReadEnabled = enabled;
      this.render();
    }
    nextGuideStep() {
      if (!this.guideData || !this.guideData.steps || this.guideData.steps.length === 0) return;
      if (this.guideStepIndex < this.guideData.steps.length - 1) {
        this.guideStepIndex++;
        this.render();
        this.highlightCurrentGuideStep();
        if (this.autoReadEnabled) {
          this.readAloud();
        }
      }
    }
    prevGuideStep() {
      if (this.guideStepIndex > 0) {
        this.guideStepIndex--;
        this.render();
        this.highlightCurrentGuideStep();
        if (this.autoReadEnabled) {
          this.readAloud();
        }
      }
    }
    highlightCurrentGuideStep() {
      this.clearGuideHighlight();
      if (!this.guideData || !this.guideData.steps || this.guideData.steps.length === 0) return;
      const currentStep = this.guideData.steps[this.guideStepIndex];
      if (!currentStep) return;
      let targetText = currentStep.targetText;
      if (!targetText) {
        const match = currentStep.text.match(/["']([^"']+)["']/);
        if (match) targetText = match[1];
      }
      this.highlightGuideElement(targetText, currentStep.targetSelector);
    }
    highlightGuideElement(targetText, selector) {
      this.clearGuideHighlight();
      if (!targetText && !selector) return;
      let targetEl = null;
      if (selector) {
        try {
          targetEl = document.querySelector(selector);
        } catch {
        }
      }
      if (!targetEl && targetText) {
        const candidates = Array.from(document.querySelectorAll(
          'button, a, [role="button"], input[type="button"], input[type="submit"], .btn, .card, h2, h3, h4'
        )).filter((el) => {
          if (el.closest("#tfb-guide-overlay-host") || el.closest("#tfb-portal-overlay-host")) return false;
          return el.offsetParent !== null || typeof window !== "undefined" && window.getComputedStyle(el).display !== "none";
        });
        const cleanTarget = targetText.toLowerCase().trim();
        targetEl = candidates.find((el) => el.textContent?.trim().toLowerCase() === cleanTarget) || null;
        if (!targetEl) {
          targetEl = candidates.find((el) => el.textContent?.trim().toLowerCase().includes(cleanTarget)) || null;
        }
        if (!targetEl) {
          targetEl = candidates.find((el) => (el.getAttribute("aria-label") || "").toLowerCase().includes(cleanTarget)) || null;
        }
      }
      if (targetEl) {
        try {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
        }
        targetEl.style.setProperty("outline", "3px solid #2563eb", "important");
        targetEl.style.setProperty("outline-offset", "3px", "important");
        targetEl.style.setProperty("box-shadow", "0 0 0 6px rgba(37, 99, 235, 0.35)", "important");
        targetEl.setAttribute("data-tfb-highlighted", "true");
        this.currentlyHighlightedElement = targetEl;
      }
    }
    clearGuideHighlight() {
      if (this.currentlyHighlightedElement) {
        try {
          this.currentlyHighlightedElement.style.removeProperty("outline");
          this.currentlyHighlightedElement.style.removeProperty("outline-offset");
          this.currentlyHighlightedElement.style.removeProperty("box-shadow");
          this.currentlyHighlightedElement.removeAttribute("data-tfb-highlighted");
        } catch {
        }
        this.currentlyHighlightedElement = null;
      }
      if (typeof document !== "undefined") {
        document.querySelectorAll("[data-tfb-highlighted]").forEach((el) => {
          try {
            el.style.removeProperty("outline");
            el.style.removeProperty("outline-offset");
            el.style.removeProperty("box-shadow");
            el.removeAttribute("data-tfb-highlighted");
          } catch {
          }
        });
      }
    }
    generateDefaultGuideData() {
      const pageTitle = typeof document !== "undefined" ? document.title : "Official Portal";
      const cleanTask = this.taskName || "Application Navigation";
      const visibleActions = typeof document !== "undefined" ? Array.from(document.querySelectorAll(
        'button, a, [role="button"], .btn, .card'
      )).filter((el) => {
        if (el.closest("#tfb-guide-overlay-host") || el.closest("#tfb-portal-overlay-host")) return false;
        return el.offsetParent !== null && Boolean(el.textContent?.trim());
      }) : [];
      let primeTarget = null;
      let primeText = "";
      const keywords = ["form 6", "fill form", "apply online", "register", "new registration", "services", "apply"];
      for (const kw of keywords) {
        primeTarget = visibleActions.find((el) => el.textContent?.toLowerCase().includes(kw)) || null;
        if (primeTarget) {
          primeText = primeTarget.textContent?.trim().replace(/\s+/g, " ") || "";
          break;
        }
      }
      const steps = [];
      if (primeText) {
        steps.push({
          stepNumber: 1,
          text: `Click on "${primeText}" to begin your application.`,
          targetText: primeText
        });
        steps.push({
          stepNumber: 2,
          text: "Sign up or log in using your mobile number and OTP if prompted."
        });
        steps.push({
          stepNumber: 3,
          text: "Fill out your applicant details, upload required proofs, and verify before submitting."
        });
      } else {
        steps.push({
          stepNumber: 1,
          text: `Review the portal options for "${cleanTask}" and choose your designated service.`
        });
        steps.push({
          stepNumber: 2,
          text: "Follow the portal instructions to proceed to the application form."
        });
      }
      this.guideData = {
        taskName: cleanTask,
        title: pageTitle,
        summary: `Welcome to ${pageTitle}. This page provides access to ${cleanTask}. Follow the steps below to navigate to the official application form.`,
        steps
      };
    }
    /**
     * Mounts the overlay inside an open Shadow DOM attached to document.body.
     */
    mount(targetParent = document.body) {
      if (this.host) return;
      let existingHost = document.getElementById("tfb-guide-overlay-host");
      if (existingHost) {
        existingHost.remove();
      }
      this.host = document.createElement("div");
      this.host.id = "tfb-guide-overlay-host";
      targetParent.appendChild(this.host);
      this.shadow = this.host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = OVERLAY_CSS;
      this.shadow.appendChild(style);
      const wrapper = document.createElement("div");
      wrapper.className = "tfb-overlay-root";
      wrapper.id = "tfb-root";
      this.shadow.appendChild(wrapper);
      this.render();
      this.open();
    }
    /**
     * Updates overlay state with scanned fields and profile analysis.
     */
    setData(fields, analysis, profileValues) {
      this.fields = fields;
      this.analysis = analysis;
      this.profileValues = profileValues;
      this.currentIndex = 0;
      if (!isRealForm(fields)) {
        this.mode = "guide";
        if (!this.guideData) {
          this.generateDefaultGuideData();
        }
      } else {
        this.mode = "fill";
        this.isComplete = false;
      }
      this.render();
      if (this.mode === "fill") {
        this.highlightCurrentField();
      } else {
        this.highlightCurrentGuideStep();
      }
    }
    setLanguage(lang) {
      this.language = sanitizeLanguage(lang);
      this.render();
    }
    open() {
      this.isOpen = true;
      this.isMinimized = false;
      this.render();
      this.highlightCurrentField();
    }
    close() {
      this.isOpen = false;
      this.isMinimized = false;
      const sheet = this.shadow?.querySelector(".tfb-sheet");
      const backdrop = this.shadow?.querySelector(".tfb-backdrop");
      sheet?.classList.remove("open");
      backdrop?.classList.remove("visible");
      this.stopSpeaking();
      this.onClose?.();
    }
    minimize() {
      this.isMinimized = true;
      this.render();
    }
    expand() {
      this.isMinimized = false;
      this.render();
      this.highlightCurrentField();
    }
    isOverlayMinimized() {
      return this.isMinimized;
    }
    nextField() {
      if (this.currentIndex < this.fields.length - 1) {
        this.currentIndex++;
        this.render();
        this.highlightCurrentField();
      } else {
        this.isComplete = true;
        this.render();
        this.onComplete?.();
      }
    }
    prevField() {
      if (this.isComplete) {
        this.isComplete = false;
        this.currentIndex = Math.max(0, this.fields.length - 1);
        this.render();
        this.highlightCurrentField();
        return;
      }
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.render();
        this.highlightCurrentField();
      }
    }
    /**
     * Fills only the currently focused field using applyFill and advances.
     */
    fillCurrentField() {
      const field = this.fields[this.currentIndex];
      const an = this.analysis[this.currentIndex];
      if (!field || !an || an.sensitive || an.manual || !an.canFill || !an.profileKey) return;
      applyFill({ [field.id]: an.profileKey }, this.profileValues, [field]);
      this.nextField();
    }
    /**
     * Fills all eligible non-sensitive fields at once.
     * STRICT: Skips every field marked sensitive or manual on either the schema or analysis.
     */
    fillAllFields() {
      const mapping = {};
      for (let i = 0; i < this.fields.length; i++) {
        const f = this.fields[i];
        const a = this.analysis[i];
        if (f.sensitive || f.manual || a && (a.sensitive || a.manual || !a.canFill || !a.profileKey)) {
          continue;
        }
        if (a && a.canFill && a.profileKey) {
          mapping[f.id] = a.profileKey;
        }
      }
      applyFill(mapping, this.profileValues, this.fields);
      this.isComplete = true;
      this.render();
      this.onComplete?.();
    }
    /**
     * Triggers text-to-speech for the current guidance message.
     * Asks host bridge first, falling back to window.speechSynthesis.
     */
    async readAloud() {
      if (this.isSpeaking || typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking) {
        this.stopSpeaking();
        return;
      }
      const t = this.getTranslations();
      let textToSpeak = "";
      if (this.mode === "guide") {
        const steps = this.guideData?.steps || [];
        const currentStep = steps[this.guideStepIndex];
        const stepNum = this.guideStepIndex + 1;
        const stepText = currentStep?.text || "";
        const stepProgStr = t.stepProgress ? t.stepProgress(stepNum, steps.length) : `Step ${stepNum} of ${steps.length}`;
        if (this.guideStepIndex === 0 && this.guideData?.summary) {
          textToSpeak = `${this.guideData.summary} ${stepProgStr}: ${stepText}`;
        } else {
          textToSpeak = `${stepProgStr}: ${stepText}`;
        }
      } else if (this.isComplete) {
        textToSpeak = `${t.completedTitle}. ${t.reviewAndSubmitMessage}. ${t.noAutoSubmitNotice}`;
      } else {
        const field = this.fields[this.currentIndex];
        const an = this.analysis[this.currentIndex];
        const fieldName = field?.label || "Current Field";
        const explanation = an?.explanation || "";
        const whatToEnter = an?.whatToEnter || "";
        const sensitiveWarning = an?.sensitive ? ` ${t.sensitiveFieldWarning}` : "";
        textToSpeak = `${fieldName}. ${explanation}. ${whatToEnter}.${sensitiveWarning}`;
      }
      if (!textToSpeak.trim()) return;
      this.isSpeaking = true;
      this.updateSpeakButtonUI();
      const targetLangTag = getLanguageBcp47(this.language);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(textToSpeak);
          utter.lang = targetLangTag;
          const voices = window.speechSynthesis.getVoices();
          let matchingVoice;
          if (voices && voices.length > 0) {
            const targetPrefix = this.language.toLowerCase().split("-")[0];
            matchingVoice = voices.find((v) => {
              const n = v.name.toLowerCase();
              const l = v.lang.toLowerCase().replace(/_/g, "-");
              const isHQ = n.includes("google") || n.includes("natural") || n.includes("online") || v.voiceURI && v.voiceURI.toLowerCase().includes("google");
              return isHQ && (l === targetLangTag.toLowerCase() || l.startsWith(targetPrefix));
            }) || voices.find((v) => {
              const l = v.lang.toLowerCase().replace(/_/g, "-");
              return l === targetLangTag.toLowerCase();
            }) || voices.find((v) => {
              const l = v.lang.toLowerCase().replace(/_/g, "-");
              return l.startsWith(targetPrefix);
            });
            if (!matchingVoice && this.language !== "hi") {
              matchingVoice = voices.find((v) => {
                const l = v.lang.toLowerCase().replace(/_/g, "-");
                const n = v.name.toLowerCase();
                return l.startsWith("hi") || n.includes("hindi") || n.includes("\u0939\u093F\u0928\u094D\u0926\u0940");
              });
              if (matchingVoice) {
                this.voiceNotice = "Pronunciation may differ (using Hindi hi-IN fallback voice as no native voice is installed).";
                this.render();
              }
            }
          }
          if (matchingVoice) {
            try {
              utter.voice = matchingVoice;
              utter.lang = matchingVoice.lang || targetLangTag;
            } catch {
            }
            if (!this.voiceNotice) {
              this.voiceNotice = "";
            }
          } else if (voices && voices.length > 0 && this.language !== "en") {
            this.voiceNotice = t.noVoiceNotice ? t.noVoiceNotice(targetLangTag) : `Notice: No voice installed for ${targetLangTag} on this system. Audio may use default synthesizer.`;
            this.render();
          } else {
            this.voiceNotice = "";
          }
          utter.onend = () => {
            this.isSpeaking = false;
            this.updateSpeakButtonUI();
          };
          utter.onerror = () => {
            this.isSpeaking = false;
            this.updateSpeakButtonUI();
          };
          window.speechSynthesis.speak(utter);
        } catch {
          this.isSpeaking = false;
          this.updateSpeakButtonUI();
        }
      } else if (this.bridge) {
        try {
          await this.bridge.send("SPEAK_REQUEST", {
            text: textToSpeak,
            language: this.language
          });
        } catch {
        }
      }
    }
    stopSpeaking() {
      this.isSpeaking = false;
      this.updateSpeakButtonUI();
      if (this.bridge) {
        this.bridge.send("STOP_SPEAK_REQUEST").catch(() => {
        });
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
    updateSpeakButtonUI() {
      const speakBtn = this.shadow?.querySelector(".tfb-btn-speak");
      const speakText = this.shadow?.querySelector(".tfb-speak-text");
      const t = this.getTranslations();
      if (speakBtn && speakText) {
        if (this.isSpeaking) {
          speakBtn.classList.add("active");
          speakText.textContent = t.btnStopAudio;
        } else {
          speakBtn.classList.remove("active");
          speakText.textContent = t.btnReadAloud;
        }
      }
    }
    /**
     * Highlights the current field on the host page and scrolls it into view.
     */
    highlightCurrentField() {
      if (this.fields.length === 0 || this.isComplete) return;
      const field = this.fields[this.currentIndex];
      if (!field) return;
      try {
        const el = document.querySelector(field.selector) || document.getElementById(field.id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus({ preventScroll: true });
          el.style.setProperty("outline", "3px solid #3b82f6", "important");
          el.style.setProperty("outline-offset", "2px", "important");
        }
      } catch {
      }
    }
    getTranslations() {
      const base = OVERLAY_TRANSLATIONS["en"];
      const current = OVERLAY_TRANSLATIONS[this.language] || base;
      return { ...base, ...current };
    }
    /**
     * Main render method inside Shadow DOM.
     */
    render() {
      const root = this.shadow?.getElementById("tfb-root");
      if (!root) return;
      const t = this.getTranslations();
      let bodyContentHtml = "";
      let progressHtml = "";
      let footerHtml = "";
      let pillInfoHtml = "";
      if (this.mode === "guide") {
        const guideSteps = this.guideData?.steps || [];
        const totalSteps = guideSteps.length || 1;
        const currentStepNum = Math.min(this.guideStepIndex + 1, totalSteps);
        const progressPercent = currentStepNum / totalSteps * 100;
        const currentStep = guideSteps[this.guideStepIndex];
        const stepProgLabel = t.stepProgress ? t.stepProgress(currentStepNum, totalSteps) : `Step ${currentStepNum} of ${totalSteps}`;
        const pageGuideLabel = this.guideData?.title || t.pageGuideTitle || "Page Guide";
        const taskLabel = t.activeTaskLabel || "Active Task";
        pillInfoHtml = `${this.taskName || pageGuideLabel}: ${stepProgLabel}`;
        progressHtml = `
        <div class="tfb-progress-container">
          <div class="tfb-progress-header">
            <span>${stepProgLabel}</span>
            <span>${Math.round(progressPercent)}%</span>
          </div>
          <div class="tfb-progress-track">
            <div class="tfb-progress-bar" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      `;
        bodyContentHtml = `
        ${this.taskName ? `
          <div class="tfb-task-banner">
            <span class="tfb-task-icon">\u{1F3AF}</span>
            <span class="tfb-task-label">${taskLabel}:</span>
            <strong class="tfb-task-title">${this.taskName}</strong>
          </div>
        ` : ""}

        <div class="tfb-card">
          <div class="tfb-card-subtitle" style="font-size:12px;font-weight:700;color:#38bdf8;margin-bottom:6px;">${pageGuideLabel}</div>
          <div class="tfb-explanation-box">
            ${this.guideData?.summary || "Follow the step-by-step guidance below to proceed with your application."}
          </div>
        </div>

        <div class="tfb-card tfb-step-active-card">
          <div class="tfb-step-header">
            <span class="tfb-step-pill">${stepProgLabel}</span>
            ${currentStep?.targetText ? `<span class="tfb-status-pill autofill">Action</span>` : ""}
          </div>

          <div class="tfb-step-body">
            ${currentStep?.text || "Review page and proceed."}
          </div>

          ${currentStep?.targetText ? `
            <div class="tfb-target-hint">
              <span>\u{1F449}</span>
              <span>${t.guideElementHighlighted || "Click highlighted element"}: <strong>"${currentStep.targetText}"</strong></span>
            </div>
          ` : ""}

          ${this.voiceNotice ? `
            <div class="tfb-voice-notice-box">
              <span>\u26A0\uFE0F</span>
              <span>${this.voiceNotice}</span>
            </div>
          ` : ""}
        </div>

        <div class="tfb-options-row">
          <label class="tfb-auto-read-label">
            <input type="checkbox" id="tfb-auto-read-toggle" ${this.autoReadEnabled ? "checked" : ""} />
            <span>\u{1F50A} ${t.autoReadToggle}</span>
          </label>
        </div>
      `;
        footerHtml = `
        <div class="tfb-btn-row-nav">
          <button class="tfb-btn tfb-btn-outline" id="tfb-prev-btn" ${this.guideStepIndex === 0 ? "disabled" : ""}>
            \u2190 ${t.btnPrev}
          </button>
          <button class="tfb-btn tfb-btn-speak ${this.isSpeaking ? "active" : ""}" id="tfb-speak-btn" title="${this.isSpeaking ? t.btnStopAudio : t.btnReadAloud}">
            ${this.isSpeaking ? "\u23F9\uFE0F" : "\u{1F50A}"} <span class="tfb-speak-text">${this.isSpeaking ? t.btnStopAudio : t.btnReadAloud}</span>
          </button>
          <button class="tfb-btn tfb-btn-outline" id="tfb-next-btn">
            ${this.guideStepIndex === totalSteps - 1 ? t.btnDone : t.btnNext} \u2192
          </button>
        </div>
      `;
      } else {
        const totalFields = this.fields.length;
        const currentNum = Math.min(this.currentIndex + 1, totalFields);
        const progressPercent = totalFields > 0 ? currentNum / totalFields * 100 : 100;
        const currentField = this.fields[this.currentIndex];
        const currentAnalysis = this.analysis[this.currentIndex];
        pillInfoHtml = this.isComplete ? t.completedTitle : `${currentNum}/${totalFields}: ${currentField?.label || "Form Field"}`;
        let statusPillHtml = "";
        let isFillDisabled = true;
        if (currentAnalysis) {
          if (currentAnalysis.sensitive) {
            statusPillHtml = `<span class="tfb-status-pill sensitive">Sensitive (Type Yourself)</span>`;
          } else if (currentAnalysis.canFill) {
            statusPillHtml = `<span class="tfb-status-pill autofill">Auto-Fillable</span>`;
            isFillDisabled = false;
          } else {
            statusPillHtml = `<span class="tfb-status-pill manual">Manual Entry</span>`;
          }
        }
        progressHtml = `
        <div class="tfb-progress-container">
          <div class="tfb-progress-header">
            <span>${t.fieldProgress(this.isComplete ? totalFields : currentNum, totalFields)}</span>
            <span>${Math.round(this.isComplete ? 100 : progressPercent)}%</span>
          </div>
          <div class="tfb-progress-track">
            <div class="tfb-progress-bar" style="width: ${this.isComplete ? 100 : progressPercent}%"></div>
          </div>
        </div>
      `;
        if (this.isComplete || totalFields === 0) {
          bodyContentHtml = `
          <div class="tfb-completion-card">
            <div class="tfb-completion-title">${t.completedTitle}</div>
            <div class="tfb-completion-text">${t.reviewAndSubmitMessage}</div>
            <div class="tfb-rule-reminder">${t.noAutoSubmitNotice}</div>
          </div>
        `;
        } else {
          bodyContentHtml = `
          ${this.taskName ? `
            <div class="tfb-task-banner">
              <span class="tfb-task-icon">\u{1F3AF}</span>
              <span class="tfb-task-label">${t.activeTaskLabel}:</span>
              <strong class="tfb-task-title">${this.taskName}</strong>
            </div>
          ` : ""}

          <div class="tfb-card">
            <div class="tfb-field-badge-row">
              <span class="tfb-section-tag">${currentField?.section || "General"}</span>
              ${statusPillHtml}
            </div>

            <div class="tfb-field-label">${currentField?.label || "Form Field"}</div>

            <div class="tfb-explanation-box">
              ${currentAnalysis?.explanation || "Enter the requested information according to your records."}
            </div>

            <div class="tfb-instruction-box">
              <span>\u{1F449}</span>
              <span>${currentAnalysis?.whatToEnter || "Please type or choose your value."}</span>
            </div>

            ${currentAnalysis?.sensitive ? `
              <div class="tfb-alert-box">
                <span>\u26A0\uFE0F</span>
                <span>${t.sensitiveFieldWarning}</span>
              </div>
            ` : ""}

            ${this.voiceNotice ? `
              <div class="tfb-voice-notice-box">
                <span>\u26A0\uFE0F</span>
                <span>${this.voiceNotice}</span>
              </div>
            ` : ""}
          </div>

          <div class="tfb-options-row">
            <label class="tfb-auto-read-label">
              <input type="checkbox" id="tfb-auto-read-toggle" ${this.autoReadEnabled ? "checked" : ""} />
              <span>\u{1F50A} ${t.autoReadToggle}</span>
            </label>
          </div>
        `;
        }
        footerHtml = `
        ${!this.isComplete ? `
          <div class="tfb-btn-row-main">
            <button class="tfb-btn tfb-btn-primary" id="tfb-fill-this-btn" ${isFillDisabled ? "disabled" : ""}>
              \u2713 ${t.btnFillThis}
            </button>
            <button class="tfb-btn tfb-btn-secondary" id="tfb-fill-all-btn">
              \u26A1 ${t.btnFillAll}
            </button>
          </div>
        ` : ""}

        <div class="tfb-btn-row-nav">
          <button class="tfb-btn tfb-btn-outline" id="tfb-prev-btn" ${this.currentIndex === 0 && !this.isComplete ? "disabled" : ""}>
            \u2190 ${t.btnPrev}
          </button>
          <button class="tfb-btn tfb-btn-speak ${this.isSpeaking ? "active" : ""}" id="tfb-speak-btn" title="${this.isSpeaking ? t.btnStopAudio : t.btnReadAloud}">
            ${this.isSpeaking ? "\u23F9\uFE0F" : "\u{1F50A}"} <span class="tfb-speak-text">${this.isSpeaking ? t.btnStopAudio : t.btnReadAloud}</span>
          </button>
          <button class="tfb-btn tfb-btn-outline" id="tfb-next-btn">
            ${this.isComplete ? t.btnDone : t.btnNext} \u2192
          </button>
        </div>
      `;
      }
      root.innerHTML = `
      <!-- Minimized Floating Pill (Tap to Expand) -->
      <div class="tfb-minimized-pill ${this.isMinimized ? "visible" : ""}" id="tfb-minimized-pill" title="Tap to expand guide">
        <span class="tfb-pill-badge">BUDDY</span>
        <span class="tfb-pill-info">${pillInfoHtml}</span>
        <span class="tfb-pill-action">Tap to Expand \u25B4</span>
      </div>

      <div class="tfb-backdrop ${this.isOpen && !this.isMinimized ? "visible" : ""}"></div>
      <div class="tfb-sheet ${this.isOpen && !this.isMinimized ? "open" : ""}">
        <div class="tfb-handle-bar">
          <div class="tfb-handle-pill"></div>
        </div>

        <!-- Header -->
        <div class="tfb-header">
          <div class="tfb-title-wrap">
            <span class="tfb-logo-badge">BUDDY</span>
            <span class="tfb-header-title">${t.title}</span>
          </div>
          <div class="tfb-header-actions">
            <select class="tfb-lang-select" id="tfb-lang-dropdown">
              ${SUPPORTED_LANGUAGES.map((l) => `<option value="${l.code}" ${this.language === l.code ? "selected" : ""}>${l.label === l.nativeName ? l.label : `${l.label} (${l.nativeName})`}</option>`).join("")}
            </select>
            <button class="tfb-icon-btn" id="tfb-minimize-btn" title="Minimize Overlay">\u2500</button>
            <button class="tfb-icon-btn" id="tfb-close-btn" title="Close Overlay">\u2715</button>
          </div>
        </div>

        <!-- Hard Rule Notice Bar -->
        <div class="tfb-notice-bar">
          <span class="tfb-notice-icon">\u{1F6E1}\uFE0F</span>
          <span>${t.loginOtpNotice}</span>
        </div>

        <!-- Progress Indicator -->
        ${progressHtml}

        <!-- Body / Field Card -->
        <div class="tfb-body">
          ${bodyContentHtml}
        </div>

        <!-- Footer / Action Buttons -->
        <div class="tfb-footer">
          ${footerHtml}
        </div>
      </div>
    `;
      this.attachEventListeners();
    }
    attachEventListeners() {
      if (!this.shadow) return;
      const langSelect = this.shadow.getElementById("tfb-lang-dropdown");
      langSelect?.addEventListener("change", (e) => {
        this.setLanguage(e.target.value);
      });
      const minimizeBtn = this.shadow.getElementById("tfb-minimize-btn");
      minimizeBtn?.addEventListener("click", () => this.minimize());
      const minimizedPill = this.shadow.getElementById("tfb-minimized-pill");
      minimizedPill?.addEventListener("click", () => this.expand());
      const closeBtn = this.shadow.getElementById("tfb-close-btn");
      closeBtn?.addEventListener("click", () => this.close());
      const backdrop = this.shadow.querySelector(".tfb-backdrop");
      backdrop?.addEventListener("click", () => this.close());
      const autoReadToggle = this.shadow.getElementById("tfb-auto-read-toggle");
      autoReadToggle?.addEventListener("change", (e) => {
        this.autoReadEnabled = e.target.checked;
      });
      const fillThisBtn = this.shadow.getElementById("tfb-fill-this-btn");
      fillThisBtn?.addEventListener("click", () => this.fillCurrentField());
      const fillAllBtn = this.shadow.getElementById("tfb-fill-all-btn");
      fillAllBtn?.addEventListener("click", () => this.fillAllFields());
      const nextBtn = this.shadow.getElementById("tfb-next-btn");
      nextBtn?.addEventListener("click", () => {
        if (this.mode === "guide") {
          const total = this.guideData?.steps?.length || 1;
          if (this.guideStepIndex >= total - 1) {
            this.close();
          } else {
            this.nextGuideStep();
          }
        } else if (this.isComplete) {
          this.close();
        } else {
          this.nextField();
        }
      });
      const prevBtn = this.shadow.getElementById("tfb-prev-btn");
      prevBtn?.addEventListener("click", () => {
        if (this.mode === "guide") {
          this.prevGuideStep();
        } else {
          this.prevField();
        }
      });
      const speakBtn = this.shadow.getElementById("tfb-speak-btn");
      speakBtn?.addEventListener("click", () => this.readAloud());
    }
    /**
     * Destroys and removes the overlay completely.
     */
    destroy() {
      this.stopSpeaking();
      this.clearGuideHighlight();
      if (this.host) {
        this.host.remove();
        this.host = null;
        this.shadow = null;
      }
    }
  };

  // packages/form-core/src/index.ts
  var activeOverlayInstance = null;
  function mountOverlay(options = {}) {
    if (activeOverlayInstance) {
      activeOverlayInstance.destroy();
    }
    activeOverlayInstance = new GuideOverlay(options);
    activeOverlayInstance.mount();
    return activeOverlayInstance;
  }
  function destroy() {
    if (typeof window === "undefined") return;
    if (activeOverlayInstance) {
      activeOverlayInstance.destroy();
      activeOverlayInstance = null;
    }
    const existingOverlayHost = document.getElementById("tfb-guide-overlay-host");
    if (existingOverlayHost) {
      existingOverlayHost.remove();
    }
    FormChangeObserver.disconnectAll();
    clearHighlights();
    window.__tfbLoaded = false;
  }
  var TechFormBuddyCore = {
    version: "1.0.0",
    readForm,
    generateSelector,
    isSensitiveField,
    applyFill,
    clearHighlights,
    normalizeDateValue,
    FormChangeObserver,
    createBridge,
    ChromeExtensionBridge,
    AndroidInAppBrowserBridge,
    MockBridge,
    analyzeField,
    analyzeForm,
    generateSafeMapping,
    detectSensitiveField,
    isLanguageControl,
    isSearchControl,
    isNavigationOrHeaderFooterControl,
    isRealForm,
    GuideOverlay,
    mountOverlay,
    destroy
  };
  if (typeof window !== "undefined") {
    if (!window.__tfbLoaded) {
      window.__tfbLoaded = true;
      window.TechFormBuddyCore = TechFormBuddyCore;
    }
  }
  var index_default = TechFormBuddyCore;
  return __toCommonJS(index_exports);
})();
