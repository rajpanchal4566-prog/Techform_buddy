import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb } from '@/lib/db';
import { getRecommendationsForProfile, UserProfileInput } from '@/lib/recommendations';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    let profile: UserProfileInput = {};

    if (userId) {
      const db = getDb();
      const row = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as any;
      if (row) {
        profile = {
          date_of_birth: row.date_of_birth,
          gender: row.gender,
          phone: row.phone,
          address: row.address,
          city: row.city,
          state: row.state,
          occupation: row.occupation,
          custom_fields: row.custom_fields,
        };
      }
    }

    // Allow query param overrides for testing / instant simulation
    const { searchParams } = new URL(request.url);
    if (searchParams.has('age')) profile.age = parseInt(searchParams.get('age')!, 10);
    if (searchParams.has('gender')) profile.gender = searchParams.get('gender');
    if (searchParams.has('income')) profile.annual_income = parseInt(searchParams.get('income')!, 10);
    if (searchParams.has('category')) profile.category = searchParams.get('category');
    if (searchParams.has('occupation')) profile.occupation = searchParams.get('occupation');
    if (searchParams.has('is_student')) profile.is_student = searchParams.get('is_student') === 'true';
    if (searchParams.has('has_disability')) profile.has_disability = searchParams.get('has_disability') === 'true';

    const results = getRecommendationsForProfile(profile);

    return NextResponse.json({
      success: true,
      profileUsed: {
        age: profile.age,
        gender: profile.gender,
        income: profile.annual_income,
        category: profile.category,
        occupation: profile.occupation,
      },
      eligible: results.eligible,
      almostEligible: results.almostEligible,
      totalEvaluated: results.allEvaluations.length,
    });
  } catch (error: any) {
    console.error('[RecommendationsAPI] Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate recommendations', details: error?.message },
      { status: 500 }
    );
  }
}

