import http from 'http';
import fs from 'fs';
import path from 'path';

export const PORT = 3005;

let submissionAttempts = 0;

export function resetSubmissionCount() {
  submissionAttempts = 0;
}

export function getSubmissionCount() {
  return submissionAttempts;
}

const homeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>National Citizen Benefits & Scholarship Portal</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { color: #1e3a8a; }
    .search-box { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; margin-bottom: 1.5rem; }
    .scheme-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 1.25rem; margin-bottom: 1rem; }
    .scheme-title { font-weight: 600; font-size: 1.15rem; color: #2563eb; text-decoration: none; display: block; margin-bottom: 0.5rem; }
    .scheme-desc { color: #64748b; font-size: 0.95rem; margin-bottom: 0.75rem; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; font-weight: 500; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-secondary { background: #e2e8f0; color: #1e293b; margin-left: 0.5rem; }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; font-size: 0.75rem; border-radius: 9999px; background: #dbeafe; color: #1e40af; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h1>National Citizen Benefits & Scholarship Portal</h1>
      <span class="badge">Official Test Portal</span>
    </div>
    <p>Welcome to the official benefits portal. Search for schemes or download guidelines below.</p>
    
    <input type="text" id="scheme_search" class="search-box" placeholder="Search government scholarships, loans or pensions..." />

    <div class="scheme-card" id="scheme-post-matric">
      <a href="/scholarship-form" class="scheme-title">Post-Matric Scholarship Scheme for SC/ST/OBC Students 2026</a>
      <p class="scheme-desc">Financial assistance for post-secondary students pursuing higher education across accredited universities.</p>
      <a href="/scholarship-form" class="btn btn-primary" id="apply-btn-1">Apply Online</a>
      <a href="/downloads/guidelines.pdf" class="btn btn-secondary" id="download-guidelines-btn" download="guidelines.pdf">Download Guidelines (PDF)</a>
    </div>

    <div class="scheme-card" id="scheme-merit">
      <a href="/scholarship-form" class="scheme-title">National Merit-cum-Means Scholarship Scheme</a>
      <p class="scheme-desc">Scholarship provided to economically weaker section students to arrest dropout rate after class VIII.</p>
      <a href="/scholarship-form" class="btn btn-primary" id="apply-btn-2">Apply Online</a>
    </div>

    <div class="scheme-card" id="scheme-broken">
      <a href="/simulated-failure" class="scheme-title">Special High-Altitude Regional Grant (Simulated Failure)</a>
      <p class="scheme-desc">This scheme link simulates a server fault (HTTP 500) for testing recovery and error reporting.</p>
      <a href="/simulated-failure" class="btn btn-secondary" id="broken-scheme-link">Test Server Fault</a>
    </div>
  </div>
</body>
</html>`;

const formHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Post-Matric Scholarship Application Form 2026</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 2rem; }
    .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    .form-group { margin-bottom: 1.25rem; }
    label { display: block; font-weight: 600; margin-bottom: 0.35rem; font-size: 0.9rem; }
    .required::after { content: " *"; color: #dc2626; }
    input[type="text"], input[type="email"], input[type="tel"], input[type="date"], input[type="number"], select {
      width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.95rem; box-sizing: border-box;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .checkbox-group { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
    .btn { padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: 600; cursor: pointer; border: none; }
    .btn-submit { background: #16a34a; color: #fff; font-size: 1rem; }
    .btn-secondary { background: #e2e8f0; color: #1e293b; }
    .error-banner { display: none; background: #fee2e2; border: 1px solid #f87171; color: #b91c1c; padding: 0.75rem; border-radius: 6px; margin-bottom: 1.5rem; }
    .success-banner { display: none; background: #dcfce7; border: 1px solid #4ade80; color: #15803d; padding: 0.75rem; border-radius: 6px; margin-bottom: 1.5rem; }
    .dynamic-box { background: #f1f5f9; padding: 1rem; border-radius: 6px; border: 1px dashed #94a3b8; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h1>Scholarship Application Form 2026</h1>
      <a href="/downloads/application-format.pdf" id="download-format-pdf" class="btn btn-secondary" download="application-format.pdf">Download Format (PDF)</a>
    </div>

    <div id="validation-errors" class="error-banner">Please complete all required fields marked with an asterisk (*).</div>
    <div id="submission-success" class="success-banner">Application submitted successfully! Tracking ID: SCH-2026-9942</div>

    <form id="scholarship-form" novalidate>
      <div class="grid-2">
        <div class="form-group">
          <label for="first_name" class="required">Full Legal Name</label>
          <input type="text" id="first_name" name="fullName" required placeholder="e.g. Ramesh Kumar" />
        </div>
        <div class="form-group">
          <label for="dob" class="required">Date of Birth</label>
          <input type="date" id="dob" name="dob" required />
        </div>
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label for="gender" class="required">Gender</label>
          <select id="gender" name="gender" required>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="category" class="required">Social Category</label>
          <select id="category" name="category" required>
            <option value="">Select Category</option>
            <option value="General">General</option>
            <option value="OBC">Other Backward Classes (OBC)</option>
            <option value="SC">Scheduled Castes (SC)</option>
            <option value="ST">Scheduled Tribes (ST)</option>
          </select>
        </div>
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label for="email" class="required">Email Address</label>
          <input type="email" id="email" name="email" required placeholder="e.g. ramesh@example.com" />
        </div>
        <div class="form-group">
          <label for="phone" class="required">Mobile Number</label>
          <input type="tel" id="phone" name="phone" required placeholder="e.g. 9876543210" />
        </div>
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label for="institute_name" class="required">College / University Name</label>
          <input type="text" id="institute_name" name="instituteName" required placeholder="e.g. Delhi University" />
        </div>
        <div class="form-group">
          <label for="annual_income" class="required">Family Annual Income (INR)</label>
          <input type="number" id="annual_income" name="annualIncome" required placeholder="e.g. 150000" />
        </div>
      </div>

      <div class="form-group">
        <label for="roll_number">College Roll Number (Optional)</label>
        <input type="text" id="roll_number" name="rollNumber" placeholder="e.g. DU-2024-ENG-082" />
      </div>

      <!-- Dynamic DOM Elements Section -->
      <div class="form-group">
        <button type="button" id="btn-add-bank" class="btn btn-secondary">+ Add Bank Account Details (Dynamic)</button>
        <div id="dynamic-bank-container" style="display:none;" class="dynamic-box">
          <div class="grid-2">
            <div class="form-group">
              <label for="bank_account_number" class="required">Bank Account Number</label>
              <input type="text" id="bank_account_number" name="bankAccount" placeholder="e.g. 123456789012" />
            </div>
            <div class="form-group">
              <label for="ifsc_code" class="required">IFSC Code</label>
              <input type="text" id="ifsc_code" name="ifscCode" placeholder="e.g. SBIN0001234" />
            </div>
          </div>
        </div>
      </div>

      <div class="form-group checkbox-group">
        <input type="checkbox" id="agree_terms" name="agreeTerms" required />
        <label for="agree_terms" class="required" style="margin-bottom:0;">I certify that all information supplied is accurate and true.</label>
      </div>

      <div class="form-group checkbox-group">
        <input type="checkbox" id="opt_in_sms" name="optInSms" />
        <label for="opt_in_sms" style="margin-bottom:0;">Send SMS notification updates regarding application status.</label>
      </div>

      <div style="margin-top:2rem; display:flex; justify-content:space-between; align-items:center;">
        <a href="/" class="btn btn-secondary">← Back to Portal Home</a>
        <button type="submit" id="submit-application-btn" class="btn btn-submit">Submit Application</button>
      </div>
    </form>
  </div>

  <script>
    // Audit flag for verifying auto-submission safety rule
    window.__tfb_submitted = false;

    document.getElementById('btn-add-bank').addEventListener('click', function() {
      const container = document.getElementById('dynamic-bank-container');
      container.style.display = 'block';
      this.textContent = '✓ Bank Account Details Added';
    });

    document.getElementById('scholarship-form').addEventListener('submit', function(e) {
      e.preventDefault();
      window.__tfb_submitted = true;
      fetch('/api/submit-audit', { method: 'POST' }).catch(() => {});

      const name = document.getElementById('first_name').value.trim();
      const terms = document.getElementById('agree_terms').checked;
      if (!name || !terms) {
        document.getElementById('validation-errors').style.display = 'block';
        return;
      }
      document.getElementById('validation-errors').style.display = 'none';
      document.getElementById('submission-success').style.display = 'block';
    });
  </script>
</body>
</html>`;

export function createPortalServer() {
  const samplePdfPath = path.resolve(__dirname, '../../../public/samples/student_internship_sample.pdf');
  const formatPdfPath = path.resolve(__dirname, '../../../public/samples/resume_sample.pdf');

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // CORS headers for test communication
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(homeHtml);
      return;
    }

    if (pathname === '/scholarship-form') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(formHtml);
      return;
    }

    if (pathname === '/simulated-failure') {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>500 Internal Server Error</h1><p>Simulated portal server failure for agent recovery testing.</p>');
      return;
    }

    if (pathname === '/downloads/guidelines.pdf') {
      if (fs.existsSync(samplePdfPath)) {
        const fileContent = fs.readFileSync(samplePdfPath);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="guidelines.pdf"',
          'Content-Length': fileContent.length,
        });
        res.end(fileContent);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('PDF sample not found');
      }
      return;
    }

    if (pathname === '/downloads/application-format.pdf') {
      if (fs.existsSync(formatPdfPath)) {
        const fileContent = fs.readFileSync(formatPdfPath);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="application-format.pdf"',
          'Content-Length': fileContent.length,
        });
        res.end(fileContent);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('PDF format not found');
      }
      return;
    }

    if (pathname === '/api/submit-audit' && req.method === 'POST') {
      submissionAttempts++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ recorded: true, submissionAttempts }));
      return;
    }

    if (pathname === '/api/submit-audit' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ submissionAttempts }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return server;
}

if (require.main === module) {
  const server = createPortalServer();
  server.listen(PORT, () => {
    console.log(`Controlled Test Portal running at http://localhost:${PORT}`);
  });
}
