import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, generateId, normalizeWatchQuery, normalizeSourceSet } from '@/lib/db';

async function resolveUser(request: NextRequest): Promise<string | null> {
  const schedulerSecret = request.headers.get('x-scheduler-secret');
  const validSecret = process.env.WATCHER_SECRET || 'dev-watcher-secret';

  if (schedulerSecret === validSecret) {
    const urlUser = request.nextUrl.searchParams.get('userId');
    if (urlUser) return urlUser;
    const db = getDb();
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined;
    return firstUser?.id || 'dev-user';
  }

  const session = await getServerSession(authOptions);
  return (session?.user as { id: string } | undefined)?.id || null;
}

export async function GET(request: NextRequest) {
  const userId = await resolveUser(request);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  // Fetch watches with enriched data: alerts count, matched notices, source info
  const watches = db.prepare(
    'SELECT * FROM form_watches WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as Array<Record<string, any>>;

  // Fetch all registered watch sources
  const allSources = db.prepare(
    'SELECT id, name, url, category, state, domain, last_checked_at, last_status, last_error_reason, last_success_at FROM watch_sources ORDER BY name'
  ).all() as Array<{
    id: string;
    name: string;
    url: string;
    category: string | null;
    state: string | null;
    domain: string | null;
    last_checked_at: string | null;
    last_status: string | null;
    last_error_reason: string | null;
    last_success_at: string | null;
  }>;

  // Enrich each watch with alert/notice data, sources being checked, and status
  const enriched = watches.map(watch => {
    const alerts = db.prepare(
      `SELECT wa.id, wa.watch_id, wa.notice_id, wa.is_read, wa.created_at, wa.why_matched,
              wn.title as notice_title, wn.link as notice_link,
              wn.classification, wn.deadline_date, ws.name as source_name
       FROM watch_alerts wa
       JOIN watch_notices wn ON wa.notice_id = wn.id
       JOIN watch_sources ws ON wn.source_id = ws.id
       WHERE wa.watch_id = ?
       ORDER BY wa.created_at DESC
       LIMIT 20`
    ).all(watch.id);

    const parsedFilters = watch.filters
      ? (typeof watch.filters === 'string' ? JSON.parse(watch.filters) : watch.filters)
      : null;

    // Requirement 1: SCOPE: A watch monitors ONLY the sources selected by the user.
    let selectedSourceIds: string[] = [];
    try {
      if (watch.source_ids) {
        selectedSourceIds = JSON.parse(watch.source_ids);
      }
    } catch {}
    if (selectedSourceIds.length === 0 && watch.source_id) {
      selectedSourceIds = [watch.source_id];
    }

    const matchingSources = allSources.filter(s => selectedSourceIds.includes(s.id));
    const sourcesBeingChecked = matchingSources.map(s => s.name);

    // Requirement 5: Per-source status details
    const sourcesDetail = matchingSources.map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      status: s.last_status || 'ok',
      error_reason: s.last_error_reason || null,
      last_success_at: s.last_success_at || null,
      last_checked_at: s.last_checked_at || null,
    }));

    const allFailed = matchingSources.length > 0 && matchingSources.every(s => s.last_status && s.last_status !== 'ok');
    const hasError = matchingSources.some(s => s.last_status && s.last_status !== 'ok');
    const lastStatus = allFailed ? 'all_failed' : hasError ? 'source_error' : 'ok';

    const latestCheck = matchingSources
      .map(s => s.last_checked_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || watch.last_checked || null;

    const unreadCount = (alerts as Array<{ is_read: number }>).filter(a => !a.is_read).length;

    let parsedMonitoredCategories: string[] = [];
    try {
      if (watch.monitored_categories) {
        parsedMonitoredCategories = JSON.parse(watch.monitored_categories);
      }
    } catch {}

    let parsedSelectedNotices: string[] = [];
    try {
      if (watch.selected_notices) {
        parsedSelectedNotices = JSON.parse(watch.selected_notices);
      }
    } catch {}

    // Find attached primary source
    const primarySourceId = selectedSourceIds[0] || watch.source_id;
    const linkedSource = primarySourceId
      ? allSources.find(s => s.id === primarySourceId)
      : null;

    const sourceName = linkedSource?.name || (matchingSources[0]?.name) || watch.search_query;
    const sourceUrl = linkedSource?.url || (matchingSources[0]?.url) || null;
    const isVerified = linkedSource ? Boolean((linkedSource as any).is_verified ?? 1) : Boolean(watch.is_verified ?? 1);

    return {
      ...watch,
      filters: parsedFilters,
      source_ids: selectedSourceIds,
      monitored_categories: parsedMonitoredCategories,
      selected_notices: parsedSelectedNotices,
      source_name: sourceName,
      source_url: sourceUrl,
      is_verified: isVerified,
      alerts,
      sources_being_checked: sourcesBeingChecked,
      sources_detail: sourcesDetail,
      last_status: lastStatus,
      last_checked: linkedSource?.last_checked_at || latestCheck,
      unread_alerts_count: unreadCount,
    };
  });

  return Response.json(enriched);
}

