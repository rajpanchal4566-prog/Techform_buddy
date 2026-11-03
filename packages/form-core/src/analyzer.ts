/**
 * TechForm Buddy - Semantic Field Analyzing Layer
 *
 * Implements strict, multi-stage semantic analysis of form fields against profile attributes:
 * - Solves field mismatching: Disqualifies wrong mappings via negative keywords, role isolation,
 *   type compatibility, and section context.
 * - Enforces Hard Rule 4: Sensitive fields (Aadhaar, PAN, Passport, Card, Bank) are NEVER autofilled;
 *   flagged as manual: true with "Please type this yourself".
 * - Enforces Hard Rule 6: If confidence < 0.80 or field is ambiguous, leaves it blank and never guesses.
 * - Supports English and Indic multilingual synonyms (Hindi, etc.).
 */

import { FormFieldSchema, FieldAnalysisResult, FormAnalysisSummary, FieldInputType, DocumentType } from './types';

export interface SemanticRule {
  category: string;
  candidateProfileKeys: string[];
  allowedInputTypes: FieldInputType[];
  positivePatterns: RegExp[];
  negativePatterns: RegExp[];
  sectionPositive?: RegExp[];
  sectionNegative?: RegExp[];
  explanationEn: string;
  whatToEnterEn: string;
}

