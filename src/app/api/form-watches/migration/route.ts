import { NextRequest, NextResponse } from 'next/server';
import { auditEventRecords, runMongoMigration } from '@/lib/mongoMigration';

export async function GET(request: NextRequest) {
  try {
    const audit = auditEventRecords();
    return NextResponse.json(audit);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await runMongoMigration();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
