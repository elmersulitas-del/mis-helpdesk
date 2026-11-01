const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('real PostgreSQL workflow: migrations, transitions, atomic audit, email ordering, retry leases and grants', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    // gen_random_uuid is built in. PGlite does not bundle the pgcrypto extension.
    await db.exec(fs.readFileSync('supabase/schema.sql', 'utf8').replace('create extension if not exists pgcrypto;', ''));
    await db.exec(fs.readFileSync('supabase/migrations/20260930_walk_in_receipts.sql', 'utf8'));
    const migration = fs.readFileSync('supabase/migrations/20261101_helpdesk_reliability.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration); // upgrade is safe to rerun
    const row = (await db.query(`insert into public.tickets(ticket_number,public_token,reporter_name,reporter_email,department,location,category,subject,description)
      values('MIS-TEST','token','Person','person@test.invalid','IT','Room','Network','Help','No internet') returning *`)).rows[0];
    const jobs = () => db.query('select * from public.ticket_email_jobs order by created_at,id');
    assert.equal((await jobs()).rows.length, 1);
    const transition = (expected, status, notes = 'Fixed') => db.query('select * from public.transition_ticket($1,$2,$3,$4,$5,$6)', [row.id, expected, status, 'Tech', notes, 'admin']);
    await assert.rejects(transition('PENDING', 'IN_PROGRESS'), /Invalid status/);
    await assert.rejects(transition('PENDING', 'RESOLVED', ''), /Resolution notes/);
    await transition('PENDING', 'ACCEPTED');
    await assert.rejects(transition('PENDING', 'ACCEPTED'), /Ticket changed/);
    await transition('ACCEPTED', 'IN_PROGRESS');
    await transition('IN_PROGRESS', 'RESOLVED');
    const resolved = (await db.query('select * from public.tickets where id=$1', [row.id])).rows[0];
    await assert.rejects(transition('RESOLVED', 'RESOLVED'), /Invalid status/);
    await assert.rejects(transition('RESOLVED', 'ACCEPTED'), /Invalid status/);
    assert.equal(new Date((await db.query('select resolved_at from public.tickets where id=$1', [row.id])).rows[0].resolved_at).getTime(), new Date(resolved.resolved_at).getTime());
    const history = (await db.query('select * from public.ticket_updates')).rows;
    assert.equal(history.length, 3); assert.ok(history.every(h => h.actor === 'admin'));
    const queued = (await jobs()).rows;
    assert.equal(queued.length, 2);
    const ack = queued.find(j => j.kind === 'ACKNOWLEDGEMENT');
    const resolution = queued.find(j => j.kind === 'RESOLUTION');
    assert.equal(ack.payload.status, 'PENDING');
    assert.equal(resolution.parent_message_id, ack.message_id);
    assert.equal(resolution.subject, 'Re: ' + ack.subject);
    let claimed = (await db.query('select * from public.claim_ticket_email($1)', [row.id])).rows;
    assert.equal(claimed.length, 1); assert.equal(claimed[0].id, ack.id);
    assert.equal((await db.query('select * from public.claim_ticket_email($1)', [row.id])).rows.length, 0);
    await db.query("update public.ticket_email_jobs set state='SENT' where id=$1", [ack.id]);
    claimed = (await db.query('select * from public.claim_ticket_email($1)', [row.id])).rows;
    assert.equal(claimed[0].id, resolution.id);
    await db.query("update public.ticket_email_jobs set lease_until=now()-interval '1 minute' where id=$1", [resolution.id]);
    await db.query('select * from public.claim_ticket_email($1)', [row.id]);
    assert.equal((await db.query('select state from public.ticket_email_jobs where id=$1',[resolution.id])).rows[0].state, 'REVIEW');
    // Audit failure must roll back status AND outbox job, proving all three are transactional.
    const second = (await db.query(`insert into public.tickets(ticket_number,public_token,reporter_name,reporter_email,department,location,category,subject,description)
      values('MIS-ROLLBACK','token2','Person','person@test.invalid','IT','Room','Network','Help','Issue') returning id`)).rows[0];
    await db.exec(`alter table public.ticket_updates add constraint reject_actor check (actor <> 'reject');`);
    await assert.rejects(db.query('select public.transition_ticket($1,$2,$3,$4,$5,$6)', [second.id,'PENDING','RESOLVED','Tech','Fixed','reject']), /reject_actor/);
    assert.equal((await db.query('select status from public.tickets where id=$1',[second.id])).rows[0].status, 'PENDING');
    assert.equal((await db.query("select count(*)::int as n from public.ticket_email_jobs where ticket_id=$1 and kind='RESOLUTION'",[second.id])).rows[0].n, 0);
    const permissions = (await db.query(`select has_function_privilege('anon','public.transition_ticket(uuid,public.ticket_status,public.ticket_status,text,text,text)','EXECUTE') as anon,
      has_function_privilege('authenticated','public.claim_ticket_email(uuid)','EXECUTE') as employee,
      has_function_privilege('service_role','public.claim_ticket_email(uuid)','EXECUTE') as server`)).rows[0];
    assert.deepEqual(permissions, { anon: false, employee: false, server: true });
    const before = (await db.query('select public.ticket_history_revision(null) as revision')).rows[0].revision;
    await db.query("update public.tickets set description='Updated' where id=$1",[second.id]);
    const after = (await db.query('select public.ticket_history_revision(null) as revision')).rows[0].revision;
    assert.notEqual(before, after);
    // Legacy sent email: do not pretend to know its original Message-ID or resend it.
    await db.query('delete from public.ticket_email_jobs where ticket_id=$1',[second.id]);
    await db.query("update public.tickets set receipt_status='SENT' where id=$1",[second.id]);
    await db.query('select public.transition_ticket($1,$2,$3,$4,$5,$6)', [second.id,'PENDING','RESOLVED','Tech','Fixed','admin']);
    const legacy = (await db.query('select * from public.ticket_email_jobs where ticket_id=$1',[second.id])).rows;
    assert.equal(legacy.length, 1); assert.equal(legacy[0].kind, 'RESOLUTION'); assert.equal(legacy[0].parent_message_id, null);
  } finally { await db.close(); }
});
