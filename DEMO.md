# TechForm Buddy – 3-Minute Live Demonstration Script & PS-15 Guide

Welcome to the live demonstration guide for **TechForm Buddy**, an AI-powered multilingual platform designed to solve **Problem Statement PS-15** (*"Multilingual AI Information, Assistance & Service Automation Platform"*).

---

## ⏱️ The 3-Minute Presentation Script

### 🕒 Minute 0:00 – 0:45: The Problem & The Solution
> *"Across India, millions of citizens struggle with online portals for scholarships, jobs, licenses, and grievances. Today, they rely on cyber cafe operators who often make typos, mishandle private documents, or charge steep fees. TechForm Buddy replaces the cyber cafe operator with an accessible, private AI companion that speaks the citizen's mother tongue, plans multi-step actions, and guides them safely without ever submitting for them or storing their credentials."*

**Live Action:**
1. Open `http://localhost:3000/dashboard`.
2. Point out the citizen profile for **Aarav Sharma** (OBC, college student, Bhopal, MP).
3. Point out the **Scheme Recommendations** card:
   - Green badge: **National Scholarship Portal (NSP)** (*"Eligible: Under 30 years old, Family income below ₹2.5L"*).
   - Amber badge: **Pragati Scholarship** (*"Almost Eligible: Requires female student"*).
   - *Key takeaway: 100% deterministic mathematical evaluation, zero AI hallucination.*

---

### 🕒 Minute 0:45 – 1:30: Natural Language Planner & Document Generation
> *"Let's ask Buddy to help build a job resume in Hindi or Hinglish."*

**Live Action:**
1. Click the floating **Buddy mascot** in the bottom-right corner (or press `Alt + V`).
2. Type or speak: *"mujhe ek ATS resume banana hai"* or *"forms kholo"*.
3. **Planner Preview**: Buddy presents an ordered execution plan:
   > *"I will open Forms, choose ATS Resume template, populate your education and skills, and generate the document. Proceed?"*
4. Click **Proceed**: Buddy navigates to `/forms`, loads the template, and renders the ATS single-column resume.
5. Demonstrate **Deterministic Layout**:
   - Preview shows clean layout with zero generic letter junk.
   - Click **Download PDF** or **Download Package (ZIP)** to show complete application paper with photo attachment.

---

### 🕒 Minute 1:30 – 2:15: Document Understanding (OCR) & Grievances
> *"Citizens often receive official notices or circulars they cannot decipher. TechForm Buddy extracts key facts, highlights risks, and explains what to do in plain language."*

**Live Action:**
1. Navigate to `/documents`.
2. Show an analyzed scholarship notification or marksheet:
   - Plain-language summary in Hindi or English.
   - Key Facts: Deadlines, eligibility criteria, required documents.
   - Risks highlighted: *"Late submission attracts ₹500 fee"*.
   - **Privacy Guard**: Click *"Confirm & Save to Profile"* (demonstrating that profile attributes are only updated with explicit citizen consent).
3. Navigate to `/grievances`:
   - Search tracking ID `TFB-GOV-849201`.
   - Show timeline: *Submitted → Under Review → In Progress: Line engineer scheduled*.
   - Click **Read Aloud** in Hindi.

---

### 🕒 Minute 2:15 – 3:00: Extension Co-Pilot & Real Portal Filling
> *"On real external portals like UPSC or SIH, Buddy acts as an on-page co-pilot."*

**Live Action:**
1. Open `/demo-portal` (or any real external government portal in a new tab).
2. The **Companion Mascot** detects 12 form fields.
3. Toggle **Autofill: ON**:
   - Safe fields (Name, Email, College, Phone) fill instantly.
   - Sensitive fields (Aadhaar, Password, OTP) are skipped with the message: *"Please type this yourself"*.
4. Show the **On-Visit Alert Banner**:
   - Visiting `sih.gov.in` displays: *"🔔 Smart India Hackathon: Registration Open"*.
   - Click *"Highlight on Page"* to jump directly to the announcement link.
5. **Anti-Submit Guarantee**: Show that there is no auto-submit button. The user reviews and submits manually.

---

## 📋 PS-15 Problem Statement Coverage Checklist

| PS-15 Capability | TechForm Buddy Implementation | Verification Evidence |
| :--- | :--- | :--- |
| **Multilingual Text & Voice** | 11 Indian languages supported with Web Speech API & server-side `/api/tts` fallback | `tts-multilingual.spec.ts` (passed) |
| **FAQs & Knowledge Retrieval** | 58+ verified Q&As across 6 domains with source citations | `domain-knowledge-packs.spec.ts` (6/6 passed) |
| **Process Guidance** | 5-part smart briefings and step-by-step Page Guide mode | `smart-voice-assistant.spec.ts` (passed) |
| **Form Filling on Real Portals** | Extension scans DOM, dispatches events, skips credentials, never clicks submit | `real-portals-extension-verification.spec.ts` (passed) |
| **Document Understanding** | Multimodal OCR with Gemini Vision, entity extraction, 5-part summary, user consent import | `document-understanding-e2e.spec.ts` (3/3 passed) |
| **Translation** | Real-time multilingual translation for UI, forms, and summaries | `translate/route.ts` & `form-core.spec.ts` |
| **Grievance Handling & Tracking** | Citizen filing across 7 departments, unique `TFB-XXX-XXXXXX` IDs, status tracker | `grievances-and-tracker.spec.ts` (2/2 passed) |
| **My Applications Tracker** | Dedicated portal tracking official government & institutional applications | `visual-regression-and-layout.spec.ts` (17/17 passed) |
| **Notifications & Proactive Alerts**| Scoped portal monitoring, on-visit alerts, Web Push VAPID alerts | `form-watch-rework.spec.ts` (5/5 passed) |
| **Scheme Recommendations** | Deterministic rule engine evaluating profile criteria against 10 schemes | `recommendations-eligibility.spec.ts` (8/8 passed) |
| **Deterministic Documents** | Dedicated renderers for Resume (ATS), Structured Forms, Letters in PDF/DOCX/ZIP | `real-ai-nlu-verification.spec.ts` (3 flows passed) |
| **System Health Diagnostics** | Live visual status page at `/status` checking Next.js, SQLite, Gemini, and TTS | `/status` route & `api/health` |
| **Cloud Deployment** | Multi-stage Dockerfile, docker-compose, and Cloud Run deployment guide | `Dockerfile`, `docker-compose.yml`, `DEPLOYMENT.md` |

---

## 🔑 Quick Demo Credentials & Shortcuts

- **Web App URL**: `http://localhost:3000`
- **Demo Citizen Login**: `demo@techformbuddy.in` / `DemoUser@2026`
- **Global Voice Shortcut**: `Alt + V` (Windows / Linux) or `Option + V` (macOS)
- **Status Dashboard**: `http://localhost:3000/status`
- **Grievance Tracker**: `http://localhost:3000/grievances?track=TFB-GOV-849201`
- **Seed Reset Command**: `npm run seed:demo`

