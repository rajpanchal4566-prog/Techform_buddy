import assert from 'node:assert';

async function testHttpEndpoints() {
  console.log('Testing live API endpoints on http://localhost:3000...');

  // 1. Test POST /api/forms/download (PDF)
  const pdfRes = await fetch('http://localhost:3000/api/forms/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Leave Application',
      language: 'en',
      format: 'pdf',
      sections: {
        header: 'To,\nThe Principal,\nABC College',
        date: '25 October 2026',
        subject: 'Subject: Application for leave',
        salutation: 'Respected Sir,',
        body: 'I am writing to formally request leave of absence from 26 October to 28 October due to urgent family matters. I will ensure all coursework is completed promptly upon my return.',
        closing: 'Yours sincerely,',
        signature: 'Aarav Sharma\nRoll No: 104',
      },
    }),
  });

  assert.strictEqual(pdfRes.status, 200, 'PDF download should return 200');
  assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
  const pdfDispo = pdfRes.headers.get('content-disposition');
  assert.ok(pdfDispo && pdfDispo.includes('Leave_Application_'), 'Disposition header should have sanitized filename');
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  assert.strictEqual(pdfBuf.slice(0, 5).toString('ascii'), '%PDF-', 'Buffer should start with %PDF-');
  console.log(`✓ /api/forms/download (PDF) passed: ${pdfBuf.length} bytes`);

  // 2. Test POST /api/forms/download (DOCX)
  const docxRes = await fetch('http://localhost:3000/api/forms/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Leave Application',
      language: 'en',
      format: 'docx',
      sections: {
        header: 'To,\nThe Principal,\nABC College',
        date: '25 October 2026',
        subject: 'Subject: Application for leave',
        salutation: 'Respected Sir,',
        body: 'I am writing to formally request leave of absence from 26 October to 28 October due to urgent family matters.',
        closing: 'Yours sincerely,',
        signature: 'Aarav Sharma',
      },
    }),
  });

  assert.strictEqual(docxRes.status, 200, 'DOCX download should return 200');
  assert.strictEqual(docxRes.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const docxBuf = Buffer.from(await docxRes.arrayBuffer());
  assert.strictEqual(docxBuf[0], 0x50, 'DOCX PK header byte 0');
  assert.strictEqual(docxBuf[1], 0x4b, 'DOCX PK header byte 1');
  console.log(`✓ /api/forms/download (DOCX) passed: ${docxBuf.length} bytes`);

  // 3. Test POST /api/forms/download (TXT)
  const txtRes = await fetch('http://localhost:3000/api/forms/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Leave Application',
      language: 'en',
      format: 'txt',
      sections: {
        header: 'To,\nThe Principal,\nABC College',
        date: '25 October 2026',
        subject: 'Subject: Application for leave',
        salutation: 'Respected Sir,',
        body: 'I am writing to formally request leave of absence from 26 October to 28 October due to urgent family matters.',
        closing: 'Yours sincerely,',
        signature: 'Aarav Sharma',
      },
    }),
  });

  assert.strictEqual(txtRes.status, 200, 'TXT download should return 200');
  assert.ok(txtRes.headers.get('content-type')?.includes('text/plain'));
  const txtText = await txtRes.text();
  assert.ok(txtText.includes('LEAVE APPLICATION'));
  console.log(`✓ /api/forms/download (TXT) passed: ${txtText.length} characters`);

  // 4. Test POST /api/forms/generate-doc checkOnly
  const checkRes = await fetch('http://localhost:3000/api/forms/generate-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'leave_application',
      fields: {},
      language: 'en',
      checkOnly: true,
    }),
  });

  assert.strictEqual(checkRes.status, 200, 'generate-doc checkOnly should return 200');
  const checkData = await checkRes.json();
  assert.strictEqual(checkData.hasMissingFields, true, 'Empty fields should flag missing fields');
  assert.ok(checkData.missingFields.length > 0, 'Should return missing fields list');
  console.log(`✓ /api/forms/generate-doc (checkOnly) passed: flagged ${checkData.missingFields.length} missing fields`);

  console.log('\n🎉 ALL LIVE ENDPOINTS VERIFIED SUCCESSFULLY!');
}

testHttpEndpoints().catch(err => {
  console.error('❌ HTTP endpoint test failed:', err);
  process.exit(1);
});