export async function POST(request: NextRequest) {
  const userId = await resolveUser(request);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    searchQuery,
    category,
    filters,
    sourceId: incomingSourceId,
    sourceIds: incomingSourceIds,
    customUrl,
    customName,
    monitoredCategories,
    selectedNotices,
    isVerified = true,
    digestMode = 'instant',
    updateExisting = false,
  } = await request.json();

  if (!searchQuery && !incomingSourceId && (!incomingSourceIds || incomingSourceIds.length === 0) && !customUrl) {
    return Response.json({ error: 'Search query or source is required' }, { status: 400 });
  }

  const db = getDb();
  let sourceId = incomingSourceId || null;
  let finalSourceIds: string[] = [];

  if (Array.isArray(incomingSourceIds) && incomingSourceIds.length > 0) {
    finalSourceIds = incomingSourceIds.filter(Boolean);
  } else if (sourceId) {
    finalSourceIds = [sourceId];
  }

  // If user provided a custom URL, create custom source marked unverified
  if (finalSourceIds.length === 0 && customUrl) {
    sourceId = generateId();
    try {
      db.prepare(
        `INSERT INTO watch_sources (id, name, url, type, is_verified, category, check_interval) 
         VALUES (?, ?, ?, 'html', 0, 'custom', 3600)`
      ).run(sourceId, customName || searchQuery || 'Custom Portal', customUrl);
    } catch (err: any) {
      const existing = db.prepare('SELECT id FROM watch_sources WHERE url = ?').get(customUrl) as any;
      if (existing) sourceId = existing.id;
    }
    finalSourceIds = [sourceId];
  }

  if (finalSourceIds.length > 0 && !sourceId) {
    sourceId = finalSourceIds[0];
  }

  const effectiveQuery = (searchQuery || customName || 'Portal Watch').trim();
  const normalizedQuery = normalizeWatchQuery(effectiveQuery);
  const normalizedSources = normalizeSourceSet(finalSourceIds);

  // Requirement 2: DEDUPE: normalize the query and source set; if the same watch exists, offer to update it
  const existingWatch = db.prepare(`
    SELECT * FROM form_watches 
    WHERE user_id = ? AND is_active = 1 AND (normalized_query = ? OR (source_ids IS NOT NULL AND source_ids = ?))
  `).get(userId, normalizedQuery, normalizedSources) as any;

  if (existingWatch && !updateExisting) {
    return Response.json({
      error: 'DUPLICATE_WATCH',
      message: `A watch for "${existingWatch.search_query}" already exists.`,
      duplicate: true,
      existingWatch: {
        id: existingWatch.id,
        search_query: existingWatch.search_query,
        created_at: existingWatch.created_at,
        source_id: existingWatch.source_id,
        source_ids: existingWatch.source_ids ? JSON.parse(existingWatch.source_ids) : [],
      },
    }, { status: 409 });
  }

  if (existingWatch && updateExisting) {
    // Update existing watch
    db.prepare(`
      UPDATE form_watches 
      SET category = ?, filters = ?, source_id = ?, source_ids = ?, monitored_categories = ?, selected_notices = ?, digest_mode = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      category || existingWatch.category,
      filters ? JSON.stringify(filters) : existingWatch.filters,
      sourceId || existingWatch.source_id,
      JSON.stringify(finalSourceIds),
      monitoredCategories ? JSON.stringify(monitoredCategories) : existingWatch.monitored_categories,
      selectedNotices ? JSON.stringify(selectedNotices) : existingWatch.selected_notices,
      digestMode || existingWatch.digest_mode || 'instant',
      existingWatch.id
    );

    return Response.json({
      id: existingWatch.id,
      updated: true,
      message: 'Existing watch updated successfully',
      stored: {
        search_query: existingWatch.search_query,
        source_ids: finalSourceIds,
        monitored_categories: monitoredCategories || null,
        selected_notices: selectedNotices || null,
        filters: filters || null,
      },
    }, { status: 200 });
  }

  // Create new watch
  const id = generateId();
  const filtersJson = filters ? JSON.stringify(filters) : null;
  const categoriesJson = monitoredCategories && Array.isArray(monitoredCategories) ? JSON.stringify(monitoredCategories) : null;
  const noticesJson = selectedNotices && Array.isArray(selectedNotices) ? JSON.stringify(selectedNotices) : null;

  db.prepare(
    `INSERT INTO form_watches (id, user_id, search_query, normalized_query, category, filters, source_id, source_ids, monitored_categories, selected_notices, is_verified, digest_mode, is_active) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(
    id,
    userId,
    effectiveQuery,
    normalizedQuery,
    category || null,
    filtersJson,
    sourceId,
    JSON.stringify(finalSourceIds),
    categoriesJson,
    noticesJson,
    isVerified ? 1 : 0,
    digestMode
  );

  // Create a notification telling the user what is stored
  const notifId = generateId();
  const catsDesc = monitoredCategories && monitoredCategories.length > 0 ? monitoredCategories.join(', ') : 'all notices';
  const storedDesc = `Watching for: "${effectiveQuery}" (${catsDesc}) across ${finalSourceIds.length} source(s).`;

  db.prepare(
    'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)'
  ).run(notifId, userId, 'Form Watch Active', storedDesc, 'info');

  return Response.json({
    id,
    message: 'Form watch created',
    stored: {
      search_query: effectiveQuery,
      source_id: sourceId,
      source_ids: finalSourceIds,
      monitored_categories: monitoredCategories || null,
      selected_notices: selectedNotices || null,
      filters: filters || null,
      explanation: storedDesc,
    },
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const userId = await resolveUser(request);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { alertId, watchId, markAllRead } = await request.json();
  const db = getDb();

  if (alertId) {
    db.prepare('UPDATE watch_alerts SET is_read = 1 WHERE id = ? AND user_id = ?').run(alertId, userId);
  } else if (watchId) {
    db.prepare('UPDATE watch_alerts SET is_read = 1 WHERE watch_id = ? AND user_id = ?').run(watchId, userId);
  } else if (markAllRead) {
    db.prepare('UPDATE watch_alerts SET is_read = 1 WHERE user_id = ?').run(userId);
  }

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const userId = await resolveUser(request);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await request.json();

  if (!id) {
    return Response.json({ error: 'Watch id is required' }, { status: 400 });
  }

  const db = getDb();
  db.prepare('DELETE FROM form_watches WHERE id = ? AND user_id = ?').run(id, userId);
  db.prepare('DELETE FROM watch_alerts WHERE watch_id = ? AND user_id = ?').run(id, userId);

  return Response.json({ message: 'Watch deleted' });
}
