import Link from 'next/link';
import './landing.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TechForm Buddy — Multilingual AI Form Assistant',
  description: 'Fill forms using voice commands in your native language. Upload documents for auto-fill, search and track forms online.',
};

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-nav container">
          <div className="landing-brand">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#3b82f6"/>
              <path d="M8 12h16M8 16h12M8 20h14M22 10l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>TechForm Buddy</span>
          </div>
          <div className="landing-actions">
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/register" className="btn btn-primary">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <span className="hero-badge">Multilingual AI-Powered</span>
            <h1>Fill forms in <em>your</em> language</h1>
            <p>
              TechForm Buddy helps you fill forms using voice commands in your native language.
              Upload your documents once, and auto-fill any form instantly.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="btn btn-primary btn-lg">
                Start Free
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
              <Link href="/login" className="btn btn-secondary btn-lg">Sign in</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="container">
          <div className="features-header">
            <h2>Everything you need</h2>
            <p>Powerful features to simplify form filling across languages</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </div>
              <h3>Voice Input</h3>
              <p>Speak in your native language. The app understands and fills forms for you.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              </div>
              <h3>17+ Languages</h3>
              <p>Support for Hindi, Tamil, Telugu, Bengali, and many more Indian and global languages.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <h3>Document Upload</h3>
              <p>Upload your ID and documents once. We extract and store info for instant auto-fill.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <h3>Smart Auto-fill</h3>
              <p>Your profile data automatically fills matching form fields. Leave blanks when no data is available.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <h3>Form Watch</h3>
              <p>Tell us what form you need. We&apos;ll find it online and notify you when it&apos;s available.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="9"/></svg>
              </div>
              <h3>In-App Browser & Commands</h3>
              <p>Open form links directly in the app. Auto-fill with profile and submit by voice or app commands.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
              </div>
              <h3>Real-Time Reading (Audio)</h3>
              <p>Listen to forms read aloud in your native language. Hear questions and spoken answers clearly.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z"/><path d="M10 10h4"/></svg>
              </div>
              <h3>Domain Automation Hub</h3>
              <p>Instant guidance, document checklists, and grievance tracking across Government, Healthcare, Banking, and Education.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to simplify form filling?</h2>
            <p>Create your free account and start filling forms in your language today.</p>
            <Link href="/register" className="btn btn-primary btn-lg">
              Get Started Free
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="landing-brand">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#3b82f6"/>
                <path d="M8 12h16M8 16h12M8 20h14M22 10l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>TechForm Buddy</span>
            </div>
            <p className="text-xs text-muted">Multilingual AI Form Assistant</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
