import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions).catch(() => null);
  const { id } = await params;
  const db = getDb();

  let form: any;
  if (session?.user) {
    const userId = (session.user as { id: string }).id;
    form = db.prepare('SELECT * FROM forms WHERE id = ? AND user_id = ?').get(id, userId);
  } else {
    const secret = request.headers.get('x-scheduler-secret');
    if (secret === (process.env.WATCHER_SECRET || 'dev-watcher-secret')) {
      form = db.prepare('SELECT * FROM forms WHERE id = ?').get(id);
    }
  }

  if (!form) {
    return Response.json({ error: 'Form not found or unauthorized' }, { status: 404 });
  }

  return Response.json(form);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions).catch(() => null);
  const { id } = await params;
  const db = getDb();

  let userId: string | null = null;
  if (session?.user) {
    userId = (session.user as { id: string }).id;
  } else {
    const secret = request.headers.get('x-scheduler-secret');
    if (secret === (process.env.WATCHER_SECRET || 'dev-watcher-secret')) {
      const existingAny = db.prepare('SELECT user_id FROM forms WHERE id = ?').get(id) as { user_id: string } | undefined;
      userId = existingAny?.user_id || null;
    }
  }

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    description,
    category,
    fields,
    filledData,
    status,
    sourceUrl,
    language,
    documentContent,
    templateId,
  } = body;

  const existing = db.prepare('SELECT id FROM forms WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    return Response.json({ error: 'Form not found' }, { status: 404 });
  }

  const fieldsJson = fields !== undefined ? (typeof fields === 'string' ? fields : JSON.stringify(fields)) : null;
  const filledJson = filledData !== undefined ? (typeof filledData === 'string' ? filledData : JSON.stringify(filledData)) : null;
  const docJson = documentContent !== undefined ? (typeof documentContent === 'string' ? documentContent : JSON.stringify(documentContent)) : null;

  db.prepare(
    `UPDATE forms SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      category = COALESCE(?, category),
      fields = COALESCE(?, fields),
      filled_data = COALESCE(?, filled_data),
      status = COALESCE(?, status),
      source_url = COALESCE(?, source_url),
      language = COALESCE(?, language),
      document_content = COALESCE(?, document_content),
      template_id = COALESCE(?, template_id),
      updated_at = datetime('now')
    WHERE id = ? AND user_id = ?`
  ).run(
    title,
    description,
    category,
    fieldsJson,
    filledJson,
    status,
    sourceUrl,
    language,
    docJson,
    templateId,
    id,
    userId
  );

  return Response.json({ message: 'Form updated successfully' });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions).catch(() => null);
  const { id } = await params;
  const db = getDb();

  let userId: string | null = null;
  if (session?.user) {
    userId = (session.user as { id: string }).id;
  } else {
    const secret = request.headers.get('x-scheduler-secret');
    if (secret === (process.env.WATCHER_SECRET || 'dev-watcher-secret')) {
      const existingAny = db.prepare('SELECT user_id FROM forms WHERE id = ?').get(id) as { user_id: string } | undefined;
      userId = existingAny?.user_id || null;
    }
  }

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  db.prepare('DELETE FROM forms WHERE id = ? AND user_id = ?').run(id, userId);

  return Response.json({ message: 'Form deleted successfully' });
}
