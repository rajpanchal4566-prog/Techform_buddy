/**
 * Form Watch — Watcher Job Engine (Reworked)
 *
 * Requirements:
 * 1. SCOPE: A watch monitors ONLY the sources selected by the user.
 * 2. RELEVANCE & LLM CLASSIFICATION: registration open, deadline, result, new event.
 *    Extracts title, date, deadline, location/mode, link.
 *    Stores "why this matched" on every alert.
 * 3. DEDUPLICATION: Cross-source alert deduplication.
 * 4. PER-SOURCE STATUS: Detailed status (OK / blocked / timeout / parse error / unsupported),
 *    exact failure reason, last successful check time.
 * 5. ALERTS: Web push + email notification + deadline reminders (7 days and 1 day before).
 * 6. DEV TEST HIDING: Hides Local Test Source unless dev flag is on.
 */

import { getDb, generateId, normalizeWatchQuery } from './db';
import crypto from 'crypto';
import { getEmailProvider } from './emailSender';

// ────────────────── Types ──────────────────

export interface SourceRow {
  id: string;
  name: string;
  url: string;
  domain: string | null;
  type: string; // 'html' | 'json'
  state: string | null;
  category: string | null;
  check_interval: number;
  last_checked_at: string | null;
  last_status: string | null;
  last_error_reason: string | null;
  last_success_at: string | null;
  content_hash: string | null;
}

export interface NoticeItem {
  title: string;
  link: string | null;
  date: string | null;
  rawText: string;
  location_mode?: 'online' | 'offline' | 'hybrid' | string | null;
  eligibility?: 'students' | 'all' | string | null;
}

export interface ClassifiedNotice {
  title: string;
  classification: 'registration_open' | 'deadline' | 'result' | 'new_event' | 'admit_card' | 'other';
  deadline_date: string | null;
  location_mode: 'online' | 'offline' | 'hybrid' | null;
  eligibility: 'students' | 'all' | null;
}

export interface WatchRow {
  id: string;
  user_id: string;
  search_query: string;
  category: string | null;
  source_id: string | null;
  source_ids: string | null; // JSON array of source IDs
  monitored_categories: string | null; // JSON array
  selected_notices: string | null; // JSON array
  filters: string | null; // JSON string
  digest_mode: string | null; // 'instant' | 'daily'
  is_active: number;
}

export interface FailedSourceReport {
  id: string;
  name: string;
  status: 'ok' | 'blocked' | 'timeout' | 'parse_error' | 'unsupported' | 'http_error' | string;
  reason: string;
}

export interface RunResult {
  sourcesChecked: number;
  sourcesSucceeded: number;
  sourcesFailed: FailedSourceReport[];
  itemsFound: number;
  newNotices: number;
  alertsCreated: number;
  allFailed: boolean;
  errors: string[];
}

// ────────────────── Fetch Logic ──────────────────

const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TechFormBuddy/2.0';

