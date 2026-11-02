/**
 * TechForm Buddy - Multi-Domain Knowledge Packs Engine
 * 
 * Supports complete Problem Statement (PS-15) requirements across 6 domains:
 *  1. Education (scholarships, exam registration, admissions, bonafide)
 *  2. Healthcare (Ayushman Bharat, hospital OPD, immunization, disability)
 *  3. Banking (PM Jan Dhan, education loan, Mudra loan, RBI Ombudsman)
 *  4. Business (Udyam MSME, GST, Shop & Establishment, Trade License)
 *  5. Customer Support / Grievances (NCH, electricity/water/road complaints, citizen tracking)
 *  6. Institutions (library membership, hostel admission, NOC, conduct)
 * 
 * Rules:
 *  - Each domain has at least 8 curated Q&As with official portal citations
 *  - Each domain has at least 2 structured form/letter templates
 *  - Each domain handles at least 2 common user queries with multilingual support
 */

export type DomainCategory =
  | 'education'
  | 'healthcare'
  | 'banking'
  | 'business'
  | 'grievances'
  | 'institutions'
  | 'government';

export interface DomainQA {
  id: string;
  domain: DomainCategory;
  topic: string;
  question: string;
  questionHi: string;
  answer: string;
  answerHi: string;
  portalUrl: string;
  citation: string;
  lastChecked?: string;
  isVerified?: boolean;
  keywords: string[];
}

export interface DomainPack {
  domain: DomainCategory;
  name: string;
  nameHi: string;
  description: string;
  descriptionHi: string;
  officialPortals: Array<{ name: string; url: string; department: string }>;
  qaList: DomainQA[];
  templates: string[]; // IDs in FORM_TEMPLATES
  sampleQueries: Array<{ query: string; language: string; expectedIntent: string }>;
}