export const SEMANTIC_TAXONOMY: SemanticRule[] = [
  // 1. Applicant First Name
  {
    category: 'APPLICANT_FIRST_NAME',
    candidateProfileKeys: ['first_name', 'firstName'],
    allowedInputTypes: ['text'],
    positivePatterns: [
      /\bfirst[\s_-]?name\b/i,
      /\bgiven[\s_-]?name\b/i,
      /\bforename\b/i,
      /\bप्रथम[\s_-]?नाम\b/i,
    ],
    negativePatterns: [
      /\b(last|middle|father|mother|parent|spouse|guardian|nominee|witness|bank|branch|college|school|company|hospital|doctor|user|login)\b/i,
    ],
    explanationEn: "Applicant's official first name as shown on government ID.",
    whatToEnterEn: 'Enter your legal first name only.',
  },

  // 2. Applicant Last Name
  {
    category: 'APPLICANT_LAST_NAME',
    candidateProfileKeys: ['last_name', 'lastName', 'surname'],
    allowedInputTypes: ['text'],
    positivePatterns: [
      /\blast[\s_-]?name\b/i,
      /\bsurname\b/i,
      /\bfamily[\s_-]?name\b/i,
      /\bउपनाम\b/i,
    ],
    negativePatterns: [
      /\b(first|middle|father|mother|parent|spouse|guardian|nominee|witness|bank|branch|college|school|company|hospital|doctor|user|login)\b/i,
    ],
    explanationEn: "Applicant's surname or family name.",
    whatToEnterEn: 'Enter your legal surname / last name.',
  },

  // 3. Applicant Full Name (Strict: must NOT be father/mother/organization/school/bank/username)
  {
    category: 'APPLICANT_FULL_NAME',
    candidateProfileKeys: ['full_name', 'fullName', 'name'],
    allowedInputTypes: ['text'],
    positivePatterns: [
      /\bfull[\s_-]?name\b/i,
      /\bapplicant[\s_-]?name\b/i,
      /\bcandidate[\s_-]?name\b/i,
      /\bstudent[\s_-]?name\b/i,
      /\bname\s+of\s+(the\s+)?applicant\b/i,
      /\bname\s+of\s+(the\s+)?candidate\b/i,
      /\bनाम\b/i,
      /\bपूरा[\s_-]?नाम\b/i,
      /^name$/i,
    ],
    negativePatterns: [
      /\b(first|last|middle|father|mother|parent|spouse|husband|wife|guardian|nominee|witness|employer|company|firm|org|organization|bank|branch|college|school|university|institute|hospital|doctor|ref|reference|user|username|login|scheme|service|project|file|document)\b/i,
    ],
    sectionNegative: [
      /\b(father|mother|parent|guardian|spouse|nominee|witness|bank|employer|office)\b/i,
    ],
    explanationEn: "Applicant's complete legal name as registered in profile.",
    whatToEnterEn: 'Enter your full legal name as per government records.',
  },

  // 4. Father's Name (Strict role isolation)
  {
    category: 'FATHER_NAME',
    candidateProfileKeys: ['father_name', 'fatherName'],
    allowedInputTypes: ['text'],
    positivePatterns: [
      /\bfather('?s)?[\s_-]?name\b/i,
      /\bपिता[\s_-]?का[\s_-]?नाम\b/i,
      /\bपिता\b/i,
    ],
    negativePatterns: [
      /\b(mother|spouse|guardian|applicant|wife|husband|nominee)\b/i,
    ],
    explanationEn: "Father's official legal name.",
    whatToEnterEn: "Enter your father's full name.",
  },

  // 5. Mother's Name (Strict role isolation)
  {
    category: 'MOTHER_NAME',
    candidateProfileKeys: ['mother_name', 'motherName'],
    allowedInputTypes: ['text'],
    positivePatterns: [
      /\bmother('?s)?[\s_-]?name\b/i,
      /\bमाता[\s_-]?का[\s_-]?नाम\b/i,
      /\bमाता\b/i,
    ],
    negativePatterns: [
      /\b(father|spouse|guardian|applicant|wife|husband|nominee)\b/i,
    ],
    explanationEn: "Mother's official legal name.",
    whatToEnterEn: "Enter your mother's full name.",
  },

  // 6. Spouse Name
  {
    category: 'SPOUSE_NAME',
    candidateProfileKeys: ['spouse_name', 'spouseName', 'husband_name', 'wife_name'],
    allowedInputTypes: ['text'],
    positivePatterns: [
      /\bspouse('?s)?[\s_-]?name\b/i,
      /\bhusband('?s)?[\s_-]?name\b/i,
      /\bwife('?s)?[\s_-]?name\b/i,
      /\bपति\/?पत्नी\b/i,
    ],
    negativePatterns: [
      /\b(father|mother|applicant)\b/i,
    ],
    explanationEn: "Spouse's legal name.",
    whatToEnterEn: "Enter your spouse's name if married.",
  },

  // 7. Email Address (Must NOT be physical address, web URL, or phone)
  {
    category: 'EMAIL_ADDRESS',
    candidateProfileKeys: ['email', 'email_address', 'emailAddress'],
    allowedInputTypes: ['email', 'text'],
    positivePatterns: [
      /\be[\s_-]?mail(\s+id|\s+address)?\b/i,
      /\bईमेल\b/i,
    ],
    negativePatterns: [
      /\b(phone|mobile|fax|street|residential|permanent|postal|pin|office|employer|father|mother)\b/i,
    ],
    explanationEn: 'Primary contact email address for alerts and notifications.',
    whatToEnterEn: 'Enter your active email address (e.g. name@example.com).',
  },

  // 8. Mobile / Phone Number (Must NOT be fax, landline, emergency contact, or parent's phone)
  {
    category: 'PRIMARY_MOBILE',
    candidateProfileKeys: ['phone', 'mobile', 'phone_number', 'mobile_number', 'phoneNumber', 'mobileNumber'],
    allowedInputTypes: ['tel', 'text', 'number'],
    positivePatterns: [
      /\bmobile(\s+no|\s+num|\s+number)?\b/i,
      /\bphone(\s+no|\s+num|\s+number)?\b/i,
      /\bcontact[\s_-]?number\b/i,
      /\bcell[\s_-]?phone\b/i,
      /\bमोबाइल(\s+नंबर)?\b/i,
      /\bदूरभाष\b/i,
    ],
    negativePatterns: [
      /\b(fax|emergency|alternate|alt|secondary|father|mother|guardian|office|work|landline|pincode)\b/i,
    ],
    explanationEn: 'Primary 10-digit mobile number for communication.',
    whatToEnterEn: 'Enter your 10-digit mobile phone number.',
  },

  // 9. Date of Birth (Must NOT be issue date, expiry date, registration date, or admission date)
  {
    category: 'DATE_OF_BIRTH',
    candidateProfileKeys: ['date_of_birth', 'dob', 'birth_date', 'dateOfBirth'],
    allowedInputTypes: ['date', 'text'],
    positivePatterns: [
      /\bdate\s+of\s+birth\b/i,
      /\bbirth[\s_-]?date\b/i,
      /\bd\.?o\.?b\.?\b/i,
      /\bजन्म[\s_-]?तिथि\b/i,
      /\bजन्म[\s_-]?तारीख\b/i,
    ],
    negativePatterns: [
      /\b(issue|expiry|expire|validity|valid|registration|admission|joining|leaving|event|today|transaction|receipt|dispatch|order|invoice)\b/i,
    ],
    explanationEn: 'Official date of birth according to birth certificate or matriculation marksheet.',
    whatToEnterEn: 'Enter your date of birth (DD/MM/YYYY).',
  },

  // 10. Gender
  {
    category: 'GENDER',
    candidateProfileKeys: ['gender', 'sex'],
    allowedInputTypes: ['select', 'radio', 'text'],
    positivePatterns: [
      /\bgender\b/i,
      /\bsex\b/i,
      /\bलिंग\b/i,
    ],
    negativePatterns: [],
    explanationEn: 'Gender identity (Male / Female / Transgender / Other).',
    whatToEnterEn: 'Select or specify your gender.',
  },

  // 11. Blood Group
  {
    category: 'BLOOD_GROUP',
    candidateProfileKeys: ['blood_group', 'bloodGroup'],
    allowedInputTypes: ['select', 'text'],
    positivePatterns: [
      /\bblood[\s_-]?group\b/i,
      /\bblood[\s_-]?type\b/i,
      /\bरक्त[\s_-]?समूह\b/i,
    ],
    negativePatterns: [],
    explanationEn: 'Medical blood group classification (e.g. O+, A+, B+).',
    whatToEnterEn: 'Select your blood group.',
  },

  // 12. Marital Status
  {
    category: 'MARITAL_STATUS',
    candidateProfileKeys: ['marital_status', 'maritalStatus'],
    allowedInputTypes: ['select', 'radio', 'text'],
    positivePatterns: [
      /\bmarital[\s_-]?status\b/i,
      /\bवैवाहिक[\s_-]?स्थिति\b/i,
    ],
    negativePatterns: [],
    explanationEn: 'Marital status (Single, Married, Divorced, Widowed).',
    whatToEnterEn: 'Select your marital status.',
  },

  // 13. Occupation / Profession
  {
    category: 'OCCUPATION',
    candidateProfileKeys: ['occupation', 'profession', 'job'],
    allowedInputTypes: ['text', 'select'],
    positivePatterns: [
      /\boccupation\b/i,
      /\bprofession\b/i,
      /\bव्यवसाय\b/i,
      /\bपेशा\b/i,
    ],
    negativePatterns: [
      /\b(father|mother|spouse)\b/i,
    ],
    explanationEn: 'Current employment or professional occupation.',
    whatToEnterEn: 'Enter your current occupation / profession.',
  },

  // 14. Full Residential Address (Must NOT be email address, office address, or permanent if looking for present)
  {
    category: 'FULL_ADDRESS',
    candidateProfileKeys: ['address', 'residential_address', 'full_address'],
    allowedInputTypes: ['textarea', 'text'],
    positivePatterns: [
      /\bresidential[\s_-]?address\b/i,
      /\bpresent[\s_-]?address\b/i,
      /\bcurrent[\s_-]?address\b/i,
      /\bcommunication[\s_-]?address\b/i,
      /\bcorrespondence[\s_-]?address\b/i,
      /\bfull[\s_-]?address\b/i,
      /\baddress[\s_-]?line\b/i,
      /\bपता\b/i,
      /\bवर्तमान[\s_-]?पता\b/i,
      /\bनिवास[\s_-]?का[\s_-]?पता\b/i,
      /^address$/i,
    ],
    negativePatterns: [
      /\b(email|web|ip|mac|url|office|work|employer|permanent|native|hospital|school|college|branch|bank)\b/i,
    ],
    sectionNegative: [
      /\b(office|employer|permanent|bank)\b/i,
    ],
    explanationEn: 'Full residential street address with house number and locality.',
    whatToEnterEn: 'Enter your complete postal / residential address.',
  },

  // 15. City / District
  {
    category: 'CITY',
    candidateProfileKeys: ['city', 'district'],
    allowedInputTypes: ['text', 'select'],
    positivePatterns: [
      /\bcity\b/i,
      /\btown\b/i,
      /\bdistrict\b/i,
      /\bशहर\b/i,
      /\bजिला\b/i,
    ],
    negativePatterns: [
      /\b(state|country|pincode|zip|address|street)\b/i,
    ],
    explanationEn: 'City, town or administrative district name.',
    whatToEnterEn: 'Enter your city or district name.',
  },

  // 16. State / Union Territory
  {
    category: 'STATE',
    candidateProfileKeys: ['state', 'province', 'ut'],
    allowedInputTypes: ['select', 'text'],
    positivePatterns: [
      /\bstate\b/i,
      /\bunion[\s_-]?territory\b/i,
      /\bprovince\b/i,
      /\bराज्य\b/i,
    ],
    negativePatterns: [
      /\b(statement|status|static|estate|city|country|pincode|zip)\b/i,
    ],
    explanationEn: 'State or Union Territory of residence.',
    whatToEnterEn: 'Select or type your State / UT.',
  },

  // 17. Pincode / Postal Code / Zip
  {
    category: 'PINCODE',
    candidateProfileKeys: ['pincode', 'postal_code', 'zip', 'pinCode', 'postalCode'],
    allowedInputTypes: ['text', 'number'],
    positivePatterns: [
      /\bpin[\s_-]?code\b/i,
      /\bpostal[\s_-]?code\b/i,
      /\bzip[\s_-]?code\b/i,
      /\bपिनकोड\b/i,
      /\bडाक[\s_-]?कोड\b/i,
    ],
    negativePatterns: [
      /\b(state|city|country|phone|mobile)\b/i,
    ],
    explanationEn: '6-digit postal index number (PIN code).',
    whatToEnterEn: 'Enter your 6-digit postal PIN code.',
  },

  // 18. Country / Nationality
  {
    category: 'COUNTRY',
    candidateProfileKeys: ['country', 'nationality'],
    allowedInputTypes: ['select', 'text'],
    positivePatterns: [
      /\bcountry\b/i,
      /\bnationality\b/i,
      /\bदेश\b/i,
      /\bराष्ट्रीयता\b/i,
    ],
    negativePatterns: [
      /\b(state|city|district|county|pincode)\b/i,
    ],
    explanationEn: 'Country of residence or legal citizenship.',
    whatToEnterEn: 'Select or enter your country (e.g. India).',
  },

  // 19. College / University / Institute
  {
    category: 'COLLEGE_UNIVERSITY',
    candidateProfileKeys: ['college', 'university', 'institution', 'college_name', 'university_name'],
    allowedInputTypes: ['text', 'select'],
    positivePatterns: [
      /\bcollege(\s+name)?\b/i,
      /\buniversity(\s+name)?\b/i,
      /\binstitute(\s+name)?\b/i,
      /\binstitution\b/i,
      /\bमहाविद्यालय\b/i,
      /\bविश्वविद्यालय\b/i,
      /\bसंस्थान\b/i,
    ],
    negativePatterns: [
      /\b(roll|enrollment|cgpa|percentage|marks|passing|degree|course|branch|mobile|phone|email)\b/i,
    ],
    explanationEn: "College, University or Educational Institution name.",
    whatToEnterEn: "Enter your college or university name.",
  },

  // 20. Course / Degree / Academic Program
  {
    category: 'COURSE_DEGREE',
    candidateProfileKeys: ['course', 'degree', 'qualification', 'program'],
    allowedInputTypes: ['text', 'select'],
    positivePatterns: [
      /\bcourse(\s+name)?\b/i,
      /\bdegree(\s+name)?\b/i,
      /\bprogram(me)?(\s+name)?\b/i,
      /\bqualification\b/i,
      /\bपाठ्यक्रम\b/i,
      /\bडिग्री\b/i,
    ],
    negativePatterns: [
      /\b(roll|enrollment|cgpa|percentage|marks|passing|college|university|school)\b/i,
    ],
    explanationEn: "Academic degree or course of study (e.g., B.Tech, B.Sc, MBA).",
    whatToEnterEn: "Select or enter your enrolled course or degree.",
  },

  // 21. Branch / Specialization / Stream
  {
    category: 'BRANCH_SPECIALIZATION',
    candidateProfileKeys: ['branch', 'specialization', 'stream', 'discipline'],
    allowedInputTypes: ['text', 'select'],
    positivePatterns: [
      /\bbranch\b/i,
      /\bspecialization\b/i,
      /\bstream\b/i,
      /\bdiscipline\b/i,
      /\bशाखा\b/i,
    ],
    negativePatterns: [
      /\b(bank|office|city|address|college|university)\b/i,
    ],
    explanationEn: "Academic branch, stream or specialization.",
    whatToEnterEn: "Enter your branch or specialization (e.g. Computer Science, Mechanical).",
  },

  // 22. Roll Number / Hall Ticket Number
  {
    category: 'ROLL_NUMBER',
    candidateProfileKeys: ['roll_number', 'rollNo', 'roll_no'],
    allowedInputTypes: ['text', 'number'],
    positivePatterns: [
      /\broll[\s_-]?no(\.|\b)/i,
      /\broll[\s_-]?number\b/i,
      /\bhall[\s_-]?ticket\b/i,
      /\bअनुक्रमांक\b/i,
      /\bरोल[\s_-]?नंबर\b/i,
    ],
    negativePatterns: [
      /\b(enrollment|registration|mobile|phone|pincode)\b/i,
    ],
    explanationEn: "Official examination or class roll number.",
    whatToEnterEn: "Enter your institutional or exam roll number.",
  },

  // 23. Enrollment Number / Registration Number
  {
    category: 'ENROLLMENT_NUMBER',
    candidateProfileKeys: ['enrollment_number', 'enrollment_no', 'enrolment_no', 'registration_number', 'reg_no'],
    allowedInputTypes: ['text'],
    positivePatterns: [
      /\benroll?ment(\s+no|\s+num|\s+number)?\b/i,
      /\bregistration(\s+no|\s+num|\s+number)?\b/i,
      /\breg[\s_-]?no(\.|\b)/i,
      /\bनामांकन[\s_-]?संख्या\b/i,
      /\bपंजीकरण[\s_-]?संख्या\b/i,
    ],
    negativePatterns: [
      /\b(roll|mobile|phone|vehicle|aadhaar|pan)\b/i,
    ],
    explanationEn: "University enrollment or registration number.",
    whatToEnterEn: "Enter your university enrollment or registration ID.",
  },

  // 24. Academic Year / Semester
  {
    category: 'ACADEMIC_YEAR_SEMESTER',
    candidateProfileKeys: ['semester', 'year', 'academic_year'],
    allowedInputTypes: ['select', 'text', 'number'],
    positivePatterns: [
      /\bsemester\b/i,
      /\bacademic[\s_-]?year\b/i,
      /\bcurrent[\s_-]?year\b/i,
      /\byear[\s_-]?of[\s_-]?study\b/i,
      /\bसत्र\b/i,
      /\bसेमेस्टर\b/i,
    ],
    negativePatterns: [
      /\b(passing|birth|dob|issue|expiry)\b/i,
    ],
    explanationEn: "Current academic year or semester of study.",
    whatToEnterEn: "Select or enter your current semester or year.",
  },

  // 25. CGPA / Percentage / Academic Score
  {
    category: 'ACADEMIC_CGPA_PERCENTAGE',
    candidateProfileKeys: ['cgpa', 'percentage', 'marks'],
    allowedInputTypes: ['text', 'number'],
    positivePatterns: [
      /\bcgpa\b/i,
      /\bpercentage\b/i,
      /\bpercent\b/i,
      /\bmarks\s*%\b/i,
      /\bप्रतिशत\b/i,
    ],
    negativePatterns: [
      /\b(roll|enrollment|year|semester)\b/i,
    ],
    explanationEn: "Academic performance score, CGPA or percentage.",
    whatToEnterEn: "Enter your CGPA or percentage score.",
  },

  // 26. Social / Reservation Category
  {
    category: 'SOCIAL_CATEGORY',
    candidateProfileKeys: ['category', 'caste_category', 'social_category'],
    allowedInputTypes: ['select', 'radio', 'text'],
    positivePatterns: [
      /\bsocial[\s_-]?category\b/i,
      /\bcaste[\s_-]?category\b/i,
      /\breservation[\s_-]?category\b/i,
      /\bcategory\b/i,
      /\bवर्ग\b/i,
      /\bश्रेणी\b/i,
    ],
    negativePatterns: [
      /\b(post|job|service|document|file|scheme)\b/i,
    ],
    explanationEn: "Reservation / social category (General, OBC, SC, ST, EWS).",
    whatToEnterEn: "Select or enter your category (e.g. General, OBC, SC, ST, EWS).",
  },
];

/**
 * Detects the document type requested by a file upload field.
 */
export function detectDocumentType(label: string, id: string = '', name: string = '', accept: string = ''): DocumentType {
  const text = `${label} ${id} ${name} ${accept}`.toLowerCase();
  if (/aadhaar|aadhar|uidai/i.test(text)) return 'aadhaar';
  if (/\bpan\b|permanent[\s_-]?account/i.test(text)) return 'pan';
  if (/photo|passport[\s_-]?size|photograph|image|pic|चित्र|तस्वीर/i.test(text) && !/signature|sign/i.test(text)) return 'photo';
  if (/sign|signature|हस्ताक्षर|दस्तखत/i.test(text)) return 'signature';
  if (/mark[\s_-]?sheet|grade[\s_-]?card|transcript|अंकतालिका/i.test(text)) return 'marksheet';
  if (/certificate|degree|diploma|प्रमाण[\s_-]?पत्र/i.test(text)) return 'certificate';
  if (/resume|cv|biodata|bio[\s_-]?data/i.test(text)) return 'resume';
  return 'other';
}

/**
 * Hard Rule 4 & 3: Sensitive identification/financial field patterns.
 * Under NO circumstances are these filled from stored data.
 */
const SENSITIVE_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Aadhaar', pattern: /\b(aadhaar|aadhar|uidai|uid)\b|आधार/i },
  { name: 'PAN', pattern: /\b(pan(?!\s*[-–]\s*[a-z])|permanent\s+account\s+number)\b|पैन/i },
  { name: 'Passport', pattern: /\bpassport\b|पासपोर्ट/i },
  { name: 'Bank Account', pattern: /\b(bank\s+acc(ount)?|acc(ount)?\s*no(umber)?|ifsc|micr|iban)\b|खाता|बैंक/i },
  { name: 'Payment Card', pattern: /\b(card\s*no(umber)?|credit\s*card|debit\s*card|cvv|cvc|cvv2|cid)\b/i },
  { name: 'Voter ID (EPIC)', pattern: /\b(epic|epic\s*no(umber)?|voter\s*id)\b|मतदाता/i },
  { name: 'Credential / Secret', pattern: /\b(password|pin|secret|otp|mpin|captcha)\b/i },
];

/**
 * Checks if a field asks for sensitive financial or ID credentials.
 */
export function detectSensitiveField(field: FormFieldSchema): { isSensitive: boolean; kind?: string } {
  // File uploads are document attachments, not sensitive text credential fields
  if (field.type === 'file') {
    return { isSensitive: false };
  }

  const combined = `${field.label} ${field.id} ${field.selector} ${field.section}`.toLowerCase();

  for (const s of SENSITIVE_PATTERNS) {
    if (s.pattern.test(combined)) {
      return { isSensitive: true, kind: s.name };
    }
  }

  return { isSensitive: false };
}

/**
 * Core Analyzer: Evaluates a single FormFieldSchema against available profile keys.
 * Calculates confidence score and enforces all negative constraints and safety rules.
 */
export function analyzeField(
  field: FormFieldSchema,
  availableProfileKeys: string[]
): FieldAnalysisResult {
  // 1. Hard Rule 4: Intercept Sensitive Credential Fields (excluding file inputs)
  const sensitiveCheck = detectSensitiveField(field);
  if (field.type !== 'file' && (sensitiveCheck.isSensitive || field.sensitive)) {
    return {
      fieldId: field.id,
      selector: field.selector,
      label: field.label,
      type: field.type,
      profileKey: null,
      confidence: 1.0,
      canFill: false,
      manual: true,
      sensitive: true,
      explanation: `This is a sensitive ${sensitiveCheck.kind || 'identity/financial'} field.`,
      whatToEnter: 'Please type this yourself on the official website. For your security, TechForm Buddy never stores or autofills ID/card/bank numbers.',
      reason: 'Sensitive field (Hard Rule 4 enforced)',
    };
  }

  // 2. File inputs: match against Document Vault types
  if (field.type === 'file') {
    const docType = detectDocumentType(field.label, field.id, '', field.accept || '');
    const docKey = `doc_${docType}`;

    return {
      fieldId: field.id,
      selector: field.selector,
      label: field.label,
      type: 'file',
      profileKey: docKey,
      confidence: 0.95,
      canFill: true,
      manual: false,
      sensitive: false,
      explanation: `Document upload slot matched with ${docType.toUpperCase()} in Document Vault.`,
      whatToEnter: `Attaches ${docType.toUpperCase()} document from your saved Document Vault.`,
      reason: 'Document vault match',
    };
  }

  // 3. Non-file manual fields (e.g. captchas, custom manual inputs)
  if (field.manual) {
    return {
      fieldId: field.id,
      selector: field.selector,
      label: field.label,
      type: field.type,
      profileKey: null,
      confidence: 1.0,
      canFill: false,
      manual: true,
      sensitive: false,
      explanation: 'Manual action required for this field.',
      whatToEnter: 'Please complete this field manually.',
      reason: 'Manual field',
    };
  }

  // 3. Search for best matching semantic rule
  const textCorpus = `${field.label} ${field.id}`.toLowerCase();
  const sectionText = (field.section || '').toLowerCase();

  let bestRule: SemanticRule | null = null;
  let bestScore = 0.0;
  let matchedProfileKey: string | null = null;

  for (const rule of SEMANTIC_TAXONOMY) {
    // Check input type compatibility
    if (!rule.allowedInputTypes.includes(field.type)) {
      continue;
    }

    // Check negative patterns (disqualifiers)
    const hasDisqualifier = rule.negativePatterns.some(pat => pat.test(textCorpus));
    if (hasDisqualifier) {
      continue;
    }

    // Check section negative patterns
    if (rule.sectionNegative && rule.sectionNegative.some(pat => pat.test(sectionText))) {
      continue;
    }

    // Calculate match score
    let score = 0.0;
    const positiveMatched = rule.positivePatterns.some(pat => pat.test(textCorpus));
    if (positiveMatched) {
      score += 0.85;

      // Section bonus if section reinforces rule
      if (rule.sectionPositive && rule.sectionPositive.some(pat => pat.test(sectionText))) {
        score += 0.10;
      }

      // Exact label equality bonus
      if (rule.positivePatterns.some(pat => pat.source.startsWith('^') && pat.test(field.label))) {
        score += 0.10;
      }
    }

    if (score > bestScore) {
      // Find candidate profile key in available user profile keys
      const candidateKey = rule.candidateProfileKeys.find(k => availableProfileKeys.includes(k));
      if (candidateKey) {
        bestScore = Math.min(1.0, score);
        bestRule = rule;
        matchedProfileKey = candidateKey;
      }
    }
  }

  // 4. Hard Rule 6: Confidence thresholding (never guess)
  const CONFIDENCE_THRESHOLD = 0.80;

  if (bestRule && matchedProfileKey && bestScore >= CONFIDENCE_THRESHOLD) {
    return {
      fieldId: field.id,
      selector: field.selector,
      label: field.label,
      type: field.type,
      profileKey: matchedProfileKey,
      confidence: Number(bestScore.toFixed(2)),
      canFill: true,
      manual: false,
      sensitive: false,
      explanation: bestRule.explanationEn,
      whatToEnter: bestRule.whatToEnterEn,
    };
  }

  // Unmatched / Ambiguous field
  return {
    fieldId: field.id,
    selector: field.selector,
    label: field.label,
    type: field.type,
    profileKey: null,
    confidence: Number(bestScore.toFixed(2)),
    canFill: false,
    manual: true,
    sensitive: false,
    explanation: `Field "${field.label}" does not have a reliable, high-confidence match in your profile.`,
    whatToEnter: 'Please enter this value manually if required.',
    reason: 'Confidence below threshold (< 0.80) or ambiguous field (Hard Rule 6: never guess)',
  };
}

/**
 * Analyzes an entire FormSchema against the user's available profile keys.
 * Produces a complete audit summary ready for client autofill or overlay display.
 */
export function analyzeForm(
  fields: FormFieldSchema[],
  availableProfileKeys: string[]
): FormAnalysisSummary {
  const analysisResults: FieldAnalysisResult[] = [];

  let matchedCount = 0;
  let unmatchedCount = 0;
  let manualCount = 0;
  let sensitiveCount = 0;

  for (const field of fields) {
    const res = analyzeField(field, availableProfileKeys);
    analysisResults.push(res);

    if (res.sensitive) {
      sensitiveCount++;
      manualCount++;
    } else if (res.canFill) {
      matchedCount++;
    } else if (res.manual) {
      manualCount++;
    } else {
      unmatchedCount++;
    }
  }

  return {
    fields: analysisResults,
    matchedCount,
    unmatchedCount,
    manualCount,
    sensitiveCount,
  };
}

/**
 * Creates a safe mapping Record<fieldId, profileKey> containing ONLY fields
 * that passed the confidence threshold and semantic validation.
 */
export function generateSafeMapping(
  fields: FormFieldSchema[],
  availableProfileKeys: string[]
): Record<string, string> {
  const summary = analyzeForm(fields, availableProfileKeys);
  const mapping: Record<string, string> = {};

  for (const res of summary.fields) {
    if (res.canFill && res.profileKey && res.confidence >= 0.80 && !res.sensitive && !res.manual) {
      mapping[res.fieldId] = res.profileKey;
    }
  }

  return mapping;
}
