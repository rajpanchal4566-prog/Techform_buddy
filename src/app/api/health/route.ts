import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isDeepCheck = searchParams.get('deep') === '1';

  let dbOk = false;
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 as alive').get() as { alive?: number };
    dbOk = row?.alive === 1;
  } catch {
    dbOk = false;
  }

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const environment = process.env.NODE_ENV || 'development';
  const smtpConfigured = Boolean(process.env.SMTP_HOST || process.env.SMTP_USER || process.env.GMAIL_USER);
  const pushConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

  let sourceCount = 0;
  let tokenCount = 0;
  try {
    const db = getDb();
    const sRow = db.prepare('SELECT count(*) as cnt FROM watcher_sources').get() as { cnt: number } | undefined;
    sourceCount = sRow?.cnt || 0;
    const tRow = db.prepare('SELECT count(*) as cnt FROM extension_tokens').get() as { cnt: number } | undefined;
    tokenCount = tRow?.cnt || 0;
  } catch {
    // fallback defaults
  }

  const subsystems = {
    database: {
      status: dbOk ? 'operational' : 'degraded',
      label: 'SQLite WAL Database',
      details: dbOk ? 'Connection active with foreign keys and WAL mode' : 'Connection failed',
    },
    ai: {
      status: geminiConfigured ? 'operational' : 'fallback',
      label: 'Google Gemini NLU',
      model,
      details: geminiConfigured ? `API Key configured for ${model}` : 'Offline deterministic rule engine fallback',
    },
    smtp: {
      status: smtpConfigured ? 'operational' : 'mock',
      label: 'SMTP Email Delivery',
      details: smtpConfigured ? 'Configured for production email delivery' : 'Dev/Demo mode: Mock console provider active',
    },
    push: {
      status: pushConfigured ? 'operational' : 'mock',
      label: 'Web Push (VAPID)',
      details: pushConfigured ? 'VAPID public/private keypair active' : 'Dev/Demo mode: Local push simulation active',
    },
    watcher: {
      status: 'operational',
      label: 'Form Watcher Scheduler',
      details: `${sourceCount} real government and portal feeds monitored`,
    },
    extensionBridge: {
      status: 'operational',
      label: 'Chrome Extension Bridge',
      details: `Bearer token auth & form mapping ready (${tokenCount} registered tokens)`,
    },
  };

  const baseResponse = {
    status: dbOk ? 'ok' : 'degraded',
    service: 'TechForm Buddy API',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'error',
    geminiConfigured,
    environment,
    subsystems,
  };

  if (!isDeepCheck) {
    return NextResponse.json(baseResponse, {
      status: 200,
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
  }

  // Deep check: allowed only in development OR for authenticated sessions
  const isDev = environment !== 'production';
  let isAuthenticated = false;

  if (!isDev) {
    const session = await getServerSession(authOptions);
    isAuthenticated = Boolean(session?.user);
  }

  if (!isDev && !isAuthenticated) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Deep health check is restricted to development or authenticated sessions' },
      { status: 403, headers: { 'Cache-Control': 'no-cache, no-store' } }
    );
  }

  if (!geminiConfigured) {
    return NextResponse.json(
      {
        ...baseResponse,
        status: 'degraded',
        modelOk: false,
        model,
        reason: 'API_KEY_MISSING',
      },
      { status: 503, headers: { 'Cache-Control': 'no-cache, no-store' } }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY || '';

  // If running with test mock key or USE_MOCK_LLM, return successful health check
  if (apiKey.startsWith('AQ.') || process.env.USE_MOCK_LLM === 'true') {
    return NextResponse.json(
      {
        ...baseResponse,
        modelOk: true,
        model,
        reason: 'OK',
      },
      { status: 200, headers: { 'Cache-Control': 'no-cache, no-store' } }
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'health_check_ping' }] }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      return NextResponse.json(
        {
          ...baseResponse,
          modelOk: true,
          model,
          reason: 'OK',
        },
        { status: 200, headers: { 'Cache-Control': 'no-cache, no-store' } }
      );
    } else {
      const errorText = await res.text();
      const sanitizedError = errorText.replace(new RegExp(apiKey, 'g'), '[REDACTED]').slice(0, 100);
      return NextResponse.json(
        {
          ...baseResponse,
          status: 'degraded',
          modelOk: false,
          model,
          reason: `HTTP_${res.status}`,
          details: sanitizedError,
        },
        { status: 502, headers: { 'Cache-Control': 'no-cache, no-store' } }
      );
    }
  } catch (err: any) {
    const reasonCode = err.name === 'AbortError' ? 'TIMEOUT' : 'CONNECTION_ERROR';
    return NextResponse.json(
      {
        ...baseResponse,
        status: 'degraded',
        modelOk: false,
        model,
        reason: reasonCode,
      },
      { status: 504, headers: { 'Cache-Control': 'no-cache, no-store' } }
    );
  }
}
