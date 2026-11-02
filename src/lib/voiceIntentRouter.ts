/**
 * Voice Intent Router
 *
 * Maps speech transcripts (multilingual: English, Hindi, etc.) to actionable application intents.
 * Employs keyword matching first with LLM fallback.
 * Strictly enforces confirmation on data-altering actions and refuses to store or speak credentials/OTPs.
 */

export type VoiceIntentType =
  | 'NAVIGATE'
  | 'NEW_FORM'
  | 'WATCH_SCHOLARSHIPS'
  | 'READ_PAGE_ALOUD'
  | 'SMART_BRIEFING'
  | 'READ_FULL_PAGE'
  | 'READ_NEXT_FIELD'
  | 'PAGE_GUIDE'
  | 'STOP_SPEECH'
  | 'DOWNLOAD_PDF'
  | 'OPEN_PORTAL'
  | 'STEP_NEXT'
  | 'STEP_PREVIOUS'
  | 'FILL_THIS'
  | 'FILL_ALL'
  | 'CHANGE_LANGUAGE'
  | 'SCROLL_DOWN'
  | 'SCROLL_UP'
  | 'HIDE_WIDGET'
  | 'SUBMIT_FORM'
  | 'DELETE_DATA'
  | 'QUESTION'
  | 'UNKNOWN';

export interface VoiceIntentResult {
  type: VoiceIntentType;
  target?: string;
  targetLanguage?: string;
  label: string;
  portalQuery?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  securityBlocked?: boolean;
  securityMessage?: string;
  isQuestion?: boolean;
  question?: string;
  confidence?: number;
}

