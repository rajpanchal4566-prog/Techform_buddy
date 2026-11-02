import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import { SERVER_ALLOWED_PROFILE_KEYS, redactedLogger, getCorsHeaders, handleOptionsCors } from '@/lib/llm';
import { validateExtensionToken } from '@/lib/extensionAuth';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsCors(request);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(request);

  // 1. Authentication check (Bearer token OR web session)
  const authHeader = request.headers.get('authorization');
  let userId: string = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim();
    const tokenResult = validateExtensionToken(rawToken, 'profile:read');
    if (!tokenResult.valid) {
      redactedLogger.log({
        level: 'warn',
        endpoint: '/api/profile/fill-values',
        method: 'GET',
        status: 401,
        payloadSummary: `[REDACTED: Bearer token rejected: ${tokenResult.error}]`,
      });
      return NextResponse.json(
        { error: tokenResult.error || 'TOKEN_INVALID' },
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
          },
        }
      );
    }
    userId = tokenResult.userId!;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      redactedLogger.log({
        level: 'warn',
        endpoint: '/api/profile/fill-values',
        method: 'GET',
        status: 401,
        payloadSummary: '[REDACTED: Unauthenticated profile fill-values access attempt]',
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
          },
        }
      );
    }
    userId = (session.user as { id?: string }).id || '';
  }

  if (!userId) {
    return NextResponse.json({ error: 'User identifier missing' }, { status: 400, headers: corsHeaders });
  }

  const db = getDb();
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;

  // 2. Build filtered, whitelisted non-sensitive values only
  const fillValues: Record<string, string> = {};

  if (profile) {
    const fullName = typeof profile.full_name === 'string' ? profile.full_name : '';
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const allowedSet = new Set<string>(SERVER_ALLOWED_PROFILE_KEYS);

    for (const key of SERVER_ALLOWED_PROFILE_KEYS) {
      if (key === 'first_name') {
        if (firstName) fillValues.first_name = firstName;
      } else if (key === 'last_name') {
        if (lastName) fillValues.last_name = lastName;
      } else if (key === 'name') {
        if (fullName) fillValues.name = fullName;
      } else if (key in profile && typeof profile[key] === 'string' && profile[key]) {
        fillValues[key] = profile[key] as string;
      }
    }

    // Check custom_fields if any non-sensitive values exist
    if (typeof profile.custom_fields === 'string') {
      try {
        const custom = JSON.parse(profile.custom_fields);
        for (const [k, v] of Object.entries(custom)) {
          if (allowedSet.has(k) && typeof v === 'string' && v && !fillValues[k]) {
            fillValues[k] = v;
          }
        }
      } catch {
        // ignore parse error
      }
    }
  }

  const durationMs = Date.now() - startTime;

  // 3. Redacted logging: Values are NEVER written to logs
  redactedLogger.log({
    level: 'info',
    endpoint: '/api/profile/fill-values',
    method: 'GET',
    userId,
    status: 200,
    durationMs,
    payloadSummary: `[REDACTED: ${Object.keys(fillValues).length} whitelisted profile fields returned]`,
  });

  return NextResponse.json(
    {
      fillValues,
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}
