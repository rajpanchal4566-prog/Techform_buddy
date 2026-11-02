/**
 * TechForm Buddy - On-Page Guide Overlay (Phase 2)
 *
 * Implements a rich, accessible, mobile-first bottom sheet that turns into
 * a right-side drawer on wide screens.
 *
 * Key Architecture:
 * - Rendered entirely inside an open Shadow DOM: Site CSS cannot break it,
 *   and overlay CSS cannot leak into the host page.
 * - Multi-language support (English, Hindi, and Indian regional languages).
 * - Progress indicator ("Field 3 of 12") with clear manual step reminders.
 * - Strict Hard Rule Compliance:
 *   - NEVER auto-submits. Displays: "Review everything on the page, then press Submit yourself on the website."
 *   - Disables filling on sensitive fields (Aadhaar, PAN, Passport, Bank, Card, EPIC).
 *   - Read aloud triggers host voice synthesis via IBridge.
 */

import { FormFieldSchema, FieldAnalysisResult, IBridge, PageGuideData, PageGuideStep } from './types';
import { applyFill } from './applyFill';
import { isRealForm } from './readForm';
import { SUPPORTED_LANGUAGES, sanitizeLanguage, getLanguageBcp47 } from '../../../src/lib/languages';

export interface OverlayOptions {
  bridge?: IBridge;
  language?: string;
  taskName?: string;
  mode?: 'fill' | 'guide';
  guideData?: PageGuideData;
  onClose?: () => void;
  onComplete?: () => void;
}

export interface LocalizedOverlayStrings {
  title: string;
  loginOtpNotice: string;
  fieldProgress: (current: number, total: number) => string;
  stepProgress?: (current: number, total: number) => string;
  pageGuideTitle?: string;
  autoReadToggle?: string;
  noVoiceNotice?: (lang: string) => string;
  activeTaskLabel?: string;
  guideElementHighlighted?: string;
  btnFillThis: string;
  btnFillAll: string;
  btnNext: string;
  btnPrev: string;
  btnReadAloud: string;
  btnStopAudio: string;
  btnDone: string;
  sensitiveFieldWarning: string;
  reviewAndSubmitMessage: string;
  noAutoSubmitNotice: string;
  manualActionRequired: string;
  completedTitle: string;
}

