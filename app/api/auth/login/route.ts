import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { makeSession, sessionCookie } from '@/lib/auth';
const credentials = z.object({ username: z.string().min(1).max(120), password: z.string().min(1).max(1024) });
function same(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export async function POST(request: Request) {
  const { MIS_ADMIN_USERNAME, MIS_ADMIN_PASSWORD, AUTH_SECRET } = process.env;
  if (!MIS_ADMIN_USERNAME?.trim() || !MIS_ADMIN_PASSWORD?.trim() || !AUTH_SECRET?.trim()) {
    return NextResponse.json({ error: 'MIS login is not configured. Contact the administrator.' }, { status: 503 });
  }
  const parsed = credentials.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !same(parsed.data.username, MIS_ADMIN_USERNAME) || !same(parsed.data.password, MIS_ADMIN_PASSWORD)) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, makeSession(parsed.data.username), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: sessionCookie.maxAge,
  });
  return response;
}
