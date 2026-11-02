import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export interface GeneratedFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  section?: string;
}

export interface GeneratedFormResponse {
  title: string;
  category: string;
  formType: 'letter' | 'form';
  description: string;
  language: string;
  fields: GeneratedFormField[];
  documentContent?: {
    header: string;
    date: string;
    subject: string;
    salutation: string;
    body: string;
    closing: string;
    signature: string;
    enclosures?: string[];
  };
}

// Call Gemini to generate a tailored, dynamic form schema & document structure
async function callLlmForFormFormat(
  prompt: string,
  language: string
): Promise<GeneratedFormResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  if (!apiKey) return null;

  const isHi = language === 'hi';
  const systemPrompt = `You are an expert official form & administrative legal document architect for India.
Given a user requirement, generate a comprehensive, highly realistic and tailored form schema and complete document structure.
TARGET LANGUAGE: ${isHi ? 'Hindi (हिंदी)' : 'English'}
USER REQUIREMENT: "${prompt}"

Generate a custom-tailored form structure and formal document specifically designed for this exact requirement.
Do NOT give generic dummy fields. Give 8 to 15 REAL, SPECIFIC, NECESSARY FIELDS tailored to this exact purpose.
For example:
- If rental agreement: Landlord Full Name, Tenant Full Name, Property Complete Address, Monthly Rent Amount (INR), Security Deposit (INR), Agreement Start Date, Tenancy Period (Months), Notice Period (Days), Electricity Meter Number, Witness 1 Full Name, Witness 2 Full Name, etc.
- If electricity meter transfer: Current Consumer Number, Meter Serial Number, Existing Registered Owner Name, New Owner Name, Reason for Transfer, Property Ownership Proof / Sale Deed Number, Latest Bill Payment Receipt Number, Mobile Number, Sub-Division Office, etc.
- If affidavit: Deponent Full Name, Father's/Spouse's Name, Age, Permanent Residential Address, Aadhaar Number, Sworn Statement / Affirmation Details, Purpose of Affidavit, Place of Execution, Date of Affirmation, Notary / Oath Commissioner Details, etc.
- If admission/scholarship/job/leave: Tailor fields specifically to that context.

You MUST return ONLY a valid JSON object matching EXACTLY this structure:
{
  "title": "Clear, official title for this document/form",
  "category": "one of: government, education, healthcare, banking, business, general",
  "formType": "letter or form",
  "description": "Specific 1-2 sentence description explaining the purpose of this form",
  "fields": [
    {
      "id": "f_1",
      "label": "Specific field label",
      "type": "text", // one of: text, date, number, textarea, select, tel, email
      "required": true,
      "placeholder": "Sample realistic placeholder",
      "options": ["Option 1", "Option 2"],
      "section": "parties or property or personal or identity or terms or letter or general"
    }
  ],
  "documentContent": {
    "header": "To / Recipient or Parties block with address",
    "date": "Formatted date string (e.g. 29 October 2026 or 29 अक्टूबर 2026)",
    "subject": "Formal subject line or agreement title",
    "salutation": "Formal salutation or opening recital",
    "body": "Comprehensive multi-paragraph formal/legal text for this document (minimum 2 full paragraphs, at least 250 characters).",
    "closing": "Formal complimentary closing",
    "signature": "Full signature block with applicant/deponent/party details",
    "enclosures": ["Required document 1", "Required document 2"]
  }
}`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[FormGen LLM] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    if (!parsed.title || !Array.isArray(parsed.fields) || parsed.fields.length === 0) {
      return null;
    }

    const seenIds = new Set<string>();
    const fields: GeneratedFormField[] = parsed.fields.map((f: any, idx: number) => {
      let fId = f.id ? String(f.id).trim() : '';
      if (!fId || seenIds.has(fId)) {
        fId = `f_${idx + 1}_${Date.now()}`;
      }
      seenIds.add(fId);
      return {
        id: fId,
        label: String(f.label || `Field ${idx + 1}`),
        type: String(f.type || 'text'),
        required: f.required !== false,
        placeholder: f.placeholder ? String(f.placeholder) : '',
        options: Array.isArray(f.options) ? f.options.map(String) : undefined,
        section: f.section ? String(f.section) : 'general',
      };
    });

    return {
      title: String(parsed.title),
      category: ['government', 'education', 'healthcare', 'banking', 'business', 'general'].includes(parsed.category)
        ? parsed.category
        : 'general',
      formType: parsed.formType === 'letter' ? 'letter' : 'form',
      description: String(parsed.description || `Custom tailored format for ${parsed.title}`),
      language,
      fields,
      documentContent: parsed.documentContent
        ? {
            header: String(parsed.documentContent.header || '').trim(),
            date: String(parsed.documentContent.date || '').trim(),
            subject: String(parsed.documentContent.subject || '').trim(),
            salutation: String(parsed.documentContent.salutation || '').trim(),
            body: String(parsed.documentContent.body || '').trim(),
            closing: String(parsed.documentContent.closing || '').trim(),
            signature: String(parsed.documentContent.signature || '').trim(),
            enclosures: Array.isArray(parsed.documentContent.enclosures)
              ? parsed.documentContent.enclosures.map(String)
              : undefined,
          }
        : undefined,
    };
  } catch (err) {
    console.error('[FormGen LLM] Error calling Gemini:', err);
    return null;
  }
}