export async function fetchSource(source: SourceRow): Promise<{
  body: string;
  status: 'ok' | 'blocked' | 'timeout' | 'parse_error' | 'unsupported' | 'http_error';
  reason: string | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: source.type === 'json' ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (res.status === 401 || res.status === 403) {
      return {
        body: '',
        status: 'blocked',
        reason: `HTTP ${res.status} Forbidden: Automated request blocked by portal security policy`,
      };
    }

    if (!res.ok) {
      return {
        body: '',
        status: 'http_error',
        reason: `HTTP ${res.status} ${res.statusText || 'Server Error'}`,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (source.type === 'json' && !contentType.includes('json') && !source.url.includes('api/test-source')) {
      return {
        body: '',
        status: 'unsupported',
        reason: `Expected JSON feed but received Content-Type: ${contentType}`,
      };
    }

    const body = await res.text();
    return { body, status: 'ok', reason: null };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        body: '',
        status: 'timeout',
        reason: `Connection timed out after ${FETCH_TIMEOUT_MS}ms`,
      };
    }
    return {
      body: '',
      status: 'http_error',
      reason: err.message || 'Network unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────── Extract Notices ──────────────────

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}

function normalizeTitleText(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Extracts notices from JSON feeds.
 */
function extractJsonNotices(body: string): { items: NoticeItem[]; parseError: string | null } {
  try {
    const data = JSON.parse(body);
    const notices = data.notices || data.items || data.events || [];
    const items: NoticeItem[] = notices.map((n: any) => ({
      title: String(n.title || n.name || '').trim(),
      link: n.link || n.url || null,
      date: n.date || n.start_date || null,
      rawText: n.title || n.name || '',
      location_mode: n.location_mode || n.mode || (n.online ? 'online' : null),
      eligibility: n.eligibility || (n.student_eligible ? 'students' : null),
    })).filter((n: NoticeItem) => n.title.length > 0);

    return { items, parseError: null };
  } catch (err: any) {
    return { items: [], parseError: `JSON parse error: ${err.message}` };
  }
}

/**
 * Extracts notices from HTML portals.
 */
function extractHtmlNotices(body: string): NoticeItem[] {
  const notices: NoticeItem[] = [];
  const seen = new Set<string>();

  // 1. Anchors with text content
  const anchorRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(body)) !== null) {
    const href = match[1];
    let text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text.length >= 15 && text.length <= 300 && !seen.has(text)) {
      // Exclude common nav items
      const lower = text.toLowerCase();
      if (
        !lower.includes('skip to') &&
        !lower.includes('screen reader') &&
        !lower.includes('accessibility') &&
        !lower.includes('hyperlink policy') &&
        !lower.includes('terms of use') &&
        !lower.includes('privacy policy')
      ) {
        seen.add(text);
        notices.push({
          title: text,
          link: href.startsWith('http') ? href : null,
          date: null,
          rawText: text,
        });
      }
    }
  }

  // 2. Table cells
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  while ((match = tdRegex.exec(body)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text.length >= 20 && text.length <= 300 && !seen.has(text)) {
      seen.add(text);
      notices.push({ title: text, link: null, date: null, rawText: text });
    }
  }

  return notices.slice(0, 30);
}

// ────────────────── LLM Classification ──────────────────