export const DOMAIN_KNOWLEDGE_PACKS: Record<DomainCategory, DomainPack> = {
  education: {
    domain: 'education',
    name: 'Education & Academics',
    nameHi: 'शिक्षा एवं अकादमिक सेवाएं',
    description: 'Guidance and automated documentation for scholarships, university admissions, exam registrations, and academic transcripts.',
    descriptionHi: 'छात्रवृत्ति, विश्वविद्यालय प्रवेश, परीक्षा पंजीकरण एवं अकादमिक प्रमाणपत्रों हेतु मार्गदर्शन।',
    officialPortals: [
      { name: 'National Scholarship Portal (NSP)', url: 'https://scholarships.gov.in', department: 'Ministry of Electronics & IT / Ministry of Education' },
      { name: 'National Testing Agency (NTA)', url: 'https://nta.ac.in', department: 'Ministry of Education' },
      { name: 'Samarth Higher Education Platform', url: 'https://samarth.edu.in', department: 'Department of Higher Education' },
      { name: 'DigiLocker National Academic Depository (NAD)', url: 'https://nad.digilocker.gov.in', department: 'Ministry of Electronics & IT' },
    ],
    templates: ['scholarship_application', 'student_internship', 'bonafide_certificate_request'],
    sampleQueries: [
      { query: 'scholarship form kaise bhare', language: 'hi', expectedIntent: 'ask_faq' },
      { query: 'how to get college bonafide certificate', language: 'en', expectedIntent: 'build_document' },
    ],
    qaList: [
      {
        id: 'edu-qa-1',
        domain: 'education',
        topic: 'National Scholarship Portal (NSP)',
        question: 'How do I apply for Pre-Matric and Post-Matric scholarships on the National Scholarship Portal (NSP)?',
        questionHi: 'नेशनल स्कॉलरशिप पोर्टल (NSP) पर प्री-मैट्रिक और पोस्ट-मैट्रिक छात्रवृत्ति के लिए कैसे आवेदन करें?',
        answer: 'Register on scholarships.gov.in with your Aadhaar, bank account details, and institutional student ID. Select your scheme (Minority, SC/ST, OBC, or Merit-cum-Means), upload your income certificate, caste certificate, and previous year marksheet, and submit the application for institute-level verification before the annual closing deadline (typically 30th November).',
        answerHi: 'scholarships.gov.in पर अपने आधार, बैंक खाते और कॉलेज आईडी के साथ पंजीकरण करें। योजना चुनें (अल्पसंख्यक, एससी/एसटी, ओबीसी, या मेरिट-कम-मीन्स), आय प्रमाण पत्र, जाति प्रमाण पत्र और अंकसूची अपलोड करें, और अंतिम तिथि से पहले जमा करें।',
        portalUrl: 'https://scholarships.gov.in',
        citation: 'National Scholarship Portal, Ministry of Education, Govt. of India (scholarships.gov.in)',
        keywords: ['scholarship', 'nsp', 'post-matric', 'pre-matric', 'छात्रवृत्ति', 'welfare grant'],
      },
      {
        id: 'edu-qa-2',
        domain: 'education',
        topic: 'CUET & NTA Entrance Exams',
        question: 'What is the procedure for registering for CUET-UG, JEE Main, or NEET on the NTA Portal?',
        questionHi: 'NTA पोर्टल पर CUET-UG, JEE Main या NEET के लिए पंजीकरण प्रक्रिया क्या है?',
        answer: 'Visit nta.ac.in and the respective exam portal (e.g. cuetug.ntaonline.in). Fill out the online registration form with personal and academic details, upload your scanned passport photo (10KB–200KB) and signature (4KB–30KB), choose your examination test cities and subjects, pay the statutory examination fee via net banking/UPI, and download the Confirmation Page.',
        answerHi: 'nta.ac.in पर जाएं। व्यक्तिगत और शैक्षणिक विवरण दर्ज करें, पासपोर्ट फोटो और हस्ताक्षर अपलोड करें, परीक्षा शहर और विषय चुनें, यूपीआई या नेट बैंकिंग से शुल्क का भुगतान करें और कन्फर्मेशन पेज डाउनलोड करें।',
        portalUrl: 'https://nta.ac.in',
        citation: 'National Testing Agency, Ministry of Education (nta.ac.in)',
        keywords: ['cuet', 'nta', 'entrance exam', 'jee', 'neet', 'परीक्षा पंजीकरण'],
      },
      {
        id: 'edu-qa-3',
        domain: 'education',
        topic: 'College Bonafide Certificate',
        question: 'How can a student request a Bonafide / Study Certificate from their college or university?',
        questionHi: 'कॉलेज या विश्वविद्यालय से बोनाफाइड (अध्ययनरत) प्रमाण पत्र कैसे प्राप्त करें?',
        answer: 'Submit a formal Bonafide Certificate Request letter addressed to the Principal or Dean. Mention your enrollment roll number, current course, semester, and specific purpose (such as passport application, bus pass, or scholarship). Attach a copy of your student ID card and latest fee receipt. TechForm Buddy can generate this letter instantly.',
        answerHi: 'प्राचार्य या डीन को संबोधित बोनाफाइड प्रमाण पत्र प्रार्थना पत्र प्रस्तुत करें। अपना रोल नंबर, पाठ्यक्रम, सेमेस्टर और उद्देश्य (जैसे पासपोर्ट, बस पास, छात्रवृत्ति) स्पष्ट लिखें। टेकफॉर्म बडी इस पत्र को तुरंत तैयार कर सकता है।',
        portalUrl: 'https://samarth.edu.in',
        citation: 'Institutional Academic Services, UGC & Samarth Platform (samarth.edu.in)',
        keywords: ['bonafide', 'study certificate', 'college certificate', 'बोनाफाइड', 'प्रमाण पत्र'],
      },
      {
        id: 'edu-qa-4',
        domain: 'education',
        topic: 'DigiLocker NAD Academic Verification',
        question: 'How do I download and digitally verify school and university marksheets through DigiLocker NAD?',
        questionHi: 'डिजिलॉकर NAD के माध्यम से स्कूल और यूनिवर्सिटी की मार्कशीट कैसे डाउनलोड और सत्यापित करें?',
        answer: 'Log in to digilocker.gov.in using your Aadhaar-linked mobile. Go to "Education & Learning", choose your state board or university, enter your passing year and roll number, and fetch your digital certificate. The downloaded PDF contains a tamper-proof cryptographic QR code recognized under Rule 9A of IT Act 2000.',
        answerHi: 'digilocker.gov.in पर लॉगिन करें। "एजुकेशन" सेक्शन में अपना बोर्ड या विश्वविद्यालय चुनें, रोल नंबर और उत्तीर्ण वर्ष दर्ज करें। डाउनलोड की गई डिजिटल मार्कशीट आईटी एक्ट 2000 के तहत कानूनी रूप से मान्य है।',
        portalUrl: 'https://nad.digilocker.gov.in',
        citation: 'National Academic Depository (NAD), DigiLocker, MeitY (nad.digilocker.gov.in)',
        keywords: ['digilocker', 'marksheet', 'degree', 'migration', 'मार्कशीट', 'nad'],
      },
      {
        id: 'edu-qa-5',
        domain: 'education',
        topic: 'AICTE Pragati Scholarship for Girls',
        question: 'What is the AICTE Pragati Scholarship scheme and who is eligible?',
        questionHi: 'एआईसीटीई प्रगति छात्रवृत्ति योजना क्या है और कौन पात्र है?',
        answer: 'AICTE Pragati provides ₹50,000 per annum to girl students admitted to the first or second year (lateral entry) of technical degree/diploma courses in AICTE-approved institutions. Eligibility requires annual family income under ₹8 Lakh, with a maximum of two girls per family eligible. Applications are processed annually via the National Scholarship Portal.',
        answerHi: 'एआईसीटीई प्रगति योजना तकनीकी डिग्री या डिप्लोमा में अध्ययनरत छात्राओं को प्रति वर्ष ₹50,000 की वित्तीय सहायता देती है। पारिवारिक वार्षिक आय ₹8 लाख से कम होनी चाहिए। आवेदन NSP पोर्टल पर किए जाते हैं।',
        portalUrl: 'https://www.aicte-india.org',
        citation: 'All India Council for Technical Education (aicte-india.org)',
        keywords: ['pragati', 'aicte', 'girls scholarship', 'technical scholarship', 'प्रगति'],
      },
      {
        id: 'edu-qa-6',
        domain: 'education',
        topic: 'Student Railway & Bus Concession',
        question: 'How do students obtain travel concession vouchers for Indian Railways and state buses?',
        questionHi: 'छात्र भारतीय रेलवे और राज्य परिवहन बसों के लिए रियायती यात्रा पास कैसे प्राप्त करते हैं?',
        answer: 'Collect the official Student Travel Concession Form from your college administrative desk or download the format on TechForm Buddy. Have it verified and stamped by your Head of Institution with your student photo affixed. Submit this stamped voucher at the railway reservation counter or state transport depot to receive up to 50% discount on suburban and sleeper travel.',
        answerHi: 'कॉलेज कार्यालय से छात्र रियायत प्रपत्र प्राप्त करें या टेकफॉर्म बडी से तैयार करें। संस्था प्रमुख द्वारा सत्यापित करवाकर रेलवे आरक्षण काउंटर या बस डिपो पर प्रस्तुत करने पर 50% तक यात्रा छूट मिलती है।',
        portalUrl: 'https://indianrailways.gov.in',
        citation: 'Ministry of Railways, Student Travel Concession Rules (indianrailways.gov.in)',
        keywords: ['railway concession', 'student pass', 'bus pass', 'यात्रा रियायत', 'travel voucher'],
      },
      {
        id: 'edu-qa-7',
        domain: 'education',
        topic: 'GATE Examination Registration',
        question: 'What are the eligibility requirements and application steps for GATE (Graduate Aptitude Test in Engineering)?',
        questionHi: 'गेट (GATE) परीक्षा के लिए पात्रता और आवेदन के मुख्य चरण क्या हैं?',
        answer: 'Candidates who are currently in the 3rd or higher year of any undergraduate engineering/technology degree or who have already completed any government-approved degree in engineering, science, or commerce are eligible. Apply online on the organizing institute’s GOAPS portal with valid photo ID, category certificate (if claiming fee relaxation), and college principal certificate.',
        answerHi: 'इंजीनियरिंग, टेक्नोलॉजी या विज्ञान में स्नातक के तृतीय वर्ष के छात्र या उत्तीर्ण अभ्यर्थी पात्र हैं। परीक्षा आयोजक संस्थान के GOAPS पोर्टल पर ऑनलाइन फोटो आईडी और श्रेणी प्रमाणपत्र के साथ आवेदन करें।',
        portalUrl: 'https://gate2026.iitr.ac.in',
        citation: 'GATE Organizing Committee, Ministry of Education (gate.iisc.ac.in)',
        keywords: ['gate', 'engineering exam', 'psu recruitment', 'mtech entrance', 'गेट'],
      },
      {
        id: 'edu-qa-8',
        domain: 'education',
        topic: 'Samarth University Admission Portal',
        question: 'How does the Samarth eGov portal facilitate central and state university admissions?',
        questionHi: 'समर्थ ई-गवर्नेंस पोर्टल केंद्रीय और राज्य विश्वविद्यालयों में प्रवेश को कैसे सुगम बनाता है?',
        answer: 'Samarth eGov standardizes student registration, program selection, fee payment, and document verification across 200+ universities. Students register with their CUET application number or class 12 credentials, choose preferred college preferences, track seat allocation rounds, and accept offers digitally.',
        answerHi: 'समर्थ पोर्टल 200 से अधिक विश्वविद्यालयों में प्रवेश, सीट आवंटन और शुल्क भुगतान को एकीकृत करता है। छात्र अपने CUET नंबर से लॉगिन कर कॉलेज वरीयता चुन सकते हैं।',
        portalUrl: 'https://samarth.edu.in',
        citation: 'Samarth eGov Suite, Ministry of Education (samarth.edu.in)',
        keywords: ['samarth', 'university admission', 'college admission', 'कॉलेज प्रवेश'],
      },
    ],
  },

  healthcare: {
    domain: 'healthcare',
    name: 'Healthcare & Medical Assistance',
    nameHi: 'स्वास्थ्य एवं चिकित्सा सहायता',
    description: 'Assistance for Ayushman Bharat PM-JAY cards, hospital OPD appointments, disability identity cards, and generic medicines.',
    descriptionHi: 'आयुष्मान भारत कार्ड, अस्पताल ओपीडी अपॉइंटमेंट, दिव्यांगता पहचान पत्र एवं जेनेरिक दवाओं हेतु सहायता।',
    officialPortals: [
      { name: 'Ayushman Bharat PM-JAY (NHA)', url: 'https://pmjay.gov.in', department: 'National Health Authority, MoHFW' },
      { name: 'Online Registration System (ORS AIIMS)', url: 'https://ors.gov.in', department: 'Ministry of Electronics & IT / MoHFW' },
      { name: 'Swavlamban UDID Portal', url: 'https://www.swavlambancard.gov.in', department: 'Department of Empowerment of Persons with Disabilities' },
      { name: 'PM Bhartiya Janaushadhi Pariyojana', url: 'https://janaushadhi.gov.in', department: 'Department of Pharmaceuticals' },
    ],
    templates: ['leave_application', 'disability_certificate_application'],
    sampleQueries: [
      { query: 'ayushman card kaise banwaye', language: 'hi', expectedIntent: 'ask_faq' },
      { query: 'how to book AIIMS OPD appointment online', language: 'en', expectedIntent: 'ask_faq' },
    ],
    qaList: [
      {
        id: 'health-qa-1',
        domain: 'healthcare',
        topic: 'Ayushman Bharat PM-JAY',
        question: 'Who is eligible for Ayushman Bharat PM-JAY and how do I download the Ayushman Card?',
        questionHi: 'आयुष्मान भारत PM-JAY के लिए कौन पात्र है और आयुष्मान कार्ड कैसे डाउनलोड करें?',
        answer: 'Families listed in SECC 2011 database or holding verified state NFSA ration cards are eligible for ₹5 Lakh annual cashless hospitalization cover. Check your eligibility at beneficiary.nha.gov.in using your mobile number or Aadhaar. Complete face/OTP e-KYC to generate and download your instant PVC Ayushman card.',
        answerHi: 'SECC 2011 या राशन कार्ड धारक परिवार प्रति वर्ष ₹5 लाख तक के कैशलेस उपचार के पात्र हैं। beneficiary.nha.gov.in पर आधार से पात्रता जांचें और e-KYC कर तुरंत आयुष्मान कार्ड डाउनलोड करें।',
        portalUrl: 'https://pmjay.gov.in',
        citation: 'National Health Authority, Ministry of Health and Family Welfare (pmjay.gov.in)',
        keywords: ['ayushman', 'pm-jay', 'golden card', 'health insurance', 'आयुष्मान कार्ड', 'कैशलेस इलाज'],
      },
      {
        id: 'health-qa-2',
        domain: 'healthcare',
        topic: 'Hospital OPD Appointments (ORS)',
        question: 'How do I book an online OPD consultation appointment at AIIMS and central government hospitals?',
        questionHi: 'एम्स और सरकारी अस्पतालों में ऑनलाइन ओपीडी अपॉइंटमेंट कैसे बुक करें?',
        answer: 'Visit the Online Registration System at ors.gov.in. Verify your identity with Aadhaar OTP to create an Ayushman Bharat Health Account (ABHA). Choose your state, target hospital (e.g. AIIMS New Delhi), clinical department, and available date slot. You will receive an SMS confirmation with an appointment UHID number.',
        answerHi: 'ors.gov.in पर जाएं। आधार ओटीपी से आभा (ABHA) आईडी बनाएं। राज्य, अस्पताल (जैसे एम्स), विभाग और उपलब्ध तारीख चुनें। टोकन नंबर और अपॉइंटमेंट एसएमएस प्राप्त होगा।',
        portalUrl: 'https://ors.gov.in',
        citation: 'Online Registration System, Ministry of Health and Family Welfare (ors.gov.in)',
        keywords: ['ors', 'opd appointment', 'aiims appointment', 'doctor appointment', 'अस्पताल पर्ची'],
      },
      {
        id: 'health-qa-3',
        domain: 'healthcare',
        topic: 'Unique Disability ID (UDID Swavlamban)',
        question: 'How do persons with disabilities apply for a UDID Swavlamban Card and disability certificate?',
        questionHi: 'दिव्यांगजन UDID स्वावलंबन कार्ड और दिव्यांगता प्रमाण पत्र के लिए कैसे आवेदन करें?',
        answer: 'Register on swavlambancard.gov.in. Upload applicant photo, signature/thumb impression, address proof, and existing medical disability report if available. Select your district medical hospital for physical assessment by the Chief Medical Officer (CMO) board. The issued UDID card offers pan-India recognition for railway, bus, and welfare concessions.',
        answerHi: 'swavlambancard.gov.in पर पंजीकरण करें। फोटो, हस्ताक्षर और चिकित्सा रिपोर्ट अपलोड करें। जिला अस्पताल के मेडिकल बोर्ड द्वारा मूल्यांकन के बाद पूरे देश में मान्य UDID कार्ड जारी किया जाता है।',
        portalUrl: 'https://www.swavlambancard.gov.in',
        citation: 'Department of Empowerment of Persons with Disabilities, Ministry of Social Justice (swavlambancard.gov.in)',
        keywords: ['udid', 'disability certificate', 'swavlamban', 'दिव्यांग प्रमाण पत्र', 'विकलांग कार्ड'],
      },
      {
        id: 'health-qa-4',
        domain: 'healthcare',
        topic: 'Pradhan Mantri Jan Aushadhi (PMBJP)',
        question: 'Where can citizens purchase affordable generic medicines under Jan Aushadhi Pariyojana?',
        questionHi: 'जन औषधि परियोजना के अंतर्गत नागरिक सस्ती जेनेरिक दवाएं कहां से खरीद सकते हैं?',
        answer: 'PMBJP stores provide high-quality generic medicines and surgical consumables priced 50% to 90% lower than branded market alternatives. Locate your nearest Kendra by searching on janaushadhi.gov.in or using the "Jan Aushadhi Sugam" mobile app.',
        answerHi: 'जन औषधि केंद्रों पर ब्रांडेड दवाओं की तुलना में 50% से 90% कम कीमत पर जेनेरिक दवाएं मिलती हैं। अपने नजदीकी केंद्र को janaushadhi.gov.in या "जन औषधि सुगम" ऐप से खोजें।',
        portalUrl: 'https://janaushadhi.gov.in',
        citation: 'Pharmaceuticals & Medical Devices Bureau of India (PMBI) (janaushadhi.gov.in)',
        keywords: ['jan aushadhi', 'generic medicines', 'pmbjp', 'सस्ती दवाएं', 'जन औषधि'],
      },
      {
        id: 'health-qa-5',
        domain: 'healthcare',
        topic: 'e-Raktkosh National Blood Bank',
        question: 'How can citizens find real-time blood stock availability across Indian blood banks?',
        questionHi: 'नागरिक भारतीय ब्लड बैंकों में रक्त की उपलब्धता रियल-टाइम में कैसे देख सकते हैं?',
        answer: 'Visit eraktkosh.in or dial 104. Use the "Blood Availability Search" feature to select your state, district, and required blood group (e.g. O+ or AB-). The portal displays real-time available component units (Whole Blood, PRBC, Platelets) along with direct contact numbers and distance to licensed blood centers.',
        answerHi: 'eraktkosh.in पर जाएं या 104 पर कॉल करें। राज्य, जिला और ब्लड ग्रुप चुनकर रक्त की उपलब्धता देखें। पोर्टल पर ब्लड बैंकों के नंबर और उपलब्ध यूनिट की सीधी जानकारी मिलती है।',
        portalUrl: 'https://eraktkosh.in',
        citation: 'e-Raktkosh, Ministry of Health and Family Welfare (eraktkosh.in)',
        keywords: ['blood bank', 'raktkosh', 'blood donation', 'ब्लड बैंक', 'रक्त उपलब्धता'],
      },
      {
        id: 'health-qa-6',
        domain: 'healthcare',
        topic: 'Tele-MANAS Mental Health Support',
        question: 'What is Tele-MANAS and how can citizens access free 24/7 mental health counseling?',
        questionHi: 'टेली-मानस (Tele-MANAS) क्या है और मुफ्त 24/7 मानसिक स्वास्थ्य परामर्श कैसे प्राप्त करें?',
        answer: 'Tele-MANAS is the Government of India’s 24x7 toll-free tele-mental health helpline. Citizens can dial 14416 or 1800-891-4416 from any phone to connect immediately with trained mental health counselors and clinical psychiatrists in over 20 regional Indian languages at zero cost.',
        answerHi: 'टेली-मानस भारत सरकार की 24 घंटे चलने वाली निशुल्क हेल्पलाइन है। किसी भी फोन से 14416 या 1800-891-4416 डायल करें और अपनी भाषा में अनुभवी काउंसलर्स से मुफ्त परामर्श प्राप्त करें।',
        portalUrl: 'https://telemanas.mohfw.gov.in',
        citation: 'National Tele Mental Health Programme, MoHFW (telemanas.mohfw.gov.in)',
        keywords: ['tele-manas', 'mental health', 'counseling', '14416', 'मानसिक स्वास्थ्य'],
      },
      {
        id: 'health-qa-7',
        domain: 'healthcare',
        topic: 'U-WIN Universal Immunization',
        question: 'How does U-WIN track pregnant women and child vaccination schedules in India?',
        questionHi: 'U-WIN पोर्टल पर गर्भवती महिलाओं और बच्चों के टीकाकरण का रिकॉर्ड कैसे दर्ज और ट्रैक होता है?',
        answer: 'U-WIN digitizes routine immunization across India under the Universal Immunization Programme (UIP). Parents can register with their Aadhaar/mobile number, view scheduled vaccines from birth to 16 years, book vaccination slots at primary health centers, and download bilingual vaccination certificates.',
        answerHi: 'U-WIN पर जन्म से 16 वर्ष तक के सभी आवश्यक टीकों का डिजिटल रिकॉर्ड रहता है। नजदीकी स्वास्थ्य केंद्र में टीकाकरण का स्लॉट बुक करें और डिजिटल प्रमाण पत्र डाउनलोड करें।',
        portalUrl: 'https://uwin.mohfw.gov.in',
        citation: 'Universal Immunization Programme, MoHFW (uwin.mohfw.gov.in)',
        keywords: ['u-win', 'immunization', 'child vaccine', 'टीकाकरण', 'vaccination certificate'],
      },
      {
        id: 'health-qa-8',
        domain: 'healthcare',
        topic: 'NOTTO Organ Donation Registry',
        question: 'How can an Indian citizen pledge organ and tissue donation after death?',
        questionHi: 'एक भारतीय नागरिक मृत्यु के बाद अंग और ऊतक दान करने का संकल्प कैसे ले सकता है?',
        answer: 'Visit the National Organ and Tissue Transplant Organisation portal at notto.mohfw.gov.in. Fill in Form 7 (Organ Donation Pledge Form) with your Aadhaar verification and emergency family contact. You will receive an official Digital Donor Card to carry in your wallet.',
        answerHi: 'notto.mohfw.gov.in पर जाएं और फॉर्म 7 भरकर अंगदान का संकल्प लें। आधार सत्यापन के बाद आपका आधिकारिक डिजिटल डोनर कार्ड जनरेट हो जाता है।',
        portalUrl: 'https://notto.mohfw.gov.in',
        citation: 'National Organ and Tissue Transplant Organisation, MoHFW (notto.mohfw.gov.in)',
        keywords: ['notto', 'organ donation', 'donor card', 'अंगदान', 'pledge form'],
      },
    ],
  },

  banking: {
    domain: 'banking',
    name: 'Banking & Financial Inclusions',
    nameHi: 'बैंकिंग एवं वित्तीय समावेशन',
    description: 'Information and applications for PM Jan Dhan zero-balance accounts, Vidya Lakshmi education loans, Mudra micro-loans, and RBI Ombudsman grievances.',
    descriptionHi: 'जन धन खाता, विद्या लक्ष्मी शिक्षा ऋण, मुद्रा ऋण एवं आरबीआई बैंकिंग लोकपाल शिकायत संबंधी सेवाएं।',
    officialPortals: [
      { name: 'Pradhan Mantri Jan-Dhan Yojana (PMJDY)', url: 'https://pmjdy.gov.in', department: 'Department of Financial Services, Ministry of Finance' },
      { name: 'Vidya Lakshmi Education Loan Portal', url: 'https://www.vidyalakshmi.co.in', department: 'NDML / Ministry of Finance / Ministry of Education' },
      { name: 'Pradhan Mantri MUDRA Yojana (PMMY)', url: 'https://www.mudra.org.in', department: 'SIDBI / Ministry of Finance' },
      { name: 'RBI Complaint Management System (CMS)', url: 'https://cms.rbi.org.in', department: 'Reserve Bank of India' },
    ],
    templates: ['bank_kyc_letter', 'loan_application_request'],
    sampleQueries: [
      { query: 'mudra loan apply kaise kare', language: 'hi', expectedIntent: 'ask_faq' },
      { query: 'how to complain to RBI Banking Ombudsman', language: 'en', expectedIntent: 'ask_faq' },
    ],
    qaList: [
      {
        id: 'bank-qa-1',
        domain: 'banking',
        topic: 'PM Jan Dhan Yojana (PMJDY)',
        question: 'What are the benefits of a Pradhan Mantri Jan Dhan Yojana (PMJDY) account and how do I open one?',
        questionHi: 'प्रधानमंत्री जन धन योजना (PMJDY) खाते के क्या लाभ हैं और इसे कैसे खोलें?',
        answer: 'PMJDY accounts require zero minimum balance and offer an accidental insurance cover of ₹2 Lakh on the free RuPay debit card, plus an overdraft facility up to ₹10,000 for eligible account holders. Open one at any nationalized bank branch or Bank Mitra kiosk with your Aadhaar and 2 passport photos.',
        answerHi: 'जन धन खाता बिना किसी न्यूनतम बैलेंस के खोला जाता है। इसमें रुपे डेबिट कार्ड पर ₹2 लाख का दुर्घटना बीमा और ₹10,000 तक की ओवरड्राफ्ट सुविधा मिलती है। आधार कार्ड लेकर किसी भी बैंक शाखा में जाएं।',
        portalUrl: 'https://pmjdy.gov.in',
        citation: 'Department of Financial Services, Ministry of Finance (pmjdy.gov.in)',
        keywords: ['jan dhan', 'pmjdy', 'zero balance account', 'जन धन खाता', 'rupay card'],
      },
      {
        id: 'bank-qa-2',
        domain: 'banking',
        topic: 'Vidya Lakshmi Education Loan',
        question: 'How do students apply for government-subsidized education loans on the Vidya Lakshmi portal?',
        questionHi: 'विद्या लक्ष्मी पोर्टल पर छात्र रियायती शिक्षा ऋण के लिए कैसे आवेदन करते हैं?',
        answer: 'Register on vidyalakshmi.co.in. Complete the Common Educational Loan Application Form (CELAF) with applicant personal data, admission offer letter, course fee breakdown, and guarantor details. You can apply to up to three scheduled commercial banks simultaneously through a single application.',
        answerHi: 'vidyalakshmi.co.in पर CELAF फॉर्म भरें। कॉलेज प्रवेश पत्र, शुल्क विवरण और गारंटर विवरण दर्ज करें। एक ही फॉर्म से आप 3 बैंकों में एक साथ शिक्षा ऋण के लिए आवेदन कर सकते हैं।',
        portalUrl: 'https://www.vidyalakshmi.co.in',
        citation: 'Vidya Lakshmi Portal, Department of Higher Education & IBA (vidyalakshmi.co.in)',
        keywords: ['vidya lakshmi', 'education loan', 'student loan', 'शिक्षा ऋण', 'celaf'],
      },
      {
        id: 'bank-qa-3',
        domain: 'banking',
        topic: 'Pradhan Mantri Mudra Yojana (PMMY)',
        question: 'What are the three categories of Mudra loans and what collateral is required?',
        questionHi: 'मुद्रा योजना के 3 प्रकार कौन से हैं और क्या कोई गारंटी देनी होती है?',
        answer: 'Mudra offers collateral-free loans across three categories: Shishu (loans up to ₹50,000), Kishore (loans between ₹50,001 and ₹5,00,000), and Tarun (loans between ₹5,00,001 and ₹10,00,000). Apply online on jansamarth.in or visit any commercial bank/NBFC with business quotation, identity proof, and project report.',
        answerHi: 'मुद्रा ऋण में किसी गारंटी (कोलेटरल) की आवश्यकता नहीं होती। 3 श्रेणियां हैं: शिशु (₹50,000 तक), किशोर (₹50,001 से ₹5 लाख), और तरुण (₹5 लाख से ₹10 लाख)। jansamarth.in पर ऑनलाइन आवेदन करें।',
        portalUrl: 'https://www.mudra.org.in',
        citation: 'Micro Units Development & Refinance Agency (MUDRA), SIDBI (mudra.org.in)',
        keywords: ['mudra loan', 'pmmy', 'shishu', 'kishore', 'tarun', 'मुद्रा लोन', 'jansamarth'],
      },
      {
        id: 'bank-qa-4',
        domain: 'banking',
        topic: 'RBI Banking Ombudsman (CMS)',
        question: 'When and how can a customer escalate a banking complaint to the RBI Ombudsman?',
        questionHi: 'एक ग्राहक बैंक शिकायत को आरबीआई लोकपाल में कब और कैसे दर्ज कर सकता है?',
        answer: 'If your bank rejects your formal complaint or fails to reply within 30 days regarding unauthorized transactions, ATM failures, or wrongful penal charges, file an escalation at cms.rbi.org.in under the Reserve Bank - Integrated Ombudsman Scheme. The resolution is 100% free and binding on the bank.',
        answerHi: 'यदि बैंक 30 दिनों में आपकी शिकायत का समाधान नहीं करता है, तो cms.rbi.org.in पर आरबीआई एकीकृत लोकपाल योजना के तहत निशुल्क शिकायत दर्ज करें। यह निर्णय बैंक के लिए बाध्यकारी होता है।',
        portalUrl: 'https://cms.rbi.org.in',
        citation: 'Reserve Bank of India Complaint Management System (cms.rbi.org.in)',
        keywords: ['rbi ombudsman', 'banking complaint', 'unauthorized debit', 'लोकपाल', 'cms rbi'],
      },
      {
        id: 'bank-qa-5',
        domain: 'banking',
        topic: 'Atal Pension Yojana (APY)',
        question: 'Who can subscribe to Atal Pension Yojana and what are the monthly guaranteed returns?',
        questionHi: 'अटल पेंशन योजना में कौन शामिल हो सकता है और गारंटीड पेंशन कितनी मिलती है?',
        answer: 'Any Indian citizen aged 18 to 40 years holding an active bank account (who is not an income tax assessee) can subscribe. Depending on the monthly contribution, subscribers receive a guaranteed monthly pension of ₹1,000, ₹2,000, ₹3,000, ₹4,000, or ₹5,000 upon reaching 60 years of age, guaranteed by the Government of India.',
        answerHi: '18 से 40 वर्ष के बैंक खाताधारक नागरिक पात्र हैं। 60 वर्ष की आयु पूरी होने पर भारत सरकार द्वारा ₹1,000 से लेकर ₹5,000 प्रति माह तक की गारंटीड आजीवन पेंशन दी जाती है।',
        portalUrl: 'https://www.npscra.nsdl.co.in',
        citation: 'Pension Fund Regulatory and Development Authority (PFRDA) (npscra.nsdl.co.in)',
        keywords: ['atal pension', 'apy', 'pfrda', 'अटल पेंशन', 'retirement plan'],
      },
      {
        id: 'bank-qa-6',
        domain: 'banking',
        topic: 'PM Jeevan Jyoti Bima Yojana (PMJJBY)',
        question: 'What is the premium and life insurance coverage provided under PMJJBY?',
        questionHi: 'PMJJBY योजना के तहत प्रीमियम और जीवन बीमा कवर कितना मिलता है?',
        answer: 'PMJJBY offers a term life insurance cover of ₹2 Lakh for death due to any cause to bank account holders aged 18 to 50 years. The annual premium is ₹436, which is automatically debited from the subscriber’s savings bank account in May every year.',
        answerHi: 'PMJJBY में किसी भी कारण से मृत्यु होने पर ₹2 लाख का जीवन बीमा कवर मिलता है। वार्षिक प्रीमियम मात्र ₹436 है, जो हर साल मई में बैंक खाते से ऑटो-डेबिट होता है।',
        portalUrl: 'https://financialservices.gov.in',
        citation: 'Department of Financial Services, Ministry of Finance (financialservices.gov.in)',
        keywords: ['pmjjby', 'life insurance', 'term cover', 'जीवन ज्योति बीमा', '436 premium'],
      },
      {
        id: 'bank-qa-7',
        domain: 'banking',
        topic: 'Bank KYC Re-KYC Update',
        question: 'How do customers complete Periodic Re-KYC for frozen or inoperative bank accounts?',
        questionHi: 'फ्रीज या निष्क्रिय बैंक खातों के लिए ग्राहक समय-समय पर Re-KYC कैसे पूरा करते हैं?',
        answer: 'If there is no change in your address, submit a self-declaration letter via internet banking, registered email, or ATM. If your address has changed, submit updated Aadhaar/Voter ID with recent passport photos to your branch. TechForm Buddy generates the formal Bank KYC Update letter in one click.',
        answerHi: 'यदि पते में कोई बदलाव नहीं है, तो नेट बैंकिंग या शाखा में स्व-घोषणा पत्र दें। पता बदलने पर नया आधार और फोटो संलग्न करें। टेकफॉर्म बडी एक क्लिक में बैंक केवाईसी पत्र तैयार करता है।',
        portalUrl: 'https://rbi.org.in',
        citation: 'Reserve Bank of India Master Direction - KYC (rbi.org.in)',
        keywords: ['bank kyc', 're-kyc', 'account frozen', 'केवाईसी', 'kyc letter'],
      },
      {
        id: 'bank-qa-8',
        domain: 'banking',
        topic: 'Sukanya Samriddhi Yojana (SSY)',
        question: 'What are the rules and tax benefits for opening a Sukanya Samriddhi Yojana account for girl children?',
        questionHi: 'सुकन्या समृद्धि योजना (SSY) खाता खोलने के नियम और कर लाभ क्या हैं?',
        answer: 'Parents or legal guardians can open an SSY account for a girl child under the age of 10 years at any post office or commercial bank with an initial deposit of ₹250 (maximum ₹1.5 Lakh per financial year). It provides high government-backed interest and qualifies for tax exemption under Section 80C (EEE status).',
        answerHi: '10 वर्ष से कम उम्र की बेटी के लिए किसी भी डाकघर या बैंक में न्यूनतम ₹250 से सुकन्या खाता खोला जा सकता है। इसमें धारा 80C के तहत पूर्ण कर छूट और उच्चतम ब्याज दर मिलती है।',
        portalUrl: 'https://www.indiapost.gov.in',
        citation: 'India Post, Ministry of Communications & Ministry of Finance (indiapost.gov.in)',
        keywords: ['sukanya samriddhi', 'ssy', 'girl child scheme', 'सुकन्या समृद्धि', '80c tax free'],
      },
    ],
  },

  business: {
    domain: 'business',
    name: 'Business & MSME Enterprise',
    nameHi: 'व्यापार एवं एमएसएमई उद्यम सेवाएं',
    description: 'Procedures and document templates for Udyam MSME registration, GST registration, trade licenses, FSSAI, and Shop Act.',
    descriptionHi: 'उद्यम एमएसएमई पंजीकरण, जीएसटी नंबर, ट्रेड लाइसेंस, एफएसएसएआई एवं गुमाश्ता लाइसेंस संबंधी प्रक्रियाएं।',
    officialPortals: [
      { name: 'Udyam MSME Registration Portal', url: 'https://udyamregistration.gov.in', department: 'Ministry of Micro, Small and Medium Enterprises' },
      { name: 'GST Common Portal', url: 'https://www.gst.gov.in', department: 'Goods & Services Tax Network (GSTN)' },
      { name: 'FSSAI Food Safety Compliance System (FoSCoS)', url: 'https://foscos.fssai.gov.in', department: 'Food Safety and Standards Authority of India' },
      { name: 'Startup India DPIIT', url: 'https://www.startupindia.gov.in', department: 'DPIIT, Ministry of Commerce and Industry' },
    ],
    templates: ['job_application', 'trade_license_application', 'resignation'],
    sampleQueries: [
      { query: 'msme udyam registration kaise kare', language: 'hi', expectedIntent: 'ask_faq' },
      { query: 'what documents are needed for GST registration', language: 'en', expectedIntent: 'ask_faq' },
    ],
    qaList: [
      {
        id: 'biz-qa-1',
        domain: 'business',
        topic: 'Udyam MSME Registration',
        question: 'How do micro, small, and medium businesses register on the official Udyam portal?',
        questionHi: 'सूक्ष्म, लघु और मध्यम उद्यम आधिकारिक उद्यम पोर्टल पर कैसे पंजीकरण करते हैं?',
        answer: 'Visit udyamregistration.gov.in. Registration is 100% paperless, free of cost, and instant. Enter the entrepreneur’s 12-digit Aadhaar number and enterprise PAN. The portal auto-fetches investment and turnover figures from GST and Income Tax databases to generate your lifelong Udyam Registration Certificate with a dynamic QR code.',
        answerHi: 'udyamregistration.gov.in पर जाएं। यह प्रक्रिया पूर्णतः निशुल्क और पेपरलेस है। उद्यमी का आधार और पैन नंबर दर्ज करें। जीएसटी व आयकर डेटा से सत्यापन के बाद क्यूआर कोड वाला उद्यम प्रमाणपत्र तुरंत जारी हो जाता है।',
        portalUrl: 'https://udyamregistration.gov.in',
        citation: 'Ministry of Micro, Small & Medium Enterprises (udyamregistration.gov.in)',
        keywords: ['udyam', 'msme registration', 'small business', 'उद्यम', 'एमएसएमई'],
      },
      {
        id: 'biz-qa-2',
        domain: 'business',
        topic: 'New GST Registration (Form GST REG-01)',
        question: 'What are the mandatory requirements to obtain a new GST registration for an enterprise?',
        questionHi: 'किसी व्यवसाय के लिए नया जीएसटी पंजीकरण प्राप्त करने हेतु क्या आवश्यकताएं हैं?',
        answer: 'Mandatory when annual turnover exceeds ₹40 Lakh for goods (₹20 Lakh for services / special category states). Apply online at gst.gov.in (Form GST REG-01). You need: PAN of the business, Aadhaar of proprietor/directors, proof of business address (Electricity Bill + Consent Letter / Rent Agreement), and bank cancelled cheque/statement.',
        answerHi: 'वार्षिक टर्नओवर ₹40 लाख (सेवाओं के लिए ₹20 लाख) से अधिक होने पर gst.gov.in पर आवेदन करें। पैन कार्ड, आधार, व्यापार स्थल का बिजली बिल/किरायानामा और बैंक चेक की आवश्यकता होती है।',
        portalUrl: 'https://www.gst.gov.in',
        citation: 'Goods and Services Tax Network, Govt. of India (gst.gov.in)',
        keywords: ['gst registration', 'gstin', 'reg-01', 'जीएसटी पंजीकरण', 'tax registration'],
      },
      {
        id: 'biz-qa-3',
        domain: 'business',
        topic: 'FSSAI Food Business License (FoSCoS)',
        question: 'How do restaurants, food stalls, and packaged food manufacturers get an FSSAI license?',
        questionHi: 'रेस्तरां, फूड स्टॉल और खाद्य निर्माता एफएसएसएआई लाइसेंस कैसे प्राप्त करते हैं?',
        answer: 'Apply online at foscos.fssai.gov.in. Petty food business operators with turnover up to ₹12 Lakh per year need a Basic FSSAI Registration (Form A, fee ₹100/yr). Larger enterprises with turnover up to ₹20 Crore require a State FSSAI License (Form B). Submit your photo, government ID, business address proof, and food category list.',
        answerHi: 'foscos.fssai.gov.in पर आवेदन करें। ₹12 लाख तक टर्नओवर वाले छोटे विक्रेताओं के लिए बुनियादी पंजीकरण (₹100/वर्ष) लगता है। बड़े कारोबारियों के लिए राज्य या केंद्रीय लाइसेंस आवश्यक है।',
        portalUrl: 'https://foscos.fssai.gov.in',
        citation: 'Food Safety and Standards Authority of India (foscos.fssai.gov.in)',
        keywords: ['fssai', 'foscos', 'food license', 'food safety', 'खाद्य लाइसेंस'],
      },
      {
        id: 'biz-qa-4',
        domain: 'business',
        topic: 'Shop & Establishment Act (Gumasta)',
        question: 'What is a Shop & Establishment Act license and where is it registered?',
        questionHi: 'दुकान एवं स्थापना (गुमाश्ता) लाइसेंस क्या है और इसका पंजीकरण कहां होता है?',
        answer: 'Every commercial establishment, shop, and office must register under the state’s Shop & Establishment Act within 30 days of opening. Issued by the municipal corporation or state labor department, it regulates working hours, wage payments, and holidays, and is accepted by banks as valid commercial address proof.',
        answerHi: 'दुकान या कार्यालय शुरू करने के 30 दिनों के भीतर नगर निगम या श्रम विभाग से गुमाश्ता लाइसेंस लेना अनिवार्य है। यह बैंक खाता खोलने के लिए वैध व्यापारिक प्रमाण पत्र का काम करता है।',
        portalUrl: 'https://labour.gov.in',
        citation: 'Ministry of Labour & Employment / State Labour Departments (labour.gov.in)',
        keywords: ['shop act', 'gumasta', 'establishment license', 'गुमाश्ता', 'दुकान पंजीकरण'],
      },
      {
        id: 'biz-qa-5',
        domain: 'business',
        topic: 'Import Export Code (DGFT IEC)',
        question: 'How does an Indian business obtain an Import Export Code (IEC) from DGFT?',
        questionHi: 'भारतीय व्यवसाय डीजीएफटी से आयात-निर्यात कोड (IEC) कैसे प्राप्त करते हैं?',
        answer: 'Visit dgft.gov.in and click "Apply for IEC". Any registered sole proprietor, partnership, or company can apply using their business PAN, active bank account details, and registered commercial address. The IEC is issued electronically and remains valid for a lifetime with mandatory annual online renewal/updation between April and June.',
        answerHi: 'dgft.gov.in पर जाएं। अपने पैन कार्ड और बैंक खाते के विवरण से ऑनलाइन आवेदन करें। आईईसी कोड जीवन भर के लिए वैध होता है और निर्यात-आयात के लिए अनिवार्य है।',
        portalUrl: 'https://www.dgft.gov.in',
        citation: 'Directorate General of Foreign Trade, Ministry of Commerce and Industry (dgft.gov.in)',
        keywords: ['iec', 'dgft', 'import export', 'आयात निर्यात कोड', 'foreign trade'],
      },
      {
        id: 'biz-qa-6',
        domain: 'business',
        topic: 'Startup India DPIIT Recognition',
        question: 'What are the benefits of DPIIT recognition under Startup India and how to apply?',
        questionHi: 'स्टार्टअप इंडिया के तहत DPIIT मान्यता के क्या लाभ हैं और आवेदन कैसे करें?',
        answer: 'Entities incorporated as private limited companies or LLPs less than 10 years old with turnover under ₹100 Crore can apply on startupindia.gov.in. Benefits include access to 3-year tax exemption under Section 80-IAC, fast-tracked patent examination with up to 80% rebate, and exemption from angel tax (Section 56(2)(viib)).',
        answerHi: 'startupindia.gov.in पर आवेदन करें। पात्र स्टार्टअप को 3 साल तक आयकर छूट (धारा 80-IAC), 80% पेटेंट शुल्क छूट और सरकारी निविदाओं में बिना पूर्व अनुभव के भाग लेने की सुविधा मिलती है।',
        portalUrl: 'https://www.startupindia.gov.in',
        citation: 'Department for Promotion of Industry and Internal Trade (DPIIT) (startupindia.gov.in)',
        keywords: ['startup india', 'dpiit', 'angel tax', 'स्टार्टअप इंडिया', '80-iac'],
      },
      {
        id: 'biz-qa-7',
        domain: 'business',
        topic: 'Municipal Trade License',
        question: 'Why is a Municipal Trade License necessary and how do I apply for one?',
        questionHi: 'नगर निगम ट्रेड लाइसेंस क्यों आवश्यक है और इसके लिए कैसे आवेदन करें?',
        answer: 'A Trade License certifies that a business operation complies with municipal safety, health, and fire guidelines and does not cause environmental pollution or health hazards. Apply on your city’s municipal portal (e.g. MCD, BMC, or state e-Nagar Palika) with site plan, property tax receipt, and NOC from fire department if applicable.',
        answerHi: 'ट्रेड लाइसेंस यह प्रमाणित करता है कि व्यवसाय स्वास्थ्य व सुरक्षा मानकों के अनुसार है। स्थानीय नगर निगम पोर्टल पर संपत्ति कर रसीद और व्यवसाय स्थल के नक्शे के साथ आवेदन करें।',
        portalUrl: 'https://mohua.gov.in',
        citation: 'Ministry of Housing and Urban Affairs & Local Municipal Corporations (mohua.gov.in)',
        keywords: ['trade license', 'municipal license', 'nagar palika', 'ट्रेड लाइसेंस', 'व्यापार अनुमति'],
      },
      {
        id: 'biz-qa-8',
        domain: 'business',
        topic: 'EPFO & ESIC Employer Registration',
        question: 'When is a business required to register for EPF and ESI for its employees?',
        questionHi: 'किसी कंपनी के लिए कर्मचारियों हेतु ईपीएफ और ईएसआईसी पंजीकरण कब अनिवार्य होता है?',
        answer: 'EPF registration is mandatory for any commercial establishment employing 20 or more persons (voluntary for fewer). ESIC registration is mandatory for units with 10 or more workers where wages are up to ₹21,000 per month. Both registrations are completed online in a single integrated form on shramsuvidha.gov.in.',
        answerHi: '20 या अधिक कर्मचारियों वाले प्रतिष्ठानों के लिए ईपीएफ और 10 या अधिक कर्मचारियों के लिए ईएसआईसी पंजीकरण अनिवार्य है। shramsuvidha.gov.in पर दोनों का संयुक्त पंजीकरण होता है।',
        portalUrl: 'https://shramsuvidha.gov.in',
        citation: 'Unified Shram Suvidha Portal, Ministry of Labour and Employment (shramsuvidha.gov.in)',
        keywords: ['epfo', 'esic', 'shram suvidha', 'employer registration', 'पीएफ पंजीकरण'],
      },
    ],
  },

  grievances: {
    domain: 'grievances',
    name: 'Customer Support & Public Grievances',
    nameHi: 'उपभोक्ता सहायता एवं जन शिकायत निवारण',
    description: 'Filing complaints for defective products, electricity outages, water supply, road potholes, and tracking central CPGRAMS grievances.',
    descriptionHi: 'दोषपूर्ण उत्पाद, बिजली कटौती, जल आपूर्ति, सड़क गड्ढों की शिकायत एवं सीपीग्राम्स ट्रैकिंग।',
    officialPortals: [
      { name: 'National Consumer Helpline (NCH INGRAM)', url: 'https://consumerhelpline.gov.in', department: 'Department of Consumer Affairs' },
      { name: 'CPGRAMS Central Public Grievance Portal', url: 'https://pgportal.gov.in', department: 'Department of Administrative Reforms and Public Grievances (DARPG)' },
      { name: 'RailMadad Indian Railways Grievance', url: 'https://railmadad.indianrailways.gov.in', department: 'Ministry of Railways' },
      { name: 'RTI Online Central Portal', url: 'https://rtionline.gov.in', department: 'Department of Personnel and Training (DoPT)' },
    ],
    templates: ['complaint_letter', 'rti_application'],
    sampleQueries: [
      { query: 'consumer helpline par complaint kaise kare', language: 'hi', expectedIntent: 'register_grievance' },
      { query: 'how to file a complaint for electricity meter fault', language: 'en', expectedIntent: 'register_grievance' },
    ],
    qaList: [
      {
        id: 'grv-qa-1',
        domain: 'grievances',
        topic: 'National Consumer Helpline (NCH INGRAM)',
        question: 'How do consumers lodge complaints against e-commerce fraud or defective goods on NCH?',
        questionHi: 'उपभोक्ता NCH पर ई-कॉमर्स धोखाधड़ी या खराब सामान के खिलाफ शिकायत कैसे दर्ज करें?',
        answer: 'Dial 1915 or register on consumerhelpline.gov.in (INGRAM). Enter details of the merchant, purchase order number, transaction date, and upload the invoice. The portal facilitates fast-track pre-litigation mediation with registered convergent companies, resolving over 85% of cases within 45 days.',
        answerHi: '1915 पर कॉल करें या consumerhelpline.gov.in पर जाएं। विक्रेता का नाम, ऑर्डर नंबर और बिल अपलोड करें। राष्ट्रीय उपभोक्ता हेल्पलाइन 45 दिनों के भीतर कंपनी से सीधी मध्यस्थता करवाती है।',
        portalUrl: 'https://consumerhelpline.gov.in',
        citation: 'Department of Consumer Affairs, Govt. of India (consumerhelpline.gov.in)',
        keywords: ['consumer helpline', 'ingram', 'defective goods', '1915', 'उपभोक्ता शिकायत', 'fraud complaint'],
      },
      {
        id: 'grv-qa-2',
        domain: 'grievances',
        topic: 'Electricity Outage & Billing Grievance',
        question: 'How do I lodge an official complaint for frequent power cuts or incorrect electricity bills?',
        questionHi: 'बार-बार बिजली कटौती या गलत बिजली बिल के लिए शिकायत कैसे दर्ज करें?',
        answer: 'Contact your state Discom portal or call the national power helpline 1912 with your Consumer Service Connection Number (IVRS No). If the local sub-station fails to resolve within the stipulated Standard of Performance (SoP) timeframe, escalate to the Consumer Grievance Redressal Forum (CGRF) and state Electricity Ombudsman.',
        answerHi: 'अपने बिजली बिल का उपभोक्ता नंबर (IVRS) लेकर 1912 डायल करें या डिस्कॉम पोर्टल पर शिकायत करें। समय पर समाधान न होने पर उपभोक्ता शिकायत निवारण फोरम (CGRF) में अपील करें।',
        portalUrl: 'https://urjamitra.com',
        citation: 'Ministry of Power & State Electricity Regulatory Commissions (urjamitra.com)',
        keywords: ['electricity complaint', 'power outage', '1912', 'cgrf', 'बिजली शिकायत', 'गलत बिल'],
      },
      {
        id: 'grv-qa-3',
        domain: 'grievances',
        topic: 'Municipal Potable Water & Drainage Issues',
        question: 'Where can citizens register grievances regarding polluted drinking water or blocked sewage?',
        questionHi: 'नागरिक दूषित पेयजल आपूर्ति या सीवेज जाम की शिकायत कहां दर्ज करा सकते हैं?',
        answer: 'Use the official mobile app or toll-free citizen grievance number of your local municipal corporation / Jal Board. Under the Citizen Charter, potable water contamination issues must be inspected within 24 hours. TechForm Buddy’s Grievances portal routes and tracks these complaints with direct tracking IDs.',
        answerHi: 'स्थानीय नगर निगम या जल बोर्ड के पोर्टल/हेल्पलाइन पर शिकायत करें। नागरिक चार्टर के अनुसार दूषित पानी की समस्या का 24 घंटे में निरीक्षण आवश्यक है। टेकफॉर्म बडी ट्रैकिंग आईडी के साथ इसे दर्ज करता है।',
        portalUrl: 'https://swachhbharaturban.gov.in',
        citation: 'Ministry of Housing and Urban Affairs & State Water Supply Boards (swachhbharaturban.gov.in)',
        keywords: ['water complaint', 'sewage blockage', 'drainage grievance', 'पानी की समस्या', 'सीवर जाम'],
      },
      {
        id: 'grv-qa-4',
        domain: 'grievances',
        topic: 'Road Potholes & Streetlight Repair (PWD)',
        question: 'How do I report dangerous road potholes, broken pavements, or dark streetlights?',
        questionHi: 'सड़क के खतरनाक गड्ढों, टूटे फुटपाथ या खराब स्ट्रीटलाइट की रिपोर्ट कैसे करें?',
        answer: 'Submit a geo-tagged photo and location on the central CPGRAMS portal or state public works application (such as Meri Sadak / PMGSY app for rural roads or municipal civic portals for city streets). The assigned junior engineer must rectify civic road hazards within 7 business days.',
        answerHi: 'सड़क के गड्ढे या खराब लाइट की फोटो खींचकर "मेरी सड़क" ऐप या नगर निगम पोर्टल पर दर्ज करें। लोक निर्माण विभाग (PWD) को 7 दिनों के भीतर इसे ठीक करना होता है।',
        portalUrl: 'https://pgportal.gov.in',
        citation: 'Public Works Department (PWD) & MoRTH (pgportal.gov.in)',
        keywords: ['pothole complaint', 'road repair', 'streetlight repair', 'सड़क के गड्ढे', 'स्ट्रीट लाइट'],
      },
      {
        id: 'grv-qa-5',
        domain: 'grievances',
        topic: 'CPGRAMS Central Public Grievance Redressal',
        question: 'How does CPGRAMS handle grievances against central government ministries and departments?',
        questionHi: 'सीपीग्राम्स (CPGRAMS) पर केंद्र सरकार के मंत्रालयों के खिलाफ शिकायत कैसे दर्ज और मॉनिटर होती है?',
        answer: 'Register on pgportal.gov.in. Select the relevant central ministry (e.g. Railways, Banking/Finance, Posts, Telecom, or Education) and describe your grievance in up to 4,000 characters with supporting attachments. Every grievance receives a unique registration number with a mandatory 30-day resolution timeline.',
        answerHi: 'pgportal.gov.in पर लॉगिन करें। संबंधित मंत्रालय चुनें और 4000 अक्षरों में शिकायत विवरण दें। प्रत्येक शिकायत को विशिष्ट नंबर मिलता है और 30 दिनों में निवारण अनिवार्य है।',
        portalUrl: 'https://pgportal.gov.in',
        citation: 'Department of Administrative Reforms & Public Grievances (DARPG) (pgportal.gov.in)',
        keywords: ['cpgrams', 'pgportal', 'central grievance', 'जन शिकायत', 'darpg'],
      },
      {
        id: 'grv-qa-6',
        domain: 'grievances',
        topic: 'RailMadad Railway Passenger Assistance',
        question: 'How do train passengers register instant complaints for coach cleanliness, food quality, or security?',
        questionHi: 'ट्रेन यात्री कोच की सफाई, भोजन की गुणवत्ता या सुरक्षा के लिए तुरंत शिकायत कैसे दर्ज करते हैं?',
        answer: 'Dial toll-free 139 or visit railmadad.indianrailways.gov.in. Provide your PNR number or coach and berth details. On-duty staff (OBHS cleaning crew, RPF escort, or catering manager) are alerted via mobile app and attend to the complaint at the next operational halt.',
        answerHi: '139 डायल करें या railmadad.indianrailways.gov.in पर पीएनआर नंबर दर्ज करें। ऑन-बोर्ड हाउसकीपिंग या आरपीएफ टीम अगले स्टेशन पर आकर समस्या का समाधान करती है।',
        portalUrl: 'https://railmadad.indianrailways.gov.in',
        citation: 'Indian Railways Passenger Grievance Redressal (railmadad.indianrailways.gov.in)',
        keywords: ['railmadad', 'railway complaint', '139', 'train cleanliness', 'रेलवे शिकायत', 'pnr help'],
      },
      {
        id: 'grv-qa-7',
        domain: 'grievances',
        topic: 'TRAI Telecom DND & Spam Complaints',
        question: 'How do citizens report spam marketing calls and SMS to TRAI for disconnection?',
        questionHi: 'नागरिक अनचाहे स्पैम कॉल और मैसेज की रिपोर्ट ट्राई (TRAI) को कैसे करते हैं?',
        answer: 'Activate Do Not Disturb (DND) by sending "START 0" to 1909. If you still receive promotional calls from unregistered telemarketers, report within 3 days via SMS to 1909 in format: "Brief description, Phone number, Date (DD/MM/YY)" or use the TRAI DND 3.0 mobile app.',
        answerHi: '1909 पर "START 0" एसएमएस भेजकर डीएनडी सक्रिय करें। फिर भी स्पैम कॉल आने पर 3 दिनों के भीतर 1909 पर रिपोर्ट करें। दूरसंचार ऑपरेटर उस नंबर को ब्लॉक करता है।',
        portalUrl: 'https://www.trai.gov.in',
        citation: 'Telecom Regulatory Authority of India (trai.gov.in)',
        keywords: ['trai', 'dnd', 'spam call', '1909', 'स्पैम कॉल', 'डू नॉट डिस्टर्ब'],
      },
      {
        id: 'grv-qa-8',
        domain: 'grievances',
        topic: 'Right to Information (RTI Section 6(1))',
        question: 'How do citizens file an online RTI application to inspect public records or tender delays?',
        questionHi: 'नागरिक सरकारी फाइलों या टेंडर की जानकारी के लिए ऑनलाइन आरटीआई कैसे लगाते हैं?',
        answer: 'Visit rtionline.gov.in for central public authorities. Select the department, frame up to 3,000 characters of clear, factual questions under Section 6(1), pay the statutory fee of ₹10 (BPL cardholders are exempt), and track response within the mandatory 30-day deadline.',
        answerHi: 'rtionline.gov.in पर जाएं। मंत्रालय चुनें, स्पष्ट बिंदुवार प्रश्न लिखें, ₹10 का शुल्क अदा करें (बीपीएल धारकों के लिए निशुल्क)। 30 दिनों में जवाब प्राप्त करने का कानूनी अधिकार है।',
        portalUrl: 'https://rtionline.gov.in',
        citation: 'Right to Information Online, DoPT, Govt. of India (rtionline.gov.in)',
        keywords: ['rti', 'right to information', 'section 6', 'सूचना का अधिकार', 'rtionline'],
      },
    ],
  },

  institutions: {
    domain: 'institutions',
    name: 'Institutional & Campus Administration',
    nameHi: 'संस्थागत एवं परिसर प्रशासन',
    description: 'Services and formal documentation for library cards, college hostel admissions, institutional NOCs, and character certificates.',
    descriptionHi: 'पुस्तकालय कार्ड, कॉलेज हॉस्टल प्रवेश, अनापत्ति प्रमाण पत्र (NOC) एवं चरित्र प्रमाण पत्र संबंधी सेवाएं।',
    officialPortals: [
      { name: 'University Grants Commission (UGC)', url: 'https://www.ugc.ac.in', department: 'Ministry of Education' },
      { name: 'National Digital Library of India (NDLI)', url: 'https://ndl.gov.in', department: 'Ministry of Education / IIT Kharagpur' },
      { name: 'AICTE Institutional Services', url: 'https://www.aicte-india.org', department: 'Ministry of Education' },
      { name: 'State Higher Education Council', url: 'https://samarth.edu.in', department: 'Higher Education Department' },
    ],
    templates: ['bonafide_certificate_request', 'hostel_admission_application'],
    sampleQueries: [
      { query: 'hostel admission ke liye application kaise likhe', language: 'hi', expectedIntent: 'build_document' },
      { query: 'how to apply for college NOC certificate', language: 'en', expectedIntent: 'build_document' },
    ],
    qaList: [
      {
        id: 'inst-qa-1',
        domain: 'institutions',
        topic: 'Public & University Library Membership',
        question: 'How do students and citizens obtain institutional library membership cards?',
        questionHi: 'छात्र और नागरिक संस्थागत पुस्तकालय सदस्यता कार्ड कैसे प्राप्त करते हैं?',
        answer: 'Submit a Library Membership Application Form to the Chief Librarian along with your institutional student identity card, proof of local residence, and two passport-sized photographs. TechForm Buddy provides a pre-formatted application with borrower undertakings.',
        answerHi: 'मुख्य ग्रंथपाल (लाइब्रेरियन) को पुस्तकालय सदस्यता फॉर्म, छात्र आईडी, पते का प्रमाण और 2 फोटो के साथ प्रस्तुत करें। टेकफॉर्म बडी इसका विधिवत आवेदन पत्र प्रदान करता है।',
        portalUrl: 'https://ndl.gov.in',
        citation: 'National Digital Library of India, Ministry of Education (ndl.gov.in)',
        keywords: ['library membership', 'library card', 'borrower card', 'पुस्तकालय कार्ड', 'लाइब्रेरी सदस्यता'],
      },
      {
        id: 'inst-qa-2',
        domain: 'institutions',
        topic: 'College Hostel Admission Allotment',
        question: 'What is the procedure and documentation needed for college hostel accommodation allotment?',
        questionHi: 'कॉलेज हॉस्टल में कमरे के आवंटन के लिए क्या प्रक्रिया और दस्तावेज आवश्यक हैं?',
        answer: 'Fill out the Hostel Admission Application Form addressed to the Chief Warden. Enclose your college admission receipt, permanent residence certificate (distance proof), medical fitness certificate from a registered physician, parent/guardian undertaking, and passport photos.',
        answerHi: 'चीफ वार्डन को संबोधित छात्रावास प्रवेश आवेदन भरें। कॉलेज प्रवेश रसीद, मूल निवास प्रमाण पत्र (दूरी का प्रमाण), चिकित्सा फिटनेस प्रमाण पत्र और अभिभावक का सहमति पत्र संलग्न करें।',
        portalUrl: 'https://samarth.edu.in',
        citation: 'Institutional Hostel Administration, UGC Guidelines (samarth.edu.in)',
        keywords: ['hostel admission', 'hostel form', 'chief warden', 'छात्रावास प्रवेश', 'हॉस्टल फॉर्म'],
      },
      {
        id: 'inst-qa-3',
        domain: 'institutions',
        topic: 'Institutional No Objection Certificate (NOC)',
        question: 'How do students and employees apply for an institutional No Objection Certificate (NOC)?',
        questionHi: 'छात्र और कर्मचारी संस्था से अनापत्ति प्रमाण पत्र (NOC) के लिए कैसे आवेदन करते हैं?',
        answer: 'Submit an NOC Request Letter to the Head of Institution stating your purpose (e.g. passport renewal, external competitive exam, or part-time internship). Confirm that no library dues or laboratory obligations remain pending. TechForm Buddy generates this formal NOC letter instantly.',
        answerHi: 'संस्था प्रमुख को उद्देश्य (जैसे पासपोर्ट, प्रतियोगी परीक्षा, या इंटर्नशिप) बताते हुए एनओसी प्रार्थना पत्र दें। स्पष्ट करें कि संस्था का कोई बकाया नहीं है। टेकफॉर्म बडी यह पत्र तुरंत तैयार करता है।',
        portalUrl: 'https://www.ugc.ac.in',
        citation: 'UGC Institutional Guidelines for Students and Faculty (ugc.ac.in)',
        keywords: ['noc', 'no objection certificate', 'clearance letter', 'अनापत्ति प्रमाण पत्र', 'एनओसी'],
      },
      {
        id: 'inst-qa-4',
        domain: 'institutions',
        topic: 'Character & Conduct Certificate',
        question: 'How can an alumnus or outgoing student obtain a Character & Conduct Certificate from their college?',
        questionHi: 'कोई पूर्व छात्र अपने कॉलेज से चरित्र एवं आचरण प्रमाण पत्र कैसे प्राप्त कर सकता है?',
        answer: 'Submit an application letter to the Principal or Registrar with a copy of your final semester marksheet and college ID card. The administrative office verifies discipline and proctorial records before issuing the official stamped Character Certificate within 3 to 5 business days.',
        answerHi: 'अंतिम सेमेस्टर की मार्कशीट और कॉलेज आईडी की प्रति के साथ प्राचार्य को आवेदन दें। कॉलेज अनुशासन रिकॉर्ड सत्यापित कर 3 से 5 दिनों में चरित्र प्रमाण पत्र जारी करता है।',
        portalUrl: 'https://samarth.edu.in',
        citation: 'Higher Education Academic Administration, UGC (samarth.edu.in)',
        keywords: ['character certificate', 'conduct certificate', 'चरित्र प्रमाण पत्र', 'आचरण प्रमाण पत्र'],
      },
      {
        id: 'inst-qa-5',
        domain: 'institutions',
        topic: 'Campus Student ID Card Re-issue',
        question: 'What should a student do if they lose their campus student identity card?',
        questionHi: 'यदि किसी छात्र का कैंपस आईडी कार्ड खो जाए तो उसे क्या करना चाहिए?',
        answer: 'File an online Lost Article Report with local police, draft a Student ID Re-issue Application addressed to the Proctor or Administrative Officer, pay the replacement fee (typically ₹50–₹100) at the accounts desk, and submit the receipt to the IT/ID card section for an updated card.',
        answerHi: 'पुलिस में गुमशुदगी की ऑनलाइन सूचना दें। प्रॉक्टर को आईडी कार्ड पुनः जारी करने हेतु प्रार्थना पत्र दें, चालान शुल्क जमा करें और नया स्मार्ट कार्ड प्राप्त करें।',
        portalUrl: 'https://samarth.edu.in',
        citation: 'Institutional Proctorial Regulations (samarth.edu.in)',
        keywords: ['lost id card', 'student id reissue', 'campus card', 'आईडी कार्ड', 'पहचान पत्र'],
      },
      {
        id: 'inst-qa-6',
        domain: 'institutions',
        topic: 'Degree Migration Certificate',
        question: 'How do students apply for a university Migration Certificate to join another institution?',
        questionHi: 'अन्य संस्थान में प्रवेश लेने हेतु छात्र विश्वविद्यालय से माइग्रेशन प्रमाण पत्र कैसे प्राप्त करते हैं?',
        answer: 'Apply on the university’s examination / student portal or submit a physical application with self-attested photocopies of your final degree/provisional marksheet and transfer certificate (TC). Pay the prescribed migration fee online to receive the dispatched certificate by registered post.',
        answerHi: 'विश्वविद्यालय परीक्षा पोर्टल पर अंतिम डिग्री/मार्कशीट और स्थानांतरण प्रमाण पत्र (टीसी) के साथ माइग्रेशन आवेदन करें। निर्धारित शुल्क अदा करने पर डाक द्वारा माइग्रेशन भेजा जाता है।',
        portalUrl: 'https://www.ugc.ac.in',
        citation: 'Inter-University Migration Regulations, UGC (ugc.ac.in)',
        keywords: ['migration certificate', 'university migration', 'tc', 'माइग्रेशन प्रमाण पत्र', 'प्रवासन प्रमाणपत्र'],
      },
      {
        id: 'inst-qa-7',
        domain: 'institutions',
        topic: 'Sports Complex & Gymkhana Membership',
        question: 'How do students enroll in university sports complexes, gymnasium, and swimming facilities?',
        questionHi: 'छात्र विश्वविद्यालय खेल परिसर, जिम और तैराकी सुविधाओं में सदस्यता कैसे लेते हैं?',
        answer: 'Submit the Gymkhana & Sports Complex Membership Form to the Director of Physical Education along with a registered physician’s medical fitness clearance and emergency parent contact. Members receive a biometric or barcode-enabled sports pass.',
        answerHi: 'शारीरिक शिक्षा निदेशक को मेडिकल फिटनेस सर्टिफिकेट और फोटो के साथ जिमखाना फॉर्म जमा करें। सत्यापन के बाद स्पोर्ट्स पास जारी किया जाता है।',
        portalUrl: 'https://www.ugc.ac.in',
        citation: 'UGC National Sports Promotion Guidelines (ugc.ac.in)',
        keywords: ['sports membership', 'gymkhana', 'swimming pass', 'खेल परिसर', 'जिम सदस्यता'],
      },
      {
        id: 'inst-qa-8',
        domain: 'institutions',
        topic: 'Tuition Fee Installment Undertaking',
        question: 'Can students request to pay college semester tuition fees in multiple installments?',
        questionHi: 'क्या छात्र कॉलेज सेमेस्टर की ट्यूशन फीस किस्तों में जमा करने का अनुरोध कर सकते हैं?',
        answer: 'Yes. Students experiencing temporary financial hardship can submit a formal Fee Installment Undertaking Letter to the Finance Committee or Principal. The application must explain the economic circumstances, attach family income proof, and propose a definite monthly payment timeline.',
        answerHi: 'हां। आर्थिक कठिनाई होने पर छात्र प्राचार्य को शपथ-पत्र सहित आवेदन प्रस्तुत कर सकते हैं। पारिवारिक आय प्रमाण पत्र संलग्न कर किस्तों की निश्चित तिथियां प्रस्तावित करें।',
        portalUrl: 'https://www.aicte-india.org',
        citation: 'Institutional Student Welfare & Fee Regulations (aicte-india.org)',
        keywords: ['fee installment', 'tuition fee concession', 'undertaking', 'फीस किस्त', 'शुल्क रियायत'],
      },
    ],
  },

  government: {
    domain: 'government',
    name: 'Government & Civic Services',
    nameHi: 'सरकारी एवं नागरिक सेवाएं',
    description: 'Core citizen document assistance: Voter ID, Passport, PAN Card, Driving License, Domicile, and Birth Certificates.',
    descriptionHi: 'मूल नागरिक सेवाएं: मतदाता पहचान पत्र, पासपोर्ट, पैन कार्ड, ड्राइविंग लाइसेंस, निवास एवं जन्म प्रमाण पत्र।',
    officialPortals: [
      { name: 'ECI Voters Portal', url: 'https://voters.eci.gov.in', department: 'Election Commission of India' },
      { name: 'Passport Seva', url: 'https://www.passportindia.gov.in', department: 'Ministry of External Affairs' },
      { name: 'Income Tax e-Filing (PAN)', url: 'https://www.incometax.gov.in', department: 'Income Tax Department, CBDT' },
      { name: 'Parivahan Sarathi (DL)', url: 'https://parivahan.gov.in', department: 'Ministry of Road Transport and Highways' },
    ],
    templates: ['certificate_application', 'complaint_letter', 'rti_application'],
    sampleQueries: [
      { query: 'voter id card kaise banaye', language: 'hi', expectedIntent: 'fill_form' },
      { query: 'how to apply for driving license online', language: 'en', expectedIntent: 'fill_form' },
    ],
    qaList: [
      {
        id: 'gov-qa-1',
        domain: 'government',
        topic: 'Voter ID Registration (Form 6)',
        question: 'How do first-time voters apply for an Election Card on the ECI portal?',
        questionHi: 'नए मतदाता भारत निर्वाचन आयोग के पोर्टल पर वोटर आईडी कार्ड के लिए कैसे आवेदन करते हैं?',
        answer: 'Indian citizens aged 18 or older apply on voters.eci.gov.in by filling Form 6. Upload proof of age (10th marksheet or birth certificate), proof of residence (Aadhaar or utility bill), and passport photo. Upon BLO field verification, your digital e-EPIC is generated and the physical EPIC card is delivered by India Post Speed Post.',
        answerHi: '18 वर्ष के नागरिक voters.eci.gov.in पर फॉर्म 6 भरें। आयु प्रमाण, निवास प्रमाण और फोटो अपलोड करें। बीएलओ सत्यापन के बाद डिजिटल ई-एपिक डाउनलोड करें और डाक से वोटर कार्ड पाएं।',
        portalUrl: 'https://voters.eci.gov.in',
        citation: 'Election Commission of India (voters.eci.gov.in)',
        keywords: ['voter id', 'form 6', 'e-epic', 'वोटर कार्ड', 'मतदाता पहचान'],
      },
      {
        id: 'gov-qa-2',
        domain: 'government',
        topic: 'Driving Learner & Permanent Licence',
        question: 'What is the step-by-step process for getting a Driving Licence via Parivahan Sarathi?',
        questionHi: 'परिवहन सारथी के माध्यम से ड्राइविंग लाइसेंस प्राप्त करने की चरणबद्ध प्रक्रिया क्या है?',
        answer: 'Visit parivahan.gov.in (Sarathi). Apply for Learner’s Licence (LL) online using Aadhaar e-KYC and pass the online road safety video and quiz. After holding an LL for 30 days, book a practical driving slot at your RTO to obtain your permanent laminated Smart Card Driving Licence.',
        answerHi: 'parivahan.gov.in पर आधार ई-केवाईसी से ऑनलाइन लर्नर लाइसेंस (LL) प्राप्त करें। 30 दिन बाद आरटीओ में ड्राइविंग टेस्ट देकर पक्का स्मार्ट कार्ड ड्राइविंग लाइसेंस प्राप्त करें।',
        portalUrl: 'https://parivahan.gov.in',
        citation: 'Ministry of Road Transport and Highways (parivahan.gov.in)',
        keywords: ['driving license', 'parivahan', 'sarathi', 'ड्राइविंग लाइसेंस', 'लर्नर लाइसेंस'],
      },
      {
        id: 'gov-qa-3',
        domain: 'government',
        topic: 'Tatkaal & Normal Passport',
        question: 'How do citizens apply for an Indian passport under Tatkaal or Normal schemes?',
        questionHi: 'नागरिक तत्काल या सामान्य योजना के तहत भारतीय पासपोर्ट के लिए कैसे आवेदन करते हैं?',
        answer: 'Register on passportindia.gov.in. Complete the online form with identity and residential details. Pay the statutory fee (₹1,500 normal / ₹3,500 tatkaal) and book an appointment slot at your nearest Passport Seva Kendra (PSK) for biometric capture and document verification.',
        answerHi: 'passportindia.gov.in पर फॉर्म भरें। शुल्क का भुगतान कर नजदीकी पासपोर्ट सेवा केंद्र (PSK) में स्लॉट बुक करें और मूल दस्तावेजों के साथ उपस्थित हों।',
        portalUrl: 'https://www.passportindia.gov.in',
        citation: 'Passport Seva, Ministry of External Affairs (passportindia.gov.in)',
        keywords: ['passport', 'tatkaal', 'psk', 'पासपोर्ट', 'पासपोर्ट सेवा'],
      },
      {
        id: 'gov-qa-4',
        domain: 'government',
        topic: 'Instant e-PAN Card',
        question: 'How quickly can I obtain an Instant e-PAN using Aadhaar e-KYC?',
        questionHi: 'आधार ई-केवाईसी के माध्यम से तुरंत e-PAN कार्ड कितनी देर में मिल जाता है?',
        answer: 'Instant e-PAN is issued completely free of charge in less than 10 minutes on incometax.gov.in. Enter your Aadhaar number, verify the OTP sent to your linked mobile number, and download the digitally signed PDF containing your permanent account number and QR code.',
        answerHi: 'incometax.gov.in पर 10 मिनट से कम समय में मुफ्त e-PAN मिलता है। आधार नंबर दर्ज कर ओटीपी सत्यापित करें और डिजिटल हस्ताक्षरित ई-पैन डाउनलोड करें।',
        portalUrl: 'https://www.incometax.gov.in',
        citation: 'Income Tax Department, Govt. of India (incometax.gov.in)',
        keywords: ['instant pan', 'e-pan', 'pan card', 'पैन कार्ड', 'ई-पैन'],
      },
      {
        id: 'gov-qa-5',
        domain: 'government',
        topic: 'Aadhaar Demographic Update',
        question: 'How can citizens update their address or phone number in Aadhaar online?',
        questionHi: 'नागरिक आधार में अपना पता या मोबाइल नंबर ऑनलाइन कैसे अपडेट कर सकते हैं?',
        answer: 'Visit myaadhaar.uidai.gov.in. Address updates can be done paperless online by uploading a valid address document (electricity bill, bank passbook, rent agreement) or using Head of Family (HoF) consent. Mobile number and biometric updates require a one-time visit to an Aadhaar Seva Kendra.',
        answerHi: 'myaadhaar.uidai.gov.in पर जाएं। बिजली बिल या बैंक पासबुक अपलोड कर पता ऑनलाइन अपडेट किया जा सकता है। मोबाइल नंबर या बायोमेट्रिक के लिए आधार सेवा केंद्र जाना आवश्यक है।',
        portalUrl: 'https://myaadhaar.uidai.gov.in',
        citation: 'Unique Identification Authority of India (UIDAI) (uidai.gov.in)',
        keywords: ['aadhaar update', 'uidai', 'address change', 'आधार सुधार', 'आधार अपडेट'],
      },
      {
        id: 'gov-qa-6',
        domain: 'government',
        topic: 'Income Certificate (Aay Praman Patra)',
        question: 'What is the procedure for obtaining an Income Certificate from the Tehsildar?',
        questionHi: 'तहसीलदार से आय प्रमाण पत्र प्राप्त करने की क्या प्रक्रिया है?',
        answer: 'Apply through your state’s e-District / RTPS portal (such as MP e-District, e-District Delhi, or UP eDistrict). Attach salary slip/ITR or self-attested revenue declaration, ration card, and electricity bill. The Revenue Inspector conducts verification and the digitally signed certificate is issued within 7 to 15 days.',
        answerHi: 'राज्य के e-District पोर्टल पर आय घोषणा, राशन कार्ड और बिजली बिल के साथ आवेदन करें। पटवारी/राजस्व निरीक्षक सत्यापन के बाद डिजिटल हस्ताक्षरित आय प्रमाण पत्र जारी होता है।',
        portalUrl: 'https://edistrict.gov.in',
        citation: 'State Revenue Department & e-District Portal (edistrict.gov.in)',
        keywords: ['income certificate', 'tehsildar', 'आय प्रमाण पत्र', 'edistrict'],
      },
      {
        id: 'gov-qa-7',
        domain: 'government',
        topic: 'Caste & Community Certificate',
        question: 'Who issues Caste / Category Certificates and what proofs are required?',
        questionHi: 'जाति प्रमाण पत्र कौन जारी करता है और क्या प्रमाण आवश्यक हैं?',
        answer: 'Issued by the Sub-Divisional Magistrate (SDM) or Tehsildar. Applicants must provide parental lineage proof showing caste record prior to the state cut-off year, family land records, and local residence proof. It is mandatory for reserved category reservation and fee concessions.',
        answerHi: 'एसडीएम या तहसीलदार द्वारा जारी किया जाता है। पैतृक जाति रिकॉर्ड, भूमि दस्तावेज और निवास प्रमाण पत्र आवश्यक हैं। यह सरकारी नौकरियों और छात्रवृत्ति के लिए अनिवार्य है।',
        portalUrl: 'https://edistrict.gov.in',
        citation: 'Ministry of Social Justice and Empowerment / State Revenue Departments (edistrict.gov.in)',
        keywords: ['caste certificate', 'sc st obc', 'जाति प्रमाण पत्र', 'category certificate'],
      },
      {
        id: 'gov-qa-8',
        domain: 'government',
        topic: 'Birth Certificate Registration',
        question: 'How do citizens register a birth and obtain an official Birth Certificate?',
        questionHi: 'नागरिक जन्म पंजीकरण कैसे कराते हैं और जन्म प्रमाण पत्र कैसे प्राप्त करते हैं?',
        answer: 'Births must be reported within 21 days of occurrence at the local municipal corporation or gram panchayat (or via crsorgi.gov.in). Hospital discharge slips and parents’ Aadhaar cards are required. The certificate is issued free of charge within 7 days.',
        answerHi: 'जन्म के 21 दिनों के भीतर नगर निगम या ग्राम पंचायत (crsorgi.gov.in) में पंजीकरण कराएं। अस्पताल का पर्चा और माता-पिता का आधार आवश्यक है।',
        portalUrl: 'https://crsorgi.gov.in',
        citation: 'Civil Registration System, Office of Registrar General of India (crsorgi.gov.in)',
        keywords: ['birth certificate', 'crsorgi', 'जन्म प्रमाण पत्र', 'जन्म पंजीकरण'],
      },
    ],
  },
};

