# ICC MIS Helpdesk

School helpdesk built with Next.js, TypeScript and Supabase. Includes institutional Google login, employee ticket history and conversations, MIS queue/status updates, looping pending-ticket alerts, Web Push, monthly accomplishment reports, walk-in entries, and automatic threaded resolution emails.

**Start with [UPDATE_SETUP.md](UPDATE_SETUP.md)** for database migrations, configuration, email scheduler, deployment, tests and upgrade details. Both new and existing installations must apply the migrations listed there.

```bash
npm ci
# Configure .env.local from .env.example and apply the documented SQL migrations.
npm run dev
```

Employee portal: `/` · MIS login: `/mis/login`

Do not commit `.env.local` or service credentials. The Supabase admin key is server-only. Database tables have row-level security enabled; protected server routes enforce authorization.
