import { sanitizeLanguage } from '@/lib/languages';

export interface ArenaCopy {
  tagline: string;
  score: string;
  wave: string;
  hp: string;
  defeated: string;
  pause: string;
  resume: string;
  sound: string;
  voice: string;
  on: string;
  off: string;
  start: string;
  introduction: string;
  startInstructions: string;
  paused: string;
  pausedDescription: string;
  resumeGame: string;
  gameOver: string;
  scoreAndWave: string;
  bestScore: string;
  restart: string;
  weaponLevel: string;
  upgrade: string;
  points: string;
  needPoints: string;
  pulse: string;
  ready: string;
  seconds: string;
  healingActive: string;
  healingNone: string;
  aimAssist: string;
  reduceEffects: string;
  instructions: string;
  waveComplete: string;
  nextWaveIn: string;
  levelUp: string;
  canvasAlt: string;
  enemiesApproaching: string;
  waveCompleted: string;
  healthCritical: string;
  healingActivated: string;
  gameOverAnnouncement: string;
  gameError: string;
  gameErrorDescription: string;
  tryAgain: string;
  liveWave: string;
  liveHealth: string;
  liveHealthCritical: string;
  safetyTips: readonly [string, string, string];
}

const COPY: Record<string, ArenaCopy> = {
  en: {
    tagline: 'Protect your forms from scam monsters',
    score: 'Score', wave: 'Wave', hp: 'HP', defeated: 'Defeated',
    pause: 'Pause', resume: 'Resume', sound: 'Sound', voice: 'Voice', on: 'On', off: 'Off',
    start: 'Start Game', introduction: 'Keep fake forms away. Protect your information.',
    startInstructions: 'Move or drag to aim · Space for Pulse · P to pause',
    paused: 'Paused', pausedDescription: 'Your arena is safe while you take a break.', resumeGame: 'Resume Game',
    gameOver: 'GAME OVER', scoreAndWave: 'Score {score} · Wave {wave}', bestScore: 'Best score {score}', restart: 'Restart',
    weaponLevel: 'Weapon level', upgrade: 'Upgrade', points: 'pts', needPoints: 'Need {n} points to upgrade',
    pulse: 'Pulse', ready: 'Ready', seconds: '{n}s',
    healingActive: 'Healing pickup active', healingNone: 'Healing pickup: none',
    aimAssist: 'Aim assist', reduceEffects: 'Reduce effects',
    instructions: 'Move the pointer or drag to aim · Space for Pulse · P to pause',
    waveComplete: 'Wave {n} complete', nextWaveIn: 'Next wave in {n}s',
    levelUp: 'Weapon upgraded · Level {n}',
    canvasAlt: 'Buddy Defender arena: Buddy robot fights geometric form monsters. Use pointer or touch to aim, Space for Pulse.',
    enemiesApproaching: 'Enemies approaching', waveCompleted: 'Wave completed', healthCritical: 'Health critical',
    healingActivated: 'Healing activated', gameOverAnnouncement: 'Game over',
    gameError: 'Buddy Defender could not start',
    gameErrorDescription: 'The rest of TechForm Buddy is still available. Try loading the game again.',
    tryAgain: 'Try again',
    liveWave: 'Wave {n}.', liveHealth: 'Health {n}.', liveHealthCritical: 'Health critical.',
    safetyTips: [
      'Never share your OTP or password.',
      'Check the site address carefully; many government services use .gov.in.',
      'A real portal never asks you to pay to “unlock” a form.',
    ],
  },
  hi: {
    tagline: 'नकली फ़ॉर्म राक्षसों से अपने फ़ॉर्म की रक्षा करें',
    score: 'स्कोर', wave: 'वेव', hp: 'HP', defeated: 'हराए',
    pause: 'रोकें', resume: 'जारी रखें', sound: 'ध्वनि', voice: 'आवाज़', on: 'चालू', off: 'बंद',
    start: 'खेल शुरू करें', introduction: 'नकली फ़ॉर्म को दूर रखें। अपनी जानकारी सुरक्षित रखें।',
    startInstructions: 'लक्ष्य के लिए माउस चलाएँ या खींचें · Pulse के लिए Space · रोकने के लिए P',
    paused: 'रुका हुआ', pausedDescription: 'विराम के दौरान आपका खेल सुरक्षित है।', resumeGame: 'खेल जारी रखें',
    gameOver: 'खेल समाप्त', scoreAndWave: 'स्कोर {score} · वेव {wave}', bestScore: 'सर्वश्रेष्ठ स्कोर {score}', restart: 'फिर से शुरू करें',
    weaponLevel: 'हथियार स्तर', upgrade: 'अपग्रेड', points: 'अंक', needPoints: 'अपग्रेड के लिए {n} अंक चाहिए',
    pulse: 'Pulse', ready: 'तैयार', seconds: '{n} सेकंड',
    healingActive: 'हीलिंग पिकअप उपलब्ध', healingNone: 'हीलिंग पिकअप: नहीं',
    aimAssist: 'लक्ष्य सहायता', reduceEffects: 'प्रभाव कम करें',
    instructions: 'लक्ष्य के लिए माउस चलाएँ या खींचें · Pulse के लिए Space · रोकने के लिए P',
    waveComplete: 'वेव {n} पूरी हुई', nextWaveIn: 'अगली वेव {n} सेकंड में',
    levelUp: 'हथियार अपग्रेड · स्तर {n}',
    canvasAlt: 'Buddy Defender खेल: Buddy रोबोट ज्यामितीय फ़ॉर्म राक्षसों से लड़ता है। लक्ष्य के लिए माउस या स्पर्श करें, Pulse के लिए Space दबाएँ।',
    enemiesApproaching: 'दुश्मन आ रहे हैं', waveCompleted: 'वेव पूरी हुई', healthCritical: 'स्वास्थ्य बहुत कम है',
    healingActivated: 'हीलिंग सक्रिय हुई', gameOverAnnouncement: 'खेल समाप्त',
    gameError: 'Buddy Defender शुरू नहीं हो सका',
    gameErrorDescription: 'TechForm Buddy के बाकी हिस्से उपलब्ध हैं। खेल को फिर से लोड करें।',
    tryAgain: 'फिर से कोशिश करें',
    liveWave: 'वेव {n}.', liveHealth: 'स्वास्थ्य {n}.', liveHealthCritical: 'स्वास्थ्य बहुत कम है।',
    safetyTips: [
      'अपना OTP या पासवर्ड कभी साझा न करें।',
      'वेबसाइट का पता ध्यान से जाँचें; कई सरकारी सेवाएँ .gov.in का उपयोग करती हैं।',
      'असली पोर्टल फ़ॉर्म “अनलॉक” करने के लिए भुगतान नहीं माँगता।',
    ],
  },
  ta: {
    tagline: 'போலி படிவங்களிலிருந்து உங்கள் தகவலைப் பாதுகாக்கவும்',
    score: 'மதிப்பெண்', wave: 'சுற்று', hp: 'HP', defeated: 'வீழ்த்தியது',
    pause: 'இடைநிறுத்து', resume: 'தொடரவும்', sound: 'ஒலி', voice: 'குரல்', on: 'இயக்கு', off: 'நிறுத்து',
    start: 'விளையாட்டைத் தொடங்கு', introduction: 'போலி படிவங்களைத் தடுத்து உங்கள் தகவலைப் பாதுகாக்கவும்.',
    startInstructions: 'குறிவைக்க நகர்த்தவும் அல்லது இழுக்கவும் · Pulse-க்கு Space · இடைநிறுத்த P',
    paused: 'இடைநிறுத்தப்பட்டது', pausedDescription: 'இடைவேளையில் உங்கள் அரங்கம் பாதுகாப்பாக இருக்கும்.', resumeGame: 'விளையாட்டைத் தொடரவும்',
    gameOver: 'விளையாட்டு முடிந்தது', scoreAndWave: 'மதிப்பெண் {score} · சுற்று {wave}', bestScore: 'சிறந்த மதிப்பெண் {score}', restart: 'மீண்டும் தொடங்கு',
    weaponLevel: 'ஆயுத நிலை', upgrade: 'மேம்படுத்து', points: 'புள்ளிகள்', needPoints: 'மேம்படுத்த {n} புள்ளிகள் தேவை',
    pulse: 'Pulse', ready: 'தயார்', seconds: '{n} வி',
    healingActive: 'குணப்படுத்தும் பொருள் உள்ளது', healingNone: 'குணப்படுத்தும் பொருள்: இல்லை',
    aimAssist: 'குறி உதவி', reduceEffects: 'விளைவுகளைக் குறை',
    instructions: 'குறிவைக்க நகர்த்தவும் அல்லது இழுக்கவும் · Pulse-க்கு Space · இடைநிறுத்த P',
    waveComplete: 'சுற்று {n} முடிந்தது', nextWaveIn: 'அடுத்த சுற்று {n} வினாடிகளில்',
    levelUp: 'ஆயுதம் மேம்படுத்தப்பட்டது · நிலை {n}',
    canvasAlt: 'Buddy Defender அரங்கம்: Buddy ரோபோ வடிவியல் படிவ அரக்கர்களுடன் போராடுகிறது. குறிவைக்க சுட்டி அல்லது தொடுதலைப் பயன்படுத்தவும்; Pulse-க்கு Space.',
    enemiesApproaching: 'எதிரிகள் நெருங்குகிறார்கள்', waveCompleted: 'சுற்று முடிந்தது', healthCritical: 'உடல்நலம் மிகவும் குறைவு',
    healingActivated: 'குணப்படுத்துதல் செயல்பட்டது', gameOverAnnouncement: 'விளையாட்டு முடிந்தது',
    gameError: 'Buddy Defender தொடங்க முடியவில்லை',
    gameErrorDescription: 'TechForm Buddy-யின் மற்ற பகுதிகள் தொடர்ந்து கிடைக்கும். விளையாட்டை மீண்டும் ஏற்றவும்.',
    tryAgain: 'மீண்டும் முயற்சிக்கவும்',
    liveWave: 'சுற்று {n}.', liveHealth: 'உடல்நலம் {n}.', liveHealthCritical: 'உடல்நலம் மிகவும் குறைவு.',
    safetyTips: [
      'உங்கள் OTP அல்லது கடவுச்சொல்லை ஒருபோதும் பகிர வேண்டாம்.',
      'இணைய முகவரியை கவனமாகச் சரிபார்க்கவும்; பல அரசு சேவைகள் .gov.in பயன்படுத்துகின்றன.',
      'உண்மையான தளம் படிவத்தை “திறக்க” பணம் கேட்காது.',
    ],
  },
  te: {
    tagline: 'నకిలీ ఫారమ్‌ల నుంచి మీ సమాచారాన్ని కాపాడండి',
    score: 'స్కోరు', wave: 'వేవ్', hp: 'HP', defeated: 'ఓడించినవి',
    pause: 'ఆపండి', resume: 'కొనసాగించండి', sound: 'శబ్దం', voice: 'వాయిస్', on: 'ఆన్', off: 'ఆఫ్',
    start: 'ఆట ప్రారంభించండి', introduction: 'నకిలీ ఫారమ్‌లను దూరంగా ఉంచి మీ సమాచారాన్ని కాపాడండి.',
    startInstructions: 'లక్ష్యానికి కదపండి లేదా లాగండి · Pulse కోసం Space · ఆపడానికి P',
    paused: 'ఆగింది', pausedDescription: 'విరామ సమయంలో మీ అరేనా సురక్షితంగా ఉంటుంది.', resumeGame: 'ఆట కొనసాగించండి',
    gameOver: 'ఆట ముగిసింది', scoreAndWave: 'స్కోరు {score} · వేవ్ {wave}', bestScore: 'ఉత్తమ స్కోరు {score}', restart: 'మళ్లీ ప్రారంభించండి',
    weaponLevel: 'ఆయుధ స్థాయి', upgrade: 'మెరుగుపరచండి', points: 'పాయింట్లు', needPoints: 'మెరుగుపరచడానికి {n} పాయింట్లు కావాలి',
    pulse: 'Pulse', ready: 'సిద్ధం', seconds: '{n} సె',
    healingActive: 'హీలింగ్ వస్తువు ఉంది', healingNone: 'హీలింగ్ వస్తువు: లేదు',
    aimAssist: 'లక్ష్య సహాయం', reduceEffects: 'ఎఫెక్ట్‌లు తగ్గించండి',
    instructions: 'లక్ష్యానికి కదపండి లేదా లాగండి · Pulse కోసం Space · ఆపడానికి P',
    waveComplete: 'వేవ్ {n} పూర్తయింది', nextWaveIn: 'తదుపరి వేవ్ {n} సెకన్లలో',
    levelUp: 'ఆయుధం మెరుగైంది · స్థాయి {n}',
    canvasAlt: 'Buddy Defender అరేనా: Buddy రోబోట్ జ్యామితీయ ఫారమ్ రాక్షసులతో పోరాడుతుంది. లక్ష్యానికి మౌస్ లేదా టచ్ ఉపయోగించండి; Pulse కోసం Space.',
    enemiesApproaching: 'శత్రువులు వస్తున్నారు', waveCompleted: 'వేవ్ పూర్తయింది', healthCritical: 'ఆరోగ్యం ప్రమాదకరంగా తక్కువ',
    healingActivated: 'హీలింగ్ ప్రారంభమైంది', gameOverAnnouncement: 'ఆట ముగిసింది',
    gameError: 'Buddy Defender ప్రారంభం కాలేదు',
    gameErrorDescription: 'TechForm Buddy లోని మిగతా భాగాలు అందుబాటులో ఉంటాయి. ఆటను మళ్లీ లోడ్ చేయండి.',
    tryAgain: 'మళ్లీ ప్రయత్నించండి',
    liveWave: 'వేవ్ {n}.', liveHealth: 'ఆరోగ్యం {n}.', liveHealthCritical: 'ఆరోగ్యం ప్రమాదకరంగా తక్కువ.',
    safetyTips: [
      'మీ OTP లేదా పాస్‌వర్డ్‌ను ఎప్పుడూ పంచుకోకండి.',
      'వెబ్ చిరునామాను జాగ్రత్తగా తనిఖీ చేయండి; అనేక ప్రభుత్వ సేవలు .gov.in ఉపయోగిస్తాయి.',
      'నిజమైన పోర్టల్ ఫారమ్‌ను “అన్‌లాక్” చేయడానికి డబ్బు అడగదు.',
    ],
  },
  bn: {
    tagline: 'ভুয়ো ফর্ম দানব থেকে আপনার তথ্য রক্ষা করুন',
    score: 'স্কোর', wave: 'ওয়েভ', hp: 'HP', defeated: 'পরাজিত',
    pause: 'বিরতি', resume: 'চালিয়ে যান', sound: 'শব্দ', voice: 'কণ্ঠ', on: 'চালু', off: 'বন্ধ',
    start: 'খেলা শুরু করুন', introduction: 'ভুয়ো ফর্ম দূরে রাখুন। আপনার তথ্য সুরক্ষিত রাখুন।',
    startInstructions: 'লক্ষ্য করতে সরান বা টানুন · Pulse-এর জন্য Space · বিরতির জন্য P',
    paused: 'বিরতিতে', pausedDescription: 'বিরতির সময় আপনার ক্ষেত্র নিরাপদ।', resumeGame: 'খেলা চালিয়ে যান',
    gameOver: 'খেলা শেষ', scoreAndWave: 'স্কোর {score} · ওয়েভ {wave}', bestScore: 'সেরা স্কোর {score}', restart: 'আবার শুরু করুন',
    weaponLevel: 'অস্ত্রের স্তর', upgrade: 'উন্নত করুন', points: 'পয়েন্ট', needPoints: 'উন্নত করতে {n} পয়েন্ট দরকার',
    pulse: 'Pulse', ready: 'প্রস্তুত', seconds: '{n} সে',
    healingActive: 'নিরাময়ের পিকআপ আছে', healingNone: 'নিরাময়ের পিকআপ: নেই',
    aimAssist: 'লক্ষ্য সহায়তা', reduceEffects: 'প্রভাব কমান',
    instructions: 'লক্ষ্য করতে সরান বা টানুন · Pulse-এর জন্য Space · বিরতির জন্য P',
    waveComplete: 'ওয়েভ {n} সম্পূর্ণ', nextWaveIn: 'পরের ওয়েভ {n} সেকেন্ডে',
    levelUp: 'অস্ত্র উন্নত হয়েছে · স্তর {n}',
    canvasAlt: 'Buddy Defender ক্ষেত্র: Buddy রোবট জ্যামিতিক ফর্ম দানবদের সঙ্গে লড়ে। লক্ষ্য করতে মাউস বা স্পর্শ ব্যবহার করুন; Pulse-এর জন্য Space।',
    enemiesApproaching: 'শত্রুরা এগিয়ে আসছে', waveCompleted: 'ওয়েভ সম্পূর্ণ', healthCritical: 'স্বাস্থ্য সংকটজনক',
    healingActivated: 'নিরাময় চালু হয়েছে', gameOverAnnouncement: 'খেলা শেষ',
    gameError: 'Buddy Defender শুরু করা যায়নি',
    gameErrorDescription: 'TechForm Buddy-এর বাকি অংশ ব্যবহার করা যাবে। গেমটি আবার লোড করুন।',
    tryAgain: 'আবার চেষ্টা করুন',
    liveWave: 'ওয়েভ {n}.', liveHealth: 'স্বাস্থ্য {n}.', liveHealthCritical: 'স্বাস্থ্য সংকটজনক।',
    safetyTips: [
      'আপনার OTP বা পাসওয়ার্ড কখনও শেয়ার করবেন না।',
      'ওয়েব ঠিকানাটি ভালো করে দেখুন; অনেক সরকারি পরিষেবা .gov.in ব্যবহার করে।',
      'আসল পোর্টাল ফর্ম “আনলক” করার জন্য টাকা চায় না।',
    ],
  },
  mr: {
    tagline: 'बनावट फॉर्मपासून आपल्या माहितीचे संरक्षण करा',
    score: 'गुण', wave: 'फेरी', hp: 'HP', defeated: 'पराभूत',
    pause: 'थांबवा', resume: 'पुन्हा सुरू', sound: 'आवाज', voice: 'वाणी', on: 'चालू', off: 'बंद',
    start: 'खेळ सुरू करा', introduction: 'बनावट फॉर्म दूर ठेवा. आपली माहिती सुरक्षित ठेवा.',
    startInstructions: 'लक्ष्य साधण्यासाठी हलवा किंवा ओढा · Pulse साठी Space · थांबवण्यासाठी P',
    paused: 'थांबवले', pausedDescription: 'विश्रांतीत तुमचे खेळाचे क्षेत्र सुरक्षित आहे.', resumeGame: 'खेळ पुन्हा सुरू करा',
    gameOver: 'खेळ संपला', scoreAndWave: 'गुण {score} · फेरी {wave}', bestScore: 'सर्वोत्तम गुण {score}', restart: 'पुन्हा सुरू करा',
    weaponLevel: 'शस्त्राची पातळी', upgrade: 'अपग्रेड', points: 'गुण', needPoints: 'अपग्रेडसाठी {n} गुण आवश्यक',
    pulse: 'Pulse', ready: 'तयार', seconds: '{n} से.',
    healingActive: 'उपचार पिकअप उपलब्ध', healingNone: 'उपचार पिकअप: नाही',
    aimAssist: 'लक्ष्य सहाय्य', reduceEffects: 'प्रभाव कमी करा',
    instructions: 'लक्ष्य साधण्यासाठी हलवा किंवा ओढा · Pulse साठी Space · थांबवण्यासाठी P',
    waveComplete: 'फेरी {n} पूर्ण', nextWaveIn: 'पुढची फेरी {n} सेकंदांत',
    levelUp: 'शस्त्र अपग्रेड · पातळी {n}',
    canvasAlt: 'Buddy Defender क्षेत्र: Buddy रोबोट भूमितीय फॉर्म राक्षसांशी लढतो. लक्ष्य साधण्यासाठी माउस किंवा स्पर्श वापरा; Pulse साठी Space.',
    enemiesApproaching: 'शत्रू जवळ येत आहेत', waveCompleted: 'फेरी पूर्ण', healthCritical: 'आरोग्य धोकादायकरीत्या कमी',
    healingActivated: 'उपचार सुरू झाले', gameOverAnnouncement: 'खेळ संपला',
    gameError: 'Buddy Defender सुरू होऊ शकले नाही',
    gameErrorDescription: 'TechForm Buddy चे इतर भाग उपलब्ध आहेत. खेळ पुन्हा लोड करा.',
    tryAgain: 'पुन्हा प्रयत्न करा',
    liveWave: 'फेरी {n}.', liveHealth: 'आरोग्य {n}.', liveHealthCritical: 'आरोग्य धोकादायकरीत्या कमी.',
    safetyTips: [
      'तुमचा OTP किंवा पासवर्ड कधीही शेअर करू नका.',
      'वेबसाइटचा पत्ता काळजीपूर्वक तपासा; अनेक सरकारी सेवा .gov.in वापरतात.',
      'खरे पोर्टल फॉर्म “अनलॉक” करण्यासाठी पैसे मागत नाही.',
    ],
  },
  gu: {
    tagline: 'નકલી ફોર્મના રાક્ષસોથી તમારી માહિતીનું રક્ષણ કરો',
    score: 'સ્કોર', wave: 'વેવ', hp: 'HP', defeated: 'હરાવ્યા',
    pause: 'થોભો', resume: 'ચાલુ રાખો', sound: 'ધ્વનિ', voice: 'અવાજ', on: 'ચાલુ', off: 'બંધ',
    start: 'રમત શરૂ કરો', introduction: 'નકલી ફોર્મને દૂર રાખો. તમારી માહિતી સુરક્ષિત રાખો.',
    startInstructions: 'નિશાન માટે ખસેડો અથવા ખેંચો · Pulse માટે Space · થોભવા P',
    paused: 'થોભેલી', pausedDescription: 'વિરામ દરમિયાન તમારું મેદાન સુરક્ષિત છે.', resumeGame: 'રમત ચાલુ રાખો',
    gameOver: 'રમત પૂરી', scoreAndWave: 'સ્કોર {score} · વેવ {wave}', bestScore: 'શ્રેષ્ઠ સ્કોર {score}', restart: 'ફરી શરૂ કરો',
    weaponLevel: 'હથિયારનું સ્તર', upgrade: 'અપગ્રેડ', points: 'પોઇન્ટ', needPoints: 'અપગ્રેડ માટે {n} પોઇન્ટ જોઈએ',
    pulse: 'Pulse', ready: 'તૈયાર', seconds: '{n} સે.',
    healingActive: 'સારવાર પિકઅપ ઉપલબ્ધ', healingNone: 'સારવાર પિકઅપ: નથી',
    aimAssist: 'નિશાન સહાય', reduceEffects: 'અસર ઘટાડો',
    instructions: 'નિશાન માટે ખસેડો અથવા ખેંચો · Pulse માટે Space · થોભવા P',
    waveComplete: 'વેવ {n} પૂરી', nextWaveIn: 'આગલી વેવ {n} સેકન્ડમાં',
    levelUp: 'હથિયાર અપગ્રેડ · સ્તર {n}',
    canvasAlt: 'Buddy Defender મેદાન: Buddy રોબોટ ભૌમિતિક ફોર્મ રાક્ષસો સામે લડે છે. નિશાન માટે માઉસ અથવા ટચ વાપરો; Pulse માટે Space.',
    enemiesApproaching: 'દુશ્મનો આવી રહ્યા છે', waveCompleted: 'વેવ પૂરી', healthCritical: 'આરોગ્ય ગંભીર રીતે ઓછું',
    healingActivated: 'સારવાર સક્રિય થઈ', gameOverAnnouncement: 'રમત પૂરી',
    gameError: 'Buddy Defender શરૂ થઈ શક્યું નથી',
    gameErrorDescription: 'TechForm Buddy ના બાકીના ભાગો ઉપલબ્ધ છે. રમત ફરીથી લોડ કરો.',
    tryAgain: 'ફરી પ્રયાસ કરો',
    liveWave: 'વેવ {n}.', liveHealth: 'આરોગ્ય {n}.', liveHealthCritical: 'આરોગ્ય ગંભીર રીતે ઓછું.',
    safetyTips: [
      'તમારો OTP અથવા પાસવર્ડ ક્યારેય શેર કરશો નહીં.',
      'વેબ સરનામું ધ્યાનથી તપાસો; ઘણી સરકારી સેવાઓ .gov.in વાપરે છે.',
      'ખરું પોર્ટલ ફોર્મ “અનલૉક” કરવા માટે પૈસા માગતું નથી.',
    ],
  },
  kn: {
    tagline: 'ನಕಲಿ ಫಾರ್ಮ್ ರಾಕ್ಷಸರಿಂದ ನಿಮ್ಮ ಮಾಹಿತಿಯನ್ನು ಕಾಪಾಡಿ',
    score: 'ಸ್ಕೋರ್', wave: 'ಅಲೆ', hp: 'HP', defeated: 'ಸೋಲಿಸಿದವು',
    pause: 'ವಿರಾಮ', resume: 'ಮುಂದುವರಿಸಿ', sound: 'ಧ್ವನಿ', voice: 'ಧ್ವನಿವಾಣಿ', on: 'ಆನ್', off: 'ಆಫ್',
    start: 'ಆಟ ಪ್ರಾರಂಭಿಸಿ', introduction: 'ನಕಲಿ ಫಾರ್ಮ್‌ಗಳನ್ನು ದೂರವಿಡಿ. ನಿಮ್ಮ ಮಾಹಿತಿಯನ್ನು ರಕ್ಷಿಸಿ.',
    startInstructions: 'ಗುರಿ ಮಾಡಲು ಸರಿಸಿ ಅಥವಾ ಎಳೆಯಿರಿ · Pulse‌ಗೆ Space · ವಿರಾಮಕ್ಕೆ P',
    paused: 'ವಿರಾಮದಲ್ಲಿದೆ', pausedDescription: 'ವಿರಾಮದ ವೇಳೆ ನಿಮ್ಮ ಆಟದ ಮೈದಾನ ಸುರಕ್ಷಿತವಾಗಿದೆ.', resumeGame: 'ಆಟ ಮುಂದುವರಿಸಿ',
    gameOver: 'ಆಟ ಮುಗಿದಿದೆ', scoreAndWave: 'ಸ್ಕೋರ್ {score} · ಅಲೆ {wave}', bestScore: 'ಅತ್ಯುತ್ತಮ ಸ್ಕೋರ್ {score}', restart: 'ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ',
    weaponLevel: 'ಆಯುಧದ ಹಂತ', upgrade: 'ನವೀಕರಿಸಿ', points: 'ಅಂಕಗಳು', needPoints: 'ನವೀಕರಣಕ್ಕೆ {n} ಅಂಕಗಳು ಬೇಕು',
    pulse: 'Pulse', ready: 'ಸಿದ್ಧ', seconds: '{n} ಸೆ.',
    healingActive: 'ಚಿಕಿತ್ಸಾ ಪಿಕಪ್ ಇದೆ', healingNone: 'ಚಿಕಿತ್ಸಾ ಪಿಕಪ್: ಇಲ್ಲ',
    aimAssist: 'ಗುರಿ ಸಹಾಯ', reduceEffects: 'ಪರಿಣಾಮ ಕಡಿಮೆಮಾಡಿ',
    instructions: 'ಗುರಿ ಮಾಡಲು ಸರಿಸಿ ಅಥವಾ ಎಳೆಯಿರಿ · Pulse‌ಗೆ Space · ವಿರಾಮಕ್ಕೆ P',
    waveComplete: 'ಅಲೆ {n} ಪೂರ್ಣ', nextWaveIn: 'ಮುಂದಿನ ಅಲೆ {n} ಸೆಕೆಂಡುಗಳಲ್ಲಿ',
    levelUp: 'ಆಯುಧ ನವೀಕರಣ · ಹಂತ {n}',
    canvasAlt: 'Buddy Defender ಮೈದಾನ: Buddy ರೋಬೋಟ್ ಜ್ಯಾಮಿತೀಯ ಫಾರ್ಮ್ ರಾಕ್ಷಸರೊಂದಿಗೆ ಹೋರಾಡುತ್ತದೆ. ಗುರಿಗೆ ಮೌಸ್ ಅಥವಾ ಸ್ಪರ್ಶ ಬಳಸಿ; Pulse‌ಗೆ Space.',
    enemiesApproaching: 'ಶತ್ರುಗಳು ಬರುತ್ತಿದ್ದಾರೆ', waveCompleted: 'ಅಲೆ ಪೂರ್ಣಗೊಂಡಿದೆ', healthCritical: 'ಆರೋಗ್ಯ ಗಂಭೀರವಾಗಿ ಕಡಿಮೆ',
    healingActivated: 'ಚಿಕಿತ್ಸೆ ಸಕ್ರಿಯವಾಗಿದೆ', gameOverAnnouncement: 'ಆಟ ಮುಗಿದಿದೆ',
    gameError: 'Buddy Defender ಪ್ರಾರಂಭವಾಗಲಿಲ್ಲ',
    gameErrorDescription: 'TechForm Buddy ಯ ಉಳಿದ ಭಾಗಗಳು ಲಭ್ಯವಿವೆ. ಆಟವನ್ನು ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ.',
    tryAgain: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    liveWave: 'ಅಲೆ {n}.', liveHealth: 'ಆರೋಗ್ಯ {n}.', liveHealthCritical: 'ಆರೋಗ್ಯ ಗಂಭೀರವಾಗಿ ಕಡಿಮೆ.',
    safetyTips: [
      'ನಿಮ್ಮ OTP ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ಅನ್ನು ಎಂದಿಗೂ ಹಂಚಿಕೊಳ್ಳಬೇಡಿ.',
      'ವೆಬ್ ವಿಳಾಸವನ್ನು ಎಚ್ಚರಿಕೆಯಿಂದ ಪರಿಶೀಲಿಸಿ; ಅನೇಕ ಸರ್ಕಾರಿ ಸೇವೆಗಳು .gov.in ಬಳಸುತ್ತವೆ.',
      'ನಿಜವಾದ ಪೋರ್ಟಲ್ ಫಾರ್ಮ್ “ಅನ್‌ಲಾಕ್” ಮಾಡಲು ಹಣ ಕೇಳುವುದಿಲ್ಲ.',
    ],
  },
  ml: {
    tagline: 'വ്യാജ ഫോമുകളിൽ നിന്ന് നിങ്ങളുടെ വിവരങ്ങൾ സംരക്ഷിക്കുക',
    score: 'സ്കോർ', wave: 'വേവ്', hp: 'HP', defeated: 'തോൽപ്പിച്ചത്',
    pause: 'നിർത്തുക', resume: 'തുടരുക', sound: 'ശബ്ദം', voice: 'ശബ്ദസഹായി', on: 'ഓൺ', off: 'ഓഫ്',
    start: 'ഗെയിം ആരംഭിക്കുക', introduction: 'വ്യാജ ഫോമുകളെ അകറ്റി നിങ്ങളുടെ വിവരങ്ങൾ സംരക്ഷിക്കുക.',
    startInstructions: 'ലക്ഷ്യമിടാൻ നീക്കുക അല്ലെങ്കിൽ വലിക്കുക · Pulse-ന് Space · നിർത്താൻ P',
    paused: 'നിർത്തി', pausedDescription: 'വിശ്രമവേളയിൽ നിങ്ങളുടെ അരീന സുരക്ഷിതമാണ്.', resumeGame: 'ഗെയിം തുടരുക',
    gameOver: 'ഗെയിം അവസാനിച്ചു', scoreAndWave: 'സ്കോർ {score} · വേവ് {wave}', bestScore: 'മികച്ച സ്കോർ {score}', restart: 'വീണ്ടും ആരംഭിക്കുക',
    weaponLevel: 'ആയുധ നില', upgrade: 'മെച്ചപ്പെടുത്തുക', points: 'പോയിന്റ്', needPoints: 'മെച്ചപ്പെടുത്താൻ {n} പോയിന്റ് വേണം',
    pulse: 'Pulse', ready: 'തയ്യാർ', seconds: '{n} സെ.',
    healingActive: 'ചികിത്സാ പിക്കപ്പ് ലഭ്യമാണ്', healingNone: 'ചികിത്സാ പിക്കപ്പ്: ഇല്ല',
    aimAssist: 'ലക്ഷ്യ സഹായം', reduceEffects: 'ഇഫക്റ്റുകൾ കുറയ്ക്കുക',
    instructions: 'ലക്ഷ്യമിടാൻ നീക്കുക അല്ലെങ്കിൽ വലിക്കുക · Pulse-ന് Space · നിർത്താൻ P',
    waveComplete: 'വേവ് {n} പൂർത്തിയായി', nextWaveIn: 'അടുത്ത വേവ് {n} സെക്കൻഡിൽ',
    levelUp: 'ആയുധം മെച്ചപ്പെടുത്തി · നില {n}',
    canvasAlt: 'Buddy Defender അരീന: Buddy റോബോട്ട് ജ്യാമിതീയ ഫോം രാക്ഷസന്മാരോട് പോരാടുന്നു. ലക്ഷ്യമിടാൻ മൗസ് അല്ലെങ്കിൽ സ്പർശം ഉപയോഗിക്കുക; Pulse-ന് Space.',
    enemiesApproaching: 'ശത്രുക്കൾ അടുത്തെത്തുന്നു', waveCompleted: 'വേവ് പൂർത്തിയായി', healthCritical: 'ആരോഗ്യം ഗുരുതരമായി കുറഞ്ഞു',
    healingActivated: 'ചികിത്സ സജീവമായി', gameOverAnnouncement: 'ഗെയിം അവസാനിച്ചു',
    gameError: 'Buddy Defender ആരംഭിക്കാനായില്ല',
    gameErrorDescription: 'TechForm Buddy-യുടെ മറ്റ് ഭാഗങ്ങൾ ലഭ്യമാണ്. ഗെയിം വീണ്ടും ലോഡ് ചെയ്യുക.',
    tryAgain: 'വീണ്ടും ശ്രമിക്കുക',
    liveWave: 'വേവ് {n}.', liveHealth: 'ആരോഗ്യം {n}.', liveHealthCritical: 'ആരോഗ്യം ഗുരുതരമായി കുറഞ്ഞു.',
    safetyTips: [
      'നിങ്ങളുടെ OTP അല്ലെങ്കിൽ പാസ്‌വേഡ് ഒരിക്കലും പങ്കിടരുത്.',
      'വെബ് വിലാസം ശ്രദ്ധിച്ച് പരിശോധിക്കുക; നിരവധി സർക്കാർ സേവനങ്ങൾ .gov.in ഉപയോഗിക്കുന്നു.',
      'യഥാർത്ഥ പോർട്ടൽ ഫോം “അൺലോക്ക്” ചെയ്യാൻ പണം ചോദിക്കില്ല.',
    ],
  },
  pa: {
    tagline: 'ਨਕਲੀ ਫਾਰਮ ਰਾਖਸ਼ਾਂ ਤੋਂ ਆਪਣੀ ਜਾਣਕਾਰੀ ਦੀ ਰੱਖਿਆ ਕਰੋ',
    score: 'ਸਕੋਰ', wave: 'ਵੇਵ', hp: 'HP', defeated: 'ਹਰਾਏ',
    pause: 'ਰੋਕੋ', resume: 'ਜਾਰੀ ਰੱਖੋ', sound: 'ਆਵਾਜ਼', voice: 'ਬੋਲੀ', on: 'ਚਾਲੂ', off: 'ਬੰਦ',
    start: 'ਖੇਡ ਸ਼ੁਰੂ ਕਰੋ', introduction: 'ਨਕਲੀ ਫਾਰਮਾਂ ਨੂੰ ਦੂਰ ਰੱਖੋ। ਆਪਣੀ ਜਾਣਕਾਰੀ ਸੁਰੱਖਿਅਤ ਰੱਖੋ।',
    startInstructions: 'ਨਿਸ਼ਾਨਾ ਲਗਾਉਣ ਲਈ ਹਿਲਾਓ ਜਾਂ ਖਿੱਚੋ · Pulse ਲਈ Space · ਰੋਕਣ ਲਈ P',
    paused: 'ਰੁਕੀ ਹੋਈ', pausedDescription: 'ਵਿਰਾਮ ਦੌਰਾਨ ਤੁਹਾਡਾ ਖੇਤਰ ਸੁਰੱਖਿਅਤ ਹੈ।', resumeGame: 'ਖੇਡ ਜਾਰੀ ਰੱਖੋ',
    gameOver: 'ਖੇਡ ਖਤਮ', scoreAndWave: 'ਸਕੋਰ {score} · ਵੇਵ {wave}', bestScore: 'ਸਭ ਤੋਂ ਵਧੀਆ ਸਕੋਰ {score}', restart: 'ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ',
    weaponLevel: 'ਹਥਿਆਰ ਦਾ ਪੱਧਰ', upgrade: 'ਅਪਗ੍ਰੇਡ', points: 'ਅੰਕ', needPoints: 'ਅਪਗ੍ਰੇਡ ਲਈ {n} ਅੰਕ ਚਾਹੀਦੇ',
    pulse: 'Pulse', ready: 'ਤਿਆਰ', seconds: '{n} ਸਕਿੰਟ',
    healingActive: 'ਇਲਾਜ ਪਿਕਅੱਪ ਮੌਜੂਦ', healingNone: 'ਇਲਾਜ ਪਿਕਅੱਪ: ਨਹੀਂ',
    aimAssist: 'ਨਿਸ਼ਾਨਾ ਸਹਾਇਤਾ', reduceEffects: 'ਪ੍ਰਭਾਵ ਘਟਾਓ',
    instructions: 'ਨਿਸ਼ਾਨਾ ਲਗਾਉਣ ਲਈ ਹਿਲਾਓ ਜਾਂ ਖਿੱਚੋ · Pulse ਲਈ Space · ਰੋਕਣ ਲਈ P',
    waveComplete: 'ਵੇਵ {n} ਪੂਰੀ', nextWaveIn: 'ਅਗਲੀ ਵੇਵ {n} ਸਕਿੰਟਾਂ ਵਿੱਚ',
    levelUp: 'ਹਥਿਆਰ ਅਪਗ੍ਰੇਡ · ਪੱਧਰ {n}',
    canvasAlt: 'Buddy Defender ਖੇਤਰ: Buddy ਰੋਬੋਟ ਜਿਆਮਿਤੀ ਫਾਰਮ ਰਾਖਸ਼ਾਂ ਨਾਲ ਲੜਦਾ ਹੈ। ਨਿਸ਼ਾਨੇ ਲਈ ਮਾਊਸ ਜਾਂ ਟੱਚ ਵਰਤੋ; Pulse ਲਈ Space।',
    enemiesApproaching: 'ਦੁਸ਼ਮਣ ਨੇੜੇ ਆ ਰਹੇ ਹਨ', waveCompleted: 'ਵੇਵ ਪੂਰੀ ਹੋਈ', healthCritical: 'ਸਿਹਤ ਬਹੁਤ ਘੱਟ ਹੈ',
    healingActivated: 'ਇਲਾਜ ਸ਼ੁਰੂ ਹੋਇਆ', gameOverAnnouncement: 'ਖੇਡ ਖਤਮ',
    gameError: 'Buddy Defender ਸ਼ੁਰੂ ਨਹੀਂ ਹੋ ਸਕਿਆ',
    gameErrorDescription: 'TechForm Buddy ਦੇ ਬਾਕੀ ਹਿੱਸੇ ਉਪਲਬਧ ਹਨ। ਖੇਡ ਨੂੰ ਮੁੜ ਲੋਡ ਕਰੋ।',
    tryAgain: 'ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ',
    liveWave: 'ਵੇਵ {n}.', liveHealth: 'ਸਿਹਤ {n}.', liveHealthCritical: 'ਸਿਹਤ ਬਹੁਤ ਘੱਟ ਹੈ।',
    safetyTips: [
      'ਆਪਣਾ OTP ਜਾਂ ਪਾਸਵਰਡ ਕਦੇ ਵੀ ਸਾਂਝਾ ਨਾ ਕਰੋ।',
      'ਵੈੱਬ ਪਤਾ ਧਿਆਨ ਨਾਲ ਜਾਂਚੋ; ਕਈ ਸਰਕਾਰੀ ਸੇਵਾਵਾਂ .gov.in ਵਰਤਦੀਆਂ ਹਨ।',
      'ਅਸਲੀ ਪੋਰਟਲ ਫਾਰਮ “ਅਨਲੌਕ” ਕਰਨ ਲਈ ਪੈਸੇ ਨਹੀਂ ਮੰਗਦਾ।',
    ],
  },
  ur: {
    tagline: 'جعلی فارم کے عفریت سے اپنی معلومات کی حفاظت کریں',
    score: 'اسکور', wave: 'لہر', hp: 'HP', defeated: 'شکست دی',
    pause: 'روکیں', resume: 'جاری رکھیں', sound: 'آواز', voice: 'بولی', on: 'چالو', off: 'بند',
    start: 'کھیل شروع کریں', introduction: 'جعلی فارم کو دور رکھیں۔ اپنی معلومات محفوظ رکھیں۔',
    startInstructions: 'نشانہ لگانے کے لیے حرکت دیں یا کھینچیں · Pulse کے لیے Space · روکنے کے لیے P',
    paused: 'رکا ہوا', pausedDescription: 'وقفے کے دوران آپ کا میدان محفوظ ہے۔', resumeGame: 'کھیل جاری رکھیں',
    gameOver: 'کھیل ختم', scoreAndWave: 'اسکور {score} · لہر {wave}', bestScore: 'بہترین اسکور {score}', restart: 'دوبارہ شروع کریں',
    weaponLevel: 'ہتھیار کی سطح', upgrade: 'اپ گریڈ', points: 'پوائنٹس', needPoints: 'اپ گریڈ کے لیے {n} پوائنٹس درکار ہیں',
    pulse: 'Pulse', ready: 'تیار', seconds: '{n} سیکنڈ',
    healingActive: 'علاج کا پک اپ موجود ہے', healingNone: 'علاج کا پک اپ: نہیں',
    aimAssist: 'نشانہ معاون', reduceEffects: 'اثرات کم کریں',
    instructions: 'نشانہ لگانے کے لیے حرکت دیں یا کھینچیں · Pulse کے لیے Space · روکنے کے لیے P',
    waveComplete: 'لہر {n} مکمل', nextWaveIn: 'اگلی لہر {n} سیکنڈ میں',
    levelUp: 'ہتھیار اپ گریڈ · سطح {n}',
    canvasAlt: 'Buddy Defender میدان: Buddy روبوٹ جیومیٹری فارم کے عفریتوں سے لڑتا ہے۔ نشانہ لگانے کے لیے ماؤس یا ٹچ استعمال کریں؛ Pulse کے لیے Space۔',
    enemiesApproaching: 'دشمن قریب آ رہے ہیں', waveCompleted: 'لہر مکمل', healthCritical: 'صحت خطرناک حد تک کم',
    healingActivated: 'علاج شروع ہو گیا', gameOverAnnouncement: 'کھیل ختم',
    gameError: 'Buddy Defender شروع نہیں ہو سکا',
    gameErrorDescription: 'TechForm Buddy کے باقی حصے دستیاب ہیں۔ کھیل دوبارہ لوڈ کریں۔',
    tryAgain: 'دوبارہ کوشش کریں',
    liveWave: 'لہر {n}.', liveHealth: 'صحت {n}.', liveHealthCritical: 'صحت خطرناک حد تک کم۔',
    safetyTips: [
      'اپنا OTP یا پاس ورڈ کبھی کسی کو نہ بتائیں۔',
      'ویب پتے کو غور سے دیکھیں؛ بہت سی سرکاری خدمات .gov.in استعمال کرتی ہیں۔',
      'حقیقی پورٹل فارم کو “اَن لاک” کرنے کے لیے رقم نہیں مانگتا۔',
    ],
  },
};

const copyByCode: Readonly<Record<string, ArenaCopy>> = COPY;

export function getArenaCopy(language: string): ArenaCopy {
  return copyByCode[sanitizeLanguage(language)] || COPY.en;
}

export function formatArenaText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function getSafetyTip(language: string, wave: number): string {
  const tips = getArenaCopy(language).safetyTips;
  return tips[(Math.max(1, wave) - 1) % tips.length];
}
