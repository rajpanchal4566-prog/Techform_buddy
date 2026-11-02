import crypto from 'crypto';
import { getDb, generateId } from './db';

export interface ExtensionTokenRecord {
  id: string;
  user_id: string;
  name: string;
  scopes: string[];
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export type ExtensionScope = 'form:map' | 'profile:read';

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates and stores a new extension token with SHA-256 hashing.
 * The raw token is returned ONCE to the user/extension and NEVER stored in plaintext.
 */
export function issueExtensionToken(
  userId: string,
  name = 'Chrome Extension (Desktop)',
  scopes: ExtensionScope[] = ['form:map', 'profile:read'],
  expiresInDays = 30
): { tokenId: string; rawToken: string; expiresAt: string; scopes: ExtensionScope[] } {
  const db = getDb();
  const tokenId = generateId();
  const rawToken = `tfb_ext_${crypto.randomBytes(24).toString('base64url')}`;
  const tokenHash = hashToken(rawToken);

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + expiresInDays);
  const expiresAt = expiresDate.toISOString();

  db.prepare(
    `INSERT INTO extension_tokens (id, user_id, name, token_hash, scopes, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(tokenId, userId, name, tokenHash, JSON.stringify(scopes), expiresAt);

  return {
    tokenId,
    rawToken,
    expiresAt,
    scopes,
  };
}

/**
 * Revokes a specific extension token for a user.
 */
export function revokeExtensionToken(tokenId: string, userId: string): boolean {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE extension_tokens
       SET revoked_at = datetime('now')
       WHERE id = ? AND user_id = ? AND revoked_at IS NULL`
    )
    .run(tokenId, userId);

  return result.changes > 0;
}

/**
 * Retrieves all connected extension tokens for a user (hashes excluded).
 */
export function listExtensionTokens(userId: string): ExtensionTokenRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, name, scopes, expires_at, revoked_at, created_at
       FROM extension_tokens
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId) as any[];

  return rows.map((r) => ({
    ...r,
    scopes: typeof r.scopes === 'string' ? JSON.parse(r.scopes) : r.scopes,
  }));
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  tokenId?: string;
  error?: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_REVOKED' | 'INSUFFICIENT_SCOPE';
}

/**
 * Validates a Bearer extension token against the database hash.
 */
export function validateExtensionToken(
  rawToken: string,
  requiredScope?: ExtensionScope
): TokenValidationResult {
  if (!rawToken || !rawToken.startsWith('tfb_ext_')) {
    return { valid: false, error: 'TOKEN_INVALID' };
  }

  const tokenHash = hashToken(rawToken);
  const db = getDb();

  const row = db
    .prepare(
      `SELECT id, user_id, scopes, expires_at, revoked_at
       FROM extension_tokens
       WHERE token_hash = ?`
    )
    .get(tokenHash) as any;

  if (!row) {
    return { valid: false, error: 'TOKEN_INVALID' };
  }

  if (row.revoked_at) {
    return { valid: false, error: 'TOKEN_REVOKED' };
  }

  const expiresTime = new Date(row.expires_at).getTime();
  if (Date.now() > expiresTime) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  if (requiredScope) {
    let scopes: string[] = [];
    try {
      scopes = typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes;
    } catch {
      scopes = [];
    }

    if (!scopes.includes(requiredScope)) {
      return { valid: false, error: 'INSUFFICIENT_SCOPE' };
    }
  }

  return {
    valid: true,
    userId: row.user_id,
    tokenId: row.id,
  };
}
