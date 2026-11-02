import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Request Proxy / Middleware: Nonce-based Content Security Policy (CSP)
 *
 * How this works:
 * 1. For every incoming HTML request, a fresh cryptographic nonce is generated.
 * 2. The nonce is injected into the CSP policy ('nonce-${nonce}', 'strict-dynamic').
 * 3. 'x-nonce' and 'Content-Security-Policy' are attached to the incoming request headers
 *    so Next.js server-rendering automatically extracts the nonce and assigns it to all
 *    framework scripts, inline bundles, and style tags.
 * 4. The response receives 'Content-Security-Policy-Report-Only' by default so it reports
 *    violations without breaking or blocking application workflows.
 *
 * HOW TO SWITCH FROM REPORT-ONLY TO ENFORCEMENT:
 * - Option A (Recommended): Set environment variable `CSP_ENFORCE=true` in `.env.local` or production environment.
 * - Option B (Code): Change `DEFAULT_ENFORCE` below from `false` to `true`, which switches the header name from
 *   'Content-Security-Policy-Report-Only' to 'Content-Security-Policy'.
 */

const DEFAULT_ENFORCE = false;

export function proxy(request: NextRequest) {
  // 1. Generate unique cryptographic nonce (Base64)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  // 2. Build CSP Directives
  // - 'strict-dynamic' allows trusted scripts to load dependencies
  // - 'unsafe-eval' is permitted strictly in development for React Fast Refresh / HMR
  // - ws: / wss: allowed for Next.js dev server web sockets
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: ${isDev ? "'unsafe-eval'" : ""}`.trim(),
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "style-src-attr 'unsafe-inline'",
    `style-src-elem 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://generativelanguage.googleapis.com https: http://localhost:* ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  // 3. Forward nonce & CSP to Next.js renderer via request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspDirectives);
  requestHeaders.set('Content-Security-Policy-Report-Only', cspDirectives);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 4. Determine header name (Report-Only vs Enforce)
  const isEnforce = process.env.CSP_ENFORCE === 'true' || DEFAULT_ENFORCE;
  const clientHeaderName = isEnforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

  // Attach CSP header and x-nonce to outgoing response
  response.headers.set(clientHeaderName, cspDirectives);
  response.headers.set('x-nonce', nonce);

  return response;
}

// Backwards compatibility alias for middleware
export const middleware = proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png (favicons & app icons)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
