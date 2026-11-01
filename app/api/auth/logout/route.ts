import { NextResponse } from 'next/server';
import { getMisSession, sessionCookie } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export async function POST() {
  const session = await getMisSession();
  if (session) {
    const { error } = await getSupabaseAdmin().from('mis_push_subscriptions').delete().eq('session_key', session.key);
    if (error) return NextResponse.json({ error: 'Unable to revoke alerts. Please retry logout.' }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
