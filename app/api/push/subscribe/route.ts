import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isMisAuthenticated } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(1000),
    auth: z.string().min(1).max(1000),
  }),
});

export async function GET() {
  if (!(await isMisAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { error: 'Push notifications are not configured.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ publicKey });
}

export async function POST(request: Request) {
  if (!(await isMisAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = subscriptionSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid push subscription.' },
      { status: 400 }
    );
  }

  const { endpoint, keys } = parsed.data;
  const { error } = await getSupabaseAdmin()
    .from('mis_push_subscriptions')
    .upsert(
      {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: request.headers.get('user-agent'),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscribed: true });
}
