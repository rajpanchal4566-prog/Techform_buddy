import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getDb, generateId } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const db = getDb();

  // Get user details
  const user = db.prepare('SELECT id, name, email, preferred_language FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  // Get profile
  let profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as any;

  if (!profile) {
    // Create default profile for this user if it doesn't exist
    const profileId = generateId();
    db.prepare(
      'INSERT INTO profiles (id, user_id, full_name, email) VALUES (?, ?, ?, ?)'
    ).run(profileId, userId, user.name || '', user.email || '');

    profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  }

  return Response.json({
    ...profile,
    preferred_language: user.preferred_language || 'en',
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const {
    full_name, date_of_birth, gender, phone, email,
    address, city, state, pincode, country,
    father_name, mother_name, blood_group, emergency_contact,
    marital_status, occupation,
    custom_fields,
    preferred_language
  } = body;

  const db = getDb();

  // Ensure profile exists
  const existing = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(userId);
  if (!existing) {
    const profileId = generateId();
    db.prepare(
      `INSERT INTO profiles (
        id, user_id, full_name, date_of_birth, gender, phone, email,
        address, city, state, pincode, country,
        father_name, mother_name, blood_group, emergency_contact,
        marital_status, occupation,
        custom_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      profileId, userId, full_name || '', date_of_birth || '', gender || '', phone || '', email || '',
      address || '', city || '', state || '', pincode || '', country || '',
      father_name || '', mother_name || '', blood_group || '', emergency_contact || '',
      marital_status || '', occupation || '',
      custom_fields ? JSON.stringify(custom_fields) : null
    );
  } else {
    db.prepare(
      `UPDATE profiles SET
        full_name = COALESCE(?, full_name),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        pincode = COALESCE(?, pincode),
        country = COALESCE(?, country),
        father_name = COALESCE(?, father_name),
        mother_name = COALESCE(?, mother_name),
        blood_group = COALESCE(?, blood_group),
        emergency_contact = COALESCE(?, emergency_contact),
        marital_status = COALESCE(?, marital_status),
        occupation = COALESCE(?, occupation),
        custom_fields = COALESCE(?, custom_fields),
        updated_at = datetime('now')
      WHERE user_id = ?`
    ).run(
      full_name, date_of_birth, gender, phone, email,
      address, city, state, pincode, country,
      father_name, mother_name, blood_group, emergency_contact,
      marital_status, occupation,
      custom_fields ? JSON.stringify(custom_fields) : null,
      userId
    );
  }

  // Update user's preferred language if provided
  if (preferred_language) {
    db.prepare('UPDATE users SET preferred_language = ? WHERE id = ?').run(preferred_language, userId);
  }

  return Response.json({
    message: 'Profile updated successfully',
    preferred_language: preferred_language || 'en'
  });
}
