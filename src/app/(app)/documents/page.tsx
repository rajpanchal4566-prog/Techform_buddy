'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import { speakText, stopSpeaking } from '@/lib/speech';
import './documents.css';

interface DocumentItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  extracted_data: string | null;
  uploaded_at: string;
}

interface DocumentAnalysis {
  docType: string;
  confidence: number;
  summary: string;
  translatedSummary?: string;
  targetLanguage: string;
  keyFacts: {
    names: string[];
    dates: string[];
    deadlines: string[];
    amounts: string[];
    referenceNumbers: string[];
  };
  nextSteps: string[];
  risksAndWarnings: string[];
  candidateProfileFields: {
    key: string;
    label: string;
    value: string;
    confidence: number;
    sensitive: boolean;
    selected?: boolean;
  }[];
  rawTextPreview: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const [activeAnalysis, setActiveAnalysis] = useState<DocumentAnalysis | null>(null);
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [editableFields, setEditableFields] = useState<Record<string, { value: string; selected: boolean }>>({});
  const [syncFeedback, setSyncFeedback] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useAppHeader({
    title: 'Document Understanding & Vault',
    subtitle: 'Upload notices, marksheets, certificates, or bank letters for plain-language summaries, key facts, and next steps',
  });

  useEffect(() => {
    fetchDocuments();
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('tfb_language') || localStorage.getItem('tfb_lang') || 'en';
      setSelectedLanguage(savedLang);
    }
  }, []);

  const fetchDocuments = async () => {
    const res = await fetch('/api/documents');
    if (res.ok) setDocuments(await res.json());
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadSuccessMsg('');
    setActiveAnalysis(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', selectedLanguage);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setUploadSuccessMsg(`Uploaded "${file.name}". Analyzing document understanding...`);
        fetchDocuments();

        // Run deep document understanding
        runDocumentAnalysis(data.id, file.name);
      }
    } catch (e) {
      console.error('Upload error:', e);
    } finally {
      setUploading(false);
    }
  };

  const [activeFileName, setActiveFileName] = useState<string>('');

  const runDocumentAnalysis = async (docId: string, fileName: string, langOverride?: string) => {
    const lang = langOverride || selectedLanguage;
    setAnalyzingDocId(docId);
    setActiveFileName(fileName);
    setSyncFeedback('');
    try {
      const res = await fetch('/api/documents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, language: lang, fileName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.analysis) {
          setActiveAnalysis(data.analysis);
          // Initialize editable fields
          const initialEditable: Record<string, { value: string; selected: boolean }> = {};
          data.analysis.candidateProfileFields.forEach((f: any) => {
            initialEditable[f.key] = {
              value: f.value,
              // Sensitive fields are UNCHECKED by default
              selected: !f.sensitive,
            };
          });
          setEditableFields(initialEditable);
        }
      }
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setAnalyzingDocId(null);
    }
  };

  const handleReadAloud = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    if (!activeAnalysis) return;

    const textToSpeak = [
      activeAnalysis.translatedSummary || activeAnalysis.summary,
      'What you need to do next:',
      ...activeAnalysis.nextSteps,
      'Risks and warnings:',
      ...activeAnalysis.risksAndWarnings,
    ].join('. ');

    setIsSpeaking(true);
    speakText(textToSpeak, activeAnalysis.targetLanguage || selectedLanguage);
  };

  const handleConfirmProfileSync = async () => {
    if (!activeAnalysis) return;
    const fieldsToSave: Record<string, string> = {};
    for (const [key, fieldState] of Object.entries(editableFields)) {
      if (fieldState.selected && fieldState.value.trim()) {
        fieldsToSave[key] = fieldState.value.trim();
      }
    }

    if (Object.keys(fieldsToSave).length === 0) {
      setSyncFeedback('Please select at least one field to save to your profile.');
      return;
    }

    try {
      const res = await fetch('/api/documents/analyze', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldsToSave }),
      });
      if (res.ok) {
        setSyncFeedback('✓ Successfully saved confirmed values to your profile! Available for instant form autofill.');
      } else {
        setSyncFeedback('Failed to update profile.');
      }
    } catch {
      setSyncFeedback('Error updating profile.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (activeAnalysis) setActiveAnalysis(null);
    fetchDocuments();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    return '📎';
  };

  return (
    <div className="docs-content animate-fadeIn">
          {uploadSuccessMsg && (
            <div className="card" style={{ borderLeft: '4px solid var(--color-success)', background: '#ecfdf5', padding: '12px 16px', marginBottom: '16px' }}>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{uploadSuccessMsg}</span>
            </div>
          )}

          {/* Consent Notice before AI Analysis */}
          <div
            id="doc-upload-consent-banner"
            style={{
              padding: '10px 14px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#1e40af',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🔒</span>
            <div>
              <strong>Citizen Consent Notice:</strong> By selecting or dropping a document, you authorize AI optical character recognition (OCR) and summarization. Your document contents are analyzed solely to assist you with form-filling and are <strong>never submitted to external government or third-party portals</strong> without your explicit confirmation.
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div
            className={`upload-area ${dragActive ? 'upload-area-active' : ''} ${uploading ? 'upload-area-uploading' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="doc-upload-input"
              className="upload-input"
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
            />
            {uploading ? (
              <>
                <div className="loading-spinner" />
                <p>Extracting text, OCR intelligence, and plain-language summary...</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>📂</div>
                <p><strong>Drop document here</strong> or click to browse</p>
                <span className="text-xs text-muted">Notice, Marksheet, Certificate, Bank Letter, or Form Instructions (PDF, JPG, PNG)</span>
              </>
            )}
          </div>

          {/* DOCUMENT UNDERSTANDING RESULT CARD (Requirement 1) */}
          {activeAnalysis && (
            <div id="document-understanding-card" className="card" style={{ marginTop: '24px', padding: '24px', border: '2px solid #3b82f6', background: 'var(--color-surface)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🔍</span>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Document Understanding</h2>
                    <span className="badge badge-primary" style={{ fontSize: '11px' }}>{activeAnalysis.docType}</span>
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>{Math.round(activeAnalysis.confidence * 100)}% Confidence</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    AI-powered extraction of key facts, deadlines, actionable steps, and verified profile data.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    id="analysis-language-select"
                    className="input"
                    style={{ fontSize: '12px', padding: '4px 8px', width: 'auto', background: 'var(--color-background)', cursor: 'pointer' }}
                    value={selectedLanguage}
                    onChange={(e) => {
                      const newLang = e.target.value;
                      setSelectedLanguage(newLang);
                      if (analyzingDocId && activeFileName) {
                        runDocumentAnalysis(analyzingDocId, activeFileName, newLang);
                      }
                    }}
                    title="Select Translation Language"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="mr">मराठी (Marathi)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="bn">বাংলা (Bengali)</option>
                    <option value="te">తెలుగు (Telugu)</option>
                  </select>

                  <button
                    id="read-aloud-analysis-btn"
                    className="btn btn-sm btn-primary"
                    onClick={handleReadAloud}
                    title="Read Aloud Analysis"
                  >
                    {isSpeaking ? '⏹ Stop' : '🔊 Read Aloud'}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setActiveAnalysis(null)}>
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Plain-Language Summary & Translation */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>📝 Plain-Language Summary</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.6', background: 'var(--color-background)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  {activeAnalysis.summary}
                </p>
                {activeAnalysis.translatedSummary && activeAnalysis.targetLanguage !== 'en' && (
                  <div style={{ marginTop: '8px', padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: '4px' }}>
                      🌐 Translation ({activeAnalysis.targetLanguage.toUpperCase()}):
                    </span>
                    <p style={{ fontSize: '13px', color: '#1e3a8a', lineHeight: '1.5', margin: 0 }}>
                      {activeAnalysis.translatedSummary}
                    </p>
                  </div>
                )}
              </div>

              {/* Key Facts Grid */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>📌 Key Facts Extracted</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'var(--color-background)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase' }}>Names</span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{activeAnalysis.keyFacts.names.length > 0 ? activeAnalysis.keyFacts.names.join(', ') : 'None listed'}</span>
                  </div>
                  <div style={{ background: 'var(--color-background)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase' }}>Deadlines / Last Date</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>{activeAnalysis.keyFacts.deadlines.length > 0 ? activeAnalysis.keyFacts.deadlines.join(', ') : 'No deadline specified'}</span>
                  </div>
                  <div style={{ background: 'var(--color-background)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase' }}>Amounts / Fees</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>{activeAnalysis.keyFacts.amounts.length > 0 ? activeAnalysis.keyFacts.amounts.join(', ') : 'None listed'}</span>
                  </div>
                  <div style={{ background: 'var(--color-background)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase' }}>Reference / Order Numbers</span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{activeAnalysis.keyFacts.referenceNumbers.length > 0 ? activeAnalysis.keyFacts.referenceNumbers.join(', ') : 'None listed'}</span>
                  </div>
                </div>
              </div>

              {/* What You Need to Do Next */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>🚀 What You Need to Do Next</h3>
                <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', lineHeight: '1.7', color: 'var(--color-text-primary)' }}>
                  {activeAnalysis.nextSteps.map((step, idx) => (
                    <li key={idx}><strong>{step}</strong></li>
                  ))}
                </ol>
              </div>

              {/* Risks & Warnings */}
              {activeAnalysis.risksAndWarnings.length > 0 && (
                <div style={{ marginBottom: '24px', background: '#fffbeb', border: '1px solid #fcd34d', padding: '14px', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#b45309', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠️ Risks & Warnings
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#92400e', lineHeight: '1.6' }}>
                    {activeAnalysis.risksAndWarnings.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Offer to Add Extracted Details to Profile (Requirement 1) */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>👤 Sync Extracted Values into Your Profile</h3>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                      Review values, make corrections, and select which fields to save. Sensitive IDs are excluded by default.
                    </p>
                  </div>
                  <button
                    id="save-profile-sync-btn"
                    className="btn btn-sm btn-primary"
                    onClick={handleConfirmProfileSync}
                  >
                    Confirm & Save to Profile
                  </button>
                </div>

                {syncFeedback && (
                  <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', background: syncFeedback.includes('✓') ? '#ecfdf5' : '#fef2f2', color: syncFeedback.includes('✓') ? '#065f46' : '#991b1b', border: '1px solid' }}>
                    {syncFeedback}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                  {activeAnalysis.candidateProfileFields.map((field) => {
                    const current = editableFields[field.key] || { value: field.value, selected: !field.sensitive };
                    return (
                      <div
                        key={field.key}
                        style={{
                          background: field.sensitive ? '#f8fafc' : 'var(--color-background)',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: field.sensitive ? '1px dashed #cbd5e1' : '1px solid var(--color-border)',
                          opacity: field.sensitive ? 0.8 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={current.selected}
                              onChange={(e) => {
                                setEditableFields(prev => ({
                                  ...prev,
                                  [field.key]: { ...current, selected: e.target.checked },
                                }));
                              }}
                            />
                            {field.label}
                          </label>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            {Math.round(field.confidence * 100)}% conf
                          </span>
                        </div>

                        {field.sensitive ? (
                          <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                            🔒 {field.value} (Sensitive ID - Manual entry only)
                          </div>
                        ) : (
                          <input
                            type="text"
                            className="input"
                            style={{ fontSize: '12px', padding: '4px 8px', marginTop: '4px' }}
                            value={current.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableFields(prev => ({
                                ...prev,
                                [field.key]: { ...current, value: val },
                              }));
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Documents List */}
          {documents.length > 0 ? (
            <div className="docs-list" style={{ marginTop: '28px' }}>
              <h2>Your Documents Vault ({documents.length})</h2>
              <div className="docs-grid">
                {documents.map(doc => (
                  <div key={doc.id} className="doc-item card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="doc-icon">{getFileIcon(doc.file_type)}</div>
                      <div className="doc-info" style={{ flex: 1 }}>
                        <span className="doc-name" style={{ fontWeight: 600 }}>{doc.file_name}</span>
                        <div className="doc-meta">
                          <span className="text-xs text-muted">{formatSize(doc.file_size)}</span>
                          <span className="text-xs text-muted">·</span>
                          <span className="text-xs text-muted">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => runDocumentAnalysis(doc.id, doc.file_name)}
                        disabled={analyzingDocId === doc.id}
                        title="Analyze Document"
                      >
                        {analyzingDocId === doc.id ? 'Analyzing...' : '🔍 Understand'}
                      </button>

                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteDocument(doc.id)} title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
              <p className="text-muted">No documents uploaded yet</p>
              <p className="text-xs text-muted">Upload any notice, marksheet, certificate, or bank letter to get plain-language analysis & autofill support</p>
            </div>
          )}
        </div>
  );
}
