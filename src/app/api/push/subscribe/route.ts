import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, generateId } from '@/lib/db';

/**
 * POST /api/push/subscribe
 * Saves a push subscription for the authenticated user.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const subscription = await request.json();

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return Response.json({ error: 'Invalid push subscription' }, { status: 400 });
  }

  const db = getDb();

  // Upsert: delete old subscription with same endpoint, insert new
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(subscription.endpoint);
  db.prepare(
    'INSERT INTO push_subscriptions (id, user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?, ?)'
  ).run(generateId(), userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);

  return Response.json({ message: 'Subscription saved' });
}

/**
 * DELETE /api/push/subscribe
 * Removes a push subscription.
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { endpoint } = await request.json();
  if (!endpoint) {
    return Response.json({ error: 'Endpoint is required' }, { status: 400 });
  }

  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);

  return Response.json({ message: 'Subscription removed' });
}
