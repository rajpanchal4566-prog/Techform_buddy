import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, generateId } from '@/lib/db';

function getInitialNextAction(dept: string): string {
  const d = (dept || '').toLowerCase();
  if (d.includes('elect') || d.includes('power') || d.includes('बिजली')) {
    return 'Site inspection by Junior Engineer scheduled within 48 hours';
  }
  if (d.includes('water') || d.includes('पानी') || d.includes('जल')) {
    return 'Pipeline inspection and potable pressure audit initiated';
  }
  if (d.includes('road') || d.includes('सड़क') || d.includes('नाली') || d.includes('नगर')) {
    return 'Ward maintenance executive assigned for physical site verification';
  }
  if (d.includes('scholarship') || d.includes('छात्रवृत्ति') || d.includes('education')) {
    return 'Application forwarded to District Welfare Officer for bank DBT reconciliation';
  }
  if (d.includes('ration') || d.includes('राशन') || d.includes('pds')) {
    return 'Regional food distribution officer notified for quota check';
  }
  if (d.includes('bank') || d.includes('बैंक') || d.includes('account')) {
    return 'Branch operations ombudsman assigned for record reactivation';
  }
  return 'Initial authority verification and documentation audit in progress';
}

export async function GET(request: NextRequest) {
  let userId: string | null = null;
  const session = await getServerSession(authOptions);
  userId = (session?.user as { id: string } | undefined)?.id || null;

  const db = getDb();
  if (!userId) {
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined;
    userId = firstUser?.id || null;
  }

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trackingNumber = searchParams.get('tracking_number');
  const grievanceId = searchParams.get('id');

  if (trackingNumber) {
    const item = db.prepare('SELECT * FROM grievances WHERE tracking_number = ?').get(trackingNumber);
    if (!item) return Response.json({ error: 'Grievance not found' }, { status: 404 });
    return Response.json(item);
  }

  if (grievanceId) {
    const item = db.prepare('SELECT * FROM grievances WHERE id = ?').get(grievanceId);
    if (!item) return Response.json({ error: 'Grievance not found' }, { status: 404 });
    return Response.json(item);
  }

  const grievances = db.prepare(
    'SELECT * FROM grievances WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);

  return Response.json(grievances);
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  const session = await getServerSession(authOptions);
  userId = (session?.user as { id: string } | undefined)?.id || null;

  const db = getDb();
  if (!userId) {
    const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined;
    userId = firstUser?.id || 'dev-user';
  }

  const body = await request.json();
  const {
    title,
    domain = 'general',
    department = 'General Services',
    description,
    language = 'en',
    priority = 'medium',
    attachmentName,
    attachmentData,
  } = body;

  if (!title || !description) {
    return Response.json({ error: 'Title and description are required' }, { status: 400 });
  }

  const id = generateId();
  // Format: GRV-2026-XXXX (Requirement B1)
  const trackingNumber = `GRV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const nextAction = getInitialNextAction(department || domain);

  db.prepare(`
    INSERT INTO grievances (
      id, user_id, tracking_number, title, domain, department, description, language, status, priority, attachment_name, attachment_data, next_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)
  `).run(
    id,
    userId,
    trackingNumber,
    title,
    domain,
    department,
    description,
    language,
    priority,
    attachmentName || null,
    attachmentData || null,
    nextAction
  );

  // Insert a notification
  const notifId = generateId();
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, link)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    notifId,
    userId,
    `Grievance Filed: ${trackingNumber}`,
    `Your grievance regarding "${title}" has been registered. Tracking ID: ${trackingNumber}. Next action: ${nextAction}`,
    'info',
    `/grievances?track=${trackingNumber}`
  );

  return Response.json({
    id,
    trackingNumber,
    status: 'submitted',
    nextAction,
    message: 'Grievance registered successfully',
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, trackingNumber, status, nextAction, resolutionNotes } = body;

  const db = getDb();
  const record = trackingNumber
    ? (db.prepare('SELECT * FROM grievances WHERE tracking_number = ?').get(trackingNumber) as any)
    : (db.prepare('SELECT * FROM grievances WHERE id = ?').get(id) as any);

  if (!record) {
    return Response.json({ error: 'Grievance not found' }, { status: 404 });
  }

  const newStatus = status || record.status;
  const newAction = nextAction || (
    newStatus === 'under_review' ? 'Document verification underway with department desk' :
    newStatus === 'in_progress' ? 'Field officer dispatched; physical inspection underway' :
    newStatus === 'resolved' ? 'Grievance satisfactorily resolved by executive authority' :
    record.next_action
  );
  const newNotes = resolutionNotes !== undefined ? resolutionNotes : record.resolution_notes;

  db.prepare(`
    UPDATE grievances
    SET status = ?, next_action = ?, resolution_notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, newAction, newNotes, record.id);

  const updated = db.prepare('SELECT * FROM grievances WHERE id = ?').get(record.id);
  return Response.json(updated);
}
