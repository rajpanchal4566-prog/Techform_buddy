import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import {
  matchTemplateFromPrompt,
  getTemplateById,
  validateDocumentSections,
  generateFallbackDocument,
  formatSectionsToFullText,
  createCustomTemplateFromPrompt,
  validateInputQuality,
  DocumentSections,
  FormTemplate,
} from '@/lib/templates';

// Call Gemini API to generate structured document sections
async function callLlmForDocument(
  template: FormTemplate,
  fieldValues: Record<string, string>,
  language: 'en' | 'hi',
  customNotes?: string,
  retryInstruction?: string,
  customPrompt?: string
): Promise<DocumentSections | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  if (!apiKey) return null;

  const isHi = language === 'hi';
  const fieldList = Object.entries(fieldValues)
    .filter(([, v]) => v && String(v).trim().length > 0)
    .map(([k, v]) => `- ${k}: "${v}"`)
    .join('\n');

  const systemInstructions = isHi ? template.systemPromptHi : template.systemPromptEn;
  const docType = customPrompt || (isHi ? template.nameHi : template.name);

  let prompt = '';
  if (template.kind === 'resume') {
    prompt = `You are an expert ATS-friendly resume and CV builder for Indian students and professionals.
Create structured, professional single-column resume sections based strictly on the provided details.
DO NOT create an official letter. DO NOT invent recipient names, addresses, or "Respected Sir/Madam".
DO NOT write "To, <applicant name>" or "Yours faithfully".

TARGET LANGUAGE: ${isHi ? 'Hindi' : 'English'}
DOCUMENT TITLE: "${docType}"
PROVIDED DETAILS:
${fieldList}
${customPrompt ? `USER REQUIREMENT: "${customPrompt}"` : ''}
${customNotes ? `ADDITIONAL NOTES: "${customNotes}"` : ''}
${retryInstruction ? `\nCRITICAL FIX: ${retryInstruction}` : ''}

You MUST return ONLY a valid JSON object matching this schema:
{
  "contactInfo": {
    "name": "Applicant Full Name",
    "email": "email address",
    "phone": "phone number",
    "city": "city and state",
    "linkedin": "optional linkedin profile",
    "github": "optional github profile"
  },
  "summary": "3-4 concise professional sentences summarizing expertise and career objective.",
  "education": [
    {
      "degree": "Degree and Specialization",
      "institution": "College or University Name",
      "year": "Passing year or graduation range",
      "score": "CGPA or percentage if known"
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "projects": [
    {
      "title": "Project Title",
      "bullets": ["Bullet describing achievement with metrics", "Bullet describing tech stack"]
    }
  ],
  "experience": [
    {
      "role": "Role / Internship Title",
      "organization": "Company / Organization Name",
      "period": "Duration / Year",
      "bullets": ["Key responsibility or outcome"]
    }
  ],
  "certifications": ["Certification 1", "Certification 2"],
  "languages": ["English", "Hindi"],
  "declaration": "I hereby declare that all information furnished above is true and correct to the best of my knowledge."
}`;
  } else {
    prompt = `You are an expert official document, petition, agreement, and administrative letter drafter for India.
${systemInstructions}

DOCUMENT TYPE & CONTEXT: "${docType}"
TEMPLATE KIND: "${template.kind}"
TARGET LANGUAGE: ${isHi ? 'Hindi (हिंदी - शुद्ध, प्रामाणिक व औपचारिक भाषा)' : 'English (Formal administrative Indian standard)'}

PROVIDED DETAILS & PARTICULARS:
${fieldList}
${customPrompt ? `SPECIFIC USER REQUIREMENT & CONTEXT: "${customPrompt}"` : ''}
${customNotes ? `ADDITIONAL USER INSTRUCTIONS: "${customNotes}"` : ''}
${retryInstruction ? `\nCRITICAL FIX FROM PREVIOUS ATTEMPT: ${retryInstruction}` : ''}

CRITICAL RULES (NON-NEGOTIABLE):
1. FORMS VS LETTERS: If TEMPLATE KIND is "application_form", return a structured form object with "coverNote" (max 3-4 sentences in natural first person), "declaration", "subject", and "enclosures".
2. NO INVENTED FACTS: NEVER invent recipient names, addresses, organizations, institutions, dates or facts. If recipient is unknown, use "[Recipient name and address]". DO NOT write "District Administrative Complex" or "State / Region: India" unless explicitly provided.
3. WORDING: NEVER write "on behalf of" for self-applications; use natural first person ("I am applying...", "I am writing..."). Remove unverified claims like "statutory credentials", "verified supporting documents", or "duly compiled" — just say "The following documents are enclosed:".
4. SUBJECT LINE: The subject line must come from the purpose (e.g. "Subject: Application for Student Internship at <org>"), NEVER a raw copy of the form title.

You MUST return ONLY a valid JSON object with EXACTLY these keys:
{
  "header": "To block with recipient title/office, or leave clean placeholder '[Recipient name and address]'",
  "date": "Formally formatted date string (e.g. 25 October 2026 or 25 अक्टूबर 2026)",
  "subject": "Formal subject line starting with Subject: / विषय:",
  "salutation": "Formal salutation (e.g. Respected Sir/Madam, or महोदय,)",
  "body": "Substantive, full paragraphs in first person without 'on behalf of' or unverifiable claims.",
  "coverNote": "3-4 concise sentences in first person stating objective and enthusiasm (for application_form kind)",
  "declaration": "Formal declaration of truthfulness (e.g. I hereby solemnly declare that all particulars furnished above are true and correct)",
  "closing": "Complimentary close (e.g. Yours faithfully, or सधन्यवाद,\\nभवदीय,)",
  "signature": "Applicant signature block",
  "enclosures": ["Document 1", "Document 2"]
}`;
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error(`[DocGen LLM] HTTP ${res.status}`);
      return null;
    }

    const result = await res.json();
    const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);

    if (template.kind === 'resume') {
      const applicant = parsed.contactInfo?.name || fieldValues['applicant_name'] || 'Applicant';
      const email = parsed.contactInfo?.email || fieldValues['email'] || '';
      const phone = parsed.contactInfo?.phone || fieldValues['contact'] || '';
      const city = parsed.contactInfo?.city || fieldValues['city'] || '';
      const summary = parsed.summary || '';
      const skills = Array.isArray(parsed.skills) ? parsed.skills : (fieldValues['skills'] ? fieldValues['skills'].split(',').map((s: string) => s.trim()) : []);

      return {
        header: `${applicant}\n${email} | ${phone} | ${city}`,
        date: `Date: ${new Date().toLocaleDateString('en-IN')}`,
        subject: `Resume of ${applicant}`,
        salutation: '',
        body: `${summary}\n\nEDUCATION\n${(parsed.education || []).map((e: any) => `${e.degree} - ${e.institution} (${e.year})`).join('\n')}\n\nKEY SKILLS\n${skills.join(', ')}`,
        closing: '',
        signature: applicant,
        contactInfo: {
          name: applicant,
          email,
          phone,
          city,
          linkedin: parsed.contactInfo?.linkedin || fieldValues['linkedin'] || '',
          github: parsed.contactInfo?.github || fieldValues['github'] || '',
        },
        summary,
        education: Array.isArray(parsed.education) ? parsed.education : [{ degree: fieldValues['education'] || 'Degree', institution: '', year: '' }],
        skills,
        projects: Array.isArray(parsed.projects) ? parsed.projects : [{ title: 'Key Projects', bullets: (fieldValues['projects'] || '').split('\n').filter(Boolean) }],
        experience: Array.isArray(parsed.experience) ? parsed.experience : undefined,
        certifications: Array.isArray(parsed.certifications) ? parsed.certifications : undefined,
        languages: Array.isArray(parsed.languages) ? parsed.languages : undefined,
        declaration: parsed.declaration || undefined,
      };
    }

    return {
      header: String(parsed.header || '').trim(),
      date: String(parsed.date || '').trim(),
      subject: String(parsed.subject || '').trim(),
      salutation: String(parsed.salutation || '').trim(),
      body: String(parsed.body || '').trim(),
      closing: String(parsed.closing || '').trim(),
      signature: String(parsed.signature || '').trim(),
      coverNote: parsed.coverNote ? String(parsed.coverNote).trim() : undefined,
      declaration: parsed.declaration ? String(parsed.declaration).trim() : undefined,
      enclosures: Array.isArray(parsed.enclosures) ? parsed.enclosures.map(String) : undefined,
    };
  } catch (err) {
    console.error('[DocGen LLM] Error calling Gemini:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const body = await request.json();
    const {
      templateId,
      prompt = '',
      fields = {},
      language = 'en',
      customNotes = '',
      checkOnly = false, // if true, only check for missing required fields
    } = body;

    const selectedLang: 'en' | 'hi' = language === 'hi' ? 'hi' : 'en';
    const trimmedPrompt = (prompt || '').trim();

    // 1. Pick template by ID or free-text prompt
    let template: FormTemplate;
    if (templateId) {
      const found = getTemplateById(templateId);
      if (found) {
        template = found;
      } else if (trimmedPrompt) {
        template = createCustomTemplateFromPrompt(trimmedPrompt, selectedLang);
      } else {
        template = matchTemplateFromPrompt(templateId);
      }
    } else if (trimmedPrompt) {
      // Check if prompt matches standard templates
      const matched = matchTemplateFromPrompt(trimmedPrompt);
      if (matched.id === 'general_application') {
        // If it was going to fall back to general_application, synthesize a custom tailored template!
        template = createCustomTemplateFromPrompt(trimmedPrompt, selectedLang);
      } else {
        template = matched;
      }
    } else {
      template = matchTemplateFromPrompt('');
    }

    // 2. Auto-merge known stored profile values
    const mergedFields: Record<string, string> = { ...fields };
    if (session?.user) {
      try {
        const userId = (session.user as { id: string }).id;
        const db = getDb();
        const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as Record<string, any> | undefined;

        if (profile) {
          const addressParts = [profile.address, profile.city, profile.state].filter(Boolean);
          const fullAddress = addressParts.length > 0
            ? addressParts.join(', ') + (profile.pincode ? ' - ' + profile.pincode : '')
            : '';

          for (const f of template.fields) {
            if (!mergedFields[f.key] && f.profileKey) {
              if (f.profileKey === 'full_name' && profile.full_name) mergedFields[f.key] = profile.full_name;
              else if (f.profileKey === 'phone' && profile.phone) mergedFields[f.key] = profile.phone;
              else if (f.profileKey === 'email' && profile.email) mergedFields[f.key] = profile.email;
              else if (f.profileKey === 'address' && fullAddress) mergedFields[f.key] = fullAddress;
              else if (f.profileKey === 'father_name' && profile.father_name) mergedFields[f.key] = profile.father_name;
            }
          }
        }
      } catch (err) {
        console.warn('[DocGen] Error fetching profile for auto-fill:', err);
      }
    }

    // 3. Identify missing required fields and validate input quality (Requirement 2)
    const missingFields: Array<{ key: string; label: string; type?: string; error?: string }> = [];
    const qualityErrors: Array<{ key: string; label: string; error: string }> = [];

    for (const f of template.fields) {
      const val = mergedFields[f.key];
      const isMissing = !val || String(val).trim().length === 0;
      if (f.required && isMissing) {
        missingFields.push({
          key: f.key,
          label: selectedLang === 'hi' ? f.labelHi : f.label,
          type: f.type,
        });
      } else if (val && String(val).trim().length > 0) {
        const quality = validateInputQuality(val, selectedLang === 'hi' ? f.labelHi : f.label, f.required);
        if (!quality.isValid && quality.error) {
          qualityErrors.push({
            key: f.key,
            label: selectedLang === 'hi' ? f.labelHi : f.label,
            error: quality.error,
          });
        }
      }
    }

    if (qualityErrors.length > 0 && !checkOnly) {
      return Response.json(
        {
          error: qualityErrors[0].error,
          field: qualityErrors[0].key,
          qualityErrors,
        },
        { status: 400 }
      );
    }

    // If checkOnly is explicitly requested, return missing list so UI asks user
    if (checkOnly) {
      return Response.json({
        template: {
          id: template.id,
          name: selectedLang === 'hi' ? template.nameHi : template.name,
          category: template.category,
          kind: template.kind,
          description: selectedLang === 'hi' ? template.descriptionHi : template.description,
          fields: template.fields,
        },
        hasMissingFields: missingFields.length > 0,
        missingFields: missingFields.map(f => ({
          key: f.key,
          label: f.label,
          type: f.type,
          error: f.error,
        })),
        qualityErrors,
        currentFields: mergedFields,
      });
    }

    // 4. Generate Document
    let sections: DocumentSections | null = null;

    // First attempt with LLM
    sections = await callLlmForDocument(template, mergedFields, selectedLang, customNotes, undefined, trimmedPrompt);

    // If LLM returned null (offline/no key), use rich authentic fallback
    if (!sections) {
      sections = generateFallbackDocument(template, mergedFields, selectedLang, trimmedPrompt);
    }

    // 5. Validate the result
    let validation = validateDocumentSections(sections, template);

    // If validation failed, regenerate automatically ONCE with reinforced strict prompt
    if (!validation.valid) {
      console.warn('[DocGen] First generation failed validation:', validation.errors);
      const fixNote = `Your previous output was REJECTED because: ${validation.errors.join('; ')}. You MUST write full, comprehensive body paragraphs with at least 500 total characters.`;

      const retrySections = await callLlmForDocument(template, mergedFields, selectedLang, customNotes, fixNote, trimmedPrompt);

      if (retrySections) {
        const retryValidation = validateDocumentSections(retrySections, template);
        if (retryValidation.valid) {
          sections = retrySections;
          validation = retryValidation;
        } else {
          // If second LLM attempt is still too short, switch to verified authentic fallback
          console.warn('[DocGen] Second attempt failed validation. Employing verified authentic fallback template.');
          sections = generateFallbackDocument(template, mergedFields, selectedLang, trimmedPrompt);
          validation = validateDocumentSections(sections, template);
        }
      } else {
        // Fallback to verified template
        sections = generateFallbackDocument(template, mergedFields, selectedLang, trimmedPrompt);
        validation = validateDocumentSections(sections, template);
      }
    }

    // Final check: if still invalid, return clear error instead of saving tiny result
    if (!validation.valid) {
      return Response.json(
        {
          error: 'Document quality validation failed. The generated output did not meet official formatting standards.',
          details: validation.errors,
          charCount: validation.charCount,
          minRequired: template.minLengthChars,
        },
        { status: 422 }
      );
    }

    // Ensure structured fieldsTable exists for application_form and resume (Requirement 1)
    if ((template.kind === 'application_form' || template.kind === 'resume') && (!sections.fieldsTable || sections.fieldsTable.length === 0)) {
      sections.fieldsTable = template.fields
        .filter(f => mergedFields[f.key])
        .map(f => ({
          label: selectedLang === 'hi' ? f.labelHi : f.label,
          value: mergedFields[f.key],
        }));
    }

    const fullText = formatSectionsToFullText(sections, selectedLang);

    return Response.json({
      success: true,
      templateId: template.id,
      kind: template.kind,
      title: selectedLang === 'hi' ? template.nameHi : template.name,
      language: selectedLang,
      sections,
      fullText,
      charCount: validation.charCount,
      wordCount: validation.wordCount,
      template: {
        id: template.id,
        name: selectedLang === 'hi' ? template.nameHi : template.name,
        category: template.category,
        kind: template.kind,
        fields: template.fields,
      },
    });
  } catch (error: any) {
    console.error('DocGen route error:', error);
    return Response.json({ error: error.message || 'Failed to generate document' }, { status: 500 });
  }
}
