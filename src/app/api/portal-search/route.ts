import { NextRequest, NextResponse } from 'next/server';

export interface PortalSearchResult {
  title: string;
  url: string;
  host: string;
  description: string;
  isOfficialDomain: boolean;
}

// Curated verified official portals for fast matching and reliable ranking
const VERIFIED_PORTALS: { title: string; url: string; keywords: string[]; description: string }[] = [
  {
    title: 'Passport Seva Online Portal',
    url: 'https://www.passportindia.gov.in',
    keywords: ['passport', 'tatkaal', 'psk', 'passport seva', 'visa', 'travel'],
    description: 'Official portal of Ministry of External Affairs for fresh passport, tatkaal reissue, police verification, and appointment booking.',
  },
  {
    title: 'Parivahan Sewa (Sarathi & Vahan)',
    url: 'https://parivahan.gov.in',
    keywords: ['driving licence', 'dl', 'parivahan', 'sarathi', 'vahan', 'rc', 'learner licence', 'vehicle'],
    description: 'Ministry of Road Transport and Highways portal for Driving Licence, Learner Licence, vehicle registration, and road tax.',
  },
  {
    title: 'National Voters Service Portal (ECI)',
    url: 'https://voters.eci.gov.in',
    keywords: ['voter', 'election', 'voter id', 'eci', 'epic', 'electoral roll'],
    description: 'Election Commission of India official portal for new voter registration (Form 6), correction (Form 8), and digital EPIC download.',
  },
  {
    title: 'Income Tax e-Filing Portal (Instant PAN)',
    url: 'https://www.incometax.gov.in',
    keywords: ['pan', 'pan card', 'tax', 'income tax', 'itr', 'instant pan', 'e-filing'],
    description: 'Income Tax Department portal for Instant e-PAN issuance via Aadhaar eKYC, ITR filing, and tax deduction certificates.',
  },
  {
    title: 'DigiLocker Government Document Wallet',
    url: 'https://www.digilocker.gov.in',
    keywords: ['digilocker', 'locker', 'documents', 'certificates', 'marksheets', 'aadhaar download'],
    description: 'National Digital Identity Platform by Ministry of Electronics & IT (MeitY) for issuing and verifying digital certificates.',
  },
  {
    title: 'UIDAI - MyAadhaar Portal',
    url: 'https://myaadhaar.uidai.gov.in',
    keywords: ['aadhaar', 'uidai', 'update aadhaar', 'aadhaar pvc', 'address update', 'biometric lock'],
    description: 'Unique Identification Authority of India official portal for Aadhaar download, address updates, and PVC card ordering.',
  },
  {
    title: 'EPFO Member Unified Portal',
    url: 'https://unifiedportal-mem.epfindia.gov.in',
    keywords: ['epfo', 'provident fund', 'pf', 'uan', 'pension', 'pf withdrawal', 'claim'],
    description: 'Employees Provident Fund Organisation portal for UAN activation, online PF claims, advance withdrawal, and passbook.',
  },
  {
    title: 'PM Kisan Samman Nidhi',
    url: 'https://pmkisan.gov.in',
    keywords: ['pm kisan', 'farmer', 'kisan', 'agriculture', 'samman nidhi', 'ekyc'],
    description: 'Department of Agriculture & Farmers Welfare portal for beneficiary registration, eKYC, and installment status.',
  },
  {
    title: 'National Scholarship Portal (NSP)',
    url: 'https://scholarships.gov.in',
    keywords: ['scholarship', 'nsp', 'education', 'student', 'grant', 'pre-matric', 'post-matric'],
    description: 'One-stop electronic platform for application, processing, and disbursal of Central and State government scholarships.',
  },
  {
    title: 'e-District State Citizen Services Gateway',
    url: 'https://edistrict.gov.in',
    keywords: ['edistrict', 'caste', 'income certificate', 'domicile', 'birth certificate', 'death certificate', 'revenue'],
    description: 'National gateway linking state-level citizen services for caste, income, domicile certificates and social security pensions.',
  },
];

function isGovDomain(host: string): boolean {
  const clean = host.toLowerCase().trim();
  return clean.endsWith('.gov.in') || clean.endsWith('.nic.in') || clean.endsWith('.gov') || clean.endsWith('.mil');
}

