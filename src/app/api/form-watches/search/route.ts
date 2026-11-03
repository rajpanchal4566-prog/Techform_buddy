import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';

export interface SourceCard {
  id: string;
  name: string;
  url: string;
  type: string;
  state: string | null;
  category: string | null;
  description: string;
  monitoredWhat: string;
  availableCategories: string[];
  lastChecked: string | null;
  lastStatus: string | null;
  isVerified: boolean;
  score: number;
}

export interface BroadCategoryFilter {
  key: string;
  label: string;
  options: string[];
}

// Government and educational domain validation rule (Requirement 4)
export function isValidGovOrEduUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith('.gov.in') ||
      host.endsWith('.nic.in') ||
      host.endsWith('.ac.in') ||
      host.endsWith('.edu.in') ||
      host === 'localhost' ||
      host.includes('nta.ac.in') ||
      host.includes('parivahan.gov.in') ||
      host.includes('passportindia.gov.in')
    );
  } catch {
    return false;
  }
}

// Curated official suggestions for popular unseeded government bodies
const KNOWN_GOV_SUGGESTIONS: Record<string, { name: string; url: string; state: string | null; category: string; description: string }> = {
  bpsc: {
    name: 'Bihar Public Service Commission (BPSC)',
    url: 'https://bpsc.bih.nic.in',
    state: 'Bihar',
    category: 'exam',
    description: 'Official portal for Bihar State Services, teacher recruitment, and administrative examinations.',
  },
  rpsc: {
    name: 'Rajasthan Public Service Commission (RPSC)',
    url: 'https://rpsc.rajasthan.gov.in',
    state: 'Rajasthan',
    category: 'exam',
    description: 'Official Rajasthan state administrative services (RAS/RTS), teacher, and officer recruitments.',
  },
  uppsc: {
    name: 'Uttar Pradesh Public Service Commission (UPPSC)',
    url: 'https://uppsc.up.nic.in',
    state: 'Uttar Pradesh',
    category: 'exam',
    description: 'Official portal for UP Combined State / Upper Subordinate Services examination and recruitments.',
  },
  jpsc: {
    name: 'Jharkhand Public Service Commission (JPSC)',
    url: 'https://jpsc.gov.in',
    state: 'Jharkhand',
    category: 'exam',
    description: 'Official portal for Jharkhand Combined Civil Services Examination and state recruitments.',
  },
  cuet: {
    name: 'Common University Entrance Test (CUET NTA)',
    url: 'https://cuetug.nta.nic.in',
    state: null,
    category: 'exam',
    description: 'National Testing Agency official portal for central and state university admissions.',
  },
  jeecup: {
    name: 'Joint Entrance Examination Council Uttar Pradesh (JEECUP)',
    url: 'https://jeecup.admissions.nic.in',
    state: 'Uttar Pradesh',
    category: 'exam',
    description: 'Official UP Polytechnic admissions and seat allotment portal.',
  },
  gate: {
    name: 'Graduate Aptitude Test in Engineering (GATE)',
    url: 'https://gate2026.iitk.ac.in',
    state: null,
    category: 'exam',
    description: 'National admission examination for postgraduate engineering and PSU recruitments.',
  },
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  return handleSearch(query);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query || body.q || '';
    return handleSearch(query);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Invalid search request', details: err.message },
      { status: 400 }
    );
  }
}

