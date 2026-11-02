import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import { validateExtensionToken } from '@/lib/extensionAuth';

/**
 * GET /api/watcher/on-visit?domain=<hostname>
 * Requirement 6 (b): Returns unseen alerts for the watched sources matching this domain.
 */
export async function GET(request: NextRequest) {
  let userId: string | null = null;

  // 1. Check Bearer token from Extension
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim();
    const tokenResult = validateExtensionToken(rawToken);
    if (tokenResult.valid && tokenResult.userId) {
      userId = tokenResult.userId;
    }
  }

  // 2. Check NextAuth session
  if (!userId) {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      userId = (session.user as any).id;
    }
  }

  // 3. Fallback to first user in development
  const db = getDb();
  if (!userId) {
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined;
    userId = firstUser?.id || null;
  }

  if (!userId) {
    return Response.json({ hasAlerts: false, alerts: [] });
  }

  const { searchParams } = new URL(request.url);
  const domainQuery = (searchParams.get('domain') || '').toLowerCase().trim();

  if (!domainQuery) {
    return Response.json({ hasAlerts: false, alerts: [] });
  }

  // Find sources matching this domain
  const matchedSources = db.prepare(`
    SELECT id, name, url, domain, is_verified 
    FROM watch_sources 
    WHERE (domain IS NOT NULL AND ? LIKE '%' || domain || '%')
       OR (? LIKE '%' || replace(replace(url, 'https://', ''), 'http://', '') || '%')
       OR (url LIKE '%' || ? || '%')
  `).all(domainQuery, domainQuery, domainQuery) as Array<{
    id: string;
    name: string;
    url: string;
    domain: string;
    is_verified: number;
  }>;

  if (matchedSources.length === 0) {
    return Response.json({ hasAlerts: false, alerts: [] });
  }

  const sourceIds = matchedSources.map(s => s.id);
  const primarySource = matchedSources[0];

  // Find user's active watches that monitor any of these sources
  const userWatches = db.prepare(`
    SELECT id, source_id, source_ids, search_query 
    FROM form_watches 
    WHERE user_id = ? AND is_active = 1
  `).all(userId) as Array<{
    id: string;
    source_id: string | null;
    source_ids: string | null;
    search_query: string;
  }>;

  const relevantWatchIds: string[] = [];
  for (const w of userWatches) {
    let watchSources: string[] = [];
    try {
      if (w.source_ids) watchSources = JSON.parse(w.source_ids);
    } catch {}
    if (watchSources.length === 0 && w.source_id) {
      watchSources = [w.source_id];
    }
    if (watchSources.some(sid => sourceIds.includes(sid))) {
      relevantWatchIds.push(w.id);
    }
  }

  if (relevantWatchIds.length === 0) {
    return Response.json({ hasAlerts: false, alerts: [] });
  }

  // Query unseen alerts (is_read = 0)
  const placeholders = relevantWatchIds.map(() => '?').join(',');
  const unseenAlerts = db.prepare(`
    SELECT wa.id, wa.watch_id, wa.is_read, wa.created_at, wa.why_matched,
           wn.title as notice_title, wn.link as notice_link, wn.classification,
           wn.deadline_date, ws.name as source_name, ws.domain as source_domain
    FROM watch_alerts wa
    JOIN watch_notices wn ON wa.notice_id = wn.id
    JOIN watch_sources ws ON wn.source_id = ws.id
    WHERE wa.user_id = ? AND wa.is_read = 0 AND wa.watch_id IN (${placeholders})
    ORDER BY wa.created_at DESC
    LIMIT 10
  `).all(userId, ...relevantWatchIds) as Array<{
    id: string;
    watch_id: string;
    is_read: number;
    created_at: string;
    why_matched: string | null;
    notice_title: string;
    notice_link: string | null;
    classification: string | null;
    deadline_date: string | null;
    source_name: string;
    source_domain: string | null;
  }>;

  return Response.json({
    hasAlerts: unseenAlerts.length > 0,
    sourceName: primarySource.name,
    domain: primarySource.domain || domainQuery,
    alerts: unseenAlerts.map(a => ({
      id: a.id,
      title: a.notice_title,
      link: a.notice_link,
      deadline: a.deadline_date,
      classification: a.classification,
      whyMatched: a.why_matched || `Matched active watch for ${primarySource.name}`,
      createdAt: a.created_at,
    })),
  });
}

