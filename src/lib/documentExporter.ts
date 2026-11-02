/**
 * Document Exporter Utility
 *
 * Multi-Kind Document Architecture:
 * - application_form: Form title, photo box (top-right), two-column fields table (label: value),
 *                     short cover note (first-person), declaration, signature block, enclosures, footer.
 * - resume:           ATS-friendly single-column resume with clean contact line, summary, education,
 *                     skills, projects, experience, certifications, and languages.
 * - letter:           Formal Indian official letter (To, Date, Subject, Salutation, Body, Closing, Signature, Enclosures).
 *
 * Generates PDF (via PDFKit with embedded Noto Sans Devanagari font),
 * DOCX (via docx package with Devanagari font formatting),
 * and clean formatted TXT documents.
 */

import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  Footer,
} from 'docx';
import path from 'path';
import fs from 'fs';
import { DocumentSections, TemplateKind, sanitizeEnclosureTitle } from './templates';

export interface GenerateDocOptions {
  kind?: TemplateKind;
  photoBuffer?: Buffer;
  photoBase64?: string;
  dateStr?: string;
}

export function getSanitizedFilename(title: string, dateStr: string, ext: 'pdf' | 'docx' | 'txt'): string {
  let dateFormatted = dateStr;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      dateFormatted = d.toISOString().split('T')[0];
    }
  } catch {
    dateFormatted = new Date().toISOString().split('T')[0];
  }

  const cleanTitle = (title || 'Application_Document')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);

  return `${cleanTitle}_${dateFormatted}.${ext}`;
}

export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text || '');
}

function resolvePhotoBuffer(options?: GenerateDocOptions, sections?: DocumentSections): Buffer | undefined {
  if (options?.photoBuffer && options.photoBuffer.length > 0) {
    return options.photoBuffer;
  }
  const b64 = options?.photoBase64 || sections?.photoBase64;
  if (b64 && typeof b64 === 'string' && b64.trim().length > 0) {
    try {
      const clean = b64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
      return Buffer.from(clean, 'base64');
    } catch {}
  }
  return undefined;
}

function detectDocumentKind(title: string, sections: DocumentSections, explicitKind?: TemplateKind): TemplateKind {
  if (explicitKind) return explicitKind;
  const lowerTitle = (title || '').toLowerCase();
  if (lowerTitle.includes('resume') || lowerTitle.includes('cv') || lowerTitle.includes('बायोडाटा') || lowerTitle.includes('curriculum vitae')) {
    return 'resume';
  }
  if (
    sections.fieldsTable && sections.fieldsTable.length > 0 ||
    lowerTitle.includes('internship') ||
    lowerTitle.includes('form') ||
    lowerTitle.includes('प्रारूप') ||
    lowerTitle.includes('आवेदन पत्र')
  ) {
    return 'application_form';
  }
  return 'letter';
}

/**
 * ----------------------------------------------------------------------
 * 1. APPLICATION FORM PDF RENDERER (kind: application_form)
 * ----------------------------------------------------------------------
 */
