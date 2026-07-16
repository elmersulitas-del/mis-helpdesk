import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'mis_session';
const MAX_AGE = 60 * 60 * 12;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET is required.');
  return value;
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeSession(username: string) {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifySession(token?: string) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = signature(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function isMisAuthenticated() {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value);
}

export const sessionCookie = { name: COOKIE_NAME, maxAge: MAX_AGE };
