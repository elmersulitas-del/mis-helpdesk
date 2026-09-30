import nodemailer from 'nodemailer';
import type { Ticket } from '@/lib/types';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function deliverReceipt(ticket: Ticket) {
  const sb = getSupabaseAdmin();
  const { data: claimed, error } = await sb.from('tickets')
    .update({ receipt_status: 'SENDING' }).eq('id', ticket.id)
    .in('receipt_status', ['NOT_SENT', 'FAILED']).select('id').maybeSingle();
  if (error) return { status: 'FAILED', message: 'Record saved. Apply the receipt migration before sending email.' };
  if (!claimed) return { status: ticket.receipt_status || 'SENDING', message: 'Receipt already sent or being processed.' };
  try {
    const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) throw new Error('SMTP is not configured');
    if (!ticket.reporter_email) throw new Error('Recipient email is missing');
    const port = Number(process.env.SMTP_PORT || '465');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    const walkIn = ticket.source === 'WALK_IN';
    const date = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(walkIn ? ticket.resolved_at || ticket.created_at : ticket.created_at));
    const base = process.env.NEXT_PUBLIC_APP_URL;
    const lines = [
      `Hello ${ticket.reporter_name},`, '',
      walkIn ? 'This is your receipt confirming that you received walk-in assistance from the MIS Office.' : 'We have received your MIS support request. This receipt confirms submission; it does not mean the concern has been resolved.',
      '', `Reference: ${ticket.ticket_number}`, `Date (Philippines): ${date}`,
      `Department: ${ticket.department}`, `Location: ${ticket.location}`,
      `Category: ${ticket.category}`, `Subject: ${ticket.subject}`,
      `Concern: ${ticket.description}`, `Status: ${ticket.status.replaceAll('_', ' ')}`,
      ...(walkIn ? [`Action taken: ${ticket.resolution_notes}`, `Technician: ${ticket.assigned_to}`] : []),
      ...(base ? ['', `Track your request: ${base.replace(/\/$/, '')}/track/${ticket.public_token}`] : []),
      '', 'Immaculada Concepcion College — MIS Office',
    ];
    const info = await transporter.sendMail({
      from: { name: 'ICC MIS Helpdesk', address: process.env.SMTP_FROM_EMAIL || 'mis@immaculada.edu.ph' },
      to: ticket.reporter_email,
      subject: `${walkIn ? 'MIS assistance receipt' : 'MIS support request received'} — ${ticket.ticket_number}`,
      text: lines.join('\n'),
    });
    if (!info.accepted.length) throw new Error('Recipient rejected');
    const { error: saved } = await sb.from('tickets').update({ receipt_status: 'SENT', receipt_sent_at: new Date().toISOString() }).eq('id', ticket.id);
    if (saved) return { status: 'SENDING', message: 'Email accepted, but delivery status could not be saved. Check before retrying.' };
    return { status: 'SENT', message: 'Email receipt accepted by the mail server.' };
  } catch {
    await sb.from('tickets').update({ receipt_status: 'FAILED' }).eq('id', ticket.id);
    return { status: 'FAILED', message: 'Record saved, but the receipt could not be sent. MIS can retry after checking email settings.' };
  }
}
