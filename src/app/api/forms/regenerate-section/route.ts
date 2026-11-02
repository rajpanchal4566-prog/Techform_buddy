import { NextRequest } from 'next/server';
import { getTemplateById, matchTemplateFromPrompt, DocumentSections } from '@/lib/templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateId,
      sectionName,
      currentSections,
      fields = {},
      language = 'en',
      instruction = '',
    } = body;

    if (!sectionName || !currentSections) {
      return Response.json({ error: 'sectionName and currentSections are required' }, { status: 400 });
    }

    const template = getTemplateById(templateId) || matchTemplateFromPrompt(templateId || 'general');
    const isHi = language === 'hi';
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

    if (!apiKey) {
      // Fallback: return slightly rephrased current section or default
      return Response.json({
        sectionName,
        content: currentSections[sectionName] || '',
      });
    }

    const prompt = `You are an expert formal document and petition editor for India.
We are revising ONLY the "${sectionName}" section of this document: "${isHi ? template.nameHi : template.name}".
Language: ${isHi ? 'Hindi' : 'English'}

CURRENT DOCUMENT SECTIONS:
- Header: ${currentSections.header || ''}
- Subject: ${currentSections.subject || ''}
- Salutation: ${currentSections.salutation || ''}
- Body: ${currentSections.body || ''}
- Closing: ${currentSections.closing || ''}

REVISION INSTRUCTIONS FOR "${sectionName.toUpperCase()}":
${instruction ? `User note: "${instruction}"` : 'Rewrite this section to be more formal, precise, and articulate.'}

Return ONLY valid JSON with a single key "${sectionName}":
{
  "${sectionName}": "The rewritten content for this section"
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (parsed[sectionName]) {
          return Response.json({
            sectionName,
            content: parsed[sectionName],
          });
        }
      }
    }

    return Response.json({
      sectionName,
      content: currentSections[sectionName] || '',
    });
  } catch (err: any) {
    console.error('Section regeneration error:', err);
    return Response.json({ error: err.message || 'Failed to regenerate section' }, { status: 500 });
  }
}