function extractHost(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase();
  } catch {
    return urlStr;
  }
}

// Live Search via DuckDuckGo adapter
async function searchWebPortals(query: string): Promise<PortalSearchResult[]> {
  try {
    const searchQuery = `${query} official government portal apply online`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return [];
    const html = await res.text();

    const linkRegex = /class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/g;

    const links: { title: string; href: string }[] = [];
    const snippets: string[] = [];

    let match;
    while ((match = linkRegex.exec(html)) !== null && links.length < 8) {
      let rawHref = match[1];
      let cleanHref = '';
      if (rawHref.includes('uddg=')) {
        const u = rawHref.split('uddg=')[1]?.split('&')[0];
        if (u) cleanHref = decodeURIComponent(u);
      } else if (rawHref.startsWith('http')) {
        cleanHref = rawHref;
      }
      if (cleanHref && !cleanHref.includes('duckduckgo.com') && !cleanHref.includes('bing.com')) {
        links.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          href: cleanHref,
        });
      }
    }

    let snipMatch;
    while ((snipMatch = snippetRegex.exec(html)) !== null && snippets.length < 8) {
      const clean = snipMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      snippets.push(clean);
    }

    const results: PortalSearchResult[] = [];
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const host = extractHost(link.href);
      if (!host) continue;
      results.push({
        title: link.title,
        url: link.href,
        host,
        description: snippets[i] || `Official online portal resource for ${query}`,
        isOfficialDomain: isGovDomain(host),
      });
    }

    return results;
  } catch (err) {
    console.error('Portal live web search error:', err);
    return [];
  }
}

// Optional Gemini Search Grounding adapter
async function searchWithGemini(query: string): Promise<PortalSearchResult[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const prompt = `Search for official portals and government websites for: "${query}". Return a JSON array with 3 to 6 results. Each item must have:
- "title": Name of the official website or service
- "url": Real absolute URL
- "description": Short 1-2 sentence description
Respond ONLY with a valid JSON array.`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.1,
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return null;

    return parsed.map((item: any) => {
      const host = extractHost(item.url || '');
      return {
        title: String(item.title || 'Official Portal'),
        url: String(item.url || ''),
        host,
        description: String(item.description || ''),
        isOfficialDomain: isGovDomain(host),
      };
    });
  } catch {
    // If Gemini grounding fails or model does not support it, return null to use fallback
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  if (!query || query.trim() === '') {
    // Return all curated portals by default
    const defaultList: PortalSearchResult[] = VERIFIED_PORTALS.map(p => {
      const host = extractHost(p.url);
      return {
        title: p.title,
        url: p.url,
        host,
        description: p.description,
        isOfficialDomain: isGovDomain(host),
      };
    });
    return NextResponse.json({ query: '', results: defaultList });
  }

  const cleanQ = query.toLowerCase().trim();

  // 1. Check curated verified database matches
  const matchedCurated = VERIFIED_PORTALS.filter(p => {
    return (
      p.title.toLowerCase().includes(cleanQ) ||
      p.description.toLowerCase().includes(cleanQ) ||
      p.keywords.some(k => cleanQ.includes(k) || k.includes(cleanQ))
    );
  }).map(p => {
    const host = extractHost(p.url);
    return {
      title: p.title,
      url: p.url,
      host,
      description: p.description,
      isOfficialDomain: isGovDomain(host),
    };
  });

  // 2. Try Gemini with Google Search grounding first
  let liveResults = await searchWithGemini(cleanQ);

  // 3. If Gemini is unavailable or yields empty results, use live search adapter
  if (!liveResults || liveResults.length === 0) {
    liveResults = await searchWebPortals(cleanQ);
  }

  // Combine curated (prioritized) + live search results without duplicates
  const seenUrls = new Set<string>();
  const combined: PortalSearchResult[] = [];

  for (const item of [...matchedCurated, ...(liveResults || [])]) {
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    combined.push(item);
  }

  // If query is specifically looking for an unofficial/third-party or general term, ensure testability:
  return NextResponse.json({
    query,
    count: combined.length,
    results: combined,
  });
}
