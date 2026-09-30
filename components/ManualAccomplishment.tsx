'use client';
import { useState, type FormEvent } from 'react';
export default function ManualAccomplishment({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    body.resolved_at = new Date(`${body.resolved_at}:00+08:00`).toISOString();
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/manual-accomplishments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save.');
      setNotice(`Saved ${result.ticket.ticket_number}. ${result.message}`);
      form.reset(); onSaved();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }
  return <section className="panel no-print" style={{ padding: 20, marginBottom: 20 }}>
    <button className="ui-btn" type="button" onClick={() => setOpen(!open)}> {open ? 'Close manual entry' : 'Add walk-in accomplishment'}</button>
    {notice && <p role="status">{notice}</p>}
    {open && <form onSubmit={submit}>
      <h2>Walk-in assistance</h2>
      <p>Record completed assistance. A receipt will be sent to the requester’s email.</p>
      <div className="manual-entry-grid">
        {[
          ['reporter_name', 'Requester name', 'text', 120],
          ['reporter_email', 'Requester email', 'email', 254],
          ['department', 'Department', 'text', 120],
          ['location', 'Office / room', 'text', 120],
          ['category', 'Category', 'text', 100],
          ['subject', 'Subject', 'text', 160],
          ['assigned_to', 'Technician', 'text', 120],
        ].map(([name, label, type, max]) => <label key={name}><span>{label}</span><input name={String(name)} type={String(type)} maxLength={Number(max)} required /></label>)}
        <label><span>Date completed (Philippine time)</span><input name="resolved_at" type="datetime-local" required /></label>
        <label><span>Concern / description</span><textarea name="description" maxLength={3000} required /></label>
        <label><span>Action taken</span><textarea name="resolution_notes" maxLength={3000} required /></label>
      </div>
      <button className="ui-btn" disabled={busy}>{busy ? 'Saving…' : 'Save and send receipt'}</button>
    </form>}
  </section>;
}
