import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { seedDemoData } from '@/lib/seedDemo';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    // Allow demo reset if authenticated or if in development
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized: Demo reset requires login' }, { status: 401 });
    }

    const result = await seedDemoData();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API:demo/reset] Error resetting demo data:', error);
    return NextResponse.json(
      { error: 'Failed to reset demo data', details: error?.message },
      { status: 500 }
    );
  }
}

