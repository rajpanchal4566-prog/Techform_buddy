// Comprehensive Speech Synthesis, Recognition, and Multilingual Localization Engine for TechForm Buddy

import {
  LanguageOption,
  SUPPORTED_LANGUAGES,
  ALLOWED_LANGUAGE_CODES,
  sanitizeLanguage,
  getLanguageBcp47,
  getLanguageOption,
} from './languages';
import { translateFromEnglish, getTranslationFailureMessage } from './translate';

export {
  type LanguageOption,
  SUPPORTED_LANGUAGES,
  ALLOWED_LANGUAGE_CODES,
  sanitizeLanguage,
  getLanguageBcp47,
  getLanguageOption,
};

// Helper: Get the saved default language from localStorage.
// Coerces removed (non-Indian) languages back to 'en'.
export function getDefaultLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem('tfb_lang') || localStorage.getItem('tfb_language') || 'en';
  if (!ALLOWED_LANGUAGE_CODES.has(saved)) {
    localStorage.setItem('tfb_lang', 'en');
    localStorage.setItem('tfb_language', 'en');
    return 'en';
  }
  return saved;
}

// Helper: Save default language to localStorage
export function setDefaultLanguage(langCode: string): void {
  if (typeof window !== 'undefined') {
    const safe = sanitizeLanguage(langCode);
    localStorage.setItem('tfb_lang', safe);
    localStorage.setItem('tfb_language', safe);
  }
}

// Language Capability Levels
export type LanguageCapability = 'full' | 'speech_only' | 'text_only' | 'limited';

export interface LanguageCapabilityInfo {
  level: LanguageCapability;
  label: string;
  description: string;
  tts: boolean;       // Text-to-Speech works
  stt: boolean;       // Speech-to-Text works
  formFill: boolean;  // Can fill forms by voice command
  voiceNav: boolean;  // Can navigate by voice command
  translate: boolean; // Has native field translations
}

