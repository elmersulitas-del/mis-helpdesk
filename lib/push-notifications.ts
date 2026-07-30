import webpush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type NewTicketPush = {
  id: string;
  ticket_number: string;
  department: string;
  subject: string;
};

type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendNewTicketPush(ticket: NewTicketPush) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || 'mailto:mis@immaculada.edu.ph';

  if (!publicKey || !privateKey) {
    console.warn('Web Push is not configured. Skipping push notification.');
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('mis_push_subscriptions')
    .select('endpoint,p256dh,auth');

  if (error) {
    console.error('Unable to load MIS push subscriptions:', error.message);
    return;
  }

  const payload = JSON.stringify({
    title: 'New MIS support request',
    body: `${ticket.department}: ${ticket.subject}`,
    tag: `mis-ticket-${ticket.id}`,
    url: '/mis',
    ticketNumber: ticket.ticket_number,
  });

  await Promise.allSettled(
    ((data || []) as StoredSubscription[]).map(async (saved) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: saved.endpoint,
            keys: {
              p256dh: saved.p256dh,
              auth: saved.auth,
            },
          },
          payload,
          { TTL: 60, urgency: 'high' }
        );
      } catch (error) {
        const statusCode =
          typeof error === 'object' &&
          error &&
          'statusCode' in error
            ? Number(error.statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from('mis_push_subscriptions')
            .delete()
            .eq('endpoint', saved.endpoint);
          return;
        }

        console.error('Unable to send MIS push notification:', error);
      }
    })
  );
}
