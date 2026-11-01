# Validation — November 1, 2026

Passed on the updated source:

- `npm test`: 14 behavior tests, covering login configuration, session validation, complete history, unchanged-history 304 responses, threaded email payloads, duplicate protection, known/uncertain SMTP failures, manual entries, stale-update handling and logout subscription revocation.
- `npm run test:db`: embedded PostgreSQL integration test covering migration reapplication, allowed/rejected status transitions, stable completion timestamps, audit/outbox rollback, email claim ordering, expired lease recovery, privilege restrictions, revision changes and legacy email fallback.
- `npm run test:ui`: 2 Chromium browser scenarios covering looping audio state for two pending tickets, stopping after the final acceptance, hidden receipt labels, failed-poll/recovery messaging and tracking-page recovery.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build -- --webpack`: passed.

The browser tests use synthetic tickets and an instrumented audio player. They verify play/loop/pause behavior, not actual speaker output or browser audio permission on a real staff computer. Browser binaries were supplied locally for this environment; standard installations can use `npx playwright install chromium`.

Database tests run PostgreSQL through PGlite locally, not against the institution's Supabase database. Email delivery is mocked; no real institutional email was sent. SMTP inbox threading, Google OAuth, Web Push delivery and scheduler execution must be checked after configuring the real deployment, following UPDATE_SETUP.md.
