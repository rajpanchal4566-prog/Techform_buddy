import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { runWatcherJob } from '@/lib/watcher';
import { getDb } from '@/lib/db';

/**
 * POST /api/watcher/run
 * Triggers the watcher job. Protected by auth or a shared secret for Cloud Scheduler.
 * Optional body: { sourceId } to check a single source.
 */
export async function POST(request: NextRequest) {
  // Auth: either user session or a scheduler secret
  const schedulerSecret = request.headers.get('x-scheduler-secret');
  const validSecret = process.env.WATCHER_SECRET || 'dev-watcher-secret';

  if (schedulerSecret !== validSecret) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let sourceId: string | undefined;
  try {
    const body = await request.json();
    sourceId = body?.sourceId;
  } catch { /* no body is fine */ }

  try {
    const result = await runWatcherJob(sourceId);
    return Response.json(result);
  } catch (err: any) {
    console.error('[Watcher API] Error running watcher job:', err);
    return Response.json({ error: err.message || 'Internal watcher error', stack: err.stack }, { status: 500 });
  }
}

/**
 * GET /api/watcher/run
 * Returns source statuses (for UI display or scheduled monitor).
 */
export async function GET(request: NextRequest) {
  const schedulerSecret = request.headers.get('x-scheduler-secret');
  const validSecret = process.env.WATCHER_SECRET || 'dev-watcher-secret';

  if (schedulerSecret !== validSecret) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = getDb();
  const showDev = process.env.NODE_ENV === 'development' || process.env.SHOW_TEST_SOURCES === 'true' || request.nextUrl.searchParams.get('dev') === 'true';
  const query = showDev ? 'SELECT * FROM watch_sources ORDER BY name' : "SELECT * FROM watch_sources WHERE category != 'test' ORDER BY name";
  const sources = db.prepare(query).all();

  return Response.json({ sources });
}
