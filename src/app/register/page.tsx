'use client';

import { useState, useMemo, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../login/auth.css';
import BuddyMascot from '@/components/BuddyMascot';
import { suggestEmailCorrection } from '@/lib/emailValidation';
import { getPasswordStrength, validatePassword } from '@/lib/auth';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [userLang, setUserLang] = useState('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tfb_language') || localStorage.getItem('preferred_language') || 'en';
      setUserLang(stored);
    } catch { }
  }, []);

  // Email typo suggestion (e.g. user@gmial.com -> user@gmail.com)
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

      // Requirement 2: Account is marked unverified; route to verification page
      router.push(`/verify-email?email=${encodeURIComponent(form.email.trim())}&lang=${encodeURIComponent(userLang)}`);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <BuddyMascot size={54} state="idle" />
          </div>
          <h1>Create your Citizen Account</h1>
          <p>Get started with TechForm Buddy intelligent digital assistance</p>
        </div>

        {/* Mode Tabs: [ Login ] [ Register ] */}
        <div className="auth-mode-tabs">
          <Link href="/login" className="auth-mode-tab">
            Login
          </Link>
          <button type="button" className="auth-mode-tab active">
            Register
          </button>
        </div>

        <div className="auth-form">
          {/* Requirement 1: Continue with Google on Signup page */}
          <button
            type="button"
            className="btn-google"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || loading}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853" />
              <path d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05" />
              <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.9273 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z" fill="#EA4335" />
            </svg>
            {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
          </button>

          <div className="auth-divider">
            <span>or create with email</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} action="javascript:void(0);" method="POST">
            {error && (
              <div className="auth-error animate-fadeIn">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            <div className="input-group">
              <label className="input-label" htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                type="text"
                className="input"
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="register-email">Email</label>
              <div className="input-with-icon">
                <svg className="input-icon" viewBox="0 0 18 18" fill="none">
                  <path d="M3 5l6 4 6-4M3 13h12V5H3v8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  id="register-email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>

              {/* Requirement 2: Live typo suggestions */}
              {emailSuggestion && (
                <div className="email-typo-suggestion">
                  <span>💡 Did you mean</span>
                  <button type="button" onClick={handleApplySuggestion}>
                    {emailSuggestion}
                  </button>
                  <span>?</span>
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="register-password">Password</label>
              <div className="input-with-icon">
                <svg className="input-icon" viewBox="0 0 18 18" fill="none">
                  <rect x="4" y="8" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6 8V6a3 3 0 116 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  id="register-password"
                  type="password"
                  className="input"
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="new-password"
                />
              </div>

              {/* Requirement 3: Live strength meter */}
              {form.password && (
                <div className="password-strength-container">
                  <div className="strength-bar-track">
                    <div className={`strength-bar-segment ${strength.score >= 1 ? `active-${strength.label}` : ''}`} />
                    <div className={`strength-bar-segment ${strength.score >= 2 ? `active-${strength.label}` : ''}`} />
                    <div className={`strength-bar-segment ${strength.score >= 3 ? `active-${strength.label}` : ''}`} />
                    <div className={`strength-bar-segment ${strength.score >= 4 ? `active-${strength.label}` : ''}`} />
                  </div>
                  <div className="strength-label-row">
                    <span>{strengthTexts.strengthTitle}:</span>
                    <span className={`strength-label-value ${strength.label}`}>
                      {strengthTexts[strength.label]}
                    </span>
                  </div>
                </div>
              )}

              {/* Requirement 3: Clear rules */}
              {form.password && (
                <div className="password-requirements" style={{ marginTop: '8px' }}>
                  <span className={`requirement ${passwordChecks.length ? 'met' : ''}`}>
                    <svg viewBox="0 0 14 14" fill="none">
                      {passwordChecks.length ? (
                        <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <circle cx="7" cy="7" r="3" fill="currentColor" opacity="0.3" />
                      )}
                    </svg>
                    At least 8 characters
                  </span>
                  <span className={`requirement ${passwordChecks.uppercase ? 'met' : ''}`}>
                    <svg viewBox="0 0 14 14" fill="none">
                      {passwordChecks.uppercase ? (
                        <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <circle cx="7" cy="7" r="3" fill="currentColor" opacity="0.3" />
                      )}
                    </svg>
                    One uppercase letter (A-Z)
                  </span>
                  <span className={`requirement ${passwordChecks.lowercase ? 'met' : ''}`}>
                    <svg viewBox="0 0 14 14" fill="none">
                      {passwordChecks.lowercase ? (
                        <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <circle cx="7" cy="7" r="3" fill="currentColor" opacity="0.3" />
                      )}
                    </svg>
                    One lowercase letter (a-z)
                  </span>
                  <span className={`requirement ${passwordChecks.number ? 'met' : ''}`}>
                    <svg viewBox="0 0 14 14" fill="none">
                      {passwordChecks.number ? (
                        <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <circle cx="7" cy="7" r="3" fill="currentColor" opacity="0.3" />
                      )}
                    </svg>
                    One number (0-9)
                  </span>
                  <span className={`requirement ${passwordChecks.symbol ? 'met' : ''}`}>
                    <svg viewBox="0 0 14 14" fill="none">
                      {passwordChecks.symbol ? (
                        <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <circle cx="7" cy="7" r="3" fill="currentColor" opacity="0.3" />
                      )}
                    </svg>
                    One symbol (!@#$%^&* etc.)
                  </span>
                  {form.email && (
                    <span className={`requirement ${passwordChecks.noEmail ? 'met' : ''}`}>
                      <svg viewBox="0 0 14 14" fill="none">
                        {passwordChecks.noEmail ? (
                          <path d="M3 7l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        ) : (
                          <circle cx="7" cy="7" r="3" fill="currentColor" opacity="0.3" />
                        )}
                      </svg>
                      Does not contain email name
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="register-confirm">Confirm password</label>
              <input
                id="register-confirm"
                type="password"
                className="input"
                placeholder="Confirm your password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
                autoComplete="new-password"
              />
              {form.confirmPassword && !passwordChecks.match && (
                <span className="error-text">Passwords do not match</span>
              )}
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || (form.password.length > 0 && !passwordValidation.valid)}
            >
              {loading ? (
                <span className="btn-loading">
                  <svg className="spinner" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Citizen Account →'
              )}
            </button>

            <div className="auth-trust-badge">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.464 9.99 1.579 2.065 3.48 3.018 4.096 3.263a.5.5 0 0 0 .398 0c.616-.245 2.517-1.198 4.096-3.263 1.677-2.195 3.06-5.513 2.464-9.99a1.54 1.54 0 0 0-1.044-1.263 62.7 62.7 0 0 0-2.887-.87C9.843.266 8.69 0 8 0zm2.146 5.854a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 9.043l3.146-3.189z" />
              </svg>
              <span>Protected with 256-bit encryption • Citizen Security</span>
            </div>
          </form>
        </div>

        <div className="auth-footer">
          <p>Already have an account? <Link href="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
