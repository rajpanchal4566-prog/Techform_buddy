import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import { decryptDocument } from '@/lib/encryption';

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

  // Strict owner-only access (Requirement 3)
  const doc = db
    .prepare('SELECT file_name, file_type, file_size, file_data FROM documents WHERE id = ? AND user_id = ?')
    .get(id, userId) as { file_name: string; file_type: string; file_size: number; file_data: Buffer } | undefined;

  if (!doc) {
    return Response.json({ error: 'Document not found or access denied' }, { status: 404 });
  }

  // Decrypt document at rest
  const decrypted = decryptDocument(doc.file_data);

  return new Response(decrypted as any, {
    headers: {
      'Content-Type': doc.file_type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.file_name)}"`,
      'Content-Length': String(decrypted.length),
    },
  });
}

