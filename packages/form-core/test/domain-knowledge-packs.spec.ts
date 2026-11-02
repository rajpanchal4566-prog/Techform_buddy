import { test, expect } from '@playwright/test';
import {
  DOMAIN_KNOWLEDGE_PACKS,
  searchDomainQA,
  getAllDomainPacks,
  getDomainPack,
  DomainCategory,
} from '../../../src/lib/domainKnowledge';
import { FORM_TEMPLATES, matchTemplateFromPrompt, generateFallbackDocument } from '../../../src/lib/templates';

test.describe('B3: Domain Knowledge Packs & Multi-Domain Coverage (PS-15)', () => {
  const REQUIRED_DOMAINS: DomainCategory[] = [
    'education',
    'healthcare',
    'banking',
    'business',
    'grievances',
    'institutions',
  ];

  test('All 6 specified domains are registered with comprehensive metadata', () => {
    const packs = getAllDomainPacks();
    expect(packs.length).toBeGreaterThanOrEqual(6);

    for (const domain of REQUIRED_DOMAINS) {
      const pack = getDomainPack(domain);
      expect(pack).toBeDefined();
      expect(pack?.name).toBeTruthy();
      expect(pack?.nameHi).toBeTruthy();
      expect(pack?.description).toBeTruthy();
      expect(pack?.officialPortals.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('Every domain has at least 8 curated Q&As with valid portal citations', () => {
    for (const domain of REQUIRED_DOMAINS) {
      const pack = getDomainPack(domain)!;
      expect(
        pack.qaList.length,
        `Domain "${domain}" must have at least 8 curated Q&As`
      ).toBeGreaterThanOrEqual(8);

      for (const qa of pack.qaList) {
        // Question in EN and HI
        expect(qa.question.trim().length).toBeGreaterThan(10);
        expect(qa.questionHi.trim().length).toBeGreaterThan(10);

        // Answer in EN and HI
        expect(qa.answer.trim().length).toBeGreaterThan(25);
        expect(qa.answerHi.trim().length).toBeGreaterThan(25);

        // Official portal URL
        expect(qa.portalUrl).toMatch(/^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

        // Official source citation
        expect(qa.citation.trim().length).toBeGreaterThan(10);
        expect(
          qa.citation.includes('.gov.in') ||
          qa.citation.includes('.nic.in') ||
          qa.citation.includes('.ac.in') ||
          qa.citation.includes('.org') ||
          qa.citation.includes('.edu') ||
          qa.citation.includes('.in') ||
          qa.citation.includes('.com')
        ).toBe(true);

        // Keywords
        expect(qa.keywords.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('Every domain has at least 2 structured document/form templates registered in FORM_TEMPLATES', () => {
    for (const domain of REQUIRED_DOMAINS) {
      const pack = getDomainPack(domain)!;
      expect(
        pack.templates.length,
        `Domain "${domain}" must list at least 2 templates`
      ).toBeGreaterThanOrEqual(2);

      // Verify each template exists in FORM_TEMPLATES
      for (const tmplId of pack.templates) {
        const found = FORM_TEMPLATES.find((t) => t.id === tmplId);
        expect(
          found,
          `Template "${tmplId}" in domain "${domain}" must exist in FORM_TEMPLATES`
        ).toBeDefined();
        expect(found?.fields.length).toBeGreaterThan(3);

        // Test generation in English and Hindi
        const docEn = generateFallbackDocument(found!, {}, 'en');
        const docHi = generateFallbackDocument(found!, {}, 'hi');
        expect(docEn).toBeDefined();
        expect(docHi).toBeDefined();
      }
    }
  });

  test('Assistant query matching correctly retrieves answers with source citations for all 6 domains', async () => {
    const domainTestCases: Array<{
      query: string;
      domain: DomainCategory;
      expectedKeyword: string;
      expectedPortal: string;
    }> = [
      {
        query: 'how to apply for scholarship on national scholarship portal',
        domain: 'education',
        expectedKeyword: 'scholarships.gov.in',
        expectedPortal: 'scholarships.gov.in',
      },
      {
        query: 'ayushman card kaise banwaye hospital free treatment',
        domain: 'healthcare',
        expectedKeyword: 'pmjay.gov.in',
        expectedPortal: 'pmjay.gov.in',
      },
      {
        query: 'pm mudra loan apply collateral free business',
        domain: 'banking',
        expectedKeyword: 'mudra.org.in',
        expectedPortal: 'mudra.org.in',
      },
      {
        query: 'how to register small business on udyam msme portal',
        domain: 'business',
        expectedKeyword: 'udyamregistration.gov.in',
        expectedPortal: 'udyamregistration.gov.in',
      },
      {
        query: 'consumer court helpline e-commerce complaint 1915',
        domain: 'grievances',
        expectedKeyword: 'consumerhelpline.gov.in',
        expectedPortal: 'consumerhelpline.gov.in',
      },
      {
        query: 'college hostel admission form allotment chief warden',
        domain: 'institutions',
        expectedKeyword: 'samarth.edu.in',
        expectedPortal: 'samarth.edu.in',
      },
    ];

    for (const tc of domainTestCases) {
      const matched = searchDomainQA(tc.query, tc.domain);
      expect(
        matched.length,
        `Query "${tc.query}" should match at least 1 QA in domain "${tc.domain}"`
      ).toBeGreaterThanOrEqual(1);

      const top = matched[0];
      expect(top.portalUrl).toContain(tc.expectedPortal);
      expect(top.citation).toBeTruthy();
    }
  });

  test('Template prompt matching accurately selects templates across non-government domains', () => {
    // Education: bonafide
    const bonaTmpl = matchTemplateFromPrompt('college se bonafide certificate chahiye');
    expect(bonaTmpl.id).toBe('bonafide_certificate_request');

    // Healthcare: disability certificate
    const disabTmpl = matchTemplateFromPrompt('disability certificate UDID card form');
    expect(disabTmpl.id).toBe('disability_certificate_application');

    // Banking: Mudra / loan
    const loanTmpl = matchTemplateFromPrompt('mudra loan application form');
    expect(loanTmpl.id).toBe('loan_application_request');

    // Business: trade license
    const tradeTmpl = matchTemplateFromPrompt('municipal trade license application');
    expect(tradeTmpl.id).toBe('trade_license_application');

    // Institutions: hostel admission
    const hostelTmpl = matchTemplateFromPrompt('hostel admission application for college');
    expect(hostelTmpl.id).toBe('hostel_admission_application');
  });

  test('POST /api/assistant returns verified domain pack answers and citations', async ({ request }) => {
    const res = await request.post('/api/assistant', {
      data: {
        query: 'How to apply for Ayushman Bharat card online?',
        domain: 'healthcare',
        language: 'en',
      },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.found).toBe(true);
    expect(data.data.portalUrl).toMatch(/(pmjay\.gov\.in|nha\.gov\.in)/);
    expect(data.data.summary).toMatch(/(5 Lakh|₹5,00,000)/);
    expect(data.data.officialDepartment).toContain('National Health Authority');
  });
});
