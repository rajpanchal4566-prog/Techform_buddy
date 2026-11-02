import { test, expect } from '@playwright/test';
import {
  SCHEME_RULES_REGISTRY,
  calculateAge,
  normalizeIncome,
  evaluateSchemeEligibility,
  getRecommendationsForProfile,
  UserProfileInput,
} from '../../../src/lib/recommendations';

test.describe('B4: Deterministic Scheme Eligibility Rule Evaluator (PS-15)', () => {
  // Test 1: Age calculation & parsing from multiple Indian formats
  test('calculateAge correctly parses ISO and Indian date formats', () => {
    // Current year is 2026
    const ageIso = calculateAge('2000-05-15');
    expect(ageIso).toBeGreaterThanOrEqual(25);
    expect(ageIso).toBeLessThanOrEqual(26);

    const ageSlash = calculateAge('15/05/2000');
    expect(ageSlash).toBeGreaterThanOrEqual(25);

    const ageDash = calculateAge('15-05-2000');
    expect(ageDash).toBeGreaterThanOrEqual(25);

    expect(calculateAge(undefined)).toBeUndefined();
    expect(calculateAge('')).toBeUndefined();
  });

  // Test 2: Income normalizer
  test('normalizeIncome correctly cleans currency symbols and commas', () => {
    expect(normalizeIncome(150000)).toBe(150000);
    expect(normalizeIncome('₹2,50,000')).toBe(250000);
    expect(normalizeIncome('Rs. 1,80,000.00')).toBe(180000);
    expect(normalizeIncome('300000')).toBe(300000);
    expect(normalizeIncome(undefined)).toBeUndefined();
  });

  // Test 3: Boundary Age Rules for Atal Pension Yojana (18 to 40)
  test('Atal Pension Yojana: evaluates boundary ages 18 and 40 accurately', () => {
    const apyScheme = SCHEME_RULES_REGISTRY.find(s => s.id === 'scheme-atal-pension')!;
    expect(apyScheme).toBeDefined();

    // Age 18: Lower boundary (Must be ELIGIBLE)
    const res18 = evaluateSchemeEligibility({ age: 18 }, apyScheme);
    expect(res18.status).toBe('ELIGIBLE');
    expect(res18.whyYouQualify.length).toBeGreaterThan(0);

    // Age 40: Upper boundary (Must be ELIGIBLE)
    const res40 = evaluateSchemeEligibility({ age: 40 }, apyScheme);
    expect(res40.status).toBe('ELIGIBLE');

    // Age 25: Normal (Must be ELIGIBLE)
    const res25 = evaluateSchemeEligibility({ age: 25 }, apyScheme);
    expect(res25.status).toBe('ELIGIBLE');

    // Age 17: Below minimum (Must not be ELIGIBLE)
    const res17 = evaluateSchemeEligibility({ age: 17 }, apyScheme);
    expect(res17.status).not.toBe('ELIGIBLE');

    // Age 41: Above maximum (Must not be ELIGIBLE)
    const res41 = evaluateSchemeEligibility({ age: 41 }, apyScheme);
    expect(res41.status).not.toBe('ELIGIBLE');
  });

  // Test 4: Gender & Age Constraints for Sukanya Samriddhi Yojana (Female, Age <= 10)
  test('Sukanya Samriddhi Yojana: strictly enforces Female gender and Age <= 10', () => {
    const ssyScheme = SCHEME_RULES_REGISTRY.find(s => s.id === 'scheme-sukanya-samriddhi')!;
    expect(ssyScheme).toBeDefined();

    // 8-year-old girl: ELIGIBLE
    const resGirl = evaluateSchemeEligibility({ age: 8, gender: 'Female' }, ssyScheme);
    expect(resGirl.status).toBe('ELIGIBLE');
    expect(resGirl.whyYouQualify.some(r => r.includes('Female'))).toBe(true);

    // 8-year-old boy: NOT_ELIGIBLE (Hard rule fail)
    const resBoy = evaluateSchemeEligibility({ age: 8, gender: 'Male' }, ssyScheme);
    expect(resBoy.status).toBe('NOT_ELIGIBLE');

    // 14-year-old girl: NOT_ELIGIBLE (Age > 10)
    const resTeen = evaluateSchemeEligibility({ age: 14, gender: 'Female' }, ssyScheme);
    expect(resTeen.status).toBe('NOT_ELIGIBLE');
  });

  // Test 5: Income Limits and Category Rules for NSP Post-Matric Scholarship
  test('NSP Post-Matric: evaluates income ceiling and category rules with clear reasons', () => {
    const nspScheme = SCHEME_RULES_REGISTRY.find(s => s.id === 'scheme-nsp-post-matric')!;

    // Eligible profile: Student, Age 20, Income ₹1,80,000, Category OBC
    const eligibleProfile: UserProfileInput = {
      age: 20,
      annual_income: 180000,
      category: 'OBC',
      is_student: true,
    };
    const resEligible = evaluateSchemeEligibility(eligibleProfile, nspScheme);
    expect(resEligible.status).toBe('ELIGIBLE');
    expect(resEligible.whyYouQualify.length).toBeGreaterThanOrEqual(3);

    // Exact Boundary: ₹2,50,000 (Must be ELIGIBLE)
    const boundaryProfile: UserProfileInput = {
      age: 20,
      annual_income: 250000,
      category: 'SC',
      is_student: true,
    };
    const resBoundary = evaluateSchemeEligibility(boundaryProfile, nspScheme);
    expect(resBoundary.status).toBe('ELIGIBLE');

    // Above ceiling: ₹5,00,000 (NOT_ELIGIBLE)
    const richProfile: UserProfileInput = {
      age: 20,
      annual_income: 500000,
      category: 'OBC',
      is_student: true,
    };
    const resRich = evaluateSchemeEligibility(richProfile, nspScheme);
    expect(resRich.status).toBe('NOT_ELIGIBLE');

    // General Category (Without EWS): NOT_ELIGIBLE
    const genProfile: UserProfileInput = {
      age: 20,
      annual_income: 150000,
      category: 'General',
      is_student: true,
    };
    const resGen = evaluateSchemeEligibility(genProfile, nspScheme);
    expect(resGen.status).toBe('NOT_ELIGIBLE');
  });

  // Test 6: Missing Data produces ALMOST_ELIGIBLE with actionable next steps
  test('Missing income or category produces ALMOST_ELIGIBLE and explains what is missing', () => {
    const nspScheme = SCHEME_RULES_REGISTRY.find(s => s.id === 'scheme-nsp-post-matric')!;

    // Profile with only age and student status (Missing income and category)
    const partialProfile: UserProfileInput = {
      age: 21,
      is_student: true,
    };
    const res = evaluateSchemeEligibility(partialProfile, nspScheme);

    expect(res.status).toBe('ALMOST_ELIGIBLE');
    expect(res.whatIsMissing.length).toBeGreaterThan(0);
    expect(res.whatIsMissing.some(m => m.includes('income') || m.includes('Income'))).toBe(true);
  });

  // Test 7: Multi-scheme prioritizer returns both eligible and almost-eligible buckets
  test('getRecommendationsForProfile groups 8+ schemes into prioritized lists', () => {
    const sampleStudent: UserProfileInput = {
      date_of_birth: '2004-03-12', // ~22 yrs
      gender: 'Female',
      annual_income: '₹2,00,000',
      category: 'OBC',
      occupation: 'Student',
      is_student: true,
    };

    const recs = getRecommendationsForProfile(sampleStudent);

    expect(recs.allEvaluations.length).toBeGreaterThanOrEqual(8);
    expect(recs.eligible.length).toBeGreaterThan(0);

    // AICTE Pragati & NSP should be eligible for this female student
    const hasNsp = recs.eligible.some(r => r.scheme.id.includes('nsp'));
    const hasPragati = recs.eligible.some(r => r.scheme.id.includes('pragati'));
    expect(hasNsp || hasPragati).toBe(true);
  });

  // Test 8: Browser UI renders Recommendations section on Dashboard
  test('Dashboard page renders Personalized Scheme Recommendations with Why You Qualify', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'u-b4-test', name: 'Aakash Verma', email: 'aakash@example.com' } }),
      });
    });

    await page.route('**/api/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ forms: 3, documents: 4, watches: 2 }),
      });
    });

    await page.route('**/api/forms?limit=5', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/notifications?limit=5', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/recommendations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          eligible: [
            {
              scheme: {
                id: 'scheme-nsp-post-matric',
                name: 'National Post-Matric Scholarship (NSP)',
                domain: 'education',
                benefitDescription: 'Financial assistance of ₹15,000 to ₹75,000 per year covering full tuition fees.',
                portalUrl: 'https://scholarships.gov.in',
                templateId: 'scholarship_application',
              },
              status: 'ELIGIBLE',
              whyYouQualify: [
                'Your age (20 yrs) satisfies the required range of 16–32 years.',
                'Your annual income (₹1,80,000) is below the ceiling of ₹2,50,000.',
                'You are enrolled as an active student.',
              ],
              whatIsMissing: [],
            },
          ],
          almostEligible: [
            {
              scheme: {
                id: 'scheme-pm-mudra',
                name: 'Pradhan Mantri MUDRA Micro-Loan Yojana',
                domain: 'banking',
                benefitDescription: 'Collateral-free business credit up to ₹10,00,000.',
                portalUrl: 'https://www.mudra.org.in',
                templateId: 'loan_application_request',
              },
              status: 'ALMOST_ELIGIBLE',
              whyYouQualify: [
                'Your age (20 yrs) satisfies the required range of 18–65 years.',
              ],
              whatIsMissing: [
                'Self-employed / business trade occupation confirmation needed.',
              ],
            },
          ],
        }),
      });
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify recommendations section appears
    const section = page.locator('#scheme-recommendations-section');
    await expect(section).toBeVisible();

    // Verify 100% Eligible card
    const eligibleCard = page.locator('.recommendation-card-eligible');
    await expect(eligibleCard).toBeVisible();
    await expect(eligibleCard).toContainText('National Post-Matric Scholarship');
    await expect(eligibleCard).toContainText('Why You Qualify');
    await expect(eligibleCard).toContainText('Apply with Buddy');

    // Verify Almost Eligible card
    const almostCard = page.locator('.recommendation-card-almost');
    await expect(almostCard).toBeVisible();
    await expect(almostCard).toContainText('Pradhan Mantri MUDRA');
    await expect(almostCard).toContainText('Almost Eligible');
    await expect(almostCard).toContainText('What is Missing');
  });
});