// Security rule: Never speak or store passwords, OTPs, PINs, or CVVs
const SENSITIVE_CREDENTIAL_REGEX =
  /(?:password|otp|one[\s-]?time[\s-]?password|passcode|secret[\s-]?key|पासवर्ड|ओटीपी|पिन|cvv|pin[\s-]?code)\s*[:=]?\s*([A-Za-z0-9@#$%^&*!]+)?/i;

export function sanitizeTranscript(rawText: string): {
  clean: string;
  blocked: boolean;
  warning?: string;
} {
  const text = (rawText || '').trim();

  if (SENSITIVE_CREDENTIAL_REGEX.test(text)) {
    return {
      clean: text.replace(SENSITIVE_CREDENTIAL_REGEX, '[REDACTED_CREDENTIAL]'),
      blocked: true,
      warning: 'Security protection: Passwords, OTPs, and security PINs cannot be spoken or processed by voice.',
    };
  }

  return { clean: text, blocked: false };
}

/**
 * Route transcript to intent using keyword rules first
 */
export async function routeVoiceIntent(
  rawTranscript: string,
  language = 'en',
  currentPath = '/'
): Promise<VoiceIntentResult> {
  // 1. Security Check
  const security = sanitizeTranscript(rawTranscript);
  if (security.blocked) {
    return {
      type: 'UNKNOWN',
      label: 'Security Notice',
      securityBlocked: true,
      securityMessage: security.warning,
    };
  }

  const query = security.clean.toLowerCase().trim();

  // 2. STOP Intent (Immediate Highest Priority)
  if (
    query === 'stop' ||
    query === 'pause' ||
    query.includes('stop reading') ||
    query.includes('stop speech') ||
    query.includes('stop speaking') ||
    query.includes('रुको') ||
    query.includes('रुकें') ||
    query.includes('बंद करो') ||
    query.includes('चुप रहो') ||
    query.includes('शांत')
  ) {
    return {
      type: 'STOP_SPEECH',
      label: language === 'hi' ? 'आवाज़ बंद करें' : 'Stop Speaking',
    };
  }

  // 3. READ PAGE ALOUD Intent
  if (
    query.includes('read this page aloud') ||
    query.includes('read page aloud') ||
    query.includes('read aloud') ||
    query.includes('read page') ||
    query.includes('read this page') ||
    query.includes('read screen') ||
    query.includes('पढ़कर सुनाओ') ||
    query.includes('पेज पढ़ो') ||
    query.includes('स्क्रीन पढ़ो') ||
    query.includes('बोलकर बताओ')
  ) {
    return {
      type: 'READ_PAGE_ALOUD',
      label: language === 'hi' ? 'पेज पढ़कर सुनाएं' : 'Read Page Aloud',
      confidence: 0.95,
    };
  }

  // 3a. SMART BRIEFING Intent (Requirement 3)
  if (
    query === 'briefing' ||
    query.includes('smart briefing') ||
    query.includes('page briefing') ||
    query.includes('give me a briefing') ||
    query.includes('read briefing') ||
    query.includes('briefing sunao') ||
    query.includes('ब्रीफिंग') ||
    query.includes('संक्षेप')
  ) {
    return {
      type: 'SMART_BRIEFING',
      label: language === 'hi' ? 'स्मार्ट ब्रीफिंग' : 'Smart Briefing',
      confidence: 0.95,
    };
  }

  // 3b. READ FULL PAGE Intent
  if (
    query === 'read full page' ||
    query.includes('read whole page') ||
    query.includes('read complete page') ||
    query.includes('पूरा पेज पढ़ो')
  ) {
    return {
      type: 'READ_FULL_PAGE',
      label: language === 'hi' ? 'पूरा पेज पढ़ें' : 'Read Full Page',
      confidence: 0.95,
    };
  }

  // 3c. READ NEXT FIELD Intent
  if (
    query === 'read next field' ||
    query.includes('next field') ||
    query.includes('अगला फ़ील्ड पढ़ो')
  ) {
    return {
      type: 'READ_NEXT_FIELD',
      label: language === 'hi' ? 'अगला फ़ील्ड पढ़ें' : 'Read Next Field',
      confidence: 0.95,
    };
  }

  // 3b. PAGE GUIDE / SCREEN EXPLANATION Intent
  if (
    query.includes('what is on this screen') ||
    query.includes('what is on screen') ||
    query.includes('what is here') ||
    query.includes("what's on this screen") ||
    query.includes("what's here") ||
    query.includes('page guide') ||
    query.includes('screen guide') ||
    query.includes('explain screen') ||
    query.includes('explain page') ||
    query.includes('स्क्रीन पर क्या है') ||
    query.includes('यह क्या है') ||
    query.includes('गाइड')
  ) {
    return {
      type: 'PAGE_GUIDE',
      label: language === 'hi' ? 'स्क्रीन का विवरण' : 'Page Guide',
    };
  }

  // 4. DOWNLOAD AS PDF Intent
  if (
    query.includes('download as pdf') ||
    query.includes('download pdf') ||
    query.includes('save as pdf') ||
    query.includes('pdf download') ||
    query.includes('pdf डाउनलोड') ||
    query.includes('डाउनलोड करो') ||
    query.includes('डाउनलोड फॉर्म')
  ) {
    return {
      type: 'DOWNLOAD_PDF',
      label: language === 'hi' ? 'पीडीएफ डाउनलोड करें' : 'Download as PDF',
    };
  }

  // 5. OPEN <PORTAL> WITH BUDDY Intent
  const openPortalMatch = query.match(
    /(?:open|launch|खोलो)\s+([a-zA-Z0-9\s.-]+?)\s+(?:with buddy|in buddy|portal)?$/i
  ) || query.match(/open\s+([a-zA-Z0-9\s.-]+)\s+with buddy/i);

  if (openPortalMatch && openPortalMatch[1]) {
    const portalName = openPortalMatch[1].trim();
    return {
      type: 'OPEN_PORTAL',
      target: `/browser?portal=${encodeURIComponent(portalName)}`,
      portalQuery: portalName,
      label: language === 'hi' ? `${portalName} पोर्टल खोलें` : `Open ${portalName} with Buddy`,
    };
  }

  // 6. WATCH SCHOLARSHIP FORMS Intent
  if (
    query.includes('watch scholarship forms') ||
    query.includes('watch scholarship') ||
    query.includes('scholarship watch') ||
    query.includes('track scholarships') ||
    query.includes('form watch') ||
    query.includes('watch forms') ||
    query.includes('फॉर्म वॉच') ||
    query.includes('छात्रवृत्ति फॉर्म')
  ) {
    return {
      type: 'WATCH_SCHOLARSHIPS',
      target: '/form-watch?q=scholarship',
      label: language === 'hi' ? 'छात्रवृत्ति फॉर्म ट्रैक करें' : 'Watch Scholarship Forms',
    };
  }

  // 7. NEW FORM Intent
  if (
    query === 'new form' ||
    query.includes('new form') ||
    query.includes('create form') ||
    query.includes('draft form') ||
    query.includes('start form') ||
    query.includes('नया फॉर्म') ||
    query.includes('फॉर्म बनाओ') ||
    query.includes('नया आवेदन')
  ) {
    return {
      type: 'NEW_FORM',
      target: '/forms/new',
      label: language === 'hi' ? 'नया फॉर्म बनाएं' : 'Create New Form',
    };
  }

  // 8. NEXT / PREVIOUS STEP Intent
  if (
    query === 'next' ||
    query.includes('next step') ||
    query.includes('go next') ||
    query.includes('अगला कदम') ||
    query.includes('अगला') ||
    query.includes('आगे')
  ) {
    return {
      type: 'STEP_NEXT',
      label: language === 'hi' ? 'अगला कदम' : 'Next Step',
    };
  }

  if (
    query === 'previous' ||
    query === 'back' ||
    query.includes('previous step') ||
    query.includes('go back') ||
    query.includes('पिछला कदम') ||
    query.includes('पिछला') ||
    query.includes('पीछे')
  ) {
    return {
      type: 'STEP_PREVIOUS',
      label: language === 'hi' ? 'पिछला कदम' : 'Previous Step',
    };
  }

  // 8b. FILL THIS / FILL ALL Intent
  if (
    query === 'fill this' ||
    query.includes('fill this') ||
    query.includes('fill field') ||
    query.includes('fill current') ||
    query.includes('यह भरो') ||
    query.includes('इसे भरो') ||
    query.includes('इसको भरो')
  ) {
    return {
      type: 'FILL_THIS',
      label: language === 'hi' ? 'यह फ़ील्ड भरें' : 'Fill this field',
    };
  }

  if (
    query === 'fill all' ||
    query.includes('fill all') ||
    query.includes('fill form') ||
    query.includes('fill all fields') ||
    query.includes('auto fill') ||
    query.includes('सब भरो') ||
    query.includes('सभी भरें') ||
    query.includes('पूरा फॉर्म भरो')
  ) {
    return {
      type: 'FILL_ALL',
      label: language === 'hi' ? 'सभी फ़ील्ड भरें' : 'Fill all fields',
    };
  }

  // 8c. CHANGE LANGUAGE Intent
  const langMatch = query.match(/(?:change|switch|set)\s+(?:language\s+to|to)\s+([a-zA-Z]+)/i) ||
    query.match(/भाषा\s+(?:बदलो|बदलें)\s*([a-zA-Z\u0900-\u097F]+)?/i);
  if (
    langMatch ||
    query.includes('change language') ||
    query.includes('switch language') ||
    query.includes('भाषा बदलो')
  ) {
    let targetLang = 'en';
    const q = query.toLowerCase();
    if (q.includes('hindi') || q.includes('हिन्दी') || q.includes('हिंदी')) targetLang = 'hi';
    else if (q.includes('bengali') || q.includes('বাংলা') || q.includes('bangla')) targetLang = 'bn';
    else if (q.includes('tamil') || q.includes('தமிழ்')) targetLang = 'ta';
    else if (q.includes('telugu') || q.includes('తెలుగు')) targetLang = 'te';
    else if (q.includes('marathi') || q.includes('मराठी')) targetLang = 'mr';
    else if (q.includes('english') || q.includes('अंग्रेजी')) targetLang = 'en';

    return {
      type: 'CHANGE_LANGUAGE',
      targetLanguage: targetLang,
      label: language === 'hi' ? `भाषा ${targetLang.toUpperCase()} में बदलें` : `Change language to ${targetLang.toUpperCase()}`,
    };
  }

  // 8d. SCROLL DOWN / UP Intent
  if (query === 'scroll down' || query.includes('scroll down') || query.includes('नीचे स्क्रॉल') || query.includes('नीचे जाओ')) {
    return {
      type: 'SCROLL_DOWN',
      label: language === 'hi' ? 'नीचे स्क्रॉल करें' : 'Scroll down',
    };
  }
  if (query === 'scroll up' || query.includes('scroll up') || query.includes('ऊपर स्क्रॉल') || query.includes('ऊपर जाओ')) {
    return {
      type: 'SCROLL_UP',
      label: language === 'hi' ? 'ऊपर स्क्रॉल करें' : 'Scroll up',
    };
  }

  // 8e. HIDE / MINIMIZE Intent
  if (
    query === 'hide' ||
    query === 'minimize' ||
    query.includes('hide buddy') ||
    query.includes('minimize buddy') ||
    query.includes('close buddy') ||
    query.includes('hide widget') ||
    query.includes('छिपाओ') ||
    query.includes('बंद करो')
  ) {
    return {
      type: 'HIDE_WIDGET',
      label: language === 'hi' ? 'बडी छिपाएं' : 'Hide Buddy',
    };
  }

  // 9. SAFETY GUARANTEE: SUBMIT OR PAY NEVER CLICKS ANYTHING
  if (
    query === 'submit' ||
    query === 'pay' ||
    query.includes('submit form') ||
    query.includes('submit application') ||
    query.includes('make payment') ||
    query.includes('pay fee') ||
    query.includes('pay now') ||
    query.includes('सबमिट करो') ||
    query.includes('जमा करो') ||
    query.includes('भुगतान करो')
  ) {
    return {
      type: 'SUBMIT_FORM',
      label: language === 'hi' ? 'सुरक्षा नियम: स्वयं सबमिट या भुगतान करें' : 'Safety Guarantee: Manual submission required',
      requiresConfirmation: true,
      confirmationMessage:
        language === 'hi'
          ? 'सुरक्षा गारंटी: फॉर्म जमा करने से पहले कृपया समीक्षा करें। फॉर्म को आपको स्वयं सबमिट बटन दबाकर जमा करना होगा।'
          : 'Safety Notice: TechForm Buddy never submits forms automatically. Review entries before proceeding.',
    };
  }

  if (
    query.includes('delete') ||
    query.includes('clear form') ||
    query.includes('डिलीट') ||
    query.includes('हटाएं') ||
    query.includes('साफ करो') ||
    query.includes('reset data')
  ) {
    return {
      type: 'DELETE_DATA',
      label: language === 'hi' ? 'डेटा साफ़ करें' : 'Delete / Clear Data',
      requiresConfirmation: true,
      confirmationMessage:
        language === 'hi'
          ? 'क्या आप इस फॉर्म या डेटा को हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।'
          : 'Are you sure you want to delete or clear this data? This action cannot be undone.',
    };
  }

  // 10. PAGE NAVIGATION ROUTING
  // Dashboard
  if (
    query.includes('dashboard') ||
    query.includes('डैशबोर्ड') ||
    query === 'home' ||
    query === 'go home' ||
    query.includes('होम')
  ) {
    return {
      type: 'NAVIGATE',
      target: '/dashboard',
      label: language === 'hi' ? 'डैशबोर्ड पर जाएं' : 'Go to Dashboard',
    };
  }

  // Forms
  if (
    query.includes('all forms') ||
    query.includes('my forms') ||
    query.includes('forms page') ||
    query === 'forms' ||
    query === 'form' ||
    query.includes('फॉर्म') ||
    query.includes('आवेदन सूची')
  ) {
    return {
      type: 'NAVIGATE',
      target: '/forms',
      label: language === 'hi' ? 'फॉर्म्स सूची पर जाएं' : 'Go to Forms',
    };
  }

  // Documents
  if (
    query.includes('document') ||
    query.includes('documents') ||
    query.includes('दस्तावेज़') ||
    query.includes('कागजात') ||
    query.includes('my uploads') ||
    query.includes('upload document')
  ) {
    return {
      type: 'NAVIGATE',
      target: '/documents',
      label: language === 'hi' ? 'दस्तावेज़ पर जाएं' : 'Go to Documents',
    };
  }

  // AI Assistant
  if (
    query.includes('assistant') ||
    query.includes('ai assistant') ||
    query.includes('सहायक') ||
    query.includes('असिस्टेंट') ||
    query.includes('chatbot') ||
    query.includes('help me')
  ) {
    return {
      type: 'NAVIGATE',
      target: '/assistant',
      label: language === 'hi' ? 'AI असिस्टेंट पर जाएं' : 'Go to AI Assistant',
    };
  }

  // Portal Launcher
  if (
    query.includes('portal launcher') ||
    query.includes('launcher') ||
    query.includes('browser') ||
    query.includes('पोर्टल') ||
    query.includes('ब्राउज़र') ||
    query.includes('smart browser')
  ) {
    return {
      type: 'NAVIGATE',
      target: '/browser',
      label: language === 'hi' ? 'पोर्टल लॉन्चर पर जाएं' : 'Go to Portal Launcher',
    };
  }

  // Profile
  if (
    query.includes('profile') ||
    query.includes('प्रोफाइल') ||
    query.includes('my details') ||
    query.includes('मेरी जानकारी') ||
    query.includes('account')
  ) {
    return {
      type: 'NAVIGATE',
      target: '/profile',
      label: language === 'hi' ? 'प्रोफ़ाइल पर जाएं' : 'Go to Profile',
    };
  }

  // Alerts & Notifications
  if (
    query.includes('alert') ||
    query.includes('alerts') ||
    query.includes('notification') ||
    query.includes('notifications') ||
    query.includes('अलर्ट') ||
    query.includes('सूचनाएं') ||
    query.includes('सूचना')
  ) {
    return {
      type: 'NAVIGATE',
      target: '/notifications',
      label: language === 'hi' ? 'सूचनाएं देखें' : 'Go to Notifications',
    };
  }

  // Settings
  if (
    query.includes('setting') ||
    query.includes('settings') ||
    query.includes('सेटिंग्स') ||
    query.includes('preferences') ||
    query.includes('विकल्प')
  ) {
    return {
      type: 'NAVIGATE',
      target: '/settings',
      label: language === 'hi' ? 'सेटिंग्स पर जाएं' : 'Go to Settings',
    };
  }

  // 11. LLM Fallback: for conversational or ambiguous commands
  try {
    const res = await fetch('/api/voice-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: query,
        language,
        currentPath,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.type && data.type !== 'UNKNOWN') {
        return data as VoiceIntentResult;
      }
    }
  } catch (err) {
    console.warn('[VoiceIntent] Fallback endpoint unavailable:', err);
  }

  // 11. EVERYTHING ELSE IS A QUESTION (Requirement 1)
  // Confidence threshold: If not a recognized high-confidence command, route to question answering.
  // Never just echo the transcript as a "command".
  return {
    type: 'QUESTION',
    label: language === 'hi' ? 'सवाल का जवाब तैयार किया जा रहा है...' : 'Answering your question...',
    isQuestion: true,
    question: rawTranscript,
    confidence: 0,
  };
}
