import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

/**
 * POST /api/form-watches/narrow
 * Given a free-text form description, returns 3-5 clarifying filter options
 * as selectable chips so the user can refine their watch.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { query } = await request.json();
  if (!query || typeof query !== 'string') {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

  if (!apiKey) {
    // Fallback: return default filter options without LLM
    return Response.json({
      query,
      filters: getDefaultFilters(query),
    });
  }

  try {
    const prompt = `User wants to watch for Indian government/education form updates about: "${query}"

Return 3-5 clarifying filter categories relevant to this topic. Each filter should have:
- key: short identifier (e.g. "state", "education_level", "exam_type")
- label: human-readable name
- options: 2-5 selectable values as strings, plus "All" as first option

Return ONLY valid JSON:
{"filters":[{"key":"state","label":"State","options":["All","Madhya Pradesh","Uttar Pradesh","Rajasthan"]},{"key":"category","label":"Type","options":["All","Scholarship","Exam","Result"]}]}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

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

    if (!res.ok) {
      return Response.json({ query, filters: getDefaultFilters(query) });
    }

    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return Response.json({ query, filters: getDefaultFilters(query) });
    }

    const parsed = JSON.parse(rawText);
    return Response.json({ query, filters: parsed.filters || getDefaultFilters(query) });
  } catch (err) {
    console.error('[Narrow] Error:', err);
    return Response.json({ query, filters: getDefaultFilters(query) });
  }
}

function getDefaultFilters(query: string) {
  const q = query.toLowerCase();
  const filters = [
    {
      key: 'state',
      label: 'State',
      options: ['All', 'Madhya Pradesh', 'Uttar Pradesh', 'Rajasthan', 'Maharashtra', 'Bihar'],
    },
    {
      key: 'category',
      label: 'Notice Type',
      options: ['All', 'Application Open', 'Deadline', 'Result', 'Admit Card'],
    },
  ];

  if (q.includes('scholar') || q.includes('education') || q.includes('college')) {
    filters.push({
      key: 'education_level',
      label: 'Education Level',
      options: ['All', 'Pre-Matric (Class 1-10)', 'Post-Matric (Class 11-12)', 'Graduate', 'Post-Graduate'],
    });
  }

  if (q.includes('exam') || q.includes('ssc') || q.includes('upsc') || q.includes('psc')) {
    filters.push({
      key: 'exam_type',
      label: 'Exam Type',
      options: ['All', 'UPSC', 'SSC', 'State PSC', 'Banking', 'Railway'],
    });
  }

  if (q.includes('scheme') || q.includes('kisan') || q.includes('pm ') || q.includes('pradhan')) {
    filters.push({
      key: 'scheme_type',
      label: 'Scheme Type',
      options: ['All', 'Central Government', 'State Government', 'Private'],
    });
  }

  return filters.slice(0, 5);
}
