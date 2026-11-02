import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, generateId } from '@/lib/db';
import { checkAccountPermission } from '@/lib/authGuard';
import { deriveCleanFormTitle, getTemplateById } from '@/lib/templates';

export async function GET(request: NextRequest) {
  let userId: string | null = null;
  const schedulerSecret = request.headers.get('x-scheduler-secret');
  if (schedulerSecret === (process.env.WATCHER_SECRET || 'dev-watcher-secret')) {
    const db = getDb();
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined;
    userId = firstUser?.id || null;
  } else {
    const session = await getServerSession(authOptions);
    userId = (session?.user as { id: string } | undefined)?.id || null;
  }

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const limit = request.nextUrl.searchParams.get('limit') || '50';

  const forms = db.prepare(
    'SELECT id, title, description, category, status, language, source_url, document_content, template_id, created_at, updated_at FROM forms WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?'
  ).all(userId, parseInt(limit));

  return Response.json(forms);
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  const schedulerSecret = request.headers.get('x-scheduler-secret');
  if (schedulerSecret === (process.env.WATCHER_SECRET || 'dev-watcher-secret')) {
    const db = getDb();
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined;
    userId = firstUser?.id || 'dev-user';
  } else {
    const session = await getServerSession(authOptions);
    userId = (session?.user as { id: string } | undefined)?.id || null;
  }

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check unverified account limits (Requirement 2 & 5)
  const permission = checkAccountPermission(userId, 'create_form');
  if (!permission.allowed) {
    return Response.json(
      { error: permission.reason, requiresVerification: true },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    title,
    description,
    category,
    fields,
    filledData,
    status = 'draft',
    sourceUrl,
    language = 'en',
    documentContent,
    templateId,
  } = body;

  if (!title) {
    return Response.json({ error: 'Title is required' }, { status: 400 });
  }

  const tmpl = templateId ? getTemplateById(templateId) : undefined;
  let applicantName: string | undefined = undefined;
  if (filledData && typeof filledData === 'object') {
    applicantName = (filledData as any).applicant_name || (filledData as any).student_name || (filledData as any).account_holder_name;
  }
  const cleanTitle = deriveCleanFormTitle(tmpl || title, applicantName, (language || 'en') as 'en' | 'hi');

  const db = getDb();
  const id = generateId();

  const fieldsJson = fields ? (typeof fields === 'string' ? fields : JSON.stringify(fields)) : '[]';
  const filledJson = filledData ? (typeof filledData === 'string' ? filledData : JSON.stringify(filledData)) : '{}';
  const docContentJson = documentContent ? (typeof documentContent === 'string' ? documentContent : JSON.stringify(documentContent)) : null;

  db.prepare(
    `INSERT INTO forms (id, user_id, title, description, category, fields, filled_data, status, source_url, language, document_content, template_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    cleanTitle,
    description || '',
    category || 'general',
    fieldsJson,
    filledJson,
    status,
    sourceUrl || '',
    language,
    docContentJson,
    templateId || null
  );

  return Response.json({ id, message: 'Form created successfully', status }, { status: 201 });
}
