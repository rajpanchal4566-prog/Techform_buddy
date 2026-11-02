'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import { getDefaultLanguage, setDefaultLanguage, SUPPORTED_LANGUAGES } from '@/lib/speech';
import './browser.css';

interface PortalTile {
  label: string;
  url: string;
  category: string;
  description: string;
  isOfficial: boolean;
}

interface SearchResult {
  title: string;
  url: string;
  host: string;
  description: string;
  isOfficialDomain: boolean;
}

const POPULAR_PORTALS: { category: string; portals: PortalTile[] }[] = [
  {
    category: 'Government & Identity',
    portals: [
      {
        label: 'Passport Seva',
        url: 'https://www.passportindia.gov.in',
        category: 'Identity',
        description: 'Ministry of External Affairs — Fresh passports, Tatkaal reissue, and police verification.',
        isOfficial: true,
      },
      {
        label: 'UIDAI MyAadhaar',
        url: 'https://myaadhaar.uidai.gov.in',
        category: 'Identity',
        description: 'Unique Identification Authority of India — Aadhaar downloads, address updates, PVC orders.',
        isOfficial: true,
      },
      {
        label: 'National Voter Service (ECI)',
        url: 'https://voters.eci.gov.in',
        category: 'Elections',
        description: 'Election Commission of India — Form 6 new voter registration, EPIC download, corrections.',
        isOfficial: true,
      },
      {
        label: 'DigiLocker',
        url: 'https://www.digilocker.gov.in',
        category: 'Documents',
        description: 'MeitY document repository — Issued digital certificates and verified identity cards.',
        isOfficial: true,
      },
    ],
  },
  {
    category: 'Transport & Licences',
    portals: [
      {
        label: 'Parivahan Sarathi (Driving Licence)',
        url: 'https://parivahan.gov.in',
        category: 'Transport',
        description: 'Ministry of Road Transport — Driving licence, Learner licence, and vehicle registration.',
        isOfficial: true,
      },
      {
        label: 'e-District State Services',
        url: 'https://edistrict.gov.in',
        category: 'Revenue',
        description: 'State citizen service gateway for caste, income, domicile certificates, and revenue inquiries.',
        isOfficial: true,
      },
    ],
  },
  {
    category: 'Tax & Social Security',
    portals: [
      {
        label: 'Income Tax e-Filing (PAN & ITR)',
        url: 'https://www.incometax.gov.in',
        category: 'Taxation',
        description: 'Income Tax Department — Instant paperless e-PAN via Aadhaar e-KYC and annual ITR filing.',
        isOfficial: true,
      },
      {
        label: 'EPFO Member Unified Portal',
        url: 'https://unifiedportal-mem.epfindia.gov.in',
        category: 'Finance',
        description: 'Employees Provident Fund — Online PF claims, advance withdrawal, and UAN activation.',
        isOfficial: true,
      },
      {
        label: 'PM Kisan Samman Nidhi',
        url: 'https://pmkisan.gov.in',
        category: 'Welfare',
        description: 'Department of Agriculture — Farmer beneficiary registration, eKYC, and installment status.',
        isOfficial: true,
      },
    ],
  },
  {
    category: 'Health & Education',
    portals: [
      {
        label: 'National Scholarship Portal',
        url: 'https://scholarships.gov.in',
        category: 'Education',
        description: 'Central and State scholarship schemes for school, college, and university students.',
        isOfficial: true,
      },
      {
        label: 'Ayushman Bharat PM-JAY',
        url: 'https://beneficiary.nha.gov.in',
        category: 'Health',
        description: 'National Health Authority — PMJAY Ayushman card registration and health benefits.',
        isOfficial: true,
      },
    ],
  },
];

