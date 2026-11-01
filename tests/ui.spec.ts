import { test, expect } from '@playwright/test';
import type { Ticket } from '../lib/types';
declare global { interface Window { __audio: { playing: boolean; loop: boolean; volume: number }[] } }
const first: Ticket = {
  id: 'b733b9d9-f343-42b6-8538-11978b7a57f5', ticket_number: 'MIS-TEST-ONE', public_token: 'test-token',
  reporter_name: 'Test Employee', reporter_email: 'test@example.invalid', contact_number: null,
  department: 'IT', location: 'Test room', category: 'Network', subject: 'First test request', description: 'Test concern',
  priority: 'MEDIUM', status: 'PENDING', assigned_to: null, resolution_notes: null,
  created_at: '2026-11-01T01:00:00Z', updated_at: '2026-11-01T01:00:00Z', accepted_at: null, started_at: null, resolved_at: null,
  receipt_status: 'SENT',
};
test('sound loops only while pending tickets remain, admin hides receipts, and failed polls show an error', async ({ page, context }) => {
  let rows: Ticket[] = [{ ...first }, { ...first, id: 'b733b9d9-f343-42b6-8538-11978b7a57f6', ticket_number: 'MIS-TEST-TWO', subject: 'Second test request' }];
  let fail = false;
  await page.addInitScript(() => {
    window.__audio = [];
    class FakeAudio {
      playing = false; loop = false; volume = 1; currentTime = 0;
      constructor() { window.__audio.push(this); }
      play() { this.playing = true; return Promise.resolve(); }
      pause() { this.playing = false; }
    }
    Object.defineProperty(window, 'Audio', { value: FakeAudio });
    Object.defineProperty(window, 'Notification', { value: { permission: 'denied', requestPermission: async () => 'denied' } });
  });
  page.on('dialog', dialog => dialog.type() === 'prompt' ? dialog.accept('Test Technician') : dialog.accept());
  await page.route('**/api/tickets', route => route.fulfill({ status: fail ? 500 : 200, json: fail ? { error: 'Unavailable' } : rows }));
  await page.route('**/api/tickets/*', async route => {
    const body = route.request().postDataJSON();
    const id = route.request().url().split('/').pop();
    const index = rows.findIndex(row => row.id === id);
    expect(body.expected_status).toBe(rows[index].status);
    rows = rows.map(row => row.id === id ? { ...row, status: body.status, assigned_to: body.assigned_to } : row);
    await route.fulfill({ json: rows[index] });
  });
  const login = await context.request.post('/api/auth/login', { data: { username: 'test-admin', password: 'test-only-password' } });
  expect(login.status()).toBe(200);
  await page.goto('/mis');
  await expect(page.getByRole('button', { name: 'Accept request' })).toHaveCount(2);
  await expect(page.getByText(/Receipt:/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Enable alerts', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__audio.some(audio => audio.playing && audio.loop))).toBe(true);
  await page.getByRole('button', { name: 'Accept request' }).first().click();
  await expect(page.getByRole('button', { name: 'Accept request' })).toHaveCount(1);
  expect(await page.evaluate(() => window.__audio.some(audio => audio.playing))).toBe(true);
  await page.getByRole('button', { name: 'Accept request' }).click();
  await expect(page.getByRole('button', { name: 'Accept request' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__audio.some(audio => audio.playing))).toBe(false);
  fail = true;
  await expect(page.getByText('Connection interrupted')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to refresh' })).toContainText('Unable to refresh');
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('System online', { exact: true })).toBeVisible();
});

test('tracking page recovers after a temporary error', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/track/*', route => route.fulfill(++calls === 1 ? { status: 503, json: { error: 'Temporary failure' } } : { json: first }));
  await page.goto('/track/test-token');
  await expect(page.getByText('Temporary failure', { exact: true })).toBeVisible();
  await expect(page.getByText('MIS-TEST-ONE', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Temporary failure', { exact: true })).toHaveCount(0);
});
