import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMisSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { processEmailQueue } from '@/lib/email-receipts';
export const maxDuration = 60;
const schema = z.object({
  expected_status: z.enum(['PENDING','ACCEPTED','IN_PROGRESS','RESOLVED','CANCELLED']),
  status: z.enum(['ACCEPTED','IN_PROGRESS','RESOLVED','CANCELLED']),
  assigned_to: z.string().trim().max(120),
  resolution_notes: z.string().trim().max(3000),
});
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getMisSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const { id } = await params;
  if (!parsed.success || !z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid ticket update.' }, { status: 400 });
  const value = parsed.data;
  const { data, error } = await getSupabaseAdmin().rpc('transition_ticket', {
    p_id: id, p_expected: value.expected_status, p_status: value.status,
    p_assigned: value.assigned_to, p_notes: value.resolution_notes, p_actor: session.username,
  });
  if (error) {
    const status = error.code === '40001' ? 409 : error.code === '22023' ? 400 : error.code === 'P0002' ? 404 : 500;
    const message = status === 409 ? 'This ticket changed. Refresh and try again.' : status === 400 ? 'Invalid transition. Technician and resolution notes are required when applicable.' : status === 404 ? 'Ticket not found.' : 'Unable to update ticket. Check the database migration.';
    return NextResponse.json({ error: message }, { status });
  }
  if (value.status === 'RESOLVED') after(async () => {
    await processEmailQueue(id).catch(error => console.error('Email worker:', error));
  });
  return NextResponse.json(data);
}
