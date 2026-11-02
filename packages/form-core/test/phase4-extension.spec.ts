import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import {
  issueExtensionToken,
  revokeExtensionToken,
  validateExtensionToken,
  listExtensionTokens,
} from '../../../src/lib/extensionAuth';
import { getDb } from '../../../src/lib/db';
import { formMappingCache } from '../../../src/lib/llm/cache';

const BUNDLE_PATH = path.resolve(__dirname, '../dist/form-core.iife.js');
const EXTENSION_DIST = path.resolve(__dirname, '../../extension/dist');

function getPageUrl(fileName: string): string {
  const filePath = path.resolve(__dirname, '../test-pages', fileName);
  return 'file:///' + filePath.replace(/\\/g, '/');
}

test.describe('Phase 4: Chrome Extension Backend Auth & Security Guarantees', () => {

  const testUserId = 'user_test_ext_' + Date.now();

  test.beforeAll(() => {
    const db = getDb();
    // Ensure test user exists in DB
    db.prepare(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name)
       VALUES (?, ?, 'hash', 'Test Extension User')`
    ).run(testUserId, `ext_${Date.now()}@example.com`);
  });

  // 1. Scoped token creation & hashing test
  test('Token Issuance: generates scoped token, stores only SHA-256 hash, raw token never stored in plaintext', () => {
    const result = issueExtensionToken(testUserId, 'Desktop Test Chrome', ['form:map', 'profile:read'], 30);
    expect(result.rawToken).toMatch(/^tfb_ext_/);
    expect(result.scopes).toEqual(['form:map', 'profile:read']);

    const db = getDb();
    const stored = db.prepare('SELECT * FROM extension_tokens WHERE id = ?').get(result.tokenId) as any;
    expect(stored).toBeDefined();
    // Plaintext raw token MUST NOT be in the database
    expect(stored.token_hash).not.toBe(result.rawToken);
    expect(stored.token_hash.length).toBe(64); // SHA-256 hex string length
    expect(stored.revoked_at).toBeNull();
  });

  // 2. Token validation with correct scope
  test('Token Validation: valid token authenticates successfully for authorized scopes', () => {
    const { rawToken } = issueExtensionToken(testUserId, 'Valid Token Ext', ['form:map', 'profile:read']);

    const mapValidation = validateExtensionToken(rawToken, 'form:map');
    expect(mapValidation.valid).toBe(true);
    expect(mapValidation.userId).toBe(testUserId);

    const profileValidation = validateExtensionToken(rawToken, 'profile:read');
    expect(profileValidation.valid).toBe(true);
  });

  // 3. Wrong scope test (must fail)
  test('Scope Enforcement: token with only form:map scope fails when accessing profile:read', () => {
    const { rawToken } = issueExtensionToken(testUserId, 'Map Only Ext', ['form:map']);

    const mapCheck = validateExtensionToken(rawToken, 'form:map');
    expect(mapCheck.valid).toBe(true);

    const profileCheck = validateExtensionToken(rawToken, 'profile:read');
    expect(profileCheck.valid).toBe(false);
    expect(profileCheck.error).toBe('INSUFFICIENT_SCOPE');
  });

  // 4. Revocation test (must fail after revoke)
  test('Token Revocation: revoked token is rejected with TOKEN_REVOKED', () => {
    const { rawToken, tokenId } = issueExtensionToken(testUserId, 'Revocable Ext', ['form:map', 'profile:read']);

    // Initially valid
    expect(validateExtensionToken(rawToken, 'form:map').valid).toBe(true);

    // Revoke token
    const revoked = revokeExtensionToken(tokenId, testUserId);
    expect(revoked).toBe(true);

    // Now rejected
    const checkAfterRevoke = validateExtensionToken(rawToken, 'form:map');
    expect(checkAfterRevoke.valid).toBe(false);
    expect(checkAfterRevoke.error).toBe('TOKEN_REVOKED');
  });

  // 5. Expired token test (must fail)
  test('Token Expiry: expired token is rejected with TOKEN_EXPIRED', () => {
    const { rawToken, tokenId } = issueExtensionToken(testUserId, 'Expiring Ext', ['form:map'], -1); // expired 1 day ago

    const checkExpired = validateExtensionToken(rawToken, 'form:map');
    expect(checkExpired.valid).toBe(false);
    expect(checkExpired.error).toBe('TOKEN_EXPIRED');
  });

  // 6. Token used on unauthorized routes (must fail)
  test('Route Restriction: extension Bearer token used on general web routes (e.g. /api/profile) fails with 401', async ({ request }) => {
    const { rawToken } = issueExtensionToken(testUserId, 'Route Restrict Ext', ['form:map', 'profile:read']);

    // Call /api/profile with Bearer token
    const response = await request.get('/api/profile', {
      headers: {
        Authorization: `Bearer ${rawToken}`,
      },
    });

    // General app routes only accept web session, NOT extension token
    expect(response.status()).toBe(401);
  });

  // 7. Token used on authorized routes (/api/form/map and /api/profile/fill-values) succeeds
  test('Authorized Endpoints: Bearer token is accepted on /api/form/map and /api/profile/fill-values', async ({ request }) => {
    const { rawToken } = issueExtensionToken(testUserId, 'Authorized Ext', ['form:map', 'profile:read']);

    // Seed cache so test runs deterministically without network LLM dependency
    const reqPayload = {
      siteHost: 'upsc.gov.in',
      language: 'en',
      fields: [{ id: 'f_name', label: 'Full Name', type: 'text' }],
      profileKeys: ['full_name'],
    };
    const key = formMappingCache.generateKey(reqPayload);
    formMappingCache.set(key, [
      {
        fieldId: 'f_name',
        profileKey: 'full_name',
        confidence: 0.95,
        explanation: 'Candidate Full Name',
        whatToEnter: 'Your official name',
      },
    ]);

    // Call /api/form/map with Bearer token
    const mapRes = await request.post('/api/form/map', {
      headers: {
        Authorization: `Bearer ${rawToken}`,
      },
      data: reqPayload,
    });
    expect(mapRes.status()).toBe(200);

    // Call /api/profile/fill-values with Bearer token
    const fillRes = await request.get('/api/profile/fill-values', {
      headers: {
        Authorization: `Bearer ${rawToken}`,
      },
    });
    expect(fillRes.status()).toBe(200);
    const fillData = await fillRes.json();
    expect(fillData.fillValues).toBeDefined();
  });

  // 8. Extension build artifact verification
  test('Extension Artifacts: packages/extension and dist contain valid Manifest V3 bundle', () => {
    const EXTENSION_ROOT = path.resolve(__dirname, '../../extension');

    // Both packages/extension AND packages/extension/dist must have all required files
    for (const targetDir of [EXTENSION_ROOT, EXTENSION_DIST]) {
      expect(fs.existsSync(path.join(targetDir, 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'background.js'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'content-app.js'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'popup.html'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'popup.js'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'popup.css'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, 'form-core.iife.js'))).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8'));
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.permissions).toContain('activeTab');
      expect(manifest.permissions).toContain('scripting');
      expect(manifest.permissions).toContain('storage');
      expect(manifest.host_permissions).toBeUndefined();
      expect(manifest.key).toBeDefined();
    }
  });

  // 9. Hard Rule 2 Safety Check: Extension NEVER auto-submits or clicks Submit/Pay
  test('Hard Rule 2 Safety: Form assistance NEVER fires submit events or clicks submit buttons', async ({ page }) => {
    await page.goto(getPageUrl('plain-form.html'));
    await page.addScriptTag({ path: BUNDLE_PATH });

    // Track submit events on the page
    const submitFired = await page.evaluate(() => {
      let fired = false;
      document.querySelector('form')?.addEventListener('submit', (e) => {
        fired = true;
        e.preventDefault();
      });

      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();
      const overlay = core.mountOverlay({ language: 'en' });
      overlay.setData(schema.fields, [], { first_name: 'Ananya' });

      // Simulate full guide run
      overlay.fillAllFields();

      return fired;
    });

    expect(submitFired).toBe(false);
  });

  // 10. React Form State Synchronization in ISOLATED World
  test('React Form in ISOLATED World: prototype value setter synchronizes React synthetic state', async ({ page }) => {
    await page.goto(getPageUrl('react-form.html'));
    await page.waitForSelector('#react-form');
    await page.addScriptTag({ path: BUNDLE_PATH });

    const reactResult = await page.evaluate(() => {
      const core = (window as any).TechFormBuddyCore;
      const schema = core.readForm();
      const mapping = {
        'react-name': 'fullName',
        'react-email': 'email',
      };
      const values = {
        fullName: 'Rohit Sharma',
        email: 'rohit@example.com',
      };

      core.applyFill(mapping, values, schema.fields);

      // Verify that React synthetic state updated
      const namePreview = document.getElementById('state-preview-name')?.textContent || '';
      const emailPreview = document.getElementById('state-preview-email')?.textContent || '';
      return {
        namePreview,
        emailPreview,
        tokenExposed: (window as any).__tfbToken !== undefined,
      };
    });

    expect(reactResult.namePreview).toContain('Rohit Sharma');
    expect(reactResult.emailPreview).toContain('rohit@example.com');
    expect(reactResult.tokenExposed).toBe(false);
  });
});
