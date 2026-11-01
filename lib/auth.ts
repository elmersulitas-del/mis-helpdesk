import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
const COOKIE_NAME = 'mis_session';
const MAX_AGE = 60 * 60 * 12;
export type MisSession = { username: string; exp: number; nonce: string; key: string };
function signature(payload: string) {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET is required.');
  return createHmac('sha256', process.env.AUTH_SECRET).update(payload).digest('base64url');
}
export function makeSession(username: string) {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + MAX_AGE * 1000, nonce: randomUUID() })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export function readSession(token?: string): MisSession | null {
  if (!token || !process.env.AUTH_SECRET) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = signature(payload);
    if (Buffer.byteLength(sig) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.username !== 'string' || !data.username || typeof data.nonce !== 'string' || !Number.isFinite(data.exp) || data.exp <= Date.now()) return null;
    if (!process.env.MIS_ADMIN_USERNAME || data.username !== process.env.MIS_ADMIN_USERNAME) return null;
    return { ...data, key: createHash('sha256').update(token).digest('hex') };
  } catch { return null; }
}
export function verifySession(token?: string) { return !!readSession(token); }
export async function getMisSession() {
  return readSession((await cookies()).get(COOKIE_NAME)?.value);
}
export async function isMisAuthenticated() { return !!(await getMisSession()); }
export const sessionCookie = { name: COOKIE_NAME, maxAge: MAX_AGE };
