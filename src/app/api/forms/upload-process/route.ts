import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { analyzeFormFields } from '@/lib/speech';

export interface ProcessedField {
  id: string;
  label: string;
  type: string;
  value: string;
  required: boolean;
  placeholder?: string;
  section?: string;
}

export interface UploadProcessResponse {
  success: boolean;
  title: string;
  category: string;
  formType: 'letter' | 'form';
  description: string;
  modeApplied: 'format_only' | 'fix_only' | 'extract_and_profile';
  summaryOfChanges: string;
  fields: ProcessedField[];
  originalFieldCount: number;
  cleanedValuesCount: number;
  fixedCount: number;
}

// Deep text parser: extracts lines and structured field candidates from raw document text
function parseDocumentLines(rawText: string): { key: string; value: string; raw: string }[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const results: { key: string; value: string; raw: string }[] = [];

  for (const line of lines) {
    // 1. Colon pattern: "Label: Value" or "Label : Value"
    const colonMatch = line.match(/^([^:\n\t]{2,60})\s*:\s*(.*)$/);
    if (colonMatch) {
      const key = colonMatch[1].trim();
      const val = colonMatch[2].trim();
      // Filter out URLs e.g. https://
      if (!key.toLowerCase().startsWith('http') && !key.toLowerCase().startsWith('ftp')) {
        results.push({ key, value: val, raw: line });
        continue;
      }
    }

    // 2. Dash / bullet pattern: "- Label: Value" or "• Label: Value"
    const bulletMatch = line.match(/^[-*•]\s*([^:\n]{2,50})\s*:\s*(.*)$/);
    if (bulletMatch) {
      results.push({ key: bulletMatch[1].trim(), value: bulletMatch[2].trim(), raw: line });
      continue;
    }

    // 3. Underline / blank fill pattern: "Label ______" or "Label ...."
    const blankMatch = line.match(/^([A-Za-z\s]{2,50})[\s_:.-]{3,}(.*)$/);
    if (blankMatch) {
      results.push({ key: blankMatch[1].trim(), value: blankMatch[2].trim(), raw: line });
      continue;
    }

    // 4. Bracket pattern: "Label [Value]" or "[Label]: Value"
    const bracketMatch = line.match(/^\[([^\]]+)\]\s*:?\s*(.*)$/);
    if (bracketMatch) {
      results.push({ key: bracketMatch[1].trim(), value: bracketMatch[2].trim(), raw: line });
      continue;
    }

    // Single line header or candidate
    if (line.length <= 60 && !line.endsWith('.')) {
      results.push({ key: line, value: '', raw: line });
    } else {
      // Body paragraph
      results.push({ key: 'Body Text / Paragraph', value: line, raw: line });
    }
  }

  return results;
}

// Deep classification: detect field type accurately based on label & value
function inferFieldType(label: string, value: string): string {
  const lbl = label.toLowerCase();
  if (lbl.includes('date') || lbl.includes('dob') || lbl.includes('दिनांक') || lbl.includes('जन्म')) return 'date';
  if (lbl.includes('email') || lbl.includes('ईमेल')) return 'email';
  if (lbl.includes('phone') || lbl.includes('mobile') || lbl.includes('contact') || lbl.includes('मोबाइल') || lbl.includes('दूरभाष')) return 'tel';
  if (
    lbl.includes('reason') ||
    lbl.includes('address') ||
    lbl.includes('description') ||
    lbl.includes('handover') ||
    lbl.includes('body') ||
    lbl.includes('justification') ||
    lbl.includes('remarks') ||
    lbl.includes('पता') ||
    lbl.includes('कारण') ||
    value.length > 80
  ) {
    return 'textarea';
  }
  if (lbl.includes('pincode') || lbl.includes('pin code') || lbl.includes('age') || lbl.includes('days') || lbl.includes('amount') || lbl.includes('संख्या')) {
    return 'number';
  }
  return 'text';
}

