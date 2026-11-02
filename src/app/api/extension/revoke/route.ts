import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { revokeExtensionToken } from '@/lib/extensionAuth';
import { getCorsHeaders, handleOptionsCors } from '@/lib/llm';

export async function OPTIONS(request: NextRequest) {
  return handleOptionsCors(request);
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  const tokenId = body.tokenId;
  if (!tokenId) {
    return NextResponse.json({ error: 'tokenId is required' }, { status: 400, headers: corsHeaders });
  }

  const revoked = revokeExtensionToken(tokenId, userId);
  return NextResponse.json({ success: revoked }, { headers: corsHeaders });
}
