import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
