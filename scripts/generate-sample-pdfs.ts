import fs from 'fs';
import path from 'path';
import { generatePdf } from '../src/lib/documentExporter';
import { getTemplateById, generateFallbackDocument } from '../src/lib/templates';

async function main() {
  const outDir = path.resolve(process.cwd(), 'public/samples');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Load sample photo from public/icon-192.png
  const samplePhotoBuf = fs.readFileSync(path.resolve(process.cwd(), 'public/icon-192.png'));
  const samplePhotoBase64 = samplePhotoBuf.toString('base64');

  // 1. Generate Student Internship Application Form PDF
  console.log('Generating student_internship_sample.pdf...');
  const internshipTmpl = getTemplateById('student_internship');
  if (!internshipTmpl) {
    throw new Error('student_internship template not found');
  }

  const internshipFields = {
    applicant_name: 'Raj Vishwakarma',
    father_name: 'Mahesh Vishwakarma',
    dob: '2003-08-14',
    college: 'Maulana Azad National Institute of Technology, Bhopal',
    course: 'B.Tech in Computer Science & Engineering',
    semester_year: '6th Semester (3rd Year)',
    contact: '9876543210',
    email: 'raj.vishwakarma@example.com',
    skills: 'TypeScript, React, Next.js, Node.js, Python, PostgreSQL, REST APIs',
    preferred_domain: 'Full Stack Web Development & AI Engineering',
    duration: '6 Months (Jan 2027 - June 2027)',
    organization_name: 'National Informatics Centre (NIC)',
    recipient_name: 'The Director General, National Informatics Centre',
  };

  const internshipSections = generateFallbackDocument(
    internshipTmpl,
    internshipFields,
    'en',
    'Student Internship Application Form'
  );

  const internshipPdfBytes = await generatePdf(
    'Student Internship Application Form',
    internshipSections,
    'en',
    {
      kind: 'application_form',
      photoBase64: samplePhotoBase64,
    }
  );

  const internshipPath = path.join(outDir, 'student_internship_sample.pdf');
  fs.writeFileSync(internshipPath, internshipPdfBytes);
  console.log('Saved:', internshipPath, `(${internshipPdfBytes.length} bytes)`);

  // 2. Generate Resume PDF
  console.log('Generating resume_sample.pdf...');
  const resumeTmpl = getTemplateById('resume');
  if (!resumeTmpl) {
    throw new Error('resume template not found');
  }

  const resumeFields = {
    applicant_name: 'Raj Vishwakarma',
    contact: '9876543210',
    email: 'raj.vishwakarma@example.com',
    location: 'Bhopal, Madhya Pradesh, India',
    linkedin_github: 'https://github.com/rajvishwakarma',
    summary: 'Proactive Full Stack Developer with 2+ years of hands-on experience building scalable web applications with React, Next.js, and TypeScript. Passionate about accessible user interfaces and high-performance software architecture.',
    education: 'B.Tech in Computer Science and Engineering\nMaulana Azad National Institute of Technology (MANIT), Bhopal | CGPA: 8.8/10 (2023 - 2027)',
    skills: 'Languages: TypeScript, JavaScript, Python, SQL\nFrameworks & Libraries: React, Next.js, Node.js, Express, Tailwind CSS\nDatabases: PostgreSQL, SQLite, Redis\nTools & Platforms: Git, Docker, Linux, Playwright, Jest',
    projects: 'TechForm Buddy — Multilingual Form Assistant with Voice Control & Autofill\n• Engineered AI-driven offline-first form filling system serving vernacular users across India.\n• Built Playwright end-to-end testing suite validating zero hydration mismatches and strict PII protection.\n\nSmart Grievance Tracker\n• Developed real-time citizen portal with SMS/Email OTP authentication and audit logging.',
    experience: 'Software Engineering Intern — TechNova Labs (May 2026 - July 2026)\n• Optimized web performance and reduced bundle sizes by 35% using code splitting and lazy loading.\n• Designed and integrated secure JWT and OAuth2 authorization workflows.',
  };

  const resumeSections = generateFallbackDocument(
    resumeTmpl,
    resumeFields,
    'en',
    'Resume'
  );

  const resumePdfBytes = await generatePdf(
    'Raj Vishwakarma - Resume',
    resumeSections,
    'en',
    {
      kind: 'resume',
      photoBase64: samplePhotoBase64,
    }
  );

  const resumePath = path.join(outDir, 'resume_sample.pdf');
  fs.writeFileSync(resumePath, resumePdfBytes);
  console.log('Saved:', resumePath, `(${resumePdfBytes.length} bytes)`);

  // 3. Generate Hindi Internship Application Form to verify Hindi fonts & rendering
  console.log('Generating student_internship_hindi_sample.pdf...');
  const hindiSections = generateFallbackDocument(
    internshipTmpl,
    {
      ...internshipFields,
      applicant_name: 'राज विश्वकर्मा',
      father_name: 'महेश विश्वकर्मा',
      college: 'मौलाना आज़ाद राष्ट्रीय प्रौद्योगिकी संस्थान, भोपाल',
      course: 'बी.टेक (कंप्यूटर साइंस)',
      semester_year: 'छठा सेमेस्टर (तृतीय वर्ष)',
      skills: 'टाइपस्क्रिप्ट, रिएक्ट, नेक्स्ट.जेएस, पायथन',
      preferred_domain: 'फुल स्टैक वेब डेवलपमेंट',
      duration: '६ माह',
      organization_name: 'राष्ट्रीय सूचना विज्ञान केंद्र (एनआईसी)',
      recipient_name: 'महानिदेशक महोदय, राष्ट्रीय सूचना विज्ञान केंद्र',
    },
    'hi',
    'छात्र इंटर्नशिप आवेदन पत्र'
  );

  const hindiPdfBytes = await generatePdf(
    'छात्र इंटर्नशिप आवेदन पत्र',
    hindiSections,
    'hi',
    {
      kind: 'application_form',
      photoBase64: samplePhotoBase64,
    }
  );

  const hindiPath = path.join(outDir, 'student_internship_hindi_sample.pdf');
  fs.writeFileSync(hindiPath, hindiPdfBytes);
  console.log('Saved:', hindiPath, `(${hindiPdfBytes.length} bytes)`);
}

main().catch(err => {
  console.error('Failed generating sample PDFs:', err);
  process.exit(1);
});

