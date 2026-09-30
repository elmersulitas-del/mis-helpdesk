const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name), process: { env: { SMTP_HOST: 'test.invalid', SMTP_USER: 'mis@immaculada.edu.ph', SMTP_PASSWORD: 'fake', NEXT_PUBLIC_APP_URL: 'https://test.invalid' } }, Intl, Date, console });
  return module.exports;
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
function receiptFixture(fail = false) {
  let status = 'NOT_SENT', sent = 0, mail;
  const sb = { from() { let update; const q = { update(value) { update = value; return q; }, eq() { if (update.receipt_status !== 'SENDING') status = update.receipt_status; return q; }, in() { return q; }, select() { return q; }, async maybeSingle() { if (status === 'SENT' || status === 'SENDING') return { data: null }; status = 'SENDING'; return { data: { id: '1' } }; } }; return q; } };
  const { deliverReceipt } = load('lib/email-receipts.ts', { '@/lib/supabase-admin': { getSupabaseAdmin: () => sb }, nodemailer: { createTransport: () => ({ async sendMail(value) { if (fail) throw Error('SMTP failed'); sent++; mail = value; return { accepted: ['requester@test.invalid'] }; } }) } });
  const ticket = { id: '1', source: 'WALK_IN', reporter_email: 'requester@test.invalid', reporter_name: 'Test', ticket_number: 'MIS-TEST', department: 'IT', location: 'Office', category: 'Software', subject: 'Help', description: 'Issue', status: 'RESOLVED', created_at: '2026-09-30T10:00:00Z', resolved_at: '2026-09-30T10:00:00Z', resolution_notes: 'Fixed', assigned_to: 'Tech', public_token: 'token' };
  return { deliverReceipt, ticket, state: () => ({ status, sent, mail }) };
}
test('walk-in receipt uses institutional sender, action taken and duplicate protection', async () => {
  const f = receiptFixture(); assert.equal((await f.deliverReceipt(f.ticket)).status, 'SENT');
  assert.equal(f.state().mail.from.address, 'mis@immaculada.edu.ph');
  assert.match(f.state().mail.text, /Action taken: Fixed/);
  await f.deliverReceipt({ ...f.ticket, receipt_status: 'SENT' }); assert.equal(f.state().sent, 1);
});
test('SMTP failure marks receipt FAILED without deleting the ticket', async () => {
  const f = receiptFixture(true); assert.equal((await f.deliverReceipt(f.ticket)).status, 'FAILED'); assert.equal(f.state().status, 'FAILED');
});
test('manual entry requires MIS login; future dates rejected; valid entry is resolved walk-in', async () => {
  let authenticated = false, saved;
  const route = load('app/api/manual-accomplishments/route.ts', {
    '@/lib/auth': { isMisAuthenticated: async () => authenticated },
    '@/lib/supabase-admin': { getSupabaseAdmin: () => ({ from: () => ({ insert(value) { saved = value; return this; }, select() { return this; }, async single() { return { data: { id: '1', ...saved } }; } }) }) },
    '@/lib/email-receipts': { deliverReceipt: async () => ({ status: 'FAILED', message: 'Saved, email failed.' }) },
  });
  const body = { reporter_name: 'Person', reporter_email: 'Person@test.invalid', department: 'IT', location: 'Office', category: 'Network', subject: 'Help', description: 'Internet issue', assigned_to: 'Tech', resolution_notes: 'Fixed', resolved_at: '2020-01-01T00:00:00Z' };
  const request = value => ({ json: async () => value });
  assert.equal((await route.POST(request(body))).status, 401);
  authenticated = true;
  assert.equal((await route.POST(request({ ...body, resolved_at: '2099-01-01T00:00:00Z' }))).status, 400);
  const result = await route.POST(request(body)); assert.equal(result.status, 201);
  assert.equal(saved.source, 'WALK_IN'); assert.equal(saved.status, 'RESOLVED');
  assert.equal(saved.reporter_email, 'person@test.invalid');
  assert.equal((await result.json()).receipt_status, 'FAILED');
});

test('online receipt acknowledges submission rather than completed assistance', async () => {
  const f = receiptFixture(); await f.deliverReceipt({ ...f.ticket, source: 'ONLINE', status: 'PENDING' });
  assert.match(f.state().mail.text, /does not mean the concern has been resolved/);
  assert.doesNotMatch(f.state().mail.text, /Action taken:/);
});
test('Philippine month includes UTC evening in the next month', () => {
  const source = fs.readFileSync('components/MisDashboard.tsx', 'utf8');
  const helper = source.slice(source.indexOf('function philippineMonth'), source.indexOf('function monthValue'));
  const code = ts.transpileModule(helper + "\nmodule.exports = philippineMonth;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; vm.runInNewContext(code, { module, Intl, Date });
  assert.equal(module.exports('2026-08-31T16:30:00Z'), '2026-09');
  assert.equal(module.exports('2026-08-31T15:59:00Z'), '2026-08');
});