async function classifyNotices(
  notices: NoticeItem[],
  sourceName: string
): Promise<ClassifiedNotice[]> {
  if (notices.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

  // Heuristic baseline classification
  const defaultClassified: ClassifiedNotice[] = notices.map(n => {
    const lower = n.title.toLowerCase();
    let cls: ClassifiedNotice['classification'] = 'other';
    let mode: 'online' | 'offline' | 'hybrid' | null = (n.location_mode === 'online' || n.location_mode === 'offline' || n.location_mode === 'hybrid') ? n.location_mode : null;
    let elig: 'students' | 'all' | null = (n.eligibility === 'students' || n.eligibility === 'all') ? n.eligibility : null;

    if (lower.includes('apply') || lower.includes('registration open') || lower.includes('online application')) {
      cls = 'registration_open';
    } else if (lower.includes('last date') || lower.includes('deadline') || lower.includes('closing date')) {
      cls = 'deadline';
    } else if (lower.includes('result') || lower.includes('merit list') || lower.includes('score card')) {
      cls = 'result';
    } else if (lower.includes('admit card') || lower.includes('hall ticket') || lower.includes('call letter')) {
      cls = 'admit_card';
    } else if (lower.includes('hackathon') || lower.includes('challenge') || lower.includes('competition') || lower.includes('event')) {
      cls = 'new_event';
    }

    if (lower.includes('online') || lower.includes('virtual')) mode = 'online';
    if (lower.includes('student') || lower.includes('college') || lower.includes('undergraduate')) elig = 'students';

    return {
      title: n.title,
      classification: cls,
      deadline_date: null,
      location_mode: mode,
      eligibility: elig,
    };
  });

  if (!apiKey) return defaultClassified;

  const noticeSummaries = notices.slice(0, 15).map((n, i) =>
    `${i + 1}. "${n.title}" ${n.date ? `(date: ${n.date})` : ''}`
  ).join('\n');

  const prompt = `You are an event, education, and government notice classifier for India.
Source: "${sourceName}"
Below are notice/event titles extracted from this source. For each:
1. Classify as one of: registration_open, deadline, result, new_event, admit_card, other
2. Extract the deadline date if mentioned (ISO format YYYY-MM-DD), or null
3. Extract event mode: "online", "offline", "hybrid", or null
4. Extract student eligibility: "students", "all", or null

Return ONLY a valid JSON array:
[{"index":1,"classification":"registration_open","deadline_date":"2026-11-20","location_mode":"online","eligibility":"students"}, ...]

Notices:
${noticeSummaries}`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

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

    if (!res.ok) {
      return defaultClassified;
    }

    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return defaultClassified;

    const parsed = JSON.parse(rawText) as Array<{
      index: number;
      classification: string;
      deadline_date: string | null;
      location_mode?: string | null;
      eligibility?: string | null;
    }>;

    const validClasses = ['registration_open', 'deadline', 'result', 'new_event', 'admit_card', 'other'];

    return notices.map((n, i) => {
      const found = parsed.find(p => p.index === i + 1);
      const def = defaultClassified[i];
      return {
        title: n.title,
        classification: (found && validClasses.includes(found.classification)
          ? found.classification
          : def.classification) as ClassifiedNotice['classification'],
        deadline_date: found?.deadline_date || null,
        location_mode: (found?.location_mode as any) || def.location_mode,
        eligibility: (found?.eligibility as any) || def.eligibility,
      };
    });
  } catch (err) {
    return defaultClassified;
  }
}

// ────────────────── Scope & Matching ──────────────────

export interface MatchResult {
  matched: boolean;
  whyMatched: string;
}

/**
 * Requirement 1: SCOPE: A watch must monitor ONLY the sources the user selected.
 * Requirement 4: RELEVANCE: Keywords + classification + filters + whyMatched explanation.
 */
