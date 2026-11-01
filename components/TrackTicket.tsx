'use client';
import { useEffect, useState } from 'react';
import type { Ticket } from '@/lib/types';
export default function TrackTicket({ token }: { token: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(`/api/track/${token}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load ticket.');
        setTicket(result); setError('');
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load ticket.');
      } finally { busy = false; }
    };
    void load(); const timer = setInterval(load, 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [token]);
  if (!ticket) return <div className="card" role="status">{error || 'Loading ticket…'}</div>;
  return <div className="card">
    {error && <div className="notice error" role="alert">{error} Retrying automatically; the details below may be outdated.</div>}
    <div className="tickethead"><div><h2>{ticket.ticket_number}</h2><div className="muted">Last update: {new Date(ticket.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</div></div><span className={`badge ${ticket.status}`}>{ticket.status.replaceAll('_', ' ')}</span></div>
    {ticket.status === 'ACCEPTED' && <div className="notice">IT support accepted your request. Please wait for the technician’s update.</div>}
    {ticket.status === 'IN_PROGRESS' && <div className="notice">An MIS technician is currently working on your concern.</div>}
    {ticket.status === 'RESOLVED' && <div className="notice successbox">Your request has been resolved.</div>}
    <div className="statusline"><b>Subject</b><span>{ticket.subject}</span></div>
    <div className="statusline"><b>Department / Location</b><span>{ticket.department} — {ticket.location}</span></div>
    <div className="statusline"><b>Concern</b><span>{ticket.description}</span></div>
    <div className="statusline"><b>Assigned technician</b><span>{ticket.assigned_to || 'Not yet assigned'}</span></div>
    {ticket.resolution_notes && <div className="statusline"><b>Resolution</b><span>{ticket.resolution_notes}</span></div>}
  </div>;
}
