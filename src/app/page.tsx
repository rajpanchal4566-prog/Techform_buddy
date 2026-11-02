'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signIn, useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SUPPORTED_LANGUAGES, LanguageOption } from '@/lib/languages';
import './landing.css';

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Authentication Tab: 'login' | 'register'
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Language Dropdown
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: email.trim(),
        password,
      });

      if (res?.error) {
        setErrorMsg(
          res.error === 'CredentialsSignin'
            ? 'Invalid email or password. Please try again.'
            : res.error
        );
        setLoading(false);
      } else {
        setSuccessMsg('Signed in successfully! Redirecting...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 300);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  // Handle Registration Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg('Please fill in your name, email address, and password.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Account created successfully! Logging you in...');
      const loginRes = await signIn('credentials', {
        redirect: false,
        email: email.trim(),
        password,
      });

      if (loginRes?.error) {
        window.location.href = '/login';
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch {
      setErrorMsg('Google sign in initiation failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="landing-page-wrapper">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP NAVIGATION HEADER
          ───────────────────────────────────────────────────────────── */}
      <header className="top-header-bar">
        <div className="top-header-inner">
          <Link href="/" className="brand-section">
            {/* Mascot Robot Icon in white circular badge */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                flexShrink: 0,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                <rect x="6" y="9" width="20" height="15" rx="5" fill="#4a0e17" />
                <circle cx="16" cy="4" r="2" fill="#4a0e17" />
                <line x1="16" y1="5.5" x2="16" y2="9" stroke="#4a0e17" strokeWidth="2" strokeLinecap="round" />
                <rect x="3" y="13" width="3" height="7" rx="1.5" fill="#4a0e17" />
                <rect x="26" y="13" width="3" height="7" rx="1.5" fill="#4a0e17" />
                <rect x="9" y="12" width="14" height="6" rx="2" fill="#ffffff" />
                <circle cx="12" cy="15" r="1.5" fill="#4a0e17" />
                <circle cx="20" cy="15" r="1.5" fill="#4a0e17" />
                <rect x="13.5" y="20.5" width="5" height="1.5" rx="0.75" fill="#ffffff" />
              </svg>
            </div>

            <div className="brand-text-col">
              <span className="brand-title-text">TechForm Buddy</span>
              <span className="brand-subtitle-text">Your AI Form &amp; Service Assistant</span>
            </div>
          </Link>

          <div className="header-right-actions">
            <span className="header-tagline-text">Smart • Simple • Multilingual</span>

            {/* Language Selector Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="lang-selector-btn"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                aria-expanded={isLangMenuOpen}
                aria-label="Select Language"
              >
                <span>🌐</span>
                <span>{selectedLang.nativeName}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>

              {isLangMenuOpen && (
                <div className="lang-dropdown-menu">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      className={`lang-dropdown-item ${selectedLang.code === lang.code ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedLang(lang);
                        setIsLangMenuOpen(false);
                      }}
                    >
                      <span>{lang.nativeName}</span>
                      <span style={{ fontSize: '10px', opacity: 0.6 }}>{lang.code.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION — VIKRANT UNIVERSITY CAMPUS BACKDROP
          ───────────────────────────────────────────────────────────── */}
      <section className="hero-university-section">
        {/* Dark Maroon / Vignette Overlay */}
        <div className="hero-backdrop-overlay" />

        <div className="hero-main-container">
          {/* Left Column: Headline, Subtitle, Feature Badges & Tagline */}
          <div className="hero-left-column">
            {/* Pill Badge */}
            <div className="hero-badge-pill">
              <span>🎓</span>
              <span>Empowering Citizens • Enabling Digital India</span>
            </div>

            {/* Main Headline */}
            <h1 className="hero-main-headline">
              TechForm Buddy<br />
              Your Smart Companion for<br />
              <span className="hero-headline-gold">Forms, Services &amp;<br />Digital Assistance</span>
            </h1>

            {/* Subtitle */}
            <p className="hero-description-text">
              Powered by AI. Available in Multiple Languages.<br />
              Designed for Every Indian Citizen.
            </p>

            {/* 4 Feature Pills Row */}
            <div className="feature-pills-row">
              <div className="feature-pill-card">
                <div className="feature-pill-icon">⚡</div>
                <div className="feature-pill-label">Auto<br />Form Fill</div>
              </div>

              <div className="feature-pill-card">
                <div className="feature-pill-icon">🔍</div>
                <div className="feature-pill-label">Smart<br />Search</div>
              </div>

              <div className="feature-pill-card">
                <div className="feature-pill-icon">📄</div>
                <div className="feature-pill-label">Document<br />Helper</div>
              </div>

              <div className="feature-pill-card">
                <div className="feature-pill-icon">🌐</div>
                <div className="feature-pill-label">Multilingual<br />Support</div>
              </div>
            </div>

            {/* Tagline Divider */}
            <div className="hero-tagline-divider">
              <div className="tagline-line" />
              <span className="tagline-text">Your Digital Assistant, Always With You</span>
              <div className="tagline-line right" />
            </div>
          </div>

          {/* Right Column: Floating White Authentication Card */}
          <div className="hero-right-column">
            <div className="auth-floating-card">
              {/* Authenticated State */}
              {status === 'authenticated' && session?.user ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: '#fdf2f4',
                      border: '2px solid #fecdd3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px auto',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>👋</span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--maroon-darkest)', margin: '0 0 6px 0' }}>
                    Welcome back, {session.user.name || 'Citizen'}!
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px 0' }}>
                    You are signed in to TechForm Buddy.
                  </p>
                  <Link
                    href="/dashboard"
                    className="auth-submit-btn"
                    style={{ textDecoration: 'none', marginBottom: '10px' }}
                  >
                    Go to Dashboard →
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--maroon-primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  {/* Card Header with Robot Mascot */}
                  <div className="card-header-block">
                    <div className="card-header-robot">
                      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                        <rect x="6" y="9" width="20" height="15" rx="5" fill="#4a0e17" />
                        <circle cx="16" cy="4" r="2" fill="#4a0e17" />
                        <line x1="16" y1="5.5" x2="16" y2="9" stroke="#4a0e17" strokeWidth="2" strokeLinecap="round" />
                        <rect x="3" y="13" width="3" height="7" rx="1.5" fill="#4a0e17" />
                        <rect x="26" y="13" width="3" height="7" rx="1.5" fill="#4a0e17" />
                        <rect x="9" y="12" width="14" height="6" rx="2" fill="#ffffff" />
                        <circle cx="12" cy="15" r="1.5" fill="#4a0e17" />
                        <circle cx="20" cy="15" r="1.5" fill="#4a0e17" />
                        <rect x="13.5" y="20.5" width="5" height="1.5" rx="0.75" fill="#ffffff" />
                      </svg>
                    </div>

                    <div>
                      <div className="card-title-text">Welcome to<br />TechForm Buddy</div>
                      <div className="card-subtitle-text">
                        {authTab === 'login' ? 'Sign in to continue your journey' : 'Create an account in 30 seconds'}
                      </div>
                    </div>
                  </div>

                  {/* Segmented Tabs: [ Login ] | [ Register ] */}
                  <div className="auth-tabs-toggle">
                    <button
                      type="button"
                      className={`auth-tab-btn ${authTab === 'login' ? 'active' : ''}`}
                      onClick={() => {
                        setAuthTab('login');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={`auth-tab-btn ${authTab === 'register' ? 'active' : ''}`}
                      onClick={() => {
                        setAuthTab('register');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                    >
                      Register
                    </button>
                  </div>

                  {/* Feedback Banners */}
                  {errorMsg && <div className="auth-card-error">⚠️ {errorMsg}</div>}
                  {successMsg && <div className="auth-card-success">✓ {successMsg}</div>}

                  {/* LOGIN FORM */}
                  {authTab === 'login' && (
                    <form onSubmit={handleLogin} className="auth-form-body">
                      {/* Email input with Mail Icon */}
                      <div className="auth-input-wrapper">
                        <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        <input
                          type="email"
                          className="auth-text-field"
                          placeholder="Enter your email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>

                      {/* Password input with Lock Icon and Eye Toggle */}
                      <div className="auth-input-wrapper">
                        <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="auth-text-field"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="auth-password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Options Row: Remember Me & Forgot Password */}
                      <div className="auth-options-row">
                        <label className="remember-checkbox-label">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                          />
                          <span>Remember me</span>
                        </label>

                        <Link href="/login" className="forgot-password-link">
                          Forgot password?
                        </Link>
                      </div>

                      {/* Primary Submit Button */}
                      <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? 'Signing in...' : 'Login →'}
                      </button>
                    </form>
                  )}

                  {/* REGISTER FORM */}
                  {authTab === 'register' && (
                    <form onSubmit={handleRegister} className="auth-form-body">
                      {/* Name input */}
                      <div className="auth-input-wrapper">
                        <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <input
                          type="text"
                          className="auth-text-field"
                          placeholder="Enter your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>

                      {/* Email input */}
                      <div className="auth-input-wrapper">
                        <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        <input
                          type="email"
                          className="auth-text-field"
                          placeholder="Enter your email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>

                      {/* Password input */}
                      <div className="auth-input-wrapper">
                        <svg className="auth-input-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="auth-text-field"
                          placeholder="Create a strong password (min 8 chars)"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="auth-password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Primary Register Button */}
                      <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Register →'}
                      </button>
                    </form>
                  )}

                  {/* Divider "or" */}
                  <div className="auth-or-divider">
                    <div className="divider-line" />
                    <span className="divider-text">or</span>
                    <div className="divider-line" />
                  </div>

                  {/* Social Buttons: Google & Aadhaar */}
                  <div className="auth-social-buttons">
                    <button
                      type="button"
                      className="auth-social-btn"
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading || loading}
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62z" fill="#4285F4"/>
                        <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z" fill="#34A853"/>
                        <path d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.6.1-1.18.29-1.71V4.96H.96A8.99 8.99 0 000 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" fill="#FBBC05"/>
                        <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>

                    <button
                      type="button"
                      className="auth-social-btn"
                      onClick={() => {
                        window.location.href = '/login';
                      }}
                    >
                      <svg width="22" height="18" viewBox="0 0 28 22" fill="none">
                        <circle cx="14" cy="9" r="6" fill="#f97316" />
                        <path d="M14 1v3M7 4l2 2M21 4l-2 2M4 9h3M21 9h3" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M11 11a3 3 0 016 0c0 4-3 6-3 8" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M8.5 13a5.5 5.5 0 0111 0c0 4-2.5 6-2.5 8" stroke="#ea580c" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      <span>Continue with Aadhaar</span>
                    </button>
                  </div>

                  {/* Footer Security Badge */}
                  <div className="auth-footer-badge">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    <span>Secure &amp; Trusted Platform</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. COMPREHENSIVE FEATURES & CITIZEN CAPABILITIES
          ───────────────────────────────────────────────────────────── */}
      <section className="features-section-maroon">
        <div className="section-container">
          <div className="section-heading-block">
            <span className="section-badge-maroon">Citizen Services &amp; AI Power</span>
            <h2 className="section-title-maroon">Everything You Need for Public Digital Services</h2>
            <p className="section-subtitle-maroon">
              From college scholarships to civil grievance redressal, TechForm Buddy bridges the digital divide for every citizen.
            </p>
          </div>

          <div className="features-grid-maroon">
            <div className="feature-box-maroon">
              <div className="feature-box-icon">⚡</div>
              <h3 className="feature-box-title">Autonomous Form Autofill</h3>
              <p className="feature-box-desc">
                Fill forms across government, university, and public portals safely. You retain full control with zero automatic submissions.
              </p>
            </div>

            <div className="feature-box-maroon">
              <div className="feature-box-icon">🎙️</div>
              <h3 className="feature-box-title">Multilingual Voice Commands</h3>
              <p className="feature-box-desc">
                Speak naturally in Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, or English.
              </p>
            </div>

            <div className="feature-box-maroon">
              <div className="feature-box-icon">📄</div>
              <h3 className="feature-box-title">AI Document Understanding</h3>
              <p className="feature-box-desc">
                Upload Aadhaar, PAN, marksheets, and income certificates. Our vision engine securely verifies and structures data locally.
              </p>
            </div>

            <div className="feature-box-maroon">
              <div className="feature-box-icon">🏛️</div>
              <h3 className="feature-box-title">Grievance &amp; Scheme Tracking</h3>
              <p className="feature-box-desc">
                File grievances directly to administrative departments, calculate scheme eligibility, and track application stages live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. FOOTER
          ───────────────────────────────────────────────────────────── */}
      <footer className="landing-footer-maroon">
        <div className="footer-inner-content">
          <div className="brand-section">
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <rect x="6" y="9" width="20" height="15" rx="5" fill="#4a0e17" />
                <circle cx="16" cy="4" r="2" fill="#4a0e17" />
                <rect x="9" y="12" width="14" height="6" rx="2" fill="#ffffff" />
                <circle cx="12" cy="15" r="1.5" fill="#4a0e17" />
                <circle cx="20" cy="15" r="1.5" fill="#4a0e17" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>TechForm Buddy</div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)' }}>Digital India • Citizen AI Platform</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
            <Link href="/login" style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}>Sign In</Link>
            <Link href="/register" style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}>Register</Link>
            <Link href="/status" style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none' }}>System Status</Link>
          </div>
        </div>

        <div className="footer-copy-text">
          © {new Date().getFullYear()} TechForm Buddy. All rights reserved. Designed for Indian Citizens.
        </div>
      </footer>
    </div>
  );
}
