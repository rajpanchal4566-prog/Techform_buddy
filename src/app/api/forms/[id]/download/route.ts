import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import {
  generatePdf,
  generateDocx,
  generateTxt,
  getSanitizedFilename,
} from '@/lib/documentExporter';
import { DocumentSections } from '@/lib/templates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const { id } = await params;
    const format = (request.nextUrl.searchParams.get('format') || 'pdf').toLowerCase();

    const db = getDb();
    let form: any;

    if (session?.user) {
      const userId = (session.user as { id: string }).id;
      form = db.prepare('SELECT * FROM forms WHERE id = ? AND user_id = ?').get(id, userId);
    } else {
      // Allow if request has a scheduler secret or dev token
      const secret = request.headers.get('x-scheduler-secret');
      if (secret === (process.env.WATCHER_SECRET || 'dev-watcher-secret')) {
        form = db.prepare('SELECT * FROM forms WHERE id = ?').get(id);
      }
    }

    if (!form) {
      return Response.json({ error: 'Form not found or unauthorized' }, { status: 404 });
    }

    let sections: DocumentSections;
    if (form.document_content) {
      try {
        sections = JSON.parse(form.document_content);
      } catch {
        sections = {
          header: form.title,
          date: form.created_at,
          subject: form.title,
          salutation: 'Respected Sir/Madam,',
          body: form.description || 'Application Details',
          closing: 'Yours faithfully,',
          signature: form.user_id,
        };
      }
    } else {
      // Derive sections from fields & filled_data
      let filled: Record<string, string> = {};
      try {
        filled = JSON.parse(form.filled_data || '{}');
      } catch {}

      sections = {
        header: form.title,
        date: form.created_at,
        subject: `Subject: Application for ${form.title}`,
        salutation: 'Respected Sir/Madam,',
        body: Object.entries(filled).map(([k, v]) => `${k}: ${v}`).join('\n'),
        closing: 'Yours faithfully,',
        signature: 'Applicant Signature',
      };
    }

    const title = form.title || 'Application_Document';
    const dateStr = form.created_at || new Date().toISOString().split('T')[0];
    const lang = (form.language === 'hi' ? 'hi' : 'en') as 'en' | 'hi';

    if (format === 'pdf') {
      const pdfBuffer = await generatePdf(title, sections, lang);
      const filename = getSanitizedFilename(title, dateStr, 'pdf');
      return new Response(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    } else if (format === 'docx') {
      const docxBuffer = await generateDocx(title, sections, lang);
      const filename = getSanitizedFilename(title, dateStr, 'docx');
      return new Response(docxBuffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Content-Length': String(docxBuffer.length),
        },
      });
    } else {
      const txtContent = generateTxt(title, sections, lang);
      const filename = getSanitizedFilename(title, dateStr, 'txt');
      return new Response(txtContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }
  } catch (err: any) {
    console.error('Download form by ID error:', err);
    return Response.json({ error: err.message || 'Failed to download form' }, { status: 500 });
  }
}
