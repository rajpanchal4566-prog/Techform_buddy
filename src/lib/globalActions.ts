/**
 * Global Actions Definition
 *
 * App-wide actions registered into the Action Registry that are available
 * across every page in the application.
 */

'use client';

import { ActionDefinition, actionRegistry } from './actionRegistry';
import { SUPPORTED_LANGUAGES } from './speech';

export function createGlobalActions(router: { push: (url: string) => void }): ActionDefinition[] {
  return [
    // 1. Navigate
    {
      name: 'navigate',
      description: 'Navigate to any page in the application (forms, dashboard, documents, settings, watch, profile).',
      parameters: {
        page: {
          type: 'string',
          description: 'The target destination URL or route (e.g. /forms, /dashboard, /documents, /settings, /form-watch, /profile).',
          required: true,
        },
      },
      isReadOnly: true,
      handler: async ({ page }) => {
        let destination = String(page).trim();
        if (!destination.startsWith('/')) {
          destination = `/${destination}`;
        }
        router.push(destination);
        return {
          success: true,
          message: `Navigated to ${destination}`,
        };
      },
    },

    // 2. Open Settings
    {
      name: 'open_settings',
      description: 'Open application settings page or specific settings section.',
      parameters: {
        section: {
          type: 'string',
          description: 'Section to open (e.g. voice, language, accessibility, display).',
          required: false,
        },
      },
      isReadOnly: true,
      handler: async ({ section }) => {
        const dest = section ? `/settings#${section}` : '/settings';
        router.push(dest);
        return {
          success: true,
          message: `Opened settings ${section ? `section ${section}` : ''}`.trim(),
        };
      },
    },

    // 3. Set Language
    {
      name: 'set_language',
      description: 'Change the application and assistant language (e.g. en, hi, bn, te, ta, mr, gu, kn, ml).',
      parameters: {
        lang: {
          type: 'string',
          description: 'Language code (e.g. en, hi, bn, te, ta, mr, gu, kn, ml, pa, or, as, ur).',
          required: true,
          enum: SUPPORTED_LANGUAGES.map((l) => l.code),
        },
      },
      isReadOnly: false,
      isReversible: true,
      confirmationPrompt: ({ lang }, activeLang) => {
        const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
        const name = langObj ? `${langObj.label} (${langObj.nativeName})` : lang;
        if (activeLang === 'hi') {
          return `क्या आप भाषा बदलकर "${name}" करना चाहते हैं?`;
        }
        return `Do you want to change the application language to ${name}?`;
      },
      handler: async ({ lang }) => {
        if (typeof window === 'undefined') return;
        const prevLang = localStorage.getItem('tfb_lang') || 'en';
        const langCode = String(lang).toLowerCase().trim();

        localStorage.setItem('tfb_lang', langCode);
        localStorage.setItem('tfb_language', langCode);
        localStorage.setItem('preferred_language', langCode);
        window.dispatchEvent(
          new CustomEvent('tfb-language-changed', { detail: { language: langCode } })
        );

        const langName =
          SUPPORTED_LANGUAGES.find((l) => l.code === langCode)?.label || langCode.toUpperCase();

        return {
          success: true,
          message: `Language changed to ${langName}`,
          undo: () => {
            localStorage.setItem('tfb_lang', prevLang);
            localStorage.setItem('tfb_language', prevLang);
            localStorage.setItem('preferred_language', prevLang);
            window.dispatchEvent(
              new CustomEvent('tfb-language-changed', { detail: { language: prevLang } })
            );
          },
        };
      },
    },

    // 4. Set Voice Speed
    {
      name: 'set_voice_speed',
      description: 'Adjust the speech synthesis voice rate/speed (from 0.5 to 2.0).',
      parameters: {
        value: {
          type: 'number',
          description: 'Playback rate multiplier (e.g. 0.8, 1.0, 1.2, 1.5).',
          required: true,
        },
      },
      isReadOnly: false,
      isReversible: true,
      confirmationPrompt: ({ value }) => `Adjust voice reading speed to ${value}x?`,
      handler: async ({ value }) => {
        if (typeof window === 'undefined') return;
        const prevRate = localStorage.getItem('tfb_rate') || '1.0';
        const num = Math.max(0.5, Math.min(2.0, Number(value) || 1.0));

        localStorage.setItem('tfb_rate', String(num));
        window.dispatchEvent(
          new CustomEvent('tfb-voice-rate-changed', { detail: { rate: num } })
        );

        return {
          success: true,
          message: `Voice speed set to ${num}x`,
          undo: () => {
            localStorage.setItem('tfb_rate', prevRate);
            window.dispatchEvent(
              new CustomEvent('tfb-voice-rate-changed', { detail: { rate: parseFloat(prevRate) } })
            );
          },
        };
      },
    },

    // 5. Toggle Setting
    {
      name: 'toggle_setting',
      description: 'Toggle an accessibility or user preference setting (high contrast, dyslexic font, screen reader, sound effects).',
      parameters: {
        name: {
          type: 'string',
          description: 'Name of the setting (e.g. high_contrast, dyslexic_font, screen_reader, sound_effects).',
          required: true,
        },
        value: {
          type: 'boolean',
          description: 'Enable (true) or disable (false).',
          required: true,
        },
      },
      isReadOnly: false,
      isReversible: true,
      confirmationPrompt: ({ name, value }) =>
        `${value ? 'Enable' : 'Disable'} setting "${name}"?`,
      handler: async ({ name, value }) => {
        if (typeof window === 'undefined') return;
        const key = `tfb_setting_${name}`;
        const prev = localStorage.getItem(key);
        const boolVal = Boolean(value);

        localStorage.setItem(key, String(boolVal));
        window.dispatchEvent(
          new CustomEvent('tfb-setting-changed', {
            detail: { setting: name, value: boolVal },
          })
        );

        // Apply HTML class if high_contrast or dyslexic_font
        if (name === 'high_contrast') {
          document.documentElement.classList.toggle('high-contrast', boolVal);
        } else if (name === 'dyslexic_font') {
          document.documentElement.classList.toggle('dyslexic-font', boolVal);
        }

        return {
          success: true,
          message: `Setting "${name}" ${boolVal ? 'enabled' : 'disabled'}`,
          undo: () => {
            if (prev === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, prev);
            }
            const oldBool = prev === 'true';
            window.dispatchEvent(
              new CustomEvent('tfb-setting-changed', {
                detail: { setting: name, value: oldBool },
              })
            );
            if (name === 'high_contrast') {
              document.documentElement.classList.toggle('high-contrast', oldBool);
            } else if (name === 'dyslexic_font') {
              document.documentElement.classList.toggle('dyslexic-font', oldBool);
            }
          },
        };
      },
    },

    // 6. Explain Page (Guide Mode)
    {
      name: 'explain_page',
      description: 'Explain the current page: purpose, ordered steps, required preparation, and offer next steps.',
      parameters: {},
      isReadOnly: true,
      handler: async () => {
        window.dispatchEvent(new CustomEvent('tfb-explain-page'));
        return {
          success: true,
          message: 'Explaining current page',
        };
      },
    },

    // 7. Read Aloud
    {
      name: 'read_aloud',
      description: 'Read the page aloud or listen to the smart spoken briefing.',
      parameters: {
        scope: {
          type: 'string',
          description: 'Reading scope: "briefing" (smart 5-part summary) or "full" (entire text) or "next_field".',
          required: false,
          enum: ['briefing', 'full', 'next_field'],
        },
      },
      isReadOnly: true,
      handler: async ({ scope = 'briefing' }) => {
        window.dispatchEvent(
          new CustomEvent('tfb-trigger-speech', { detail: { scope } })
        );
        return {
          success: true,
          message: `Triggered speech (${scope})`,
        };
      },
    },

    // 8. Toggle Autofill (Autofill Mode)
    {
      name: 'toggle_autofill',
      description: 'Turn smart form autofill mode ON or OFF.',
      parameters: {
        enabled: {
          type: 'boolean',
          description: 'Enable (true) or disable (false) autofill mode.',
          required: false,
        },
      },
      isReadOnly: false,
      isReversible: true,
      handler: async ({ enabled }) => {
        const cur = localStorage.getItem('tfb_autofill_mode') !== 'false';
        const next = typeof enabled === 'boolean' ? enabled : !cur;
        localStorage.setItem('tfb_autofill_mode', String(next));
        window.dispatchEvent(new CustomEvent('tfb-autofill-mode-changed', { detail: { enabled: next } }));
        return {
          success: true,
          message: `Autofill mode turned ${next ? 'ON' : 'OFF'}`,
          undo: () => {
            localStorage.setItem('tfb_autofill_mode', String(cur));
            window.dispatchEvent(new CustomEvent('tfb-autofill-mode-changed', { detail: { enabled: cur } }));
          },
        };
      },
    },
  ];
}

