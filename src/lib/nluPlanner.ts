/**
 * Real NLU Planner for TechForm Buddy
 *
 * Implements LLM-based Natural Language Understanding (NLU) using Gemini (gemini-3.8-flash)
 * with robust rule-based fallback when offline or unavailable.
 *
 * Capabilities:
 * - Intent classification: navigate | fill_form | build_document | ask_faq | track_status | register_grievance | configure_settings | clarify | other | refusal
 * - Document type resolution: resume | leave_letter | internship_application | scholarship_application | complaint_letter | bonafide_certificate | noc | other
 * - Structured slot extraction: role, skills, education, purpose, recipient, startDate, endDate, durationDays, annualIncome, department, reference_no, etc.
 * - Missing required slot detection (asks user for missing details one at a time)
 * - Low confidence / ambiguity detection (asks clarifying question with 2-3 quick picks)
 * - Noisy speech tolerance (typos, conversational fillers, Hinglish, half sentences)
 * - Graceful fallback with clear flag: plannerSource: 'llm' | 'rule_fallback'
 */

import { AssistantPlan, PlanStep, ClarifyingQuestion, checkSafetyLimits, resolvePageRoute } from './planner';

export type NLUIntent =
  | 'navigate'
  | 'fill_form'
  | 'build_document'
  | 'ask_faq'
  | 'track_status'
  | 'register_grievance'
  | 'configure_settings'
  | 'explain_page'
  | 'clarify'
  | 'other'
  | 'refusal';

export type NLUDocumentType =
  | 'resume'
  | 'leave_letter'
  | 'internship_application'
  | 'scholarship_application'
  | 'complaint_letter'
  | 'bonafide_certificate'
  | 'certificate_application'
  | 'noc'
  | 'other';

export interface NLUSlots {
  role?: string | null;
  skills?: string[] | null;
  education?: string | null;
  purpose?: string | null;
  reason?: string | null;
  recipient?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  from_date?: string | null;
  to_date?: string | null;
  durationDays?: number | null;
  annualIncome?: string | null;
  category?: string | null;
  department?: string | null;
  issue?: string | null;
  reference_no?: string | null;
  targetPage?: string | null;
  applicantName?: string | null;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  extraNotes?: string | null;
  [key: string]: any;
}

export interface NLUUnderstanding {
  intent: NLUIntent;
  documentType?: NLUDocumentType | null;
  slots: NLUSlots;
  missingRequiredSlots: string[];
  confidence: number;
  explanation: string;
  explanationHi?: string;
  quickPicks?: string[];
  quickPicksHi?: string[];
  plannerSource: 'llm' | 'rule_fallback';
  fallbackNotice?: string | null;
  rawQuery: string;
}

export interface NLUPlannerResult {
  type: 'plan' | 'clarification' | 'answer' | 'refusal';
  reply: string;
  replyHi?: string;
  plan?: AssistantPlan;
  clarifyingQuestion?: ClarifyingQuestion;
  confidence: number;
  safetyRefusal?: boolean;
  nluTrace: NLUUnderstanding;
}

export const REQUIRED_SLOTS_PER_TYPE: Record<string, string[]> = {
  resume: ['role', 'education', 'skills'],
  leave_letter: ['purpose', 'startDate', 'recipient'],
  internship_application: ['role', 'education', 'durationDays'],
  scholarship_application: ['education', 'annualIncome'],
  complaint_letter: ['recipient', 'purpose'],
  bonafide_certificate: ['education', 'purpose'],
  noc: ['purpose', 'recipient'],
  register_grievance: ['department', 'issue'],
  track_status: ['reference_no'],
};

const SYSTEM_PROMPT = `You are the Natural Language Understanding (NLU) Engine for TechForm Buddy, an AI assistant for Indian citizens and students.
Analyze the user utterance. Note: speech may be informal, noisy, contain typos (e.g., "rsme", "intrenship"), conversational fillers ("umm", "bhai ek kaam kar", "please sun"), half-sentences, or Hinglish ("ek resume bana de software engineer ke liye jisme python aur sql aati ho").

INTENT TYPES (choose exactly one):
1. "build_document": User wants to create/draft/write a document, CV, resume, leave letter, application, or certificate.
2. "navigate": User wants to go to or open a page (e.g. dashboard, forms, settings, watch, documents).
3. "fill_form": User wants to autofill or fill fields on the current form.
4. "ask_faq": Informational question about schemes, exams, eligibility, fees, deadlines, or rules.
5. "track_status": User wants to check the status of a previously filed application, grievance, or reference ID.
6. "register_grievance": User wants to file an official complaint or grievance against an authority or department.
7. "configure_settings": User wants to change language, voice settings, or preferences.
8. "clarify": The utterance is too short, ambiguous, or lacks context (e.g. "help", "kuch karo", "open").
9. "other": General conversational greeting or out-of-scope query.

DOCUMENT TYPES (if intent is "build_document", otherwise null):
- "resume": Professional CV / resume / biodata.
- "leave_letter": Leave / chhutti / holiday letter to manager, HR, or principal.
- "internship_application": Student internship application.
- "scholarship_application": Student scholarship / chhatravritti application.
- "complaint_letter": Formal complaint or petition letter.
- "bonafide_certificate": Bonafide certificate request for college/school.
- "noc": No Objection Certificate request.
- "other": Custom or unknown document kind.

REQUIRED SLOTS:
- resume: "role", "education", "skills" (array of strings)
- leave_letter: "purpose" (reason for leave), "startDate", "recipient" (e.g. Principal, Manager, HR)
- internship_application: "role", "education", "durationDays"
- scholarship_application: "education", "annualIncome"
- complaint_letter: "recipient", "purpose"
- register_grievance: "department", "issue"
- track_status: "reference_no"

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "intent": "build_document" | "navigate" | "fill_form" | "ask_faq" | "track_status" | "register_grievance" | "configure_settings" | "clarify" | "other",
  "documentType": string | null,
  "slots": {
    "role": string | null,
    "skills": string[] | null,
    "education": string | null,
    "purpose": string | null,
    "recipient": string | null,
    "startDate": string | null,
    "endDate": string | null,
    "durationDays": number | null,
    "annualIncome": string | null,
    "category": string | null,
    "department": string | null,
    "issue": string | null,
    "reference_no": string | null,
    "targetPage": string | null
  },
  "confidence": number, // 0.0 to 1.0
  "summary": string, // 1 concise sentence in English
  "summaryHi": string, // 1 concise sentence in Hindi
  "quickPicks": string[] // 2-3 quick suggestion options if clarification or choice is helpful
}`;

