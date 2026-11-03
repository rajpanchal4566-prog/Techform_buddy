import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, saveEvent, getSavedEvents, deleteSavedEvent, toggleEventReminder } from '@/lib/db';

async function resolveUser(request: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  let userId = (session?.user as { id?: string })?.id || null;

  if (!userId && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
    userId = 'ce93fcbf-0795-4774-9d9e-e24bbb5e9483';
  }
  return userId;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUser(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const saved = getSavedEvents(userId);
    return NextResponse.json({ savedEvents: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUser(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || 'save';

    if (action === 'save') {
      const saved = saveEvent(userId, {
        id: body.id,
        event_id: body.eventId || body.event_id || body.id,
        title: body.title,
        category: body.category || 'hackathon',
        event_type: body.eventType || body.event_type || 'event',
        source_name: body.sourceName || body.source_name,
        source_url: body.sourceUrl || body.source_url,
        event_date: body.eventDate || body.event_date,
        deadline_date: body.deadlineDate || body.deadline_date,
        location_mode: body.locationMode || body.location_mode || 'online',
        registration_url: body.registrationUrl || body.registration_url || body.sourceUrl,
        reminder_set: body.reminderSet !== undefined ? (body.reminderSet ? 1 : 0) : 1,
        notes: body.notes,
      });

      return NextResponse.json({
        success: true,
        message: `Event "${saved.title}" saved successfully.`,
        savedEvent: saved,
      });
    }

    if (action === 'remove' || action === 'delete') {
      const idOrTitle = body.id || body.title;
      if (!idOrTitle) {
        return NextResponse.json({ error: 'Event ID or Title is required' }, { status: 400 });
      }
      deleteSavedEvent(userId, idOrTitle);
      return NextResponse.json({ success: true, message: 'Event removed from bookmarks.' });
    }

    if (action === 'toggle_reminder') {
      const id = body.id;
      const reminderSet = Boolean(body.reminderSet);
      if (!id) {
        return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
      }
      toggleEventReminder(userId, id, reminderSet);
      return NextResponse.json({
        success: true,
        message: reminderSet ? 'Reminder enabled for this event.' : 'Reminder disabled.',
        reminderSet,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