// Capability matrix for each language
export const LANGUAGE_CAPABILITIES: Record<string, LanguageCapabilityInfo> = {
  en: { level: 'full', label: 'Full Support', description: 'Complete voice commands, form filling, navigation, TTS, and STT', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  hi: { level: 'full', label: 'Full Support', description: 'पूर्ण आवाज़ कमांड, फॉर्म भरना, नेविगेशन, TTS और STT', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  ta: { level: 'full', label: 'Full Support', description: 'முழு குரல் கட்டளைகள், படிவம் நிரப்புதல், வழிசெலுத்தல்', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  te: { level: 'full', label: 'Full Support', description: 'పూర్తి వాయిస్ కమాండ్లు, ఫారం నింపడం, నావిగేషన్', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  bn: { level: 'full', label: 'Full Support', description: 'সম্পূর্ণ ভয়েস কমান্ড, ফর্ম পূরণ, নেভিগেশন', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  mr: { level: 'full', label: 'Full Support', description: 'पूर्ण व्हॉइस कमांड, फॉर्म भरणे, नेविगेशन', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  gu: { level: 'full', label: 'Full Support', description: 'સંપૂર્ણ વૉઇસ કમાન્ડ, ફોર્મ ભરવું, નેવિગેશન', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  kn: { level: 'full', label: 'Full Support', description: 'ಸಂಪೂರ್ಣ ಧ್ವನಿ ಆದೇಶ, ಫಾರ್ಮ್ ಭರ್ತಿ, ನ್ಯಾವಿಗೇಷನ್', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  ml: { level: 'full', label: 'Full Support', description: 'പൂർണ്ണ വോയ്സ് കമാൻഡ്, ഫോം പൂരിപ്പിക്കൽ, നാവിഗേഷൻ', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  pa: { level: 'full', label: 'Full Support', description: 'ਪੂਰੀ ਵੌਇਸ ਕਮਾਂਡ, ਫਾਰਮ ਭਰਨਾ, ਨੈਵੀਗੇਸ਼ਨ', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
  ur: { level: 'full', label: 'Full Support', description: 'مکمل وائس کمانڈ، فارم بھرنا، نیویگیشن', tts: true, stt: true, formFill: true, voiceNav: true, translate: true },
};

export function getLanguageCapability(langCode: string): LanguageCapabilityInfo {
  return LANGUAGE_CAPABILITIES[langCode] || LANGUAGE_CAPABILITIES['en'];
}

// Native test phrases for each language
export const TEST_PHRASES: Record<string, string> = {
  en: 'Hello! This is TechForm Buddy speaking in English. Your voice is configured.',
  hi: 'नमस्ते! यह टेकफॉर्म बडी है। आपकी हिन्दी आवाज़ सफलतापूर्वक सेट हो गई है।',
  ta: 'வணக்கம்! இது டெக்ஃபார்ம் படி. உங்கள் தமிழ் குரல் வெற்றிகரமாக அமைக்கப்பட்டது.',
  te: 'నమస్కారం! ఇది టెక్ఫార్మ్ బడ్డీ. మీ తెలుగు వాయిస్ విజయవంతంగా సెట్ చేయబడింది.',
  bn: 'নমস্কার! এটি টেকফর্ম বাডি। আপনার বাংলা ভয়েস সফলভাবে সেট করা হয়েছে।',
  mr: 'नमस्कार! हे टेकफॉर्म बडी आहे. तुमचा मराठी आवाज यशस्वीरित्या बदलला आहे.',
  gu: 'નમસ્તે! આ ટેકફોર્મ બડી છે. તમારો ગુજરાતી અવાજ સફળતાપૂર્વક સેટ થઈ ગયો છે.',
  kn: 'ನಮಸ್ಕಾರ! ಇದು ಟೆಕ್‌ಫಾರ್ಮ್ ಬಡ್ಡಿ. ನಿಮ್ಮ ಧ್ವನಿ ಯಶಸ್ವಿಯಾಗಿ ಹೊಂದಿಸಲಾಗಿದೆ.',
  ml: 'നമസ്കാരം! ഇത് ടെക്ഫോം ബഡി ആണ്. നിങ്ങളുടെ ശബ്ദം വിജയകരമായി സജ്ജീകരിച്ചു.',
  pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਇਹ ਟੈਕਫਾਰਮ ਬੱਡੀ ਹੈ। ਤੁਹਾਡੀ ਆਵਾਜ਼ ਸਫਲਤਾਪੂਰਵਕ ਸੈੱਟ ਹੋ ਗਈ ਹੈ।',
  ur: 'السلام علیکم! یہ ٹیک فارم بڈی ہے۔ آپ کی آواز کامیابی سے تبدیل ہو گئی ہے۔',
};

// Voice command keyword translations for multilingual voice commands
export interface VoiceCommandCategories {
  fill: string[];
  read: string[];
  submit: string[];
  download: string[];
  clear: string[];
  copy: string[];
  print: string[];
  scrollDown: string[];
  scrollUp: string[];
  zoomIn: string[];
  zoomOut: string[];
  reload: string[];
  navForms: string[];
  navDashboard: string[];
  navProfile: string[];
  navDocuments: string[];
  navAssistant: string[];
  portalSarthi: string[];
  portalPassport: string[];
  portalPan: string[];
  portalPmkisan: string[];
  portalEpfo: string[];
  portalDigilocker: string[];
}

export const VOICE_COMMAND_KEYWORDS: Record<string, VoiceCommandCategories> = {
  en: {
    fill: ['auto fill', 'autofill', 'fill form', 'fill from profile', 'profile fill', 'fill'],
    read: ['read form', 'read aloud', 'read cloud', 'read allowed', 'read a loud', 'read out loud', 'read all', 'speak form', 'speak aloud', 'listen form', 'read', 'speak'],
    submit: ['submit form', 'submit', 'send form', 'finish form', 'submit application'],
    download: ['download form', 'download pdf', 'download document', 'download', 'save form', 'export'],
    clear: ['clear all', 'clear fields', 'clear form', 'reset form', 'erase form', 'clear'],
    copy: ['copy form', 'copy data', 'clipboard', 'copy to clipboard', 'copy'],
    print: ['print form', 'print document', 'print'],
    scrollDown: ['scroll down', 'page down', 'move down'],
    scrollUp: ['scroll up', 'page up', 'move up'],
    zoomIn: ['zoom in', 'enlarge', 'make bigger'],
    zoomOut: ['zoom out', 'shrink', 'make smaller'],
    reload: ['refresh', 'reload', 'reload page'],
    navForms: ['go to forms', 'open forms', 'show forms', 'forms page'],
    navDashboard: ['go to dashboard', 'open dashboard', 'dashboard'],
    navProfile: ['go to profile', 'open profile', 'my profile'],
    navDocuments: ['go to documents', 'open documents', 'my documents'],
    navAssistant: ['go to assistant', 'open assistant', 'ai assistant'],
    portalSarthi: ['open sarthi', 'driving license', 'parivahan', 'sarathi'],
    portalPassport: ['open passport', 'passport seva', 'passport portal'],
    portalPan: ['open pan', 'pan card', 'income tax', 'tin nsdl'],
    portalPmkisan: ['open pm kisan', 'pmkisan', 'kisan portal'],
    portalEpfo: ['open epfo', 'provident fund', 'uan portal'],
    portalDigilocker: ['open digilocker', 'digilocker'],
  },
  hi: {
    fill: ['भरो', 'भर', 'प्रोफाइल से भरो', 'ऑटो फिल', 'भरें', 'जानकारी भरो', 'प्रोफाइल'],
    read: ['पढ़ो', 'बोलो', 'सुनाओ', 'पढ़ें', 'बताओ', 'सुनाएं'],
    submit: ['जमा करो', 'सबमिट', 'सबमिट करो', 'भेजो', 'भेजें', 'पूरा करो'],
    download: ['डाउनलोड', 'डाउनलोड करो', 'पीडीएफ डाउनलोड', 'सेव करो', 'दस्तावेज डाउनलोड'],
    clear: ['साफ करो', 'साफ़ करो', 'खाली करो', 'हटाओ', 'मिटाओ', 'रीसेट करो'],
    copy: ['कॉपी करो', 'कॉपी', 'नकल करो'],
    print: ['प्रिंट करो', 'प्रिंट', 'छापो'],
    scrollDown: ['नीचे करो', 'नीचे चलो', 'नीचे', 'स्क्रोल डाउन'],
    scrollUp: ['ऊपर करो', 'ऊपर चलो', 'ऊपर', 'स्क्रोल अप'],
    zoomIn: ['बड़ा करो', 'ज़ूम इन', 'बड़ा'],
    zoomOut: ['छोटा करो', 'ज़ूम आउट', 'छोटा'],
    reload: ['रिफ्रेश करो', 'रिफ्रेश', 'दोबारा खोलो'],
    navForms: ['फॉर्म्स खोलो', 'फॉर्म्स', 'फॉर्म पर जाओ'],
    navDashboard: ['डैशबोर्ड खोलो', 'डैशबोर्ड'],
    navProfile: ['प्रोफाइल खोलो', 'प्रोफ़ाइल', 'मेरी प्रोफाइल'],
    navDocuments: ['डॉक्युमेंट्स खोलो', 'दस्तावेज खोलो', 'डॉक्युमेंट्स'],
    navAssistant: ['असिस्टेंट खोलो', 'एआई असिस्टेंट'],
    portalSarthi: ['सारथी खोलो', 'ड्राइविंग लाइसेंस', 'परिवहन'],
    portalPassport: ['पासपोर्ट खोलो', 'पासपोर्ट सेवा'],
    portalPan: ['पैन कार्ड खोलो', 'पैन पोर्टल'],
    portalPmkisan: ['पीएम किसान खोलो', 'किसान पोर्टल'],
    portalEpfo: ['ईपीएफओ खोलो', 'पीएफ पोर्टल'],
    portalDigilocker: ['डिजिलॉकर खोलो', 'डिजिलॉकर'],
  },
  ta: {
    fill: ['நிரப்பு', 'நிரப்புங்கள்', 'சுயவிவரம்', 'தானாக'],
    read: ['படிக்க', 'படியுங்கள்', 'சொல்லுங்கள்', 'கேளுங்கள்'],
    submit: ['சமர்ப்பி', 'அனுப்பு', 'அனுப்புங்கள்', 'முடி'],
    download: ['பதிவிறக்கு', 'பதிவிறக்கம் செய்', 'சேமி'],
    clear: ['அழி', 'அழிக்கவும்', 'மீட்டமை'],
    copy: ['நகலெடு', 'நகல் செய்'],
    print: ['அச்சிடு'],
    scrollDown: ['கீழே உருட்டு', 'கீழே'],
    scrollUp: ['மேலே உருட்டு', 'மேலே'],
    zoomIn: ['பெரிதாக்கு'],
    zoomOut: ['சிறிதாக்கு'],
    reload: ['புதுப்பி'],
    navForms: ['படிவங்கள்', 'படிவங்கள் திற'],
    navDashboard: ['டாஷ்போர்டு'],
    navProfile: ['சுயவிவரம்'],
    navDocuments: ['ஆவணங்கள்'],
    navAssistant: ['உதவியாளர்'],
    portalSarthi: ['சாரதி', 'ஓட்டுநர் உரிமம்'],
    portalPassport: ['பாஸ்போர்ட்'],
    portalPan: ['பான் கார்டு'],
    portalPmkisan: ['பிஎம் கிசான்'],
    portalEpfo: ['இபிஎஃப்ஓ'],
    portalDigilocker: ['டிஜிலாக்கர்'],
  },
  te: {
    fill: ['నింపు', 'నింపండి', 'ప్రొఫైల్', 'ఆటో'],
    read: ['చదువు', 'చదవండి', 'చెప్పండి', 'వినండి'],
    submit: ['సమర్పించు', 'పంపు', 'పంపండి', 'ముగించు'],
    download: ['డౌన్‌లోడ్', 'సేవ్ చేయి'],
    clear: ['క్లియర్ చేయి', 'తొలగించు'],
    copy: ['కాపీ చేయి'],
    print: ['ప్రింట్ చేయి'],
    scrollDown: ['క్రిందికి'],
    scrollUp: ['పైకి'],
    zoomIn: ['పెద్దది చేయి'],
    zoomOut: ['చిన్నది చేయి'],
    reload: ['రీఫ్రెష్'],
    navForms: ['ఫారమ్‌లు'],
    navDashboard: ['డాష్‌బోర్డ్'],
    navProfile: ['ప్రొఫైల్'],
    navDocuments: ['పత్రాలు'],
    navAssistant: ['అసిస్టెంట్'],
    portalSarthi: ['సారథి', 'డ్రైవింగ్ లైసెన్స్'],
    portalPassport: ['పాస్‌పోర్ట్'],
    portalPan: ['పాన్ కార్డ్'],
    portalPmkisan: ['పీఎం కిసాన్'],
    portalEpfo: ['ఈపీఎఫ్‌ఓ'],
    portalDigilocker: ['డిజిలాకర్'],
  },
  bn: {
    fill: ['পূরণ', 'ভরো', 'প্রোফাইল', 'অটো', 'ভরুন'],
    read: ['পড়ো', 'পড়ুন', 'বলো', 'শোনাও', 'বলুন'],
    submit: ['জমা', 'পাঠাও', 'সাবমিট', 'পাঠান', 'শেষ'],
    download: ['ডাউনলোড', 'ডাউনলোড করো', 'সেভ করো'],
    clear: ['পরিষ্কার করো', 'মুছে ফেলো'],
    copy: ['কপি করো'],
    print: ['প্রিন্ট করো'],
    scrollDown: ['নিচে যাও', 'নিচে'],
    scrollUp: ['উপরে যাও', 'উপরে'],
    zoomIn: ['বড় করো'],
    zoomOut: ['ছোট করো'],
    reload: ['রিফ্রেশ করো'],
    navForms: ['ফর্ম খুলুন'],
    navDashboard: ['ড্যাশবোর্ড'],
    navProfile: ['প্রোফাইল'],
    navDocuments: ['ডকুমেন্টস'],
    navAssistant: ['অ্যাসিস্ট্যান্ট'],
    portalSarthi: ['সারথি', 'ড্রাইভিং লাইসেন্স'],
    portalPassport: ['পাসপোর্ট'],
    portalPan: ['প্যান কার্ড'],
    portalPmkisan: ['পিএম কিষান'],
    portalEpfo: ['ইপিএফও'],
    portalDigilocker: ['ডিজিলকার'],
  },
  mr: {
    fill: ['भरा', 'भरून', 'प्रोफाइल', 'ऑटो', 'माहिती'],
    read: ['वाचा', 'सांगा', 'ऐका', 'बोला'],
    submit: ['सबमिट', 'पाठवा', 'जमा', 'पूर्ण'],
    download: ['डाउनलोड करा', 'डाउनलोड', 'सेव्ह करा'],
    clear: ['साफ करा', 'रिकामे करा'],
    copy: ['कॉपी करा'],
    print: ['प्रिंट करा'],
    scrollDown: ['खाली करा'],
    scrollUp: ['वर करा'],
    zoomIn: ['मोठे करा'],
    zoomOut: ['लहान करा'],
    reload: ['रिफ्रेश करा'],
    navForms: ['फॉर्म्स उघडा'],
    navDashboard: ['डॅशबोर्ड'],
    navProfile: ['प्रोफाइल'],
    navDocuments: ['दस्तऐवज'],
    navAssistant: ['असिस्टंट'],
    portalSarthi: ['सारथी', 'ड्रायव्हिंग लायसन्स'],
    portalPassport: ['पासपोर्ट'],
    portalPan: ['पॅन कार्ड'],
    portalPmkisan: ['पीएम किसान'],
    portalEpfo: ['ईपीएफओ'],
    portalDigilocker: ['डिजिलॉकर'],
  },
  gu: {
    fill: ['ભરો', 'ભરવું', 'પ્રોફાઇલ', 'ઓટો', 'માહિતી'],
    read: ['વાંચો', 'બોલો', 'સાંભળો', 'કહો'],
    submit: ['સબમિટ', 'મોકલો', 'જમા', 'પૂર્ણ'],
    download: ['ડાઉનલોડ કરો', 'ડાઉનલોડ'],
    clear: ['સાફ કરો', 'ખાલી કરો'],
    copy: ['કોપી કરો'],
    print: ['પ્રિન્ટ કરો'],
    scrollDown: ['નીચે'],
    scrollUp: ['ઉપર'],
    zoomIn: ['મોટું કરો'],
    zoomOut: ['નાનું કરો'],
    reload: ['રીફ્રેશ'],
    navForms: ['ફોર્મ ખોલો'],
    navDashboard: ['ડેશબોર્ડ'],
    navProfile: ['પ્ર્રોફાઇલ'],
    navDocuments: ['દસ્તાવેજ'],
    navAssistant: ['સહાયક'],
    portalSarthi: ['સારથી', 'ડ્રાઇવિંગ લાઇસન્સ'],
    portalPassport: ['પાસપોર્ટ'],
    portalPan: ['પાન કાર્ડ'],
    portalPmkisan: ['પીએમ કિસાન'],
    portalEpfo: ['ઇપીએફઓ'],
    portalDigilocker: ['ડિજીલોકર'],
  },
  kn: {
    fill: ['ತುಂಬಿ', 'ಭರ್ತಿ', 'ಪ್ರೊಫೈಲ್', 'ಆಟೋ', 'ಮಾಹಿತಿ'],
    read: ['ಓದು', 'ಓದಿ', 'ಹೇಳಿ', 'ಕೇಳಿ'],
    submit: ['ಸಲ್ಲಿಸು', 'ಕಳುಹಿಸು', 'ಮುಗಿಸು', 'ಪೂರ್ಣ'],
    download: ['ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ', 'ಡೌನ್‌ಲೋಡ್'],
    clear: ['ತೆರವುಗೊಳಿಸಿ', 'ಅಳಿಸಿ'],
    copy: ['ನಕಲಿಸಿ'],
    print: ['ಮುದ್ರಿಸು'],
    scrollDown: ['ಕೆಳಗೆ'],
    scrollUp: ['ಮೇಲೆ'],
    zoomIn: ['ದೊಡ್ಡದು'],
    zoomOut: ['ಸಣ್ಣದು'],
    reload: ['ರಿಫ್ರೆಶ್'],
    navForms: ['ಫಾರ್ಮ್‌ಗಳು'],
    navDashboard: ['ಡ್ಯಾಶ್‌ಬೋರ್ಡ್'],
    navProfile: ['ಪ್ರೊಫೈಲ್'],
    navDocuments: ['ದಾಖಲೆಗಳು'],
    navAssistant: ['ಸಹಾಯಕ'],
    portalSarthi: ['ಸಾರಥಿ', 'ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್'],
    portalPassport: ['ಪಾಸ್‌ಪೋರ್ಟ್'],
    portalPan: ['ಪ್ಯಾನ್ ಕಾರ್ಡ್'],
    portalPmkisan: ['ಪಿಎಂ ಕಿಸಾನ್'],
    portalEpfo: ['ಇಪಿಎಫ್‌ಒ'],
    portalDigilocker: ['ಡಿಜಿಲಾಕರ್'],
  },
  ml: {
    fill: ['പൂരിപ്പിക്കൂ', 'നിറയ്ക്കൂ', 'പ്രൊഫൈൽ', 'ഓട്ടോ', 'വിവരം'],
    read: ['വായിക്കൂ', 'പറയൂ', 'കേൾക്കൂ', 'പറഞ്ഞു'],
    submit: ['സമർപ്പിക്കൂ', 'അയയ്ക്കൂ', 'പൂർത്തി', 'കഴിഞ്ഞു'],
    download: ['ഡൗൺലോഡ് ചെയ്യുക', 'ഡൗൺലോഡ്'],
    clear: ['മായ്ക്കുക', 'ശൂന്യമാക്കുക'],
    copy: ['പകർത്തുക'],
    print: ['പ്രിന്റ് ചെയ്യുക'],
    scrollDown: ['താഴേക്ക്'],
    scrollUp: ['മുകളിലേക്ക്'],
    zoomIn: ['വലുതാക്കുക'],
    zoomOut: ['ചെറുതാക്കുക'],
    reload: ['പുതുക്കുക'],
    navForms: ['ഫോമുകൾ'],
    navDashboard: ['ഡാഷ്‌ബോർഡ്'],
    navProfile: ['പ്രൊഫൈൽ'],
    navDocuments: ['പ്രമാണങ്ങൾ'],
    navAssistant: ['സഹായി'],
    portalSarthi: ['സാരഥി'],
    portalPassport: ['പാസ്‌പോർട്ട്'],
    portalPan: ['പാൻ കാർഡ്'],
    portalPmkisan: ['പിഎം കിസാൻ'],
    portalEpfo: ['ഇപിഎഫ്ഒ'],
    portalDigilocker: ['ഡിജിലോക്കർ'],
  },
  pa: {
    fill: ['ਭਰੋ', 'ਭਰਨ', 'ਪ੍ਰੋਫਾਈਲ', 'ਆਟੋ', 'ਜਾਣਕਾਰੀ'],
    read: ['ਪੜ੍ਹੋ', 'ਬੋਲੋ', 'ਸੁਣੋ', 'ਦੱਸੋ'],
    submit: ['ਜਮ੍ਹਾਂ', 'ਭੇਜੋ', 'ਸਬਮਿਟ', 'ਮੁਕੰਮਲ'],
    download: ['ਡਾਊਨਲੋਡ ਕਰੋ', 'ਡਾਊਨਲੋਡ'],
    clear: ['ਸਾਫ਼ ਕਰੋ', 'ਖਾਲੀ ਕਰੋ'],
    copy: ['ਕਾਪੀ ਕਰੋ'],
    print: ['ਪ੍ਰਿੰਟ ਕਰੋ'],
    scrollDown: ['ਹੇਠਾਂ'],
    scrollUp: ['ਉੱਪਰ'],
    zoomIn: ['ਵੱਡਾ ਕਰੋ'],
    zoomOut: ['ਛੋਟਾ ਕਰੋ'],
    reload: ['ਰੀਫ੍ਰੈਸ਼'],
    navForms: ['ਫਾਰਮ ਖੋਲ੍ਹੋ'],
    navDashboard: ['ਡੈਸ਼ਬੋਰਡ'],
    navProfile: ['ਪ੍ਰੋਫਾਈਲ'],
    navDocuments: ['ਦਸਤਾਵੇਜ਼'],
    navAssistant: ['ਸਹਾਇਕ'],
    portalSarthi: ['ਸਾਰਥੀ'],
    portalPassport: ['ਪਾਸਪੋਰਟ'],
    portalPan: ['ਪੈਨ ਕਾਰਡ'],
    portalPmkisan: ['ਪੀਐਮ ਕਿਸਾਨ'],
    portalEpfo: ['ਈਪੀਐਫਓ'],
    portalDigilocker: ['ਡਿਜੀਲੌਕਰ'],
  },
  ur: {
    fill: ['بھرو', 'بھریں', 'پروفائل', 'آٹو', 'معلومات'],
    read: ['پڑھو', 'پڑھیں', 'بولو', 'سنائیں'],
    submit: ['جمع', 'بھیجو', 'بھیجیں', 'مکمل'],
    download: ['ڈاؤن لوڈ کریں', 'ڈاؤن لوڈ'],
    clear: ['صاف کرو', 'خالی کرو'],
    copy: ['کاپی کرو'],
    print: ['پرنٹ کرو'],
    scrollDown: ['نیچے'],
    scrollUp: ['اوپر'],
    zoomIn: ['بڑا کرو'],
    zoomOut: ['چھوٹا کرو'],
    reload: ['ریفریش'],
    navForms: ['فارمز'],
    navDashboard: ['ڈیش بورڈ'],
    navProfile: ['پروفائل'],
    navDocuments: ['دستاویزات'],
    navAssistant: ['معاون'],
    portalSarthi: ['سارتھی'],
    portalPassport: ['پاسپورٹ'],
    portalPan: ['پین کارڈ'],
    portalPmkisan: ['پی ایم کسان'],
    portalEpfo: ['ای پی ایف او'],
    portalDigilocker: ['ڈیجی لاکر'],
  },
  // Non-Indian language entries removed — only Indian languages are supported
};

export type VoiceCommandIntent =
  | 'fill'
  | 'read'
  | 'submit'
  | 'download'
  | 'clear'
  | 'copy'
  | 'print'
  | 'scroll_down'
  | 'scroll_up'
  | 'zoom_in'
  | 'zoom_out'
  | 'reload'
  | 'nav_forms'
  | 'nav_dashboard'
  | 'nav_profile'
  | 'nav_documents'
  | 'nav_assistant'
  | 'portal_sarthi'
  | 'portal_passport'
  | 'portal_pan'
  | 'portal_pmkisan'
  | 'portal_epfo'
  | 'portal_digilocker'
  | null;

// Determine the voice command intent from spoken text in any language
export function parseVoiceCommand(spokenText: string, langCode: string): VoiceCommandIntent {
  const text = spokenText.toLowerCase();
  const kw = VOICE_COMMAND_KEYWORDS[langCode] || VOICE_COMMAND_KEYWORDS['en'];
  const enKw = VOICE_COMMAND_KEYWORDS['en'];

  const matches = (list1?: string[], list2?: string[]) => {
    const combined = [...(list1 || []), ...(list2 || [])];
    return combined.some(k => text.includes(k.toLowerCase()));
  };

  if (matches(kw.download, enKw.download)) return 'download';
  if (matches(kw.clear, enKw.clear)) return 'clear';
  if (matches(kw.copy, enKw.copy)) return 'copy';
  if (matches(kw.print, enKw.print)) return 'print';
  if (matches(kw.scrollDown, enKw.scrollDown)) return 'scroll_down';
  if (matches(kw.scrollUp, enKw.scrollUp)) return 'scroll_up';
  if (matches(kw.zoomIn, enKw.zoomIn)) return 'zoom_in';
  if (matches(kw.zoomOut, enKw.zoomOut)) return 'zoom_out';
  if (matches(kw.reload, enKw.reload)) return 'reload';

  if (matches(kw.portalSarthi, enKw.portalSarthi)) return 'portal_sarthi';
  if (matches(kw.portalPassport, enKw.portalPassport)) return 'portal_passport';
  if (matches(kw.portalPan, enKw.portalPan)) return 'portal_pan';
  if (matches(kw.portalPmkisan, enKw.portalPmkisan)) return 'portal_pmkisan';
  if (matches(kw.portalEpfo, enKw.portalEpfo)) return 'portal_epfo';
  if (matches(kw.portalDigilocker, enKw.portalDigilocker)) return 'portal_digilocker';

  if (matches(kw.navForms, enKw.navForms)) return 'nav_forms';
  if (matches(kw.navDashboard, enKw.navDashboard)) return 'nav_dashboard';
  if (matches(kw.navProfile, enKw.navProfile)) return 'nav_profile';
  if (matches(kw.navDocuments, enKw.navDocuments)) return 'nav_documents';
  if (matches(kw.navAssistant, enKw.navAssistant)) return 'nav_assistant';

  if (matches(kw.fill, enKw.fill)) return 'fill';
  if (matches(kw.read, enKw.read)) return 'read';
  if (matches(kw.submit, enKw.submit)) return 'submit';

  return null;
}

// Detect if spoken transcript is an instruction to read aloud (including common STT errors like "read cloud")
export function isReadAloudCommand(transcript: string): boolean {
  if (!transcript || !transcript.trim()) return false;
  const t = transcript.toLowerCase().trim();
  const readPhrases = [
    'read aloud',
    'read cloud',
    'read a cloud',
    'read allowed',
    'read a loud',
    'read out loud',
    'read form',
    'read the form',
    'read all',
    'read fields',
    'read this',
    'read page',
    'speak form',
    'speak aloud',
    'speak out loud',
    'speak',
    'read',
    'listen form',
    'listen',
    'पढो',
    'पढ़ो',
    'सुनाओ',
    'सुनाएं',
    'बोलकर सुनाओ',
    'फॉर्म पढ़ो',
    'படிக்க',
    'படியுங்கள்',
    'சொல்லுங்கள்',
    'చదువు',
    'వినండి',
    'পড়ো',
    'শোনাও',
    'वाचा',
    'વાંચો',
    'ಓದು',
    'വായിക്കൂ',
    'ਪੜ੍ਹੋ',
    'پڑھو'
  ];
  return readPhrases.some(phrase => t.includes(phrase) || t === phrase);
}

// Localized voice command instructions
export const VOICE_COMMAND_INSTRUCTIONS: Record<string, string> = {
  en: 'Command Mode: Say "Auto fill", "Download form", "Clear fields", "Copy data", "Read form", or "Submit"...',
  hi: 'कमांड मोड: बोलें "भरो", "डाउनलोड करो", "साफ करो", "कॉपी करो", "पढ़ो" या "जमा करो"...',
  ta: 'கட்டளை முறை: "நிரப்பு", "பதிவிறக்கு", "அழி", "நகலெடு", "படிக்க" அல்லது "சமர்ப்பி" என்று சொல்லுங்கள்...',
  te: 'కమాండ్ మోడ్: "నింపు", "డౌన్‌లోడ్", "క్లియర్", "కాపీ", "చదువు" లేదా "సమర్పించు" అని చెప్పండి...',
  bn: 'কমান্ড মোড: বলুন "পূরণ করো", "ডাউনলোড করো", "মুছে ফেলো", "কপি করো", "পড়ো" বা "জমা দাও"...',
  mr: 'कमांड मोड: बोला "भरा", "डाउनलोड करा", "साफ करा", "कॉपी करा", "वाचा" किंवा "सबमिट करा"...',
  gu: 'કમાન્ડ મોડ: બોલો "ભરો", "ડાઉનલોડ", "સાફ કરો", "કોપી", "વાંચો" અથવા "સબમિટ"...',
  kn: 'ಕಮಾಂಡ್ ಮೋಡ್: "ತುಂಬಿ", "ಡೌನ್‌ಲೋಡ್", "ತೆರವುಗೊಳಿಸಿ", "ನಕಲಿಸಿ", "ಓದು" ಅಥವಾ "ಸಲ್ಲಿಸು" ಎಂದು ಹೇಳಿ...',
  ml: 'കമാൻഡ് മോഡ്: "പൂരിപ്പിക്കൂ", "ഡൗൺലോഡ്", "മായ്ക്കുക", "പകർത്തുക", "വായിക്കൂ" അല്ലെങ്കിൽ "സമർപ്പിക്കൂ"...',
  pa: 'ਕਮਾਂਡ ਮੋਡ: ਬੋਲੋ "ਭਰੋ", "ਡਾਊਨਲੋਡ ਕਰੋ", "ਸਾਫ਼ ਕਰੋ", "ਕਾਪੀ ਕਰੋ", "ਪੜ੍ਹੋ" ਜਾਂ "ਜਮ੍ਹਾਂ ਕਰੋ"...',
  ur: 'کمانڈ موڈ: بولیں "بھرو"، "ڈاؤن لوڈ کریں"، "صاف کرو"، "کاپی کرو"، "پڑھو" یا "جمع کرو"...',
  // Non-Indian language entries removed
};

// Common field label translations
export const FIELD_TRANSLATIONS: Record<string, Record<string, string>> = {
  'full name': {
    hi: 'पूरा नाम',
    ta: 'முழு பெயர்',
    te: 'పూర్తి పేరు',
    bn: 'সম্পূর্ণ নাম',
    mr: 'पूर्ण नाव',
    gu: 'પૂરું નામ',
    kn: 'ಪೂರ್ಣ ಹೆಸರು',
    ml: 'പൂർണ്ണ പേര്',
    pa: 'ਪੂਰਾ ਨਾਮ',
    ur: 'پورا نام',
  },
  'email': {
    hi: 'ईमेल पता',
    ta: 'மின்னஞ்சல் முகவரி',
    te: 'ఈమెయిల్ చిరునామా',
    bn: 'ইমেল ঠিকানা',
    mr: 'ईमेल पत्ता',
    gu: 'ઈમેલ એડ્રેસ',
    kn: 'ಇಮೇಲ್ ವಿಳಾಸ',
    ml: 'ഇമെയിൽ വിലാസം',
    pa: 'ਈਮੇਲ ਪਤਾ',
    ur: 'ای میل ایڈریس',
  },
  'phone': {
    hi: 'फ़ोन नंबर',
    ta: 'தொலைபேசி எண்',
    te: 'ఫోన్ నంబర్',
    bn: 'ফোন নম্বর',
    mr: 'फोन नंबर',
    gu: 'ફોન નંબર',
    kn: 'ದೂರವಾಣಿ ಸಂಖ್ಯೆ',
    ml: 'ഫോൺ നമ്പർ',
    pa: 'ਫੋਨ ਨੰਬਰ',
    ur: 'فون نمبر',
  },
  'address': {
    hi: 'पता',
    ta: 'முகவரி',
    te: 'చిరునామా',
    bn: 'ঠিকানা',
    mr: 'पत्ता',
    gu: 'સરનામું',
    kn: 'ವಿಳಾಸ',
    ml: 'മേൽവിലാസം',
    pa: 'ਪਤਾ',
    ur: 'پتہ',
  },
  'date of birth': {
    hi: 'जन्म तिथि',
    ta: 'பிறந்த தேதி',
    te: 'పుట్టిన తేదీ',
    bn: 'জন্ম তারিখ',
    mr: 'जन्मतारीख',
    gu: 'જન્મ તારીખ',
    kn: 'ಹುಟ್ಟಿದ ದಿನಾಂಕ',
    ml: 'ജനന തീയതി',
    pa: 'ਜਨਮ ਮਿਤੀ',
    ur: 'تاریخ پیدائش',
  },
  'gender': {
    hi: 'लिंग',
    ta: 'பாலினம்',
    te: 'లింగం',
    bn: 'লিঙ্গ',
    mr: 'लिंग',
    gu: 'જાતિ',
    kn: 'ಲಿಂಗ',
    ml: 'ലിംഗം',
    pa: 'ਲਿੰਗ',
    ur: 'جنس',
  },
  'aadhaar number': {
    hi: 'आधार संख्या',
    ta: 'ஆதார் எண்',
    te: 'ఆధార్ సంఖ్య',
    bn: 'আধার নম্বর',
    mr: 'आधार क्रमांक',
    gu: 'આધાર નંબર',
    kn: 'ಆಧಾರ್ ಸಂಖ್ಯೆ',
    ml: 'ആധാർ നമ്പർ',
    pa: 'ਆਧਾਰ ਨੰਬਰ',
    ur: 'آدھار نمبر',
  },
  'pan number': {
    hi: 'पैन कार्ड नंबर',
    ta: 'பான் எண்',
    te: 'పాన్ సంఖ్య',
    bn: 'প্যান নম্বর',
    mr: 'पॅन क्रमांक',
    gu: 'પાન નંબર',
    kn: 'ಪ್ಯಾನ್ ಸಂಖ್ಯೆ',
    ml: 'പാൻ നമ്പർ',
    pa: 'ਪੈਨ ਨੰਬਰ',
    ur: 'پین نمبر',
  },
};

// Translate a field label into user's language
export function translateFieldLabel(label: string, langCode: string): string {
  if (langCode === 'en') return label;
  const key = label.trim().toLowerCase();
  if (FIELD_TRANSLATIONS[key] && FIELD_TRANSLATIONS[key][langCode]) {
    return FIELD_TRANSLATIONS[key][langCode];
  }
  return label;
}

// Localized Spoken Prompt for individual form field
export function formatFieldSpeech(
  fieldLabel: string,
  fieldValue: string,
  isRequired: boolean,
  langCode: string
): string {
  const localizedLabel = translateFieldLabel(fieldLabel, langCode);

  switch (langCode) {
    case 'hi':
      return fieldValue
        ? `फ़ील्ड: ${localizedLabel}। भरा हुआ मान है: ${fieldValue}।`
        : `सवाल: ${localizedLabel}। यह फ़ील्ड अभी खाली है। ${isRequired ? 'यह भरना अनिवार्य है।' : ''}`;
    case 'ta':
      return fieldValue
        ? `புலம்: ${localizedLabel}. பதிவு செய்யப்பட்ட மதிப்பு: ${fieldValue}.`
        : `கேள்வி: ${localizedLabel}. இந்த புலம் காலியாக உள்ளது. ${isRequired ? 'இது கட்டாயமாகும்.' : ''}`;
    case 'te':
      return fieldValue
        ? `ఫీల్డ్: ${localizedLabel}. నమోదు చేసిన విలువ: ${fieldValue}.`
        : `ప్రశ్న: ${localizedLabel}. ఈ ఫీల్డ్ ఖాళీగా ఉంది. ${isRequired ? 'ఇది తప్పనిసరి.' : ''}`;
    case 'bn':
      return fieldValue
        ? `ফিল্ড: ${localizedLabel}। বর্তমান মান: ${fieldValue}।`
        : `প্রশ্ন: ${localizedLabel}। এই ফিল্ডটি এখন খালি আছে। ${isRequired ? 'এটি পূরণ করা আবশ্যক।' : ''}`;
    case 'mr':
      return fieldValue
        ? `फील्ड: ${localizedLabel}. भरलेले मूल्य: ${fieldValue}.`
        : `प्रश्न: ${localizedLabel}. हे फील्ड रिकामे आहे. ${isRequired ? 'हे अनिवार्य आहे.' : ''}`;
    case 'gu':
      return fieldValue
        ? `ફીલ્ડ: ${localizedLabel}. ભરેલી કિંમત: ${fieldValue}.`
        : `પ્રશ્ન: ${localizedLabel}. આ ફીલ્ડ ખાલી છે. ${isRequired ? 'આ જરૂરી છે.' : ''}`;
    case 'kn':
      return fieldValue
        ? `ಕ್ಷೇತ್ರ: ${localizedLabel}. ನಮೂದಿಸಿದ ಮೌಲ್ಯ: ${fieldValue}.`
        : `ಪ್ರಶ್ನೆ: ${localizedLabel}. ಈ ಕ್ಷೇತ್ರವು ಖಾಲಿಯಾಗಿದೆ. ${isRequired ? 'ಇದು ಕಡ್ಡಾಯವಾಗಿದೆ.' : ''}`;
    case 'ml':
      return fieldValue
        ? `ഫീൽഡ്: ${localizedLabel}. നൽകിയ മൂല്യം: ${fieldValue}.`
        : `ചോദ്യം: ${localizedLabel}. ഈ ഫീൽഡ് ശൂന്യമാണ്. ${isRequired ? 'ഇത് നിർബന്ധമാണ്.' : ''}`;
    case 'pa':
      return fieldValue
        ? `ਖੇਤਰ: ${localizedLabel}। ਭਰਿਆ ਮੁੱਲ: ${fieldValue}।`
        : `ਸਵਾਲ: ${localizedLabel}। ਇਹ ਖੇਤਰ ਖਾਲੀ ਹੈ। ${isRequired ? 'ਇਹ ਲਾਜ਼ਮੀ ਹੈ।' : ''}`;
    case 'ur':
      return fieldValue
        ? `فیلڈ: ${localizedLabel}۔ بھرا ہوا ڈیٹا: ${fieldValue}۔`
        : `سوال: ${localizedLabel}۔ یہ فیلڈ فی الحال خالی ہے۔ ${isRequired ? 'یہ لازمی ہے۔' : ''}`;
    default:
      return fieldValue
        ? `Field: ${fieldLabel}. Current value is: ${fieldValue}.`
        : `Question: ${fieldLabel}. Field is empty. ${isRequired ? 'This field is required.' : ''}`;
  }
}

// Localized full form speech summary — now covers ALL supported languages
export function formatFormOverviewSpeech(
  formTitle: string,
  fields: { label: string; value?: string; required?: boolean }[],
  langCode: string
): string {
  const buildScript = (
    formWord: string,
    newFormWord: string,
    totalWord: string,
    fieldsWord: string,
    fieldWord: string,
    valueWord: string,
    emptyWord: string
  ) => {
    let script = `${formWord}: ${formTitle || newFormWord}. ${totalWord} ${fields.length} ${fieldsWord}. `;
    fields.forEach((f, i) => {
      const lbl = translateFieldLabel(f.label, langCode);
      script += `${fieldWord} ${i + 1}: ${lbl}. ${f.value ? valueWord + ': ' + f.value + '. ' : emptyWord + '. '}`;
    });
    return script;
  };

  switch (langCode) {
    case 'hi':
      return buildScript('फॉर्म', 'नया फॉर्म', 'कुल', 'फ़ील्ड हैं', 'फ़ील्ड', 'मान', 'खाली है');
    case 'ta':
      return buildScript('படிவம்', 'புதிய படிவம்', 'மொத்தம்', 'புலங்கள் உள்ளன', 'புலம்', 'மதிப்பு', 'காலியாக உள்ளது');
    case 'te':
      return buildScript('ఫారమ్', 'కొత్త ఫారమ్', 'మొత్తం', 'ఫీల్డులు ఉన్నాయి', 'ఫీల్డ్', 'విలువ', 'ఖాళీగా ఉంది');
    case 'bn':
      return buildScript('ফর্ম', 'নতুন ফর্ম', 'মোট', 'টি ফিল্ড আছে', 'ফিল্ড', 'মান', 'খালি');
    case 'mr':
      return buildScript('फॉर्म', 'नवीन फॉर्म', 'एकूण', 'फील्ड आहेत', 'फील्ड', 'मूल्य', 'रिकामे');
    case 'gu':
      return buildScript('ફોર્મ', 'નવું ફોર્મ', 'કુલ', 'ફીલ્ડ છે', 'ફીલ્ડ', 'કિંમત', 'ખાલી');
    case 'kn':
      return buildScript('ಫಾರ್ಮ್', 'ಹೊಸ ಫಾರ್ಮ್', 'ಒಟ್ಟು', 'ಕ್ಷೇತ್ರಗಳಿವೆ', 'ಕ್ಷೇತ್ರ', 'ಮೌಲ್ಯ', 'ಖಾಲಿ');
    case 'ml':
      return buildScript('ഫോം', 'പുതിയ ഫോം', 'ആകെ', 'ഫീൽഡുകൾ ഉണ്ട്', 'ഫീൽഡ്', 'മൂല്യം', 'ശൂന്യം');
    case 'pa':
      return buildScript('ਫਾਰਮ', 'ਨਵਾਂ ਫਾਰਮ', 'ਕੁੱਲ', 'ਖੇਤਰ ਹਨ', 'ਖੇਤਰ', 'ਮੁੱਲ', 'ਖਾਲੀ');
    case 'ur':
      return buildScript('فارم', 'نیا فارم', 'کل', 'فیلڈز ہیں', 'فیلڈ', 'قدر', 'خالی');
    default: {
      let script = `Form: ${formTitle || 'Form'}. There are ${fields.length} fields. `;
      fields.forEach((f, i) => {
        script += `Field ${i + 1}: ${f.label}. ${f.value ? 'Value: ' + f.value + '. ' : 'Blank. '}`;
      });
      return script;
    }
  }
}

// Localized system feedback messages
export function getLocalizedMessage(
  key: 'saved' | 'submitted' | 'autofilled' | 'recorded',
  langCode: string,
  extra?: string
): string {
  const map: Record<string, Record<string, string>> = {
    saved: {
      en: 'Form saved successfully.',
      hi: 'फॉर्म सफलतापूर्वक सहेजा गया।',
      ta: 'படிவம் வெற்றிகரமாக சேமிக்கப்பட்டது.',
      te: 'ఫారమ్ విజయవంతంగా సేవ్ చేయబడింది.',
      bn: 'ফর্ম সফলভাবে সংরক্ষিত হয়েছে।',
      mr: 'फॉर्म यशस्वीरित्या सेव्ह झाला.',
      gu: 'ફોર્મ સફળતાપૂર્વક સાચવવામાં આવ્યું.',
      kn: 'ಫಾರ್ಮ್ ಅನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಉಳಿಸಲಾಗಿದೆ.',
      ml: 'ഫോം വിജയകരമായി സംരക്ഷിച്ചു.',
      pa: 'ਫਾਰਮ ਸਫਲਤਾਪੂਰਵਕ ਸੁਰੱਖਿਅਤ ਕੀਤਾ ਗਿਆ।',
      ur: 'فارم کامیابی کے ساتھ محفوظ ہو گیا۔',
    },
    submitted: {
      en: 'Form submitted successfully.',
      hi: 'फॉर्म सफलतापूर्वक जमा किया गया।',
      ta: 'படிவம் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது.',
      te: 'ఫారమ్ విజయవంతంగా సమర్పించబడింది.',
      bn: 'ফর্ম সফলভাবে জমা দেওয়া হয়েছে।',
      mr: 'फॉर्म यशस्वीरित्या सबमिट केला.',
      gu: 'ફોર્મ સફળતાપૂર્વક સબમિટ કરવામાં આવ્યું.',
      kn: 'ಫಾರ್ಮ್ ಅನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಸಲಾಗಿದೆ.',
      ml: 'ഫോം വിജയകരമായി സമർപ്പിച്ചു.',
      pa: 'ਫਾਰਮ ਸਫਲਤਾਪੂਰਵਕ ਜਮ੍ਹਾਂ ਹੋ ਗਿਆ।',
      ur: 'فارم کامیابی سے جمع کر دیا گیا ہے۔',
    },
    autofilled: {
      en: 'Auto-fill applied from your profile and documents.',
      hi: 'आपकी प्रोफ़ाइल और दस्तावेज़ों से जानकारी भर दी गई है।',
      ta: 'உங்கள் சுயவிவரம் மற்றும் ஆவணங்களிலிருந்து தகவல்கள் நிரப்பப்பட்டன.',
      te: 'మీ ప్రొఫైల్ మరియు పత్రాల నుండి వివరాలు నింపబడ్డాయి.',
      bn: 'আপনার প্রোফাইল ও নথি থেকে তথ্য পূরণ করা হয়েছে।',
      mr: 'तुमच्या प्रोफाइल आणि कागदपत्रांमधून माहिती भरली गेली.',
      gu: 'તમારી પ્રોફાઇલ અને દસ્તાવેજોમાંથી વિગતો ભરાઈ ગઈ છે.',
      kn: 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಮತ್ತು ದಾಖಲೆಗಳಿಂದ ಮಾಹಿತಿ ತುಂಬಲಾಗಿದೆ.',
      ml: 'നിങ്ങളുടെ പ്രൊഫൈലിൽ നിന്നും വിവരങ്ങൾ പൂരിപ്പിച്ചു.',
      pa: 'ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਤੋਂ ਜਾਣਕਾਰੀ ਭਰੀ ਗਈ ਹੈ।',
      ur: 'آپ کے پروفائل سے ڈیٹا درج کر دیا گیا ہے۔',
    },
    recorded: {
      en: `Recorded: ${extra || ''}`,
      hi: `रिकॉर्ड किया गया: ${extra || ''}`,
      ta: `பதிவு செய்யப்பட்டது: ${extra || ''}`,
      te: `నమోదు చేయబడింది: ${extra || ''}`,
      bn: `রেকর্ড করা হয়েছে: ${extra || ''}`,
      mr: `नोंदवले: ${extra || ''}`,
      gu: `નોંધાયું: ${extra || ''}`,
      kn: `ದಾಖಲಿಸಲಾಗಿದೆ: ${extra || ''}`,
      ml: `രേഖപ്പെടുത്തി: ${extra || ''}`,
      pa: `ਦਰਜ ਕੀਤਾ ਗਿਆ: ${extra || ''}`,
      ur: `درج کیا گیا: ${extra || ''}`,
    },
  };

  return map[key]?.[langCode] || map[key]?.['en'] || '';
}

// Voice cache and initialization
let cachedVoices: SpeechSynthesisVoice[] = [];

// British English voice patterns to exclude (applied strictly to English voices only)
const BRITISH_VOICE_PATTERNS = [
  'en-gb', 'en_gb', 'en-uk', 'en_uk', 'en-au', 'en_au', 'en-nz', 'en-nz',
  'en-za', 'en_za', 'en-ie', 'en_ie', 'en-sc', 'en_sc', 'en-wls', 'en-ni',
  'united kingdom', 'great britain', 'england', 'scotland', 'wales',
  'british', 'george', 'hazel', 'susan', 'ryan', 'oliver', 'sonia', 'libby',
];

// British English voice patterns: Requirement 2 explicitly permits en-IN and en-GB for English
export function isBritishVoice(voice: SpeechSynthesisVoice): boolean {
  // Requirement 2 specifies matching voices e.g. en-IN / en-GB for English
  return false;
}

function initVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const list = window.speechSynthesis.getVoices();
  if (list && list.length > 0) {
    cachedVoices = Array.from(list);
  }
}

// Listen for dynamic voice loading in Chromium/Edge/Firefox
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  initVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    initVoices();
  };
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const list = window.speechSynthesis.getVoices();
  if (list && list.length > 0) {
    cachedVoices = Array.from(list);
  }
  return cachedVoices;
}

// Common language name aliases in voice titles across platforms
export const VOICE_LANG_KEYWORDS: Record<string, string[]> = {
  hi: ['hindi', 'हिन्दी', 'swara', 'madhur', 'kalpana', 'hemant', 'hi-in'],
  ta: ['tamil', 'தமிழ்', 'valluvar', 'ta-in'],
  te: ['telugu', 'తెలుగు', 'mohan', 'te-in'],
  bn: ['bengali', 'বাংলা', 'tapan', 'bashkar', 'bn-in', 'bn-bd'],
  mr: ['marathi', 'मराठी', 'aarohi', 'mr-in'],
  gu: ['gujarati', 'ગુજરાતી', 'dhwani', 'gu-in'],
  kn: ['kannada', 'ಕನ್ನಡ', 'gagan', 'kn-in'],
  ml: ['malayalam', 'മലയാളം', 'midhun', 'ml-in'],
  pa: ['punjabi', 'ਪੰਜਾਬੀ', 'pa-in'],
  ur: ['urdu', 'اردو', 'salman', 'uzma', 'ur-in', 'ur-pk'],
  en: ['english', 'en-in', 'en-gb', 'en-us', 'david', 'zira', 'mark', 'ravi', 'heera', 'guy', 'jenny', 'aria'],
};

/**
 * Requirement 2: Returns only voices matching the selected language
 * (e.g. hi-IN for Hindi, en-IN/en-GB for English).
 */
export function getMatchingVoicesForLanguage(
  langCode: string,
  voicesList?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice[] {
  const safeLang = sanitizeLanguage(langCode);
  const voices = voicesList || getAvailableVoices();
  const prefix = safeLang.toLowerCase();
  const targetBcp47 = getLanguageBcp47(safeLang).toLowerCase();
  const keywords = VOICE_LANG_KEYWORDS[prefix] || [prefix];

  if (prefix === 'en') {
    return voices.filter((v) => {
      const l = (v.lang || '').toLowerCase().replace(/_/g, '-');
      const n = (v.name || '').toLowerCase();
      return (
        l.startsWith('en') ||
        l === 'en-in' ||
        l === 'en-gb' ||
        l === 'en-us' ||
        n.includes('english')
      );
    });
  }

  return voices.filter((v) => {
    const l = (v.lang || '').toLowerCase().replace(/_/g, '-');
    const n = (v.name || '').toLowerCase();
    if (l === targetBcp47 || l.startsWith(prefix)) return true;
    return keywords.some((k) => n.includes(k.toLowerCase()) || l.includes(k.toLowerCase()));
  });
}

// Dedicated helper to locate installed Google Hindi voice if present
export function getInstalledGoogleHindiVoice(voicesList?: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const voices = voicesList || getAvailableVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Google Hindi voice (Google हिन्दी or Google Hindi)
  const googleHindi = voices.find(v => {
    const n = v.name.toLowerCase();
    const l = v.lang.toLowerCase().replace(/_/g, '-');
    const isGoogle = n.includes('google') || (v.voiceURI && v.voiceURI.toLowerCase().includes('google'));
    const isHindi = n.includes('हिन्दी') || n.includes('hindi') || l.startsWith('hi');
    return isGoogle && isHindi;
  });
  if (googleHindi) return googleHindi;

  // 2. Any voice named Google हिन्दी or Google Hindi
  const nameMatch = voices.find(v => {
    const n = v.name.toLowerCase();
    return n.includes('google हिन्दी') || n.includes('google hindi');
  });
  if (nameMatch) return nameMatch;

  // 3. Fallback to any Hindi voice
  const anyHindi = voices.find(v => {
    const n = v.name.toLowerCase();
    const l = v.lang.toLowerCase().replace(/_/g, '-');
    return l.startsWith('hi') || n.includes('हिन्दी') || n.includes('hindi');
  });
  return anyHindi || null;
}

export interface VoiceResolution {
  matchingVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  isFallbackToHindi: boolean;
  fallbackNote: string | null;
  hasNativeVoice: boolean;
}

/**
 * Requirement 2: Determines available matching voices for the selected language.
 * If no voice exists for the selected language, falls back to the Hindi (hi-IN) voice
 * and provides a short note that pronunciation may differ.
 */
export function getVoiceResolution(
  langCode: string,
  voicesList?: SpeechSynthesisVoice[],
  preferredVoiceURI?: string
): VoiceResolution {
  const safeLang = sanitizeLanguage(langCode);
  const voices = voicesList || getAvailableVoices();
  const directMatches = getMatchingVoicesForLanguage(safeLang, voices);

  if (directMatches.length > 0) {
    let chosen: SpeechSynthesisVoice | null = null;
    if (preferredVoiceURI) {
      chosen = directMatches.find((v) => v.voiceURI === preferredVoiceURI) || null;
    }
    if (!chosen) {
      chosen = findBestVoiceForLanguage(safeLang, preferredVoiceURI, directMatches) || directMatches[0];
    }
    return {
      matchingVoices: directMatches,
      selectedVoice: chosen,
      isFallbackToHindi: false,
      fallbackNote: null,
      hasNativeVoice: true,
    };
  }

  // No native voice for this language: fall back to Hindi (hi-IN) voice per Requirement 2
  const hindiMatches = getMatchingVoicesForLanguage('hi', voices);
  const hindiVoice =
    (preferredVoiceURI ? hindiMatches.find((v) => v.voiceURI === preferredVoiceURI) : null) ||
    findBestVoiceForLanguage('hi', undefined, hindiMatches) ||
    hindiMatches[0] ||
    getInstalledGoogleHindiVoice(voices) ||
    null;

  return {
    matchingVoices: hindiVoice ? [hindiVoice] : [],
    selectedVoice: hindiVoice,
    isFallbackToHindi: safeLang !== 'hi' && Boolean(hindiVoice),
    fallbackNote:
      safeLang !== 'hi'
        ? `Pronunciation may differ (using Hindi hi-IN fallback voice as no native voice is installed for ${getLanguageOption(safeLang).label}).`
        : 'No voice installed for Hindi on this system.',
    hasNativeVoice: false,
  };
}

// Find the best matching browser voice for any supported language
export function findBestVoiceForLanguage(
  langCode: string,
  preferredVoiceURI?: string,
  voicesList?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const voices = voicesList || getAvailableVoices();
  if (voices.length === 0) return null;

  const safeLang = sanitizeLanguage(langCode);
  const targetBcp47 = getLanguageBcp47(safeLang).toLowerCase(); // e.g. 'hi-in'
  const langPrefix = safeLang.toLowerCase();

  // 1. Check explicitly saved voice for this language
  const customSavedURI = preferredVoiceURI || (typeof window !== 'undefined' ? localStorage.getItem(`tfb_voice_${safeLang}`) : null);
  if (customSavedURI) {
    const customMatch = voices.find(v => v.voiceURI === customSavedURI);
    if (customMatch) return customMatch;
  }

  // 2. Language-specific preference for Hindi (if Google Hindi voice is available)
  if (langPrefix === 'hi') {
    const googleHindiVoice = getInstalledGoogleHindiVoice(voices);
    if (googleHindiVoice) {
      return googleHindiVoice;
    }
  }

  // 3. For English: prioritize Indian English (en-IN), then British (en-GB), then US (en-US)
  if (langPrefix === 'en') {
    const englishVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
    const inVoice = englishVoices.find(v => (v.lang || '').toLowerCase().includes('en-in') || v.name.toLowerCase().includes('india'));
    if (inVoice) return inVoice;
    const gbVoice = englishVoices.find(v => (v.lang || '').toLowerCase().includes('en-gb'));
    if (gbVoice) return gbVoice;
    const usVoice = englishVoices.find(v => (v.lang || '').toLowerCase().includes('en-us'));
    if (usVoice) return usVoice;
    const defaultVoice = englishVoices.find(v => v.default);
    if (defaultVoice) return defaultVoice;
    return englishVoices[0] || null;
  }

  // 4. Exact BCP-47 match (e.g. 'hi-IN' or 'hi_IN')
  const exactMatch = voices.find(v => {
    const vLang = v.lang.toLowerCase().replace(/_/g, '-');
    return vLang === targetBcp47;
  });
  if (exactMatch) return exactMatch;

  // 5. Prefer Google or Natural voice that matches the SELECTED language
  const highQualityVoiceForLang = voices.find(v => {
    const n = v.name.toLowerCase();
    const l = v.lang.toLowerCase().replace(/_/g, '-');
    const isHQ = n.includes('google') || n.includes('natural') || n.includes('online') || (v.voiceURI && v.voiceURI.toLowerCase().includes('google'));
    if (!isHQ) return false;
    return l.startsWith(langPrefix) || l === targetBcp47;
  });
  if (highQualityVoiceForLang) return highQualityVoiceForLang;

  // 6. Language code prefix match (e.g. 'hi')
  const prefixMatch = voices.find(v => {
    const vLang = v.lang.toLowerCase().replace(/_/g, '-');
    return vLang.startsWith(langPrefix);
  });
  if (prefixMatch) return prefixMatch;

  // 7. Voice name contains language keywords
  const keywords = VOICE_LANG_KEYWORDS[langPrefix] || [langPrefix];
  const nameMatch = voices.find(v => {
    const lowerName = v.name.toLowerCase();
    return keywords.some(k => lowerName.includes(k.toLowerCase()));
  });
  if (nameMatch) return nameMatch;

  // 8. Requirement 2: If no voice exists for selected language, FALL BACK to Hindi (hi-IN) voice!
  if (langPrefix !== 'hi') {
    const fallbackHindi = getInstalledGoogleHindiVoice(voices) || voices.find(v => {
      const l = v.lang.toLowerCase().replace(/_/g, '-');
      const n = v.name.toLowerCase();
      return l.startsWith('hi') || n.includes('hindi') || n.includes('हिन्दी');
    });
    if (fallbackHindi) {
      return fallbackHindi;
    }
  }

  return null;
}

// Playback session state tracking for cancellation and concurrency protection
let currentPlaybackSessionId = 0;
let activeAudioElement: HTMLAudioElement | null = null;
let activeAudioObjectUrl: string | null = null;
let activeAbortController: AbortController | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let isUtteranceCanceled = false;

// Last playback diagnostic details
let lastDiagnosticLanguage = 'en';
let lastDiagnosticProvider = 'none';

/**
 * Cleanup active audio element and revoke Object URLs to prevent memory leaks.
 */
function cleanupAudioResources(): void {
  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {}
    activeAbortController = null;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
      activeAudioElement.onplay = null;
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.src = '';
    } catch {}
    activeAudioElement = null;
  }

  if (activeAudioObjectUrl) {
    try {
      URL.revokeObjectURL(activeAudioObjectUrl);
    } catch {}
    activeAudioObjectUrl = null;
  }
}

/**
 * Split text into chunks for safe speech delivery (supports all 17 languages and scripts).
 */
export function splitIntoChunks(text: string, maxLen: number = 150): string[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  const delimiterRegex = /([^।॥۔؟،؛。！？；，、.?!\n\r;:,"'()]+[।॥۔؟،؛。！？；，、.?!\n\r;:,"'()]*)/gu;
  const segments: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = delimiterRegex.exec(trimmed)) !== null) {
    const s = match[0].trim();
    if (s) segments.push(s);
  }

  if (segments.length === 0) {
    segments.push(trimmed);
  }

  const atomicParts: string[] = [];
  for (const seg of segments) {
    if (seg.length <= maxLen) {
      atomicParts.push(seg);
    } else if (seg.includes(' ')) {
      const words = seg.split(/\s+/);
      let buf = '';
      for (const w of words) {
        if (!w) continue;
        if (buf.length + w.length + 1 <= maxLen) {
          buf = buf ? `${buf} ${w}` : w;
        } else {
          if (buf) atomicParts.push(buf);
          if (w.length > maxLen) {
            for (let i = 0; i < w.length; i += maxLen) {
              atomicParts.push(w.slice(i, i + maxLen));
            }
            buf = '';
          } else {
            buf = w;
          }
        }
      }
      if (buf) atomicParts.push(buf);
    } else {
      const chars = Array.from(seg);
      for (let i = 0; i < chars.length; i += maxLen) {
        atomicParts.push(chars.slice(i, i + maxLen).join(''));
      }
    }
  }

  const chunks: string[] = [];
  let currentChunk = '';
  for (const part of atomicParts) {
    if (!currentChunk) {
      currentChunk = part;
    } else if (currentChunk.length + part.length + 1 <= maxLen) {
      currentChunk += ' ' + part;
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = part;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Secondary fallback: Play text via browser SpeechSynthesis when audio stream is unavailable.
 */
function playBrowserSynthesisFallback(
  text: string,
  langCode: string,
  onStart?: () => void,
  onEnd?: () => void
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      resolve(false);
      return;
    }

    try {
      const targetBcp47 = getLanguageBcp47(langCode);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetBcp47;

      const matchingVoice = findBestVoiceForLanguage(langCode);
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => {
        lastDiagnosticProvider = 'browser-speech-fallback';
        onStart?.();
      };

      utterance.onend = () => {
        activeUtterance = null;
        onEnd?.();
        resolve(true);
      };

      utterance.onerror = (e) => {
        activeUtterance = null;
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn(`[TechForm Buddy Speech] Browser speech fallback error for ${langCode}:`, e.error);
        }
        onEnd?.();
        resolve(false);
      };

      activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn(`[TechForm Buddy Speech] Failed to start browser synthesis fallback:`, err);
      onEnd?.();
      resolve(false);
    }
  });
}

/**
 * Play native high-fidelity audio stream from /api/tts with response validation,
 * object URL lifecycle management, and fallback handling.
 */
async function playNativeAudioStream(
  text: string,
  langCode: string,
  onStart?: () => void,
  onEnd?: () => void,
  allowFallbackToBrowserSynthesis: boolean = true
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const trimmed = text.trim();
  if (!trimmed) {
    onEnd?.();
    return false;
  }

  // Increment session ID to cancel any prior in-flight fetch or audio
  const sessionId = ++currentPlaybackSessionId;
  cleanupAudioResources();

  const abortController = new AbortController();
  activeAbortController = abortController;
  lastDiagnosticLanguage = langCode;

  try {
    // Attempt audio fetch via POST (supports large Unicode text without URI truncation)
    let res: Response;
    try {
      res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, lang: langCode }),
        signal: abortController.signal,
      });
    } catch (fetchErr: unknown) {
      if ((fetchErr as Error)?.name === 'AbortError' || sessionId !== currentPlaybackSessionId) {
        return false;
      }
      // Retry via GET fallback if POST failed (e.g. proxy environment)
      const getUrl = `/api/tts?lang=${encodeURIComponent(langCode)}&text=${encodeURIComponent(trimmed.slice(0, 500))}`;
      res = await fetch(getUrl, { signal: abortController.signal });
    }

    if (sessionId !== currentPlaybackSessionId) {
      return false;
    }

    if (!res.ok) {
      throw new Error(`TTS API returned status ${res.status}`);
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('audio') && !contentType.includes('mpeg') && !contentType.includes('octet-stream')) {
      throw new Error(`TTS API returned non-audio Content-Type: ${contentType}`);
    }

    const blob = await res.blob();
    if (sessionId !== currentPlaybackSessionId) {
      return false;
    }

    if (!blob || blob.size < 32) {
      throw new Error('TTS API returned empty or truncated audio');
    }

    const objectUrl = URL.createObjectURL(blob);
    activeAudioObjectUrl = objectUrl;

    const audio = new Audio();
    activeAudioElement = audio;
    audio.src = objectUrl;
    lastDiagnosticProvider = 'native-audio-stream';

    let hasStarted = false;

    return await new Promise<boolean>((resolve) => {
      audio.onplay = () => {
        if (!hasStarted) {
          hasStarted = true;
          onStart?.();
        }
      };

      audio.onended = () => {
        if (sessionId === currentPlaybackSessionId) {
          cleanupAudioResources();
          onEnd?.();
          resolve(true);
        }
      };

      audio.onerror = (err) => {
        if (sessionId !== currentPlaybackSessionId) return;
        console.warn(`[TechForm Buddy Speech] Native audio element error for ${langCode}:`, err);
        cleanupAudioResources();

        if (allowFallbackToBrowserSynthesis && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          playBrowserSynthesisFallback(trimmed, langCode, onStart, onEnd).then(resolve);
        } else {
          onEnd?.();
          resolve(false);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((playErr: unknown) => {
          if (sessionId !== currentPlaybackSessionId) return;
          const isAutoplay = (playErr as Error)?.name === 'NotAllowedError';
          if (isAutoplay) {
            console.warn('[TechForm Buddy Speech] Audio playback prevented by browser autoplay policy. User gesture required.');
          } else {
            console.warn('[TechForm Buddy Speech] Audio playback error:', playErr);
          }
          cleanupAudioResources();
          onEnd?.();
          resolve(false);
        });
      }
    });
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError' || sessionId !== currentPlaybackSessionId) {
      return false;
    }
    console.warn(`[TechForm Buddy Speech] Audio stream failed for ${langCode}:`, (err as Error)?.message || err);
    cleanupAudioResources();

    if (allowFallbackToBrowserSynthesis && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return playBrowserSynthesisFallback(trimmed, langCode, onStart, onEnd);
    }
    onEnd?.();
    return false;
  }
}

/**
 * Immediately stops all active speech playback, clears pending queues,
 * and releases audio resources.
 */
export function stopSpeaking(): void {
  currentPlaybackSessionId++;
  isUtteranceCanceled = true;
  cleanupAudioResources();

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    activeUtterance = null;
  }
}

