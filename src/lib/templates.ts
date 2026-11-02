/**
 * Form & Letter Templates Registry
 *
 * Defines official Indian government, academic, and business letter templates
 * with required fields, profile field mapping, validation rules, and high-quality
 * authentic fallback generators for both English and Hindi.
 */

export type TemplateKind = 'letter' | 'resume' | 'application_form' | 'declaration' | 'certificate_request' | 'other';

export interface TemplateField {
  key: string;
  label: string;
  labelHi: string;
  type: 'text' | 'date' | 'textarea' | 'number' | 'select' | 'tel' | 'email';
  required: boolean;
  profileKey?: string; // maps to user profile column (full_name, phone, address, etc.)
  placeholder: string;
  placeholderHi: string;
  options?: string[];
}

export interface DocumentSections {
  header?: string;       // To / Recipient address block & applicant reference
  date: string;          // Formatted date string
  subject: string;       // Formal subject line
  salutation?: string;   // Dear Sir / Respected Madam / महोदय
  body: string;          // Full paragraphs with \n\n separating them
  closing?: string;      // Yours faithfully / भवदीय
  signature: string;     // Name, designation/roll no, contact info
  enclosures?: string[]; // Array of attached document titles

  // Structured properties for application_form kind
  formTitle?: string;
  fieldsTable?: Array<{ label: string; value: string; labelHi?: string }>;
  coverNote?: string;    // Short 3-4 sentence statement of purpose in first person
  declaration?: string;  // Solemn affirmation / declaration
  place?: string;        // Place string
  hasPhoto?: boolean;
  photoBase64?: string;

  // Structured properties for resume kind
  contactInfo?: {
    name: string;
    email: string;
    phone: string;
    city?: string;
    linkedin?: string;
    github?: string;
  };
  summary?: string;
  education?: Array<{ degree: string; institution: string; year: string; score?: string }>;
  skills?: string[] | Record<string, string[]>;
  projects?: Array<{ title: string; tech?: string; bullets: string[] }>;
  experience?: Array<{ role: string; organization: string; period: string; bullets: string[] }>;
  certifications?: string[];
  languages?: string[];
}

export interface TemplateDocument {
  id: string;
  name: string;
  nameHi: string;
  type: string; // 'photo' | 'signature' | 'aadhaar' | 'marksheet' | 'income_certificate' | 'caste_certificate' | 'domicile' | 'resume' | 'fee_receipt' | 'college_id' | 'other'
  required: boolean;
  allowedFormats: string[]; // e.g. ['jpg', 'jpeg', 'png'] or ['pdf', 'jpg', 'png']
  maxSizeBytes?: number; // e.g. 200 * 1024
  minSizeBytes?: number;
  description?: string;
  descriptionHi?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  nameHi: string;
  category: string;
  kind: TemplateKind;
  description: string;
  descriptionHi: string;
  minLengthChars: number;
  requiredSections: Array<keyof DocumentSections>;
  fields: TemplateField[];
  requiredDocuments?: TemplateDocument[];
  isUnverified?: boolean; // True when AI-proposed for unknown form type
  systemPromptEn: string;
  systemPromptHi: string;
}

/**
 * Quality validator: Rejects meaningless placeholder text ("vvv", "asdf", etc.)
 * in required form fields.
 */
export interface InputQualityResult {
  isValid: boolean;
  error?: string;
}

