/**
 * Multi-Step Natural Language Planner & Action Resolver
 *
 * Decomposes natural language requests (in English, Hindi, Hinglish, etc.) into:
 * 1. An answer (informational response),
 * 2. A clarifying question (when confidence is low or request is ambiguous), or
 * 3. A validated multi-step PLAN with typed parameters matching the action registry.
 *
 * Enforces hard safety limits: NEVER submit, pay, solve captcha, or touch passwords/OTPs.
 */

export type StepActionType =
  | 'navigate'
  | 'select_template'
  | 'start_form'
  | 'fill_field'
  | 'ask_user'
  | 'attach_document'
  | 'generate'
  | 'download'
  | 'open_settings'
  | 'set_language'
  | 'set_voice_speed'
  | 'create_watch'
  | 'read_aloud'
  | 'explain_page'
  | 'refusal'
  // Browser Agent Actions
  | 'search_portal'
  | 'inspect_page'
  | 'detect_forms'
  | 'fill_fields'
  | 'download_document'
  | 'request_approval'
  | 'speak';

export interface PlanStep {
  id: string;
  action: StepActionType;
  title?: string;
  toolName?: string;
  description: string;
  descriptionHi?: string;
  parameters: Record<string, any>;
  params?: Record<string, any>;
  requiresConfirmation?: boolean;
  expectedResult?: string;
  expectedResultHi?: string;
  verifyCondition?: string;
  fallbackStrategy?: string;
  retryCount?: number;
  maxRetries?: number;
  observation?: any;
  executionResult?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'unverified';
  resultMessage?: string;
  verified?: boolean;
}

export interface AssistantPlan {
  id: string;
  title: string;
  titleHi?: string;
  goal?: string;
  goalHi?: string;
  summary: string;
  summaryHi?: string;
  target?: 'app' | 'portal';
  steps: PlanStep[];
  currentStepIndex: number;
  status: 'proposed' | 'consented' | 'running' | 'paused' | 'completed' | 'cancelled';
  autopilot?: boolean;
  updatedAt?: number;
  collectedAnswers: Record<string, any>;
  createdAt: number;
}

export interface ClarifyingQuestion {
  question: string;
  questionHi?: string;
  options?: string[];
  optionsHi?: string[];
  fieldKey?: string;
}

