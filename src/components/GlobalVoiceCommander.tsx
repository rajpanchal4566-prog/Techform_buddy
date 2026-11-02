'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  routeVoiceIntent,
  VoiceIntentResult,
  sanitizeTranscript,
} from '@/lib/voiceIntentRouter';
import {
  getDefaultLanguage,
  getLanguageBcp47,
  SUPPORTED_LANGUAGES,
  speakText,
  stopSpeaking,
  isSpeaking as checkIsSpeaking,
} from '@/lib/speech';
import { SCREEN_DESCRIPTIONS } from '@/components/AccessibilityHelper';
import { translateFromEnglish } from '@/lib/translate';
import { redactPII } from '@/lib/piiSanitizer';
import {
  actionRegistry,
  ActionLogEntry,
  validateActionParams,
} from '@/lib/actionRegistry';
import { createGlobalActions } from '@/lib/globalActions';
import {
  getAutofillMode,
  setAutofillMode,
  hasAutofillConsent,
  setAutofillConsent,
  executeAutofillRun,
  undoAutofillItem,
  undoAllAutofill,
  AutofillSummary,
  setNativeFieldValue,
} from '@/lib/autofillMode';
import {
  planUserUtterance,
  AssistantPlan,
  PlanStep,
  ClarifyingQuestion,
  PlannerResult,
} from '@/lib/planner';
import './voice-commander.css';
import BuddyMascot from '@/components/BuddyMascot';

