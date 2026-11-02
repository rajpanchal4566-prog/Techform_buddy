import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';
import { getDb } from './db';

export interface UserAuthStatus {
  authenticated: boolean;
  userId?: string;
  email?: string;
  emailVerified: boolean;
}

export async function getUserAuthStatus(): Promise<UserAuthStatus> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { authenticated: false, emailVerified: false };
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return { authenticated: false, emailVerified: false };
  }
  const db = getDb();
  const u = db.prepare('SELECT id, email, email_verified FROM users WHERE id = ?').get(userId) as {
    id: string;
    email: string;
    email_verified: number;
  } | undefined;

  return {
    authenticated: true,
    userId: u?.id,
    email: u?.email,
    emailVerified: Boolean(u?.email_verified),
  };
}

/**
 * Enforces unverified account limits (Requirement 2 & 5).
 * Unverified accounts have limited access:
 * - Limited to a maximum of 1 form draft
 * - Cannot submit grievances
 * - Cannot create automated form watchers
 * - Cannot export official documents
 */
export function checkAccountPermission(
  userId: string,
  action: 'create_form' | 'submit_grievance' | 'create_watch' | 'export_document'
): { allowed: boolean; reason?: string } {
  const db = getDb();
  const user = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(userId) as {
    email_verified: number;
  } | undefined;

  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  // Fully verified accounts have no restrictions
  if (Boolean(user.email_verified)) {
    return { allowed: true };
  }

  // Unverified account restrictions:
  if (action === 'create_form') {
    const count = (db.prepare('SELECT COUNT(*) as c FROM forms WHERE user_id = ?').get(userId) as { c: number }).c;
    if (count >= 1) {
      return {
        allowed: false,
        reason: 'Unverified accounts are limited to 1 form. Please verify your email to unlock unlimited forms.',
      };
    }
  }

  if (action === 'submit_grievance') {
    return {
      allowed: false,
      reason: 'Email verification required to submit official grievances.',
    };
  }

  if (action === 'create_watch') {
    return {
      allowed: false,
      reason: 'Email verification required to activate automated portal watchers.',
    };
  }

  if (action === 'export_document') {
    return {
      allowed: false,
      reason: 'Email verification required to export legal documents.',
    };
  }

  return { allowed: true };
}

