# MIS Helpdesk MVP

A deployable school IT support ticketing system built with Next.js, TypeScript, Vercel, and Supabase PostgreSQL.

## Included
- Public employee support-request form
- Unique ticket number and private tracking link
- MIS staff login
- Dashboard with Pending, Accepted, In Progress, Resolved, and Cancelled statuses
- Custom browser notification sound upload and volume control
- Browser desktop notification for new tickets
- Assignment and resolution notes
- 5-second live polling suitable for an MVP

## Setup
1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Use a Supabase **secret key** only in `SUPABASE_SECRET_KEY`. Never prefix it with `NEXT_PUBLIC_`.
5. Run:
   ```bash
   npm install
   npm run dev
   ```
6. Open `http://localhost:3000` for the employee form and `/mis/login` for MIS staff.

## Deploy to Vercel
1. Push this folder to GitHub.
2. Import the repository into Vercel.
3. Add all variables from `.env.example` under Project Settings → Environment Variables.
4. Set `NEXT_PUBLIC_APP_URL` to your final production URL, such as `https://mis-helpdesk-school.vercel.app`.
5. Deploy.

## Important production notes
- Replace the single environment-based MIS login with Supabase Auth and staff roles when multiple MIS staff accounts are needed.
- Add email delivery (Resend or school SMTP) for updates when the employee closes the tracking page.
- The chosen custom alert audio is stored in the MIS browser's localStorage. Each MIS computer can choose its own sound.
- Browsers require a user interaction before audio and notification permissions work. Click **Enable/Test Sound** once after opening the dashboard.