export default function BrowserPortalLauncherPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Extension status detection via dataset.tfbExtension
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState('');
  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [connectingExt, setConnectingExt] = useState(false);

  // Language state & sync
  const [selectedLang, setSelectedLang] = useState<string>('en');

  // "Open with Buddy" Guide Flow Modal
  const [guideModal, setGuideModal] = useState<{ open: boolean; portalName: string; portalUrl: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Initialize language from saved preferences
  useEffect(() => {
    const saved = getDefaultLanguage();
    if (saved) {
      setSelectedLang(saved);
      if (typeof window !== 'undefined') {
        window.postMessage({ type: 'TFB_SET_LANGUAGE', language: saved }, '*');
      }
    }
  }, []);

  const handleLanguageChange = (lang: string) => {
    setSelectedLang(lang);
    setDefaultLanguage(lang);
    if (typeof window !== 'undefined') {
      window.postMessage({ type: 'TFB_SET_LANGUAGE', language: lang }, '*');
    }
  };

  // Extension detection
  useEffect(() => {
    const detectExtension = () => {
      if (typeof document !== 'undefined') {
        const extVer = document.documentElement.dataset.tfbExtension;
        if (extVer) {
          setExtensionInstalled(true);
          setExtensionVersion(extVer);
        } else {
          setExtensionInstalled(false);
          setExtensionVersion('');
        }
      }
      // Check if connected token exists in localStorage or document
      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('tfb_ext_connected');
        if (storedToken) {
          setIsExtensionConnected(true);
        }
      }
    };

    detectExtension();
    const interval = setInterval(detectExtension, 800);

    const onExtReady = (e: any) => {
      const ver = e.detail?.version || '1.0.0';
      setExtensionInstalled(true);
      setExtensionVersion(ver);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'TFB_EXTENSION_READY') {
        setExtensionInstalled(true);
        setExtensionVersion(e.data.version || '1.0.0');
      }
    };
    window.addEventListener('tfb-extension-ready', onExtReady);
    window.addEventListener('message', onMessage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tfb-extension-ready', onExtReady);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  // Quick connect button action for installed extension
  const handleConnectExtension = async () => {
    setConnectingExt(true);
    try {
      const res = await fetch('/api/extension/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Portal Launcher Quick Connect' }),
      });
      if (res.ok) {
        const data = await res.json();
        // Dispatch window message for content script
        window.postMessage(
          {
            type: 'TFB_CONNECT_TOKEN',
            token: data.token,
            appUrl: window.location.origin,
          },
          '*'
        );
        localStorage.setItem('tfb_ext_connected', 'true');
        setIsExtensionConnected(true);
      } else {
        router.push('/extension/connect');
      }
    } catch {
      router.push('/extension/connect');
    } finally {
      setConnectingExt(false);
    }
  };

  // Perform search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/portal-search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      } else {
        setSearchError('Failed to fetch portal results. Please try again.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Network error while searching portals');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError('');
  };

  // "Open with Buddy" flow: opens in new tab and triggers 3-step guide in our app
  const handleOpenWithBuddy = (url: string, name: string) => {
    // Forward selected language, portal URL & task to extension content script
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tfb_active_task', name);
      } catch {}
      window.postMessage({ type: 'TFB_OPEN_WITH_BUDDY', language: selectedLang, url, taskName: name }, '*');
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    // Show 3-step guide in our app
    setGuideModal({
      open: true,
      portalName: name,
      portalUrl: url,
    });
  };

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading Portal Launcher...</p>
      </div>
    );
  }

  useAppHeader({
    title: 'Official Portal Launcher',
    subtitle: 'Find, verify, and launch real government and citizen service portals. Open portals securely in new tabs with TechForm Buddy assistance.',
  });

  return (
    <div>
      {/* MANDATORY SAFETY COPY BANNER */}
        <div
          id="safety-copy-banner"
          style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: '10px',
            padding: '14px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#065f46' }}>
                Buddy fills the form on the real website. You review and press Submit yourself.
              </div>
              <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                We never ask for or store your portal passwords or OTPs. All submissions are made by you directly on the official department website.
              </div>
            </div>
          </div>

        </div>

        {/* EXTENSION DETECTION & STATUS CARD */}
        <div
          id="extension-status-card"
          style={{
            background: extensionInstalled ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${extensionInstalled ? '#86efac' : '#fde68a'}`,
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '28px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{extensionInstalled ? '🔌' : '⚠️'}</span>
                <span style={{ fontWeight: 700, fontSize: '14px', color: extensionInstalled ? '#166534' : '#92400e' }}>
                  {extensionInstalled
                    ? `TechForm Buddy Extension Detected (v${extensionVersion})`
                    : 'TechForm Buddy Extension Not Installed'}
                </span>
                {extensionInstalled && (
                  <span
                    style={{
                      background: isExtensionConnected ? '#22c55e' : '#f59e0b',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {isExtensionConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                )}
              </div>

              {!extensionInstalled ? (
                <div style={{ fontSize: '13px', color: '#78350f', marginTop: '8px', lineHeight: 1.6 }}>
                  <p style={{ fontWeight: 600, marginBottom: '4px' }}>
                    Install the extension to enable automatic form-filling on official websites:
                  </p>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    <li>Open <code>chrome://extensions</code> (or <code>edge://extensions</code>) in your browser.</li>
                    <li>Turn on <strong>Developer mode</strong> (toggle at top right).</li>
                    <li>Click <strong>Load unpacked</strong> and select the <code>packages/extension</code> directory.</li>
                  </ol>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#15803d', marginTop: '6px' }}>
                  {isExtensionConnected
                    ? 'Extension is connected to your account. Launch any portal below and click the Buddy toolbar icon.'
                    : 'Extension is detected. Click Connect to authorize secure communication with your profile.'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Language:</span>
                <select
                  id="browser-language-select"
                  value={selectedLang}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'white',
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label === l.nativeName ? l.label : `${l.label} (${l.nativeName})`}
                    </option>
                  ))}
                </select>
              </div>

              {!extensionInstalled ? (
                <Link href="/extension/connect" className="btn btn-sm btn-primary">
                  Connect Extension Page →
                </Link>
              ) : !isExtensionConnected ? (
                <button
                  id="connect-ext-btn"
                  className="btn btn-sm btn-primary"
                  onClick={handleConnectExtension}
                  disabled={connectingExt}
                >
                  {connectingExt ? 'Connecting...' : 'Connect'}
                </button>
              ) : (
                <Link href="/extension/connect" className="btn btn-sm btn-secondary">
                  Manage Extension ⚙️
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* SEARCH BOX (Gemini Search Grounding / Adapter) */}
        <section style={{ marginBottom: '32px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                id="portal-search-input"
                type="text"
                className="input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search official portals (e.g., Passport Seva, Parivahan DL, Bihar e-District, PAN, Ration Card...)"
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 42px',
                  fontSize: '14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--color-border)',
                }}
              />
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#94a3b8' }}>
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              id="portal-search-submit-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isSearching}
              style={{ padding: '0 24px', fontWeight: 600, borderRadius: '10px' }}
            >
              {isSearching ? 'Searching...' : 'Find Portal'}
            </button>
          </form>

          {searchError && (
            <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '6px' }}>{searchError}</div>
          )}

          {/* SEARCH RESULTS VIEW */}
          {searchResults !== null && (
            <div
              id="search-results-container"
              style={{
                marginTop: '20px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700 }}>
                  Search Results for &ldquo;{searchQuery}&rdquo; ({searchResults.length})
                </h2>
                <button className="btn btn-ghost btn-sm" onClick={handleClearSearch}>
                  Clear Results
                </button>
              </div>

              {searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-secondary)' }}>
                  <p style={{ fontSize: '15px' }}>No portals found for this query.</p>
                  <p style={{ fontSize: '13px', marginTop: '6px' }}>Try searching by scheme name, document type, or department name.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="portal-search-result-card"
                      style={{
                        padding: '16px',
                        background: 'var(--color-background)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                            {result.title}
                          </h3>
                          {/* BADGE CRITERIA: .gov.in or .nic.in vs all others */}
                          {result.isOfficialDomain ? (
                            <span
                              className="domain-badge domain-badge-official"
                              style={{
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              🛡️ Official-looking domain
                            </span>
                          ) : (
                            <span
                              className="domain-badge domain-badge-warning"
                              style={{
                                background: '#fffbeb',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              ⚠️ Check this is the official site before entering any details.
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '4px', fontFamily: 'monospace' }}>
                          {result.host}
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                          {result.description}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          className="btn btn-sm btn-primary open-with-buddy-btn"
                          onClick={() => handleOpenWithBuddy(result.url, result.title)}
                          style={{ fontWeight: 600 }}
                        >
                          🚀 Open with Buddy
                        </button>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-secondary"
                        >
                          Visit Site ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* POPULAR PORTALS TILES */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Popular Government & Citizen Portals</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                All portals open directly in new tabs with your browser security active.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {POPULAR_PORTALS.map(categoryGroup => (
              <div key={categoryGroup.category}>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-text-muted)',
                    marginBottom: '14px',
                  }}
                >
                  {categoryGroup.category}
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {categoryGroup.portals.map(portal => (
                    <div
                      key={portal.url}
                      className="card portal-tile-card"
                      style={{
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: 'var(--color-primary)',
                              background: '#eff6ff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {portal.category}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#059669',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            🛡️ Official
                          </span>
                        </div>

                        <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                          {portal.label}
                        </h4>

                        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
                          {portal.description}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                        <button
                          className="btn btn-sm btn-primary open-with-buddy-btn"
                          onClick={() => handleOpenWithBuddy(portal.url, portal.label)}
                          style={{ flex: 1, fontWeight: 600, fontSize: '12px' }}
                        >
                          🚀 Open with Buddy
                        </button>
                        <a
                          href={portal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-secondary"
                          title="Open website in a new tab"
                          style={{ fontSize: '12px' }}
                        >
                          Visit ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* "OPEN WITH BUDDY" 3-STEP GUIDE MODAL */}
        {guideModal?.open && (
          <div
            id="open-with-buddy-modal"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                maxWidth: '540px',
                width: '100%',
                padding: '32px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                  }}
                >
                  🚀
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    Opening {guideModal.portalName}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>
                    Follow these 3 quick steps on the opened tab:
                  </p>
                </div>
              </div>

              {/* 3-Step Guide */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '24px 0' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      color: 'white',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                      Log in to the portal yourself
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Enter your official login credentials directly on the department portal. TechForm Buddy never handles or asks for portal passwords or OTPs.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      color: 'white',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                      Click the Buddy icon in the toolbar
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Once you navigate to the application form page, click the TechForm Buddy extension icon in your browser toolbar.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      color: 'white',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                      Press &ldquo;Start on this page&rdquo;
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Buddy will analyze the fields and automatically map your verified profile details into the real form.
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety notice in modal */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: '#475569',
                  marginBottom: '20px',
                }}
              >
                🔒 <strong>Zero Credential Retention:</strong> You review all entered fields and submit the form yourself.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <a
                  href={guideModal.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  Re-open Tab ↗
                </a>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setGuideModal(null)}
                >
                  Got It!
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
