'use client';

import { useState, useEffect, useRef, useTransition, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SUPPORTED_LANGUAGES, isSupportedLanguage } from '@/lib/languages';
import '../login/auth.css';

interface VerifyI18n {
  title: string;
  subtitle: string;
  emailLabel: string;
  codeLabel: string;
  verifyBtn: string;
  verifyingBtn: string;
  didNotReceive: string;
  resendBtn: string;
  resendWait: string;
  successMsg: string;
  errEnterEmail: string;
  errEnterCode: string;
  errNetwork: string;
  languageLabel: string;
  backToLogin: string;
  goToDashboard: string;
}

const VERIFY_TEXTS: Record<string, VerifyI18n> = {
  en: {
    title: 'Verify your email',
    subtitle: 'Enter the 6-digit verification code sent to your email to unlock all features',
    emailLabel: 'Email Address',
    codeLabel: '6-Digit Verification Code',
    verifyBtn: 'Verify Email',
    verifyingBtn: 'Verifying...',
    didNotReceive: "Didn't receive the code?",
    resendBtn: 'Resend verification code',
    resendWait: 'Resend in {s}s',
    successMsg: 'Email verified successfully! You now have full access.',
    errEnterEmail: 'Please enter your email address.',
    errEnterCode: 'Please enter all 6 digits of the verification code.',
    errNetwork: 'Network error. Please try again.',
    languageLabel: 'Language',
    backToLogin: 'Back to Sign in',
    goToDashboard: 'Go to Dashboard',
  },
  hi: {
    title: 'अपना ईमेल सत्यापित करें',
    subtitle: 'सभी सुविधाओं को अनलॉक करने के लिए अपने ईमेल पर भेजा गया 6-अंकीय कोड दर्ज करें',
    emailLabel: 'ईमेल पता',
    codeLabel: '6-अंकीय सत्यापन कोड',
    verifyBtn: 'ईमेल सत्यापित करें',
    verifyingBtn: 'सत्यापित किया जा रहा है...',
    didNotReceive: 'कोड प्राप्त नहीं हुआ?',
    resendBtn: 'सत्यापन कोड पुनः भेजें',
    resendWait: '{s} सेकंड में पुनः भेजें',
    successMsg: 'ईमेल सफलतापूर्वक सत्यापित हुआ! अब आपको पूर्ण पहुँच प्राप्त है।',
    errEnterEmail: 'कृपया अपना ईमेल पता दर्ज करें।',
    errEnterCode: 'कृपया सत्यापन कोड के सभी 6 अंक दर्ज करें।',
    errNetwork: 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।',
    languageLabel: 'भाषा',
    backToLogin: 'साइन इन पर वापस जाएं',
    goToDashboard: 'डैशबोर्ड पर जाएं',
  },
  ta: {
    title: 'உங்கள் மின்னஞ்சலைச் சரிபார்க்கவும்',
    subtitle: 'அனைத்து அம்சங்களையும் திறக்க உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்ட 6 இலக்கக் குறியீட்டை உள்ளிடவும்',
    emailLabel: 'மின்னஞ்சல் முகவரி',
    codeLabel: '6 இலக்க சரிபார்ப்புக் குறியீடு',
    verifyBtn: 'மின்னஞ்சலைச் சரிபார்க்கவும்',
    verifyingBtn: 'சரிபார்க்கிறது...',
    didNotReceive: 'குறியீடு கிடைக்கவில்லையா?',
    resendBtn: 'சரிபார்ப்புக் குறியீட்டை மீண்டும் அனுப்பவும்',
    resendWait: '{s} வினாடிகளில் மீண்டும் அனுப்பலாம்',
    successMsg: 'மின்னஞ்சல் வெற்றிகரமாகச் சரிபார்க்கப்பட்டது! உங்களுக்கு முழு அணுகல் உள்ளது.',
    errEnterEmail: 'தயவுசெய்து உங்கள் மின்னஞ்சல் முகவரியை உள்ளிடவும்.',
    errEnterCode: 'சரிபார்ப்புக் குறியீட்டின் 6 இலக்கங்களையும் உள்ளிடவும்.',
    errNetwork: 'பிணையப் பிழை. மீண்டும் முயற்சிக்கவும்.',
    languageLabel: 'மொழி',
    backToLogin: 'உள்நுழைவுக்குத் திரும்பு',
    goToDashboard: 'முகப்புப் பலகைக்குச் செல்',
  },
  te: {
    title: 'మీ ఇమెయిల్‌ను ధృవీకరించండి',
    subtitle: 'అన్ని ఫీచర్లను అన్‌లాక్ చేయడానికి మీ ఇమెయిల్‌కు పంపిన 6-అంకెల కోడ్‌ను నమోదు చేయండి',
    emailLabel: 'ఇమెయిల్ చిరునామా',
    codeLabel: '6-అంకెల ధృవీకరణ కోడ్',
    verifyBtn: 'ఇమెయిల్‌ను ధృవీకరించండి',
    verifyingBtn: 'ధృవీకరిస్తోంది...',
    didNotReceive: 'కోడ్ అందలేదా?',
    resendBtn: 'ధృవీకరణ కోడ్‌ను మళ్లీ పంపండి',
    resendWait: '{s} సెకన్లలో మళ్లీ పంపండి',
    successMsg: 'ఇమెయిల్ విజయవంతంగా ధృవీకరించబడింది! మీకు పూర్తి యాక్సెస్ లభించింది.',
    errEnterEmail: 'దయచేసి మీ ఇమెయిల్ చిరునామాను నమోదు చేయండి.',
    errEnterCode: 'దయచేసి ధృవీకరణ కోడ్‌లోని మొత్తం 6 అంకెలను నమోదు చేయండి.',
    errNetwork: 'నెట్‌వర్క్ లోపం. దయచేసి మళ్లీ ప్రయత్నించండి.',
    languageLabel: 'భాష',
    backToLogin: 'సైన్ ఇన్ పేజీకి తిరిగి వెళ్లండి',
    goToDashboard: 'డాష్‌బోర్డ్‌కు వెళ్లండి',
  },
  bn: {
    title: 'আপনার ইমেল যাচাই করুন',
    subtitle: 'সমস্ত সুবিধা আনলক করতে আপনার ইমেলে পাঠানো ৬ অঙ্কের কোডটি লিখুন',
    emailLabel: 'ইমেল ঠিকানা',
    codeLabel: '৬ অঙ্কের যাচাইকরণ কোড',
    verifyBtn: 'ইমেল যাচাই করুন',
    verifyingBtn: 'যাচাই করা হচ্ছে...',
    didNotReceive: 'কোডটি পাননি?',
    resendBtn: 'যাচাইকরণ কোড পুনরায় পাঠান',
    resendWait: '{s} সেকেন্ডে পুনরায় পাঠান',
    successMsg: 'ইমেল সফলভাবে যাচাই করা হয়েছে! আপনার সম্পূর্ণ অ্যাক্সেস রয়েছে।',
    errEnterEmail: 'অনুগ্রহ করে আপনার ইমেল ঠিকানা লিখুন।',
    errEnterCode: 'অনুগ্রহ করে যাচাইকরণ কোডের সবকটি ৬টি সংখ্যা লিখুন।',
    errNetwork: 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।',
    languageLabel: 'ভাষা',
    backToLogin: 'সাইন ইন-এ ফিরে যান',
    goToDashboard: 'ড্যাশবোর্ডে যান',
  },
  mr: {
    title: 'आपला ईमेल पडताळा',
    subtitle: 'सर्व वैशिष्ट्ये सुरू करण्यासाठी आपल्या ईमेलवर पाठवलेला ६-अंकी कोड प्रविष्ट करा',
    emailLabel: 'ईमेल पत्ता',
    codeLabel: '६-अंकी पडताळणी कोड',
    verifyBtn: 'ईमेल पडताळा',
    verifyingBtn: 'पडताळणी सुरू आहे...',
    didNotReceive: 'कोड मिळाला नाही का?',
    resendBtn: 'पडताळणी कोड पुन्हा पाठवा',
    resendWait: '{s} सेकंदात पुन्हा पाठवा',
    successMsg: 'ईमेल यशस्वीरित्या पडताळला गेला! आता तुम्हाला पूर्ण प्रवेश मिळाला आहे.',
    errEnterEmail: 'कृपया आपला ईमेल पत्ता प्रविष्ट करा.',
    errEnterCode: 'कृपया पडताळणी कोडचे सर्व ६ अंक प्रविष्ट करा.',
    errNetwork: 'नेटवर्क त्रुटी. कृपया पुन्हा प्रयत्न करा.',
    languageLabel: 'भाषा',
    backToLogin: 'साइन इनकडे परत जा',
    goToDashboard: 'डॅशबोर्डवर जा',
  },
  gu: {
    title: 'તમારો ઇમેઇલ ચકાસો',
    subtitle: 'બધી સુવિધાઓ સક્રિય કરવા માટે તમારા ઇમેઇલ પર મોકલેલ 6-અંકનો કોડ દાખલ કરો',
    emailLabel: 'ઇમેઇલ સરનામું',
    codeLabel: '6-અંકનો ચકાસણી કોડ',
    verifyBtn: 'ઇમેઇલ ચકાસો',
    verifyingBtn: 'ચકાસી રહ્યું છે...',
    didNotReceive: 'કોડ મળ્યો નથી?',
    resendBtn: 'ચકાસણી કોડ ફરી મોકલો',
    resendWait: '{s} સેકન્ડમાં ફરી મોકલો',
    successMsg: 'ઇમેઇલ સફળતાપૂર્વક ચકાસાયેલ છે! તમારી પાસે સંપૂર્ણ ઍક્સેસ છે.',
    errEnterEmail: 'કૃપા કરીને તમારું ઇમેઇલ સરનામું દાખલ કરો.',
    errEnterCode: 'કૃપા કરીને ચકાસણી કોડના તમામ 6 અંકો દાખલ કરો.',
    errNetwork: 'નેટવર્ક ભૂલ. ફરી પ્રયાસ કરો.',
    languageLabel: 'ભાષા',
    backToLogin: 'સાઇન ઇન પર પાછા જાઓ',
    goToDashboard: 'ડેશબોર્ડ પર જાઓ',
  },
  kn: {
    title: 'ನಿಮ್ಮ ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ',
    subtitle: 'ಎಲ್ಲಾ ವೈಶಿಷ್ಟ್ಯಗಳನ್ನು ಅನ್ಲಾಕ್ ಮಾಡಲು ನಿಮ್ಮ ಇಮೇಲ್ಗೆ ಕಳುಹಿಸಲಾದ 6-ಅಂಕಿಯ ಕೋಡ್ ನಮೂದಿಸಿ',
    emailLabel: 'ಇಮೇಲ್ ವಿಳಾಸ',
    codeLabel: '6-ಅಂಕಿಯ ಪರಿಶೀಲನಾ ಕೋಡ್',
    verifyBtn: 'ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ',
    verifyingBtn: 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...',
    didNotReceive: 'ಕೋಡ್ ಸ್ವೀಕರಿಸಲಿಲ್ಲವೇ?',
    resendBtn: 'ಪರಿಶೀಲನಾ ಕೋಡ್ ಮರುಕಳುಹಿಸಿ',
    resendWait: '{s} ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಮರುಕಳುಹಿಸಿ',
    successMsg: 'ಇಮೇಲ್ ಯಶಸ್ವಿಯಾಗಿ ಪರಿಶೀಲಿಸಲ್ಪಟ್ಟಿದೆ! ನೀವು ಪೂರ್ಣ ಪ್ರವೇಶವನ್ನು ಹೊಂದಿದ್ದೀರಿ.',
    errEnterEmail: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ.',
    errEnterCode: 'ದಯವಿಟ್ಟು ಪರಿಶೀಲನಾ ಕೋಡ್‌ನ ಎಲ್ಲಾ 6 ಅಂಕಿಗಳನ್ನು ನಮೂದಿಸಿ.',
    errNetwork: 'ನೆಟ್‌ವರ್ಕ್ ದೋಷ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    languageLabel: 'ಭಾಷೆ',
    backToLogin: 'ಸೈನ್ ಇನ್‌ಗೆ ಹಿಂತಿರುಗಿ',
    goToDashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ',
  },
  ml: {
    title: 'നിങ്ങളുടെ ഇമെയിൽ സ്ഥിരീകരിക്കുക',
    subtitle: 'എല്ലാ ഫീച്ചറുകളും അൺലോക്ക് ചെയ്യാൻ നിങ്ങളുടെ ഇമെയിലിലേക്ക് അയച്ച 6 അക്ക കോഡ് നൽകുക',
    emailLabel: 'ഇമെയിൽ വിലാസം',
    codeLabel: '6 അക്ക സ്ഥിരീകരണ കോഡ്',
    verifyBtn: 'ഇമെയിൽ സ്ഥിരീകരിക്കുക',
    verifyingBtn: 'സ്ഥിരീകരിക്കുന്നു...',
    didNotReceive: 'കോഡ് ലഭിച്ചില്ലേ?',
    resendBtn: 'സ്ഥിരീകരണ കോഡ് വീണ്ടും അയക്കുക',
    resendWait: '{s} സെക്കൻഡിൽ വീണ്ടും അയക്കാം',
    successMsg: 'ഇമെയിൽ വിജയകരമായി സ്ഥിരീകരിച്ചു! നിങ്ങൾക്ക് പൂർണ്ണ ആക്സസ് ലഭിച്ചു.',
    errEnterEmail: 'ദയവായി നിങ്ങളുടെ ഇമെയിൽ വിലാസം നൽകുക.',
    errEnterCode: 'സ്ഥിരീകരണ കോഡിന്റെ 6 അക്കങ്ങളും നൽകുക.',
    errNetwork: 'നെറ്റ്‌വർക്ക് തകരാർ. വീണ്ടും ശ്രമിക്കുക.',
    languageLabel: 'ഭാഷ',
    backToLogin: 'സൈൻ ഇൻ പേജിലേക്ക് മടങ്ങുക',
    goToDashboard: 'ഡാഷ്‌ബോർഡിലേക്ക് പോകുക',
  },
  pa: {
    title: 'ਆਪਣੀ ਈਮੇਲ ਤਸਦੀਕ ਕਰੋ',
    subtitle: 'ਸਾਰੀਆਂ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ ਨੂੰ ਅਨਲੌਕ ਕਰਨ ਲਈ ਆਪਣੀ ਈਮੇਲ ਤੇ ਭੇਜਿਆ 6-ਅੰਕਾਂ ਵਾਲਾ ਕੋਡ ਦਾਖਲ ਕਰੋ',
    emailLabel: 'ਈਮੇਲ ਪਤਾ',
    codeLabel: '6-ਅੰਕਾਂ ਵਾਲਾ ਤਸਦੀਕ ਕੋਡ',
    verifyBtn: 'ਈਮੇਲ ਤਸਦੀਕ ਕਰੋ',
    verifyingBtn: 'ਤਸਦੀਕ ਹੋ ਰਿਹਾ ਹੈ...',
    didNotReceive: 'ਕੋਡ ਪ੍ਰਾਪਤ ਨਹੀਂ ਹੋਇਆ?',
    resendBtn: 'ਤਸਦੀਕ ਕੋਡ ਮੁੜ ਭੇਜੋ',
    resendWait: '{s} ਸਕਿੰਟਾਂ ਵਿੱਚ ਮੁੜ ਭੇਜੋ',
    successMsg: 'ਈਮੇਲ ਸਫਲਤਾਪੂਰਵਕ ਤਸਦੀਕ ਹੋ ਗਈ ਹੈ! ਹੁਣ ਤੁਹਾਡੇ ਕੋਲ ਪੂਰੀ ਪਹੁੰਚ ਹੈ।',
    errEnterEmail: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਈਮੇਲ ਪਤਾ ਦਾਖਲ ਕਰੋ।',
    errEnterCode: 'ਕਿਰਪਾ ਕਰਕੇ ਤਸਦੀਕ ਕੋਡ ਦੇ ਸਾਰੇ 6 ਅੰਕ ਦਰਜ ਕਰੋ।',
    errNetwork: 'ਨੈੱਟਵਰਕ ਸਮੱਸਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    languageLabel: 'ਭਾਸ਼ਾ',
    backToLogin: 'ਸਾਈਨ ਇਨ ਤੇ ਵਾਪਸ ਜਾਓ',
    goToDashboard: 'ਡੈਸ਼ਬੋਰਡ ਤੇ ਜਾਓ',
  },
  ur: {
    title: 'اپنی ای میل کی تصدیق کریں',
    subtitle: 'تمام خصوصیات کو کھولنے کے لیے اپنی ای میل پر بھیجا گیا 6 ہندسوں کا کوڈ درج کریں',
    emailLabel: 'ای میل پتہ',
    codeLabel: '6 ہندسوں کا تصدیقی کوڈ',
    verifyBtn: 'ای میل کی تصدیق کریں',
    verifyingBtn: 'تصدیق جاری ہے...',
    didNotReceive: 'کوڈ موصول نہیں ہوا؟',
    resendBtn: 'تصدیقی کوڈ دوبارہ بھیجیں',
    resendWait: '{s} سیکنڈ میں دوبارہ بھیجیں',
    successMsg: 'ای میل کی کامیابی سے تصدیق ہو گئی! آپ کو مکمل رسائی حاصل ہے۔',
    errEnterEmail: 'براہ کرم اپنا ای میل پتہ درج کریں۔',
    errEnterCode: 'براہ کرم تصدیقی کوڈ کے تمام 6 ہندسے درج کریں۔',
    errNetwork: 'نیٹ ورک کی خرابی۔ براہ کرم دوبارہ کوشش کریں۔',
    languageLabel: 'زبان',
    backToLogin: 'سائن ان پر واپس جائیں',
    goToDashboard: 'ڈیش بورڈ پر جائیں',
  },
};

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const initialLang = searchParams.get('lang') || '';

  const [email, setEmail] = useState(initialEmail);
  const [selectedLang, setSelectedLang] = useState<string>('en');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(60);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendInfo, setResendInfo] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [, startTransition] = useTransition();

  // Detect language on mount
  useEffect(() => {
    let resolved = 'en';
    if (isSupportedLanguage(initialLang)) {
      resolved = initialLang.toLowerCase().trim();
    } else {
      const stored =
        typeof window !== 'undefined'
          ? localStorage.getItem('tfb_language') || localStorage.getItem('preferred_language')
          : null;
      if (stored && isSupportedLanguage(stored)) {
        resolved = stored.toLowerCase().trim();
      }
    }
    setSelectedLang(resolved);
  }, [initialLang]);

  const texts = VERIFY_TEXTS[selectedLang] || VERIFY_TEXTS.en;

  // Auto-focus first digit input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle single digit input
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...digits];

    if (!cleaned) {
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    // Take the last character typed
    const digitChar = cleaned.slice(-1);
    newDigits[index] = digitChar;
    setDigits(newDigits);
    setErrorMessage('');

    // Auto-advance focus to next slot
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all 6 digits are complete, trigger submit automatically
    const fullOtp = newDigits.join('');
    if (fullOtp.length === 6) {
      triggerVerification(fullOtp);
    }
  };

  // Keyboard navigation: Backspace and arrow keys
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move focus backward and clear previous box
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Paste support: distributes digits across the 6 boxes and auto-triggers verification
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const numericChars = pastedText.replace(/\D/g, '').slice(0, 6);

    if (!numericChars) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < numericChars.length; i++) {
      newDigits[i] = numericChars[i];
    }
    setDigits(newDigits);
    setErrorMessage('');

    // Focus slot corresponding to pasted length
    const focusTarget = Math.min(numericChars.length, 5);
    inputRefs.current[focusTarget]?.focus();

    if (numericChars.length === 6) {
      triggerVerification(numericChars);
    }
  };

  // Submit OTP
  const triggerVerification = async (otpCode: string) => {
    if (!email.trim()) {
      setStatus('error');
      setErrorMessage(texts.errEnterEmail);
      return;
    }
    if (otpCode.length !== 6) {
      setStatus('error');
      setErrorMessage(texts.errEnterCode);
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    setResendInfo('');

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otpCode.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setErrorMessage('');
        setTimeout(() => {
          startTransition(() => {
            router.push('/dashboard');
          });
        }, 1500);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Verification failed. Please check the code.');
        if (typeof data.attemptsLeft === 'number') {
          setAttemptsLeft(data.attemptsLeft);
        }
      }
    } catch {
      setStatus('error');
      setErrorMessage(texts.errNetwork);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerVerification(digits.join(''));
  };

  // Resend code with 60s cooldown
  const handleResend = async () => {
    if (!email.trim()) {
      setStatus('error');
      setErrorMessage(texts.errEnterEmail);
      return;
    }
    if (resendCooldown > 0 || resendLoading) return;

    setResendLoading(true);
    setErrorMessage('');
    setResendInfo('');

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          lang: selectedLang,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResendCooldown(60);
        setResendInfo(data.message || 'Verification code resent. Check your inbox.');
        // Reset digit inputs and focus first box
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else if (res.status === 429) {
        setStatus('error');
        setErrorMessage(data.error || 'Please wait before requesting again.');
        if (data.retryAfterSeconds) {
          setResendCooldown(data.retryAfterSeconds);
        }
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Could not resend email.');
      }
    } catch {
      setStatus('error');
      setErrorMessage(texts.errNetwork);
    } finally {
      setResendLoading(false);
    }
  };

  const isRtl = selectedLang === 'ur';

  return (
    <div className="auth-page" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="auth-container animate-fadeIn">
        {/* Language selector in top right corner of card */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <label htmlFor="verify-lang-select" style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginRight: '6px', alignSelf: 'center' }}>
            {texts.languageLabel}:
          </label>
          <select
            id="verify-lang-select"
            value={selectedLang}
            onChange={(e) => {
              const newL = e.target.value;
              setSelectedLang(newL);
              if (typeof window !== 'undefined') {
                localStorage.setItem('tfb_language', newL);
              }
            }}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text)',
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.label})
              </option>
            ))}
          </select>
        </div>

        <div className="auth-header">
          <div className="auth-logo">
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#3b82f6" />
              <path
                d="M6 10l10 7 10-7M6 22h20V10H6v12z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1>{texts.title}</h1>
          <p>{texts.subtitle}</p>
        </div>

        <div className="auth-form">
          {status === 'success' ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  fontSize: '28px',
                  marginBottom: '12px',
                }}
              >
                ✓
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>
                {texts.successMsg}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                Redirecting to dashboard...
              </p>
              <Link
                href="/dashboard"
                className="btn btn-primary btn-lg"
                style={{ display: 'inline-block', width: '100%', textAlign: 'center' }}
              >
                {texts.goToDashboard}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {status === 'error' && errorMessage && (
                <div className="auth-error animate-fadeIn" role="alert">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div>
                    <div>{errorMessage}</div>
                    {typeof attemptsLeft === 'number' && attemptsLeft > 0 && (
                      <div style={{ fontSize: '11px', marginTop: '3px', opacity: 0.9 }}>
                        Attempts remaining: {attemptsLeft}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {resendInfo && (
                <div
                  style={{
                    fontSize: '13px',
                    color: '#0284c7',
                    background: 'rgba(56, 189, 248, 0.12)',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  ✓ {resendInfo}
                </div>
              )}

              <div className="input-group">
                <label className="input-label" htmlFor="verify-email">
                  {texts.emailLabel}
                </label>
                <input
                  id="verify-email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* 6-Digit OTP input group with individual boxes, auto-focus, paste support */}
              <div className="input-group">
                <label className="input-label" htmlFor="otp-digit-0">
                  {texts.codeLabel}
                </label>

                <div className="otp-inputs-grid" dir="ltr">
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-digit-${idx}`}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className={`otp-digit-box ${digit ? 'filled' : ''}`}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      disabled={status === 'loading'}
                      aria-label={`Digit ${idx + 1}`}
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg auth-submit"
                disabled={status === 'loading' || digits.join('').length !== 6}
              >
                {status === 'loading' ? texts.verifyingBtn : texts.verifyBtn}
              </button>

              {/* Resend section with live cooldown countdown */}
              <div
                style={{
                  marginTop: '12px',
                  textAlign: 'center',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '14px',
                }}
              >
                <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
                  {texts.didNotReceive}
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading || resendCooldown > 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: resendCooldown > 0 ? 'var(--color-text-tertiary)' : '#3b82f6',
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: resendCooldown > 0 ? 'none' : 'underline',
                  }}
                >
                  {resendLoading
                    ? 'Sending...'
                    : resendCooldown > 0
                      ? texts.resendWait.replace('{s}', resendCooldown.toString())
                      : texts.resendBtn}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="auth-footer">
          <p>
            <Link href="/login">{texts.backToLogin}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="auth-container">Loading...</div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
