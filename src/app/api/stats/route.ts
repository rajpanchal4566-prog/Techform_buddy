import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const db = getDb();

  const forms = db.prepare('SELECT COUNT(*) as count FROM forms WHERE user_id = ?').get(userId) as { count: number };
  const documents = db.prepare('SELECT COUNT(*) as count FROM documents WHERE user_id = ?').get(userId) as { count: number };
  const watches = db.prepare('SELECT COUNT(*) as count FROM form_watches WHERE user_id = ? AND is_active = 1').get(userId) as { count: number };

  return Response.json({
    forms: forms.count,
    documents: documents.count,
    watches: watches.count,
  });
}