async function handleSearch(rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) {
    return NextResponse.json({
      matches: [],
      isBroad: false,
      categories: [],
      suggestions: [],
      hasNoMatch: false,
    });
  }

  const qLower = query.toLowerCase();
  const qTokens = qLower.split(/[\s,_\-]+/).filter(t => t.length > 1);

  const db = getDb();
  const isDevMode = process.env.NODE_ENV === 'development' || process.env.SHOW_TEST_SOURCES === 'true' || rawQuery.includes('test');
  const allSources = db.prepare('SELECT * FROM watch_sources').all() as Array<Record<string, any>>;
  const visibleSources = isDevMode ? allSources : allSources.filter(s => s.category !== 'test');

  const scoredMatches: SourceCard[] = [];

  for (const s of visibleSources) {
    const name = String(s.name || '');
    const nameLower = name.toLowerCase();
    const url = String(s.url || '');
    const category = String(s.category || '').toLowerCase();
    const state = s.state ? String(s.state).toLowerCase() : '';
    const description = String(s.description || '');
    const descLower = description.toLowerCase();

    let aliases: string[] = [];
    try {
      if (s.aliases) {
        aliases = JSON.parse(s.aliases);
      }
    } catch {}

    const aliasesLower = aliases.map(a => String(a).toLowerCase());

    let score = 0;

    // 1. Exact alias or name match
    if (aliasesLower.some(a => a === qLower) || nameLower === qLower) {
      score += 100;
    }
    // 2. Exact word boundary match in aliases or name (e.g. "mppsc" in "mppsc indore")
    else if (aliasesLower.some(a => a.includes(qLower) || qLower.includes(a))) {
      score += 85;
    }
    // 3. Substring match in name
    else if (nameLower.includes(qLower)) {
      score += 75;
    }
    // 4. Token matches
    else {
      let matchedTokens = 0;
      for (const token of qTokens) {
        if (
          nameLower.includes(token) ||
          aliasesLower.some(a => a.includes(token)) ||
          category.includes(token) ||
          state.includes(token) ||
          descLower.includes(token)
        ) {
          matchedTokens++;
        }
      }
      if (matchedTokens > 0) {
        score += (matchedTokens / qTokens.length) * 60;
      }
    }

    if (score > 0) {
      let availableCategories = ['recruitment', 'notification', 'admit_card', 'result', 'syllabus'];
      try {
        if (s.monitored_types) {
          availableCategories = JSON.parse(s.monitored_types);
        }
      } catch {}

      const monitoredWhat = availableCategories
        .map(c => {
          if (c === 'recruitment') return 'Recruitment / Vacancy';
          if (c === 'notification') return 'Official Notification';
          if (c === 'admit_card') return 'Admit Card';
          if (c === 'result') return 'Result';
          if (c === 'syllabus') return 'Syllabus / Exam Calendar';
          return c;
        })
        .join(', ');

      scoredMatches.push({
        id: s.id,
        name: s.name,
        url: s.url,
        type: s.type || 'html',
        state: s.state || null,
        category: s.category || null,
        description: s.description || `${s.name} updates and notifications.`,
        monitoredWhat,
        availableCategories,
        lastChecked: s.last_checked_at || null,
        lastStatus: s.last_status || null,
        isVerified: Boolean(s.is_verified ?? 1),
        score,
      });
    }
  }

  scoredMatches.sort((a, b) => b.score - a.score);

  // Check if broad term like "scholarship", "hackathon", "admission" (Requirement 3)
  const isBroad =
    qLower.includes('scholar') ||
    qLower.includes('hackathon') ||
    qLower.includes('admission') ||
    qLower.includes('cuet') ||
    qLower.includes('exam') ||
    qLower.includes('yojana') ||
    qLower === 'jobs' ||
    qLower.includes('internship') ||
    qLower.includes('fair') ||
    qLower.includes('techfest');
  let broadCategories: BroadCategoryFilter[] = [];

  if (isBroad) {
    if (qLower.includes('hackathon') || qLower.includes('challenge')) {
      broadCategories = [
        {
          key: 'mode',
          label: 'Event Mode',
          options: ['All Modes', 'Online (Virtual)', 'Offline (In-Person)', 'Hybrid'],
        },
        {
          key: 'studentEligible',
          label: 'Eligibility',
          options: ['All Eligible', 'Students Only'],
        },
        {
          key: 'deadlineDays',
          label: 'Deadline Range',
          options: ['Any time', 'Within 7 days', 'Within 15 days', 'Within 30 days'],
        },
      ];
    } else if (qLower.includes('internship') || qLower.includes('job') || qLower.includes('fair') || qLower.includes('techfest')) {
      broadCategories = [
        {
          key: 'mode',
          label: 'Opportunity Type',
          options: ['All Opportunities', 'Virtual / Remote', 'On-Site / Campus', 'Apprenticeship Drive'],
        },
        {
          key: 'studentEligible',
          label: 'Applicant Eligibility',
          options: ['All Candidates', 'Students / Freshers Only', 'Graduates / Diploma'],
        },
        {
          key: 'deadlineDays',
          label: 'Application Window',
          options: ['Any time', 'Within 7 days', 'Within 15 days', 'Within 30 days'],
        },
      ];
    } else if (qLower.includes('scholar')) {
      broadCategories = [
        {
          key: 'state',
          label: 'State / Region',
          options: ['All India (Central)', 'Madhya Pradesh', 'Uttar Pradesh', 'Rajasthan', 'Maharashtra', 'Bihar'],
        },
        {
          key: 'education_level',
          label: 'Education Level',
          options: ['All Levels', 'Pre-Matric (Class 1-10)', 'Post-Matric (Class 11-12)', 'Graduate / Higher Education', 'Technical / Engineering / Medical'],
        },
        {
          key: 'scheme_type',
          label: 'Govt / Private',
          options: ['All Schemes', 'Central Government (NSP)', 'State Government Schemes', 'Private / Corporate CSR'],
        },
      ];
    } else if (qLower.includes('admission') || qLower.includes('cuet')) {
      broadCategories = [
        {
          key: 'level',
          label: 'Degree Level',
          options: ['All Programs', 'Undergraduate (UG)', 'Postgraduate (PG)', 'Engineering / Technology', 'Medical / Dental'],
        },
        {
          key: 'state',
          label: 'Institution Scope',
          options: ['All India / Central Universities', 'State Universities', 'Deemed / Autonomous'],
        },
      ];
    } else {
      broadCategories = [
        {
          key: 'state',
          label: 'State Jurisdiction',
          options: ['All India (Central)', 'Madhya Pradesh', 'Uttar Pradesh', 'Rajasthan', 'Delhi'],
        },
        {
          key: 'stage',
          label: 'Examination Stage',
          options: ['All Stages', 'Fresh Notification', 'Application Open', 'Admit Card Released', 'Final Result'],
        },
      ];
    }
  }

  // If no match in our registry, suggest likely official portals via AI / heuristics (Requirement 4)
  let suggestions: Array<{
    name: string;
    url: string;
    description: string;
    isVerified: boolean;
    state: string | null;
  }> = [];

  const hasNoMatch = scoredMatches.length === 0;

  if (hasNoMatch) {
    // Check known curated suggestions first
    const matchedKey = Object.keys(KNOWN_GOV_SUGGESTIONS).find(k => qLower.includes(k) || k.includes(qLower));
    if (matchedKey) {
      const item = KNOWN_GOV_SUGGESTIONS[matchedKey];
      if (isValidGovOrEduUrl(item.url)) {
        suggestions.push({
          name: item.name,
          url: item.url,
          description: item.description,
          isVerified: false, // Explicitly marked unverified until user confirms
          state: item.state,
        });
      }
    }

    // Try Gemini LLM if available to suggest official portal
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

    if (suggestions.length === 0 && apiKey) {
      try {
        const prompt = `User in India is searching for government portal or exam notices for: "${query}".
Suggest 1-2 authentic official Indian government or educational portals for this topic.
Rules:
1. ONLY return URLs that end with .gov.in, .nic.in, .ac.in, or .edu.in.
2. Return ONLY a valid JSON array:
[{"name":"Organization Name","url":"https://domain.gov.in/path","description":"Short description"}]`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const p of parsed) {
                if (p.url && isValidGovOrEduUrl(p.url)) {
                  suggestions.push({
                    name: p.name || `${query.toUpperCase()} Official Portal`,
                    url: p.url,
                    description: p.description || 'Suggested government/educational portal.',
                    isVerified: false,
                    state: null,
                  });
                }
              }
            }
          }
        }
      } catch (llmErr) {
        console.warn('[Sources Search LLM Error]:', llmErr);
      }
    }

    // If still no suggestion, provide safe educational/governmental fallback suggestion
    if (suggestions.length === 0) {
      const cleanQ = query.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      suggestions.push({
        name: `${query.toUpperCase()} Public Notice Portal (Suggested)`,
        url: `https://${cleanQ}.gov.in`,
        description: `Suggested official portal for ${query}. Please verify the URL before confirming.`,
        isVerified: false,
        state: null,
      });
    }
  }

  return NextResponse.json({
    query,
    matches: scoredMatches,
    bestMatch: scoredMatches[0] || null,
    otherMatches: scoredMatches.slice(1),
    isBroad,
    categories: broadCategories,
    hasNoMatch,
    suggestions,
    allowCustomUrl: true,
  });
}

