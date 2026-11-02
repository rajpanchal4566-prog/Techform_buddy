'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import {
  SUPPORTED_LANGUAGES,
  speakText,
  stopSpeaking,
  formatFormOverviewSpeech,
  getLocalizedMessage,
  getDefaultLanguage,
  parseVoiceCommand,
  analyzeFormFields,
} from '@/lib/speech';
import { downloadFormAsDocument } from '@/lib/downloadForm';
import '../browser/browser.css';

interface DemoField {
  name: string;
  label: string;
  type: string;
  value: string;
  required: boolean;
  section?: 'personal' | 'identity' | 'address' | 'scheme';
}

const DEMO_TEMPLATES: { id: string; name: string; description: string; fields: DemoField[] }[] = [
  {
    id: 'passport',
    name: 'Passport Application (Practice)',
    description: 'Practice completing personal, identity and residential address fields for passport services.',
    fields: [
      { name: 'fullName', label: 'Applicant Given Name', type: 'text', value: '', required: true, section: 'personal' },
      { name: 'surname', label: 'Surname', type: 'text', value: '', required: false, section: 'personal' },
      { name: 'dob', label: 'Date of Birth', type: 'date', value: '', required: true, section: 'personal' },
      { name: 'gender', label: 'Gender', type: 'text', value: '', required: true, section: 'personal' },
      { name: 'email', label: 'Email ID', type: 'email', value: '', required: true, section: 'identity' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', value: '', required: true, section: 'identity' },
      { name: 'aadhaar', label: 'Aadhaar Number', type: 'text', value: '', required: true, section: 'identity' },
      { name: 'address', label: 'Present Residential Address', type: 'textarea', value: '', required: true, section: 'address' },
      { name: 'policeStation', label: 'Police Station Jurisdiction', type: 'text', value: '', required: true, section: 'address' },
      { name: 'emergencyContact', label: 'Emergency Contact Person & Phone', type: 'text', value: '', required: true, section: 'scheme' },
    ],
  },
  {
    id: 'driving',
    name: 'Driving Licence Application (Practice)',
    description: 'Practice filling guardian details, vehicle category and permanent address.',
    fields: [
      { name: 'fullName', label: 'Applicant Full Name', type: 'text', value: '', required: true, section: 'personal' },
      { name: 'fatherName', label: "Father / Guardian's Name", type: 'text', value: '', required: true, section: 'personal' },
      { name: 'dob', label: 'Date of Birth', type: 'date', value: '', required: true, section: 'personal' },
      { name: 'bloodGroup', label: 'Blood Group', type: 'text', value: '', required: true, section: 'personal' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', value: '', required: true, section: 'identity' },
      { name: 'email', label: 'Email Address', type: 'email', value: '', required: false, section: 'identity' },
      { name: 'aadhaar', label: 'Aadhaar Number', type: 'text', value: '', required: true, section: 'identity' },
      { name: 'vehicleClass', label: 'Vehicle Class (e.g. LMV / MCWG)', type: 'text', value: '', required: true, section: 'scheme' },
      { name: 'rtoOffice', label: 'RTO Office Jurisdiction', type: 'text', value: '', required: true, section: 'address' },
      { name: 'address', label: 'Permanent Address', type: 'textarea', value: '', required: true, section: 'address' },
    ],
  },
  {
    id: 'pan',
    name: 'Instant PAN Application (Practice)',
    description: 'Practice filling personal details and Aadhaar-linked identity information.',
    fields: [
      { name: 'fullName', label: 'Full Name as per Aadhaar', type: 'text', value: '', required: true, section: 'personal' },
      { name: 'fatherName', label: "Father's Full Name", type: 'text', value: '', required: true, section: 'personal' },
      { name: 'dob', label: 'Date of Birth', type: 'date', value: '', required: true, section: 'personal' },
      { name: 'gender', label: 'Gender', type: 'text', value: '', required: true, section: 'personal' },
      { name: 'aadhaar', label: 'Aadhaar Number (e-KYC)', type: 'text', value: '', required: true, section: 'identity' },
      { name: 'phone', label: 'Mobile Number (Aadhaar Linked)', type: 'tel', value: '', required: true, section: 'identity' },
      { name: 'email', label: 'Email Address', type: 'email', value: '', required: true, section: 'identity' },
      { name: 'address', label: 'Delivery Address', type: 'textarea', value: '', required: true, section: 'address' },
    ],
  },
  {
    id: 'scholarship',
    name: 'Student Scholarship (Practice)',
    description: 'Practice student registration, academic institution, and contact details.',
    fields: [
      { name: 'fullName', label: 'Student Full Name', type: 'text', value: '', required: true, section: 'personal' },
      { name: 'fatherName', label: "Father / Guardian's Name", type: 'text', value: '', required: true, section: 'personal' },
      { name: 'dob', label: 'Date of Birth', type: 'date', value: '', required: true, section: 'personal' },
      { name: 'email', label: 'Email Address', type: 'email', value: '', required: true, section: 'identity' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', value: '', required: true, section: 'identity' },
      { name: 'aadhaar', label: 'Aadhaar Number', type: 'text', value: '', required: true, section: 'identity' },
      { name: 'college', label: 'Institution / College Name', type: 'text', value: '', required: true, section: 'scheme' },
      { name: 'course', label: 'Course / Degree Name', type: 'text', value: '', required: true, section: 'scheme' },
      { name: 'address', label: 'Residential Address', type: 'textarea', value: '', required: true, section: 'address' },
    ],
  },
];

export default function DemoPortalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('passport');
  const [fields, setFields] = useState<DemoField[]>(DEMO_TEMPLATES[0].fields);
  const [language, setLanguage] = useState('en');
  const [submitted, setSubmitted] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState('');
  const [autoFillFlash, setAutoFillFlash] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [photoInfo, setPhotoInfo] = useState<{ name: string; sizeKb: number; valid: boolean } | null>(null);
  const [sigInfo, setSigInfo] = useState<{ name: string; sizeKb: number; valid: boolean } | null>(null);
  const [docInfo, setDocInfo] = useState<{ name: string; sizeKb: number; valid: boolean } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLanguage(getDefaultLanguage());
    }
    return () => {
      stopSpeaking();
    };
  }, []);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = DEMO_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      setFields(tmpl.fields.map(f => ({ ...f, value: '' })));
      setSubmitted(false);
      setCommandFeedback(`Loaded ${tmpl.name}`);
    }
  };

  const updateField = (name: string, value: string) => {
    setFields(prev => prev.map(f => (f.name === name ? { ...f, value } : f)));
  };

  // Auto-Fill from Profile
  const handleAutoFill = async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) {
        setCommandFeedback('Could not access user profile.');
        return;
      }
      const profile = await res.json();
      let customMap: Record<string, string> = {};
      if (profile.custom_fields) {
        try {
          customMap = typeof profile.custom_fields === 'string' ? JSON.parse(profile.custom_fields) : profile.custom_fields;
        } catch {
          customMap = {};
        }
      }

      const profileData: Record<string, string> = {
        name: profile.name || '',
        full_name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        mobile: profile.phone || '',
        aadhaar: profile.aadhaar || '',
        pan: profile.pan || '',
        address: profile.address || '',
        date_of_birth: profile.date_of_birth || '',
        dob: profile.date_of_birth || '',
        gender: profile.gender || '',
        father_name: profile.father_name || '',
        mother_name: profile.mother_name || '',
        blood_group: profile.blood_group || '',
        city: profile.city || '',
        state: profile.state || '',
        pincode: profile.pincode || '',
        ...customMap,
      };

      const analysis = analyzeFormFields(
        fields.map(f => ({ name: f.name, label: f.label, type: f.type, required: f.required })),
        profileData
      );

      let count = 0;
      setFields(prev =>
        prev.map(f => {
          const matched = analysis.find(a => a.fieldName === f.name);
          if (matched && matched.canFill && matched.value) {
            count++;
            return { ...f, value: matched.value };
          }
          return f;
        })
      );

      setAutoFillFlash(true);
      setTimeout(() => setAutoFillFlash(false), 2000);
      setCommandFeedback(`✓ Auto-filled ${count} fields from your verified profile.`);
    } catch (err) {
      console.error('Auto-fill error:', err);
      setCommandFeedback('Error performing auto-fill.');
    }
  };

  const handleClear = () => {
    setFields(prev => prev.map(f => ({ ...f, value: '' })));
    setSubmitted(false);
    setCommandFeedback('Cleared all fields.');
  };

  const handleReadAloud = () => {
    const script = formatFormOverviewSpeech(
      DEMO_TEMPLATES.find(t => t.id === selectedTemplateId)?.name || 'Demo Form',
      fields.map(f => ({ label: f.label, type: f.type, required: f.required })),
      language
    );
    speakText(script, language);
    setCommandFeedback('Reading form fields aloud...');
  };

  const handleDownload = () => {
    const currentTmpl = DEMO_TEMPLATES.find(t => t.id === selectedTemplateId);
    downloadFormAsDocument(
      currentTmpl?.name || 'Practice Form',
      fields.map(f => ({ label: f.label, value: f.value, required: f.required, section: f.section })),
      'Demo Practice Form',
      submitted ? 'submitted' : 'draft',
      'TechForm Demo Portal'
    );
  };

  // Submit (demo only)
  const handleSubmitDemo = () => {
    setSubmitted(true);
    setCommandFeedback('✓ Demo form submitted successfully! Note: No data was transmitted to any government department.');
  };

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading Demo Portal...</p>
      </div>
    );
  }

  useAppHeader({
    title: 'Interactive Practice Portal',
    subtitle: 'Practice completing forms in a safe, simulated environment.',
  });

  const currentTemplate = DEMO_TEMPLATES.find(t => t.id === selectedTemplateId);
  const filledCount = fields.filter(f => f.value && f.value.trim() !== '').length;

  return (
    <div>
      {/* MANDATORY PERMANENT DEMO BANNER */}
        <div
          id="demo-portal-banner"
          style={{
            background: '#eff6ff',
            border: '2px solid #3b82f6',
            color: '#1e40af',
            padding: '14px 20px',
            borderRadius: '10px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.08)',
          }}
        >
          <span style={{ fontSize: '20px' }}>🧪</span>
          <span>Demo form only. Not a government website. Data is not sent to any department.</span>
        </div>

        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              TechForm Demo Portal (Practice Form)
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Safely practice form-filling, auto-fill, and voice recognition in an isolated sandbox environment.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Language:
            </label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
            >
              {SUPPORTED_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Template Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {DEMO_TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              onClick={() => handleSelectTemplate(tmpl.id)}
              className={`btn btn-sm ${selectedTemplateId === tmpl.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              {tmpl.name}
            </button>
          ))}
        </div>

        {/* Quick Actions Bar */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            padding: '12px 18px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Sandbox Actions:
            </span>
            <button className="btn btn-sm btn-secondary" onClick={handleAutoFill}>
              ⚡ Auto-Fill from Profile
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleClear}>
              🗑️ Clear Fields
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleReadAloud}>
              🔊 Read Form Aloud
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleDownload}>
              📥 Download Form (PDF)
            </button>
          </div>

          <div>
            {/* RENAME TO 'Submit (demo only)' */}
            <button
              id="submit-demo-btn"
              className="btn btn-sm btn-primary"
              onClick={handleSubmitDemo}
              style={{ fontWeight: 600 }}
            >
              🚀 Submit (demo only)
            </button>
          </div>
        </div>

        {commandFeedback && (
          <div
            style={{
              background: '#fef3c7',
              color: '#92400e',
              padding: '8px 16px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '13px',
              border: '1px solid #fde68a',
            }}
          >
            {commandFeedback}
          </div>
        )}

        {/* Success Modal / Banner upon demo submission */}
        {submitted && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              color: '#166534',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
              ✓ Demo Submission Successful!
            </div>
            <div style={{ fontSize: '13px', color: '#15803d' }}>
              This was an isolated practice session on TechForm Demo Portal. No actual application was transmitted.
              You can now review your answers, download a formatted paper copy, or practice again.
            </div>
          </div>
        )}

        {/* Form Canvas */}
        <div
          className={`card ${autoFillFlash ? 'flash-highlight' : ''}`}
          style={{
            padding: '28px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{currentTemplate?.name}</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {currentTemplate?.description}
              </p>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Progress: <strong>{filledCount} of {fields.length}</strong> fields filled
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {fields.map(field => (
              <div
                key={field.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: 'var(--color-background)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                    {field.section}
                  </span>
                </div>

                {field.type === 'textarea' ? (
                  <textarea
                    className="input"
                    value={field.value}
                    onChange={e => updateField(field.name, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    rows={2}
                    style={{ fontSize: '13px' }}
                  />
                ) : (
                  <input
                    className="input"
                    type={field.type}
                    value={field.value}
                    onChange={e => updateField(field.name, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    style={{ fontSize: '13px' }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Document & Photo Upload Slots (Requirement E) */}
          <div style={{ marginTop: '28px', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
              📎 Document & Photo Uploads (Demo Portal Practice)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Test TechForm Buddy extension attachment or manual selection. Limits match government portals.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Photo Slot */}
              <div style={{ background: 'var(--color-background)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <label htmlFor="portal-photo-input" style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Applicant Photograph <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>(Max 100 KB, JPG/PNG)</span>
                </label>
                <input
                  id="portal-photo-input"
                  name="applicant_photo"
                  type="file"
                  accept="image/jpeg,image/png"
                  data-testid="portal-photo-input"
                  className="input"
                  style={{ fontSize: '12px', padding: '6px' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const sizeKb = Math.round(f.size / 1024);
                      setPhotoInfo({ name: f.name, sizeKb, valid: sizeKb <= 100 });
                    } else {
                      setPhotoInfo(null);
                    }
                  }}
                />
                {photoInfo && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: photoInfo.valid ? '#10b981' : '#ef4444' }}>
                    {photoInfo.valid ? `✓ Attached: ${photoInfo.name} (${photoInfo.sizeKb} KB)` : `⚠️ Exceeds 100 KB limit (${photoInfo.sizeKb} KB)`}
                  </div>
                )}
              </div>

              {/* Signature Slot */}
              <div style={{ background: 'var(--color-background)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <label htmlFor="portal-signature-input" style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Applicant Signature <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>(Max 50 KB, JPG/PNG)</span>
                </label>
                <input
                  id="portal-signature-input"
                  name="applicant_signature"
                  type="file"
                  accept="image/jpeg,image/png"
                  data-testid="portal-signature-input"
                  className="input"
                  style={{ fontSize: '12px', padding: '6px' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const sizeKb = Math.round(f.size / 1024);
                      setSigInfo({ name: f.name, sizeKb, valid: sizeKb <= 50 });
                    } else {
                      setSigInfo(null);
                    }
                  }}
                />
                {sigInfo && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: sigInfo.valid ? '#10b981' : '#ef4444' }}>
                    {sigInfo.valid ? `✓ Attached: ${sigInfo.name} (${sigInfo.sizeKb} KB)` : `⚠️ Exceeds 50 KB limit (${sigInfo.sizeKb} KB)`}
                  </div>
                )}
              </div>

              {/* Document / Marksheet Slot */}
              <div style={{ background: 'var(--color-background)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <label htmlFor="portal-document-input" style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Supporting Document / Marksheet <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>(Max 2 MB, PDF/Image)</span>
                </label>
                <input
                  id="portal-document-input"
                  name="supporting_document"
                  type="file"
                  accept="application/pdf,image/*"
                  data-testid="portal-document-input"
                  className="input"
                  style={{ fontSize: '12px', padding: '6px' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const sizeKb = Math.round(f.size / 1024);
                      setDocInfo({ name: f.name, sizeKb, valid: sizeKb <= 2048 });
                    } else {
                      setDocInfo(null);
                    }
                  }}
                />
                {docInfo && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: docInfo.valid ? '#10b981' : '#ef4444' }}>
                    {docInfo.valid ? `✓ Attached: ${docInfo.name} (${docInfo.sizeKb} KB)` : `⚠️ Exceeds 2 MB limit (${docInfo.sizeKb} KB)`}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={handleClear}>
              Reset Form
            </button>
            <button className="btn btn-primary" onClick={handleSubmitDemo}>
              Submit (demo only)
            </button>
          </div>
        </div>
    </div>
  );
}
