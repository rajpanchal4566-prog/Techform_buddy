/**
 * TechForm Buddy - CORS Security Configuration
 *
 * Restricts cross-origin requests strictly to:
 * 1. Our own web origin (NEXTAUTH_URL / localhost)
 * 2. The TechForm Buddy Chrome Extension origin (configurable via ALLOWED_EXTENSION_ORIGIN)
 */

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const allowedExt = process.env.ALLOWED_EXTENSION_ORIGIN;
  const webOrigin = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  let allowOrigin = webOrigin;

  if (origin) {
    // 1. Check web app origin
    if (origin === webOrigin || origin.startsWith('http://localhost:3000')) {
      allowOrigin = origin;
    }
    // 2. Check extension origin
    else if (origin.startsWith('chrome-extension://')) {
      if (!allowedExt || allowedExt === '*' || origin === allowedExt || allowedExt.startsWith('chrome-extension://*')) {
        allowOrigin = origin;
      }
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function handleOptionsCors(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}
