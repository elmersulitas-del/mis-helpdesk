const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function load(file, mocks, env = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: name => name in mocks ? mocks[name] : require(name), Buffer, process: { env: { ...env, SMTP_HOST: 'test.invalid', SMTP_USER: 'mis@immaculada.edu.ph', SMTP_PASSWORD: 'fake', NEXT_PUBLIC_APP_URL: 'https://test.invalid' } }, Intl, Date, console });
  return loaded.exports;
}
test('history returns all 1250 rows even when the database caps each request at 137', async () => {
  const rows = Array.from({ length: 1250 }, (_, id) => ({ id: String(id), reporter_email: id % 2 ? 'one@test.invalid' : 'two@test.invalid' }));
  const sb = { from() { let email; return { select() { return this; }, lte() { return this; }, order() { return this; }, eq(_key, value) { email = value; return this; }, async range(start, end) { const filtered = email ? rows.filter(r => r.reporter_email === email) : rows; return { data: filtered.slice(start, Math.min(end + 1, start + 137)), error: null }; } }; } };
  const { getTicketHistory } = load('lib/ticket-history.ts', { '@/lib/supabase-admin': { getSupabaseAdmin: () => sb } });
  assert.equal((await getTicketHistory()).length, 1250);
  assert.equal((await getTicketHistory('one@test.invalid')).length, 625);
});
test('history fails rather than returning a silently incomplete list', async () => {
  const query = { select() { return this; }, lte() { return this; }, order() { return this; }, async range() { return { data: null, error: {} }; } };
  const { getTicketHistory } = load('lib/ticket-history.ts', { '@/lib/supabase-admin': { getSupabaseAdmin: () => ({ from: () => query }) } });
  await assert.rejects(getTicketHistory(), /complete ticket history/);
});
test('manual entry requires MIS login; future dates rejected; valid entry is resolved walk-in', async () => {
  let authenticated = false, saved;
  const route = load('app/api/manual-accomplishments/route.ts', {
    '@/lib/auth': { isMisAuthenticated: async () => authenticated },
    '@/lib/supabase-admin': { getSupabaseAdmin: () => ({ from: () => ({ insert(value) { saved = value; return this; }, select() { return this; }, async single() { return { data: { id: '1', ...saved } }; } }) }) },
    '@/lib/email-receipts': { processEmailQueue: async () => ({ sent: 1 }) },
    'next/server': { ...require('next/server'), after: () => {} },
  });
  const body = { reporter_name: 'Person', reporter_email: 'Person@test.invalid', department: 'IT', location: 'Office', category: 'Network', subject: 'Help', description: 'Internet issue', assigned_to: 'Tech', resolution_notes: 'Fixed', resolved_at: '2020-01-01T00:00:00Z' };
  const request = value => ({ json: async () => value });
  assert.equal((await route.POST(request(body))).status, 401);
  authenticated = true;
  assert.equal((await route.POST(request({ ...body, resolved_at: '2099-01-01T00:00:00Z' }))).status, 400);
  const result = await route.POST(request(body)); assert.equal(result.status, 201);
  assert.equal(saved.source, 'WALK_IN'); assert.equal(saved.status, 'RESOLVED');
  assert.equal(saved.reporter_email, 'person@test.invalid');
  assert.match((await result.json()).message, /automatically/);
});