export function checkNoticeMatchesWatch(
  notice: NoticeItem & {
    classification?: string;
    deadline_date?: string | null;
    location_mode?: string | null;
    eligibility?: string | null;
  },
  source: SourceRow,
  watch: WatchRow
): MatchResult {
  // 1. STRICT SCOPE CHECK: Watch must contain this source in its source_ids
  let watchSourceIds: string[] = [];
  try {
    if (watch.source_ids) {
      watchSourceIds = JSON.parse(watch.source_ids);
    }
  } catch {}
  if (watchSourceIds.length === 0 && watch.source_id) {
    watchSourceIds = [watch.source_id];
  }

  // If this watch does NOT monitor this source, it NEVER matches!
  if (!watchSourceIds.includes(source.id)) {
    return { matched: false, whyMatched: '' };
  }

  const query = (watch.search_query || '').toLowerCase().trim();
  const title = (notice.title || '').toLowerCase();
  const sourceName = source.name || 'Official Portal';

  // 2. Specific notices check: if the user followed specific discovered notices
  let selectedNotices: string[] = [];
  try {
    if (watch.selected_notices) {
      selectedNotices = JSON.parse(watch.selected_notices);
    }
  } catch {}

  let isSpecificMatch = false;
  if (selectedNotices.length > 0) {
    isSpecificMatch = selectedNotices.some(sn => title.includes(sn.toLowerCase()) || sn.toLowerCase().includes(title));
  }

  // 3. Keyword / Query Match
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);
  const textMatch = queryWords.length === 0 || queryWords.some(word => title.includes(word) || sourceName.toLowerCase().includes(word));

  if (!isSpecificMatch && !textMatch) {
    return { matched: false, whyMatched: '' };
  }

  // 4. Monitored categories filter
  let monitoredCategories: string[] = [];
  try {
    if (watch.monitored_categories) {
      monitoredCategories = JSON.parse(watch.monitored_categories);
    }
  } catch {}

  if (monitoredCategories.length > 0 && notice.classification) {
    const cls = notice.classification;
    const categoryMatches = monitoredCategories.some(mc => {
      if (mc === cls) return true;
      if (mc === 'recruitment' && (cls === 'registration_open' || cls === 'new_event')) return true;
      if (mc === 'registration_open' && cls === 'recruitment') return true;
      if (mc === 'notification') return true;
      if (mc === 'deadline' && cls === 'deadline') return true;
      if (mc === 'result' && cls === 'result') return true;
      if (mc === 'admit_card' && cls === 'admit_card') return true;
      return false;
    });
    if (!categoryMatches) {
      return { matched: false, whyMatched: '' };
    }
  }

  // 5. Additional filters: mode (online/offline), city, student eligibility, deadline
  if (watch.filters) {
    try {
      const filters = JSON.parse(watch.filters);
      // Mode filter: online / offline
      if (filters.mode && filters.mode !== 'all' && notice.location_mode) {
        if (filters.mode.toLowerCase() !== notice.location_mode.toLowerCase() && notice.location_mode !== 'hybrid') {
          return { matched: false, whyMatched: '' };
        }
      }
      // Student eligibility
      if (filters.studentEligible && notice.eligibility && notice.eligibility !== 'students' && notice.eligibility !== 'all') {
        return { matched: false, whyMatched: '' };
      }
      // Location / City
      if (filters.city && filters.city.trim()) {
        const cityFilter = filters.city.toLowerCase().trim();
        if (!title.includes(cityFilter) && notice.location_mode === 'offline') {
          return { matched: false, whyMatched: '' };
        }
      }
      // Deadline within N days
      if (filters.deadlineDays && notice.deadline_date) {
        const deadlineDate = new Date(notice.deadline_date).getTime();
        const now = Date.now();
        const diffDays = (deadlineDate - now) / (1000 * 3600 * 24);
        if (diffDays < 0 || diffDays > Number(filters.deadlineDays)) {
          return { matched: false, whyMatched: '' };
        }
      }
    } catch {}
  }

  // 6. Build transparent "why this matched" reason
  const reasons: string[] = [];
  reasons.push(`Monitored source "${source.name}"`);
  if (isSpecificMatch) {
    reasons.push('followed notice selection');
  } else if (queryWords.length > 0) {
    reasons.push(`keyword "${watch.search_query}"`);
  }
  if (notice.classification) {
    reasons.push(`type: ${notice.classification.replace('_', ' ')}`);
  }
  if (notice.deadline_date) {
    reasons.push(`deadline: ${notice.deadline_date}`);
  }
  if (notice.location_mode) {
    reasons.push(`mode: ${notice.location_mode}`);
  }

  const whyMatched = `Matched ${reasons.join(', ')}`;
  return { matched: true, whyMatched };
}

// ────────────────── Push & Email Notifications ──────────────────

async function sendPushToUser(userId: string, payload: object) {
  try {
    const webpush = await import('web-push');
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return;

    webpush.setVapidDetails('mailto:admin@techformbuddy.local', publicKey, privateKey);
    const db = getDb();
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId) as Array<{
      endpoint: string;
      keys_p256dh: string;
      keys_auth: string;
    }>;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        }
      }
    }
  } catch {}
}

/**
 * Requirement 6 (a): Deadline reminders 7 days and 1 day before.
 */