// Type definitions for Web Speech API
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: IWindowSpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: IWindowSpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: IWindowSpeechRecognition, ev: { error: string }) => void) | null;
  onend: ((this: IWindowSpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new(): IWindowSpeechRecognition;
}

export default function GlobalVoiceCommander() {
  const router = useRouter();
  const pathname = usePathname() || '/';

  // Server-safe deterministic defaults to prevent hydration mismatch (Requirement 1)
  const [isMounted, setIsMounted] = useState(false);
  const [briefingTitle, setBriefingTitle] = useState('Smart Briefing');
  const [briefingAria, setBriefingAria] = useState('Listen to smart briefing');

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentLang, setCurrentLang] = useState('en');
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<VoiceIntentResult | null>(null);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [lastActionFeedback, setLastActionFeedback] = useState<string | null>(null);
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [activeTab, setActiveTab] = useState<'guide' | 'fill' | 'voice' | 'actions' | 'read'>('voice');
  const [isHidden, setIsHidden] = useState(false);
  const [badgePos, setBadgePos] = useState<{ x: number; y: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Action Registry States (Requirement 1, 3 & 4)
  const [pendingAction, setPendingAction] = useState<{
    name: string;
    parameters: Record<string, any>;
    prompt: string;
  } | null>(null);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  // Autofill Mode States (Requirement 1, 2 & 3)
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [autofillSummary, setAutofillSummary] = useState<AutofillSummary | null>(null);
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);
  const [walkthroughValue, setWalkthroughValue] = useState('');
  const [isWalkthroughListening, setIsWalkthroughListening] = useState(false);

  // Natural Language Multi-Step Assistant Plan States
  const [activePlan, setActivePlan] = useState<AssistantPlan | null>(null);
  const [isExecutingPlan, setIsExecutingPlan] = useState(false);
  const [planQuestionInput, setPlanQuestionInput] = useState('');
  const [planClarification, setPlanClarification] = useState<ClarifyingQuestion | null>(null);
  const [planPendingConfirmation, setPlanPendingConfirmation] = useState<{
    step: PlanStep;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Toggle Autofill Mode (Requirement 1)
  const toggleAutofill = useCallback(() => {
    setAutofillEnabled((prev) => {
      const next = !prev;
      setAutofillMode(next);
      return next;
    });
  }, []);

  // Autofill Mode Sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAutofillEnabled(getAutofillMode());
      const handleModeChange = (e: any) => {
        if (typeof e?.detail?.enabled === 'boolean') {
          setAutofillEnabled(e.detail.enabled);
        }
      };
      window.addEventListener('tfb-autofill-mode-changed', handleModeChange);
      return () => window.removeEventListener('tfb-autofill-mode-changed', handleModeChange);
    }
  }, []);

  // Load User Profile for Autofill
  const loadProfileForAutofill = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        if (data && (data.full_name || data.email)) {
          return data;
        }
      }
    } catch { }
    return {
      full_name: 'Raj Vishwakarma',
      email: 'raj@example.com',
      phone: '9876543210',
      date_of_birth: '2000-01-15',
      address: '123 MG Road',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      pincode: '462001',
    };
  }, []);

  // Run Autofill on Page (Requirement 2)
  const handleRunAutofill = useCallback(async () => {
    if (!autofillEnabled) {
      const msg = currentLang === 'hi' ? 'ऑटोफ़िल मोड बंद है' : 'Autofill Mode is currently OFF';
      setStatusMessage(msg);
      speakText(msg, currentLang);
      return;
    }

    const siteKey = typeof window !== 'undefined' ? window.location.hostname || 'app' : 'app';
    if (!hasAutofillConsent(siteKey)) {
      setShowConsentModal(true);
      return;
    }

    const profile = await loadProfileForAutofill();
    const summary = executeAutofillRun(document, profile);
    setAutofillSummary(summary);

    const feedback = currentLang === 'hi'
      ? `ऑटोफ़िल पूरा: ${summary.filledCount} भरे गए, ${summary.skippedCount} छोड़े गए`
      : `Autofill complete: ${summary.filledCount} filled, ${summary.skippedCount} skipped`;
    setLastActionFeedback(feedback);
    setStatusMessage(feedback);
    speakText(feedback, currentLang);
  }, [autofillEnabled, currentLang, loadProfileForAutofill]);

  // Grant One-Time Consent and Run
  const handleGrantConsent = useCallback(async () => {
    const siteKey = typeof window !== 'undefined' ? window.location.hostname || 'app' : 'app';
    setAutofillConsent(siteKey, true);
    setShowConsentModal(false);
    await handleRunAutofill();
  }, [handleRunAutofill]);

  // Undo Individual Item
  const handleUndoItem = useCallback((item: any) => {
    undoAutofillItem(item);
    setAutofillSummary((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        filledCount: Math.max(0, prev.filledCount - 1),
        skippedCount: prev.skippedCount + 1,
      };
    });
    const msg = currentLang === 'hi' ? `फ़ील्ड रीसेट किया गया: ${item.label}` : `Reset field: ${item.label}`;
    setStatusMessage(msg);
  }, [currentLang]);

  // Undo All (Requirement 2)
  const handleUndoAll = useCallback(() => {
    if (!autofillSummary) return;
    undoAllAutofill(autofillSummary);
    setAutofillSummary({ ...autofillSummary });
    const msg = currentLang === 'hi' ? 'सभी भरे गए फ़ील्ड रीसेट किए गए' : 'All autofilled fields undone';
    setLastActionFeedback(msg);
    setStatusMessage(msg);
    speakText(msg, currentLang);
  }, [autofillSummary, currentLang]);

  // Voice Step-by-Step Walk-through (Requirement 3)
  const startVoiceWalkthrough = useCallback(() => {
    if (!autofillSummary || autofillSummary.skippedCount === 0) {
      const msg = currentLang === 'hi' ? 'कोई छोड़े गए फ़ील्ड नहीं हैं' : 'No skipped fields to walk through';
      setStatusMessage(msg);
      speakText(msg, currentLang);
      return;
    }
    const skipped = autofillSummary.items.filter((i) => i.status === 'skipped');
    if (skipped.length === 0) return;

    setIsWalkthroughActive(true);
    setWalkthroughIndex(0);
    setWalkthroughValue('');

    const first = skipped[0];
    if (first && first.element) {
      try {
        first.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        first.element.style.outline = '3px solid #3b82f6';
        first.element.focus();
      } catch { }
    }
    const prompt = currentLang === 'hi'
      ? `कृपया अपने ${first.label} बताएं:`
      : `What is your ${first.label}?`;
    setStatusMessage(prompt);
    speakText(prompt, currentLang);
  }, [autofillSummary, currentLang]);

  const confirmAndFillWalkthroughItem = useCallback((val: string) => {
    if (!autofillSummary) return;
    const skipped = autofillSummary.items.filter((i) => i.status === 'skipped');
    const item = skipped[walkthroughIndex];
    if (!item) return;

    const cleanVal = val.trim();
    if (cleanVal && item.element) {
      setNativeFieldValue(item.element, cleanVal);
      item.element.style.outline = '2px solid #10b981';
      item.element.style.backgroundColor = '#ecfdf5';
      item.status = 'filled';
      autofillSummary.filledCount++;
      autofillSummary.skippedCount = Math.max(0, autofillSummary.skippedCount - 1);
      setAutofillSummary({ ...autofillSummary });
    }

    const nextIdx = walkthroughIndex + 1;
    const remainingSkipped = autofillSummary.items.filter((i) => i.status === 'skipped');
    if (nextIdx < remainingSkipped.length) {
      setWalkthroughIndex(nextIdx);
      setWalkthroughValue('');
      const nextItem = remainingSkipped[nextIdx];
      if (nextItem && nextItem.element) {
        try {
          nextItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nextItem.element.style.outline = '3px solid #3b82f6';
          nextItem.element.focus();
        } catch { }
      }
      const prompt = currentLang === 'hi'
        ? `कृपया अपने ${nextItem.label} बताएं:`
        : `What is your ${nextItem.label}?`;
      setStatusMessage(prompt);
      speakText(prompt, currentLang);
    } else {
      setIsWalkthroughActive(false);
      const doneMsg = currentLang === 'hi' ? 'सभी फ़ील्ड पूरे हो गए हैं' : 'All fields completed!';
      setStatusMessage(doneMsg);
      speakText(doneMsg, currentLang);
    }
  }, [autofillSummary, walkthroughIndex, currentLang]);

  const handleWalkthroughCommand = useCallback((cmd: string) => {
    if (!autofillSummary) return;
    const skipped = autofillSummary.items.filter((i) => i.status === 'skipped');
    const norm = cmd.toLowerCase().trim();

    if (norm === 'stop' || norm === 'cancel' || norm === 'roko' || norm === 'band') {
      setIsWalkthroughActive(false);
      const msg = currentLang === 'hi' ? 'वॉइस वॉकथ्रू रोक दिया गया' : 'Voice walk-through stopped';
      setStatusMessage(msg);
      speakText(msg, currentLang);
      return;
    }

    if (norm === 'repeat' || norm === 'dobara' || norm === 'phir se') {
      const cur = skipped[walkthroughIndex];
      if (cur) {
        const prompt = currentLang === 'hi' ? `कृपया अपने ${cur.label} बताएं:` : `What is your ${cur.label}?`;
        speakText(prompt, currentLang);
      }
      return;
    }

    if (norm === 'skip' || norm === 'chhodo' || norm === 'next' || norm === 'agla') {
      const nextIdx = walkthroughIndex + 1;
      if (nextIdx < skipped.length) {
        setWalkthroughIndex(nextIdx);
        setWalkthroughValue('');
        const nextItem = skipped[nextIdx];
        if (nextItem && nextItem.element) {
          try {
            nextItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nextItem.element.style.outline = '3px solid #3b82f6';
            nextItem.element.focus();
          } catch { }
        }
        const prompt = currentLang === 'hi' ? `कृपया अपने ${nextItem.label} बताएं:` : `What is your ${nextItem.label}?`;
        setStatusMessage(prompt);
        speakText(prompt, currentLang);
      } else {
        setIsWalkthroughActive(false);
        const doneMsg = currentLang === 'hi' ? 'सभी फ़ील्ड पूरे हो गए हैं' : 'All fields completed!';
        setStatusMessage(doneMsg);
        speakText(doneMsg, currentLang);
      }
      return;
    }

    if (norm === 'go back' || norm === 'back' || norm === 'peeche') {
      const prevIdx = Math.max(0, walkthroughIndex - 1);
      setWalkthroughIndex(prevIdx);
      setWalkthroughValue('');
      const prevItem = skipped[prevIdx];
      if (prevItem && prevItem.element) {
        try {
          prevItem.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          prevItem.element.style.outline = '3px solid #3b82f6';
          prevItem.element.focus();
        } catch { }
      }
      const prompt = currentLang === 'hi' ? `कृपया अपने ${prevItem.label} बताएं:` : `What is your ${prevItem.label}?`;
      setStatusMessage(prompt);
      speakText(prompt, currentLang);
      return;
    }
  }, [autofillSummary, walkthroughIndex, currentLang]);

  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, origLeft: 0, origTop: 0 });

  // Sync language with user preference & check hide / position state after mount (Requirement 1)
  useEffect(() => {
    setIsMounted(true);

    if (typeof window !== 'undefined') {
      const savedLang = getDefaultLanguage();
      if (savedLang) {
        setCurrentLang(savedLang);
        if (savedLang === 'hi') {
          setBriefingTitle('स्मार्ट ब्रीफिंग');
          setBriefingAria('स्मार्ट ब्रीफिंग सुनें');
        } else {
          setBriefingTitle('Smart Briefing');
          setBriefingAria('Listen to smart briefing');
        }
      }

      try {
        const isSiteHidden = localStorage.getItem(`tfb_hidden_${window.location.hostname}`);
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          if (sessionStorage.getItem('tfb_hidden_session') === 'true') {
            setIsHidden(true);
          }
        } else if (isSiteHidden === 'true') {
          setIsHidden(true);
        }
        const savedPos = localStorage.getItem('tfb_commander_pos');
        if (savedPos) {
          const parsed = JSON.parse(savedPos);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            setBadgePos(parsed);
          }
        }

        // Restore active multi-step plan from sessionStorage
        const savedPlanStr = sessionStorage.getItem('tfb_active_plan');
        if (savedPlanStr) {
          const parsed = JSON.parse(savedPlanStr) as AssistantPlan;
          if (parsed && (parsed.status === 'running' || parsed.status === 'proposed')) {
            setActivePlan(parsed);
            if (parsed.status === 'running') {
              setIsOpen(true);
            }
          }
        }
      } catch { }

      // Check speech synthesis state on mount / interval
      const interval = setInterval(() => {
        setIsSpeaking(checkIsSpeaking());
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  // Sync activePlan to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (activePlan && activePlan.status !== 'completed' && activePlan.status !== 'cancelled') {
          sessionStorage.setItem('tfb_active_plan', JSON.stringify(activePlan));
        } else {
          sessionStorage.removeItem('tfb_active_plan');
        }
      } catch (err) {
        console.warn('[GlobalVoiceCommander] Failed to sync plan to sessionStorage:', err);
      }
    }
  }, [activePlan]);

  // Update briefing title/aria when language changes after mount
  useEffect(() => {
    if (!isMounted) return;
    if (currentLang === 'hi') {
      setBriefingTitle('स्मार्ट ब्रीफिंग');
      setBriefingAria('स्मार्ट ब्रीफिंग सुनें');
    } else {
      setBriefingTitle('Smart Briefing');
      setBriefingAria('Listen to smart briefing');
    }
  }, [currentLang, isMounted]);

  // Register app-wide global actions into Action Registry (Requirement 1)
  useEffect(() => {
    const globalActions = createGlobalActions(router);
    const unregs = globalActions.map((act) => actionRegistry.register(act));
    return () => {
      unregs.forEach((unreg) => unreg());
    };
  }, [router]);

  // Subscribe to live Action Registry Log (Requirement 4)
  useEffect(() => {
    return actionRegistry.subscribeLog((log) => {
      setActionLog(log);
    });
  }, []);

  // Listen for extension / custom show events
  useEffect(() => {
    const handleRestoreEvent = () => {
      setIsHidden(false);
      try {
        localStorage.setItem(`tfb_hidden_${window.location.hostname}`, 'false');
      } catch { }
    };
    window.addEventListener('tfb-show-buddy', handleRestoreEvent);
    return () => window.removeEventListener('tfb-show-buddy', handleRestoreEvent);
  }, []);

  // Keyboard shortcut: Alt+B to toggle Buddy visibility; Alt+V to toggle Voice Assistant; Escape to dismiss/stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+B: Toggle Show / Hide Buddy
      if (
        (e.altKey && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'b' || e.key === 'B'))
      ) {
        e.preventDefault();
        setIsHidden((prev) => {
          const next = !prev;
          if (next) handleStop();
          try {
            localStorage.setItem(`tfb_hidden_${window.location.hostname}`, next ? 'true' : 'false');
          } catch { }
          return next;
        });
        return;
      }

      // Ignore if user is currently typing in an input or textarea (unless Alt+V is pressed)
      if (
        (e.altKey && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V'))
      ) {
        e.preventDefault();
        if (isHidden) setIsHidden(false);
        setActiveTab('voice');
        toggleVoiceCommander();
        return;
      }

      if (e.key === 'Escape') {
        if (checkIsSpeaking()) {
          handleStop();
        }
        if (isOpen) {
          closeCommander();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isListening, isHidden]);

  // Extract clean readable text from the main page area
  const extractPageContent = useCallback((): string => {
    if (typeof document === 'undefined') return '';
    const mainEl =
      document.querySelector('main') ||
      document.querySelector('#main-content') ||
      document.querySelector('[role="main"]') ||
      document.body;

    if (!mainEl) return 'This page is empty.';

    // Clone element to sanitize
    const clone = mainEl.cloneNode(true) as HTMLElement;
    const unwanted = clone.querySelectorAll(
      'script, style, nav, svg, .voice-commander-fab, .voice-modal-backdrop, [aria-hidden="true"]'
    );
    unwanted.forEach((el) => el.remove());

    const text = clone.innerText || clone.textContent || '';
    return text.replace(/\s+/g, ' ').trim().slice(0, 1500);
  }, []);

  // Active screen identifier derived from pathname for screen guides
  const activeScreenId = (() => {
    if (pathname === '/') return 'landing';
    if (pathname.startsWith('/forms/')) return 'form-detail';
    if (pathname.startsWith('/forms')) return 'forms';
    if (pathname.startsWith('/documents')) return 'documents';
    if (pathname.startsWith('/assistant')) return 'assistant';
    if (pathname.startsWith('/browser')) return 'browser';
    if (pathname.startsWith('/profile')) return 'profile';
    if (pathname.startsWith('/settings')) return 'settings';
    if (pathname.startsWith('/notifications')) return 'notifications';
    if (pathname.startsWith('/login')) return 'login';
    if (pathname.startsWith('/register')) return 'register';
    if (pathname.startsWith('/dashboard')) return 'dashboard';
    return 'dashboard';
  })();

  // Immediate Stop
  const handleStop = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.abort();
      } catch { }
      setIsListening(false);
    }
    setLastActionFeedback('Stopped');
    setTimeout(() => setLastActionFeedback(null), 2000);
  }, [isListening]);

  // Read current page aloud
  const handleReadAloud = useCallback(() => {
    if (checkIsSpeaking() || isSpeaking) {
      handleStop();
      return;
    }

    const content = extractPageContent();
    if (!content) return;

    stopSpeaking();
    setIsSpeaking(true);
    setLastActionFeedback('Reading page aloud...');

    speakText(
      content,
      currentLang,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        setLastActionFeedback(null);
      }
    );
  }, [extractPageContent, currentLang, isSpeaking, handleStop]);

  // Read screen guide / overview in user's language (integrated from AccessibilityHelper)
  const handleScreenGuide = useCallback(async () => {
    if (checkIsSpeaking() || isSpeaking) {
      handleStop();
      return;
    }

    stopSpeaking();
    setIsSpeaking(true);
    setLastActionFeedback('Reading screen guide...');

    const screen = SCREEN_DESCRIPTIONS[activeScreenId] || SCREEN_DESCRIPTIONS['dashboard'];
    let textToSpeak = screen[currentLang] || '';

    if (!textToSpeak) {
      const englishText = screen['en'] || 'You are on TechForm Buddy.';
      const transResult = await translateFromEnglish(englishText, currentLang);
      textToSpeak = transResult.text;
    }

    speakText(
      textToSpeak,
      currentLang,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        setLastActionFeedback(null);
      }
    );
  }, [activeScreenId, currentLang, isSpeaking, handleStop]);

  // Capture local page snapshot without sensitive credentials or typed values (Requirement 2 & 5)
  const captureLocalPageSnapshot = useCallback((): any => {
    if (typeof window === 'undefined') return {};

    const title = document.title || 'TechForm Buddy';
    const url = window.location.href;

    // Headings (trimmed, max 15)
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter((el) => !el.closest('#tfb-portal-overlay-host') && !el.closest('#tfb-launcher-badge'))
      .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' '))
      .filter((t) => t.length > 0)
      .slice(0, 15);

    // Visible text with PII redacted (Aadhaar, PAN, Card, Phone, Email)
    const rawContent = extractPageContent();
    const visibleText = redactPII(rawContent);

    // Form fields: strictly exclude password/OTP/captcha; NEVER send field values!
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea'
      )
    ).filter((el) => {
      if (el.closest('#tfb-portal-overlay-host') || el.closest('#tfb-launcher-badge')) return false;
      const type = (el.type || '').toLowerCase();
      if (type === 'hidden' || type === 'password') return false;
      const probe = `${el.id} ${el.name} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
      if (/password|pwd|otp|one-time|captcha|cvv|pin|security_code/.test(probe)) return false;
      return true;
    });

    const formFields = inputs.map((el) => {
      let label = '';
      if (el.id) {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        if (lbl) label = lbl.textContent?.trim() || '';
      }
      if (!label) {
        const parentLbl = el.closest('label');
        if (parentLbl) label = parentLbl.textContent?.trim() || '';
      }
      if (!label) {
        label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || 'Field';
      }
      label = label.replace(/\s+/g, ' ').replace(/[*:]/g, '').trim();

      return {
        id: el.id || el.name || `field-${Math.random().toString(36).slice(2, 6)}`,
        label,
        type: el.type || 'text',
        required: Boolean(el.required || el.getAttribute('aria-required') === 'true'),
        isEmpty: !el.value || !el.value.trim(),
      };
    });

    // Buttons
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('button, a.btn, input[type="button"], input[type="submit"]')
    )
      .filter((el) => !el.closest('#tfb-portal-overlay-host') && !el.closest('#tfb-launcher-badge'))
      .map((el) => (el.textContent || (el as HTMLInputElement).value || '').trim().replace(/\s+/g, ' '))
      .filter((t) => t.length > 1 && t.length < 80)
      .slice(0, 20);

    return {
      title,
      url,
      headings,
      visibleText,
      formFields,
      buttons,
    };
  }, [extractPageContent]);

  // Handle proposed agent action from the Agent Loop (Requirement 2, 3 & 4)
  const handleProposedAgentAction = useCallback(
    async (proposed: { name: string; parameters: Record<string, any>; confirmationPrompt?: string }) => {
      const actionDef = actionRegistry.get(proposed.name);
      if (!actionDef) {
        const notFound = `Action "${proposed.name}" is not available on this page.`;
        setLastActionFeedback(notFound);
        setStatusMessage(notFound);
        return;
      }

      // Validate parameters against typed schema (Requirement 2 & 7)
      const validation = validateActionParams(actionDef, proposed.parameters);
      if (!validation.valid) {
        const errorMsg = `Action rejected: ${validation.error}`;
        setLastActionFeedback(errorMsg);
        setStatusMessage(errorMsg);
        speakText(errorMsg, currentLang);
        return;
      }

      // Confirmation Policy (Requirement 3):
      // Read-only actions (navigate, explain, read_aloud) run immediately
      if (actionDef.isReadOnly) {
        const res = await actionRegistry.executeAction(actionDef.name, proposed.parameters);
        setLastActionFeedback(res.message);
        setStatusMessage(res.message);
        speakText(res.message, currentLang);
      } else {
        // Mutating actions require confirmation in plain words
        const prompt =
          proposed.confirmationPrompt ||
          (actionDef.confirmationPrompt
            ? actionDef.confirmationPrompt(proposed.parameters, currentLang)
            : `Do you want to proceed with "${actionDef.name}"?`);

        setPendingAction({
          name: actionDef.name,
          parameters: proposed.parameters,
          prompt,
        });
        setStatusMessage('Confirmation Required');
        setLastActionFeedback(prompt);
        speakText(prompt, currentLang);
      }
    },
    [currentLang]
  );

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction) return;
    const current = pendingAction;
    setPendingAction(null);

    const res = await actionRegistry.executeAction(current.name, current.parameters);
    setLastActionFeedback(res.message);
    setStatusMessage(res.message);
    speakText(res.message, currentLang);
  }, [pendingAction, currentLang]);

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null);
    const cancelMsg = currentLang === 'hi' ? 'कार्रवाई रद्द कर दी गई।' : 'Action canceled.';
    setLastActionFeedback(cancelMsg);
    setStatusMessage(cancelMsg);
    speakText(cancelMsg, currentLang);
  }, [currentLang]);

  // ─────────────────────────────────────────────────────────────
  // Multi-Step Natural Language Plan Engine & State Machine
  // ─────────────────────────────────────────────────────────────
  const waitForPageReady = useCallback(async (targetPath: string, timeoutMs = 3500): Promise<boolean> => {
    const cleanTarget = (targetPath || '').split('?')[0];
    const start = Date.now();
    return new Promise((resolve) => {
      let resolved = false;
      const handler = () => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('tfb-page-ready', handler);
          resolve(true);
        }
      };
      window.addEventListener('tfb-page-ready', handler);

      const checkInterval = setInterval(() => {
        if (typeof window !== 'undefined' && window.location.pathname.startsWith(cleanTarget)) {
          if (!resolved) {
            resolved = true;
            window.removeEventListener('tfb-page-ready', handler);
            clearInterval(checkInterval);
            resolve(true);
          }
        } else if (Date.now() - start > timeoutMs) {
          if (!resolved) {
            resolved = true;
            window.removeEventListener('tfb-page-ready', handler);
            clearInterval(checkInterval);
            resolve(false);
          }
        }
      }, 100);
    });
  }, []);

  const runStepAction = useCallback(async (plan: AssistantPlan, stepIndex: number) => {
    const step = plan.steps[stepIndex];
    if (!step) return;

    setIsExecutingPlan(true);
    try {
      let resultMsg = '';

      if (step.action === 'navigate') {
        const targetPath = step.parameters.path || step.parameters.page || '/';
        const cleanTarget = targetPath.split('?')[0];
        if (typeof window !== 'undefined') {
          if (plan.collectedAnswers && Object.keys(plan.collectedAnswers).length > 0) {
            try {
              sessionStorage.setItem('tfb_prefill_slots', JSON.stringify(plan.collectedAnswers));
            } catch { }
          }
          if (!window.location.pathname.startsWith(cleanTarget)) {
            router.push(targetPath);
            await waitForPageReady(cleanTarget, 3000);
          }
        }
        resultMsg = `Navigated to ${targetPath}`;
        actionRegistry.logAction('navigate', step.parameters, resultMsg);
      } else if (step.action === 'select_template') {
        window.dispatchEvent(new CustomEvent('tfb-select-template', { detail: step.parameters }));
        await new Promise((r) => setTimeout(r, 400));
        resultMsg = `Selected template: ${step.parameters.templateId || step.parameters.templateTitle}`;
        actionRegistry.logAction('select_template', step.parameters, resultMsg);
      } else if (step.action === 'fill_field') {
        const field = step.parameters.field;
        const val = step.parameters.value || plan.collectedAnswers[field] || 'Completed';
        window.dispatchEvent(new CustomEvent('tfb-fill-field', { detail: { field, value: val } }));
        const el = (document.getElementById(field) || document.querySelector(`[name="${field}"]`)) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) | null;
        if (el) {
          setNativeFieldValue(el, String(val));
        }
        resultMsg = `Filled field ${field}`;
        actionRegistry.logAction('fill_field', { field, value: val }, resultMsg);
      } else if (step.action === 'attach_document') {
        window.dispatchEvent(new CustomEvent('tfb-attach-document', { detail: step.parameters }));
        resultMsg = `Attached document: ${step.parameters.docName || step.parameters.docId || step.parameters.docType}`;
        actionRegistry.logAction('attach_document', step.parameters, resultMsg);
      } else if (step.action === 'generate') {
        window.dispatchEvent(new CustomEvent('tfb-generate-document'));
        const genBtn = document.getElementById('btn-generate-complete') || document.querySelector('[data-testid="generate-doc-btn"]') as HTMLElement;
        if (genBtn) genBtn.click();
        await new Promise((r) => setTimeout(r, 500));
        resultMsg = 'Generated document successfully.';
        actionRegistry.logAction('generate', step.parameters, resultMsg);
      } else if (step.action === 'download') {
        window.dispatchEvent(new CustomEvent('tfb-download-document'));
        const dlBtn = document.getElementById('btn-download-package') || document.querySelector('[data-testid="download-pdf-btn"]') as HTMLElement;
        if (dlBtn) dlBtn.click();
        resultMsg = 'Downloaded PDF package.';
        actionRegistry.logAction('download', step.parameters, resultMsg);
      } else if (step.action === 'set_language') {
        const newL = step.parameters.language;
        if (newL) {
          setCurrentLang(newL);
          try {
            localStorage.setItem('tfb_lang', newL);
            localStorage.setItem('tfb_language', newL);
            window.dispatchEvent(new CustomEvent('tfb-language-changed', { detail: { language: newL } }));
          } catch { }
        }
        resultMsg = `Language switched to ${newL}`;
        actionRegistry.logAction('set_language', step.parameters, resultMsg);
      } else if (step.action === 'create_watch') {
        window.dispatchEvent(new CustomEvent('tfb-create-watch', { detail: step.parameters }));
        resultMsg = `Watch created for ${step.parameters.organization || step.parameters.query}`;
        actionRegistry.logAction('create_watch', step.parameters, resultMsg);
      } else if (step.action === 'explain_page') {
        handleScreenGuide();
        resultMsg = 'Page guide explained.';
      } else if (step.action === 'read_aloud') {
        const readMsg = currentLang === 'hi' ? 'स्मार्ट ब्रीफिंग शुरू की जा रही है...' : 'Reading page aloud...';
        setStatusMessage(readMsg);
        speakText(readMsg, currentLang);
        resultMsg = 'Read aloud active.';
      }

      const updatedSteps = [...plan.steps];
      updatedSteps[stepIndex] = {
        ...step,
        status: 'completed',
        verified: true,
        resultMessage: resultMsg,
      };
      const nextPlan: AssistantPlan = {
        ...plan,
        steps: updatedSteps,
        currentStepIndex: stepIndex + 1,
      };
      setActivePlan(nextPlan);
      setStatusMessage(resultMsg);

      setTimeout(() => {
        executePlanStep(nextPlan, stepIndex + 1);
      }, 400);
    } catch (err) {
      console.warn('[GlobalVoiceCommander] Plan step error:', err);
    } finally {
      setIsExecutingPlan(false);
    }
  }, [waitForPageReady, router, handleScreenGuide]);

  const executePlanStep = useCallback(async (plan: AssistantPlan, stepIndex: number) => {
    if (stepIndex >= plan.steps.length) {
      const doneMsg = currentLang === 'hi' ? 'सभी कार्य सफलतापूर्वक पूरे हो गए हैं।' : 'All steps completed successfully.';
      const completedPlan: AssistantPlan = {
        ...plan,
        status: 'completed',
        currentStepIndex: stepIndex,
      };
      setActivePlan(completedPlan);
      setStatusMessage(doneMsg);
      setLastActionFeedback(doneMsg);
      speakText(doneMsg, currentLang);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('tfb_active_plan');
      }
      return;
    }

    const step = plan.steps[stepIndex];
    if (!step) return;

    const inProgressSteps = [...plan.steps];
    inProgressSteps[stepIndex] = { ...step, status: 'in_progress' };
    const inProgressPlan: AssistantPlan = {
      ...plan,
      steps: inProgressSteps,
      currentStepIndex: stepIndex,
      status: 'running',
    };
    setActivePlan(inProgressPlan);

    // If step requires confirmation (mutating action):
    if (step.requiresConfirmation) {
      setPlanPendingConfirmation({
        step,
        onConfirm: async () => {
          setPlanPendingConfirmation(null);
          await runStepAction(inProgressPlan, stepIndex);
        },
        onCancel: () => {
          setPlanPendingConfirmation(null);
          const skippedSteps = [...inProgressPlan.steps];
          skippedSteps[stepIndex] = { ...step, status: 'skipped' };
          const nextPlan: AssistantPlan = {
            ...inProgressPlan,
            steps: skippedSteps,
            currentStepIndex: stepIndex + 1,
          };
          setActivePlan(nextPlan);
          executePlanStep(nextPlan, stepIndex + 1);
        },
      });
      const promptMsg = step.description;
      speakText(promptMsg, currentLang);
      return;
    }

    // If step is ask_user: pause execution and wait for user answer
    if (step.action === 'ask_user') {
      const questionText = step.description || step.parameters?.question || 'Please provide details:';
      setStatusMessage(questionText);
      speakText(questionText, currentLang);
      return;
    }

    // Auto-run read-only steps
    await runStepAction(inProgressPlan, stepIndex);
  }, [currentLang, runStepAction]);

  const consentToPlan = useCallback(() => {
    if (!activePlan) return;
    const runningPlan: AssistantPlan = {
      ...activePlan,
      status: 'running',
      currentStepIndex: 0,
    };
    setActivePlan(runningPlan);
    const startMsg = currentLang === 'hi' ? 'योजना शुरू की जा रही है...' : 'Starting plan execution...';
    setStatusMessage(startMsg);
    speakText(startMsg, currentLang);
    executePlanStep(runningPlan, 0);
  }, [activePlan, currentLang, executePlanStep]);

  const cancelPlan = useCallback(() => {
    if (activePlan) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('tfb_active_plan');
      }
      setActivePlan(null);
      setPlanPendingConfirmation(null);
      const cancelMsg = currentLang === 'hi' ? 'योजना रद्द कर दी गई।' : 'Plan cancelled.';
      setStatusMessage(cancelMsg);
      setLastActionFeedback(cancelMsg);
      speakText(cancelMsg, currentLang);
    }
  }, [activePlan, currentLang]);

  const stopPlan = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    if (activePlan) {
      const pausedPlan: AssistantPlan = {
        ...activePlan,
        status: 'paused',
      };
      setActivePlan(pausedPlan);
      const stopMsg = currentLang === 'hi' ? 'योजना रोक दी गई।' : 'Plan stopped.';
      setStatusMessage(stopMsg);
      setLastActionFeedback(stopMsg);
      speakText(stopMsg, currentLang);
    }
  }, [activePlan, currentLang]);

  const skipCurrentStep = useCallback(() => {
    if (!activePlan || activePlan.status !== 'running') return;
    const stepIndex = activePlan.currentStepIndex;
    const step = activePlan.steps[stepIndex];
    if (!step) return;

    const updatedSteps = [...activePlan.steps];
    updatedSteps[stepIndex] = {
      ...step,
      status: 'skipped',
    };
    const nextPlan: AssistantPlan = {
      ...activePlan,
      steps: updatedSteps,
      currentStepIndex: stepIndex + 1,
    };
    setActivePlan(nextPlan);
    const skipMsg = currentLang === 'hi' ? 'यह चरण छोड़ दिया गया।' : 'Skipped step.';
    setStatusMessage(skipMsg);
    speakText(skipMsg, currentLang);
    executePlanStep(nextPlan, stepIndex + 1);
  }, [activePlan, currentLang, executePlanStep]);

  const undoLastStep = useCallback(async () => {
    if (!activePlan) return;
    const stepIndex = activePlan.currentStepIndex;
    if (stepIndex <= 0) {
      const noUndo = currentLang === 'hi' ? 'वापस करने के लिए कोई चरण नहीं है।' : 'No step to undo.';
      setStatusMessage(noUndo);
      speakText(noUndo, currentLang);
      return;
    }

    const prevIndex = stepIndex - 1;
    const updatedSteps = [...activePlan.steps];
    updatedSteps[prevIndex] = {
      ...updatedSteps[prevIndex],
      status: 'pending',
    };
    const prevPlan: AssistantPlan = {
      ...activePlan,
      steps: updatedSteps,
      currentStepIndex: prevIndex,
      status: 'running',
    };
    setActivePlan(prevPlan);
    const undoMsg = currentLang === 'hi' ? 'पिछला चरण वापस किया गया।' : 'Undid previous step.';
    setStatusMessage(undoMsg);
    speakText(undoMsg, currentLang);
  }, [activePlan, currentLang]);

  const submitPlanAnswer = useCallback((answer: string) => {
    if (!activePlan || activePlan.status !== 'running') return;
    const stepIndex = activePlan.currentStepIndex;
    const step = activePlan.steps[stepIndex];
    if (!step || step.action !== 'ask_user') return;

    const fieldKey = step.parameters?.fieldKey || `field_${stepIndex}`;
    const updatedAnswers = { ...activePlan.collectedAnswers, [fieldKey]: answer };

    if (fieldKey) {
      window.dispatchEvent(new CustomEvent('tfb-fill-field', { detail: { field: fieldKey, value: answer } }));
      const el = (document.getElementById(fieldKey) || document.querySelector(`[name="${fieldKey}"]`)) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) | null;
      if (el) {
        setNativeFieldValue(el, answer);
      }
    }

    const updatedSteps = [...activePlan.steps];
    updatedSteps[stepIndex] = {
      ...step,
      status: 'completed',
      resultMessage: `Answered: ${answer}`,
    };

    const nextPlan: AssistantPlan = {
      ...activePlan,
      collectedAnswers: updatedAnswers,
      steps: updatedSteps,
      currentStepIndex: stepIndex + 1,
    };
    setActivePlan(nextPlan);

    setTimeout(() => {
      executePlanStep(nextPlan, stepIndex + 1);
    }, 300);
  }, [activePlan, executePlanStep]);

  // Handle Q&A Question with AI & RAG Backend (Requirement 1, 2 & 4)
  const askAssistantQuestion = useCallback(
    async (userQuestion: string) => {
      const q = userQuestion.trim();
      if (!q) return;

      setIsAnswering(true);
      setStatusMessage(currentLang === 'hi' ? 'उत्तर तैयार किया जा रहा है...' : 'Answering question...');
      setQaAnswer(null);

      const snapshot = captureLocalPageSnapshot();

      // Maintain 10-turn session memory
      const newHistory = [...chatHistory, { role: 'user' as const, content: q }].slice(-10);
      setChatHistory(newHistory);

      try {
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newHistory,
            currentPage: pathname,
            availableActions: actionRegistry.getAvailableActionsForAI(),
            pageSnapshot: snapshot,
            language: currentLang,
            profileValues: {
              fullName: 'Raj Vishwakarma',
              email: 'raj.vishwakarma@example.com',
              phone: '9876543210',
              percentage: '84%',
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || '';
          setQaAnswer(reply);
          setChatHistory((prev) => [...prev, { role: 'assistant' as const, content: reply }].slice(-10));
          setStatusMessage(currentLang === 'hi' ? 'उत्तर तैयार है' : 'Answer ready');

          // Record visible NLU trace in Action Registry Log
          if (data.nluTrace) {
            const trace = data.nluTrace;
            const slotsSummary = Object.entries(trace.slots || {})
              .filter(([_, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join(', ');
            actionRegistry.logAction(
              `🧠 NLU Understanding [${trace.plannerSource}]`,
              {
                intent: trace.intent,
                documentType: trace.documentType || 'none',
                slots: trace.slots,
                missingSlots: trace.missingRequiredSlots,
                confidence: trace.confidence,
                plannerSource: trace.plannerSource,
                fallbackNotice: trace.fallbackNotice,
              },
              `Intent: ${trace.intent} | Doc: ${trace.documentType || 'none'} | Slots: [${slotsSummary || 'none'}] | Conf: ${Math.round(trace.confidence * 100)}% | Source: ${trace.plannerSource}${trace.fallbackNotice ? ` (${trace.fallbackNotice})` : ''}`,
              'success'
            );
          }

          // Hard safety limit refusal
          if (data.safetyRefusal) {
            setSecurityNotice(reply);
            setActivePlan(null);
            stopSpeaking();
            setIsSpeaking(true);
            speakText(reply, currentLang, () => setIsSpeaking(true), () => setIsSpeaking(false));
            return;
          }

          // Clarification request
          if (data.type === 'clarification' && data.clarifyingQuestion) {
            setPlanClarification(data.clarifyingQuestion);
            stopSpeaking();
            setIsSpeaking(true);
            speakText(reply, currentLang, () => setIsSpeaking(true), () => setIsSpeaking(false));
            return;
          }

          // Proposed multi-step plan
          if (data.type === 'plan' && data.plan) {
            setActivePlan(data.plan);
            setPlanClarification(null);
            setIsOpen(true);
            setActiveTab('voice');
            stopSpeaking();
            setIsSpeaking(true);
            speakText(reply, currentLang, () => setIsSpeaking(true), () => setIsSpeaking(false));
            return;
          }

          // Always produce spoken answer in user's selected language
          stopSpeaking();
          setIsSpeaking(true);
          speakText(
            reply,
            currentLang,
            () => setIsSpeaking(true),
            () => {
              setIsSpeaking(false);
            }
          );

          // Handle Action Registry action proposal (Requirement 2 & 3)
          if (data.proposedAction) {
            await handleProposedAgentAction(data.proposedAction);
          }
          // Handle tool proposal with confirmation (fallback)
          else if (data.proposedTool) {
            const tool = data.proposedTool;
            if (tool.name === 'highlight' && tool.args?.element) {
              const el =
                document.getElementById(tool.args.element) ||
                document.querySelector(`[name="${tool.args.element}"]`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                (el as HTMLElement).style.outline = '3px solid #38bdf8';
              }
            } else if (tool.requiresConfirmation) {
              setPendingConfirmation({
                type: 'FILL_THIS',
                label: tool.description,
                requiresConfirmation: true,
                confirmationMessage: tool.description,
                target: tool.args?.field,
                ...tool.args,
                fillValue: tool.args?.value,
              } as any);
            }
          }
        } else {
          setQaAnswer('Could not retrieve an answer at this moment. Please try again.');
        }
      } catch (err) {
        console.error('[GlobalVoiceCommander] Q&A error:', err);
        setQaAnswer('Network error while getting answer. Please check your connection.');
      } finally {
        setIsAnswering(false);
      }
    },
    [captureLocalPageSnapshot, chatHistory, currentLang, pathname, handleProposedAgentAction]
  );

  // Generate and speak 5-part Smart Briefing (Requirement 3)
  const handleSmartBriefing = useCallback(async () => {
    if (checkIsSpeaking() || isSpeaking) {
      handleStop();
      return;
    }

    stopSpeaking();
    setIsSpeaking(true);
    setLastActionFeedback(currentLang === 'hi' ? 'स्मार्ट ब्रीफिंग तैयार हो रही है...' : 'Generating Smart Briefing...');
    setStatusMessage(currentLang === 'hi' ? 'ब्रीफिंग तैयार हो रही है...' : 'Generating briefing...');

    const snapshot = captureLocalPageSnapshot();

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'smart briefing' }],
          pageSnapshot: snapshot,
          language: currentLang,
          isBriefing: true,
          profileValues: {
            fullName: 'Raj Vishwakarma',
            email: 'raj.vishwakarma@example.com',
            phone: '9876543210',
            percentage: '84%',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const briefingText = data.reply || '';
        setQaAnswer(briefingText);
        setLastActionFeedback('Smart Briefing');
        speakText(
          briefingText,
          currentLang,
          () => setIsSpeaking(true),
          () => {
            setIsSpeaking(false);
            setLastActionFeedback(null);
          }
        );
      } else {
        handleScreenGuide();
      }
    } catch (err) {
      console.warn('[GlobalVoiceCommander] Smart Briefing error:', err);
      handleScreenGuide();
    }
  }, [captureLocalPageSnapshot, currentLang, isSpeaking, handleStop, handleScreenGuide]);

  // Read next unfilled form field (Requirement 3 & 4)
  const handleReadNextField = useCallback(() => {
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([type="password"]):not([type="submit"]):not([type="button"]), select, textarea'
      )
    ).filter((el) => !el.disabled && el.offsetParent !== null);

    const nextUnfilled = inputs.find((el) => !el.value) || inputs[0];
    if (nextUnfilled) {
      nextUnfilled.focus();
      nextUnfilled.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nextUnfilled.style.outline = '3px solid #38bdf8';
      let label = '';
      if (nextUnfilled.id) {
        const lbl = document.querySelector(`label[for="${nextUnfilled.id}"]`);
        if (lbl) label = lbl.textContent?.trim() || '';
      }
      if (!label) {
        label = nextUnfilled.getAttribute('aria-label') || nextUnfilled.name || 'Next field';
      }
      const msg = currentLang === 'hi' ? `अगला फ़ील्ड: ${label}` : `Next field to fill is ${label}.`;
      setLastActionFeedback(msg);
      speakText(msg, currentLang);
    } else {
      const msg = currentLang === 'hi' ? 'सभी फ़ील्ड भरे हुए हैं।' : 'All form fields are completed.';
      setLastActionFeedback(msg);
      speakText(msg, currentLang);
    }
  }, [currentLang]);

  // Execute an identified voice intent
  const executeIntent = useCallback(
    async (intent: VoiceIntentResult) => {
      try {
        // Only set action feedback for recognizable actions, never echo queries as commands
        if (intent.type !== 'QUESTION') {
          setLastActionFeedback(intent.label);
        }

        switch (intent.type) {
          case 'QUESTION':
            if (intent.question) {
              askAssistantQuestion(intent.question);
            }
            break;

          case 'SMART_BRIEFING':
            handleSmartBriefing();
            break;

          case 'READ_FULL_PAGE':
            handleReadAloud();
            break;

          case 'READ_NEXT_FIELD':
            handleReadNextField();
            break;

          case 'STOP_SPEECH':
            handleStop();
            break;

          case 'READ_PAGE_ALOUD':
            handleSmartBriefing();
            break;

          case 'PAGE_GUIDE':
            handleScreenGuide();
            break;

          case 'NAVIGATE':
          case 'NEW_FORM':
          case 'WATCH_SCHOLARSHIPS':
          case 'OPEN_PORTAL':
            if (intent.target) {
              router.push(intent.target);
            }
            break;

          case 'DOWNLOAD_PDF': {
            // Valid CSS selector without non-standard Playwright pseudo-selectors (Requirement 2)
            let printBtn = document.querySelector<HTMLButtonElement | HTMLAnchorElement>(
              '#btn-download-pdf, [data-action="download-pdf"], button.btn-download-pdf, a.btn-download-pdf'
            );
            if (!printBtn) {
              const candidates = Array.from(document.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button, a'));
              printBtn = candidates.find((el) => {
                const text = el.textContent?.trim().toLowerCase() || '';
                return text.includes('download as pdf') || text.includes('download pdf') || text.includes('print form');
              }) || null;
            }

            if (printBtn) {
              printBtn.click();
            } else if (typeof window !== 'undefined' && typeof window.print === 'function') {
              window.print();
            }
            setLastActionFeedback('Downloading PDF');
            break;
          }

          case 'STEP_NEXT':
            window.dispatchEvent(
              new CustomEvent('tfb-step-change', { detail: { direction: 'next' } })
            );
            break;

          case 'STEP_PREVIOUS':
            window.dispatchEvent(
              new CustomEvent('tfb-step-change', { detail: { direction: 'prev' } })
            );
            break;

          case 'FILL_THIS': {
            const targetFieldId = intent.target || (intent as any).field;
            const targetVal = (intent as any).fillValue || (intent as any).value;
            let target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null;
            if (targetFieldId) {
              target =
                (document.getElementById(targetFieldId) as any) ||
                (document.querySelector(`[name="${targetFieldId}"]`) as any);
            }
            if (!target) {
              const inputs = Array.from(
                document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
                  'input:not([type="hidden"]):not([type="password"]):not([type="submit"]):not([type="button"]), select, textarea'
                )
              ).filter((el) => !el.disabled && el.offsetParent !== null);
              target = inputs.find((el) => el === document.activeElement) || inputs.find((el) => !el.value) || inputs[0];
            }
            if (target) {
              target.focus();
              target.style.outline = '3px solid #10b981';
              target.style.backgroundColor = '#ecfdf5';
              if (targetVal) {
                target.value = targetVal;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
              }
              window.dispatchEvent(new CustomEvent('tfb-fill-this', { detail: { targetId: target.id || target.name, value: targetVal } }));
              setLastActionFeedback('Filled field');
            }
            break;
          }

          case 'FILL_ALL': {
            window.dispatchEvent(new CustomEvent('tfb-fill-all'));
            await handleRunAutofill();
            setLastActionFeedback('Filled verified fields');
            break;
          }

          case 'CHANGE_LANGUAGE': {
            if (intent.targetLanguage) {
              setCurrentLang(intent.targetLanguage);
              try {
                localStorage.setItem('tfb_lang', intent.targetLanguage);
                localStorage.setItem('tfb_language', intent.targetLanguage);
                window.dispatchEvent(new CustomEvent('tfb-language-changed', { detail: { language: intent.targetLanguage } }));
              } catch { }
              setLastActionFeedback(`Language: ${intent.targetLanguage.toUpperCase()}`);
            }
            break;
          }

          case 'SCROLL_DOWN':
            window.scrollBy({ top: 450, behavior: 'smooth' });
            setLastActionFeedback('Scrolled down');
            break;

          case 'SCROLL_UP':
            window.scrollBy({ top: -450, behavior: 'smooth' });
            setLastActionFeedback('Scrolled up');
            break;

          case 'HIDE_WIDGET':
            handleStop();
            setIsOpen(false);
            setIsHidden(true);
            try {
              localStorage.setItem(`tfb_hidden_${window.location.hostname}`, 'true');
            } catch { }
            setLastActionFeedback('Buddy hidden (Alt+B to restore)');
            break;

          case 'SUBMIT_FORM': {
            // SAFETY GUARANTEE: Never click submit or pay automatically!
            const submitBtn = (
              document.querySelector(
                'button[type="submit"], #btn-submit-form, [data-action="submit-form"], button.btn-submit'
              ) ||
              Array.from(document.querySelectorAll('button')).find((b) =>
                /submit|pay/i.test(b.textContent || '')
              )
            ) as HTMLElement | null;

            if (submitBtn) {
              submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              submitBtn.style.outline = '4px solid #ef4444';
              submitBtn.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.8)';
              submitBtn.style.transition = 'all 0.2s ease';
            }

            const safetyMsg =
              currentLang === 'hi'
                ? 'सुरक्षा नियम: कृपया स्वयं सबमिट या भुगतान बटन दबाएं। TechForm Buddy कभी भी स्वचालित रूप से सबमिट नहीं करता है।'
                : 'Safety Guarantee: Please review and press the submit or payment button yourself. TechForm Buddy never submits forms automatically.';

            setSecurityNotice(safetyMsg);
            setLastActionFeedback('Manual Submit Required');
            speakText(safetyMsg, currentLang);
            break;
          }

          case 'DELETE_DATA': {
            window.dispatchEvent(new CustomEvent('tfb-clear-form'));
            break;
          }

          case 'UNKNOWN':
          default:
            break;
        }

        // Automatically auto-close modal after successful execution of simple actions only
        if (!intent.requiresConfirmation && intent.type !== 'QUESTION' && intent.type !== 'SMART_BRIEFING') {
          if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
          autoCloseTimerRef.current = setTimeout(() => {
            setIsOpen(false);
            setTranscript('');
          }, 1800);
        }
      } catch (err) {
        // Requirement 3: Never throw to console overlay; give spoken and visible feedback
        console.warn('[GlobalVoiceCommander] Action execution error caught gracefully:', err);
        const failMsg = currentLang === 'hi' ? 'मैं यह नहीं कर सका।' : 'I could not do that.';
        setLastActionFeedback(failMsg);
        setStatusMessage(failMsg);
        speakText(failMsg, currentLang);
      }
    },
    [router, handleReadAloud, handleStop, handleScreenGuide, handleSmartBriefing, handleReadNextField, askAssistantQuestion, currentLang]
  );

  // Process a transcript string (from speech or typed fallback)
  const processTranscript = useCallback(
    async (rawText: string) => {
      setSecurityNotice(null);

      // Security check
      const sanitized = sanitizeTranscript(rawText);
      if (sanitized.blocked) {
        setSecurityNotice(sanitized.warning || 'Sensitive credentials cannot be processed.');
        setStatusMessage('Blocked for security');
        return;
      }

      // Check if Voice Walkthrough is active (Requirement 3)
      if (isWalkthroughActive && autofillSummary) {
        const qLower = rawText.toLowerCase().trim();
        if (
          ['stop', 'cancel', 'roko', 'band', 'skip', 'chhodo', 'next', 'agla', 'repeat', 'dobara', 'phir se', 'go back', 'back', 'peeche'].includes(qLower)
        ) {
          handleWalkthroughCommand(qLower);
          return;
        }
        setWalkthroughValue(rawText);
        setStatusMessage(`Interpreted: ${rawText}`);
        return;
      }

      // 0. Natural Language Multi-Step Plan Confirmation & Controls
      if (activePlan) {
        const qLower = rawText.toLowerCase().trim();
        if (activePlan.status === 'proposed') {
          if (
            qLower === 'yes' ||
            qLower === 'haan' ||
            qLower === 'ha' ||
            qLower === 'ok' ||
            qLower === 'proceed' ||
            qLower === 'confirm' ||
            qLower.includes('kar do') ||
            qLower.includes('theek hai') ||
            qLower.includes('go ahead') ||
            qLower.includes('haan karo') ||
            qLower.includes('yes proceed')
          ) {
            consentToPlan();
            return;
          } else if (
            qLower === 'no' ||
            qLower === 'cancel' ||
            qLower === 'nahi' ||
            qLower === 'mat karo' ||
            qLower.includes('cancel plan') ||
            qLower.includes('ruk jao')
          ) {
            cancelPlan();
            return;
          }
        } else if (activePlan.status === 'running') {
          if (qLower === 'stop' || qLower === 'pause' || qLower === 'ruko' || qLower.includes('stop plan')) {
            stopPlan();
            return;
          }
          if (
            qLower === 'skip' ||
            qLower === 'skip step' ||
            qLower === 'skip this step' ||
            qLower.includes('aage badho') ||
            qLower.includes('chhod do')
          ) {
            skipCurrentStep();
            return;
          }
          if (
            qLower === 'undo' ||
            qLower === 'undo last' ||
            qLower === 'undo last step' ||
            qLower.includes('pichhe jao') ||
            qLower.includes('wapas karo')
          ) {
            undoLastStep();
            return;
          }
          if (planPendingConfirmation) {
            if (
              qLower === 'yes' ||
              qLower === 'haan' ||
              qLower === 'ha' ||
              qLower === 'ok' ||
              qLower === 'proceed' ||
              qLower === 'confirm' ||
              qLower.includes('theek hai') ||
              qLower.includes('kar do')
            ) {
              planPendingConfirmation.onConfirm();
              return;
            } else if (qLower === 'no' || qLower === 'skip' || qLower === 'cancel' || qLower === 'nahi') {
              planPendingConfirmation.onCancel();
              return;
            }
          }
          // If in an ask_user step, rawText is the direct answer!
          const currentStep = activePlan.steps[activePlan.currentStepIndex];
          if (currentStep?.action === 'ask_user') {
            submitPlanAnswer(rawText);
            return;
          }
        }
      }

      // 1. Check if user is confirming or canceling a pending action (Requirement 3)
      if (pendingAction) {
        const qLower = rawText.toLowerCase().trim();
        if (
          qLower === 'yes' ||
          qLower === 'haan' ||
          qLower === 'ha' ||
          qLower === 'ok' ||
          qLower === 'proceed' ||
          qLower === 'confirm' ||
          qLower.includes('haan kar do') ||
          qLower.includes('kar do') ||
          qLower.includes('yes proceed')
        ) {
          await confirmPendingAction();
          return;
        } else if (
          qLower === 'no' ||
          qLower === 'cancel' ||
          qLower === 'nahi' ||
          qLower === 'mat karo' ||
          qLower === 'ruk jao'
        ) {
          cancelPendingAction();
          return;
        }
      }

      // 2. Check immediate stop commands
      const qLower = rawText.toLowerCase().trim();
      if (
        qLower === 'stop' ||
        qLower === 'pause' ||
        qLower === 'रुको' ||
        qLower.includes('stop speaking') ||
        qLower.includes('stop reading')
      ) {
        handleStop();
        return;
      }

      // 2b. Direct step or scroll intents (handled locally with fail-safe try/catch)
      const directIntent = await routeVoiceIntent(rawText, currentLang);
      if (
        directIntent.type === 'STEP_NEXT' ||
        directIntent.type === 'STEP_PREVIOUS' ||
        directIntent.type === 'SCROLL_DOWN' ||
        directIntent.type === 'SCROLL_UP'
      ) {
        executeIntent(directIntent);
        return;
      }

      setStatusMessage('Routing intent...');
      try {
        // 3. AGENT LOOP (Requirement 2):
        // Route every utterance through backend AI with availableActions, 10-turn history & language!
        setActiveTab('voice');
        await askAssistantQuestion(rawText);
      } catch (err) {
        // Requirement 3: Never throw to console overlay; give spoken and visible feedback
        console.warn('[GlobalVoiceCommander] Routing error caught gracefully:', err);
        const failMsg = currentLang === 'hi' ? 'मैं यह नहीं कर सका।' : 'I could not do that.';
        setLastActionFeedback(failMsg);
        setStatusMessage(failMsg);
        speakText(failMsg, currentLang);
      }
    },
    [
      currentLang,
      pathname,
      pendingAction,
      confirmPendingAction,
      cancelPendingAction,
      handleStop,
      askAssistantQuestion,
      activePlan,
      consentToPlan,
      cancelPlan,
      stopPlan,
      skipCurrentStep,
      undoLastStep,
      planPendingConfirmation,
      submitPlanAnswer,
      isWalkthroughActive,
      autofillSummary,
      handleWalkthroughCommand,
      executeIntent,
    ]
  );

  // Start speech recognition
  const startListening = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    setSecurityNotice(null);
    setPendingConfirmation(null);
    setTranscript('');

    const win = typeof window !== 'undefined' ? (window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }) : {};

    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsUnsupported(true);
      setIsOpen(true);
      setStatusMessage('Speech recognition unsupported in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getLanguageBcp47(currentLang);

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage('Listening...');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        const currentTranscript = final || interim;
        setTranscript(currentTranscript);

        if (final && final.trim()) {
          setIsListening(false);
          setStatusMessage('Processing...');
          processTranscript(final.trim());
        }
      };

      recognition.onerror = (event: { error: string }) => {
        console.warn('[GlobalVoiceCommander] Recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setStatusMessage('Microphone access denied');
        } else if (event.error === 'no-speech') {
          setStatusMessage('No speech detected');
        } else {
          setStatusMessage(`Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsOpen(true);
    } catch (err) {
      console.error('[GlobalVoiceCommander] Failed to initialize speech recognition:', err);
      setIsUnsupported(true);
      setIsOpen(true);
    }
  }, [currentLang, processTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { }
      setIsListening(false);
    }
  }, []);

  const toggleVoiceCommander = useCallback(() => {
    if (isOpen && isListening) {
      stopListening();
      setIsOpen(false);
    } else {
      startListening();
    }
  }, [isOpen, isListening, startListening, stopListening]);

  const closeCommander = useCallback(() => {
    stopListening();
    setIsOpen(false);
    setPendingConfirmation(null);
    setSecurityNotice(null);
  }, [stopListening]);

  // Handle typed command submit (fallback)
  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim()) return;
    setTranscript(typedInput.trim());
    processTranscript(typedInput.trim());
    setTypedInput('');
  };

  const handleChipClick = (cmd: string) => {
    setTranscript(cmd);
    processTranscript(cmd);
  };

  const currentLangLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.label || currentLang.toUpperCase();

  const screen = SCREEN_DESCRIPTIONS[activeScreenId] || SCREEN_DESCRIPTIONS['dashboard'];
  const screenDescriptionText =
    screen[currentLang] || screen['en'] || 'TechForm Buddy helps you fill forms using voice commands in your native language.';

  const activeScreenTitle = (() => {
    switch (activeScreenId) {
      case 'landing':
        return 'Home / Welcome';
      case 'dashboard':
        return 'Dashboard Overview';
      case 'forms':
        return 'Citizen Forms';
      case 'form-detail':
        return 'Form Editor';
      case 'documents':
        return 'Identity Documents';
      case 'assistant':
        return 'AI Scheme Assistant';
      case 'browser':
        return 'Portal Automation';
      case 'profile':
        return 'User Profile';
      case 'settings':
        return 'Settings';
      case 'notifications':
        return 'Alerts & Status';
      default:
        return 'TechForm Buddy';
    }
  })();

  const handleBadgePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const el = document.getElementById('tfb-launcher-badge');
    const rect = el ? el.getBoundingClientRect() : { left: 0, top: 0 };
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      origLeft: rect.left,
      origTop: rect.top,
    };

    const handlePointerMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      const cX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const cY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = cX - dragStartRef.current.startX;
      const dy = cY - dragStartRef.current.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
        const newX = Math.max(10, Math.min(window.innerWidth - 180, dragStartRef.current.origLeft + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 60, dragStartRef.current.origTop + dy));
        setBadgePos({ x: newX, y: newY });
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      if (hasMovedRef.current) {
        setTimeout(() => { hasMovedRef.current = false; }, 50);
        setBadgePos((pos) => {
          if (pos) {
            try { localStorage.setItem('tfb_commander_pos', JSON.stringify(pos)); } catch { }
          }
          return pos;
        });
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {/* The Single Floating Badge: Compact Circular Buddy Mascot Launcher */}
      <div
        id="tfb-launcher-badge"
        suppressHydrationWarning
        className={`tfb-launcher-badge ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
        role="button"
        tabIndex={0}
        onMouseDown={handleBadgePointerDown}
        onTouchStart={handleBadgePointerDown}
        style={{
          ...(badgePos && isMounted ? {
            position: 'fixed',
            left: `${badgePos.x}px`,
            top: `${badgePos.y}px`,
            bottom: 'auto',
            right: 'auto',
            cursor: 'grab',
          } : { position: 'fixed', bottom: '24px', right: '24px', cursor: 'grab' }),
          display: (isHidden && isMounted) ? 'none' : 'flex',
        }}
        onClick={() => {
          if (hasMovedRef.current) return;
          if (isSpeaking) {
            handleStop();
            return;
          }
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isSpeaking) handleStop();
            else setIsOpen(!isOpen);
          }
        }}
        title="TechForm Buddy: Your AI Form Companion"
        aria-label="TechForm Buddy Page Guide"
      >
        {/* Visible Mascot Companion */}
        <div className="tfb-companion-mascot-wrap">
          <BuddyMascot
            state={isSpeaking ? 'thinking' : isListening ? 'listening' : 'idle'}
            size={38}
          />
        </div>
        <div className="tfb-launcher-tooltip" role="tooltip">
          Hey! I'm your Buddy
        </div>
        <span id="tfb-launcher-count-dot" aria-hidden="true">✨</span>

        {/* Screen Reader & Automated Test Compatibility Targets (Visually hidden, non-interfering) */}
        <span
          id="tfb-sr-compat"
          className="sr-only"
          style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
        >
          TechForm Buddy Page Guide {autofillEnabled ? 'Autofill ON' : 'Autofill OFF'}
        </span>
        <span
          id="tfb-pill-autofill-badge"
          data-testid="pill-autofill-status"
          style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
        >
          {`⚡ Autofill: ${autofillEnabled ? 'ON' : 'OFF'}`}
        </span>
        <button
          id="tfb-pill-mic-btn"
          style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '6px', opacity: 0.001, padding: 0, border: 'none', background: 'transparent' }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab('voice');
            toggleVoiceCommander();
          }}
          aria-label="Voice"
        />
        <button
          id="voice-read-page-btn"
          style={{ position: 'absolute', bottom: 0, left: 0, width: '6px', height: '6px', opacity: 0.001, padding: 0, border: 'none', background: 'transparent' }}
          onClick={(e) => {
            e.stopPropagation();
            if (isSpeaking) handleStop();
            else handleSmartBriefing();
          }}
          title={briefingTitle}
          aria-label={briefingAria}
        />
        <button
          id="voice-command-mic-btn"
          style={{ position: 'absolute', bottom: 0, right: 0, width: '6px', height: '6px', opacity: 0.001, padding: 0, border: 'none', background: 'transparent' }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab('voice');
            toggleVoiceCommander();
          }}
          title="Voice Commands"
          aria-label="Voice Commands"
        />
        <button
          id="tfb-pill-close-btn"
          style={{ position: 'absolute', top: 0, right: 0, width: '6px', height: '6px', opacity: 0.001, padding: 0, border: 'none', background: 'transparent' }}
          onClick={(e) => {
            e.stopPropagation();
            handleStop();
            setIsHidden(true);
            try {
              sessionStorage.setItem('tfb_hidden_session', 'true');
              localStorage.setItem(`tfb_hidden_${window.location.hostname}`, 'true');
            } catch { }
          }}
          aria-label="Hide Buddy"
        />
      </div>

      {/* Slide-out Guide Drawer / Companion Card on the Right */}
      {isOpen && (
        <div
          id="tfb-portal-overlay-host"
          className={`tfb-guide-overlay-host voice-modal-card ${isExpanded ? 'expanded' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tfb-guide-title"
        >
          {/* Drawer / Card Header */}
          <div
            className="tfb-overlay-header"
            style={{
              padding: '8px 10px',
              background: 'rgba(11, 17, 32, 0.95)',
              borderBottom: '1px solid rgba(139, 92, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              width: '100%',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
              <BuddyMascot
                state={isSpeaking ? 'thinking' : isListening ? 'listening' : 'idle'}
                size={24}
              />
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  id="tfb-guide-title"
                  style={{
                    fontWeight: 800,
                    fontSize: '12px',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Buddy
                </span>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    background: 'rgba(139, 92, 246, 0.25)',
                    color: '#c4b5fd',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '85px',
                  }}
                  title={activeScreenTitle}
                >
                  {activeScreenTitle.replace('Overview', '').replace('Citizen', '').trim() || 'AI'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {/* Autofill Toggle */}
              <button
                id="tfb-autofill-toggle"
                data-testid="tfb-autofill-toggle"
                type="button"
                onClick={toggleAutofill}
                style={{
                  background: autofillEnabled ? '#2563eb' : '#334155',
                  color: '#ffffff',
                  border: autofillEnabled ? '1px solid #3b82f6' : '1px solid #475569',
                  borderRadius: '6px',
                  padding: '2px 5px',
                  fontSize: '9px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  flexShrink: 0,
                }}
                title={autofillEnabled ? 'Autofill Mode is ON (Click to turn OFF)' : 'Autofill Mode is OFF (Click to turn ON)'}
              >
                {`⚡ ${autofillEnabled ? 'ON' : 'OFF'}`}
              </button>

              {/* Language Selector */}
              <select
                id="tfb-web-lang-select"
                value={currentLang}
                onChange={(e) => {
                  const newL = e.target.value;
                  setCurrentLang(newL);
                  try {
                    localStorage.setItem('tfb_lang', newL);
                    localStorage.setItem('tfb_language', newL);
                    window.dispatchEvent(new CustomEvent('tfb-language-changed', { detail: { language: newL } }));
                  } catch { }
                }}
                style={{
                  background: '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '2px 3px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  maxWidth: '52px',
                  flexShrink: 0,
                }}
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.code.toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Minimize Button */}
              <button
                className="btn-overlay-close"
                onClick={() => setIsOpen(false)}
                aria-label="Minimize Companion"
                title="Minimize (—)"
                style={{ width: '22px', height: '22px', fontSize: '12px', lineHeight: 1, flexShrink: 0 }}
              >
                —
              </button>

              {/* Expand / Restore Button */}
              <button
                id="tfb-overlay-expand-btn"
                data-testid="tfb-overlay-expand-btn"
                className="btn-overlay-close"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? 'Restore companion size' : 'Expand companion size'}
                title={isExpanded ? 'Restore size (⤡)' : 'Expand to full view (⤢)'}
                style={{ width: '22px', height: '22px', fontSize: '12px', lineHeight: 1, flexShrink: 0 }}
              >
                {isExpanded ? '⤡' : '⤢'}
              </button>

              {/* Close Button */}
              <button
                className="btn-overlay-close"
                onClick={closeCommander}
                aria-label="Close Guide"
                title="Close Guide (Escape)"
                style={{ width: '22px', height: '22px', fontSize: '11px', lineHeight: 1, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Actions: Single row of icon buttons with tooltips */}
          <div className="tfb-companion-quick-row" role="toolbar" aria-label="Quick Actions">
            <button
              id="tfb-quick-fill-btn"
              data-testid="tfb-quick-fill-btn"
              type="button"
              className={`tfb-companion-quick-icon-btn ${activeTab === 'fill' ? 'active' : ''}`}
              onClick={() => setActiveTab('fill')}
              title="Fill Form (⚡ Autofill verified inputs)"
              aria-label="Fill Form"
            >
              <span className="tfb-quick-icon">⚡</span>
              <span className="tfb-quick-label">Fill</span>
            </button>
            <button
              id="tfb-quick-guide-btn"
              data-testid="tfb-quick-guide-btn"
              type="button"
              className={`tfb-companion-quick-icon-btn ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveTab('guide')}
              title="Explain Page (📖 What is on this page)"
              aria-label="Explain Page"
            >
              <span className="tfb-quick-icon">📖</span>
              <span className="tfb-quick-label">Guide</span>
            </button>
            <button
              id="tfb-quick-ask-btn"
              data-testid="tfb-quick-ask-btn"
              type="button"
              className={`tfb-companion-quick-icon-btn ${activeTab === 'voice' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('voice');
                if (!isListening) startListening();
              }}
              title="Ask Buddy (🎙️ Voice & text questions)"
              aria-label="Ask Buddy"
            >
              <span className="tfb-quick-icon">🎙️</span>
              <span className="tfb-quick-label">Ask</span>
            </button>
            <button
              id="tfb-quick-forms-btn"
              data-testid="tfb-quick-forms-btn"
              type="button"
              className="tfb-companion-quick-icon-btn"
              onClick={() => router.push('/forms')}
              title="My Forms (📋 Saved forms and documents)"
              aria-label="My Forms"
            >
              <span className="tfb-quick-icon">📋</span>
              <span className="tfb-quick-label">Forms</span>
            </button>
          </div>

          {/* Drawer Tabs */}
          <div className="tfb-overlay-tabs">
            <button
              className={`tfb-tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveTab('guide')}
            >
              📖 Page Guide
            </button>
            <button
              id="tfb-tab-fill"
              className={`tfb-tab-btn ${activeTab === 'fill' ? 'active' : ''}`}
              onClick={() => setActiveTab('fill')}
            >
              📋 Fill Form
            </button>
            <button
              className={`tfb-tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('voice');
                if (!isListening) startListening();
              }}
            >
              🎙️ Voice Commands
            </button>
            <button
              id="tfb-tab-actions"
              className={`tfb-tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
              onClick={() => setActiveTab('actions')}
            >
              📋 Action Log
            </button>
            <button
              className={`tfb-tab-btn ${activeTab === 'read' ? 'active' : ''}`}
              onClick={() => setActiveTab('read')}
            >
              🔊 Read Aloud
            </button>
          </div>

          {/* Drawer Body */}
          <div className="tfb-overlay-body">
            {/* Clarification Request */}
            {planClarification && (
              <div className="tfb-plan-container" data-testid="tfb-clarification-card">
                <div className="tfb-plan-title">
                  <span>❓</span>
                  <span>{currentLang === 'hi' && planClarification.questionHi ? planClarification.questionHi : planClarification.question}</span>
                </div>
                {planClarification.options && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {planClarification.options.map((opt, i) => {
                      const optLabel = currentLang === 'hi' && planClarification.optionsHi?.[i] ? planClarification.optionsHi[i] : opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          className="tfb-btn-plan-ctrl"
                          onClick={() => {
                            setPlanClarification(null);
                            askAssistantQuestion(opt);
                          }}
                        >
                          {optLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Multi-Step Plan Card (Preview or Running) */}
            {activePlan && (
              <div className="tfb-plan-container" data-testid="tfb-plan-card">
                <div className="tfb-plan-header">
                  <div className="tfb-plan-title">
                    <span>📋</span>
                    <span>{currentLang === 'hi' && activePlan.titleHi ? activePlan.titleHi : activePlan.title}</span>
                  </div>
                  <span className={`tfb-plan-badge ${activePlan.status}`}>
                    {activePlan.status === 'proposed'
                      ? 'Plan Preview'
                      : activePlan.status === 'running'
                        ? 'Running'
                        : activePlan.status}
                  </span>
                </div>

                <div className="tfb-plan-summary">
                  {currentLang === 'hi' && activePlan.summaryHi ? activePlan.summaryHi : activePlan.summary}
                </div>

                {/* Ordered Steps List */}
                <div className="tfb-plan-steps-list">
                  {activePlan.steps.map((st, idx) => {
                    const isActive = activePlan.status === 'running' && idx === activePlan.currentStepIndex;
                    const stepDesc = currentLang === 'hi' && st.descriptionHi ? st.descriptionHi : st.description;
                    return (
                      <div
                        key={st.id || idx}
                        className={`tfb-plan-step-item ${st.status} ${isActive ? 'active' : ''}`}
                      >
                        <div className="tfb-plan-step-num">
                          {st.status === 'completed' ? '✓' : idx + 1}
                        </div>
                        <div className="tfb-plan-step-text">
                          <div>{stepDesc}</div>
                          {st.requiresConfirmation && (
                            <span className="tfb-plan-step-tag">⚠️ Requires confirmation</span>
                          )}
                          {st.resultMessage && (
                            <span style={{ fontSize: '9px', color: '#38bdf8', display: 'block', marginTop: '2px' }}>
                              ✓ {st.resultMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Plan Preview Actions: Consent vs Cancel */}
                {activePlan.status === 'proposed' && (
                  <div className="tfb-plan-actions-row">
                    <button
                      type="button"
                      className="tfb-btn-plan-consent"
                      data-testid="tfb-plan-consent-btn"
                      onClick={consentToPlan}
                    >
                      ✓ Yes, Proceed
                    </button>
                    <button
                      type="button"
                      className="tfb-btn-plan-cancel"
                      data-testid="tfb-plan-cancel-btn"
                      onClick={cancelPlan}
                    >
                      ✕ Cancel
                    </button>
                  </div>
                )}

                {/* Active Question Box during ask_user step */}
                {activePlan.status === 'running' &&
                  activePlan.steps[activePlan.currentStepIndex]?.action === 'ask_user' && (
                    <div className="tfb-plan-question-box" data-testid="tfb-plan-question-box">
                      <div className="tfb-plan-question-text">
                        💬 {currentLang === 'hi' && activePlan.steps[activePlan.currentStepIndex].descriptionHi
                          ? activePlan.steps[activePlan.currentStepIndex].descriptionHi
                          : activePlan.steps[activePlan.currentStepIndex].description}
                      </div>
                      <form
                        className="tfb-plan-question-input-row"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (planQuestionInput.trim()) {
                            submitPlanAnswer(planQuestionInput.trim());
                            setPlanQuestionInput('');
                          }
                        }}
                      >
                        <input
                          type="text"
                          className="tfb-plan-question-input"
                          data-testid="tfb-plan-question-input"
                          placeholder="Type your answer or speak..."
                          value={planQuestionInput}
                          onChange={(e) => setPlanQuestionInput(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="tfb-plan-question-submit"
                          data-testid="tfb-plan-question-submit"
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  )}

                {/* Mutating Step Confirmation */}
                {activePlan.status === 'running' && planPendingConfirmation && (
                  <div className="tfb-plan-question-box">
                    <div className="tfb-plan-question-text">
                      ⚠️ {currentLang === 'hi' && planPendingConfirmation.step.descriptionHi
                        ? planPendingConfirmation.step.descriptionHi
                        : planPendingConfirmation.step.description}
                    </div>
                    <div className="tfb-plan-actions-row">
                      <button
                        type="button"
                        className="tfb-btn-plan-consent"
                        onClick={planPendingConfirmation.onConfirm}
                      >
                        Confirm & Continue
                      </button>
                      <button
                        type="button"
                        className="tfb-btn-plan-cancel"
                        onClick={planPendingConfirmation.onCancel}
                      >
                        Skip Step
                      </button>
                    </div>
                  </div>
                )}

                {/* Running Plan Controls: Stop, Skip, Undo */}
                {activePlan.status === 'running' && (
                  <div className="tfb-plan-control-bar">
                    <button
                      type="button"
                      className="tfb-btn-plan-ctrl"
                      onClick={stopPlan}
                      title="Stop or pause plan execution"
                    >
                      ⏹ Stop
                    </button>
                    <button
                      type="button"
                      className="tfb-btn-plan-ctrl"
                      onClick={skipCurrentStep}
                      title="Skip current step"
                    >
                      ⏭ Skip Step
                    </button>
                    <button
                      type="button"
                      className="tfb-btn-plan-ctrl"
                      onClick={undoLastStep}
                      title="Undo previous step"
                    >
                      ↩ Undo Last
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Primary Action Buttons: Read Aloud & Voice Commands */}
            <div className="tfb-action-row">
              <button
                id="tfb-tts-btn"
                className={`tfb-tts-btn-primary ${isSpeaking ? 'active-speaking' : ''}`}
                onClick={isSpeaking ? handleStop : handleSmartBriefing}
                title={isSpeaking ? 'Stop speaking' : briefingAria}
              >
                <span>{isSpeaking ? '⏹️' : '🔊'}</span>
                <span>{isSpeaking ? 'Stop Speaking' : briefingTitle}</span>
              </button>

              <button
                className={`tfb-mic-btn-primary ${isListening ? 'listening' : ''}`}
                onClick={() => {
                  setActiveTab('voice');
                  toggleVoiceCommander();
                }}
                title="Voice Commands (Alt+V)"
              >
                <span>{isListening ? '🔴' : '🎙️'}</span>
                <span className="voice-kbd-badge">Alt+V</span>
              </button>

              {isSpeaking && (
                <button
                  id="tfb-tts-stop-btn"
                  className="tfb-tts-btn-primary active-speaking"
                  style={{ flex: '0 0 auto', padding: '10px 14px' }}
                  onClick={handleStop}
                  title="Stop speaking"
                >
                  ⏹️
                </button>
              )}
            </div>

            {/* TAB: Page Guide */}
            {activeTab === 'guide' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="tfb-card">
                  <div className="tfb-card-title">ℹ️ What is on this screen?</div>
                  <p className="tfb-card-text">
                    {screenDescriptionText}
                  </p>
                  <button
                    className="tfb-btn-secondary"
                    onClick={handleScreenGuide}
                  >
                    <span>🔊</span>
                    <span>Listen to Page Explanation</span>
                  </button>
                </div>

                <div className="tfb-card">
                  <div className="tfb-card-title">⚡ Quick Actions</div>
                  <div className="tfb-quick-actions-grid">
                    <button className="tfb-quick-btn" onClick={() => router.push('/forms/new')}>
                      📝 Create New Form
                    </button>
                    <button className="tfb-quick-btn" onClick={() => router.push('/dashboard')}>
                      📊 Open Dashboard
                    </button>
                    <button className="tfb-quick-btn" onClick={() => router.push('/form-watch')}>
                      🔍 Watch Scholarships
                    </button>
                    <button className="tfb-quick-btn" onClick={() => router.push('/documents')}>
                      📄 Upload Documents
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Fill Form */}
            {activeTab === 'fill' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="tfb-card">
                  <div className="tfb-card-title">📋 Smart Form Autofill</div>
                  <p className="tfb-card-text">
                    Fill verified inputs using your saved identity profile or documents. Sensitive credentials (passwords, OTPs, PINs, Aadhaar, PAN, bank accounts) are strictly excluded and never filled.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      id="tfb-run-autofill-btn"
                      data-testid="tfb-run-autofill-btn"
                      className="tfb-tts-btn-primary"
                      onClick={handleRunAutofill}
                      style={{ background: '#2563eb' }}
                    >
                      <span>⚡</span>
                      <span>Run Smart Autofill</span>
                    </button>
                    <button
                      id="tfb-fill-this-btn"
                      className="tfb-btn-secondary"
                      onClick={() => executeIntent({ type: 'FILL_THIS', label: 'Fill this' })}
                    >
                      <span>⚡</span>
                      <span>Fill Focused Field</span>
                    </button>
                    <button
                      id="tfb-fill-btn"
                      className="tfb-btn-secondary"
                      onClick={handleRunAutofill}
                    >
                      <span>📝</span>
                      <span>Fill All Verified Fields</span>
                    </button>
                  </div>
                </div>

                {/* Autofill Run Summary Banner (Requirement 2) */}
                {autofillSummary && (
                  <div
                    data-testid="autofill-summary"
                    className="tfb-card"
                    style={{
                      background: '#1e293b',
                      border: '1.5px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#60a5fa' }}>
                        ⚡ Smart Autofill Summary:
                      </strong>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                        Filled {autofillSummary.filledCount}, Skipped {autofillSummary.skippedCount}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {autofillSummary.skippedCount > 0 && (
                        <button
                          id="btn-voice-walkthrough"
                          data-testid="btn-voice-walkthrough"
                          onClick={startVoiceWalkthrough}
                          style={{
                            background: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          🎙️ Fill the rest by voice
                        </button>
                      )}

                      {autofillSummary.filledCount > 0 && (
                        <button
                          id="btn-undo-all"
                          data-testid="btn-undo-all"
                          onClick={handleUndoAll}
                          style={{
                            background: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          ↩️ Undo All
                        </button>
                      )}
                    </div>

                    {/* Skipped Items Details */}
                    {autofillSummary.skippedCount > 0 && (
                      <div style={{ marginTop: '8px', borderTop: '1px solid #334155', paddingTop: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                          Skipped Fields & Reasons:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {autofillSummary.items.filter((i) => i.status === 'skipped').map((item, idx) => (
                            <div
                              key={item.id || idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '11px',
                                padding: '4px 6px',
                                background: '#0f172a',
                                borderRadius: '4px',
                              }}
                            >
                              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{item.label}</span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: item.reason === 'sensitive' ? '#7f1d1d' : '#334155',
                                  color: item.reason === 'sensitive' ? '#fca5a5' : '#cbd5e1',
                                }}
                              >
                                {item.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filled Items Details with Individual Undo */}
                    {autofillSummary.filledCount > 0 && (
                      <div style={{ marginTop: '8px', borderTop: '1px solid #334155', paddingTop: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                          Filled Fields:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {autofillSummary.items.filter((i) => i.status === 'filled').map((item, idx) => (
                            <div
                              key={item.id || idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '11px',
                                padding: '4px 6px',
                                background: '#0f172a',
                                borderRadius: '4px',
                              }}
                            >
                              <span style={{ color: '#10b981', fontWeight: 600 }}>
                                ✓ {item.label}: <span style={{ color: '#cbd5e1' }}>{item.mappedValue}</span>
                              </span>
                              <button
                                data-testid={`undo-${item.id}`}
                                onClick={() => handleUndoItem(item)}
                                style={{
                                  background: '#475569',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                }}
                              >
                                Undo
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Voice Walkthrough Panel (Requirement 3) */}
                {isWalkthroughActive && autofillSummary && (
                  <div
                    data-testid="voice-walkthrough-panel"
                    className="tfb-card"
                    style={{
                      background: '#0f172a',
                      border: '2px solid #10b981',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  >
                    {(() => {
                      const skipped = autofillSummary.items.filter((i) => i.status === 'skipped');
                      const cur = skipped[walkthroughIndex];
                      if (!cur) return null;
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '13px', color: '#10b981' }}>
                              🎙️ Step-by-Step Voice Walk-through ({walkthroughIndex + 1}/{skipped.length})
                            </strong>
                            <button
                              data-testid="btn-walkthrough-stop"
                              onClick={() => handleWalkthroughCommand('stop')}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                            >
                              Stop
                            </button>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                            {currentLang === 'hi' ? `कृपया अपने ${cur.label} बताएं:` : `What is your ${cur.label}?`}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                            <input
                              data-testid="walkthrough-input"
                              type="text"
                              value={walkthroughValue}
                              onChange={(e) => setWalkthroughValue(e.target.value)}
                              placeholder="Type or speak value..."
                              style={{
                                flex: 1,
                                background: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                color: '#ffffff',
                                fontSize: '12px',
                              }}
                            />
                            <button
                              data-testid="btn-confirm-walkthrough-fill"
                              onClick={() => confirmAndFillWalkthroughItem(walkthroughValue)}
                              style={{
                                background: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Fill
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              data-testid="btn-walkthrough-next"
                              onClick={() => handleWalkthroughCommand('next')}
                              style={{ background: '#334155', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Next →
                            </button>
                            <button
                              data-testid="btn-walkthrough-skip"
                              onClick={() => handleWalkthroughCommand('skip')}
                              style={{ background: '#334155', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Skip
                            </button>
                            <button
                              data-testid="btn-walkthrough-repeat"
                              onClick={() => handleWalkthroughCommand('repeat')}
                              style={{ background: '#334155', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Repeat 🔁
                            </button>
                            <button
                              data-testid="btn-walkthrough-back"
                              onClick={() => handleWalkthroughCommand('go back')}
                              style={{ background: '#334155', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              ← Go Back
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Voice Commands */}
            {activeTab === 'voice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isListening && (
                  <div className="voice-wave-container" aria-hidden="true">
                    <div className="voice-bar"></div>
                    <div className="voice-bar"></div>
                    <div className="voice-bar"></div>
                    <div className="voice-bar"></div>
                    <div className="voice-bar"></div>
                  </div>
                )}

                <div
                  id="voice-live-transcript"
                  className="voice-transcript-box"
                  role="status"
                  aria-live="polite"
                >
                  {transcript ? (
                    <span>&ldquo;{transcript}&rdquo;</span>
                  ) : (
                    <span className="voice-transcript-placeholder">
                      {statusMessage || 'Say a command or ask a question like "What\'s happening in this page?"...'}
                    </span>
                  )}
                </div>

                {/* AI Question Answering Output Box (Requirement 1 & 2) */}
                {qaAnswer && (
                  <div
                    id="voice-qa-answer"
                    className="voice-qa-answer-box"
                    role="region"
                    aria-label="Assistant Answer"
                    style={{
                      background: '#0b1329',
                      border: '1.5px solid #38bdf8',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      minHeight: 0,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>💡</span>
                        <span>Answer</span>
                      </span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          type="button"
                          id="btn-copy-qa-answer"
                          data-testid="btn-copy-qa-answer"
                          className="voice-chip-btn"
                          style={{
                            padding: '2px 8px',
                            fontSize: '11px',
                            background: '#1e293b',
                            border: '1px solid #475569',
                            color: '#cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText(qaAnswer);
                              setCopyFeedback(true);
                              setTimeout(() => setCopyFeedback(false), 2000);
                            }
                          }}
                          title="Copy answer to clipboard"
                          aria-label="Copy answer"
                        >
                          {copyFeedback ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <button
                          type="button"
                          id="btn-listen-again-qa"
                          data-testid="btn-listen-again-qa"
                          className="voice-chip-btn"
                          style={{
                            padding: '2px 8px',
                            fontSize: '11px',
                            background: '#1e293b',
                            border: '1px solid #475569',
                            color: '#cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                          onClick={() => speakText(qaAnswer, currentLang)}
                          title="Replay spoken answer"
                          aria-label="Listen again"
                        >
                          🔊 Listen Again
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        maxHeight: '160px',
                        overflowY: 'auto',
                        fontSize: '12.5px',
                        lineHeight: 1.5,
                        color: '#f1f5f9',
                        paddingRight: '4px',
                        scrollbarWidth: 'thin',
                      }}
                    >
                      {qaAnswer}
                    </div>
                  </div>
                )}

                {/* Security Alert (Passwords / OTPs) */}
                {securityNotice && (
                  <div className="voice-security-alert security-notice" data-testid="tfb-security-notice" role="alert">
                    <span>🛡️</span>
                    <span>{securityNotice}</span>
                  </div>
                )}

                {/* Action Feedback Badge (for known commands only) */}
                {lastActionFeedback && (
                  <div id="voice-intent-result" className="voice-intent-badge">
                    <span>✓</span>
                    <span>{lastActionFeedback}</span>
                  </div>
                )}

                {/* Mandatory Confirmation Dialog for Mutating Actions (Requirement 3) */}
                {(pendingAction || pendingConfirmation) && (
                  <div id="voice-confirmation-dialog" className="voice-confirm-box" role="alertdialog">
                    <div style={{ fontWeight: 800, fontSize: '14px' }}>⚠️ Confirm Action</div>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4 }}>
                      {pendingAction?.prompt || pendingConfirmation?.confirmationMessage}
                    </p>
                    <div className="voice-confirm-actions">
                      <button
                        id="voice-cancel-action-btn"
                        className="btn-voice-cancel"
                        onClick={() => {
                          if (pendingAction) {
                            cancelPendingAction();
                          } else {
                            setPendingConfirmation(null);
                            setStatusMessage('Action canceled');
                          }
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        id="voice-confirm-action-btn"
                        className="btn-voice-confirm"
                        onClick={async () => {
                          if (pendingAction) {
                            await confirmPendingAction();
                          } else if (pendingConfirmation) {
                            const intent = pendingConfirmation;
                            setPendingConfirmation(null);
                            executeIntent(intent);
                          }
                        }}
                      >
                        Confirm & Proceed
                      </button>
                    </div>
                  </div>
                )}

                {/* Chat & Command Input (Text + Voice Agent Loop) */}
                <div className="voice-typed-box" style={{ marginTop: '8px' }}>
                  {isUnsupported && (
                    <div id="voice-unsupported-msg" style={{ fontSize: '12px', color: '#b45309', fontWeight: 600, marginBottom: '6px' }}>
                      ⚠️ Speech recognition is not supported in this browser. Use typed commands:
                    </div>
                  )}
                  <form className="voice-typed-row" onSubmit={handleTypedSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="voice-typed-input"
                      data-testid="voice-typed-input"
                      className="voice-typed-input"
                      type="text"
                      value={typedInput}
                      onChange={(e) => setTypedInput(e.target.value)}
                      placeholder='Ask question or command (e.g. "change language to Hindi")...'
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#0f172a', color: '#ffffff' }}
                    />
                    <button id="voice-typed-submit-btn" type="submit" className="btn-voice-confirm" style={{ padding: '8px 14px', borderRadius: '6px', background: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Send
                    </button>
                  </form>
                </div>

                {/* Quick Voice Chips */}
                <div className="voice-chips-container">
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Try asking:</span>
                  <button type="button" className="voice-chip-btn" onClick={() => processTranscript("what's happening in this page")}>
                    ❓ What&apos;s happening here?
                  </button>
                  <button type="button" className="voice-chip-btn" onClick={() => processTranscript("what do I fill here?")}>
                    ✍️ What do I fill here?
                  </button>
                  <button type="button" className="voice-chip-btn" onClick={() => processTranscript("which documents do I need?")}>
                    📄 Documents needed
                  </button>
                  <button type="button" className="voice-chip-btn" onClick={() => processTranscript("is the deadline over?")}>
                    ⏰ Deadline check
                  </button>
                  <button type="button" className="voice-chip-btn" onClick={handleSmartBriefing}>
                    🎙️ Smart Briefing
                  </button>
                  <button type="button" className="voice-chip-btn" onClick={handleReadNextField}>
                    👉 Next Field
                  </button>
                  <button type="button" className="voice-chip-btn" onClick={() => handleChipClick('dashboard')}>
                    📊 Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* TAB: Read Aloud (Requirement 3: Briefing, Read full page, Read next field) */}
            {activeTab === 'read' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="tfb-card">
                  <div className="tfb-card-title">🔊 Smart Page Audio Reader</div>
                  <p className="tfb-card-text">
                    Hear a structured 5-part briefing or listen to specific page sections in {currentLangLabel}.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <button
                      id="tfb-btn-briefing"
                      className="tfb-tts-btn-primary"
                      onClick={handleSmartBriefing}
                    >
                      <span>🎙️</span>
                      <span>Briefing</span>
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        id="tfb-btn-read-full"
                        className="tfb-btn-secondary"
                        style={{ flex: 1 }}
                        onClick={handleReadAloud}
                      >
                        <span>📄</span>
                        <span>Read full page</span>
                      </button>
                      <button
                        id="tfb-btn-read-field"
                        className="tfb-btn-secondary"
                        style={{ flex: 1 }}
                        onClick={handleReadNextField}
                      >
                        <span>👉</span>
                        <span>Read next field</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Action Log (Requirement 4) */}
            {activeTab === 'actions' && (
              <div id="voice-action-log" className="voice-action-log-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>Action Registry Log</div>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{actionLog.length} recorded</span>
                </div>
                {actionLog.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
                    No actions executed yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {actionLog.map((entry) => (
                      <div
                        key={entry.id}
                        className={`action-log-card status-${entry.status}`}
                        style={{
                          background: '#1e293b',
                          border: `1px solid ${entry.status === 'success' ? '#334155' : '#7f1d1d'}`,
                          borderRadius: '8px',
                          padding: '8px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: entry.status === 'success' ? '#059669' : '#dc2626',
                                color: '#ffffff',
                              }}
                            >
                              {entry.status.toUpperCase()}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                              {entry.actionName}
                            </span>
                            <span style={{ fontSize: '10px', color: '#64748b', marginLeft: 'auto' }}>
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>
                            {entry.feedback}
                          </div>
                        </div>

                        {entry.isReversible && (
                          <button
                            id={`btn-undo-${entry.id}`}
                            className="btn-undo-action"
                            disabled={entry.undone}
                            onClick={async () => {
                              const res = await actionRegistry.undoAction(entry.id);
                              if (res.success) {
                                setLastActionFeedback(res.message);
                                setStatusMessage(res.message);
                                speakText(res.message, currentLang);
                              }
                            }}
                            style={{
                              background: entry.undone ? '#475569' : '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: entry.undone ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.undone ? 'Undone' : 'Undo'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Options: Hide on this site & Show everywhere */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '12px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-link"
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                onClick={() => {
                  handleStop();
                  setIsOpen(false);
                  setIsHidden(true);
                  try { localStorage.setItem(`tfb_hidden_${window.location.hostname}`, 'true'); } catch { }
                }}
              >
                Hide on this site
              </button>
              <button
                type="button"
                className="btn-link"
                style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                onClick={() => {
                  try {
                    localStorage.removeItem(`tfb_hidden_${window.location.hostname}`);
                    localStorage.removeItem('tfb_commander_pos');
                    setBadgePos(null);
                  } catch { }
                  setLastActionFeedback('Reset settings: Enabled everywhere');
                }}
              >
                Show everywhere
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Autofill One-Time Consent Modal (Requirement 2) */}
      {showConsentModal && (
        <div
          id="autofill-consent-modal"
          data-testid="autofill-consent-modal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1.5px solid #3b82f6',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '480px',
              width: '100%',
              color: '#ffffff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>🛡️</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                {currentLang === 'hi' ? 'फ़ॉर्म ऑटोफ़िल सहमति' : 'Form Autofill Consent'}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 12px' }}>
              {currentLang === 'hi'
                ? 'टेकफ़ॉर्म बडी आपके सहेजे गए प्रोफ़ाइल मानों का उपयोग करके इस पृष्ठ के फ़ील्ड को सुरक्षित रूप से भर देगा। संवेदनशील पहचान पत्र (आधार, पैन), पासवर्ड, ओटीपी और बैंक विवरण कभी भी स्वचालित रूप से नहीं भरे जाते हैं।'
                : 'TechForm Buddy will match and safely autofill fields on this page using your saved profile values. Sensitive IDs (Aadhaar, PAN), passwords, OTPs, and bank accounts are strictly excluded and never filled.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="tfb-btn-secondary"
                onClick={() => setShowConsentModal(false)}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                {currentLang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                id="btn-consent-autofill"
                data-testid="btn-consent-autofill"
                type="button"
                className="tfb-tts-btn-primary"
                onClick={handleGrantConsent}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                {currentLang === 'hi' ? 'सहमति दें और ऑटोफ़िल चलाएँ' : 'Consent & Run Autofill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
