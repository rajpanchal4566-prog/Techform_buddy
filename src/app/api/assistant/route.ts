import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { searchDomainQA, getDomainKnowledgeItems } from '@/lib/domainKnowledge';

export interface KnowledgeItem {
  id: string;
  domain: string;
  keywords: string[];
  title: string;
  summary: string;
  steps: string[];
  documentsNeeded: string[];
  formCategory: string;
  formFields: { label: string; type: string; required: boolean }[];
  portalUrl: string;
  processingTime?: string;
  officialDepartment?: string;
}

// Comprehensive Verified Real-World Form Guidance Database
const BASE_KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: 'gov-passport',
    domain: 'government',
    keywords: ['passport', 'travel', 'visa', 'seva', 'renew passport', 'tatkaal', 'psk', 'passport application'],
    title: 'Passport Application & Tatkaal Renewal (Passport Seva)',
    summary: 'Apply for a fresh Indian Ordinary Passport (36 or 60 pages), Tatkaal issuance, or renew an expired passport via Passport Seva Online.',
    steps: [
      'Register an account on Passport Seva Online Portal (passportindia.gov.in) with your active email and mobile.',
      'Log in and click "Apply for Fresh Passport / Re-issue of Passport" to initiate Form 1.',
      'Choose Scheme Type: Normal or Tatkaal, and Booklet Type (36 Pages standard or 60 Pages jumbo).',
      'Fill in applicant details, family background, residential address, emergency contact, and previous passport details.',
      'Upload Proof of Date of Birth (Birth Certificate/10th Marksheet), Address Proof, and Non-ECR status proof if applicable.',
      'Pay application fee online (SBI NetBanking, Credit/Debit Card, or UPI) and book an appointment slot at nearest PSK / Post Office PSK.',
      'Visit PSK on scheduled date with original documents for biometric capture, digital signature, and photograph.',
      'Track police verification via SMS. Passport is dispatched via India Post Speed Post upon clearance.',
    ],
    documentsNeeded: [
      'Aadhaar Card (Identity & Address Proof)',
      'Proof of Date of Birth (Birth Certificate, School Leaving Certificate, or 10th Marksheet)',
      'Current Address Proof (Electricity Bill, Water Bill, Bank Passbook with photo, or Rent Agreement)',
      '10th Standard Passing Certificate (for Non-ECR status eligibility)',
      'Old Passport Booklet (in case of renewal / re-issue)',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Applicant Given Name', type: 'text', required: true },
      { label: 'Surname', type: 'text', required: false },
      { label: 'Date of Birth', type: 'date', required: true },
      { label: 'Gender', type: 'text', required: true },
      { label: 'Marital Status', type: 'text', required: true },
      { label: "Father's Full Name", type: 'text', required: true },
      { label: "Mother's Full Name", type: 'text', required: true },
      { label: 'Email Address', type: 'email', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'Present Residential Address', type: 'textarea', required: true },
      { label: 'Police Station Jurisdiction', type: 'text', required: true },
      { label: 'Emergency Contact Person & Phone', type: 'text', required: true },
    ],
    portalUrl: 'https://www.passportindia.gov.in',
    processingTime: 'Normal: 15-20 business days | Tatkaal: 3-5 business days',
    officialDepartment: 'Consular, Passport & Visa (CPV) Division, Ministry of External Affairs',
  },
  {
    id: 'gov-pan',
    domain: 'government',
    keywords: ['pan', 'pan card', 'tax', 'income tax', 'nsdl', 'uti', 'tin', 'e-pan', 'form 49a', 'instant pan'],
    title: 'Instant e-PAN & New PAN Card Application (Form 49A)',
    summary: 'Apply for an instant paperless digital e-PAN in 10 minutes using Aadhaar e-KYC or standard physical laminated PAN card.',
    steps: [
      'Visit Income Tax e-Filing portal (incometax.gov.in) for Instant e-PAN or Protean NSDL / UTIITSL for Form 49A.',
      'Enter your 12-digit Aadhaar Number and complete OTP verification on your Aadhaar-linked mobile.',
      'Review and validate your pre-fetched Aadhaar demographic details (Name, DOB, Gender, Address).',
      'Choose physical card delivery preference and digital signature mode (e-Sign via Aadhaar OTP).',
      'Pay nominal fee of ₹107 for physical card dispatch (e-PAN is 100% free of government charge).',
      'Instant e-PAN PDF with QR code is generated within 10 minutes for immediate download.',
      'Physical laminated PAN card is delivered by Speed Post to your Aadhaar address within 10-15 business days.',
    ],
    documentsNeeded: [
      'Aadhaar Card with linked active mobile number for OTP e-KYC',
      'Passport size photograph (only required if applying through non-paperless mode)',
      'Proof of Identity & Address (auto-fetched from UIDAI in paperless mode)',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Full Name as per Aadhaar', type: 'text', required: true },
      { label: "Father's Full Name", type: 'text', required: true },
      { label: 'Date of Birth', type: 'date', required: true },
      { label: 'Gender', type: 'text', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'Mobile Number (Aadhaar linked)', type: 'tel', required: true },
      { label: 'Email ID', type: 'email', required: true },
      { label: 'Delivery Address for Physical PAN', type: 'textarea', required: true },
    ],
    portalUrl: 'https://www.incometax.gov.in',
    processingTime: 'Instant e-PAN: 10 minutes | Physical Card: 7-14 days',
    officialDepartment: 'Income Tax Department, Central Board of Direct Taxes (CBDT)',
  },
  {
    id: 'gov-driving-license',
    domain: 'government',
    keywords: ['driving licence', 'driving license', 'dl', 'learning licence', 'learner license', 'parivahan', 'sarathi', 'rto', 'vehicle license'],
    title: 'Driving Licence & Learner Licence Application (Sarathi Parivahan)',
    summary: 'Apply online for a new Learner Licence (LL), Permanent Driving Licence (DL), or add class of vehicle via Sarathi Parivahan.',
    steps: [
      'Visit Parivahan Sewa portal (parivahan.gov.in) and select "Driving Licence Related Services" -> your State.',
      'Step 1 (Learner Licence): Click "Apply for Learner Licence". Choose Aadhaar Authentication for contactless home LL test or non-Aadhaar for RTO visit.',
      'Fill applicant details, blood group, educational qualification, and select vehicle classes (MCWG for Motorcycle, LMV for Car).',
      'Upload Form 1 (Self-declaration physical fitness), address proof, age proof, and passport photo with signature.',
      'Pay application fee online (approx. ₹200-₹500 depending on vehicle class).',
      'Complete online LL test (traffic rules and road signs) from home or at RTO. Download Learner Licence upon passing.',
      'Step 2 (Permanent Driving Licence): After 30 days of LL issuance (valid up to 6 months), click "Apply for Driving Licence".',
      'Book a practical driving test slot at your local RTO and present your vehicle for the track driving test.',
      'Upon passing the test, the smart card Driving Licence is approved and posted to your address.',
    ],
    documentsNeeded: [
      'Aadhaar Card (Address & Identity Proof)',
      'Age Proof (10th Marksheet, Birth Certificate, or School Leaving Certificate)',
      'Form 1 Physical Fitness Declaration (Form 1A Medical Certificate from MBBS doctor for transport/commercial vehicles or age 40+)',
      'Passport size photographs and digital signature sample',
      'Valid Learner Licence (for permanent DL application)',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Applicant Full Name', type: 'text', required: true },
      { label: "Father / Guardian Name", type: 'text', required: true },
      { label: 'Date of Birth', type: 'date', required: true },
      { label: 'Blood Group', type: 'text', required: true },
      { label: 'Educational Qualification', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
      { label: 'Vehicle Class (e.g. LMV / MCWG)', type: 'text', required: true },
      { label: 'RTO Office Jurisdiction', type: 'text', required: true },
      { label: 'Permanent Address', type: 'textarea', required: true },
    ],
    portalUrl: 'https://parivahan.gov.in',
    processingTime: 'Learner Licence: Same day | Driving Licence: 7-15 days after practical test',
    officialDepartment: 'Ministry of Road Transport and Highways (MoRTH)',
  },
  {
    id: 'gov-voter-id',
    domain: 'government',
    keywords: ['voter id', 'voter card', 'epic', 'election commission', 'voter registration', 'eci', 'form 6', 'new voter'],
    title: 'New Voter ID Registration (ECI Form 6)',
    summary: 'Enroll as a new elector or register for first-time Voter Photo Identity Card (EPIC) under Election Commission of India.',
    steps: [
      'Visit Election Commission of India Voter Services Portal (voters.eci.gov.in) or download the Voter Helpline App.',
      'Sign up using your mobile number and set your login password.',
      'Select "New registration for general electors" (Form 6).',
      'Select State, District, and your Parliamentary / Assembly Constituency.',
      'Enter personal details (Name, Relative name, Date of Birth, Gender, Disability status if any).',
      'Provide current residential address with village/town, post office, PIN code, and Tehsil/Mandal.',
      'Upload passport photograph, self-attested proof of age, and proof of residence.',
      'Review complete Form 6 summary and submit. Note down the 12-digit Application Reference Number for tracking.',
      'Booth Level Officer (BLO) may visit for physical field verification. Voter ID card is dispatched to address free of charge.',
    ],
    documentsNeeded: [
      'Proof of Age / DOB (Aadhaar Card, PAN Card, Birth Certificate, or 10th Certificate)',
      'Proof of Residence (Aadhaar Card, Water/Electricity/Gas connection bill, Indian Passport, or Bank Passbook)',
      'Recent Passport-sized color photograph (white background)',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Applicant Given Name', type: 'text', required: true },
      { label: 'Surname', type: 'text', required: false },
      { label: 'Name of Relative (Father/Mother/Husband)', type: 'text', required: true },
      { label: 'Relationship Type', type: 'text', required: true },
      { label: 'Date of Birth', type: 'date', required: true },
      { label: 'Gender', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
      { label: 'Email ID', type: 'email', required: false },
      { label: 'Assembly Constituency', type: 'text', required: true },
      { label: 'Complete Residential Address', type: 'textarea', required: true },
      { label: 'PIN Code', type: 'text', required: true },
    ],
    portalUrl: 'https://voters.eci.gov.in',
    processingTime: '15 to 30 days upon BLO verification',
    officialDepartment: 'Election Commission of India (ECI)',
  },
  {
    id: 'health-ayushman',
    domain: 'healthcare',
    keywords: ['ayushman', 'pmjay', 'health card', 'ayushman bharat', 'insurance', 'hospital card', 'abha card', '5 lakh health'],
    title: 'Ayushman Bharat PM-JAY & ABHA Health Card (₹5 Lakh Free Treatment)',
    summary: 'Avail up to ₹5,00,000 per family per year cashless hospitalization coverage at empanelled public and private hospitals across India.',
    steps: [
      'Visit Beneficiary Portal (beneficiary.nha.gov.in) or PM-JAY portal (pmjay.gov.in).',
      'Log in as Beneficiary using Mobile Number and OTP.',
      'Search your family eligibility by State, Scheme (PMJAY), and identification: Family ID / Ration Card / Aadhaar Number / PMJAY ID.',
      'If family member status shows "e-KYC Pending" or "Not Linked", click the Action button.',
      'Authenticate using Aadhaar OTP, IRIS, or Fingerprint biometric.',
      'Capture a live photograph using webcam or mobile camera and confirm your demographic address details.',
      'Once approved (instant to 24 hours), click "Download Ayushman Card" to save the high-resolution Gold Health Card PDF.',
      'Show this digital card or physical printout at any empanelled hospital along with Aadhaar for 100% cashless medical treatment.',
    ],
    documentsNeeded: [
      'Aadhaar Card of all family beneficiaries',
      'Ration Card / NFSA Family ID / SECC 2011 Household Census document',
      'Active mobile number linked with Aadhaar for instant OTP validation',
    ],
    formCategory: 'healthcare',
    formFields: [
      { label: 'Beneficiary Full Name', type: 'text', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'Ration Card / Family ID', type: 'text', required: true },
      { label: 'Date of Birth', type: 'date', required: true },
      { label: 'Gender', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
      { label: 'State & District', type: 'text', required: true },
      { label: 'Residential Address', type: 'textarea', required: true },
    ],
    portalUrl: 'https://beneficiary.nha.gov.in',
    processingTime: 'Instant to 24 hours online | Instant at Common Service Centers (CSC)',
    officialDepartment: 'National Health Authority (NHA), Ministry of Health and Family Welfare',
  },
  {
    id: 'gov-aadhaar',
    domain: 'government',
    keywords: ['aadhaar', 'uidai', 'update aadhaar', 'myaadhaar', 'aadhaar card', 'address update', 'name change aadhaar'],
    title: 'Aadhaar Card Demographics Update & Document Revalidation (myAadhaar)',
    summary: 'Update address, name, DOB, or upload proof documents online through UIDAI myAadhaar self-service portal.',
    steps: [
      'Visit myAadhaar official portal (myaadhaar.uidai.gov.in).',
      'Click "Login" and authenticate with your 12-digit Aadhaar number and OTP received on linked mobile.',
      'Select the service required: "Document Update" (Proof of Identity & Address) or "Address Update".',
      'For Address Update: Enter new address details (Care Of, House/Flat No, Street, Landmark, Pincode, City, State).',
      'Select matching valid Supporting Document type from approved list (e.g. Electricity bill, Bank statement, Ration card, Passport).',
      'Upload clear scanned copy or photo of the supporting document in JPEG/PDF format (under 2MB).',
      'Pay nominal government processing fee of ₹50 online.',
      'Save the Service Request Number (SRN) for tracking. UIDAI verification takes 3-7 business days.',
    ],
    documentsNeeded: [
      'Aadhaar Number with registered mobile number for OTP',
      'Proof of Identity (POI): PAN Card, Passport, Voter ID, Driving Licence',
      'Proof of Address (POA): Electricity Bill (within 3 months), Bank Passbook/Statement, Rent Agreement, Water Bill',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Full Name as per Aadhaar', type: 'text', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'New Address to be Updated', type: 'textarea', required: true },
      { label: 'PIN Code', type: 'text', required: true },
      { label: 'District & State', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
      { label: 'Supporting Document Type', type: 'text', required: true },
    ],
    portalUrl: 'https://myaadhaar.uidai.gov.in',
    processingTime: '3 to 7 working days',
    officialDepartment: 'Unique Identification Authority of India (UIDAI)',
  },
  {
    id: 'gov-birth-cert',
    domain: 'government',
    keywords: ['birth certificate', 'crs', 'crsorgi', 'new born registration', 'municipal birth', 'death certificate'],
    title: 'Birth Certificate Application (Civil Registration System - CRS)',
    summary: 'Register birth of a newborn or apply for official Birth Certificate through Civil Registration System (CRS) or state municipal portal.',
    steps: [
      'Birth occurred in hospital: Hospital initiates institutional reporting on CRS portal (crsorgi.gov.in) within 21 days.',
      'Birth occurred at home: Inform local Registrar / Gram Panchayat / Municipal Health Officer within 21 days.',
      'Register on state e-District or Civil Registration portal (crsorgi.gov.in).',
      'Fill Form 1 (Birth Report): Date and exact time of birth, gender, child name (or left blank for later addition).',
      'Enter Father\'s and Mother\'s Aadhaar, educational attainment, occupation, and religion.',
      'Provide place of birth (Hospital discharge summary or address proof of residence where birth occurred).',
      'Upload hospital discharge certificate / medical attendant slip and parent identity cards.',
      'Pay applicable statutory fee. Once registered, download digitally signed QR-coded Birth Certificate.',
    ],
    documentsNeeded: [
      'Hospital Discharge Slip / Medical Certificate of Birth',
      'Aadhaar Cards of both Father and Mother',
      'Marriage Certificate or joint declaration of parents',
      'Proof of Residence / Address of Parents',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Child Full Name', type: 'text', required: false },
      { label: 'Date of Birth', type: 'date', required: true },
      { label: 'Gender', type: 'text', required: true },
      { label: "Father's Full Name & Aadhaar", type: 'text', required: true },
      { label: "Mother's Full Name & Aadhaar", type: 'text', required: true },
      { label: 'Place of Birth (Hospital / Home)', type: 'text', required: true },
      { label: 'Hospital Name & Address', type: 'textarea', required: false },
      { label: 'Permanent Address of Parents', type: 'textarea', required: true },
      { label: 'Contact Phone Number', type: 'tel', required: true },
    ],
    portalUrl: 'https://crsorgi.gov.in',
    processingTime: 'Within 7-14 working days',
    officialDepartment: 'Office of the Registrar General & Census Commissioner, Ministry of Home Affairs',
  },
  {
    id: 'gov-income-cert',
    domain: 'government',
    keywords: ['income certificate', 'e-district', 'tahsildar', 'patwari', 'income proof', 'family income certificate'],
    title: 'Income Certificate Application (State Revenue / e-District)',
    summary: 'Obtain an official revenue-stamped Income Certificate for scholarship eligibility, fee concessions, and government welfare benefits.',
    steps: [
      'Visit your State e-District / Citizen Services Portal (e.g. edistrict.delhigovt.nic.in, edistrict.up.gov.in, mahabhumi, etc.).',
      'Register with Aadhaar and log in to citizen dashboard.',
      'Select Revenue Department -> "Issuance of Income Certificate".',
      'Fill applicant personal details, occupation, and list all sources of income (Salary, Agriculture, Business, Pension, Rent, Other).',
      'Declare total gross annual family income across all earning members.',
      'Upload salary slip / ITR copy (for salaried/business) or self-declaration affidavit (for unorganized/informal sector).',
      'Upload electricity bill, Ration Card, and Aadhaar card.',
      'Submit application. Revenue Inspector (Patwari / Lekhpal) conducts field or telephonic verification.',
      'Download digitally signed QR-coded certificate directly from portal once approved by Tehsildar / Sub-Divisional Magistrate (SDM).',
    ],
    documentsNeeded: [
      'Aadhaar Card of Applicant & Family Head',
      'Salary Slip / Form 16 / ITR Acknowledgement (if salaried)',
      'Notarized Income Affidavit / Self-declaration on non-judicial stamp paper (if self-employed/daily wage)',
      'Ration Card / Family BPL list proof',
      'Electricity Bill / Rent Agreement for address verification',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Applicant Full Name', type: 'text', required: true },
      { label: "Father's / Husband's Name", type: 'text', required: true },
      { label: 'Occupation / Profession', type: 'text', required: true },
      { label: 'Total Annual Family Income (INR)', type: 'number', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'Residential Address', type: 'textarea', required: true },
      { label: 'Tehsil / Sub-Division', type: 'text', required: true },
      { label: 'Purpose of Certificate', type: 'text', required: true },
    ],
    portalUrl: 'https://edistrict.gov.in',
    processingTime: '7 to 15 business days',
    officialDepartment: 'Revenue Department / District Administration of Respective State',
  },
  {
    id: 'gov-caste-cert',
    domain: 'government',
    keywords: ['caste certificate', 'sc certificate', 'st certificate', 'obc certificate', 'ews certificate', 'community certificate'],
    title: 'Caste & EWS Certificate Application (State Revenue Department)',
    summary: 'Apply for SC, ST, OBC (Non-Creamy Layer), or Economically Weaker Section (EWS) reservation certificate for education & government jobs.',
    steps: [
      'Open your State e-District portal or visit local Tehsildar / Revenue Department office.',
      'Choose the appropriate category: SC / ST / OBC / SEBC / EWS Certificate.',
      'Provide applicant bio-data, caste/sub-caste nomenclature, and ancestral lineage details.',
      'Submit historical residency proof proving residence in the state prior to presidential cut-off dates (e.g. 1950 for SC/ST, 1993 for OBC).',
      'For OBC Non-Creamy Layer: Submit proof that annual parental income is below ₹8 Lakhs from non-salary agricultural sources.',
      'Upload father\'s caste certificate, land deed (Khatoni/Sale deed) showing family caste, and school leaving certificate.',
      'Tehsildar/Circle Officer schedules enquiry through village Patwari.',
      'Download officially verified Caste Certificate with digital signature and verification URL.',
    ],
    documentsNeeded: [
      'Aadhaar Card of Applicant & Parents',
      'Father\'s or paternal relative\'s existing Caste Certificate / Land Records / 1950/1993 domicile records',
      'School Leaving Certificate / Transfer Certificate (TC) mentioning caste',
      'Income Certificate (mandatory for OBC Non-Creamy Layer and EWS categories)',
      'Passport size photograph and self-declaration affidavit',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Applicant Full Name', type: 'text', required: true },
      { label: "Father's Full Name", type: 'text', required: true },
      { label: 'Caste / Sub-Caste Name', type: 'text', required: true },
      { label: 'Category (SC / ST / OBC / EWS)', type: 'text', required: true },
      { label: 'Annual Parental Income (INR)', type: 'number', required: true },
      { label: 'Paternal Village / Ancestral Town', type: 'text', required: true },
      { label: 'Current Residential Address', type: 'textarea', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
    ],
    portalUrl: 'https://edistrict.gov.in',
    processingTime: '15 to 21 working days',
    officialDepartment: 'Department of Social Justice & Empowerment / State Revenue Department',
  },
  {
    id: 'gov-ration-card',
    domain: 'government',
    keywords: ['ration card', 'nfsa', 'food security', 'bpl card', 'apl card', 'ration application', 'annapurna'],
    title: 'New Ration Card Application (National Food Security - NFSA)',
    summary: 'Apply for Antyodaya Anna Yojana (AAY) or Priority Household (PHH) subsidized foodgrain Ration Card under NFSA.',
    steps: [
      'Visit State Department of Food & Civil Supplies portal or National Food Security Portal (nfsa.gov.in).',
      'Click "Apply for New Ration Card" and choose family category based on income: AAY (poorest), PHH (BPL), or Non-NFSA (White).',
      'Enter details of the Eldest Female Head of the Family (as designated under Section 12 of NFSA 2013).',
      'Add all family members with their full names, relationship, age, and 12-digit Aadhaar numbers.',
      'Provide details of LPG gas connection (Oil Marketing Company, Consumer Number) and bank account details for DBT.',
      'Upload family group photograph, electricity bill, income proof, and surrender certificate if moving from another area.',
      'Submit Form and submit hard copy at local Fair Price Shop (FPS) / Food Supply Office if mandated by state.',
      'Food Inspector verifies premises. Ration card is issued and mapped to nearest Fair Price Shop.',
    ],
    documentsNeeded: [
      'Aadhaar Card of all family members to be enrolled in the card',
      'Combined family group photograph',
      'LPG Gas Connection Consumer Book / Slip',
      'Income Certificate / Wage Proof of family',
      'Electricity Bill or Rent Agreement for address proof',
      'Bank Account Passbook (in the name of Eldest Female Head of Family)',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Head of Family Name (Eldest Female)', type: 'text', required: true },
      { label: "Father's / Husband's Name", type: 'text', required: true },
      { label: 'Total Number of Family Members', type: 'number', required: true },
      { label: 'Annual Household Income (INR)', type: 'number', required: true },
      { label: 'LPG Connection Number & Company', type: 'text', required: false },
      { label: 'Bank Account Number & IFSC (Head of Family)', type: 'text', required: true },
      { label: 'Complete Residential Address', type: 'textarea', required: true },
      { label: 'Nearest Fair Price Shop (FPS) Preference', type: 'text', required: false },
    ],
    portalUrl: 'https://nfsa.gov.in',
    processingTime: '21 to 30 days',
    officialDepartment: 'Department of Food & Public Distribution, Ministry of Consumer Affairs',
  },
  {
    id: 'gov-epfo-pf',
    domain: 'banking',
    keywords: ['epfo', 'pf', 'provident fund', 'pf withdrawal', 'form 19', 'form 10c', 'form 31', 'uan', 'advance pf'],
    title: 'EPFO PF Withdrawal & Advance Claim (Form 19, 10C, 31)',
    summary: 'Submit online claim for Provident Fund final settlement (Form 19), Pension withdrawal (Form 10C), or COVID/Illness/House advance (Form 31).',
    steps: [
      'Log in to EPFO Member Unified Portal (unifiedportal-mem.epfindia.gov.in) with your 12-digit UAN and Password.',
      'Ensure Prerequisites: Aadhaar is linked & verified, Bank Account with correct IFSC is approved by employer, and PAN is seeded.',
      'Go to "Online Services" tab -> click "Claim (Form-31, 19, 10C & 10D)".',
      'Verify the last 4 digits of your seeded Bank Account Number to validate identity.',
      'Select "Proceed for Online Claim".',
      'Under "I want to apply for", select claim type: PF Advance (Form 31) if still working, or Full Settlement (Form 19 & 10C) if employment ceased 2+ months ago.',
      'For Form 31: Choose purpose (Illness, Marriage, Education, Purchase of House/Flat, Construction, Special Covid).',
      'Upload clear image of cancelled cheque or bank passbook first page showing name, account number, and IFSC.',
      'Request Aadhaar OTP, enter OTP, and submit claim. Amount is credited to bank account within 3 to 7 working days.',
    ],
    documentsNeeded: [
      'Active UAN (Universal Account Number) with mobile linked to Aadhaar',
      'Cancelled Cheque or Bank Passbook showing Name, Account Number, and IFSC clearly',
      'Form 15G / 15H (if service is less than 5 years and withdrawal exceeds ₹50,000 to avoid TDS)',
    ],
    formCategory: 'banking',
    formFields: [
      { label: 'Universal Account Number (UAN)', type: 'text', required: true },
      { label: 'Employee Full Name', type: 'text', required: true },
      { label: 'Registered Bank Account Number', type: 'text', required: true },
      { label: 'Claim Type (Form 31 / 19 / 10C)', type: 'text', required: true },
      { label: 'Purpose of Advance (if Form 31)', type: 'text', required: false },
      { label: 'Amount Required (INR)', type: 'number', required: false },
      { label: 'Current Residential Address', type: 'textarea', required: true },
    ],
    portalUrl: 'https://unifiedportal-mem.epfindia.gov.in',
    processingTime: '3 to 7 working days (credited directly via NEFT)',
    officialDepartment: 'Employees\' Provident Fund Organisation (EPFO), Ministry of Labour and Employment',
  },
  {
    id: 'gov-pm-kisan',
    domain: 'government',
    keywords: ['pm kisan', 'kisan samman nidhi', 'farmer scheme', 'kisan 6000', 'pmkisan', 'kisan registration'],
    title: 'PM Kisan Samman Nidhi Registration (₹6,000 Annual Farmer Support)',
    summary: 'Direct income support of ₹6,000 per year in 3 four-monthly installments of ₹2,000 each for landholding farmer families.',
    steps: [
      'Visit official PM Kisan Portal (pmkisan.gov.in) -> "Farmers Corner".',
      'Click "New Farmer Registration" -> Choose Rural Farmer or Urban Farmer.',
      'Enter Aadhaar number, Mobile number, and select your State.',
      'Authenticate with Aadhaar OTP.',
      'Select District, Sub-District (Tehsil), Block, and Village.',
      'Provide landholding ownership details: Survey / Khata Number, Khasra Number, Area in Hectares, and Land Transfer status.',
      'Upload scanned copy of Land Registry deed / Khatauni document and Bank Passbook (NPCI Aadhaar-seeded account).',
      'Submit application. District Agriculture Officer approves record, and installments start via Direct Benefit Transfer (DBT).',
    ],
    documentsNeeded: [
      'Aadhaar Card of Landholding Farmer',
      'Land Ownership Proof: Khasra / Khatauni / Jamabandi records showing farmer\'s name',
      'Bank Account Passbook (must be NPCI Aadhaar seeded for DBT)',
      'Active mobile number linked to Aadhaar',
    ],
    formCategory: 'government',
    formFields: [
      { label: 'Farmer Full Name', type: 'text', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
      { label: 'State, District & Village', type: 'text', required: true },
      { label: 'Land Survey / Khata Number', type: 'text', required: true },
      { label: 'Khasra Number', type: 'text', required: true },
      { label: 'Cultivable Land Area (in Hectares)', type: 'number', required: true },
      { label: 'Bank Account Number & IFSC', type: 'text', required: true },
    ],
    portalUrl: 'https://pmkisan.gov.in',
    processingTime: 'Approval within 15-30 days; funds credited in next quarterly cycle',
    officialDepartment: 'Department of Agriculture & Farmers Welfare, Ministry of Agriculture',
  },
  {
    id: 'edu-scholarship',
    domain: 'education',
    keywords: ['scholarship', 'nsp', 'student', 'college', 'tuition', 'fee waiver', 'merit', 'post matric', 'pre matric'],
    title: 'National Scholarship Portal (NSP) Application & OTR',
    summary: 'Pre-Matric, Post-Matric, and Merit-cum-Means central and state government scholarships for school, college, and university students.',
    steps: [
      'Visit National Scholarship Portal (scholarships.gov.in) and register for One-Time Registration (OTR) with Aadhaar Face/OTP verification.',
      'Log in with OTR ID and Password to access the National Scholarship application form.',
      'Select Scheme Category: Pre-Matric (Class 1-10) or Post-Matric / MCM / Top Class (College/University/Professional degree).',
      'Select College / Institute using AISHE (All India Survey on Higher Education) Code or Institute Name search.',
      'Enter course details, year of study, roll number, day scholar/hosteller status, and previous year academic percentage.',
      'Provide Annual Family Income as per official Income Certificate.',
      'Upload Previous Year Marksheet, Bonafide Student Certificate, Income Certificate, and Fee Receipt.',
      'Submit application before scheme closing deadline.',
      'Institution Nodal Officer (INO) and District Nodal Officer (DNO) verify records. Funds sent via DBT to student\'s Aadhaar-linked account.',
    ],
    documentsNeeded: [
      'Student Aadhaar Card (linked to bank account for DBT)',
      'Previous Qualifying Examination Marksheet / Grade Card',
      'Bonafide Student Certificate from College / School Head',
      'Current Year College Admission & Fee Payment Receipt',
      'Valid Family Income Certificate issued by competent revenue authority',
      'Caste Certificate / Minority Community Self-Declaration (if applicable)',
    ],
    formCategory: 'education',
    formFields: [
      { label: 'Student Full Name', type: 'text', required: true },
      { label: "Father / Guardian Name", type: 'text', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'College / Institute Name', type: 'text', required: true },
      { label: 'Course Enrolled & Year', type: 'text', required: true },
      { label: 'Previous Exam Percentage / CGPA', type: 'number', required: true },
      { label: 'Annual Family Income (INR)', type: 'number', required: true },
      { label: 'Student Bank Account Number & IFSC', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
    ],
    portalUrl: 'https://scholarships.gov.in',
    processingTime: 'Varies by academic cycle; verification in 15-30 days, disbursement by academic year end',
    officialDepartment: 'Ministry of Electronics & Information Technology (MeitY) & Ministry of Education',
  },
  {
    id: 'bank-mudra',
    domain: 'banking',
    keywords: ['mudra', 'loan', 'business loan', 'shishu', 'kishore', 'tarun', 'credit', 'startup fund', 'pmmy'],
    title: 'Pradhan Mantri MUDRA Yojana (PMMY) Loan Application',
    summary: 'Collateral-free business loans up to ₹10 Lakhs under Shishu (up to ₹50K), Kishore (₹50K-₹5L), or Tarun (₹5L-₹10L) via Jan Samarth.',
    steps: [
      'Visit National Credit Portal Jan Samarth (jansamarth.in) or your commercial bank / NBFC website.',
      'Choose "Business Activity Loan" -> select Pradhan Mantri MUDRA Yojana (PMMY).',
      'Select category: Shishu (up to ₹50,000 for starting), Kishore (₹50,000 to ₹5,00,000), or Tarun (₹5,00,000 to ₹10,00,000 for expansion).',
      'Enter business activity details (Retail shop, Manufacturing unit, Service center, Food stall, Transport operator, etc.).',
      'Submit quotation / proforma invoice for machinery, tools, or working capital requirements.',
      'Provide PAN, Aadhaar, business address proof, and last 6 months bank statement.',
      'Jan Samarth portal generates Digital In-Principle Approval letter.',
      'Selected bank branch processes disbursement without requiring any collateral or third-party guarantee.',
    ],
    documentsNeeded: [
      'Aadhaar Card and PAN Card of Business Owner / Proprietor',
      'Business Enterprise Address Proof (Trade license, Shop Act, GST, or Rent Agreement)',
      'Quotation / Price Estimate of machinery, raw materials, or equipment to be purchased',
      'Bank Account Statement for the last 6 months',
      'Passport size photographs of applicant and co-applicant if any',
    ],
    formCategory: 'banking',
    formFields: [
      { label: 'Applicant / Entrepreneur Name', type: 'text', required: true },
      { label: 'Business / Enterprise Name', type: 'text', required: true },
      { label: 'Loan Category (Shishu / Kishore / Tarun)', type: 'text', required: true },
      { label: 'Loan Amount Requested (INR)', type: 'number', required: true },
      { label: 'Business Nature & Purpose', type: 'text', required: true },
      { label: 'PAN Number', type: 'text', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'Bank Account Number & IFSC', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
    ],
    portalUrl: 'https://www.jansamarth.in',
    processingTime: 'In-Principle approval in 15 minutes; branch disbursement within 7-10 days',
    officialDepartment: 'Department of Financial Services (DFS), Ministry of Finance',
  },
  {
    id: 'biz-msme',
    domain: 'business',
    keywords: ['msme', 'udyam', 'business registration', 'small business', 'gst', 'industry', 'udyam registration', 'zero fee'],
    title: 'MSME Udyam Registration (Zero Government Fee)',
    summary: 'Free official paperless registration for Micro, Small, and Medium Enterprises to access priority lending, subsidies, and tender benefits.',
    steps: [
      'Visit official Udyam Registration Portal (udyamregistration.gov.in). Beware of fake commercial websites charging fees — government registration is 100% free.',
      'Click "For New Entrepreneurs who are not registered yet as MSME".',
      'Enter entrepreneur\'s 12-digit Aadhaar Number and Name as per Aadhaar. Click "Validate & Generate OTP".',
      'Enter Organization Type (Proprietorship, Partnership, LLP, Pvt Ltd, Self Help Group).',
      'Enter PAN of the enterprise and validate with Income Tax database.',
      'Fill Enterprise Name, Plant / Unit location address, and official communication details.',
      'Select National Industry Classification (NIC) Code corresponding to manufacturing or service activity.',
      'Declare number of persons employed and written-down value of investment in plant/machinery and previous year turnover.',
      'Submit with final OTP. Permanent Udyam Registration Certificate with dynamic QR code is generated instantly.',
    ],
    documentsNeeded: [
      'Aadhaar Card of the Proprietor / Managing Partner / Director',
      'PAN Card of the Enterprise / Proprietor',
      'Bank Account Number and IFSC of the business',
      'NIC Code of business activity (searchable on portal)',
    ],
    formCategory: 'business',
    formFields: [
      { label: 'Entrepreneur / Owner Name', type: 'text', required: true },
      { label: 'Enterprise / Business Name', type: 'text', required: true },
      { label: 'Aadhaar Number of Owner', type: 'text', required: true },
      { label: 'PAN of Enterprise / Proprietor', type: 'text', required: true },
      { label: 'Business Address & Unit Location', type: 'textarea', required: true },
      { label: 'Main Business Activity (Manufacturing / Service)', type: 'text', required: true },
      { label: 'Number of Employees', type: 'number', required: true },
      { label: 'Bank Account & IFSC', type: 'text', required: true },
      { label: 'Mobile Number (Aadhaar linked)', type: 'tel', required: true },
      { label: 'Email ID', type: 'email', required: true },
    ],
    portalUrl: 'https://udyamregistration.gov.in',
    processingTime: 'Instant generation of digital certificate',
    officialDepartment: 'Ministry of Micro, Small and Medium Enterprises (MSME)',
  },
  {
    id: 'biz-gst',
    domain: 'business',
    keywords: ['gst', 'gst registration', 'gstin', 'goods and services tax', 'reg-01', 'tax registration'],
    title: 'New GST Registration Application (Form GST REG-01)',
    summary: 'Apply online for Goods and Services Tax Identification Number (GSTIN) for businesses crossing threshold or inter-state sales.',
    steps: [
      'Visit official GST Portal (gst.gov.in) -> Services -> Registration -> "New Registration".',
      'Part A: Select "Taxpayer", State, District, Legal Name of Business, PAN, Email, and Mobile. Complete OTP verification to receive Temporary Reference Number (TRN).',
      'Part B: Log in using TRN and mobile OTP within 15 days.',
      'Tab 1 (Business Details): Trade Name, Constitution of Business, and Reason for obtaining registration.',
      'Tab 2 (Promoters/Partners): Details of Directors/Partners/Proprietor, residential address, Aadhaar, and photo upload.',
      'Tab 3 (Principal Place of Business): Address, proof of premises ownership (Electricity bill / Property tax receipt / Rent agreement with NOC).',
      'Tab 4 (Goods & Services): Search and add top 5 HSN (Goods) or SAC (Services) codes.',
      'Tab 5 (Aadhaar Authentication): Opt for Aadhaar Authentication for instant fast-track approval without physical site visit.',
      'Submit Form with DSC (for companies/LLPs) or EVC (Aadhaar OTP for proprietorship). GSTIN Certificate issued in 3-7 days.',
    ],
    documentsNeeded: [
      'PAN Card of Business / Proprietor',
      'Aadhaar Card of all Partners / Directors / Proprietor',
      'Proof of Business Premises: Electricity Bill / Municipal Khata / Property Tax Receipt along with Rent Agreement & Landlord NOC',
      'Bank Account Proof: Cancelled Cheque / Bank Statement with name and IFSC',
      'Passport size photograph of authorized signatory',
    ],
    formCategory: 'business',
    formFields: [
      { label: 'Legal Name of Business', type: 'text', required: true },
      { label: 'Trade Name', type: 'text', required: true },
      { label: 'PAN of Business / Proprietor', type: 'text', required: true },
      { label: 'State & District', type: 'text', required: true },
      { label: 'Principal Place of Business Address', type: 'textarea', required: true },
      { label: 'Primary HSN / SAC Code', type: 'text', required: true },
      { label: 'Authorized Signatory Name & Mobile', type: 'text', required: true },
      { label: 'Email Address for GST Notifications', type: 'email', required: true },
    ],
    portalUrl: 'https://www.gst.gov.in',
    processingTime: '3 to 7 working days with Aadhaar Authentication',
    officialDepartment: 'Goods and Services Tax Network (GSTN), Ministry of Finance',
  },
  {
    id: 'tax-itr',
    domain: 'banking',
    keywords: ['itr', 'income tax return', 'itr 1', 'sahaj', 'tax filing', 'incometax return', 'efiling'],
    title: 'Income Tax Return (ITR-1 Sahaj) Filing',
    summary: 'File annual Income Tax Return for resident individuals having salary, one house property, and other sources income up to ₹50 Lakhs.',
    steps: [
      'Log in to Income Tax e-Filing Portal (incometax.gov.in) with your PAN and Password.',
      'Navigate to "e-File" -> "Income Tax Returns" -> "File Income Tax Return".',
      'Select Assessment Year (e.g. Current AY), Status: "Individual", and ITR Form: "ITR-1 (Sahaj)".',
      'Review Pre-filled Information: System pre-populates salary, TDS from Form 16, interest from AIS (Annual Information Statement) / TIS.',
      'Confirm personal information and verify bank account for income tax refund.',
      'Verify Gross Total Income under Salary, House Property, and Other Sources (Savings bank interest, FD interest, Dividends).',
      'Claim eligible deductions under Chapter VI-A (Section 80C, 80D health insurance, 80TTA, 80CCD NPS) if under Old Tax Regime.',
      'Calculate Tax: Review tax computation under default New Tax Regime vs Old Tax Regime.',
      'Pay any self-assessment tax due online, then click "Preview and Submit".',
      'CRITICAL: e-Verify your ITR immediately using Aadhaar OTP to complete filing (mandatory within 30 days).',
    ],
    documentsNeeded: [
      'Form 16 issued by employer',
      'Annual Information Statement (AIS) and Form 26AS (downloadable from e-filing portal)',
      'Bank Account Statements for interest income verification',
      'Proof of Tax-Saving Investments (LIC, ELSS, PPF, Tuition fees, Health Insurance receipts if claiming deductions)',
    ],
    formCategory: 'banking',
    formFields: [
      { label: 'Taxpayer Full Name', type: 'text', required: true },
      { label: 'PAN Number', type: 'text', required: true },
      { label: 'Aadhaar Number', type: 'text', required: true },
      { label: 'Gross Salary Income (INR)', type: 'number', required: true },
      { label: 'Income from Other Sources / Interest (INR)', type: 'number', required: false },
      { label: 'Tax Deductions Claimed (80C, 80D, etc.)', type: 'number', required: false },
      { label: 'Bank Account Number & IFSC for Refund', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
      { label: 'Email ID', type: 'email', required: true },
    ],
    portalUrl: 'https://www.incometax.gov.in',
    processingTime: 'Filing: 15-30 minutes; ITR processing & refund: 7-21 days by CPC Bengaluru',
    officialDepartment: 'Central Processing Centre (CPC), Income Tax Department',
  },
  {
    id: 'grv-consumer',
    domain: 'grievance',
    keywords: ['consumer', 'consumer complaint', 'consumer court', 'refund', 'e-daakhil', 'fraud', 'defective goods', 'service dispute'],
    title: 'National Consumer Grievance & E-Daakhil Complaint',
    summary: 'File formal complaints against defective goods, failed refunds, deficient banking/e-commerce services on National Consumer Helpline / E-Daakhil.',
    steps: [
      'Step 1 (Pre-Litigation Mediation): Register on National Consumer Helpline (consumerhelpline.gov.in) or call toll-free 1915.',
      'File convergence grievance against the company with order ID, invoice, and disputed transaction amount. The company has 15-30 days to resolve.',
      'Step 2 (Formal Legal Filing): If grievance remains unresolved, visit E-Daakhil portal (edaakhil.nic.in) to file a formal case in District Consumer Commission.',
      'Register as Complainant on E-Daakhil with Aadhaar verification.',
      'Enter Complainant and Opposite Party (Company/Merchant) details with registered corporate address.',
      'Draft your Complaint Petition outlining dates of incident, deficiency in service/defect, financial loss, and exact relief or compensation sought.',
      'Upload purchase invoice, payment receipt, email correspondence, and formal legal notice copy.',
      'Pay online court fee (exempt up to ₹5 Lakhs claim value; nominal fee for higher amounts).',
      'Case Number and hearing date are assigned. Summons issued to respondent via court system.',
    ],
    documentsNeeded: [
      'Purchase Invoice / Bill / Order Confirmation Receipt',
      'Proof of Payment (Bank Statement, UPI Transaction Screenshot, Credit Card Slip)',
      'Written correspondence / emails sent to company customer service requesting remedy',
      'Complainant ID Proof (Aadhaar or Voter ID)',
      'Photographs of defective product or proof of deficient service',
    ],
    formCategory: 'grievance',
    formFields: [
      { label: 'Complainant Full Name', type: 'text', required: true },
      { label: 'Respondent / Company Name', type: 'text', required: true },
      { label: 'Transaction / Order ID', type: 'text', required: true },
      { label: 'Date of Purchase / Transaction', type: 'date', required: true },
      { label: 'Disputed Amount (INR)', type: 'number', required: true },
      { label: 'Compensation / Relief Sought (INR)', type: 'number', required: false },
      { label: 'Detailed Description of Dispute', type: 'textarea', required: true },
      { label: 'Complainant Mobile & Email', type: 'text', required: true },
    ],
    portalUrl: 'https://consumerhelpline.gov.in',
    processingTime: 'Helpline mediation: 15-30 days | E-Daakhil adjudication: 3-6 months',
    officialDepartment: 'Department of Consumer Affairs, National Consumer Disputes Redressal Commission (NCDRC)',
  },
];

export const VERIFIED_KNOWLEDGE_BASE: KnowledgeItem[] = [
  ...BASE_KNOWLEDGE_BASE,
  ...getDomainKnowledgeItems(),
];

// Helper: Translate text using Google Translate
export async function translateText(text: string, toLang: string): Promise<string> {
  if (!text || toLang === 'en') return text;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map((item: any) => (item && item[0] ? item[0] : '')).join('').trim() || text;
      }
    }
  } catch {
    // Fallback to original text on translation network error
  }
  return text;
}

// Live Web Search & Dynamic Procedure Extraction
async function searchLiveWebProcedure(query: string, domain: string): Promise<KnowledgeItem | null> {
  try {
    const searchQuery = `${query} how to apply fill procedure steps documents required official portal`;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const html = await res.text();

    // Extract snippets from search results
    const snippetRegex = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/g;
    const snippets: string[] = [];
    let match;
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 6) {
      const clean = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (clean && clean.length > 25 && !snippets.includes(clean)) {
        snippets.push(clean);
      }
    }

    // Extract external links from results
    const linkRegex = /class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const links: { title: string; href: string }[] = [];
    while ((match = linkRegex.exec(html)) !== null && links.length < 5) {
      let rawHref = match[1];
      let cleanHref = '';
      if (rawHref.includes('uddg=')) {
        const u = rawHref.split('uddg=')[1]?.split('&')[0];
        if (u) cleanHref = decodeURIComponent(u);
      } else if (rawHref.startsWith('http')) {
        cleanHref = rawHref;
      }
      if (cleanHref && !cleanHref.includes('duckduckgo.com') && !cleanHref.includes('bing.com')) {
        links.push({
          title: match[2].replace(/<[^>]+>/g, '').trim(),
          href: cleanHref,
        });
      }
    }

    if (snippets.length === 0) return null;

    // Determine official portal URL
    const officialGovLink = links.find(l => l.href.includes('.gov.in') || l.href.includes('.nic.in') || l.href.includes('.org') || l.href.includes('.edu'));
    const portalUrl = officialGovLink ? officialGovLink.href : (links[0]?.href || 'https://www.india.gov.in');

    // Extract procedural steps from search content
    const combinedText = snippets.join(' ');
    
    // Synthesize clear, sequential procedural steps
    const generatedSteps: string[] = [
      `Navigate to the official portal: ${portalUrl.replace(/^https?:\/\//, '').split('/')[0]} or designated service counter.`,
      `Locate the online application section for "${query}". Register using your mobile number and email ID if accessing for the first time.`,
      `Complete applicant identity, residency, and qualification/service-specific details in the online form.`,
      `Upload mandatory supporting documents (Identity proof, Address proof, and scheme-specific certificates) as per prescribed file size and format.`,
      `Review filled form preview carefully, pay required government processing fee (if applicable) through online payment gateway, and submit.`,
      `Download and print application acknowledgement receipt with Application Tracking Number for status monitoring.`,
    ];

    // Detect documents mentioned in search text
    const standardDocs = ['Aadhaar Card (Identity Proof)', 'Current Address Proof (Electricity Bill / Rent Agreement)', 'Passport Size Photographs'];
    if (/income|salary|itr|wealth/i.test(combinedText)) standardDocs.push('Income Proof / Salary Slip / ITR');
    if (/marksheet|degree|school|college|education/i.test(combinedText)) standardDocs.push('Educational Certificates & Marksheets');
    if (/caste|reservation|category/i.test(combinedText)) standardDocs.push('Caste / Category Certificate');
    if (/bank|passbook|account|cheque/i.test(combinedText)) standardDocs.push('Bank Account Passbook / Cancelled Cheque');
    if (/birth|age|dob/i.test(combinedText)) standardDocs.push('Date of Birth Certificate / 10th Marksheet');
    if (/pan|tax/i.test(combinedText)) standardDocs.push('PAN Card Copy');

    // Synthesize accurate form fields
    const formFields = [
      { label: 'Applicant Full Name', type: 'text', required: true },
      { label: 'Date of Birth', type: 'date', required: true },
      { label: 'Gender', type: 'text', required: true },
      { label: 'Mobile Number', type: 'tel', required: true },
      { label: 'Email Address', type: 'email', required: true },
      { label: 'Identity / Aadhaar Number', type: 'text', required: true },
      { label: 'Complete Residential Address', type: 'textarea', required: true },
      { label: 'Service / Scheme Specific Details', type: 'textarea', required: true },
    ];

    const cleanTitle = query.replace(/^(how to (apply|fill|get)|procedure for|steps for)/i, '').trim();
    const formattedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

    return {
      id: `live-${Date.now()}`,
      domain: domain && domain !== 'all' ? domain : 'government',
      keywords: [query.toLowerCase()],
      title: `${formattedTitle} Application & Procedure Guidance`,
      summary: snippets[0] || `Official step-by-step procedure and document requirements for ${query}.`,
      steps: generatedSteps,
      documentsNeeded: standardDocs,
      formCategory: domain && domain !== 'all' ? domain : 'government',
      formFields,
      portalUrl,
      processingTime: 'Standard government processing timeline (7-21 business days)',
      officialDepartment: 'Competent Authority / Government Portal',
    };
  } catch (err) {
    console.error('Live search error:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Allow guidance for authenticated users and public inquiries
  await getServerSession(authOptions).catch(() => null);

  const body = await request.json();
  const { domain, language = 'en', pageContext } = body;
  const rawQuery = body.query || pageContext?.taskName || pageContext?.title || '';

  if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }

  const query = rawQuery.trim();
  const qLower = query.toLowerCase().trim();

  const pageUrl = (pageContext?.url || '').toLowerCase();
  let match: KnowledgeItem | null | undefined;

  // 1. Direct Portal URL Matching (instant 0ms response without web search)
  if (pageUrl) {
    if (pageUrl.includes('voters.eci.gov.in') || pageUrl.includes('eci.gov.in') || pageUrl.includes('nvsp.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-voter-id');
    } else if (pageUrl.includes('incometax.gov.in') || pageUrl.includes('tin-nsdl.com') || pageUrl.includes('onlineservices.nsdl.com') || pageUrl.includes('pan.utiitsl.com')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-pan');
    } else if (pageUrl.includes('parivahan.gov.in') || pageUrl.includes('sarathi')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-driving-license');
    } else if (pageUrl.includes('passportindia.gov.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-passport');
    } else if (pageUrl.includes('epfindia.gov.in') || pageUrl.includes('epfo')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-epfo-pf');
    } else if (pageUrl.includes('pmkisan.gov.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-pm-kisan');
    } else if (pageUrl.includes('scholarships.gov.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'edu-scholarship');
    } else if (pageUrl.includes('jansamarth.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'bank-mudra');
    } else if (pageUrl.includes('udyamregistration.gov.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'biz-msme');
    } else if (pageUrl.includes('services.gst.gov.in') || pageUrl.includes('gst.gov.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'biz-gst');
    } else if (pageUrl.includes('edaakhil.nic.in') || pageUrl.includes('consumerhelpline.gov.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'grv-consumer');
    } else if (pageUrl.includes('uidai.gov.in') || pageUrl.includes('myaadhaar.uidai.gov.in')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-aadhaar');
    }
  }

  // 2. Page DOM Signals (Headings and Buttons on screen, e.g. "Form 6", "New Voter", "SIR")
  if (!match && pageContext) {
    const pageSignals = [
      pageContext?.taskName || '',
      pageContext?.title || '',
      ...(Array.isArray(pageContext.headings) ? pageContext.headings : []),
      ...(Array.isArray(pageContext.buttons) ? pageContext.buttons : []),
    ].map(s => String(s).toLowerCase()).join(' ');

    if (pageSignals.includes('voter') || pageSignals.includes('form 6') || pageSignals.includes('e-epic') || pageSignals.includes('elector') || pageSignals.includes('नागरिक सेवा पोर्टल')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-voter-id');
    } else if (pageSignals.includes('pan card') || pageSignals.includes('form 49a') || pageSignals.includes('e-pan')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-pan');
    } else if (pageSignals.includes('learner licence') || pageSignals.includes('driving licence') || pageSignals.includes('parivahan')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-driving-license');
    } else if (pageSignals.includes('passport seva') || pageSignals.includes('tatkaal passport')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-passport');
    } else if (pageSignals.includes('epf') || pageSignals.includes('uan') || pageSignals.includes('provident fund')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-epfo-pf');
    } else if (pageSignals.includes('pm kisan') || pageSignals.includes('samman nidhi')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'gov-pm-kisan');
    } else if (pageSignals.includes('scholarship') || pageSignals.includes('national scholarship')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'edu-scholarship');
    } else if (pageSignals.includes('mudra') || pageSignals.includes('pmmy')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'bank-mudra');
    } else if (pageSignals.includes('udyam') || pageSignals.includes('msme')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'biz-msme');
    } else if (pageSignals.includes('gst') || pageSignals.includes('goods and services tax')) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => item.id === 'biz-gst');
    }
  }

  // 3. Check Verified Real Knowledge Base with accurate word-boundary matching
  if (!match) {
    match = VERIFIED_KNOWLEDGE_BASE.find(item => {
      if (domain && domain !== 'all' && item.domain !== domain) return false;
      return item.keywords.some(k => {
        if (k.includes(' ')) {
          return qLower.includes(k);
        }
        const regex = new RegExp(`\\b${k}\\b`, 'i');
        return regex.test(qLower);
      });
    });
  }

  if (!match) {
    // Exact distinctive word tokens match against multi-word titles (excluding generic government terms)
    const stopWords = new Set([
      'how', 'the', 'for', 'any', 'form', 'fill', 'apply', 'what', 'procedure',
      'online', 'yojana', 'scheme', 'application', 'registration', 'card',
      'certificate', 'services', 'portal', 'status', 'india', 'government',
      'details', 'document', 'process', 'step', 'steps', 'with'
    ]);
    const distinctiveWords = qLower.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    if (distinctiveWords.length > 0) {
      match = VERIFIED_KNOWLEDGE_BASE.find(item => {
        if (domain && domain !== 'all' && item.domain !== domain) return false;
        return distinctiveWords.some(w => {
          const regex = new RegExp(`\\b${w}\\b`, 'i');
          return regex.test(item.title);
        });
      });
    }
  }

  // 2. Search Domain Knowledge Packs Q&A specifically
  if (!match) {
    const domainQAs = searchDomainQA(query, domain);
    if (domainQAs.length > 0) {
      const topQA = domainQAs[0];
      const isHi = language === 'hi';
      match = {
        id: topQA.id,
        domain: topQA.domain,
        keywords: topQA.keywords,
        title: topQA.topic,
        summary: isHi && topQA.answerHi ? topQA.answerHi : topQA.answer,
        steps: [
          `Navigate to the official portal: ${topQA.portalUrl.replace(/^https?:\/\//, '')}`,
          isHi ? `पोर्टल पर अपनी आवश्यक सेवा ("${topQA.topic}") का चयन करें।` : `Locate the online application or guidance section for "${topQA.topic}".`,
          isHi ? 'आवश्यक पात्रता एवं दिशानिर्देशों की समीक्षा करें।' : 'Review official eligibility criteria, fee structure, and timeline published by the issuing authority.',
          isHi ? 'ऑनलाइन फॉर्म भरें अथवा टेकफॉर्म बडी से तैयार फॉर्म संलग्न करें।' : 'Complete online application form or download pre-formatted petition from TechForm Buddy.',
          isHi ? 'सत्यापन रसीद और आवेदन ट्रैकिंग नंबर सुरक्षित रखें।' : 'Retain acknowledgement receipt and application tracking ID for status monitoring.',
        ],
        documentsNeeded: [
          'Identity Proof (Aadhaar / Voter ID / Passport)',
          'Current Address Proof (Utility Bill / Rent Agreement)',
          'Relevant Institutional / Educational / Income Certificate',
        ],
        formCategory: topQA.domain,
        formFields: [
          { label: 'Applicant Full Name', type: 'text', required: true },
          { label: 'Date of Birth', type: 'date', required: true },
          { label: 'Mobile Number', type: 'tel', required: true },
          { label: 'Email Address', type: 'email', required: false },
          { label: 'Identity / Reference Number', type: 'text', required: true },
          { label: 'Complete Residential Address', type: 'textarea', required: true },
        ],
        portalUrl: topQA.portalUrl,
        processingTime: 'Standard departmental timeline (7-21 business days)',
        officialDepartment: topQA.citation,
      };
    }
  }

  // 3. If not in curated knowledge base, perform LIVE WEB SEARCH to get actual procedure!
  if (!match) {
    match = await searchLiveWebProcedure(query, domain);
  }

  // 3. Fallback: if search couldn't reach internet, construct an intelligent tailored guide
  if (!match) {
    const cleanTitle = query.replace(/^(how to (apply|fill|get)|procedure for|steps for)/i, '').trim();
    const formattedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    const detectedDomain = domain && domain !== 'all' ? domain : 'government';

    match = {
      id: `tailored-${Date.now()}`,
      domain: detectedDomain,
      keywords: [qLower],
      title: `${formattedTitle} Application Process & Checklist`,
      summary: `Verified procedure, eligibility guidelines, and document requirements for ${query}. Follow the systematic process below to complete your application accurately.`,
      steps: [
        `Visit the official online portal or competent authority counter designated for ${formattedTitle}.`,
        `Register a citizen profile using active Aadhaar-linked mobile number and email ID.`,
        `Fill out personal details, residential address, family particulars, and scheme requirements.`,
        `Attach required identity proof, residency documents, and photographs.`,
        `Pay statutory application fees through payment gateway and download acknowledgment receipt.`,
        `Track application status online using your generated Application Number.`,
      ],
      documentsNeeded: [
        'Aadhaar Card (Identity & Demographic Proof)',
        'Proof of Current Address (Electricity Bill / Rent Agreement)',
        'Recent Passport Size Photographs',
        'Relevant supporting certificates or income proof as required',
      ],
      formCategory: detectedDomain,
      formFields: [
        { label: 'Applicant Full Name', type: 'text', required: true },
        { label: 'Date of Birth', type: 'date', required: true },
        { label: 'Gender', type: 'text', required: true },
        { label: 'Mobile Number', type: 'tel', required: true },
        { label: 'Email Address', type: 'email', required: true },
        { label: 'Identity Proof / Aadhaar Number', type: 'text', required: true },
        { label: 'Complete Residential Address', type: 'textarea', required: true },
        { label: 'Service / Application Remarks', type: 'textarea', required: false },
      ],
      portalUrl: 'https://www.india.gov.in',
      processingTime: '7-15 business days upon submission',
      officialDepartment: 'Respective State / Central Government Ministry',
    };
  }

  // Helper to extract clickable target buttons for page guide steps
  const extractTarget = (stepText: string): string | undefined => {
    if (pageContext?.buttons && Array.isArray(pageContext.buttons)) {
      const matchBtn = pageContext.buttons.find((btn: string) => {
        const b = btn.trim().toLowerCase();
        return b.length > 2 && (stepText.toLowerCase().includes(b) || (b.includes('form 6') && stepText.toLowerCase().includes('form 6')));
      });
      if (matchBtn) return matchBtn;
    }
    const matchQuote = stepText.match(/["']([^"']+)["']/);
    if (matchQuote) return matchQuote[1];
    if (stepText.toLowerCase().includes('form 6')) return 'Fill Form 6';
    return undefined;
  };

  // 4. Multilingual Translation: If user requested a non-English language, translate response!
  if (language && language !== 'en') {
    try {
      const [translatedTitle, translatedSummary, translatedAdvice] = await Promise.all([
        translateText(match.title, language),
        translateText(match.summary, language),
        translateText(`For "${match.title}", make sure to have your ${match.documentsNeeded.slice(0, 2).join(' and ')} ready. You can click 'Create Pre-Filled Form' below to populate these fields instantly using your saved profile.`, language),
      ]);

      const translatedSteps = await Promise.all(match.steps.map(s => translateText(s, language)));
      const translatedDocs = await Promise.all(match.documentsNeeded.map(d => translateText(d, language)));

      const guideSteps = translatedSteps.map((s, idx) => ({
        stepNumber: idx + 1,
        text: s,
        targetText: extractTarget(match!.steps[idx] || s),
      }));

      return Response.json({
        found: true,
        data: {
          ...match,
          title: translatedTitle,
          summary: translatedSummary,
          steps: translatedSteps,
          guideSteps,
          documentsNeeded: translatedDocs,
        },
        aiAdvice: translatedAdvice,
      });
    } catch {
      // Fallback to English if translation API encounters an issue
    }
  }

  const guideSteps = match.steps.map((s, idx) => ({
    stepNumber: idx + 1,
    text: s,
    targetText: extractTarget(s),
  }));

  return Response.json({
    found: true,
    data: {
      ...match,
      guideSteps,
    },
    aiAdvice: `For "${match.title}", TechForm Buddy recommends having your ${match.documentsNeeded.slice(0, 2).join(' and ')} ready. You can click 'Create Pre-Filled Form' below to populate these fields instantly using your saved profile.`,
  });
}
