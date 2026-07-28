import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isMisAuthenticated } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const messageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isMisAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await getSupabaseAdmin()
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'Unable to load the conversation.' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isMisAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id,status,assigned_to')
    .eq('id', id)
    .single();

  if (!ticket) {
    return NextResponse.json(
      { error: 'Ticket not found.' },
      { status: 404 }
    );
  }

  if (ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'This ticket is closed and can no longer receive replies.' },
      { status: 409 }
    );
  }

  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Message must contain 1 to 2,000 characters.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: id,
      sender_type: 'MIS',
      sender_name: ticket.assigned_to || 'MIS Staff',
      sender_email: null,
      message: parsed.data.message,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Unable to send the reply.' },
      { status: 500 }
    );
  }

  await supabase
    .from('tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json(data, { status: 201 });
}
