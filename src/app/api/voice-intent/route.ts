import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript = '', language = 'en' } = body;
    const text = String(transcript).toLowerCase().trim();

    // Secondary semantic matching
    if (text.includes('scholarship') || text.includes('छात्रवृत्ति')) {
      return Response.json({
        type: 'WATCH_SCHOLARSHIPS',
        target: '/form-watch?q=scholarship',
        label: language === 'hi' ? 'छात्रवृत्ति फॉर्म ट्रैक करें' : 'Watch Scholarship Forms',
      });
    }

    if (text.includes('upload') || text.includes('pan card') || text.includes('aadhaar') || text.includes('id card')) {
      return Response.json({
        type: 'NAVIGATE',
        target: '/documents',
        label: language === 'hi' ? 'दस्तावेज़ पर जाएं' : 'Go to Documents',
      });
    }

    if (text.includes('fill') || text.includes('apply') || text.includes('application') || text.includes('आवेदन')) {
      return Response.json({
        type: 'NEW_FORM',
        target: '/forms/new',
        label: language === 'hi' ? 'नया फॉर्म बनाएं' : 'Create New Form',
      });
    }

    return Response.json({
      type: 'QUESTION',
      label: language === 'hi' ? 'सवाल पूछा गया' : 'Question',
      isQuestion: true,
      question: transcript,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Intent parse failed' }, { status: 500 });
  }
}
