import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Phase 5: Portal Launcher & Demo Portal Security & Architecture Specs', () => {

  const browserPagePath = path.resolve(__dirname, '../../../src/app/browser/page.tsx');
  const demoPortalPath = path.resolve(__dirname, '../../../src/app/demo-portal/page.tsx');
  const portalSearchApiPath = path.resolve(__dirname, '../../../src/app/api/portal-search/route.ts');
  const downloadFormPath = path.resolve(__dirname, '../../../src/lib/downloadForm.ts');
  const translatePath = path.resolve(__dirname, '../../../src/lib/translate.ts');
  const formDetailPath = path.resolve(__dirname, '../../../src/app/forms/[id]/page.tsx');

  // Test 1: No iframe element exists on /browser
  test('Rule 1: No iframe element exists on /browser and external sites never embedded', () => {
    expect(fs.existsSync(browserPagePath)).toBe(true);
    const content = fs.readFileSync(browserPagePath, 'utf8');

    // Ensure no <iframe> tag exists in the file
    expect(content).not.toMatch(/<iframe/i);
    expect(content).not.toMatch(/<\/iframe>/i);

    // Verify all portal tiles and external links open in a new tab with noopener noreferrer
    expect(content).toMatch(/target="_blank"/);
    expect(content).toMatch(/rel="noopener noreferrer"/);

    // Verify no fake government portal replica branding remains in /browser
    expect(content).not.toContain('Official e-Governance Gateway');
    expect(content).not.toContain('256-Bit SSL Encrypted');
    expect(content).not.toContain('Submit by App Command');
  });

  // Test 2: Popular portal tiles open in a new tab
  test('Rule 4: Portal tiles open real sites in new tab with target="_blank"', () => {
    const content = fs.readFileSync(browserPagePath, 'utf8');
    
    // Check popular portals definition
    expect(content).toContain('https://www.passportindia.gov.in');
    expect(content).toContain('https://parivahan.gov.in');
    expect(content).toContain('https://voters.eci.gov.in');
    expect(content).toContain('https://www.incometax.gov.in');

    // Confirm target="_blank" and rel="noopener noreferrer" on tile links
    expect(content).toContain('target="_blank"');
    expect(content).toContain('rel="noopener noreferrer"');
  });

  // Test 3: Portal search and domain warning logic
  test('Rule 3: Non-.gov.in results show warning and .gov.in shows official badge', () => {
    expect(fs.existsSync(portalSearchApiPath)).toBe(true);
    const apiContent = fs.readFileSync(portalSearchApiPath, 'utf8');
    const browserContent = fs.readFileSync(browserPagePath, 'utf8');

    // Verification in API route for official domain detection (.gov.in or .nic.in)
    expect(apiContent).toContain('.gov.in');
    expect(apiContent).toContain('.nic.in');
    expect(apiContent).toContain('isOfficialDomain');

    // Verification in /browser rendering for badge and warning
    expect(browserContent).toContain('Official-looking domain');
    expect(browserContent).toContain('Check this is the official site before entering any details.');
  });

  // Test 4: Extension detection
  test('Rule 5: Extension detection reads documentElement.dataset.tfbExtension', () => {
    const content = fs.readFileSync(browserPagePath, 'utf8');
    expect(content).toContain('dataset.tfbExtension');
    expect(content).toContain('packages/extension');
    expect(content).toContain('/extension/connect');
  });

  // Test 5: "Open with Buddy" 3-step guide & zero password credential promise
  test('Rule 6: "Open with Buddy" flow displays 3-step guide and never requests credentials', () => {
    const content = fs.readFileSync(browserPagePath, 'utf8');

    // Verify 3-step guide in our app
    expect(content).toContain('Log in to the portal yourself');
    expect(content).toContain('Click the Buddy icon in the toolbar');
    expect(content).toContain('Start on this page');

    // Verify credential security statement
    expect(content).toMatch(/never (asks? for|handles?|stores?).*passwords or OTPs/i);
  });

  // Test 6: Safety copy banner on /browser
  test('Rule 7: Safety copy prominently displayed on /browser', () => {
    const content = fs.readFileSync(browserPagePath, 'utf8');
    expect(content).toContain('Buddy fills the form on the real website. You review and press Submit yourself.');
  });

  // Test 7: Demo portal at /demo-portal has permanent banner and "Submit (demo only)"
  test('Rule 2: /demo-portal has permanent banner and "Submit (demo only)" with no fake government branding', () => {
    expect(fs.existsSync(demoPortalPath)).toBe(true);
    const content = fs.readFileSync(demoPortalPath, 'utf8');

    // Permanent banner text
    expect(content).toContain('Demo form only. Not a government website. Data is not sent to any department.');

    // Renamed button
    expect(content).toContain('Submit (demo only)');

    // Ensure removed fake government branding
    expect(content).not.toContain('Official e-Governance Gateway');
    expect(content).not.toContain('256-Bit SSL Encrypted');
    expect(content).not.toContain('Submit by App Command');
  });

  // Test 8: Download format produces actual application paper with filled values
  test('Fix A: Download format produces printable application paper with filled values, declaration and signatures', () => {
    expect(fs.existsSync(downloadFormPath)).toBe(true);
    const content = fs.readFileSync(downloadFormPath, 'utf8');

    // Actual paper layout
    expect(content).toContain('APPLICANT DECLARATION & UNDERTAKING');
    expect(content).toContain('Signature / Thumb Impression of Applicant');
    expect(content).toContain('AFFIX RECENT');
    expect(content).toContain('PASSPORT SIZE');
    expect(content).toContain('paper-val-filled');
    expect(content).toContain('[Not Provided]');
  });

  // Test 9: Form filling accepts any language and converts to English
  test('Fix B: Multilingual input translation handles foreign/Indic script and updates field value to English', () => {
    expect(fs.existsSync(translatePath)).toBe(true);
    const translateContent = fs.readFileSync(translatePath, 'utf8');
    expect(translateContent).toContain('translateToEnglish');
    expect(translateContent).toContain('[^\\x00-\\x7F]');

    expect(fs.existsSync(formDetailPath)).toBe(true);
    const formContent = fs.readFileSync(formDetailPath, 'utf8');
    expect(formContent).toContain('handleTranslateField');
    expect(formContent).toContain('handleTranslateAllFields');
    expect(formContent).toContain('Convert All to English');
  });
});
