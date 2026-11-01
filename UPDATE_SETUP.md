# November 1, 2026 update — read before deploying

## What changed

- Click **Enable alerts** once per page session to enable browser sound. The dashboard repeats the alert while at least one request is PENDING. Accepting the last pending request stops the sound immediately after the server confirms the update. Other pending requests keep the alert active. Updates from another computer stop it on the next refresh (normally within five seconds). Sound also stops on connection failure, logout or leaving the dashboard. Volume 0 mutes it.
- Looping audio requires an open dashboard and browser permission to play sound. A closed dashboard can receive normal Web Push notifications, but cannot run looping audio. Mobile background suspension can delay polling.
- New online tickets queue their acknowledgement automatically. Resolving an online ticket queues a resolution email with action taken and technician, using **In-Reply-To** and **References** pointing to the acknowledgement's stored Message-ID. The subject is `Re: <original subject>`.
- Existing emails sent before this update did not store a Message-ID. A resolution notification for those tickets is standalone unless the original ID is deliberately recovered from SMTP logs. This update does not invent that ID, resend old SENT receipts, or bulk email old records.
- Walk-ins remain one completed-assistance email, because they are created already resolved.
- Removed Receipt: SENT/NOT_SENT and all manual send-receipt buttons from both admin queue and reports. Delivery diagnostics remain server-side.
- Fixed configuration names, fail-open login, malformed session handling, illegal/stale status transitions, overwritten completion dates, non-atomic status history, retained push permissions after logout, and tracking-page recovery. Audit entries include the authenticated admin username.
- Idle polling uses a database revision and HTTP 304; complete history is fetched only when records change. First loads and changed histories still fetch all pages to keep reports complete. For a very large installation, separate server-paginated queue and report endpoints remain a future improvement.

## 1. Back up and apply the database update

Back up Supabase first. In SQL Editor:

- Existing installation: run `supabase/migrations/20260930_walk_in_receipts.sql` if not already applied, then run `supabase/migrations/20261101_helpdesk_reliability.sql`.
- New installation: run `supabase/schema.sql`, then both migrations above in that order.
- The new migration is safe to rerun. It does not delete tickets, messages, or history. It creates the private email queue and functions, so apply it **before deploying the new code**. Deploy promptly after migration; avoid leaving old and new application versions serving traffic together, since the old version sends receipts directly.
- Existing staff sessions require signing in again because the session format now includes a nonce. Old push subscriptions are inactive until staff sign in and enable alerts again.

## 2. Environment variables

Copy `.env.example` to `.env.local` for local use; set the same variables in your hosting provider for deployment.

| Variable | Required value |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL, matching `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret/service-role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Same project URL for employee Google login |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public publishable/anon key |
| `MIS_ADMIN_USERNAME`, `MIS_ADMIN_PASSWORD` | Nonempty, strong admin credentials |
| `AUTH_SECRET` | Long random session-signing secret |
| `NEXT_PUBLIC_APP_URL` | Final HTTPS app URL |
| `ALLOWED_GOOGLE_DOMAIN`, `NEXT_PUBLIC_ALLOWED_GOOGLE_DOMAIN` | Same institutional domain, default `immaculada.edu.ph` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Working institution-approved SMTP configuration; default port 465 |
| `SMTP_FROM_EMAIL` | Approved sender address; default `mis@immaculada.edu.ph` |
| `CRON_SECRET` | Separate long random token protecting the retry worker |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push configuration; generate with `npm run generate:vapid` |

Rename old `SUPABASE_SERVICE_ROLE_KEY` to `SUPABASE_SECRET_KEY` and old `SESSION_SECRET` to `AUTH_SECRET`. Preserve the existing secret value if available. Never prefix server credentials with NEXT_PUBLIC_. Public environment changes require a rebuild.

The SMTP account must be permitted to send as SMTP_FROM_EMAIL. Port 465 uses implicit TLS; other ports require STARTTLS. Client inbox grouping can vary even with correct reply headers. Verify with your actual SMTP provider and recipient inbox.

## 3. Configure automatic retries

Normal submissions/resolutions attempt delivery using Next.js `after()` after returning the saved ticket response. The jobs persist in Supabase, so ticket saving does not wait for SMTP.

**Required for retries while everyone is offline:** configure a scheduler to call the following endpoint, ideally every minute, with the secret authorization header:

```
GET https://YOUR-APP/api/internal/email-worker
Authorization: Bearer YOUR_CRON_SECRET
```

Use your hosting provider's scheduler or another authorized scheduler. If using Vercel Cron, its configured CRON_SECRET is supplied as the Bearer token. Choose a frequency supported by your hosting plan. No `vercel.json` schedule is forced into this project because scheduling limits differ by plan. The worker processes at most two jobs per call; increase scheduler frequency or worker capacity if your volume requires it.

Without this scheduler, immediate delivery attempts still run, but failed or interrupted jobs will not be revisited reliably after the dashboard closes.

Known delivery failures retry with delays of 1, 2, 4, and 8 minutes. After five failed attempts, the job requires review. Resolution mail waits until its acknowledgement succeeds. A process interruption or uncertain SMTP acceptance moves the job to REVIEW after its five-minute lease expires, preventing blind duplicate sending. Exactly-once SMTP delivery cannot be guaranteed across a process crash.

## 4. Install and deploy

```bash
npm ci
npm test
npm run test:db
npm run lint
npx tsc --noEmit
npm run build -- --webpack
npm start
```

Optional browser checks (uses synthetic tickets and a fake audio player, never real emails):

```bash
npx playwright install chromium
npm run test:ui
```

Browser tests expect an existing production build and start an isolated local server on port 3100 using test-only admin credentials. Database tests use embedded PostgreSQL (PGlite); they do not connect to your Supabase project.

## 5. Live verification

1. Sign in as MIS and click Enable alerts. Submit a test request using an authorized institutional Google account.
2. Confirm the acknowledgement arrives and sound repeats. Accept the request and confirm sound stops when no other pending requests remain.
3. Submit two tickets and accept one: sound must continue for the second. Accept the second: sound must stop.
4. Resolve a ticket with action taken and technician. Check that its resolution email replies to the first message and displays both details.
5. Confirm queue and report contain no receipt status or send-receipt controls.
6. Open two admin tabs. Resolve in one, then attempt an older status update from the other: the outdated update should be rejected.
7. Confirm logout stops future pushes to that browser. Already dispatched operating-system notifications may arrive briefly before their short TTL expires.
8. Confirm the scheduled worker receives 200 responses. Temporarily use a failing SMTP configuration in a test environment and verify recovery after restoring it.

No live Supabase database was migrated and no institutional email was sent while preparing this update.

## Email diagnosis (administrator only)

Run in Supabase SQL Editor:

```sql
select id, ticket_id, kind, state, attempts, available_at, last_error
from public.ticket_email_jobs
where state <> 'SENT'
order by created_at;
```

After fixing a known failure, or after checking SMTP logs for a REVIEW job, update **only the specific confirmed job**. If mail was accepted, mark it SENT (including sent_at). If it was definitely not sent, reset it to QUEUED, attempts=0, available_at=now(), lease_until=null, claim_token=null. Never reset all jobs indiscriminately. Keep SMTP credentials and actual recipient data out of logs shared externally.

Shared admin credentials remain the existing authentication model. Audit logs identify that admin account, not distinct human staff members. Use individual staff accounts/roles in a future authentication upgrade if individual accountability is needed.

Implementation references: https://nodemailer.com/message and https://supabase.com/docs/guides/database/functions
