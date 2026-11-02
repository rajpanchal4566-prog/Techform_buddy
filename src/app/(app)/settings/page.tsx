'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import PasswordSecurityCard from '@/components/PasswordSecurityCard';
import { isThemePreference, useTheme } from '@/components/ThemeProvider';
import { useRegisterActions } from '@/lib/actionRegistry';
import {
  SUPPORTED_LANGUAGES,
  speakText,
  getAvailableVoices,
  findBestVoiceForLanguage,
  getMatchingVoicesForLanguage,
  getVoiceResolution,
  isBritishVoice,
  TEST_PHRASES,
  getLocalizedMessage,
  getDefaultLanguage,
  setDefaultLanguage,
  getLanguageCapability,
  type LanguageCapabilityInfo,
} from '@/lib/speech';
import './settings.css';

export default function SettingsPage() {
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [language, setLanguage] = useState('en');
  const [speechRate, setSpeechRate] = useState('1.0');
  const [requireApproval, setRequireApproval] = useState(true);
  const [autoReadFocus, setAutoReadFocus] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Available browser speech voices
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [capability, setCapability] = useState<LanguageCapabilityInfo>(getLanguageCapability('en'));
  const [extensionTokens, setExtensionTokens] = useState<any[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);

  // Register Settings page actions (Requirement 1, 3 & 4)
  useRegisterActions([
    {
      name: 'set_language',
      description: 'Change the application and assistant language (reversible).',
      parameters: {
        lang: {
          type: 'string',
          description: 'Language code (e.g. en, hi, bn, te, ta, mr, gu, kn, ml).',
          required: true,
          enum: SUPPORTED_LANGUAGES.map((l) => l.code),
        },
      },
      isReadOnly: false,
      isReversible: true,
      confirmationPrompt: ({ lang }) => {
        const obj = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
        return `Change language to ${obj ? obj.label : lang}?`;
      },
      handler: async ({ lang }) => {
        const prev = language;
        const target = String(lang).toLowerCase();
        setLanguage(target);
        setDefaultLanguage(target);
        return {
          success: true,
          message: `Language updated to ${target.toUpperCase()}`,
          undo: () => {
            setLanguage(prev);
            setDefaultLanguage(prev);
          },
        };
      },
    },
    {
      name: 'set_voice_speed',
      description: 'Adjust the text-to-speech voice speed (reversible).',
      parameters: {
        value: {
          type: 'number',
          description: 'Speed rate (e.g. 0.8, 1.0, 1.2, 1.5).',
          required: true,
        },
      },
      isReadOnly: false,
      isReversible: true,
      confirmationPrompt: ({ value }) => `Adjust voice speed to ${value}x?`,
      handler: async ({ value }) => {
        const prev = speechRate;
        const strVal = String(value);
        setSpeechRate(strVal);
        localStorage.setItem('tfb_rate', strVal);
        return {
          success: true,
          message: `Voice speed set to ${value}x`,
          undo: () => {
            setSpeechRate(prev);
            localStorage.setItem('tfb_rate', prev);
          },
        };
      },
    },
    {
      name: 'toggle_setting',
      description: 'Toggle setting like auto_read or email_alerts.',
      parameters: {
        name: {
          type: 'string',
          description: 'Setting name (e.g. auto_read, email_alerts).',
          required: true,
        },
        value: {
          type: 'boolean',
          description: 'Enable or disable.',
          required: true,
        },
      },
      isReadOnly: false,
      isReversible: true,
      confirmationPrompt: ({ name, value }) => `${value ? 'Enable' : 'Disable'} ${name}?`,
      handler: async ({ name, value }) => {
        if (name === 'auto_read') {
          const prev = autoReadFocus;
          setAutoReadFocus(Boolean(value));
          return {
            success: true,
            message: `Auto-read ${value ? 'enabled' : 'disabled'}`,
            undo: () => setAutoReadFocus(prev),
          };
        } else if (name === 'email_alerts') {
          const prev = emailAlerts;
          setEmailAlerts(Boolean(value));
          return {
            success: true,
            message: `Email alerts ${value ? 'enabled' : 'disabled'}`,
            undo: () => setEmailAlerts(prev),
          };
        }
        return { success: true, message: `Updated ${name}` };
      },
    },
  ], [language, speechRate, autoReadFocus, emailAlerts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandaloneApp(isStandalone);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);


  useEffect(() => {
    // Load local preferences — always read the globally saved default language
    if (typeof window !== 'undefined') {
      const savedLang = getDefaultLanguage();
      setLanguage(savedLang);
      setCapability(getLanguageCapability(savedLang));
      const savedRate = localStorage.getItem('tfb_rate');
      if (savedRate) setSpeechRate(savedRate);
      const savedApproval = localStorage.getItem('tfb_approval');
      if (savedApproval !== null) setRequireApproval(savedApproval === 'true');

      // Load voices and auto-select best matching voice
      const updateVoices = () => {
        const list = getAvailableVoices();
        setBrowserVoices(list);
        const savedVoiceForLang = localStorage.getItem(`tfb_voice_${savedLang}`) || '';
        const res = getVoiceResolution(savedLang, list, savedVoiceForLang);
        if (res.selectedVoice) {
          setSelectedVoiceURI(res.selectedVoice.voiceURI);
        }
      };

      updateVoices();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setCapability(getLanguageCapability(newLang));
    // Auto-select best matching voice for the new language (Item 2)
    if (typeof window !== 'undefined') {
      const savedForLang = localStorage.getItem(`tfb_voice_${newLang}`) || '';
      const res = getVoiceResolution(newLang, browserVoices, savedForLang);
      setSelectedVoiceURI(res.selectedVoice ? res.selectedVoice.voiceURI : '');
    }
  };

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      // Save language globally — this becomes the default for all pages
      setDefaultLanguage(language);
      localStorage.setItem('tfb_rate', speechRate);
      localStorage.setItem('tfb_approval', String(requireApproval));
      if (selectedVoiceURI) {
        localStorage.setItem(`tfb_voice_${language}`, selectedVoiceURI);
      }

      // Persist to user record in DB
      fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_language: language }),
      }).catch(console.error);
    }
    setSavedSuccess(true);
    const feedback = getLocalizedMessage('saved', language);
    speakText(feedback, language);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const loadTokens = async () => {
    setTokensLoading(true);
    try {
      const res = await fetch('/api/extension/token');
      if (res.ok) {
        const data = await res.json();
        setExtensionTokens(data.tokens || []);
      }
    } catch {
      // ignore network err
    } finally {
      setTokensLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadTokens();
    }
  }, [status]);

  const handleRevokeToken = async (tokenId: string) => {
    try {
      const res = await fetch('/api/extension/token', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId }),
      });
      if (res.ok) {
        loadTokens();
      }
    } catch {
      // ignore
    }
  };

  const testVoice = () => {
    // Speak in native language with the selected voice!
    const phrase = TEST_PHRASES[language] || TEST_PHRASES['en'];
    if (typeof window !== 'undefined' && selectedVoiceURI) {
      localStorage.setItem(`tfb_voice_${language}`, selectedVoiceURI);
    }
    speakText(phrase, language);
  };

  useAppHeader({
    title: 'Settings & Preferences',
    subtitle: 'Configure multilingual voice output, voice selection, and auto-fill preferences. This language becomes your default across the entire app.',
  });

  // Requirement 2: Voice resolution - only matching voices, Hindi fallback if none
  const voiceRes = getVoiceResolution(language, browserVoices, selectedVoiceURI);
  const matchingVoices = voiceRes.matchingVoices;

  const capabilityColor =
    capability.level === 'full' ? 'var(--tfb-success-text)' :
    capability.level === 'speech_only' ? 'var(--tfb-info-text)' :
    capability.level === 'text_only' ? 'var(--tfb-warning-text)' : 'var(--tfb-danger-text)';

  return (
    <div className="settings-container animate-fadeIn">
          <div className="settings-card card">
            <div className="settings-card-header">
              <h2>Appearance</h2>
              <p className="text-sm text-muted">Choose light or dark colors, or follow your device setting.</p>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span>Color theme</span>
                <span>Your preference is saved on this device.</span>
              </div>
              <select
                className="input"
                aria-label="Color theme"
                style={{ width: '240px', fontWeight: 600 }}
                value={themePreference}
                onChange={(event) => {
                  if (isThemePreference(event.target.value)) setThemePreference(event.target.value);
                }}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          {savedSuccess && (
            <div className="card" style={{ background: '#ecfdf5', borderLeft: '4px solid var(--color-success)', padding: '12px 16px' }}>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ Preferences Saved — Default language set to {SUPPORTED_LANGUAGES.find(l => l.code === language)?.label || language}</span>
            </div>
          )}

          {/* Multilingual & Speech Section */}
          <div className="settings-card card">
            <div className="settings-card-header">
              <h2>🗣️ Language & Speech Engine</h2>
              <p className="text-sm text-muted">Choose your preferred native language. This becomes the default language for the entire app including forms, assistant, browser, and voice commands.</p>
            </div>

            {/* Language Selection */}
            <div className="settings-row">
              <div className="settings-label">
                <span>Default App & Spoken Language</span>
                <span>This language is used everywhere: speech recognition, reading, AI responses, and voice commands</span>
              </div>
              <select
                className="input"
                style={{ width: '240px', fontWeight: 600 }}
                value={language}
                onChange={e => handleLanguageChange(e.target.value)}
              >
                {SUPPORTED_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.label === l.nativeName ? l.label : `${l.label} (${l.nativeName})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Capability Indicator */}
            <div className="settings-row" style={{ paddingTop: '4px', paddingBottom: '4px' }}>
              <div className="settings-label" style={{ flex: 1 }}>
                <span>Language Capability Analysis</span>
                <span>What this language can actually do in the app</span>
              </div>
              <div style={{ width: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: capabilityColor, flexShrink: 0 }} />
                  <strong style={{ fontSize: '13px', color: capabilityColor }}>{capability.label}</strong>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
                  {capability.description}
                </p>

                {/* Voice Status in Language Capability Analysis (Item 2) */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    background: voiceRes.hasNativeVoice ? '#f0fdf4' : (voiceRes.isFallbackToHindi ? '#fffbeb' : '#fef2f2'),
                    border: `1px solid ${voiceRes.hasNativeVoice ? '#bbf7d0' : (voiceRes.isFallbackToHindi ? '#fde68a' : '#fecaca')}`,
                  }}
                >
                  <strong
                    style={{
                      fontSize: '12px',
                      display: 'block',
                      color: voiceRes.hasNativeVoice ? '#166534' : (voiceRes.isFallbackToHindi ? '#92400e' : '#991b1b'),
                    }}
                  >
                    {voiceRes.hasNativeVoice
                      ? `✓ Native Voice Active: ${voiceRes.selectedVoice?.name || 'Installed Voice'}`
                      : voiceRes.isFallbackToHindi
                      ? '⚠️ Hindi (hi-IN) Voice Fallback Active'
                      : 'ℹ️ Server Audio Engine Active'}
                  </strong>
                  {voiceRes.isFallbackToHindi && (
                    <span style={{ fontSize: '11px', color: '#b45309', display: 'block', marginTop: '2px' }}>
                      Pronunciation may differ (using Hindi voice fallback as no native voice is installed).
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: capability.tts ? '#dcfce7' : '#fee2e2', color: capability.tts ? '#166534' : '#991b1b' }}>
                    {capability.tts ? '✓' : '✗'} Text-to-Speech
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: capability.stt ? '#dcfce7' : '#fee2e2', color: capability.stt ? '#166534' : '#991b1b' }}>
                    {capability.stt ? '✓' : '✗'} Speech-to-Text
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: capability.formFill ? '#dcfce7' : '#fee2e2', color: capability.formFill ? '#166534' : '#991b1b' }}>
                    {capability.formFill ? '✓' : '✗'} Form Fill by Voice
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: capability.voiceNav ? '#dcfce7' : '#fee2e2', color: capability.voiceNav ? '#166534' : '#991b1b' }}>
                    {capability.voiceNav ? '✓' : '✗'} Voice Navigation
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: capability.translate ? '#dcfce7' : '#fee2e2', color: capability.translate ? '#166534' : '#991b1b' }}>
                    {capability.translate ? '✓' : '✗'} Native Translations
                  </span>
                </div>
              </div>
            </div>

            {/* Specific Voice Engine Selection */}
            <div className="settings-row" style={{ alignItems: 'flex-start', paddingTop: '12px' }}>
              <div className="settings-label" style={{ flex: 1, paddingRight: '16px' }}>
                <span>Installed Speech Synthesis Voice</span>
                <span>
                  Select the specific voice persona installed in your browser for this language.
                  {voiceRes.hasNativeVoice ? (
                    <strong style={{ color: 'var(--color-success)', display: 'block', marginTop: '2px' }}>
                      ✓ {matchingVoices.length} voice(s) matching {language.toUpperCase()}
                    </strong>
                  ) : voiceRes.isFallbackToHindi ? (
                    <span style={{ color: '#d97706', display: 'block', marginTop: '2px', fontWeight: 600 }}>
                      ⚠️ No native voice installed. Falling back to Hindi (hi-IN) voice.
                    </span>
                  ) : (
                    <span style={{ color: '#64748b', display: 'block', marginTop: '2px' }}>
                      ℹ️ Using authentic server audio stream for {language.toUpperCase()}
                    </span>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '280px' }}>
                {/* Voice Dropdown: only matching voices, NO "All Installed Voices" optgroup (Item 2) */}
                <select
                  className="input"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={selectedVoiceURI || voiceRes.selectedVoice?.voiceURI || ''}
                  onChange={e => {
                    setSelectedVoiceURI(e.target.value);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem(`tfb_voice_${language}`, e.target.value);
                    }
                  }}
                >
                  {matchingVoices.length === 0 ? (
                    <option value="">-- No Matching Voice Installed --</option>
                  ) : (
                    matchingVoices.map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang}){voiceRes.isFallbackToHindi ? ' [Hindi Fallback]' : ''}
                      </option>
                    ))
                  )}
                </select>

                {/* Short note that pronunciation may differ if using Hindi fallback (Item 2) */}
                {voiceRes.isFallbackToHindi && (
                  <p style={{ fontSize: '11px', color: '#b45309', margin: '2px 0 0 0', lineHeight: 1.3 }}>
                    ℹ️ Note: Pronunciation may differ (using Hindi hi-IN fallback voice as no native voice is installed).
                  </p>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={testVoice}
                  style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                >
                  🔊 Test Native Voice
                </button>
              </div>
            </div>

            {/* Reading Speed */}
            <div className="settings-row">
              <div className="settings-label">
                <span>Speech Reading Speed</span>
                <span>Adjust reading speed for form assistance and advice</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  className="input"
                  style={{ width: '140px' }}
                  value={speechRate}
                  onChange={e => setSpeechRate(e.target.value)}
                >
                  <option value="0.75">Slower (0.75x)</option>
                  <option value="0.9">Natural (0.9x)</option>
                  <option value="1.0">Normal (1.0x)</option>
                  <option value="1.15">Brisk (1.15x)</option>
                  <option value="1.3">Fast (1.3x)</option>
                </select>
              </div>
            </div>

            {/* Auto Read on Focus */}
            <div className="settings-row">
              <div className="settings-label">
                <span>Auto-Read Fields on Focus</span>
                <span>Read question aloud automatically when clicking into a form field</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoReadFocus}
                  onChange={e => setAutoReadFocus(e.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          {/* Form Automation Preferences */}
          <div className="settings-card card">
            <div className="settings-card-header">
              <h2>⚡ Form Automation & Approval</h2>
              <p className="text-sm text-muted">Control manual approval steps when auto-filling forms</p>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <span>Require Manual Approval for Voice Input</span>
                <span>Show confirmation dialog before inserting recognized voice input into form fields</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={e => setRequireApproval(e.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <span>Form Watch & Availability Notifications</span>
                <span>Send real-time alerts when monitored government or institutional forms open online</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={e => setEmailAlerts(e.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          {/* Progressive Web App (PWA) Management */}
          <div className="settings-card card">
            <div className="settings-card-header">
              <h2>📱 Progressive Web App (PWA)</h2>
              <p className="text-sm text-muted">
                Install TechForm Buddy on your Phone or Desktop for native performance, offline support, and quick access
              </p>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      {isStandaloneApp ? 'Installed App (Standalone Mode)' : 'Running in Web Browser'}
                    </strong>
                    <span
                      style={{
                        fontSize: '11px',
                        background: isStandaloneApp ? '#dcfce7' : '#e0f2fe',
                        color: isStandaloneApp ? '#16a34a' : '#0369a1',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {isStandaloneApp ? 'Active PWA' : 'Install Available'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    {isStandaloneApp
                      ? 'You are running the official standalone app with offline caching and service worker enabled.'
                      : 'You can install TechForm Buddy on your phone home screen or desktop taskbar/dock.'}
                  </p>
                </div>

                {!isStandaloneApp && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '8px 16px' }}
                    onClick={() => {
                      localStorage.removeItem('tfb_pwa_dismissed_until');
                      window.location.reload();
                    }}
                  >
                    Install App
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Connected Chrome Extensions Section */}
          <div className="settings-card card">
            <div className="settings-card-header">
              <h2>🔌 Connected Chrome Extensions</h2>
              <p className="text-sm text-muted">Manage desktop extensions authorized to analyze forms and fill your profile attributes</p>
            </div>

            <div style={{ marginTop: '16px' }}>
              {tokensLoading ? (
                <p className="text-sm text-muted">Loading connected extensions...</p>
              ) : extensionTokens.length === 0 ? (
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p className="text-sm text-muted" style={{ margin: 0 }}>
                    No Chrome extensions currently connected. Install the TechForm Buddy extension and visit{' '}
                    <Link href="/extension/connect" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                      Connect Extension
                    </Link>{' '}
                    to pair it.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {extensionTokens.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        background: t.revoked_at ? '#f8fafc' : '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        opacity: t.revoked_at ? 0.6 : 1,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>{t.name}</strong>
                          {t.revoked_at ? (
                            <span style={{ fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                              Revoked
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                              Active
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                          Scopes: {Array.isArray(t.scopes) ? t.scopes.join(', ') : t.scopes} &bull; Connected:{' '}
                          {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {!t.revoked_at && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '6px 14px', color: '#dc2626', borderColor: '#fca5a5' }}
                          onClick={() => handleRevokeToken(t.id)}
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Password & Security Section */}
          <PasswordSecurityCard userEmail={session?.user?.email || ''} />

          {/* Current Localized Sample Box */}
          <div className="card" style={{ background: '#f8fafc', padding: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>
              Current Native Spoken Test Phrase for {language.toUpperCase()}:
            </span>
            <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)', marginTop: '4px', fontSize: '14px' }}>
              &ldquo;{TEST_PHRASES[language] || TEST_PHRASES['en']}&rdquo;
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              Save Preferences
            </button>
          </div>
        </div>
  );
}