function renderApplicationFormPdf(
  doc: PDFKit.PDFDocument,
  title: string,
  sections: DocumentSections,
  isHindi: boolean,
  fontRegular: string,
  fontBold: string,
  photoBuffer?: Buffer
) {
  // Title Header
  doc.font(fontBold).fontSize(14).fillColor('#0f172a').text(title.toUpperCase(), 54, 45, { align: 'center', width: 487 });
  doc.strokeColor('#0284c7').lineWidth(1.5).moveTo(54, 68).lineTo(541, 68).stroke();

  // Top Section: Metadata on Left, Photo Box on Right (x: 435, y: 76, width: 95, height: 115)
  const photoX = 435;
  const photoY = 76;
  const photoW = 95;
  const photoH = 115;

  if (photoBuffer && photoBuffer.length > 0) {
    try {
      doc.rect(photoX, photoY, photoW, photoH).lineWidth(1).stroke('#cbd5e1');
      doc.image(photoBuffer, photoX + 2, photoY + 2, {
        width: photoW - 4,
        height: photoH - 4,
        fit: [photoW - 4, photoH - 4],
        align: 'center',
        valign: 'center',
      });
    } catch {
      // Fallback if image buffer is corrupted
      doc.rect(photoX, photoY, photoW, photoH).lineWidth(1).stroke('#94a3b8');
      doc.font(fontRegular).fontSize(8).fillColor('#64748b').text(isHindi ? 'पासपोर्ट फोटो' : 'Affix Photo', photoX, photoY + 45, { width: photoW, align: 'center' });
    }
  } else {
    doc.rect(photoX, photoY, photoW, photoH).lineWidth(1).stroke('#94a3b8');
    doc.font(fontRegular).fontSize(8).fillColor('#64748b').text(
      isHindi ? 'पासपोर्ट साइज फोटो\nयहाँ चिपकाएं' : 'Affix Recent\nPassport Size\nPhotograph',
      photoX,
      photoY + 38,
      { width: photoW, align: 'center', lineGap: 3 }
    );
  }

  // Left Metadata Block
  const metaW = 370;
  let metaY = 76;

  if (sections.subject) {
    doc.font(fontBold).fontSize(10).fillColor('#0f172a').text(sections.subject, 54, metaY, { width: metaW, lineGap: 3 });
    metaY = doc.y + 4;
  }

  if (sections.header && sections.header.trim().length > 0) {
    doc.font(fontRegular).fontSize(9).fillColor('#334155');
    const headerLines = sections.header.split('\n').filter(Boolean);
    for (const hl of headerLines) {
      doc.text(hl.trim(), 54, metaY, { width: metaW });
      metaY += 12;
    }
    metaY += 4;
  }

  if (sections.date) {
    doc.font(fontRegular).fontSize(9).fillColor('#64748b').text(sections.date, 54, metaY, { width: metaW });
    metaY += 14;
  }

  // Two-Column Table of Fields (Label : Value)
  let curY = Math.max(metaY + 10, photoY + photoH + 12);

  // Table Banner
  doc.rect(54, curY, 487, 18).fill('#1e293b');
  doc.font(fontBold).fontSize(9).fillColor('#ffffff').text(
    isHindi ? 'आवेदक का विवरण एवं शैक्षणिक योग्यता' : 'APPLICANT PARTICULARS & DETAILS',
    62,
    curY + 4
  );
  curY += 18;

  const rows = sections.fieldsTable || [];
  const col1W = 155;
  const col2W = 332;

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const valText = String(r.value || '').trim();
    doc.font(fontRegular).fontSize(8.5);
    const valHeight = doc.heightOfString(valText, { width: col2W - 12 });
    const rowHeight = Math.max(18, valHeight + 6);

    // Page break guard
    if (curY + rowHeight > 750) {
      doc.addPage();
      curY = 50;
    }

    // Alternating fill
    if (idx % 2 === 0) {
      doc.rect(54, curY, 487, rowHeight).fill('#f8fafc');
    }

    // Border lines
    doc.rect(54, curY, 487, rowHeight).lineWidth(0.5).stroke('#e2e8f0');
    doc.moveTo(54 + col1W, curY).lineTo(54 + col1W, curY + rowHeight).stroke('#e2e8f0');

    // Label & Value text
    doc.font(fontBold).fontSize(8.5).fillColor('#334155').text(r.label, 60, curY + 4, { width: col1W - 10 });
    doc.font(fontRegular).fontSize(8.5).fillColor('#0f172a').text(valText, 54 + col1W + 6, curY + 4, { width: col2W - 12 });

    curY += rowHeight;
  }

  // Cover Note / Statement of Purpose (max 3-4 sentences in first-person)
  const coverNote = sections.coverNote || sections.body || '';
  if (coverNote.trim().length > 0) {
    curY += 10;
    if (curY + 60 > 750) {
      doc.addPage();
      curY = 50;
    }

    doc.font(fontBold).fontSize(9.5).fillColor('#0f172a').text(
      isHindi ? 'उद्देश्य विवरण (Statement of Purpose):' : 'STATEMENT OF PURPOSE / APPLICANT OBJECTIVE:',
      54,
      curY
    );
    curY += 14;

    doc.font(fontRegular).fontSize(8.5).fillColor('#1e293b').text(coverNote.trim(), 54, curY, {
      width: 487,
      align: 'justify',
      lineGap: 3,
    });
    curY = doc.y + 10;
  }

  // Declaration
  const declaration = sections.declaration || (isHindi
    ? 'मैं एतद्द्वारा सत्यनिष्ठा से घोषणा करता/करती हूँ कि इस आवेदन में प्रस्तुत किए गए समस्त विवरण मेरी सर्वोत्तम जानकारी व विश्वास के अनुसार पूर्णतः सत्य एवं सही हैं।'
    : 'I hereby solemnly declare that all the information and particulars furnished in this application form are true, complete, and correct to the best of my personal knowledge and belief.');

  if (curY + 45 > 750) {
    doc.addPage();
    curY = 50;
  }

  doc.font(fontBold).fontSize(9).fillColor('#0f172a').text(isHindi ? 'सत्यनिष्ठा घोषणा (Declaration):' : 'SOLEMN DECLARATION:', 54, curY);
  curY += 12;

  doc.font(fontRegular).fontSize(8).fillColor('#475569').text(declaration.trim(), 54, curY, {
    width: 487,
    align: 'justify',
    lineGap: 2,
  });
  curY = doc.y + 14;

  // Signature Block (Date, Place on Left, Applicant Signature on Right)
  if (curY + 65 > 745) {
    doc.addPage();
    curY = 50;
  }

  doc.font(fontRegular).fontSize(8.5).fillColor('#334155');
  doc.text(sections.date || (isHindi ? 'दिनांक: _____________' : 'Date: _____________'), 54, curY);
  doc.text(sections.place || (isHindi ? 'स्थान: _____________' : 'Place: _____________'), 54, curY + 14);

  doc.font(fontBold).fontSize(8.5).fillColor('#0f172a');
  doc.text('____________________________________', 340, curY, { align: 'right', width: 200 });
  doc.text(isHindi ? 'आवेदक के हस्ताक्षर (Signature of Applicant)' : 'Signature of Applicant', 340, curY + 12, { align: 'right', width: 200 });

  if (sections.signature) {
    const sigLine = sections.signature.split('\n')[0].replace(/^\(Signature of Applicant\)/i, '').trim();
    if (sigLine) {
      doc.font(fontRegular).fontSize(8.5).fillColor('#334155').text(sigLine, 340, curY + 24, { align: 'right', width: 200 });
    }
  }
  curY += 45;

  // Enclosures List (Clean Single Numbering - Requirement 6)
  if (sections.enclosures && sections.enclosures.length > 0) {
    if (curY + (sections.enclosures.length * 12) + 20 > 760) {
      doc.addPage();
      curY = 50;
    }

    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(54, curY).lineTo(541, curY).stroke();
    curY += 6;

    doc.font(fontBold).fontSize(8.5).fillColor('#0f172a').text(isHindi ? 'संलग्नक (Enclosures):' : 'Enclosures Attached:', 54, curY);
    curY += 12;

    sections.enclosures.forEach((enc, idx) => {
      const cleanTitle = sanitizeEnclosureTitle(enc);
      doc.font(fontRegular).fontSize(8).fillColor('#475569').text(`  ${idx + 1}. ${cleanTitle}`, 60, curY, { width: 475 });
      curY += 11;
    });
  }

  // Footer: Fixed at y: 805 with guaranteed line separation (Requirement 7)
  doc.fontSize(7.5).fillColor('#94a3b8').text(
    'Generated via TechForm Buddy — Official Citizen Form Assistant',
    54,
    805,
    { align: 'center', width: 487 }
  );
}