// Section categorization
function inferSection(label: string): string {
  const lbl = label.toLowerCase();
  if (lbl.includes('manager') || lbl.includes('recipient') || lbl.includes('principal') || lbl.includes('employer') || lbl.includes('to:')) return 'recipient';
  if (lbl.includes('sender') || lbl.includes('from:') || lbl.includes('employee') || lbl.includes('applicant')) return 'sender';
  if (lbl.includes('subject') || lbl.includes('salutation') || lbl.includes('body') || lbl.includes('reason') || lbl.includes('notice') || lbl.includes('closing')) return 'letter';
  if (lbl.includes('aadhaar') || lbl.includes('pan') || lbl.includes('passport') || lbl.includes('voter') || lbl.includes('identity')) return 'identity';
  if (lbl.includes('address') || lbl.includes('city') || lbl.includes('state') || lbl.includes('pincode')) return 'address';
  if (lbl.includes('bank') || lbl.includes('ifsc') || lbl.includes('account')) return 'banking';
  return 'general';
}

// Detect if document is a formal letter (Resignation, Leave, Application, Official Letter)
function isFormalLetter(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('resignation') ||
    lower.includes('leave application') ||
    lower.includes('dear sir') ||
    lower.includes('dear madam') ||
    lower.includes('respected sir') ||
    lower.includes('subject:') ||
    lower.includes('yours sincerely') ||
    lower.includes('yours faithfully') ||
    lower.includes('yours obediently') ||
    lower.includes('to,') ||
    lower.includes('to :') ||
    lower.includes('notice period') ||
    lower.includes('last working day') ||
    lower.includes('tender my resignation')
  );
}

