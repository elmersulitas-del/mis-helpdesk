import nodemailer from 'nodemailer';
import type { Ticket } from '@/lib/types';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type EmailJob = {
  id: string; ticket_id: string; kind: 'ACKNOWLEDGEMENT' | 'RESOLUTION';
  payload: Ticket; message_id: string; parent_message_id: string | null;
  subject: string; attempts: number; claim_token: string;
};

export function emailContent(job: EmailJob) {
  const ticket = job.payload;
  const resolved = job.kind === 'RESOLUTION';
  const walkIn = ticket.source === 'WALK_IN';
  const date = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(resolved || walkIn ? ticket.resolved_at || ticket.created_at : ticket.created_at));
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return {
    messageId: job.message_id,
    ...(job.parent_message_id ? { inReplyTo: job.parent_message_id, references: [job.parent_message_id] } : {}),
    subject: job.subject,
    text: [
      `Hello ${ticket.reporter_name},`, '',
      resolved ? 'Your MIS support request has been resolved. Below are the completed action and technician details.' :
      walkIn ? 'This receipt confirms your completed walk-in assistance from the MIS Office.' :
      'We have received your MIS support request. This acknowledges submission; it does not mean the concern has been resolved.',
      '', `Reference: ${ticket.ticket_number}`, `Date (Philippines): ${date}`,
      `Department: ${ticket.department}`, `Location: ${ticket.location}`,
      `Category: ${ticket.category}`, `Subject: ${ticket.subject}`, `Concern: ${ticket.description}`,
      `Status: ${resolved || walkIn ? 'RESOLVED' : ticket.status.replaceAll('_', ' ')}`,
      ...(resolved || walkIn ? [`Action taken: ${ticket.resolution_notes}`, `Technician: ${ticket.assigned_to}`] : []),
      ...(base ? ['', `Track your request: ${base.replace(/\/$/, '')}/track/${ticket.public_token}`] : []),
      '', 'Immaculada Concepcion College — MIS Office',
    ].join('\n'),
  };
}

// Durable jobs are inserted by the same database transaction as the ticket change.
// Only one worker can claim a job. Resolution jobs wait for the first email to be sent.
export async function processEmailQueue(ticketId?: string, limit = 2) {
  const sb = getSupabaseAdmin();
  let sent = 0;
  for (let i = 0; i < limit; i++) {
    const { data, error } = await sb.rpc('claim_ticket_email', { p_ticket_id: ticketId || null });
    if (error) throw new Error('Email queue unavailable. Apply the reliability migration.');
    const job = data?.[0] as EmailJob | undefined;
    if (!job) break;
    let smtpAccepted = false;
    try {
      const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) throw new Error('SMTP is not configured');
      if (!job.payload.reporter_email) throw new Error('Recipient email missing');
      const port = Number(process.env.SMTP_PORT || '465');
      const transport = nodemailer.createTransport({
        host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
        connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000,
        disableFileAccess: true, disableUrlAccess: true,
      });
      const info = await transport.sendMail({
        from: { name: 'ICC MIS Helpdesk', address: process.env.SMTP_FROM_EMAIL || 'mis@immaculada.edu.ph' },
        to: job.payload.reporter_email, ...emailContent(job),
      });
      if (!info.accepted.length) throw new Error('Recipient rejected');
      smtpAccepted = true;
      const { error: saved } = await sb.from('ticket_email_jobs')
        .update({ state: 'SENT', sent_at: new Date().toISOString(), lease_until: null, last_error: null })
        .eq('id', job.id).eq('claim_token', job.claim_token);
      if (saved) throw new Error('Unable to record SMTP acceptance');
      if (job.kind === 'ACKNOWLEDGEMENT') {
        await sb.from('tickets').update({ receipt_status: 'SENT', receipt_sent_at: new Date().toISOString() }).eq('id', job.ticket_id);
      }
      sent++;
    } catch (cause) {
      const error = cause as { code?: string; command?: string; message?: string };
      // A timeout/disconnect during DATA might happen after acceptance. Review instead of duplicating mail.
      const uncertain = smtpAccepted || (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET'].includes(error.code || '') && error.command === 'DATA');
      const state = uncertain || job.attempts >= 5 ? 'REVIEW' : 'QUEUED';
      const { error: saved } = await sb.from('ticket_email_jobs').update({
        state, lease_until: null,
        available_at: new Date(Date.now() + Math.min(3600, 60 * 2 ** (job.attempts - 1)) * 1000).toISOString(),
        last_error: uncertain ? 'SMTP outcome uncertain. Check mail logs before retrying.' : 'Email failed. Check SMTP configuration and recipient.',
      }).eq('id', job.id).eq('claim_token', job.claim_token);
      if (saved) console.error('Unable to record email failure; expired job will require review.');
    }
  }
  return { sent };
}
