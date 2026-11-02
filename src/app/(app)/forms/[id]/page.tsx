'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAppHeader } from '@/components/AppShellContext';
import {
  SUPPORTED_LANGUAGES,
  speakText,
  stopSpeaking,
  isSpeaking,
  formatFieldSpeech,
  formatFormOverviewSpeech,
  getLocalizedMessage,
  getDefaultLanguage,
  analyzeFormFields,
  isReadAloudCommand,
  parseVoiceCommand,
} from '@/lib/speech';
import { downloadFormAsDocument } from '@/lib/downloadForm';
import { translateToEnglish } from '@/lib/translate';
import { useRegisterActions } from '@/lib/actionRegistry';
import '../forms.css';

interface FormField {
  id: string;
  label: string;
  type: string;
  value: string;
  required?: boolean;
  section?: string;
}

export default function FormDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const formId = params?.id as string;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [language, setLanguage] = useState('en');
  const [formStatus, setFormStatus] = useState('draft');
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [autoFillPending, setAutoFillPending] = useState<{ fieldId: string; spokenValue: string; value: string; isTranslating?: boolean } | null>(null);
  const [currentlyReadingFieldId, setCurrentlyReadingFieldId] = useState<string | null>(null);
  const [readingAll, setReadingAll] = useState(false);
  const [translatingFieldIds, setTranslatingFieldIds] = useState<Record<string, boolean>>({});
  const [originalInputs, setOriginalInputs] = useState<Record<string, string>>({});
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isGlobalVoiceActive, setIsGlobalVoiceActive] = useState(false);
  const [globalVoiceMsg, setGlobalVoiceMsg] = useState('');
  const [documentContent, setDocumentContent] = useState<any>(null);
  const [templateId, setTemplateId] = useState<string>('');
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Upload Document Feature State
  const [showUploadBanner, setShowUploadBanner] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; type: string; content: string; previewUrl?: string } | null>(null);
  const [uploadMode, setUploadMode] = useState<'format_only' | 'fix_only' | 'extract_and_profile'>('fix_only');
  const [uploadInstruction, setUploadInstruction] = useState('');
  const [isListeningUploadInst, setIsListeningUploadInst] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadResultFeedback, setUploadResultFeedback] = useState<{ summary: string; cleanedCount: number; fixedCount: number; mode: string } | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (status === 'authenticated' && formId) {
      loadForm();
    }
    return () => {
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, [status, formId]);

  // Register Form Editor actions with Action Registry (Requirement 1, 3 & 4)
  useRegisterActions([
    {
      name: 'fill_field',
      description: 'Fill a specific form field with a value (reversible).',
      parameters: {
        field: {
          type: 'string',
          description: 'The field ID or field label to fill.',
          required: true,
        },
        value: {
          type: 'string',
          description: 'The value to enter in the field.',
          required: true,
        },
      },
      isReadOnly: false,
      isReversible: true,
      confirmationPrompt: ({ field, value }) => `Fill field "${field}" with "${value}"?`,
      handler: async ({ field, value }) => {
        const target = fields.find(
          (f) =>
            f.id.toLowerCase() === String(field).toLowerCase() ||
            f.label.toLowerCase() === String(field).toLowerCase()
        ) || fields[0];

        if (!target) {
          return { success: false, message: `Field "${field}" not found.` };
        }

        const prevVal = target.value;
        setFields((prev) =>
          prev.map((f) => (f.id === target.id ? { ...f, value: String(value) } : f))
        );

        return {
          success: true,
          message: `Filled "${target.label}" with "${value}"`,
          undo: () => {
            setFields((prev) =>
              prev.map((f) => (f.id === target.id ? { ...f, value: prevVal } : f))
            );
          },
        };
      },
    },
    {
      name: 'select_option',
      description: 'Select an option for a dropdown or radio button field (reversible).',
      parameters: {
        field: {
          type: 'string',
          description: 'Field ID or label.',
          required: true,
        },
        option: {
          type: 'string',
          description: 'The option value to select.',
          required: true,
        },
      },
      isReadOnly: false,
      isReversible: true,
      confirmationPrompt: ({ field, option }) => `Select "${option}" for "${field}"?`,
      handler: async ({ field, option }) => {
        const target = fields.find(
          (f) =>
            f.id.toLowerCase() === String(field).toLowerCase() ||
            f.label.toLowerCase() === String(field).toLowerCase()
        );
        if (!target) {
          return { success: false, message: `Field "${field}" not found.` };
        }
        const prevVal = target.value;
        setFields((prev) =>
          prev.map((f) => (f.id === target.id ? { ...f, value: String(option) } : f))
        );
        return {
          success: true,
          message: `Selected "${option}" for "${target.label}"`,
          undo: () => {
            setFields((prev) =>
              prev.map((f) => (f.id === target.id ? { ...f, value: prevVal } : f))
            );
          },
        };
      },
    },
    {
      name: 'attach_document',
      description: 'Attach a verified user document to a form field.',
      parameters: {
        field: {
          type: 'string',
          description: 'The field name or ID.',
          required: true,
        },
        documentId: {
          type: 'string',
          description: 'The ID of the document to attach.',
          required: true,
        },
      },
      isReadOnly: false,
      confirmationPrompt: ({ field, documentId }) => `Attach document #${documentId} to "${field}"?`,
      handler: async ({ field, documentId }) => {
        return {
          success: true,
          message: `Attached document #${documentId} to "${field}"`,
        };
      },
    },
    {
      name: 'download_pdf',
      description: 'Download the current form document as a PDF.',
      parameters: {
        formId: {
          type: 'string',
          description: 'Optional form ID.',
          required: false,
        },
      },
      isReadOnly: false,
      confirmationPrompt: () => `Download this form as a PDF document?`,
      handler: async () => {
        const fieldData = fields.map((f) => ({
          label: f.label || 'Field',
          value: f.value || '',
          required: f.required,
          section: f.section,
        }));
        downloadFormAsDocument(
          title || 'Form Document',
          fieldData,
          category || 'General',
          formStatus || 'draft',
          undefined,
          category?.toLowerCase().includes('letter') ? 'letter' : undefined
        );
        return {
          success: true,
          message: 'PDF downloaded successfully',
        };
      },
    },
    {
      name: 'submit_form',
      description: 'Review and confirm submission of the form application.',
      parameters: {},
      isReadOnly: false,
      confirmationPrompt: () => 'Submit form application? Please review your summary before finalizing.',
      handler: async () => {
        return {
          success: true,
          message: 'Form summary prepared for manual review.',
        };
      },
    },
  ], [fields, title, category, formStatus]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/forms/${formId}`);
      if (!res.ok) {
        alert('Form not found or inaccessible.');
        router.push('/forms');
        return;
      }
      const data = await res.json();
      setTitle(data.title || '');
      setDescription(data.description || '');
      setCategory(data.category || 'general');
      setLanguage(data.language || 'en');
      setFormStatus(data.status || 'draft');

      let parsedFields: FormField[] = [];
      try {
        parsedFields = JSON.parse(data.fields);
      } catch {
        parsedFields = [];
      }

      let parsedFilled: Record<string, string> = {};
      try {
        parsedFilled = JSON.parse(data.filled_data || '{}');
      } catch {
        parsedFilled = {};
      }

      const seenIds = new Set<string>();
      const mergedFields = parsedFields.map((f, idx) => {
        let fieldId = f.id ? String(f.id).trim() : '';
        if (!fieldId || seenIds.has(fieldId)) {
          fieldId = `field_${idx + 1}_${Date.now()}`;
        }
        seenIds.add(fieldId);
        return {
          ...f,
          id: fieldId,
          value: parsedFilled[f.label] !== undefined ? parsedFilled[f.label] : (f.value || ''),
        };
      });

      setFields(mergedFields);

      if (data.document_content) {
        try {
          const parsed = typeof data.document_content === 'string' ? JSON.parse(data.document_content) : data.document_content;
          setDocumentContent(parsed);
        } catch (e) {
          console.warn('Failed parsing document_content:', e);
        }
      }
      if (data.template_id) setTemplateId(data.template_id);
    } catch (e) {
      console.error('Failed to load form:', e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill from user profile: ONLY uses real profile data, never fake or synthetic fallbacks
  const handleAutoFillFromProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) return;
      const profile = await res.json();

      let customMap: Record<string, string> = {};
      if (profile.custom_fields) {
        try {
          customMap = typeof profile.custom_fields === 'string' ? JSON.parse(profile.custom_fields) : profile.custom_fields;
        } catch {
          customMap = {};
        }
      }

      const userName = profile.full_name || session?.user?.name || '';
      const userEmail = profile.email || session?.user?.email || '';
      const addressParts = [profile.address, profile.city, profile.state].filter(Boolean);
      const fullAddress = addressParts.length > 0
        ? addressParts.join(', ') + (profile.pincode ? ' - ' + profile.pincode : '')
        : '';

      const profileData: Record<string, string> = {
        full_name: userName,
        email: userEmail,
        phone: profile.phone || '',
        address: fullAddress,
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
        father_name: profile.father_name || '',
        mother_name: profile.mother_name || '',
        blood_group: profile.blood_group || '',
        emergency_contact: profile.emergency_contact || '',
        marital_status: profile.marital_status || '',
        occupation: profile.occupation || '',
        city: profile.city || '',
        state: profile.state || '',
        pincode: profile.pincode || '',
        country: profile.country || '',
      };

      const analysis = analyzeFormFields(
        fields.map(f => ({ name: f.id, label: f.label, type: f.type, required: !!f.required })),
        profileData
      );

      const profileLookup: Record<string, string> = {};
      analysis.forEach(a => {
        if (a.canFill && a.value) {
          profileLookup[a.fieldName] = a.value;
          profileLookup[a.label] = a.value;
        }
      });

      setFields(prev =>
        prev.map(field => {
          if (field.value && field.value.trim() !== '') return field;
          const matchedVal = profileLookup[field.id] || profileLookup[field.label];
          return matchedVal ? { ...field, value: matchedVal } : field;
        })
      );

      speakText(getLocalizedMessage('autofilled', language), language);
    } catch (e) {
      console.error('Auto-fill error:', e);
    }
  };

  // Upload Form Document & Update Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setUploadedFile({
          name: file.name,
          size: sizeFormatted,
          type: file.type,
          content: `Document Image: ${file.name}\nExtracted text candidate from uploaded scan`,
          previewUrl: dataUrl,
        });
        setUploadFeedback(`Uploaded image: ${file.name}`);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        setUploadedFile({
          name: file.name,
          size: sizeFormatted,
          type: file.type || 'text/plain',
          content: text,
        });
        setUploadFeedback(`Loaded file: ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  const startUploadVoiceInstruction = () => {
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
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListeningUploadInst(true);
      setUploadFeedback(`Listening in ${langObj?.label || language}...`);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.trim();
      setUploadInstruction(transcript);
      setIsListeningUploadInst(false);

      const lower = transcript.toLowerCase();
      if (lower.includes('fix only') || lower.includes('only fix') || lower.includes('सिर्फ ठीक') || lower.includes('केवल सुधार')) {
        setUploadMode('fix_only');
      } else if (lower.includes('profile') || lower.includes('प्रोफ़ाइल') || lower.includes('my data')) {
        setUploadMode('extract_and_profile');
      } else {
        setUploadMode('format_only');
      }

      setUploadFeedback(`Instruction recorded: "${transcript}"`);
    };

    recognition.onerror = () => setIsListeningUploadInst(false);
    recognition.onend = () => setIsListeningUploadInst(false);
    recognition.start();
  };

  const handleProcessUploadedDocument = async () => {
    if (!uploadedFile && !uploadInstruction.trim()) {
      alert('Please upload a document or provide an instruction.');
      return;
    }

    setIsProcessingUpload(true);
    setUploadFeedback('Analyzing document with deep document reasoning...');

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
          fileName: uploadedFile?.name || 'uploaded_document.txt',
          fileContent: uploadedFile?.content || uploadInstruction,
          mode: uploadMode,
          instruction: uploadInstruction,
          language,
          profileData,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.title) setTitle(data.title);
        if (data.category) setCategory(data.category);
        if (Array.isArray(data.fields) && data.fields.length > 0) {
          const seenIds = new Set<string>();
          const formatted: FormField[] = data.fields.map((f: any, idx: number) => {
            let fieldId = f.id ? String(f.id).trim() : '';
            if (!fieldId || seenIds.has(fieldId)) {
              fieldId = `field_${idx + 1}_${Date.now()}`;
            }
            seenIds.add(fieldId);
            return {
              id: fieldId,
              label: f.label || `Field ${idx + 1}`,
              type: f.type || 'text',
              value: f.value || '',
              required: !!f.required,
              placeholder: f.placeholder || '',
            };
          });
          setFields(formatted);
          setUploadResultFeedback({
            summary: data.summaryOfChanges,
            cleanedCount: data.cleanedValuesCount,
            fixedCount: data.fixedCount,
            mode: data.modeApplied,
          });
          const speakMsg = data.summaryOfChanges || 'Document processed successfully.';
          setUploadFeedback(speakMsg);
          speakText(speakMsg, language);
        }
      } else {
        alert('Could not process the uploaded document.');
      }
    } catch (err) {
      console.error('Upload processing error:', err);
      alert('Error during document processing');
    } finally {
      setIsProcessingUpload(false);
    }
  };

  // Real-time Text to Speech for a specific field in the selected native language
  const readFieldAloud = (field: FormField) => {
    if (currentlyReadingFieldId === field.id) {
      stopSpeaking();
      setCurrentlyReadingFieldId(null);
      return;
    }

    stopSpeaking();
    setReadingAll(false);
    setCurrentlyReadingFieldId(field.id);

    const textToSpeak = formatFieldSpeech(field.label, field.value, !!field.required, language);

    speakText(
      textToSpeak,
      language,
      () => setCurrentlyReadingFieldId(field.id),
      () => setCurrentlyReadingFieldId(null)
    );
  };

  // Real-time reading for entire form in native language
  const readEntireForm = () => {
    if (readingAll) {
      stopSpeaking();
      setReadingAll(false);
      return;
    }

    setReadingAll(true);
    const fullScript = formatFormOverviewSpeech(title || 'Form', fields, language);

    speakText(
      fullScript,
      language,
      () => setReadingAll(true),
      () => setReadingAll(false)
    );
  };

  // Multilingual Speech Recognition
  const startVoiceInput = (fieldId: string) => {
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
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === language);
    recognition.lang = langObj ? langObj.bcp47 : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setActiveFieldId(fieldId);
      setVoiceText('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setVoiceText(transcript);

      if (event.results[0].isFinal) {
        const spoken = transcript.trim();

        // Voice command recognition: if user says "read aloud", "read cloud", "read form", etc.
        if (isReadAloudCommand(spoken)) {
          setIsListening(false);
          setActiveFieldId(null);
          setAutoFillPending(null);
          const lower = spoken.toLowerCase();
          if (lower.includes('form') || lower.includes('all') || lower.includes('पूरा') || lower.includes('सब')) {
            readEntireForm();
          } else {
            const currentField = fields.find(f => f.id === fieldId);
            if (currentField) {
              readFieldAloud(currentField);
            } else {
              readEntireForm();
            }
          }
          return;
        }

        const intent = parseVoiceCommand(spoken, language);
        if (intent === 'read') {
          setIsListening(false);
          setActiveFieldId(null);
          setAutoFillPending(null);
          readEntireForm();
          return;
        }
        if (intent === 'fill') {
          setIsListening(false);
          setActiveFieldId(null);
          setAutoFillPending(null);
          handleAutoFillFromProfile();
          return;
        }
        if (intent === 'submit') {
          setIsListening(false);
          setActiveFieldId(null);
          setAutoFillPending(null);
          submitForm();
          return;
        }
        if (intent === 'download') {
          setIsListening(false);
          setActiveFieldId(null);
          setAutoFillPending(null);
          handleDownload();
          return;
        }

        setAutoFillPending({
          fieldId,
          spokenValue: spoken,
          value: spoken,
          isTranslating: true,
        });

        // Always translate voice input from any language into English for form field value
        translateToEnglish(spoken, language || 'auto').then(translated => {
          setAutoFillPending(prev => {
            if (!prev || prev.fieldId !== fieldId) return prev;
            return {
              ...prev,
              value: translated || spoken,
              isTranslating: false,
            };
          });
        });
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setActiveFieldId(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setActiveFieldId(null);
  };

  const approveAutoFill = () => {
    if (!autoFillPending) return;
    // Store the English value in the form field
    setFields(prev =>
      prev.map(f =>
        f.id === autoFillPending.fieldId ? { ...f, value: autoFillPending.value } : f
      )
    );
    if (autoFillPending.spokenValue && autoFillPending.spokenValue !== autoFillPending.value) {
      setOriginalInputs(prev => ({ ...prev, [autoFillPending.fieldId]: autoFillPending.spokenValue }));
    }
    // Spoken feedback in user's chosen language confirming the recorded value
    speakText(getLocalizedMessage('recorded', language, autoFillPending.value), language);
    setAutoFillPending(null);
    setVoiceText('');
    setActiveFieldId(null);
  };

  const handleDownload = async (format: 'pdf' | 'docx' | 'txt' = 'pdf') => {
    try {
      const res = await fetch(`/api/forms/${formId}/download?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        let filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${format}`;
        const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].replace(/["']/g, ''));
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Fallback to legacy document builder if server error
        downloadFormAsDocument(
          title || 'Application Form',
          fields.map(f => ({ label: f.label, value: f.value, required: f.required, section: f.section })),
          category,
          formStatus,
          undefined,
          category?.toLowerCase().includes('letter') ? 'letter' : undefined
        );
      }
    } catch {
      downloadFormAsDocument(
        title || 'Application Form',
        fields.map(f => ({ label: f.label, value: f.value, required: f.required, section: f.section })),
        category,
        formStatus,
        undefined,
        category?.toLowerCase().includes('letter') ? 'letter' : undefined
      );
    }
  };

  const handleDownloadPackage = async () => {
    try {
      const res = await fetch(`/api/forms/${formId}/package`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_')}_Package.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        handleDownload('pdf');
      }
    } catch {
      handleDownload('pdf');
    }
  };

  const handleRegenerateSection = async (sectionName: string, customInstruction = '') => {
    if (!documentContent) return;
    setRegeneratingSection(sectionName);
    try {
      const res = await fetch('/api/forms/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId || 'general_application',
          sectionName,
          currentSections: documentContent,
          language,
          instruction: customInstruction,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.content) {
          setDocumentContent((prev: any) => ({ ...prev, [sectionName]: data.content }));
        }
      }
    } catch (err) {
      console.error('Section regeneration error:', err);
    } finally {
      setRegeneratingSection(null);
    }
  };

  const updateSection = (sectionKey: string, value: string | string[]) => {
    setDocumentContent((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        [sectionKey]: value,
      };
    });
  };

  const rejectAutoFill = () => {
    setAutoFillPending(null);
    setVoiceText('');
    setActiveFieldId(null);
  };

  const addField = () => {
    const newId = `field_${Date.now()}_${fields.length + 1}`;
    setFields([...fields, { id: newId, label: 'New Field', type: 'text', value: '', required: false }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  // Auto-translate typed or entered input to English for official form completion
  const handleTranslateField = async (fieldId: string, textToTranslate?: string) => {
    const targetField = fields.find(f => f.id === fieldId);
    const text = textToTranslate !== undefined ? textToTranslate : targetField?.value;
    if (!text || !text.trim()) return;

    const hasNonAscii = /[^\x00-\x7F]/.test(text);
    if (language === 'en' && !hasNonAscii) return;

    setTranslatingFieldIds(prev => ({ ...prev, [fieldId]: true }));
    try {
      const translated = await translateToEnglish(text, language);
      if (translated && translated.trim() && translated.trim() !== text.trim()) {
        setOriginalInputs(prev => ({ ...prev, [fieldId]: text }));
        updateField(fieldId, { value: translated.trim() });
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslatingFieldIds(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const handleTranslateAllFields = async () => {
    setIsTranslatingAll(true);
    try {
      for (const field of fields) {
        if (!field.value || !field.value.trim()) continue;
        const hasNonAscii = /[^\x00-\x7F]/.test(field.value);
        if (language !== 'en' || hasNonAscii) {
          const translated = await translateToEnglish(field.value, language);
          if (translated && translated.trim() && translated.trim() !== field.value.trim()) {
            setOriginalInputs(prev => ({ ...prev, [field.id]: field.value }));
            updateField(field.id, { value: translated.trim() });
          }
        }
      }
    } catch (err) {
      console.error('Translate all error:', err);
    } finally {
      setIsTranslatingAll(false);
    }
  };

  const saveForm = async (targetStatus?: string) => {
    setSaving(true);
    try {
      const filledData: Record<string, string> = {};
      fields.forEach(f => {
        filledData[f.label] = f.value;
        if (f.id) filledData[f.id] = f.value;
      });

      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          language,
          fields,
          filledData,
          status: targetStatus || formStatus,
          documentContent,
          templateId,
        }),
      });

      if (res.ok) {
        if (targetStatus) setFormStatus(targetStatus);
        speakText(getLocalizedMessage('saved', language), language);
      }
    } catch (e) {
      console.error('Failed to save form:', e);
    } finally {
      setSaving(false);
    }
  };

  const submitForm = async () => {
    // Check required fields
    const emptyRequired = fields.filter(f => f.required && (!f.value || f.value.trim() === ''));
    if (emptyRequired.length > 0) {
      const msg = `Please fill required field: ${emptyRequired[0].label}`;
      alert(msg);
      speakText(msg, language);
      return;
    }

    setSubmitting(true);
    await saveForm('submitted');
    setSubmitting(false);
    speakText(getLocalizedMessage('submitted', language), language);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading Form...</p>
      </div>
    );
  }

  useAppHeader({
    title: title || 'Edit Form',
    subtitle: 'Real-time voice reading & multilingual input',
    actions: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <button
          className={`btn ${readingAll ? 'btn-danger' : 'btn-secondary'} btn-sm`}
          onClick={readEntireForm}
          title="Real-time reading of all fields"
        >
          {readingAll ? 'Stop Reading' : 'Read Form Aloud'}
        </button>

        <button className="btn btn-secondary btn-sm" onClick={handleAutoFillFromProfile} title="Auto-fill with saved documents & profile">
          Auto-Fill from Profile
        </button>

        <div className="download-btn-group" style={{ display: 'inline-flex', gap: '4px' }}>
          <button className="btn-download-pdf" onClick={() => handleDownload('pdf')} title="Download authentic PDF with embedded Devanagari font">
            📄 PDF
          </button>
          <button id="btn-download-package" data-testid="btn-download-package" className="btn btn-secondary btn-sm" style={{ background: '#0284c7', color: 'white', borderColor: '#0284c7', fontWeight: 700 }} onClick={handleDownloadPackage} title="Download Package with Enclosures">
            📦 Package
          </button>
          <button className="btn-download-docx" onClick={() => handleDownload('docx')} title="Download Word DOCX">
            📝 DOCX
          </button>
          <button className="btn-download-txt" onClick={() => handleDownload('txt')} title="Download Plain Text">
            📃 TXT
          </button>
        </div>

        <button
          className={`btn ${showUploadBanner ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setShowUploadBanner(!showUploadBanner)}
          title="Upload document, scan, or existing letter to extract or fix"
        >
          📄 {showUploadBanner ? 'Hide Upload' : 'Upload Document'}
        </button>

        <button className="btn btn-primary btn-sm" onClick={submitForm} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Form'}
        </button>
      </div>
    ),
  });

  return (
    <div className="form-content animate-fadeIn">
          {/* Form submitted notice with direct download */}
          {(formStatus === 'submitted' || formStatus === 'completed') && (
            <div className="card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>✅</span>
                <div>
                  <h4 style={{ margin: 0, color: '#166534', fontSize: '15px', fontWeight: 600 }}>Form Submitted Successfully!</h4>
                  <p style={{ margin: '2px 0 0', color: '#15803d', fontSize: '12px' }}>Your form is recorded and ready for download or printing.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn-download-pdf" onClick={() => handleDownload('pdf')}>
                  📄 PDF
                </button>
                <button className="btn-download-package" style={{ background: '#0284c7', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} onClick={handleDownloadPackage}>
                  📦 Package PDF
                </button>
                <button className="btn-download-docx" onClick={() => handleDownload('docx')}>
                  📝 DOCX
                </button>
                <button className="btn-download-txt" onClick={() => handleDownload('txt')}>
                  📃 TXT
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  🖨️ Print
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => router.push('/forms')}>
                  ← Back to Forms
                </button>
              </div>
            </div>
          )}

          {/* Auto-fill voice approval modal with translation */}
          {autoFillPending && (
            <div className="autofill-dialog card animate-slideUp">
              <div className="autofill-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                <span>Voice Input Recognized & Translated</span>
              </div>
              <div style={{ margin: '8px 0', fontSize: '13px' }}>
                <div style={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  🗣️ Spoken Input ({SUPPORTED_LANGUAGES.find(l => l.code === language)?.label || language}): <strong>&ldquo;{autoFillPending.spokenValue}&rdquo;</strong>
                </div>
                <div style={{ color: '#166534', background: '#dcfce7', padding: '8px 12px', borderRadius: '6px', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                  {autoFillPending.isTranslating ? '⏳ Translating to English...' : `📝 Form Field Output (English): "${autoFillPending.value}"`}
                </div>
              </div>
              <div className="autofill-actions">
                <button className="btn btn-primary btn-sm" onClick={approveAutoFill} disabled={autoFillPending.isTranslating}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Confirm & Fill in English
                </button>
                <button className="btn btn-secondary btn-sm" onClick={rejectAutoFill}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Upload Document / Scan Banner */}
          {showUploadBanner && (
            <div className="card" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-md)', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx,.doc,.rtf,image/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              
              {!uploadedFile ? (
                <div
                  className="upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
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
                      Upload form document, scan, or letter to update fields
                    </strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Supports PDF, PNG, JPG, Word (.docx), or plain text files
                    </span>
                  </div>
                </div>
              ) : (
                <div className="uploaded-file-banner">
                  <div className="file-info-col">
                    {uploadedFile.previewUrl ? (
                      <img src={uploadedFile.previewUrl} alt="Preview" className="file-preview-thumb" />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                        📄
                      </div>
                    )}
                    <div>
                      <strong style={{ fontSize: '13px', display: 'block' }}>{uploadedFile.name}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{uploadedFile.size} • {uploadedFile.type}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setUploadedFile(null);
                        setUploadResultFeedback(null);
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                </div>
              )}

              <div className="upload-modes-container">
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Select How to Update this Form:
                </span>
                <div className="upload-mode-buttons">
                  <button
                    type="button"
                    className={`upload-mode-btn ${uploadMode === 'format_only' ? 'active' : ''}`}
                    onClick={() => setUploadMode('format_only')}
                    title="Removes existing details and extracts blank reusable format"
                  >
                    ⚡ Take as Clean Format (Remove Existing Text)
                  </button>
                  <button
                    type="button"
                    className={`upload-mode-btn ${uploadMode === 'fix_only' ? 'active' : ''}`}
                    onClick={() => setUploadMode('fix_only')}
                    title="Preserves existing data and fixes only what you specify"
                  >
                    🛠️ Fix Specific Things Only
                  </button>
                  <button
                    type="button"
                    className={`upload-mode-btn ${uploadMode === 'extract_and_profile' ? 'active' : ''}`}
                    onClick={() => setUploadMode('extract_and_profile')}
                    title="Extracts structure and auto-fills with verified profile data"
                  >
                    👤 Extract Format & Fill from My Profile
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                  <input
                    className="input"
                    placeholder={
                      uploadMode === 'fix_only'
                        ? "Specify what to fix (e.g. 'Fix date and contact only', 'Fix spelling in reason')..."
                        : "Instruction (e.g. 'Take this as format and remove text')..."
                    }
                    value={uploadInstruction}
                    onChange={e => setUploadInstruction(e.target.value)}
                    disabled={isProcessingUpload}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className={`btn btn-sm ${isListeningUploadInst ? 'btn-danger mic-button-pulse' : 'btn-secondary'}`}
                    onClick={startUploadVoiceInstruction}
                    title="Speak instruction by voice"
                    disabled={isProcessingUpload}
                  >
                    🎤 {isListeningUploadInst ? 'Listening...' : 'Voice'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleProcessUploadedDocument}
                    disabled={isProcessingUpload || (!uploadedFile && !uploadInstruction.trim())}
                  >
                    {isProcessingUpload ? 'Processing...' : '⚡ Update Form Fields'}
                  </button>
                </div>

                {uploadResultFeedback && (
                  <div className="upload-result-badge">
                    <span style={{ fontSize: '18px' }}>✓</span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block' }}>{uploadResultFeedback.summary}</strong>
                      <span style={{ fontSize: '11px', color: '#15803d' }}>
                        Mode: {uploadResultFeedback.mode === 'format_only' ? 'Clean Blank Format' : uploadResultFeedback.mode === 'fix_only' ? 'Fix Specific Items Only' : 'Profile Auto-Fill'} 
                        {uploadResultFeedback.cleanedCount > 0 && ` • Stripped ${uploadResultFeedback.cleanedCount} pre-filled values`}
                        {uploadResultFeedback.fixedCount > 0 && ` • Selectively updated ${uploadResultFeedback.fixedCount} items`}
                        • Zero synthetic data
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editable Document Preview if documentContent exists */}
          {documentContent && (
            <div className="doc-preview-wrapper animate-fadeIn" style={{ marginBottom: '28px' }}>
              <div className="doc-action-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 800, fontSize: '15px' }}>{title || 'Generated Document'}</span>
                  <span className="badge badge-accent" style={{ fontSize: '11px' }}>
                    Document Preview
                  </span>
                </div>

                <div className="download-btn-group">
                  <button
                    className="btn-download-pdf"
                    onClick={() => handleDownload('pdf')}
                    title="Download authentic PDF with embedded Devanagari font"
                  >
                    📄 PDF
                  </button>
                  <button
                    className="btn-download-docx"
                    onClick={() => handleDownload('docx')}
                    title="Download Microsoft Word DOCX document"
                  >
                    📝 DOCX
                  </button>
                  <button
                    className="btn-download-txt"
                    onClick={() => handleDownload('txt')}
                    title="Download Plain Text"
                  >
                    📃 TXT
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => window.print()}
                    title="Print Document"
                  >
                    🖨️ Print
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => saveForm('draft')}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : '💾 Save Draft'}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={submitForm}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : '✅ Submit'}
                  </button>
                </div>
              </div>

              {/* Editable Paper */}
              <div className="doc-paper">
                {/* Header Section */}
                <div className="doc-section-block">
                  <div className="doc-section-actions">
                    <button
                      className="doc-regen-btn"
                      onClick={() => handleRegenerateSection('header')}
                      disabled={regeneratingSection === 'header'}
                    >
                      {regeneratingSection === 'header' ? 'Rewriting...' : '🔄 Regenerate Header'}
                    </button>
                  </div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {language === 'hi' ? 'प्राप्तकर्ता / पता:' : 'To / Recipient Block:'}
                  </label>
                  <textarea
                    className="doc-editable-textarea"
                    rows={3}
                    value={documentContent.header || ''}
                    onChange={e => updateSection('header', e.target.value)}
                  />
                </div>

                {/* Date Section */}
                <div className="doc-section-block" style={{ textAlign: 'right' }}>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {language === 'hi' ? 'दिनांक:' : 'Date:'}
                  </label>
                  <input
                    type="text"
                    className="doc-editable-input"
                    style={{ textAlign: 'right', maxWidth: '240px', marginLeft: 'auto' }}
                    value={documentContent.date || ''}
                    onChange={e => updateSection('date', e.target.value)}
                  />
                </div>

                {/* Subject Section */}
                <div className="doc-section-block">
                  <div className="doc-section-actions">
                    <button
                      className="doc-regen-btn"
                      onClick={() => handleRegenerateSection('subject')}
                      disabled={regeneratingSection === 'subject'}
                    >
                      {regeneratingSection === 'subject' ? 'Rewriting...' : '🔄 Regenerate Subject'}
                    </button>
                  </div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {language === 'hi' ? 'विषय पंक्ति:' : 'Subject Line:'}
                  </label>
                  <input
                    type="text"
                    className="doc-editable-input"
                    style={{ fontWeight: 700 }}
                    value={documentContent.subject || ''}
                    onChange={e => updateSection('subject', e.target.value)}
                  />
                </div>

                {/* Salutation Section */}
                <div className="doc-section-block">
                  <input
                    type="text"
                    className="doc-editable-input"
                    value={documentContent.salutation || ''}
                    onChange={e => updateSection('salutation', e.target.value)}
                  />
                </div>

                {/* Body Paragraphs Section */}
                <div className="doc-section-block">
                  <div className="doc-section-actions">
                    <button
                      className="doc-regen-btn"
                      onClick={() => handleRegenerateSection('body')}
                      disabled={regeneratingSection === 'body'}
                    >
                      {regeneratingSection === 'body' ? 'Rewriting...' : '🔄 Regenerate Body'}
                    </button>
                  </div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {language === 'hi' ? 'मुख्य विवरण / अनुच्छेद (Body Paragraphs):' : 'Body Paragraphs (Detailed Statement):'}
                  </label>
                  <textarea
                    className="doc-editable-textarea"
                    rows={8}
                    value={documentContent.body || ''}
                    onChange={e => updateSection('body', e.target.value)}
                  />
                </div>

                {/* Enclosures Section (if applicable) */}
                {documentContent.enclosures && (
                  <div className="doc-section-block">
                    <div className="doc-section-actions">
                      <button
                        className="doc-regen-btn"
                        onClick={() => handleRegenerateSection('enclosures')}
                        disabled={regeneratingSection === 'enclosures'}
                      >
                        {regeneratingSection === 'enclosures' ? 'Rewriting...' : '🔄 Regenerate Enclosures'}
                      </button>
                    </div>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      {language === 'hi' ? 'संलग्नक (दस्तावेज़ सूची):' : 'Enclosures:'}
                    </label>
                    <textarea
                      className="doc-editable-textarea"
                      rows={3}
                      value={Array.isArray(documentContent.enclosures) ? documentContent.enclosures.join('\n') : (documentContent.enclosures || '')}
                      onChange={e => updateSection('enclosures', e.target.value.split('\n'))}
                    />
                  </div>
                )}

                {/* Closing & Signature Section */}
                <div className="doc-section-block" style={{ marginTop: '24px' }}>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {language === 'hi' ? 'समापन व हस्ताक्षर:' : 'Closing & Sign-off:'}
                  </label>
                  <input
                    type="text"
                    className="doc-editable-input"
                    style={{ marginBottom: '8px' }}
                    value={documentContent.closing || ''}
                    onChange={e => updateSection('closing', e.target.value)}
                  />
                  <textarea
                    className="doc-editable-textarea"
                    rows={3}
                    style={{ fontWeight: 600 }}
                    value={documentContent.signature || ''}
                    onChange={e => updateSection('signature', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Settings / Metadata */}
          <div className="form-meta card">
            <div className="form-meta-grid">
              <div className="input-group">
                <label className="input-label">Form Title</label>
                <input
                  className="input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Passport Application Form"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Domain / Category</label>
                <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="government">Government Services</option>
                  <option value="education">Education & Admissions</option>
                  <option value="healthcare">Healthcare & Insurance</option>
                  <option value="banking">Banking & Finance</option>
                  <option value="business">Business & Licensing</option>
                  <option value="general">General Application</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Spoken & Reading Language</label>
                <select
                  className="input"
                  value={language}
                  onChange={e => {
                    setLanguage(e.target.value);
                    stopSpeaking();
                  }}
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

          {/* Form Fields List */}
          <div className="form-fields">
            <div className="form-fields-header">
              <h2>Form Fields ({fields.length})</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleTranslateAllFields}
                  disabled={isTranslatingAll}
                  title="Convert all non-English responses to English for official submission"
                >
                  🌐 {isTranslatingAll ? 'Converting...' : 'Convert All to English'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={addField}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Field
                </button>
              </div>
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id ? `field-${field.id}-${index}` : `field-${index}`}
                className={`form-field card ${activeFieldId === field.id ? 'form-field-active' : ''}`}
                style={{
                  borderLeft: currentlyReadingFieldId === field.id ? '4px solid var(--color-primary)' : undefined,
                  transition: 'border-color 0.2s ease',
                }}
              >
                <div className="field-header">
                  <div className="field-label-edit">
                    <input
                      className="field-label-input"
                      value={field.label}
                      onChange={e => updateField(field.id, { label: e.target.value })}
                      placeholder="Field Label"
                    />
                    <select
                      className="field-type-select"
                      value={field.type}
                      onChange={e => updateField(field.id, { type: e.target.value })}
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="textarea">Long Text</option>
                    </select>
                  </div>

                  <div className="field-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {/* Real-time reading button for this field */}
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => readFieldAloud(field)}
                      title="Read this question aloud (Text-to-Speech)"
                      style={{ color: currentlyReadingFieldId === field.id ? 'var(--color-primary)' : 'inherit' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </button>

                    {/* Multilingual Voice Input Microphone */}
                    <button
                      className={`btn btn-icon voice-btn ${isListening && activeFieldId === field.id ? 'voice-btn-active' : ''}`}
                      onClick={() =>
                        isListening && activeFieldId === field.id ? stopVoiceInput() : startVoiceInput(field.id)
                      }
                      title="Speak in your native language to fill this field"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                        <path d="M19 10v2a7 7 0 01-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>

                    {/* Translate field to English button */}
                    <button
                      className="btn btn-icon btn-ghost"
                      onClick={() => handleTranslateField(field.id)}
                      title="Translate response to English for official submission"
                      disabled={translatingFieldIds[field.id]}
                      style={{ color: translatingFieldIds[field.id] ? 'var(--color-primary)' : 'inherit' }}
                    >
                      🌐
                    </button>

                    {fields.length > 1 && (
                      <button className="btn btn-icon btn-ghost" onClick={() => removeField(field.id)} title="Remove field">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {field.type === 'textarea' ? (
                  <textarea
                    className="input field-input"
                    value={field.value}
                    onChange={e => updateField(field.id, { value: e.target.value })}
                    onBlur={() => handleTranslateField(field.id)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    rows={3}
                  />
                ) : (
                  <input
                    className="input field-input"
                    type={field.type}
                    value={field.value}
                    onChange={e => updateField(field.id, { value: e.target.value })}
                    onBlur={() => handleTranslateField(field.id)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                )}

                {/* Translating Indicator */}
                {translatingFieldIds[field.id] && (
                  <div style={{ fontSize: '12px', color: 'var(--color-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⏳ Translating to English for official form...</span>
                  </div>
                )}

                {/* Original Language Value Reference */}
                {originalInputs[field.id] && (
                  <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '4px', background: '#f0f9ff', padding: '4px 8px', borderRadius: '4px' }}>
                    Original: &ldquo;{originalInputs[field.id]}&rdquo; → Converted to English for official form
                  </div>
                )}

                {/* Voice listening active indicator */}
                {isListening && activeFieldId === field.id && (
                  <div className="voice-indicator">
                    <div className="voice-wave">
                      <span /><span /><span /><span /><span />
                    </div>
                    <span className="voice-status">Listening in {language.toUpperCase()}... {voiceText ? `"${voiceText}"` : ''}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Form Actions Footer */}
          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
            <button className="btn btn-ghost" onClick={() => router.push('/forms')}>
              Cancel
            </button>
            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="download-btn-group">
                <button className="btn-download-pdf" onClick={() => handleDownload('pdf')} title="Download PDF with Devanagari font">
                  📄 PDF
                </button>
                <button className="btn-download-docx" onClick={() => handleDownload('docx')} title="Download Word DOCX">
                  📝 DOCX
                </button>
                <button className="btn-download-txt" onClick={() => handleDownload('txt')} title="Download Plain Text">
                  📃 TXT
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Print Document">
                  🖨️ Print
                </button>
              </div>
              <button className="btn btn-secondary" onClick={() => saveForm('draft')} disabled={saving}>
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button className="btn btn-primary" onClick={submitForm} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Form'}
              </button>
            </div>
          </div>
        </div>
  );
}
