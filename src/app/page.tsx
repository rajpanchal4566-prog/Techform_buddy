'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { SUPPORTED_LANGUAGES, LanguageOption } from '@/lib/languages';
import BuddyMascot from '@/components/BuddyMascot';
import './landing.css';

export default function LandingPage() {
  const { data: session, status } = useSession();

  // Language Dropdown state
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);

  return (
    <div className="landing-page-root">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION BAR (DEEP BURGUNDY)
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

          {/* Desktop Navigation Links */}
          <nav className="lp-nav-links" aria-label="Main Navigation">
            <a href="#hero" className="lp-nav-link active">Home</a>
            <a href="#features" className="lp-nav-link">Features</a>
            <a href="#about" className="lp-nav-link">About</a>
            <a href="#contact" className="lp-nav-link">Contact</a>
          </nav>

          {/* Right Actions: Language Selector & Login */}
          <div className="lp-nav-actions">
            {/* Language Selector Dropdown */}
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

            {/* Login or Dashboard Button */}
            {status === 'authenticated' && session?.user ? (
              <Link href="/dashboard" className="lp-login-nav-btn">
                Dashboard →
              </Link>
            ) : (
              <Link href="/login" className="lp-login-nav-btn">
                Citizen Login →
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. IMMERSIVE HERO SECTION
          ───────────────────────────────────────────────────────────── */}
      <section id="hero" className="lp-hero-section">
        <div className="lp-hero-overlay" />

        <div className="lp-hero-layout">
          {/* ─────────────────────────────────────────────────────────
              LEFT COLUMN — HERO PROSE, 5 PILLS & CTA BUTTONS
              ───────────────────────────────────────────────────────── */}
          <div className="lp-hero-left">
            {/* Top Pill Badge */}
            <div className="lp-badge-pill">
              <span>🎓</span>
              <span>Empowering Citizens • Enabling Digital India</span>
            </div>

            {/* Main Hero Heading */}
            <h1 className="lp-hero-heading">
              <span className="lp-title-white">TechForm Buddy</span>
              <span className="lp-title-white">Your Smart Companion for</span>
              <span className="lp-title-gold">Forms, Services &amp;</span>
              <span className="lp-title-gold">Digital Assistance</span>
            </h1>

            {/* Subtitle */}
            <p className="lp-hero-subtext">
              Simplifying government forms, digital services and documentation through AI-powered assistance.
            </p>

            {/* 5 Feature Pills in a Row */}
            <div className="lp-hero-pills">
              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">⚡</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">AI-Powered</span>
                  <span className="lp-pill-sub">Form Filling</span>
                </div>
              </div>

              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">🔍</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">Smart</span>
                  <span className="lp-pill-sub">Portal Search</span>
                </div>
              </div>

              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">📄</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">Document</span>
                  <span className="lp-pill-sub">Assistance</span>
                </div>
              </div>

              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">🎙️</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">Multilingual</span>
                  <span className="lp-pill-sub">Voice Support</span>
                </div>
              </div>

              <div className="lp-hero-pill">
                <div className="lp-pill-icon-circle">👥</div>
                <div className="lp-pill-text-wrap">
                  <span className="lp-pill-title">Personal</span>
                  <span className="lp-pill-sub">Digital Assistant</span>
                </div>
              </div>
            </div>

            {/* Hero CTAs */}
            <div className="lp-hero-ctas">
              <Link href="/login" className="lp-cta-primary">
                Get Started →
              </Link>
              <a href="#features" className="lp-cta-secondary">
                Explore Features
              </a>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              RIGHT COLUMN — LIVE ASSISTANT SHOWCASE & METRICS
              ───────────────────────────────────────────────────────── */}
          <div className="lp-hero-right">
            <div className="lp-hero-showcase-card">
              <div className="lp-showcase-header">
                <div className="lp-showcase-avatar">
                  <BuddyMascot size={36} state="idle" />
                </div>
                <div>
                  <div className="lp-showcase-badge">
                    <span className="lp-pulse-dot" />
                    <span>AI Co-Pilot • Ready</span>
                  </div>
                  <h3 className="lp-showcase-title">National Digital Assistant</h3>
                </div>
              </div>

              <div className="lp-showcase-form-preview">
                <div className="lp-preview-row">
                  <span className="lp-preview-label">Active Portal</span>
                  <span className="lp-preview-value">National Scholarship Portal (NSP)</span>
                </div>
                <div className="lp-preview-row">
                  <span className="lp-preview-label">Field Autofill</span>
                  <span className="lp-preview-tag">Verified 99.4% ✓</span>
                </div>
                <div className="lp-preview-row">
                  <span className="lp-preview-label">Citizen Privacy</span>
                  <span className="lp-preview-tag-sec">256-Bit Encrypted 🔒</span>
                </div>
              </div>

              <div className="lp-showcase-stats-grid">
                <div className="lp-showcase-stat">
                  <span className="lp-mini-stat-num">500+</span>
                  <span className="lp-mini-stat-lbl">Portals</span>
                </div>
                <div className="lp-showcase-stat">
                  <span className="lp-mini-stat-num">10+</span>
                  <span className="lp-mini-stat-lbl">Languages</span>
                </div>
                <div className="lp-showcase-stat">
                  <span className="lp-mini-stat-num">100%</span>
                  <span className="lp-mini-stat-lbl">Citizen Privacy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. COMPREHENSIVE FEATURES SECTION
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
            <div className="lp-card-icon-wrap">🎯</div>
            <h3 className="lp-card-heading">Personalized Scheme Recommendations</h3>
            <p className="lp-card-body">
              Deterministic statutory eligibility evaluation matching your verified profile attributes to
              central and state schemes without repetitive paperwork.
            </p>
            <div className="lp-card-tag">Zero Hallucination</div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. ABOUT & NATIONAL COLLABORATION SECTION
          ───────────────────────────────────────────────────────────── */}
      <section id="about" className="lp-about-section">
        <div className="lp-about-container">
          <div className="lp-about-copy">
            <span className="lp-section-eyebrow">Digital Governance Initiative</span>
            <h2>Bridging the Distance Between Citizens &amp; Public Services</h2>
            <p>
              Navigating government portals and institutional procedures can be confusing and time-consuming.
              TechForm Buddy is engineered to make digital services as natural as having an expert companion
              by your side.
            </p>

            {/* National Initiative Highlight */}
            <div className="lp-university-partner-highlight">
              <div className="lp-highlight-hindi">डिजिटल भारत सशक्त नागरिक</div>
              <div className="lp-highlight-english">DIGITAL INDIA CITIZEN EMPOWERMENT</div>
              <p className="lp-highlight-desc">
                Engineered in full alignment with the <strong>Digital India</strong> vision, TechForm Buddy develops
                ethical AI models, privacy-preserving client sandboxes, and multilingual voice tools designed to empower
                students, farmers, job seekers, and citizens across every state.
              </p>
            </div>

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
              <li><Link href="/applications">My Applications</Link></li>
              <li><Link href="/form-watch">Form Watch</Link></li>
            </ul>
          </div>

          <div className="lp-footer-col">
            <h4>Initiatives</h4>
            <ul>
              <li><span>Digital India Initiative</span></li>
              <li><span>National Citizen Portal</span></li>
              <li><span>Multilingual Voice AI</span></li>
              <li><span>256-bit AES Privacy</span></li>
            </ul>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <div>© {new Date().getFullYear()} TechForm Buddy. National Digital Services &amp; Citizen Assistance Platform.</div>
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
