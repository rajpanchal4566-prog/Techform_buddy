// Form download utility — generates an authentic, printable filled application paper or formal letter

export function downloadFormAsDocument(
  title: string,
  fields: { label: string; value: string; required?: boolean; section?: string }[],
  category: string,
  status: string,
  portalName?: string,
  formType?: 'letter' | 'form'
) {
  const date = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const appRef = `TFB-${Math.abs(hashString(title + category)).toString(36).toUpperCase()}-${Date.now().toString().slice(-5)}`;

  // Group fields by section for organized display
  const sectionOrder = ['sender', 'recipient', 'personal', 'identity', 'address', 'scheme', 'letter', 'banking', 'fee', 'inquiry', 'department', 'income', 'general', 'terms', 'property', 'parties', 'qualifications', 'application', 'bank'];
  const sectionLabels: Record<string, string> = {
    sender: '1. SENDER / APPLICANT DETAILS',
    recipient: '2. RECIPIENT / AUTHORITY DETAILS',
    personal: '1. PERSONAL INFORMATION',
    identity: '2. IDENTITY & CONTACT DETAILS',
    address: '3. ADDRESS & RESIDENCE DETAILS',
    income: '4. INCOME & OCCUPATION DETAILS',
    scheme: '5. SCHEME / SERVICE SPECIFIC DETAILS',
    banking: '6. BANKING & ACCOUNT DETAILS',
    letter: 'LETTER CONTENT & STATEMENT',
    fee: 'FEE & PAYMENT DETAILS',
    inquiry: 'INQUIRY / GRIEVANCE DETAILS',
    department: 'DEPARTMENT DETAILS',
    general: 'GENERAL INFORMATION',
    terms: 'TERMS & DECLARATION',
    property: 'PROPERTY DETAILS',
    parties: 'PARTIES INFORMATION',
    qualifications: 'EDUCATIONAL QUALIFICATIONS',
    application: 'APPLICATION DETAILS',
    bank: 'BANK DETAILS',
  };

  // Check if it's a letter format
  const isLetter = formType === 'letter' ||
    category?.toLowerCase().includes('letter') ||
    fields.some(f => f.section === 'letter' || f.section === 'sender' || f.section === 'recipient');

  const filledCount = fields.filter(f => f.value && f.value.trim() !== '').length;
  const totalCount = fields.length;

  let bodyHtml = '';
  if (isLetter && hasFilledValues(fields)) {
    bodyHtml = buildLetterHtml(fields, title, date, appRef);
  } else {
    // Group fields
    const grouped: Record<string, typeof fields> = {};
    const ungrouped: typeof fields = [];
    
    for (const f of fields) {
      const section = f.section || '';
      if (section && sectionLabels[section]) {
        if (!grouped[section]) grouped[section] = [];
        grouped[section].push(f);
      } else {
        ungrouped.push(f);
      }
    }

    const hasAnySections = Object.keys(grouped).length > 0;
    if (hasAnySections) {
      let secIndex = 1;
      for (const section of sectionOrder) {
        if (!grouped[section] || grouped[section].length === 0) continue;
        const label = sectionLabels[section] || `${secIndex++}. ${section.toUpperCase()} DETAILS`;
        bodyHtml += `<div class="paper-section-heading">${label}</div>`;
        bodyHtml += buildFieldTable(grouped[section]);
      }
      if (ungrouped.length > 0) {
        bodyHtml += `<div class="paper-section-heading">${secIndex}. ADDITIONAL PARTICULARS</div>`;
        bodyHtml += buildFieldTable(ungrouped);
      }
    } else {
      bodyHtml += `<div class="paper-section-heading">APPLICATION PARTICULARS & DETAILS</div>`;
      bodyHtml += buildFieldTable(fields);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - Application Paper</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 30px 20px;
      line-height: 1.5;
    }
    .paper-page {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 48px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      position: relative;
    }
    .paper-border-inner {
      border: 2px solid #1e293b;
      padding: 28px;
      position: relative;
    }
    .paper-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .paper-header-left {
      flex: 1;
    }
    .paper-title-tag {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 4px;
    }
    .paper-h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: -0.01em;
    }
    .paper-submeta {
      font-size: 12px;
      color: #334155;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .paper-photo-box {
      width: 120px;
      height: 140px;
      border: 1.5px dashed #475569;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 10px;
      font-weight: 500;
      color: #64748b;
      line-height: 1.35;
      padding: 8px;
      flex-shrink: 0;
      margin-left: 20px;
    }
    .paper-section-heading {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f172a;
      background: #f1f5f9;
      border-left: 4px solid #1e293b;
      padding: 6px 12px;
      margin: 22px 0 10px 0;
    }
    table.paper-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    table.paper-table th {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      text-align: left;
    }
    table.paper-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      font-size: 13px;
      vertical-align: top;
    }
    .paper-field-label {
      width: 38%;
      background: #fcfcfd;
      font-weight: 600;
      color: #334155;
    }
    .paper-field-value {
      width: 62%;
      color: #0f172a;
    }
    .paper-val-filled {
      font-weight: 600;
      color: #0f172a;
    }
    .paper-val-empty {
      color: #94a3b8;
      font-style: italic;
      font-size: 12px;
    }
    .declaration-box {
      margin-top: 28px;
      padding: 16px;
      border: 1px solid #cbd5e1;
      background: #fafafa;
      font-size: 12px;
      line-height: 1.6;
    }
    .declaration-title {
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1e293b;
      margin-bottom: 6px;
    }
    .declaration-text {
      color: #334155;
      text-align: justify;
    }
    .signatures-block {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 40px;
      padding-top: 10px;
      font-size: 12px;
    }
    .sig-col {
      min-width: 180px;
    }
    .sig-line {
      border-top: 1px solid #0f172a;
      padding-top: 6px;
      text-align: center;
      font-weight: 600;
      min-width: 220px;
    }
    .paper-footer {
      margin-top: 24px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
    }
    /* Letter formatting */
    .letter-paper {
      font-size: 14px;
      line-height: 1.8;
      color: #1e293b;
    }
    .letter-meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .letter-subject-line {
      font-weight: 700;
      text-decoration: underline;
      margin: 20px 0 16px 0;
    }
    .letter-body-p {
      text-align: justify;
      margin-bottom: 16px;
      text-indent: 24px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .paper-page { border: none; box-shadow: none; padding: 0; }
      .paper-border-inner { border: 2px solid #000; padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 820px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; background: #e0f2fe; padding: 12px 20px; border-radius: 8px; border: 1px solid #bae6fd;">
    <div style="font-size: 13px; color: #0369a1;">
      <strong>Printable Paper Ready:</strong> ${filledCount} of ${totalCount} fields filled. Press Print or Save as PDF.
    </div>
    <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 600; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="paper-page">
    <div class="paper-border-inner">
      <div class="paper-header">
        <div class="paper-header-left">
          <div class="paper-title-tag">TECHFORM BUDDY • OFFICIAL APPLICATION FORMAT</div>
          <h1 class="paper-h1">${escapeHtml(title)}</h1>
          <div class="paper-submeta">
            <span><strong>Application No:</strong> ${appRef}</span>
            <span><strong>Category:</strong> ${escapeHtml(category)}</span>
            <span><strong>Status:</strong> ${escapeHtml(status.toUpperCase())}</span>
            <span><strong>Date:</strong> ${date}</span>
            ${portalName ? `<span><strong>Portal:</strong> ${escapeHtml(portalName)}</span>` : ''}
          </div>
        </div>
        ${!isLetter ? `
        <div class="paper-photo-box">
          <span>AFFIX RECENT<br/>PASSPORT SIZE<br/>PHOTOGRAPH<br/>(Self Attested)</span>
        </div>` : ''}
      </div>

      ${bodyHtml}

      ${!isLetter ? `
      <div class="declaration-box">
        <div class="declaration-title">APPLICANT DECLARATION & UNDERTAKING</div>
        <p class="declaration-text">
          I hereby solemnly declare that all information and particulars stated in this application form are true, complete and correct to the best of my knowledge and belief. In the event of any information being found false, fraudulent or incorrect at any stage, my application/candidature shall be liable to immediate rejection/cancellation without any prior notice.
        </p>
      </div>

      <div class="signatures-block">
        <div class="sig-col">
          <div><strong>Place:</strong> ______________________</div>
          <div style="margin-top: 14px;"><strong>Date:</strong> ${date.split(',')[0]}</div>
        </div>
        <div class="sig-col" style="text-align: right;">
          <div class="sig-line">
            Signature / Thumb Impression of Applicant
          </div>
        </div>
      </div>
      ` : ''}

      <div class="paper-footer">
        <span>Verified Digital Record • Generated via TechForm Buddy</span>
        <span>Form Ref: ${appRef} • Page 1 of 1</span>
      </div>
    </div>
  </div>

  <script class="no-print">
    window.onload = function() {
      // Auto-focus print dialog after short delay
      setTimeout(() => { window.print(); }, 600);
    };
  </script>
</body>
</html>`;

  // 1. Try to open clean printable preview tab
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  } catch (err) {
    console.warn('Pop-up prevented, proceeding with direct download:', err);
  }

  // 2. Direct download of the paper file
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_Paper.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function hasFilledValues(fields: { value: string }[]): boolean {
  return fields.some(f => f.value && f.value.trim() !== '');
}

function buildFieldTable(fields: { label: string; value: string; required?: boolean }[]): string {
  const rows = fields.map(f => {
    const hasVal = f.value && f.value.trim() !== '';
    return `
    <tr>
      <td class="paper-field-label">
        ${escapeHtml(f.label)}${f.required ? ' <span style="color:#dc2626">*</span>' : ''}
      </td>
      <td class="paper-field-value">
        ${hasVal
          ? `<span class="paper-val-filled">${escapeHtml(f.value)}</span>`
          : '<span class="paper-val-empty">[Not Provided]</span>'}
      </td>
    </tr>`;
  }).join('');

  return `
  <table class="paper-table">
    <tbody>
      ${rows}
    </tbody>
  </table>`;
}

function buildLetterHtml(
  fields: { label: string; value: string; section?: string }[],
  title: string,
  date: string,
  appRef: string
): string {
  const getVal = (section: string, ...keywords: string[]): string => {
    for (const f of fields) {
      if (f.section !== section && section !== 'any') continue;
      const lbl = f.label.toLowerCase();
      if (keywords.some(k => lbl.includes(k))) {
        return f.value && f.value.trim() !== '' ? f.value.trim() : '';
      }
    }
    return '';
  };

  const senderName = getVal('sender', 'name', 'applicant', 'employee') || getVal('any', 'name', 'applicant');
  const senderDesignation = getVal('sender', 'designation', 'title', 'job');
  const senderContact = getVal('sender', 'contact', 'phone', 'email', 'mobile') || getVal('any', 'phone', 'email', 'mobile');
  const senderAddress = getVal('sender', 'address') || getVal('any', 'address');
  const recipientName = getVal('recipient', 'name', 'manager', 'head', 'principal', 'officer');
  const companyName = getVal('recipient', 'company', 'organization', 'institution', 'department');
  const letterDate = getVal('letter', 'date') || date.split(',')[0];
  const subject = getVal('letter', 'subject') || title;
  const salutation = getVal('letter', 'salutation') || 'Respected Sir/Madam,';
  const reason = getVal('letter', 'reason', 'body', 'statement', 'core', 'description') || getVal('any', 'reason', 'purpose', 'details');
  const handover = getVal('letter', 'handover', 'knowledge', 'transfer');
  const closing = getVal('letter', 'closing', 'sign-off', 'signature') || 'Yours sincerely,';

  let html = '<div class="letter-paper">';

  html += '<div class="letter-meta-row">';
  // Sender
  html += '<div class="letter-from">';
  html += '<div><strong>From:</strong></div>';
  if (senderName) html += `<div style="font-weight:600;font-size:15px">${escapeHtml(senderName)}</div>`;
  if (senderDesignation) html += `<div>${escapeHtml(senderDesignation)}</div>`;
  if (senderContact) html += `<div>${escapeHtml(senderContact)}</div>`;
  if (senderAddress) html += `<div>${escapeHtml(senderAddress)}</div>`;
  html += '</div>';

  // Date
  html += `<div><strong>Date:</strong> ${escapeHtml(letterDate)}</div>`;
  html += '</div>';

  // Recipient
  html += '<div class="letter-to" style="margin-bottom:20px;">';
  html += '<div><strong>To:</strong></div>';
  if (recipientName) html += `<div style="font-weight:600">${escapeHtml(recipientName)}</div>`;
  if (companyName) html += `<div>${escapeHtml(companyName)}</div>`;
  html += '</div>';

  // Subject
  html += `<div class="letter-subject-line">Subject: ${escapeHtml(subject)}</div>`;

  // Salutation
  html += `<div style="margin-bottom:14px">${escapeHtml(salutation)}</div>`;

  // Body
  if (reason) {
    html += `<div class="letter-body-p">${escapeHtml(reason).replace(/\n\n/g, '</div><div class="letter-body-p">').replace(/\n/g, '<br/>')}</div>`;
  } else {
    html += `<div class="letter-body-p">I am submitting this formal application regarding the subject mentioned above. Please find below the detailed particulars for your kind review and consideration.</div>`;
  }

  // Handover
  if (handover) {
    html += `<div style="margin:16px 0;"><strong>Handover & Transition Notes:</strong><br/>${escapeHtml(handover).replace(/\n/g, '<br/>')}</div>`;
  }

  // Additional filled fields table
  const filledFields = fields.filter(f => f.value && f.value.trim() !== '');
  if (filledFields.length > 0) {
    html += `<div class="paper-section-heading" style="margin-top:28px">Attached Application Details</div>`;
    html += buildFieldTable(filledFields);
  }

  // Closing
  html += `<div style="margin-top:36px;">${escapeHtml(closing)}</div>`;
  html += `<div style="margin-top:40px;"><div class="sig-line" style="display:inline-block;min-width:200px;">${senderName ? escapeHtml(senderName) : 'Applicant Signature'}</div></div>`;

  html += '</div>';
  return html;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
