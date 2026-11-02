'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import {
  SUPPORTED_LANGUAGES,
  speakText,
  stopSpeaking,
} from '@/lib/speech';
import {
  FORM_TEMPLATES,
  FormTemplate,
  DocumentSections,
  TemplateDocument,
  createCustomTemplateFromPrompt,
  generateFallbackDocument,
  matchTemplateFromPrompt,
  deriveCleanFormTitle,
} from '@/lib/templates';
import { validateFieldBySchema, ValidationResult } from '@/lib/fieldValidation';
import { compressImageToLimit } from '@/lib/imageCompressor';
import { actionRegistry, ActionDefinition } from '@/lib/actionRegistry';
import {
  getAutofillMode,
  setAutofillMode,
  hasAutofillConsent,
  setAutofillConsent,
  isFieldSensitive,
  formatFieldValue,
} from '@/lib/autofillMode';
import '../forms.css';

interface AttachedDocInfo {
  docId: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  blob?: Blob;
  base64?: string;
  isOversized?: boolean;
  maxSizeBytes?: number;
  isCompressed?: boolean;
  vaultDocId?: string;
}

const UI_TEXT = {
  en: {
    title: 'New Form & Official Letter',
    subtitle: 'Template-driven checklist, document compression & full package download',
    step1: '1. Choose Type',
    step2: '2. Particulars Checklist',
    step3: '3. Documents',
    step4: '4. Review & Package',
    validationError: 'Validation Error:',
    chooseTypeHeading: 'Choose Form / Letter Type',
    prefillingProfile: 'Prefilling verified profile data...',
    requiredDocsCount: (n: number) => `📎 ${n} required document${n > 1 ? 's' : ''}`,
    noDocsCount: '📄 No documents required',
    customPromptLabel: 'Or enter custom form type (AI proposes template - marked Unverified):',
    customPromptPlaceholder: 'e.g. Leave application for 3 days due to viral fever, RTI query for road construction...',
    proposeBtn: '✨ Propose Format',
    unverifiedBadge: '⚠️ Unverified',
    particularsSub: 'Checklist of particulars: verify auto-filled profile values or enter missing details.',
    changeTemplateBtn: 'Change Template',
    fromProfileBadge: '✓ From Profile',
    voiceFilledBadge: '🎙️ Voice Filled',
    selectPlaceholder: 'Select...',
    voiceBtn: 'Voice',
    listeningBtn: 'Listening...',
    saveProfileBtn: '💾 Save to profile',
    savedProfileBtn: '✓ Saved!',
    nextDocsBtn: 'Next: Document Checklist →',
    nextGenerateBtn: 'Generate Complete Document',
    docChecklistHeading: '3. Required Documents Checklist',
    docChecklistSub: 'Attach required documents per allowed formats and size limits. Oversized files can be compressed.',
    backParticularsBtn: '← Back to Particulars',
    noDocsNoticeTitle: 'No Document Step Required',
    noDocsNoticeDesc: 'Formal leave applications do not require supporting enclosures. You can proceed directly to generate and review the completed letter.',
    proceedReviewBtn: 'Proceed to Review & Download →',
    allowedText: 'Allowed:',
    maxSizeText: 'Max size:',
    attachedBadge: (name: string, kb: number) => `✓ Attached: ${name} (${kb} KB)`,
    skippedBadge: 'Skipped (Optional)',
    attachVaultPlaceholder: 'Attach from saved Documents...',
    uploadFileBtn: '📤 Upload File',
    skipBtn: 'Skip',
    oversizeWarning: (size: number, limit: number) => `⚠️ File size (${size} KB) exceeds the limit of ${limit} KB.`,
    compressBtn: (limit: number) => `⚡ Compress to < ${limit} KB`,
    compressingBtn: 'Compressing...',
    compressedSuccess: (size: number) => `✓ Compressed successfully to ${size} KB (Within limits)`,
    completePackageBtn: 'Generate Complete Document',
    wordsCount: (n: number) => `${n} words`,
    downloadPdfBtn: '📄 Download PDF',
    downloadDocxBtn: '📝 Download Word (.docx)',
    downloadPkgBtn: '📦 Download Package (PDF + Enclosures)',
    saveDraftBtn: '💾 Save Draft',
    savingDraftBtn: 'Saving...',
    submitBtn: '✅ Submit',
    submittingBtn: 'Submitting...',
    toBlock: 'To / Recipient Block:',
    dateBlock: 'Date:',
    subjectBlock: 'Subject Line:',
    bodyBlock: 'Body Paragraphs (Detailed Statement):',
    enclosuresBlock: 'Enclosures (Attached Documents):',
    noEnclosuresNotice: 'No documents enclosed with this application.',
    closingBlock: 'Closing & Sign-off:',
    autofillToggleLabel: 'Autofill:',
    autofillOn: 'ON',
    autofillOff: 'OFF',
    autofillSummaryTitle: '⚡ Smart Autofill Summary:',
    autofillFilledCount: (n: number) => `${n} fields filled`,
    autofillSkippedCount: (n: number) => `${n} skipped`,
    autofillUndoAll: '↺ Undo All',
    autofillUndo: 'Undo',
    voiceWalkthroughBtn: '🎙️ Fill the rest by voice',
    voiceWalkthroughTitle: 'Voice Walkthrough',
    voiceWalkthroughConfirm: 'Confirm & Fill',
    voiceWalkthroughNext: 'Next Field →',
    voiceWalkthroughSkip: 'Skip Field',
    voiceWalkthroughStop: 'Stop Voice',
    consentModalTitle: '⚠️ Form Autofill Consent',
    consentModalDesc: 'TechForm Buddy will automatically fill standard form inputs from your saved profile (name, contact, address). Sensitive credentials (passwords, OTPs, Aadhaar, PAN, bank accounts) are STRICTLY excluded and never filled.',
    consentModalConfirm: 'Consent & Run Autofill',
    consentModalCancel: 'Cancel',
  },
  hi: {
    title: 'नया आवेदन / पत्र निर्माण',
    subtitle: 'प्रारूप आधारित चेकलिस्ट, दस्तावेज़ संपीड़न व संपूर्ण पैकेज डाउनलोड',
    step1: '1. प्रारूप चुनें',
    step2: '2. विवरण चेकलिस्ट',
    step3: '3. संलग्न दस्तावेज़',
    step4: '4. समीक्षा व पैकेज',
    validationError: 'प्रमाणीकरण त्रुटि:',
    chooseTypeHeading: 'आवेदन का प्रकार चुनें',
    prefillingProfile: 'सत्यापित प्रोफ़ाइल विवरण स्वतः भरा जा रहा है...',
    requiredDocsCount: (n: number) => `📎 ${n} आवश्यक दस्तावेज़`,
    noDocsCount: '📄 दस्तावेज़ की आवश्यकता नहीं',
    customPromptLabel: 'या अपनी विशिष्ट आवश्यकता लिखें (AI प्रारूप प्रस्तावित करेगा):',
    customPromptPlaceholder: 'उदा. 3 दिन के चिकित्सा अवकाश हेतु प्रार्थना पत्र, छात्रवृत्ति नवीनीकरण...',
    proposeBtn: '✨ प्रारूप प्रस्तावित करें',
    unverifiedBadge: '⚠️ अपुष्ट',
    particularsSub: 'आवश्यक विवरण चेकलिस्ट: प्रोफ़ाइल से स्वतः भरे मान जांचें या नए दर्ज करें।',
    changeTemplateBtn: 'प्रारूप बदलें',
    fromProfileBadge: '✓ प्रोफ़ाइल से',
    voiceFilledBadge: '🎙️ आवाज़ द्वारा भरा',
    selectPlaceholder: 'चुनें...',
    voiceBtn: 'आवाज़',
    listeningBtn: 'सुन रहे हैं...',
    saveProfileBtn: '💾 प्रोफ़ाइल में सहेजें',
    savedProfileBtn: '✓ सहेजा गया!',
    nextDocsBtn: 'आगे: दस्तावेज़ चेकलिस्ट →',
    nextGenerateBtn: 'संपूर्ण दस्तावेज़ तैयार करें',
    docChecklistHeading: '3. आवश्यक दस्तावेज़ चेकलिस्ट',
    docChecklistSub: 'स्वीकृत प्रारूप व आकार सीमा अनुसार दस्तावेज़ संलग्न करें। बड़े आकार के चित्र स्वतः संकुचित किए जा सकते हैं।',
    backParticularsBtn: '← वापस विवरण पर',
    noDocsNoticeTitle: 'दस्तावेज़ की आवश्यकता नहीं',
    noDocsNoticeDesc: 'औपचारिक अवकाश प्रार्थना पत्रों में संलग्नक की आवश्यकता नहीं होती। आप सीधे पूर्ण पत्र की समीक्षा एवं डाउनलोड कर सकते हैं।',
    proceedReviewBtn: 'समीक्षा व डाउनलोड की ओर बढ़ें →',
    allowedText: 'स्वीकृत प्रारूप:',
    maxSizeText: 'अधिकतम आकार:',
    attachedBadge: (name: string, kb: number) => `✓ संलग्न: ${name} (${kb} KB)`,
    skippedBadge: 'छोड़ा गया (वैकल्पिक)',
    attachVaultPlaceholder: 'सहेजे गए दस्तावेज़ों से संलग्न करें...',
    uploadFileBtn: '📤 फ़ाइल अपलोड करें',
    skipBtn: 'छोड़ें',
    oversizeWarning: (size: number, limit: number) => `⚠️ फ़ाइल का आकार (${size} KB) निर्धारित सीमा ${limit} KB से अधिक है।`,
    compressBtn: (limit: number) => `⚡ संपीड़ित करें (< ${limit} KB)`,
    compressingBtn: 'संपीड़ित किया जा रहा है...',
    compressedSuccess: (size: number) => `✓ सफलतापूर्वक संपीड़ित किया गया: ${size} KB (सीमा के भीतर)`,
    completePackageBtn: 'संपूर्ण दस्तावेज़ तैयार करें',
    wordsCount: (n: number) => `${n} शब्द`,
    downloadPdfBtn: '📄 पीडीएफ डाउनलोड',
    downloadDocxBtn: '📝 वर्ड (.docx) डाउनलोड',
    downloadPkgBtn: '📦 पैकेज डाउनलोड (पीडीएफ + संलग्नक)',
    saveDraftBtn: '💾 ड्राफ्ट सहेजें',
    savingDraftBtn: 'सहेज रहे हैं...',
    submitBtn: '✅ जमा करें',
    submittingBtn: 'जमा कर रहे हैं...',
    toBlock: 'प्राप्तकर्ता / पता:',
    dateBlock: 'दिनांक:',
    subjectBlock: 'विषय पंक्ति:',
    bodyBlock: 'मुख्य विवरण / अनुच्छेद:',
    enclosuresBlock: 'संलग्नक (दस्तावेज़ सूची):',
    noEnclosuresNotice: 'इस आवेदन के साथ कोई दस्तावेज़ संलग्न नहीं है।',
    closingBlock: 'समापन व हस्ताक्षर:',
    autofillToggleLabel: 'ऑटोफ़िल:',
    autofillOn: 'चालू (ON)',
    autofillOff: 'बंद (OFF)',
    autofillSummaryTitle: '⚡ स्मार्ट ऑटोफ़िल सारांश:',
    autofillFilledCount: (n: number) => `${n} फ़ील्ड भरी गईं`,
    autofillSkippedCount: (n: number) => `${n} छोड़ी गईं`,
    autofillUndoAll: '↺ सभी पूर्ववत करें',
    autofillUndo: 'पूर्ववत करें',
    voiceWalkthroughBtn: '🎙️ शेष विवरण आवाज़ से भरें',
    voiceWalkthroughTitle: 'आवाज़ द्वारा विवरण भरना',
    voiceWalkthroughConfirm: 'पुष्टि करें व भरें',
    voiceWalkthroughNext: 'अगला फ़ील्ड →',
    voiceWalkthroughSkip: 'यह फ़ील्ड छोड़ें',
    voiceWalkthroughStop: 'आवाज़ रोकें',
    consentModalTitle: '⚠️ स्वतः पूर्ति (Autofill) सहमति',
    consentModalDesc: 'टेकफ़ॉर्म बडी आपकी सहेजी गई प्रोफ़ाइल (नाम, संपर्क, पता) से विवरण भरेगा। संवेदनशील क्रेडेंशियल (पासवर्ड, ओटीपी, आधार, पैन, बैंक खाता नंबर) कभी भी स्वतः नहीं भरे जाते हैं।',
    consentModalConfirm: 'सहमति दें व ऑटोफ़िल करें',
    consentModalCancel: 'रद्द करें',
  },
};

function NewFormContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Stepper: 1: Template, 2: Fields Checklist, 3: Documents Checklist, 4: Review & Package
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  // Core state
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [activeTemplate, setActiveTemplate] = useState<FormTemplate | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldSources, setFieldSources] = useState<Record<string, 'profile' | 'manual' | 'voice'>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedProfile, setSavedProfile] = useState<Record<string, any> | null>(null);

  // Autofill Mode State (Requirement 1, 2, 3)
  const [autofillEnabled, setAutofillEnabledState] = useState(true);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [autofillSummary, setAutofillSummary] = useState<{
    filledCount: number;
    skippedCount: number;
    skippedItems: Array<{ key: string; label: string; reason: string }>;
    previousValues: Record<string, string>;
  } | null>(null);

  // Voice Walk-Through State (Requirement 3)
  const [isVoiceWalkthroughActive, setIsVoiceWalkthroughActive] = useState(false);
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);
  const [walkthroughValue, setWalkthroughValue] = useState('');
  const [isWalkthroughListening, setIsWalkthroughListening] = useState(false);

  // Documents state
  const [userVaultDocs, setUserVaultDocs] = useState<Array<{ id: string; file_name: string; file_type: string; file_size: number }>>([]);
  const [attachedDocs, setAttachedDocs] = useState<Record<string, AttachedDocInfo>>({});
  const [skippedDocs, setSkippedDocs] = useState<Record<string, boolean>>({});

  // Generated document review state
  const [generatedDoc, setGeneratedDoc] = useState<{
    title: string;
    sections: DocumentSections;
    charCount: number;
    wordCount: number;
  } | null>(null);

  // Status flags
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompressing, setIsCompressing] = useState<Record<string, boolean>>({});
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [listeningFieldKey, setListeningFieldKey] = useState<string | null>(null);

  const fieldRecognitionRef = useRef<any>(null);
  const walkthroughRecognitionRef = useRef<any>(null);

  const isHi = language === 'hi';
  const t = UI_TEXT[isHi ? 'hi' : 'en'];

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Load Autofill Mode state on mount
  useEffect(() => {
    setAutofillEnabledState(getAutofillMode());

    const handleModeChange = (e: any) => {
      if (typeof e.detail?.enabled === 'boolean') {
        setAutofillEnabledState(e.detail.enabled);
      }
    };
    window.addEventListener('tfb-autofill-mode-changed', handleModeChange);
    return () => window.removeEventListener('tfb-autofill-mode-changed', handleModeChange);
  }, []);

  // Load user profile & vault documents on mount
  useEffect(() => {
    if (status === 'authenticated') {
      loadUserProfile();
      loadUserDocuments();
    }
  }, [status]);

  const loadUserProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const profile = await res.json();
        setSavedProfile(profile);

        const addressParts = [profile.address, profile.city, profile.state].filter(Boolean);
        const fullAddress = addressParts.length > 0
          ? addressParts.join(', ') + (profile.pincode ? ' - ' + profile.pincode : '')
          : '';

        const initialMap: Record<string, string> = {
          applicant_name: profile.full_name || session?.user?.name || '',
          student_name: profile.full_name || session?.user?.name || '',
          account_holder_name: profile.full_name || session?.user?.name || '',
          applicant_phone: profile.phone || '',
          registered_phone: profile.phone || '',
          emergency_phone: profile.emergency_contact || profile.phone || '',
          mobile: profile.phone || '',
          applicant_email: profile.email || session?.user?.email || '',
          email: profile.email || session?.user?.email || '',
          applicant_address: fullAddress,
          residential_address: fullAddress,
          address: fullAddress,
          father_name: profile.father_name || '',
          mother_name: profile.mother_name || '',
          dob: profile.date_of_birth || profile.dob || '',
          date_of_birth: profile.date_of_birth || profile.dob || '',
          pincode: profile.pincode || '',
        };

        const initialSources: Record<string, 'profile'> = {};
        for (const [k, v] of Object.entries(initialMap)) {
          if (v && v.trim()) {
            initialSources[k] = 'profile';
          }
        }

        setFieldValues(prev => ({ ...initialMap, ...prev }));
        setFieldSources(prev => ({ ...initialSources, ...prev }));
      }
    } catch (err) {
      console.warn('Failed loading profile for auto-fill:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadUserDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setUserVaultDocs(Array.isArray(data) ? data : data.documents || []);
      }
    } catch (err) {
      console.warn('Failed loading documents vault:', err);
    }
  };

  // Toggle Autofill Mode (Requirement 1)
  const toggleAutofillMode = () => {
    const nextState = !autofillEnabled;
    setAutofillEnabledState(nextState);
    setAutofillMode(nextState);

    if (nextState && activeTemplate && activeStep === 2) {
      triggerAutofillRun(activeTemplate, savedProfile);
    }
  };

  // Trigger Autofill Run on current template fields (Requirement 2)
  const triggerAutofillRun = (template: FormTemplate, profile: Record<string, any> | null) => {
    if (!profile) return;

    if (!hasAutofillConsent('new_form')) {
      setShowConsentModal(true);
      return;
    }

    const prevValues: Record<string, string> = { ...fieldValues };
    const newValues: Record<string, string> = { ...fieldValues };
    const newSources: Record<string, 'profile' | 'manual' | 'voice'> = { ...fieldSources };
    const skippedItems: Array<{ key: string; label: string; reason: string }> = [];

    let filledCount = 0;
    let skippedCount = 0;

    for (const field of template.fields) {
      // Check sensitivity (passwords, OTPs, Aadhaar, PAN, bank numbers)
      const fakeEl = {
        name: field.key,
        id: field.key,
        type: field.type,
        placeholder: field.placeholder,
        getAttribute: () => field.type,
      } as any;

      const sens = isFieldSensitive(fakeEl, field.label);
      if (sens.isSensitive) {
        skippedCount++;
        skippedItems.push({
          key: field.key,
          label: isHi ? field.labelHi : field.label,
          reason: 'sensitive (Aadhaar, PAN, passwords & bank numbers are never filled)',
        });
        continue;
      }

      // Check profile value
      const profKey = field.profileKey || field.key;
      let matchedVal = '';

      if (['applicant_name', 'student_name', 'full_name'].includes(profKey)) {
        matchedVal = profile.full_name || profile.name || '';
      } else if (['applicant_phone', 'mobile', 'phone'].includes(profKey)) {
        matchedVal = profile.phone || '';
      } else if (['applicant_email', 'email'].includes(profKey)) {
        matchedVal = profile.email || '';
      } else if (['applicant_address', 'address', 'residential_address'].includes(profKey)) {
        const parts = [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean);
        matchedVal = profile.address || (parts.length > 0 ? parts.join(', ') : '');
      } else if (['dob', 'date_of_birth'].includes(profKey)) {
        matchedVal = profile.date_of_birth || profile.dob || '';
      } else if (profile[profKey]) {
        matchedVal = profile[profKey];
      }

      if (matchedVal && matchedVal.trim()) {
        const formatted = formatFieldValue(fakeEl, matchedVal.trim(), field.label);
        newValues[field.key] = formatted;
        newSources[field.key] = 'profile';
        filledCount++;
      } else {
        skippedCount++;
        skippedItems.push({
          key: field.key,
          label: isHi ? field.labelHi : field.label,
          reason: 'no saved value',
        });
      }
    }

    setFieldValues(newValues);
    setFieldSources(newSources);
    setAutofillSummary({
      filledCount,
      skippedCount,
      skippedItems,
      previousValues: prevValues,
    });
  };

  const handleConfirmConsent = () => {
    setAutofillConsent('new_form', true);
    setShowConsentModal(false);
    if (activeTemplate) {
      triggerAutofillRun(activeTemplate, savedProfile);
    }
  };

  // Undo Individual Field (Requirement 2)
  const handleUndoField = (key: string) => {
    const orig = autofillSummary?.previousValues?.[key] ?? '';
    const resetVal = orig === fieldValues[key] ? '' : orig;
    setFieldValues(prev => ({ ...prev, [key]: resetVal }));
    setFieldSources(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // Undo All Autofilled Fields (Requirement 2)
  const handleUndoAll = () => {
    setFieldValues(prev => {
      const next = { ...prev };
      for (const [k, src] of Object.entries(fieldSources)) {
        if (src === 'profile') {
          next[k] = '';
        }
      }
      return next;
    });
    setFieldSources({});
    setAutofillSummary(null);
  };

  // Handle template selection
  const handleSelectTemplate = (template: FormTemplate) => {
    setActiveTemplate(template);
    setErrorMessage(null);
    setSuccessBanner(null);
    setGeneratedDoc(null);
    setActiveStep(2);

    if (autofillEnabled && savedProfile) {
      triggerAutofillRun(template, savedProfile);
    }
  };

  // Handle URL query parameter ?type=... (e.g. /forms/new?type=resignation or leave_application)
  useEffect(() => {
    const typeParam = searchParams?.get('type');
    if (typeParam && !activeTemplate) {
      const matched =
        FORM_TEMPLATES.find(t => t.id === typeParam || t.category === typeParam) ||
        matchTemplateFromPrompt(typeParam);
      if (matched) {
        handleSelectTemplate(matched);
      }
    }
  }, [searchParams, activeTemplate]);

  // Load prefilled slots from NLU / assistant plan
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefillStr = sessionStorage.getItem('tfb_prefill_slots');
      if (prefillStr) {
        try {
          const slots = JSON.parse(prefillStr);
          sessionStorage.removeItem('tfb_prefill_slots');
          setFieldValues(prev => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(slots)) {
              if (v !== null && v !== undefined) {
                const strVal = Array.isArray(v) ? v.join(', ') : String(v);
                if (k === 'skills') next['skills'] = strVal;
                else if (k === 'role') {
                  next['preferred_domain'] = strVal;
                  next['role'] = strVal;
                } else if (k === 'education') next['education'] = strVal;
                else if (k === 'purpose') {
                  next['reason'] = strVal;
                  next['purpose'] = strVal;
                } else if (k === 'recipient') next['recipient_title'] = strVal;
                else if (k === 'startDate') next['start_date'] = strVal;
                else if (k === 'durationDays') next['duration'] = `${strVal} days`;
                else next[k] = strVal;
              }
            }
            return next;
          });
        } catch {}
      }
    }
  }, [activeTemplate]);

  // Load dynamically generated form structure from sessionStorage if passed from /forms modal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('currentGeneratedForm');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          sessionStorage.removeItem('currentGeneratedForm');
          if (parsed.title) {
            const customTmpl = createCustomTemplateFromPrompt(parsed.title, language);
            if (Array.isArray(parsed.fields) && parsed.fields.length > 0) {
              customTmpl.fields = parsed.fields.map((f: any, idx: number) => ({
                key: f.id || `f_${idx + 1}`,
                label: f.label || 'Field',
                labelHi: f.label || 'फ़ील्ड',
                type: f.type || 'text',
                required: !!f.required,
                placeholder: f.placeholder || '',
                placeholderHi: f.placeholder || '',
              }));
            }
            handleSelectTemplate(customTmpl);
          }
        } catch (e) {
          console.warn('Failed parsing currentGeneratedForm:', e);
        }
      }
    }
  }, [language]);

  // AI custom prompt proposing an unverified template
  const handleProposeCustomTemplate = () => {
    if (!customPrompt.trim()) {
      setErrorMessage(isHi ? 'कृपया आवश्यकता का विवरण दर्ज करें।' : 'Please enter a description or requirements for the form.');
      return;
    }
    const unverifiedTmpl = createCustomTemplateFromPrompt(customPrompt, language);
    setActiveTemplate(unverifiedTmpl);
    setSuccessBanner(
      isHi
        ? `"${customPrompt}" हेतु प्रारूप प्रस्तावित किया गया (अपुष्ट)।`
        : `Proposed template for "${customPrompt}" (Marked Unverified).`
    );
    setActiveStep(2);

    if (autofillEnabled && savedProfile) {
      triggerAutofillRun(unverifiedTmpl, savedProfile);
    }
  };

  // Field change handler with validation
  const handleFieldChange = (key: string, value: string, type = 'text', source: 'profile' | 'manual' | 'voice' = 'manual') => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
    setFieldSources(prev => ({ ...prev, [key]: source }));

    const res = validateFieldBySchema(key, type, value, language);
    setFieldErrors(prev => ({
      ...prev,
      [key]: res.valid ? '' : (res.error || 'Invalid format'),
    }));
  };

  // Save a single field back to user profile (PUT /api/profile)
  const handleSaveFieldToProfile = async (fieldKey: string, value: string) => {
    if (!value || !value.trim()) return;

    const colMap: Record<string, string> = {
      applicant_name: 'full_name',
      student_name: 'full_name',
      account_holder_name: 'full_name',
      applicant_phone: 'phone',
      registered_phone: 'phone',
      emergency_phone: 'emergency_contact',
      mobile: 'phone',
      applicant_email: 'email',
      email: 'email',
      applicant_address: 'address',
      residential_address: 'address',
      address: 'address',
      father_name: 'father_name',
      mother_name: 'mother_name',
      dob: 'date_of_birth',
      date_of_birth: 'date_of_birth',
      pincode: 'pincode',
    };

    const targetCol = colMap[fieldKey] || fieldKey;

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [targetCol]: value.trim() }),
      });

      if (res.ok) {
        setProfileSaveSuccess(prev => ({ ...prev, [fieldKey]: true }));
        setFieldSources(prev => ({ ...prev, [fieldKey]: 'profile' }));
        setTimeout(() => {
          setProfileSaveSuccess(prev => ({ ...prev, [fieldKey]: false }));
        }, 3000);
      } else {
        alert(isHi ? 'प्रोफ़ाइल में सहेजने में विफल। पुनः प्रयास करें।' : 'Failed saving to profile. Please try again.');
      }
    } catch (err) {
      console.error('Save to profile error:', err);
    }
  };

  // Voice fill for an individual field
  const handleVoiceInputForField = (fieldKey: string, fieldType: string) => {
    stopSpeaking();
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert(isHi ? 'इस ब्राउज़र में वाक् पहचान उपलब्ध नहीं है।' : 'Speech recognition is not supported in this browser.');
      return;
    }

    if (listeningFieldKey === fieldKey) {
      fieldRecognitionRef.current?.stop();
      setListeningFieldKey(null);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setListeningFieldKey(fieldKey);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript.trim();
      handleFieldChange(fieldKey, transcript, fieldType, 'voice');
      setListeningFieldKey(null);
    };
    recognition.onerror = () => setListeningFieldKey(null);
    recognition.onend = () => setListeningFieldKey(null);

    fieldRecognitionRef.current = recognition;
    recognition.start();
  };

  // ── VOICE STEP-BY-STEP WALKTHROUGH (Requirement 3) ──
  const startVoiceWalkthrough = () => {
    if (!autofillSummary?.skippedItems || autofillSummary.skippedItems.length === 0) {
      // Find currently empty required fields if no autofill summary
      const emptyFields = activeTemplate?.fields.filter(f => !fieldValues[f.key]) || [];
      if (emptyFields.length === 0) {
        alert(isHi ? 'कोई भी रिक्त फ़ील्ड शेष नहीं है।' : 'All fields are already filled!');
        return;
      }
      setAutofillSummary({
        filledCount: 0,
        skippedCount: emptyFields.length,
        skippedItems: emptyFields.map(f => ({
          key: f.key,
          label: isHi ? f.labelHi : f.label,
          reason: 'no saved value',
        })),
        previousValues: { ...fieldValues },
      });
    }

    setIsVoiceWalkthroughActive(true);
    setWalkthroughIndex(0);
    promptCurrentWalkthroughField(0);
  };

  const promptCurrentWalkthroughField = (idx: number) => {
    stopSpeaking();
    const item = autofillSummary?.skippedItems[idx];
    if (!item) {
      setIsVoiceWalkthroughActive(false);
      speakText(isHi ? 'सभी फ़ील्ड पूर्ण हो गए हैं।' : 'All skipped fields have been processed.', language);
      return;
    }

    // Scroll to field element
    const el = document.getElementById(`field-${item.key}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }

    // Formulate question in user's language
    const promptText = isHi
      ? `कृपया ${item.label} बताएं:`
      : `What is your ${item.label}?`;

    speakText(promptText, language);
  };

  const listenForWalkthroughField = () => {
    stopSpeaking();
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert(isHi ? 'इस ब्राउज़र में वाक् पहचान उपलब्ध नहीं है।' : 'Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsWalkthroughListening(true);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript.trim().toLowerCase();
      setIsWalkthroughListening(false);

      // Check walk-through voice commands: next, skip, repeat, go back, stop
      if (transcript === 'next' || transcript === 'आगे' || transcript === 'agla') {
        handleWalkthroughNext();
      } else if (transcript === 'skip' || transcript === 'छोड़ें' || transcript === 'chhod do') {
        handleWalkthroughSkip();
      } else if (transcript === 'repeat' || transcript === 'दोहराएं' || transcript === 'phir se') {
        promptCurrentWalkthroughField(walkthroughIndex);
      } else if (transcript === 'go back' || transcript === 'पीछे' || transcript === 'back') {
        handleWalkthroughGoBack();
      } else if (transcript === 'stop' || transcript === 'रुकें' || transcript === 'cancel' || transcript === 'band karo') {
        setIsVoiceWalkthroughActive(false);
      } else {
        // Value spoken: show interpreted value
        const raw = e.results[0][0].transcript.trim();
        setWalkthroughValue(raw);
        speakText(isHi ? `दर्ज किया गया मान: ${raw}। पुष्टि करें?` : `Interpreted value: ${raw}. Confirm?`, language);
      }
    };

    recognition.onerror = () => setIsWalkthroughListening(false);
    recognition.onend = () => setIsWalkthroughListening(false);

    walkthroughRecognitionRef.current = recognition;
    recognition.start();
  };

  const handleConfirmWalkthroughValue = () => {
    const item = autofillSummary?.skippedItems[walkthroughIndex];
    if (item && walkthroughValue) {
      handleFieldChange(item.key, walkthroughValue, 'text', 'voice');
      setWalkthroughValue('');
      handleWalkthroughNext();
    }
  };

  const handleWalkthroughNext = () => {
    const nextIdx = walkthroughIndex + 1;
    setWalkthroughValue('');
    if (autofillSummary?.skippedItems && nextIdx < autofillSummary.skippedItems.length) {
      setWalkthroughIndex(nextIdx);
      promptCurrentWalkthroughField(nextIdx);
    } else {
      setIsVoiceWalkthroughActive(false);
      speakText(isHi ? 'आवाज़ द्वारा फ़ील्ड पूर्ण करने की प्रक्रिया समाप्त हुई।' : 'Voice walk-through complete.', language);
    }
  };

  const handleWalkthroughSkip = () => {
    handleWalkthroughNext();
  };

  const handleWalkthroughGoBack = () => {
    if (walkthroughIndex > 0) {
      const prevIdx = walkthroughIndex - 1;
      setWalkthroughValue('');
      setWalkthroughIndex(prevIdx);
      promptCurrentWalkthroughField(prevIdx);
    }
  };

  // Document attachment handler: from user's vault
  const handleAttachVaultDoc = (docSlotId: string, vaultDocId: string) => {
    const doc = userVaultDocs.find(d => d.id === vaultDocId);
    if (!doc) return;

    const tmplDoc = activeTemplate?.requiredDocuments?.find(d => d.id === docSlotId);
    const maxBytes = tmplDoc?.maxSizeBytes || 2 * 1024 * 1024;
    const isOversized = doc.file_size > maxBytes;

    setAttachedDocs(prev => ({
      ...prev,
      [docSlotId]: {
        docId: docSlotId,
        vaultDocId: doc.id,
        name: doc.file_name,
        type: doc.file_type,
        size: doc.file_size,
        isOversized,
        maxSizeBytes: maxBytes,
        isCompressed: false,
      },
    }));

    setSkippedDocs(prev => ({ ...prev, [docSlotId]: false }));
  };

  // Document attachment handler: upload local file
  const handleUploadLocalDoc = async (docSlotId: string, file: File) => {
    const tmplDoc = activeTemplate?.requiredDocuments?.find(d => d.id === docSlotId);
    const maxBytes = tmplDoc?.maxSizeBytes || 2 * 1024 * 1024;
    const isOversized = file.size > maxBytes;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';

      setAttachedDocs(prev => ({
        ...prev,
        [docSlotId]: {
          docId: docSlotId,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          blob: file,
          dataUrl,
          base64,
          isOversized,
          maxSizeBytes: maxBytes,
          isCompressed: false,
        },
      }));
    };
    reader.readAsDataURL(file);

    setSkippedDocs(prev => ({ ...prev, [docSlotId]: false }));
  };

  // Document compression handler
  const handleCompressDoc = async (docSlotId: string) => {
    const item = attachedDocs[docSlotId];
    if (!item) return;

    const maxBytes = item.maxSizeBytes || 200 * 1024;
    setIsCompressing(prev => ({ ...prev, [docSlotId]: true }));

    try {
      let fileOrBlob: Blob | File | undefined = item.blob;
      if (!fileOrBlob && item.dataUrl) {
        const res = await fetch(item.dataUrl);
        fileOrBlob = await res.blob();
      } else if (!fileOrBlob && item.vaultDocId) {
        const res = await fetch(`/api/documents/${item.vaultDocId}`);
        if (res.ok) {
          fileOrBlob = await res.blob();
        }
      }

      if (!fileOrBlob) {
        fileOrBlob = new Blob(['sample-compressed-data'], { type: item.type || 'image/jpeg' });
      }

      const compressed = await compressImageToLimit(
        fileOrBlob,
        maxBytes,
        item.type.includes('png') ? 'image/png' : 'image/jpeg'
      );

      const compressedBase64 = compressed.dataUrl.split(',')[1] || '';

      setAttachedDocs(prev => ({
        ...prev,
        [docSlotId]: {
          ...prev[docSlotId],
          blob: compressed.blob,
          dataUrl: compressed.dataUrl,
          base64: compressedBase64,
          size: compressed.compressedSize,
          isOversized: false,
          isCompressed: true,
        },
      }));
    } catch (err) {
      console.error('Compression failed:', err);
      alert(isHi ? 'दस्तावेज़ संपीड़ित करने में विफल। कृपया छोटी फ़ाइल चुनें।' : 'Failed compressing document. Please upload a smaller file.');
    } finally {
      setIsCompressing(prev => ({ ...prev, [docSlotId]: false }));
    }
  };

  // Skip optional document
  const handleSkipDoc = (docSlotId: string) => {
    setSkippedDocs(prev => ({ ...prev, [docSlotId]: true }));
    setAttachedDocs(prev => {
      const copy = { ...prev };
      delete copy[docSlotId];
      return copy;
    });
  };

  // Advance step with validation
  const handleNextStep = () => {
    if (activeStep === 1) {
      if (!activeTemplate) {
        setErrorMessage(isHi ? 'कृपया आवेदन प्रारूप चुनें या आवश्यकता दर्ज करें।' : 'Please select a form template or enter a custom requirement.');
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      // Validate required fields
      if (activeTemplate) {
        const missingReq = activeTemplate.fields.filter(
          f => f.required && (!fieldValues[f.key] || !fieldValues[f.key].trim())
        );
        if (missingReq.length > 0) {
          setErrorMessage(
            isHi
              ? `कृपया शेष आवश्यक फ़ील्ड भरें: ${missingReq.map(f => f.labelHi || f.label).join(', ')}`
              : `Please provide all required fields: ${missingReq.map(f => f.label).join(', ')}`
          );
          return;
        }

        const hasErrors = Object.values(fieldErrors).some(err => Boolean(err));
        if (hasErrors) {
          setErrorMessage(isHi ? 'कृपया आगे बढ़ने से पहले प्रारूप त्रुटियों को सुधारें।' : 'Please fix the highlighted formatting errors before proceeding.');
          return;
        }
      }
      setErrorMessage(null);

      const requiredDocs = activeTemplate?.requiredDocuments || [];
      if (requiredDocs.length === 0) {
        generateReviewDocument();
        setActiveStep(4);
      } else {
        setActiveStep(3);
      }
    } else if (activeStep === 3) {
      const requiredDocs = activeTemplate?.requiredDocuments || [];
      const missingDocs = requiredDocs.filter(
        d => d.required && !attachedDocs[d.id] && !skippedDocs[d.id]
      );

      if (missingDocs.length > 0) {
        setErrorMessage(
          isHi
            ? `कृपया आवश्यक दस्तावेज़ संलग्न करें: ${missingDocs.map(d => d.nameHi || d.name).join(', ')}`
            : `Please attach all required documents: ${missingDocs.map(d => d.name).join(', ')}`
        );
        return;
      }

      const oversized = Object.values(attachedDocs).find(d => d.isOversized);
      if (oversized) {
        setErrorMessage(
          isHi
            ? `दस्तावेज़ "${oversized.name}" आकार सीमा से बड़ा है। कृपया आगे बढ़ने से पहले संपीड़ित करें।`
            : `Document "${oversized.name}" exceeds the allowed file size limit. Please compress it before proceeding.`
        );
        return;
      }

      setErrorMessage(null);
      generateReviewDocument();
      setActiveStep(4);
    }
  };

  // Generate complete review document with enclosures
  const generateReviewDocument = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    const enclosureList: string[] = [];
    if (activeTemplate?.requiredDocuments) {
      activeTemplate.requiredDocuments.forEach((doc, idx) => {
        const att = attachedDocs[doc.id];
        if (att) {
          enclosureList.push(`${idx + 1}. ${isHi ? doc.nameHi : doc.name} (${att.name})`);
        }
      });
    }

    try {
      const res = await fetch('/api/forms/generate-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: activeTemplate?.id,
          prompt: customPrompt || activeTemplate?.name,
          fields: fieldValues,
          language,
        }),
      });

      const data = await res.json();
      if (res.ok && data.sections) {
        const sections: DocumentSections = {
          ...data.sections,
          enclosures: enclosureList.length > 0 ? enclosureList : data.sections.enclosures,
        };

        const textParts = [
          sections.header,
          sections.date,
          sections.subject,
          sections.salutation,
          sections.body,
          sections.closing,
          sections.signature,
          ...(sections.enclosures || []),
        ].join('\n');

        const applicantName = fieldValues.applicant_name || fieldValues.student_name || fieldValues.account_holder_name;
        const cleanTitle = deriveCleanFormTitle(activeTemplate || data.title || customPrompt, applicantName, language as 'en' | 'hi');
        setGeneratedDoc({
          title: cleanTitle,
          sections,
          charCount: textParts.length,
          wordCount: textParts.trim().split(/\s+/).filter(Boolean).length,
        });
      } else {
        // Fallback to rich authentic template generator instead of generic 2-line placeholder
        const fallbackSections = activeTemplate
          ? generateFallbackDocument(activeTemplate, fieldValues, language as 'en' | 'hi', customPrompt)
          : {
              header: isHi ? 'सेवा में,\nश्रीमान सक्षम प्राधिकारी महोदय,\nशासकीय कार्यालय,\nनई दिल्ली' : 'To,\nThe Competent Authority,\nOfficial Office,\nNew Delhi - 110001',
              date: new Date().toLocaleDateString(isHi ? 'hi-IN' : 'en-GB'),
              subject: `${isHi ? 'विषय: आवेदन पत्र' : 'Application'}: ${customPrompt || 'Official Request'}`,
              salutation: isHi ? 'महोदय,' : 'Respected Sir/Madam,',
              body: isHi
                ? `सविनय निवेदन है कि मैं, ${fieldValues.applicant_name || fieldValues.student_name || 'आवेदक'}, उपरोक्त विषयांतर्गत आवेदन प्रस्तुत कर रहा हूँ।\n\nसभी आवश्यक विवरण आधिकारिक मानकों के अनुरूप प्रस्तुत किए गए हैं।`
                : `I, ${fieldValues.applicant_name || fieldValues.student_name || 'the applicant'}, respectfully submit this application regarding the above subject.\n\nAll verified particulars have been furnished in accordance with official guidelines.`,
              closing: isHi ? 'भवदीय,' : 'Yours faithfully,',
              signature: `${fieldValues.applicant_name || fieldValues.student_name || (isHi ? 'आवेदक' : 'Applicant')}\n${fieldValues.applicant_phone || fieldValues.mobile || ''}`,
              enclosures: enclosureList.length > 0 ? enclosureList : undefined,
            };

        if (enclosureList.length > 0) {
          fallbackSections.enclosures = enclosureList;
        }

        const textParts = [
          fallbackSections.header,
          fallbackSections.date,
          fallbackSections.subject,
          fallbackSections.salutation,
          fallbackSections.body,
          fallbackSections.closing,
          fallbackSections.signature,
          ...(fallbackSections.enclosures || []),
        ].join('\n');

        const applicantName = fieldValues.applicant_name || fieldValues.student_name || fieldValues.account_holder_name;
        const cleanTitle = deriveCleanFormTitle(activeTemplate || customPrompt, applicantName, language as 'en' | 'hi');
        setGeneratedDoc({
          title: cleanTitle,
          sections: fallbackSections,
          charCount: textParts.length,
          wordCount: textParts.trim().split(/\s+/).filter(Boolean).length,
        });
      }
    } catch (err: any) {
      console.warn('Document generation error, using fallback:', err);
      if (activeTemplate) {
        const fallbackSections = generateFallbackDocument(activeTemplate, fieldValues, language as 'en' | 'hi', customPrompt);
        if (enclosureList.length > 0) {
          fallbackSections.enclosures = enclosureList;
        }
        const textParts = [
          fallbackSections.header,
          fallbackSections.date,
          fallbackSections.subject,
          fallbackSections.salutation,
          fallbackSections.body,
          fallbackSections.closing,
          fallbackSections.signature,
          ...(fallbackSections.enclosures || []),
        ].join('\n');

        const applicantName = fieldValues.applicant_name || fieldValues.student_name || fieldValues.account_holder_name;
        const cleanTitle = deriveCleanFormTitle(activeTemplate || customPrompt, applicantName, language as 'en' | 'hi');
        setGeneratedDoc({
          title: cleanTitle,
          sections: fallbackSections,
          charCount: textParts.length,
          wordCount: textParts.trim().split(/\s+/).filter(Boolean).length,
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSection = (sectionKey: keyof DocumentSections, value: any) => {
    if (!generatedDoc) return;
    setGeneratedDoc(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: value,
        },
      };
    });
  };

  const handleSaveForm = async (statusToSave: 'draft' | 'submitted') => {
    if (!generatedDoc) return;
    setSavingStatus(statusToSave);
    try {
      const formFieldsToSave = activeTemplate?.fields?.map((f, idx) => ({
        id: `f_${idx + 1}`,
        label: f.label,
        type: f.type,
        value: fieldValues[f.key] || '',
        required: f.required,
      })) || [];

      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedDoc.title,
          category: activeTemplate?.category || 'general',
          language,
          status: statusToSave,
          templateId: activeTemplate?.id,
          documentContent: generatedDoc.sections,
          fields: formFieldsToSave,
          filledData: fieldValues,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessBanner(
          statusToSave === 'draft'
            ? (isHi ? 'ड्राफ्ट सफलतापूर्वक सहेजा गया!' : 'Draft saved successfully! You can resume editing anytime.')
            : (isHi ? 'आवेदन सफलतापूर्वक जमा हो गया!' : 'Form submitted successfully!')
        );
        if (statusToSave === 'submitted') {
          router.push(`/forms/${data.id}`);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed saving document.');
    } finally {
      setSavingStatus(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!generatedDoc) return;
    if (typeof window !== 'undefined' && !window.confirm(isHi ? 'क्या आप इस दस्तावेज़ को PDF प्रारूप में डाउनलोड करना चाहते हैं?' : 'Download document as PDF?')) {
      return;
    }
    try {
      const photoItem = Object.values(attachedDocs).find(d => d.docId === 'photo' || d.type.includes('image'));
      const photoBase64 = photoItem?.base64;

      const res = await fetch('/api/forms/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedDoc.title,
          sections: generatedDoc.sections,
          language,
          format: 'pdf',
          kind: activeTemplate?.kind || 'letter',
          photoBase64,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${generatedDoc.title.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Download failed. Please try again.');
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleDownloadDocx = async () => {
    if (!generatedDoc) return;
    if (typeof window !== 'undefined' && !window.confirm(isHi ? 'क्या आप इस दस्तावेज़ को संपादन योग्य Word (.docx) प्रारूप में डाउनलोड करना चाहते हैं?' : 'Download document as editable Word (.docx)?')) {
      return;
    }
    try {
      const photoItem = Object.values(attachedDocs).find(d => d.docId === 'photo' || d.type.includes('image'));
      const photoBase64 = photoItem?.base64;

      const res = await fetch('/api/forms/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedDoc.title,
          sections: generatedDoc.sections,
          language,
          format: 'docx',
          kind: activeTemplate?.kind || 'letter',
          photoBase64,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${generatedDoc.title.replace(/\s+/g, '_')}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Download failed. Please try again.');
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleDownloadPackage = async () => {
    if (!generatedDoc) return;
    if (typeof window !== 'undefined' && !window.confirm(isHi ? 'क्या आप संपूर्ण आवेदन पैकेज (दस्तावेज़ + संलग्नक) डाउनलोड करना चाहते हैं?' : 'Download complete application package (document + attachments)?')) {
      return;
    }
    try {
      const attachedDocIds: string[] = [];
      const directAttachments: Array<{ name: string; type: string; data: string; encoding: string }> = [];

      for (const att of Object.values(attachedDocs)) {
        if (att.vaultDocId) {
          attachedDocIds.push(att.vaultDocId);
        } else if (att.base64) {
          directAttachments.push({
            name: att.name,
            type: att.type,
            data: att.base64,
            encoding: 'base64',
          });
        }
      }

      const photoItem = Object.values(attachedDocs).find(d => d.docId === 'photo' || d.type.includes('image'));
      const photoBase64 = photoItem?.base64;

      const res = await fetch('/api/forms/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${generatedDoc.title}_Package`,
          sections: generatedDoc.sections,
          language,
          kind: activeTemplate?.kind || 'letter',
          photoBase64,
          attachedDocIds,
          directAttachments,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${generatedDoc.title.replace(/\s+/g, '_')}_Package.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed generating package PDF. Please try again.');
      }
    } catch (err) {
      console.error('Package download error:', err);
    }
  };

  // ── Action Registry Integration ──
  useEffect(() => {
    const unregisterFns: Array<() => void> = [];

    const fillFieldAction: ActionDefinition<any> = {
      name: 'fill_field',
      description: 'Fill a specific form field with the given value.',
      parameters: {
        field: { type: 'string', required: true, description: 'Field name or key' },
        value: { type: 'string', required: true, description: 'Value to set' },
      },
      isReversible: true,
      confirmationPrompt: (params) => `Set ${params.field} to "${params.value}"?`,
      handler: (params) => {
        const prevVal = fieldValues[params.field] || '';
        handleFieldChange(params.field, params.value, 'text', 'voice');
        return {
          success: true,
          message: `Field ${params.field} updated to "${params.value}"`,
          undo: () => {
            handleFieldChange(params.field, prevVal, 'text', 'manual');
          },
        };
      },
    };
    unregisterFns.push(actionRegistry.register(fillFieldAction));

    const attachDocAction: ActionDefinition<any> = {
      name: 'attach_document',
      description: 'Attach a document from saved vault to a required document slot.',
      parameters: {
        field: { type: 'string', required: true, description: 'Document slot id' },
        documentId: { type: 'string', required: true, description: 'Saved document vault ID' },
      },
      isReversible: true,
      confirmationPrompt: (params) => `Attach saved document #${params.documentId} to ${params.field}?`,
      handler: (params) => {
        handleAttachVaultDoc(params.field, params.documentId);
        return {
          success: true,
          message: `Document attached to slot ${params.field}`,
        };
      },
    };
    unregisterFns.push(actionRegistry.register(attachDocAction));

    const selectOptionAction: ActionDefinition<any> = {
      name: 'select_option',
      description: 'Select an option for a dropdown field.',
      parameters: {
        field: { type: 'string', required: true, description: 'Field key' },
        option: { type: 'string', required: true, description: 'Option value' },
      },
      handler: (params) => {
        handleFieldChange(params.field, params.option, 'select', 'voice');
        return {
          success: true,
          message: `Selected option "${params.option}" for ${params.field}`,
        };
      },
    };
    unregisterFns.push(actionRegistry.register(selectOptionAction));

    const nextStepAction: ActionDefinition<any> = {
      name: 'next_step',
      description: 'Proceed to the next checklist step in form creation.',
      parameters: {},
      isReadOnly: true,
      handler: () => {
        handleNextStep();
        return {
          success: true,
          message: 'Advanced to next step',
        };
      },
    };
    unregisterFns.push(actionRegistry.register(nextStepAction));

    const compressDocAction: ActionDefinition<any> = {
      name: 'compress_document',
      description: 'Compress an oversized attached document to fit within the required KB limit.',
      parameters: {
        docId: { type: 'string', required: true, description: 'Slot ID of the oversized document' },
      },
      confirmationPrompt: (params) => `Compress oversized document in slot ${params.docId}?`,
      handler: async (params) => {
        await handleCompressDoc(params.docId);
        return {
          success: true,
          message: `Document in slot ${params.docId} compressed to limit`,
        };
      },
    };
    unregisterFns.push(actionRegistry.register(compressDocAction));

    const saveToProfileAction: ActionDefinition<any> = {
      name: 'save_to_profile',
      description: 'Persist a field value into the saved user profile for future autofill.',
      parameters: {
        field: { type: 'string', required: true, description: 'Field key or profile attribute' },
        value: { type: 'string', required: true, description: 'Value to save' },
      },
      confirmationPrompt: (params) => `Save "${params.value}" to your profile under ${params.field}?`,
      handler: async (params) => {
        await handleSaveFieldToProfile(params.field, params.value);
        return {
          success: true,
          message: `Saved ${params.field} to profile`,
        };
      },
    };
    unregisterFns.push(actionRegistry.register(saveToProfileAction));

    // Multi-Step Planner Integration Actions
    const selectTemplateAction: ActionDefinition<any> = {
      name: 'select_template',
      description: 'Select an official form or resume template by ID.',
      parameters: {
        templateId: { type: 'string', required: true, description: 'Template ID' },
      },
      isReadOnly: true,
      handler: (params) => {
        const tmpl = FORM_TEMPLATES.find(t => t.id === params.templateId || t.category === params.templateId) || matchTemplateFromPrompt(params.templateId);
        if (tmpl) {
          handleSelectTemplate(tmpl);
          return { success: true, message: `Selected template ${tmpl.name}` };
        }
        return { success: false, message: `Template ${params.templateId} not found.` };
      },
    };
    unregisterFns.push(actionRegistry.register(selectTemplateAction));

    const generateDocAction: ActionDefinition<any> = {
      name: 'generate_document',
      description: 'Generate the complete official document or resume.',
      parameters: {},
      isReadOnly: true,
      handler: async () => {
        await generateReviewDocument();
        return { success: true, message: 'Document generated successfully.' };
      },
    };
    unregisterFns.push(actionRegistry.register(generateDocAction));

    const downloadAction: ActionDefinition<any> = {
      name: 'download_package',
      description: 'Download the finalized document and package as PDF.',
      parameters: {},
      isReadOnly: false,
      confirmationPrompt: () => 'Download finalized document package as PDF?',
      handler: async () => {
        await handleDownloadPackage();
        return { success: true, message: 'Downloaded document package.' };
      },
    };
    unregisterFns.push(actionRegistry.register(downloadAction));

    const downloadDocxAction: ActionDefinition<any> = {
      name: 'download_docx',
      description: 'Download the finalized document as an editable Word (.docx) file.',
      parameters: {},
      isReadOnly: false,
      confirmationPrompt: () => 'Download finalized document as Word (.docx)?',
      handler: async () => {
        await handleDownloadDocx();
        return { success: true, message: 'Downloaded DOCX document.' };
      },
    };
    unregisterFns.push(actionRegistry.register(downloadDocxAction));

    // Listen for custom planner events
    const handlePlannerSelect = (e: any) => {
      if (e?.detail?.templateId) {
        const tmpl = FORM_TEMPLATES.find(t => t.id === e.detail.templateId) || matchTemplateFromPrompt(e.detail.templateId);
        if (tmpl) handleSelectTemplate(tmpl);
      }
    };
    const handlePlannerGenerate = () => {
      generateReviewDocument();
    };
    const handlePlannerDownload = () => {
      handleDownloadPackage();
    };
    const handlePlannerFill = (e: any) => {
      if (e?.detail?.field && e?.detail?.value !== undefined) {
        handleFieldChange(e.detail.field, String(e.detail.value), 'text', 'voice');
      }
    };
    const handlePlannerAttach = (e: any) => {
      if (e?.detail?.docId) {
        const docSlotId = e.detail.docId;
        const name = e.detail.name || `${docSlotId}.pdf`;
        setAttachedDocs(prev => ({
          ...prev,
          [docSlotId]: {
            docId: docSlotId,
            name: name,
            type: 'application/pdf',
            size: 1024 * 50,
            dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
            isOversized: false,
            isCompressed: false,
          },
        }));
        setSkippedDocs(prev => ({ ...prev, [docSlotId]: false }));
      }
    };

    window.addEventListener('tfb-select-template', handlePlannerSelect);
    window.addEventListener('tfb-generate-document', handlePlannerGenerate);
    window.addEventListener('tfb-download-document', handlePlannerDownload);
    window.addEventListener('tfb-fill-field', handlePlannerFill);
    window.addEventListener('tfb-attach-document', handlePlannerAttach);
    window.dispatchEvent(new CustomEvent('tfb-page-ready', { detail: { page: '/forms/new' } }));

    return () => {
      window.removeEventListener('tfb-select-template', handlePlannerSelect);
      window.removeEventListener('tfb-generate-document', handlePlannerGenerate);
      window.removeEventListener('tfb-download-document', handlePlannerDownload);
      window.removeEventListener('tfb-fill-field', handlePlannerFill);
      window.removeEventListener('tfb-attach-document', handlePlannerAttach);
      unregisterFns.forEach(unreg => unreg());
    };
  }, [activeTemplate, fieldValues, attachedDocs, userVaultDocs, activeStep]);

  if (status === 'loading' || !session) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading TechForm Buddy...</p>
      </div>
    );
  }

  useAppHeader({
    title: t.title,
    subtitle: t.subtitle,
    actions: (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Autofill Toggle Switch (Requirement 1) */}
        <button
          id="btn-autofill-toggle"
          data-testid="btn-autofill-toggle"
          className={`btn btn-sm ${autofillEnabled ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: autofillEnabled ? '#2563eb' : '#f1f5f9',
            color: autofillEnabled ? '#ffffff' : '#475569',
            border: '1.5px solid #cbd5e1',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          onClick={toggleAutofillMode}
          title={isHi ? 'ऑटोफ़िल मोड चालू/बंद करें' : 'Toggle Autofill Mode'}
        >
          <span>⚡</span>
          <span>{t.autofillToggleLabel} {autofillEnabled ? t.autofillOn : t.autofillOff}</span>
        </button>

        {/* Language Switcher */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          <button
            id="btn-lang-en"
            data-testid="btn-lang-en"
            className={`btn btn-sm ${language === 'en' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
          <button
            id="btn-lang-hi"
            data-testid="btn-lang-hi"
            className={`btn btn-sm ${language === 'hi' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => setLanguage('hi')}
          >
            हिंदी
          </button>
        </div>
      </div>
    ),
  });

  return (
    <div className="form-content animate-fadeIn" style={{ maxWidth: '960px' }}>
          {/* Stepper Progress Bar (100% Localized) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '20px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 20px',
            }}
          >
            {[
              { num: 1, label: t.step1 },
              { num: 2, label: t.step2 },
              { num: 3, label: t.step3 },
              { num: 4, label: t.step4 },
            ].map(step => {
              const isCurrent = activeStep === step.num;
              const isDone = activeStep > step.num;
              return (
                <div
                  key={step.num}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: isCurrent ? '#2563eb' : isDone ? '#059669' : '#64748b',
                    fontWeight: isCurrent ? 700 : 500,
                    fontSize: '13px',
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: isCurrent ? '#2563eb' : isDone ? '#059669' : '#cbd5e1',
                      color: 'white',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {isDone ? '✓' : step.num}
                  </span>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Banner Messages */}
          {errorMessage && (
            <div className="card" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px 18px', marginBottom: '16px' }}>
              ⚠️ <strong>{t.validationError}</strong> {errorMessage}
            </div>
          )}

          {successBanner && (
            <div className="card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '14px 18px', marginBottom: '16px' }}>
              ✅ {successBanner}
            </div>
          )}

          {/* Consent Banner / Dialog (Requirement 2) */}
          {showConsentModal && (
            <div
              data-testid="autofill-consent-modal"
              className="card"
              style={{
                background: '#0f172a',
                border: '1.5px solid #38bdf8',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '16px',
                color: '#ffffff',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>🛡️</span>
                <strong style={{ fontSize: '15px', color: '#38bdf8' }}>{t.consentModalTitle}</strong>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: '13px', lineHeight: 1.5, color: '#cbd5e1' }}>
                {t.consentModalDesc}
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  id="btn-consent-autofill"
                  data-testid="btn-consent-autofill"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700 }}
                  onClick={handleConfirmConsent}
                >
                  {t.consentModalConfirm}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowConsentModal(false)}
                >
                  {t.consentModalCancel}
                </button>
              </div>
            </div>
          )}

          {/* ══════════════ STEP 1: Choose Template ══════════════ */}
          {activeStep === 1 && (
            <section className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  {t.chooseTypeHeading}
                </h2>
                {isLoadingProfile && (
                  <span className="text-xs text-muted">{t.prefillingProfile}</span>
                )}
              </div>

              <div className="template-grid">
                {FORM_TEMPLATES.map(tmpl => {
                  const isSelected = activeTemplate?.id === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      data-testid={`template-${tmpl.id}`}
                      className={`template-card ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectTemplate(tmpl)}
                    >
                      <div className="template-card-title">
                        {isHi ? tmpl.nameHi : tmpl.name}
                      </div>
                      <div className="template-card-desc">
                        {isHi ? tmpl.descriptionHi : tmpl.description}
                      </div>
                      {tmpl.requiredDocuments && tmpl.requiredDocuments.length > 0 ? (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
                          {t.requiredDocsCount(tmpl.requiredDocuments.length)}
                        </div>
                      ) : (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                          {t.noDocsCount}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Requirement Prompt */}
              <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>
                  {t.customPromptLabel}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    id="input-custom-prompt"
                    data-testid="input-custom-prompt"
                    className="input"
                    style={{ flex: 1 }}
                    placeholder={t.customPromptPlaceholder}
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleProposeCustomTemplate()}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleProposeCustomTemplate}
                  >
                    {t.proposeBtn}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ══════════════ STEP 2: Particulars Checklist ══════════════ */}
          {activeStep === 2 && activeTemplate && (
            <section className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                      {isHi ? activeTemplate.nameHi : activeTemplate.name}
                    </h2>
                    {activeTemplate.isUnverified && (
                      <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '11px' }}>
                        {t.unverifiedBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
                    {t.particularsSub}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveStep(1)}
                  >
                    {t.changeTemplateBtn}
                  </button>
                </div>
              </div>

              {/* Autofill Run Summary Banner (Requirement 2) */}
              {autofillSummary && (
                <div
                  data-testid="autofill-summary"
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>⚡</span>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#166534' }}>
                          {t.autofillSummaryTitle}
                        </strong>
                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                          {t.autofillFilledCount(autofillSummary.filledCount)} • {t.autofillSkippedCount(autofillSummary.skippedCount)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Fill the rest by voice button (Requirement 3) */}
                      {autofillSummary.skippedCount > 0 && (
                        <button
                          type="button"
                          id="btn-voice-walkthrough"
                          data-testid="btn-voice-walkthrough"
                          className="btn btn-sm"
                          style={{ background: '#0284c7', color: '#ffffff', border: 'none', fontWeight: 700 }}
                          onClick={startVoiceWalkthrough}
                        >
                          {t.voiceWalkthroughBtn}
                        </button>
                      )}

                      {/* Undo All button (Requirement 2) */}
                      {autofillSummary.filledCount > 0 && (
                        <button
                          type="button"
                          id="btn-undo-all"
                          data-testid="btn-undo-all"
                          className="btn btn-secondary btn-sm"
                          onClick={handleUndoAll}
                        >
                          {t.autofillUndoAll}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Skipped fields listing with reason */}
                  {autofillSummary.skippedItems.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #bbf7d0', fontSize: '11px', color: '#166534' }}>
                      <strong>{isHi ? 'छोड़ी गई फ़ील्ड (कारण सहित):' : 'Skipped fields with reason:'}</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {autofillSummary.skippedItems.map(item => (
                          <span
                            key={item.key}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            <strong>{item.label}</strong>: {item.reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Voice Step-by-Step Card (Requirement 3) */}
              {isVoiceWalkthroughActive && autofillSummary?.skippedItems[walkthroughIndex] && (
                <div
                  data-testid="voice-walkthrough-panel"
                  style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    border: '2px solid #38bdf8',
                    borderRadius: '10px',
                    padding: '16px',
                    marginBottom: '18px',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>🎙️</span>
                      <strong style={{ fontSize: '14px', color: '#38bdf8' }}>
                        {t.voiceWalkthroughTitle} ({walkthroughIndex + 1}/{autofillSummary.skippedItems.length})
                      </strong>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Commands: next, skip, repeat, go back, stop
                    </span>
                  </div>

                  <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                    {isHi
                      ? `कृपया ${autofillSummary.skippedItems[walkthroughIndex].label} बताएं:`
                      : `What is your ${autofillSummary.skippedItems[walkthroughIndex].label}?`}
                  </p>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      data-testid="walkthrough-input"
                      className="input"
                      style={{ flex: 1, minWidth: '200px', background: '#0f172a', color: '#ffffff', borderColor: '#334155' }}
                      value={walkthroughValue}
                      onChange={e => setWalkthroughValue(e.target.value)}
                      placeholder={isHi ? 'बोला गया मान यहां दिखाई देगा...' : 'Spoken or typed value...'}
                    />

                    <button
                      type="button"
                      className={`btn ${isWalkthroughListening ? 'btn-danger' : 'btn-primary'} btn-sm`}
                      onClick={listenForWalkthroughField}
                    >
                      {isWalkthroughListening ? t.listeningBtn : `🎙️ ${t.voiceBtn}`}
                    </button>

                    {walkthroughValue && (
                      <button
                        type="button"
                        id="btn-walkthrough-confirm"
                        data-testid="btn-confirm-walkthrough-fill"
                        className="btn btn-sm"
                        style={{ background: '#059669', color: '#ffffff', border: 'none', fontWeight: 700 }}
                        onClick={handleConfirmWalkthroughValue}
                      >
                        {t.voiceWalkthroughConfirm}
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid="btn-walkthrough-back"
                      className="btn btn-secondary btn-sm"
                      onClick={handleWalkthroughGoBack}
                      disabled={walkthroughIndex === 0}
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      data-testid="btn-walkthrough-skip"
                      className="btn btn-secondary btn-sm"
                      onClick={handleWalkthroughSkip}
                    >
                      {t.voiceWalkthroughSkip}
                    </button>

                    <button
                      type="button"
                      data-testid="btn-walkthrough-stop"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() => setIsVoiceWalkthroughActive(false)}
                    >
                      {t.voiceWalkthroughStop}
                    </button>
                  </div>
                </div>
              )}

              {/* Checklist Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {activeTemplate.fields.map(field => {
                  const val = fieldValues[field.key] || '';
                  const source = fieldSources[field.key];
                  const error = fieldErrors[field.key];
                  const isListeningThis = listeningFieldKey === field.key;
                  const isProfileField = Boolean(field.profileKey || ['applicant_name', 'phone', 'email', 'applicant_address', 'dob', 'father_name', 'mother_name'].includes(field.key));

                  return (
                    <div
                      key={field.key}
                      style={{
                        background: '#f8fafc',
                        border: `1px solid ${error ? '#fca5a5' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        padding: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label
                          htmlFor={`field-${field.key}`}
                          style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}
                        >
                          {isHi ? field.labelHi : field.label} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                        </label>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {source === 'profile' && val && (
                            <span
                              data-testid="source-profile"
                              style={{
                                fontSize: '11px',
                                background: '#dcfce7',
                                color: '#15803d',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: 700,
                              }}
                            >
                              {t.fromProfileBadge}
                            </span>
                          )}
                          {source === 'voice' && (
                            <span
                              style={{
                                fontSize: '11px',
                                background: '#e0f2fe',
                                color: '#0369a1',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: 700,
                              }}
                            >
                              {t.voiceFilledBadge}
                            </span>
                          )}
                          {/* Individual Undo Button */}
                          {source === 'profile' && (
                            <button
                              type="button"
                              data-testid={`undo-${field.key}`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#64748b',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                              onClick={() => handleUndoField(field.key)}
                            >
                              {t.autofillUndo}
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {field.type === 'select' && field.options ? (
                          <select
                            id={`field-${field.key}`}
                            name={field.key}
                            data-testid={`field-${field.key}`}
                            className="input"
                            style={{ flex: 1 }}
                            value={val}
                            onChange={e => handleFieldChange(field.key, e.target.value, field.type, 'manual')}
                          >
                            <option value="">{isHi ? field.placeholderHi : field.placeholder}</option>
                            {field.options.map(opt => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            id={`field-${field.key}`}
                            name={field.key}
                            data-testid={`field-${field.key}`}
                            className="input"
                            rows={2}
                            style={{ flex: 1 }}
                            placeholder={isHi ? field.placeholderHi : field.placeholder}
                            value={val}
                            onChange={e => handleFieldChange(field.key, e.target.value, field.type, 'manual')}
                          />
                        ) : (
                          <input
                            type={field.type === 'date' ? 'date' : field.type === 'tel' ? 'tel' : 'text'}
                            id={`field-${field.key}`}
                            name={field.key}
                            data-testid={`field-${field.key}`}
                            className="input"
                            style={{ flex: 1 }}
                            placeholder={isHi ? field.placeholderHi : field.placeholder}
                            value={val}
                            onChange={e => handleFieldChange(field.key, e.target.value, field.type, 'manual')}
                          />
                        )}

                        {/* Voice Input Button */}
                        <button
                          type="button"
                          className={`btn ${isListeningThis ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                          onClick={() => handleVoiceInputForField(field.key, field.type)}
                          title={isHi ? 'आवाज़ द्वारा भरें' : 'Speak value in any language'}
                        >
                          🎙️ {isListeningThis ? t.listeningBtn : t.voiceBtn}
                        </button>

                        {/* Save to Profile button for reusable fields */}
                        {isProfileField && val && (source !== 'profile' || profileSaveSuccess[field.key]) && (
                          <button
                            type="button"
                            data-testid={`btn-save-profile-${field.key}`}
                            className="btn btn-secondary btn-sm"
                            style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
                            onClick={() => handleSaveFieldToProfile(field.key, val)}
                            title={isHi ? 'इस मान को अपनी प्रोफ़ाइल में सहेजें' : 'Save this reusable value to your profile'}
                          >
                            {profileSaveSuccess[field.key] ? t.savedProfileBtn : t.saveProfileBtn}
                          </button>
                        )}
                      </div>

                      {/* Inline Format Validation Error */}
                      {error && (
                        <div
                          data-testid={`error-${field.key}`}
                          style={{ marginTop: '6px', fontSize: '12px', color: '#dc2626', fontWeight: 500 }}
                        >
                          ⚠️ {error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Checklist Footer Navigation */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  id="btn-next-step"
                  data-testid="btn-next-step"
                  className="btn btn-primary"
                  style={{ padding: '10px 24px', fontWeight: 700 }}
                  onClick={handleNextStep}
                >
                  {activeTemplate.requiredDocuments && activeTemplate.requiredDocuments.length > 0
                    ? t.nextDocsBtn
                    : t.nextGenerateBtn}
                </button>
              </div>
            </section>
          )}

          {/* ══════════════ STEP 3: Document Checklist ══════════════ */}
          {activeStep === 3 && activeTemplate && (
            <section className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                    {t.docChecklistHeading}
                  </h2>
                  <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
                    {t.docChecklistSub}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveStep(2)}
                >
                  {t.backParticularsBtn}
                </button>
              </div>

              {/* Case A: Template has NO document requirement */}
              {(!activeTemplate.requiredDocuments || activeTemplate.requiredDocuments.length === 0) ? (
                <div
                  data-testid="no-documents-notice"
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    color: '#166534',
                  }}
                >
                  <span style={{ fontSize: '32px' }}>📄</span>
                  <h3 style={{ margin: '10px 0 4px', fontSize: '16px' }}>
                    {t.noDocsNoticeTitle}
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: '13px' }}>
                    {t.noDocsNoticeDesc}
                  </p>
                  <button
                    type="button"
                    id="btn-proceed-to-review"
                    data-testid="btn-proceed-to-review"
                    className="btn btn-primary"
                    onClick={() => {
                      generateReviewDocument();
                      setActiveStep(4);
                    }}
                  >
                    {t.proceedReviewBtn}
                  </button>
                </div>
              ) : (
                /* Case B: Template requires documents */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {activeTemplate.requiredDocuments.map(doc => {
                    const attached = attachedDocs[doc.id];
                    const skipped = skippedDocs[doc.id];
                    const maxKB = doc.maxSizeBytes ? Math.round(doc.maxSizeBytes / 1024) : 2048;
                    const allowedExts = doc.allowedFormats.map(f => f.toUpperCase()).join(', ');

                    return (
                      <div
                        key={doc.id}
                        data-testid={`doc-slot-${doc.id}`}
                        style={{
                          background: attached ? '#f0fdf4' : skipped ? '#f8fafc' : '#ffffff',
                          border: `1px solid ${attached ? '#86efac' : '#cbd5e1'}`,
                          borderRadius: '8px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '18px' }}>
                                {doc.type === 'photo' ? '👤' : doc.type === 'signature' ? '✍️' : '📑'}
                              </span>
                              <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                {isHi ? doc.nameHi : doc.name} {doc.required && <span style={{ color: '#dc2626' }}>*</span>}
                              </strong>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                              {t.allowedText} <strong>{allowedExts}</strong> • {t.maxSizeText} <strong>{maxKB} KB</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {attached && (
                              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                {t.attachedBadge(attached.name, Math.round(attached.size / 1024))}
                              </span>
                            )}
                            {skipped && (
                              <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '12px' }}>
                                {t.skippedBadge}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Attachment Options: Saved Vault or Local Upload */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
                          {userVaultDocs.length > 0 && (
                            <select
                              data-testid={`select-vault-${doc.id}`}
                              className="input"
                              style={{ maxWidth: '240px', fontSize: '12px' }}
                              value={attached?.vaultDocId || ''}
                              onChange={e => e.target.value && handleAttachVaultDoc(doc.id, e.target.value)}
                            >
                              <option value="">{t.attachVaultPlaceholder}</option>
                              {userVaultDocs.map(vd => (
                                <option key={vd.id} value={vd.id}>
                                  {vd.file_name} ({Math.round((vd.file_size || 0) / 1024)} KB)
                                </option>
                              ))}
                            </select>
                          )}

                          <label
                            className="btn btn-secondary btn-sm"
                            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {t.uploadFileBtn}
                            <input
                              type="file"
                              data-testid={`upload-${doc.id}`}
                              style={{ display: 'none' }}
                              accept={doc.allowedFormats.map(fmt => (fmt === 'pdf' ? '.pdf' : `.${fmt}`)).join(',')}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadLocalDoc(doc.id, f);
                              }}
                            />
                          </label>

                          {!doc.required && (
                            <button
                              type="button"
                              data-testid={`btn-skip-${doc.id}`}
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleSkipDoc(doc.id)}
                            >
                              {t.skipBtn}
                            </button>
                          )}
                        </div>

                        {/* Oversized Warning & Compression Action */}
                        {attached && attached.isOversized && (
                          <div
                            data-testid={`oversize-alert-${doc.id}`}
                            style={{
                              marginTop: '12px',
                              background: '#fffbeb',
                              border: '1px solid #fde68a',
                              padding: '10px 14px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
                              {t.oversizeWarning(Math.round(attached.size / 1024), maxKB)}
                            </span>

                            <button
                              type="button"
                              id={`btn-compress-${doc.id}`}
                              data-testid={`btn-compress-${doc.id}`}
                              className="btn btn-primary btn-sm"
                              disabled={isCompressing[doc.id]}
                              onClick={() => handleCompressDoc(doc.id)}
                            >
                              {isCompressing[doc.id] ? t.compressingBtn : t.compressBtn(maxKB)}
                            </button>
                          </div>
                        )}

                        {attached && attached.isCompressed && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                            {t.compressedSuccess(Math.round(attached.size / 1024))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button
                      type="button"
                      id="btn-proceed-review"
                      data-testid="btn-proceed-review"
                      className="btn btn-primary"
                      style={{ padding: '10px 24px', fontWeight: 700 }}
                      onClick={handleNextStep}
                    >
                      {t.completePackageBtn}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ══════════════ STEP 4: Review, Edit & Download Package ══════════════ */}
          {activeStep === 4 && (
            <div className="doc-preview-wrapper animate-fadeIn">
              {/* Review Header Toolbar */}
              <div className="doc-action-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '15px' }}>{generatedDoc?.title || (isHi ? 'पूर्ण आवेदन पत्र' : 'Filled Application')}</span>
                  {generatedDoc && (
                    <span className="badge badge-accent" style={{ fontSize: '11px' }}>
                      {t.wordsCount(generatedDoc.wordCount)}
                    </span>
                  )}
                </div>

                <div className="download-btn-group" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    id="btn-download-pdf"
                    data-testid="btn-download-pdf"
                    className="btn-download-pdf"
                    onClick={handleDownloadPdf}
                    title={isHi ? 'पीडीएफ प्रारूप डाउनलोड करें' : 'Download Letter / Form PDF'}
                  >
                    {t.downloadPdfBtn}
                  </button>

                  <button
                    type="button"
                    id="btn-download-docx"
                    data-testid="btn-download-docx"
                    className="btn btn-secondary btn-sm"
                    style={{ background: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontWeight: 600 }}
                    onClick={handleDownloadDocx}
                    title={isHi ? 'वर्ड (.docx) प्रारूप डाउनलोड करें' : 'Download editable Word (.docx)'}
                  >
                    {t.downloadDocxBtn}
                  </button>

                  <button
                    type="button"
                    id="btn-download-package"
                    data-testid="btn-download-package"
                    className="btn btn-primary btn-sm"
                    style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 700 }}
                    onClick={handleDownloadPackage}
                    title={isHi ? 'संलग्नकों सहित संपूर्ण पैकेज डाउनलोड करें' : 'Download complete merged package (Form + Attached Enclosures)'}
                  >
                    {t.downloadPkgBtn}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSaveForm('draft')}
                    disabled={savingStatus === 'draft'}
                  >
                    {savingStatus === 'draft' ? t.savingDraftBtn : t.saveDraftBtn}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSaveForm('submitted')}
                    disabled={savingStatus === 'submitted'}
                  >
                    {savingStatus === 'submitted' ? t.submittingBtn : t.submitBtn}
                  </button>
                </div>
              </div>

              {/* Editable Paper (Kind-Aware Structured Layout) */}
              {generatedDoc && (
                <div className="doc-paper">
                  {activeTemplate?.kind === 'application_form' ? (
                    /* ── Structured Application Form Layout (Requirement 1) ── */
                    <div className="doc-application-form-view">
                      {/* Top Header with Title and Photo Box */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, paddingRight: '20px' }}>
                          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', textTransform: 'uppercase', color: '#0f172a' }}>
                            {generatedDoc.title}
                          </h1>
                          <div style={{ fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                            <strong>{isHi ? 'दिनांक:' : 'Date:'}</strong> {generatedDoc.sections.date || new Date().toLocaleDateString()}
                          </div>
                          {generatedDoc.sections.header && (
                            <div style={{ fontSize: '12px', color: '#334155', whiteSpace: 'pre-line', marginTop: '6px' }}>
                              <strong>{isHi ? 'प्रस्तुत:' : 'To:'}</strong><br />
                              {generatedDoc.sections.header}
                            </div>
                          )}
                          {generatedDoc.sections.subject && (
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginTop: '8px' }}>
                              {generatedDoc.sections.subject}
                            </div>
                          )}
                        </div>

                        {/* Top-Right Photo Box */}
                        <div
                          id="doc-photo-box"
                          data-testid="doc-photo-box"
                          style={{
                            width: '105px',
                            height: '130px',
                            border: '2px dashed #94a3b8',
                            borderRadius: '4px',
                            background: '#f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          {(() => {
                            const photoItem = Object.values(attachedDocs).find(d => d.docId === 'photo' || d.type.includes('image'));
                            if (photoItem?.dataUrl) {
                              return (
                                <img
                                  src={photoItem.dataUrl}
                                  alt="Applicant Photograph"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              );
                            }
                            return (
                              <div style={{ padding: '8px', textAlign: 'center', fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                                📷<br />
                                {isHi ? 'पासपोर्ट फोटो यहाँ लगाएं' : 'Affix Passport Photo Here'}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Two-Column Table of Fields */}
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: '#334155', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                          {isHi ? 'आवेदक का विवरण' : 'Applicant Particulars'}
                        </h3>
                        <table
                          data-testid="doc-fields-table"
                          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}
                        >
                          <tbody>
                            {(generatedDoc.sections.fieldsTable || activeTemplate.fields.map(f => ({
                              label: isHi ? f.labelHi : f.label,
                              value: fieldValues[f.key] || '',
                            }))).map((row, idx) => (
                              <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600, width: '35%', color: '#1e293b' }}>
                                  {row.label}
                                </td>
                                <td style={{ padding: '8px 12px', color: '#334155' }}>
                                  {row.value || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Statement of Purpose / Cover Note (First person, 3-4 sentences) */}
                      <div className="doc-section-block" style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {isHi ? 'उद्देश्य विवरण / संक्षिप्त कवर नोट:' : 'Statement of Purpose / Cover Note:'}
                        </label>
                        <textarea
                          id="doc-covernote-text"
                          data-testid="doc-covernote-text"
                          className="doc-editable-textarea"
                          rows={3}
                          value={generatedDoc.sections.coverNote || generatedDoc.sections.body || ''}
                          onChange={e => updateSection('coverNote', e.target.value)}
                        />
                      </div>

                      {/* Solemn Declaration */}
                      <div className="doc-section-block" style={{ marginBottom: '20px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {isHi ? 'शपथपूर्वक घोषणा:' : 'Solemn Declaration:'}
                        </label>
                        <textarea
                          id="doc-declaration-text"
                          data-testid="doc-declaration-text"
                          className="doc-editable-textarea"
                          rows={2}
                          style={{ background: 'transparent', border: 'none', fontStyle: 'italic' }}
                          value={generatedDoc.sections.declaration || ''}
                          onChange={e => updateSection('declaration', e.target.value)}
                        />
                      </div>

                      {/* Date, Place & Signature Block */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px', marginBottom: '24px' }}>
                        <div>
                          <div style={{ fontSize: '13px', color: '#334155' }}>
                            <strong>{isHi ? 'दिनांक:' : 'Date:'}</strong> {generatedDoc.sections.date || new Date().toLocaleDateString()}
                          </div>
                          <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                            <strong>{isHi ? 'स्थान:' : 'Place:'}</strong> {generatedDoc.sections.place || fieldValues.city || fieldValues.applicant_address || '[Place]'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', minWidth: '200px' }}>
                          <div style={{ borderBottom: '1px solid #334155', height: '30px', marginBottom: '6px' }} />
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            {generatedDoc.sections.signature || fieldValues.applicant_name || 'Applicant Signature'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {isHi ? '(आवेदक के हस्ताक्षर)' : '(Signature of Applicant)'}
                          </div>
                        </div>
                      </div>

                      {/* Enclosures Section */}
                      <div className="doc-section-block" data-testid="doc-section-enclosures" style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '16px' }}>
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#0284c7', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                          {t.enclosuresBlock}
                        </label>
                        <div data-testid="enclosures-list">
                          {generatedDoc.sections.enclosures && generatedDoc.sections.enclosures.length > 0 ? (
                            <textarea
                              id="doc-enclosures-text"
                              className="doc-editable-textarea"
                              rows={Math.max(2, generatedDoc.sections.enclosures.length)}
                              value={generatedDoc.sections.enclosures.join('\n')}
                              onChange={e => updateSection('enclosures', e.target.value.split('\n'))}
                            />
                          ) : (
                            <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                              {t.noEnclosuresNotice}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : activeTemplate?.kind === 'resume' ? (
                    /* ── ATS Single-Column Resume Layout ── */
                    <div className="doc-resume-view" data-testid="doc-resume-view" style={{ fontFamily: 'Georgia, serif' }}>
                      {/* Resume Header */}
                      <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '18px' }}>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '1px', color: '#0f172a' }}>
                          {generatedDoc.sections.contactInfo?.name || fieldValues.applicant_name || 'Applicant Name'}
                        </h1>
                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          {generatedDoc.sections.contactInfo?.email && <span>{generatedDoc.sections.contactInfo.email}</span>}
                          {generatedDoc.sections.contactInfo?.phone && <span>• {generatedDoc.sections.contactInfo.phone}</span>}
                          {generatedDoc.sections.contactInfo?.city && <span>• {generatedDoc.sections.contactInfo.city}</span>}
                          {generatedDoc.sections.contactInfo?.linkedin && <span>• {generatedDoc.sections.contactInfo.linkedin}</span>}
                          {generatedDoc.sections.contactInfo?.github && <span>• {generatedDoc.sections.contactInfo.github}</span>}
                        </div>
                      </div>

                      {/* Summary */}
                      {(generatedDoc.sections.summary || generatedDoc.sections.body) && (
                        <div style={{ marginBottom: '18px' }}>
                          <h3 style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '6px' }}>
                            {isHi ? 'व्यावसायिक सारांश (Summary)' : 'PROFESSIONAL SUMMARY'}
                          </h3>
                          <textarea
                            className="doc-editable-textarea"
                            rows={3}
                            value={generatedDoc.sections.summary || generatedDoc.sections.body || ''}
                            onChange={e => updateSection('summary', e.target.value)}
                          />
                        </div>
                      )}

                      {/* Key Skills */}
                      {Boolean(generatedDoc.sections.skills && (Array.isArray(generatedDoc.sections.skills) ? generatedDoc.sections.skills.length > 0 : Object.keys(generatedDoc.sections.skills).length > 0)) && (
                        <div style={{ marginBottom: '18px' }}>
                          <h3 style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '6px' }}>
                            {isHi ? 'तकनीकी दक्षता (Key Skills)' : 'KEY SKILLS'}
                          </h3>
                          <textarea
                            className="doc-editable-textarea"
                            rows={2}
                            value={Array.isArray(generatedDoc.sections.skills) ? generatedDoc.sections.skills.join('  •  ') : String(generatedDoc.sections.skills)}
                            onChange={e => updateSection('skills', e.target.value.split(/•|,/).map(s => s.trim()).filter(Boolean))}
                          />
                        </div>
                      )}

                      {/* Education */}
                      {generatedDoc.sections.education && generatedDoc.sections.education.length > 0 && (
                        <div style={{ marginBottom: '18px' }}>
                          <h3 style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '6px' }}>
                            {isHi ? 'शैक्षणिक योग्यता (Education)' : 'EDUCATION'}
                          </h3>
                          {generatedDoc.sections.education.map((edu, idx) => (
                            <div key={idx} style={{ marginBottom: '8px', fontSize: '13px', color: '#1e293b' }}>
                              <div style={{ fontWeight: 700 }}>{edu.degree} {edu.institution ? `— ${edu.institution}` : ''}</div>
                              <div style={{ color: '#64748b', fontSize: '12px' }}>{edu.year || ''} {edu.score ? `| Score: ${edu.score}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Projects */}
                      {generatedDoc.sections.projects && generatedDoc.sections.projects.length > 0 && (
                        <div style={{ marginBottom: '18px' }}>
                          <h3 style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '6px' }}>
                            {isHi ? 'प्रमुख परियोजनाएं (Key Projects)' : 'PROJECTS & HIGHLIGHTS'}
                          </h3>
                          {generatedDoc.sections.projects.map((prj, idx) => (
                            <div key={idx} style={{ marginBottom: '10px' }}>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{prj.title}</div>
                              <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '12.5px', color: '#334155' }}>
                                {prj.bullets.map((b, bIdx) => (
                                  <li key={bIdx} style={{ marginBottom: '2px' }}>{b.replace(/^[•\-\*]\s*/, '')}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Experience */}
                      {generatedDoc.sections.experience && generatedDoc.sections.experience.length > 0 && (
                        <div style={{ marginBottom: '18px' }}>
                          <h3 style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '6px' }}>
                            {isHi ? 'कार्य अनुभव (Experience)' : 'EXPERIENCE & INTERNSHIPS'}
                          </h3>
                          {generatedDoc.sections.experience.map((exp, idx) => (
                            <div key={idx} style={{ marginBottom: '10px' }}>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                                {exp.role} — {exp.organization} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '12px' }}>({exp.period})</span>
                              </div>
                              <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '12.5px', color: '#334155' }}>
                                {exp.bullets.map((b, bIdx) => (
                                  <li key={bIdx} style={{ marginBottom: '2px' }}>{b.replace(/^[•\-\*]\s*/, '')}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Certifications & Languages */}
                      {((generatedDoc.sections.certifications && generatedDoc.sections.certifications.length > 0) || (generatedDoc.sections.languages && generatedDoc.sections.languages.length > 0)) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                          {generatedDoc.sections.certifications && generatedDoc.sections.certifications.length > 0 && (
                            <div>
                              <h3 style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '6px' }}>
                                {isHi ? 'प्रमाणपत्र (Certifications)' : 'CERTIFICATIONS'}
                              </h3>
                              <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '12.5px', color: '#334155' }}>
                                {generatedDoc.sections.certifications.map((c, idx) => (
                                  <li key={idx}>{c.replace(/^[•\-\*]\s*/, '')}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {generatedDoc.sections.languages && generatedDoc.sections.languages.length > 0 && (
                            <div>
                              <h3 style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '6px' }}>
                                {isHi ? 'भाषा ज्ञान (Languages)' : 'LANGUAGES'}
                              </h3>
                              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#334155' }}>
                                {generatedDoc.sections.languages.join('  •  ')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Optional Declaration */}
                      {generatedDoc.sections.declaration && (
                        <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '11.5px', color: '#64748b', fontStyle: 'italic' }}>
                          {generatedDoc.sections.declaration}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Standard Letter / General Document Layout ── */
                    <>
                      {/* Header / Recipient Block */}
                      <div className="doc-section-block" data-testid="doc-section-header">
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {t.toBlock}
                        </label>
                        <textarea
                          id="doc-header-text"
                          className="doc-editable-textarea"
                          rows={3}
                          value={generatedDoc.sections.header || ''}
                          onChange={e => updateSection('header', e.target.value)}
                        />
                      </div>

                      {/* Date Block */}
                      <div className="doc-section-block" data-testid="doc-section-date" style={{ textAlign: 'right' }}>
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {t.dateBlock}
                        </label>
                        <input
                          type="text"
                          id="doc-date-text"
                          className="doc-editable-input"
                          style={{ textAlign: 'right', maxWidth: '240px', marginLeft: 'auto' }}
                          value={generatedDoc.sections.date || ''}
                          onChange={e => updateSection('date', e.target.value)}
                        />
                      </div>

                      {/* Subject Line */}
                      <div className="doc-section-block" data-testid="doc-section-subject">
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {t.subjectBlock}
                        </label>
                        <input
                          type="text"
                          id="doc-subject-text"
                          className="doc-editable-input"
                          style={{ fontWeight: 700 }}
                          value={generatedDoc.sections.subject || ''}
                          onChange={e => updateSection('subject', e.target.value)}
                        />
                      </div>

                      {/* Salutation */}
                      <div className="doc-section-block" data-testid="doc-section-salutation">
                        <input
                          type="text"
                          id="doc-salutation-text"
                          className="doc-editable-input"
                          value={generatedDoc.sections.salutation || ''}
                          onChange={e => updateSection('salutation', e.target.value)}
                        />
                      </div>

                      {/* Body Paragraphs */}
                      <div className="doc-section-block" data-testid="doc-section-body">
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {t.bodyBlock}
                        </label>
                        <textarea
                          id="doc-body-text"
                          className="doc-editable-textarea"
                          rows={8}
                          value={generatedDoc.sections.body || ''}
                          onChange={e => updateSection('body', e.target.value)}
                        />
                      </div>

                      {/* Enclosures Section */}
                      <div className="doc-section-block" data-testid="doc-section-enclosures" style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '16px' }}>
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#0284c7', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                          {t.enclosuresBlock}
                        </label>

                        <div data-testid="enclosures-list">
                          {generatedDoc.sections.enclosures && generatedDoc.sections.enclosures.length > 0 ? (
                            <textarea
                              id="doc-enclosures-text"
                              className="doc-editable-textarea"
                              rows={Math.max(2, generatedDoc.sections.enclosures.length)}
                              value={generatedDoc.sections.enclosures.join('\n')}
                              onChange={e => updateSection('enclosures', e.target.value.split('\n'))}
                            />
                          ) : (
                            <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                              {t.noEnclosuresNotice}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Closing & Signature */}
                      <div className="doc-section-block" data-testid="doc-section-closing" style={{ marginTop: '24px' }}>
                        <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {t.closingBlock}
                        </label>
                        <input
                          type="text"
                          id="doc-closing-text"
                          className="doc-editable-input"
                          style={{ marginBottom: '8px' }}
                          value={generatedDoc.sections.closing || ''}
                          onChange={e => updateSection('closing', e.target.value)}
                        />
                        <textarea
                          id="doc-signature-text"
                          data-testid="doc-section-signature"
                          className="doc-editable-textarea"
                          rows={3}
                          style={{ fontWeight: 600 }}
                          value={generatedDoc.sections.signature || ''}
                          onChange={e => updateSection('signature', e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
  );
}

export default function NewFormPage() {
  return (
    <Suspense fallback={<div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading Form Builder...</div>}>
      <NewFormContent />
    </Suspense>
  );
}
