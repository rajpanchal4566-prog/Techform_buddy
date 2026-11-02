import { NextRequest, NextResponse } from 'next/server';
import { planUtteranceNLU } from '@/lib/nluPlanner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, currentPath = '/', language = 'en', profile } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "query" field' }, { status: 400 });
    }

    const result = await planUtteranceNLU(query, currentPath, language, profile);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/planner] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal NLU Planner error' },
      { status: 500 }
    );
  }
}

