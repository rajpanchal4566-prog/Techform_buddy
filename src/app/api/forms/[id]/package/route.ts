import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import { decryptDocument } from '@/lib/encryption';
import { createMergedPackagePdf, AttachedDocumentPayload } from '@/lib/packageExporter';
import { DocumentSections } from '@/lib/templates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions).catch(() => null);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { id } = await params;
  const db = getDb();

  const form = db.prepare('SELECT * FROM forms WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!form) {
    return Response.json({ error: 'Form not found or unauthorized' }, { status: 404 });
  }

  let docSections: DocumentSections;
  try {
    docSections = form.document_content
      ? typeof form.document_content === 'string'
        ? JSON.parse(form.document_content)
        : form.document_content
      : {
          header: form.title,
          date: new Date().toISOString().split('T')[0],
          subject: form.title,
          salutation: 'Respected Authority,',
          body: form.description || 'Application submission.',
          closing: 'Yours faithfully,',
          signature: (session.user as any).name || 'Applicant',
        };
  } catch {
    docSections = {
      header: form.title,
      date: new Date().toISOString().split('T')[0],
      subject: form.title,
      salutation: 'Respected Authority,',
      body: form.description || '',
      closing: 'Yours faithfully,',
      signature: (session.user as any).name || 'Applicant',
    };
  }

  // Parse attached documents from filled_data or document_content.enclosures
  let filledMap: Record<string, any> = {};
  try {
    if (form.filled_data) {
      filledMap = typeof form.filled_data === 'string' ? JSON.parse(form.filled_data) : form.filled_data;
    }
  } catch {}

  const attachedDocIds: string[] = [];
  if (Array.isArray(filledMap.attachedDocumentIds)) {
    attachedDocIds.push(...filledMap.attachedDocumentIds);
  }
  // Check any field with _doc_id or documentId
  Object.entries(filledMap).forEach(([k, v]) => {
    if ((k.includes('document') || k.includes('doc_')) && typeof v === 'string' && v.length > 5) {
      if (!attachedDocIds.includes(v)) attachedDocIds.push(v);
    }
  });

  const attachedPayloads: AttachedDocumentPayload[] = [];
  for (const docId of attachedDocIds) {
    const docRow = db
      .prepare('SELECT file_name, file_type, file_data FROM documents WHERE id = ? AND user_id = ?')
      .get(docId, userId) as { file_name: string; file_type: string; file_data: Buffer } | undefined;

    if (docRow && docRow.file_data) {
      const decryptedData = decryptDocument(docRow.file_data);
      attachedPayloads.push({
        name: docRow.file_name,
        type: docRow.file_type,
        data: decryptedData,
      });
    }
  }

  const title = form.title || 'Application_Package';
  const language = form.language === 'hi' ? 'hi' : 'en';

  const packagePdfBuffer = await createMergedPackagePdf(
    title,
    docSections,
    language,
    attachedPayloads
  );

  const cleanName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

  return new Response(packagePdfBuffer as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cleanName}_Package.pdf"`,
      'Content-Length': String(packagePdfBuffer.length),
    },
  });
}

