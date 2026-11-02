import { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';

/**
 * GET /api/test-source
 * Returns test notices in JSON format. Editable by modifying the test-notices.json file.
 *
 * POST /api/test-source
 * Replaces the test notices data.
 */

const DATA_FILE = path.join(process.cwd(), 'data', 'test-notices.json');

function getDefaultNotices() {
  return {
    notices: [
      {
        title: 'Test Scholarship Application Open — National Merit Scholarship 2026-27',
        link: 'http://localhost:3000/form-watch',
        date: '2026-10-25',
      },
    ],
  };
}

function readNotices() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch { /* fallthrough */ }
  return getDefaultNotices();
}

export async function GET() {
  const data = readNotices();
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate structure
    if (!body.notices || !Array.isArray(body.notices)) {
      return Response.json(
        { error: 'Body must have a "notices" array with objects containing at least a "title" field' },
        { status: 400 }
      );
    }

    // Ensure data directory exists
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2), 'utf-8');
    return Response.json({ message: 'Test notices updated', count: body.notices.length });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