/**
 * Universal speech synthesis entry point for all supported languages.
 * Automatically chooses the best voice or stream provider with robust fallback protection.
 */
export function speakText(
  text: string,
  langCode: string = 'en',
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  stopSpeaking();

  if (!text || text.trim() === '') return false;

  isUtteranceCanceled = false;
  lastDiagnosticLanguage = langCode;

  const targetBcp47 = getLanguageBcp47(langCode);
  const bestVoice = findBestVoiceForLanguage(langCode);

  // If no matching installed voice is available for this language,
  // use the high-quality native audio stream directly as primary provider.
  if (!bestVoice) {
    lastDiagnosticProvider = 'native-audio-stream';
    playNativeAudioStream(text, langCode, onStart, onEnd, true);
    return true;
  }

  if (!('speechSynthesis' in window)) {
    lastDiagnosticProvider = 'native-audio-stream';
    playNativeAudioStream(text, langCode, onStart, onEnd, false);
    return true;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetBcp47;
    utterance.voice = bestVoice;
    if (bestVoice.lang && bestVoice.lang.toLowerCase().startsWith(langCode.toLowerCase())) {
      utterance.lang = bestVoice.lang;
    }

    let rate = 1.0;
    const savedRate = localStorage.getItem('tfb_rate');
    if (savedRate) {
      const parsed = parseFloat(savedRate);
      if (!isNaN(parsed) && parsed > 0) rate = parsed;
    }
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const windowWithUtterance = window as unknown as { __currentUtterance?: SpeechSynthesisUtterance | null };
    windowWithUtterance.__currentUtterance = utterance;

    let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

    utterance.onstart = () => {
      lastDiagnosticProvider = `browser-voice:${bestVoice.name}`;
      activeUtterance = utterance;
      onStart?.();

      keepAliveInterval = setInterval(() => {
        if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 3000);
    };

    utterance.onend = () => {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      activeUtterance = null;
      windowWithUtterance.__currentUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      activeUtterance = null;
      windowWithUtterance.__currentUtterance = null;

      // DO NOT fall back if canceled or interrupted by user or new speech request!
      if (isUtteranceCanceled || e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }

      console.warn(`[TechForm Buddy Speech] Browser voice error (${e.error}), falling back to native audio stream`);
      playNativeAudioStream(text, langCode, onStart, onEnd, false);
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('[TechForm Buddy Speech] Speech synthesis exception, falling back to native audio stream:', err);
    playNativeAudioStream(text, langCode, onStart, onEnd, false);
    return true;
  }
}

/**
 * Requirement 4: Reads text aloud in the user's selected language.
 * Whatever is on screen (portal text in any language, labels, instructions, errors,
 * AI assistant answers), translates the text first through the backend
 * (preserving proper nouns, form numbers, IDs, amounts, and dates; cached per text+language),
 * shows the translated text, then speaks it with the matching voice (or fallback Hindi voice).
 * If translation fails, speaks and displays the failure notice instead of reading the wrong language.
 */
export async function readAloudInSelectedLanguage(
  text: string,
  targetLang: string,
  options?: {
    onTranslatedText?: (translated: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (errMessage: string) => void;
  }
): Promise<boolean> {
  const safeLang = sanitizeLanguage(targetLang);
  if (!text || !text.trim()) return false;

  let textToSpeak = text.trim();

  if (safeLang !== 'en') {
    const translationResult = await translateFromEnglish(textToSpeak, safeLang);
    if (!translationResult.success) {
      // Translation failed: announce failure notice instead of reading the wrong language!
      const failureNotice = translationResult.text || getTranslationFailureMessage(safeLang);
      options?.onTranslatedText?.(failureNotice);
      options?.onError?.(failureNotice);
      return speakText(failureNotice, safeLang, options?.onStart, options?.onEnd);
    }
    textToSpeak = translationResult.text;
  }

  options?.onTranslatedText?.(textToSpeak);
  return speakText(textToSpeak, safeLang, options?.onStart, options?.onEnd);
}

export function isSpeaking(): boolean {
  if (activeAudioElement && !activeAudioElement.paused && !activeAudioElement.ended) {
    return true;
  }
  if (activeUtterance) {
    return true;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

export interface SpeechDiagnostics {
  supportedLanguagesCount: number;
  availableVoicesCount: number;
  lastLanguageUsed: string;
  lastProviderUsed: string;
  isAudioActive: boolean;
  isSynthesisActive: boolean;
}

export function getSpeechDiagnostics(): SpeechDiagnostics {
  const voices = getAvailableVoices();
  return {
    supportedLanguagesCount: SUPPORTED_LANGUAGES.length,
    availableVoicesCount: voices.length,
    lastLanguageUsed: lastDiagnosticLanguage,
    lastProviderUsed: lastDiagnosticProvider,
    isAudioActive: Boolean(activeAudioElement && !activeAudioElement.paused && !activeAudioElement.ended),
    isSynthesisActive: typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.speaking : false,
  };
}

if (typeof window !== 'undefined') {
  (window as unknown as { __TechFormBuddySpeech?: unknown }).__TechFormBuddySpeech = {
    speakText,
    readAloudInSelectedLanguage,
    stopSpeaking,
    isSpeaking,
    getSpeechDiagnostics,
    SUPPORTED_LANGUAGES,
    findBestVoiceForLanguage,
    getAvailableVoices,
    getMatchingVoicesForLanguage,
    getVoiceResolution,
  };
}

// Smart form field analysis: maps portal field names/labels strictly to profile keys with negative disqualifiers
// Enforces Hard Rule 4 (sensitive fields manual) and Hard Rule 6 (never guess on low confidence)

interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

export interface AnalyzedFieldOutput {
  fieldName: string;
  label: string;
  profileKey: string | null;
  value: string;
  canFill: boolean;
  manual?: boolean;
  sensitive?: boolean;
  message?: string;
}

/**
 * Strict semantic analyzing layer for form fields against user profile data.
 * Prevents placing saved information into mismatched fields.
 */
export function analyzeFormFields(
  fields: FieldDefinition[],
  profileData: Record<string, string>
): AnalyzedFieldOutput[] {
  return fields.map(field => {
    const rawLabel = (field.label || '').trim();
    const rawName = (field.name || '').trim();
    const rawType = (field.type || 'text').toLowerCase();
    const corpus = `${rawLabel} ${rawName}`.toLowerCase();

    // 1. HARD RULE 4 & 3: Sensitive identification/financial/security fields
    // NEVER fill Aadhaar, PAN, passport, bank account, card, password, OTP, captcha
    const isSensitive = /\b(aadhaar|aadhar|uidai|pan|permanent\s+account\s+number|passport|bank\s+acc|account\s+no|ifsc|cvv|card\s+number|credit\s+card|debit\s+card|password|pin|otp|captcha)\b/i.test(corpus);
    if (isSensitive) {
      return {
        fieldName: rawName,
        label: rawLabel,
        profileKey: null,
        value: '',
        canFill: false,
        manual: true,
        sensitive: true,
        message: 'Sensitive field (Aadhaar/PAN/Passport/Card/Bank) - Please type this yourself',
      };
    }

    // File inputs must always be manual
    if (rawType === 'file') {
      return {
        fieldName: rawName,
        label: rawLabel,
        profileKey: null,
        value: '',
        canFill: false,
        manual: true,
        sensitive: false,
        message: 'File upload requires manual file selection',
      };
    }

    let profileKey: string | null = null;
    let value = '';

    // Helper to test negative disqualifiers
    const hasDisqualifier = (disqualifiers: RegExp[]) => disqualifiers.some(rx => rx.test(corpus));

    // 2. Email Address
    if (!profileKey && (rawType === 'email' || /\be[\s_-]?mail(\s+id|\s+address)?\b/i.test(corpus) || /\bईमेल\b/i.test(corpus))) {
      const disqualifiers = [/\b(phone|mobile|fax|street|residential|postal|office|father|mother)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['email']?.trim()) {
        profileKey = 'email';
        value = profileData['email'].trim();
      }
    }

    // 3. Mobile / Phone Number
    if (!profileKey && (rawType === 'tel' || /\b(mobile|phone|contact[\s_-]?number|मोबाइल|दूरभाष)\b/i.test(corpus))) {
      const disqualifiers = [/\b(fax|emergency|alt|alternate|secondary|father|mother|guardian|office|work|landline|pincode)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['phone']?.trim()) {
        profileKey = 'phone';
        value = profileData['phone'].trim();
      }
    }

    // 4. Father's Name (Strict role isolation)
    if (!profileKey && (/\bfather('?s)?[\s_-]?name\b/i.test(corpus) || /\bपिता[\s_-]?का[\s_-]?नाम\b/i.test(corpus) || /\bपिता\b/i.test(corpus))) {
      const disqualifiers = [/\b(mother|spouse|applicant|nominee)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['father_name']?.trim()) {
        profileKey = 'father_name';
        value = profileData['father_name'].trim();
      }
    }

    // 5. Mother's Name (Strict role isolation)
    if (!profileKey && (/\bmother('?s)?[\s_-]?name\b/i.test(corpus) || /\bमाता[\s_-]?का[\s_-]?नाम\b/i.test(corpus) || /\bमाता\b/i.test(corpus))) {
      const disqualifiers = [/\b(father|spouse|applicant|nominee)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['mother_name']?.trim()) {
        profileKey = 'mother_name';
        value = profileData['mother_name'].trim();
      }
    }

    // 6. Spouse Name
    if (!profileKey && (/\bspouse('?s)?[\s_-]?name\b/i.test(corpus) || /\bhusband('?s)?[\s_-]?name\b/i.test(corpus) || /\bwife('?s)?[\s_-]?name\b/i.test(corpus) || /\bपति\/?पत्नी\b/i.test(corpus))) {
      if (profileData['spouse_name']?.trim()) {
        profileKey = 'spouse_name';
        value = profileData['spouse_name'].trim();
      }
    }

    // 7. Date of Birth
    if (!profileKey && (rawType === 'date' || /\b(date\s+of\s+birth|birth[\s_-]?date|d\.?o\.?b\.?|जन्म[\s_-]?तिथि|जन्म[\s_-]?तारीख)\b/i.test(corpus))) {
      const disqualifiers = [/\b(issue|expiry|expire|validity|valid|registration|admission|joining|leaving|event|today|transaction|receipt|dispatch|order|invoice)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['date_of_birth']?.trim()) {
        profileKey = 'date_of_birth';
        value = profileData['date_of_birth'].trim();
      }
    }

    // 8. Applicant First Name
    if (!profileKey && rawType !== 'email' && rawType !== 'tel' && rawType !== 'date') {
      if (/\b(first[\s_-]?name|given[\s_-]?name|forename|प्रथम[\s_-]?नाम)\b/i.test(corpus)) {
        const disqualifiers = [/\b(last|middle|father|mother|parent|spouse|guardian|nominee|witness|bank|branch|college|school|company|hospital|doctor|user|login)\b/i];
        if (!hasDisqualifier(disqualifiers)) {
          const fn = profileData['first_name'] || (profileData['full_name'] ? profileData['full_name'].split(' ')[0] : '');
          if (fn.trim()) {
            profileKey = 'first_name';
            value = fn.trim();
          }
        }
      }
    }

    // 9. Applicant Last Name
    if (!profileKey && rawType !== 'email' && rawType !== 'tel' && rawType !== 'date') {
      if (/\b(last[\s_-]?name|surname|family[\s_-]?name|उपनाम)\b/i.test(corpus)) {
        const disqualifiers = [/\b(first|middle|father|mother|parent|spouse|guardian|nominee|witness|bank|branch|college|school|company|hospital|doctor|user|login)\b/i];
        if (!hasDisqualifier(disqualifiers)) {
          const ln = profileData['last_name'] || profileData['surname'] || (profileData['full_name'] ? profileData['full_name'].split(' ').slice(1).join(' ') : '');
          if (ln.trim()) {
            profileKey = 'last_name';
            value = ln.trim();
          }
        }
      }
    }

    // 10. Applicant Full Name (Strict: must NOT be organization, institution, relative, or system field)
    if (!profileKey && rawType !== 'email' && rawType !== 'tel' && rawType !== 'date') {
      const isApplicantName =
        /\b(full[\s_-]?name|applicant[\s_-]?name|candidate[\s_-]?name|student[\s_-]?name|पूरा[\s_-]?नाम)\b/i.test(corpus) ||
        (corpus === 'name' || corpus === 'नाम' || rawName === 'fullName' || rawName === 'applicantName');

      if (isApplicantName) {
        const disqualifiers = [
          /\b(first|last|middle|father|mother|parent|spouse|husband|wife|guardian|nominee|witness|employer|company|firm|org|organization|bank|branch|college|school|university|institute|hospital|doctor|ref|reference|user|username|login|scheme|service|project|file|document)\b/i,
        ];
        if (!hasDisqualifier(disqualifiers) && profileData['full_name']?.trim()) {
          profileKey = 'full_name';
          value = profileData['full_name'].trim();
        }
      }
    }

    // 11. Gender
    if (!profileKey && /\b(gender|sex|लिंग)\b/i.test(corpus)) {
      if (profileData['gender']?.trim()) {
        profileKey = 'gender';
        value = profileData['gender'].trim();
      }
    }

    // 12. Blood Group
    if (!profileKey && /\b(blood[\s_-]?group|blood[\s_-]?type|रक्त[\s_-]?समूह)\b/i.test(corpus)) {
      if (profileData['blood_group']?.trim()) {
        profileKey = 'blood_group';
        value = profileData['blood_group'].trim();
      }
    }

    // 13. Marital Status
    if (!profileKey && /\b(marital[\s_-]?status|वैवाहिक[\s_-]?स्थिति)\b/i.test(corpus)) {
      if (profileData['marital_status']?.trim()) {
        profileKey = 'marital_status';
        value = profileData['marital_status'].trim();
      }
    }

    // 14. Occupation
    if (!profileKey && /\b(occupation|profession|व्यवसाय|पेशा)\b/i.test(corpus)) {
      const disqualifiers = [/\b(father|mother|spouse)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['occupation']?.trim()) {
        profileKey = 'occupation';
        value = profileData['occupation'].trim();
      }
    }

    // 15. City / District
    if (!profileKey && /\b(city|town|district|शहर|जिला)\b/i.test(corpus)) {
      const disqualifiers = [/\b(state|country|pincode|zip|address|street)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['city']?.trim()) {
        profileKey = 'city';
        value = profileData['city'].trim();
      }
    }

    // 16. State / Union Territory
    if (!profileKey && (/\bstate\b/i.test(corpus) || /\bunion[\s_-]?territory\b/i.test(corpus) || /\bprovince\b/i.test(corpus) || /\bराज्य\b/i.test(corpus))) {
      const disqualifiers = [/\b(statement|status|static|estate|city|country|pincode|zip)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['state']?.trim()) {
        profileKey = 'state';
        value = profileData['state'].trim();
      }
    }

    // 17. Pincode / Postal Code
    if (!profileKey && /\b(pin[\s_-]?code|postal[\s_-]?code|zip[\s_-]?code|पिनकोड|डाक[\s_-]?कोड)\b/i.test(corpus)) {
      const disqualifiers = [/\b(state|city|country|phone|mobile)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['pincode']?.trim()) {
        profileKey = 'pincode';
        value = profileData['pincode'].trim();
      }
    }

    // 18. Country
    if (!profileKey && (/\bcountry\b/i.test(corpus) || /\bnationality\b/i.test(corpus) || /\bदेश\b/i.test(corpus) || /\bराष्ट्रीयता\b/i.test(corpus))) {
      const disqualifiers = [/\b(state|city|district|county|pincode)\b/i];
      if (!hasDisqualifier(disqualifiers) && profileData['country']?.trim()) {
        profileKey = 'country';
        value = profileData['country'].trim();
      }
    }

    // 19. Full Residential Address (Strict: must NOT be email address, web address, or office address)
    if (!profileKey && rawType !== 'email') {
      const isAddress =
        /\b(residential[\s_-]?address|present[\s_-]?address|current[\s_-]?address|communication[\s_-]?address|correspondence[\s_-]?address|full[\s_-]?address|address[\s_-]?line|निवास[\s_-]?का[\s_-]?पता)\b/i.test(corpus) ||
        (corpus === 'address' || corpus === 'पता' || rawName === 'address' || rawName === 'residentialAddress');

      if (isAddress) {
        const disqualifiers = [/\b(email|e-mail|web|ip|mac|url|office|work|employer|permanent|bank)\b/i];
        if (!hasDisqualifier(disqualifiers) && profileData['address']?.trim()) {
          profileKey = 'address';
          value = profileData['address'].trim();
        }
      }
    }

    // HARD RULE 6: If field cannot be matched with high confidence, LEAVE BLANK and DO NOT GUESS
    const canFill = Boolean(profileKey && value && value.trim() !== '');

    return {
      fieldName: rawName,
      label: rawLabel,
      profileKey,
      value: canFill ? value : '',
      canFill,
      manual: !canFill,
      sensitive: false,
      message: canFill
        ? `Mapped with high confidence to profile "${profileKey}"`
        : 'Left blank: field cannot be matched with high confidence (manual entry required)',
    };
  });
}