// Translate text using Google Translate public endpoint
async function translateText(text: string, toLang: string, fromLang = 'auto'): Promise<string> {
  if (!text || toLang === 'en' || fromLang === toLang) return text;
  try {
    const encoded = encodeURIComponent(text.trim());
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encoded}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return text;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map((item: any) => (item && item[0] ? item[0] : '')).join('');
      return translated.trim() || text;
    }
  } catch {
    // fallback
  }
  return text;
}

// Translate non-English prompt to English for accurate intent matching
async function detectAndTranslateToEnglish(text: string, currentLang: string): Promise<string> {
  if (currentLang === 'en') return text;
  return translateText(text, 'en', currentLang);
}

export async function POST(request: NextRequest) {
  try {
    // Allow template generation for both authenticated sessions and template requests
    await getServerSession(authOptions).catch(() => null);

    const body = await request.json();
    const { prompt = '', language = 'en' } = body;

    const trimmedPrompt = (prompt || '').trim();
    if (!trimmedPrompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 1. First attempt: call Gemini LLM to generate a truly dynamic, tailored format
    const dynamicLlmResult = await callLlmForFormFormat(trimmedPrompt, language);
    if (dynamicLlmResult) {
      return NextResponse.json(dynamicLlmResult);
    }

    // Translate user prompt to English to identify real template intent
    const englishQuery = await detectAndTranslateToEnglish(trimmedPrompt, language);
    const qLower = englishQuery.toLowerCase();
    const origLower = trimmedPrompt.toLowerCase();

    let result: GeneratedFormResponse;

    // 1. Formal Resignation Letter
    if (
      qLower.includes('resignation') ||
      qLower.includes('resign') ||
      origLower.includes('इस्तीफा') ||
      origLower.includes('रिजाइन')
    ) {
      result = {
        title: 'Formal Resignation Letter',
        category: 'business',
        formType: 'letter',
        description: 'Professional employee resignation letter notice adhering to corporate protocols with transition plan.',
        language,
        fields: [
          { id: '1', label: 'Employee Full Name', type: 'text', required: true, placeholder: 'e.g., Rahul Sharma', section: 'sender' },
          { id: '2', label: 'Job Title / Designation', type: 'text', required: true, placeholder: 'e.g., Senior Systems Analyst', section: 'sender' },
          { id: '3', label: 'Employee ID', type: 'text', required: true, placeholder: 'e.g., EMP-40918', section: 'sender' },
          { id: '4', label: 'Department / Business Unit', type: 'text', required: true, placeholder: 'e.g., Cloud Infrastructure', section: 'sender' },
          { id: '5', label: 'Personal Email & Phone', type: 'text', required: true, placeholder: 'rahul.personal@gmail.com / +91 98765 43210', section: 'sender' },
          { id: '6', label: 'Reporting Manager / HR Head Name', type: 'text', required: true, placeholder: 'e.g., Vikram Singhania', section: 'recipient' },
          { id: '7', label: 'Company / Organization Name', type: 'text', required: true, placeholder: 'e.g., Acme Technologies Pvt. Ltd.', section: 'recipient' },
          { id: '8', label: 'Office Location / Branch', type: 'text', required: true, placeholder: 'e.g., Cyber City, Gurugram', section: 'recipient' },
          { id: '9', label: 'Date of Notice Submission', type: 'date', required: true, placeholder: '', section: 'letter' },
          { id: '10', label: 'Notice Period Duration', type: 'text', required: true, placeholder: 'e.g., 30 Days (as per employment agreement)', section: 'letter' },
          { id: '11', label: 'Requested Last Working Day', type: 'date', required: true, placeholder: '', section: 'letter' },
          { id: '12', label: 'Subject Line', type: 'text', required: true, placeholder: 'Formal Resignation — Rahul Sharma (EMP-40918)', section: 'letter' },
          { id: '13', label: 'Reason for Departure', type: 'textarea', required: false, placeholder: 'Pursuing higher studies / Personal reasons / Career transition...', section: 'letter' },
          { id: '14', label: 'Knowledge Transfer & Handover Plan', type: 'textarea', required: true, placeholder: 'Detailing active projects, documentation handover, and assisting successor...', section: 'letter' },
          { id: '15', label: 'Formal Closing & Sign-off', type: 'text', required: true, placeholder: 'Yours sincerely, Rahul Sharma', section: 'letter' },
        ],
      };
    }
    // 2. Formal Leave Application Letter (Work, School, University)
    else if (
      qLower.includes('leave') ||
      qLower.includes('sick leave') ||
      qLower.includes('casual leave') ||
      qLower.includes('vacation') ||
      qLower.includes('absence') ||
      origLower.includes('छुट्टी') ||
      origLower.includes('अवकाश')
    ) {
      result = {
        title: 'Formal Leave Application Letter',
        category: 'general',
        formType: 'letter',
        description: 'Official formal request for casual, medical, or annual leave to supervisor or institutional head.',
        language,
        fields: [
          { id: '1', label: 'Applicant Full Name', type: 'text', required: true, placeholder: 'Your complete name', section: 'sender' },
          { id: '2', label: 'Employee ID / Student Roll Number', type: 'text', required: true, placeholder: 'e.g., EMP-2034 or Roll No. 42', section: 'sender' },
          { id: '3', label: 'Department / Class / Division', type: 'text', required: true, placeholder: 'e.g., Operations / B.Tech 3rd Year', section: 'sender' },
          { id: '4', label: 'Contact Phone Number', type: 'tel', required: true, placeholder: '+91 98765 43210', section: 'sender' },
          { id: '5', label: 'Recipient Name & Designation', type: 'text', required: true, placeholder: 'e.g., The Branch Manager / The Principal / Team Lead', section: 'recipient' },
          { id: '6', label: 'Organization / Institution Name', type: 'text', required: true, placeholder: 'Company or College name', section: 'recipient' },
          { id: '7', label: 'Date of Letter', type: 'date', required: true, placeholder: '', section: 'letter' },
          { id: '8', label: 'Subject Line', type: 'text', required: true, placeholder: 'Application for Casual Leave from [Date] to [Date]', section: 'letter' },
          { id: '9', label: 'Type of Leave Requested', type: 'text', required: true, placeholder: 'Casual Leave / Medical Leave / Earned Leave', section: 'letter' },
          { id: '10', label: 'Leave Start Date', type: 'date', required: true, placeholder: '', section: 'letter' },
          { id: '11', label: 'Leave End Date', type: 'date', required: true, placeholder: '', section: 'letter' },
          { id: '12', label: 'Total Number of Days', type: 'number', required: true, placeholder: 'e.g., 3', section: 'letter' },
          { id: '13', label: 'Reason for Leave', type: 'textarea', required: true, placeholder: 'Explain specific reason for leave (medical consultation, family emergency, personal commitment)...', section: 'letter' },
          { id: '14', label: 'Work / Task Handover Details', type: 'textarea', required: false, placeholder: 'Colleague handling urgent matters during absence and contact availability...', section: 'letter' },
          { id: '15', label: 'Formal Salutation & Sign-off', type: 'text', required: true, placeholder: 'Yours respectfully / sincerely, [Your Name]', section: 'letter' },
        ],
      };
    }
    // 3. Job Application / Cover Letter
    else if (
      qLower.includes('job') ||
      qLower.includes('cover letter') ||
      qLower.includes('internship') ||
      qLower.includes('employment application') ||
      origLower.includes('नौकरी') ||
      origLower.includes('आवेदन')
    ) {
      result = {
        title: 'Job Application & Formal Cover Letter',
        category: 'business',
        formType: 'letter',
        description: 'Comprehensive job application dossier and professional cover letter statement for employment.',
        language,
        fields: [
          { id: '1', label: 'Applicant Full Name', type: 'text', required: true, placeholder: 'Your complete name', section: 'personal' },
          { id: '2', label: 'Email Address', type: 'email', required: true, placeholder: 'your.name@example.com', section: 'personal' },
          { id: '3', label: 'Mobile Number', type: 'tel', required: true, placeholder: '+91 98765 43210', section: 'personal' },
          { id: '4', label: 'Current Residential Address & City', type: 'text', required: true, placeholder: 'City, State', section: 'personal' },
          { id: '5', label: 'Position Applied For', type: 'text', required: true, placeholder: 'e.g., Lead Full Stack Engineer', section: 'application' },
          { id: '6', label: 'Target Company / Organization', type: 'text', required: true, placeholder: 'e.g., Tata Consultancy Services', section: 'application' },
          { id: '7', label: 'Hiring Manager / HR Department', type: 'text', required: true, placeholder: 'e.g., Head of Talent Acquisition', section: 'application' },
          { id: '8', label: 'Highest Educational Qualification', type: 'text', required: true, placeholder: 'e.g., B.Tech in Computer Science', section: 'qualifications' },
          { id: '9', label: 'Total Years of Relevant Experience', type: 'text', required: true, placeholder: 'e.g., 4.5 Years', section: 'qualifications' },
          { id: '10', label: 'Core Technical Skills & Certifications', type: 'textarea', required: true, placeholder: 'React, Node.js, Python, AWS Certified Cloud Practitioner...', section: 'qualifications' },
          { id: '11', label: 'Current CTC & Expected CTC (INR)', type: 'text', required: false, placeholder: 'Current: ₹8 LPA | Expected: ₹12 LPA', section: 'application' },
          { id: '12', label: 'Notice Period / Availability to Join', type: 'text', required: true, placeholder: 'e.g., Immediate / 30 Days', section: 'application' },
          { id: '13', label: 'Cover Letter / Statement of Purpose', type: 'textarea', required: true, placeholder: 'State why you are the best fit for this role and key achievements...', section: 'application' },
          { id: '14', label: 'Portfolio / LinkedIn / GitHub URL', type: 'text', required: false, placeholder: 'https://linkedin.com/in/...', section: 'application' },
        ],
      };
    }
    // 4. Banking Formal Letter (Closure, Cheque Book, ATM, Dispute)
    else if (
      qLower.includes('bank') ||
      qLower.includes('cheque') ||
      qLower.includes('account closure') ||
      qLower.includes('atm') ||
      origLower.includes('बैंक') ||
      origLower.includes('खाता')
    ) {
      result = {
        title: 'Bank Service Request & Formal Letter',
        category: 'banking',
        formType: 'letter',
        description: 'Official formal letter to bank branch manager for account closure, cheque book, or services.',
        language,
        fields: [
          { id: '1', label: 'Account Holder Full Name', type: 'text', required: true, placeholder: 'Name as registered with Bank', section: 'personal' },
          { id: '2', label: 'Bank Name & Branch Name', type: 'text', required: true, placeholder: 'e.g., State Bank of India, Main Branch', section: 'bank' },
          { id: '3', label: 'The Branch Manager Office Address', type: 'text', required: true, placeholder: 'Branch city & state', section: 'bank' },
          { id: '4', label: 'Savings / Current Account Number', type: 'text', required: true, placeholder: '11 or 16 digit Account No', section: 'bank' },
          { id: '5', label: 'IFSC Code & CIF Number', type: 'text', required: true, placeholder: 'SBIN0001234 / CIF: 89012345', section: 'bank' },
          { id: '6', label: 'Registered Mobile Number', type: 'tel', required: true, placeholder: '+91 98765 43210', section: 'personal' },
          { id: '7', label: 'Registered Email Address', type: 'email', required: true, placeholder: 'email@example.com', section: 'personal' },
          { id: '8', label: 'Date of Letter', type: 'date', required: true, placeholder: '', section: 'letter' },
          { id: '9', label: 'Subject Line', type: 'text', required: true, placeholder: 'Request for Account Closure / Issuance of 50-Leaf Cheque Book', section: 'letter' },
          { id: '10', label: 'Nature of Service Requested', type: 'text', required: true, placeholder: 'Account Closure / Cheque Book / Address Update / Stop Payment', section: 'letter' },
          { id: '11', label: 'Detailed Request / Reason', type: 'textarea', required: true, placeholder: 'Provide specific reason (relocating to another city, operating multiple accounts, etc.)...', section: 'letter' },
          { id: '12', label: 'Surrendered Items (Debit Card / Unused Cheques)', type: 'text', required: false, placeholder: 'Debit Card ending 4012 cut into pieces, 4 unused cheques enclosed', section: 'letter' },
          { id: '13', label: 'Target Account for Balance Transfer (if closing)', type: 'text', required: false, placeholder: 'A/C: 1234567890, Bank: HDFC, IFSC: HDFC0001234', section: 'letter' },
          { id: '14', label: 'Declaration & Specimen Signature', type: 'text', required: true, placeholder: 'Yours faithfully, [Account Holder Name]', section: 'letter' },
        ],
      };
    }
    // 5. RTI (Right to Information) Application Form
    else if (
      qLower.includes('rti') ||
      qLower.includes('right to information') ||
      origLower.includes('आरटीआई') ||
      origLower.includes('सूचना का अधिकार')
    ) {
      result = {
        title: 'Right to Information (RTI) Application Form',
        category: 'government',
        formType: 'form',
        description: 'Statutory citizen information request under Section 6(1) of Right to Information Act, 2005.',
        language,
        fields: [
          { id: '1', label: 'Applicant Full Name', type: 'text', required: true, placeholder: 'Full Name as per Aadhaar', section: 'personal' },
          { id: '2', label: "Father's / Spouse's Full Name", type: 'text', required: true, placeholder: 'Parent or Spouse Name', section: 'personal' },
          { id: '3', label: 'Complete Postal Address with Pincode', type: 'textarea', required: true, placeholder: 'House No., Locality, City, State - PIN', section: 'personal' },
          { id: '4', label: 'Contact Phone Number', type: 'tel', required: true, placeholder: '+91 98765 43210', section: 'personal' },
          { id: '5', label: 'Email ID', type: 'email', required: true, placeholder: 'applicant@email.com', section: 'personal' },
          { id: '6', label: 'Public Authority / Government Department', type: 'text', required: true, placeholder: 'e.g., Municipal Corporation / Ministry of Road Transport', section: 'department' },
          { id: '7', label: 'Public Information Officer (PIO) Office Location', type: 'text', required: true, placeholder: 'Office address / Room No.', section: 'department' },
          { id: '8', label: 'Subject Matter of Information Sought', type: 'text', required: true, placeholder: 'e.g., Road repair funds allocated in Ward 14 during 2023-2024', section: 'inquiry' },
          { id: '9', label: 'Specific Information / Questions Sought (Point-by-Point)', type: 'textarea', required: true, placeholder: '1. Certified copy of tender work order...\n2. Total expenditure incurred...\n3. Inspection reports by site engineer...', section: 'inquiry' },
          { id: '10', label: 'Period to which Information Pertains', type: 'text', required: true, placeholder: 'e.g., 01-April-2023 to 31-March-2024', section: 'inquiry' },
          { id: '11', label: 'Application Fee Details (₹10 Statutory Fee)', type: 'text', required: true, placeholder: 'IPO No. / Demand Draft No. / Online Payment Transaction Ref', section: 'fee' },
          { id: '12', label: 'BPL Card Number (if fee exemption claimed)', type: 'text', required: false, placeholder: 'Leave blank if not Below Poverty Line', section: 'fee' },
        ],
      };
    }
    // 6. Driving Licence / Sarathi Parivahan Application
    else if (
      qLower.includes('driving') ||
      qLower.includes('license') ||
      qLower.includes('licence') ||
      qLower.includes('sarathi') ||
      qLower.includes('parivahan') ||
      qLower.includes('dl') ||
      origLower.includes('ड्राइविंग') ||
      origLower.includes('सारथी')
    ) {
      result = {
        title: 'Driving Licence & Learner Application (Parivahan Sarathi)',
        category: 'government',
        formType: 'form',
        description: 'Official Ministry of Road Transport & Highways driving licence issuance application.',
        language,
        fields: [
          { id: '1', label: 'Applicant Full Name', type: 'text', required: true, placeholder: 'Full Name as in 10th marksheet/Aadhaar', section: 'personal' },
          { id: '2', label: "Father's / Guardian's Full Name", type: 'text', required: true, placeholder: 'Father / Guardian full name', section: 'personal' },
          { id: '3', label: 'Date of Birth', type: 'date', required: true, placeholder: '', section: 'personal' },
          { id: '4', label: 'Blood Group', type: 'text', required: true, placeholder: 'e.g., B+ / O+ / A+', section: 'personal' },
          { id: '5', label: 'Gender', type: 'text', required: true, placeholder: 'Male / Female / Other', section: 'personal' },
          { id: '6', label: 'Educational Qualification', type: 'text', required: true, placeholder: '10th Standard / 12th / Graduate', section: 'personal' },
          { id: '7', label: 'Mobile Number (Aadhaar Linked)', type: 'tel', required: true, placeholder: '+91 98765 43210', section: 'identity' },
          { id: '8', label: 'Aadhaar Number', type: 'text', required: true, placeholder: '12-digit Aadhaar Number', section: 'identity' },
          { id: '9', label: 'State & RTO Office Jurisdiction', type: 'text', required: true, placeholder: 'e.g., Maharashtra - MH02 Mumbai West', section: 'scheme' },
          { id: '10', label: 'Vehicle Class Category', type: 'text', required: true, placeholder: 'MCWG (Two Wheeler) / LMV (Car) / Transport', section: 'scheme' },
          { id: '11', label: 'Learner Licence Number (if Permanent DL)', type: 'text', required: false, placeholder: 'LL Number from Learner Certificate', section: 'scheme' },
          { id: '12', label: 'Present Residential Address', type: 'textarea', required: true, placeholder: 'Current address where applicant resides', section: 'address' },
          { id: '13', label: 'Permanent Address', type: 'textarea', required: true, placeholder: 'Permanent address as per identity document', section: 'address' },
        ],
      };
    }
    // 7. Instant PAN Card / Form 49A
    else if (
      qLower.includes('pan') ||
      qLower.includes('income tax') ||
      qLower.includes('49a') ||
      origLower.includes('पैन')
    ) {
      result = {
        title: 'Instant e-PAN & Permanent Account Number (Form 49A)',
        category: 'government',
        formType: 'form',
        description: 'Income Tax Department PAN card allotment application via paperless e-KYC or physical dispatch.',
        language,
        fields: [
          { id: '1', label: 'Full Name as per Aadhaar', type: 'text', required: true, placeholder: 'Full Name on Aadhaar', section: 'personal' },
          { id: '2', label: "Father's Full Name", type: 'text', required: true, placeholder: "Father's name (mandatory for PAN card)", section: 'personal' },
          { id: '3', label: "Mother's Full Name", type: 'text', required: false, placeholder: "Mother's optional name", section: 'personal' },
          { id: '4', label: 'Date of Birth', type: 'date', required: true, placeholder: '', section: 'personal' },
          { id: '5', label: 'Gender', type: 'text', required: true, placeholder: 'Male / Female', section: 'personal' },
          { id: '6', label: 'Aadhaar Number', type: 'text', required: true, placeholder: '12-digit Aadhaar Number', section: 'identity' },
          { id: '7', label: 'Mobile Number (Aadhaar linked)', type: 'tel', required: true, placeholder: '+91 98765 43210', section: 'identity' },
          { id: '8', label: 'Email ID for e-PAN Dispatch', type: 'email', required: true, placeholder: 'applicant@example.com', section: 'identity' },
          { id: '9', label: 'Source of Income', type: 'text', required: true, placeholder: 'Salary / Business / Profession / No Income', section: 'income' },
          { id: '10', label: 'Delivery Address for Physical Card', type: 'textarea', required: true, placeholder: 'Full address with Pincode for Speed Post', section: 'address' },
        ],
      };
    }
    // 8. Passport Seva Application
    else if (
      qLower.includes('passport') ||
      origLower.includes('पासपोर्ट')
    ) {
      result = {
        title: 'Ordinary Passport & Tatkaal Application (Passport Seva)',
        category: 'government',
        formType: 'form',
        description: 'Ministry of External Affairs application for Fresh Ordinary Passport or Re-issue/Renewal.',
        language,
        fields: [
          { id: '1', label: 'Applicant Given Name', type: 'text', required: true, placeholder: 'First and middle name', section: 'personal' },
          { id: '2', label: 'Surname', type: 'text', required: false, placeholder: 'Family name', section: 'personal' },
          { id: '3', label: 'Date of Birth', type: 'date', required: true, placeholder: '', section: 'personal' },
          { id: '4', label: 'Place of Birth (Village/Town & State)', type: 'text', required: true, placeholder: 'e.g., Jaipur, Rajasthan', section: 'personal' },
          { id: '5', label: 'Gender', type: 'text', required: true, placeholder: 'Male / Female', section: 'personal' },
          { id: '6', label: 'Marital Status', type: 'text', required: true, placeholder: 'Single / Married / Divorced', section: 'personal' },
          { id: '7', label: "Father's Full Name", type: 'text', required: true, placeholder: "Father's name", section: 'personal' },
          { id: '8', label: "Mother's Full Name", type: 'text', required: true, placeholder: "Mother's name", section: 'personal' },
          { id: '9', label: 'Aadhaar Number', type: 'text', required: true, placeholder: '12-digit Aadhaar Number', section: 'identity' },
          { id: '10', label: 'Mobile Number', type: 'tel', required: true, placeholder: '+91 98765 43210', section: 'identity' },
          { id: '11', label: 'Email ID', type: 'email', required: true, placeholder: 'applicant@example.com', section: 'identity' },
          { id: '12', label: 'Present Residential Address', type: 'textarea', required: true, placeholder: 'Present Address with Pincode', section: 'address' },
          { id: '13', label: 'Police Station Jurisdiction', type: 'text', required: true, placeholder: 'e.g., Malviya Nagar Police Station', section: 'address' },
          { id: '14', label: 'Emergency Contact Person & Phone', type: 'text', required: true, placeholder: 'Relative Name & Mobile', section: 'identity' },
        ],
      };
    }
    // 9. Rental / Tenancy Agreement Form
    else if (
      qLower.includes('rent') ||
      qLower.includes('tenant') ||
      qLower.includes('lease') ||
      origLower.includes('किराया')
    ) {
      result = {
        title: 'Residential Tenancy & Rental Agreement Form',
        category: 'business',
        formType: 'form',
        description: 'Standard residential lease agreement defining tenancy duration, monthly rent, and security deposit.',
        language,
        fields: [
          { id: '1', label: 'Landlord / Property Owner Full Name', type: 'text', required: true, placeholder: 'Owner Full Name', section: 'parties' },
          { id: '2', label: 'Tenant Full Name', type: 'text', required: true, placeholder: 'Tenant Full Name', section: 'parties' },
          { id: '3', label: 'Tenant Permanent Address & Aadhaar', type: 'textarea', required: true, placeholder: 'Permanent hometown address and 12-digit Aadhaar', section: 'parties' },
          { id: '4', label: 'Tenant Contact Mobile & Email', type: 'text', required: true, placeholder: '+91 98765 43210 / email@example.com', section: 'parties' },
          { id: '5', label: 'Rented Property Complete Address', type: 'textarea', required: true, placeholder: 'Flat No., Building Name, Street, City, Pincode', section: 'property' },
          { id: '6', label: 'Monthly Rent Amount (INR)', type: 'number', required: true, placeholder: 'e.g., 22000', section: 'terms' },
          { id: '7', label: 'Refundable Security Deposit (INR)', type: 'number', required: true, placeholder: 'e.g., 50000', section: 'terms' },
          { id: '8', label: 'Agreement Commencement Date', type: 'date', required: true, placeholder: '', section: 'terms' },
          { id: '9', label: 'Lease Duration (Months)', type: 'number', required: true, placeholder: 'e.g., 11', section: 'terms' },
          { id: '10', label: 'Notice Period for Vacating (Days)', type: 'number', required: true, placeholder: 'e.g., 30', section: 'terms' },
          { id: '11', label: 'Bank Account for Rent Payment (UPI / IFSC)', type: 'text', required: true, placeholder: 'Owner Bank A/C & IFSC or UPI ID', section: 'terms' },
        ],
      };
    }
    // 10. General / Custom Dynamic Format Tailored to Specific Inquiry
    else {
      // Dynamic synthesis based on detected words in query
      const isLetter =
        qLower.includes('letter') ||
        qLower.includes('application') ||
        qLower.includes('request') ||
        origLower.includes('पत्र');

      const titleFormatted = trimmedPrompt
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      result = {
        title: isLetter ? `${titleFormatted}` : `${titleFormatted} Application Form`,
        category: 'general',
        formType: isLetter ? 'letter' : 'form',
        description: `Custom formal document structure tailored for ${trimmedPrompt} with official field requirements.`,
        language,
        fields: isLetter
          ? [
              { id: '1', label: 'Applicant / Sender Full Name', type: 'text', required: true, placeholder: 'Your complete name', section: 'sender' },
              { id: '2', label: 'Sender Address & Contact Details', type: 'textarea', required: true, placeholder: 'Residential address, mobile & email', section: 'sender' },
              { id: '3', label: 'Recipient Name & Official Designation', type: 'text', required: true, placeholder: 'e.g., The Officer-in-Charge / Director', section: 'recipient' },
              { id: '4', label: 'Organization / Department Name', type: 'text', required: true, placeholder: 'Competent authority or organization', section: 'recipient' },
              { id: '5', label: 'Date of Application', type: 'date', required: true, placeholder: '', section: 'letter' },
              { id: '6', label: 'Subject Line', type: 'text', required: true, placeholder: `Subject: Formal application regarding ${trimmedPrompt}`, section: 'letter' },
              { id: '7', label: 'Formal Salutation', type: 'text', required: true, placeholder: 'Respected Sir / Madam,', section: 'letter' },
              { id: '8', label: 'Main Statement / Body of Application', type: 'textarea', required: true, placeholder: `Detailing the specific requirement and background for ${trimmedPrompt}...`, section: 'letter' },
              { id: '9', label: 'Supporting Documents Enclosed', type: 'text', required: false, placeholder: 'List attached proof documents, identity cards, or receipts', section: 'letter' },
              { id: '10', label: 'Formal Sign-off & Full Name', type: 'text', required: true, placeholder: 'Yours faithfully, [Your Full Name]', section: 'letter' },
            ]
          : [
              { id: '1', label: 'Applicant Full Name', type: 'text', required: true, placeholder: 'Applicant complete legal name', section: 'personal' },
              { id: '2', label: 'Date of Birth', type: 'date', required: true, placeholder: '', section: 'personal' },
              { id: '3', label: 'Gender', type: 'text', required: true, placeholder: 'Male / Female / Other', section: 'personal' },
              { id: '4', label: 'Mobile Number', type: 'tel', required: true, placeholder: '+91 98765 43210', section: 'identity' },
              { id: '5', label: 'Email Address', type: 'email', required: true, placeholder: 'applicant@example.com', section: 'identity' },
              { id: '6', label: 'Identity / Aadhaar / National ID', type: 'text', required: true, placeholder: 'Valid identity number', section: 'identity' },
              { id: '7', label: 'Current Residential Address', type: 'textarea', required: true, placeholder: 'Complete address with Pincode', section: 'address' },
              { id: '8', label: 'Specific Purpose / Service Details', type: 'textarea', required: true, placeholder: `Details specific to ${trimmedPrompt}...`, section: 'scheme' },
              { id: '9', label: 'Supporting Reference / Remarks', type: 'textarea', required: false, placeholder: 'Any additional notes or references', section: 'scheme' },
            ],
      };
    }

    // 11. Multilingual translation for UI labels and titles if requested language is not English
    if (language && language !== 'en') {
      try {
        const [translatedTitle, translatedDesc] = await Promise.all([
          translateText(result.title, language),
          translateText(result.description, language),
        ]);
        result.title = translatedTitle;
        result.description = translatedDesc;

        // Translate field labels and placeholders in parallel
        result.fields = await Promise.all(
          result.fields.map(async f => {
            const [tLabel, tPlaceholder] = await Promise.all([
              translateText(f.label, language),
              f.placeholder ? translateText(f.placeholder, language) : Promise.resolve(''),
            ]);
            return {
              ...f,
              label: tLabel,
              placeholder: tPlaceholder || f.placeholder,
            };
          })
        );
      } catch (err) {
        console.warn('Translation error in form generation:', err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Form generation error:', error);
    return NextResponse.json({ error: 'Failed to generate form format' }, { status: 500 });
  }
}