export interface PlannerResult {
  type: 'plan' | 'clarification' | 'answer' | 'refusal';
  reply: string;
  replyHi?: string;
  plan?: AssistantPlan;
  clarifyingQuestion?: ClarifyingQuestion;
  confidence: number;
  safetyRefusal?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Page Synonyms & Target Resolution (English, Hindi, Hinglish)
// ─────────────────────────────────────────────────────────────
export const PAGE_ROUTES: Record<string, { path: string; name: string; nameHi: string }> = {
  dashboard: { path: '/dashboard', name: 'Dashboard', nameHi: 'डैशबोर्ड' },
  forms: { path: '/forms', name: 'Forms', nameHi: 'फॉर्म्स' },
  new_form: { path: '/forms/new', name: 'New Form Creation', nameHi: 'नया फॉर्म' },
  documents: { path: '/documents', name: 'Document Vault', nameHi: 'दस्तावेज़ वॉल्ट' },
  settings: { path: '/settings', name: 'Settings', nameHi: 'सेटिंग्स' },
  watch: { path: '/form-watch', name: 'Form Watch', nameHi: 'फॉर्म वॉच' },
  notifications: { path: '/notifications', name: 'Alerts & Notices', nameHi: 'अलर्ट्स व सूचनाएं' },
  profile: { path: '/profile', name: 'User Profile', nameHi: 'प्रोफ़ाइल' },
  browser: { path: '/browser', name: 'Portal Launcher', nameHi: 'पोर्टल लॉन्चर' },
  demo_portal: { path: '/demo-portal', name: 'Demo Portal', nameHi: 'डेमो पोर्टल' },
};

const ROUTE_SYNONYMS: Array<{ key: string; keywords: string[] }> = [
  {
    key: 'dashboard',
    keywords: [
      'dashboard', 'mukhya prishth', 'home', 'main page', 'overview',
      'dashboard par jao', 'dashboard kholo', 'dashboard dikhao', 'go to dashboard',
      'होम', 'डैशबोर्ड', 'डैशबोर्ड पर जाओ', 'डैशबोर्ड खोलो'
    ],
  },
  {
    key: 'forms',
    keywords: [
      'forms', 'form', 'form list', 'my forms', 'mere forms', 'mere saare forms',
      'forms dikhao', 'forms kholo', 'saved forms', 'application list', 'applications',
      'फॉर्म', 'फॉर्म्स', 'मेरे फॉर्म', 'फॉर्म्स दिखाओ', 'फॉर्म्स खोलो'
    ],
  },
  {
    key: 'new_form',
    keywords: [
      'new form', 'create form', 'start form', 'naya form', 'form banao', 'forms new',
      'naya aavedan', 'naya application', 'make form', 'form shuru karo',
      'नया फॉर्म', 'फॉर्म बनाओ', 'फॉर्म शुरू करो'
    ],
  },
  {
    key: 'documents',
    keywords: [
      'documents', 'document', 'dastavej', 'mere documents', 'documents kholo',
      'vault', 'my documents', 'certificates', 'marksheet', 'uploaded documents',
      'दस्तावेज़', 'डॉक्यूमेंट्स', 'मेरे दस्तावेज़', 'दस्तावेज़ खोलो'
    ],
  },
  {
    key: 'watch',
    keywords: [
      'form watch', 'watch', 'watch lagao', 'monitor', 'scholarship watch',
      'exam watch', 'alerts setup', 'watch list', 'create watch',
      'फॉर्म वॉच', 'वॉच लगाओ', 'मॉनिटर'
    ],
  },
  {
    key: 'notifications',
    keywords: [
      'alerts', 'notifications', 'soochna', 'alerts dikhao', 'notifications dikhao',
      'notice', 'notices', 'अलर्ट', 'अलर्ट्स', 'सूचनाएं', 'नोटिस'
    ],
  },
  {
    key: 'profile',
    keywords: [
      'profile', 'my profile', 'meri profile', 'meri jankari', 'user profile',
      'profile kholo', 'personal details', 'प्रोफ़ाइल', 'मेरी प्रोफ़ाइल'
    ],
  },
  {
    key: 'settings',
    keywords: [
      'settings', 'setting', 'options', 'preferences', 'settings kholo',
      'setting badlo', 'configuration', 'सेटिंग्स', 'सेटिंग', 'सेटिंग्स खोलो'
    ],
  },
  {
    key: 'browser',
    keywords: [
      'browser', 'portal', 'launcher', 'portal launcher', 'external portal',
      'ब्राउज़र', 'पोर्टल'
    ],
  },
  {
    key: 'demo_portal',
    keywords: [
      'demo', 'demo portal', 'sample portal', 'test portal',
      'डेमो', 'डेमो पोर्टल'
    ],
  },
];

export function resolvePageRoute(query: string): { path: string; name: string; nameHi: string } | null {
  const q = query.toLowerCase().trim();
  const allEntries: Array<{ key: string; keyword: string }> = [];
  for (const item of ROUTE_SYNONYMS) {
    for (const kw of item.keywords) {
      allEntries.push({ key: item.key, keyword: kw.toLowerCase() });
    }
  }
  allEntries.sort((a, b) => b.keyword.length - a.keyword.length);

  for (const entry of allEntries) {
    if (q === entry.keyword || q.includes(entry.keyword)) {
      return PAGE_ROUTES[entry.key] || null;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Hard Safety Limits Validator (Zero Guessing on Forbidden Operations)
// ─────────────────────────────────────────────────────────────
export function checkSafetyLimits(query: string): { isForbidden: boolean; reason: string; reasonHi: string } | null {
  const q = query.toLowerCase();

  // 0. Prompt Injection / Jailbreak Refusal
  if (
    q.includes('ignore previous') ||
    q.includes('bypass') ||
    q.includes('jailbreak') ||
    q.includes('override safety') ||
    q.includes('prompt injection') ||
    q.includes('disregard')
  ) {
    return {
      isForbidden: true,
      reason: 'Security violation: Unauthorized prompt injection or security bypass attempt detected.',
      reasonHi: 'सुरक्षा उल्लंघन: अनधिकृत सुरक्षा बाईपास प्रयास पाया गया।',
    };
  }

  // 1. Never Submit
  if (
    q.includes('submit') ||
    q.includes('सबमिट')
  ) {
    return {
      isForbidden: true,
      reason: 'For your security and legal protection, TechForm Buddy will NEVER submit a form on your behalf. You must review the completed fields and click Submit yourself.',
      reasonHi: 'आपकी सुरक्षा के लिए, TechForm Buddy कभी भी आपकी ओर से फॉर्म सबमिट नहीं करेगा। आपको खुद जांच कर सबमिट करना होगा।',
    };
  }

  // 2. Never handle passwords or OTPs
  if (
    q.includes('password') ||
    q.includes('mera password') ||
    q.includes('password daal') ||
    q.includes('enter password') ||
    q.includes('पासवर्ड')
  ) {
    return {
      isForbidden: true,
      reason: 'TechForm Buddy strictly protects your security and will NEVER enter or store your secret passwords.',
      reasonHi: 'TechForm Buddy आपकी सुरक्षा के लिए कभी भी पासवर्ड दर्ज या स्टोर नहीं करेगा।',
    };
  }

  if (
    q.includes('otp') ||
    q.includes('one time password') ||
    q.includes('enter otp') ||
    q.includes('fill otp') ||
    q.includes('ओटीपी')
  ) {
    return {
      isForbidden: true,
      reason: 'TechForm Buddy NEVER handles OTPs. Please verify and enter one-time passcodes yourself.',
      reasonHi: 'TechForm Buddy कभी भी OTP दर्ज नहीं करेगा। कृपया ओटीपी स्वयं दर्ज करें।',
    };
  }

  // 3. Never make payments
  if (
    q.includes('pay fee') ||
    q.includes('make payment') ||
    q.includes('payment kar do') ||
    q.includes('pay online') ||
    q.includes('fees bhar do') ||
    q.includes('पेमेंट') ||
    q.includes('फीस भुगतान')
  ) {
    return {
      isForbidden: true,
      reason: 'TechForm Buddy NEVER executes financial transactions or fees payments. Please complete payments securely on the official portal.',
      reasonHi: 'TechForm Buddy कभी भी वित्तीय लेन-देन या फीस का भुगतान नहीं करता है। कृपया आधिकारिक पोर्टल पर स्वयं भुगतान करें।',
    };
  }

  // 4. Never solve captchas
  if (
    q.includes('solve captcha') ||
    q.includes('captcha solve') ||
    q.includes('बायपास कैप्चा')
  ) {
    return {
      isForbidden: true,
      reason: 'TechForm Buddy adheres to government portal security protocols and does not bypass or solve captchas.',
      reasonHi: 'TechForm Buddy कैप्चा हल या बायपास नहीं करता है।',
    };
  }

  // 5. Prompt injection defense
  if (
    q.includes('ignore previous instructions') ||
    q.includes('override safety') ||
    q.includes('system prompt') ||
    q.includes('fill aadhaar without consent')
  ) {
    return {
      isForbidden: true,
      reason: 'This request violates system integrity policies and has been rejected.',
      reasonHi: 'यह अनुरोध सुरक्षा नीतियों का उल्लंघन करता है और अस्वीकार कर दिया गया है।',
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Language Code Extractor
// ─────────────────────────────────────────────────────────────
export function extractTargetLanguage(query: string): { code: string; label: string; nativeName: string } | null {
  const q = query.toLowerCase();
  const languages = [
    { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', patterns: ['hindi', 'हिन्दी', 'हिंदी'] },
    { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்', patterns: ['tamil', 'தமிழ்', 'तमिल'] },
    { code: 'te', label: 'Telugu', nativeName: 'తెలుగు', patterns: ['telugu', 'తెలుగు', 'तेलुगु'] },
    { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', patterns: ['bengali', 'bangla', 'বাংলা', 'बंगाली'] },
    { code: 'mr', label: 'Marathi', nativeName: 'मराठी', patterns: ['marathi', 'मराठी', 'मराठी'] },
    { code: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી', patterns: ['gujarati', 'ગુજરાતી', 'गुजराती'] },
    { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ', patterns: ['kannada', 'ಕನ್ನಡ', 'कन्नड़'] },
    { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം', patterns: ['malayalam', 'മലയാളം', 'मलयालम'] },
    { code: 'pa', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', patterns: ['punjabi', 'ਪੰਜਾਬੀ', 'पंजाबी'] },
    { code: 'ur', label: 'Urdu', nativeName: 'اردو', patterns: ['urdu', 'اردو', 'उर्दू'] },
    { code: 'en', label: 'English', nativeName: 'English', patterns: ['english', 'अंग्रेजी'] },
  ];

  for (const lang of languages) {
    for (const pat of lang.patterns) {
      if (q.includes(pat)) {
        return { code: lang.code, label: lang.label, nativeName: lang.nativeName };
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Main Plan Generator (Multilingual, Multi-Step, Typed Steps)
// ─────────────────────────────────────────────────────────────
export function planUserUtterance(rawQuery: string, currentPath: string = '/', currentLanguage: string = 'en'): PlannerResult {
  const q = rawQuery.trim();
  const qLower = q.toLowerCase();

  // 1. Hard safety limit check
  const safety = checkSafetyLimits(q);
  if (safety) {
    return {
      type: 'refusal',
      reply: safety.reason,
      replyHi: safety.reasonHi,
      confidence: 1.0,
      safetyRefusal: true,
    };
  }

  // 2. Ambiguity & Clarification Detection
  const shortVagueWords = ['kuch karo', 'open', 'chalo', 'karo', 'help', 'help me', 'madad karo', 'shuru karo'];
  if (shortVagueWords.includes(qLower) || (q.length < 5 && !['forms', 'watch', 'home'].includes(qLower))) {
    return {
      type: 'clarification',
      reply: 'What would you like to do? I can help you create a form, check your alerts, or guide you through this page.',
      replyHi: 'आप क्या करना चाहते हैं? मैं नया फॉर्म बनाने, अलर्ट देखने या इस पेज को समझाने में मदद कर सकता हूँ।',
      confidence: 0.45,
      clarifyingQuestion: {
        question: 'What would you like me to do?',
        questionHi: 'आप क्या करना चाहते हैं?',
        options: ['Create a Form or Resume', 'Open Form Watch Alerts', 'Explain this page', 'Go to Dashboard'],
        optionsHi: ['नया फॉर्म या रेज़्यूमे बनाएं', 'फॉर्म वॉच अलर्ट्स देखें', 'इस पेज को समझाएं', 'डैशबोर्ड पर जाएं'],
      },
    };
  }

  // 3. Multi-Step Flow A: Resume / CV Creation
  if (
    qLower.includes('resume') ||
    qLower.includes('curriculum vitae') ||
    qLower.includes('cv') ||
    qLower.includes('बायोडाटा') ||
    qLower.includes('रेज़्यूमे')
  ) {
    const plan: AssistantPlan = {
      id: `plan-resume-${Date.now()}`,
      title: 'Create Professional Resume',
      titleHi: 'प्रोफेशनल रेज़्यूमे तैयार करें',
      summary: 'I will open Forms, choose the Resume template, collect your education, skills, and projects, generate the document, and download it with your confirmation. Go ahead?',
      summaryHi: 'मैं फॉर्म खोलकर रेज़्यूमे टेम्पलेट चुनूँगा, आपकी शिक्षा और स्किल्स पूछूँगा, और फिर डॉक्यूमेंट जनरेट करूँगा। क्या आगे बढ़ें?',
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-nav',
          action: 'navigate',
          description: 'Open Form Creation (/forms/new)',
          descriptionHi: 'फॉर्म निर्माण पेज खोलें (/forms/new)',
          parameters: { page: '/forms/new?type=resume' },
          status: 'pending',
        },
        {
          id: 'step-tmpl',
          action: 'select_template',
          description: 'Select Resume / CV Template',
          descriptionHi: 'रेज़्यूमे टेम्पलेट चुनें',
          parameters: { templateId: 'resume', templateTitle: 'Resume / Curriculum Vitae (CV)' },
          status: 'pending',
        },
        {
          id: 'step-ask-edu',
          action: 'ask_user',
          description: 'Ask for Education & College Details',
          descriptionHi: 'शिक्षा व कॉलेज का विवरण पूछें',
          parameters: {
            question: 'What is your highest degree/education and college name?',
            questionHi: 'आपकी उच्चतम शिक्षा और कॉलेज का नाम क्या है?',
            fieldKey: 'education',
          },
          status: 'pending',
        },
        {
          id: 'step-ask-skills',
          action: 'ask_user',
          description: 'Ask for Technical Skills & Tools',
          descriptionHi: 'टेक्निकल स्किल्स और टूल्स पूछें',
          parameters: {
            question: 'What are your key technical skills and tools?',
            questionHi: 'आपके मुख्य टेक्निकल स्किल्स और टूल्स कौन से हैं?',
            fieldKey: 'skills',
          },
          status: 'pending',
        },
        {
          id: 'step-ask-proj',
          action: 'ask_user',
          description: 'Ask for Key Projects or Work Experience',
          descriptionHi: 'प्रोजेक्ट्स या कार्यानुभव पूछें',
          parameters: {
            question: 'Describe your key projects or work experience:',
            questionHi: 'अपने मुख्य प्रोजेक्ट्स या कार्यानुभव के बारे में बताएं:',
            fieldKey: 'experience',
          },
          status: 'pending',
        },
        {
          id: 'step-gen',
          action: 'generate',
          description: 'Generate Clean Formatted Resume Document',
          descriptionHi: 'रेज़्यूमे डॉक्यूमेंट जनरेट करें',
          parameters: { kind: 'resume' },
          status: 'pending',
        },
        {
          id: 'step-dl',
          action: 'download',
          description: 'Download Resume PDF',
          descriptionHi: 'रेज़्यूमे पीडीएफ डाउनलोड करें',
          parameters: { formId: 'current' },
          requiresConfirmation: true,
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // 4. Multi-Step Flow B: Scholarship Form & Document Attachment
  if (
    qLower.includes('scholarship') ||
    qLower.includes('chatravriti') ||
    qLower.includes('छात्रवृत्ति')
  ) {
    const isWatchIntent = qLower.includes('watch') || qLower.includes('alert') || qLower.includes('monitor') || qLower.includes('ट्रैक');
    if (isWatchIntent) {
      const plan: AssistantPlan = {
        id: `plan-watch-scholarship-${Date.now()}`,
        title: 'Setup Scholarship Form Watch',
        titleHi: 'छात्रवृत्ति फॉर्म वॉच सेट करें',
        summary: 'I will navigate to Form Watch, ask which scholarship sources to monitor, and set up your watch with your confirmation. Go ahead?',
        summaryHi: 'मैं फॉर्म वॉच पर जाऊँगा, स्रोत पूछूँगा, और आपकी पुष्टि के बाद छात्रवृत्ति वॉच सेट करूँगा। क्या आगे बढ़ें?',
        target: 'app',
        status: 'proposed',
        currentStepIndex: 0,
        collectedAnswers: {},
        createdAt: Date.now(),
        steps: [
          {
            id: 'step-nav-watch',
            action: 'navigate',
            description: 'Navigate to Form Watch (/form-watch)',
            descriptionHi: 'फॉर्म वॉच पेज पर जाएं (/form-watch)',
            parameters: { page: '/form-watch' },
            status: 'pending',
          },
          {
            id: 'step-ask-sources',
            action: 'ask_user',
            description: 'Ask for Specific Scholarship Portals to Watch',
            descriptionHi: 'मॉनिटर करने के लिए छात्रवृत्ति पोर्टल पूछें',
            parameters: {
              question: 'Which sources or portals would you like to watch for scholarships? (e.g. National Scholarship Portal, State Portal)',
              questionHi: 'आप छात्रवृत्ति के लिए कौन से पोर्टल मॉनिटर करना चाहते हैं? (जैसे राष्ट्रीय छात्रवृत्ति पोर्टल)',
              fieldKey: 'sources',
            },
            status: 'pending',
          },
          {
            id: 'step-create-watch',
            action: 'create_watch',
            description: 'Create Watch for Scholarship Portals',
            descriptionHi: 'छात्रवृत्ति पोर्टलों के लिए वॉच बनाएं',
            parameters: { query: 'scholarship' },
            requiresConfirmation: true,
            status: 'pending',
          },
        ],
      };

      return {
        type: 'plan',
        reply: plan.summary,
        replyHi: plan.summaryHi,
        plan,
        confidence: 0.94,
      };
    }

    // Scholarship form creation
    const plan: AssistantPlan = {
      id: `plan-scholarship-${Date.now()}`,
      title: 'Create Scholarship Application Form',
      titleHi: 'छात्रवृत्ति आवेदन फॉर्म तैयार करें',
      summary: 'I will open the Scholarship Application form, help you fill missing details, attach your income certificate, and generate the form. Go ahead?',
      summaryHi: 'मैं छात्रवृत्ति फॉर्म खोलूँगा, विवरण पूछूँगा, आय प्रमाण पत्र संलग्न करूँगा और फॉर्म जनरेट करूँगा। क्या आगे बढ़ें?',
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-nav-scholarship',
          action: 'navigate',
          description: 'Open Scholarship Form Creation (/forms/new)',
          descriptionHi: 'छात्रवृत्ति फॉर्म निर्माण खोलें (/forms/new)',
          parameters: { page: '/forms/new?type=scholarship' },
          status: 'pending',
        },
        {
          id: 'step-select-scholarship',
          action: 'select_template',
          description: 'Select Scholarship Application Template',
          descriptionHi: 'छात्रवृत्ति आवेदन टेम्पलेट चुनें',
          parameters: { templateId: 'scholarship_application', templateTitle: 'Scholarship Application Form' },
          status: 'pending',
        },
        {
          id: 'step-ask-scholarship-details',
          action: 'ask_user',
          description: 'Ask for Course and Family Income',
          descriptionHi: 'कोर्स और पारिवारिक आय पूछें',
          parameters: {
            question: 'What is your current course and annual family income?',
            questionHi: 'आपका वर्तमान कोर्स और वार्षिक पारिवारिक आय क्या है?',
            fieldKey: 'income_course',
          },
          status: 'pending',
        },
        {
          id: 'step-attach-income-doc',
          action: 'attach_document',
          description: 'Attach Income Certificate from Vault',
          descriptionHi: 'वॉल्ट से आय प्रमाण पत्र संलग्न करें',
          parameters: { docType: 'income_certificate', field: 'income_certificate' },
          requiresConfirmation: true,
          status: 'pending',
        },
        {
          id: 'step-gen-scholarship',
          action: 'generate',
          description: 'Generate Structured Scholarship Application Document',
          descriptionHi: 'छात्रवृत्ति आवेदन डॉक्यूमेंट जनरेट करें',
          parameters: { kind: 'application_form' },
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // 5. Multi-Step Flow C: Settings & Language Change
  if (
    (qLower.includes('setting') || qLower.includes('सेटिंग')) &&
    (qLower.includes('language') || qLower.includes('bhasha') || qLower.includes('भाषा') || extractTargetLanguage(qLower))
  ) {
    const targetLang = extractTargetLanguage(qLower) || { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்' };
    const plan: AssistantPlan = {
      id: `plan-lang-settings-${Date.now()}`,
      title: `Change Application Language to ${targetLang.label}`,
      titleHi: `भाषा बदलकर ${targetLang.nativeName} करें`,
      summary: `I will navigate to Settings and change the application language to ${targetLang.label}. Go ahead?`,
      summaryHi: `मैं सेटिंग्स खोलूँगा और भाषा ${targetLang.nativeName} में बदलूँगा। क्या आगे बढ़ें?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-nav-settings',
          action: 'navigate',
          description: 'Navigate to Settings (/settings)',
          descriptionHi: 'सेटिंग्स पेज पर जाएं (/settings)',
          parameters: { page: '/settings' },
          status: 'pending',
        },
        {
          id: 'step-set-lang',
          action: 'set_language',
          description: `Switch Language to ${targetLang.label} (${targetLang.nativeName})`,
          descriptionHi: `भाषा बदलकर ${targetLang.nativeName} करें`,
          parameters: { lang: targetLang.code },
          requiresConfirmation: true,
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // 6. Direct Language Switch without settings
  if (
    qLower.includes('change language') ||
    qLower.includes('set language') ||
    qLower.includes('switch language') ||
    qLower.includes('bhasha badlo') ||
    qLower.includes('bhasha badal') ||
    qLower.includes('language to') ||
    qLower.includes('language tamil') ||
    qLower.includes('language hindi') ||
    qLower.includes('language telugu') ||
    qLower.includes('language bengali') ||
    qLower.includes('language marathi') ||
    qLower.includes('में करो') ||
    qLower.includes('mein karo')
  ) {
    const targetLang = extractTargetLanguage(qLower) || { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' };
    const plan: AssistantPlan = {
      id: `plan-lang-${Date.now()}`,
      title: `Switch Language to ${targetLang.label}`,
      titleHi: `भाषा ${targetLang.nativeName} में बदलें`,
      summary: `Do you want to switch the application language to ${targetLang.label} (${targetLang.nativeName})?`,
      summaryHi: `क्या आप ऐप की भाषा ${targetLang.nativeName} में बदलना चाहते हैं?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-direct-lang',
          action: 'set_language',
          description: `Switch Language to ${targetLang.label} (${targetLang.nativeName})`,
          descriptionHi: `भाषा बदलकर ${targetLang.nativeName} करें`,
          parameters: { lang: targetLang.code, language: targetLang.code },
          requiresConfirmation: true,
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // 6.5. Voice Speed Adjustment
  if (
    qLower.includes('voice speed') ||
    qLower.includes('dheere') ||
    qLower.includes('tez') ||
    qLower.includes('speed fast') ||
    qLower.includes('speed slow') ||
    qLower.includes('speed normal') ||
    qLower.includes('आवाज की गति')
  ) {
    let speed = 1.0;
    let speedLabel = 'normal';
    if (qLower.includes('fast') || qLower.includes('tez') || qLower.includes('तेज़')) {
      speed = 1.3;
      speedLabel = 'fast';
    } else if (qLower.includes('slow') || qLower.includes('dheere') || qLower.includes('धीमे')) {
      speed = 0.8;
      speedLabel = 'slow';
    }

    const hasSettings = qLower.includes('setting') || qLower.includes('सेटिंग');
    const steps: PlanStep[] = [];
    if (hasSettings) {
      steps.push({
        id: 'step-nav-settings',
        action: 'navigate',
        description: 'Navigate to Settings (/settings)',
        descriptionHi: 'सेटिंग्स पेज पर जाएं (/settings)',
        parameters: { page: '/settings' },
        status: 'pending',
      });
    }
    steps.push({
      id: 'step-set-speed',
      action: 'set_voice_speed',
      description: `Set voice speed to ${speedLabel} (${speed}x)`,
      descriptionHi: `आवाज की गति ${speedLabel} (${speed}x) सेट करें`,
      parameters: { speed, speedLabel },
      requiresConfirmation: true,
      status: 'pending',
    });

    const plan: AssistantPlan = {
      id: `plan-voice-speed-${Date.now()}`,
      title: `Set Voice Speed to ${speedLabel}`,
      titleHi: `आवाज की गति ${speedLabel} करें`,
      summary: `I will ${hasSettings ? 'open Settings and ' : ''}set the voice speed to ${speedLabel}. Go ahead?`,
      summaryHi: `मैं ${hasSettings ? 'सेटिंग्स खोलकर ' : ''}आवाज की गति ${speedLabel} सेट करूँगा। क्या आगे बढ़ें?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps,
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // 7. Multi-Step Flow D: Specific Form Creation
  if (
    qLower.includes('internship') ||
    qLower.includes('job') ||
    qLower.includes('caste') ||
    qLower.includes('income') ||
    qLower.includes('leave') ||
    qLower.includes('bonafide') ||
    qLower.includes('birth') ||
    qLower.includes('application form') ||
    qLower.includes('aavedan') ||
    qLower.includes('आवेदन')
  ) {
    const isDownload = qLower.includes('download') || qLower.includes('डाउनलोड');
    if (isDownload) {
      const plan: AssistantPlan = {
        id: `plan-dl-form-${Date.now()}`,
        title: 'Download Form PDF',
        titleHi: 'फॉर्म पीडीएफ डाउनलोड करें',
        summary: 'I will open your forms list and download the PDF document with your confirmation. Go ahead?',
        summaryHi: 'मैं फॉर्म सूची खोलकर आपकी पुष्टि के साथ पीडीएफ डाउनलोड करूँगा। क्या आगे बढ़ें?',
        target: 'app',
        status: 'proposed',
        currentStepIndex: 0,
        collectedAnswers: {},
        createdAt: Date.now(),
        steps: [
          {
            id: 'step-nav-forms',
            action: 'navigate',
            description: 'Navigate to Forms (/forms)',
            descriptionHi: 'फॉर्म्स पेज पर जाएं (/forms)',
            parameters: { page: '/forms' },
            status: 'pending',
          },
          {
            id: 'step-dl-pdf',
            action: 'download',
            description: 'Download Form Document PDF',
            descriptionHi: 'फॉर्म पीडीएफ डाउनलोड करें',
            parameters: { formId: 'internship_application' },
            requiresConfirmation: true,
            status: 'pending',
          },
        ],
      };

      return {
        type: 'plan',
        reply: plan.summary,
        replyHi: plan.summaryHi,
        plan,
        confidence: 0.94,
      };
    }

    let tmplId = 'student_internship';
    let tmplTitle = 'Student Internship Application Form';
    if (qLower.includes('job')) { tmplId = 'job_application'; tmplTitle = 'Employment / Job Application Form'; }
    else if (qLower.includes('caste') || qLower.includes('जाति')) { tmplId = 'certificate_application'; tmplTitle = 'Caste Certificate Request'; }
    else if (qLower.includes('income') || qLower.includes('आय')) { tmplId = 'certificate_application'; tmplTitle = 'Income Certificate Request'; }
    else if (qLower.includes('bonafide')) { tmplId = 'certificate_application'; tmplTitle = 'Bonafide Certificate Request'; }
    else if (qLower.includes('birth')) { tmplId = 'certificate_application'; tmplTitle = 'Birth Certificate Application'; }
    else if (qLower.includes('leave')) { tmplId = 'leave_application'; tmplTitle = 'Official Leave Application'; }

    const plan: AssistantPlan = {
      id: `plan-form-${tmplId}-${Date.now()}`,
      title: `Create ${tmplTitle}`,
      titleHi: `${tmplTitle} तैयार करें`,
      summary: `I will open Forms, select "${tmplTitle}", collect the required details, and generate the document. Go ahead?`,
      summaryHi: `मैं फॉर्म खोलकर "${tmplTitle}" चुनूँगा, विवरण पूछूँगा, और फॉर्म जनरेट करूँगा। क्या आगे बढ़ें?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-nav-new',
          action: 'navigate',
          description: 'Open Form Creation (/forms/new)',
          descriptionHi: 'फॉर्म निर्माण खोलें (/forms/new)',
          parameters: { page: `/forms/new?type=${tmplId}` },
          status: 'pending',
        },
        {
          id: 'step-select-tmpl',
          action: 'select_template',
          description: `Select "${tmplTitle}"`,
          descriptionHi: `"${tmplTitle}" टेम्पलेट चुनें`,
          parameters: { templateId: tmplId, templateTitle: tmplTitle },
          status: 'pending',
        },
        {
          id: 'step-ask-details',
          action: 'ask_user',
          description: 'Ask for Applicant & Institution Details',
          descriptionHi: 'आवेदक व संस्थान का विवरण पूछें',
          parameters: {
            question: 'Please state your college/department and preferred specialization or reason:',
            questionHi: 'कृपया अपने कॉलेज/विभाग और पसंदीदा विषय या कारण बताएं:',
            fieldKey: 'details',
          },
          status: 'pending',
        },
        {
          id: 'step-gen-doc',
          action: 'generate',
          description: 'Generate Document',
          descriptionHi: 'डॉक्यूमेंट जनरेट करें',
          parameters: { kind: 'application_form' },
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.94,
    };
  }

  // 8. General Download PDF
  if (
    qLower.includes('download') ||
    qLower.includes('डाउनलोड') ||
    qLower.includes('pdf download') ||
    qLower.includes('download pdf') ||
    qLower.includes('download as pdf') ||
    qLower.includes('download finalized') ||
    qLower.includes('download application') ||
    qLower.includes('package')
  ) {
    const plan: AssistantPlan = {
      id: `plan-download-${Date.now()}`,
      title: 'Download Form PDF',
      titleHi: 'फॉर्म पीडीएफ डाउनलोड करें',
      summary: 'I will download the current form document as a PDF with your confirmation. Go ahead?',
      summaryHi: 'मैं आपकी पुष्टि के साथ वर्तमान फॉर्म को पीडीएफ में डाउनलोड करूँगा। क्या आगे बढ़ें?',
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-download-pdf',
          action: 'download',
          description: 'Download PDF Document',
          descriptionHi: 'पीडीएफ डॉक्यूमेंट डाउनलोड करें',
          parameters: { formId: 'current' },
          requiresConfirmation: true,
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // 9. Generic Watch Creation
  if (
    qLower.includes('watch lagao') ||
    qLower.includes('create watch') ||
    qLower.includes('setup watch') ||
    qLower.includes('watch setup') ||
    qLower.includes('monitor updates') ||
    qLower.includes('alerts setup') ||
    qLower.includes('alerts track') ||
    qLower.includes('track karo') ||
    qLower.includes('watch banao') ||
    (qLower.includes('watch') && (qLower.includes('mppsc') || qLower.includes('upsc') || qLower.includes('vacancy') || qLower.includes('alert') || qLower.includes('scholarship')))
  ) {
    let targetOrg = 'Government Exam';
    if (qLower.includes('mppsc')) targetOrg = 'MPPSC';
    else if (qLower.includes('upsc')) targetOrg = 'UPSC';
    else if (qLower.includes('scholarship')) targetOrg = 'Scholarship';
    else if (qLower.includes('vacancy')) targetOrg = 'New Vacancy';
    const targetQuery = targetOrg;
    const plan: AssistantPlan = {
      id: `plan-watch-${Date.now()}`,
      title: `Setup Form Watch for "${targetQuery}"`,
      titleHi: `"${targetQuery}" के लिए फॉर्म वॉच सेट करें`,
      summary: `I will open Form Watch, ask which sources to monitor, and create a watch for "${targetQuery}" with your confirmation. Go ahead?`,
      summaryHi: `मैं फॉर्म वॉच खोलूँगा, स्रोत पूछूँगा, और आपकी पुष्टि के बाद "${targetQuery}" के लिए वॉच बनाऊँगा। क्या आगे बढ़ें?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-nav-watch',
          action: 'navigate',
          description: 'Navigate to Form Watch (/form-watch)',
          descriptionHi: 'फॉर्म वॉच पेज पर जाएं (/form-watch)',
          parameters: { page: '/form-watch' },
          status: 'pending',
        },
        {
          id: 'step-ask-sources',
          action: 'ask_user',
          description: 'Ask for Sources & Portals to Monitor',
          descriptionHi: 'मॉनिटर करने के लिए पोर्टल पूछें',
          parameters: {
            question: `Which portals or websites would you like to monitor for "${targetQuery}"?`,
            questionHi: `आप "${targetQuery}" के लिए कौन सी वेबसाइटें मॉनिटर करना चाहते हैं?`,
            fieldKey: 'sources',
          },
          status: 'pending',
        },
        {
          id: 'step-create-watch',
          action: 'create_watch',
          description: `Create Watch for "${targetQuery}"`,
          descriptionHi: `"${targetQuery}" के लिए वॉच बनाएं`,
          parameters: { query: targetQuery },
          requiresConfirmation: true,
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.93,
    };
  }

  // 10. Explain Page & Read Aloud
  if (
    qLower.includes('kya karna hai') ||
    qLower.includes('explain') ||
    qLower.includes('samjhao') ||
    qLower.includes('what is happening') ||
    qLower.includes('page guide') ||
    qLower.includes('guide me')
  ) {
    const isHi = qLower.includes('hindi') || qLower.includes('हिन्दी') || currentLanguage === 'hi';
    const plan: AssistantPlan = {
      id: `plan-explain-${Date.now()}`,
      title: isHi ? 'पेज को हिन्दी में समझें' : 'Explain Current Page',
      titleHi: 'पेज को हिन्दी में समझें',
      summary: isHi ? 'मैं इस पेज का उद्देश्य, आवश्यक कदम और चेकलिस्ट समझा रहा हूँ।' : 'I will explain the page purpose, required steps, and checklist.',
      summaryHi: 'मैं इस पेज का उद्देश्य, आवश्यक कदम और चेकलिस्ट समझा रहा हूँ।',
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-explain',
          action: 'explain_page',
          description: 'Explain Page Checklist & Steps',
          descriptionHi: 'पेज चेकलिस्ट व कदम समझाएं',
          parameters: { language: isHi ? 'hi' : 'en' },
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // 11. Navigation matching using synonyms
  const resolvedPage = resolvePageRoute(q);
  if (resolvedPage) {
    const plan: AssistantPlan = {
      id: `plan-nav-${Date.now()}`,
      title: `Navigate to ${resolvedPage.name}`,
      titleHi: `${resolvedPage.nameHi} पर जाएं`,
      summary: `Navigating to ${resolvedPage.name} (${resolvedPage.path}).`,
      summaryHi: `${resolvedPage.nameHi} (${resolvedPage.path}) पर ले जा रहा हूँ।`,
      target: 'app',
      status: 'running',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-nav',
          action: 'navigate',
          description: `Navigate to ${resolvedPage.name}`,
          descriptionHi: `${resolvedPage.nameHi} पर जाएं`,
          parameters: { page: resolvedPage.path },
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // 12. Informational fallback answer
  const answerEn = `I am your TechForm Buddy assistant. You can ask me to create a form or resume, navigate pages, setup a watch, change language, or explain this page.`;
  const answerHi = `मैं आपका TechForm Buddy असिस्टेंट हूँ। आप मुझसे नया फॉर्म या रेज़्यूमे बनाने, पेज बदलने, वॉच लगाने या पेज समझाने के लिए कह सकते हैं।`;

  return {
    type: 'answer',
    reply: currentLanguage === 'hi' ? answerHi : answerEn,
    replyHi: answerHi,
    confidence: 0.8,
  };
}


// ─────────────────────────────────────────────────────────────
// Browser Agent Multi-Step Task Planner
// ─────────────────────────────────────────────────────────────
export function planBrowserTask(
  rawQuery: string,
  pageContextOrLang?: { url?: string; title?: string; activeTask?: string; headings?: string[]; formFieldsCount?: number; buttonsCount?: number; hasFillValues?: boolean } | string,
  currentLanguageOrContext: any = 'en',
  profile?: any
): PlannerResult {
  let pageContext: any = {};
  let currentLanguage = 'en';

  if (typeof pageContextOrLang === 'string') {
    currentLanguage = pageContextOrLang;
    if (typeof currentLanguageOrContext === 'object') {
      pageContext = currentLanguageOrContext || {};
    }
  } else if (typeof pageContextOrLang === 'object') {
    pageContext = pageContextOrLang || {};
    currentLanguage = typeof currentLanguageOrContext === 'string' ? currentLanguageOrContext : 'en';
  }

  const q = rawQuery.trim();
  const qLower = q.toLowerCase();

  // 1. Hard safety limits check
  const safety = checkSafetyLimits(q);
  if (safety) {
    return {
      type: 'refusal',
      reply: safety.reason,
      replyHi: safety.reasonHi,
      confidence: 1.0,
      safetyRefusal: true,
    };
  }

  // 2. Ambiguity & Clarification Detection
  const shortVagueWords = ['kuch karo', 'open', 'chalo', 'karo', 'help', 'help me', 'madad karo', 'shuru karo', 'portal', 'search'];
  if (shortVagueWords.includes(qLower) || (q.length < 5 && !['forms', 'watch', 'home', 'pan', 'dl'].includes(qLower))) {
    return {
      type: 'clarification',
      reply: 'What would you like me to do? I can search official portals, download application forms, inspect this page, or help you autofill.',
      replyHi: 'आप क्या करना चाहते हैं? मैं आधिकारिक पोर्टल खोज सकता हूँ, फॉर्म डाउनलोड कर सकता हूँ, या भरने में मदद कर सकता हूँ।',
      confidence: 0.45,
      clarifyingQuestion: {
        question: 'What would you like me to do?',
        questionHi: 'आप क्या करना चाहते हैं?',
        options: [
          'Find scholarship portal and download form',
          'Autofill this form with my profile details',
          'Search government service portal',
          'Explain what is on this page',
        ],
        optionsHi: [
          'स्कॉलरशिप पोर्टल खोजें और फॉर्म डाउनलोड करें',
          'मेरी प्रोफ़ाइल से यह फॉर्म भरें',
          'सरकारी सेवा पोर्टल खोजें',
          'इस पेज की जानकारी समझाएं',
        ],
      },
    };
  }

  // Detect domain/service keyword across all 11 supported languages + Hinglish
  let detectedService = '';
  let defaultPortalUrl = '';
  const scholarshipKeywords = [
    'scholarship', 'छात्रवृत्ति', 'chhatravritti',
    'உதவித்தொகை', // Tamil
    'స్కాలర్‌షిప్', 'విద్యార్థివేతనం', // Telugu
    'বৃত্তি', 'স্কলারশিপ', // Bengali
    'शिष्यवृत्ती', // Marathi
    'સ્કોલરશીપ', 'શિષ્યવૃત્તિ', // Gujarati
    'ವಿದ್ಯಾರ್ಥಿವೇತನ', 'ಸ್ಕಾಲರ್‌ಶಿಪ್', // Kannada
    'സ്കോളർഷിപ്പ്', 'സ്കോളർഷിപ്', 'സ്കോളർ', // Malayalam
    'ਵਜ਼ੀਫ਼ਾ', 'ਵਜ਼ੀਫ਼ੇ', 'ਸਕਾਲਰਸ਼ਿਪ', // Punjabi
    'وظیفہ', 'اسکالرشپ', // Urdu
  ];

  if (scholarshipKeywords.some(k => qLower.includes(k))) {
    detectedService = 'National Scholarship Portal';
    defaultPortalUrl = 'https://scholarships.gov.in';
  } else if (qLower.includes('passport') || qLower.includes('पासपोर्ट')) {
    detectedService = 'Passport Seva Online Portal';
    defaultPortalUrl = 'https://www.passportindia.gov.in';
  } else if (qLower.includes('driving') || qLower.includes('licence') || qLower.includes('license') || qLower.includes('parivahan') || qLower.includes('ड्राइविंग')) {
    detectedService = 'Parivahan Sewa';
    defaultPortalUrl = 'https://parivahan.gov.in';
  } else if (qLower.includes('pan') || qLower.includes('पैन')) {
    detectedService = 'Income Tax e-Filing Portal';
    defaultPortalUrl = 'https://www.incometax.gov.in';
  } else if (qLower.includes('voter') || qLower.includes('मतदाता') || qLower.includes('election')) {
    detectedService = 'National Voters Service Portal';
    defaultPortalUrl = 'https://voters.eci.gov.in';
  } else if (qLower.includes('kisan') || qLower.includes('किसान')) {
    detectedService = 'PM Kisan Samman Nidhi';
    defaultPortalUrl = 'https://pmkisan.gov.in';
  }

  const searchKeywords = [
    'search', 'find', 'dhoondo', 'khojo', 'dhundo', 'ढूंढो', 'खोजो',
    'தேடு', 'వెతకండి', 'অনুসন্ধান', 'शोधा', 'શોધો', 'ಹುಡುಕಿ', 'തിരയുക', 'ਖੋਜ', 'تلاش',
  ];
  const hasSearchIntent = searchKeywords.some(k => qLower.includes(k));

  const openKeywords = [
    'open', 'kholo', 'chalo', 'launch', 'खोलो', 'जाओ', 'jao', 'apply', 'आवेदन',
    'விண்ணப்பிக்க', 'దరఖాస్తు', 'আবেদন', 'अर्ज', 'અરજી', 'ಅರ್ಜಿ', 'അപേക്ഷ', 'ਅਰਜ਼ੀ', 'درخواست',
  ];
  const hasOpenIntent = openKeywords.some(k => qLower.includes(k)) || (Boolean(detectedService) && (qLower.includes('portal') || qLower.includes('scheme') || qLower.includes('योजना') || qLower.includes('திட்டம்') || qLower.includes('పథకం') || qLower.includes('পরিকল্পনা')));

  const downloadKeywords = [
    'download', 'डाउनलोड', 'guidelines', 'circular', 'form download', 'format',
    'பதிவிறக்க', 'డౌన్‌లోడ్', 'ডাউনলোড', 'मार्गदर्शक', 'ડાઉનલોડ', 'ಡೌನ್‌ಲೋಡ್', 'ഡൗൺലോഡ്', 'ਡਾਊਨਲੋਡ', 'ڈاؤنلوڈ',
  ];
  const hasDownloadIntent = downloadKeywords.some(k => qLower.includes(k));

  const fillKeywords = [
    'fill', 'bhar', 'bhariye', 'autofill', 'भर दो', 'भरें', 'apply', 'आवेदन', 'फॉर्म',
    'படிவம்', 'நிரப்ப', 'ఫారమ్', 'నింపండి', 'ফর্ম', 'পূরণ', 'भरणे', 'ભરવું', 'ತುಂಬಲು', 'പൂരിപ്പിക്കുക', 'ਭਰਨਾ', 'پر کرنا',
  ];
  const hasFillIntent = fillKeywords.some(k => qLower.includes(k));

  // Multi-Step Scenario A: Full Lifecycle (Search/Find -> Navigate -> Download -> Fill)
  // E.g. "Find the scholarship portal, open it, download the application form and help me fill it."
  if ((hasSearchIntent || hasOpenIntent) && (hasDownloadIntent || hasFillIntent)) {
    const serviceName = detectedService || 'Official Citizen Portal';
    const portalUrl = defaultPortalUrl || 'https://scholarships.gov.in';

    const steps: PlanStep[] = [
      {
        id: 'step-search-portal',
        action: 'search_portal',
        description: `Search official portal directory for "${serviceName}"`,
        descriptionHi: `"${serviceName}" के लिए आधिकारिक पोर्टल खोजें`,
        parameters: { query: serviceName, domain: 'government' },
        expectedResult: `Official URL for ${serviceName} identified`,
        expectedResultHi: `${serviceName} का आधिकारिक URL मिला`,
        verifyCondition: 'portal_found',
        status: 'pending',
      },
      {
        id: 'step-navigate-portal',
        action: 'navigate',
        description: `Navigate browser tab to ${serviceName} (${portalUrl})`,
        descriptionHi: `ब्राउज़र को ${serviceName} (${portalUrl}) पर ले जाएं`,
        parameters: { url: portalUrl, reason: `Open ${serviceName}` },
        expectedResult: `${serviceName} official portal page loaded and ready`,
        expectedResultHi: `${serviceName} आधिकारिक पोर्टल खुल गया`,
        verifyCondition: 'dom_ready',
        status: 'pending',
      },
    ];

    if (hasDownloadIntent) {
      steps.push({
        id: 'step-download-guidelines',
        action: 'download_document',
        description: `Download official application form / guidelines for ${serviceName}`,
        descriptionHi: `${serviceName} के लिए आधिकारिक फॉर्म / दिशानिर्देश डाउनलोड करें`,
        parameters: { filename: `${serviceName.replace(/\s+/g, '_')}_Guidelines.pdf`, docType: 'guidelines' },
        expectedResult: 'Official document download initiated and verified',
        expectedResultHi: 'आधिकारिक दस्तावेज़ डाउनलोड शुरू हुआ',
        verifyCondition: 'download_started',
        status: 'pending',
      });
    }

    if (hasFillIntent) {
      steps.push({
        id: 'step-detect-fields',
        action: 'detect_forms',
        description: 'Scan and semantically classify all form fields on the portal',
        descriptionHi: 'पोर्टल पर सभी फॉर्म फ़ील्ड्स को पहचानें और वर्गीकृत करें',
        parameters: { forceRescan: true },
        expectedResult: 'Form fields detected and verified',
        expectedResultHi: 'फॉर्म फ़ील्ड्स सत्यापित हुए',
        verifyCondition: 'fields_classified',
        status: 'pending',
      });
      steps.push({
        id: 'step-autofill-fields',
        action: 'fill_fields',
        description: 'Autofill verified profile demographic values into matching fields',
        descriptionHi: 'सत्यापित प्रोफ़ाइल विवरण मेल खाने वाले फ़ील्ड्स में सुरक्षित भरें',
        parameters: { autofillAll: true },
        expectedResult: 'High-confidence profile fields filled and highlighted',
        expectedResultHi: 'प्रोफ़ाइल फ़ील्ड्स सफलतापूर्वक भरे गए',
        verifyCondition: 'inputs_verified',
        status: 'pending',
      });
      steps.push({
        id: 'step-approval-review',
        action: 'request_approval',
        description: 'Review entered data and prepare for manual submission',
        descriptionHi: 'भरे गए डेटा की जांच करें और स्वयं सबमिट करने के लिए समीक्षा करें',
        parameters: { actionDescription: 'Review all filled fields before submitting manually', targetAction: 'user_review' },
        expectedResult: 'User reviewed and confirmed all entered data',
        expectedResultHi: 'उपयोगकर्ता ने भरे हुए डेटा की समीक्षा कर ली',
        verifyCondition: 'approval_decided',
        status: 'pending',
      });
    }

    const plan: AssistantPlan = {
      id: `plan-browser-${Date.now()}`,
      title: `Assistance Plan for ${serviceName}`,
      titleHi: `${serviceName} के लिए सहायता योजना`,
      summary: `I will find ${serviceName}, open the portal${hasDownloadIntent ? ', download the guidelines,' : ''}${hasFillIntent ? ' and assist with form filling' : ''}.`,
      summaryHi: `मैं ${serviceName} खोजूंगा, पोर्टल खोलूंगा${hasDownloadIntent ? ', दिशानिर्देश डाउनलोड करूंगा' : ''}${hasFillIntent ? ' और फॉर्म भरने में सहायता करूंगा' : ''}।`,
      target: 'portal',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps,
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.95,
    };
  }

  // Multi-Step Scenario B: Search and Open Portal
  if (hasSearchIntent || (detectedService && hasOpenIntent)) {
    const serviceName = detectedService || rawQuery.replace(/search|find|portal|kholo|dhoondo|jao|chalo/gi, '').trim() || 'Government Portal';
    const portalUrl = defaultPortalUrl || 'https://www.incometax.gov.in';

    const plan: AssistantPlan = {
      id: `plan-search-nav-${Date.now()}`,
      title: `Search & Open ${serviceName}`,
      titleHi: `${serviceName} खोजें और खोलें`,
      summary: `I will search for the verified official portal of ${serviceName} and navigate to it.`,
      summaryHi: `मैं ${serviceName} का आधिकारिक पोर्टल खोजकर उस पर ले चलूँगा।`,
      target: 'portal',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-search',
          action: 'search_portal',
          description: `Search for official ${serviceName} URL`,
          descriptionHi: `${serviceName} का आधिकारिक लिंक खोजें`,
          parameters: { query: serviceName },
          expectedResult: `Verified portal URL for ${serviceName} found`,
          expectedResultHi: `${serviceName} का सत्यापित लिंक मिला`,
          verifyCondition: 'portal_found',
          status: 'pending',
        },
        {
          id: 'step-nav',
          action: 'navigate',
          description: `Navigate to ${serviceName} (${portalUrl})`,
          descriptionHi: `${serviceName} (${portalUrl}) पर जाएं`,
          parameters: { url: portalUrl },
          expectedResult: 'Portal loaded successfully',
          expectedResultHi: 'पोर्टल सफलतापूर्वक लोड हुआ',
          verifyCondition: 'dom_ready',
          status: 'pending',
        },
        {
          id: 'step-inspect',
          action: 'inspect_page',
          description: 'Inspect portal structure and active options',
          descriptionHi: 'पोर्टल संरचना और विकल्पों का निरीक्षण करें',
          parameters: { scope: 'all' },
          expectedResult: 'Page inspection snapshot captured',
          expectedResultHi: 'पेज का स्नैपशॉट मिला',
          verifyCondition: 'snapshot_captured',
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.92,
    };
  }

  // Multi-Step Scenario C: Form Filling on Active Page
  if (hasFillIntent) {
    const plan: AssistantPlan = {
      id: `plan-fill-${Date.now()}`,
      title: 'Scan & Autofill Form Fields',
      titleHi: 'फॉर्म फ़ील्ड्स स्कैन और ऑटो-फिल करें',
      summary: 'I will scan the form on this page, map your verified profile details, and fill eligible fields safely.',
      summaryHi: 'मैं इस पेज के फॉर्म को स्कैन करके आपकी प्रोफ़ाइल से सुरक्षित रूप से फ़ील्ड्स भरूँगा।',
      target: 'portal',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-scan',
          action: 'detect_forms',
          description: 'Scan and categorize all form fields on this page',
          descriptionHi: 'इस पेज के सभी फॉर्म फ़ील्ड्स को पहचानें और वर्गीकृत करें',
          parameters: { forceRescan: true },
          expectedResult: 'Form fields categorized with semantic taxonomy',
          expectedResultHi: 'फॉर्म फ़ील्ड्स वर्गीकृत किए गए',
          verifyCondition: 'fields_classified',
          status: 'pending',
        },
        {
          id: 'step-fill',
          action: 'fill_fields',
          description: 'Fill eligible fields with verified profile values (excluding passwords & sensitive IDs)',
          descriptionHi: 'सत्यापित प्रोफ़ाइल मान भरें (पासवर्ड और संवेदनशील आईडी छोड़कर)',
          parameters: { autofillAll: true },
          expectedResult: 'High-confidence form fields populated and visually highlighted',
          expectedResultHi: 'उच्च-सटीकता फ़ील्ड्स भरे गए और हाइलाइट किए गए',
          verifyCondition: 'inputs_verified',
          status: 'pending',
        },
        {
          id: 'step-review',
          action: 'request_approval',
          description: 'Review entered values and submit manually',
          descriptionHi: 'भरे गए विवरण की समीक्षा करें और स्वयं सबमिट करें',
          parameters: { actionDescription: 'Review all fields before manual submission', targetAction: 'user_review' },
          expectedResult: 'User manual review completed',
          expectedResultHi: 'उपयोगकर्ता द्वारा समीक्षा पूर्ण',
          verifyCondition: 'approval_decided',
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.94,
    };
  }

  // Multi-Step Scenario D: Download Document
  if (hasDownloadIntent) {
    const plan: AssistantPlan = {
      id: `plan-download-${Date.now()}`,
      title: 'Find & Download Document',
      titleHi: 'दस्तावेज़ खोजें और डाउनलोड करें',
      summary: 'I will scan the page for official download links and download the requested document.',
      summaryHi: 'मैं इस पेज पर आधिकारिक डाउनलोड लिंक ढूंढकर दस्तावेज़ डाउनलोड करूँगा।',
      target: 'portal',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps: [
        {
          id: 'step-inspect-downloads',
          action: 'inspect_page',
          description: 'Inspect page for downloadable PDF and document links',
          descriptionHi: 'डाउनलोड करने योग्य पीडीएफ और लिंक के लिए पेज का निरीक्षण करें',
          parameters: { scope: 'downloads' },
          expectedResult: 'Download links identified',
          expectedResultHi: 'डाउनलोड लिंक की पहचान की गई',
          verifyCondition: 'snapshot_captured',
          status: 'pending',
        },
        {
          id: 'step-download',
          action: 'download_document',
          description: 'Initiate download for requested document',
          descriptionHi: 'अनुरोधित दस्तावेज़ का डाउनलोड शुरू करें',
          parameters: { filename: 'Official_Document.pdf' },
          expectedResult: 'Download started via browser downloads engine',
          expectedResultHi: 'ब्राउज़र द्वारा डाउनलोड शुरू हुआ',
          verifyCondition: 'download_started',
          status: 'pending',
        },
      ],
    };

    return {
      type: 'plan',
      reply: plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: 0.91,
    };
  }

  // If none of the multi-step browser patterns match, delegate to standard planner or Q&A
  return planUserUtterance(rawQuery, pageContext?.url || '/', currentLanguage);
}
