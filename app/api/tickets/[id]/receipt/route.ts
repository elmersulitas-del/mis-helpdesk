import { NextResponse } from 'next/server';
import { isMisAuthenticated } from '@/lib/auth';
export async function POST() {
  if (!await isMisAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ message: 'Emails are now handled automatically by the delivery queue.' }, { status: 410 });
}
