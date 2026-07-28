import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEmployeeIdentity } from '@/lib/employee-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const messageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

async function getOwnedTicket(request: Request, id: string) {
  const employee = await getEmployeeIdentity(request);
  if (!employee) return { employee: null, ticket: null };

  const { data: ticket } = await getSupabaseAdmin()
    .from('tickets')
    .select('id,status,reporter_email')
    .eq('id', id)
    .eq('reporter_email', employee.email)
    .single();

  return { employee, ticket };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { employee, ticket } = await getOwnedTicket(request, id);

  if (!employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ticket) {
    return NextResponse.json(
      { error: 'Ticket not found.' },
      { status: 404 }
    );
  }

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
  const { id } = await params;
  const { employee, ticket } = await getOwnedTicket(request, id);

  if (!employee) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: id,
      sender_type: 'EMPLOYEE',
      sender_name: employee.fullName,
      sender_email: employee.email,
      message: parsed.data.message,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Unable to send your reply.' },
      { status: 500 }
    );
  }

  await supabase
    .from('tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json(data, { status: 201 });
}
