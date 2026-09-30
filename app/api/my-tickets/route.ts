import { NextResponse } from 'next/server';
import { getEmployeeIdentity } from '@/lib/employee-auth';
import { getTicketHistory } from '@/lib/ticket-history';

export async function GET(request: Request) {
  const employee = await getEmployeeIdentity(request);

  if (!employee) {
    return NextResponse.json(
      { error: 'Your login session is invalid or expired.' },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(await getTicketHistory(employee.email));
  } catch {
    return NextResponse.json({ error: 'Unable to load complete ticket history.' }, { status: 500 });
  }
}
