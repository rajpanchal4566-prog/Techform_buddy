'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BuddyMascot from '@/components/BuddyMascot';
import { suggestEmailCorrection } from '@/lib/emailValidation';
import { getPasswordStrength, validatePassword } from '@/lib/auth';
import { SUPPORTED_LANGUAGES, LanguageOption } from '@/lib/languages';
import '../login/auth.css';

const STRENGTH_I18N: Record<string, Record<string, string>> = {
  en: {
    'very-weak': 'Very Weak',
    weak: 'Weak',
    fair: 'Fair',
    strong: 'Strong',
    'very-strong': 'Very Strong',
    strengthTitle: 'Password strength',
  },
  hi: {
    'very-weak': 'बहुत कमज़ोर',
    weak: 'कमज़ोर',
    fair: 'मध्यम',
    strong: 'मज़बूत',
    'very-strong': 'अति मज़बूत',
    strengthTitle: 'पासवर्ड की शक्ति',
  },
  ta: {
    'very-weak': 'மிகவும் பலவீனமானது',
    weak: 'பலவீனமானது',
    fair: 'மிதமான',
    strong: 'வலுவானது',
    'very-strong': 'மிக வலுவானது',
    strengthTitle: 'கடவுச்சொல் வலிமை',
  },
  te: {
    'very-weak': 'చాలా బలహీనమైనది',
    weak: 'బలహీనమైనది',
    fair: 'మధ్యస్థమైనది',
    strong: 'బలమైనది',
    'very-strong': 'చాలా బలమైనది',
    strengthTitle: 'పాస్‌వర్డ్ బలం',
  },
  bn: {
    'very-weak': 'খুব দুর্বল',
    weak: 'দুর্বল',
    fair: 'মাঝারি',
    strong: 'শক্তিশালী',
    'very-strong': 'অত্যন্ত শক্তিশালী',
    strengthTitle: 'পাসওয়ার্ড শক্তি',
  },
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [userLang, setUserLang] = useState('en');

  // Language dropdown
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tfb_language') || localStorage.getItem('preferred_language') || 'en';
      setUserLang(stored);
      const match = SUPPORTED_LANGUAGES.find((l) => l.code === stored);
      if (match) setSelectedLang(match);
    } catch { }
  }, []);

  // Email typo suggestion
  const emailSuggestion = useMemo(() => {
    return suggestEmailCorrection(form.email);
  }, [form.email]);

  // Live password validation
  const passwordValidation = useMemo(() => {
    return validatePassword(form.password, form.email);
  }, [form.password, form.email]);

  const passwordChecks = useMemo(() => {
    const p = form.password;
    const local = form.email.split('@')[0]?.toLowerCase();
    return {
      length: p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      lowercase: /[a-z]/.test(p),
      number: /[0-9]/.test(p),
      symbol: /[^A-Za-z0-9]/.test(p),
      noEmail: !(local && local.length >= 3 && p.toLowerCase().includes(local)),
      match: p === form.confirmPassword && form.confirmPassword.length > 0,
    };
  }, [form.password, form.confirmPassword, form.email]);

  // Live password strength
  const strength = useMemo(() => {
    return getPasswordStrength(form.password);
  }, [form.password]);

  const strengthTexts = STRENGTH_I18N[userLang] || STRENGTH_I18N.en;

  const handleGoogleSignUp = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch {
      setError('Failed to initiate Google sign in. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleApplySuggestion = () => {
    if (emailSuggestion) {
      setForm((prev) => ({ ...prev, email: emailSuggestion }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          language: userLang,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(form.email.trim())}&lang=${encodeURIComponent(userLang)}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root-wrapper">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP NAVIGATION BAR (IDENTICAL TO IMAGE 1)
          ───────────────────────────────────────────────────────────── */}
      <header className="auth-topbar">
        <div className="auth-topbar-inner">
          <Link href="/" className="auth-brand">
            <div className="auth-brand-avatar">
              <BuddyMascot size={26} state="idle" />
            </div>
            <div className="auth-brand-text">
              <span className="auth-brand-title">TechForm Buddy</span>
              <span className="auth-brand-sub">Your AI Form &amp; Service Assistant</span>
            </div>
          </Link>

          <div className="auth-topbar-right">
            <span className="auth-tagline-text">Smart • Simple • Multilingual</span>

            {/* Language Selector */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="auth-lang-pill"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                aria-expanded={isLangMenuOpen}
              >
                <span>🌐</span>
                <span>{selectedLang.nativeName}</span>
                <span style={{ fontSize: '9px', opacity: 0.8 }}>▼</span>
              </button>

              {isLangMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid #e0d4c5',
                    borderRadius: '12px',
                    boxShadow: '0 12px 30px rgba(53, 4, 7, 0.25)',
                    padding: '6px',
                    minWidth: '170px',
                    zIndex: 200,
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '8px 12px',
                        background: selectedLang.code === lang.code ? '#fbeee9' : 'transparent',
                        color: selectedLang.code === lang.code ? '#590907' : '#29211f',
                        fontWeight: selectedLang.code === lang.code ? 700 : 500,
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onClick={() => {
                        setSelectedLang(lang);
                        setUserLang(lang.code);
                        setIsLangMenuOpen(false);
                      }}
                    >
                      <span>{lang.nativeName}</span>
                      <span style={{ fontSize: '10px', color: '#a5a79b' }}>{lang.code.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO BACKDROP ARENA
          ───────────────────────────────────────────────────────────── */}
      <main className="auth-arena">
        <div className="auth-arena-overlay" />

        <div className="auth-arena-grid">
          {/* Left Column: Hero Info & Feature Pills */}
          <div className="auth-hero-info">
            <div className="auth-badge-pill">
              <span>🎓</span>
              <span>Empowering Citizens • Enabling Digital India</span>
            </div>

            <h1 className="auth-hero-heading">
              <span className="title-white">TechForm Buddy</span>
              <span className="title-white">Your Smart Companion for</span>
              <span className="title-gold">Forms, Services &amp;</span>
              <span className="title-gold">Digital Assistance</span>
            </h1>

            <p className="auth-hero-subtext">
              Powered by AI. Available in Multiple Languages.<br />
              Designed for Every Indian Citizen.
            </p>

            <div className="auth-hero-pills">
              <div className="auth-hero-pill">
                <div className="auth-pill-circle">⚡</div>
                <div className="auth-pill-text">Auto<br />Form Fill</div>
              </div>

              <div className="auth-hero-pill">
                <div className="auth-pill-circle">🔍</div>
                <div className="auth-pill-text">Smart<br />Search</div>
              </div>

              <div className="auth-hero-pill">
                <div className="auth-pill-circle">📄</div>
                <div className="auth-pill-text">Document<br />Helper</div>
              </div>

              <div className="auth-hero-pill">
                <div className="auth-pill-circle">🌐</div>
                <div className="auth-pill-text">Multilingual<br />Support</div>
              </div>
            </div>

            <div className="auth-hero-bottom-tag">
              Your Digital Assistant, Always With You
            </div>
          </div>

          {/* Right Column: Floating White Register Card */}
          <div className="auth-card-container">
            <div className="auth-card">
              <div className="auth-card-header">
                <div className="auth-card-icon-wrap">
                  <BuddyMascot size={32} state="idle" />
                </div>
                <h2 className="auth-card-title">Welcome to TechForm Buddy</h2>
                <p className="auth-card-sub">Create your citizen account to get started</p>
              </div>

              {/* Tabs: [ Login | Register (Active) ] */}
              <div className="auth-card-tabs">
                <Link href="/login" className="auth-tab-link">
                  Login
                </Link>
                <button type="button" className="auth-tab-link active">
                  Register
                </button>
              </div>

              {error && (
                <div className="auth-msg-error" role="alert">
                  <span>⚠️</span>
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Full Name */}
                <div className="auth-input-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none">
                      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zM3 18a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <input
                      id="register-name"
                      type="text"
                      className="auth-input"
                      placeholder="Your full name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="auth-input-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none">
                      <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M3 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <input
                      id="register-email"
                      type="email"
                      className="auth-input"
                      placeholder="Enter your email address"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      autoComplete="email"
                    />
                  </div>

                  {emailSuggestion && (
                    <div style={{ fontSize: '11.5px', color: '#590907', marginTop: '4px' }}>
                      💡 Did you mean{' '}
                      <button
                        type="button"
                        onClick={handleApplySuggestion}
                        style={{ background: 'none', border: 'none', color: '#590907', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {emailSuggestion}
                      </button>
                      ?
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="auth-input-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none">
                      <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 9V6a3 3 0 116 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      className="auth-input"
                      placeholder="Create a strong password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="auth-pw-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                          <path d="M3 3l14 14M8.5 8.5a2.5 2.5 0 003.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M4.5 7.5C3 9 2 10 2 10s3.5 6 8 6c1 0 1.9-.2 2.8-.6M16 13c1.5-1.5 2-3 2-3s-3.5-6-8-6c-.8 0-1.6.1-2.4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                          <path d="M2 10s3.5-6 8-6 8 6 8 6-3.5 6-8 6-8-6-8-6z" stroke="currentColor" strokeWidth="1.5" />
                          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {form.password && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', gap: '4px', height: '4px', width: '100%' }}>
                        <div style={{ flex: 1, height: '100%', borderRadius: '2px', background: strength.score >= 1 ? '#ef4444' : '#e5e7eb' }} />
                        <div style={{ flex: 1, height: '100%', borderRadius: '2px', background: strength.score >= 2 ? '#f97316' : '#e5e7eb' }} />
                        <div style={{ flex: 1, height: '100%', borderRadius: '2px', background: strength.score >= 3 ? '#eab308' : '#e5e7eb' }} />
                        <div style={{ flex: 1, height: '100%', borderRadius: '2px', background: strength.score >= 4 ? '#22c55e' : '#e5e7eb' }} />
                      </div>
                      <div style={{ fontSize: '11px', color: '#746a63', marginTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{strengthTexts.strengthTitle}:</span>
                        <strong>{strengthTexts[strength.label]}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="auth-input-group">
                  <div className="auth-input-wrapper">
                    <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none">
                      <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 9V6a3 3 0 116 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <input
                      id="register-confirm-password"
                      type="password"
                      className="auth-input"
                      placeholder="Confirm your password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {form.confirmPassword && !passwordChecks.match && (
                    <span style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '3px' }}>
                      Passwords do not match
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="auth-btn-primary"
                  disabled={loading || (form.password.length > 0 && !passwordValidation.valid)}
                >
                  {loading ? 'Creating Account...' : 'Register →'}
                </button>
              </form>

              <div className="auth-or-divider">
                <span>or</span>
              </div>

              {/* Continue with Google */}
              <button
                type="button"
                className="auth-btn-social"
                onClick={handleGoogleSignUp}
                disabled={googleLoading || loading}
              >
                <svg viewBox="0 0 18 18" fill="none">
                  <path
                    d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.9273 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
                    fill="#EA4335"
                  />
                </svg>
                <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              {/* Continue with Aadhaar */}
              <button
                type="button"
                className="auth-btn-social"
                onClick={() => {
                  setError('Aadhaar registration is supported for verified citizen identity onboarding.');
                }}
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#FFF7ED" stroke="#EA580C" strokeWidth="1.2" />
                  <path d="M12 4v4M12 16v4M4 12h4M16 12h4" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3" fill="#EA580C" />
                  <path d="M8 8l2 2M14 14l2 2M16 8l-2 2M10 14l-2 2" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span>Continue with Aadhaar</span>
              </button>

              <div className="auth-secure-footer">
                <svg className="auth-secure-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM13.707 8.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Secure &amp; Trusted Platform</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