test('Philippine month includes UTC evening in the next month', () => {
  const source = fs.readFileSync('components/MisDashboard.tsx', 'utf8');
  const helper = source.slice(source.indexOf('function philippineMonth'), source.indexOf('function monthValue'));
  const code = ts.transpileModule(helper + "\nmodule.exports = philippineMonth;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} }; vm.runInNewContext(code, { module: loaded, Intl, Date });
  assert.equal(loaded.exports('2026-08-31T16:30:00Z'), '2026-09');
  assert.equal(loaded.exports('2026-08-31T15:59:00Z'), '2026-08');
});
const ticket = { id: '1', source: 'ONLINE', reporter_email: 'requester@test.invalid', reporter_name: 'Test', ticket_number: 'MIS-TEST', department: 'IT', location: 'Office', category: 'Software', subject: 'Help', description: 'Issue', status: 'PENDING', created_at: '2026-09-30T10:00:00Z', resolved_at: '2026-09-30T10:00:00Z', resolution_notes: 'Fixed', assigned_to: 'Tech', public_token: 'token' };
function emailFixture(failure, saveFailure = false) {
  const jobs = [
    { id: 'ack', ticket_id: '1', kind: 'ACKNOWLEDGEMENT', payload: ticket, message_id: '<ack@test.invalid>', subject: 'MIS support request received — MIS-TEST', parent_message_id: null, state: 'QUEUED', attempts: 0, claim_token: 'claim1' },
    { id: 'resolve', ticket_id: '1', kind: 'RESOLUTION', payload: { ...ticket, status: 'RESOLVED' }, message_id: '<resolve@test.invalid>', subject: 'Re: MIS support request received — MIS-TEST', parent_message_id: '<ack@test.invalid>', state: 'QUEUED', attempts: 0, claim_token: 'claim2' },
  ];
  const mails = [];
  const sb = {
    async rpc() {
      const job = jobs.find(j => j.state === 'QUEUED' && (!j.available_at || Date.parse(j.available_at) <= Date.now()) && (!j.parent_message_id || jobs.find(p => p.message_id === j.parent_message_id)?.state === 'SENT'));
      if (!job) return { data: [] };
      job.state = 'SENDING'; job.attempts++;
      return { data: [{ ...job }] };
    },
    from(table) {
      let values, id;
      const query = { update(v) { values = v; return query; }, eq(key, value) { if (key === 'id') id = value; return query; }, then(resolve) {
        if (saveFailure && values.state === 'SENT') return Promise.resolve({ error: {} }).then(resolve);
        if (table === 'ticket_email_jobs') Object.assign(jobs.find(j => j.id === id), values);
        return Promise.resolve({ error: null }).then(resolve);
      } }; return query;
    },
  };
  const lib = load('lib/email-receipts.ts', {
    '@/lib/supabase-admin': { getSupabaseAdmin: () => sb },
    nodemailer: { createTransport: () => ({ async sendMail(mail) { if (failure) throw failure; mails.push(mail); return { accepted: ['requester@test.invalid'] }; } }) },
  });
  return { ...lib, jobs, mails };
}
test('acknowledgement and resolution use one thread, preserve action details, and never resend SENT jobs', async () => {
  const f = emailFixture(); await f.processEmailQueue('1');
  assert.equal(f.mails.length, 2);
  assert.match(f.mails[0].text, /does not mean the concern has been resolved/);
  assert.equal(f.mails[1].inReplyTo, f.mails[0].messageId);
  assert.equal(f.mails[1].references[0], f.mails[0].messageId);
  assert.equal(f.mails[1].subject, `Re: ${f.mails[0].subject}`);
  assert.match(f.mails[1].text, /Action taken: Fixed/);
  assert.match(f.mails[1].text, /Technician: Tech/);
  await f.processEmailQueue('1'); assert.equal(f.mails.length, 2);
});
test('known SMTP failures schedule a retry and block resolution until acknowledgement succeeds', async () => {
  const f = emailFixture(Object.assign(new Error('Auth failed'), { code: 'EAUTH' }));
  await f.processEmailQueue('1');
  assert.equal(f.jobs[0].state, 'QUEUED'); assert.ok(Date.parse(f.jobs[0].available_at) > Date.now());
  assert.equal(f.jobs[1].attempts, 0); assert.equal(f.mails.length, 0);
});
test('uncertain SMTP acceptance requires review instead of duplicate sending', async () => {
  const f = emailFixture(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT', command: 'DATA' }));
  await f.processEmailQueue('1'); assert.equal(f.jobs[0].state, 'REVIEW'); assert.equal(f.jobs[1].attempts, 0);
});
test('database failure after SMTP acceptance cannot cause an automatic duplicate', async () => {
  const f = emailFixture(null, true); await f.processEmailQueue('1');
  assert.equal(f.jobs[0].state, 'REVIEW'); assert.equal(f.mails.length, 1);
});
test('walk-in receipt contains completed assistance, legacy resolution does not invent parent headers', () => {
  const f = emailFixture();
  const walkIn = f.emailContent({ ...f.jobs[0], payload: { ...ticket, source: 'WALK_IN', status: 'RESOLVED' } });
  assert.match(walkIn.text, /completed walk-in assistance/); assert.match(walkIn.text, /Action taken: Fixed/);
  const legacy = f.emailContent({ ...f.jobs[1], parent_message_id: null }); assert.equal(legacy.inReplyTo, undefined);
});
test('missing admin configuration and empty JSON never issue a login session', async () => {
  let sessions = 0;
  const mocks = { '@/lib/auth': { makeSession: () => { sessions++; return 'session'; }, sessionCookie: { name: 'mis_session', maxAge: 60 } } };
  const unconfigured = load('app/api/auth/login/route.ts', mocks, { AUTH_SECRET: 'test' });
  assert.equal((await unconfigured.POST({ json: async () => ({}) })).status, 503);
  const configured = load('app/api/auth/login/route.ts', mocks, { AUTH_SECRET: 'test', MIS_ADMIN_USERNAME: 'admin', MIS_ADMIN_PASSWORD: 'test-password' });
  assert.equal((await configured.POST({ json: async () => ({}) })).status, 401);
  assert.equal((await configured.POST({ json: async () => ({ username: 'admin', password: 'wrong' }) })).status, 401);
  assert.equal(sessions, 0);
  const result = await configured.POST({ json: async () => ({ username: 'admin', password: 'test-password' }) });
  assert.equal(result.status, 200); assert.equal(sessions, 1);
});
test('sessions validate shape, signature and expiry; malformed unicode signatures do not throw', () => {
  const auth = load('lib/auth.ts', { 'next/headers': {} }, { AUTH_SECRET: 'test', MIS_ADMIN_USERNAME: 'admin' });
  const token = auth.makeSession('admin');
  assert.equal(auth.verifySession(token), true);
  assert.equal(auth.verifySession(token + '.extra'), false);
  assert.equal(auth.verifySession(token.split('.')[0] + '.' + 'é'.repeat(43)), false);
  assert.equal(auth.verifySession(auth.makeSession('different-user')), false);
  const { createHmac } = require('crypto');
  const payload = Buffer.from(JSON.stringify({ username: 'admin', nonce: 'test', exp: 1 })).toString('base64url');
  assert.equal(auth.verifySession(`${payload}.${createHmac('sha256', 'test').update(payload).digest('base64url')}`), false);
});
test('unchanged history returns 304 without fetching ticket rows', async () => {
  const lib = load('lib/ticket-history.ts', { '@/lib/supabase-admin': { getSupabaseAdmin: () => ({ rpc: async () => ({ data: 'revision' }), from: () => { throw Error('Should not read rows'); } }) } });
  const response = await lib.ticketHistoryResponse(new Request('https://test.invalid', { headers: { 'if-none-match': '"revision"' } }));
  assert.equal(response.status, 304);
});
test('ticket update requires expected status and maps stale updates to 409', async () => {
  let called = 0;
  const route = load('app/api/tickets/[id]/route.ts', {
    '@/lib/auth': { getMisSession: async () => ({ username: 'admin' }) },
    '@/lib/supabase-admin': { getSupabaseAdmin: () => ({ rpc: async () => { called++; return { error: { code: '40001' } }; } }) },
    '@/lib/email-receipts': { processEmailQueue: async () => ({ sent: 0 }) },
  });
  const params = { params: Promise.resolve({ id: 'b733b9d9-f343-42b6-8538-11978b7a57f5' }) };
  const body = { status: 'RESOLVED', assigned_to: 'Tech', resolution_notes: 'Fixed' };
  assert.equal((await route.PATCH({ json: async () => body }, params)).status, 400); assert.equal(called, 0);
  assert.equal((await route.PATCH({ json: async () => ({ ...body, expected_status: 'PENDING' }) }, params)).status, 409);
});
test('logout revokes only current session subscriptions and keeps session on revocation failure', async () => {
  let deletedKey, fail = false;
  const route = load('app/api/auth/logout/route.ts', {
    '@/lib/auth': { getMisSession: async () => ({ key: 'current-session' }), sessionCookie: { name: 'mis_session' } },
    '@/lib/supabase-admin': { getSupabaseAdmin: () => ({ from: () => ({ delete: () => ({ eq: async (column, key) => { assert.equal(column, 'session_key'); deletedKey = key; return { error: fail ? {} : null }; } }) }) }) },
  });
  const ok = await route.POST(); assert.equal(ok.status, 200); assert.equal(deletedKey, 'current-session');
  assert.match(ok.headers.get('set-cookie'), /Max-Age=0/);
  fail = true; const blocked = await route.POST(); assert.equal(blocked.status, 503); assert.equal(blocked.headers.get('set-cookie'), null);
});
