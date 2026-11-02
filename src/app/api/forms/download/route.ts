import { NextRequest } from 'next/server';
import {
  generatePdf,
  generateDocx,
  generateTxt,
  getSanitizedFilename,
} from '@/lib/documentExporter';
import { DocumentSections } from '@/lib/templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title = 'Application_Document',
      sections,
      language = 'en',
      format = 'pdf',
      date,
      kind,
      photoBase64,
    } = body;

    if (!sections) {
      return Response.json({ error: 'sections object is required' }, { status: 400 });
    }

    const docSections = sections as DocumentSections;
    const requestedFormat = (format || 'pdf').toLowerCase();
    const dateStr = date || docSections.date || new Date().toISOString().split('T')[0];
    const docOptions = {
      kind,
      photoBase64,
      dateStr,
    };

    if (requestedFormat === 'pdf') {
      const pdfBuffer = await generatePdf(title, docSections, language as 'en' | 'hi', docOptions);
      const filename = getSanitizedFilename(title, dateStr, 'pdf');

      return new Response(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    } else if (requestedFormat === 'docx') {
      const docxBuffer = await generateDocx(title, docSections, language as 'en' | 'hi', docOptions);
      const filename = getSanitizedFilename(title, dateStr, 'docx');

      return new Response(docxBuffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Content-Length': String(docxBuffer.length),
        },
      });
    } else if (requestedFormat === 'txt') {
      const txtContent = generateTxt(title, docSections, language as 'en' | 'hi', docOptions);
      const filename = getSanitizedFilename(title, dateStr, 'txt');

      return new Response(txtContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    } else {
      return Response.json({ error: `Unsupported format: ${format}. Use 'pdf', 'docx', or 'txt'` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Download route error:', err);
    return Response.json({ error: err.message || 'Failed to generate document download' }, { status: 500 });
  }
}
