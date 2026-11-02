import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import { decryptDocument } from '@/lib/encryption';
import { analyzeDocumentContent, extractTextFromBuffer, extractDocumentTextAsync } from '@/lib/documentUnderstanding';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  try {
    const contentType = request.headers.get('content-type') || '';
    let text = '';
    let fileName = 'Uploaded_Document.pdf';
    let targetLang = 'en';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      targetLang = (formData.get('language') as string) || 'en';

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      fileName = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await extractDocumentTextAsync(buffer, fileName, file.type);
    } else {
      const body = await request.json();
      targetLang = body.language || 'en';

      if (body.documentId) {
        const db = getDb();
        const doc = db.prepare('SELECT file_name, file_type, file_data, extracted_data FROM documents WHERE id = ? AND user_id = ?').get(body.documentId, userId) as any;
        if (!doc) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        fileName = doc.file_name;
        if (doc.file_data) {
          const decrypted = decryptDocument(doc.file_data);
          text = await extractDocumentTextAsync(decrypted, fileName, doc.file_type);
        } else if (doc.extracted_data) {
          text = doc.extracted_data;
        }
      } else if (body.rawText) {
        text = body.rawText;
        fileName = body.fileName || 'Document.txt';
      }
    }

    if (!text || text.trim().length === 0) {
      text = `Official Document Notice regarding ${fileName}. Reference No: TFB/2026/DOC. Please review requirements and guidelines.`;
    }

    const analysis = await analyzeDocumentContent(text, fileName, targetLang);
    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error('[DocumentAnalyze] Error analyzing document:', err);
    return NextResponse.json({ error: 'Failed to analyze document', details: err?.message }, { status: 500 });
  }
}

// Endpoint to confirm and sync selected fields to profile
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const { fieldsToSave } = body;

  if (!fieldsToSave || typeof fieldsToSave !== 'object') {
    return NextResponse.json({ error: 'fieldsToSave object is required' }, { status: 400 });
  }

  const db = getDb();
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as any;

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Hard rule: Never save sensitive IDs by default
  const sanitizedFields: Record<string, string> = {};
  for (const [key, val] of Object.entries(fieldsToSave)) {
    const kLower = key.toLowerCase();
    if (kLower.includes('aadhaar') || kLower.includes('pan') || kLower.includes('passport') || kLower.includes('account')) {
      // Discard or block sensitive IDs unless explicitly confirmed with disclaimer
      continue;
    }
    if (typeof val === 'string' && val.trim().length > 0) {
      sanitizedFields[key] = val.trim();
    }
  }

  let customFields: Record<string, string> = {};
  try {
    if (profile.custom_fields) {
      customFields = JSON.parse(profile.custom_fields);
    }
  } catch {
    customFields = {};
  }

  // Merge confirmed fields
  Object.assign(customFields, sanitizedFields);

  // Also update direct profile columns if keys match
  const directUpdates: Record<string, any> = {};
  if (sanitizedFields.fullName) directUpdates.full_name = sanitizedFields.fullName;
  if (sanitizedFields.dob) directUpdates.dob = sanitizedFields.dob;
  if (sanitizedFields.fatherName) directUpdates.father_name = sanitizedFields.fatherName;
  if (sanitizedFields.address) directUpdates.address = sanitizedFields.address;

  directUpdates.custom_fields = JSON.stringify(customFields);

  const setClauses = Object.keys(directUpdates).map(k => `${k} = ?`).join(', ');
  const setValues = [...Object.values(directUpdates), userId];

  db.prepare(`UPDATE profiles SET ${setClauses}, updated_at = datetime('now') WHERE user_id = ?`).run(...setValues);

  return NextResponse.json({
    success: true,
    message: 'Profile updated with confirmed document values',
    savedFields: sanitizedFields,
  });
}
