import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  FormMapRequestSchema,
  LLMOutputListSchema,
  SERVER_ALLOWED_PROFILE_KEYS,
  formMappingCache,
  userRateLimiter,
  redactedLogger,
  getCorsHeaders,
  handleOptionsCors,
  getLLMProvider,
  MockProvider,
  isSensitiveOrExcludedField,
  FormFieldMapping,
} from '@/lib/llm';
import { validateExtensionToken } from '@/lib/extensionAuth';

const MAX_PAYLOAD_BYTES = 250 * 1024; // 250 KB limit

export async function OPTIONS(request: NextRequest) {
  return handleOptionsCors(request);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(request);

  // 1. Authentication check (Bearer extension token OR web session)
  const authHeader = request.headers.get('authorization');
  let userId: string = '';
  let rateLimitKey: string = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7).trim();
    const tokenResult = validateExtensionToken(rawToken, 'form:map');
    if (!tokenResult.valid) {
      redactedLogger.log({
        level: 'warn',
        endpoint: '/api/form/map',
        method: 'POST',
        status: 401,
        payloadSummary: `[REDACTED: Bearer token rejected: ${tokenResult.error}]`,
      });
      return NextResponse.json(
        { error: tokenResult.error || 'TOKEN_INVALID', message: 'Invalid or expired extension token' },
        { status: 401, headers: corsHeaders }
      );
    }
    userId = tokenResult.userId!;
    rateLimitKey = `token:${tokenResult.tokenId}`;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      redactedLogger.log({
        level: 'warn',
        endpoint: '/api/form/map',
        method: 'POST',
        status: 401,
        payloadSummary: '[REDACTED: Unauthenticated request]',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    userId = (session.user as { id?: string }).id || 'unknown_user';
    rateLimitKey = `user:${userId}`;
  }

  // 2. Request body size limit check
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    redactedLogger.log({
      level: 'warn',
      endpoint: '/api/form/map',
      method: 'POST',
      userId,
      status: 413,
      payloadSummary: '[REDACTED: Payload exceeded 250KB limit]',
    });
    return NextResponse.json(
      { error: 'PAYLOAD_TOO_LARGE', message: 'Payload size exceeds allowable 250KB limit' },
      { status: 413, headers: corsHeaders }
    );
  }

  // 3. Rate limiting check (per user or per token)
  const rateLimit = userRateLimiter.check(rateLimitKey);
  if (!rateLimit.allowed) {
    redactedLogger.log({
      level: 'warn',
      endpoint: '/api/form/map',
      method: 'POST',
      userId,
      status: 429,
      payloadSummary: '[REDACTED: Rate limit exceeded]',
    });
    return NextResponse.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please wait before analyzing another form.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Retry-After': String(rateLimit.retryAfterSeconds || 60),
        },
      }
    );
  }

  let rawBody: any;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON', message: 'Invalid JSON request body' }, { status: 400, headers: corsHeaders });
  }

  // 4. Validate input with Zod
  const parseResult = FormMapRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    redactedLogger.log({
      level: 'warn',
      endpoint: '/api/form/map',
      method: 'POST',
      userId,
      status: 400,
      payloadSummary: '[REDACTED: Invalid request schema]',
    });
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        details: (((parseResult.error as any).issues || (parseResult.error as any).errors || []) as any[]).map((e: any) => ({
          path: Array.isArray(e.path) ? e.path.join('.') : String(e.path),
          message: e.message,
        })),
      },
      { status: 400, headers: corsHeaders }
    );
  }

  const mapRequest = parseResult.data;

  // 5. Cache lookup (siteHost + field-signature hash + language)
  const cacheKey = formMappingCache.generateKey(mapRequest);
  const cachedMappings = formMappingCache.get(cacheKey);

  if (cachedMappings) {
    const durationMs = Date.now() - startTime;
    redactedLogger.log({
      level: 'info',
      endpoint: '/api/form/map',
      method: 'POST',
      userId,
      siteHost: mapRequest.siteHost,
      fieldCount: mapRequest.fields.length,
      status: 200,
      durationMs,
      payloadSummary: `[REDACTED: Cached mapping returned for ${mapRequest.fields.length} fields]`,
    });

    return NextResponse.json(
      {
        siteHost: mapRequest.siteHost,
        language: mapRequest.language,
        mappings: cachedMappings,
        fromCache: true,
        provider: 'cache',
      },
      { headers: corsHeaders }
    );
  }

  // 6. Call LLMProvider with timeout fallback
  const provider = getLLMProvider();
  let rawMappings: FormFieldMapping[];

  try {
    rawMappings = await provider.mapForm(mapRequest);
  } catch (llmErr: any) {
    try {
      const fallbackMock = new MockProvider();
      rawMappings = await fallbackMock.mapForm(mapRequest);
    } catch {
      const durationMs = Date.now() - startTime;
      redactedLogger.log({
        level: 'error',
        endpoint: '/api/form/map',
        method: 'POST',
        userId,
        siteHost: mapRequest.siteHost,
        fieldCount: mapRequest.fields.length,
        status: 503,
        durationMs,
        error: llmErr.message,
        payloadSummary: '[REDACTED: LLM provider invocation failed]',
      });

      // Fallback: clear error code allowing client to use local analyzeForm()
      return NextResponse.json(
        {
          error: 'LLM_UNAVAILABLE',
          fallbackToLocal: true,
          message: 'LLM service unavailable or timed out. Falling back to local form analyzer.',
        },
        { status: 503, headers: corsHeaders }
      );
    }
  }

  // 7. Validate LLM output with Zod
  const outputValidation = LLMOutputListSchema.safeParse(rawMappings);
  if (!outputValidation.success) {
    redactedLogger.log({
      level: 'error',
      endpoint: '/api/form/map',
      method: 'POST',
      userId,
      siteHost: mapRequest.siteHost,
      status: 502,
      payloadSummary: '[REDACTED: LLM returned invalid schema]',
    });

    return NextResponse.json(
      {
        error: 'LLM_SCHEMA_VIOLATION',
        fallbackToLocal: true,
        message: 'LLM output violated mapping schema specification',
      },
      { status: 502, headers: corsHeaders }
    );
  }

  // 8. Server-side Whitelist & Security Policy Enforcement
  const requestedProfileKeysSet = new Set(mapRequest.profileKeys);
  const serverWhitelistSet = new Set<string>(SERVER_ALLOWED_PROFILE_KEYS);
  const fieldInputMap = new Map(mapRequest.fields.map((f) => [f.id, f]));

  const sanitizedMappings: FormFieldMapping[] = outputValidation.data.map((m) => {
    const fieldInput = fieldInputMap.get(m.fieldId);
    let profileKey = m.profileKey;
    let confidence = m.confidence;
    let explanation = m.explanation;
    let whatToEnter = m.whatToEnter;

    // Check sensitive or excluded fields (Rule 4: Never map Aadhaar/PAN/Passport/Card/Bank/Passwords/OTPs)
    if (fieldInput && isSensitiveOrExcludedField(fieldInput.label, fieldInput.id, fieldInput.type)) {
      profileKey = null;
      confidence = 0;
      explanation = 'Sensitive identity or financial field.';
      whatToEnter = 'Please type this yourself directly on the website.';
    }

    // Check allowed profile keys: must be in client requested keys AND server whitelist
    if (profileKey) {
      const isAllowedByClient = requestedProfileKeysSet.has(profileKey);
      const isAllowedByServer = serverWhitelistSet.has(profileKey);

      if (!isAllowedByClient || !isAllowedByServer) {
        // Disqualify invalid/non-whitelisted key
        profileKey = null;
      }
    }

    // Rule 6: If confidence < 0.7, set profileKey to null
    if (confidence < 0.7) {
      profileKey = null;
    }

    return {
      fieldId: m.fieldId,
      profileKey,
      explanation,
      whatToEnter,
      confidence,
    };
  });

  // 9. Store in cache
  formMappingCache.set(cacheKey, sanitizedMappings);

  const durationMs = Date.now() - startTime;
  redactedLogger.log({
    level: 'info',
    endpoint: '/api/form/map',
    method: 'POST',
    userId,
    siteHost: mapRequest.siteHost,
    fieldCount: mapRequest.fields.length,
    status: 200,
    durationMs,
    payloadSummary: `[REDACTED: Form mapped successfully for ${sanitizedMappings.length} fields]`,
  });

  return NextResponse.json(
    {
      siteHost: mapRequest.siteHost,
      language: mapRequest.language,
      mappings: sanitizedMappings,
      fromCache: false,
      provider: provider.name,
    },
    { headers: corsHeaders }
  );
}
