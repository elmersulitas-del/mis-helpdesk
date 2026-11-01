import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { processEmailQueue } from '@/lib/email-receipts';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try { return NextResponse.json(await processEmailQueue(undefined, 2)); }
  catch { return NextResponse.json({ error: 'Email queue unavailable' }, { status: 503 }); }
}
