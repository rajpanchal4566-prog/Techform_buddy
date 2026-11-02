# Cherry Theme Audit

Baseline captured 2026-11-03 before theme changes.

The scan covered readable files under `src/` and `packages/extension/`. It counted
hex values, `rgb[a]()`/`hsl[a]()` functions, Tailwind color utilities, and named
CSS/SVG color declarations. Binary assets are not included. Generated extension
bundles are included and account for repeated matches. These counts are match
counts, not distinct-color counts.

## Summary

| Area | Files with matches | Matches |
|---|---:|---:|
| Web app and game (`src/`) | 48 | 1,751 |
| Extension (including generated output) | 9 | 1,372 |
| **Total** | **57** | **3,123** |

## Web app and game (`src/`)

| File | Total | Hex | RGB/HSL | Tailwind | Named CSS | SVG named |
|---|---:|---:|---:|---:|---:|---:|
| `src/components/voice-commander.css` | 221 | 131 | 84 | 0 | 6 | 0 |
| `src/app/(app)/forms/new/page.tsx` | 157 | 155 | 2 | 0 | 0 | 0 |
| `src/app/login/auth.css` | 112 | 70 | 41 | 0 | 1 | 0 |
| `src/components/GlobalVoiceCommander.tsx` | 111 | 104 | 7 | 0 | 0 | 0 |
| `src/app/landing.css` | 106 | 50 | 56 | 0 | 0 | 0 |
| `src/app/(app)/forms/forms.css` | 98 | 71 | 14 | 0 | 13 | 0 |
| `src/app/globals.css` | 77 | 52 | 23 | 0 | 2 | 0 |
| `src/app/(app)/browser/browser.css` | 62 | 47 | 7 | 0 | 8 | 0 |
| `src/app/(app)/form-watch/form-watch.css` | 62 | 48 | 8 | 0 | 6 | 0 |
| `src/app/(app)/settings/page.tsx` | 60 | 60 | 0 | 0 | 0 | 0 |
| `src/lib/documentExporter.ts` | 57 | 57 | 0 | 0 | 0 | 0 |
| `src/app/(app)/browser/page.tsx` | 49 | 46 | 3 | 0 | 0 | 0 |
| `src/lib/emailTemplate.ts` | 42 | 40 | 2 | 0 | 0 | 0 |
| `src/lib/downloadForm.ts` | 41 | 39 | 1 | 0 | 1 | 0 |
| `src/game/renderer.ts` | 39 | 33 | 6 | 0 | 0 | 0 |
| `src/app/(app)/arena/arena.module.css` | 32 | 23 | 9 | 0 | 0 | 0 |
| `src/components/BuddyMascot.tsx` | 32 | 31 | 1 | 0 | 0 | 0 |
| `src/app/(app)/applications/page.tsx` | 30 | 30 | 0 | 0 | 0 | 0 |
| `src/app/(app)/form-watch/page.tsx` | 29 | 27 | 2 | 0 | 0 | 0 |
| `src/app/register/page.tsx` | 28 | 27 | 1 | 0 | 0 | 0 |
| `src/app/(app)/dashboard/page.tsx` | 27 | 26 | 1 | 0 | 0 | 0 |
| `src/app/(app)/forms/[id]/page.tsx` | 26 | 26 | 0 | 0 | 0 | 0 |
| `src/app/(app)/extension/connect/page.tsx` | 23 | 22 | 1 | 0 | 0 | 0 |
| `src/app/(app)/documents/page.tsx` | 22 | 22 | 0 | 0 | 0 | 0 |
| `src/app/(app)/grievances/page.tsx` | 21 | 19 | 2 | 0 | 0 | 0 |
| `src/app/(app)/assistant/page.tsx` | 20 | 20 | 0 | 0 | 0 | 0 |
| `src/app/login/page.tsx` | 20 | 19 | 1 | 0 | 0 | 0 |
| `src/components/AccessibilityHelper.tsx` | 20 | 18 | 2 | 0 | 0 | 0 |
| `src/app/(app)/demo-portal/page.tsx` | 18 | 17 | 1 | 0 | 0 | 0 |
| `src/components/PasswordSecurityCard.tsx` | 17 | 11 | 6 | 0 | 0 | 0 |
| `src/app/(app)/status/page.tsx` | 16 | 16 | 0 | 0 | 0 | 0 |
| `src/app/(app)/assistant/assistant.css` | 12 | 6 | 2 | 0 | 4 | 0 |
| `src/app/verify-email/page.tsx` | 9 | 5 | 3 | 0 | 0 | 1 |
| `src/lib/watcher.ts` | 9 | 9 | 0 | 0 | 0 | 0 |
| `src/app/page.tsx` | 8 | 7 | 1 | 0 | 0 | 0 |
| `src/app/(app)/forms/page.tsx` | 7 | 7 | 0 | 0 | 0 | 0 |
| `src/app/(app)/profile/page.tsx` | 5 | 3 | 2 | 0 | 0 | 0 |
| `src/components/UnverifiedBanner.tsx` | 5 | 4 | 1 | 0 | 0 | 0 |
| `src/components/PwaInstallPrompt.tsx` | 4 | 3 | 0 | 0 | 1 | 0 |
| `src/app/(app)/settings/settings.css` | 3 | 2 | 0 | 0 | 1 | 0 |
| `src/app/(app)/arena/GameClient.tsx` | 2 | 2 | 0 | 0 | 0 | 0 |
| `src/app/(app)/dashboard/dashboard.css` | 2 | 0 | 1 | 0 | 1 | 0 |
| `src/components/Sidebar.tsx` | 2 | 1 | 0 | 0 | 0 | 1 |
| `src/game/systems.ts` | 2 | 2 | 0 | 0 | 0 | 0 |
| `src/lib/autofillMode.ts` | 2 | 2 | 0 | 0 | 0 | 0 |
| `src/lib/imageCompressor.ts` | 2 | 2 | 0 | 0 | 0 | 0 |
| `src/app/layout.tsx` | 1 | 1 | 0 | 0 | 0 | 0 |
| `src/game/entities.ts` | 1 | 1 | 0 | 0 | 0 | 0 |
| **Total** | **1,751** | **1,414** | **291** | **0** | **43** | **3** |

## Extension submodule (`packages/extension/`)

| File | Total | Hex | RGB/HSL | Tailwind | Named CSS | SVG named |
|---|---:|---:|---:|---:|---:|---:|
| `packages/extension/src/content-portal.ts` | 338 | 245 | 60 | 0 | 33 | 0 |
| `packages/extension/content-portal.js` | 340 | 247 | 60 | 0 | 33 | 0 |
| `packages/extension/dist/content-portal.js` | 340 | 247 | 60 | 0 | 33 | 0 |
| `packages/extension/src/agentTools.ts` | 2 | 2 | 0 | 0 | 0 | 0 |
| `packages/extension/popup.css` | 44 | 41 | 2 | 0 | 1 | 0 |
| `packages/extension/public/popup.css` | 44 | 41 | 2 | 0 | 1 | 0 |
| `packages/extension/dist/popup.css` | 44 | 41 | 2 | 0 | 1 | 0 |
| `packages/extension/form-core.iife.js` | 110 | 90 | 19 | 0 | 1 | 0 |
| `packages/extension/dist/form-core.iife.js` | 110 | 90 | 19 | 0 | 1 | 0 |
| **Total** | **1,372** | **1,044** | **224** | **0** | **103** | **0** |

Generated documents and third-party logos require separate treatment during
migration; the document export paths must remain neutral and print-friendly.