/**
 * ----------------------------------------------------------------------
 * 2. RESUME / CV PDF RENDERER (kind: resume)
 * ----------------------------------------------------------------------
 */
function renderResumePdf(
  doc: PDFKit.PDFDocument,
  title: string,
  sections: DocumentSections,
  isHindi: boolean,
  fontRegular: string,
  fontBold: string,
  photoBuffer?: Buffer
) {
  const applicantName = sections.contactInfo?.name || sections.signature || 'Applicant';
  const email = sections.contactInfo?.email || '';
  const phone = sections.contactInfo?.phone || '';
  const city = sections.contactInfo?.city || '';
  const linkedin = sections.contactInfo?.linkedin || '';
  const github = sections.contactInfo?.github || '';

  // Applicant Name in prominent bold 18pt
  doc.font(fontBold).fontSize(18).fillColor('#0f172a').text(applicantName.toUpperCase(), 54, 45, { align: 'left', width: 400 });

  // Optional Top-Right Photo
  if (photoBuffer && photoBuffer.length > 0) {
    try {
      doc.rect(460, 42, 75, 90).lineWidth(1).stroke('#cbd5e1');
      doc.image(photoBuffer, 462, 44, { width: 71, height: 86, fit: [71, 86], align: 'center', valign: 'center' });
    } catch {}
  }

  // Contact Row
  const contactParts = [email, phone, city, linkedin, github].filter(Boolean);
  doc.font(fontRegular).fontSize(8.5).fillColor('#475569').text(contactParts.join('  |  '), 54, 70, { width: 395, lineGap: 3 });

  // Divider
  let curY = 96;
  doc.strokeColor('#0f172a').lineWidth(1).moveTo(54, curY).lineTo(541, curY).stroke();
  curY += 12;

  // Sections
  const renderSectionHeader = (secTitle: string) => {
    if (curY + 40 > 750) {
      doc.addPage();
      curY = 50;
    }
    doc.font(fontBold).fontSize(10).fillColor('#0f172a').text(secTitle.toUpperCase(), 54, curY);
    curY += 14;
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(54, curY - 2).lineTo(541, curY - 2).stroke();
  };

  // Summary
  if (sections.summary) {
    renderSectionHeader(isHindi ? 'व्यावसायिक सारांश (Summary)' : 'PROFESSIONAL SUMMARY');
    doc.font(fontRegular).fontSize(8.5).fillColor('#1e293b').text(sections.summary.trim(), 54, curY, { width: 487, align: 'justify', lineGap: 3 });
    curY = doc.y + 12;
  }

  // Education
  if (sections.education && sections.education.length > 0) {
    renderSectionHeader(isHindi ? 'शैक्षणिक योग्यता (Education)' : 'EDUCATION');
    for (const edu of sections.education) {
      doc.font(fontBold).fontSize(9).fillColor('#0f172a').text(edu.degree, 54, curY);
      curY += 12;
      if (edu.institution || edu.year) {
        doc.font(fontRegular).fontSize(8.5).fillColor('#475569').text(`${edu.institution} ${edu.year ? `(${edu.year})` : ''}`, 54, curY);
        curY += 12;
      }
    }
    curY += 6;
  }

  // Skills
  const skillsList = Array.isArray(sections.skills) ? sections.skills : [];
  if (skillsList.length > 0) {
    renderSectionHeader(isHindi ? 'तकनीकी दक्षता (Technical Skills)' : 'KEY SKILLS');
    doc.font(fontRegular).fontSize(8.5).fillColor('#1e293b').text(skillsList.join('  •  '), 54, curY, { width: 487, lineGap: 3 });
    curY = doc.y + 12;
  }

  // Projects
  if (sections.projects && sections.projects.length > 0) {
    renderSectionHeader(isHindi ? 'प्रमुख परियोजनाएं (Key Projects)' : 'PROJECTS & HIGHLIGHTS');
    for (const prj of sections.projects) {
      doc.font(fontBold).fontSize(9).fillColor('#0f172a').text(prj.title, 54, curY);
      curY += 12;
      for (const bullet of prj.bullets) {
        const cleanBullet = bullet.replace(/^[•\-\*]\s*/, '');
        doc.font(fontRegular).fontSize(8.5).fillColor('#334155').text(`  •  ${cleanBullet}`, 60, curY, { width: 475, lineGap: 2 });
        curY = doc.y + 3;
      }
      curY += 4;
    }
  }

  // Experience
  if (sections.experience && sections.experience.length > 0) {
    renderSectionHeader(isHindi ? 'कार्य अनुभव (Experience)' : 'EXPERIENCE');
    for (const exp of sections.experience) {
      doc.font(fontBold).fontSize(9).fillColor('#0f172a').text(`${exp.role} — ${exp.organization}`, 54, curY);
      curY += 12;
      for (const bullet of exp.bullets) {
        doc.font(fontRegular).fontSize(8.5).fillColor('#334155').text(`  •  ${bullet}`, 60, curY, { width: 475, lineGap: 2 });
        curY = doc.y + 3;
      }
      curY += 4;
    }
  }

  // Certifications
  if (sections.certifications && sections.certifications.length > 0) {
    renderSectionHeader(isHindi ? 'प्रमाणपत्र एवं उपलब्धियां (Certifications)' : 'CERTIFICATIONS & ACHIEVEMENTS');
    for (const cert of sections.certifications) {
      doc.font(fontRegular).fontSize(8.5).fillColor('#334155').text(`  •  ${cert.replace(/^[•\-\*]\s*/, '')}`, 60, curY, { width: 475, lineGap: 2 });
      curY = doc.y + 3;
    }
    curY += 4;
  }

  // Languages
  if (sections.languages && sections.languages.length > 0) {
    renderSectionHeader(isHindi ? 'भाषा ज्ञान (Languages)' : 'LANGUAGES');
    doc.font(fontRegular).fontSize(8.5).fillColor('#334155').text(sections.languages.join('  •  '), 54, curY, { width: 487, lineGap: 2 });
    curY = doc.y + 6;
  }

  // Optional Declaration
  if (sections.declaration) {
    renderSectionHeader(isHindi ? 'घोषणा (Declaration)' : 'DECLARATION');
    doc.font(fontRegular).fontSize(8).fillColor('#475569').text(sections.declaration, 54, curY, { width: 487, align: 'justify', lineGap: 2 });
    curY = doc.y + 6;
  }

  // Footer
  doc.fontSize(7.5).fillColor('#94a3b8').text('Generated via TechForm Buddy', 54, 805, { align: 'center', width: 487 });
}

