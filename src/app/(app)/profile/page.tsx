'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import PasswordSecurityCard from '@/components/PasswordSecurityCard';
import {
  SUPPORTED_LANGUAGES,
  speakText,
  getDefaultLanguage,
  setDefaultLanguage,
  getLocalizedMessage,
} from '@/lib/speech';
import './profile.css';

interface ProfileData {
  full_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  father_name: string;
  mother_name: string;
  blood_group: string;
  emergency_contact: string;
  marital_status: string;
  occupation: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '', date_of_birth: '', gender: '', phone: '', email: '',
    address: '', city: '', state: '', pincode: '', country: '',
    father_name: '', mother_name: '', blood_group: '', emergency_contact: '',
    marital_status: '', occupation: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [language, setLanguage] = useState('en');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Load default language from settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = getDefaultLanguage();
      setLanguage(savedLang);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchProfile();
  }, [status]);

  const fetchProfile = async () => {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const data = await res.json();
      setProfile({
        full_name: data.full_name || '',
        date_of_birth: data.date_of_birth || '',
        gender: data.gender || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        country: data.country || '',
        father_name: data.father_name || '',
        mother_name: data.mother_name || '',
        blood_group: data.blood_group || '',
        emergency_contact: data.emergency_contact || '',
        marital_status: data.marital_status || '',
        occupation: data.occupation || '',
      });
      if (data.preferred_language) {
        setLanguage(data.preferred_language);
        setDefaultLanguage(data.preferred_language);
      }
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      // Save language preference to localStorage as the app-wide default
      setDefaultLanguage(language);

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, preferred_language: language }),
      });
      if (res.ok) {
        setSaved(true);
        // Speak confirmation in the CHOSEN language
        const msg = getLocalizedMessage('saved', language);
        speakText(msg, language);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (newLang: string) => {
    setLanguage(newLang);
    // Immediately save to localStorage so other pages pick it up
    setDefaultLanguage(newLang);

    // Provide immediate spoken feedback in the chosen language!
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === newLang);
    const greetingMap: Record<string, string> = {
      en: 'Language set to English.',
      hi: 'भाषा हिंदी चुनी गई है।',
      ta: 'தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது.',
      te: 'తెలుగు భాష ఎంపిక చేయబడింది.',
      bn: 'বাংলা ভাষা নির্বাচিত হয়েছে।',
      mr: 'मराठी भाषा निवडली गेली आहे.',
      gu: 'ગુજરાતી ભાષા પસંદ કરવામાં આવી છે.',
      kn: 'ಕನ್ನಡ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ.',
      ml: 'മലയാളം ഭാഷ തിരഞ്ഞെടുത്തു.',
      pa: 'ਪੰਜਾਬੀ ਭਾਸ਼ਾ ਚੁਣੀ ਗਈ ਹੈ।',
      ur: 'اردو زبان منتخب کی گئی ہے۔',
      es: 'Idioma español seleccionado.',
      fr: 'Langue française sélectionnée.',
      de: 'Deutsche Sprache ausgewählt.',
      ar: 'تم اختيار اللغة العربية.',
      zh: '已选择中文。',
      ja: '日本語が選択されました。',
    };
    const voiceMsg = greetingMap[newLang] || `Language set to ${langObj?.label || newLang}`;
    speakText(voiceMsg, newLang);

    // Immediately persist to backend database
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_language: newLang }),
      });
    } catch (e) {
      console.error('Failed to persist language preference:', e);
    }
  };

  const updateField = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  useAppHeader({
    title: 'Profile',
    subtitle: 'Your info is used to auto-fill forms. Language preference applies app-wide.',
    actions: (
      <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
      </button>
    ),
  });

  return (
    <div className="profile-content animate-fadeIn">
          {saved && (
            <div className="save-toast animate-slideUp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>
              Profile saved — Language set to {SUPPORTED_LANGUAGES.find(l => l.code === language)?.label || language}
            </div>
          )}

          {/* Language Preference Section */}
          <section className="profile-section card">
            <h2>🌐 Language Preference</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-md)' }}>
              This language becomes the default for the entire app — voice, speech, forms, and assistant.
            </p>
            <div className="profile-grid">
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="input-label">Preferred Language</label>
                <select
                  className="input"
                  value={language}
                  onChange={e => handleLanguageChange(e.target.value)}
                  style={{ fontWeight: 600, fontSize: '15px' }}
                >
                  {SUPPORTED_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      {l.label === l.nativeName ? l.label : `${l.label} (${l.nativeName})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="profile-section card">
            <h2>Personal Information</h2>
            <div className="profile-grid">
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input className="input" value={profile.full_name} onChange={e => updateField('full_name', e.target.value)} placeholder="Your full name" />
              </div>
              <div className="input-group">
                <label className="input-label">Father&apos;s Name</label>
                <input className="input" value={profile.father_name} onChange={e => updateField('father_name', e.target.value)} placeholder="Father's full name" />
              </div>
              <div className="input-group">
                <label className="input-label">Mother&apos;s Name</label>
                <input className="input" value={profile.mother_name} onChange={e => updateField('mother_name', e.target.value)} placeholder="Mother's full name" />
              </div>
              <div className="input-group">
                <label className="input-label">Date of Birth</label>
                <input className="input" type="date" value={profile.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Gender</label>
                <select className="input" value={profile.gender} onChange={e => updateField('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Marital Status</label>
                <select className="input" value={profile.marital_status} onChange={e => updateField('marital_status', e.target.value)}>
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Blood Group</label>
                <select className="input" value={profile.blood_group} onChange={e => updateField('blood_group', e.target.value)}>
                  <option value="">Select</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Phone</label>
                <input className="input" type="tel" value={profile.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+91 XXXXXXXXXX" />
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input className="input" type="email" value={profile.email} onChange={e => updateField('email', e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="input-group">
                <label className="input-label">Occupation</label>
                <input className="input" value={profile.occupation} onChange={e => updateField('occupation', e.target.value)} placeholder="e.g. Software Engineer, Teacher" />
              </div>
              <div className="input-group">
                <label className="input-label">Emergency Contact</label>
                <input className="input" value={profile.emergency_contact} onChange={e => updateField('emergency_contact', e.target.value)} placeholder="Name (+91 XXXXXXXXXX)" />
              </div>
            </div>
          </section>

          <section className="profile-section card">
            <h2>Address</h2>
            <div className="profile-grid">
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="input-label">Address</label>
                <input className="input" value={profile.address} onChange={e => updateField('address', e.target.value)} placeholder="Street address" />
              </div>
              <div className="input-group">
                <label className="input-label">City</label>
                <input className="input" value={profile.city} onChange={e => updateField('city', e.target.value)} placeholder="City" />
              </div>
              <div className="input-group">
                <label className="input-label">State</label>
                <input className="input" value={profile.state} onChange={e => updateField('state', e.target.value)} placeholder="State" />
              </div>
              <div className="input-group">
                <label className="input-label">Pincode</label>
                <input className="input" value={profile.pincode} onChange={e => updateField('pincode', e.target.value)} placeholder="Pincode" />
              </div>
              <div className="input-group">
                <label className="input-label">Country</label>
                <input className="input" value={profile.country} onChange={e => updateField('country', e.target.value)} placeholder="Country" />
              </div>
            </div>
          </section>

          <PasswordSecurityCard userEmail={profile.email || session?.user?.email || ''} />

          <section className="profile-section card" style={{ borderLeft: '4px solid #10b981' }}>
            <h2>Privacy & Security Architecture</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-md)' }}>
              Strict Zero-Storage Guarantee for Sensitive Credentials
            </p>
            <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🛡️</span>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#10b981', fontWeight: 600 }}>Zero Sensitive Data Retention</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
                    TechForm Buddy never stores, logs, or auto-fills sensitive government identity numbers (Aadhaar, PAN, Passport, EPIC Voter ID) or bank account / card numbers.
                    When a government form requires these credentials, our assistant will clearly prompt: <strong>&ldquo;Please type this yourself.&rdquo;</strong>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
  );
}
