'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import './forms.css';
import { downloadFormAsDocument } from '@/lib/downloadForm';
import { useRegisterActions } from '@/lib/actionRegistry';
import {
  SUPPORTED_LANGUAGES,
  getDefaultLanguage,
  speakText,
  stopSpeaking,
} from '@/lib/speech';
import './forms.css';

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  language: string;
  updated_at: string;
}

interface FormWatch {
  id: string;
  search_query: string;
  category: string;
  is_active: number;
  created_at: string;
}

function FormsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [forms, setForms] = useState<Form[]>([]);
  const [watches, setWatches] = useState<FormWatch[]>([]);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'forms');
  const [search, setSearch] = useState('');
  const [watchQuery, setWatchQuery] = useState('');
  useAppHeader({
    title: 'Forms',
    subtitle: 'Manage and fill your forms',
    actions: (
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => setShowCreateModal(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Form
      </button>
    ),
  });

  // New Form Type Request Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formTypePrompt, setFormTypePrompt] = useState('');
  const [selectedLang, setSelectedLang] = useState('en');
  const [isListeningPrompt, setIsListeningPrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const promptRecognitionRef = useRef<SpeechRecognition | null>(null);

  // Modal Upload Form State
  const [modalTab, setModalTab] = useState<'prompt' | 'upload'>('prompt');
  const [modalUploadedFile, setModalUploadedFile] = useState<{
    name: string;
    size: string;
    type: string;
    content: string;
    previewUrl?: string;
  } | null>(null);
  const [modalUploadMode, setModalUploadMode] = useState<'format_only' | 'fix_only' | 'extract_and_profile'>('format_only');
  const [modalUploadInstruction, setModalUploadInstruction] = useState('');
  const [isListeningModalUpload, setIsListeningModalUpload] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = getDefaultLanguage();
      setSelectedLang(saved);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchForms();
      fetchWatches();
    }
    return () => {
      stopSpeaking();
      promptRecognitionRef.current?.stop();
    };
  }, [status]);

  // Register page actions with Action Registry (Requirement 1 & 7)
  useRegisterActions([
    {
      name: 'start_new_form',
      description: 'Start creating a new citizen form or letter (e.g. scholarship, job, income_certificate, caste_certificate).',
      parameters: {
        type: {
          type: 'string',
          description: 'Type of form to create (e.g. scholarship, job, income_certificate, caste_certificate, general).',
          required: false,
        },
      },
      isReadOnly: false,
      confirmationPrompt: ({ type }) => `Start creating a new ${type || 'application'} form?`,
      handler: async ({ type }) => {
        const dest = type ? `/forms/new?type=${encodeURIComponent(type)}` : '/forms/new';
        router.push(dest);
        return {
          success: true,
          message: `Starting new ${type || 'general'} form`,
        };
      },
    },
    {
      name: 'open_form',
      description: 'Open an existing citizen application form by ID.',
      parameters: {
        id: {
          type: 'string',
          description: 'The unique ID of the form to view/edit.',
          required: true,
        },
      },
      isReadOnly: false,
      confirmationPrompt: ({ id }) => `Open form #${id}?`,
      handler: async ({ id }) => {
        router.push(`/forms/${id}`);
        return {
          success: true,
          message: `Opened form #${id}`,
        };
      },
    },
    {
      name: 'download_pdf',
      description: 'Download a citizen form or letter as a PDF document through the action registry.',
      parameters: {
        formId: {
          type: 'string',
          description: 'The ID of the form to download (optional, defaults to current form).',
          required: false,
        },
      },
      isReadOnly: false,
      confirmationPrompt: ({ formId }) => {
        const target = forms.find(f => f.id === formId) || forms[0];
        return `Download "${target ? target.title : 'form document'}" as PDF?`;
      },
      handler: async ({ formId }) => {
        const target = (formId ? forms.find(f => f.id === formId) : forms[0]) || {
          id: '1',
          title: 'Citizen Application Form',
          category: 'General',
          status: 'ready',
        };
        try {
          const fakeEvent = { preventDefault: () => {}, stopPropagation: () => {} } as any;
          await downloadFormItem(fakeEvent, target.id, target.title, target.category, target.status);
          if (typeof window !== 'undefined' && typeof window.print === 'function') {
            window.print();
          }
          window.dispatchEvent(new CustomEvent('tfb-action-executed', { detail: { name: 'download_pdf', formId } }));
          return {
            success: true,
            message: `Downloaded PDF: ${target.title}`,
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Could not download PDF: ${err?.message || 'Error'}`,
          };
        }
      },
    },
  ], [forms, router]);

  const fetchForms = async () => {
    const res = await fetch('/api/forms');
    if (res.ok) setForms(await res.json());
  };

  const fetchWatches = async () => {
    const res = await fetch('/api/form-watches');
    if (res.ok) setWatches(await res.json());
  };

  const addWatch = async () => {
    if (!watchQuery.trim()) return;
    const res = await fetch('/api/form-watches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchQuery: watchQuery }),
    });
    if (res.ok) {
      setWatchQuery('');
      fetchWatches();
    }
  };

  // Voice command input for form type
  const startPromptVoiceInput = () => {
    stopSpeaking();
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang);
    recognition.lang = langObj ? langObj.bcp47 : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListeningPrompt(true);
      setVoiceFeedback(`Listening in ${langObj?.label || selectedLang}... Speak the type of form or letter you need.`);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setFormTypePrompt(transcript);
      setVoiceFeedback(`Heard: "${transcript}"`);
    };

    recognition.onerror = () => {
      setIsListeningPrompt(false);
      setVoiceFeedback('');
    };

    recognition.onend = () => {
      setIsListeningPrompt(false);
    };

    promptRecognitionRef.current = recognition;
    recognition.start();
  };

  // Generate real dynamic form structure via API based on user prompt
  const handleGenerateForm = async (overridePrompt?: string) => {
    const query = (overridePrompt || formTypePrompt).trim();
    if (!query) {
      alert('Please enter or speak the type of form you want to create.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/forms/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, language: selectedLang }),
      });

      if (res.ok) {
        const generatedData = await res.json();
        // Save to sessionStorage for new form page to consume
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('currentGeneratedForm', JSON.stringify(generatedData));
        }
        setShowCreateModal(false);
        router.push('/forms/new');
      } else {
        alert('Could not generate form template. Redirecting to blank form.');
        setShowCreateModal(false);
        router.push('/forms/new');
      }
    } catch (err) {
      console.error('Generation error:', err);
      setShowCreateModal(false);
      router.push('/forms/new');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeFormatted = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    if (isImage) {
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setModalUploadedFile({
          name: file.name,
          size: sizeFormatted,
          type: file.type,
          content: `Document Image: ${file.name}\nExtracted text candidate from uploaded scan`,
          previewUrl: dataUrl,
        });
        setVoiceFeedback(`Uploaded: ${file.name}`);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        setModalUploadedFile({
          name: file.name,
          size: sizeFormatted,
          type: file.type || 'text/plain',
          content: text,
        });
        setVoiceFeedback(`Loaded: ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  const startModalUploadVoice = () => {
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
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang);
    recognition.lang = langObj ? langObj.bcp47 : 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListeningModalUpload(true);
      setVoiceFeedback(`Listening in ${langObj?.label || selectedLang}...`);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.trim();
      setModalUploadInstruction(transcript);
      setIsListeningModalUpload(false);

      const lower = transcript.toLowerCase();
      if (lower.includes('fix only') || lower.includes('only fix') || lower.includes('सिर्फ ठीक') || lower.includes('केवल सुधार')) {
        setModalUploadMode('fix_only');
      } else if (lower.includes('profile') || lower.includes('प्रोफ़ाइल') || lower.includes('my data')) {
        setModalUploadMode('extract_and_profile');
      } else {
        setModalUploadMode('format_only');
      }

      setVoiceFeedback(`Instruction: "${transcript}"`);
    };

    recognition.onerror = () => setIsListeningModalUpload(false);
    recognition.onend = () => setIsListeningModalUpload(false);
    recognition.start();
  };

  const handleProcessModalUpload = async () => {
    if (!modalUploadedFile && !modalUploadInstruction.trim()) {
      alert('Please upload a document or specify an instruction.');
      return;
    }

    setIsGenerating(true);
    setVoiceFeedback('Processing uploaded document format...');

    try {
      let profileData: Record<string, string> = {};
      try {
        const pRes = await fetch('/api/profile');
        if (pRes.ok) profileData = await pRes.json();
      } catch (e) {
        console.warn('Profile fetch error:', e);
      }

      const res = await fetch('/api/forms/upload-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: modalUploadedFile?.name || 'uploaded_document.txt',
          fileContent: modalUploadedFile?.content || modalUploadInstruction,
          mode: modalUploadMode,
          instruction: modalUploadInstruction,
          language: selectedLang,
          profileData,
        }),
      });

      if (res.ok) {
        const generatedData = await res.json();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('currentGeneratedForm', JSON.stringify(generatedData));
        }
        setShowCreateModal(false);
        router.push('/forms/new');
      } else {
        alert('Could not process document. Redirecting to blank form.');
        setShowCreateModal(false);
        router.push('/forms/new');
      }
    } catch (err) {
      console.error('Modal upload error:', err);
      setShowCreateModal(false);
      router.push('/forms/new');
    } finally {
      setIsGenerating(false);
    }
  };

  const quickSuggestions = [
    { label: '✉️ Formal Resignation Letter', prompt: 'Formal employee resignation letter to manager with transition plan' },
    { label: '📝 Formal Leave Application', prompt: 'Formal leave application letter to employer or principal' },
    { label: '💼 Job Application & Cover Letter', prompt: 'Job application form and professional cover letter' },
    { label: '🏦 Bank Account Service / Closure Letter', prompt: 'Formal bank letter to branch manager for account closure or cheque book' },
    { label: '🚗 Driving Licence (Sarathi Parivahan)', prompt: 'Driving licence application form under Parivahan Sarathi' },
    { label: '💳 Instant PAN Card (Form 49A)', prompt: 'Application for allotment of Permanent Account Number (Form 49A)' },
    { label: '🛂 Passport Seva Application', prompt: 'Indian ordinary passport application form under Passport Seva' },
    { label: '⚖️ RTI Information Request (RTI Act)', prompt: 'Right to Information RTI application form under Section 6(1)' },
    { label: '🏠 Residential Rental Agreement', prompt: 'Residential tenancy rental agreement form' },
  ];

  const downloadFormItem = async (e: React.MouseEvent, formId: string, formTitle: string, formCat: string, formStat: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/forms/${formId}`);
      if (res.ok) {
        const data = await res.json();
        let fieldList: any[] = [];
        if (data.fields) {
          try {
            fieldList = typeof data.fields === 'string' ? JSON.parse(data.fields) : data.fields;
          } catch {
            fieldList = [];
          }
        }
        let filledMap: Record<string, string> = {};
        if (data.filled_data) {
          try {
            filledMap = typeof data.filled_data === 'string' ? JSON.parse(data.filled_data) : data.filled_data;
          } catch {
            filledMap = {};
          }
        }
        const fields = fieldList.map((f: any) => ({
          label: f.label || 'Field',
          value: f.value || filledMap[f.label] || (f.id ? filledMap[f.id] : '') || '',
          required: f.required,
          section: f.section,
        }));
        downloadFormAsDocument(
          formTitle,
          fields,
          formCat,
          formStat,
          undefined,
          formCat?.toLowerCase().includes('letter') ? 'letter' : undefined
        );
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const filteredForms = forms.filter(f =>
    f.title.toLowerCase().includes(search.toLowerCase()) ||
    f.category.toLowerCase().includes(search.toLowerCase())
  );

  if (status === 'loading' || !session) {
    return <div className="loading-screen"><div className="loading-spinner" /><p>Loading...</p></div>;
  }

  return (
    <>
      {/* Creation Modal for Form Type */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => !isGenerating && setShowCreateModal(false)}>
          <div className="modal-dialog animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h2>⚡ Create Form or Formal Document</h2>
                <p className="text-sm text-muted">
                  What kind of form or letter do you need? Speak by voice command or type below.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setShowCreateModal(false)}
                disabled={isGenerating}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Modal Tabs */}
              <div className="form-creation-tabs">
                <button
                  type="button"
                  className={`creation-tab-btn ${modalTab === 'prompt' ? 'active' : ''}`}
                  onClick={() => setModalTab('prompt')}
                >
                  ⚡ Speak or Type Form Type
                </button>
                <button
                  type="button"
                  className={`creation-tab-btn ${modalTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setModalTab('upload')}
                >
                  📄 Upload Existing Form / Scan
                </button>
              </div>

              {modalTab === 'prompt' ? (
                <>
                  <div className="voice-prompt-box">
                    <label className="input-label" style={{ marginBottom: '6px' }}>
                      Ask for Form Type (Voice Command or Type)
                    </label>
                    <div className="voice-prompt-input-row">
                      <input
                        className="input"
                        placeholder="e.g. Formal resignation letter, Driving licence form, Leave application..."
                        value={formTypePrompt}
                        onChange={e => setFormTypePrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleGenerateForm()}
                        disabled={isGenerating}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className={`btn btn-sm ${isListeningPrompt ? 'btn-danger mic-button-pulse' : 'btn-secondary'}`}
                        onClick={startPromptVoiceInput}
                        title="Click and speak the form or letter type you want"
                        disabled={isGenerating}
                      >
                        🎤 {isListeningPrompt ? 'Listening...' : 'Voice'}
                      </button>
                    </div>

                    {voiceFeedback && (
                      <p className="text-xs text-muted" style={{ marginTop: '6px', fontStyle: 'italic', color: '#2563eb' }}>
                        {voiceFeedback}
                      </p>
                    )}

                    <div style={{ marginTop: '12px' }}>
                      <span className="text-xs text-muted" style={{ fontWeight: 600 }}>
                        Popular Real Form & Letter Templates:
                      </span>
                      <div className="prompt-chips-wrap">
                        {quickSuggestions.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="prompt-chip"
                            onClick={() => {
                              setFormTypePrompt(item.prompt);
                              handleGenerateForm(item.prompt);
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="upload-form-card" style={{ border: 'none', padding: 0, boxShadow: 'none' }}>
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept=".pdf,.txt,.docx,.doc,.rtf,image/*"
                    style={{ display: 'none' }}
                    onChange={handleModalFileUpload}
                  />

                  {!modalUploadedFile ? (
                    <div
                      className="upload-dropzone"
                      onClick={() => modalFileInputRef.current?.click()}
                    >
                      <div className="upload-dropzone-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b' }}>
                          Click to upload document, scan, or existing letter
                        </strong>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Supports PDF, PNG, JPG, Word (.docx), or plain text files
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="uploaded-file-banner">
                      <div className="file-info-col">
                        {modalUploadedFile.previewUrl ? (
                          <img src={modalUploadedFile.previewUrl} alt="Preview" className="file-preview-thumb" />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            📄
                          </div>
                        )}
                        <div>
                          <strong style={{ fontSize: '13px', display: 'block' }}>{modalUploadedFile.name}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{modalUploadedFile.size} • {modalUploadedFile.type}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => modalFileInputRef.current?.click()}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setModalUploadedFile(null)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="upload-modes-container">
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Select How to Process:
                    </span>
                    <div className="upload-mode-buttons">
                      <button
                        type="button"
                        className={`upload-mode-btn ${modalUploadMode === 'format_only' ? 'active' : ''}`}
                        onClick={() => setModalUploadMode('format_only')}
                        title="Removes existing details and extracts blank reusable format"
                      >
                        ⚡ Take as Clean Format (Remove Existing Text)
                      </button>
                      <button
                        type="button"
                        className={`upload-mode-btn ${modalUploadMode === 'fix_only' ? 'active' : ''}`}
                        onClick={() => setModalUploadMode('fix_only')}
                        title="Preserves existing data and fixes only what you specify"
                      >
                        🛠️ Fix Specific Things Only
                      </button>
                      <button
                        type="button"
                        className={`upload-mode-btn ${modalUploadMode === 'extract_and_profile' ? 'active' : ''}`}
                        onClick={() => setModalUploadMode('extract_and_profile')}
                        title="Extracts structure and auto-fills with verified profile data"
                      >
                        👤 Extract Format & Fill from My Profile
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                      <input
                        className="input"
                        placeholder={
                          modalUploadMode === 'fix_only'
                            ? "Specify what to fix (e.g. 'Fix date and contact only')..."
                            : "Instruction (e.g. 'Take this as format and remove text')..."
                        }
                        value={modalUploadInstruction}
                        onChange={e => setModalUploadInstruction(e.target.value)}
                        disabled={isGenerating}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className={`btn btn-sm ${isListeningModalUpload ? 'btn-danger mic-button-pulse' : 'btn-secondary'}`}
                        onClick={startModalUploadVoice}
                        title="Speak instruction by voice"
                        disabled={isGenerating}
                      >
                        🎤 {isListeningModalUpload ? 'Listening...' : 'Voice'}
                      </button>
                    </div>

                    {voiceFeedback && (
                      <p className="text-xs text-muted" style={{ fontStyle: 'italic', color: '#2563eb', margin: 0 }}>
                        {voiceFeedback}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Language for Fields & Voice</label>
                  <select
                    className="input"
                    value={selectedLang}
                    onChange={e => setSelectedLang(e.target.value)}
                  >
                    {SUPPORTED_LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>
                        {l.label} ({l.nativeName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <Link href="/forms/new" className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>
                Start with Blank Form
              </Link>
              {modalTab === 'prompt' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleGenerateForm()}
                  disabled={isGenerating || !formTypePrompt.trim()}
                >
                  {isGenerating ? 'Generating Real Format...' : '⚡ Generate Form Format'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleProcessModalUpload}
                  disabled={isGenerating || (!modalUploadedFile && !modalUploadInstruction.trim())}
                >
                  {isGenerating ? 'Processing Document...' : '⚡ Process & Open Form'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="forms-list-content animate-fadeIn">
          <div className="tabs">
            <button className={`tab ${activeTab === 'forms' ? 'tab-active' : ''}`} onClick={() => setActiveTab('forms')}>
              My Forms ({forms.length})
            </button>
            <button className={`tab ${activeTab === 'watch' ? 'tab-active' : ''}`} onClick={() => setActiveTab('watch')}>
              Form Watch ({watches.length})
            </button>
          </div>

          {activeTab === 'forms' && (
            <>
              <div className="forms-toolbar">
                <div className="forms-search input-with-icon">
                  <svg className="input-icon" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><line x1="13" y1="13" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <input className="input" placeholder="Search forms..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>

              {filteredForms.length > 0 ? (
                <div className="forms-grid">
                  {filteredForms.map((form, idx) => (
                    <Link key={form.id ? `form-${form.id}` : `form-idx-${idx}`} href={`/forms/${form.id}`} className="form-list-item card card-hover" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                      <div className="form-list-info">
                        <span className="form-list-title">{form.title}</span>
                        <div className="form-list-meta">
                          <span className="text-xs text-muted">{form.category}</span>
                          <span className="text-xs text-muted">·</span>
                          <span className="text-xs text-muted">{new Date(form.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={e => downloadFormItem(e, form.id, form.title, form.category, form.status)}
                          title="Download Form Document (PDF)"
                        >
                          📥
                        </button>
                        <span className={`badge badge-${form.status === 'completed' ? 'success' : form.status === 'submitted' ? 'accent' : 'default'}`}>
                          {form.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="64" height="64"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <p className="text-muted">No forms yet</p>
                  <Link href="/forms/new" className="btn btn-primary btn-sm">Create your first form</Link>
                </div>
              )}
            </>
          )}

          {activeTab === 'watch' && (
            <div>
              <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-md)' }}>
                Describe a form you&apos;re looking for. We&apos;ll notify you when it becomes available online.
              </p>
              <div className="watch-form">
                <input
                  className="input"
                  placeholder="e.g., UPSC application form 2025"
                  value={watchQuery}
                  onChange={e => setWatchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addWatch()}
                />
                <button className="btn btn-primary" onClick={addWatch}>Watch</button>
              </div>

              {watches.length > 0 ? (
                <div className="watch-list">
                  {watches.map((w, idx) => (
                    <div key={w.id ? `watch-${w.id}` : `watch-idx-${idx}`} className="watch-item card" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                      <div className="watch-item-info">
                        <span className="watch-query">{w.search_query}</span>
                        <span className="text-xs text-muted">Added {new Date(w.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className={`badge ${w.is_active ? 'badge-accent' : 'badge-default'}`}>
                        {w.is_active ? 'Watching' : 'Paused'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ paddingTop: 'var(--space-xl)' }}>
                  <p className="text-muted">No form watches set up yet</p>
                </div>
              )}
            </div>
          )}
        </div>
    </>
  );
}

export default function FormsPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading Forms...</p>
        </div>
      }
    >
      <FormsContent />
    </Suspense>
  );
}
