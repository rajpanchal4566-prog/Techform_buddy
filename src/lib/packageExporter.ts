import { PDFDocument } from 'pdf-lib';
import { generatePdf, GenerateDocOptions } from './documentExporter';
import { DocumentSections, TemplateKind } from './templates';

export interface AttachedDocumentPayload {
  name: string;
  type: string;
  data: Buffer;
}

/**
 * Creates a unified downloadable package (merged PDF) containing:
 * 1. The official filled application form/letter with the Enclosures list
 * 2. The attached documents (PDFs, images) appended onto subsequent pages
 */
export async function createMergedPackagePdf(
  title: string,
  sections: DocumentSections,
  language: 'en' | 'hi' = 'en',
  attachedDocs: AttachedDocumentPayload[] = [],
  options?: GenerateDocOptions
): Promise<Buffer> {
  // If no photoBuffer supplied, check if an attached document is a photo
  let photoBuf = options?.photoBuffer;
  if (!photoBuf && attachedDocs && attachedDocs.length > 0) {
    const photoDoc = attachedDocs.find(
      d =>
        (d.type && d.type.toLowerCase().includes('photo')) ||
        (d.name && d.name.toLowerCase().includes('photo'))
    );
    if (photoDoc && photoDoc.data && photoDoc.data.length > 0) {
      photoBuf = photoDoc.data;
    }
  }

  const docOptions: GenerateDocOptions = {
    ...options,
    photoBuffer: photoBuf,
  };

  // 1. Generate main form/letter PDF via PDFKit
  const mainPdfBuffer = await generatePdf(title, sections, language, docOptions);

  // If no attached docs, return main PDF buffer directly
  if (!attachedDocs || attachedDocs.length === 0) {
    return mainPdfBuffer;
  }

  // 2. Load into pdf-lib to merge attached documents
  const mergedPdf = await PDFDocument.create();

  try {
    const mainDoc = await PDFDocument.load(mainPdfBuffer);
    const mainPages = await mergedPdf.copyPages(mainDoc, mainDoc.getPageIndices());
    mainPages.forEach((page) => mergedPdf.addPage(page));
  } catch (err) {
    console.error('[PackageExporter] Error loading main PDF into pdf-lib:', err);
    return mainPdfBuffer;
  }

  // 3. Append each attached document
  for (const doc of attachedDocs) {
    if (!doc.data || doc.data.length === 0) continue;

    try {
      const mime = (doc.type || '').toLowerCase();
      const name = (doc.name || '').toLowerCase();

      if (mime.includes('pdf') || name.endsWith('.pdf')) {
        const subDoc = await PDFDocument.load(doc.data);
        const subPages = await mergedPdf.copyPages(subDoc, subDoc.getPageIndices());
        subPages.forEach((p) => mergedPdf.addPage(p));
      } else if (
        mime.includes('image') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png')
      ) {
        let image;
        if (mime.includes('png') || name.endsWith('.png')) {
          image = await mergedPdf.embedPng(doc.data);
        } else {
          image = await mergedPdf.embedJpg(doc.data);
        }

        // Standard A4 page
        const page = mergedPdf.addPage([595.28, 841.89]);
        const { width, height } = image.scaleToFit(500, 720);

        // Header tag on enclosure page
        page.drawText(`Attached Enclosure: ${doc.name}`, {
          x: 48,
          y: 810,
          size: 10,
        });

        page.drawImage(image, {
          x: (595.28 - width) / 2,
          y: (780 - height) / 2 + 30,
          width,
          height,
        });
      }
    } catch (docErr) {
      console.warn(`[PackageExporter] Skipping attachment "${doc.name}" due to parsing error:`, docErr);
    }
  }

  const mergedBytes = await mergedPdf.save();
  return Buffer.from(mergedBytes);
}

