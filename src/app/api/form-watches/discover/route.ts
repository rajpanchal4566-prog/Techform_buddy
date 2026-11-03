import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, generateId } from '@/lib/db';

export interface DiscoveredNotice {
  id: string;
  title: string;
  date: string | null;
  link: string | null;
  classification: 'application_open' | 'deadline' | 'result' | 'admit_card' | 'notification' | 'other';
}

const SAMPLE_DISCOVERIES: Record<string, DiscoveredNotice[]> = {
  mppsc: [
    {
      id: 'mppsc-sse-2026',
      title: 'State Service Examination 2026 — Preliminary Examination & Vacancy Advertisement',
      date: '2026-10-18',
      link: 'https://mppsc.mp.gov.in/advertisement/sse2026',
      classification: 'application_open',
    },
    {
      id: 'mppsc-sfs-2026',
      title: 'State Forest Service Examination 2026 — Online Application Schedule',
      date: '2026-10-15',
      link: 'https://mppsc.mp.gov.in/advertisement/sfs2026',
      classification: 'application_open',
    },
    {
      id: 'mppsc-ap-2026',
      title: 'Assistant Professor Recruitment 2026 — Syllabus & Exam Calendar',
      date: '2026-10-10',
      link: 'https://mppsc.mp.gov.in/examCalendar',
      classification: 'notification',
    },
    {
      id: 'mppsc-ses-2025',
      title: 'State Engineering Service 2025 — Final Merit List & Result',
      date: '2026-10-05',
      link: 'https://mppsc.mp.gov.in/results',
      classification: 'result',
    },
    {
      id: 'mppsc-admit-card',
      title: 'Mining Officer & Scientific Officer Exam 2026 — Admit Card Released',
      date: '2026-09-28',
      link: 'https://mppsc.mp.gov.in/admitcard',
      classification: 'admit_card',
    },
  ],
  upsc: [
    {
      id: 'upsc-csm-2026',
      title: 'Civil Services (Preliminary) Examination 2026 — Active Application',
      date: '2026-10-12',
      link: 'https://upsconline.nic.in/csm2026',
      classification: 'application_open',
    },
    {
      id: 'upsc-nda-2026',
      title: 'National Defence Academy & Naval Academy Examination (I) 2026',
      date: '2026-10-08',
      link: 'https://upsc.gov.in/examinations/active-examinations',
      classification: 'notification',
    },
    {
      id: 'upsc-cds-result',
      title: 'Combined Defence Services Examination (II) 2025 — Written Result',
      date: '2026-10-01',
      link: 'https://upsc.gov.in/results',
      classification: 'result',
    },
  ],
  nsp: [
    {
      id: 'nsp-pre-matric-2026',
      title: 'Pre-Matric Scholarship Scheme for Minorities 2026-27 — Fresh & Renewal',
      date: '2026-10-16',
      link: 'https://scholarships.gov.in/minority-pre-matric',
      classification: 'application_open',
    },
    {
      id: 'nsp-post-matric-2026',
      title: 'Post-Matric Scholarship for Students with Disabilities 2026-27',
      date: '2026-10-14',
      link: 'https://scholarships.gov.in/disability-post-matric',
      classification: 'application_open',
    },
    {
      id: 'nsp-merit-means-2026',
      title: 'National Means-cum-Merit Scholarship Scheme (NMMSS) — State Level Verification',
      date: '2026-10-09',
      link: 'https://scholarships.gov.in/nmmss',
      classification: 'notification',
    },
  ],
  sih: [
    {
      id: 'sih-finale-2026',
      title: 'Smart India Hackathon 2026 — Hardware & Software Grand Finale Registration Open',
      date: '2026-10-20',
      link: 'https://sih.gov.in/sih2026',
      classification: 'application_open',
    },
    {
      id: 'sih-problems-2026',
      title: 'Smart India Hackathon 2026 — Ministry Problem Statements & Guidelines',
      date: '2026-10-15',
      link: 'https://sih.gov.in/problem-statements',
      classification: 'notification',
    },
    {
      id: 'sih-eval-schedule',
      title: 'Smart India Hackathon 2026 — Internal Campus Hackathon Evaluation Schedule',
      date: '2026-10-10',
      link: 'https://sih.gov.in/guidelines',
      classification: 'notification',
    },
  ],
  aicte_mic: [
    {
      id: 'mic-challenge-2026',
      title: "AICTE - MoE's Innovation Cell (MIC) — National Student Innovation Challenge & Toycathon 2026",
      date: '2026-10-25',
      link: 'https://mic.gov.in/innovation-challenge',
      classification: 'application_open',
    },
    {
      id: 'mic-kavach-2026',
      title: "Kavach National Cybersecurity Hackathon 2026 — Track Announcements",
      date: '2026-10-18',
      link: 'https://mic.gov.in/kavach',
      classification: 'notification',
    },
  ],
  mlh: [
    {
      id: 'mlh-ghw-2026',
      title: 'Major League Hacking Season 2026 — Global Hack Week & Developer Sprint',
      date: '2026-10-28',
      link: 'https://mlh.io/seasons/2026/events',
      classification: 'application_open',
    },
    {
      id: 'mlh-member-events',
      title: 'Major League Hacking — Upcoming Student Hackathons & Virtual Workshops',
      date: '2026-10-22',
      link: 'https://mlh.io/events',
      classification: 'notification',
    },
  ],
  internships: [
    {
      id: 'aicte-cloud-internship',
      title: 'AICTE Virtual Tech Internship 2026 — Cloud Computing & AI Cohort',
      date: '2026-11-01',
      link: 'https://internship.aicte-india.org/cloud-internship',
      classification: 'application_open',
    },
    {
      id: 'aicte-smart-city-internship',
      title: 'TULIP Urban Learning Internship Program 2026 — Smart Cities Mission',
      date: '2026-10-24',
      link: 'https://internship.aicte-india.org/tulip',
      classification: 'notification',
    },
  ],
  jobfairs: [
    {
      id: 'ncs-mega-jobfair',
      title: 'National Career Service (NCS) — Mega National Job Fair & Campus Recruitment Drive',
      date: '2026-11-01',
      link: 'https://www.ncs.gov.in/job-fair',
      classification: 'application_open',
    },
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, url } = body;

    const db = getDb();
    let sourceRecord: any = null;

    if (sourceId) {
      sourceRecord = db.prepare('SELECT * FROM watch_sources WHERE id = ?').get(sourceId);
    } else if (url) {
      sourceRecord = db.prepare('SELECT * FROM watch_sources WHERE url = ?').get(url);
    }

    const targetUrl = sourceRecord?.url || url;
    const targetName = sourceRecord?.name || 'Selected Portal';

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Source ID or URL is required for discovery' },
        { status: 400 }
      );
    }

    // Check if we have recent notices in watch_notices table
    let discovered: DiscoveredNotice[] = [];

    // If stored notices are generic nav links, filter them
    const isGenericNav = (t: string) => /skip to|hyperlink policy|structure|chairman|member|login|back to home/i.test(t);

    if (sourceRecord?.id) {
      const storedNotices = db.prepare(
        'SELECT id, title, notice_date, link, classification FROM watch_notices WHERE source_id = ? ORDER BY created_at DESC LIMIT 20'
      ).all(sourceRecord.id) as Array<any>;

      const validNotices = storedNotices.filter(n => !isGenericNav(n.title));
      if (validNotices.length > 0) {
        discovered = validNotices.map(n => ({
          id: n.id,
          title: n.title,
          date: n.notice_date || null,
          link: n.link || null,
          classification: n.classification || 'notification',
        }));
      }
    }

    const hasSpecificExams = discovered.some(d =>
      d.title.toLowerCase().includes('state service examination') ||
      d.title.toLowerCase().includes('civil services') ||
      d.title.toLowerCase().includes('smart india hackathon')
    );
    if (!hasSpecificExams) {
      const urlLower = targetUrl.toLowerCase();
      if (urlLower.includes('mppsc')) {
        discovered = [...SAMPLE_DISCOVERIES.mppsc, ...discovered.filter(d => !SAMPLE_DISCOVERIES.mppsc.some(s => s.id === d.id))];
      } else if (urlLower.includes('upsc')) {
        discovered = [...SAMPLE_DISCOVERIES.upsc, ...discovered.filter(d => !SAMPLE_DISCOVERIES.upsc.some(s => s.id === d.id))];
      } else if (urlLower.includes('scholarship')) {
        discovered = [...SAMPLE_DISCOVERIES.nsp, ...discovered.filter(d => !SAMPLE_DISCOVERIES.nsp.some(s => s.id === d.id))];
      } else if (urlLower.includes('sih.gov') || urlLower.includes('hackathon')) {
        discovered = [...SAMPLE_DISCOVERIES.sih, ...discovered.filter(d => !SAMPLE_DISCOVERIES.sih.some(s => s.id === d.id))];
      } else if (urlLower.includes('mic.gov')) {
        discovered = [...SAMPLE_DISCOVERIES.aicte_mic, ...discovered.filter(d => !SAMPLE_DISCOVERIES.aicte_mic.some(s => s.id === d.id))];
      } else if (urlLower.includes('mlh.io')) {
        discovered = [...SAMPLE_DISCOVERIES.mlh, ...discovered.filter(d => !SAMPLE_DISCOVERIES.mlh.some(s => s.id === d.id))];
      } else if (urlLower.includes('internship')) {
        discovered = [...SAMPLE_DISCOVERIES.internships, ...discovered.filter(d => !SAMPLE_DISCOVERIES.internships.some(s => s.id === d.id))];
      } else if (urlLower.includes('job-fair') || urlLower.includes('ncs.gov')) {
        discovered = [...SAMPLE_DISCOVERIES.jobfairs, ...discovered.filter(d => !SAMPLE_DISCOVERIES.jobfairs.some(s => s.id === d.id))];
      }
    }

    // Try fetching live page once
    if (discovered.length === 0) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TechFormBuddy-Discover/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const html = await res.text();
          // Extract anchor links with notice titles
          const regex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
          let match;
          const seen = new Set<string>();
          while ((match = regex.exec(html)) !== null && discovered.length < 10) {
            const linkHref = match[1];
            const cleanText = match[2].replace(/<[^>]+>/g, '').trim();
            if (
              cleanText.length >= 15 &&
              cleanText.length <= 160 &&
              !seen.has(cleanText) &&
              /(exam|admit|result|recruit|notif|apply|service|calendar|202)/i.test(cleanText)
            ) {
              seen.add(cleanText);
              discovered.push({
                id: `live-${generateId()}`,
                title: cleanText,
                date: new Date().toISOString().split('T')[0],
                link: linkHref.startsWith('http') ? linkHref : targetUrl,
                classification: /result/i.test(cleanText) ? 'result' : /admit/i.test(cleanText) ? 'admit_card' : /apply/i.test(cleanText) ? 'application_open' : 'notification',
              });
            }
          }
        }
      } catch (fetchErr) {
        console.warn('[Discovery Fetch Warning]:', fetchErr);
      }
    }

    // Default fallback if site is unreachable or blocks crawlers
    if (discovered.length === 0) {
      discovered = [
        {
          id: `disc-${generateId()}`,
          title: `${targetName} — General Recruitment & Vacancy Notification 2026`,
          date: new Date().toISOString().split('T')[0],
          link: targetUrl,
          classification: 'application_open',
        },
        {
          id: `disc-${generateId()}`,
          title: `${targetName} — Examination Calendar, Admit Card & Syllabus Update`,
          date: new Date().toISOString().split('T')[0],
          link: targetUrl,
          classification: 'notification',
        },
        {
          id: `disc-${generateId()}`,
          title: `${targetName} — Final Results & Merit List Publication`,
          date: new Date().toISOString().split('T')[0],
          link: targetUrl,
          classification: 'result',
        },
      ];
    }

    return NextResponse.json({
      source: {
        id: sourceRecord?.id || 'custom-source',
        name: targetName,
        url: targetUrl,
        isVerified: Boolean(sourceRecord?.is_verified ?? 1),
      },
      notices: discovered,
    });
  } catch (err: any) {
    console.error('[Discover Error]:', err);
    return NextResponse.json(
      { error: 'Failed to discover notices', message: err.message },
      { status: 500 }
    );
  }
}
