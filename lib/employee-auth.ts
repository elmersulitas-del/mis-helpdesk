import type { User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type EmployeeIdentity = {
  user: User;
  email: string;
  fullName: string;
};

const ALLOWED_DOMAIN =
  process.env.ALLOWED_GOOGLE_DOMAIN || 'immaculada.edu.ph';

export async function getEmployeeIdentity(
  request: Request
): Promise<EmployeeIdentity | null> {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : '';

  if (!accessToken) return null;

  const { data, error } = await getSupabaseAdmin().auth.getUser(
    accessToken
  );
  const user = data.user;

  if (error || !user?.email) return null;

  const email = user.email.toLowerCase();
  const validDomain = email.endsWith(
    `@${ALLOWED_DOMAIN.toLowerCase()}`
  );
  const isGoogleUser = user.app_metadata?.provider === 'google';

  if (!validDomain || !isGoogleUser) return null;

  return {
    user,
    email,
    fullName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split('@')[0],
  };
}