export function validateInputQuality(
  value: string | undefined | null,
  fieldLabel: string,
  isRequired: boolean
): InputQualityResult {
  if (!value || typeof value !== 'string') {
    if (isRequired) {
      return { isValid: false, error: `${fieldLabel} is required.` };
    }
    return { isValid: true };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (isRequired) {
      return { isValid: false, error: `${fieldLabel} is required.` };
    }
    return { isValid: true };
  }

  // 1. Repeated identical characters (e.g. "vvv", "aaaa", "1111", "...", "---")
  if (/^(.)\1{2,}$/i.test(trimmed)) {
    return {
      isValid: false,
      error: `Please enter a valid ${fieldLabel}. Repeated characters like "${trimmed}" are not allowed.`,
    };
  }

  // Check if any single character makes up >=75% of string of length >= 4
  if (trimmed.length >= 4) {
    const charCounts: Record<string, number> = {};
    for (const ch of trimmed.toLowerCase()) {
      charCounts[ch] = (charCounts[ch] || 0) + 1;
    }
    const maxCharCount = Math.max(...Object.values(charCounts));
    if (maxCharCount / trimmed.length >= 0.75) {
      return {
        isValid: false,
        error: `Please enter a valid ${fieldLabel}. Meaningless input like "${trimmed}" is not allowed.`,
      };
    }
  }

  // 2. Meaningless placeholder / keyboard spam tokens
  const junkPatterns = [
    /^asdf+$/i,
    /^qwerty+$/i,
    /^zxcv+$/i,
    /^test(ing)?$/i,
    /^sample$/i,
    /^dummy$/i,
    /^temp(orary)?$/i,
    /^none$/i,
    /^n\/?a$/i,
    /^null$/i,
    /^undefined$/i,
    /^x{2,}$/i,
    /^xyz$/i,
    /^abc$/i,
    /^blah(\s*blah)*$/i,
    /^foo(\s*bar)?$/i,
  ];

  for (const pat of junkPatterns) {
    if (pat.test(trimmed)) {
      return {
        isValid: false,
        error: `Please enter a valid ${fieldLabel}. Placeholder text like "${trimmed}" is not allowed.`,
      };
    }
  }

  // 3. Minimum length check for substantive name/organization/skills/course fields
  const lowerLabel = fieldLabel.toLowerCase();
  const isNameOrEntity =
    lowerLabel.includes('name') ||
    lowerLabel.includes('college') ||
    lowerLabel.includes('university') ||
    lowerLabel.includes('institution') ||
    lowerLabel.includes('course') ||
    lowerLabel.includes('skills') ||
    lowerLabel.includes('domain');

  if (isNameOrEntity && trimmed.length < 3) {
    return {
      isValid: false,
      error: `${fieldLabel} is too short (minimum 3 characters required).`,
    };
  }

  // 4. Must contain letters for text fields (reject purely numbers/punctuation in names)
  if (
    isNameOrEntity &&
    !lowerLabel.includes('number') &&
    !lowerLabel.includes('phone') &&
    !lowerLabel.includes('pin') &&
    !lowerLabel.includes('code') &&
    !lowerLabel.includes('date') &&
    !lowerLabel.includes('dob')
  ) {
    const hasLetters = /[a-zA-Z\u0900-\u097F]/.test(trimmed);
    if (!hasLetters) {
      return {
        isValid: false,
        error: `${fieldLabel} must contain valid letters or words.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Clean up leading numbers ("1. ", "2) ", etc.) from enclosure titles to prevent duplicate numbering
 */
export function sanitizeEnclosureTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/^\s*\d+[\.\)\-:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const FORM_TEMPLATES: FormTemplate[] = [
  // 1. Formal Leave Application (No document step)
  {
    id: 'leave_application',
    name: 'Formal Leave Application Letter',
    nameHi: 'अवकाश हेतु प्रार्थना पत्र',
    category: 'leave',
    kind: 'letter',
    description: 'Formal application for casual, medical, or urgent personal leave to employer, principal, or department head.',
    descriptionHi: 'नियोक्ता, प्रधानाचार्य या विभागाध्यक्ष को आकस्मिक या चिकित्सीय अवकाश हेतु औपचारिक आवेदन पत्र।',
    minLengthChars: 450,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature'],
    requiredDocuments: [], // Empty: No document step required
    fields: [
      { key: 'applicant_name', label: 'Applicant Full Name', labelHi: 'आवेदक का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Rahul Sharma', placeholderHi: 'उदा. राहुल शर्मा' },
      { key: 'designation_or_roll', label: 'Designation / Student Roll No.', labelHi: 'पद / छात्र अनुक्रमांक', type: 'text', required: true, placeholder: 'e.g. Software Engineer / Roll No. 42', placeholderHi: 'उदा. सॉफ्टवेयर इंजीनियर / रोल नं. 42' },
      { key: 'organization_name', label: 'Organization / Institution Name', labelHi: 'संस्था / कंपनी का नाम', type: 'text', required: true, placeholder: 'e.g. Acme Infotech / Govt. College', placeholderHi: 'उदा. शासकीय महाविद्यालय, भोपाल' },
      { key: 'recipient_title', label: 'Recipient Title & Department', labelHi: 'प्राप्तकर्ता का पद व विभाग', type: 'text', required: true, placeholder: 'e.g. The Manager / The Principal', placeholderHi: 'उदा. श्रीमान शाखा प्रबंधक / प्रधानाचार्य महोदय' },
      { key: 'recipient_address', label: 'Office / City Location', labelHi: 'कार्यालय / शहर का पता', type: 'text', required: true, placeholder: 'e.g. Bhopal, Madhya Pradesh', placeholderHi: 'उदा. भोपाल, मध्य प्रदेश' },
      { key: 'leave_type', label: 'Type of Leave', labelHi: 'अवकाश का प्रकार', type: 'select', required: true, options: ['Casual Leave', 'Medical Leave', 'Earned Leave', 'Maternity/Paternity Leave', 'Emergency Personal Leave'], placeholder: 'Select leave type', placeholderHi: 'अवकाश का प्रकार चुनें' },
      { key: 'start_date', label: 'Leave Start Date', labelHi: 'अवकाश प्रारंभ तिथि', type: 'date', required: true, placeholder: 'YYYY-MM-DD', placeholderHi: 'YYYY-MM-DD' },
      { key: 'end_date', label: 'Leave End Date', labelHi: 'अवकाश समाप्ति तिथि', type: 'date', required: true, placeholder: 'YYYY-MM-DD', placeholderHi: 'YYYY-MM-DD' },
      { key: 'reason', label: 'Reason for Leave', labelHi: 'अवकाश का कारण', type: 'textarea', required: true, placeholder: 'Explain specific medical reason or personal requirement...', placeholderHi: 'अवकाश का स्पष्ट कारण (बीमारी, पारिवारिक कार्य, आदि)...' },
      { key: 'emergency_phone', label: 'Emergency Contact Phone', labelHi: 'आपातकालीन संपर्क नंबर', type: 'tel', required: false, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
    ],
    systemPromptEn: 'Draft an authentic, courteous Indian formal leave application letter with full contextual body paragraphs, specific dates, handover explanation, and polite closing.',
    systemPromptHi: 'एक प्रामाणिक, सम्मानजनक और औपचारिक हिंदी अवकाश प्रार्थना पत्र तैयार करें जिसमें स्पष्ट विषय, कारण, दिनांक और भवदीय हस्ताक्षर शामिल हों।',
  },

  // 2. Scholarship Application Letter
  {
    id: 'scholarship_application',
    name: 'Scholarship Application Letter',
    nameHi: 'छात्रवृत्ति हेतु आवेदन पत्र',
    category: 'scholarship',
    kind: 'application_form',
    description: 'Comprehensive financial assistance request to welfare department or institutional scholarship committee.',
    descriptionHi: 'समाज कल्याण विभाग अथवा संस्थागत छात्रवृत्ति समिति को वित्तीय सहायता हेतु औपचारिक आवेदन।',
    minLengthChars: 500,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature', 'enclosures'],
    requiredDocuments: [
      {
        id: 'photo',
        name: 'Passport Size Photograph',
        nameHi: 'पासपोर्ट साइज फोटो',
        type: 'photo',
        required: true,
        allowedFormats: ['jpg', 'jpeg', 'png'],
        maxSizeBytes: 200 * 1024, // 200 KB
        description: 'Recent clear color photograph (max 200 KB, JPG/PNG).',
        descriptionHi: 'हाल ही में खींची गई स्पष्ट रंगीन फोटो (अधिकतम 200 KB, JPG/PNG)।',
      },
      {
        id: 'signature',
        name: 'Applicant Signature',
        nameHi: 'आवेदक के हस्ताक्षर',
        type: 'signature',
        required: true,
        allowedFormats: ['jpg', 'jpeg', 'png'],
        maxSizeBytes: 100 * 1024, // 100 KB
        description: 'Clear digital signature on white paper (max 100 KB).',
        descriptionHi: 'सफेद कागज पर स्पष्ट हस्ताक्षर की स्कैन कॉपी (अधिकतम 100 KB)।',
      },
      {
        id: 'aadhaar',
        name: 'Aadhaar Card Copy',
        nameHi: 'आधार कार्ड प्रति',
        type: 'aadhaar',
        required: true,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSizeBytes: 2 * 1024 * 1024, // 2 MB
        description: 'Self-attested Aadhaar card for demographic verification (max 2 MB).',
        descriptionHi: 'पहचान एवं पते के प्रमाण हेतु आधार कार्ड की प्रति (अधिकतम 2 MB)।',
      },
      {
        id: 'marksheet',
        name: 'Previous Academic Marksheet',
        nameHi: 'पूर्व शैक्षणिक अंकसूची',
        type: 'marksheet',
        required: true,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSizeBytes: 2 * 1024 * 1024, // 2 MB
        description: 'Last qualifying examination marksheet or grade transcript (max 2 MB).',
        descriptionHi: 'अंतिम उत्तीर्ण परीक्षा की प्रमाणित अंकसूची (अधिकतम 2 MB)।',
      },
      {
        id: 'income_certificate',
        name: 'Income Certificate',
        nameHi: 'आय प्रमाण पत्र',
        type: 'income_certificate',
        required: true,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSizeBytes: 2 * 1024 * 1024, // 2 MB
        description: 'Valid revenue authority income certificate of current financial year (max 2 MB).',
        descriptionHi: 'सक्षम राजस्व अधिकारी द्वारा जारी वैध आय प्रमाण पत्र (अधिकतम 2 MB)।',
      },
      {
        id: 'caste_certificate',
        name: 'Caste Certificate (if applicable)',
        nameHi: 'जाति प्रमाण पत्र (यदि लागू हो)',
        type: 'caste_certificate',
        required: false,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSizeBytes: 2 * 1024 * 1024, // 2 MB
        description: 'SC/ST/OBC category certificate issued by competent authority (max 2 MB).',
        descriptionHi: 'आरक्षित वर्ग (SC/ST/OBC/EWS) के आवेदकों हेतु जाति प्रमाण पत्र।',
      },
    ],
    fields: [
      { key: 'applicant_name', label: 'Student Full Name', labelHi: 'छात्र का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Priya Patel', placeholderHi: 'उदा. प्रिया पटेल' },
      { key: 'father_name', label: 'Father / Guardian Name', labelHi: 'पिता / अभिभावक का नाम', type: 'text', required: true, profileKey: 'father_name', placeholder: 'e.g. Ramesh Patel', placeholderHi: 'उदा. रमेश पटेल' },
      { key: 'mother_name', label: 'Mother Name', labelHi: 'माता का नाम', type: 'text', required: true, profileKey: 'mother_name', placeholder: 'e.g. Sunita Patel', placeholderHi: 'उदा. सुनीता पटेल' },
      { key: 'dob', label: 'Date of Birth', labelHi: 'जन्म तिथि', type: 'date', required: true, profileKey: 'dob', placeholder: 'YYYY-MM-DD', placeholderHi: 'YYYY-MM-DD' },
      { key: 'email', label: 'Email Address', labelHi: 'ईमेल पता', type: 'email', required: true, profileKey: 'email', placeholder: 'priya.patel@example.com', placeholderHi: 'priya.patel@example.com' },
      { key: 'mobile', label: 'Mobile Number', labelHi: 'मोबाइल नंबर', type: 'tel', required: true, profileKey: 'phone', placeholder: '9876543210', placeholderHi: '9876543210' },
      { key: 'address', label: 'Residential Address', labelHi: 'निवास का पता', type: 'textarea', required: true, profileKey: 'address', placeholder: 'Complete address with Pincode', placeholderHi: 'पिनकोड सहित पूर्ण पता' },
      { key: 'category_caste', label: 'Category / Caste', labelHi: 'वर्ग / जाति', type: 'text', required: true, profileKey: 'category', placeholder: 'e.g. OBC / SC / ST / EWS', placeholderHi: 'उदा. अन्य पिछड़ा वर्ग (OBC) / SC / ST / EWS' },
      { key: 'institution_name', label: 'College / University Name', labelHi: 'कॉलेज / विश्वविद्यालय का नाम', type: 'text', required: true, placeholder: 'e.g. Govt. Polytechnic College, Indore', placeholderHi: 'उदा. शासकीय पॉलिटेक्निक कॉलेज, इंदौर' },
      { key: 'course_and_year', label: 'Course, Stream & Current Year', labelHi: 'पाठ्यक्रम, संकाय व वर्तमान वर्ष', type: 'text', required: true, placeholder: 'e.g. Diploma in Electrical Engg, 2nd Year', placeholderHi: 'उदा. इलेक्ट्रिकल इंजीनियरिंग डिप्लोमा, द्वितीय वर्ष' },
      { key: 'annual_income', label: 'Annual Family Income', labelHi: 'वार्षिक पारिवारिक आय', type: 'text', required: true, placeholder: 'e.g. Rs. 1,40,000/- per annum', placeholderHi: 'उदा. रु. 1,40,000/- प्रति वर्ष' },
      { key: 'academic_record', label: 'Previous Academic Performance (Marks / %)', labelHi: 'पूर्व शैक्षणिक परिणाम (अंक / %)', type: 'text', required: true, placeholder: 'e.g. 84.5% in 12th Board Examinations', placeholderHi: 'उदा. 12वीं बोर्ड में 84.5% अंक' },
      { key: 'recipient_title', label: 'Sanctioning Authority / Designation', labelHi: 'स्वीकृतिकर्ता प्राधिकारी / पद', type: 'text', required: true, placeholder: 'e.g. The District Welfare Officer', placeholderHi: 'उदा. जिला समाज कल्याण अधिकारी' },
      { key: 'department_or_office', label: 'Department / Office Name', labelHi: 'विभाग / कार्यालय का नाम', type: 'text', required: true, placeholder: 'e.g. Backward Classes & Minorities Welfare Department', placeholderHi: 'उदा. पिछड़ा वर्ग एवं अल्पसंख्यक कल्याण विभाग' },
      { key: 'scheme_name', label: 'Scholarship Scheme Name', labelHi: 'छात्रवृत्ति योजना का नाम', type: 'text', required: true, placeholder: 'e.g. Post-Matric State Scholarship Scheme 2026-27', placeholderHi: 'उदा. पोस्ट-मैट्रिक राज्य छात्रवृत्ति योजना' },
    ],
    systemPromptEn: 'Draft an authentic Indian government/institutional scholarship application letter highlighting economic eligibility, academic diligence, family circumstances, and complete enclosures list.',
    systemPromptHi: 'आर्थिक स्थिति, शैक्षणिक योग्यता और संलग्नक सूची के साथ संपूर्ण औपचारिक छात्रवृत्ति प्रार्थना पत्र तैयार करें।',
  },

  // 3. Formal Resignation Letter
  {
    id: 'resignation',
    name: 'Formal Resignation Letter',
    nameHi: 'त्यागपत्र / इस्तीफा पत्र',
    category: 'employment',
    kind: 'letter',
    description: 'Formal employee resignation letter to reporting manager or HR head with notice period and handover transition.',
    descriptionHi: 'प्रबंधक अथवा मानव संसाधन विभाग को नोटिस अवधि एवं दायित्व हस्तांतरण सहित औपचारिक त्यागपत्र।',
    minLengthChars: 450,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature'],
    requiredDocuments: [],
    fields: [
      { key: 'applicant_name', label: 'Employee Full Name', labelHi: 'कर्मचारी का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Rahul Sharma', placeholderHi: 'उदा. राहुल शर्मा' },
      { key: 'employee_id', label: 'Employee ID / Staff Code', labelHi: 'कर्मचारी कोड / स्टाफ आईडी', type: 'text', required: true, placeholder: 'e.g. EMP-40918', placeholderHi: 'उदा. EMP-40918' },
      { key: 'designation', label: 'Designation / Current Role', labelHi: 'वर्तमान पद / पदनाम', type: 'text', required: true, placeholder: 'e.g. Senior Software Engineer', placeholderHi: 'उदा. वरिष्ठ सॉफ्टवेयर इंजीनियर' },
      { key: 'department', label: 'Department / Team', labelHi: 'विभाग / प्रभाग', type: 'text', required: true, placeholder: 'e.g. Information Technology / Product Engg', placeholderHi: 'उदा. सूचना प्रौद्योगिकी / इंजीनियरिंग' },
      { key: 'organization_name', label: 'Company / Organization Name', labelHi: 'संस्था / कंपनी का नाम', type: 'text', required: true, placeholder: 'e.g. TechCorp Solutions Pvt. Ltd.', placeholderHi: 'उदा. टेककॉर्प सोल्यूशंस प्रा. लि.' },
      { key: 'recipient_title', label: 'Reporting Manager / HR Head Title', labelHi: 'रिपोर्टिंग मैनेजर / मानव संसाधन प्रमुख', type: 'text', required: true, placeholder: 'e.g. The Engineering Director / Head of HR', placeholderHi: 'उदा. श्रीमान इंजीनियरिंग डायरेक्टर / एचआर हेड' },
      { key: 'recipient_address', label: 'Office / City Location', labelHi: 'कार्यालय / शहर का स्थान', type: 'text', required: true, placeholder: 'e.g. Cyber City, Gurugram, Haryana', placeholderHi: 'उदा. साइबर सिटी, गुरुग्राम, हरियाणा' },
      { key: 'notice_period', label: 'Notice Period', labelHi: 'नोटिस अवधि', type: 'select', required: true, options: ['30 Days', '60 Days', '90 Days', 'Immediate (Notice Buyout)'], placeholder: 'Select notice period', placeholderHi: 'नोटिस अवधि चुनें' },
      { key: 'last_working_day', label: 'Proposed Last Working Date', labelHi: 'प्रस्तावित अंतिम कार्य दिवस', type: 'date', required: true, placeholder: 'YYYY-MM-DD', placeholderHi: 'YYYY-MM-DD' },
      { key: 'reason', label: 'Reason for Resignation', labelHi: 'त्यागपत्र का कारण', type: 'textarea', required: true, placeholder: 'Detail reason for resignation (career growth, higher studies, personal commitments)...', placeholderHi: 'त्यागपत्र का कारण (करियर विकास, उच्च शिक्षा, व्यक्तिगत कारण, आदि)...' },
      { key: 'emergency_phone', label: 'Personal Mobile / Contact', labelHi: 'व्यक्तिगत मोबाइल नंबर', type: 'tel', required: false, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
    ],
    systemPromptEn: 'Draft an authentic, courteous, and professional Indian formal resignation letter detailing gratitude for tenure, notice period timeline, last working date, thorough handover commitment, and polite closing.',
    systemPromptHi: 'एक प्रामाणिक, गरिमापूर्ण और औपचारिक हिंदी त्यागपत्र तैयार करें जिसमें कार्यकाल के प्रति कृतज्ञता, नोटिस अवधि, अंतिम कार्य दिवस और दायित्वों के सुचारू हस्तांतरण का विस्तृत विवरण हो।',
  },

  // 4. Complaint & Public Grievance Letter
  {
    id: 'complaint_letter',
    name: 'Formal Complaint & Grievance Letter',
    nameHi: 'औपचारिक शिकायत एवं समस्या निवारण पत्र',
    category: 'complaint',
    kind: 'letter',
    description: 'Official complaint to municipal corporation, police commissioner, consumer forum, or utility board.',
    descriptionHi: 'नगर निगम, पुलिस प्रशासन, उपभोक्ता फोरम या विद्युत विभाग को आधिकारिक शिकायत पत्र।',
    minLengthChars: 500,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature', 'enclosures'],
    requiredDocuments: [
      { id: 'doc_comp_photo', name: 'Photographs of Grievance Site / Issue', nameHi: 'समस्या स्थल के फोटो', type: 'photo', required: false, allowedFormats: ['jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
      { id: 'doc_comp_id', name: 'Complainant ID Proof', nameHi: 'पहचान प्रमाण', type: 'aadhaar', required: false, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Complainant Full Name', labelHi: 'शिकायतकर्ता का नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Amit Verma', placeholderHi: 'उदा. अमित वर्मा' },
      { key: 'applicant_address', label: 'Residential Address', labelHi: 'निवास का पता', type: 'textarea', required: true, profileKey: 'address', placeholder: 'House number, street, locality, city, pincode', placeholderHi: 'मकान नं., वार्ड, मोहल्ला, शहर व पिनकोड' },
      { key: 'recipient_title', label: 'Authority Designation', labelHi: 'प्राधिकारी का पद', type: 'text', required: true, placeholder: 'e.g. The Municipal Commissioner / Assistant Engineer', placeholderHi: 'उदा. नगर निगम आयुक्त / कार्यपालन यंत्री' },
      { key: 'authority_name', label: 'Department / Board Name', labelHi: 'विभाग / बोर्ड का नाम', type: 'text', required: true, placeholder: 'e.g. Municipal Corporation / State Power Distribution Co.', placeholderHi: 'उदा. नगर पालिक निगम / मध्य प्रदेश विद्युत वितरण कंपनी' },
      { key: 'incident_date', label: 'Date of Issue / Incident', labelHi: 'समस्या की तिथि / अवधि', type: 'text', required: true, placeholder: 'e.g. Since 15 October 2026', placeholderHi: 'उदा. पिछले 15 दिनों से लगातार' },
      { key: 'complaint_subject', label: 'Core Issue Subject', labelHi: 'शिकायत का मुख्य विषय', type: 'text', required: true, placeholder: 'e.g. Irregular drinking water supply and contaminated pipeline', placeholderHi: 'उदा. वार्ड में दूषित पेयजल आपूर्ति एवं पाइपलाइन लीकेज के संबंध में' },
      { key: 'complaint_details', label: 'Detailed Description of Problem', labelHi: 'समस्या का विस्तृत विवरण', type: 'textarea', required: true, placeholder: 'Explain specific difficulties faced, previous verbal complaints, and consequences...', placeholderHi: 'समस्या का विवरण, क्षेत्रवासियों को हो रही असुविधा और पूर्व में की गई शिकायतों का ब्यौरा...' },
      { key: 'relief_sought', label: 'Immediate Action / Relief Demanded', labelHi: 'अपेक्षित त्वरित कार्यवाही', type: 'textarea', required: true, placeholder: 'e.g. Immediate inspection by junior engineer, repair of pipeline, and supply restoration', placeholderHi: 'उदा. संबंधित अधिकारी द्वारा स्थल निरीक्षण, पाइपलाइन मरम्मत व शुद्ध पेयजल आपूर्ति' },
    ],
    systemPromptEn: 'Draft a firm, formal, well-structured Indian administrative complaint letter stating exact facts, public hardship, statutory duty of authority, and specific relief demanded.',
    systemPromptHi: 'नागरिक अधिकार, सार्वजनिक समस्या और तत्काल समाधान की मांग करते हुए एक सशक्त, वैधानिक और औपचारिक शिकायत पत्र तैयार करें।',
  },

  // 5. RTI Application (Right to Information)
  {
    id: 'rti_application',
    name: 'RTI Application Letter (Section 6(1))',
    nameHi: 'सूचना का अधिकार (RTI) आवेदन पत्र',
    category: 'rti',
    kind: 'application_form',
    description: 'Statutory application seeking official certified records, file notings, or inspection under RTI Act 2005.',
    descriptionHi: 'सूचना का अधिकार अधिनियम 2005 की धारा 6(1) के अंतर्गत प्रमाणित अभिलेख व जानकारी प्राप्ति हेतु आवेदन।',
    minLengthChars: 500,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature', 'enclosures'],
    requiredDocuments: [
      { id: 'doc_rti_ipo', name: 'IPO / Fee Receipt', nameHi: 'पोस्टल ऑर्डर / शुल्क रसीद', type: 'fee_receipt', required: true, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
      { id: 'doc_rti_id', name: 'Citizen Identity Proof', nameHi: 'नागरिक पहचान पत्र', type: 'aadhaar', required: false, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Applicant Name', labelHi: 'आवेदक का नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Rajesh Kumar', placeholderHi: 'उदा. राजेश कुमार' },
      { key: 'applicant_address', label: 'Applicant Postal Address', labelHi: 'आवेदक का डाक पता', type: 'textarea', required: true, profileKey: 'address', placeholder: 'Complete address for postal delivery of info', placeholderHi: 'पिनकोड सहित डाक प्राप्त करने का पूरा पता' },
      { key: 'pio_designation', label: 'Public Information Officer (PIO) Title', labelHi: 'जन सूचना अधिकारी का पद', type: 'text', required: true, placeholder: 'The Central / State Public Information Officer (CPIO / SPIO)', placeholderHi: 'श्रीमान लोक सूचना अधिकारी (PIO)' },
      { key: 'public_authority', label: 'Public Authority / Department', labelHi: 'सार्वजनिक प्राधिकरण / विभाग', type: 'text', required: true, placeholder: 'e.g. Public Works Department / District Collectorate', placeholderHi: 'उदा. लोक निर्माण विभाग (PWD) / कलेक्ट्रेट कार्यालय' },
      { key: 'office_address', label: 'Office Location / City', labelHi: 'कार्यालय का स्थान / शहर', type: 'text', required: true, placeholder: 'e.g. Vallabh Bhawan, Bhopal, M.P.', placeholderHi: 'उदा. मंत्रालय, वल्लभ भवन, भोपाल' },
      { key: 'particulars_of_information', label: 'Specific Information Requested', labelHi: 'वांछित सूचना का बिंदुवार विवरण', type: 'textarea', required: true, placeholder: '1. Certified copy of tender document... 2. Work completion certificate and payment receipts...', placeholderHi: '1. स्वीकृत कार्य की प्रमाणित प्रतिलिपि... 2. भुगतान वाउचर व कार्य पूर्णता प्रमाण पत्र...' },
      { key: 'period_pertaining_to', label: 'Period Pertaining to Information', labelHi: 'सूचना से संबंधित समयावधि', type: 'text', required: true, placeholder: 'e.g. 01 April 2024 to 31 March 2026', placeholderHi: 'उदा. 1 अप्रैल 2024 से 31 मार्च 2026 तक' },
      { key: 'fee_details', label: 'Application Fee Details', labelHi: 'आवेदन शुल्क का विवरण', type: 'text', required: true, placeholder: 'e.g. Indian Postal Order (IPO) No. 45G 123456 of Rs. 10/-', placeholderHi: 'उदा. रु. 10/- का भारतीय पोस्टल ऑर्डर (IPO) सं. 45G 123456 संलग्न' },
    ],
    systemPromptEn: 'Draft a legally compliant RTI application strictly adhering to Section 6(1) of Right to Information Act 2005 with clear itemized queries, citizenship declaration, and fee details.',
    systemPromptHi: 'सूचना का अधिकार अधिनियम 2005 की धारा 6(1) के कानूनी प्रावधानों के अनुरूप बिंदुवार जानकारी, भारतीय नागरिकता की घोषणा और शुल्क विवरण सहित औपचारिक आवेदन बनाएं।',
  },

  // 6. Income / Caste / Domicile Certificate Application
  {
    id: 'certificate_application',
    name: 'Certificate Application (Income / Caste / Domicile)',
    nameHi: 'प्रमाण पत्र हेतु आवेदन (आय / जाति / मूल निवास)',
    category: 'certificate',
    kind: 'certificate_request',
    description: 'Official citizen application to Tehsildar or Sub-Divisional Officer (SDO) for issuance of revenue certificates.',
    descriptionHi: 'तहसीलदार अथवा अनुविभागीय अधिकारी (राजस्व) को आय, जाति अथवा मूल निवास प्रमाण पत्र जारी करने हेतु आवेदन।',
    minLengthChars: 480,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature', 'enclosures'],
    requiredDocuments: [
      { id: 'doc_cert_photo', name: 'Passport Size Photograph', nameHi: 'पासपोर्ट फोटो', type: 'photo', required: true, allowedFormats: ['jpg', 'jpeg', 'png'], maxSizeBytes: 200 * 1024 },
      { id: 'doc_cert_aadhaar', name: 'Aadhaar Card', nameHi: 'आधार कार्ड', type: 'aadhaar', required: true, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
      { id: 'doc_cert_income_proof', name: 'Ration Card / Salary Slip', nameHi: 'राशन कार्ड / वेतन पर्ची', type: 'income_certificate', required: false, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Applicant Legal Name', labelHi: 'आवेदक का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Sandeep Lodhi', placeholderHi: 'उदा. संदीप लोधी' },
      { key: 'father_name', label: 'Father / Husband Name', labelHi: 'पिता / पति का नाम', type: 'text', required: true, profileKey: 'father_name', placeholder: 'e.g. Mohan Lodhi', placeholderHi: 'उदा. मोहन लोधी' },
      { key: 'applicant_address', label: 'Permanent Residence Address', labelHi: 'स्थाई निवास का पता', type: 'textarea', required: true, profileKey: 'address', placeholder: 'Village/Town, Tehsil, District, State & Pincode', placeholderHi: 'ग्राम/वार्ड, तहसील, जिला व राज्य' },
      { key: 'recipient_title', label: 'Revenue Authority Title', labelHi: 'राजस्व अधिकारी का पद', type: 'text', required: true, placeholder: 'e.g. The Tehsildar / Sub-Divisional Magistrate (SDM)', placeholderHi: 'उदा. श्रीमान तहसीलदार महोदय / अनुविभागीय अधिकारी (राजस्व)' },
      { key: 'tehsil_district', label: 'Tehsil & District Name', labelHi: 'तहसील व जिले का नाम', type: 'text', required: true, placeholder: 'e.g. Tehsil Huzur, District Bhopal, M.P.', placeholderHi: 'उदा. तहसील हुजूर, जिला भोपाल (म.प्र.)' },
      { key: 'certificate_type', label: 'Certificate Required', labelHi: 'वांछित प्रमाण पत्र', type: 'select', required: true, options: ['Income Certificate (आय प्रमाण पत्र)', 'Caste Certificate (जाति प्रमाण पत्र)', 'Domicile / Residence Certificate (मूल निवास प्रमाण पत्र)', 'Economically Weaker Section (EWS) Certificate'], placeholder: 'Select certificate type', placeholderHi: 'प्रमाण पत्र का प्रकार चुनें' },
      { key: 'purpose', label: 'Purpose of Certificate', labelHi: 'प्रमाण पत्र का प्रयोजन', type: 'text', required: true, placeholder: 'e.g. Higher Education Admission / Govt. Scholarship / Employment', placeholderHi: 'उदा. उच्च शिक्षा प्रवेश एवं सरकारी छात्रवृत्ति हेतु' },
      { key: 'annual_income', label: 'Declared Annual Income (for Income Cert)', labelHi: 'घोषित वार्षिक आय (आय प्रमाण पत्र हेतु)', type: 'text', required: false, placeholder: 'e.g. Rs. 1,20,000/- from agriculture & manual labor', placeholderHi: 'उदा. रु. 1,20,000/- (कृषि व मजदूरी से)' },
      { key: 'caste_subcaste', label: 'Caste & Sub-Caste (for Caste Cert)', labelHi: 'जाति व उप-जाति (जाति प्रमाण पत्र हेतु)', type: 'text', required: false, placeholder: 'e.g. Lodhi (OBC Category, Sr. No. 48)', placeholderHi: 'उदा. लोधी (अन्य पिछड़ा वर्ग, सरल क्र. 48)' },
    ],
    systemPromptEn: 'Draft a standard revenue administration application for state revenue certificate including verification statement, declaration of truthfulness, and statutory enclosure proofs.',
    systemPromptHi: 'राजस्व संहिता के अनुरूप तहसीलदार को प्रस्तुत करने योग्य प्रमाण पत्र आवेदन पत्र बनाएं जिसमें सत्यनिष्ठा की घोषणा और सभी आवश्यक प्रमाण संलग्न हों।',
  },

  // 7. Bank KYC Update Letter
  {
    id: 'bank_kyc_letter',
    name: 'Bank KYC Update & Reactivation Letter',
    nameHi: 'बैंक केवाईसी अद्यतन एवं खाता सत्यापन पत्र',
    category: 'banking',
    kind: 'letter',
    description: 'Formal request to bank branch manager for periodic KYC update, address change, or account unfreezing.',
    descriptionHi: 'बैंक शाखा प्रबंधक को आवधिक केवाईसी अद्यतन, पता संशोधन अथवा खाता सक्रियण हेतु आवेदन।',
    minLengthChars: 450,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature', 'enclosures'],
    requiredDocuments: [
      { id: 'doc_kyc_photo', name: 'Passport Size Photograph', nameHi: 'पासपोर्ट फोटो', type: 'photo', required: true, allowedFormats: ['jpg', 'jpeg', 'png'], maxSizeBytes: 200 * 1024 },
      { id: 'doc_kyc_pan', name: 'PAN Card Copy', nameHi: 'पैन कार्ड प्रति', type: 'pan', required: true, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
      { id: 'doc_kyc_aadhaar', name: 'Aadhaar Card / Address Proof', nameHi: 'आधार कार्ड / पते का प्रमाण', type: 'aadhaar', required: true, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'account_holder_name', label: 'Account Holder Full Name', labelHi: 'खाताधारक का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Manoj Joshi', placeholderHi: 'उदा. मनोज जोशी' },
      { key: 'account_number', label: 'Bank Account Number', labelHi: 'बैंक खाता संख्या', type: 'text', required: true, placeholder: 'e.g. 10293847561', placeholderHi: 'उदा. 10293847561' },
      { key: 'bank_name', label: 'Bank Name', labelHi: 'बैंक का नाम', type: 'text', required: true, placeholder: 'e.g. State Bank of India / Punjab National Bank', placeholderHi: 'उदा. भारतीय स्टेट बैंक (SBI)' },
      { key: 'branch_name', label: 'Branch Name & Location', labelHi: 'शाखा का नाम व स्थान', type: 'text', required: true, placeholder: 'e.g. TT Nagar Branch, Bhopal', placeholderHi: 'उदा. टी.टी. नगर शाखा, भोपाल' },
      { key: 'residential_address', label: 'Current Residential Address', labelHi: 'वर्तमान निवास का पता', type: 'textarea', required: true, profileKey: 'address', placeholder: 'Complete address with Pincode', placeholderHi: 'पिनकोड सहित पूर्ण पता' },
      { key: 'registered_phone', label: 'Registered Mobile Number', labelHi: 'पंजीकृत मोबाइल नंबर', type: 'tel', required: true, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
      { key: 'kyc_purpose', label: 'KYC Purpose', labelHi: 'केवाईसी का कारण', type: 'select', required: true, options: ['Periodic Re-KYC Compliance', 'Reactivation of Inoperative / Dormant Account', 'Address & Contact Details Updation', 'Removal of Debit Freeze'], placeholder: 'Select KYC purpose', placeholderHi: 'केवाईसी का कारण चुनें' },
    ],
    systemPromptEn: 'Draft an authentic banking correspondence to the Branch Manager for KYC update and account maintenance adhering to Reserve Bank of India (RBI) KYC master guidelines.',
    systemPromptHi: 'भारतीय रिज़र्व बैंक के केवाईसी दिशा-निर्देशों के अनुसार शाखा प्रबंधक को संबोधित औपचारिक बैंक केवाईसी अद्यतन पत्र तैयार करें।',
  },

  // 8. Job Application / Cover Letter
  {
    id: 'job_application',
    name: 'Job Application & Formal Cover Letter',
    nameHi: 'नौकरी हेतु आवेदन एवं कवर लेटर',
    category: 'employment',
    kind: 'letter',
    description: 'Professional employment application highlighting experience, educational background, and role alignment.',
    descriptionHi: 'अनुभव, शैक्षणिक योग्यता और पद की उपयुक्तता दर्शाते हुए व्यावसायिक नौकरी आवेदन पत्र।',
    minLengthChars: 480,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature', 'enclosures'],
    requiredDocuments: [
      { id: 'doc_job_photo', name: 'Passport Size Photograph', nameHi: 'पासपोर्ट फोटो', type: 'photo', required: false, allowedFormats: ['jpg', 'jpeg', 'png'], maxSizeBytes: 200 * 1024 },
      { id: 'doc_job_resume', name: 'Resume / Curriculum Vitae', nameHi: 'बायोडाटा / रिज्यूमे', type: 'resume', required: true, allowedFormats: ['pdf', 'docx'], maxSizeBytes: 2 * 1024 * 1024 },
      { id: 'doc_job_degree', name: 'Degree / Marksheet', nameHi: 'डिग्री / अंकसूची', type: 'marksheet', required: false, allowedFormats: ['pdf', 'jpg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Applicant Name', labelHi: 'आवेदक का नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Sneha Roy', placeholderHi: 'उदा. स्नेहा रॉय' },
      { key: 'applicant_email', label: 'Email Address', labelHi: 'ईमेल पता', type: 'email', required: true, profileKey: 'email', placeholder: 'sneha.roy@example.com', placeholderHi: 'sneha.roy@example.com' },
      { key: 'applicant_phone', label: 'Mobile Number', labelHi: 'मोबाइल नंबर', type: 'tel', required: true, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
      { key: 'position_applied', label: 'Position / Post Applied For', labelHi: 'आवेदित पद का नाम', type: 'text', required: true, placeholder: 'e.g. Accounts Assistant / Operations Executive', placeholderHi: 'उदा. लेखा सहायक / ऑपरेशन्स एग्जीक्यूटिव' },
      { key: 'company_name', label: 'Company / Organization Name', labelHi: 'कंपनी / संस्था का नाम', type: 'text', required: true, placeholder: 'e.g. Tata Consultancy Services', placeholderHi: 'उदा. टाटा कंसल्टेंसी सर्विसेज' },
      { key: 'hiring_manager_title', label: 'Hiring Authority Designation', labelHi: 'नियुक्ति प्राधिकारी का पद', type: 'text', required: true, placeholder: 'e.g. The HR Manager / Recruitment Team', placeholderHi: 'उदा. मानव संसाधन प्रबंधक (HR Head)' },
      { key: 'qualification_summary', label: 'Key Qualifications & Experience', labelHi: 'मुख्य योग्यताएं एवं अनुभव', type: 'textarea', required: true, placeholder: 'Highlight degrees, relevant software skills, and years of experience...', placeholderHi: 'स्नातक/डिप्लोमा, प्रासंगिक कंप्यूटर कौशल व कार्य अनुभव का संक्षेप...' },
    ],
    systemPromptEn: 'Draft an Indian formal corporate or government job application letter presenting professional qualifications, enthusiasm, and career credentials persuasively.',
    systemPromptHi: 'शैक्षणिक योग्यता, तकनीकी दक्षता और निष्ठापूर्वक कार्य करने की प्रतिबद्धता दर्शाते हुए एक प्रभावशाली औपचारिक नौकरी आवेदन पत्र तैयार करें।',
  },

  // 9. Student Internship Application Form (Requirement 1: application_form kind)
  {
    id: 'student_internship',
    name: 'Student Internship Application Form',
    nameHi: 'छात्र इंटर्नशिप आवेदन फॉर्म',
    category: 'internship',
    kind: 'application_form',
    description: 'Structured formal application form for college and university students seeking semester, summer, or industry internships.',
    descriptionHi: 'कॉलेज एवं विश्वविद्यालय छात्रों हेतु ग्रीष्मकालीन/सत्र इंटर्नशिप हेतु संरचित औपचारिक आवेदन फॉर्म।',
    minLengthChars: 400,
    requiredSections: ['subject', 'body', 'signature'],
    requiredDocuments: [
      {
        id: 'doc_intern_resume',
        name: 'Resume / Curriculum Vitae',
        nameHi: 'बायोडाटा / रेज़्यूमे',
        type: 'resume',
        required: false,
        allowedFormats: ['pdf', 'docx'],
        maxSizeBytes: 2 * 1024 * 1024,
        description: 'Optional: attach your current resume or curriculum vitae.',
        descriptionHi: 'वैकल्पिक: अपना वर्तमान रेज़्यूमे या सीवी संलग्न करें।',
      },
      {
        id: 'doc_intern_college_id',
        name: 'College ID Card / Bonafide Certificate',
        nameHi: 'कॉलेज पहचान पत्र / बोनाफाइड प्रमाण पत्र',
        type: 'college_id',
        required: false,
        allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSizeBytes: 2 * 1024 * 1024,
        description: 'Optional: college identity card or bonafide student certificate.',
        descriptionHi: 'वैकल्पिक: कॉलेज पहचान पत्र अथवा संस्थागत बोनाफाइड प्रमाण पत्र।',
      },
      {
        id: 'doc_intern_photo',
        name: 'Passport Size Photograph',
        nameHi: 'पासपोर्ट साइज फोटो',
        type: 'photo',
        required: false,
        allowedFormats: ['jpg', 'jpeg', 'png'],
        maxSizeBytes: 500 * 1024,
        description: 'Optional: recent passport photo to embed in the application form.',
        descriptionHi: 'वैकल्पिक: आवेदन पत्र में लगाने हेतु हाल की पासपोर्ट साइज फोटो।',
      },
    ],
    fields: [
      { key: 'applicant_name', label: 'Applicant Full Name', labelHi: 'आवेदक का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Rajesh Sharma', placeholderHi: 'उदा. राजेश शर्मा' },
      { key: 'father_name', label: "Father's Name", labelHi: 'पिता का नाम', type: 'text', required: true, placeholder: 'e.g. Suresh Sharma', placeholderHi: 'उदा. सुरेश शर्मा' },
      { key: 'dob', label: 'Date of Birth', labelHi: 'जन्म तिथि', type: 'date', required: true, profileKey: 'date_of_birth', placeholder: 'YYYY-MM-DD', placeholderHi: 'YYYY-MM-DD' },
      { key: 'college', label: 'College / University Name', labelHi: 'कॉलेज / विश्वविद्यालय का नाम', type: 'text', required: true, placeholder: 'e.g. National Institute of Technology, Bhopal', placeholderHi: 'उदा. राष्ट्रीय प्रौद्योगिकी संस्थान, भोपाल' },
      { key: 'course', label: 'Course / Degree', labelHi: 'पाठ्यक्रम / डिग्री', type: 'text', required: true, placeholder: 'e.g. B.Tech Computer Science & Engg', placeholderHi: 'उदा. बी.टेक (कंप्यूटर साइंस)' },
      { key: 'semester_year', label: 'Semester / Current Year', labelHi: 'सेमेस्टर / वर्तमान वर्ष', type: 'text', required: true, placeholder: 'e.g. 6th Semester / 3rd Year', placeholderHi: 'उदा. छठा सेमेस्टर / तृतीय वर्ष' },
      { key: 'contact', label: 'Contact Phone Number', labelHi: 'संपर्क मोबाइल नंबर', type: 'tel', required: true, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
      { key: 'email', label: 'Email Address', labelHi: 'ईमेल पता', type: 'email', required: true, profileKey: 'email', placeholder: 'rajesh.sharma@example.com', placeholderHi: 'rajesh.sharma@example.com' },
      { key: 'skills', label: 'Technical & Core Skills', labelHi: 'तकनीकी कौशल (Key Skills)', type: 'text', required: true, placeholder: 'e.g. Python, TypeScript, React, SQL, Machine Learning', placeholderHi: 'उदा. पायथन, रिएक्ट, मशीन लर्निंग' },
      { key: 'preferred_domain', label: 'Preferred Internship Domain', labelHi: 'पसंदीदा कार्यक्षेत्र (Domain)', type: 'text', required: true, placeholder: 'e.g. Web Development / AI / Data Analytics', placeholderHi: 'उदा. वेब डेवलपमेंट / एआई / डेटा एनालिटिक्स' },
      { key: 'duration', label: 'Internship Duration', labelHi: 'इंटर्नशिप की अवधि', type: 'text', required: true, placeholder: 'e.g. 3 Months (June - August 2026)', placeholderHi: 'उदा. 3 माह (जून - अगस्त 2026)' },
      { key: 'organization_name', label: 'Host Organization / Company Name', labelHi: 'संस्था / कंपनी का नाम (यदि ज्ञात हो)', type: 'text', required: false, placeholder: 'e.g. Infosys / DRDO / TechCorp (Leave blank if general)', placeholderHi: 'उदा. कंपनी या संस्था का नाम' },
      { key: 'recipient_title', label: 'Addressed To (Optional)', labelHi: 'प्राप्तकर्ता का पद (वैकल्पिक)', type: 'text', required: false, placeholder: 'e.g. The HR Manager / Internship Coordinator', placeholderHi: 'उदा. मानव संसाधन प्रबंधक / इंटर्नशिप समन्वयक' },
    ],
    systemPromptEn: 'Draft an authentic, structured Indian Student Internship Application Form. Generate a professional 3-4 sentence Statement of Purpose in natural first person, a formal declaration, and precise particulars.',
    systemPromptHi: 'कॉलेज छात्रों हेतु एक सुव्यवस्थित इंटर्नशिप आवेदन फॉर्म तैयार करें जिसमें प्रथम पुरुष में संक्षिप्त उद्देश्य विवरण (SOP), सत्यनिष्ठा घोषणा और संपूर्ण व्यक्तिगत विवरण शामिल हो।',
  },

  // 10. ATS Professional Resume / CV (kind: resume)
  {
    id: 'resume',
    name: 'Professional Resume / CV',
    nameHi: 'व्यावसायिक बायोडाटा (रेज़्यूमे / CV)',
    category: 'resume',
    kind: 'resume',
    description: 'ATS-compliant single column professional resume with clean sections for summary, education, skills, projects, and experience.',
    descriptionHi: 'ATS-अनुरूप एकल स्तंभ व्यावसायिक रेज़्यूमे (बायोडाटा) जिसमें सारांश, शिक्षा, कौशल, परियोजनाएं और अनुभव शामिल हैं।',
    minLengthChars: 400,
    requiredSections: ['body', 'signature'],
    requiredDocuments: [
      {
        id: 'doc_resume_photo',
        name: 'Passport Size Photograph (Optional)',
        nameHi: 'पासपोर्ट साइज फोटो (वैकल्पिक)',
        type: 'photo',
        required: false,
        allowedFormats: ['jpg', 'jpeg', 'png'],
        maxSizeBytes: 500 * 1024,
        description: 'Optional: photograph for resume top-right corner.',
        descriptionHi: 'वैकल्पिक: रेज़्यूमे हेतु हाल की पासपोर्ट साइज फोटो।',
      },
    ],
    fields: [
      { key: 'applicant_name', label: 'Full Legal Name', labelHi: 'पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Rahul Sharma', placeholderHi: 'उदा. राहुल शर्मा' },
      { key: 'email', label: 'Email Address', labelHi: 'ईमेल पता', type: 'email', required: true, profileKey: 'email', placeholder: 'rahul.sharma@example.com', placeholderHi: 'rahul.sharma@example.com' },
      { key: 'contact', label: 'Phone Number', labelHi: 'मोबाइल नंबर', type: 'tel', required: true, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
      { key: 'city', label: 'City & State', labelHi: 'शहर व राज्य', type: 'text', required: true, profileKey: 'city', placeholder: 'e.g. Bhopal, Madhya Pradesh', placeholderHi: 'उदा. भोपाल, मध्य प्रदेश' },
      { key: 'linkedin', label: 'LinkedIn Profile URL', labelHi: 'लिंक्डइन प्रोफाइल लिंक', type: 'text', required: false, placeholder: 'linkedin.com/in/rahulsharma', placeholderHi: 'linkedin.com/in/rahulsharma' },
      { key: 'github', label: 'GitHub / Portfolio URL', labelHi: 'गिटहब / पोर्टफोलियो लिंक', type: 'text', required: false, placeholder: 'github.com/rahulsharma', placeholderHi: 'github.com/rahulsharma' },
      { key: 'summary', label: 'Professional Summary / Objective', labelHi: 'व्यावसायिक सारांश / करियर उद्देश्य', type: 'textarea', required: true, placeholder: 'Results-driven software developer with expertise in web technologies...', placeholderHi: 'सॉफ्टवेयर विकास व आधुनिक तकनीकों में दक्ष...' },
      { key: 'education', label: 'Education Details (Degree, College, Year, GPA)', labelHi: 'शैक्षणिक योग्यता (डिग्री, कॉलेज, वर्ष, अंक)', type: 'textarea', required: true, placeholder: 'e.g. B.Tech Computer Science, ABC Institute of Tech (2022-2026) - CGPA: 8.8/10', placeholderHi: 'उदा. बी.टेक कंप्यूटर साइंस (2022-2026), 8.8 सीजीपीए' },
      { key: 'skills', label: 'Key Skills (Grouped or Comma-separated)', labelHi: 'मुख्य कौशल (कॉमा से अलग करें)', type: 'textarea', required: true, placeholder: 'e.g. TypeScript, React, Next.js, Python, PostgreSQL, Docker, Git', placeholderHi: 'उदा. जावास्क्रिप्ट, पायथन, रिएक्ट, एसक्यूएल' },
      { key: 'projects', label: 'Key Projects & Highlights', labelHi: 'प्रमुख परियोजनाएं (Projects)', type: 'textarea', required: true, placeholder: '• Citizen Portal Automation: Built full-stack form automation web app...\n• OCR Document Verifier: Designed OCR pipeline in Python...', placeholderHi: '• प्रोजेक्ट 1 का विवरण...\n• प्रोजेक्ट 2 का विवरण...' },
      { key: 'experience', label: 'Work Experience / Internships (if any)', labelHi: 'कार्य अनुभव / इंटर्नशिप (यदि कोई हो)', type: 'textarea', required: false, placeholder: 'e.g. Software Intern at TechCorp (June 2025 - August 2025)...', placeholderHi: 'उदा. इंटर्नशिप का विवरण...' },
      { key: 'certifications', label: 'Certifications & Achievements', labelHi: 'प्रमाणपत्र एवं उपलब्धियां', type: 'textarea', required: false, placeholder: 'e.g. AWS Certified Cloud Practitioner, 1st Place at State Hackathon', placeholderHi: 'उदा. राज्य स्तरीय हैकाथॉन विजेता' },
      { key: 'languages', label: 'Languages Known', labelHi: 'ज्ञात भाषाएं', type: 'text', required: false, placeholder: 'e.g. English (Fluent), Hindi (Native)', placeholderHi: 'उदा. हिंदी, अंग्रेजी' },
    ],
    systemPromptEn: 'Draft an ATS-friendly, clean single-column Indian professional resume. Group skills neatly, format project bullet points effectively, and maintain strict factual integrity.',
    systemPromptHi: 'एटीएस-अनुरूप स्वच्छ एकल स्तंभ पेशेवर बायोडाटा तैयार करें। कौशलों व परियोजनाओं को बिंदुवार सुव्यवस्थित रूप में प्रस्तुत करें।',
  },

  // 11. General Administrative Application
  {
    id: 'general_application',
    name: 'General Official Application Letter',
    nameHi: 'सामान्य आधिकारिक आवेदन पत्र',
    category: 'general',
    kind: 'other',
    description: 'All-purpose formal application for government offices, municipal bodies, universities, or public utilities.',
    descriptionHi: 'शासकीय कार्यालयों, नगर परिषदों, विश्वविद्यालयों अथवा संस्थानों हेतु सर्व-उद्देश्यीय औपचारिक आवेदन पत्र।',
    minLengthChars: 450,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature'],
    requiredDocuments: [
      { id: 'doc_gen_id', name: 'Identity Proof (Aadhaar / Voter ID)', nameHi: 'पहचान पत्र', type: 'aadhaar', required: false, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Applicant Name', labelHi: 'आवेदक का नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'Your full legal name', placeholderHi: 'आपका पूरा नाम' },
      { key: 'applicant_address', label: 'Address & Contact', labelHi: 'पता व संपर्क', type: 'textarea', required: true, profileKey: 'address', placeholder: 'Address and phone number', placeholderHi: 'निवास का पता और मोबाइल नंबर' },
      { key: 'recipient_title', label: 'Recipient Authority Title', labelHi: 'प्राप्तकर्ता का पद', type: 'text', required: true, placeholder: 'e.g. The Officer-in-Charge / The Director', placeholderHi: 'उदा. सक्षम अधिकारी / निदेशक महोदय' },
      { key: 'office_name', label: 'Office / Department Name', labelHi: 'कार्यालय / विभाग का नाम', type: 'text', required: false, placeholder: 'e.g. Administrative Office (or leave blank if general)', placeholderHi: 'उदा. प्रशासनिक कार्यालय' },
      { key: 'subject_line', label: 'Subject Line', labelHi: 'पत्र का विषय', type: 'text', required: true, placeholder: 'e.g. Application regarding issuance of official record', placeholderHi: 'उदा. आवश्यक अभिलेख जारी करने के संबंध में' },
      { key: 'application_body', label: 'Main Request Statement', labelHi: 'आवेदन का मुख्य विवरण', type: 'textarea', required: true, placeholder: 'Detail your background, the official requirement, and formal request...', placeholderHi: 'आवश्यकता, पृष्ठभूमि और औपचारिक निवेदन का संपूर्ण विवरण...' },
    ],
    systemPromptEn: 'Draft an authentic, respectful Indian administrative application letter adhering to standard government petition formats.',
    systemPromptHi: 'मानक प्रशासनिक प्रारूप के अनुसार सम्मानजनक, स्पष्ट और प्रभावी हिंदी आधिकारिक आवेदन पत्र तैयार करें।',
  },

  // 12. Bonafide Student Certificate Request (Education & Institutions)
  {
    id: 'bonafide_certificate_request',
    name: 'Bonafide Student Certificate Request Letter',
    nameHi: 'अध्ययनरत / बोनाफाइड प्रमाण पत्र आवेदन पत्र',
    category: 'education',
    kind: 'certificate_request',
    description: 'Formal application to college principal or university registrar requesting an official Bonafide / Study Certificate for passport, visa, or scholarships.',
    descriptionHi: 'पासपोर्ट, वीजा अथवा छात्रवृत्ति हेतु कॉलेज प्राचार्य से आधिकारिक अध्ययनरत (बोनाफाइड) प्रमाण पत्र जारी करने का औपचारिक आवेदन।',
    minLengthChars: 400,
    requiredSections: ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature'],
    requiredDocuments: [
      { id: 'doc_bona_id', name: 'Student College ID Card', nameHi: 'कॉलेज पहचान पत्र', type: 'college_id', required: false, allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Student Full Name', labelHi: 'छात्र का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Rahul Sharma', placeholderHi: 'उदा. राहुल शर्मा' },
      { key: 'roll_no', label: 'Roll No. / Enrollment ID', labelHi: 'अनुक्रमांक / नामांकन संख्या', type: 'text', required: true, placeholder: 'e.g. 21BCE1042', placeholderHi: 'उदा. 21BCE1042' },
      { key: 'college_name', label: 'College / Institute Name', labelHi: 'कॉलेज / संस्था का नाम', type: 'text', required: true, placeholder: 'e.g. Govt. Engineering College, Bhopal', placeholderHi: 'उदा. शासकीय इंजीनियरिंग कॉलेज' },
      { key: 'course_name', label: 'Course / Degree & Branch', labelHi: 'पाठ्यक्रम एवं शाखा', type: 'text', required: true, placeholder: 'e.g. B.Tech Computer Science', placeholderHi: 'उदा. बी.टेक कंप्यूटर साइंस' },
      { key: 'semester', label: 'Current Semester / Year', labelHi: 'वर्तमान सेमेस्टर / वर्ष', type: 'text', required: true, placeholder: 'e.g. 5th Semester / 3rd Year', placeholderHi: 'उदा. 5वां सेमेस्टर / तृतीय वर्ष' },
      { key: 'purpose', label: 'Purpose of Certificate', labelHi: 'प्रमाण पत्र का उद्देश्य', type: 'text', required: true, placeholder: 'e.g. Passport Application / Bank Education Loan / Scholarship', placeholderHi: 'उदा. पासपोर्ट आवेदन / बैंक शिक्षा ऋण / छात्रवृत्ति' },
      { key: 'recipient_title', label: 'Addressed To', labelHi: 'प्राप्तकर्ता का पद', type: 'text', required: true, placeholder: 'e.g. The Principal / The Registrar', placeholderHi: 'उदा. श्रीमान प्राचार्य महोदय' },
    ],
    systemPromptEn: 'Draft an authentic, formal Bonafide Student Certificate Request Letter with student enrollment details and specific purpose.',
    systemPromptHi: 'कॉलेज प्राचार्य को संबोधित औपचारिक बोनाफाइड प्रमाण पत्र आवेदन पत्र तैयार करें।',
  },

  // 13. Disability Certificate & UDID Application (Healthcare)
  {
    id: 'disability_certificate_application',
    name: 'Disability Certificate & UDID Card Application Form',
    nameHi: 'दिव्यांगता प्रमाण पत्र एवं UDID कार्ड आवेदन फॉर्म',
    category: 'healthcare',
    kind: 'application_form',
    description: 'Structured formal application form for assessment and issuance of Disability Certificate and Unique Disability Identity Card (UDID).',
    descriptionHi: 'दिव्यांगता प्रमाण पत्र और स्वावलंबन (UDID) कार्ड प्राप्त करने हेतु संरचित औपचारिक आवेदन फॉर्म।',
    minLengthChars: 400,
    requiredSections: ['subject', 'body', 'signature'],
    requiredDocuments: [
      { id: 'doc_disab_photo', name: 'Passport Size Photograph', nameHi: 'पासपोर्ट साइज फोटो', type: 'photo', required: false, allowedFormats: ['jpg', 'jpeg', 'png'], maxSizeBytes: 500 * 1024 },
      { id: 'doc_disab_id', name: 'Aadhaar / Identity Proof', nameHi: 'आधार कार्ड', type: 'aadhaar', required: false, allowedFormats: ['pdf', 'jpg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Applicant Full Name', labelHi: 'आवेदक का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Manoj Kumar', placeholderHi: 'उदा. मनोज कुमार' },
      { key: 'father_name', label: "Father's / Guardian's Name", labelHi: 'पिता या अभिभावक का नाम', type: 'text', required: true, placeholder: 'e.g. Ramesh Kumar', placeholderHi: 'उदा. रमेश कुमार' },
      { key: 'dob', label: 'Date of Birth', labelHi: 'जन्म तिथि', type: 'date', required: true, profileKey: 'date_of_birth', placeholder: 'YYYY-MM-DD', placeholderHi: 'YYYY-MM-DD' },
      { key: 'gender', label: 'Gender', labelHi: 'लिंग', type: 'select', required: true, options: ['Male', 'Female', 'Other'], placeholder: 'Select Gender', placeholderHi: 'लिंग चुनें' },
      { key: 'address', label: 'Permanent Residential Address', labelHi: 'स्थायी निवास का पता', type: 'textarea', required: true, profileKey: 'address', placeholder: 'Full residential address with district and pincode', placeholderHi: 'पूरा पता, जिला एवं पिनकोड' },
      { key: 'disability_type', label: 'Type of Disability', labelHi: 'दिव्यांगता का प्रकार', type: 'select', required: true, options: ['Locomotor Disability', 'Visual Impairment', 'Hearing Impairment', 'Mental Illness / Intellectual', 'Multiple Disabilities'], placeholder: 'Select Disability Type', placeholderHi: 'दिव्यांगता का प्रकार चुनें' },
      { key: 'hospital_name', label: 'District Hospital / CMO Authority', labelHi: 'जिला अस्पताल / मुख्य चिकित्सा अधिकारी कार्यालय', type: 'text', required: true, placeholder: 'e.g. District Civil Hospital, Bhopal', placeholderHi: 'उदा. जिला सिविल अस्पताल, भोपाल' },
      { key: 'contact', label: 'Contact Phone Number', labelHi: 'संपर्क मोबाइल नंबर', type: 'tel', required: true, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
    ],
    systemPromptEn: 'Draft an authentic Indian Disability Certificate Application Form with 2-column particulars table, medical assessment request cover note, and legal declaration.',
    systemPromptHi: 'मुख्य चिकित्सा अधिकारी (CMO) को प्रस्तुत करने हेतु सुव्यवस्थित दिव्यांगता प्रमाण पत्र आवेदन फॉर्म तैयार करें।',
  },

  // 14. Mudra / Education Loan Application Form (Banking)
  {
    id: 'loan_application_request',
    name: 'Mudra / Education Loan Application Form',
    nameHi: 'मुद्रा / शिक्षा ऋण औपचारिक आवेदन फॉर्म',
    category: 'banking',
    kind: 'application_form',
    description: 'Structured formal application form for Pradhan Mantri Mudra Yojana (PMMY) or higher education student loan with banking particulars.',
    descriptionHi: 'प्रधानमंत्री मुद्रा योजना अथवा उच्च शिक्षा ऋण प्राप्त करने हेतु संरचित आधिकारिक बैंक आवेदन फॉर्म।',
    minLengthChars: 400,
    requiredSections: ['subject', 'body', 'signature'],
    requiredDocuments: [
      { id: 'doc_loan_pan', name: 'PAN Card Copy', nameHi: 'पैन कार्ड', type: 'pan', required: false, allowedFormats: ['pdf', 'jpg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
      { id: 'doc_loan_aadhaar', name: 'Aadhaar Card Copy', nameHi: 'आधार कार्ड', type: 'aadhaar', required: false, allowedFormats: ['pdf', 'jpg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Applicant Full Name', labelHi: 'आवेदक का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Vikas Sharma', placeholderHi: 'उदा. विकास शर्मा' },
      { key: 'father_name', label: "Father's Name", labelHi: 'पिता का नाम', type: 'text', required: true, placeholder: 'e.g. Satish Sharma', placeholderHi: 'उदा. सतीश शर्मा' },
      { key: 'dob', label: 'Date of Birth', labelHi: 'जन्म तिथि', type: 'date', required: true, profileKey: 'date_of_birth', placeholder: 'YYYY-MM-DD', placeholderHi: 'YYYY-MM-DD' },
      { key: 'address', label: 'Residential Address', labelHi: 'निवास का पता', type: 'textarea', required: true, profileKey: 'address', placeholder: 'Complete residential address', placeholderHi: 'पूरा पता एवं पिनकोड' },
      { key: 'loan_scheme', label: 'Loan Scheme Type', labelHi: 'ऋण योजना का प्रकार', type: 'select', required: true, options: ['PM Mudra Yojana (Shishu - Up to ₹50,000)', 'PM Mudra Yojana (Kishore - Up to ₹5 Lakh)', 'PM Mudra Yojana (Tarun - Up to ₹10 Lakh)', 'Higher Education Loan (Vidya Lakshmi)'], placeholder: 'Select Loan Scheme', placeholderHi: 'योजना चुनें' },
      { key: 'loan_amount', label: 'Loan Amount Required (INR)', labelHi: 'आवश्यक ऋण राशि (रुपये)', type: 'number', required: true, placeholder: 'e.g. 250000', placeholderHi: 'उदा. 250000' },
      { key: 'business_or_course', label: 'Business Enterprise / Academic Course Purpose', labelHi: 'उद्यम अथवा अध्ययन पाठ्यक्रम का विवरण', type: 'text', required: true, placeholder: 'e.g. Retail Grocery Store Expansion / B.Tech Course Fees', placeholderHi: 'उदा. किराना स्टोर विस्तार / इंजीनियरिंग फीस' },
      { key: 'bank_branch', label: 'Target Bank & Branch Name', labelHi: 'लक्षित बैंक एवं शाखा का नाम', type: 'text', required: true, placeholder: 'e.g. State Bank of India, Main Market Branch', placeholderHi: 'उदा. स्टेट बैंक ऑफ इंडिया, मुख्य शाखा' },
      { key: 'contact', label: 'Mobile Number', labelHi: 'मोबाइल नंबर', type: 'tel', required: true, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
    ],
    systemPromptEn: 'Draft an authentic, structured Indian Banking Loan Application Form with 2-column particulars, loan statement of purpose, and standard borrower declaration.',
    systemPromptHi: 'बैंक शाखा प्रबंधक को प्रस्तुत करने हेतु मुद्रा/शिक्षा ऋण आवेदन फॉर्म तैयार करें।',
  },

  // 15. Municipal Trade License Application Form (Business)
  {
    id: 'trade_license_application',
    name: 'Municipal Trade License Application Form',
    nameHi: 'नगर निगम व्यापार / ट्रेड लाइसेंस आवेदन फॉर्म',
    category: 'business',
    kind: 'application_form',
    description: 'Structured formal application form to Municipal Corporation or Nagar Palika for grant of commercial Trade License under Municipal Acts.',
    descriptionHi: 'नगर निगम या नगर पालिका से व्यावसायिक ट्रेड लाइसेंस प्राप्त करने हेतु संरचित आधिकारिक आवेदन फॉर्म।',
    minLengthChars: 400,
    requiredSections: ['subject', 'body', 'signature'],
    requiredDocuments: [
      { id: 'doc_trade_prop', name: 'Property Tax Receipt / Rent Agreement', nameHi: 'संपत्ति कर रसीद / किरायानामा', type: 'other', required: false, allowedFormats: ['pdf', 'jpg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
      { id: 'doc_trade_id', name: 'Proprietor Aadhaar / PAN', nameHi: 'प्रोपराइटर आधार / पैन', type: 'aadhaar', required: false, allowedFormats: ['pdf', 'jpg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Proprietor / Applicant Full Name', labelHi: 'प्रोपराइटर / आवेदक का नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Deepak Agrawal', placeholderHi: 'उदा. दीपक अग्रवाल' },
      { key: 'business_name', label: 'Trade / Firm Commercial Name', labelHi: 'फर्म / व्यापारिक प्रतिष्ठान का नाम', type: 'text', required: true, placeholder: 'e.g. Agrawal General & Stationery Mart', placeholderHi: 'उदा. अग्रवाल जनरल स्टोर्स' },
      { key: 'trade_nature', label: 'Nature of Trade / Commercial Activity', labelHi: 'व्यापार की प्रकृति (Category)', type: 'text', required: true, placeholder: 'e.g. Retail Grocery, Stationery, and Confectionery', placeholderHi: 'उदा. खुदरा किराना एवं स्टेशनरी व्यापार' },
      { key: 'business_address', label: 'Commercial Premise Address', labelHi: 'व्यापारिक स्थल का पूरा पता', type: 'textarea', required: true, placeholder: 'Shop No, Market Road, Ward No, City, Pincode', placeholderHi: 'दुकान नंबर, बाजार, वार्ड, शहर, पिनकोड' },
      { key: 'premise_type', label: 'Premise Ownership Status', labelHi: 'स्थल स्वामित्व स्थिति', type: 'select', required: true, options: ['Owned Commercial Property', 'Rented / Leased Commercial Unit'], placeholder: 'Select Ownership Status', placeholderHi: 'स्वामित्व चुनें' },
      { key: 'annual_turnover', label: 'Estimated Annual Turnover (INR)', labelHi: 'अनुमानित वार्षिक टर्नओवर', type: 'text', required: false, placeholder: 'e.g. ₹15,00,000', placeholderHi: 'उदा. ₹15,00,000' },
      { key: 'contact', label: 'Contact Phone Number', labelHi: 'संपर्क फोन नंबर', type: 'tel', required: true, profileKey: 'phone', placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
    ],
    systemPromptEn: 'Draft an authentic, structured Indian Municipal Trade License Application Form with 2-column particulars, commercial undertaking, and sanitary compliance declaration.',
    systemPromptHi: 'नगर निगम आयुक्त को प्रस्तुत करने हेतु मानक ट्रेड लाइसेंस आवेदन फॉर्म तैयार करें।',
  },

  // 16. College Hostel Admission Application Form (Institutions)
  {
    id: 'hostel_admission_application',
    name: 'College Hostel Admission Application Form',
    nameHi: 'कॉलेज छात्रावास (हॉस्टल) प्रवेश आवेदन फॉर्म',
    category: 'institutions',
    kind: 'application_form',
    description: 'Structured formal application form for college hostel room accommodation, mess enrollment, and guardian undertaking.',
    descriptionHi: 'कॉलेज छात्रावास में कमरा आवंटन एवं मेस सुविधा हेतु संरचित आधिकारिक प्रवेश आवेदन फॉर्म।',
    minLengthChars: 400,
    requiredSections: ['subject', 'body', 'signature'],
    requiredDocuments: [
      { id: 'doc_hostel_photo', name: 'Passport Size Photograph', nameHi: 'पासपोर्ट साइज फोटो', type: 'photo', required: false, allowedFormats: ['jpg', 'jpeg', 'png'], maxSizeBytes: 500 * 1024 },
      { id: 'doc_hostel_rec', name: 'College Admission Fee Receipt', nameHi: 'कॉलेज प्रवेश रसीद', type: 'fee_receipt', required: false, allowedFormats: ['pdf', 'jpg', 'png'], maxSizeBytes: 2 * 1024 * 1024 },
    ],
    fields: [
      { key: 'applicant_name', label: 'Student Full Name', labelHi: 'छात्र का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Priya Sharma', placeholderHi: 'उदा. प्रिया शर्मा' },
      { key: 'father_name', label: "Father's / Mother's Name", labelHi: 'माता/पिता का नाम', type: 'text', required: true, placeholder: 'e.g. Omprakash Sharma', placeholderHi: 'उदा. ओमप्रकाश शर्मा' },
      { key: 'dob', label: 'Date of Birth', labelHi: 'जन्म तिथि', type: 'date', required: true, profileKey: 'date_of_birth', placeholder: 'YYYY-MM-DD', placeholderHi: 'YYYY-MM-DD' },
      { key: 'course', label: 'Enrolled Degree / Course', labelHi: 'प्रवेशित पाठ्यक्रम / डिग्री', type: 'text', required: true, placeholder: 'e.g. B.Sc Electronics / MBA', placeholderHi: 'उदा. बी.एस.सी / एम.बी.ए' },
      { key: 'semester', label: 'Semester / Academic Year', labelHi: 'सेमेस्टर / शैक्षणिक सत्र', type: 'text', required: true, placeholder: 'e.g. 1st Semester (2026-27)', placeholderHi: 'उदा. प्रथम सेमेस्टर (2026-27)' },
      { key: 'permanent_address', label: 'Permanent Home Address', labelHi: 'स्थायी गृह पता', type: 'textarea', required: true, profileKey: 'address', placeholder: 'H.No, Street, Village/Town, District, State, Pincode', placeholderHi: 'मकान नंबर, सड़क, गांव/शहर, जिला, राज्य, पिनकोड' },
      { key: 'distance_km', label: 'Distance from College Campus (in KM)', labelHi: 'कॉलेज परिसर से दूरी (कि.मी. में)', type: 'number', required: true, placeholder: 'e.g. 180', placeholderHi: 'उदा. 180' },
      { key: 'emergency_phone', label: 'Parent / Guardian Mobile Phone', labelHi: 'अभिभावक का आपातकालीन मोबाइल नंबर', type: 'tel', required: true, placeholder: '+91 98765 43210', placeholderHi: '+91 98765 43210' },
    ],
    systemPromptEn: 'Draft an authentic, structured Indian College Hostel Admission Application Form with 2-column particulars, accommodation request cover note, and discipline undertaking.',
    systemPromptHi: 'चीफ वार्डन को प्रस्तुत करने हेतु सुव्यवस्थित छात्रावास प्रवेश आवेदन फॉर्म तैयार करें।',
  },
];

// Helper: Match template by free-text prompt or ID
export function matchTemplateFromPrompt(prompt: string): FormTemplate {
  const p = (prompt || '').trim().toLowerCase();

  // Internship check (Requirement 1)
  if (
    p.includes('intern') ||
    p.includes('internship') ||
    p.includes('इंटर्नशिप') ||
    p.includes('trainee') ||
    p.includes('प्रशिक्षु')
  ) {
    return FORM_TEMPLATES.find(t => t.id === 'student_internship')!;
  }

  // Resume check
  if (
    p === 'resume' ||
    p === 'cv' ||
    p.includes('resume') ||
    p.includes('curriculum vitae') ||
    p.includes('biodata') ||
    p.includes('बायोडाटा') ||
    p.includes('रेज़्यूमे')
  ) {
    return FORM_TEMPLATES.find(t => t.id === 'resume')!;
  }

  if (p === 'leave' || p.includes('leave') || p.includes('sick') || p.includes('casual') || p.includes('छुट्टी') || p.includes('अवकाश')) {
    return FORM_TEMPLATES.find(t => t.id === 'leave_application')!;
  }
  if (p === 'resignation' || p.includes('resignation') || p.includes('त्यागपत्र') || p.includes('इस्तीफा') || p.includes('resign')) {
    return FORM_TEMPLATES.find(t => t.id === 'resignation')!;
  }
  if (p.includes('scholarship') || p.includes('stipend') || p.includes('छात्रवृत्ति') || p.includes('शिष्यवृत्ति')) {
    return FORM_TEMPLATES.find(t => t.id === 'scholarship_application')!;
  }
  if (p.includes('complaint') || p.includes('grievance') || p.includes('शिकायत') || p.includes('समस्या')) {
    return FORM_TEMPLATES.find(t => t.id === 'complaint_letter')!;
  }
  if (/\brti\b/i.test(p) || p.includes('right to information') || p.includes('सूचना का अधिकार') || p.includes('आरतीआई')) {
    return FORM_TEMPLATES.find(t => t.id === 'rti_application')!;
  }
  if (p.includes('bonafide') || p.includes('बोनाफाइड') || p.includes('study certificate')) {
    return FORM_TEMPLATES.find(t => t.id === 'bonafide_certificate_request')!;
  }
  if (p.includes('disability') || p.includes('udid') || p.includes('दिव्यांग') || p.includes('विकलांग')) {
    return FORM_TEMPLATES.find(t => t.id === 'disability_certificate_application')!;
  }
  if (p.includes('loan') || p.includes('mudra') || p.includes('मुद्रा') || p.includes('ऋण') || p.includes('vidya lakshmi')) {
    return FORM_TEMPLATES.find(t => t.id === 'loan_application_request')!;
  }
  if (p.includes('trade license') || p.includes('ट्रेड लाइसेंस') || p.includes('shop act') || p.includes('gumasta') || p.includes('गुमाश्ता')) {
    return FORM_TEMPLATES.find(t => t.id === 'trade_license_application')!;
  }
  if (p.includes('hostel') || p.includes('छात्रावास') || p.includes('warden')) {
    return FORM_TEMPLATES.find(t => t.id === 'hostel_admission_application')!;
  }
  if (p.includes('certificate') || p.includes('income') || p.includes('caste') || p.includes('domicile') || p.includes('जाति') || p.includes('आय') || p.includes('निवास')) {
    return FORM_TEMPLATES.find(t => t.id === 'certificate_application')!;
  }

  // Exact ID check
  const byId = FORM_TEMPLATES.find(t => t.id === prompt);
  if (byId) return byId;

  // Default to general application
  return FORM_TEMPLATES.find(t => t.id === 'general_application')!;
}

// Dynamically create tailored template schema from user requirement
export function createCustomTemplateFromPrompt(prompt: string, language: 'en' | 'hi' = 'en'): FormTemplate {
  const trimmed = (prompt || '').trim();
  const isHi = language === 'hi';
  const titleFormatted = trimmed
    ? trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : (isHi ? 'विशिष्ट आधिकारिक आवेदन प्रारूप' : 'Custom Official Document');

  const lower = trimmed.toLowerCase();
  let category = 'general';
  if (lower.includes('rent') || lower.includes('lease') || lower.includes('contract') || lower.includes('business') || lower.includes('agreement') || lower.includes('किराया')) category = 'business';
  else if (lower.includes('police') || lower.includes('passport') || lower.includes('licence') || lower.includes('license') || lower.includes('pan') || lower.includes('aadhaar') || lower.includes('certificate') || lower.includes('government') || lower.includes('sarkari')) category = 'government';
  else if (lower.includes('school') || lower.includes('college') || lower.includes('scholarship') || lower.includes('exam') || lower.includes('student') || lower.includes('admission') || lower.includes('intern')) category = 'education';
  else if (lower.includes('medical') || lower.includes('health') || lower.includes('hospital') || lower.includes('doctor') || lower.includes('claim')) category = 'healthcare';
  else if (lower.includes('bank') || lower.includes('loan') || lower.includes('cheque') || lower.includes('card') || lower.includes('account')) category = 'banking';

  // Determine kind deterministically
  let kind: TemplateKind = 'letter';
  if (lower.includes('resume') || lower.includes('cv') || lower.includes('curriculum vitae') || lower.includes('बायोडाटा')) {
    kind = 'resume';
  } else if (lower.includes('form') || lower.includes('internship') || lower.includes('admission') || lower.includes('आवेदन पत्र') || lower.includes('प्रारूप')) {
    kind = 'application_form';
  } else if (lower.includes('certificate') || lower.includes('bonafide') || lower.includes('noc') || lower.includes('प्रमाण पत्र')) {
    kind = 'certificate_request';
  } else if (lower.includes('affidavit') || lower.includes('declaration') || lower.includes('घोषणा') || lower.includes('शपथपत्र')) {
    kind = 'declaration';
  }

  // Data Minimization (Requirement 5): Never require sensitive ID documents by default
  const proposedDocuments: TemplateDocument[] = [];
  if (kind === 'application_form' || kind === 'resume') {
    proposedDocuments.push({
      id: 'doc_custom_photo',
      name: 'Passport Size Photograph (Optional)',
      nameHi: 'पासपोर्ट साइज फोटो (वैकल्पिक)',
      type: 'photo',
      required: false,
      allowedFormats: ['jpg', 'jpeg', 'png'],
      maxSizeBytes: 500 * 1024,
      description: 'Optional recent photograph to embed in the document.',
      descriptionHi: 'दस्तावेज़ में संलग्न करने हेतु हाल की फोटो (वैकल्पिक)।',
    });
  } else if (kind === 'certificate_request' || category === 'government') {
    proposedDocuments.push({
      id: 'doc_custom_proof',
      name: 'Supporting Relevant Document / Proof',
      nameHi: 'संबंधित प्रमाण दस्तावेज़',
      type: 'other',
      required: false,
      allowedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      maxSizeBytes: 2 * 1024 * 1024,
      description: 'Relevant institutional or identity proof.',
      descriptionHi: 'प्रासंगिक दस्तावेज़ की प्रति (वैकल्पिक)।',
    });
  }

  return {
    id: `custom_${Date.now()}`,
    name: titleFormatted,
    nameHi: titleFormatted,
    category,
    kind,
    isUnverified: true, // Marked as AI-proposed unverified template
    description: `Custom-tailored official document and formal layout for ${trimmed} (Unverified AI Template).`,
    descriptionHi: `${trimmed} हेतु विशिष्ट आधिकारिक दस्तावेज़ एवं प्रारूप (अपरीक्षित एआई प्रारूप)।`,
    minLengthChars: 220,
    requiredSections: kind === 'application_form' || kind === 'resume'
      ? ['body', 'signature']
      : ['header', 'date', 'subject', 'salutation', 'body', 'closing', 'signature'],
    requiredDocuments: proposedDocuments,
    fields: [
      { key: 'applicant_name', label: 'Applicant / Principal Party Full Name', labelHi: 'आवेदक / मुख्य पक्ष का पूरा नाम', type: 'text', required: true, profileKey: 'full_name', placeholder: 'e.g. Rahul Sharma', placeholderHi: 'उदा. राहुल शर्मा' },
      { key: 'applicant_address', label: 'Address & Contact Information', labelHi: 'निवास का पता एवं संपर्क नंबर', type: 'textarea', required: true, profileKey: 'address', placeholder: 'Complete address with city and pincode', placeholderHi: 'शहर और पिनकोड सहित पूरा पता' },
      { key: 'recipient_title', label: 'Whom is this addressed to? (e.g. HR Manager / Principal)', labelHi: 'प्राप्तकर्ता का पद (उदा. मानव संसाधन प्रबंधक / प्रधानाचार्य)', type: 'text', required: false, placeholder: 'e.g. The HR Manager / Officer-in-Charge (Leave blank if unknown)', placeholderHi: 'उदा. सक्षम अधिकारी महोदय' },
      { key: 'specific_purpose', label: 'Primary Subject & Specific Requirement', labelHi: 'मुख्य विषय एवं विशिष्ट आवश्यकता', type: 'textarea', required: true, placeholder: `Detailed facts, requirements or terms regarding ${trimmed}...`, placeholderHi: `${trimmed} के संबंध में विस्तृत तथ्य व शर्तें...` },
      { key: 'reference_number', label: 'Reference / Application / Meter / ID Number (Optional)', labelHi: 'संदर्भ / आवेदन / मीटर / पहचान संख्या (वैकल्पिक)', type: 'text', required: false, placeholder: 'e.g. REF-2026-90412 or Consumer No.', placeholderHi: 'उदा. संदर्भ संख्या या उपभोक्ता क्रमांक' },
    ],
    systemPromptEn: `Draft a formal, comprehensive Indian legal, administrative, or commercial document specifically tailored for: "${trimmed}". Address the specific facts, statutory or customary rules, and explicit requirements.`,
    systemPromptHi: `"${trimmed}" के संबंध में एक प्रामाणिक, सम्मानजनक और संपूर्ण भारतीय आधिकारिक प्रारूप तैयार करें।`,
  };
}

export function getTemplateById(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find(t => t.id === id);
}

export function getAllTemplates(): FormTemplate[] {
  return FORM_TEMPLATES;
}

/**
 * Derives a clean, professional form/document title, ensuring conversational
 * speech fillers ("ek ... likh de", "mere liye resume banao", "kholo") are
 * never used as raw form titles.
 */
export function deriveCleanFormTitle(
  templateOrPrompt: FormTemplate | string | undefined | null,
  applicantName?: string | null,
  language: 'en' | 'hi' = 'en'
): string {
  const isHi = language === 'hi';
  const cleanName = (applicantName || '').trim();

  // If a FormTemplate object was passed:
  if (templateOrPrompt && typeof templateOrPrompt === 'object' && 'id' in templateOrPrompt) {
    const tmpl = templateOrPrompt as FormTemplate;
    if (tmpl.id === 'resume' || tmpl.kind === 'resume') {
      if (cleanName) return isHi ? `बायोडाटा - ${cleanName}` : `Resume - ${cleanName}`;
      return isHi ? 'व्यावसायिक बायोडाटा (Resume)' : 'Professional Resume';
    }
    if (tmpl.id === 'leave_application') {
      if (cleanName) return isHi ? `अवकाश प्रार्थना पत्र - ${cleanName}` : `Leave Application - ${cleanName}`;
      return isHi ? 'औपचारिक अवकाश प्रार्थना पत्र' : 'Formal Leave Application';
    }
    if (tmpl.id === 'student_internship') {
      if (cleanName) return isHi ? `इंटर्नशिप आवेदन - ${cleanName}` : `Internship Application - ${cleanName}`;
      return isHi ? 'छात्र इंटर्नशिप आवेदन फॉर्म' : 'Student Internship Application';
    }
    if (tmpl.id === 'scholarship_application') {
      if (cleanName) return isHi ? `छात्रवृत्ति आवेदन - ${cleanName}` : `Scholarship Application - ${cleanName}`;
      return isHi ? 'छात्रवृत्ति आवेदन पत्र' : 'Scholarship Application';
    }
    if (tmpl.id === 'complaint_letter') {
      if (cleanName) return isHi ? `शिकायत पत्र - ${cleanName}` : `Complaint Letter - ${cleanName}`;
      return isHi ? 'औपचारिक शिकायत पत्र' : 'Formal Complaint Letter';
    }
    if (tmpl.id === 'resignation') {
      if (cleanName) return isHi ? `त्यागपत्र - ${cleanName}` : `Resignation Letter - ${cleanName}`;
      return isHi ? 'त्यागपत्र' : 'Formal Resignation Letter';
    }
    if (tmpl.id === 'rti_application') {
      return isHi ? 'सूचना का अधिकार (RTI) आवेदन पत्र' : 'RTI Application';
    }
    if (tmpl.id === 'certificate_application') {
      return isHi ? 'प्रमाण पत्र आवेदन पत्र' : 'Certificate Application';
    }
    if (tmpl.id === 'bank_kyc_letter') {
      return isHi ? 'बैंक केवाईसी अद्यतन पत्र' : 'Bank KYC Update Application';
    }
    if (tmpl.id === 'job_application') {
      if (cleanName) return isHi ? `नौकरी आवेदन पत्र - ${cleanName}` : `Job Application - ${cleanName}`;
      return isHi ? 'नौकरी आवेदन एवं कवर लेटर' : 'Job Application Letter';
    }

    const baseName = isHi ? tmpl.nameHi : tmpl.name;
    return cleanName ? `${baseName} - ${cleanName}` : baseName;
  }

  // String prompt / title
  let raw = (typeof templateOrPrompt === 'string' ? templateOrPrompt : '').trim();
  if (!raw) {
    return cleanName
      ? (isHi ? `आवेदन पत्र - ${cleanName}` : `Application - ${cleanName}`)
      : (isHi ? 'आधिकारिक आवेदन पत्र' : 'Official Application');
  }

  // Check specific non-template document types first (bonafide, noc, etc.)
  const lower = raw.toLowerCase();
  if (lower.includes('bonafide') || lower.includes('बोनाफाइड')) {
    return cleanName ? (isHi ? `बोनाफाइड प्रमाण पत्र आवेदन - ${cleanName}` : `Bonafide Certificate Request - ${cleanName}`) : (isHi ? 'बोनाफाइड प्रमाण पत्र आवेदन' : 'Bonafide Certificate Request');
  }
  if (lower.includes('noc') || lower.includes('नो ऑब्जेक्शन')) {
    return cleanName ? (isHi ? `अनापत्ति प्रमाण पत्र (NOC) आवेदन - ${cleanName}` : `NOC Request - ${cleanName}`) : (isHi ? 'अनापत्ति प्रमाण पत्र (NOC) आवेदन' : 'No Objection Certificate (NOC) Request');
  }

  // Check if string matches any known template
  const matchedTmpl = matchTemplateFromPrompt(raw);
  if (matchedTmpl && matchedTmpl.id !== 'general_application') {
    return deriveCleanFormTitle(matchedTmpl, cleanName, language);
  }

  // Check keywords for common form types
  if (lower.includes('resume') || lower.includes('cv') || lower.includes('biodata') || lower.includes('बायोडाटा') || lower.includes('रेज़्यूमे')) {
    return cleanName ? (isHi ? `बायोडाटा - ${cleanName}` : `Resume - ${cleanName}`) : (isHi ? 'व्यावसायिक बायोडाटा' : 'Professional Resume');
  }
  if (lower.includes('leave') || lower.includes('chhutti') || lower.includes('छुट्टी') || lower.includes('अवकाश')) {
    return cleanName ? (isHi ? `अवकाश प्रार्थना पत्र - ${cleanName}` : `Leave Application - ${cleanName}`) : (isHi ? 'अवकाश प्रार्थना पत्र' : 'Leave Application');
  }
  if (lower.includes('intern') || lower.includes('इंटर्न')) {
    return cleanName ? (isHi ? `इंटर्नशिप आवेदन - ${cleanName}` : `Internship Application - ${cleanName}`) : (isHi ? 'छात्र इंटर्नशिप आवेदन फॉर्म' : 'Student Internship Application');
  }
  if (lower.includes('scholarship') || lower.includes('छात्रवृत्ति')) {
    return cleanName ? (isHi ? `छात्रवृत्ति आवेदन - ${cleanName}` : `Scholarship Application - ${cleanName}`) : (isHi ? 'छात्रवृत्ति आवेदन' : 'Scholarship Application');
  }
  if (lower.includes('complaint') || lower.includes('grievance') || lower.includes('shikayat') || lower.includes('शिकायत')) {
    return cleanName ? (isHi ? `शिकायत पत्र - ${cleanName}` : `Complaint Letter - ${cleanName}`) : (isHi ? 'औपचारिक शिकायत पत्र' : 'Formal Complaint Letter');
  }
  if (lower.includes('resignation') || lower.includes('istifa') || lower.includes('इस्तीफा') || lower.includes('त्यागपत्र')) {
    return cleanName ? (isHi ? `त्यागपत्र - ${cleanName}` : `Resignation Letter - ${cleanName}`) : (isHi ? 'त्यागपत्र' : 'Resignation Letter');
  }
  if (lower.includes('rti') || lower.includes('सूचना का अधिकार')) {
    return isHi ? 'सूचना का अधिकार (RTI) आवेदन पत्र' : 'RTI Application';
  }
  if (lower.includes('bonafide') || lower.includes('बोनाफाइड')) {
    return cleanName ? (isHi ? `बोनाफाइड प्रमाण पत्र आवेदन - ${cleanName}` : `Bonafide Certificate Request - ${cleanName}`) : (isHi ? 'बोनाफाइड प्रमाण पत्र आवेदन' : 'Bonafide Certificate Request');
  }
  if (lower.includes('noc') || lower.includes('नो ऑब्जेक्शन')) {
    return cleanName ? (isHi ? `अनापत्ति प्रमाण पत्र (NOC) आवेदन - ${cleanName}` : `NOC Request - ${cleanName}`) : (isHi ? 'अनापत्ति प्रमाण पत्र (NOC) आवेदन' : 'No Objection Certificate (NOC) Request');
  }

  // Strip conversational fillers
  let cleaned = raw
    .replace(/^(please\s+|kindly\s+|hey\s+buddy\s+|buddy\s+|can\s+you\s+|i\s+want\s+to\s+|help\s+me\s+)/i, '')
    .replace(/^(ek\s+|mere\s+liye\s+|mujhe\s+|kripya\s+|mera\s+|humara\s+)/i, '')
    .replace(/^(create\s+a\s+|draft\s+a\s+|write\s+a\s+|generate\s+a\s+|make\s+a\s+|build\s+a\s+|open\s+a\s+|open\s+)/i, '')
    .replace(/(\s+likh\s*de|\s+likho|\s+banao|\s+bana\s*do|\s+kholo|\s+chahiye|\s+karna\s*hai|\s+karni\s*hai)$/i, '')
    .replace(/(\s+for\s+me|\s+please)$/i, '')
    .trim();

  // If text is junk like "GGGGG", fallback to clean generic title
  if (/^(.)\1{3,}$/i.test(cleaned) || cleaned.length < 3) {
    return cleanName ? (isHi ? `आवेदन पत्र - ${cleanName}` : `Application Form - ${cleanName}`) : (isHi ? 'आवेदन पत्र' : 'Application Form');
  }

  cleaned = cleaned
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return cleanName ? `${cleaned} - ${cleanName}` : cleaned;
}

// Convert DocumentSections to unified full text
export function formatSectionsToFullText(sections: DocumentSections, language = 'en'): string {
  const parts: string[] = [];

  if (sections.formTitle) parts.push(sections.formTitle.trim());
  if (sections.header) parts.push(sections.header.trim());
  if (sections.date) parts.push(sections.date.trim());
  if (sections.subject) parts.push(sections.subject.trim());
  if (sections.salutation) parts.push(sections.salutation.trim());

  if (sections.fieldsTable && sections.fieldsTable.length > 0) {
    const tableLines = sections.fieldsTable.map(f => `${f.label}: ${f.value}`);
    parts.push(tableLines.join('\n'));
  }

  if (sections.coverNote) parts.push(sections.coverNote.trim());
  else if (sections.body) parts.push(sections.body.trim());

  if (sections.declaration) parts.push(`DECLARATION:\n${sections.declaration.trim()}`);
  if (sections.place) parts.push(sections.place.trim());
  if (sections.closing) parts.push(sections.closing.trim());
  if (sections.signature) parts.push(sections.signature.trim());

  if (sections.enclosures && sections.enclosures.length > 0) {
    const encTitle = language === 'hi' ? 'संलग्नक:' : 'Enclosures:';
    const encList = sections.enclosures.map((e, idx) => `${idx + 1}. ${sanitizeEnclosureTitle(e)}`).join('\n');
    parts.push(`${encTitle}\n${encList}`);
  }

  return parts.join('\n\n');
}

// Validation function checking all required sections and minimum length
export function validateDocumentSections(
  sections: Partial<DocumentSections> | null | undefined,
  template: FormTemplate
): { valid: boolean; errors: string[]; charCount: number; wordCount: number } {
  const errors: string[] = [];

  if (!sections) {
    return { valid: false, errors: ['Document sections object is empty'], charCount: 0, wordCount: 0 };
  }

  // Check required sections for this template
  for (const sec of template.requiredSections) {
    if (sec === 'enclosures') continue;
    if (sec === 'body' && (sections.coverNote || sections.body)) continue;
    const val = (sections as Record<string, any>)[sec];
    if (!val || (typeof val === 'string' && val.trim().length === 0)) {
      errors.push(`Missing required section: "${sec}"`);
    }
  }

  const effectiveBody = sections.coverNote || sections.body || '';
  if (effectiveBody.trim().length < 80 && template.kind === 'letter') {
    errors.push(`Body content is too brief (${effectiveBody.trim().length} characters). Must contain complete paragraphs.`);
  }

  const fullText = formatSectionsToFullText(sections as DocumentSections);
  const charCount = fullText.length;
  const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;

  if (charCount < template.minLengthChars) {
    errors.push(
      `Document length is insufficient: ${charCount} characters found, minimum ${template.minLengthChars} required.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    charCount,
    wordCount,
  };
}

// Complete, rich, authentic fallback document generator for offline / fallback mode
export function generateFallbackDocument(
  template: FormTemplate,
  fieldValues: Record<string, string>,
  language: 'en' | 'hi' = 'en',
  customPrompt?: string
): DocumentSections {
  const isHi = language === 'hi';
  const today = new Date();
  const dateStr = isHi
    ? `${today.getDate()} ${['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'][today.getMonth()]} ${today.getFullYear()}`
    : today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const get = (k: string, defEn: string, defHi: string) => fieldValues[k] || (isHi ? defHi : defEn);

  switch (template.id) {
    // ----------------------------------------------------
    // STUDENT INTERNSHIP APPLICATION FORM (kind: application_form)
    // ----------------------------------------------------
    case 'student_internship': {
      const applicant = get('applicant_name', 'Rajesh Sharma', 'राजेश शर्मा');
      const father = get('father_name', 'Suresh Sharma', 'सुरेश शर्मा');
      const dob = get('dob', '2003-05-15', '15 मई 2003');
      const college = get('college', 'National Institute of Technology, Bhopal', 'राष्ट्रीय प्रौद्योगिकी संस्थान, भोपाल');
      const course = get('course', 'B.Tech in Computer Science & Engineering', 'बी.टेक (कंप्यूटर साइंस एंड इंजीनियरिंग)');
      const semester = get('semester_year', '6th Semester / 3rd Year', 'छठा सेमेस्टर / तृतीय वर्ष');
      const phone = get('contact', '+91 98765 43210', '+91 98765 43210');
      const email = get('email', 'rajesh.sharma@example.com', 'rajesh.sharma@example.com');
      const skills = get('skills', 'Python, TypeScript, React, SQL, Machine Learning', 'पायथन, टाइपस्क्रिप्ट, रिएक्ट, एसक्यूएल');
      const domain = get('preferred_domain', 'Full Stack Software Development', 'सॉफ्टवेयर डेवलपमेंट एवं डेटा साइंस');
      const duration = get('duration', '3 Months (June - August 2026)', '3 माह (जून - अगस्त 2026)');
      const org = fieldValues['organization_name'] ? fieldValues['organization_name'].trim() : '';
      const recipient = fieldValues['recipient_title'] ? fieldValues['recipient_title'].trim() : '';

      const fieldsTable = isHi ? [
        { label: 'आवेदक का पूरा नाम', value: applicant },
        { label: 'पिता का नाम', value: father },
        { label: 'जन्म तिथि', value: dob },
        { label: 'कॉलेज / विश्वविद्यालय', value: college },
        { label: 'पाठ्यक्रम एवं संकाय', value: course },
        { label: 'सेमेस्टर / वर्तमान वर्ष', value: semester },
        { label: 'संपर्क मोबाइल नंबर', value: phone },
        { label: 'ईमेल पता', value: email },
        { label: 'मुख्य तकनीकी कौशल', value: skills },
        { label: 'पसंदीदा कार्यक्षेत्र (Domain)', value: domain },
        { label: 'इंटर्नशिप की अवधि', value: duration },
        ...(org ? [{ label: 'लक्षित संस्था / कंपनी', value: org }] : []),
      ] : [
        { label: 'Applicant Full Name', value: applicant },
        { label: "Father's Name", value: father },
        { label: 'Date of Birth', value: dob },
        { label: 'College / University', value: college },
        { label: 'Course & Discipline', value: course },
        { label: 'Semester / Year', value: semester },
        { label: 'Contact Phone Number', value: phone },
        { label: 'Email Address', value: email },
        { label: 'Core Technical Skills', value: skills },
        { label: 'Preferred Internship Domain', value: domain },
        { label: 'Duration of Internship', value: duration },
        ...(org ? [{ label: 'Target Organization', value: org }] : []),
      ];

      // Subject comes from purpose, never from form title copy (Requirement 4)
      const subjectLine = org
        ? (isHi ? `विषय: ${org} में छात्र इंटर्नशिप हेतु आवेदन` : `Subject: Application for Student Internship at ${org}`)
        : (isHi ? `विषय: छात्र इंटर्नशिप हेतु आवेदन` : `Subject: Application for Student Internship`);

      // Statement of purpose in natural first person, no "on behalf of", max 3-4 sentences (Requirement 1 & 4)
      const coverNote = isHi
        ? `मैं आपके प्रतिष्ठित संस्थान में इंटर्नशिप अवसर प्राप्त करने हेतु यह आवेदन प्रस्तुत कर रहा/रही हूँ। ${college} में ${course} के विद्यार्थी के रूप में मैंने ${skills} में सुदृढ़ सैद्धांतिक व व्यावहारिक ज्ञान प्राप्त किया है। मैं ${duration} की इस अवधि में ${domain} के क्षेत्र में वास्तविक परियोजनाओं पर कार्य करते हुए अपने ज्ञान का उपयोग करने और संस्थान के लक्ष्यों में योगदान देने हेतु पूर्णतः प्रतिबद्ध हूँ। मुझे विश्वास है कि यह इंटर्नशिप मेरे करियर विकास में अत्यंत महत्वपूर्ण सिद्ध होगी।`
        : `I am writing to formally submit my application for a student internship opportunity ${org ? `with ${org}` : 'with your esteemed organization'}. As a dedicated student pursuing ${course} at ${college}, I have developed strong foundational knowledge and practical proficiency in ${skills}. I am keen to apply my academic learnings to real-world engineering challenges in ${domain} during this ${duration} tenure. I look forward to contributing productively to your team with diligence and enthusiasm.`;

      const declaration = isHi
        ? `मैं एतद्द्वारा सत्यनिष्ठा से घोषणा करता/करती हूँ कि इस आवेदन में प्रस्तुत किए गए समस्त विवरण मेरी सर्वोत्तम जानकारी व विश्वास के अनुसार पूर्णतः सत्य, सही एवं प्रामाणिक हैं।`
        : `I hereby solemnly declare that all the information and particulars furnished in this application form are true, complete, and correct to the best of my personal knowledge and belief.`;

      const signature = `${applicant}\n(Signature of Applicant)`;

      return {
        formTitle: isHi ? 'छात्र इंटर्नशिप आवेदन फॉर्म' : 'STUDENT INTERNSHIP APPLICATION FORM',
        header: recipient || (org ? `To,\n${recipient || 'The Internship Coordinator'},\n${org}` : ''),
        date: isHi ? `दिनांक: ${dateStr}` : `Date: ${dateStr}`,
        place: isHi ? `स्थान: भोपाल` : `Place: Bhopal`,
        subject: subjectLine,
        salutation: isHi ? 'महोदय / महोदया,' : 'Respected Sir/Madam,',
        fieldsTable,
        coverNote,
        declaration,
        body: coverNote,
        closing: isHi ? 'सादर धन्यवाद,\nभवदीय,' : 'Yours faithfully,',
        signature,
        enclosures: isHi
          ? ['बायोडाटा / रेज़्यूमे (Resume/CV)', 'कॉलेज पहचान पत्र / बोनाफाइड प्रमाण पत्र (College ID/Bonafide)']
          : ['Resume / Curriculum Vitae', 'College ID Card / Bonafide Certificate'],
      };
    }

    // ----------------------------------------------------
    // RESUME / CV (kind: resume)
    // ----------------------------------------------------
    case 'resume': {
      const applicant = get('applicant_name', 'Rahul Sharma', 'राहुल शर्मा');
      const email = get('email', 'rahul.sharma@example.com', 'rahul.sharma@example.com');
      const phone = get('contact', '+91 98765 43210', '+91 98765 43210');
      const city = get('city', 'Bhopal, Madhya Pradesh', 'भोपाल, मध्य प्रदेश');
      const linkedin = fieldValues['linkedin'] || '';
      const github = fieldValues['github'] || '';
      const summary = get('summary',
        'Results-driven Software Engineer with solid expertise in full-stack web development, REST APIs, and modern frontend frameworks. Passionate about designing efficient, scalable citizen services.',
        'सॉफ्टवेयर इंजीनियरिंग एवं वेब डेवलपमेंट में दक्ष पेशेवर, जो आधुनिक तकनीकों के माध्यम से कुशल समाधान विकसित करने हेतु प्रतिबद्ध है।'
      );
      const education = get('education', 'B.Tech in Computer Science — ABC Institute of Technology (2022 - 2026), CGPA: 8.7/10', 'बी.टेक (कंप्यूटर साइंस) — 2022-2026, सीजीपीए: 8.7');
      const skills = get('skills', 'JavaScript, TypeScript, Python, React, Next.js, Node.js, SQL, Git', 'जावास्क्रिप्ट, टाइपस्क्रिप्ट, पायथन, रिएक्ट, नोड.जेएस, एसक्यूएल');
      const projects = get('projects', '• Smart Portal Automation: Built full-stack civic form filling application serving 10,000+ citizens.\n• Document Analysis Pipeline: Implemented automated OCR verification with 98% accuracy.', '• स्मार्ट पोर्टल ऑटोमेशन प्रोजेक्ट\n• डॉक्यूमेंट एनालिसिस पाइपलाइन');
      const experience = fieldValues['experience'] || '';
      const certifications = fieldValues['certifications'] || '';
      const languages = fieldValues['languages'] || '';

      return {
        formTitle: isHi ? 'व्यावसायिक बायोडाटा' : 'CURRICULUM VITAE',
        header: `${applicant}\n${email} | ${phone} | ${city}${linkedin ? ` | ${linkedin}` : ''}${github ? ` | ${github}` : ''}`,
        date: `Date: ${dateStr}`,
        subject: `Resume of ${applicant}`,
        salutation: '',
        body: `${summary}\n\nEDUCATION\n${education}\n\nTECHNICAL SKILLS\n${skills}\n\nPROJECTS\n${projects}`,
        closing: '',
        signature: applicant,
        contactInfo: {
          name: applicant,
          email,
          phone,
          city,
          linkedin,
          github,
        },
        summary,
        education: [{ degree: education, institution: '', year: '' }],
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        projects: [{ title: 'Projects', bullets: projects.split('\n').filter(Boolean) }],
        experience: experience ? [{ role: experience, organization: '', period: '', bullets: [] }] : undefined,
        certifications: certifications ? [certifications] : undefined,
        languages: languages ? [languages] : undefined,
      };
    }

    case 'leave_application': {
      const applicant = get('applicant_name', 'Rahul Sharma', 'राहुल शर्मा');
      const designation = get('designation_or_roll', 'Senior Executive', 'वरिष्ठ अधिकारी');
      const org = get('organization_name', 'Acme Solutions Pvt. Ltd.', 'शासकीय महाविद्यालय');
      const recipient = get('recipient_title', 'The Branch Manager', 'श्रीमान शाखा प्रबंधक महोदय');
      const location = get('recipient_address', 'Bhopal, Madhya Pradesh', 'भोपाल, मध्य प्रदेश');
      const leaveType = get('leave_type', 'Casual Leave', 'आकस्मिक अवकाश');
      const startDate = get('start_date', '2026-11-01', '2026-11-01');
      const endDate = get('end_date', '2026-11-03', '2026-11-03');
      const reason = get('reason', 'due to urgent personal commitments and family responsibilities', 'अपरिहार्य पारिवारिक एवं व्यक्तिगत कार्य होने के कारण');
      const phone = get('emergency_phone', '+91 98765 43210', '+91 98765 43210');

      if (isHi) {
        return {
          header: `सेवा में,\n${recipient},\n${org},\n${location}`,
          date: `दिनांक: ${dateStr}`,
          subject: `विषय: ${startDate} से ${endDate} तक ${leaveType} स्वीकृत करने हेतु प्रार्थना पत्र`,
          salutation: `महोदय / महोदया,`,
          body: `सविनय निवेदन है कि प्रार्थी ${applicant}, आपकी प्रतिष्ठित संस्था में ${designation} के पद पर निष्ठापूर्वक कार्यरत है। प्रार्थी को उपरोक्त उल्लिखित अवधियों के दौरान ${reason} उपस्थित रहने में असमर्थता है।\n\nप्रार्थी ने अपनी अनुपस्थिति के दौरान कार्यालयीन कार्यों का सुचारू संचालन सुनिश्चित करने हेतु सभी आवश्यक दायित्व अपने सहयोगी को हस्तांतरित कर दिए हैं। किसी भी अत्यावश्यक कार्य हेतु प्रार्थी मोबाइल नंबर ${phone} पर उपलब्ध रहेगा।\n\nअतः आपसे सादर एवं विनम्र निवेदन है कि प्रार्थी को दिनांक ${startDate} से ${endDate} तक का ${leaveType} स्वीकृत करने की महती कृपा करें। इसके लिए प्रार्थी सदैव आपका आभारी रहेगा।`,
          closing: `सधन्यवाद,\nभवदीय,`,
          signature: `${applicant}\n${designation}\nसंपर्क: ${phone}`,
        };
      } else {
        return {
          header: `To,\n${recipient},\n${org},\n${location}`,
          date: `Date: ${dateStr}`,
          subject: `Subject: Application for ${leaveType} from ${startDate} to ${endDate}`,
          salutation: `Respected Sir/Madam,`,
          body: `I am writing to formally request ${leaveType} from ${startDate} to ${endDate} ${reason}.\n\nDuring my period of absence, I have ensured that all my ongoing assignments and urgent operational responsibilities are appropriately delegated to my team member so that workflow remains undisrupted. In case of any critical requirement or emergency, I will remain accessible via phone at ${phone} and email.\n\nI kindly request you to approve my leave application for the specified dates. I shall resume my duties promptly on the next working day. Thank you for your kind understanding and consideration.`,
          closing: `Yours faithfully / sincerely,`,
          signature: `${applicant}\n${designation}\nPhone: ${phone}`,
        };
      }
    }

    case 'scholarship_application': {
      const student = get('applicant_name', 'Priya Patel', 'प्रिया पटेल');
      const father = get('father_name', 'Ramesh Patel', 'रमेश पटेल');
      const recipient = get('recipient_title', 'The District Welfare Officer', 'जिला समाज कल्याण अधिकारी');
      const dept = get('department_or_office', 'Backward Classes & Minorities Welfare Department', 'पिछड़ा वर्ग एवं अल्पसंख्यक कल्याण विभाग');
      const scheme = get('scheme_name', 'State Post-Matric Scholarship Scheme 2026-27', 'राज्य पोस्ट-मैट्रिक छात्रवृत्ति योजना 2026-27');
      const institution = get('institution_name', 'Government Engineering College, Bhopal', 'शासकीय इंजीनियरिंग कॉलेज, भोपाल');
      const course = get('course_and_year', 'B.Tech in Computer Science, 2nd Year', 'बी.टेक (कंप्यूटर साइंस), द्वितीय वर्ष');
      const income = get('annual_income', 'Rs. 1,40,000/-', 'रु. 1,40,000/-');
      const category = get('category_caste', 'OBC Category', 'अन्य पिछड़ा वर्ग (OBC)');
      const records = get('academic_record', '86.4% in previous semester examinations', 'पूर्व सेमेस्टर परीक्षा में 86.4% अंक');

      if (isHi) {
        const fieldsTable = [
          { label: 'छात्र/छात्रा का पूरा नाम', value: student },
          { label: 'पिता/अभिभावक का नाम', value: father },
          { label: 'शैक्षणिक संस्थान', value: institution },
          { label: 'पाठ्यक्रम एवं वर्ष', value: course },
          { label: 'सामाजिक वर्ग / जाति', value: category },
          { label: 'वार्षिक पारिवारिक आय', value: income },
          { label: 'पूर्व शैक्षणिक प्रदर्शन', value: records },
          { label: 'छात्रवृत्ति योजना', value: scheme },
        ];
        const declaration = 'मैं सत्यनिष्ठा से घोषणा करता/करती हूँ कि ऊपर दी गई समस्त जानकारी पूर्णतः सत्य एवं प्रामाणिक है।';
        const coverNote = `सविनय निवेदन है कि प्रार्थिया ${student}, आत्मजा श्री ${father}, ${institution} में ${course} की नियमित छात्रा है। प्रार्थिया ${category} से संबंधित है और परिवार की कुल वार्षिक आय सभी स्रोतों से मात्र ${income} है।\n\nप्रार्थिया ने अपनी पूर्व परीक्षाओं में निरंतर उत्कृष्ट प्रदर्शन करते हुए ${records} अर्जित किए हैं। कमजोर आर्थिक स्थिति के कारण उच्च तकनीकी शिक्षा का संस्थागत शिक्षण शुल्क एवं शैक्षणिक व्यय वहन करना परिवार के लिए अत्यधिक कठिन हो रहा है। प्रार्थिया राज्य सरकार द्वारा अधिसूचित ${scheme} के सभी पात्रता मानदंडों को पूर्ण करती है।\n\nअतः आपसे करबद्ध प्रार्थना है कि प्रार्थिया के आवेदन एवं संलग्न शैक्षणिक व आय प्रमाण पत्रों का समुचित सत्यापन कराकर चालू शैक्षणिक सत्र हेतु छात्रवृत्ति राशि स्वीकृत करने की महती कृपा करें। इस अनुकंपा के लिए प्रार्थिया सदैव आपकी आभारी रहेगी।`;

        return {
          header: `सेवा में,\nश्रीमान ${recipient},\n${dept}`,
          date: `दिनांक: ${dateStr}`,
          subject: `विषय: ${scheme} के अंतर्गत वित्तीय सहायता व छात्रवृत्ति स्वीकृति हेतु आवेदन पत्र`,
          salutation: `महोदय,`,
          fieldsTable,
          coverNote,
          declaration,
          body: coverNote,
          closing: `सादर धन्यवाद,\nआपकी आज्ञाकारी शिष्या / प्रार्थिया,`,
          signature: `${student}\nअनुक्रमांक: 2024-CS-042\n${institution}`,
          enclosures: [
            'पूर्व वर्ष की अंकसूची की प्रमाणित प्रति (Marksheet copy)',
            'सक्षम राजस्व अधिकारी द्वारा जारी आय प्रमाण पत्र (Income Certificate)',
            'सक्षम प्राधिकारी द्वारा प्रदत्त जाति प्रमाण पत्र (Caste Certificate)',
            'संस्थागत शिक्षण शुल्क रसीद एवं बोनाफाइड प्रमाण पत्र (Fee Receipt & Bonafide)',
            'छात्र बैंक पासबुक एवं पहचान पत्र की छायाप्रति (Bank Passbook & ID Copy)',
          ],
        };
      } else {
        const fieldsTable = [
          { label: 'Student Full Name', value: student },
          { label: 'Father / Guardian Name', value: father },
          { label: 'Institution / College', value: institution },
          { label: 'Course & Year', value: course },
          { label: 'Social Category / Caste', value: category },
          { label: 'Annual Family Income', value: income },
          { label: 'Previous Academic Record', value: records },
          { label: 'Scholarship Scheme', value: scheme },
        ];
        const declaration = 'I hereby declare that all particulars stated above are true, complete, and correct to the best of my knowledge.';
        const coverNote = `I am submitting this formal application to kindly request sanction of scholarship under the ${scheme}. I am currently enrolled as a regular, full-time student pursuing ${course} at ${institution}.\n\nI belong to the ${category} category and my family's total annual income from all sources is ${income}, as certified by the competent revenue authority. Academically, I have maintained a consistent record of diligence, securing ${records}. Due to constrained financial means, it is challenging for my family to bear the semester tuition and academic development charges without state support.\n\nI fulfill all eligibility conditions stipulated under the scholarship guidelines and have enclosed my supporting documents herewith. I earnestly request you to favorably consider my application and grant the scholarship assistance for the current academic session.`;

        return {
          header: `To,\n${recipient},\n${dept}`,
          date: `Date: ${dateStr}`,
          subject: `Subject: Application for Grant of Financial Assistance under ${scheme}`,
          salutation: `Respected Sir/Madam,`,
          fieldsTable,
          coverNote,
          declaration,
          body: coverNote,
          closing: `Yours faithfully,`,
          signature: `${student}\nRoll No: 2024-CS-042\n${institution}`,
          enclosures: [
            'Certified copies of past semester marksheets',
            'Valid Annual Income Certificate issued by Tehsildar',
            'Community / Caste Certificate issued by Sub-Divisional Officer',
            'Current Institutional Fee Receipt & Bonafide Certificate',
            'Copy of Bank Passbook & Identity Proof',
          ],
        };
      }
    }

    case 'resignation':
    case 'resignation_letter': {
      const applicant = get('applicant_name', 'Rahul Sharma', 'राहुल शर्मा');
      const empId = get('employee_id', 'EMP-40918', 'EMP-40918');
      const designation = get('designation', 'Senior Software Engineer', 'वरिष्ठ सॉफ्टवेयर इंजीनियर');
      const department = get('department', 'Information Technology', 'सूचना प्रौद्योगिकी विभाग');
      const org = get('organization_name', 'TechCorp Solutions Pvt. Ltd.', 'टेककॉर्प सोल्यूशंस प्रा. लि.');
      const recipient = get('recipient_title', 'The Engineering Director / Head of HR', 'श्रीमान इंजीनियरिंग डायरेक्टर / मानव संसाधन प्रमुख');
      const location = get('recipient_address', 'Cyber City, Gurugram, Haryana', 'साइबर सिटी, गुरुग्राम, हरियाणा');
      const noticePeriod = get('notice_period', '30 Days', '30 दिन');
      const lastWorkingDay = get('last_working_day', '2026-11-30', '2026-11-30');
      const reason = get('reason', 'to pursue new professional career development opportunities', 'नए करियर विकास एवं उच्च अवसरों की प्राप्ति हेतु');
      const phone = get('emergency_phone', '+91 98765 43210', '+91 98765 43210');

      if (isHi) {
        return {
          header: `सेवा में,\n${recipient},\n${org},\n${location}`,
          date: `दिनांक: ${dateStr}`,
          subject: `विषय: ${designation} के पद से औपचारिक त्यागपत्र बाबत`,
          salutation: `महोदय / महोदया,`,
          body: `सविनय निवेदन है कि मैं, ${applicant}, वर्तमान में आपकी प्रतिष्ठित संस्था ${org} के ${department} विभाग में ${designation} (कर्मचारी कोड: ${empId}) के पद पर सेवारत हूँ। ${reason}, मैं अपने वर्तमान पद से औपचारिक त्यागपत्र प्रस्तुत कर रहा हूँ।\n\nसंस्थान की सेवा शर्तों एवं अनुबंध के अनुसार मैं ${noticePeriod} की नोटिस अवधि पूर्ण करने हेतु प्रतिबद्ध हूँ। इस प्रकार संस्थान में मेरा प्रस्तावित अंतिम कार्य दिवस ${lastWorkingDay} होगा।\n\nमैं अपने कार्यकाल के दौरान प्रबंधन एवं अपनी टीम द्वारा दिए गए निरंतर मार्गदर्शन, सहयोग और सीखने के बेहतरीन अवसरों के लिए हृदय से आभार व्यक्त करता हूँ। इस नोटिस अवधि के दौरान मैं अपनी सभी चालू परियोजनाओं, दायित्वों एवं आवश्यक फाइलों का सुचारू रूप से पूर्ण हस्तांतरण (Handover) सुनिश्चित करूँगा ताकि कार्य में किसी भी प्रकार का व्यवधान न आए।\n\nकृपया मेरा त्यागपत्र स्वीकार करने एवं नियमानुसार कार्यमुक्ति व बकाया भुगतान की अग्रिम प्रक्रिया पूर्ण करने की कृपा करें। संस्थान के उज्ज्वल भविष्य एवं निरंतर प्रगति की मंगलकामनाओं सहित।`,
          closing: `सधन्यवाद,\nभवदीय,`,
          signature: `${applicant}\n${designation}\nकर्मचारी कोड: ${empId}\nसंपर्क: ${phone}`,
        };
      } else {
        return {
          header: `To,\n${recipient},\n${org},\n${location}`,
          date: `Date: ${dateStr}`,
          subject: `Subject: Formal Resignation from the position of ${designation} - ${applicant}`,
          salutation: `Respected Sir/Madam,`,
          body: `Please accept this letter as formal notification that I am resigning from my position as ${designation} (Employee ID: ${empId}) in the ${department} department at ${org}. ${reason}, I have decided to tender my resignation.\n\nIn accordance with the company employment policies, I will complete my required notice period of ${noticePeriod}. Therefore, my proposed last working day with the organization will be ${lastWorkingDay}.\n\nI wish to express my deepest gratitude for the professional opportunities, mentorship, and invaluable experience provided to me throughout my tenure at ${org}. Working alongside such dedicated colleagues has been a rewarding experience that has contributed immensely to my career.\n\nDuring this notice period, I am fully committed to ensuring a seamless, structured transition of all my active responsibilities, ongoing deliverables, and project documentation. I will also assist in knowledge transfer and onboarding support to ensure continuous operational excellence. Please let me know how I may further assist during this period.\n\nI wish ${org} and the entire team continued success and prosperity in all future endeavors.`,
          closing: `Yours sincerely,`,
          signature: `${applicant}\n${designation}\nEmployee ID: ${empId}\nPhone: ${phone}`,
        };
      }
    }

    case 'bank_kyc_letter': {
      const holder = get('account_holder_name', 'Manoj Joshi', 'मनोज जोशी');
      const accNo = get('account_number', '30192837465', '30192837465');
      const bank = get('bank_name', 'State Bank of India', 'भारतीय स्टेट बैंक');
      const branch = get('branch_name', 'TT Nagar Branch, Bhopal', 'टी.टी. नगर शाखा, भोपाल');
      const address = get('residential_address', '124, Shivaji Nagar, Bhopal, M.P. - 462016', '124, शिवाजी नगर, भोपाल (म.प्र.) - 462016');
      const phone = get('registered_phone', '+91 98765 43210', '+91 98765 43210');
      const purpose = get('kyc_purpose', 'Periodic Re-KYC Compliance and Account Maintenance', 'आवधिक पुन: केवाईसी अनुपालन एवं खाता सत्यापन');

      if (isHi) {
        return {
          header: `सेवा में,\nश्रीमान शाखा प्रबंधक महोदय,\n${bank},\n${branch}`,
          date: `दिनांक: ${dateStr}`,
          subject: `विषय: बचत खाता संख्या ${accNo} में केवाईसी (KYC) दस्तावेज़ अद्यतन करने बाबत`,
          salutation: `महोदय,`,
          body: `सविनय निवेदन है कि प्रार्थी ${holder} का एक बचत खाता आपकी शाखा में खाता संख्या ${accNo} के अंतर्गत संचालित है। प्रार्थी को भारतीय रिज़र्व बैंक के नियामक दिशानिर्देशों के तहत खाते में ${purpose} पूर्ण करने का निर्देश प्राप्त हुआ है।\n\nप्रार्थी अपने नवीनतम एवं प्रमाणित पहचान तथा निवास प्रमाण पत्र इस आवेदन के साथ संलग्न कर रहा है। प्रार्थी का वर्तमान स्थाई पता ${address} तथा पंजीकृत मोबाइल नंबर ${phone} है, जिसे बैंक के सीबीएस रिकॉर्ड में अद्यतन किया जाना आवश्यक है।\n\nअतः श्रीमान जी से विनम्र निवेदन है कि प्रार्थी द्वारा प्रस्तुत स्व-प्रमाणित केवाईसी दस्तावेज़ों को स्वीकार कर बैंक रिकॉर्ड में अद्यतन करने एवं खाते का निर्बाध संचालन सुनिश्चित करने की कृपा करें। इस सहयोग हेतु प्रार्थी आपका आभारी रहेगा।`,
          closing: `भवदीय,\nप्रार्थी,`,
          signature: `${holder}\nखाता संख्या: ${accNo}\nमोबाइल: ${phone}\nपता: ${address}`,
          enclosures: [
            'स्व-प्रमाणित आधार कार्ड की प्रति (Self-attested Aadhaar Card Copy)',
            'स्व-प्रमाणित पैन कार्ड की प्रति (Self-attested PAN Card Copy)',
            'नवीनतम पासपोर्ट आकार फोटोग्राफ (Recent Passport Photograph)',
          ],
        };
      } else {
        return {
          header: `To,\nThe Branch Manager,\n${bank},\n${branch}`,
          date: `Date: ${dateStr}`,
          subject: `Subject: Updation of KYC Documents for Savings Bank Account No. ${accNo}`,
          salutation: `Respected Sir/Madam,`,
          body: `I maintain an active Savings Bank Account with your esteemed branch under Account Number ${accNo}. I am submitting this formal communication for ${purpose} in accordance with Reserve Bank of India (RBI) customer due diligence norms.\n\nI have enclosed my self-attested identity proof (Aadhaar Card) and permanent account number (PAN Card) along with recent photographs. My verified residential address is ${address} and my active contact number is ${phone}. I request you to update these particulars in the core banking system.\n\nKindly acknowledge receipt of the enclosed documents and update my account status at your earliest convenience to facilitate unhindered banking transactions. Thank you for your continued support and assistance.`,
          closing: `Yours faithfully,`,
          signature: `${holder}\nA/c No: ${accNo}\nMobile: ${phone}\nAddress: ${address}`,
          enclosures: [
            'Self-attested copy of Aadhaar Card (Proof of Identity & Address)',
            'Self-attested copy of PAN Card',
            'Recent passport-sized color photograph',
          ],
        };
      }
    }

    case 'complaint_letter': {
      const complainant = get('applicant_name', 'Amit Verma', 'अमित वर्मा');
      const address = get('applicant_address', 'Flat 302, Green Valley Apartments, Ward 14, Bhopal (M.P.)', 'मकान नं. 45, वार्ड क्र. 14, ग्रीन वैली, भोपाल');
      const recipient = get('recipient_title', 'The Municipal Commissioner', 'श्रीमान आयुक्त महोदय');
      const authority = get('authority_name', 'Municipal Corporation, Bhopal', 'नगर पालिक निगम, भोपाल');
      const subject = get('complaint_subject', 'Irregular drinking water supply and contaminated pipeline leakages', 'वार्ड में निरंतर दूषित पेयजल आपूर्ति एवं पाइपलाइन लीकेज के संबंध में');
      const details = get('complaint_details', 'For the past three weeks, residents of our locality have been receiving muddy and foul-smelling water for barely 15 minutes a day, posing severe health hazards.', 'विगत तीन सप्ताह से क्षेत्र में पेयजल आपूर्ति अत्यंत अनियमित है। नलों से गंदा और बदबूदार पानी आ रहा है, जिससे नागरिकों में संक्रामक बीमारियों का गंभीर खतरा उत्पन्न हो गया है।');
      const relief = get('relief_sought', 'Immediate technical inspection by the public health engineering team and prompt repair of pipeline leakages to restore clean potable water.', 'जल कार्य विभाग द्वारा तत्काल स्थल निरीक्षण करवाकर पाइपलाइन की मरम्मत की जाए और स्वच्छ पेयजल आपूर्ति बहाल की जाए।');

      if (isHi) {
        return {
          header: `सेवा में,\n${recipient},\n${authority}`,
          date: `दिनांक: ${dateStr}`,
          subject: `विषय: ${subject}`,
          salutation: `महोदय,`,
          body: `सविनय निवेदन है कि प्रार्थी ${complainant}, निवासी ${address}, आपके संज्ञान में क्षेत्र की गंभीर एवं चिंताजनक जनसमस्या प्रस्तुत कर रहा है।\n\n${details} इस विषय में स्थानीय वार्ड कार्यालय में पूर्व में भी मौखिक व लिखित सूचना दी गई थी, परंतु अब तक कोई ठोस सुधारात्मक कदम नहीं उठाया गया है। स्वच्छ पेयजल प्राप्त करना नागरिकों का मूलभूत अधिकार है तथा निगम प्रशासन का प्राथमिक वैधानिक दायित्व है।\n\nअतः श्रीमान जी से विनम्र निवेदन है कि जनहित को सर्वोपरि रखते हुए ${relief} इस त्वरित कार्यवाही हेतु प्रार्थी एवं समस्त क्षेत्रवासी सदैव आपके कृतज्ञ रहेंगे।`,
          closing: `सधन्यवाद,\nभवदीय / प्रार्थी,`,
          signature: `${complainant}\nपता: ${address}\nनागरिक प्रतिनिधि, वार्ड 14`,
        };
      } else {
        return {
          header: `To,\n${recipient},\n${authority}`,
          date: `Date: ${dateStr}`,
          subject: `Subject: Formal Complaint regarding ${subject}`,
          salutation: `Respected Sir/Madam,`,
          body: `I am writing to bring to your urgent personal attention a critical civic grievance that has severely affected our neighborhood at ${address}.\n\n${details} Despite representations to the local maintenance division, no effective remedial measures have been initiated. The prolonged disruption in basic services is causing immense distress to families, senior citizens, and children.\n\nI earnestly urge your office to intervene immediately and direct the concerned personnel to undertake ${relief} We look forward to your prompt and decisive administrative action.`,
          closing: `Yours sincerely,`,
          signature: `${complainant}\nAddress: ${address}`,
        };
      }
    }

    case 'rti_application': {
      const applicant = get('applicant_name', 'Rajesh Kumar', 'राजेश कुमार');
      const address = get('applicant_address', 'House No. 56, Malviya Nagar, Bhopal, M.P. - 462003', 'मकान नं. 56, मालवीय नगर, भोपाल (म.प्र.) - 462003');
      const pio = get('pio_designation', 'The Public Information Officer (PIO)', 'श्रीमान लोक सूचना अधिकारी (PIO)');
      const authority = get('public_authority', 'Public Works Department (PWD)', 'लोक निर्माण विभाग (PWD)');
      const office = get('office_address', 'Nirman Bhawan, Arera Hills, Bhopal (M.P.)', 'निर्माण भवन, अरेरा हिल्स, भोपाल');
      const particulars = get('particulars_of_information', '1. Certified copy of tender sanction order for road construction in Sector B.\n2. Certified copy of completion certificate and quality inspection audit report.\n3. Details of total funds disbursed and name of contractor agency.', '1. सेक्टर-बी में सड़क निर्माण कार्य के स्वीकृत टेंडर आदेश की प्रमाणित प्रति।\n2. गुणवत्ता परीक्षण एवं कार्य पूर्णता प्रमाण पत्र (Quality Audit Report) की प्रतिलिपि।\n3. ठेकेदार फर्म का नाम व भुगतान की गई कुल राशि का विवरण।');
      const period = get('period_pertaining_to', '01 April 2024 to 31 March 2026', '1 अप्रैल 2024 से 31 मार्च 2026');
      const fee = get('fee_details', 'Indian Postal Order (IPO) No. 45G 123456 of Rs. 10/- enclosed', 'रु. 10/- का भारतीय पोस्टल ऑर्डर (IPO) क्र. 45G 123456 संलग्न');

      if (isHi) {
        return {
          header: `सेवा में,\n${pio},\n${authority},\n${office}`,
          date: `दिनांक: ${dateStr}`,
          subject: `विषय: सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के अंतर्गत सूचना प्राप्ति हेतु आवेदन`,
          salutation: `महोदय / महोदया,`,
          body: `प्रार्थी भारत का नागरिक है और सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के तहत निम्नलिखित प्रमाणित जानकारी प्राप्त करना चाहता है:\n\nसूचना का बिंदुवार विवरण:\n${particulars}\n\nउक्त सूचना समयावधि ${period} से संबंधित है। आवेदन शुल्क के रूप में ${fee} है। यदि मांगी गई सूचना आपके कार्यालय से संबंधित न होकर किसी अन्य लोक प्राधिकारी से संबंधित हो, तो अधिनियम की धारा 6(3) के अनुसार इस आवेदन को पांच दिवस के भीतर संबंधित प्राधिकारी को अंतरित कर प्रार्थी को सूचित करें।\n\nप्रार्थी प्रमाणित प्रतियों हेतु अतिरिक्त आवश्यक शुल्क (नियमों के अनुसार) जमा करने के लिए तैयार है। कृपया निर्धारित 30 दिवस की समय-सीमा के भीतर वांछित सूचना डाक द्वारा प्रार्थी के पते पर प्रेषित करने की कृपा करें।`,
          closing: `भवदीय,\n(भारतीय नागरिक),`,
          signature: `${applicant}\nपता: ${address}`,
          enclosures: [
            'निर्धारित आवेदन शुल्क (IPO / चालान प्रति)',
            'पहचान पत्र की स्व-प्रमाणित प्रतिलिपि',
          ],
        };
      } else {
        return {
          header: `To,\n${pio},\n${authority},\n${office}`,
          date: `Date: ${dateStr}`,
          subject: `Subject: Application under Section 6(1) of the Right to Information Act, 2005`,
          salutation: `Respected Sir/Madam,`,
          body: `I am a citizen of India and hereby request you to provide certified information under Section 6(1) of the Right to Information Act, 2005 on the following points:\n\nParticulars of Information Sought:\n${particulars}\n\nThe information pertains to the period: ${period}. The prescribed application fee has been remitted via: ${fee}.\n\nIn the event that any part of this requested information pertains to another public authority, kindly transfer this application within five days under Section 6(3) of the Act and inform me accordingly. I undertake to pay any additional photocopying or inspection fees upon formal intimation. Kindly dispatch the certified information by Registered Post to the address indicated below within the statutory 30-day timeline.`,
          closing: `Yours faithfully,\n(Citizen of India),`,
          signature: `${applicant}\nPostal Address: ${address}`,
          enclosures: [
            'Prescribed application fee instrument (IPO / Challan)',
            'Self-attested copy of Voter Identity Card / Aadhaar Card',
          ],
        };
      }
    }

    case 'bonafide_certificate_request': {
      const student = get('applicant_name', 'Rahul Sharma', 'राहुल शर्मा');
      const roll = get('roll_no', '21BCE1042', '21BCE1042');
      const college = get('college_name', 'Govt. Engineering College, Bhopal', 'शासकीय इंजीनियरिंग कॉलेज, भोपाल');
      const course = get('course_name', 'B.Tech in Computer Science', 'बी.टेक कंप्यूटर साइंस');
      const sem = get('semester', '5th Semester / 3rd Year', '5वां सेमेस्टर / तृतीय वर्ष');
      const purpose = get('purpose', 'Passport Application / Scholarship Verification', 'पासपोर्ट आवेदन / छात्रवृत्ति सत्यापन');
      const recipient = get('recipient_title', 'The Principal', 'श्रीमान प्राचार्य महोदय');

      if (isHi) {
        return {
          header: `सेवा में,\n${recipient},\n${college}`,
          date: `दिनांक: ${dateStr}`,
          subject: `विषय: अध्ययनरत (बोनाफाइड) प्रमाण पत्र जारी करने हेतु प्रार्थना पत्र`,
          salutation: `आदरणीय महोदय / महोदया,`,
          body: `सविनय निवेदन है कि प्रार्थी ${student}, इस संस्थान में ${course} का नियमित छात्र/छात्रा है। प्रार्थी का वर्तमान नामांकन/अनुक्रमांक ${roll} है तथा प्रार्थी वर्तमान में ${sem} में अध्ययनरत है।\n\nप्रार्थी को ${purpose} हेतु संस्थागत अध्ययनरत (Bonafide) प्रमाण पत्र की अनिवार्य आवश्यकता है। प्रार्थी का आचरण संस्थान में उत्तम रहा है तथा कोई भी शुल्क अथवा पुस्तकालय देयता बकाया नहीं है।\n\nअतः श्रीमान जी से विनम्र निवेदन है कि प्रार्थी के शैक्षणिक भविष्य को दृष्टिगत रखते हुए आधिकारिक बोनाफाइड प्रमाण पत्र जारी करने की कृपा करें।`,
          closing: `सधन्यवाद,\nआपका आज्ञाकारी शिष्य / शिष्या,`,
          signature: `${student}\nअनुक्रमांक: ${roll}\nपाठ्यक्रम: ${course}\n${college}`,
          enclosures: ['कॉलेज पहचान पत्र की छायाप्रति', 'नवीनतम सेमेस्टर शुल्क रसीद'],
        };
      } else {
        return {
          header: `To,\n${recipient},\n${college}`,
          date: `Date: ${dateStr}`,
          subject: `Subject: Formal Request for Issuance of Bonafide Student Certificate`,
          salutation: `Respected Sir/Madam,`,
          body: `I am writing to formally request the issuance of a Bonafide / Study Certificate from your esteemed institution. I am a bona fide full-time student enrolled in ${course} under Roll / Enrollment Number ${roll}, currently pursuing my ${sem}.\n\nI require this official certificate for ${purpose}. I confirm that all institutional dues, tuition installments, and library borrowings are cleared.\n\nI request your office to issue the verified certificate at an early date. Thank you for your continued support and assistance.`,
          closing: `Yours obediently,`,
          signature: `${student}\nRoll No: ${roll}\n${course}\n${college}`,
          enclosures: ['Copy of Student College Identity Card', 'Recent Tuition Fee Receipt'],
        };
      }
    }

    case 'disability_certificate_application': {
      const applicant = get('applicant_name', 'Manoj Kumar', 'मनोज कुमार');
      const father = get('father_name', 'Ramesh Kumar', 'रमेश कुमार');
      const dob = get('dob', '1998-04-10', '10 अप्रैल 1998');
      const gender = get('gender', 'Male', 'पुरुष');
      const address = get('address', 'Ward No. 12, Huzur, Bhopal (M.P.)', 'वार्ड नं. 12, हुजूर, भोपाल (म.प्र.)');
      const disType = get('disability_type', 'Locomotor Disability', 'अस्थि दिव्यांगता (Locomotor)');
      const hospital = get('hospital_name', 'District Civil Hospital, Bhopal', 'जिला सिविल अस्पताल, भोपाल');
      const phone = get('contact', '+91 98765 43210', '+91 98765 43210');

      const fieldsTable = isHi ? [
        { label: 'आवेदक का पूरा नाम', value: applicant },
        { label: 'पिता या अभिभावक का नाम', value: father },
        { label: 'जन्म तिथि', value: dob },
        { label: 'लिंग', value: gender },
        { label: 'स्थायी निवास का पता', value: address },
        { label: 'दिव्यांगता का प्रकार', value: disType },
        { label: 'लक्षित जिला अस्पताल / CMO', value: hospital },
        { label: 'संपर्क मोबाइल नंबर', value: phone },
      ] : [
        { label: 'Applicant Full Name', value: applicant },
        { label: "Father's / Guardian's Name", value: father },
        { label: 'Date of Birth', value: dob },
        { label: 'Gender', value: gender },
        { label: 'Permanent Address', value: address },
        { label: 'Disability Category', value: disType },
        { label: 'Assigned Hospital / Authority', value: hospital },
        { label: 'Mobile Number', value: phone },
      ];

      const coverNote = isHi
        ? `मैं मुख्य चिकित्सा अधिकारी (CMO) मेडिकल बोर्ड से दिव्यांगता मूल्यांकन और आधिकारिक UDID स्वावलंबन कार्ड जारी करने हेतु यह औपचारिक आवेदन प्रस्तुत कर रहा/रही हूँ। मुझे दैनिक गतिविधियों में ${disType} के कारण शारीरिक सीमाएं हैं। मैं सरकारी कल्याण योजनाओं और यात्रा रियायतों हेतु मेडिकल परीक्षण के लिए उपस्थित होने को तैयार हूँ।`
        : `I am formally submitting this application for clinical medical assessment and issuance of a permanent Disability Certificate and Unique Disability Identity (UDID) Card. Due to ${disType}, I face mobility challenges and require official statutory recognition for welfare benefits and concessions. I undertake to appear before the Medical Board on the appointed evaluation date.`;

      const declaration = isHi
        ? `मैं एतद्द्वारा सत्यनिष्ठा से घोषणा करता/करती हूँ कि आवेदन में दिए गए समस्त विवरण पूर्णतः सत्य हैं और मैंने किसी अन्य जिले से पूर्व में कोई दूसरा UDID कार्ड प्राप्त नहीं किया है।`
        : `I hereby solemnly declare that all particulars stated above are true and complete. I have not obtained any other UDID card or disability certificate from any other district authority.`;

      return {
        formTitle: isHi ? 'दिव्यांगता प्रमाण पत्र एवं UDID आवेदन फॉर्म' : 'DISABILITY CERTIFICATE & UDID APPLICATION FORM',
        header: `To,\nThe Chief Medical Officer (CMO),\nMedical Assessment Board,\n${hospital}`,
        subject: isHi ? 'विषय: दिव्यांगता प्रमाण पत्र एवं UDID कार्ड जारी करने हेतु आवेदन' : 'Subject: Application for Disability Certificate and UDID Card Assessment',
        salutation: isHi ? 'महोदय,' : 'Respected Sir/Madam,',
        body: coverNote,
        closing: isHi ? 'सादर धन्यवाद,\nभवदीय,' : 'Yours faithfully,',
        fieldsTable,
        coverNote,
        declaration,
        hasPhoto: true,
        date: `Date: ${dateStr}`,
        place: address.split(',').slice(-2)[0]?.trim() || 'Bhopal',
        signature: `${applicant}\n(Applicant / Legal Guardian)`,
        enclosures: [
          'Copy of Aadhaar Card (Proof of Identity & Residence)',
          'Recent Passport-sized color photographs showing disability',
          'Clinical hospital diagnosis / treatment slips',
        ],
      };
    }

    case 'loan_application_request': {
      const applicant = get('applicant_name', 'Vikas Sharma', 'विकास शर्मा');
      const father = get('father_name', 'Satish Sharma', 'सतीश शर्मा');
      const dob = get('dob', '1995-08-20', '20 अगस्त 1995');
      const address = get('address', 'Shop 4, Main Market, Bhopal (M.P.)', 'दुकान नं. 4, मुख्य बाजार, भोपाल (म.प्र.)');
      const scheme = get('loan_scheme', 'PM Mudra Yojana (Kishore - Up to ₹5 Lakh)', 'प्रधानमंत्री मुद्रा योजना (किशोर ऋण)');
      const amount = get('loan_amount', '₹2,50,000', '₹2,50,000');
      const purpose = get('business_or_course', 'Retail Grocery Store Expansion & Stock Purchase', 'किराना स्टोर विस्तार एवं सामग्री क्रय');
      const bank = get('bank_branch', 'State Bank of India, Main Market Branch', 'भारतीय स्टेट बैंक, मुख्य बाजार शाखा');
      const phone = get('contact', '+91 98765 43210', '+91 98765 43210');

      const fieldsTable = isHi ? [
        { label: 'आवेदक का पूरा नाम', value: applicant },
        { label: 'पिता का नाम', value: father },
        { label: 'जन्म तिथि', value: dob },
        { label: 'निवास / व्यावसायिक पता', value: address },
        { label: 'ऋण योजना', value: scheme },
        { label: 'आवश्यक ऋण राशि', value: amount.startsWith('₹') ? amount : `₹${amount}` },
        { label: 'उद्यम / ऋण उपयोग का उद्देश्य', value: purpose },
        { label: 'बैंक एवं शाखा', value: bank },
        { label: 'संपर्क मोबाइल नंबर', value: phone },
      ] : [
        { label: 'Applicant Full Name', value: applicant },
        { label: "Father's Name", value: father },
        { label: 'Date of Birth', value: dob },
        { label: 'Residential / Business Address', value: address },
        { label: 'Loan Scheme', value: scheme },
        { label: 'Loan Amount Requested', value: amount.startsWith('₹') ? amount : `₹${amount}` },
        { label: 'Project / Utilization Purpose', value: purpose },
        { label: 'Target Bank & Branch', value: bank },
        { label: 'Mobile Number', value: phone },
      ];

      const coverNote = isHi
        ? `मैं ${bank} से ${scheme} के अंतर्गत ${amount.startsWith('₹') ? amount : `₹${amount}`} की वित्तीय सहायता प्राप्त करने हेतु यह औपचारिक आवेदन प्रस्तुत कर रहा/रही हूँ। यह पूंजी ${purpose} हेतु उपयोग की जाएगी। उद्यम की आर्थिक व्यवहार्यता सुनिश्चित है तथा मैं बैंक की मासिक किस्तों का समय पर भुगतान करने हेतु पूर्णतः वचनबद्ध हूँ।`
        : `I am formally submitting this application for financial assistance of ${amount.startsWith('₹') ? amount : `₹${amount}`} under ${scheme} through ${bank}. The sanctioned funds will be deployed towards ${purpose}. The proposed enterprise is commercially viable, and I undertake to repay all principal and interest installments diligently.`;

      const declaration = isHi
        ? `मैं सत्यनिष्ठा से घोषणा करता हूँ कि मेरे विरुद्ध किसी भी बैंक में ऋण डिफ़ॉल्ट नहीं है और प्रस्तुत समस्त विवरण सत्य हैं।`
        : `I hereby solemnly declare that I have not defaulted on any past institutional borrowing and all representations stated herein are true and accurate.`;

      return {
        formTitle: isHi ? 'मुद्रा / शिक्षा ऋण औपचारिक आवेदन फॉर्म' : 'MUDRA / EDUCATION LOAN APPLICATION FORM',
        header: `To,\nThe Branch Manager,\n${bank}`,
        subject: isHi ? `विषय: ${scheme} के अंतर्गत ऋण स्वीकृति हेतु आवेदन` : `Subject: Application for Loan Assistance under ${scheme}`,
        salutation: isHi ? 'महोदय,' : 'Respected Sir/Madam,',
        body: coverNote,
        closing: isHi ? 'सादर धन्यवाद,\nभवदीय,' : 'Yours faithfully,',
        fieldsTable,
        coverNote,
        declaration,
        hasPhoto: true,
        date: `Date: ${dateStr}`,
        place: address.split(',').slice(-2)[0]?.trim() || 'Bhopal',
        signature: `${applicant}\n(Signature of Borrower / Applicant)`,
        enclosures: [
          'Self-attested PAN Card copy',
          'Self-attested Aadhaar Card copy',
          'Business quotation / Project estimation report',
          'Bank statement of past 6 months',
        ],
      };
    }

    case 'trade_license_application': {
      const applicant = get('applicant_name', 'Deepak Agrawal', 'दीपक अग्रवाल');
      const firm = get('business_name', 'Agrawal General & Stationery Mart', 'अग्रवाल जनरल एवं स्टेशनरी मार्ट');
      const nature = get('trade_nature', 'Retail Grocery and Stationery Mart', 'खुदरा किराना एवं स्टेशनरी व्यापार');
      const address = get('business_address', 'Shop 14, Commercial Complex, Ward 22, Bhopal', 'दुकान 14, कमर्शियल कॉम्प्लेक्स, वार्ड 22, भोपाल');
      const premise = get('premise_type', 'Rented Commercial Shop', 'किराये की व्यावसायिक दुकान');
      const turnover = get('annual_turnover', '₹15,00,000', '₹15,00,000');
      const phone = get('contact', '+91 98765 43210', '+91 98765 43210');

      const fieldsTable = isHi ? [
        { label: 'प्रोपराइटर का नाम', value: applicant },
        { label: 'व्यापारिक प्रतिष्ठान का नाम', value: firm },
        { label: 'व्यापार की प्रकृति', value: nature },
        { label: 'प्रतिष्ठान का पूरा पता', value: address },
        { label: 'स्थल स्वामित्व स्थिति', value: premise },
        { label: 'अनुमानित वार्षिक टर्नओवर', value: turnover },
        { label: 'संपर्क मोबाइल नंबर', value: phone },
      ] : [
        { label: 'Proprietor / Applicant Name', value: applicant },
        { label: 'Commercial Firm Name', value: firm },
        { label: 'Nature of Trade Activity', value: nature },
        { label: 'Premise Business Address', value: address },
        { label: 'Premise Ownership Status', value: premise },
        { label: 'Estimated Annual Turnover', value: turnover },
        { label: 'Contact Phone Number', value: phone },
      ];

      const coverNote = isHi
        ? `मैं नगर निगम प्रशासन से ${firm} के संचालन हेतु नगर पालिक अधिनियम के अंतर्गत नवीन ट्रेड लाइसेंस जारी करने का अनुरोध करता हूँ। व्यापार स्थल पर स्वच्छता, जन-सुरक्षा एवं अग्निशमन मानकों का पूर्ण पालन सुनिश्चित किया जाएगा।`
        : `I am formally submitting this application to Municipal Corporation authorities for grant of a new commercial Trade License for operating ${firm} at ${address}. I undertake to strictly adhere to all municipal health, hygiene, safety, and pollution guidelines.`;

      const declaration = isHi
        ? `मैं एतद्द्वारा घोषणा करता हूँ कि व्यापारिक स्थल पर कोई अवैध निर्माण या अतिक्रमण नहीं है और समस्त प्रस्तुत दस्तावेज सत्य हैं।`
        : `I hereby declare that the commercial premise has no unauthorized encroachment and complies with municipal zoning regulations.`;

      return {
        formTitle: isHi ? 'नगर निगम व्यापार / ट्रेड लाइसेंस आवेदन फॉर्म' : 'MUNICIPAL TRADE LICENSE APPLICATION FORM',
        header: `To,\nThe Municipal Commissioner,\nMunicipal Corporation`,
        subject: isHi ? `विषय: ${firm} हेतु नवीन ट्रेड लाइसेंस जारी करने के संबंध में` : `Subject: Application for Grant of Municipal Trade License for ${firm}`,
        salutation: isHi ? 'महोदय,' : 'Respected Sir/Madam,',
        body: coverNote,
        closing: isHi ? 'सादर धन्यवाद,\nभवदीय,' : 'Yours faithfully,',
        fieldsTable,
        coverNote,
        declaration,
        hasPhoto: true,
        date: `Date: ${dateStr}`,
        place: address.split(',').slice(-2)[0]?.trim() || 'Bhopal',
        signature: `${applicant}\nProprietor / Authorized Signatory\n${firm}`,
        enclosures: [
          'Proof of Premise Ownership / Rent Agreement',
          'Property Tax Payment Receipt',
          'Proprietor Aadhaar and PAN Copy',
          'Commercial site layout diagram',
        ],
      };
    }

    case 'hostel_admission_application': {
      const student = get('applicant_name', 'Priya Sharma', 'प्रिया शर्मा');
      const parent = get('father_name', 'Omprakash Sharma', 'ओमप्रकाश शर्मा');
      const dob = get('dob', '2004-11-12', '12 नवंबर 2004');
      const course = get('course', 'B.Sc Electronics (Honours)', 'बी.एससी इलेक्ट्रॉनिक्स');
      const sem = get('semester', '1st Semester (2026-27)', 'प्रथम सेमेस्टर (2026-27)');
      const home = get('permanent_address', 'Village Pipariya, Dist. Hoshangabad (M.P.)', 'ग्राम पिपरिया, जिला होशंगाबाद (म.प्र.)');
      const dist = get('distance_km', '180 KM', '180 कि.मी.');
      const phone = get('emergency_phone', '+91 98765 43210', '+91 98765 43210');

      const fieldsTable = isHi ? [
        { label: 'छात्र / छात्रा का पूरा नाम', value: student },
        { label: 'माता/पिता का नाम', value: parent },
        { label: 'जन्म तिथि', value: dob },
        { label: 'पाठ्यक्रम एवं संकाय', value: course },
        { label: 'सेमेस्टर / शैक्षणिक वर्ष', value: sem },
        { label: 'स्थायी गृह पता', value: home },
        { label: 'कॉलेज से दूरी (कि.मी.)', value: dist },
        { label: 'अभिभावक का आपातकालीन नंबर', value: phone },
      ] : [
        { label: 'Student Full Name', value: student },
        { label: "Parent's / Guardian's Name", value: parent },
        { label: 'Date of Birth', value: dob },
        { label: 'Enrolled Degree / Course', value: course },
        { label: 'Semester / Academic Year', value: sem },
        { label: 'Permanent Home Address', value: home },
        { label: 'Distance from Campus', value: dist },
        { label: 'Emergency Contact Phone', value: phone },
      ];

      const coverNote = isHi
        ? `मैं कॉलेज छात्रावास में कक्ष आवंटन एवं मेस सुविधा प्राप्त करने हेतु यह औपचारिक आवेदन प्रस्तुत कर रहा/रही हूँ। मेरा स्थायी निवास कॉलेज से ${dist} की दूरी पर स्थित होने के कारण दैनिक आवागमन संभव नहीं है। मैं छात्रावास के अनुशासन व नियमों का पूर्ण निष्ठा से पालन करूंगा/करूंगी।`
        : `I am submitting this application for room allotment and mess enrollment in the college hostel for ${sem}. As my permanent residence is located at a distance of ${dist} from campus, daily commuting is unfeasible. I undertake to abide strictly by all hostel rules, timings, and code of conduct.`;

      const declaration = isHi
        ? `मैं सत्यनिष्ठा से घोषणा करता/करती हूँ कि मैं किसी भी रैगिंग अथवा अनुशासनहीनता में संलिप्त नहीं रहूँगा/रहूँगी।`
        : `I solemnly declare that I shall maintain high moral conduct and refrain from any act of indiscipline, harassment, or ragging.`;

      return {
        formTitle: isHi ? 'कॉलेज छात्रावास प्रवेश आवेदन फॉर्म' : 'COLLEGE HOSTEL ADMISSION APPLICATION FORM',
        header: `To,\nThe Chief Warden,\nHostel Administration Office`,
        subject: isHi ? `विषय: सत्र ${sem} हेतु छात्रावास कक्ष आवंटन प्रार्थना पत्र` : `Subject: Application for College Hostel Room Allotment for ${sem}`,
        salutation: isHi ? 'महोदय,' : 'Respected Sir/Madam,',
        body: coverNote,
        closing: isHi ? 'सादर धन्यवाद,\nभवदीय,' : 'Yours faithfully,',
        fieldsTable,
        coverNote,
        declaration,
        hasPhoto: true,
        date: `Date: ${dateStr}`,
        place: 'Hostel Administrative Office',
        signature: `${student}\n(Signature of Student)\n\nCountersigned:\n${parent}\n(Signature of Parent/Guardian)`,
        enclosures: [
          'College Admission Fee Receipt Copy',
          'Permanent Domicile / Residence Proof',
          'Medical Fitness Certificate',
          'Parent / Guardian ID and Contact Undertaking',
        ],
      };
    }

    default: {
      const promptToUse = customPrompt || template.name || 'Official Application';
      const applicant = get('applicant_name', 'Rahul Sharma', 'राहुल शर्मा');
      const address = fieldValues['applicant_address'] || '';
      // No invented recipient (Requirement 3): if unknown, use clear placeholder
      const recipient = fieldValues['recipient_title'] ? fieldValues['recipient_title'].trim() : '[Recipient name and address]';
      const office = fieldValues['office_name'] ? fieldValues['office_name'].trim() : '';
      const subject = fieldValues['subject_line']
        ? (isHi ? `विषय: ${fieldValues['subject_line']}` : `Subject: ${fieldValues['subject_line']}`)
        : (isHi ? `विषय: ${promptToUse} के संबंध में आवेदन` : `Subject: Application regarding ${promptToUse}`);
      const specificPurpose = fieldValues['specific_purpose'] || fieldValues['application_body'] || `regarding ${promptToUse}`;

      const lowerPrompt = (promptToUse + ' ' + specificPurpose).toLowerCase();

      let synthesizedBodyHi = '';
      let synthesizedBodyEn = '';

      if (lowerPrompt.includes('rent') || lowerPrompt.includes('lease') || lowerPrompt.includes('किराया')) {
        synthesizedBodyHi = `यह आवासीय/व्यावसायिक किराया समझौता प्रार्थी ${applicant} (किरायेदार) एवं ${recipient} (मकान मालिक) के मध्य निष्पादित किया जाता है।\n\nउक्त परिसर का उपयोग आवासीय एवं शांतिपूर्ण कार्यों हेतु नियमानुसार किया जाएगा। समझौते के अंतर्गत नियत मासिक किराया, धरोहर राशि एवं नोटिस अवधि के समस्त प्रावधान दोनों पक्षों पर बाध्यकारी होंगे।\n\nदोनों पक्ष इस समझौते के समस्त नियमों, शर्तों एवं उत्तरदायित्वों से पूर्णतः सहमत हैं और अपनी स्वतंत्र सहमति से इस पर हस्ताक्षर कर रहे हैं।`;
        synthesizedBodyEn = `This Tenancy & Lease Agreement is entered into by and between ${applicant} (Tenant), residing at ${address || '[Address]'}, and ${recipient} (Landlord/Owner).\n\nThe tenant agrees to occupy and maintain the demised premises in a good, tenantable condition strictly in accordance with mutual covenants. The payment of monthly rent consideration, refundable security deposit, utility consumption dues, and the agreed notice period shall govern the tenure.\n\nBoth parties hereby confirm that they have read and understood all recitals, terms, and obligations set forth herein and execute this agreement voluntarily with full legal effect.`;
      } else if (lowerPrompt.includes('affidavit') || lowerPrompt.includes('हलफनामा') || lowerPrompt.includes('शपथपत्र')) {
        synthesizedBodyHi = `मैं, ${applicant}, निवासी ${address || '[पता]'}, ईश्वर को साक्षी मानकर सत्यनिष्ठा से निम्नलिखित शपथपूर्वक बयान करता/करती हूँ:\n\n1. यह कि प्रार्थी उपरोक्त पते का स्थायी निवासी है और यह शपथ पत्र ${promptToUse} के प्रयोजनार्थ निष्पादित कर रहा/रही है।\n2. यह कि ${specificPurpose} के संबंध में प्रस्तुत किए गए सभी तथ्य, साक्ष्य और विवरण मेरी सर्वोत्तम जानकारी व विश्वास के अनुसार पूर्णतः सत्य एवं सही हैं। इसमें कोई भी तथ्य छिपाया नहीं गया है।\n\nसत्यापन: मैं उपरोक्त शपथकर्ता एतद्द्वारा सत्यापित करता/करती हूँ कि इस शपथ पत्र की समस्त सामग्री सत्य है और यदि इसमें कोई असत्यता पाई जाती है तो मैं भारतीय विधि के तहत दंडात्मक कार्यवाही का उत्तरदायी रहूँगा/रहूँगी।`;
        synthesizedBodyEn = `I, ${applicant}, residing at ${address || '[Address]'}, do hereby solemnly affirm and state on oath as follows:\n\n1. That I am a citizen of India residing at the aforementioned address and am submitting this official affidavit for the purpose of ${promptToUse}.\n2. That all representations and factual submissions furnished in respect of ${specificPurpose} are true, complete, and correct to the best of my personal knowledge and belief, and nothing material has been concealed therefrom.\n\nVERIFICATION: Verified that the contents of this affidavit are true to my personal knowledge and no part of it is false.`;
      } else {
        // Natural first-person, NO "on behalf of", NO unverified claims ("statutory credentials", "duly compiled") (Requirement 4)
        synthesizedBodyHi = `सविनय निवेदन है कि मैं, ${applicant}, निवासी ${address || '[पता]'}, आपके समक्ष ${promptToUse} के संबंध में यह औपचारिक आवेदन प्रस्तुत कर रहा/रही हूँ।\n\nविस्तृत विवरण: ${specificPurpose}। इस आवेदन के समर्थन में आवश्यक दस्तावेज़ संलग्न किए गए हैं।\n\nअतः आपसे विनम्र प्रार्थना है कि मामले का सम्यक परीक्षण कर शीघ्रातिशीघ्र आवश्यक आधिकारिक स्वीकृति एवं कार्यवाही करने की कृपा करें।`;
        synthesizedBodyEn = `I am writing to formally submit this application for your consideration regarding ${promptToUse}.\n\nBackground & Specifics: ${specificPurpose}. The following documents are enclosed with this application for your perusal.\n\nIn light of the facts stated above, I respectfully request your office to review the application and grant the necessary approval or relief at the earliest convenience. Thank you for your consideration.`;
      }

      const headerLinesEn = [
        'To,',
        recipient,
        ...(office ? [office] : []),
      ];

      const headerLinesHi = [
        'सेवा में,',
        recipient,
        ...(office ? [office] : []),
      ];

      if (isHi) {
        return {
          header: headerLinesHi.join('\n'),
          date: `दिनांक: ${dateStr}`,
          subject: subject.startsWith('विषय:') ? subject : `विषय: ${subject}`,
          salutation: `महोदय / महोदया,`,
          body: synthesizedBodyHi,
          closing: `सधन्यवाद,\nभवदीय,`,
          signature: `${applicant}${address ? `\nपता: ${address}` : ''}`,
          enclosures: ['पहचान एवं निवास प्रमाण पत्र', 'प्रासंगिक साक्ष्य एवं संलग्नक'],
        };
      } else {
        return {
          header: headerLinesEn.join('\n'),
          date: `Date: ${dateStr}`,
          subject: subject.startsWith('Subject:') ? subject : `Subject: ${subject}`,
          salutation: `Respected Sir/Madam,`,
          body: synthesizedBodyEn,
          closing: `Yours faithfully,`,
          signature: `${applicant}${address ? `\nAddress: ${address}` : ''}`,
          enclosures: ['Copy of Valid Identity & Address Proof', 'Relevant Supporting Records & Submissions'],
        };
      }
    }
  }
}
