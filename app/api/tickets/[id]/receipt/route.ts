import { NextResponse } from 'next/server';
import { isMisAuthenticated } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deliverReceipt } from '@/lib/email-receipts';
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isMisAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { data } = await getSupabaseAdmin().from('tickets').select('*').eq('id', id).single();
  if (!data) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  return NextResponse.json(await deliverReceipt(data));
}