export const OVERLAY_TRANSLATIONS: Record<string, LocalizedOverlayStrings> = {
  en: {
    title: 'TechForm Buddy Guide',
    loginOtpNotice: 'Login, OTP and captcha are done by you.',
    fieldProgress: (c, t) => `Field ${c} of ${t}`,
    stepProgress: (c, t) => `Step ${c} of ${t}`,
    pageGuideTitle: 'Portal Navigation Guide',
    autoReadToggle: 'Auto-read each step',
    noVoiceNotice: (l) => `Notice: No voice installed for ${l} on this system. Audio may use default synthesizer.`,
    activeTaskLabel: 'Active Task',
    guideElementHighlighted: 'Click highlighted element',
    btnFillThis: 'Fill this',
    btnFillAll: 'Fill all',
    btnNext: 'Next',
    btnPrev: 'Previous',
    btnReadAloud: 'Read aloud',
    btnStopAudio: 'Stop audio',
    btnDone: 'Done',
    sensitiveFieldWarning: 'Sensitive ID / Financial field: Please type this yourself.',
    reviewAndSubmitMessage: 'Review everything on the page, then press Submit yourself on the website.',
    noAutoSubmitNotice: 'TechForm Buddy never auto-submits forms or clicks payment buttons.',
    manualActionRequired: 'Manual action required (file upload or document).',
    completedTitle: 'Form Review Ready!',
  },
  hi: {
    title: 'टेकफॉर्म बडी गाइड',
    loginOtpNotice: 'लॉगिन, ओटीपी और कैप्चा आपको स्वयं भरना है।',
    fieldProgress: (c, t) => `फ़ील्ड ${c} / ${t}`,
    stepProgress: (c, t) => `चरण ${c} / ${t}`,
    pageGuideTitle: 'पोर्टल नेविगेशन गाइड',
    autoReadToggle: 'प्रत्येक चरण बोलकर सुनाएं',
    noVoiceNotice: (l) => `सूचना: इस सिस्टम पर ${l} के लिए कोई आवाज नहीं मिली।`,
    activeTaskLabel: 'सक्रिय कार्य',
    guideElementHighlighted: 'हाइलाइट किए गए विकल्प पर क्लिक करें',
    btnFillThis: 'यह भरें',
    btnFillAll: 'सभी भरें',
    btnNext: 'आगे',
    btnPrev: 'पीछे',
    btnReadAloud: 'बोलकर सुनाएं',
    btnStopAudio: 'रोकें',
    btnDone: 'पूर्ण',
    sensitiveFieldWarning: 'संवेदनशील पहचान/वित्तीय फ़ील्ड: कृपया इसे स्वयं टाइप करें।',
    reviewAndSubmitMessage: 'पृष्ठ पर सब कुछ जांचें, फिर वेबसाइट पर स्वयं सबमिट दबाएं।',
    noAutoSubmitNotice: 'टेकफॉर्म बडी कभी भी स्वचालित रूप से सबमिट या भुगतान नहीं करता है।',
    manualActionRequired: 'मैन्युअल कार्रवाई आवश्यक है (फ़ाइल अपलोड)।',
    completedTitle: 'समीक्षा तैयार है!',
  },
  bn: {
    title: 'টেকফর্ম বাডি গাইড',
    loginOtpNotice: 'লগইন, ওটিপি এবং ক্যাপচা আপনার নিজের করতে হবে।',
    fieldProgress: (c, t) => `ক্ষেত্র ${c} / ${t}`,
    btnFillThis: 'এটি পূরণ করুন',
    btnFillAll: 'সব পূরণ করুন',
    btnNext: 'পরবর্তী',
    btnPrev: 'পূর্ববর্তী',
    btnReadAloud: 'পড়ে শুনুন',
    btnStopAudio: 'থামান',
    btnDone: 'সম্পন্ন',
    sensitiveFieldWarning: 'সংবেদনশীল তথ্য: অনুগ্রহ করে এটি নিজে টাইপ করুন।',
    reviewAndSubmitMessage: 'পৃষ্ঠার সবকিছু পর্যালোচনা করুন, তারপর ওয়েবসাইটে নিজে জমা দিন।',
    noAutoSubmitNotice: 'টেকফর্ম বাডি কখনই স্বয়ংক্রিয়ভাবে ফর্ম জমা দেয় না।',
    manualActionRequired: 'ম্যানুয়াল পদক্ষেপ প্রয়োজন।',
    completedTitle: 'পর্যালোচনা প্রস্তুত!',
  },
  ta: {
    title: 'டெக்ஃபார்ம் படி வழிகாட்டி',
    loginOtpNotice: 'உள்நுழைவு, OTP மற்றும் கேப்ட்சா நீங்கள் தான் செய்ய வேண்டும்.',
    fieldProgress: (c, t) => `புலம் ${c} / ${t}`,
    btnFillThis: 'இதை நிரப்பவும்',
    btnFillAll: 'அனைத்தையும் நிரப்பவும்',
    btnNext: 'அடுத்து',
    btnPrev: 'முந்தையது',
    btnReadAloud: 'வாசித்து காட்டு',
    btnStopAudio: 'நிறுத்து',
    btnDone: 'முடிந்தது',
    sensitiveFieldWarning: 'முக்கிய ஆவணம்: தயவுசெய்து இதை நீங்களே தட்டச்சு செய்யவும்.',
    reviewAndSubmitMessage: 'பக்கத்தில் உள்ள அனைத்தையும் மதிப்பாய்வு செய்து, நீங்களே சமர்ப்பிக்கவும்.',
    noAutoSubmitNotice: 'டெக்ஃபார்ம் படி தானாக படிவத்தை சமர்ப்பிக்காது.',
    manualActionRequired: 'கைமுறையாக உள்ளிட வேண்டும்.',
    completedTitle: 'மதிப்பாய்வு தயார்!',
  },
  te: {
    title: 'టెక్ఫామ్ బడ్డీ గైడ్',
    loginOtpNotice: 'లాగిన్, OTP మరియు క్యాప్చా మీరే చేయాలి.',
    fieldProgress: (c, t) => `ఫీల్డ్ ${c} / ${t}`,
    btnFillThis: 'ఇది నింపండి',
    btnFillAll: 'అన్నీ నింపండి',
    btnNext: 'తరువాత',
    btnPrev: 'మునుపటి',
    btnReadAloud: 'వినండి',
    btnStopAudio: 'ఆపండి',
    btnDone: 'పూర్తయింది',
    sensitiveFieldWarning: 'సున్నితమైన వివరాలు: దయచేసి దీన్ని మీరే టైప్ చేయండి.',
    reviewAndSubmitMessage: 'అన్నీ సమీక్షించండి, తర్వాత వెబ్‌సైట్‌లో మీరే సబ్మిట్ నొక్కండి.',
    noAutoSubmitNotice: 'టెక్ఫామ్ బడ్డీ ఎప్పుడూ ఆటో-సబ్మిట్ చేయదు.',
    manualActionRequired: 'మాన్యువల్ చర్య అవసరం.',
    completedTitle: 'సమీక్ష సిద్ధంగా ఉంది!',
  },
  mr: {
    title: 'टेकफॉर्म बडी मार्गदर्शक',
    loginOtpNotice: 'लॉगिन, ओटीपी आणि कॅप्चा तुम्हाला स्वतः भरायचे आहेत.',
    fieldProgress: (c, t) => `फील्ड ${c} / ${t}`,
    btnFillThis: 'हे भरा',
    btnFillAll: 'सर्व भरा',
    btnNext: 'पुढे',
    btnPrev: 'मागे',
    btnReadAloud: 'वाचून दाखवा',
    btnStopAudio: 'थांबवा',
    btnDone: 'पूर्ण',
    sensitiveFieldWarning: 'संवेदनशील ओळख/आर्थिक माहिती: कृपया हे स्वतः टाइप करा.',
    reviewAndSubmitMessage: 'पृष्ठावरील सर्व माहिती तपासा, नंतर वेबसाइटवर स्वतः सबमिट दाबा.',
    noAutoSubmitNotice: 'टेकफॉर्म बडी कधीही आपोआप सबमिट किंवा पेमेंट बटणे दाबत नाही.',
    manualActionRequired: 'मॅन्युअल कृती आवश्यक (दस्तऐवज/फाइल अपलोड).',
    completedTitle: 'पुनरावलोकन तयार आहे!',
  },
  gu: {
    title: 'ટેકફોર્મ બડી માર્ગદર્શિકા',
    loginOtpNotice: 'લૉગિન, OTP અને કૅપ્ચા તમારે જાતે જ ભરવાના રહેશે.',
    fieldProgress: (c, t) => `ક્ષેત્ર ${c} / ${t}`,
    btnFillThis: 'આ ભરો',
    btnFillAll: 'બધું ભરો',
    btnNext: 'આગળ',
    btnPrev: 'પાછળ',
    btnReadAloud: 'વાંચી સંભળાવો',
    btnStopAudio: 'બંધ કરો',
    btnDone: 'સંપન્ન',
    sensitiveFieldWarning: 'સંવેદનશીલ ઓળખ/નાણાકીય ક્ષેત્ર: કૃપા કરીને આ જાતે ટાઇપ કરો.',
    reviewAndSubmitMessage: 'પૃષ્ઠ પર બધું ચકાસો, પછી વેબસાઇટ પર જાતે સબમિટ દબાવો.',
    noAutoSubmitNotice: 'ટેકફોર્મ બડી ક્યારેય આપમેળે સબમિટ કરતું નથી.',
    manualActionRequired: 'મેન્યુઅલ ક્રિયા જરૂરી.',
    completedTitle: 'સમીક્ષા તૈયાર છે!',
  },
  as: {
    title: 'টেকফৰ্ম বাডী সহায়িকা',
    loginOtpNotice: 'লগইন, অ’টিপি আৰু কেপচা আপুনি নিজেই কৰিব লাগিব।',
    fieldProgress: (c, t) => `ক্ষেত্ৰ ${c} / ${t}`,
    btnFillThis: 'এইটো পূৰণ কৰক',
    btnFillAll: 'সকলো পূৰণ কৰক',
    btnNext: 'পিছৰ',
    btnPrev: 'আগলৈ',
    btnReadAloud: 'পঢ়ি শুনক',
    btnStopAudio: 'বন্ধ কৰক',
    btnDone: 'সম্পূৰ্ণ',
    sensitiveFieldWarning: 'সংবেদনশীল তথ্য: অনুগ্ৰহ কৰি নিজেই টাইপ কৰক।',
    reviewAndSubmitMessage: 'পৃষ্ঠাটো ভালদৰে পৰীક્ષા কৰক, তাৰ পিছত ৱেবছাইটত নিজেই চাবমিট কৰক।',
    noAutoSubmitNotice: 'টেকফৰ্ম বাডীয়ে কেতিয়াও স্বয়ংক্ৰিয়ভাৱে চাবমিট নকৰে।',
    manualActionRequired: 'মেনুৱেল ব্যৱস্থা প্ৰয়োজন।',
    completedTitle: 'পৰ্যালোচনা সাজু!',
  },
  kn: {
    title: 'ಟೆಕ್‌ಫಾರ್ಮ್ ಬಡ್ಡಿ ಮಾರ್ಗದರ್ಶಿ',
    loginOtpNotice: 'ಲಾಗಿನ್, OTP ಮತ್ತು ಕ್ಯಾಪ್ಚಾ ನೀವೇ ಸ್ವತಃ ಭರ್ತಿ ಮಾಡಬೇಕು.',
    fieldProgress: (c, t) => `ಕ್ಷೇತ್ರ ${c} / ${t}`,
    btnFillThis: 'ಇದನ್ನು ಭರ್ತಿ ಮಾಡಿ',
    btnFillAll: 'ಎಲ್ಲವನ್ನೂ ಭರ್ತಿ ಮಾಡಿ',
    btnNext: 'ಮುಂದೆ',
    btnPrev: 'ಹಿಂದೆ',
    btnReadAloud: 'ಓದಿ ಕೇಳಿ',
    btnStopAudio: 'ನಿಲ್ಲಿಸಿ',
    btnDone: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
    sensitiveFieldWarning: 'ಸೂಕ್ಷ್ಮ ವಿವರಗಳು: ದಯವಿಟ್ಟು ನೀವೇ ಸ್ವತಃ ಟೈಪ್ ಮಾಡಿ.',
    reviewAndSubmitMessage: 'ಪುಟದಲ್ಲಿ ಎಲ್ಲವನ್ನೂ ಪರಿಶೀಲಿಸಿ, ನಂತರ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ನೀವೇ ಸಬ್ಮಿಟ್ ಒತ್ತಿ.',
    noAutoSubmitNotice: 'ಟೆಕ್‌ಫಾರ್ಮ್ ಬಡ್ಡಿ ಎಂದಿಗೂ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಸಬ್ಮಿಟ್ ಮಾಡುವುದಿಲ್ಲ.',
    manualActionRequired: 'ಹಸ್ತಚಾಲಿತ ಕ್ರಿಯೆ ಅಗತ್ಯವಿದೆ.',
    completedTitle: 'ಪರಿಶೀಲನೆ ಸಿದ್ಧವಾಗಿದೆ!',
  },
  ml: {
    title: 'ടെക്ഫോം ബഡ്ഡി ഗൈഡ്',
    loginOtpNotice: 'ലോഗിൻ, OTP, ക്യാപ്‌ച എന്നിവ നിങ്ങൾ സ്വയം ചെയ്യേണ്ടതാണ്.',
    fieldProgress: (c, t) => `ഫീൽഡ് ${c} / ${t}`,
    btnFillThis: 'ഇത് പൂരിപ്പിക്കുക',
    btnFillAll: 'എല്ലാം പൂരിപ്പിക്കുക',
    btnNext: 'അടുത്തത്',
    btnPrev: 'മുമ്പത്തേത്',
    btnReadAloud: 'വായിച്ചു കേൾക്കുക',
    btnStopAudio: 'നിർത്തുക',
    btnDone: 'പൂർത്തിയായി',
    sensitiveFieldWarning: 'പ്രധാന വിവരങ്ങൾ: ദയവായി ഇത് സ്വയം ടൈപ്പ് ചെയ്യുക.',
    reviewAndSubmitMessage: 'പേജിലെ വിവരങ്ങൾ പരിശോധിച്ച് വെബ്സൈറ്റിൽ സ്വയം സമർപ്പിക്കുക.',
    noAutoSubmitNotice: 'ടെക്ഫോം ബഡ്ഡി സ്വയം ഫോം സമർപ്പിക്കുകയില്ല.',
    manualActionRequired: 'മാനുവൽ നടപടി ആവശ്യമാണ്.',
    completedTitle: 'പരിശോധന തയ്യാറാണ്!',
  },
  pa: {
    title: 'ਟੈੱਕਫਾਰਮ ਬੱਡੀ ਗਾਈਡ',
    loginOtpNotice: 'ਲਾਗਇਨ, OTP ਅਤੇ ਕੈਪਚਾ ਤੁਹਾਨੂੰ ਖੁਦ ਭਰਨਾ ਪਵੇਗਾ।',
    fieldProgress: (c, t) => `ਖੇਤਰ ${c} / ${t}`,
    btnFillThis: 'ਇਹ ਭਰੋ',
    btnFillAll: 'ਸਾਰੇ ਭਰੋ',
    btnNext: 'ਅਗਲਾ',
    btnPrev: 'ਪਿਛਲਾ',
    btnReadAloud: 'ਬੋਲ ਕੇ ਸੁਣਾਓ',
    btnStopAudio: 'ਰੋਕੋ',
    btnDone: 'ਮੁਕੰਮਲ',
    sensitiveFieldWarning: 'ਸੰਵੇਦਨਸ਼ੀਲ ਪਛਾਣ/ਵਿੱਤੀ ਖੇਤਰ: ਕਿਰਪਾ ਕਰਕੇ ਇਸਨੂੰ ਖੁਦ ਟਾਈਪ ਕਰੋ।',
    reviewAndSubmitMessage: 'ਪੰਨੇ ਦੀ ਚੰਗੀ ਤਰ੍ਹਾਂ ਜਾਂਚ ਕਰੋ, ਫਿਰ ਵੈੱਬਸਾਈਟ ਤੇ ਖੁਦ ਸਬਮਿਟ ਦਬਾਓ।',
    noAutoSubmitNotice: 'ਟੈੱਕਫਾਰਮ ਬੱਡੀ ਕਦੇ ਵੀ ਆਟੋ-ਸਬਮਿਟ ਨਹੀਂ ਕਰਦਾ।',
    manualActionRequired: 'ਮੈਨੂਅਲ ਕਾਰਵਾਈ ਦੀ ਲੋੜ ਹੈ।',
    completedTitle: 'ਸਮੀਖਿਆ ਤਿਆਰ ਹੈ!',
  },
};

