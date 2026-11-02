import NextAuth from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import type { NextRequest } from 'next/server';

const authHandler = NextAuth(authOptions);

async function handler(req: NextRequest, ctx: any) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  if (host) {
    process.env.NEXTAUTH_URL = `${proto}://${host}`;
  }
  return (authHandler as any)(req, ctx);
}

export { handler as GET, handler as POST };

