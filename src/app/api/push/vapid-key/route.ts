/**
 * GET /api/push/vapid-key
 * Returns the public VAPID key for the client to use when subscribing.
 */
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return Response.json({ error: 'VAPID not configured' }, { status: 503 });
  }
  return Response.json({ publicKey });
}