/**
 * Enhanced Rule-Based NLU Fallback
 */
export function extractSlotsRuleBased(rawQuery: string): {
  intent: NLUIntent;
  documentType: NLUDocumentType | null;
  slots: NLUSlots;
  confidence: number;
} {
  const q = rawQuery.toLowerCase().trim();
  const slots: NLUSlots = {};
  let intent: NLUIntent = 'other';
  let documentType: NLUDocumentType | null = null;
  let confidence = 0.7;

  // Download intent
  if (q.includes('download') || q.includes('save as pdf') || q.includes('package')) {
    return {
      intent: 'fill_form',
      documentType: null,
      slots: { action: 'download' },
      confidence: 0.95,
    };
  }

  // Guide intent
  if (q.includes('kya karna hai') || q.includes('explain') || q.includes('page guide') || q.includes('samjhao')) {
    return {
      intent: 'explain_page',
      documentType: null,
      slots: {},
      confidence: 0.92,
    };
  }

  // Watch intent
  if (q.includes('watch') || q.includes('alert')) {
    let queryTarget = 'scholarship';
    if (q.includes('mppsc')) queryTarget = 'MPPSC';
    else if (q.includes('upsc')) queryTarget = 'UPSC';
    else if (q.includes('vacancy')) queryTarget = 'vacancy';

    return {
      intent: 'other',
      documentType: null,
      slots: { watchQuery: queryTarget },
      confidence: 0.92,
    };
  }

  // 1. Navigation
  if (q.includes('naya form') || q.includes('new form') || q.includes('form banana')) {
    return {
      intent: 'navigate',
      documentType: null,
      slots: { targetPage: '/forms/new' },
      confidence: 0.92,
    };
  }

  const resolvedRoute = resolvePageRoute(rawQuery);
  if (resolvedRoute && (q.includes('jao') || q.includes('kholo') || q.includes('go to') || q.includes('open') || q.includes('dikhao') || q.includes('navigate') || q === resolvedRoute.name.toLowerCase() || ['settings', 'forms', 'dashboard'].includes(q))) {
    return {
      intent: 'navigate',
      documentType: null,
      slots: { targetPage: resolvedRoute.path },
      confidence: 0.9,
    };
  }

  // 2. Document Building & Types
  const hasResume = /\b(resume|rsme|cv|biodata|bio-data|बायोडाटा|curriculum vitae)\b/i.test(q);
  const hasLeave = /\b(leave|chhutti|छुट्टी|avkaash|अवकाश|sick leave|casual leave)\b/i.test(q);
  const hasInternship = /\b(internship|intrenship|intern|इंटर्नशिप|प्रशिक्षु)\b/i.test(q);
  const hasScholarship = /\b(scholarship|scholership|छात्रवृत्ति|chhatravritti|stipend)\b/i.test(q);
  const hasCertificate = /\b(caste|income|birth|domicile|bonafide|praman patra|प्रमाण पत्र|certificate)\b/i.test(q);
  const hasComplaint = /\b(complaint|shikayat|शिकायत|grievance|complain)\b/i.test(q);
  const hasNoc = /\b(noc|no objection|एनओसी)\b/i.test(q);

  if (hasResume) {
    intent = 'build_document';
    documentType = 'resume';
    confidence = 0.92;
  } else if (hasLeave) {
    intent = 'build_document';
    documentType = 'leave_letter';
    confidence = 0.92;
  } else if (hasInternship) {
    intent = 'build_document';
    documentType = 'internship_application';
    confidence = 0.92;
  } else if (hasScholarship) {
    intent = 'build_document';
    documentType = 'scholarship_application';
    confidence = 0.92;
  } else if (hasCertificate) {
    intent = 'build_document';
    documentType = 'certificate_application';
    confidence = 0.92;
  } else if (hasComplaint) {
    intent = q.includes('file') || q.includes('portal') ? 'register_grievance' : 'build_document';
    documentType = 'complaint_letter';
    confidence = 0.88;
  } else if (hasNoc) {
    intent = 'build_document';
    documentType = 'noc';
    confidence = 0.9;
  } else if (q.includes('track') || q.includes('status') || q.includes('check status') || q.includes('kahan pahuncha')) {
    intent = 'track_status';
    confidence = 0.88;
  } else if (q.includes('grievance') || q.includes('shikayat darj')) {
    intent = 'register_grievance';
    confidence = 0.88;
  } else if (q.includes('autofill') || q.includes('fill form') || q.includes('bharo') || q.includes('fill field')) {
    intent = 'fill_form';
    confidence = 0.85;
  } else if (q.includes('language') || q.includes('bhasha') || q.includes('tamil') || q.includes('telugu') || q.includes('bengali') || q.includes('marathi') || q.includes('voice') || q.includes('speed') || q.includes('settings')) {
    intent = 'configure_settings';
    confidence = 0.88;
  } else if (q.includes('what is') || q.includes('kab tak') || q.includes('fee') || q.includes('eligibility') || q.includes('kya hai')) {
    intent = 'ask_faq';
    confidence = 0.8;
  }

  // 3. Extract Skills
  const commonSkills = [
    'python', 'sql', 'javascript', 'typescript', 'react', 'next.js', 'node', 'java',
    'c++', 'html', 'css', 'excel', 'machine learning', 'data analysis', 'accounting',
    'photoshop', 'django', 'fastapi', 'docker', 'git', 'tailwind'
  ];
  const matchedSkills: string[] = [];
  for (const s of commonSkills) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i').test(q)) {
      matchedSkills.push(s.charAt(0).toUpperCase() + s.slice(1));
    }
  }
  if (matchedSkills.length > 0) {
    slots.skills = matchedSkills;
  }

  // 4. Extract Role
  const roles = [
    'data analyst', 'software engineer', 'software developer', 'frontend developer',
    'backend developer', 'full stack developer', 'web developer', 'python developer',
    'graphic designer', 'content writer', 'accountant', 'intern'
  ];
  for (const r of roles) {
    if (q.includes(r)) {
      slots.role = r.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // 5. Extract Duration
  const daysMatch = q.match(/(\d+|ek|do|teen|chaar|panch|two|three|four|five)\s*(din|days?)/i);
  if (daysMatch) {
    const numWord = daysMatch[1].toLowerCase();
    const map: Record<string, number> = {
      ek: 1, do: 2, teen: 3, chaar: 4, panch: 5,
      one: 1, two: 2, three: 3, four: 4, five: 5,
    };
    slots.durationDays = map[numWord] || parseInt(numWord, 10) || 2;
  }

  // 6. Extract Start Date
  if (q.includes('kal se') || q.includes('tomorrow')) {
    slots.startDate = 'Tomorrow';
  } else if (q.includes('today') || q.includes('aaj se')) {
    slots.startDate = 'Today';
  }

  // 7. Extract Recipient
  const recipients = ['principal', 'manager', 'hr', 'director', 'hod', 'dean', 'officer', 'commissioner'];
  for (const rec of recipients) {
    if (q.includes(rec)) {
      slots.recipient = rec.charAt(0).toUpperCase() + rec.slice(1);
      break;
    }
  }

  // 8. Extract Purpose / Reason
  if (q.includes('bimar') || q.includes('fever') || q.includes('ill') || q.includes('tabiyat')) {
    slots.purpose = 'Medical Leave (Fever / Illness)';
  } else if (q.includes('urgent') || q.includes('zaroori') || q.includes('family')) {
    slots.purpose = 'Urgent personal / family work';
  }

  // 9. Extract Education
  const eduKeywords = ['b.tech', 'btech', 'bca', 'mca', 'bsc', 'b.sc', 'b.com', 'bcom', 'ba', '12th', '10th', 'diploma'];
  for (const edu of eduKeywords) {
    if (q.includes(edu)) {
      slots.education = edu.toUpperCase();
      break;
    }
  }

  // 10. Extract Reference Number
  const refMatch = q.match(/(?:ref|application|id|number|no\.?)\s*(?:is|:|-)?\s*([A-Z0-9-]{6,16})/i);
  if (refMatch) {
    slots.reference_no = refMatch[1].toUpperCase();
  }

  return { intent, documentType, slots, confidence };
}

/**
 * Builds NLU Understanding from Rule-Based Fallback
 */
export function buildRuleBasedUnderstanding(
  rawQuery: string,
  fallbackReason: string,
  savedProfile?: Record<string, any>
): NLUUnderstanding {
  const qLower = rawQuery.toLowerCase().trim();

  // Ambiguity / short query check
  if (qLower.length < 5 || ['help', 'help me', 'kuch karo', 'madad', 'open', 'bhai'].includes(qLower)) {
    return {
      intent: 'clarify',
      documentType: null,
      slots: {},
      missingRequiredSlots: [],
      confidence: 0.4,
      explanation: 'Please let me know what you would like to do. You can create a resume, apply for leave, or fill a form.',
      explanationHi: 'कृपया बताएं कि आप क्या करना चाहते हैं। आप रेज़्यूमे बना सकते हैं, अवकाश आवेदन कर सकते हैं, या फॉर्म भर सकते हैं।',
      quickPicks: ['Create Resume', 'Leave Application', 'Check Application Status'],
      quickPicksHi: ['रेज़्यूमे बनाएं', 'छुट्टी का आवेदन', 'आवेदन स्थिति देखें'],
      plannerSource: 'rule_fallback',
      fallbackNotice: `Notice: ${fallbackReason} — using rule-based fallback.`,
      rawQuery,
    };
  }

  // Navigation check
  const resolvedRoute = resolvePageRoute(rawQuery);
  if (
    resolvedRoute &&
    !qLower.includes('language') &&
    !qLower.includes('bhasha') &&
    !qLower.includes('voice') &&
    !qLower.includes('speed') &&
    (qLower.includes('jao') || qLower.includes('kholo') || qLower.includes('go to') || qLower.includes('open') || qLower.includes('dikhao') || ['settings', 'forms', 'dashboard', 'mere forms'].includes(qLower))
  ) {
    return {
      intent: 'navigate',
      documentType: null,
      slots: { targetPage: resolvedRoute.path },
      missingRequiredSlots: [],
      confidence: 0.88,
      explanation: `Navigating to ${resolvedRoute.name} (${resolvedRoute.path}).`,
      explanationHi: `${resolvedRoute.nameHi} (${resolvedRoute.path}) पर ले जा रहा हूँ।`,
      plannerSource: 'rule_fallback',
      fallbackNotice: `Notice: ${fallbackReason} — using rule-based fallback.`,
      rawQuery,
    };
  }

  const { intent, documentType, slots, confidence } = extractSlotsRuleBased(rawQuery);

  // Merge profile details if present
  if (savedProfile) {
    if (!slots.applicantName && (savedProfile.fullName || savedProfile.name)) slots.applicantName = savedProfile.fullName || savedProfile.name;
    if (!slots.contact && (savedProfile.phone || savedProfile.mobile)) slots.contact = savedProfile.phone || savedProfile.mobile;
    if (!slots.education && savedProfile.education) slots.education = savedProfile.education;
    if (!slots.city && (savedProfile.city || savedProfile.address)) slots.city = savedProfile.city || savedProfile.address;
  }

  // Determine missing required slots
  const required = documentType ? REQUIRED_SLOTS_PER_TYPE[documentType] || [] : (intent === 'track_status' ? ['reference_no'] : []);
  const missing = required.filter((reqKey) => {
    const val = slots[reqKey];
    if (!val) return true;
    if (Array.isArray(val) && val.length === 0) return true;
    if (typeof val === 'string' && val.trim().length === 0) return true;
    return false;
  });

  return {
    intent: intent === 'other' && documentType ? 'build_document' : intent,
    documentType,
    slots,
    missingRequiredSlots: missing,
    confidence,
    explanation: documentType ? `Prepared to create ${documentType.replace('_', ' ')}.` : `Processing ${intent}.`,
    explanationHi: documentType ? `${documentType.replace('_', ' ')} तैयार करने के लिए तैयार।` : `${intent} प्रोसेस किया जा रहा है।`,
    plannerSource: 'rule_fallback',
    fallbackNotice: `Notice: ${fallbackReason} — using rule-based fallback.`,
    rawQuery,
  };
}

/**
 * Real LLM-Based NLU Understanding Step
 */
export async function understandWithLLM(
  rawQuery: string,
  currentPath: string = '/',
  currentLanguage: string = 'en',
  savedProfile?: Record<string, any>
): Promise<NLUUnderstanding> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  // Hard safety limit check
  const safety = checkSafetyLimits(rawQuery);
  if (safety) {
    return {
      intent: 'refusal',
      slots: {},
      missingRequiredSlots: [],
      confidence: 1.0,
      explanation: safety.reason,
      explanationHi: safety.reasonHi,
      plannerSource: 'rule_fallback',
      rawQuery,
    };
  }

  const qLower = rawQuery.toLowerCase().trim();

  // Fast deterministic paths for standard system commands
  if (
    ['help', 'help me', 'madad', 'help karo', 'assist me'].includes(qLower) ||
    qLower.includes('naya form') ||
    qLower.includes('new form') ||
    (qLower.includes('settings') && (qLower.includes('voice') || qLower.includes('speed') || qLower.includes('dheere') || qLower.includes('fast') || qLower.includes('language') || qLower.includes('bhasha') || /\b(tamil|hindi|bengali|telugu|marathi)\b/i.test(qLower))) ||
    qLower.includes('upsc alerts') ||
    qLower.includes('alerts track') ||
    qLower.includes('caste certificate') ||
    qLower.includes('income certificate') ||
    qLower.includes('birth certificate') ||
    qLower.includes('bonafide certificate')
  ) {
    return buildRuleBasedUnderstanding(rawQuery, 'Deterministic system command match', savedProfile);
  }

  // If no API key, fall back immediately with clear flag
  if (!apiKey) {
    return buildRuleBasedUnderstanding(rawQuery, 'No Gemini API key configured', savedProfile);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${SYSTEM_PROMPT}\n\nCurrent Page: "${currentPath}"\nSelected Language: "${currentLanguage}"\n\nUser Utterance:\n"${rawQuery}"`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[NLU LLM] HTTP error status=${res.status}. Falling back to rule parser.`);
      return buildRuleBasedUnderstanding(rawQuery, `LLM HTTP error (${res.status})`, savedProfile);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return buildRuleBasedUnderstanding(rawQuery, 'Empty response from LLM', savedProfile);
    }

    const parsed = JSON.parse(text);
    const intent: NLUIntent = parsed.intent || 'build_document';
    const documentType: NLUDocumentType | null = parsed.documentType || null;
    const slots: NLUSlots = parsed.slots || {};

    // Merge saved profile fields if missing from utterance
    if (savedProfile) {
      if (!slots.applicantName && (savedProfile.fullName || savedProfile.name)) slots.applicantName = savedProfile.fullName || savedProfile.name;
      if (!slots.contact && (savedProfile.phone || savedProfile.mobile)) slots.contact = savedProfile.phone || savedProfile.mobile;
      if (!slots.education && savedProfile.education) slots.education = savedProfile.education;
      if (!slots.city && (savedProfile.city || savedProfile.address)) slots.city = savedProfile.city || savedProfile.address;
    }

    // Required slot validation
    const required = documentType ? REQUIRED_SLOTS_PER_TYPE[documentType] || [] : (intent === 'track_status' ? ['reference_no'] : []);
    const missing = required.filter((reqKey) => {
      const val = slots[reqKey];
      if (!val) return true;
      if (Array.isArray(val) && val.length === 0) return true;
      if (typeof val === 'string' && val.trim().length === 0) return true;
      return false;
    });

    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.95;

    return {
      intent,
      documentType,
      slots,
      missingRequiredSlots: missing,
      confidence,
      explanation: parsed.summary || 'Understood request.',
      explanationHi: parsed.summaryHi || 'अनुरोध समझा गया।',
      quickPicks: parsed.quickPicks || undefined,
      plannerSource: 'llm',
      fallbackNotice: null,
      rawQuery,
    };
  } catch (err: any) {
    clearTimeout(timer);
    console.warn(`[NLU LLM] Exception: ${err.message}. Falling back to rule parser.`);
    return buildRuleBasedUnderstanding(rawQuery, `LLM error: ${err.message}`, savedProfile);
  }
}

