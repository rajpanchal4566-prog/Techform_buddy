# `@techformbuddy/form-core`

The core client-side library for TechForm Buddy. Distributed as a standalone IIFE bundle (`form-core.iife.js`) for injection into external web pages via the Chrome Extension (Manifest V3) or mobile host WebView environments.

---

## Architecture & Responsibilities

1. **`readForm(root)`**:
   - Safely scans form inputs (`<input>`, `<select>`, `<textarea>`, radio groups, checkboxes).
   - Recurses through open Shadow DOM roots (`attachShadow({ mode: 'open' })`) and same-origin `<iframe>` contexts.
   - Enforces **Hard Rule 2 & 3**: Excludes password, hidden, captcha (`turnstile`, `hcaptcha`, `g-recaptcha`), OTP, and submit/action buttons.
   - Enforces **Hard Rule 4**: Flags sensitive identification and financial fields (`sensitive: true, manual: true`) with word-boundary and multilingual detection.

2. **`applyFill(mapping, values, fieldSchemas, root)`**:
   - Injects values into standard, React, Vue, and Angular controlled forms by triggering prototype value setters (`Object.getOwnPropertyDescriptor(prototype, 'value').set`).
   - Dispatches full event lifecycle (`input`, `change`, `blur`) with `{ bubbles: true, composed: true }`.
   - Fuzzy option matching for `<select>`, boolean toggles for checkboxes, and radio group selection.
   - Normalizes dates to the field's target format (`YYYY-MM-DD`, `DD/MM/YYYY`, etc.) with Indian standard assumption (`DD/MM/YYYY`) and ambiguous date confidence logging.
   - Visually highlights filled fields with a green outline (`#22c55e`).

3. **`FormChangeObserver`**:
   - Debounced `MutationObserver` combined with idempotent URL and SPA routing interceptors (`pushState`, `replaceState`, `popstate`, `hashchange`).
   - Supports multi-step wizards without duplicate history patching.

4. **`GuideOverlay` (Phase 2)**:
   - Mobile-first bottom sheet that seamlessly transitions to a right-side drawer on wide screens (`>= 768px`).
   - Completely encapsulated inside an open Shadow DOM (`attachShadow({ mode: 'open' })`) to prevent host site CSS collisions.
   - Multi-language guidance (English, Hindi, Bengali, Tamil, Telugu, etc.).
   - Read Aloud capability with host bridge integration and desktop `speechSynthesis` fallback.
   - Displays clear privacy boundaries: *"Login, OTP and captcha are done by you"* and *"Review everything on the page, then press Submit yourself on the website."*

5. **`IBridge` Messaging**:
   - `ChromeExtensionBridge`: Communicates with extension background service workers using `chrome.runtime`.
   - `AndroidInAppBrowserBridge`: **[UNVERIFIED - PENDING PHASE 6 VERIFICATION]** Host communication channel for Capacitor in-app browser environments. Runtime feature detection returns a clear error when no supported host channel is detected.

6. **Teardown & Idempotency**:
   - Injection is guarded by `window.__tfbLoaded`.
   - `destroy()` unpatches history, disconnects observers, cleans up DOM highlights, and removes overlay instances.

---

## Known Limitations

1. **Custom Dropdown Widgets**: Custom `<div>` or `<li>` based dropdowns (such as unsemantic custom UI kits, styled `react-select`, or headless dropdowns without a backing `<select>` element) cannot be automatically read as native `<select>` controls unless ARIA listbox roles are implemented.
2. **Custom Date Pickers**: JavaScript-based popup calendar widgets that require clicking dates on a synthetic grid rather than populating the `<input>` element value or that intercept input keyboard events may require manual date selection.
3. **Closed Shadow Roots**: Elements encapsulated in closed shadow roots (`attachShadow({ mode: 'closed' })`) are deliberately shielded by the browser runtime and cannot be scanned from outside the component boundary.
4. **Cross-Origin Iframes**: External iframes hosted on a different origin (domain/subdomain) are protected by browser Same-Origin Policy (SOP). Form controls inside cross-origin iframes cannot be accessed via content scripts without extension host permissions or dedicated subframe injection.
5. **File Uploads (`<input type="file">`)**: Browser security models strictly forbid programmatic population of file paths onto `<input type="file">` without direct user interaction (such as an OS file picker event). These fields are intentionally marked `manual: true`.

---

## Build & Test

```bash
# Build standalone IIFE bundle
npm run build:form-core

# Run Playwright test suite
npm run test:form-core
```