/**
 * Searches curated domain knowledge Q&As across all 6 domains
 */
export function searchDomainQA(query: string, domain?: string): DomainQA[] {
  const qLower = query.toLowerCase().trim();
  const tokens = qLower.split(/\s+/).filter(w => w.length > 2);

  const targetPacks = domain && domain !== 'all' && DOMAIN_KNOWLEDGE_PACKS[domain as DomainCategory]
    ? [DOMAIN_KNOWLEDGE_PACKS[domain as DomainCategory]]
    : Object.values(DOMAIN_KNOWLEDGE_PACKS);

  const matchedQAs: Array<{ qa: DomainQA; score: number }> = [];

  for (const pack of targetPacks) {
    for (const qa of pack.qaList) {
      let score = 0;

      // 1. Exact phrase match in question or topic
      if (qa.question.toLowerCase().includes(qLower) || qa.topic.toLowerCase().includes(qLower)) {
        score += 15;
      }
      if (qa.questionHi && qa.questionHi.toLowerCase().includes(qLower)) {
        score += 15;
      }

      // 2. Keyword exact matches
      for (const kw of qa.keywords) {
        if (qLower.includes(kw.toLowerCase())) {
          score += 8;
        }
      }

      // 3. Token matches
      for (const token of tokens) {
        if (qa.question.toLowerCase().includes(token)) score += 3;
        if (qa.answer.toLowerCase().includes(token)) score += 1;
        if (qa.keywords.some(k => k.toLowerCase().includes(token))) score += 4;
      }

      if (score >= 4) {
        matchedQAs.push({ qa, score });
      }
    }
  }

  matchedQAs.sort((a, b) => b.score - a.score);
  return matchedQAs.map(m => m.qa);
}