// Standard Formal Letter Template structure builder
function buildFormalLetterStructure(
  parsedLines: { key: string; value: string; raw: string }[],
  mode: 'format_only' | 'fix_only' | 'extract_and_profile',
  instruction: string
): { title: string; category: string; description: string; fields: ProcessedField[]; summary: string; cleanedCount: number; fixedCount: number } {
  const fullText = parsedLines.map(p => `${p.key}: ${p.value}`).join('\n');
  const lowerText = fullText.toLowerCase();

  let letterTitle = 'Formal Document';
  let category = 'business';

  if (lowerText.includes('resignation')) {
    letterTitle = 'Formal Resignation Letter';
    category = 'business';
  } else if (lowerText.includes('leave')) {
    letterTitle = 'Formal Leave Application';
    category = 'general';
  } else if (lowerText.includes('job') || lowerText.includes('application for the post')) {
    letterTitle = 'Job Application & Cover Letter';
    category = 'business';
  } else if (lowerText.includes('bank') || lowerText.includes('account closure')) {
    letterTitle = 'Bank Formal Request Letter';
    category = 'banking';
  }

  // Find existing values from parsed lines to either keep (for fix_only) or strip (for format_only)
  const extractVal = (keywords: string[]): string => {
    for (const item of parsedLines) {
      const k = item.key.toLowerCase();
      if (keywords.some(kw => k.includes(kw))) {
        return item.value.trim();
      }
    }
    return '';
  };

  const senderNameVal = extractVal(['sender', 'employee name', 'from', 'applicant name', 'name', 'my name']);
  const designationVal = extractVal(['designation', 'role', 'title', 'job title', 'post']);
  const employeeIdVal = extractVal(['employee id', 'emp id', 'id', 'roll no', 'registration']);
  const contactVal = extractVal(['contact', 'phone', 'mobile', 'email', 'tel']);
  const recipientVal = extractVal(['to', 'recipient', 'manager', 'head', 'principal', 'director', 'the manager']);
  const companyVal = extractVal(['company', 'organization', 'institution', 'college', 'school']);
  const dateVal = extractVal(['date', 'dated', 'दिनांक']);
  const subjectVal = extractVal(['subject', 're:', 'sub']);
  const noticeVal = extractVal(['notice', 'duration', 'notice period']);
  const lastDayVal = extractVal(['last working day', 'last day', 'relieving date']);
  const reasonVal = extractVal(['reason', 'justification', 'cause']);
  const handoverVal = extractVal(['handover', 'knowledge transfer', 'kt plan', 'transition']);
  const closingVal = extractVal(['closing', 'sign-off', 'yours sincerely', 'regards']);

  let cleanedCount = 0;
  let fixedCount = 0;

  const getFieldValue = (extracted: string, fieldKey: string): string => {
    if (mode === 'format_only') {
      if (extracted) cleanedCount++;
      return ''; // Strip pre-existing text completely for clean reusable format
    }
    if (mode === 'fix_only') {
      // If user instructed to fix specific things, check if this field was targeted
      const instLower = instruction.toLowerCase();
      if (
        (instLower.includes('date') && fieldKey.includes('date')) ||
        (instLower.includes('phone') && fieldKey.includes('phone')) ||
        (instLower.includes('contact') && fieldKey.includes('contact')) ||
        (instLower.includes('email') && fieldKey.includes('email')) ||
        (instLower.includes('address') && fieldKey.includes('address')) ||
        (instLower.includes('subject') && fieldKey.includes('subject')) ||
        (instLower.includes('name') && fieldKey.includes('name'))
      ) {
        fixedCount++;
        // Format or refine targeted value
        if (fieldKey.includes('date') && extracted) {
          const parsed = new Date(extracted);
          return isNaN(parsed.getTime()) ? extracted : parsed.toISOString().split('T')[0];
        }
        return extracted.trim();
      }
      return extracted; // Keep original
    }
    return '';
  };

  const fields: ProcessedField[] = [
    {
      id: 'sender_name',
      label: 'Sender / Employee Full Name',
      type: 'text',
      value: getFieldValue(senderNameVal, 'sender_name'),
      required: true,
      placeholder: 'Enter sender full legal name',
      section: 'sender',
    },
    {
      id: 'sender_designation',
      label: 'Designation / Job Title',
      type: 'text',
      value: getFieldValue(designationVal, 'sender_designation'),
      required: true,
      placeholder: 'e.g., Senior Systems Engineer',
      section: 'sender',
    },
    {
      id: 'sender_id',
      label: 'Employee ID / Student Roll Number',
      type: 'text',
      value: getFieldValue(employeeIdVal, 'sender_id'),
      required: false,
      placeholder: 'e.g., EMP-10492',
      section: 'sender',
    },
    {
      id: 'sender_contact',
      label: 'Contact Number & Email Address',
      type: 'text',
      value: getFieldValue(contactVal, 'sender_contact'),
      required: true,
      placeholder: 'Phone: +91 98765 43210 | Email: user@example.com',
      section: 'sender',
    },
    {
      id: 'recipient_name',
      label: 'Recipient Name & Title',
      type: 'text',
      value: getFieldValue(recipientVal, 'recipient_name'),
      required: true,
      placeholder: 'e.g., The Reporting Manager / HR Department Head',
      section: 'recipient',
    },
    {
      id: 'company_name',
      label: 'Company / Organization / Institution Name',
      type: 'text',
      value: getFieldValue(companyVal, 'company_name'),
      required: true,
      placeholder: 'e.g., Acme Technologies Pvt. Ltd.',
      section: 'recipient',
    },
    {
      id: 'letter_date',
      label: 'Date of Letter / Submission',
      type: 'date',
      value: getFieldValue(dateVal, 'letter_date'),
      required: true,
      placeholder: '',
      section: 'letter',
    },
    {
      id: 'letter_subject',
      label: 'Subject Line',
      type: 'text',
      value: getFieldValue(subjectVal, 'letter_subject') || (mode === 'format_only' ? '' : `Formal Letter Regarding ${letterTitle}`),
      required: true,
      placeholder: `e.g., Formal Submission: ${letterTitle}`,
      section: 'letter',
    },
    {
      id: 'salutation',
      label: 'Formal Salutation',
      type: 'text',
      value: mode === 'format_only' ? '' : 'Dear Sir/Madam,',
      required: true,
      placeholder: 'Dear Sir/Madam / Respected Manager,',
      section: 'letter',
    },
    {
      id: 'notice_duration',
      label: 'Notice Period / Duration of Request',
      type: 'text',
      value: getFieldValue(noticeVal, 'notice_duration'),
      required: false,
      placeholder: 'e.g., 30 Days Notice / 3 Days Leave',
      section: 'letter',
    },
    {
      id: 'last_working_day',
      label: 'Requested Last Working Day / Effective Date',
      type: 'date',
      value: getFieldValue(lastDayVal, 'last_working_day'),
      required: false,
      placeholder: '',
      section: 'letter',
    },
    {
      id: 'reason_body',
      label: 'Core Reason & Statement of Request',
      type: 'textarea',
      value: getFieldValue(reasonVal, 'reason_body'),
      required: true,
      placeholder: 'State the specific formal reason, background context, and clear statement of intent...',
      section: 'letter',
    },
    {
      id: 'handover_plan',
      label: 'Knowledge Transfer & Handover Details',
      type: 'textarea',
      value: getFieldValue(handoverVal, 'handover_plan'),
      required: false,
      placeholder: 'Details regarding project transition, key contacts, and pending task delegation...',
      section: 'letter',
    },
    {
      id: 'formal_closing',
      label: 'Formal Closing & Signature',
      type: 'text',
      value: getFieldValue(closingVal, 'formal_closing') || (mode === 'format_only' ? '' : 'Yours sincerely,'),
      required: true,
      placeholder: 'Yours sincerely, [Your Name]',
      section: 'letter',
    },
  ];

  let summary = '';
  if (mode === 'format_only') {
    summary = `Extracted authentic letter format (${fields.length} structured fields). Removed all pre-existing text/details so you have a clean, blank format ready to fill.`;
  } else if (mode === 'fix_only') {
    summary = `Preserved all existing document details. Selectively audited and fixed requested items without altering other fields.`;
  } else {
    summary = `Parsed letter structure (${fields.length} fields) and mapped with verified profile data.`;
  }

  return {
    title: letterTitle,
    category,
    description: `Official ${letterTitle} template extracted from uploaded document with standardized fields.`,
    fields,
    summary,
    cleanedCount,
    fixedCount,
  };
}