/**
 * ----------------------------------------------------------------------
 * 3. OFFICIAL LETTER PDF RENDERER (kind: letter)
 * ----------------------------------------------------------------------
 */
function renderLetterPdf(
  doc: PDFKit.PDFDocument,
  title: string,
  sections: DocumentSections,
  isHindi: boolean,
  fontRegular: string,
  fontBold: string
) {
  // Header rule
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(54, 45).lineTo(541, 45).stroke();

  // Recipient Header block
  doc.font(fontRegular).fontSize(10.5).fillColor('#0f172a');
  const headerLines = (sections.header || '').split('\n').filter(Boolean);
  let curY = 55;
  for (const line of headerLines) {
    doc.text(line.trim(), 54, curY, { lineGap: 3, width: 350 });
    curY = doc.y;
  }

  // Date right-aligned
  if (sections.date) {
    doc.font(fontRegular).fontSize(9.5).fillColor('#475569');
    doc.text(sections.date.trim(), 54, 55, { align: 'right', width: 487 });
  }

  curY = Math.max(curY + 12, 105);

  // Subject line (prominent, bold, with underline)
  if (sections.subject) {
    doc.font(fontBold).fontSize(10.5).fillColor('#0f172a');
    doc.text(sections.subject.trim(), 54, curY, { width: 487, lineGap: 3 });
    curY = doc.y + 10;
  }

  // Salutation
  if (sections.salutation) {
    doc.font(fontRegular).fontSize(10.5).fillColor('#0f172a');
    doc.text(sections.salutation.trim(), 54, curY);
    curY = doc.y + 10;
  }

  // Body paragraphs (Direct first-person, no "on behalf of", no unverified claims)
  if (sections.body) {
    doc.font(fontRegular).fontSize(9.5).fillColor('#1e293b');
    const paragraphs = sections.body.split(/\n\s*\n/).filter(Boolean);
    for (const p of paragraphs) {
      if (curY + 45 > 740) {
        doc.addPage();
        curY = 50;
      }
      doc.text(p.trim(), 54, curY, { align: 'justify', lineGap: 3.5, width: 487 });
      curY = doc.y + 8;
    }
  }

  // Enclosures list (Clean Single Numbering - Requirement 6)
  if (sections.enclosures && sections.enclosures.length > 0) {
    if (curY + (sections.enclosures.length * 14) + 20 > 750) {
      doc.addPage();
      curY = 50;
    }
    doc.font(fontBold).fontSize(9.5).fillColor('#0f172a').text(isHindi ? 'संलग्नक (दस्तावेज़ सूची):' : 'Enclosures (Attached Documents):', 54, curY);
    curY += 13;
    doc.font(fontRegular).fontSize(9).fillColor('#334155');

    sections.enclosures.forEach((item, idx) => {
      const cleanTitle = sanitizeEnclosureTitle(item);
      doc.text(`  ${idx + 1}. ${cleanTitle}`, 60, curY, { width: 475, lineGap: 2 });
      curY = doc.y;
    });
    curY += 12;
  }

  // Closing
  if (sections.closing) {
    if (curY + 60 > 750) {
      doc.addPage();
      curY = 50;
    }
    doc.font(fontRegular).fontSize(10).fillColor('#0f172a').text(sections.closing.trim(), 54, curY);
    curY = doc.y + 16;
  }

  // Signature block
  if (sections.signature) {
    if (curY + 50 > 750) {
      doc.addPage();
      curY = 50;
    }
    doc.font(fontBold).fontSize(9.5).fillColor('#0f172a');
    const sigLines = sections.signature.split('\n').filter(Boolean);
    for (const line of sigLines) {
      doc.text(line.trim(), 54, curY, { lineGap: 2, width: 350 });
      curY = doc.y;
    }
  }

  // Footer: Separated at y: 805 with guaranteed line separation (Requirement 7)
  doc.fontSize(7.5).fillColor('#94a3b8').text(
    'Generated via TechForm Buddy — Official Citizen Form Assistant',
    54,
    805,
    { align: 'center', width: 487 }
  );
}

