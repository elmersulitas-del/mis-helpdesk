'use client';

import type { Session } from '@supabase/supabase-js';
import { FormEvent, useState } from 'react';

const departments = ['Administration','Accounting','College Department','Registrar','Library','Guidance','Human Resources','Basic Education','Other'];
const categories = ['Computer / Laptop','Printer / Scanner','Internet / Network','Software / Account','Projector / TV','Telephone','Other'];

type Props = {
  session: Session;
  fullName: string;
  email: string;
};

export default function TicketForm({ session, fullName, email }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ticket_number:string;tracking_url:string} | null>(null);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(json.error || 'Submission failed.');
      return;
    }

    setResult(json);
    e.currentTarget.reset();
  }

  if (result) {
    return (
      <div className="card">
        <h2>Request submitted</h2>
        <div className="notice successbox">
          <b>Ticket: {result.ticket_number}</b><br />Please save your tracking link.
        </div>
        <a className="btn" href={result.tracking_url}>Track my request</a>
        <button className="btn secondary" style={{marginLeft:8}} onClick={() => setResult(null)}>Submit another</button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Request MIS Support</h2>
      <p className="muted">Your name and institutional email are taken automatically from your Google account.</p>
      <div className="notice">
        <b>{fullName}</b><br />{email}
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="grid">
        <div><label>Department</label><select name="department" required defaultValue=""><option value="" disabled>Select department</option>{departments.map(x => <option key={x}>{x}</option>)}</select></div>
        <div><label>Office / Room</label><input name="location" required maxLength={120}/></div>
        <div><label>Concern category</label><select name="category" required>{categories.map(x => <option key={x}>{x}</option>)}</select></div>
        <div><label>Priority</label><select name="priority" defaultValue="MEDIUM"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></div>
        <div className="full"><label>Short subject</label><input name="subject" required minLength={1} maxLength={160}/></div>
        <div className="full"><label>Describe the problem</label><textarea name="description" required minLength={1} maxLength={3000}/></div>
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Submitting...' : 'Submit support request'}</button>
    </form>
  );
}