/**
 * Register custom/dynamic languages at runtime (extensible language system).
 */
export function registerTranslations(langCode: string, strings: LocalizedOverlayStrings): void {
  OVERLAY_TRANSLATIONS[langCode] = strings;
}

const OVERLAY_CSS = `
:host {
  all: initial;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color-scheme: dark;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.tfb-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  z-index: 2147483646;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.tfb-backdrop.visible {
  opacity: 1;
  pointer-events: auto;
}

/* Mobile-First: Bottom Sheet */
.tfb-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 85vh;
  background: #0f172a;
  color: #f8fafc;
  border-radius: 20px 20px 0 0;
  border-top: 1px solid #334155;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.tfb-sheet.open {
  transform: translateY(0);
}

/* Wide screen: Right-side Drawer */
@media (min-width: 768px) {
  .tfb-sheet {
    left: auto;
    right: 0;
    top: 0;
    bottom: 0;
    width: 420px;
    max-height: 100vh;
    border-radius: 16px 0 0 16px;
    border-top: none;
    border-left: 1px solid #334155;
    box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
    transform: translateX(100%);
  }
  .tfb-sheet.open {
    transform: translateX(0);
  }
}

/* Drag pill for mobile sheet */
.tfb-handle-bar {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}
.tfb-handle-pill {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #475569;
}
@media (min-width: 768px) {
  .tfb-handle-bar { display: none; }
}

/* Header */
.tfb-header {
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #1e293b;
  background: #0b1120;
}

.tfb-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tfb-logo-badge {
  background: linear-gradient(135deg, #2563eb, #10b981);
  color: #fff;
  font-weight: 800;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.tfb-header-title {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
}

.tfb-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tfb-lang-select {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}
.tfb-lang-select:focus {
  border-color: #3b82f6;
}

.tfb-icon-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.tfb-icon-btn:hover {
  background: #1e293b;
  color: #f8fafc;
}

/* Hard Rule Notice Banner */
.tfb-notice-bar {
  background: #172554;
  border-bottom: 1px solid #1e3a8a;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #93c5fd;
  font-weight: 500;
}
.tfb-notice-icon {
  font-size: 14px;
}

/* Progress bar */
.tfb-progress-container {
  padding: 12px 18px 4px;
}
.tfb-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}
.tfb-progress-track {
  height: 6px;
  background: #1e293b;
  border-radius: 3px;
  overflow: hidden;
}
.tfb-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width 0.25s ease;
  border-radius: 3px;
}

/* Content Area */
.tfb-body {
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
}

.tfb-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tfb-field-badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tfb-section-tag {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.tfb-status-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
}
.tfb-status-pill.autofill {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.tfb-status-pill.sensitive {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.tfb-status-pill.manual {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.tfb-field-label {
  font-size: 17px;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.3;
}

.tfb-explanation-box {
  background: #0f172a;
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid #3b82f6;
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.5;
}

.tfb-instruction-box {
  font-size: 13px;
  color: #94a3b8;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.4;
}

.tfb-alert-box {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

/* Completion Card */
.tfb-completion-card {
  background: #064e3b;
  border: 1px solid #059669;
  color: #ecfdf5;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tfb-completion-title {
  font-size: 18px;
  font-weight: 800;
  color: #34d399;
}
.tfb-completion-text {
  font-size: 14px;
  line-height: 1.5;
  color: #a7f3d0;
}
.tfb-rule-reminder {
  font-size: 12px;
  color: #6ee7b7;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 4px;
}

/* Footer / Action Buttons */
.tfb-footer {
  padding: 14px 18px 20px;
  background: #0b1120;
  border-top: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tfb-btn-row-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tfb-btn-row-nav {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
}

/* Buttons */
.tfb-btn {
  height: 48px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  transition: transform 0.1s, opacity 0.15s, background 0.15s;
  user-select: none;
  padding: 0 16px;
}
.tfb-btn:active {
  transform: scale(0.98);
}
.tfb-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.tfb-btn-primary {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
.tfb-btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #34d399, #10b981);
}

.tfb-btn-secondary {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}
.tfb-btn-secondary:hover:not(:disabled) {
  background: #3b82f6;
}

.tfb-btn-outline {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
}
.tfb-btn-outline:hover:not(:disabled) {
  background: #334155;
  color: #f8fafc;
}

.tfb-btn-speak {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}
.tfb-btn-speak:hover:not(:disabled) {
  background: #6366f1;
}

.tfb-btn-speak.active {
  background: #dc2626;
}

/* Minimized Floating Pill */
.tfb-minimized-pill {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  color: #f8fafc;
  border: 1px solid #334155;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  border-radius: 9999px;
  padding: 8px 16px;
  display: none;
  align-items: center;
  gap: 10px;
  z-index: 2147483647;
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s, box-shadow 0.2s;
}
.tfb-minimized-pill.visible {
  display: flex;
}
.tfb-minimized-pill:hover {
  transform: translateY(-2px);
  border-color: #3b82f6;
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.3);
}
.tfb-pill-badge {
  background: linear-gradient(135deg, #2563eb, #10b981);
  color: #fff;
  font-weight: 800;
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 9999px;
}
.tfb-pill-info {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tfb-pill-action {
  font-size: 12px;
  color: #60a5fa;
  font-weight: 700;
}

/* Page Guide Mode CSS */
.tfb-task-banner {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.tfb-task-icon {
  font-size: 16px;
}
.tfb-task-label {
  color: #94a3b8;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.tfb-task-title {
  color: #38bdf8;
  font-weight: 700;
  font-size: 13px;
}
.tfb-step-active-card {
  border-left: 4px solid #3b82f6 !important;
}
.tfb-step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.tfb-step-pill {
  background: #2563eb;
  color: #ffffff;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 800;
}
.tfb-step-body {
  font-size: 14px;
  line-height: 1.5;
  color: #f8fafc;
  font-weight: 600;
}
.tfb-target-hint {
  margin-top: 10px;
  background: #1e1b4b;
  border: 1px solid #4338ca;
  color: #c7d2fe;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.tfb-voice-notice-box {
  margin-top: 10px;
  background: #451a03;
  border: 1px solid #b45309;
  color: #fde68a;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.tfb-options-row {
  display: flex;
  justify-content: flex-end;
  padding: 4px 6px 0;
}
.tfb-auto-read-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}
.tfb-auto-read-label input {
  cursor: pointer;
  accent-color: #3b82f6;
}
`;