/**
 * Generate PDF buffer with embedded Noto Sans Devanagari font and kind-aware renderer
 */
export async function generatePdf(
  title: string,
  sections: DocumentSections,
  language: 'en' | 'hi' = 'en',
  options?: GenerateDocOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const isHindi =
        language === 'hi' ||
        containsDevanagari(sections.body || '') ||
        containsDevanagari(sections.subject || '') ||
        containsDevanagari(title || '');

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 45, bottom: 45, left: 54, right: 54 },
        info: {
          Title: title,
          Author: 'TechForm Buddy',
          Subject: sections.subject || title,
        },
      });

      const fontRegPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansDevanagari-Regular.ttf');
      const fontBoldPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansDevanagari-Bold.ttf');
      const hasLocalDeva = fs.existsSync(fontRegPath);

      let fontRegular = 'Helvetica';
      let fontBold = 'Helvetica-Bold';

      if (isHindi && hasLocalDeva) {
        doc.registerFont('DevaRegular', fontRegPath);
        fontRegular = 'DevaRegular';
        // Note: NotoSansDevanagari-Bold has an OpenType GPOS null anchor table issue
        // on common ligatures like 'हेतु' in fontkit. Using DevaRegular ensures rock-solid
        // glyph rendering for all Hindi texts without fontkit GPOS exceptions.
        fontBold = 'DevaRegular';
      }

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const kind = detectDocumentKind(title, sections, options?.kind);
      const photoBuf = resolvePhotoBuffer(options, sections);

      if (kind === 'application_form') {
        renderApplicationFormPdf(doc, title, sections, isHindi, fontRegular, fontBold, photoBuf);
      } else if (kind === 'resume') {
        renderResumePdf(doc, title, sections, isHindi, fontRegular, fontBold, photoBuf);
      } else {
        renderLetterPdf(doc, title, sections, isHindi, fontRegular, fontBold);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * ----------------------------------------------------------------------
 * 4. DOCX GENERATOR WITH KIND-AWARE LAYOUT
 * ----------------------------------------------------------------------
 */
export async function generateDocx(
  title: string,
  sections: DocumentSections,
  language: 'en' | 'hi' = 'en',
  options?: GenerateDocOptions
): Promise<Buffer> {
  const isHindi = language === 'hi' || containsDevanagari(sections.body || '');
  const fontName = isHindi ? 'Noto Sans Devanagari' : 'Calibri';
  const kind = detectDocumentKind(title, sections, options?.kind);
  const photoBuf = resolvePhotoBuffer(options, sections);

  const paragraphs: Array<Paragraph | Table> = [];

  // Footer definition for DOCX (Requirement 7)
  const docxFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'Generated via TechForm Buddy — Official Citizen Form Assistant',
            font: fontName,
            size: 16,
            color: '94a3b8',
          }),
        ],
      }),
    ],
  });

  if (kind === 'resume') {
    const applicantName = sections.contactInfo?.name || sections.signature || 'Applicant Name';
    const email = sections.contactInfo?.email || '';
    const phone = sections.contactInfo?.phone || '';
    const city = sections.contactInfo?.city || '';
    const linkedin = sections.contactInfo?.linkedin || '';
    const github = sections.contactInfo?.github || '';

    // Top table with Name/Contact on left and optional Photo on right
    const contactParts = [phone, email, city, linkedin, github].filter(Boolean);
    const leftChildren: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: applicantName.toUpperCase(),
            font: fontName,
            bold: true,
            size: 32, // 16pt
            color: '0f172a',
          }),
        ],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            font: fontName,
            size: 18, // 9pt
            color: '475569',
          }),
        ],
        spacing: { after: 120 },
      }),
    ];

    const rightChildren: Paragraph[] = [];
    if (photoBuf && photoBuf.length > 0) {
      rightChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new ImageRun({
              data: photoBuf,
              transformation: { width: 85, height: 105 },
              type: 'png',
            }),
          ],
        })
      );
    }

    if (rightChildren.length > 0) {
      paragraphs.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 75, type: WidthType.PERCENTAGE },
                  children: leftChildren,
                }),
                new TableCell({
                  width: { size: 25, type: WidthType.PERCENTAGE },
                  children: rightChildren,
                }),
              ],
            }),
          ],
        })
      );
    } else {
      paragraphs.push(...leftChildren);
    }

    const addSectionHeader = (secTitle: string) => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: secTitle.toUpperCase(),
              font: fontName,
              bold: true,
              size: 22, // 11pt
              color: '0f172a',
            }),
          ],
          spacing: { before: 180, after: 60 },
          border: {
            bottom: { color: 'cbd5e1', space: 2, style: BorderStyle.SINGLE, size: 6 },
          },
        })
      );
    };

    // Summary
    const summaryText = sections.summary || (sections.body && !sections.body.includes('EDUCATION') ? sections.body : '');
    if (summaryText) {
      addSectionHeader(isHindi ? 'व्यावसायिक सारांश (Professional Summary)' : 'PROFESSIONAL SUMMARY');
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({
              text: summaryText.trim(),
              font: fontName,
              size: 20,
              color: '1e293b',
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    // Education
    if (sections.education && sections.education.length > 0) {
      addSectionHeader(isHindi ? 'शैक्षणिक योग्यता (Education)' : 'EDUCATION');
      for (const edu of sections.education) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: edu.degree, font: fontName, bold: true, size: 20, color: '0f172a' }),
              ...(edu.institution ? [new TextRun({ text: ` — ${edu.institution}`, font: fontName, size: 19, color: '334155' })] : []),
              ...(edu.year ? [new TextRun({ text: ` (${edu.year})`, font: fontName, size: 19, color: '64748b' })] : []),
            ],
            spacing: { after: 40 },
          })
        );
      }
    }

    // Skills
    const skillsArr = Array.isArray(sections.skills) ? sections.skills : [];
    if (skillsArr.length > 0) {
      addSectionHeader(isHindi ? 'तकनीकी दक्षता (Key Skills)' : 'KEY SKILLS');
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: skillsArr.join('   •   '),
              font: fontName,
              size: 19,
              color: '1e293b',
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    // Projects
    if (sections.projects && sections.projects.length > 0) {
      addSectionHeader(isHindi ? 'प्रमुख परियोजनाएं (Key Projects)' : 'PROJECTS & HIGHLIGHTS');
      for (const prj of sections.projects) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: prj.title, font: fontName, bold: true, size: 20, color: '0f172a' }),
            ],
            spacing: { before: 60, after: 30 },
          })
        );
        for (const bullet of prj.bullets) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `•  ${bullet.replace(/^[•\-\*]\s*/, '')}`, font: fontName, size: 19, color: '334155' }),
              ],
              indent: { left: 360 },
              spacing: { after: 20 },
            })
          );
        }
      }
    }

    // Experience
    if (sections.experience && sections.experience.length > 0) {
      addSectionHeader(isHindi ? 'कार्य अनुभव (Experience)' : 'EXPERIENCE & INTERNSHIPS');
      for (const exp of sections.experience) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${exp.role} — ${exp.organization}`, font: fontName, bold: true, size: 20, color: '0f172a' }),
              ...(exp.period ? [new TextRun({ text: ` (${exp.period})`, font: fontName, size: 19, color: '64748b' })] : []),
            ],
            spacing: { before: 60, after: 30 },
          })
        );
        for (const bullet of exp.bullets) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `•  ${bullet.replace(/^[•\-\*]\s*/, '')}`, font: fontName, size: 19, color: '334155' }),
              ],
              indent: { left: 360 },
              spacing: { after: 20 },
            })
          );
        }
      }
    }

    // Certifications
    if (sections.certifications && sections.certifications.length > 0) {
      addSectionHeader(isHindi ? 'प्रमाणपत्र (Certifications)' : 'CERTIFICATIONS & ACHIEVEMENTS');
      for (const cert of sections.certifications) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `•  ${cert.replace(/^[•\-\*]\s*/, '')}`, font: fontName, size: 19, color: '334155' }),
            ],
            indent: { left: 360 },
            spacing: { after: 20 },
          })
        );
      }
    }

    // Languages
    if (sections.languages && sections.languages.length > 0) {
      addSectionHeader(isHindi ? 'भाषाएं (Languages)' : 'LANGUAGES');
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: sections.languages.join('   •   '),
              font: fontName,
              size: 19,
              color: '334155',
            }),
          ],
          spacing: { after: 80 },
        })
      );
    }

    // Optional Declaration
    if (sections.declaration) {
      addSectionHeader(isHindi ? 'घोषणा (Declaration)' : 'DECLARATION');
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: sections.declaration, font: fontName, size: 18, italics: true, color: '475569' }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  } else if (kind === 'application_form') {
    // Title
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: title.toUpperCase(),
            font: fontName,
            size: 28, // 14pt
            bold: true,
          }),
        ],
        spacing: { after: 180 },
      })
    );

    // Photo and metadata table
    const topCells: TableCell[] = [
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: sections.subject || 'Application for Student Internship',
                font: fontName,
                size: 22,
                bold: true,
              }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: sections.date || '',
                font: fontName,
                size: 20,
                color: '64748b',
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: photoBuf && photoBuf.length > 0
          ? [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new ImageRun({
                    data: photoBuf,
                    transformation: { width: 90, height: 110 },
                    type: 'png',
                  }),
                ],
              }),
            ]
          : [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: isHindi ? '[पासपोर्ट फोटो]' : '[Affix Photo]',
                    font: fontName,
                    size: 18,
                    color: '94a3b8',
                  }),
                ],
              }),
            ],
      }),
    ];

    paragraphs.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: topCells })],
      })
    );

    // Two-Column Table of Fields
    const fieldRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isHindi ? 'विवरण' : 'PARTICULAR', font: fontName, bold: true, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isHindi ? 'मान' : 'DETAILS', font: fontName, bold: true, size: 20 })],
              }),
            ],
          }),
        ],
      }),
    ];

    const rows = sections.fieldsTable || [];
    for (const r of rows) {
      fieldRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: r.label, font: fontName, bold: true, size: 19, color: '334155' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(r.value || ''), font: fontName, size: 19 })],
                }),
              ],
            }),
          ],
        })
      );
    }

    paragraphs.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: fieldRows,
      })
    );

    // Cover Note
    const coverNote = sections.coverNote || sections.body || '';
    if (coverNote) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: isHindi ? 'उद्देश्य विवरण:' : 'STATEMENT OF PURPOSE:',
              font: fontName,
              bold: true,
              size: 21,
            }),
          ],
          spacing: { before: 180, after: 60 },
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: coverNote, font: fontName, size: 20 })],
          spacing: { after: 120 },
        })
      );
    }

    // Declaration
    const declaration = sections.declaration || 'I hereby declare that all information furnished is true and correct.';
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: isHindi ? 'घोषणा:' : 'DECLARATION:',
            font: fontName,
            bold: true,
            size: 20,
          }),
        ],
        spacing: { before: 120, after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: declaration, font: fontName, size: 19, italics: true })],
        spacing: { after: 140 },
      })
    );

    // Signature Block
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `Signature of Applicant\n${sections.signature || ''}`,
            font: fontName,
            bold: true,
            size: 20,
          }),
        ],
        spacing: { before: 140, after: 100 },
      })
    );

    // Enclosures
    if (sections.enclosures && sections.enclosures.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: isHindi ? 'संलग्नक:' : 'Enclosures:',
              font: fontName,
              bold: true,
              size: 20,
            }),
          ],
          spacing: { before: 100, after: 40 },
        })
      );
      sections.enclosures.forEach((enc, idx) => {
        const cleanTitle = sanitizeEnclosureTitle(enc);
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `  ${idx + 1}. ${cleanTitle}`, font: fontName, size: 19 })],
          })
        );
      });
    }
  } else {
    // Letter Layout
    if (sections.header) {
      const lines = sections.header.split('\n').filter(Boolean);
      for (const l of lines) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: l.trim(),
                font: fontName,
                size: 22,
                bold: l.toLowerCase().startsWith('to') || l.startsWith('सेवा'),
              }),
            ],
            spacing: { after: 60 },
          })
        );
      }
    }

    if (sections.date) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: sections.date.trim(), font: fontName, size: 20, italics: true })],
          spacing: { before: 80, after: 120 },
        })
      );
    }

    if (sections.subject) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: sections.subject.trim(), font: fontName, size: 22, bold: true, underline: {} })],
          spacing: { before: 120, after: 140 },
        })
      );
    }

    if (sections.salutation) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: sections.salutation.trim(), font: fontName, size: 22 })],
          spacing: { after: 120 },
        })
      );
    }

    if (sections.body) {
      const bodyParagraphs = sections.body.split(/\n\s*\n/).filter(Boolean);
      for (const p of bodyParagraphs) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({ text: p.trim(), font: fontName, size: 21 })],
            spacing: { after: 140, line: 276 },
          })
        );
      }
    }

    if (sections.enclosures && sections.enclosures.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: isHindi ? 'संलग्नक:' : 'Enclosures:', font: fontName, size: 21, bold: true })],
          spacing: { before: 140, after: 60 },
        })
      );
      sections.enclosures.forEach((enc, idx) => {
        const cleanTitle = sanitizeEnclosureTitle(enc);
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `  ${idx + 1}. ${cleanTitle}`, font: fontName, size: 20 })],
            spacing: { after: 40 },
          })
        );
      });
    }

    if (sections.closing) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: sections.closing.trim(), font: fontName, size: 22 })],
          spacing: { before: 160, after: 140 },
        })
      );
    }

    if (sections.signature) {
      const sigLines = sections.signature.split('\n').filter(Boolean);
      for (const sl of sigLines) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: sl.trim(), font: fontName, size: 21, bold: true })],
            spacing: { after: 40 },
          })
        );
      }
    }
  }

  const doc = new Document({
    title,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        footers: {
          default: docxFooter,
        },
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Generate formatted plain text
 */
export function generateTxt(
  title: string,
  sections: DocumentSections,
  language: 'en' | 'hi' = 'en',
  options?: GenerateDocOptions
): string {
  const parts: string[] = [];
  const kind = detectDocumentKind(title, sections, options?.kind);

  parts.push(title.toUpperCase());
  parts.push('='.repeat(title.length));
  parts.push('');

  if (kind === 'resume') {
    if (sections.contactInfo) {
      parts.push(sections.contactInfo.name);
      const contactBits = [sections.contactInfo.email, sections.contactInfo.phone, sections.contactInfo.city].filter(Boolean);
      if (contactBits.length > 0) parts.push(contactBits.join('  •  '));
      const links = [sections.contactInfo.linkedin, sections.contactInfo.github].filter(Boolean);
      if (links.length > 0) parts.push(links.join('  •  '));
      parts.push('');
    } else if (sections.subject) {
      parts.push(sections.subject.trim());
    }

    if (sections.summary) {
      parts.push('PROFESSIONAL SUMMARY');
      parts.push('-'.repeat(30));
      parts.push(sections.summary.trim());
      parts.push('');
    }

    if (sections.skills) {
      parts.push('KEY SKILLS');
      parts.push('-'.repeat(30));
      if (Array.isArray(sections.skills) && sections.skills.length > 0) {
        parts.push(sections.skills.join('  •  '));
      } else if (typeof sections.skills === 'object') {
        for (const [category, skillList] of Object.entries(sections.skills)) {
          if (Array.isArray(skillList) && skillList.length > 0) {
            parts.push(`${category}: ${skillList.join(', ')}`);
          }
        }
      }
      parts.push('');
    }

    if (sections.education && sections.education.length > 0) {
      parts.push('EDUCATION');
      parts.push('-'.repeat(30));
      for (const edu of sections.education) {
        parts.push(`${edu.degree}${edu.institution ? ` — ${edu.institution}` : ''}${edu.year ? ` (${edu.year})` : ''}${edu.score ? ` [${edu.score}]` : ''}`);
      }
      parts.push('');
    }

    if (sections.projects && sections.projects.length > 0) {
      parts.push('PROJECTS');
      parts.push('-'.repeat(30));
      for (const p of sections.projects) {
        parts.push(p.title);
        for (const b of p.bullets) parts.push(`  • ${b}`);
      }
      parts.push('');
    }

    if (sections.experience && sections.experience.length > 0) {
      parts.push('EXPERIENCE');
      parts.push('-'.repeat(30));
      for (const exp of sections.experience) {
        parts.push(`${exp.role} — ${exp.organization}${exp.period ? ` (${exp.period})` : ''}`);
        for (const b of exp.bullets) parts.push(`  • ${b}`);
      }
      parts.push('');
    }

    if (sections.certifications && sections.certifications.length > 0) {
      parts.push('CERTIFICATIONS & ACHIEVEMENTS');
      parts.push('-'.repeat(30));
      for (const c of sections.certifications) parts.push(`  • ${c}`);
      parts.push('');
    }

    if (sections.languages && sections.languages.length > 0) {
      parts.push('LANGUAGES');
      parts.push('-'.repeat(30));
      parts.push(sections.languages.join('  •  '));
      parts.push('');
    }

    if (sections.declaration) {
      parts.push('DECLARATION');
      parts.push('-'.repeat(30));
      parts.push(sections.declaration.trim());
      parts.push('');
    }
  } else if (kind === 'application_form') {
    if (sections.subject) parts.push(sections.subject.trim());
    if (sections.date) parts.push(sections.date.trim());
    parts.push('\nAPPLICANT PARTICULARS & DETAILS:');
    parts.push('-'.repeat(40));

    if (sections.fieldsTable) {
      for (const r of sections.fieldsTable) {
        parts.push(`${r.label}: ${r.value}`);
      }
    }

    if (sections.coverNote || sections.body) {
      parts.push('\nSTATEMENT OF PURPOSE:');
      parts.push((sections.coverNote || sections.body || '').trim());
    }

    if (sections.declaration) {
      parts.push('\nSOLEMN DECLARATION:');
      parts.push(sections.declaration.trim());
    }

    if (sections.signature) parts.push(`\nSignature: ${sections.signature.trim()}`);
  } else {
    if (sections.header) parts.push(sections.header.trim());
    if (sections.date) parts.push(`\n${sections.date.trim()}`);
    if (sections.subject) parts.push(`\n${sections.subject.trim()}`);
    if (sections.salutation) parts.push(`\n${sections.salutation.trim()}`);
    if (sections.body) parts.push(`\n${sections.body.trim()}`);
    if (sections.closing) parts.push(`\n${sections.closing.trim()}`);
    if (sections.signature) parts.push(`\n${sections.signature.trim()}`);
  }

  if (sections.enclosures && sections.enclosures.length > 0) {
    const encTitle = language === 'hi' ? 'संलग्नक:' : 'Enclosures:';
    const encList = sections.enclosures
      .map((e, idx) => `  ${idx + 1}. ${sanitizeEnclosureTitle(e)}`)
      .join('\n');
    parts.push(`\n${encTitle}\n${encList}`);
  }

  parts.push('\n' + '-'.repeat(50));
  parts.push('Generated via TechForm Buddy');

  return parts.join('\n');
}
