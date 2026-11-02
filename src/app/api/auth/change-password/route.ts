import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import { verifyPassword, validatePassword, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const userId = (session?.user as any)?.id;
    if (!userId && !userEmail) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword) {
      return Response.json({ error: 'New password is required' }, { status: 400 });
    }

    const db = getDb();
    const user = (
      userId
        ? db.prepare('SELECT id, email, password_hash, auth_provider FROM users WHERE id = ?').get(userId)
        : db.prepare('SELECT id, email, password_hash, auth_provider FROM users WHERE LOWER(email) = LOWER(?)').get(userEmail)
    ) as
      | {
          id: string;
          email: string;
          password_hash: string;
          auth_provider: string;
        }
      | undefined;

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // If user already has an established password, verify currentPassword
    if (user.password_hash && user.password_hash.trim() !== '') {
      if (!currentPassword) {
        return Response.json(
          { error: 'Please enter your current password to set a new one.' },
          { status: 400 }
        );
      }

      const isCurrentValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentValid) {
        return Response.json(
          { error: 'Current password is incorrect. If you forgot it, reset via email.' },
          { status: 400 }
        );
      }
    }

    // Validate new password rules
    const validation = validatePassword(newPassword, user.email);
    if (!validation.valid) {
      return Response.json(
        {
          error: validation.message,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Hash and update password
    const newHash = await hashPassword(newPassword);
    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newHash, user.id);

    return Response.json({
      success: true,
      message: 'Password updated successfully!',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return Response.json(
      { error: 'Something went wrong while updating your password. Please try again.' },
      { status: 500 }
    );
  }
}