export class GuideOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private fields: FormFieldSchema[] = [];
  private analysis: FieldAnalysisResult[] = [];
  private profileValues: Record<string, string> = {};
  private currentIndex = 0;
  private language = 'en';
  private bridge?: IBridge;
  private isSpeaking = false;
  private isOpen = false;
  private isMinimized = false;
  private isComplete = false;
  private onClose?: () => void;
  private onComplete?: () => void;

  // Page Guide Mode Extensions
  private mode: 'fill' | 'guide' = 'fill';
  private taskName = '';
  private guideData: PageGuideData | null = null;
  private guideStepIndex = 0;
  private autoReadEnabled = false;
  private voiceNotice = '';
  private currentlyHighlightedElement: HTMLElement | null = null;

  constructor(options: OverlayOptions = {}) {
    this.bridge = options.bridge;
    this.language = sanitizeLanguage(options.language || 'en');
    this.taskName = options.taskName || '';
    this.mode = options.mode || 'fill';
    if (options.guideData) {
      this.guideData = options.guideData;
      this.mode = 'guide';
    }
    this.onClose = options.onClose;
    this.onComplete = options.onComplete;
  }

  public setTaskName(task: string): void {
    this.taskName = task;
    this.render();
  }

  public getTaskName(): string {
    return this.taskName;
  }

  public getMode(): 'fill' | 'guide' {
    return this.mode;
  }

  public setMode(mode: 'fill' | 'guide'): void {
    this.mode = mode;
    this.render();
  }

  public setGuideData(data: PageGuideData): void {
    this.guideData = data;
    this.mode = 'guide';
    this.guideStepIndex = 0;
    if (data.taskName) {
      this.taskName = data.taskName;
    }
    this.render();
    this.highlightCurrentGuideStep();
  }

  public getGuideData(): PageGuideData | null {
    return this.guideData;
  }

  public setAutoRead(enabled: boolean): void {
    this.autoReadEnabled = enabled;
    this.render();
  }

  public nextGuideStep(): void {
    if (!this.guideData || !this.guideData.steps || this.guideData.steps.length === 0) return;
    if (this.guideStepIndex < this.guideData.steps.length - 1) {
      this.guideStepIndex++;
      this.render();
      this.highlightCurrentGuideStep();
      if (this.autoReadEnabled) {
        this.readAloud();
      }
    }
  }

  public prevGuideStep(): void {
    if (this.guideStepIndex > 0) {
      this.guideStepIndex--;
      this.render();
      this.highlightCurrentGuideStep();
      if (this.autoReadEnabled) {
        this.readAloud();
      }
    }
  }

  private highlightCurrentGuideStep(): void {
    this.clearGuideHighlight();
    if (!this.guideData || !this.guideData.steps || this.guideData.steps.length === 0) return;
    const currentStep = this.guideData.steps[this.guideStepIndex];
    if (!currentStep) return;

    let targetText = currentStep.targetText;
    if (!targetText) {
      const match = currentStep.text.match(/["']([^"']+)["']/);
      if (match) targetText = match[1];
    }

    this.highlightGuideElement(targetText, currentStep.targetSelector);
  }

  public highlightGuideElement(targetText?: string, selector?: string): void {
    this.clearGuideHighlight();
    if (!targetText && !selector) return;

    let targetEl: HTMLElement | null = null;
    if (selector) {
      try {
        targetEl = document.querySelector<HTMLElement>(selector);
      } catch {}
    }

    if (!targetEl && targetText) {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        'button, a, [role="button"], input[type="button"], input[type="submit"], .btn, .card, h2, h3, h4'
      )).filter(el => {
        if (el.closest('#tfb-guide-overlay-host') || el.closest('#tfb-portal-overlay-host')) return false;
        return el.offsetParent !== null || (typeof window !== 'undefined' && window.getComputedStyle(el).display !== 'none');
      });

      const cleanTarget = targetText.toLowerCase().trim();
      targetEl = candidates.find(el => el.textContent?.trim().toLowerCase() === cleanTarget) || null;
      if (!targetEl) {
        targetEl = candidates.find(el => el.textContent?.trim().toLowerCase().includes(cleanTarget)) || null;
      }
      if (!targetEl) {
        targetEl = candidates.find(el => (el.getAttribute('aria-label') || '').toLowerCase().includes(cleanTarget)) || null;
      }
    }

    if (targetEl) {
      try {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}
      targetEl.style.setProperty('outline', '3px solid #2563eb', 'important');
      targetEl.style.setProperty('outline-offset', '3px', 'important');
      targetEl.style.setProperty('box-shadow', '0 0 0 6px rgba(37, 99, 235, 0.35)', 'important');
      targetEl.setAttribute('data-tfb-highlighted', 'true');
      this.currentlyHighlightedElement = targetEl;
    }
  }

  public clearGuideHighlight(): void {
    if (this.currentlyHighlightedElement) {
      try {
        this.currentlyHighlightedElement.style.removeProperty('outline');
        this.currentlyHighlightedElement.style.removeProperty('outline-offset');
        this.currentlyHighlightedElement.style.removeProperty('box-shadow');
        this.currentlyHighlightedElement.removeAttribute('data-tfb-highlighted');
      } catch {}
      this.currentlyHighlightedElement = null;
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[data-tfb-highlighted]').forEach(el => {
        try {
          (el as HTMLElement).style.removeProperty('outline');
          (el as HTMLElement).style.removeProperty('outline-offset');
          (el as HTMLElement).style.removeProperty('box-shadow');
          el.removeAttribute('data-tfb-highlighted');
        } catch {}
      });
    }
  }

  private generateDefaultGuideData(): void {
    const pageTitle = typeof document !== 'undefined' ? document.title : 'Official Portal';
    const cleanTask = this.taskName || 'Application Navigation';

    const visibleActions = typeof document !== 'undefined' ? Array.from(document.querySelectorAll<HTMLElement>(
      'button, a, [role="button"], .btn, .card'
    )).filter(el => {
      if (el.closest('#tfb-guide-overlay-host') || el.closest('#tfb-portal-overlay-host')) return false;
      return el.offsetParent !== null && Boolean(el.textContent?.trim());
    }) : [];

    let primeTarget: HTMLElement | null = null;
    let primeText = '';
    const keywords = ['form 6', 'fill form', 'apply online', 'register', 'new registration', 'services', 'apply'];
    for (const kw of keywords) {
      primeTarget = visibleActions.find(el => el.textContent?.toLowerCase().includes(kw)) || null;
      if (primeTarget) {
        primeText = primeTarget.textContent?.trim().replace(/\s+/g, ' ') || '';
        break;
      }
    }

    const steps: PageGuideStep[] = [];
    if (primeText) {
      steps.push({
        stepNumber: 1,
        text: `Click on "${primeText}" to begin your application.`,
        targetText: primeText,
      });
      steps.push({
        stepNumber: 2,
        text: 'Sign up or log in using your mobile number and OTP if prompted.',
      });
      steps.push({
        stepNumber: 3,
        text: 'Fill out your applicant details, upload required proofs, and verify before submitting.',
      });
    } else {
      steps.push({
        stepNumber: 1,
        text: `Review the portal options for "${cleanTask}" and choose your designated service.`,
      });
      steps.push({
        stepNumber: 2,
        text: 'Follow the portal instructions to proceed to the application form.',
      });
    }

    this.guideData = {
      taskName: cleanTask,
      title: pageTitle,
      summary: `Welcome to ${pageTitle}. This page provides access to ${cleanTask}. Follow the steps below to navigate to the official application form.`,
      steps,
    };
  }

  /**
   * Mounts the overlay inside an open Shadow DOM attached to document.body.
   */
  public mount(targetParent: HTMLElement = document.body): void {
    if (this.host) return;

    // Check if host element already exists
    let existingHost = document.getElementById('tfb-guide-overlay-host');
    if (existingHost) {
      existingHost.remove();
    }

    this.host = document.createElement('div');
    this.host.id = 'tfb-guide-overlay-host';
    targetParent.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Inject stylesheet
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    this.shadow.appendChild(style);

    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'tfb-overlay-root';
    wrapper.id = 'tfb-root';
    this.shadow.appendChild(wrapper);

    this.render();
    this.open();
  }

  /**
   * Updates overlay state with scanned fields and profile analysis.
   */
  public setData(
    fields: FormFieldSchema[],
    analysis: FieldAnalysisResult[],
    profileValues: Record<string, string>
  ): void {
    this.fields = fields;
    this.analysis = analysis;
    this.profileValues = profileValues;
    this.currentIndex = 0;

    // Requirement 1 & 2: Only treat as form page if fields >= 3
    if (!isRealForm(fields)) {
      this.mode = 'guide';
      if (!this.guideData) {
        this.generateDefaultGuideData();
      }
    } else {
      this.mode = 'fill';
      this.isComplete = false;
    }

    this.render();
    if (this.mode === 'fill') {
      this.highlightCurrentField();
    } else {
      this.highlightCurrentGuideStep();
    }
  }

  public setLanguage(lang: string): void {
    this.language = sanitizeLanguage(lang);
    this.render();
  }

  public open(): void {
    this.isOpen = true;
    this.isMinimized = false;
    this.render();
    this.highlightCurrentField();
  }

  public close(): void {
    this.isOpen = false;
    this.isMinimized = false;
    const sheet = this.shadow?.querySelector('.tfb-sheet');
    const backdrop = this.shadow?.querySelector('.tfb-backdrop');
    sheet?.classList.remove('open');
    backdrop?.classList.remove('visible');
    this.stopSpeaking();
    this.onClose?.();
  }

  public minimize(): void {
    this.isMinimized = true;
    this.render();
  }

  public expand(): void {
    this.isMinimized = false;
    this.render();
    this.highlightCurrentField();
  }

  public isOverlayMinimized(): boolean {
    return this.isMinimized;
  }

  public nextField(): void {
    if (this.currentIndex < this.fields.length - 1) {
      this.currentIndex++;
      this.render();
      this.highlightCurrentField();
    } else {
      this.isComplete = true;
      this.render();
      this.onComplete?.();
    }
  }

  public prevField(): void {
    if (this.isComplete) {
      this.isComplete = false;
      this.currentIndex = Math.max(0, this.fields.length - 1);
      this.render();
      this.highlightCurrentField();
      return;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
      this.highlightCurrentField();
    }
  }

  /**
   * Fills only the currently focused field using applyFill and advances.
   */
  public fillCurrentField(): void {
    const field = this.fields[this.currentIndex];
    const an = this.analysis[this.currentIndex];
    if (!field || !an || an.sensitive || an.manual || !an.canFill || !an.profileKey) return;

    applyFill({ [field.id]: an.profileKey }, this.profileValues, [field]);
    this.nextField();
  }

  /**
   * Fills all eligible non-sensitive fields at once.
   * STRICT: Skips every field marked sensitive or manual on either the schema or analysis.
   */
  public fillAllFields(): void {
    const mapping: Record<string, string> = {};
    for (let i = 0; i < this.fields.length; i++) {
      const f = this.fields[i];
      const a = this.analysis[i];
      // Skip if sensitive or manual on either schema or analysis
      if (f.sensitive || f.manual || (a && (a.sensitive || a.manual || !a.canFill || !a.profileKey))) {
        continue;
      }
      if (a && a.canFill && a.profileKey) {
        mapping[f.id] = a.profileKey;
      }
    }

    applyFill(mapping, this.profileValues, this.fields);
    this.isComplete = true;
    this.render();
    this.onComplete?.();
  }

  /**
   * Triggers text-to-speech for the current guidance message.
   * Asks host bridge first, falling back to window.speechSynthesis.
   */
  public async readAloud(): Promise<void> {
    if (this.isSpeaking || (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking)) {
      this.stopSpeaking();
      return;
    }

    const t = this.getTranslations();
    let textToSpeak = '';

    if (this.mode === 'guide') {
      const steps = this.guideData?.steps || [];
      const currentStep = steps[this.guideStepIndex];
      const stepNum = this.guideStepIndex + 1;
      const stepText = currentStep?.text || '';
      const stepProgStr = t.stepProgress ? t.stepProgress(stepNum, steps.length) : `Step ${stepNum} of ${steps.length}`;
      if (this.guideStepIndex === 0 && this.guideData?.summary) {
        textToSpeak = `${this.guideData.summary} ${stepProgStr}: ${stepText}`;
      } else {
        textToSpeak = `${stepProgStr}: ${stepText}`;
      }
    } else if (this.isComplete) {
      textToSpeak = `${t.completedTitle}. ${t.reviewAndSubmitMessage}. ${t.noAutoSubmitNotice}`;
    } else {
      const field = this.fields[this.currentIndex];
      const an = this.analysis[this.currentIndex];
      const fieldName = field?.label || 'Current Field';
      const explanation = an?.explanation || '';
      const whatToEnter = an?.whatToEnter || '';
      const sensitiveWarning = an?.sensitive ? ` ${t.sensitiveFieldWarning}` : '';

      textToSpeak = `${fieldName}. ${explanation}. ${whatToEnter}.${sensitiveWarning}`;
    }

    if (!textToSpeak.trim()) return;

    this.isSpeaking = true;
    this.updateSpeakButtonUI();

    const targetLangTag = getLanguageBcp47(this.language);

    // 1. Desktop & Browser Speech: window.speechSynthesis (Requirement 5)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.lang = targetLangTag;

        const voices = window.speechSynthesis.getVoices();
        let matchingVoice: SpeechSynthesisVoice | undefined;
        if (voices && voices.length > 0) {
          const targetPrefix = this.language.toLowerCase().split('-')[0];
          // Prefer high-quality or Google voice for the selected language
          matchingVoice = voices.find(v => {
            const n = v.name.toLowerCase();
            const l = v.lang.toLowerCase().replace(/_/g, '-');
            const isHQ = n.includes('google') || n.includes('natural') || n.includes('online') || (v.voiceURI && v.voiceURI.toLowerCase().includes('google'));
            return isHQ && (l === targetLangTag.toLowerCase() || l.startsWith(targetPrefix));
          }) || voices.find(v => {
            const l = v.lang.toLowerCase().replace(/_/g, '-');
            return l === targetLangTag.toLowerCase();
          }) || voices.find(v => {
            const l = v.lang.toLowerCase().replace(/_/g, '-');
            return l.startsWith(targetPrefix);
          });

          // Requirement 2: If no voice exists for selected language, fall back to Hindi (hi-IN)
          if (!matchingVoice && this.language !== 'hi') {
            matchingVoice = voices.find(v => {
              const l = v.lang.toLowerCase().replace(/_/g, '-');
              const n = v.name.toLowerCase();
              return l.startsWith('hi') || n.includes('hindi') || n.includes('हिन्दी');
            });
            if (matchingVoice) {
              this.voiceNotice = 'Pronunciation may differ (using Hindi hi-IN fallback voice as no native voice is installed).';
              this.render();
            }
          }
        }

        if (matchingVoice) {
          try {
            utter.voice = matchingVoice;
            utter.lang = matchingVoice.lang || targetLangTag;
          } catch {}
          if (!this.voiceNotice) {
            this.voiceNotice = '';
          }
        } else if (voices && voices.length > 0 && this.language !== 'en') {
          this.voiceNotice = t.noVoiceNotice ? t.noVoiceNotice(targetLangTag) : `Notice: No voice installed for ${targetLangTag} on this system. Audio may use default synthesizer.`;
          this.render();
        } else {
          this.voiceNotice = '';
        }

        utter.onend = () => {
          this.isSpeaking = false;
          this.updateSpeakButtonUI();
        };
        utter.onerror = () => {
          this.isSpeaking = false;
          this.updateSpeakButtonUI();
        };
        window.speechSynthesis.speak(utter);
      } catch {
        this.isSpeaking = false;
        this.updateSpeakButtonUI();
      }
    } else if (this.bridge) {
      // Host bridge fallback
      try {
        await this.bridge.send('SPEAK_REQUEST', {
          text: textToSpeak,
          language: this.language,
        });
      } catch {}
    }
  }

  public stopSpeaking(): void {
    this.isSpeaking = false;
    this.updateSpeakButtonUI();

    if (this.bridge) {
      this.bridge.send('STOP_SPEAK_REQUEST').catch(() => {});
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private updateSpeakButtonUI(): void {
    const speakBtn = this.shadow?.querySelector('.tfb-btn-speak');
    const speakText = this.shadow?.querySelector('.tfb-speak-text');
    const t = this.getTranslations();
    if (speakBtn && speakText) {
      if (this.isSpeaking) {
        speakBtn.classList.add('active');
        speakText.textContent = t.btnStopAudio;
      } else {
        speakBtn.classList.remove('active');
        speakText.textContent = t.btnReadAloud;
      }
    }
  }

  /**
   * Highlights the current field on the host page and scrolls it into view.
   */
  private highlightCurrentField(): void {
    if (this.fields.length === 0 || this.isComplete) return;

    const field = this.fields[this.currentIndex];
    if (!field) return;

    try {
      const el = document.querySelector<HTMLElement>(field.selector) || document.getElementById(field.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
        // Pulse animation
        el.style.setProperty('outline', '3px solid #3b82f6', 'important');
        el.style.setProperty('outline-offset', '2px', 'important');
      }
    } catch {
      // invalid selector fallback
    }
  }

  private getTranslations(): LocalizedOverlayStrings {
    const base = OVERLAY_TRANSLATIONS['en'];
    const current = OVERLAY_TRANSLATIONS[this.language] || base;
    return { ...base, ...current };
  }

  /**
   * Main render method inside Shadow DOM.
   */
  private render(): void {
    const root = this.shadow?.getElementById('tfb-root');
    if (!root) return;

    const t = this.getTranslations();

    let bodyContentHtml = '';
    let progressHtml = '';
    let footerHtml = '';
    let pillInfoHtml = '';

    if (this.mode === 'guide') {
      const guideSteps = this.guideData?.steps || [];
      const totalSteps = guideSteps.length || 1;
      const currentStepNum = Math.min(this.guideStepIndex + 1, totalSteps);
      const progressPercent = (currentStepNum / totalSteps) * 100;
      const currentStep = guideSteps[this.guideStepIndex];

      const stepProgLabel = t.stepProgress ? t.stepProgress(currentStepNum, totalSteps) : `Step ${currentStepNum} of ${totalSteps}`;
      const pageGuideLabel = this.guideData?.title || t.pageGuideTitle || 'Page Guide';
      const taskLabel = t.activeTaskLabel || 'Active Task';

      pillInfoHtml = `${this.taskName || pageGuideLabel}: ${stepProgLabel}`;

      progressHtml = `
        <div class="tfb-progress-container">
          <div class="tfb-progress-header">
            <span>${stepProgLabel}</span>
            <span>${Math.round(progressPercent)}%</span>
          </div>
          <div class="tfb-progress-track">
            <div class="tfb-progress-bar" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      `;

      bodyContentHtml = `
        ${this.taskName ? `
          <div class="tfb-task-banner">
            <span class="tfb-task-icon">🎯</span>
            <span class="tfb-task-label">${taskLabel}:</span>
            <strong class="tfb-task-title">${this.taskName}</strong>
          </div>
        ` : ''}

        <div class="tfb-card">
          <div class="tfb-card-subtitle" style="font-size:12px;font-weight:700;color:#38bdf8;margin-bottom:6px;">${pageGuideLabel}</div>
          <div class="tfb-explanation-box">
            ${this.guideData?.summary || 'Follow the step-by-step guidance below to proceed with your application.'}
          </div>
        </div>

        <div class="tfb-card tfb-step-active-card">
          <div class="tfb-step-header">
            <span class="tfb-step-pill">${stepProgLabel}</span>
            ${currentStep?.targetText ? `<span class="tfb-status-pill autofill">Action</span>` : ''}
          </div>

          <div class="tfb-step-body">
            ${currentStep?.text || 'Review page and proceed.'}
          </div>

          ${currentStep?.targetText ? `
            <div class="tfb-target-hint">
              <span>👉</span>
              <span>${t.guideElementHighlighted || 'Click highlighted element'}: <strong>"${currentStep.targetText}"</strong></span>
            </div>
          ` : ''}

          ${this.voiceNotice ? `
            <div class="tfb-voice-notice-box">
              <span>⚠️</span>
              <span>${this.voiceNotice}</span>
            </div>
          ` : ''}
        </div>

        <div class="tfb-options-row">
          <label class="tfb-auto-read-label">
            <input type="checkbox" id="tfb-auto-read-toggle" ${this.autoReadEnabled ? 'checked' : ''} />
            <span>🔊 ${t.autoReadToggle}</span>
          </label>
        </div>
      `;

      footerHtml = `
        <div class="tfb-btn-row-nav">
          <button class="tfb-btn tfb-btn-outline" id="tfb-prev-btn" ${this.guideStepIndex === 0 ? 'disabled' : ''}>
            ← ${t.btnPrev}
          </button>
          <button class="tfb-btn tfb-btn-speak ${this.isSpeaking ? 'active' : ''}" id="tfb-speak-btn" title="${this.isSpeaking ? t.btnStopAudio : t.btnReadAloud}">
            ${this.isSpeaking ? '⏹️' : '🔊'} <span class="tfb-speak-text">${this.isSpeaking ? t.btnStopAudio : t.btnReadAloud}</span>
          </button>
          <button class="tfb-btn tfb-btn-outline" id="tfb-next-btn">
            ${this.guideStepIndex === totalSteps - 1 ? t.btnDone : t.btnNext} →
          </button>
        </div>
      `;
    } else {
      // FORM FILL MODE (>= 3 fields)
      const totalFields = this.fields.length;
      const currentNum = Math.min(this.currentIndex + 1, totalFields);
      const progressPercent = totalFields > 0 ? (currentNum / totalFields) * 100 : 100;

      const currentField = this.fields[this.currentIndex];
      const currentAnalysis = this.analysis[this.currentIndex];

      pillInfoHtml = this.isComplete ? t.completedTitle : `${currentNum}/${totalFields}: ${currentField?.label || 'Form Field'}`;

      let statusPillHtml = '';
      let isFillDisabled = true;

      if (currentAnalysis) {
        if (currentAnalysis.sensitive) {
          statusPillHtml = `<span class="tfb-status-pill sensitive">Sensitive (Type Yourself)</span>`;
        } else if (currentAnalysis.canFill) {
          statusPillHtml = `<span class="tfb-status-pill autofill">Auto-Fillable</span>`;
          isFillDisabled = false;
        } else {
          statusPillHtml = `<span class="tfb-status-pill manual">Manual Entry</span>`;
        }
      }

      progressHtml = `
        <div class="tfb-progress-container">
          <div class="tfb-progress-header">
            <span>${t.fieldProgress(this.isComplete ? totalFields : currentNum, totalFields)}</span>
            <span>${Math.round(this.isComplete ? 100 : progressPercent)}%</span>
          </div>
          <div class="tfb-progress-track">
            <div class="tfb-progress-bar" style="width: ${this.isComplete ? 100 : progressPercent}%"></div>
          </div>
        </div>
      `;

      if (this.isComplete || totalFields === 0) {
        bodyContentHtml = `
          <div class="tfb-completion-card">
            <div class="tfb-completion-title">${t.completedTitle}</div>
            <div class="tfb-completion-text">${t.reviewAndSubmitMessage}</div>
            <div class="tfb-rule-reminder">${t.noAutoSubmitNotice}</div>
          </div>
        `;
      } else {
        bodyContentHtml = `
          ${this.taskName ? `
            <div class="tfb-task-banner">
              <span class="tfb-task-icon">🎯</span>
              <span class="tfb-task-label">${t.activeTaskLabel}:</span>
              <strong class="tfb-task-title">${this.taskName}</strong>
            </div>
          ` : ''}

          <div class="tfb-card">
            <div class="tfb-field-badge-row">
              <span class="tfb-section-tag">${currentField?.section || 'General'}</span>
              ${statusPillHtml}
            </div>

            <div class="tfb-field-label">${currentField?.label || 'Form Field'}</div>

            <div class="tfb-explanation-box">
              ${currentAnalysis?.explanation || 'Enter the requested information according to your records.'}
            </div>

            <div class="tfb-instruction-box">
              <span>👉</span>
              <span>${currentAnalysis?.whatToEnter || 'Please type or choose your value.'}</span>
            </div>

            ${currentAnalysis?.sensitive ? `
              <div class="tfb-alert-box">
                <span>⚠️</span>
                <span>${t.sensitiveFieldWarning}</span>
              </div>
            ` : ''}

            ${this.voiceNotice ? `
              <div class="tfb-voice-notice-box">
                <span>⚠️</span>
                <span>${this.voiceNotice}</span>
              </div>
            ` : ''}
          </div>

          <div class="tfb-options-row">
            <label class="tfb-auto-read-label">
              <input type="checkbox" id="tfb-auto-read-toggle" ${this.autoReadEnabled ? 'checked' : ''} />
              <span>🔊 ${t.autoReadToggle}</span>
            </label>
          </div>
        `;
      }

      footerHtml = `
        ${!this.isComplete ? `
          <div class="tfb-btn-row-main">
            <button class="tfb-btn tfb-btn-primary" id="tfb-fill-this-btn" ${isFillDisabled ? 'disabled' : ''}>
              ✓ ${t.btnFillThis}
            </button>
            <button class="tfb-btn tfb-btn-secondary" id="tfb-fill-all-btn">
              ⚡ ${t.btnFillAll}
            </button>
          </div>
        ` : ''}

        <div class="tfb-btn-row-nav">
          <button class="tfb-btn tfb-btn-outline" id="tfb-prev-btn" ${this.currentIndex === 0 && !this.isComplete ? 'disabled' : ''}>
            ← ${t.btnPrev}
          </button>
          <button class="tfb-btn tfb-btn-speak ${this.isSpeaking ? 'active' : ''}" id="tfb-speak-btn" title="${this.isSpeaking ? t.btnStopAudio : t.btnReadAloud}">
            ${this.isSpeaking ? '⏹️' : '🔊'} <span class="tfb-speak-text">${this.isSpeaking ? t.btnStopAudio : t.btnReadAloud}</span>
          </button>
          <button class="tfb-btn tfb-btn-outline" id="tfb-next-btn">
            ${this.isComplete ? t.btnDone : t.btnNext} →
          </button>
        </div>
      `;
    }

    root.innerHTML = `
      <!-- Minimized Floating Pill (Tap to Expand) -->
      <div class="tfb-minimized-pill ${this.isMinimized ? 'visible' : ''}" id="tfb-minimized-pill" title="Tap to expand guide">
        <span class="tfb-pill-badge">BUDDY</span>
        <span class="tfb-pill-info">${pillInfoHtml}</span>
        <span class="tfb-pill-action">Tap to Expand ▴</span>
      </div>

      <div class="tfb-backdrop ${this.isOpen && !this.isMinimized ? 'visible' : ''}"></div>
      <div class="tfb-sheet ${this.isOpen && !this.isMinimized ? 'open' : ''}">
        <div class="tfb-handle-bar">
          <div class="tfb-handle-pill"></div>
        </div>

        <!-- Header -->
        <div class="tfb-header">
          <div class="tfb-title-wrap">
            <span class="tfb-logo-badge">BUDDY</span>
            <span class="tfb-header-title">${t.title}</span>
          </div>
          <div class="tfb-header-actions">
            <select class="tfb-lang-select" id="tfb-lang-dropdown">
              ${SUPPORTED_LANGUAGES.map(l => `<option value="${l.code}" ${this.language === l.code ? 'selected' : ''}>${l.label === l.nativeName ? l.label : `${l.label} (${l.nativeName})`}</option>`).join('')}
            </select>
            <button class="tfb-icon-btn" id="tfb-minimize-btn" title="Minimize Overlay">─</button>
            <button class="tfb-icon-btn" id="tfb-close-btn" title="Close Overlay">✕</button>
          </div>
        </div>

        <!-- Hard Rule Notice Bar -->
        <div class="tfb-notice-bar">
          <span class="tfb-notice-icon">🛡️</span>
          <span>${t.loginOtpNotice}</span>
        </div>

        <!-- Progress Indicator -->
        ${progressHtml}

        <!-- Body / Field Card -->
        <div class="tfb-body">
          ${bodyContentHtml}
        </div>

        <!-- Footer / Action Buttons -->
        <div class="tfb-footer">
          ${footerHtml}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.shadow) return;

    // Language dropdown
    const langSelect = this.shadow.getElementById('tfb-lang-dropdown') as HTMLSelectElement | null;
    langSelect?.addEventListener('change', e => {
      this.setLanguage((e.target as HTMLSelectElement).value);
    });

    // Minimize button
    const minimizeBtn = this.shadow.getElementById('tfb-minimize-btn');
    minimizeBtn?.addEventListener('click', () => this.minimize());

    // Minimized pill click (Tap to Expand)
    const minimizedPill = this.shadow.getElementById('tfb-minimized-pill');
    minimizedPill?.addEventListener('click', () => this.expand());

    // Close button & backdrop click
    const closeBtn = this.shadow.getElementById('tfb-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    const backdrop = this.shadow.querySelector('.tfb-backdrop');
    backdrop?.addEventListener('click', () => this.close());

    // Auto-read toggle
    const autoReadToggle = this.shadow.getElementById('tfb-auto-read-toggle') as HTMLInputElement | null;
    autoReadToggle?.addEventListener('change', (e) => {
      this.autoReadEnabled = (e.target as HTMLInputElement).checked;
    });

    // Fill this
    const fillThisBtn = this.shadow.getElementById('tfb-fill-this-btn');
    fillThisBtn?.addEventListener('click', () => this.fillCurrentField());

    // Fill all
    const fillAllBtn = this.shadow.getElementById('tfb-fill-all-btn');
    fillAllBtn?.addEventListener('click', () => this.fillAllFields());

    // Next
    const nextBtn = this.shadow.getElementById('tfb-next-btn');
    nextBtn?.addEventListener('click', () => {
      if (this.mode === 'guide') {
        const total = this.guideData?.steps?.length || 1;
        if (this.guideStepIndex >= total - 1) {
          this.close();
        } else {
          this.nextGuideStep();
        }
      } else if (this.isComplete) {
        this.close();
      } else {
        this.nextField();
      }
    });

    // Prev
    const prevBtn = this.shadow.getElementById('tfb-prev-btn');
    prevBtn?.addEventListener('click', () => {
      if (this.mode === 'guide') {
        this.prevGuideStep();
      } else {
        this.prevField();
      }
    });

    // Read aloud
    const speakBtn = this.shadow.getElementById('tfb-speak-btn');
    speakBtn?.addEventListener('click', () => this.readAloud());
  }

  /**
   * Destroys and removes the overlay completely.
   */
  public destroy(): void {
    this.stopSpeaking();
    this.clearGuideHighlight();
    if (this.host) {
      this.host.remove();
      this.host = null;
      this.shadow = null;
    }
  }
}
