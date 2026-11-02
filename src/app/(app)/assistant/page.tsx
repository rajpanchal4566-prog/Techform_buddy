'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import { SUPPORTED_LANGUAGES, speakText, stopSpeaking, getLocalizedMessage, getDefaultLanguage, isReadAloudCommand } from '@/lib/speech';
import './assistant.css';

interface AssistantResult {
  found: boolean;
  data: {
    id: string;
    domain: string;
    title: string;
    summary: string;
    steps: string[];
    documentsNeeded: string[];
    formCategory: string;
    formFields: { label: string; type: string; required: boolean }[];
    portalUrl: string;
    processingTime?: string;
    officialDepartment?: string;
  };
  aiAdvice: string;
}

interface GrievanceItem {
  id: string;
  tracking_number: string;
  title: string;
  domain: string;
  department: string;
  description: string;
  status: string;
  created_at: string;
}

export default function AssistantPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'assistant' | 'grievances'>('assistant');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [generatingForm, setGeneratingForm] = useState(false);
  const [isReadingAdvice, setIsReadingAdvice] = useState(false);

  // Grievance states
  const [grievances, setGrievances] = useState<GrievanceItem[]>([]);
  const [grvTitle, setGrvTitle] = useState('');
  const [grvDomain, setGrvDomain] = useState('government');
  const [grvDept, setGrvDept] = useState('');
  const [grvDesc, setGrvDesc] = useState('');
  const [filingGrv, setFilingGrv] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Load default language from settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = getDefaultLanguage();
      setLanguage(savedLang);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchGrievances();
    }
    return () => {
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, [status]);

  const fetchGrievances = async () => {
    try {
      const res = await fetch('/api/grievances');
      if (res.ok) setGrievances(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (customQuery?: string) => {
    const q = customQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    stopSpeaking();

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          domain: selectedDomain,
          language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (e) {
      console.error('Assistant error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Text to Speech for the Assistant response
  const readAdviceAloud = () => {
    if (!result) return;
    if (isReadingAdvice) {
      stopSpeaking();
      setIsReadingAdvice(false);
      return;
    }
    const textToSpeak = `${result.data.title}. ${result.data.summary}. Key steps: ${result.data.steps.slice(0, 3).join('. ')}. Required documents: ${result.data.documentsNeeded.join(', ')}.`;
    setIsReadingAdvice(true);
    speakText(
      textToSpeak,
      language,
      () => setIsReadingAdvice(true),
      () => setIsReadingAdvice(false)
    );
  };

  // Create form directly in TechForm Buddy with pre-filled fields & profile data
  const createFormFromAdvice = async () => {
    if (!result) return;
    setGeneratingForm(true);

    try {
      // 1. Fetch user profile to pre-fill
      let profileData: Record<string, string> = {};
      const profRes = await fetch('/api/profile');
      if (profRes.ok) {
        const prof = await profRes.json();
        profileData = {
          'Full Name': prof.full_name || '',
          'Applicant Given Name': prof.full_name || '',
          'Applicant Full Name': prof.full_name || '',
          'Full Name as per Aadhaar': prof.full_name || '',
          'Beneficiary Full Name': prof.full_name || '',
          'Student Full Name': prof.full_name || '',
          'Owner Full Name': prof.full_name || '',
          'Email Address': prof.email || '',
          'Email ID': prof.email || '',
          'Mobile Number': prof.phone || '',
          'Date of Birth': prof.date_of_birth || '',
          'Gender': prof.gender || '',
          'Present Residential Address': prof.address || '',
          'Plant / Office Address': prof.address || '',
        };
      }

      const filledMap: Record<string, string> = {};
      result.data.formFields.forEach(f => {
        if (profileData[f.label]) {
          filledMap[f.label] = profileData[f.label];
        }
      });

      // 2. Create the form in the database
      const createRes = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.data.title,
          category: result.data.formCategory,
          language,
          fields: result.data.formFields.map((f, i) => ({ id: String(i + 1), label: f.label, type: f.type, required: f.required })),
          filledData: filledMap,
          status: 'draft',
        }),
      });

      if (createRes.ok) {
        const created = await createRes.json();
        speakText(getLocalizedMessage('autofilled', language), language);
        router.push(`/forms/${created.id}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate form');
    } finally {
      setGeneratingForm(false);
    }
  };

  // Voice Input for Query
  const startVoiceQuery = () => {
    stopSpeaking();
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === language);
    recognition.lang = langObj ? langObj.bcp47 : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const spokenText = event.results[0][0].transcript.trim();
      if (isReadAloudCommand(spokenText)) {
        setIsListening(false);
        if (result) {
          readAdviceAloud();
        } else {
          const promptMsg = language === 'hi'
            ? 'कृपया पहले कोई सेवा खोजें या सवाल पूछें, फिर मैं उसे पढ़कर सुनाऊंगा।'
            : 'Please search for a service or ask a question first, and I will read it aloud.';
          speakText(promptMsg, language);
        }
        return;
      }
      setQuery(spokenText);
      handleSearch(spokenText);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Submit Grievance
  const handleFileGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grvTitle || !grvDesc) return;
    setFilingGrv(true);

    try {
      const res = await fetch('/api/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: grvTitle,
          domain: grvDomain,
          department: grvDept,
          description: grvDesc,
          language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Service Request Submitted! Tracking ID: ${data.trackingNumber}`);
        setGrvTitle('');
        setGrvDept('');
        setGrvDesc('');
        fetchGrievances();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFilingGrv(false);
    }
  };

  const domainList = [
    { id: 'all', label: 'All Domains', icon: '🌐' },
    { id: 'government', label: 'Government', icon: '🏛️' },
    { id: 'education', label: 'Education', icon: '🎓' },
    { id: 'healthcare', label: 'Healthcare', icon: '🏥' },
    { id: 'banking', label: 'Banking & Loans', icon: '🏦' },
    { id: 'business', label: 'Business & MSME', icon: '💼' },
    { id: 'grievance', label: 'Grievance / Dispute', icon: '⚖️' },
  ];

  const quickSuggestions = [
    'How to apply for new Passport?',
    'Instant e-PAN Card using Aadhaar',
    'Ayushman Bharat 5 Lakh Health Card',
    'Mudra Loan Shishu & Tarun application',
    'National Scholarship Portal eligibility',
    'MSME Udyam Zero Fee registration',
    'File Consumer Court Complaint for refund',
  ];

  useAppHeader({
    title: 'Multilingual AI Assistance & Automation Hub',
    subtitle: 'Get process guidance, document checklists, instant form generation, and track service requests across domains',
    actions: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Language:</span>
        <select
          className="input"
          style={{ padding: '6px 12px', fontSize: '13px' }}
          value={language}
          onChange={e => {
            setLanguage(e.target.value);
            stopSpeaking();
          }}
        >
          {SUPPORTED_LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>
              {l.label === l.nativeName ? l.label : `${l.label} (${l.nativeName})`}
            </option>
          ))}
        </select>
      </div>
    ),
  });

  return (
    <div className="assistant-container animate-fadeIn">
          {/* Main Navigation Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'assistant' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('assistant')}
            >
              🤖 AI Assistance & Guidance
            </button>
            <button
              className={`tab ${activeTab === 'grievances' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('grievances')}
            >
              ⚖️ Grievances & Service Tracking ({grievances.length})
            </button>
          </div>

          {activeTab === 'assistant' ? (
            <>
              {/* Domain Filter Pills */}
              <div className="domain-pills">
                {domainList.map(d => (
                  <button
                    key={d.id}
                    className={`domain-pill ${selectedDomain === d.id ? 'domain-pill-active' : ''}`}
                    onClick={() => setSelectedDomain(d.id)}
                  >
                    <span>{d.icon}</span>
                    <span>{d.label}</span>
                  </button>
                ))}
              </div>

              {/* Multilingual Voice & Text Query Box */}
              <div className="assistant-search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" style={{ color: 'var(--color-text-tertiary)' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>

                <input
                  className="assistant-input"
                  placeholder="Ask any question in your native language (e.g. How to get Passport, Ayushman Card eligibility)..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                />

                <button
                  className={`btn btn-icon ${isListening ? 'btn-danger' : 'btn-ghost'}`}
                  onClick={startVoiceQuery}
                  title="Speak query in your native language"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                  </svg>
                </button>

                <button className="btn btn-primary btn-sm" onClick={() => handleSearch()} disabled={loading}>
                  {loading ? 'Analyzing...' : 'Ask AI'}
                </button>
              </div>

              {/* Sample Queries */}
              <div className="prompt-suggestions">
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
                  Popular Inquiries:
                </span>
                {quickSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    className="suggestion-chip"
                    onClick={() => {
                      setQuery(item);
                      handleSearch(item);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {/* AI Guidance & Service Automation Result */}
              {result && (
                <div className="assistant-result-card card animate-slideUp">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                          {result.data.domain}
                        </span>
                        {result.data.officialDepartment && (
                          <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            🏛️ {result.data.officialDepartment}
                          </span>
                        )}
                        {result.data.processingTime && (
                          <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#166534', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                            ⏱️ {result.data.processingTime}
                          </span>
                        )}
                      </div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 6px 0', color: 'var(--color-text-primary)' }}>
                        {result.data.title}
                      </h2>
                      <p className="text-muted" style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                        {result.data.summary}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className={`btn ${isReadingAdvice ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                        onClick={readAdviceAloud}
                        title={isReadingAdvice ? 'Stop reading aloud' : 'Read guidance aloud'}
                      >
                        {isReadingAdvice ? '⏹ Stop Reading' : '🔊 Read Aloud'}
                      </button>
                    </div>
                  </div>

                  {/* AI Advice Callout */}
                  {result.aiAdvice && (
                    <div style={{ background: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: '10px 14px', borderRadius: '0 8px 8px 0', fontSize: '13px', color: '#1e40af' }}>
                      <strong>💡 AI Advisory:</strong> {result.aiAdvice}
                    </div>
                  )}

                  {/* Step-by-Step Guidance */}
                  <div style={{ background: '#f8fafc', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📋 Official Step-by-Step Procedure</span>
                    </h3>
                    <ol className="steps-list" style={{ paddingLeft: '20px', margin: 0 }}>
                      {result.data.steps.map((st, i) => (
                        <li key={i} style={{ fontSize: '13px', color: '#334155', marginBottom: '8px', lineHeight: 1.5 }}>
                          {st}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Required Documents Checklist */}
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📎 Mandatory Documents Checklist</span>
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {result.data.documentsNeeded.map((doc, i) => (
                        <span key={i} className="doc-tag" style={{ background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                          ✓ {doc}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Pre-Mapped Form Fields Preview */}
                  {result.data.formFields && result.data.formFields.length > 0 && (
                    <div style={{ background: '#faf5ff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #f3e8ff' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px 0' }}>
                        📝 Pre-Mapped Application Fields ({result.data.formFields.length} Fields Ready for Auto-Fill)
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {result.data.formFields.map((f, idx) => (
                          <span key={idx} style={{ fontSize: '11px', background: 'white', color: '#6b21a8', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e9d5ff' }}>
                            {f.label} {f.required && '*'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Automated Action Buttons */}
                  <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={createFormFromAdvice}
                      disabled={generatingForm}
                    >
                      {generatingForm ? 'Generating Form...' : '⚡ Create Pre-Filled Form in TechForm Buddy'}
                    </button>

                    <Link
                      href="/browser"
                      className="btn btn-secondary"
                    >
                      🌐 Find in Portal Launcher
                    </Link>

                    <a
                      href={result.data.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ alignSelf: 'center', fontSize: '12px' }}
                    >
                      🔗 Official Website ↗
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Grievance & Service Request Tracker Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
              {/* Submission Card */}
              <div className="card" style={{ padding: 'var(--space-xl)' }}>
                <h2>File a Service Request / Citizen Grievance</h2>
                <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
                  Submit complaints regarding government services, university admissions, banking disputes, or delayed institutional processes.
                </p>

                <form onSubmit={handleFileGrievance} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-md)' }}>
                    <div className="input-group">
                      <label className="input-label">Subject / Title</label>
                      <input
                        className="input"
                        placeholder="e.g. Delay in Passport Police Verification"
                        value={grvTitle}
                        onChange={e => setGrvTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Domain</label>
                      <select className="input" value={grvDomain} onChange={e => setGrvDomain(e.target.value)}>
                        <option value="government">Government & Municipal</option>
                        <option value="education">Education & University</option>
                        <option value="healthcare">Healthcare & Insurance</option>
                        <option value="banking">Banking & Financial Services</option>
                        <option value="business">Commercial & Consumer Dispute</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Department / Agency</label>
                      <input
                        className="input"
                        placeholder="e.g. Regional Passport Office / Bank Branch"
                        value={grvDept}
                        onChange={e => setGrvDept(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Detailed Description & Transaction Details</label>
                    <textarea
                      className="input"
                      rows={4}
                      placeholder="Provide all facts, dates, transaction references, and desired outcome..."
                      value={grvDesc}
                      onChange={e => setGrvDesc(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary" disabled={filingGrv}>
                      {filingGrv ? 'Submitting...' : 'Submit Service Request'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Status Tracking List */}
              <div>
                <h2>Track Submitted Requests ({grievances.length})</h2>
                {grievances.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                    {grievances.map(item => (
                      <div key={item.id} className="grievance-card card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <span className="tracking-pill">{item.tracking_number}</span>
                            <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                              {item.domain}
                            </span>
                          </div>
                          <span className={`badge badge-${item.status === 'resolved' ? 'success' : 'default'}`}>
                            Status: {item.status.toUpperCase()}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{item.title}</h3>
                        <p className="text-sm text-secondary">{item.description}</p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--color-text-tertiary)', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                          <span>Department: {item.department || 'General Administration'}</span>
                          <span>Filed on: {new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ marginTop: 'var(--space-md)' }}>
                    <p className="text-muted">No grievances filed yet</p>
                    <p className="text-xs text-muted">Submit any service grievance above to generate an official tracking ID</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
  );
}