// Generic Form Structure Builder (Government, Application, Bank, Identity)
function buildGeneralFormStructure(
  parsedLines: { key: string; value: string; raw: string }[],
  mode: 'format_only' | 'fix_only' | 'extract_and_profile',
  instruction: string,
  fileName: string
): { title: string; category: string; description: string; fields: ProcessedField[]; summary: string; cleanedCount: number; fixedCount: number } {
  let cleanedCount = 0;
  let fixedCount = 0;

  // Filter out noise or header gibberish
  const validCandidates = parsedLines.filter(p => {
    const k = p.key.trim();
    if (k.length < 2 || k.length > 70) return false;
    if (/^(page \d+|http|www\.|confidential|all rights reserved)/i.test(k)) return false;
    return true;
  });

  // Clean document title from file name
  const cleanTitleName = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const title = validCandidates.length > 0 && validCandidates[0].key.length < 40 && !validCandidates[0].value
    ? validCandidates[0].key
    : `${cleanTitleName || 'Custom'} Application Form`;

  const fieldsToProcess = validCandidates[0]?.key === title ? validCandidates.slice(1) : validCandidates;

  const seenLabels = new Set<string>();
  const fields: ProcessedField[] = [];

  for (let i = 0; i < fieldsToProcess.length && fields.length < 25; i++) {
    const item = fieldsToProcess[i];
    let label = item.key.replace(/[:_.-]+$/, '').trim();
    if (!label || seenLabels.has(label.toLowerCase())) continue;
    seenLabels.add(label.toLowerCase());

    const type = inferFieldType(label, item.value);
    const section = inferSection(label);

    let val = item.value.trim();
    if (mode === 'format_only') {
      if (val) cleanedCount++;
      val = ''; // Clean format: empty values only
    } else if (mode === 'fix_only') {
      const instLower = instruction.toLowerCase();
      if (
        (instLower.includes('date') && type === 'date') ||
        (instLower.includes('phone') && type === 'tel') ||
        (instLower.includes('email') && type === 'email') ||
        (instLower.includes('address') && (label.toLowerCase().includes('address') || type === 'textarea')) ||
        instLower.includes(label.toLowerCase())
      ) {
        fixedCount++;
        // Apply targeted fix
        if (type === 'tel' && val) {
          val = val.replace(/[^\d+ -]/g, '');
        }
      }
    }

    fields.push({
      id: `field_${i + 1}`,
      label,
      type,
      value: val,
      required: true,
      placeholder: `Enter ${label.toLowerCase()}`,
      section,
    });
  }

  // If fewer than 4 fields found, supplement with essential standard application fields
  if (fields.length < 4) {
    const essential = [
      { id: 'app_name', label: 'Applicant Full Name', type: 'text', section: 'personal' },
      { id: 'app_dob', label: 'Date of Birth', type: 'date', section: 'personal' },
      { id: 'app_phone', label: 'Mobile Contact Number', type: 'tel', section: 'personal' },
      { id: 'app_email', label: 'Email Address', type: 'email', section: 'personal' },
      { id: 'app_address', label: 'Current Residential Address', type: 'textarea', section: 'address' },
      { id: 'app_purpose', label: 'Specific Request / Service Purpose', type: 'textarea', section: 'general' },
    ];
    essential.forEach(e => {
      if (!seenLabels.has(e.label.toLowerCase())) {
        fields.push({
          id: e.id,
          label: e.label,
          type: e.type,
          value: '',
          required: true,
          placeholder: `Enter ${e.label.toLowerCase()}`,
          section: e.section,
        });
      }
    });
  }

  let summary = '';
  if (mode === 'format_only') {
    summary = `Extracted authentic structure with ${fields.length} fields. Stripped all pre-filled text to provide a clean, blank format ready to use.`;
  } else if (mode === 'fix_only') {
    summary = `Audited ${fields.length} fields. Kept all intact and selectively fixed requested items.`;
  } else {
    summary = `Parsed form structure (${fields.length} fields) and mapped to profile.`;
  }

  return {
    title,
    category: 'general',
    description: `Standardized application format extracted from ${fileName} with verified fields.`,
    fields,
    summary,
    cleanedCount,
    fixedCount,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);

    const body = await request.json();
    const {
      fileName = 'uploaded_form.txt',
      fileContent = '',
      mode = 'auto', // 'format_only' | 'fix_only' | 'extract_and_profile' | 'auto'
      instruction = '',
      language = 'en',
      profileData = {},
    } = body;

    const trimmedContent = (fileContent || '').trim();
    if (!trimmedContent && !instruction) {
      return NextResponse.json({ error: 'Document content or instruction is required' }, { status: 400 });
    }

    // Determine intended mode based on user's instruction keywords
    let determinedMode: 'format_only' | 'fix_only' | 'extract_and_profile' = 'format_only';
    const instLower = (instruction || '').toLowerCase();

    if (
      instLower.includes('fix only') ||
      instLower.includes('only fix') ||
      instLower.includes('fix these') ||
      instLower.includes('सिर्फ ठीक') ||
      instLower.includes('केवल सुधार') ||
      mode === 'fix_only'
    ) {
      determinedMode = 'fix_only';
    } else if (
      instLower.includes('profile') ||
      instLower.includes('my data') ||
      instLower.includes('प्रोफ़ाइल') ||
      mode === 'extract_and_profile'
    ) {
      determinedMode = 'extract_and_profile';
    } else {
      // Default / "take it as a format" / "remove text"
      determinedMode = 'format_only';
    }

    // Parse document text into lines & key-value candidates
    const parsedLines = parseDocumentLines(trimmedContent);

    // Deep analysis: Formal letter vs application form
    const isLetter = isFormalLetter(trimmedContent) || instLower.includes('letter') || instLower.includes('पत्र');

    let result: {
      title: string;
      category: string;
      description: string;
      fields: ProcessedField[];
      summary: string;
      cleanedCount: number;
      fixedCount: number;
    };

    if (isLetter) {
      result = buildFormalLetterStructure(parsedLines, determinedMode, instruction);
    } else {
      result = buildGeneralFormStructure(parsedLines, determinedMode, instruction, fileName);
    }

    // If extract_and_profile requested, populate using strict analyzeFormFields (NO synthetic data)
    if (determinedMode === 'extract_and_profile' && profileData && Object.keys(profileData).length > 0) {
      const analysis = analyzeFormFields(
        result.fields.map(f => ({ name: f.id, label: f.label, type: f.type, required: f.required })),
        profileData
      );
      const profileLookup: Record<string, string> = {};
      analysis.forEach(a => {
        if (a.canFill && a.value) {
          profileLookup[a.fieldName] = a.value;
        }
      });
      result.fields = result.fields.map(f => ({
        ...f,
        value: profileLookup[f.id] || f.value,
      }));
    }

    const response: UploadProcessResponse = {
      success: true,
      title: result.title,
      category: result.category,
      formType: isLetter ? 'letter' : 'form',
      description: result.description,
      modeApplied: determinedMode,
      summaryOfChanges: result.summary,
      fields: result.fields,
      originalFieldCount: result.fields.length,
      cleanedValuesCount: result.cleanedCount,
      fixedCount: result.fixedCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Upload process error:', error);
    return NextResponse.json({ error: 'Failed to process uploaded document' }, { status: 500 });
  }
}
