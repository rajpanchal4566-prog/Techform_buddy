import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, getSavedEvents } from '@/lib/db';

async function resolveUser(request: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  let userId = (session?.user as { id?: string })?.id || null;

  if (!userId && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
    userId = 'ce93fcbf-0795-4774-9d9e-e24bbb5e9483';
  }
  return userId;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUser(request);

    const db = getDb();
    const url = new URL(request.url);
    const categoryParam = url.searchParams.get('category') || 'all';
    const typeParam = url.searchParams.get('type') || 'all'; // 'event' | 'form' | 'all'
    const modeParam = url.searchParams.get('mode') || 'all'; // 'online' | 'offline' | 'hybrid' | 'all'
    const searchParam = (url.searchParams.get('q') || '').toLowerCase().trim();

    // Query notices joined with sources
    const query = `
      SELECT wn.id, wn.source_id, wn.title, wn.link, wn.notice_date, wn.classification,
             wn.deadline_date, wn.location_mode, wn.eligibility, wn.raw_text,
             ws.name as source_name, ws.url as source_url, ws.category as source_category
      FROM watch_notices wn
      JOIN watch_sources ws ON wn.source_id = ws.id
      ORDER BY 
        CASE WHEN wn.deadline_date IS NOT NULL AND wn.deadline_date >= date('now') THEN 0 ELSE 1 END,
        wn.deadline_date ASC,
        wn.created_at DESC
      LIMIT 100
    `;

    const rawNotices = db.prepare(query).all() as Array<Record<string, any>>;

    // Fetch user bookmarks if authenticated
    const savedMap = new Map<string, boolean>();
    const reminderMap = new Map<string, boolean>();
    if (userId) {
      const saved = getSavedEvents(userId);
      for (const s of saved) {
        if (s.event_id) {
          savedMap.set(s.event_id, true);
          reminderMap.set(s.event_id, Boolean(s.reminder_set));
        }
        savedMap.set(s.title, true);
        reminderMap.set(s.title, Boolean(s.reminder_set));
      }
    }

    // Map and categorize notices into Events & Opportunities vs Forms & Applications
    const events = rawNotices.map(n => {
      const titleLower = (n.title || '').toLowerCase();
      const rawLower = (n.raw_text || '').toLowerCase();
      const srcCategory = (n.source_category || '').toLowerCase();

      // Categorization
      let category = 'event';
      let eventType: 'event' | 'form' = 'event';

      if (srcCategory === 'hackathon' || titleLower.includes('hackathon') || titleLower.includes('toycathon')) {
        category = 'hackathon';
        eventType = 'event';
      } else if (titleLower.includes('robotics') || titleLower.includes('challenge') || titleLower.includes('competition')) {
        category = 'competition';
        eventType = 'event';
      } else if (titleLower.includes('tech fest') || titleLower.includes('techfest')) {
        category = 'tech_fest';
        eventType = 'event';
      } else if (srcCategory === 'internship' || titleLower.includes('internship') || titleLower.includes('stipend')) {
        category = 'internship';
        eventType = 'event';
      } else if (srcCategory === 'job_fair' || titleLower.includes('job fair') || titleLower.includes('recruitment drive') || titleLower.includes('mela')) {
        category = 'job_fair';
        eventType = 'event';
      } else if (srcCategory === 'conference' || titleLower.includes('conference') || titleLower.includes('workshop')) {
        category = 'conference';
        eventType = 'event';
      } else if (srcCategory === 'scholarship' || titleLower.includes('scholarship') || titleLower.includes('fellowship')) {
        category = 'scholarship';
        eventType = 'form';
      } else if (srcCategory === 'admission' || titleLower.includes('admission') || titleLower.includes('cuet')) {
        category = 'admission';
        eventType = 'form';
      } else if (srcCategory === 'exam' || titleLower.includes('upsc') || titleLower.includes('mppsc') || titleLower.includes('ssc')) {
        category = 'exam';
        eventType = 'form';
      } else if (srcCategory === 'government' || titleLower.includes('yojana') || titleLower.includes('kisan')) {
        category = 'scheme';
        eventType = 'form';
      }

      // Compute days remaining
      let daysRemaining: number | null = null;
      if (n.deadline_date) {
        const diff = new Date(n.deadline_date).getTime() - new Date().getTime();
        daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      const isBookmarked = savedMap.has(n.id) || savedMap.has(n.title);
      const reminderSet = reminderMap.has(n.id) || reminderMap.has(n.title);

      return {
        id: n.id,
        title: n.title,
        category,
        eventType,
        sourceId: n.source_id,
        sourceName: n.source_name,
        sourceUrl: n.source_url,
        eventDate: n.notice_date || 'Ongoing 2026',
        deadlineDate: n.deadline_date || null,
        daysRemaining,
        locationMode: n.location_mode || 'online',
        eligibility: n.eligibility || 'students',
        description: n.raw_text || `${n.title} on official portal.`,
        registrationUrl: n.link || n.source_url,
        isVerified: true,
        isBookmarked,
        reminderSet,
      };
    });

    // Apply filtering
    const filtered = events.filter(e => {
      if (categoryParam !== 'all' && e.category !== categoryParam) {
        // Special group filters
        if (categoryParam === 'hackathon' && !['hackathon', 'competition', 'tech_fest'].includes(e.category)) {
          return false;
        } else if (categoryParam === 'opportunity' && !['internship', 'job_fair', 'workshop', 'conference'].includes(e.category)) {
          return false;
        } else if (categoryParam === 'form' && !['scholarship', 'admission', 'exam', 'scheme'].includes(e.category)) {
          return false;
        } else if (!['hackathon', 'opportunity', 'form'].includes(categoryParam)) {
          return false;
        }
      }

      if (typeParam !== 'all' && e.eventType !== typeParam) return false;

      if (modeParam !== 'all' && e.locationMode !== modeParam) return false;

      if (searchParam) {
        const matchTitle = e.title.toLowerCase().includes(searchParam);
        const matchSource = e.sourceName.toLowerCase().includes(searchParam);
        const matchCat = e.category.toLowerCase().includes(searchParam);
        const matchDesc = e.description.toLowerCase().includes(searchParam);
        if (!matchTitle && !matchSource && !matchCat && !matchDesc) return false;
      }

      return true;
    });

    return NextResponse.json({
      total: filtered.length,
      events: filtered,
      categories: [
        { key: 'all', label: 'All Events & Forms' },
        { key: 'hackathon', label: '🏆 Hackathons & Tech Fests' },
        { key: 'opportunity', label: '💼 Internships & Job Fairs' },
        { key: 'form', label: '📋 Scholarships & Admissions' },
      ],
    });
  } catch (err: any) {
    console.error('[Events API Error]:', err);
    return NextResponse.json(
      { error: 'Failed to fetch events', message: err.message },
      { status: 500 }
    );
  }
}