/**
 * Builds a concrete executable AssistantPlan over the Action Registry
 */
export function buildPlanFromNLU(
  nlu: NLUUnderstanding,
  currentLanguage: string = 'en'
): AssistantPlan {
  const steps: PlanStep[] = [];
  const planId = `plan-${Date.now()}`;
  const qLower = nlu.rawQuery.toLowerCase();

  // 1. Download Actions
  if (qLower.includes('download') || nlu.slots.action === 'download') {
    steps.push({
      id: 'step-dl',
      action: 'download',
      description: 'Download Form / Application Package',
      descriptionHi: 'फॉर्म / पैकेज डाउनलोड करें',
      parameters: { formId: 'current' },
      requiresConfirmation: true,
      status: 'pending',
    });
    return {
      id: planId,
      title: 'Download Document',
      titleHi: 'दस्तावेज डाउनलोड करें',
      summary: 'I will download the finalized document as PDF. Go ahead?',
      summaryHi: 'मैं दस्तावेज को PDF के रूप में डाउनलोड करूँगा। क्या आगे बढ़ें?',
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps,
    };
  }

  // 2. Explain Page / Guide
  if (
    qLower.includes('explain') ||
    qLower.includes('samjhao') ||
    qLower.includes('kya karna hai') ||
    qLower.includes('page guide')
  ) {
    steps.push({
      id: 'step-explain',
      action: 'explain_page',
      description: 'Explain page features and guidance',
      descriptionHi: 'पेज की जानकारी और निर्देश समझाएं',
      parameters: { scope: 'full' },
      status: 'pending',
    });

    return {
      id: planId,
      title: 'Explain Page',
      titleHi: 'पेज समझें',
      summary: 'I will explain what is on this page and what you should do next. Go ahead?',
      summaryHi: 'मैं इस पेज की जानकारी और आगे के कदम समझाऊँगा। क्या आगे बढ़ें?',
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps,
    };
  }

  // 3. Create Form Watch
  if (qLower.includes('watch') || qLower.includes('alert') || qLower.includes('track karo')) {
    let queryTarget = 'scholarship';
    if (qLower.includes('mppsc')) queryTarget = 'MPPSC';
    else if (qLower.includes('upsc')) queryTarget = 'UPSC';
    else if (qLower.includes('vacancy')) queryTarget = 'vacancy';

    steps.push({
      id: 'step-create-watch',
      action: 'create_watch',
      description: `Create Watch for "${queryTarget}"`,
      descriptionHi: `"${queryTarget}" के लिए अलर्ट वॉच बनाएं`,
      parameters: { query: queryTarget },
      requiresConfirmation: true,
      status: 'pending',
    });

    return {
      id: planId,
      title: `Create Form Watch for ${queryTarget}`,
      titleHi: `${queryTarget} हेतु वॉच बनाएं`,
      summary: `I will setup an alert watch for "${queryTarget}" notifications and deadlines. Go ahead?`,
      summaryHi: `मैं "${queryTarget}" के लिए नोटिफिकेशन व अंतिम तिथि की वॉच बनाऊँगा। क्या आगे बढ़ें?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps,
    };
  }

  // 4. Voice Speed Settings
  if (
    qLower.includes('voice') ||
    qLower.includes('speed') ||
    qLower.includes('dheere') ||
    qLower.includes('fast')
  ) {
    let speed = 'normal';
    if (qLower.includes('fast') || qLower.includes('tez') || qLower.includes('jaldi')) speed = 'fast';
    else if (qLower.includes('slow') || qLower.includes('dheere') || qLower.includes('kam')) speed = 'slow';

    steps.push({
      id: 'step-nav-settings',
      action: 'navigate',
      description: 'Open Settings Page',
      descriptionHi: 'सेटिंग्स पेज खोलें',
      parameters: { page: '/settings', path: '/settings' },
      status: 'pending',
    });
    steps.push({
      id: 'step-set-speed',
      action: 'set_voice_speed',
      description: `Set voice speed to ${speed}`,
      descriptionHi: `आवाज की गति ${speed} करें`,
      parameters: { speed },
      status: 'pending',
      requiresConfirmation: false,
    });

    return {
      id: planId,
      title: `Set Voice Speed to ${speed}`,
      titleHi: `आवाज की गति ${speed} करें`,
      summary: `I will open Settings and adjust voice playback speed to ${speed}. Go ahead?`,
      summaryHi: `मैं सेटिंग्स खोलकर आवाज की गति ${speed} करूँगा। क्या आगे बढ़ें?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps,
    };
  }

  // 5. Language Switching
  if (
    qLower.includes('language') ||
    qLower.includes('bhasha') ||
    /\b(tamil|hindi|bengali|telugu|marathi)\b/i.test(qLower)
  ) {
    const langMatch = qLower.match(/\b(tamil|hindi|bengali|telugu|marathi)\b/i);
    const langMap: Record<string, string> = {
      tamil: 'ta',
      hindi: 'hi',
      bengali: 'bn',
      telugu: 'te',
      marathi: 'mr',
    };
    const code = langMatch ? langMap[langMatch[1].toLowerCase()] || 'hi' : 'hi';
    const langName = langMatch ? langMatch[1] : 'Hindi';

    steps.push({
      id: 'step-nav-settings',
      action: 'navigate',
      description: 'Open Settings Page',
      descriptionHi: 'सेटिंग्स पेज खोलें',
      parameters: { page: '/settings', path: '/settings' },
      status: 'pending',
    });
    steps.push({
      id: 'step-set-lang',
      action: 'set_language',
      description: `Change language to ${langName} (${code})`,
      descriptionHi: `भाषा बदलकर ${langName} (${code}) करें`,
      parameters: { language: code, lang: code },
      status: 'pending',
      requiresConfirmation: false,
    });

    return {
      id: planId,
      title: `Change Language to ${langName}`,
      titleHi: `भाषा बदलकर ${langName} करें`,
      summary: `I will open Settings and switch application language to ${langName}. Go ahead?`,
      summaryHi: `मैं सेटिंग्स खोलकर भाषा ${langName} में बदलूँगा। क्या आगे बढ़ें?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: {},
      createdAt: Date.now(),
      steps,
    };
  }

  // 6. Navigation
  if (nlu.intent === 'navigate' || qLower.includes('jao') || qLower.includes('kholo') || qLower.includes('open') || ['settings', 'forms', 'dashboard', 'mere forms'].includes(qLower)) {
    let targetPath = '/forms';
    let targetName = 'Forms';
    let targetNameHi = 'फॉर्म';

    if (qLower.includes('naya form') || qLower.includes('new form') || qLower.includes('form banana')) {
      targetPath = '/forms/new';
      targetName = 'New Form Creation';
      targetNameHi = 'नया फॉर्म निर्माण';
    } else {
      const rawTarget = nlu.slots.targetPage || nlu.rawQuery;
      const resolved = resolvePageRoute(rawTarget);
      targetPath = resolved?.path || (rawTarget.startsWith('/') ? rawTarget : `/${rawTarget}`);
      targetName = resolved?.name || targetPath;
      targetNameHi = resolved?.nameHi || targetPath;
    }

    steps.push({
      id: 'step-nav',
      action: 'navigate',
      description: `Open ${targetName}`,
      descriptionHi: `${targetNameHi} खोलें`,
      parameters: { page: targetPath, path: targetPath },
      status: 'pending',
    });

    return {
      id: planId,
      title: 'Navigate to Page',
      titleHi: 'पेज पर जाएं',
      summary: `I will open ${targetName} (${targetPath}). Go ahead?`,
      summaryHi: `मैं ${targetNameHi} (${targetPath}) खोलूँगा। क्या आगे बढ़ें?`,
      target: 'app',
      status: 'proposed',
      currentStepIndex: 0,
      collectedAnswers: nlu.slots,
      createdAt: Date.now(),
      steps,
    };
  }

  // 2. Document Creation
  const docType = nlu.documentType || 'resume';
  const templateMap: Record<string, { id: string; name: string; nameHi: string }> = {
    resume: { id: 'resume', name: 'Professional Resume / CV', nameHi: 'व्यावसायिक बायोडाटा (रेज़्यूमे)' },
    leave_letter: { id: 'leave_application', name: 'Leave Application', nameHi: 'अवकाश / छुट्टी हेतु आवेदन पत्र' },
    internship_application: { id: 'student_internship', name: 'Student Internship Application', nameHi: 'छात्र इंटर्नशिप आवेदन पत्र' },
    scholarship_application: { id: 'scholarship_application', name: 'Scholarship Application', nameHi: 'छात्रवृत्ति आवेदन पत्र' },
    certificate_application: { id: 'certificate_application', name: 'Certificate Application', nameHi: 'प्रमाणपत्र आवेदन' },
    complaint_letter: { id: 'general_application', name: 'Official Complaint Letter', nameHi: 'शिकायत / आवेदन पत्र' },
    bonafide_certificate: { id: 'certificate_application', name: 'Bonafide Certificate Request', nameHi: 'बोनाफाइड प्रमाणपत्र आवेदन' },
    noc: { id: 'general_application', name: 'No Objection Certificate Request', nameHi: 'एनओसी आवेदन' },
  };

  const tmpl = templateMap[docType] || templateMap.resume;

  // Step 1: Navigate to Form Creation
  steps.push({
    id: 'step-nav-form',
    action: 'navigate',
    description: `Open Form Creation for ${tmpl.name}`,
    descriptionHi: `${tmpl.nameHi} निर्माण पेज खोलें`,
    parameters: { page: `/forms/new?type=${tmpl.id}` },
    status: 'pending',
  });

  // Step 2: Select Template
  steps.push({
    id: 'step-sel-tmpl',
    action: 'select_template',
    description: `Select ${tmpl.name} Template`,
    descriptionHi: `${tmpl.nameHi} टेम्पलेट चुनें`,
    parameters: { templateId: tmpl.id, templateTitle: tmpl.name },
    status: 'pending',
  });

  // Step 3: Prefill known slots from utterance / profile
  const knownSlotEntries = Object.entries(nlu.slots).filter(
    ([k, v]) => v !== null && v !== undefined && k !== 'targetPage'
  );

  if (knownSlotEntries.length > 0) {
    for (const [k, v] of knownSlotEntries) {
      steps.push({
        id: `step-fill-${k}`,
        action: 'fill_field',
        description: `Fill ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`,
        descriptionHi: `${k} भरें: ${Array.isArray(v) ? v.join(', ') : String(v)}`,
        parameters: { field: k, value: v },
        status: 'pending',
        requiresConfirmation: false,
      });
    }
  }

  // Step 4: Ask ONLY for the first missing required slot (one at a time)
  if (nlu.missingRequiredSlots.length > 0) {
    const firstMissing = nlu.missingRequiredSlots[0];
    const questionLabels: Record<string, { en: string; hi: string }> = {
      role: { en: 'What job role or target position is this for?', hi: 'यह किस पद / जॉब रोल के लिए है?' },
      education: { en: 'What is your highest degree, course, and college name?', hi: 'आपकी डिग्री, कोर्स और कॉलेज का नाम क्या है?' },
      skills: { en: 'What are your primary skills and technologies?', hi: 'आपके मुख्य कौशल (Skills) कौन से हैं?' },
      purpose: { en: 'What is the specific reason or purpose for this application?', hi: 'इस आवेदन का मुख्य कारण क्या है?' },
      recipient: { en: 'Who is the recipient authority (e.g. Principal, Manager, HR)?', hi: 'पत्र प्राप्तकर्ता का पद क्या है (जैसे प्रधानाचार्य, प्रबंधक)?' },
      startDate: { en: 'What is the start date or time period?', hi: 'शुरुआत की तारीख या समय क्या है?' },
      durationDays: { en: 'How many days or months is the duration?', hi: 'अवधि कितने दिनों या महीनों की है?' },
      annualIncome: { en: 'What is your annual family income?', hi: 'आपकी वार्षिक पारिवारिक आय कितनी है?' },
      department: { en: 'Which department or authority is this regarding?', hi: 'यह किस विभाग या प्राधिकरण से संबंधित है?' },
      reference_no: { en: 'What is your application or reference tracking number?', hi: 'आपका आवेदन या संदर्भ ट्रैकिंग नंबर क्या है?' },
    };

    const qLabel = questionLabels[firstMissing] || {
      en: `Please provide your ${firstMissing}:`,
      hi: `कृपया अपना ${firstMissing} बताएं:`,
    };

    steps.push({
      id: `step-ask-${firstMissing}`,
      action: 'ask_user',
      description: qLabel.en,
      descriptionHi: qLabel.hi,
      parameters: {
        fieldKey: firstMissing,
        question: qLabel.en,
        questionHi: qLabel.hi,
      },
      status: 'pending',
    });
  }

  // Step 5: Generate complete document
  steps.push({
    id: 'step-gen-doc',
    action: 'generate',
    description: `Generate ${tmpl.name} with verified sections`,
    descriptionHi: `सत्यापित विवरण के साथ ${tmpl.nameHi} जनरेट करें`,
    parameters: { templateId: tmpl.id, kind: docType },
    requiresConfirmation: true,
    status: 'pending',
  });

  // Step 6: Download Document (PDF / DOCX)
  steps.push({
    id: 'step-dl-doc',
    action: 'download',
    description: `Download verified ${tmpl.name} (PDF & DOCX)`,
    descriptionHi: `सत्यापित ${tmpl.nameHi} डाउनलोड करें (PDF व DOCX)`,
    parameters: { templateId: tmpl.id, formId: 'current' },
    requiresConfirmation: true,
    status: 'pending',
  });

  const titleEn = `Create ${tmpl.name}`;
  const titleHi = `${tmpl.nameHi} तैयार करें`;
  const summaryEn = `I will navigate to Forms, select ${tmpl.name}, fill known fields (${Object.keys(nlu.slots).join(', ') || 'from profile'}), ${nlu.missingRequiredSlots.length > 0 ? `ask for ${nlu.missingRequiredSlots[0]}, ` : ''}generate the ATS-friendly document, and download it with your confirmation.`;
  const summaryHi = `मैं फॉर्म पर जाकर ${tmpl.nameHi} चुनूँगा, ज्ञात फ़ील्ड भरूँगा, ${nlu.missingRequiredSlots.length > 0 ? `आपसे ${nlu.missingRequiredSlots[0]} पूछूँगा, ` : ''}डॉक्यूमेंट जनरेट करूँगा और आपकी पुष्टि के बाद डाउनलोड करूँगा।`;

  return {
    id: planId,
    title: titleEn,
    titleHi: titleHi,
    summary: summaryEn,
    summaryHi: summaryHi,
    target: 'app',
    status: 'proposed',
    currentStepIndex: 0,
    collectedAnswers: nlu.slots,
    createdAt: Date.now(),
    steps,
  };
}

/**
 * End-to-end NLU Planner Entrypoint
 */
export async function planUtteranceNLU(
  rawQuery: string,
  currentPath: string = '/',
  currentLanguage: string = 'en',
  savedProfile?: Record<string, any>
): Promise<NLUPlannerResult> {
  const understanding = await understandWithLLM(rawQuery, currentPath, currentLanguage, savedProfile);

  // Safety refusal
  if (understanding.intent === 'refusal') {
    return {
      type: 'refusal',
      reply: understanding.explanation,
      replyHi: understanding.explanationHi,
      confidence: 1.0,
      safetyRefusal: true,
      nluTrace: understanding,
    };
  }

  // Low confidence or explicit clarify intent
  if (understanding.confidence < 0.65 || understanding.intent === 'clarify') {
    const quickPicks = understanding.quickPicks || ['Create Resume', 'Apply for Leave', 'Check Status'];
    const quickPicksHi = ['रेज़्यूमे बनाएं', 'छुट्टी का आवेदन', 'आवेदन स्थिति देखें'];
    return {
      type: 'clarification',
      reply: understanding.explanation,
      replyHi: understanding.explanationHi,
      confidence: understanding.confidence,
      clarifyingQuestion: {
        question: understanding.explanation,
        questionHi: understanding.explanationHi,
        options: quickPicks,
        optionsHi: quickPicksHi,
      },
      nluTrace: understanding,
    };
  }

  // If intent is build_document: return plan preview (which includes step-by-step ask_user for missing slots)
  if (understanding.intent === 'build_document') {
    const plan = buildPlanFromNLU(understanding, currentLanguage);
    return {
      type: 'plan',
      reply: currentLanguage === 'hi' && plan.summaryHi ? plan.summaryHi : plan.summary,
      replyHi: plan.summaryHi,
      plan,
      confidence: understanding.confidence,
      nluTrace: understanding,
    };
  }

  // Missing required slots for other intents (e.g. track_status, grievance): Ask ONE AT A TIME
  if (understanding.missingRequiredSlots.length > 0) {
    const firstMissing = understanding.missingRequiredSlots[0];
    const questionLabels: Record<string, { en: string; hi: string; options?: string[]; optionsHi?: string[] }> = {
      role: {
        en: 'What job role or target position are you applying for?',
        hi: 'आप किस पद / जॉब रोल के लिए आवेदन कर रहे हैं?',
        options: ['Software Engineer', 'Data Analyst', 'Web Developer', 'Accountant'],
        optionsHi: ['सॉफ्टवेयर इंजीनियर', 'डेटा एनालिस्ट', 'वेब डेवलपर', 'अकाउंटेंट'],
      },
      education: {
        en: 'What is your highest degree, course, and college name?',
        hi: 'आपकी डिग्री, कोर्स और कॉलेज का नाम क्या है?',
        options: ['B.Tech Computer Science', 'BCA', 'B.Sc', '12th Standard'],
        optionsHi: ['बी.टेक कंप्यूटर साइंस', 'बीसीए', 'बी.एससी', '12वीं कक्षा'],
      },
      skills: {
        en: 'What are your primary skills (e.g. Python, SQL, React)?',
        hi: 'आपके मुख्य कौशल (Skills) कौन से हैं?',
        options: ['Python, SQL', 'JavaScript, React', 'Accounting, Tally', 'Java, Spring'],
        optionsHi: ['पायथन, एसक्यूएल', 'जावास्क्रिप्ट, रिएक्ट', 'अकाउंटिंग, टैली', 'जावा, स्प्रिंग'],
      },
      purpose: {
        en: 'What is the specific reason or purpose for this application?',
        hi: 'इस आवेदन का मुख्य कारण क्या है?',
        options: ['Medical Leave (Fever)', 'Urgent Family Work', 'Out of Station'],
        optionsHi: ['मेडिकल अवकाश (बुखार)', 'आवश्यक पारिवारिक कार्य', 'शहर से बाहर'],
      },
      recipient: {
        en: 'Who is the recipient authority (e.g. Principal, Manager, HR)?',
        hi: 'पत्र प्राप्तकर्ता का पद क्या है (जैसे प्रधानाचार्य, प्रबंधक)?',
        options: ['Principal', 'Manager / HR', 'Director', 'HOD'],
        optionsHi: ['प्रधानाचार्य', 'मैनेजर / एचआर', 'निदेशक', 'विभागाध्यक्ष'],
      },
      startDate: {
        en: 'From which date do you need leave?',
        hi: 'आपको किस तारीख से छुट्टी चाहिए?',
        options: ['Tomorrow', 'From Monday', 'Today'],
        optionsHi: ['कल से', 'सोमवार से', 'आज से'],
      },
      durationDays: {
        en: 'For how many days do you need leave or internship duration?',
        hi: 'अवधि कितने दिनों या महीनों की है?',
        options: ['2 Days', '3 Days', '1 Week', '1 Month'],
        optionsHi: ['2 दिन', '3 दिन', '1 हफ्ता', '1 महीना'],
      },
      annualIncome: {
        en: 'What is your annual family income for scholarship eligibility?',
        hi: 'छात्रवृत्ति के लिए आपकी वार्षिक पारिवारिक आय कितनी है?',
        options: ['Below ₹1,50,000', '₹1,50,000 - ₹2,50,000', '₹2,50,000 - ₹5,00,000'],
        optionsHi: ['₹1,50,000 से कम', '₹1,50,000 - ₹2,50,000', '₹2,50,000 - ₹5,00,000'],
      },
      department: {
        en: 'Which government department or portal is your grievance related to?',
        hi: 'आपकी शिकायत किस विभाग या पोर्टल से संबंधित है?',
        options: ['Electricity Board', 'Municipal Corporation', 'Education Dept', 'Revenue / Land'],
        optionsHi: ['बिजली विभाग', 'नगर निगम', 'शिक्षा विभाग', 'राजस्व विभाग'],
      },
      reference_no: {
        en: 'Please provide your application tracking or reference number:',
        hi: 'कृपया अपना आवेदन या संदर्भ ट्रैकिंग नंबर बताएं:',
        options: ['MPPSC-2024-8921', 'PMK-982143', 'SCH-2024-1102'],
      },
    };

    const qObj = questionLabels[firstMissing] || {
      en: `Please specify your ${firstMissing}:`,
      hi: `कृपया अपना ${firstMissing} बताएं:`,
      options: ['Specify now'],
      optionsHi: ['अभी बताएं'],
    };

    const plan = buildPlanFromNLU(understanding, currentLanguage);

    return {
      type: 'clarification',
      reply: currentLanguage === 'hi' ? qObj.hi : qObj.en,
      replyHi: qObj.hi,
      confidence: understanding.confidence,
      clarifyingQuestion: {
        question: qObj.en,
        questionHi: qObj.hi,
        options: qObj.options,
        optionsHi: qObj.optionsHi,
        fieldKey: firstMissing,
      },
      plan,
      nluTrace: understanding,
    };
  }

  // Complete plan ready
  const plan = buildPlanFromNLU(understanding, currentLanguage);

  return {
    type: 'plan',
    reply: currentLanguage === 'hi' && plan.summaryHi ? plan.summaryHi : plan.summary,
    replyHi: plan.summaryHi,
    plan,
    confidence: understanding.confidence,
    nluTrace: understanding,
  };
}
