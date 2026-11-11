export {};
const path = require('node:path'),
  fs = require('node:fs');
const { test, expect } = require(
  path.resolve(__dirname, '../../../frontend/node_modules/@playwright/test'),
);
const { Client } = require('../../node_modules/pg');
const { identity: assertDatabaseIdentity } = require('./contract.cjs');
const password = 'U4-disposable-password-42!';
const root = process.env.SESSION_HARNESS_ARTIFACTS;
const evidence: any = {
  status: 'NOT RUN',
  cases: [],
  diagnostics: [],
  scope:
    'Real SessionsScreen/RootLayout/LoginScreen, actual HTTP and owned SQL; no financial dashboard, native lifecycle, BFCache or stale-global A/B proof.',
};
let db: any;

test.beforeEach(async ({ page }: any, info: any) => {
  const diagnostic: any = {
    test: info.title,
    phases: [],
    http: [],
    frames: [],
    lifecycle: [],
  };
  evidence.diagnostics.push(diagnostic);
  (page as any).__u5Diagnostic = diagnostic;
  await page.exposeFunction('__u5LifecycleEvent', (event: any) =>
    diagnostic.lifecycle.push(event),
  );
  await page.addInitScript(() => {
    const record = (type: string) =>
      void (window as any).__u5LifecycleEvent({
        type,
        at: Date.now(),
        path: location.pathname,
        visibility: document.visibilityState,
      });
    window.addEventListener('pageshow', () => record('pageshow'));
    window.addEventListener('pagehide', () => record('pagehide'));
    document.addEventListener('visibilitychange', () =>
      record('visibilitychange'),
    );
  });
  const safeRequest = (request: any) => ({
    method: request.method(),
    path: new URL(request.url()).pathname,
  });
  page.on('response', (response: any) => {
    if (new URL(response.url()).pathname.startsWith('/api/'))
      diagnostic.http.push({
        ...safeRequest(response.request()),
        at: Date.now(),
        status: response.status(),
      });
  });
  page.on('requestfailed', (request: any) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      diagnostic.http.push({
        ...safeRequest(request),
        at: Date.now(),
        transportFailed: true,
      });
  });
  page.on('framenavigated', (frame: any) => {
    if (frame === page.mainFrame())
      diagnostic.frames.push({
        path: new URL(frame.url()).pathname,
        at: Date.now(),
      });
  });
});
test.afterEach(async ({ page }: any, info: any) => {
  await observe(page, 'finally-' + info.status);
});
async function observe(page: any, phase: string) {
  const diagnostic = page.__u5Diagnostic;
  if (!diagnostic) return;
  try {
    const state = await page.evaluate(async () => {
      const identity = (window as any).u4
        ? await (window as any).u4.identity()
        : null;
      return {
        path: location.pathname,
        identity,
        protectedVisible:
          !!document.querySelector('[data-testid="u4-protected"]') ||
          document.body.innerText.includes('Sessao atual'),
        unavailableVisible: document.body.innerText.includes(
          'Seus dados permanecem ocultos.',
        ),
        passwordInputPresent: !!document.querySelector(
          'input[aria-label="Senha atual para confirmar encerramento"]',
        ),
      };
    });
    diagnostic.phases.push({ phase, ...state });
  } catch {
    diagnostic.phases.push({ phase, observationUnavailable: true });
  }
}
test.beforeAll(async () => {
  db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 3000,
    query_timeout: 7000,
  });
  await db.connect();
  await assertDatabaseIdentity(db);
  evidence.disposableIdentityConfirmed = true;
});
test.afterAll(async () => {
  await db?.end();
  evidence.status =
    evidence.cases.length ===
      (process.env.SESSION_HARNESS_CASE === 'U5R' ? 1 : 2) &&
    evidence.cases.every((item: any) => item.status === 'PASS')
      ? 'PASS'
      : 'FAIL';
  fs.writeFileSync(
    path.join(root, 'u5-browser-proof.json'),
    JSON.stringify(evidence, null, 2),
    { flag: 'wx' },
  );
});
async function caseOf(name: string, work: (record: any) => Promise<void>) {
  const record: any = { case: name, status: 'FAIL' };
  evidence.cases.push(record);
  await work(record);
  record.status = 'PASS';
}
async function login(page: any, index: number) {
  await page.goto('/login');
  await page.waitForFunction(() => !!(window as any).u4);
  await page
    .getByLabel('E-mail', { exact: true })
    .fill(`current-${index}@example.com`);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByTestId('u4-protected')).toBeVisible();
  return page.evaluate(() => (window as any).u4.identity());
}
async function row(sid: string) {
  await assertDatabaseIdentity(db);
  return (
    await db.query(
      `SELECT id,usuario_id,authenticated_at,last_activity_at,absolute_expires_at,
    idle_timeout_seconds,policy_version,revoked_at,terminal_reason FROM auth_session WHERE id=$1`,
      [sid],
    )
  ).rows[0];
}
async function durable(page: any) {
  return page.evaluate(() => {
    const record = JSON.parse(
      localStorage.getItem('auth_session_v3') || 'null',
    );
    return {
      status: record?.status,
      credentialsPresent: !!record?.credentials,
      userPresent: !!record?.user,
      sidPresent: !!record?.sessionId,
      legacyPresent: ['access_token', 'refresh_token', 'usuario_logado'].some(
        (key) => localStorage.getItem(key) !== null,
      ),
      passwordPersisted: Object.values(localStorage).some(
        (value) =>
          typeof value === 'string' &&
          (value.includes('U4-disposable-password-42!') ||
            value.includes('U5-deliberately-wrong-password!')),
      ),
    };
  });
}
async function stats(page: any) {
  return (await page.request.get('/__stats')).json();
}
async function sessions(page: any) {
  await page.goto('/sessoes');
  await expect(page.getByText('Sessao atual', { exact: true })).toBeVisible();
}
async function ownedProtectedSample(
  page: any,
  sid: string,
  requiredPath: '/sessoes' | null,
  pollOptions = { timeout: 5000, intervals: [100] },
) {
  let sample: any;
  await expect
    .poll(async () => {
      sample = await page.evaluate(async () => {
        const own = (window as any).u4
          ? await (window as any).u4.identity()
          : null;
        const protectedVisible =
          !!document.querySelector('[data-testid="u4-protected"]') ||
          document.body.innerText.includes('Sessao atual');
        const unavailableVisible = document.body.innerText.includes(
          'Seus dados permanecem ocultos.',
        );
        return {
          at: Date.now(),
          path: location.pathname,
          identity: own
            ? { ...own, authority: own.authority ? { ...own.authority } : null }
            : null,
          protectedVisible,
          currentSessionVisible:
            document.body.innerText.includes('Sessao atual'),
          unavailableVisible,
        };
      });
      return sample;
    }, pollOptions)
    .toMatchObject({
      identity: {
        sid,
        signedOut: false,
        authorityOwned: true,
        authority: expect.any(Object),
        authorityEpoch: expect.any(Number),
      },
      protectedVisible: true,
      unavailableVisible: false,
      ...(requiredPath
        ? { path: requiredPath, currentSessionVisible: true }
        : {}),
    });
  // Return the matching iteration, not a later read of intentionally mutable authority.
  page.__u5Diagnostic?.phases.push({
    phase: 'matched-owned-protected-sample',
    ...sample,
  });
  return sample;
}
function passwordInput(page: any) {
  return page.getByLabel('Senha atual para confirmar encerramento', {
    exact: true,
  });
}
async function usableControl(page: any, control: any) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox();
  expect(bounds).not.toBeNull();
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.height).toBeGreaterThan(0);
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.y).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
  return bounds;
}
async function globalConfirmation(page: any) {
  await usableControl(
    page,
    page.getByRole('button', {
      name: 'Encerrar todas, incluindo esta sessao',
      exact: true,
    }),
  );
  await page
    .getByRole('button', {
      name: 'Encerrar todas, incluindo esta sessao',
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      'Todos os acessos serao encerrados, incluindo esta sessao. Voce precisara entrar novamente.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirmar encerramento', exact: true }),
  ).toBeDisabled();
  await usableControl(page, passwordInput(page));
  await passwordInput(page).fill(password);
  await usableControl(
    page,
    page.getByRole('button', { name: 'Confirmar encerramento', exact: true }),
  );
}
test('U5 real mobile-width screen rejects wrong password, revokes selected remote and confirms global cleanup', async ({
  page,
  browser,
}: any) => {
  await caseOf('selected-and-global-real-browser', async (record) => {
    await page.setViewportSize({ width: 360, height: 800 });
    evidence.browser = {
      channel: 'msedge',
      version: browser.version(),
      headless: true,
    };
    const current = await login(page, 1);
    const remoteContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4178',
    });
    try {
      const remotePage = await remoteContext.newPage(),
        remote = await login(remotePage, 1);
      expect(remote.sid).not.toBe(current.sid);
      const initial = await row(current.sid),
        remoteInitial = await row(remote.sid);
      expect(remoteInitial.usuario_id).toBe(initial.usuario_id);
      expect(initial.idle_timeout_seconds).toBe(900);
      expect(initial.policy_version).toBe(1);
      expect(+initial.absolute_expires_at - +initial.authenticated_at).toBe(
        43200000,
      );
      await sessions(page);
      await expect(
        page.getByText('Dispositivo nao identificado', { exact: true }),
      ).toHaveCount(1);
      const noTouch = await row(current.sid);
      expect(+noTouch.last_activity_at).toBe(+initial.last_activity_at);
      expect(+noTouch.absolute_expires_at).toBe(+initial.absolute_expires_at);
      const remoteControl = page.getByRole('button', {
        name: 'Encerrar esta sessao',
        exact: true,
      });
      await remoteControl.scrollIntoViewIfNeeded();
      record.layout = await page.evaluate(() => ({
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        bodyOverflow: getComputedStyle(document.body).overflow,
      }));
      record.layout.remoteControl = await remoteControl.boundingBox();
      await page.screenshot({
        path: path.join(root, 'u5-mobile-before-interaction.png'),
        fullPage: true,
      });
      record.layout.remoteControl = await usableControl(page, remoteControl);
      Object.assign(record, {
        currentSid: current.sid,
        remoteSid: remote.sid,
        readsDidNotRenewActivity: true,
        currentAndRemoteOwnIdentityConfirmed: true,
      });
      await page
        .getByRole('button', { name: 'Encerrar esta sessao', exact: true })
        .click();
      await expect(passwordInput(page)).toBeFocused();
      record.layout.passwordControl = await usableControl(
        page,
        passwordInput(page),
      );
      record.layout.cancelControl = await usableControl(
        page,
        page.getByRole('button', { name: 'Cancelar', exact: true }),
      );
      await passwordInput(page).fill('U5-deliberately-wrong-password!');
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', {
          name: 'Confirmar encerramento',
          exact: true,
        }),
      ).toBeFocused();
      const wrongResponse = page.waitForResponse(
        (response: any) =>
          response.url().endsWith(`/auth/sessions/${remote.sid}/revoke`) &&
          response.request().method() === 'POST',
      );
      await page.keyboard.press('Enter');
      const wrong = await wrongResponse;
      expect(wrong.status()).toBe(400);
      expect((await wrong.json()).error.code).toBe(
        'AUTH_CURRENT_PASSWORD_INVALID',
      );
      await expect(page.getByRole('alert')).toContainText(
        'Senha atual incorreta.',
      );
      await expect(passwordInput(page)).toHaveValue('');
      expect((await row(remote.sid)).revoked_at).toBeNull();
      expect((await row(current.sid)).revoked_at).toBeNull();
      expect((await durable(page)).credentialsPresent).toBe(true);
      await passwordInput(page).fill(password);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(passwordInput(page)).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Encerrar esta sessao', exact: true })
        .click();
      await expect(passwordInput(page)).toHaveValue('');
      await passwordInput(page).fill(password);
      const revokeResponse = page.waitForResponse(
        (response: any) =>
          response.url().endsWith(`/auth/sessions/${remote.sid}/revoke`) &&
          response.request().method() === 'POST',
      );
      await page
        .getByRole('button', { name: 'Confirmar encerramento', exact: true })
        .click();
      const revoked = await revokeResponse;
      expect(revoked.status()).toBe(204);
      expect(await revoked.text()).toBe('');
      await expect(
        page.getByText('Dispositivo nao identificado', { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText('Sessao atual', { exact: true }),
      ).toBeVisible();
      expect((await row(remote.sid)).revoked_at).not.toBeNull();
      expect((await row(current.sid)).revoked_at).toBeNull();
      const remoteDenied = await remotePage.evaluate(() =>
        (window as any).u4.request('get', '/auth/session'),
      );
      expect(remoteDenied).toMatchObject({
        ok: false,
        status: 401,
        code: 'AUTH_SESSION_REVOKED',
      });
      await expect(remotePage.getByTestId('u4-protected')).toHaveCount(0);
      expect((await durable(page)).passwordPersisted).toBe(false);
      await page.screenshot({
        path: path.join(root, 'u5-mobile-sessions.png'),
        fullPage: true,
      });
      const before = await stats(page);
      await globalConfirmation(page);
      const globalResponse = page.waitForResponse(
        (response: any) =>
          response.url().endsWith('/auth/sessions/revoke-all') &&
          response.request().method() === 'POST',
      );
      await page
        .getByRole('button', { name: 'Confirmar encerramento', exact: true })
        .click();
      const global = await globalResponse;
      expect(global.status()).toBe(204);
      expect(await global.text()).toBe('');
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
      const cleared = await durable(page);
      expect(cleared).toEqual({
        status: 'signedOut',
        credentialsPresent: false,
        userPresent: false,
        sidPresent: true,
        legacyPresent: false,
        passwordPersisted: false,
      });
      expect((await row(current.sid)).revoked_at).not.toBeNull();
      const after = await stats(page);
      expect(
        (after['POST /auth/sessions/revoke-all'] || 0) -
          (before['POST /auth/sessions/revoke-all'] || 0),
      ).toBe(1);
      expect(
        (after['POST /auth/logout'] || 0) - (before['POST /auth/logout'] || 0),
      ).toBe(0);
      await page.reload();
      await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
      expect(await durable(page)).toEqual(cleared);
      Object.assign(record, {
        currentSid: current.sid,
        remoteSid: remote.sid,
        passwordStatuses: [400, 204],
        globalStatus: 204,
        ownCurrentMarker: true,
        readsDidNotRenewActivity: true,
        remoteDenied,
        globalPosts: 1,
        extraLogoutPosts: 0,
        keyboardFocusAndSubmit: true,
        viewport: { width: 360, height: 800 },
        criticalControlsWithinViewport: true,
        documentOverflowIsNotAControlClippingOracle: true,
        passwordClearedAfterRejectCancelSuccess: true,
        durableCleared: cleared,
        durableClearedAfterReload: true,
      });
    } finally {
      await remoteContext.close();
    }
  });
});
test('U5 offline pre-send and actual post-commit response loss hide private content without replay', async ({
  page,
  context,
  browser,
}: any) => {
  await caseOf(
    'offline-and-postcommit-unknown-real-browser',
    async (record) => {
      await page.setViewportSize({ width: 360, height: 800 });
      evidence.browser = {
        channel: 'msedge',
        version: browser.version(),
        headless: true,
      };
      const current = await login(page, 2);
      record.currentSid = current.sid;
      const otherContext = await browser.newContext({
        baseURL: 'http://127.0.0.1:4178',
      });
      let remote: any;
      try {
        remote = await login(await otherContext.newPage(), 2);
        expect(remote.sid).not.toBe(current.sid);
        expect((await row(remote.sid)).usuario_id).toBe(
          (await row(current.sid)).usuario_id,
        );
        record.globalTargetSid = remote.sid;
      } finally {
        await otherContext.close();
      }
      await sessions(page);
      await page.screenshot({
        path: path.join(root, 'u5-recovery-before-interaction.png'),
        fullPage: true,
      });
      await observe(page, 'initial-owned-session-list');
      const before = await stats(page);
      await globalConfirmation(page);
      await context.setOffline(true);
      try {
        await page
          .getByRole('button', { name: 'Confirmar encerramento', exact: true })
          .click();
        await expect(page.getByRole('alert')).toContainText(
          'Seus dados permanecem ocultos.',
        );
        await expect(
          page.getByText('Sessao atual', { exact: true }),
        ).toHaveCount(0);
        await expect(passwordInput(page)).toHaveCount(0);
        const retained = await durable(page);
        expect(retained.credentialsPresent).toBe(true);
        expect(retained.passwordPersisted).toBe(false);
        expect((await row(current.sid)).revoked_at).toBeNull();
        expect((await row(remote.sid)).revoked_at).toBeNull();
        await expect(page.getByTestId('u4-protected')).toHaveCount(0);
        record.preSendOffline = {
          serverCommits: 0,
          privateHidden: true,
          retained,
        };
        await observe(page, 'offline-unavailable');
      } finally {
        await context.setOffline(false);
      }
      const reconnected = await stats(page);
      expect(
        (reconnected['POST /auth/sessions/revoke-all'] || 0) -
          (before['POST /auth/sessions/revoke-all'] || 0),
      ).toBe(0);
      const freshConfirmation = page.waitForResponse(
        (response: any) =>
          new URL(response.url()).pathname === '/api/auth/session' &&
          response.request().method() === 'GET' &&
          response.status() === 200,
      );
      await page
        .getByRole('button', { name: 'Tentar novamente', exact: true })
        .click();
      const confirmed = await freshConfirmation;
      expect(confirmed.status()).toBe(200);
      const recovered = await ownedProtectedSample(page, current.sid, null);
      expect(recovered.identity.sid).toBe(current.sid);
      expect(recovered.identity.authorityOwned).toBe(true);
      expect((await row(current.sid)).revoked_at).toBeNull();
      record.preSendRecovery = {
        confirmationStatus: 200,
        sameOwnedSid: true,
        recovered,
      };
      await observe(page, 'reconfirmed-before-navigation');
      // Root remount does not promise to preserve /sessoes after unavailable state.
      const navigationConfirmation = page.waitForResponse(
        (response: any) =>
          new URL(response.url()).pathname === '/api/auth/session' &&
          response.request().method() === 'GET' &&
          response.status() === 200,
      );
      await sessions(page);
      expect((await navigationConfirmation).status()).toBe(200);
      const navigated = await ownedProtectedSample(
        page,
        current.sid,
        '/sessoes',
      );
      expect(navigated.identity.sid).toBe(current.sid);
      expect(navigated.identity.authorityOwned).toBe(true);
      expect(navigated.path).toBe('/sessoes');
      record.postNavigationConfirmation = { status: 200, sample: navigated };
      expect((await row(current.sid)).revoked_at).toBeNull();
      expect((await row(remote.sid)).revoked_at).toBeNull();
      await observe(page, 'explicit-owned-session-list-restored');
      expect((await durable(page)).credentialsPresent).toBe(true);
      let actualCommitConfirmed = false;
      await page.route(
        '**/api/auth/sessions/revoke-all',
        async (route: any) => {
          const response = await route.fetch();
          expect(response.status()).toBe(204);
          expect(await response.text()).toBe('');
          expect((await row(current.sid)).revoked_at).not.toBeNull();
          expect((await row(remote.sid)).revoked_at).not.toBeNull();
          actualCommitConfirmed = true;
          record.actualCommitConfirmed = true;
          // Lose only the real committed response; never fabricate valid JSON.
          await route.abort('failed');
        },
      );
      try {
        await globalConfirmation(page);
        await page
          .getByRole('button', { name: 'Confirmar encerramento', exact: true })
          .click();
        await expect(page.getByRole('alert')).toContainText(
          'Seus dados permanecem ocultos.',
        );
        expect(actualCommitConfirmed).toBe(true);
        await expect(
          page.getByText('Sessao atual', { exact: true }),
        ).toHaveCount(0);
        await expect(passwordInput(page)).toHaveCount(0);
        const unknown = await durable(page);
        expect(unknown.credentialsPresent).toBe(true);
        expect(unknown.passwordPersisted).toBe(false);
        await expect(page.getByTestId('u4-protected')).toHaveCount(0);
        await observe(page, 'postcommit-response-aborted-unavailable');
        const after = await stats(page);
        expect(
          (after['POST /auth/sessions/revoke-all'] || 0) -
            (before['POST /auth/sessions/revoke-all'] || 0),
        ).toBe(1);
        expect(
          (after['POST /auth/logout'] || 0) -
            (before['POST /auth/logout'] || 0),
        ).toBe(0);
        const terminalConfirmation = page.waitForResponse(
          (response: any) =>
            new URL(response.url()).pathname === '/api/auth/session' &&
            response.request().method() === 'GET' &&
            response.status() === 401,
        );
        await page
          .getByRole('button', { name: 'Tentar novamente', exact: true })
          .click();
        const denied = await terminalConfirmation;
        expect((await denied.json()).error.code).toBe('AUTH_SESSION_REVOKED');
        await expect(page).toHaveURL(/\/login$/);
        const final = await durable(page);
        expect(final.credentialsPresent).toBe(false);
        expect(final.userPresent).toBe(false);
        expect(final.passwordPersisted).toBe(false);
        await observe(page, 'readonly-terminal-confirmation-login');
        const settled = await stats(page);
        expect(settled['POST /auth/sessions/revoke-all']).toBe(
          after['POST /auth/sessions/revoke-all'],
        );
        expect(settled['POST /auth/logout'] || 0).toBe(
          after['POST /auth/logout'] || 0,
        );
        Object.assign(record, {
          currentSid: current.sid,
          preSendOffline: {
            serverCommits: 0,
            privateHidden: true,
            credentialsRetained: true,
            passwordCleared: true,
          },
          postCommitResponseLoss: {
            actualStatus: 204,
            ownedSqlRevocationConfirmed: true,
            ownCallerAndRemoteTargetRevoked: true,
            responseAborted: true,
            globalPosts: 1,
            extraLogoutPosts: 0,
            noAutomaticReplay: true,
            privateHidden: true,
            credentialsRetainedUntilConfirmation: true,
          },
          readOnlyRetryConfirmedTerminalAndClearedLocal: true,
          final,
        });
      } finally {
        await page.unroute('**/api/auth/sessions/revoke-all');
      }
    },
  );
});