export async function checkDeadlineReminders(): Promise<{ sent7d: number; sent1d: number }> {
  const db = getDb();
  let sent7d = 0;
  let sent1d = 0;

  try {
    const pendingAlerts = db.prepare(`
      SELECT wa.id, wa.user_id, wa.reminder_sent_7d, wa.reminder_sent_1d,
             wn.title as notice_title, wn.link as notice_link, wn.deadline_date,
             ws.name as source_name, u.email as user_email
      FROM watch_alerts wa
      JOIN watch_notices wn ON wa.notice_id = wn.id
      JOIN watch_sources ws ON wn.source_id = ws.id
      JOIN users u ON wa.user_id = u.id
      WHERE wn.deadline_date IS NOT NULL
    `).all() as any[];

    const now = Date.now();
    for (const a of pendingAlerts) {
      const deadline = new Date(a.deadline_date).getTime();
      const diffDays = (deadline - now) / (1000 * 3600 * 24);

      if (diffDays <= 7 && diffDays > 1 && !a.reminder_sent_7d) {
        db.prepare('UPDATE watch_alerts SET reminder_sent_7d = 1 WHERE id = ?').run(a.id);
        sent7d++;
        if (a.user_email) {
          getEmailProvider().sendEmail({
            to: a.user_email,
            subject: `[7 Days Left] Deadline Reminder: ${a.notice_title}`,
            text: `Reminder: The deadline for "${a.notice_title}" on ${a.source_name} is in 7 days (${a.deadline_date}).`,
            html: `<p>Reminder: The deadline for <strong>${a.notice_title}</strong> on ${a.source_name} is in 7 days (<strong>${a.deadline_date}</strong>).</p>`,
          }).catch(() => {});
        }
        sendPushToUser(a.user_id, {
          title: `7-Day Deadline: ${a.source_name}`,
          body: `${a.notice_title} deadline is in 7 days (${a.deadline_date})`,
          deadline: a.deadline_date,
        }).catch(() => {});
      }

      if (diffDays <= 1 && diffDays >= 0 && !a.reminder_sent_1d) {
        db.prepare('UPDATE watch_alerts SET reminder_sent_1d = 1 WHERE id = ?').run(a.id);
        sent1d++;
        if (a.user_email) {
          getEmailProvider().sendEmail({
            to: a.user_email,
            subject: `[1 Day Left - Final Call] Deadline Tomorrow: ${a.notice_title}`,
            text: `Final Reminder: The deadline for "${a.notice_title}" on ${a.source_name} is tomorrow (${a.deadline_date}).`,
            html: `<p>Final Reminder: The deadline for <strong>${a.notice_title}</strong> on ${a.source_name} is tomorrow (<strong>${a.deadline_date}</strong>).</p>`,
          }).catch(() => {});
        }
        sendPushToUser(a.user_id, {
          title: `1-Day Urgent Deadline: ${a.source_name}`,
          body: `Tomorrow: ${a.notice_title} (${a.deadline_date})`,
          deadline: a.deadline_date,
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.error('[Watcher] Error checking deadline reminders:', err.message);
  }

  return { sent7d, sent1d };
}

// ────────────────── Main Watcher Run ──────────────────

export async function runWatcherJob(sourceIdFilter?: string): Promise<RunResult> {
  const db = getDb();
  const result: RunResult = {
    sourcesChecked: 0,
    sourcesSucceeded: 0,
    sourcesFailed: [],
    itemsFound: 0,
    newNotices: 0,
    alertsCreated: 0,
    allFailed: false,
    errors: [],
  };

  // 1. Fetch sources to check
  let sources: SourceRow[];
  if (sourceIdFilter) {
    sources = db.prepare('SELECT * FROM watch_sources WHERE id = ?').all(sourceIdFilter) as SourceRow[];
  } else {
    // Hide "Local Test Source" unless development mode or SHOW_TEST_SOURCES=true (Requirement 5)
    const isDev = process.env.NODE_ENV === 'development' || process.env.SHOW_TEST_SOURCES === 'true';
    if (isDev) {
      sources = db.prepare('SELECT * FROM watch_sources').all() as SourceRow[];
    } else {
      sources = db.prepare("SELECT * FROM watch_sources WHERE category != 'test'").all() as SourceRow[];
    }
  }

  // 2. Fetch all active watches
  const watches = db.prepare('SELECT * FROM form_watches WHERE is_active = 1').all() as WatchRow[];

  for (const source of sources) {
    result.sourcesChecked++;

    // Fetch source with per-source status & reason
    const { body, status, reason } = await fetchSource(source);

    if (status !== 'ok' || !body) {
      db.prepare(`
        UPDATE watch_sources 
        SET last_checked_at = datetime('now'), last_status = ?, last_error_reason = ? 
        WHERE id = ?
      `).run(status, reason, source.id);

      result.sourcesFailed.push({
        id: source.id,
        name: source.name,
        status,
        reason: reason || 'Unknown error',
      });
      continue;
    }

    // Success update
    db.prepare(`
      UPDATE watch_sources 
      SET last_checked_at = datetime('now'), last_status = 'ok', last_error_reason = NULL, last_success_at = datetime('now') 
      WHERE id = ?
    `).run(source.id);

    // Extract notices
    let items: NoticeItem[] = [];
    if (source.type === 'json') {
      const parsed = extractJsonNotices(body);
      if (parsed.parseError) {
        db.prepare(`
          UPDATE watch_sources 
          SET last_status = 'parse_error', last_error_reason = ? 
          WHERE id = ?
        `).run(parsed.parseError, source.id);

        result.sourcesFailed.push({
          id: source.id,
          name: source.name,
          status: 'parse_error',
          reason: parsed.parseError,
        });
        continue;
      }
      items = parsed.items;
    } else {
      items = extractHtmlNotices(body);
    }

    result.itemsFound += items.length;

    if (items.length === 0) {
      result.sourcesSucceeded++;
      continue;
    }

    // Classify notices via LLM
    const classified = await classifyNotices(items, source.name);

    // Store new notices
    const insertNotice = db.prepare(
      `INSERT INTO watch_notices (id, source_id, title, link, notice_date, classification, deadline_date, location_mode, eligibility, normalized_title, content_hash, raw_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const newNoticeIds: Array<{
      noticeId: string;
      item: NoticeItem;
      classification: string;
      deadline_date: string | null;
      location_mode: string | null;
      eligibility: string | null;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cls = classified[i] || {};
      const itemHash = hashContent(item.title + (item.link || ''));
      const normTitle = normalizeTitleText(item.title);

      const existing = db.prepare(
        'SELECT id FROM watch_notices WHERE source_id = ? AND content_hash = ?'
      ).get(source.id, itemHash);

      if (existing) continue;

      const noticeId = generateId();
      try {
        insertNotice.run(
          noticeId,
          source.id,
          cls.title || item.title,
          item.link,
          item.date,
          cls.classification || 'other',
          cls.deadline_date || null,
          cls.location_mode || item.location_mode || null,
          cls.eligibility || item.eligibility || null,
          normTitle,
          itemHash,
          item.rawText
        );
        result.newNotices++;
        newNoticeIds.push({
          noticeId,
          item,
          classification: cls.classification || 'other',
          deadline_date: cls.deadline_date || null,
          location_mode: cls.location_mode || item.location_mode || null,
          eligibility: cls.eligibility || item.eligibility || null,
        });
      } catch (err: any) {
        if (!err.message?.includes('UNIQUE')) {
          result.errors.push(`Insert notice: ${err.message}`);
        }
      }
    }

    // Match new notices against active watches
    const insertAlert = db.prepare(
      `INSERT OR IGNORE INTO watch_alerts (id, user_id, watch_id, notice_id, notified_via, why_matched, normalized_notice_title) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertNotif = db.prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)`
    );

    for (const { noticeId, item, classification, deadline_date, location_mode, eligibility } of newNoticeIds) {
      const noticeWithClass = { ...item, classification, deadline_date, location_mode, eligibility };
      const normTitle = normalizeTitleText(item.title);

      for (const watch of watches) {
        // Requirement 1 & 4: Strict scope check & matching logic
        const matchRes = checkNoticeMatchesWatch(noticeWithClass, source, watch);
        if (!matchRes.matched) continue;

        // Requirement 4: Cross-source alert deduplication
        // If the user was already alerted for this notice title within the last 30 days, skip duplicate!
        const existingAlert = db.prepare(`
          SELECT wa.id 
          FROM watch_alerts wa 
          JOIN watch_notices wn ON wa.notice_id = wn.id
          WHERE wa.user_id = ? AND (wn.normalized_title = ? OR wn.title = ?)
          AND datetime(wa.created_at) >= datetime('now', '-30 days')
        `).get(watch.user_id, normTitle, item.title);

        if (existingAlert) {
          continue;
        }

        const alertId = generateId();
        try {
          insertAlert.run(alertId, watch.user_id, watch.id, noticeId, 'in_app', matchRes.whyMatched, normTitle);
          result.alertsCreated++;

          // In-app notification
          const deadlineStr = deadline_date ? ` | Deadline: ${deadline_date}` : '';
          const notifId = generateId();
          insertNotif.run(
            notifId,
            watch.user_id,
            `📋 ${classification === 'registration_open' ? 'Registration Open' : classification === 'deadline' ? 'Deadline Alert' : classification === 'result' ? 'Result Published' : classification === 'new_event' ? 'New Event / Hackathon' : 'Notice Update'}`,
            `${item.title} — ${source.name}${deadlineStr}`,
            classification === 'deadline' ? 'warning' : 'info',
            item.link
          );

          // Web Push Notification
          await sendPushToUser(watch.user_id, {
            title: `TechForm Buddy: ${source.name}`,
            body: `${item.title}${deadlineStr}\n${matchRes.whyMatched}`,
            source: source.name,
            deadline: deadline_date || null,
            why_matched: matchRes.whyMatched,
            form_url: item.link || null,
            url: item.link ? `/form-watch?open=${encodeURIComponent(item.link)}&title=${encodeURIComponent(item.title)}` : '/form-watch',
            tag: noticeId,
          });

          // Email Notification (Requirement 6a)
          const userRow = db.prepare('SELECT email, name FROM users WHERE id = ?').get(watch.user_id) as { email?: string; name?: string } | undefined;
          if (userRow?.email && watch.digest_mode !== 'daily') {
            try {
              const emailProvider = getEmailProvider();
              await emailProvider.sendEmail({
                to: userRow.email,
                subject: `[TechForm Buddy Alert] ${item.title} — ${source.name}`,
                text: `New update from ${source.name}:\n\n${item.title}\n${deadlineStr}\nWhy matched: ${matchRes.whyMatched}\n\nOfficial Link: ${item.link || 'N/A'}\nOpen in TechForm Buddy: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/form-watch`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #2563eb; margin-top: 0;">${source.name} Update</h2>
                    <h3 style="color: #1e293b;">${item.title}</h3>
                    ${deadline_date ? `<p style="color: #dc2626; font-weight: bold;">📅 Deadline: ${deadline_date}</p>` : ''}
                    <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 10px 14px; margin: 16px 0; font-size: 13px; color: #475569;">
                      <strong>Why this matched:</strong> ${matchRes.whyMatched}
                    </div>
                    <div style="margin-top: 24px;">
                      ${item.link ? `<a href="${item.link}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Official Notice ↗</a>` : ''}
                    </div>
                  </div>
                `,
              });
            } catch (err: any) {
              console.warn('[Watcher] Failed to send email alert:', err.message);
            }
          }
        } catch { /* ignore duplicate alert constraint */ }
      }
    }

    result.sourcesSucceeded++;
    await new Promise(r => setTimeout(r, 200));
  }

  // Check deadline reminders
  await checkDeadlineReminders();

  result.allFailed = result.sourcesChecked > 0 && result.sourcesSucceeded === 0;

  // Update last_checked on active form_watches
  try {
    db.prepare("UPDATE form_watches SET last_checked = datetime('now') WHERE is_active = 1").run();
  } catch {}

  return result;
}