/**
 * Returns all domain packs
 */
export function getAllDomainPacks(): DomainPack[] {
  return Object.values(DOMAIN_KNOWLEDGE_PACKS);
}

/**
 * Gets a specific domain pack
 */
export function getDomainPack(domain: DomainCategory): DomainPack | undefined {
  return DOMAIN_KNOWLEDGE_PACKS[domain];
}

/**
 * Converts domain pack Q&As into standard KnowledgeItem format for assistant RAG engine
 */
export function getDomainKnowledgeItems(): any[] {
  const items: any[] = [];
  for (const pack of Object.values(DOMAIN_KNOWLEDGE_PACKS)) {
    for (const qa of pack.qaList) {
      items.push({
        id: qa.id,
        domain: qa.domain,
        keywords: Array.from(new Set([...qa.keywords, qa.topic.toLowerCase(), pack.name.toLowerCase()])),
        title: qa.topic,
        summary: qa.answer,
        steps: [
          `Navigate to official portal: ${qa.portalUrl.replace(/^https?:\/\//, '')}`,
          `Locate the online application / guidance section for "${qa.topic}".`,
          `Review official eligibility criteria, fee structure, and timeline published by ${qa.citation}.`,
          `Prepare supporting documents (identity proof, address proof, and scheme certificates).`,
          `Submit form online or download pre-formatted petition from TechForm Buddy.`,
          `Keep application reference / acknowledgement receipt for tracking.`,
        ],
        documentsNeeded: [
          'Identity Proof (Aadhaar / Voter ID / Passport)',
          'Current Address Proof (Utility Bill / Rent Agreement)',
          'Relevant Institutional / Educational / Income Certificate',
        ],
        formCategory: qa.domain,
        formFields: [
          { label: 'Applicant Full Name', type: 'text', required: true },
          { label: 'Date of Birth', type: 'date', required: true },
          { label: 'Mobile Number', type: 'tel', required: true },
          { label: 'Email Address', type: 'email', required: false },
          { label: 'Identity / Reference Number', type: 'text', required: true },
          { label: 'Complete Residential Address', type: 'textarea', required: true },
        ],
        portalUrl: qa.portalUrl,
        processingTime: 'Standard timeline (7-21 business days)',
        officialDepartment: qa.citation,
      });
    }
  }
  return items;
}
