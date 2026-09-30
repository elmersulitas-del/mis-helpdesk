import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { isMisAuthenticated } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deliverReceipt } from '@/lib/email-receipts';

const schema = z.object({
  reporter_name: z.string().trim().min(1).max(120),
  reporter_email: z.email().max(254).transform(value => value.toLowerCase()),
  department: z.string().trim().min(2).max(120),
  location: z.string().trim().min(1).max(120),
  category: z.string().trim().min(2).max(100),
  subject: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(3000),
  assigned_to: z.string().trim().min(1).max(120),
  resolution_notes: z.string().trim().min(1).max(3000),
  resolved_at: z.iso.datetime({ offset: true }).refine(value => Date.parse(value) <= Date.now(), 'Completion date cannot be in the future.'),
});
export async function POST(request: Request) {
  if (!await isMisAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check all fields and the completion date.' }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from('tickets').insert({
    ...parsed.data, source: 'WALK_IN', status: 'RESOLVED', priority: 'MEDIUM',
    ticket_number: `MIS-WALKIN-${randomBytes(8).toString('hex').toUpperCase()}`,
    public_token: randomBytes(24).toString('hex'),
  }).select('*').single();
  if (error) return NextResponse.json({ error: 'Unable to save. Check that the walk-in migration has been applied.' }, { status: 500 });
  const receipt = await deliverReceipt(data);
  return NextResponse.json({ ticket: data, receipt_status: receipt.status, message: receipt.message }, { status: 201 });
}
