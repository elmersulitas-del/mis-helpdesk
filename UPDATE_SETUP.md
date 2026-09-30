# Update setup

1. Back up the database and replace the project files with this updated version.
2. In Supabase SQL Editor, run `supabase/migrations/20260930_walk_in_receipts.sql`. Run this even on a fresh installation after schema.sql. Existing tickets remain intact; no rows are deleted.
3. Run `npm install`.
4. Ensure environment variables use the names the code expects: `SUPABASE_SECRET_KEY` and `AUTH_SECRET`. The old example incorrectly called them SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET. Keep the same existing auth secret when renaming.
5. Configure the SMTP variables from `.env.example` on the server / Vercel. The default sender is **mis@immaculada.edu.ph** (a period, not a comma). Confirm this address with your institution. For another email provider, use its SMTP host and port. Port 465 uses implicit TLS; other ports require STARTTLS.
6. SMTP_USER must have permission to send as SMTP_FROM_EMAIL. Use an administrator-approved SMTP credential/app password. Do not place credentials in source control or send them in chat. A Workspace account may require an approved relay or app-password policy; consult your institution’s email administrator.
7. Set NEXT_PUBLIC_APP_URL to your production URL and redeploy.

## Behavior
- Dashboard and employee history retrieve all database pages, including records beyond Supabase’s per-query row cap. UI pagination remains available. No ticket is deleted or archived by this change.
- Monthly reports include all resolved online and walk-in tickets, using Philippine time for month selection.
- MIS staff can enter completed walk-in assistance from the report page, including actual completion date, requester email, technician and action taken. Entries appear in resolved history and the selected completion month. A past date is supported; future dates are rejected.
- Online submissions send acknowledgement receipts; walk-ins send completed-assistance receipts. A receipt does not imply resolution for an online ticket.
- Email failure never removes the saved ticket. MIS can click Send receipt in the dashboard or report for NOT_SENT/FAILED receipts. SENT means accepted by the SMTP server, not guaranteed inbox delivery. Existing tickets start NOT_SENT and are not automatically emailed in bulk.
- SENDING prevents concurrent duplicate sends. If a server process stops mid-send, an administrator must check SMTP logs before resetting that record’s receipt_status to FAILED for retry.
- Walk-in ownership follows the existing reporter_email matching: an institutional Google user sees a walk-in record when its email matches their account. Verify the email before saving.
- Full-history polling retains the current five-second behavior. For very large datasets, server-side pagination plus separate full report/count queries is a future performance improvement.

## Validation checklist after deployment
- Check an older ticket beyond the latest 200 appears in history and its completion month report.
- Add one walk-in in a past month and verify the correct report and employee history.
- Submit an online ticket and verify an acknowledgement from the configured sender.
- Test a failed SMTP setting: ticket stays saved, FAILED appears, and retry works after correcting settings.
- Check an unauthenticated request cannot create manual entries or retry receipts.

No live institutional email was sent during development. SMTP and database integration must be verified after configuring credentials and applying the migration.

## Development checks
`npm test`: 7 behavior checks using mocked database and SMTP (no real emails).
`npx tsc --noEmit` and `npm run build -- --webpack`: type checking and production build.
