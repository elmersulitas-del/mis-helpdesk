import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { isMisAuthenticated } from '@/lib/auth';

const ALLOWED_DOMAIN = process.env.ALLOWED_GOOGLE_DOMAIN || 'immaculada.edu.ph';

const schema = z.object({
  department: z.string().trim().min(2).max(120),
  location: z.string().trim().min(1).max(120),
  category: z.string().trim().min(2).max(100),
  subject: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(3000),
  priority: z.enum(['LOW','MEDIUM','HIGH','URGENT']).default('MEDIUM'),
});

function ticketNumber() {
  const d = new Date();
  return `MIS-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!accessToken) {
      return NextResponse.json({ error: 'Please sign in using your institutional Google account.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    const user = userData.user;

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Your login session is invalid or expired. Please sign in again.' }, { status: 401 });
    }

    const email = user.email.toLowerCase();
    if (!email.endsWith(`@${ALLOWED_DOMAIN.toLowerCase()}`)) {
      return NextResponse.json({ error: `Only @${ALLOWED_DOMAIN} accounts can submit tickets.` }, { status: 403 });
    }

    const provider = user.app_metadata?.provider;
    if (provider !== 'google') {
      return NextResponse.json({ error: 'Please use Google Workspace to sign in.' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the required fields.' }, { status: 400 });
    }

    const reporterName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split('@')[0];

    const public_token = randomBytes(24).toString('hex');
    const ticket_number = ticketNumber();
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        ...parsed.data,
        reporter_name: reporterName,
        reporter_email: email,
        contact_number: null,
        public_token,
        ticket_number,
      })
      .select('ticket_number,public_token')
      .single();

    if (error) throw error;

    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    return NextResponse.json({
      ticket_number: data.ticket_number,
      tracking_url: `${base}/track/${data.public_token}`,
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Unable to create the ticket.' }, { status: 500 });
  }
}

export async function GET() {
  if (!await isMisAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
