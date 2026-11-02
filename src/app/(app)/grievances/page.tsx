'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppHeader } from '@/components/AppShellContext';
import { speakText, stopSpeaking } from '@/lib/speech';

export interface GrievanceItem {
  id: string;
  tracking_number: string;
  title: string;
  domain: string;
  department: string;
  description: string;
  language: string;
  status: 'submitted' | 'under_review' | 'in_progress' | 'resolved';
  priority: string;
  attachment_name?: string;
  attachment_data?: string;
  next_action?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

const DEPARTMENTS = [
  { id: 'electricity', label: 'Electricity & Power Supply', labelHi: 'विद्युत विभाग (बिजली आपूर्ति)' },
  { id: 'water', label: 'Water Supply & Sanitation', labelHi: 'जल आपूर्ति एवं सीवरेज बोर्ड' },
  { id: 'roads', label: 'Roads & Municipal Infrastructure', labelHi: 'सड़क, नाली व नागरिक अवसंरचना' },
  { id: 'scholarship', label: 'Scholarship & Education Disbursal', labelHi: 'छात्रवृत्ति व शिक्षा कल्याण विभाग' },
  { id: 'ration', label: 'Ration & Public Food Distribution (PDS)', labelHi: 'राशन एवं सार्वजनिक खाद्य वितरण' },
  { id: 'banking', label: 'Banking & Financial Grievance Cell', labelHi: 'बैंकिंग एवं वित्तीय सेवा लोकपाल' },
  { id: 'general', label: 'General Civic Administration', labelHi: 'सामान्य नागरिक प्रशासन' },
];

function GrievancesContent() {
  const searchParams = useSearchParams();
  const initialTrack = searchParams?.get('track') || '';

  const [activeTab, setActiveTab] = useState<'track' | 'file'>(initialTrack ? 'track' : 'track');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const isHi = language === 'hi';

  const [grievances, setGrievances] = useState<GrievanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrievance, setSelectedGrievance] = useState<GrievanceItem | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialTrack);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useAppHeader({
    title: isHi ? 'नागरिक शिकायत एवं समाधान ट्रैकर' : 'Grievance Redressal & Tracker',
    subtitle: isHi
      ? 'सरकारी विभागों के विरुद्ध आधिकारिक शिकायत दर्ज करें एवं वास्तविक समय में स्थिति ट्रैक करें।'
      : 'File verified grievances across departments and monitor real-time authority redressal.',
    actions: (
      <button
        type="button"
        onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
        className="btn btn-secondary btn-sm"
      >
        🌐 {isHi ? 'English' : 'हिंदी'}
      </button>
    ),
  });

  // Form state
  const [formData, setFormData] = useState({
    department: 'electricity',
    title: '',
    description: '',
    priority: 'medium',
  });
  const [attachment, setAttachment] = useState<{ name: string; base64: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGrievances = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/grievances');
      if (res.ok) {
        const data: GrievanceItem[] = await res.json();
        setGrievances(data);
        if (data.length > 0 && !selectedGrievance) {
          if (initialTrack) {
            const found = data.find(g => g.tracking_number.toLowerCase() === initialTrack.toLowerCase());
            setSelectedGrievance(found || data[0]);
          } else {
            setSelectedGrievance(data[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load grievances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrievances();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(isHi ? 'फ़ाइल का आकार 5MB से कम होना चाहिए।' : 'File size must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setAttachment({
        name: file.name,
        base64: b64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      setFormError(isHi ? 'कृपया शीर्षक और समस्या का विवरण भरें।' : 'Please enter title and description.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'government',
          department: formData.department,
          title: formData.title.trim(),
          description: formData.description.trim(),
          priority: formData.priority,
          language: language,
          attachment_name: attachment?.name,
          attachment_data: attachment?.base64,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to submit grievance');
      }

      const created: GrievanceItem = await res.json();
      setFormSuccess(created.tracking_number);
      setGrievances(prev => [created, ...prev]);
      setSelectedGrievance(created);

      // Reset form
      setFormData({
        department: 'electricity',
        title: '',
        description: '',
        priority: 'medium',
      });
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setTimeout(() => {
        setActiveTab('track');
        setFormSuccess(null);
      }, 2500);
    } catch (err: any) {
      setFormError(err.message || 'Error creating grievance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceStatus = async () => {
    if (!selectedGrievance) return;
    const stages: Array<GrievanceItem['status']> = ['submitted', 'under_review', 'in_progress', 'resolved'];
    const curIdx = stages.indexOf(selectedGrievance.status);
    if (curIdx < stages.length - 1) {
      const nextStage = stages[curIdx + 1];
      try {
        const res = await fetch('/api/grievances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'advance_stage',
            trackingNumber: selectedGrievance.tracking_number,
            status: nextStage,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setSelectedGrievance(updated);
          setGrievances(prev => prev.map(g => g.id === updated.id ? updated : g));
        } else {
          // Direct fallback for instant UI progression
          const updated = {
            ...selectedGrievance,
            status: nextStage,
            updated_at: new Date().toISOString(),
          };
          setSelectedGrievance(updated);
          setGrievances(prev => prev.map(g => g.id === updated.id ? updated : g));
        }
      } catch {
        const updated = {
          ...selectedGrievance,
          status: nextStage,
          updated_at: new Date().toISOString(),
        };
        setSelectedGrievance(updated);
        setGrievances(prev => prev.map(g => g.id === updated.id ? updated : g));
      }
    }
  };

  const handleReadAloudStatus = () => {
    if (!selectedGrievance) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = isHi
      ? `आपकी शिकायत संख्या ${selectedGrievance.tracking_number}। विषय: ${selectedGrievance.title}। वर्तमान स्थिति: ${selectedGrievance.status}। संबंधित विभाग: ${selectedGrievance.department}। अगला कदम: ${selectedGrievance.next_action || 'प्राधिकारी द्वारा समीक्षा प्रगति पर है।'}`
      : `Grievance reference number ${selectedGrievance.tracking_number}. Title: ${selectedGrievance.title}. Current status: ${selectedGrievance.status}. Assigned department: ${selectedGrievance.department}. Next action: ${selectedGrievance.next_action || 'Under review by concerned department officer.'}`;

    setIsSpeaking(true);
    speakText(
      textToSpeak,
      language,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
  };

  const TIMELINE_STEPS = [
    { key: 'submitted', label: 'Submitted', labelHi: 'दर्ज हुआ', desc: 'Complaint logged & tracking ID assigned' },
    { key: 'under_review', label: 'Under Review', labelHi: 'समीक्षाधीन', desc: 'Assigned to nodal verification officer' },
    { key: 'in_progress', label: 'In Progress', labelHi: 'कार्य प्रगति पर', desc: 'Field engineer / desk officer dispatched' },
    { key: 'resolved', label: 'Resolved', labelHi: 'समाधान संपन्न', desc: 'Action complete & redressal verified' },
  ];

  const getStepIndex = (status: GrievanceItem['status']) => {
    switch (status) {
      case 'submitted': return 0;
      case 'under_review': return 1;
      case 'in_progress': return 2;
      case 'resolved': return 3;
      default: return 0;
    }
  };

  const filteredGrievances = grievances.filter(g => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return g.tracking_number.toLowerCase().includes(q) ||
      g.title.toLowerCase().includes(q) ||
      g.department.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
            <button
              type="button"
              id="tab-track-grievances"
              data-testid="tab-track-grievances"
              onClick={() => setActiveTab('track')}
              style={{
                background: activeTab === 'track' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                border: '1px solid',
                borderColor: activeTab === 'track' ? 'var(--color-accent)' : 'var(--color-border)',
                color: activeTab === 'track' ? '#ffffff' : 'var(--color-text-secondary)',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>📍</span> {isHi ? 'आवेदन ट्रैकर' : 'Application Tracker'}
              <span style={{ fontSize: '11px', background: activeTab === 'track' ? 'rgba(255,255,255,0.2)' : 'var(--color-bg-tertiary)', padding: '1px 6px', borderRadius: '10px' }}>
                {grievances.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-file-grievance"
              data-testid="tab-file-grievance"
              onClick={() => setActiveTab('file')}
              style={{
                background: activeTab === 'file' ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                border: '1px solid',
                borderColor: activeTab === 'file' ? 'var(--color-accent)' : 'var(--color-border)',
                color: activeTab === 'file' ? '#ffffff' : 'var(--color-text-secondary)',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>📝</span> {isHi ? 'नई शिकायत दर्ज करें' : 'File a Grievance'}
            </button>
          </div>

          {/* TAB 1: TRACKER */}
          {activeTab === 'track' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '20px' }}>
              {/* Left Column: List & Search */}
              <div style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="grv-track-search" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    {isHi ? 'ट्रैकिंग नंबर या विषय से खोजें:' : 'Search by Tracking Number or Keyword:'}
                  </label>
                  <input
                    type="text"
                    id="grv-track-search"
                    data-testid="grv-track-search"
                    placeholder="e.g. TFB-GOV-849201..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      color: 'var(--color-text-primary)',
                      padding: '8px 12px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                {loading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    {isHi ? 'लोड हो रहा है...' : 'Loading grievances...'}
                  </div>
                ) : filteredGrievances.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    <p style={{ margin: '0 0 12px 0' }}>{isHi ? 'कोई शिकायत नहीं मिली।' : 'No grievances found.'}</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('file')}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {isHi ? 'नई शिकायत दर्ज करें' : 'File a New Grievance'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px', overflowY: 'auto' }}>
                    {filteredGrievances.map(item => {
                      const isSelected = selectedGrievance?.id === item.id;
                      const statusColor = item.status === 'resolved' ? '#15803d' : item.status === 'in_progress' ? '#1d4ed8' : '#b45309';
                      const statusBg = item.status === 'resolved' ? '#f0fdf4' : item.status === 'in_progress' ? '#eff6ff' : '#fffbeb';

                      return (
                        <div
                          key={item.id}
                          data-testid={`grievance-item-${item.tracking_number}`}
                          onClick={() => setSelectedGrievance(item)}
                          style={{
                            background: isSelected ? 'var(--color-accent-light)' : 'var(--color-bg)',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
                            borderRadius: '8px',
                            padding: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '12px', color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                              {item.tracking_number}
                            </strong>
                            <span style={{ fontSize: '11px', color: statusColor, fontWeight: 700, background: statusBg, padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize' }}>
                              {item.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {item.department}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Detailed Tracker View */}
              {selectedGrievance ? (
                <div
                  id="grievance-detail-card"
                  data-testid="grievance-detail-card"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {/* Header of Detail */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 800, background: 'var(--color-accent-light)', color: 'var(--color-accent)', padding: '3px 8px', borderRadius: '4px' }}>
                          {selectedGrievance.tracking_number}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {selectedGrievance.department}
                        </span>
                      </div>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '8px 0 0 0', color: 'var(--color-text-primary)' }}>
                        {selectedGrievance.title}
                      </h2>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        id="btn-read-aloud-status"
                        data-testid="btn-read-aloud-status"
                        onClick={handleReadAloudStatus}
                        className="btn btn-primary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>{isSpeaking ? '⏹️' : '🔊'}</span>
                        <span>{isSpeaking ? (isHi ? 'रोकें' : 'Stop') : (isHi ? 'स्थिति सुनें' : 'Read Aloud Status')}</span>
                      </button>

                      {selectedGrievance.status !== 'resolved' && (
                        <button
                          type="button"
                          id="btn-advance-status-demo"
                          data-testid="btn-advance-status-demo"
                          onClick={handleAdvanceStatus}
                          title="Simulate authority redressal progress (Demo Feature)"
                          style={{
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          ⚡ {isHi ? 'प्रगति सिमुलेशन' : 'Advance Stage'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4-Step Timeline Visualization */}
                  <div style={{ margin: '10px 0 16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                      {/* Connecting background bar */}
                      <div style={{ position: 'absolute', top: '14px', left: '20px', right: '20px', height: '3px', background: 'var(--color-border)', zIndex: 1 }} />
                      {/* Active progress bar */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '14px',
                          left: '20px',
                          width: `${(getStepIndex(selectedGrievance.status) / 3) * 90}%`,
                          height: '3px',
                          background: 'var(--color-accent)',
                          zIndex: 2,
                          transition: 'width 0.3s ease',
                        }}
                      />

                      {TIMELINE_STEPS.map((step, idx) => {
                        const currentIdx = getStepIndex(selectedGrievance.status);
                        const isCompleted = idx <= currentIdx;
                        const isCurrent = idx === currentIdx;

                        return (
                          <div key={step.key} style={{ zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: isCompleted ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                                border: isCompleted ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                                color: isCompleted ? '#ffffff' : 'var(--color-text-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 800,
                                boxShadow: isCurrent ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none',
                              }}
                            >
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-secondary)', marginTop: '6px', textAlign: 'center' }}>
                              {isHi ? step.labelHi : step.label}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: '2px', lineHeight: 1.2 }}>
                              {step.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grievance Details Box */}
                  <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                        {isHi ? 'विवरण (Description)' : 'Problem Description'}
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {selectedGrievance.description}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{isHi ? 'प्राथमिकता:' : 'Priority:'}</span>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                          {selectedGrievance.priority}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{isHi ? 'दर्ज करने की तिथि:' : 'Filed On:'}</span>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                          {new Date(selectedGrievance.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{isHi ? 'अद्यतन तिथि:' : 'Last Updated:'}</span>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                          {new Date(selectedGrievance.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {selectedGrievance.next_action && (
                      <div style={{ background: 'var(--color-accent-light)', border: '1px solid var(--color-accent-muted)', borderRadius: '6px', padding: '10px 12px' }}>
                        <strong style={{ fontSize: '12px', color: 'var(--color-accent)' }}>
                          🎯 {isHi ? 'अगली अपेक्षित कार्रवाई (Next Action):' : 'Next Action:'}
                        </strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-primary)' }}>
                          {selectedGrievance.next_action}
                        </p>
                      </div>
                    )}

                    {selectedGrievance.resolution_notes && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 12px' }}>
                        <strong style={{ fontSize: '12px', color: '#15803d' }}>
                          ✅ {isHi ? 'समाधान विवरण (Resolution Notes):' : 'Resolution Notes:'}
                        </strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#14532d' }}>
                          {selectedGrievance.resolution_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--color-bg-secondary)', border: '1px dashed var(--color-border)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                  {isHi ? 'विवरण देखने के लिए बाईं सूची से कोई शिकायत चुनें।' : 'Select a grievance from the list to view tracking timeline.'}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FILE GRIEVANCE FORM */}
          {activeTab === 'file' && (
            <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--color-text-primary)' }}>
                📝 {isHi ? 'आधिकारिक शिकायत दर्ज करें' : 'File an Official Civic Grievance'}
              </h2>

              {formSuccess && (
                <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
                  🎉 {isHi ? 'शिकायत सफलतापूर्वक दर्ज हुई! ट्रैकिंग आईडी:' : 'Grievance submitted successfully! Tracking ID:'} {formSuccess}
                </div>
              )}

              {formError && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', marginBottom: '16px', fontSize: '13px' }}>
                  ⚠️ {formError}
                </div>
              )}

              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                      {isHi ? 'संबंधित विभाग चुनें *' : 'Select Concerned Department *'}
                    </label>
                    <select
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d.id} value={d.id}>
                          {isHi ? d.labelHi : d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                      {isHi ? 'प्राथमिकता (Priority)' : 'Priority Level'}
                    </label>
                    <select
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      <option value="low">Low (सामान्य)</option>
                      <option value="medium">Medium (मध्यम)</option>
                      <option value="high">High (उच्च)</option>
                      <option value="urgent">Urgent (अति आवश्यक)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    {isHi ? 'शिकायत का शीर्षक (Subject) *' : 'Grievance Title / Subject *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isHi ? 'उदा. सेक्टर 14 में 3 दिन से बिजली आपूर्ति बाधित' : 'e.g. Unscheduled power outages in Sector 14'}
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text-primary)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    {isHi ? 'समस्या का विस्तृत विवरण *' : 'Detailed Description of the Issue *'}
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder={isHi ? 'समस्या की पूरी जानकारी, स्थान, दिनांक तथा पूर्व में की गई शिकायतों का विवरण लिखें...' : 'Provide complete details of the issue, affected locality, duration, and previous complaint references...'}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text-primary)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                    {isHi ? 'सहायक दस्तावेज़ या फ़ोटो (वैकल्पिक)' : 'Supporting Document or Photo (Optional)'}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px dashed var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                    }}
                  />
                  {attachment && (
                    <span style={{ fontSize: '11px', color: 'var(--color-accent)', marginTop: '4px', display: 'inline-block' }}>
                      📎 {attachment.name}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{
                      padding: '12px 28px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting
                      ? (isHi ? 'दर्ज हो रहा है...' : 'Submitting Grievance...')
                      : (isHi ? '✅ शिकायत दर्ज करें और ट्रैकिंग आईडी प्राप्त करें' : '✅ Register Grievance & Get Tracking ID')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
  );
}

export default function GrievancesPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading Grievance Portal...</p>
        </div>
      }
    >
      <GrievancesContent />
    </Suspense>
  );
}
