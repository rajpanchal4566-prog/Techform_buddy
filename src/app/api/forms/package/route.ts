import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import { decryptDocument } from '@/lib/encryption';
import { createMergedPackagePdf, AttachedDocumentPayload } from '@/lib/packageExporter';
import { DocumentSections } from '@/lib/templates';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions).catch(() => null);
  const body = await request.json();
  const {
    title = 'Application_Document',
    sections,
    language = 'en',
    attachedDocIds = [],
    directAttachments = [],
    kind,
    photoBase64,
  } = body;

  if (!sections) {
    return Response.json({ error: 'sections object is required' }, { status: 400 });
  }

  const docSections = sections as DocumentSections;
  const attachedPayloads: AttachedDocumentPayload[] = [];

  // If user is authenticated and attachedDocIds provided, fetch & decrypt from database
  if (session?.user && Array.isArray(attachedDocIds) && attachedDocIds.length > 0) {
    const userId = (session.user as { id: string }).id;
    const db = getDb();

    for (const docId of attachedDocIds) {
      const docRow = db
        .prepare('SELECT file_name, file_type, file_data FROM documents WHERE id = ? AND user_id = ?')
        .get(docId, userId) as { file_name: string; file_type: string; file_data: Buffer } | undefined;

      if (docRow && docRow.file_data) {
        attachedPayloads.push({
          name: docRow.file_name,
          type: docRow.file_type,
          data: decryptDocument(docRow.file_data),
        });
      }
    }
  }

  // Handle direct base64 attachments if provided
  if (Array.isArray(directAttachments)) {
    for (const att of directAttachments) {
      if (att.data && att.name) {
        const buf = Buffer.from(att.data, att.encoding === 'base64' ? 'base64' : 'utf-8');
        attachedPayloads.push({
          name: att.name,
          type: att.type || 'application/pdf',
          data: buf,
        });
      }
    }
  }

  const packagePdf = await createMergedPackagePdf(
    title,
    docSections,
    language as 'en' | 'hi',
    attachedPayloads,
    { kind, photoBase64 }
  );

  const cleanName = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

  return new Response(packagePdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cleanName}_Package.pdf"`,
      'Content-Length': String(packagePdf.length),
    },
  });
}

