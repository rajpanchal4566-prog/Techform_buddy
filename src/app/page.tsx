'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { SUPPORTED_LANGUAGES, LanguageOption } from '@/lib/languages';
import BuddyMascot from '@/components/BuddyMascot';
import './landing.css';

export default function LandingPage() {
  const { data: session, status } = useSession();

  // Language Dropdown state
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);

  // Auth Card state
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Register Form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [aadhaarLoading, setAadhaarLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Submit Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!loginEmail || !loginPassword) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (result?.error) {
        setError(
          result.error === 'CredentialsSignin'
            ? 'Invalid email or password.'
            : result.error
        );
        setLoading(false);
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  // 2. Submit Register Handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!registerName || !registerEmail || !registerPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName.trim(),
          email: registerEmail.trim(),
          password: registerPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
      } else {
        setSuccessMsg('Account created successfully! Signing in...');
        const loginRes = await signIn('credentials', {
          redirect: false,
          email: registerEmail.trim(),
          password: registerPassword,
        });

        if (!loginRes?.error) {
          window.location.href = '/dashboard';
        } else {
          setActiveTab('login');
          setLoginEmail(registerEmail);
          setLoading(false);
        }
      }
    } catch {
      setError('An error occurred during registration. Please try again.');
      setLoading(false);
    }
  };

  // 3. Google OAuth Handler
  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch {
      setError('Failed to initiate Google sign in. Please try again.');
      setGoogleLoading(false);
    }
  };

  // 4. Aadhaar Sandbox Gateway Handler
  const handleAadhaarClick = () => {
    setAadhaarLoading(true);
    setTimeout(() => {
      setError('Aadhaar OTP gateway is currently initializing in sandbox mode. Please sign in with email or Google.');
      setAadhaarLoading(false);
    }, 600);
  };

  return (
    <div className="landing-page-root">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION BAR (DEEP BURGUNDY · MATCHING SCREENSHOT)
          ───────────────────────────────────────────────────────────── */}
      <header className="lp-navbar">
        <div className="lp-nav-container">
          {/* Brand Logo & Name */}
          <Link href="/" className="lp-brand-link">
            <div className="lp-brand-circle">
              <BuddyMascot size={26} state="idle" />
            </div>
            <div className="lp-brand-title">
              <span>TechForm Buddy</span>
              <span className="lp-brand-subtitle">Your AI Form &amp; Service Assistant</span>
            </div>
          </Link>

          {/* Right Actions: Tagline & Language Selector */}
          <div className="lp-nav-actions">
            <span className="lp-nav-tagline">Smart • Simple • Multilingual</span>

            {/* Language Selector */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="lp-lang-btn"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                aria-expanded={isLangMenuOpen}
                aria-label="Select Language"
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
          2. IMMERSIVE HERO SECTION WITH VIKRANT UNIVERSITY BACKDROP
             TWO-COLUMN SPLIT: HERO CONTENT (LEFT) + AUTH CARD (RIGHT)
          ───────────────────────────────────────────────────────────── */}
      <section id="hero" className="lp-hero-section">
        <div className="lp-hero-overlay" />
        <div className="lp-hero-glow-1" />
        <div className="lp-hero-glow-2" />

        <div className="lp-hero-layout">
          {/* ─────────────────────────────────────────────────────────
              LEFT COLUMN — BRANDING, HEADLINE, 4 PILLS, DIVIDER
              ───────────────────────────────────────────────────────── */}
          <div className="lp-hero-left">
            {/* Top Pill Badge */}
            <div className="lp-badge-pill">
              <span>🎓</span>
              <span>Empowering Citizens • Enabling Digital India</span>
            </div>

            {/* Main 4-Line Heading */}
            <h1 className="lp-hero-heading">
              <span className="lp-title-white">TechForm Buddy</span>
              <span className="lp-title-white">Your Smart Companion for</span>
              <span className="lp-title-orange">Forms, Services &amp;</span>
              <span className="lp-title-orange">Digital Assistance</span>
            </h1>

            {/* Subtitle */}
            <p className="lp-hero-subtext">
              Powered by AI. Available in Multiple Languages.<br />
              Designed for Every Indian Citizen.
            </p>

            {/* 4 Feature Pills in a Row */}
            <div className="lp-hero-pills">
              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">⚡</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">Auto</span>
                  <span className="lp-pill-sub">Form Fill</span>
                </div>
              </div>

              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">🔍</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">Smart</span>
                  <span className="lp-pill-sub">Search</span>
                </div>
              </div>

              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">📄</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">Document</span>
                  <span className="lp-pill-sub">Helper</span>
                </div>
              </div>

              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">🌐</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">Multilingual</span>
                  <span className="lp-pill-sub">Support</span>
                </div>
              </div>
            </div>

            {/* Divider with Italic Text */}
            <div className="lp-hero-quote">
              <span className="lp-divider-line" />
              <span className="lp-divider-text">Your Digital Assistant, Always With You</span>
              <span className="lp-divider-line" />
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              RIGHT COLUMN — FLOATING AUTH CARD
              ───────────────────────────────────────────────────────── */}
          <div className="lp-hero-right">
            <div className="lp-auth-card">
              {/* Card Header */}
              <div className="lp-card-header">
                <div className="lp-card-mascot-box">
                  <BuddyMascot size={36} state="idle" />
                </div>
                <div className="lp-card-header-titles">
                  <span className="lp-card-welcome">Welcome to</span>
                  <span className="lp-card-brand-name">TechForm Buddy</span>
                </div>
              </div>

              {status === 'authenticated' && session?.user ? (
                <div className="lp-card-auth-state">
                  <p className="lp-card-subtitle" style={{ margin: '14px 0 16px' }}>
                    Signed in as <strong>{session.user.name || session.user.email}</strong>
                  </p>
                  <Link href="/dashboard" className="lp-card-submit-btn" style={{ textDecoration: 'none' }}>
                    Go to Dashboard →
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="lp-social-btn"
                    style={{ marginTop: '10px' }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <p className="lp-card-subtitle">
                    {activeTab === 'login'
                      ? 'Sign in to continue your journey'
                      : 'Register to start your digital journey'}
                  </p>

                  {/* Mode Tabs: [ Login ] [ Register ] */}
                  <div className="lp-card-tabs">
                    <button
                      type="button"
                      className={`lp-card-tab ${activeTab === 'login' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('login');
                        setError('');
                        setSuccessMsg('');
                      }}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={`lp-card-tab ${activeTab === 'register' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('register');
                        setError('');
                        setSuccessMsg('');
                      }}
                    >
                      Register
                    </button>
                  </div>

                  {error && (
                    <div className="lp-card-error">
                      <span>⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="lp-card-success">
                      <span>✓</span>
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {activeTab === 'login' ? (
                    <form onSubmit={handleLoginSubmit}>
                      {/* Email Input */}
                      <div className="lp-input-group">
                        <span className="lp-input-icon">✉</span>
                        <input
                          type="email"
                          className="lp-input"
                          placeholder="Enter your email address"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                          autoComplete="email"
                        />
                      </div>

                      {/* Password Input */}
                      <div className="lp-input-group">
                        <span className="lp-input-icon">🔒</span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="lp-input"
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                          style={{ paddingRight: '38px' }}
                        />
                        <button
                          type="button"
                          className="lp-eye-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? '🙈' : '👁'}
                        </button>
                      </div>

                      {/* Remember Me & Forgot Password */}
                      <div className="lp-card-helper-row">
                        <label className="lp-remember-label">
                          <input
                            type="checkbox"
                            className="lp-remember-checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                          />
                          Remember me
                        </label>
                        <Link href="/login" className="lp-forgot-link">
                          Forgot password?
                        </Link>
                      </div>

                      {/* Login Button */}
                      <button type="submit" className="lp-card-submit-btn" disabled={loading}>
                        {loading ? 'Signing in...' : 'Login →'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleRegisterSubmit}>
                      {/* Name Input */}
                      <div className="lp-input-group">
                        <span className="lp-input-icon">👤</span>
                        <input
                          type="text"
                          className="lp-input"
                          placeholder="Enter your full name"
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          required
                        />
                      </div>

                      {/* Email Input */}
                      <div className="lp-input-group">
                        <span className="lp-input-icon">✉</span>
                        <input
                          type="email"
                          className="lp-input"
                          placeholder="Enter your email address"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          required
                        />
                      </div>

                      {/* Password Input */}
                      <div className="lp-input-group">
                        <span className="lp-input-icon">🔒</span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="lp-input"
                          placeholder="Create a strong password"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                          style={{ paddingRight: '38px' }}
                        />
                        <button
                          type="button"
                          className="lp-eye-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? '🙈' : '👁'}
                        </button>
                      </div>

                      {/* Confirm Password */}
                      <div className="lp-input-group">
                        <span className="lp-input-icon">🔒</span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="lp-input"
                          placeholder="Confirm your password"
                          value={registerConfirmPassword}
                          onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                          required
                        />
                      </div>

                      {/* Register Button */}
                      <button type="submit" className="lp-card-submit-btn" disabled={loading}>
                        {loading ? 'Creating account...' : 'Register Account →'}
                      </button>
                    </form>
                  )}

                  {/* Divider: or */}
                  <div className="lp-card-divider">
                    <span className="lp-card-divider-line" />
                    <span>or</span>
                    <span className="lp-card-divider-line" />
                  </div>

                  {/* Continue with Google */}
                  <button
                    type="button"
                    className="lp-social-btn"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || loading}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
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
                    {googleLoading ? 'Connecting...' : 'Continue with Google'}
                  </button>

                  {/* Continue with Aadhaar */}
                  <button
                    type="button"
                    className="lp-social-btn"
                    onClick={handleAadhaarClick}
                    disabled={aadhaarLoading || loading}
                  >
                    <svg width="22" height="18" viewBox="0 0 36 28" fill="none">
                      <path d="M18 4a10 10 0 0 1 10 10" stroke="#f37021" strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M18 7a7 7 0 0 1 7 7" stroke="#e1251b" strokeWidth="2" strokeLinecap="round" />
                      <path d="M18 10a4 4 0 0 1 4 4" stroke="#f37021" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="18" cy="14" r="1.5" fill="#e1251b" />
                      <path d="M18 1v1.5M25 3l-1 1.2M31 8l-1.5.8M33 14h-1.5M7 3l1 1.2M1 8l1.5.8M3 14h1.5" stroke="#f37021" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M10 22h16c1.5 0 2.5-1 2.5-2.5V17" stroke="#e1251b" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    {aadhaarLoading ? 'Connecting Gateway...' : 'Continue with Aadhaar'}
                  </button>

                  {/* Trust Badge */}
                  <div className="lp-card-trust-badge">
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" fill="#2e7d32" opacity="0.15" />
                      <path d="M10 2l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M7 10.5l2 2 4-4" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
          3. COMPREHENSIVE FEATURES SECTION (BURGUNDY & CREAM THEME)
          ───────────────────────────────────────────────────────────── */}
      <section id="features" className="lp-features-section">
        <div className="lp-section-header">
          <span className="lp-section-eyebrow">Enterprise Capabilities</span>
          <h2 className="lp-section-title">Everything You Need for Seamless Citizen Services</h2>
          <p className="lp-section-desc">
            A unified AI platform bringing together browser intelligence, voice guidance, and verified
            security for students, farmers, job seekers, and all Indian citizens.
          </p>
        </div>

        <div className="lp-grid-cards">
          {/* Feature 1 */}
          <div className="lp-feature-card">
            <div className="lp-card-icon-wrap">⚡</div>
            <h3 className="lp-card-heading">AI Form Detection &amp; Autofill</h3>
            <p className="lp-card-body">
              Our intelligent companion analyzes dynamic web forms, parses requirements, and fills
              verified details with zero manual repetition.
            </p>
            <div className="lp-card-tag">99.4% Field Accuracy</div>
          </div>

          {/* Feature 2 */}
          <div className="lp-feature-card">
            <div className="lp-card-icon-wrap">🌐</div>
            <h3 className="lp-card-heading">Multilingual Voice Commander</h3>
            <p className="lp-card-body">
              Speak naturally in Hindi, Hinglish, English, Tamil, Telugu, Bengali, and more. Buddy listens,
              understands citizen intent, and guides you step-by-step.
            </p>
            <div className="lp-card-tag">Bilingual &amp; Vernacular</div>
          </div>

          {/* Feature 3 */}
          <div className="lp-feature-card">
            <div className="lp-card-icon-wrap">📑</div>
            <h3 className="lp-card-heading">Document Understanding &amp; OCR</h3>
            <p className="lp-card-body">
              Upload marksheets, caste certificates, income affidavits, or government circulars. Receive
              plain-language summaries and automatic eligibility checks.
            </p>
            <div className="lp-card-tag">Instant PDF Parsing</div>
          </div>

          {/* Feature 4 */}
          <div className="lp-feature-card">
            <div className="lp-card-icon-wrap">🧭</div>
            <h3 className="lp-card-heading">Autonomous Browser Companion</h3>
            <p className="lp-card-body">
              Executes complex multi-step browser tasks: portal search, guideline navigation, PDF download
              verification, and state persistence across page redirects.
            </p>
            <div className="lp-card-tag">Continuous Agent Loop</div>
          </div>

          {/* Feature 5 */}
          <div className="lp-feature-card">
            <div className="lp-card-icon-wrap">🔔</div>
            <h3 className="lp-card-heading">Application Tracker &amp; Alerts</h3>
            <p className="lp-card-body">
              Never miss a scholarship deadline, recruitment cutoff, or certificate verification date with
              real-time notifications and tracking dashboard.
            </p>
            <div className="lp-card-tag">Live Push Notifications</div>
          </div>

          {/* Feature 6 */}
          <div className="lp-feature-card">
            <div className="lp-card-icon-wrap">⚖️</div>
            <h3 className="lp-card-heading">Grievance Redressal Assistant</h3>
            <p className="lp-card-body">
              File formal grievances across public departments with AI-assisted drafting, department
              classification, and live resolution tracking.
            </p>
            <div className="lp-card-tag">Public Service SLA</div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. ABOUT & DIGITAL MISSION SECTION
          ───────────────────────────────────────────────────────────── */}
      <section id="about" className="lp-about-section">
        <div className="lp-about-container">
          <div className="lp-about-copy">
            <span className="lp-section-eyebrow">Digital Governance Mission</span>
            <h2>Bridging the Distance Between Citizens &amp; Public Services</h2>
            <p>
              Navigating government portals and institutional procedures can be confusing and time-consuming.
              TechForm Buddy is engineered to make digital services as natural as having an expert companion
              by your side.
            </p>
            <p>
              Collaborating with academic institutions like <strong>Vikrant University</strong>, we combine
              ethical AI models, privacy-preserving client sandboxes, and multilingual speech to ensure
              every citizen can access benefits without hurdles.
            </p>
            <Link href="/login" className="lp-cta-primary" style={{ display: 'inline-flex' }}>
              Join TechForm Buddy Today →
            </Link>
          </div>

          <div className="lp-about-stats">
            <div className="lp-stat-box">
              <div className="lp-stat-num">500+</div>
              <div className="lp-stat-label">Government &amp; Exam Portals Supported</div>
            </div>
            <div className="lp-stat-box">
              <div className="lp-stat-num">10+</div>
              <div className="lp-stat-label">Indian Regional Languages</div>
            </div>
            <div className="lp-stat-box">
              <div className="lp-stat-num">100%</div>
              <div className="lp-stat-label">Encrypted &amp; Citizen-Owned Data</div>
            </div>
            <div className="lp-stat-box">
              <div className="lp-stat-num">0s</div>
              <div className="lp-stat-label">Form Redundancy &amp; Repetition</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. FOOTER
          ───────────────────────────────────────────────────────────── */}
      <footer id="contact" className="lp-footer">
        <div className="lp-footer-container">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BuddyMascot size={32} state="idle" />
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>TechForm Buddy</span>
            </div>
            <p className="lp-footer-brand-p">
              Intelligent digital assistance for forms, certificates, scholarships, and citizen services across India.
            </p>
          </div>

          <div className="lp-footer-col">
            <h4>Platform</h4>
            <ul>
              <li><a href="#hero">Home</a></li>
              <li><a href="#features">Features</a></li>
              <li><Link href="/login">Citizen Login</Link></li>
              <li><Link href="/register">Register Account</Link></li>
            </ul>
          </div>

          <div className="lp-footer-col">
            <h4>Services</h4>
            <ul>
              <li><Link href="/forms">Form Detection</Link></li>
              <li><Link href="/documents">Document OCR</Link></li>
              <li><Link href="/grievances">Grievances</Link></li>
              <li><Link href="/status">System Health</Link></li>
            </ul>
          </div>

          <div className="lp-footer-col">
            <h4>Institutional</h4>
            <ul>
              <li><span>Vikrant University Campus</span></li>
              <li><span>Digital India Initiative</span></li>
              <li><span>Citizen Support 24/7</span></li>
              <li><span>256-bit AES Privacy</span></li>
            </ul>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <div>© {new Date().getFullYear()} TechForm Buddy. All rights reserved. Developed for Digital India.</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Security Compliance</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
