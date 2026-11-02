import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, generateId } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    let query = 'SELECT * FROM applications WHERE user_id = ?';
    const params: any[] = [userId];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (q) {
      query += ' AND (title LIKE ? OR reference_number LIKE ? OR portal_name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ' ORDER BY updated_at DESC';

    const applications = db.prepare(query).all(...params);
    return Response.json(applications);
  } catch (err: any) {
    console.error('GET /api/applications error:', err);
    return Response.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();
    const {
      title,
      type = 'Other',
      portal_name,
      portal_url,
      reference_number,
      date_applied = new Date().toISOString().split('T')[0],
      status = 'submitted',
      next_action,
      deadline,
      notes,
      reminder_set = 0,
      attached_documents = '[]',
    } = body;

    if (!title?.trim() || !portal_name?.trim() || !reference_number?.trim()) {
      return Response.json(
        { error: 'Bad Request', message: 'Title, portal name, and reference number are required.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = generateId();

    db.prepare(`
      INSERT INTO applications (
        id, user_id, title, type, portal_name, portal_url, reference_number,
        date_applied, status, next_action, deadline, notes, reminder_set, attached_documents,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      userId,
      title.trim(),
      type,
      portal_name.trim(),
      portal_url || null,
      reference_number.trim(),
      date_applied,
      status,
      next_action || null,
      deadline || null,
      notes || null,
      reminder_set ? 1 : 0,
      typeof attached_documents === 'string' ? attached_documents : JSON.stringify(attached_documents)
    );

    // Also record notification if reminder is enabled
    if (reminder_set && deadline) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, is_read, link)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        userId,
        `Application Deadline Set: ${title.trim()}`,
        `Next action: "${next_action || 'Status check'}" due by ${deadline} on ${portal_name.trim()}`,
        'info',
        0,
        '/applications'
      );
    }

    const created = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    return Response.json(created, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/applications error:', err);
    return Response.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();
    const { id, status, next_action, deadline, notes, reminder_set } = body;

    if (!id) {
      return Response.json({ error: 'Bad Request', message: 'Application ID is required' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?').get(id, userId) as any;
    if (!existing) {
      return Response.json({ error: 'Not Found', message: 'Application not found' }, { status: 404 });
    }

    const newStatus = status || existing.status;
    const newNextAction = next_action !== undefined ? next_action : existing.next_action;
    const newDeadline = deadline !== undefined ? deadline : existing.deadline;
    const newNotes = notes !== undefined ? notes : existing.notes;
    const newReminder = reminder_set !== undefined ? (reminder_set ? 1 : 0) : existing.reminder_set;

    db.prepare(`
      UPDATE applications SET
        status = ?, next_action = ?, deadline = ?, notes = ?, reminder_set = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(newStatus, newNextAction, newDeadline, newNotes, newReminder, id, userId);

    if (newReminder && newDeadline && newDeadline !== existing.deadline) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, is_read, link)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        userId,
        `Reminder Updated: ${existing.title}`,
        `Next action: "${newNextAction || 'Status check'}" due by ${newDeadline}`,
        'info',
        0,
        '/applications'
      );
    }

    const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
    return Response.json(updated);
  } catch (err: any) {
    console.error('PUT /api/applications error:', err);
    return Response.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Bad Request', message: 'Application ID is required' }, { status: 400 });
    }

    const db = getDb();
    db.prepare('DELETE FROM applications WHERE id = ? AND user_id = ?').run(id, userId);
    return Response.json({ success: true, message: 'Application deleted' });
  } catch (err: any) {
    console.error('DELETE /api/applications error:', err);
    return Response.json({ error: 'Internal Server Error', message: err.message }, { status: 500 });
  }
}

