import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { issueExtensionToken, listExtensionTokens, revokeExtensionToken } from '@/lib/extensionAuth';
import { getCorsHeaders, handleOptionsCors } from '@/lib/llm';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsCors(request);
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 400, headers: corsHeaders });
  }

  const tokens = listExtensionTokens(userId);
  return NextResponse.json({ tokens }, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 400, headers: corsHeaders });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const tokenName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Chrome Extension (Desktop)';
  const result = issueExtensionToken(userId, tokenName);

  return NextResponse.json(
    {
      success: true,
      tokenId: result.tokenId,
      token: result.rawToken,
      expiresAt: result.expiresAt,
      scopes: result.scopes,
    },
    { status: 201, headers: corsHeaders }
  );
}

export async function DELETE(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 400, headers: corsHeaders });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  const tokenId = body.tokenId;
  if (!tokenId) {
    return NextResponse.json({ error: 'tokenId is required' }, { status: 400, headers: corsHeaders });
  }

  const revoked = revokeExtensionToken(tokenId, userId);
  return NextResponse.json({ success: revoked }, { headers: corsHeaders });
}
