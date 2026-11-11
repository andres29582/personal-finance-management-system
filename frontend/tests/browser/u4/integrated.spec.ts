import { test, expect, Page } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const backendRequire = createRequire(path.resolve(__dirname, '../../../../backendnest/package.json'));
const { Client } = backendRequire('pg');
const root = path.resolve(__dirname, '../../../../.tmp/stage2-u4-browser-20261011-bounded4');
const evidence: Record<string, unknown>[] = [];
let db: any;
const password = 'U4-disposable-password-42!';
test.beforeAll(async () => {
  db = new Client({ host: '127.0.0.1', port: 55434, database: 'finance_e2e_u4_browser',
    user: 'finance_e2e_u4_browser_owner', password: 'disposable-local-only' });
  await db.connect();
  const { rows } = await db.query(`SELECT current_database() AS database,current_user AS role,
    shobj_description(d.oid,'pg_database') AS marker,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls
    FROM pg_database d JOIN pg_roles r ON r.rolname=current_user WHERE d.datname=current_database()`);
  expect(rows[0]).toEqual({ database: 'finance_e2e_u4_browser', role: 'finance_e2e_u4_browser_owner',
    marker: 'finance-e2e-disposable', rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false });
  evidence.push({ confinement: rows[0] });
});
test.afterAll(async ({}, testInfo) => {
  await db?.end();
  fs.writeFileSync(path.join(root, `case-evidence-worker-${testInfo.workerIndex}.json`), JSON.stringify(evidence, null, 2), { flag: 'wx' });
});
async function row(sid: string) {
  return (await db.query(`SELECT id,authenticated_at,last_activity_at,absolute_expires_at,refresh_expires_at,
    idle_timeout_seconds,policy_version,revoked_at,terminal_reason FROM auth_session WHERE id=$1`, [sid])).rows[0];
}
async function login(page: Page, index: number) {
  await page.goto('/login');
  await page.waitForFunction(() => !!window.u4);
  await page.getByLabel('E-mail', { exact: true }).fill(`u4-${index}@example.com`);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByTestId('u4-protected')).toBeVisible();
  const identity = await page.evaluate(() => window.u4.identity());
  const initial = await row(identity.sid);
  expect(initial.idle_timeout_seconds).toBe(900);
  expect(initial.policy_version).toBe(1);
  expect(+initial.absolute_expires_at - +initial.authenticated_at).toBe(43200000);
  expect(identity.authority?.absoluteExpiresAt).toBe(initial.absolute_expires_at.toISOString());
  expect(await page.evaluate(() => isSecureContext && !!navigator.locks && typeof BroadcastChannel === 'function')).toBe(true);
  return { identity, initial };
}
async function stats(page: Page) {
  return page.request.get('/__stats').then(response => response.json());
}
test('real reads, polling and refresh do not renew idle authority', async ({ page }) => {
  const { identity, initial } = await login(page, 1);
  for (let index = 0; index < 3; index++) {
    expect((await page.evaluate(() => window.u4.request('get', '/auth/session'))).ok).toBe(true);
    expect((await page.evaluate(() => window.u4.request('get', '/users/me'))).ok).toBe(true);
  }
  await page.evaluate(() => window.u4.refresh());
  const after = await row(identity.sid);
  expect(+after.last_activity_at).toBe(+initial.last_activity_at);
  expect(+after.absolute_expires_at).toBe(+initial.absolute_expires_at);
  await expect(page.getByTestId('u4-protected')).toBeVisible();
  evidence.push({ case: 1, sid: identity.sid, initial, after });
});
test('real eligible profile mutation advances activity without extending absolute deadline', async ({ page }) => {
  const { identity, initial } = await login(page, 2);
  await db.query("UPDATE auth_session SET last_activity_at=authenticated_at WHERE id=$1", [identity.sid]);
  const response = await page.evaluate(() => window.u4.request('patch', '/users/me', { nome: 'U4 mutation committed' }));
  expect(response.ok).toBe(true);
  const after = await row(identity.sid);
  expect(+after.last_activity_at).toBeGreaterThan(+initial.authenticated_at);
  expect(+after.absolute_expires_at).toBe(+initial.absolute_expires_at);
  const user = (await db.query('SELECT nome FROM usuario WHERE email=$1', ['u4-2@example.com'])).rows[0];
  expect(user.nome).toBe('U4 mutation committed');
  const fresh = await page.evaluate(() => window.u4.identity());
  expect(fresh.authority?.absoluteExpiresAt).toBe(after.absolute_expires_at.toISOString());
  evidence.push({ case: 2, sid: identity.sid, after, user });
});
test('backdated 900-second idle deadline rejects still-valid JWT and hides protected content', async ({ page }) => {
  const { identity } = await login(page, 3);
  expect(identity.exp * 1000).toBeGreaterThan(Date.now());
  await db.query(`WITH t AS MATERIALIZED (SELECT clock_timestamp() AS n)
    UPDATE auth_session SET authenticated_at=t.n-interval '1000 seconds',
    last_activity_at=t.n-interval '901 seconds',
    absolute_expires_at=t.n+interval '42200 seconds',
    refresh_expires_at=LEAST(auth_session.refresh_expires_at,t.n+interval '42200 seconds')
    FROM t WHERE id=$1`, [identity.sid]);
  const response = await page.evaluate(() => window.u4.request('get', '/auth/session'));
  expect(response).toMatchObject({ ok: false, status: 401, code: 'AUTH_SESSION_IDLE_EXPIRED' });
  await expect(page.getByTestId('u4-protected')).toHaveCount(0);
  await expect(page).toHaveURL(/\/login$/);
  const after = await row(identity.sid);
  expect(after.revoked_at).not.toBeNull();
  expect(after.terminal_reason).toBe('AUTH_SESSION_IDLE_EXPIRED');
  evidence.push({ case: 3, boundary: 'owned DB backdating, not elapsed 15-minute wait', response, after });
});
test('backdated 43200-second absolute deadline rejects despite recent activity', async ({ page }) => {
  const { identity } = await login(page, 4);
  expect(identity.exp * 1000).toBeGreaterThan(Date.now());
  await db.query(`WITH t AS MATERIALIZED (SELECT clock_timestamp() AS n)
    UPDATE auth_session SET authenticated_at=t.n-interval '43201 seconds',
    last_activity_at=t.n-interval '2 seconds',
    absolute_expires_at=t.n-interval '1 second',
    refresh_expires_at=LEAST(auth_session.refresh_expires_at,t.n-interval '1 second')
    FROM t WHERE id=$1`, [identity.sid]);
  const response = await page.evaluate(() => window.u4.request('get', '/auth/session'));
  expect(response).toMatchObject({ ok: false, status: 401, code: 'AUTH_SESSION_ABSOLUTE_EXPIRED' });
  await expect(page.getByTestId('u4-protected')).toHaveCount(0);
  const after = await row(identity.sid);
  expect(after.terminal_reason).toBe('AUTH_SESSION_ABSOLUTE_EXPIRED');
  expect(+after.absolute_expires_at - +after.authenticated_at).toBe(43200000);
  evidence.push({ case: 4, boundary: 'owned DB backdating, not elapsed 12-hour wait', response, after });
});
test('held real terminal A response cannot clear subsequently installed real login B', async ({ page }) => {
  const { identity } = await login(page, 5);
  await db.query(`UPDATE auth_session SET authenticated_at=clock_timestamp()-interval '1000 seconds',
    last_activity_at=clock_timestamp()-interval '901 seconds' WHERE id=$1`, [identity.sid]);
  let release!: () => void, observed!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const arrived = new Promise<void>(resolve => { observed = resolve; });
  let once = true;
  await page.route('**/api/auth/session', async route => {
    if (!once) return route.continue();
    once = false;
    const response = await route.fetch();
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe('AUTH_SESSION_IDLE_EXPIRED');
    observed();
    await barrier;
    await route.fulfill({ response });
  });
  const pending = page.evaluate(() => window.u4.request('get', '/auth/session'));
  try {
    await arrived;
    expect(await page.evaluate(password => window.u4.replaceLogin('u4-8@example.com', password), password)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.u4.identity().then(value => value.sid))).not.toBe(identity.sid);
    release();
    const rejected = await pending;
    expect(rejected.failure).toBe('stale');
    await expect(page.getByTestId('u4-protected')).toBeVisible();
    const current = await page.evaluate(() => window.u4.identity());
    expect(current.signedOut).toBe(false);
    expect((await row(current.sid)).revoked_at).toBeNull();
    evidence.push({ case: 5, oldSid: identity.sid, current, rejected });
  } finally { release(); await pending; await page.unroute('**/api/auth/session'); }
});
test('actual browser visibility resume keeps protected render hidden until real confirmation', async ({ page, context }) => {
  await login(page, 6);
  const other = await context.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  const hidden = await page.evaluate(() => document.hidden);
  if (!hidden) {
    evidence.push({ case: 6, supported: false, reason: 'Headless Edge did not expose real background visibility' });
    test.skip(true, 'Actual tab visibility unsupported; no synthetic lifecycle substitution');
    return;
  }
  await expect(page.getByTestId('u4-protected')).toHaveCount(0);
  let release!: () => void, observed!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const arrived = new Promise<void>(resolve => { observed = resolve; });
  await page.route('**/api/auth/session', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    observed(); await barrier; await route.fulfill({ response });
  });
  try {
    await page.bringToFront();
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
    await arrived;
    await expect(page.getByTestId('u4-protected')).toHaveCount(0);
    release();
    await expect(page.getByTestId('u4-protected')).toBeVisible();
    evidence.push({ case: 6, supported: true, actualHiddenObserved: hidden, heldRealServerResponse: true });
  } finally { release(); await page.unroute('**/api/auth/session'); await other.close(); }
});
test('injected generic post-commit 401 does not replay mutation or refresh', async ({ page }) => {
  const { identity } = await login(page, 7);
  const before = await stats(page);
  await page.route('**/api/users/me', async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const real = await route.fetch();
    expect(real.status()).toBe(200);
    await route.fulfill({ status: 401, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Injected transport response ambiguity' } }) });
  });
  try {
    const response = await page.evaluate(() => window.u4.request('patch', '/users/me', { nome: 'U4 single committed effect' }));
    expect(response).toMatchObject({ ok: false, failure: 'unavailable' });
    const after = await stats(page);
    expect((after['PATCH /users/me'] ?? 0) - (before['PATCH /users/me'] ?? 0)).toBe(1);
    expect((after['POST /auth/refresh'] ?? 0) - (before['POST /auth/refresh'] ?? 0)).toBe(0);
    const user = (await db.query('SELECT nome FROM usuario WHERE email=$1', ['u4-7@example.com'])).rows[0];
    expect(user.nome).toBe('U4 single committed effect');
    await expect(page.getByTestId('u4-protected')).toHaveCount(0);
    const session = await row(identity.sid);
    evidence.push({ case: 7, injectedFault: 'Only client-facing response replaced after actual server commit', response,
      mutationRequests: 1, refreshRequests: 0, user, session });
  } finally { await page.unroute('**/api/users/me'); }
});
