import { NextResponse } from 'next/server';
import { getEmployeeIdentity } from '@/lib/employee-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  const employee = await getEmployeeIdentity(request);

  if (!employee) {
    return NextResponse.json(
      { error: 'Your login session is invalid or expired.' },
      { status: 401 }
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .from('tickets')
    .select('*')
    .eq('reporter_email', employee.email)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: 'Unable to load your ticket history.' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
