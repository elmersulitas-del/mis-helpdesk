import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { Ticket } from '@/lib/types';

// Fetch every page: Supabase also has a server-side row limit.
export async function getTicketHistory(email?: string): Promise<Ticket[]> {
  const tickets: Ticket[] = [];
  const pageSize = 500;
  const snapshot = new Date().toISOString();
  let offset = 0;
  while (true) {
    let query = getSupabaseAdmin().from('tickets').select('*')
      .lte('created_at', snapshot)
      .order('created_at', { ascending: false }).order('id', { ascending: false });
    if (email) query = query.eq('reporter_email', email);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error('Unable to load complete ticket history.');
    tickets.push(...(data || []));
    if (!data?.length) break;
    // Continue even on a short page, in case the database row cap is lower.
    offset += data.length;
  }
  return tickets;
}
