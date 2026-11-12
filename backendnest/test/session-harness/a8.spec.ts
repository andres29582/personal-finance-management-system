import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '../../../frontend/node_modules/@playwright/test';
import { Client } from 'pg';
import {
  identity as assertDatabaseIdentity,
  initializeAuthority,
} from './contract.cjs';
import { statsValue } from './json-boundary';
import type {} from './browser-contract';
test('A8 offline local logout and sequential replacement after reconnect', async ({
  page,
  context,
}) => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });
  const evidence: Record<string, unknown> = {
    case: 'A8',
    status: 'running',
    concurrentSeparateContext: 'NOT RUN',
  };
  const bridge = <T>(fn: () => T | Promise<T>) => page.evaluate(fn);
  const durable = () =>
    page.evaluate(() => {
      const object = (value: unknown): Record<string, unknown> => {
        if (value === null || typeof value !== 'object' || Array.isArray(value))
          return {};
        return value as Record<string, unknown>;
      };
      const parsed: unknown = JSON.parse(
        localStorage.getItem('auth_session_v3')!,
      );
      const envelope = object(parsed);
      const token = object(envelope.credentials).access_token;
      const decoded: unknown =
        typeof token === 'string'
          ? JSON.parse(
              atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
            )
          : null;
      const payload = object(decoded);
      return {
        status: envelope.status,
        sid: envelope.sessionId,
        credentialsCleared: envelope.credentials === null,
        userCleared: envelope.user === null,
        userId: object(envelope.user).id ?? null,
        tokenSid: payload?.sid ?? null,
        tokenUserId: payload?.sub ?? null,
        legacyKeysCleared: [
          'access_token',
          'refresh_token',
          'usuario_logado',
          'auth_signed_out',
        ].every((key) => localStorage.getItem(key) === null),
      };
    });
  const stats = async () => {
    const value: unknown = await (await page.request.get('/__stats')).json();
    return statsValue(value);
  };
  const login = async (index: number) => {
    await page.goto('/login');
    await page.waitForFunction(() => !!window.u4);
    await page
      .getByLabel('E-mail', { exact: true })
      .fill(`current-${index}@example.com`);
    await page
      .getByLabel('Senha', { exact: true })
      .fill('U4-disposable-password-42!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByTestId('u4-protected')).toBeVisible();
    const own = await bridge(() => window.u4.identity());
    if (!own.sid) throw new Error('Missing owned session identity');
    return { ...own, sid: own.sid };
  };
  await db.connect();
  try {
    await initializeAuthority(db);
    const original = await login(5),
      before = await stats();
    const originalRow = (
      await db.query<{
        usuario_id: string;
        revoked_at: Date | null;
        policy_version: number;
        idle_timeout_seconds: number;
      }>('SELECT usuario_id,revoked_at FROM auth_session WHERE id=$1::uuid', [
        original.sid,
      ])
    ).rows[0];
    expect(originalRow).toBeTruthy();
    await context.setOffline(true);
    const result = await bridge(() => window.u4.logout());
    expect(result.remote).toBe('unconfirmed');
    expect(result.localDurable).toBe(true);
    expect(result.cleanupComplete).toBe(true);
    await expect(page.getByTestId('u4-protected')).toHaveCount(0);
    const capsule = await bridge(() => window.u4.capsule());
    expect(capsule.status).toBe('signedOut');
    expect(capsule.signedOut).toBe(true);
    expect(await durable()).toMatchObject({
      status: 'signedOut',
      sid: original.sid,
      credentialsCleared: true,
      userCleared: true,
      legacyKeysCleared: true,
      tokenSid: null,
      tokenUserId: null,
    });
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByTestId('u4-protected')).toHaveCount(0);
    expect(await durable()).toMatchObject({
      status: 'signedOut',
      credentialsCleared: true,
      userCleared: true,
      legacyKeysCleared: true,
    });
    const reconnected = await stats();
    expect(reconnected['POST /auth/logout'] || 0).toBe(
      before['POST /auth/logout'] || 0,
    );
    const replacement = await login(6);
    expect(replacement.sid).toEqual(expect.any(String));
    expect(replacement.sid).not.toBe(original.sid);
    const row = (
      await db.query<{
        usuario_id: string;
        revoked_at: Date | null;
        policy_version: number;
        idle_timeout_seconds: number;
      }>(
        'SELECT usuario_id,revoked_at,policy_version,idle_timeout_seconds FROM auth_session WHERE id=$1::uuid',
        [replacement.sid],
      )
    ).rows[0];
    expect(row).toBeTruthy();
    expect(row.usuario_id).not.toBe(originalRow.usuario_id);
    expect(row.revoked_at).toBeNull();
    expect(row.policy_version).toBe(1);
    expect(row.idle_timeout_seconds).toBe(900);
    expect(await durable()).toMatchObject({
      status: 'valid',
      sid: replacement.sid,
      tokenSid: replacement.sid,
      userId: row.usuario_id,
      tokenUserId: row.usuario_id,
      credentialsCleared: false,
      userCleared: false,
      legacyKeysCleared: true,
    });
    await page.reload();
    await expect(page.getByTestId('u4-protected')).toBeVisible();
    expect((await bridge(() => window.u4.identity())).sid).toBe(
      replacement.sid,
    );
    expect(await durable()).toMatchObject({
      status: 'valid',
      sid: replacement.sid,
      tokenSid: replacement.sid,
      userId: row.usuario_id,
      tokenUserId: row.usuario_id,
      legacyKeysCleared: true,
    });
    const end = await stats();
    expect(end['POST /auth/logout'] || 0).toBe(
      before['POST /auth/logout'] || 0,
    );
    await assertDatabaseIdentity(db);
    Object.assign(evidence, {
      status: 'completed',
      result,
      automaticLogoutReplay: 0,
      originalSid: original.sid,
      replacementSid: replacement.sid,
      replacementLoginAfterReconnectConfirmed: true,
      replacementSqlIdentityConfirmed: true,
      replacementIdentityAfterReloadConfirmed: true,
      originalCredentialsAndUserClearedConfirmed: true,
      signedOutTombstoneSidRetained: true,
      replacementDurableTokenAndUserIdentityConfirmed: true,
    });
  } catch (error: unknown) {
    evidence.status = 'failed';
    evidence.error =
      error instanceof Error ? error.message : 'Unknown browser failure';
    throw error;
  } finally {
    await context.setOffline(false);
    await db.end();
    fs.writeFileSync(
      path.join(process.env.SESSION_HARNESS_ARTIFACTS!, 'a8-proof.json'),
      JSON.stringify(evidence, null, 2),
      { flag: 'wx' },
    );
  }
});
