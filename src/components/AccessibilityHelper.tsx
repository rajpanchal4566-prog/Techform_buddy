'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getDefaultLanguage, speakText, stopSpeaking, SUPPORTED_LANGUAGES, isSpeaking as checkIsSpeaking } from '@/lib/speech';
import { translateFromEnglish } from '@/lib/translate';

// Comprehensive screen descriptions in user's chosen language
export const SCREEN_DESCRIPTIONS: Record<string, Record<string, string>> = {
  landing: {
    en: 'Welcome to TechForm Buddy. This is the home page. TechForm Buddy is a multilingual AI platform for government, healthcare, banking, education, and business services. You can fill forms using your voice in your native language, auto-fill from documents, and get guidance. Click Login or Get Started to begin.',
    hi: 'टेकफॉर्म बडी में आपका स्वागत है। यह होम पेज है। टेकफॉर्म बडी एक बहुभाषी AI प्लेटफ़ॉर्म है जहाँ आप अपनी मातृभाषा में बोलकर सरकारी, स्वास्थ्य, बैंकिंग और शिक्षा के फॉर्म भर सकते हैं। शुरू करने के लिए लॉगिन या गेट स्टार्टेड पर क्लिक करें।',
    ta: 'டெக்ஃபார்ம் படிக்கு வரவேற்கிறோம். இது முகப்புப் பக்கம். உங்கள் தாய்மொழியில் குரல் மூலம் படிவங்களை நிரப்பலாம்.',
    te: 'టెక్‌ఫారమ్ బడ్డీకి స్వాగతం. ఇది హోమ్ పేజీ. మీ మాతృభాషలో వాయిస్ ద్వారా ఫారమ్‌లను నింపవచ్చు.',
    bn: 'টেকফর্ম বাডিতে স্বাগতম। এটি হোম পেজ। আপনার মাতৃভাষায় ভয়েস দিয়ে ফর্ম পূরণ করতে পারেন।',
  },
  dashboard: {
    en: 'You are on your main Dashboard. At the top are statistics showing total forms, processed documents, and active form watches. Below are quick action buttons to launch the AI Assistant, create a new form, upload documents, or open the In-App Browser. Your recent forms and notifications are listed below.',
    hi: 'आप मुख्य डैशबोर्ड पर हैं। ऊपर आपके कुल फॉर्म, अपलोड किए गए दस्तावेज़ और फॉर्म वॉच के आंकड़े हैं। तुरंत काम करने के लिए AI असिस्टेंट, नया फॉर्म, दस्तावेज़ अपलोड और ब्राउज़र बटन हैं। नीचे आपके हाल के फॉर्म और सूचनाएं हैं।',
    ta: 'நீங்கள் முக்கிய டாஷ்போர்டில் இருக்கிறீர்கள். இங்கே உங்கள் படிவங்கள், ஆவணங்கள் மற்றும் அறிவிப்புகளை பார்க்கலாம்.',
    te: 'మీరు ప్రధాన డాష్‌బోర్డ్‌లో ఉన్నారు. ఇక్కడ మీ ఫారమ్‌లు, పత్రాలు మరియు నోటిఫికేషన్‌లను చూడవచ్చు.',
    bn: 'আপনি মূল ড্যাশবোর্ডে আছেন। এখানে আপনার ফর্ম, নথি এবং বিজ্ঞপ্তি দেখতে পাবেন।',
  },
  forms: {
    en: 'You are on the Forms page. Here you can see all your forms, filter them by category, search by name, create a new blank form, and monitor portal form updates. Click on any form to open it, fill fields by typing or speaking in your language, and download or submit it.',
    hi: 'आप फॉर्म पेज पर हैं। यहाँ आप अपने सभी फॉर्म देख सकते हैं, श्रेणी अनुसार फ़िल्टर कर सकते हैं, नया फॉर्म बना सकते हैं और पोर्टल अपडेट देख सकते हैं। किसी भी फॉर्म पर क्लिक करके उसे खोलें, अपनी भाषा में बोलकर भरें, और डाउनलोड या सबमिट करें।',
    ta: 'நீங்கள் படிவங்கள் பக்கத்தில் இருக்கிறீர்கள். அனைத்து படிவங்களையும் நிர்வகிக்கலாம் மற்றும் பதிவிறக்கம் செய்யலாம்.',
    te: 'మీరు ఫారమ్‌ల పేజీలో ఉన్నారు. మీ అన్ని ఫారమ్‌లను నిర్వహించవచ్చు మరియు డౌన్‌లోడ్ చేసుకోవచ్చు.',
    bn: 'আপনি ফর্ম পেজে আছেন। আপনার সব ফর্ম পরিচালনা ও ডাউনলোড করতে পারেন।',
  },
  'form-detail': {
    en: 'You are editing a form. You can fill each field by typing or by clicking the microphone button to speak in your chosen language — the system translates your input and fills the field in English. The speaker button reads the field aloud. Use Auto-Fill to fill from your profile. Click Download Form anytime to save a printable PDF.',
    hi: 'आप एक फॉर्म भर रहे हैं। हर फ़ील्ड को टाइप करके या माइक बटन पर क्लिक करके अपनी भाषा में बोलकर भर सकते हैं — सिस्टम आपकी आवाज़ का अनुवाद करके फ़ील्ड को अंग्रेज़ी में भरता है। स्पीकर बटन सवाल पढ़कर सुनाता है। प्रोफाइल से भरने के लिए ऑटो-फिल पर क्लिक करें। पीडीएफ डाउनलोड करने के लिए डाउनलोड फॉर्म दबाएं।',
    ta: 'நீங்கள் ஒரு படிவத்தை நிரப்புகிறீர்கள். உங்கள் மொழியில் பேசலாம், ஆங்கிலத்தில் நிரப்பப்படும். படிவத்தை பதிவிறக்கம் செய்யலாம்.',
    te: 'మీరు ఫారమ్‌ను నింపుతున్నారు. మీ భాషలో మాట్లాడితే ఇంగ్లీషులో నింపబడుతుంది. డౌన్‌లోడ్ కూడా చేసుకోవచ్చు.',
    bn: 'আপনি একটি ফর্ম পূরণ করছেন। আপনার ভাষায় কথা বললে ইংরেজিতে পূরণ হবে। ফর্ম ডাউনলোড করতে পারেন।',
  },
  documents: {
    en: 'You are on the Documents page. Upload your identity documents such as Aadhaar Card, PAN Card, or Passport. TechForm Buddy automatically extracts your information from uploaded files and links it to your profile for instant form auto-filling.',
    hi: 'आप दस्तावेज़ पेज पर हैं। यहाँ आधार कार्ड, पैन कार्ड या पासपोर्ट जैसे पहचान दस्तावेज़ अपलोड करें। सिस्टम स्वचालित रूप से डेटा निकालकर प्रोफाइल में जोड़ता है ताकि फॉर्म तुरंत ऑटो-फिल हो सकें।',
    ta: 'நீங்கள் ஆவணங்கள் பக்கத்தில் இருக்கிறீர்கள். உங்கள் அடையாள ஆவணங்களை பதிவேற்றி தானாக நிரப்பலாம்.',
    te: 'మీరు డాక్యుమెంట్‌ల పేజీలో ఉన్నారు. ఆధార్, పాన్ కార్డులను అప్‌లోడ్ చేయండి.',
    bn: 'আপনি নথি পাতায় আছেন। আধার, প্যান কার্ড আপলোড করে অটো-ফিল করতে পারেন।',
  },
  assistant: {
    en: 'You are on the AI Assistant page. You can ask any question about government schemes, passports, education, healthcare, banking, and business licenses in your native language through text or voice. The assistant can generate pre-filled forms or help you file official grievances.',
    hi: 'आप AI असिस्टेंट पेज पर हैं। सरकारी योजनाओं, पासपोर्ट, शिक्षा, स्वास्थ्य, बैंकिंग और व्यापार के बारे में अपनी भाषा में बोलकर या लिखकर सवाल पूछें। असिस्टेंट फॉर्म भी बना सकता है और शिकायत दर्ज करने में मदद करता है।',
    ta: 'நீங்கள் AI உதவியாளர் பக்கத்தில் இருக்கிறீர்கள். அரசு சேவைகள் மற்றும் திட்டங்கள் பற்றி கேளுங்கள்.',
    te: 'మీరు AI అసిస్టెంట్ పేజీలో ఉన్నారు. ప్రభుత్వ పథకాలు మరియు సేవల గురించి అడగండి.',
    bn: 'আপনি AI সহকারী পাতায় আছেন। সরকারি প্রকল্প ও সেবা সম্পর্কে প্রশ্ন করুন।',
  },
  browser: {
    en: 'You are in the In-App Browser & Smart Form Automation page. Select any government portal like Passport Seva or Income Tax. The Smart Form Drawer on the right maps all portal fields. You can auto-fill all fields from your profile, speak into each field in your native language, submit the form, and download a printable application document.',
    hi: 'आप इन-ऐप ब्राउज़र और स्मार्ट फॉर्म ऑटोमेशन पेज पर हैं। पासपोर्ट सेवा या इनकम टैक्स जैसे किसी भी पोर्टल को चुनें। दाईं ओर का स्मार्ट फॉर्म ड्रॉअर प्रोफाइल से फॉर्म भरता है। आप अपनी भाषा में बोलकर भर सकते हैं, सबमिट कर सकते हैं, और फॉर्म डाउनलोड कर सकते हैं।',
    ta: 'நீங்கள் உள்ளமைக்கப்பட்ட உலாவி பக்கத்தில் இருக்கிறீர்கள். அரசு போர்ட்டல்களை திறந்து எளிதாக நிரப்பி பதிவிறக்கலாம்.',
    te: 'మీరు ఇన్-యాప్ బ్రౌజర్‌లో ఉన్నారు. పోర్టల్ ఫారమ్‌లను వాయిస్ ద్వారా నింపి డౌన్‌లోడ్ చేయవచ్చు.',
    bn: 'আপনি ইন-অ্যাপ ব্রাউজারে আছেন। সরকারি পোর্টাল খুলে সহজে পূরণ ও ডাউনলোড করতে পারেন।',
  },
  profile: {
    en: 'You are on the Profile page. Here you can set your preferred language which becomes the default across the entire app. Enter your personal details, address, and document numbers. This data powers 1-click auto-fill for all forms.',
    hi: 'आप प्रोफाइल पेज पर हैं। यहाँ अपनी पसंदीदा भाषा चुनें जो पूरे ऐप की डिफ़ॉल्ट भाषा बन जाती है। अपनी व्यक्तिगत जानकारी, पता और पहचान संख्या दर्ज करें। यह डेटा सभी फॉर्म्स को 1-क्लिक में ऑटो-फिल करता है।',
    ta: 'நீங்கள் சுயவிவர பக்கத்தில் இருக்கிறீர்கள். உங்கள் மொழி விருப்பம் மற்றும் தகவல்களை அமைக்கவும்.',
    te: 'మీరు ప్రొఫైల్ పేజీలో ఉన్నారు. మీ భాషా ప్రాధాన్యత మరియు వివరాలను సేవ్ చేయండి.',
    bn: 'আপনি প্রোফাইল পাতায় আছেন। আপনার পছন্দের ভাষা ও তথ্য সংরক্ষণ করুন।',
  },
  settings: {
    en: 'You are on the Settings page. Adjust your global language, select voice engines, configure speech playback speed, and manage automation preferences.',
    hi: 'आप सेटिंग्स पेज पर हैं। अपनी भाषा चुनें, वॉइस इंजन बदलें, बोलने की गति नियंत्रित करें, और ऑटोमेशन प्राथमिकताएं तय करें।',
    ta: 'நீங்கள் அமைப்புகள் பக்கத்தில் இருக்கிறீர்கள். குரல் மற்றும் மொழி விருப்பங்களை மாற்றவும்.',
    te: 'మీరు సెట్టింగ్‌ల పేజీలో ఉన్నారు. వాయిస్ మరియు భాషను మార్చుకోండి.',
    bn: 'আপনি সেটিংস পাতায় আছেন। ভয়েস ও ভাষা সমন্বয় করুন।',
  },
  notifications: {
    en: 'You are on the Notifications page. Check status alerts, submission updates, and deadline reminders for all your tracked forms.',
    hi: 'आप सूचनाएं पेज पर हैं। यहाँ अपने सभी फॉर्म्स के स्टेटस अपडेट और अलर्ट देखें।',
    ta: 'நீங்கள் அறிவிப்புகள் பக்கத்தில் இருக்கிறீர்கள்.',
    te: 'మీరు నోటిఫికేషన్ల పేజీలో ఉన్నారు.',
    bn: 'আপনি বিজ্ঞপ্তি পাতায় আছেন।',
  },
  login: {
    en: 'You are on the Login page. Enter your email and password to access your TechForm Buddy account.',
    hi: 'आप लॉगिन पेज पर हैं। अपने टेकफॉर्म बडी खाते में प्रवेश करने के लिए ईमेल और पासवर्ड दर्ज करें।',
    ta: 'நீங்கள் உள்நுழைவு பக்கத்தில் இருக்கிறீர்கள்.',
    te: 'మీరు లాగిన్ పేజీలో ఉన్నారు.',
    bn: 'আপনি লগইন পাতায় আছেন।',
  },
  register: {
    en: 'You are on the Registration page. Create a free TechForm Buddy account to access AI form filling in your native language.',
    hi: 'आप रजिस्ट्रेशन पेज पर हैं। अपनी भाषा में AI फॉर्म भरने के लिए एक निःशुल्क खाता बनाएं।',
    ta: 'நீங்கள் பதிவு பக்கத்தில் இருக்கிறீர்கள்.',
    te: 'మీరు రిజిస్ట్రేషన్ పేజీలో ఉన్నారు.',
    bn: 'আপনি নিবন্ধন পাতায় আছেন।',
  },
};

