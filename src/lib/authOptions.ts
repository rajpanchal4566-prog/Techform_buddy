import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { getDb, generateId } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const email = credentials.email.toLowerCase().trim();

        // Abuse protection: rate limit login attempts per email / IP
        const rateLimitKey = `login:${email}`;
        const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMITS.login);
        if (!rateCheck.allowed) {
          const retryMinutes = Math.ceil(rateCheck.retryAfterMs / 60000);
          throw new Error(`Too many login attempts. Please try again in ${retryMinutes} minute(s).`);
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
          id: string;
          email: string;
          password_hash: string | null;
          name: string;
          email_verified: number;
        } | undefined;

        // Generic error message: never reveal whether an email exists
        if (!user || !user.password_hash) {
          throw new Error('Invalid email or password');
        }

        const isValid = await verifyPassword(credentials.password, user.password_hash);

        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: Boolean(user.email_verified),
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        if (!user.email) return false;
        const email = user.email.toLowerCase().trim();
        const db = getDb();

        const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
          id: string;
          email: string;
          name: string;
          email_verified: number;
          auth_provider: string;
        } | undefined;

        if (existingUser) {
          // Link to existing user account. Google emails count as verified.
          db.prepare(`
            UPDATE users
            SET email_verified = 1,
                auth_provider = CASE WHEN auth_provider = 'credentials' THEN 'both' ELSE auth_provider END,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(existingUser.id);

          user.id = existingUser.id;
          (user as any).emailVerified = true;
          return true;
        } else {
          // Create new user account with verified email
          const userId = generateId();
          const profileId = generateId();
          const name = user.name || email.split('@')[0];

          db.transaction(() => {
            db.prepare(`
              INSERT INTO users (id, email, password_hash, name, email_verified, auth_provider)
              VALUES (?, ?, ?, ?, 1, 'google')
            `).run(userId, email, '', name);

            db.prepare(`
              INSERT INTO profiles (id, user_id, full_name, email)
              VALUES (?, ?, ?, ?)
            `).run(profileId, userId, name, email);
          })();

          user.id = userId;
          (user as any).emailVerified = true;
          return true;
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        const u = new URL(url);
        const b = new URL(baseUrl);
        if (u.host === b.host) return url;
      } catch {}
      return `${baseUrl}/dashboard`;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      if (token.id) {
        try {
          const db = getDb();
          const u = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(token.id) as {
            email_verified?: number;
          } | undefined;
          token.emailVerified = u ? Boolean(u.email_verified) : false;
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; emailVerified?: boolean }).id = token.id as string;
        (session.user as { id?: string; emailVerified?: boolean }).emailVerified = Boolean(token.emailVerified);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
