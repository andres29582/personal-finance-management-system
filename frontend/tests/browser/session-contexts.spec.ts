import { test, expect, Page } from '@playwright/test';
import { loginSession } from '../../__tests__/helpers/session-fixtures';
import { randomUUID } from 'node:crypto';
async function ready(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    expect(errors, 'production module bundle must load without native-only modules').toEqual([]);
    await page.waitForFunction(() => !!window.sessionHarness);
    await expect(page.getByTestId('harness-ready')).toHaveText('U3 synthetic session harness');
    expect(await page.evaluate(() => isSecureContext && !!navigator.locks && typeof BroadcastChannel === 'function')).toBe(true);
}
test('three real shared pages rotate once and late N401 adopts N+1', async ({ context }) => {
    const pages = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
    await Promise.all(pages.map(ready));
    const initial = loginSession(), rotated = loginSession('A', 'session-A', '1');
    await pages[0].evaluate(async (session) => {
        const s = window.sessionHarness.storage;
        await s.installSession(session, await s.reconcileSession());
    }, initial);
    let refreshes = 0, requests = 0;
    let release!: () => void;
    const barrier = new Promise<void>(done => { release = done; });
    await context.route('**/auth/refresh', async (route) => {
        refreshes++;
        expect(route.request().postDataJSON()).toEqual({ refreshToken: initial.refresh_token });
        await barrier;
        await route.fulfill({ status: 200, json: rotated });
    });
    await context.route('**/protected', async (route) => {
        requests++;
        const valid = route.request().headers().authorization === `Bearer ${rotated.access_token}`;
        await route.fulfill({ status: valid ? 200 : 401, json: valid ? { label: 'synthetic A' } : {} });
    });
    const results = pages.map(page => page.evaluate(() => window.sessionHarness.request('/protected')));
    await expect.poll(() => refreshes).toBe(1);
    await expect.poll(() => requests).toBeGreaterThanOrEqual(3);
    release();
    expect(await Promise.all(results)).toEqual(Array(3).fill({ ok: true, data: { label: 'synthetic A' } }));
    expect(refreshes).toBe(1);
    expect((await pages[0].evaluate(() => navigator.locks.query())).held).toEqual([]);
});
test('stale profile and login publications preserve B across shared pages', async ({ context }) => {
    const a = await context.newPage(), b = await context.newPage();
    await ready(a);
    await ready(b);
    await a.evaluate(async (session) => { const s = window.sessionHarness.storage; await s.installSession(session, await s.reconcileSession()); }, loginSession());
    await a.evaluate(async () => { (window as any).capturedSession = await window.sessionHarness.storage.getSessionSnapshot(); });
    await b.evaluate(async (session) => { const s = window.sessionHarness.storage; await s.installSession(session, await s.reconcileSession()); }, loginSession('B'));
    expect(await a.evaluate(async (session) => {
        const s = window.sessionHarness.storage;
        let profileFailure = 'unexpected-success';
        try {
            await s.saveUser(session.usuario, (window as any).capturedSession);
        }
        catch (error) {
            profileFailure = (error as {
                sessionFailure: string;
            }).sessionFailure;
        }
        return { profileFailure, loginInstalled: await s.installSession(session, (window as any).capturedSession) };
    }, loginSession())).toEqual({ profileFailure: 'stale', loginInstalled: false });
    expect(await b.evaluate(() => window.sessionHarness.storage.getUser())).toEqual(loginSession('B').usuario);
});
test('actual stub post-effect response loss requires reauth after reload without resend', async ({ context, request }) => {
    const page = await context.newPage();
    await ready(page);
    const before = await (await request.get('/__stats')).json();
    const caseId = randomUUID();
    await context.route('**/auth/refresh', route => route.continue({ headers: { ...route.request().headers(), 'x-u3-case': caseId } }));
    await page.evaluate(async (session) => { const s = window.sessionHarness.storage; await s.installSession(session, await s.reconcileSession()); }, loginSession());
    await context.route('**/lost-protected', route => route.fulfill({ status: 401, json: {} }));
    expect(await page.evaluate(() => window.sessionHarness.request('/lost-protected'))).toEqual({ ok: false, failure: 'unknown' });
    expect((await (await request.get('/__stats')).json()).refreshEffects).toBe(before.refreshEffects + 1);
    expect((await (await request.get('/__stats')).json()).cases[caseId]).toEqual({ effects: 1, responsesStarted: 1 });
    await ready(page);
    expect(await page.evaluate(() => window.sessionHarness.storage.getToken())).toBeNull();
    expect(await page.evaluate(() => window.sessionHarness.request('/lost-protected'))).toEqual({ ok: false, failure: 'stale' });
    expect((await (await request.get('/__stats')).json()).refreshEffects).toBe(before.refreshEffects + 1);
    expect((await page.evaluate(() => navigator.locks.query())).held).toEqual([]);
});
test('old-page logout and ordinary response cannot clear or expose newly installed B', async ({ context }) => {
    const a = await context.newPage(), b = await context.newPage();
    await ready(a);
    await ready(b);
    await a.evaluate(async (session) => { const s = window.sessionHarness.storage; await s.installSession(session, await s.reconcileSession()); }, loginSession());
    let entered = false, release!: () => void;
    const barrier = new Promise<void>(done => { release = done; });
    await context.route('**/delayed', async (route) => { entered = true; await barrier; await route.fulfill({ status: 200, json: { privateA: true } }); });
    const pending = a.evaluate(() => window.sessionHarness.request('/delayed'));
    await expect.poll(() => entered).toBe(true);
    await b.evaluate(async (session) => { const s = window.sessionHarness.storage; await s.installSession(session, await s.reconcileSession()); }, loginSession('B'));
    const logout = await a.evaluate(async () => {
        const result = await window.sessionHarness.storage.beginLocalLogout().completion;
        return { durable: result.localDurable, capturedCredential: result.accessToken !== null };
    });
    expect(logout).toEqual({ durable: true, capturedCredential: false });
    release();
    expect(await pending).toEqual({ ok: false, failure: 'stale' });
    expect(await b.evaluate(() => window.sessionHarness.storage.getUser())).toEqual(loginSession('B').usuario);
});
test('reload recovers orphan marker without old-token HTTP and channels are not authority', async ({ context }) => {
    const page = await context.newPage();
    await ready(page);
    await page.evaluate(async (session) => {
        const s = window.sessionHarness.storage;
        await s.installSession(session, await s.reconcileSession());
        const record = JSON.parse(localStorage.getItem(s.SESSION_KEY)!);
        localStorage.setItem(s.SESSION_KEY, JSON.stringify({ ...record, status: 'refreshInFlight', revision: 1, attempt: crypto.randomUUID() }));
    }, loginSession());
    let refreshes = 0;
    await context.route('**/auth/refresh', route => { refreshes++; return route.fulfill({ status: 500 }); });
    await ready(page);
    expect(await page.evaluate(async () => { const s = window.sessionHarness.storage; await s.reconcileSession(); return s.getToken(); })).toBeNull();
    expect(refreshes).toBe(0);
});