interface AccessibilityHelperProps {
  screenId?: string;
}

export default function AccessibilityHelper({ screenId: propScreenId }: AccessibilityHelperProps) {
  const pathname = usePathname() || '';
  const [language, setLangState] = useState('en');
  const [isOpen, setIsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Determine active screen based on route if not explicitly provided
  const activeScreenId = propScreenId || (() => {
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = getDefaultLanguage();
      setLangState(savedLang);
    }
  }, [isOpen]);

  const speakScreenDescription = async () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      setStatusMessage('');
      return;
    }

    const screen = SCREEN_DESCRIPTIONS[activeScreenId] || SCREEN_DESCRIPTIONS['dashboard'];
    let textToSpeak = screen[language] || '';

    // If pre-translated text is not present for this language, translate on the fly!
    if (!textToSpeak) {
      const englishText = screen['en'] || 'You are on TechForm Buddy.';
      setStatusMessage('Translating description...');
      const transResult = await translateFromEnglish(englishText, language);
      textToSpeak = transResult.text;
    }

    setStatusMessage('Reading screen description...');
    setIsSpeaking(true);
    speakText(
      textToSpeak,
      language,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        setStatusMessage('');
      }
    );
  };

  // Voice Query: user asks "What is on this screen?" in their language
  const startVoiceQuery = () => {
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
      setIsListeningVoice(true);
      setStatusMessage(`Listening in ${langObj?.label || language}... Ask "What is on this screen?"`);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setStatusMessage(`You asked: "${transcript}"`);
      setIsListeningVoice(false);
      // Immediately answer by reading out what is on the screen!
      speakScreenDescription();
    };

    recognition.onerror = () => {
      setIsListeningVoice(false);
      setStatusMessage('');
    };

    recognition.onend = () => {
      setIsListeningVoice(false);
    };

    recognition.start();
  };

  const currentLangLabel = SUPPORTED_LANGUAGES.find(l => l.code === language)?.label || language;

  return (
    <div
      className="accessibility-fab"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {isOpen && (
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            border: '1px solid #e5e7eb',
            maxWidth: '310px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#111827', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              ♿ Screen Accessibility
            </span>
            <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              {currentLangLabel}
            </span>
          </div>

          <p style={{ fontSize: '12px', color: '#4b5563', margin: '0 0 12px 0', lineHeight: 1.4 }}>
            Ask what is on this screen in your chosen language or click below to hear an instant description.
          </p>

          {statusMessage && (
            <div style={{ fontSize: '11px', color: '#1d4ed8', background: '#eff6ff', padding: '6px 10px', borderRadius: '8px', marginBottom: '10px' }}>
              {statusMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={speakScreenDescription}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #3b82f6',
                background: isSpeaking ? '#fee2e2' : '#3b82f6',
                color: isSpeaking ? '#991b1b' : 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              {isSpeaking ? '⏹️ Stop Speaking' : '🔊 What is on this screen?'}
            </button>

            <button
              onClick={startVoiceQuery}
              disabled={isListeningVoice}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                background: isListeningVoice ? '#fef3c7' : '#f9fafb',
                color: isListeningVoice ? '#92400e' : '#374151',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              {isListeningVoice ? '🎙️ Listening... Ask now' : '🎤 Ask by Voice ("What\'s here?")'}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) {
            stopSpeaking();
            setIsSpeaking(false);
          }
        }}
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: isOpen ? '#ef4444' : '#2563eb',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(37, 99, 235, 0.45)',
          transition: 'all 0.2s ease',
          fontSize: '22px',
        }}
        title="Accessibility: Ask what is on this screen"
      >
        {isOpen ? '✕' : '♿'}
      </button>
    </div>
  );
}
