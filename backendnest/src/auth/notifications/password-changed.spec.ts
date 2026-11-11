import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PasswordChangedWorker } from './password-changed.worker';
import { passwordChangedConfig } from './password-changed.config';
import {
  passwordChangedPayload,
  sendPasswordChanged,
} from './resend-password-changed';

const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as ConfigService;
const payload = passwordChangedPayload(
  'onboarding@resend.dev',
  'user@example.com',
  new Date('2026-10-06T12:00:00Z'),
);

describe('password-change development safety', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('defaults off without reading any API key', async () => {
    const reader = { get: jest.fn().mockReturnValue(undefined) };
    expect(passwordChangedConfig(reader)).toMatchObject({ enabled: false });
    expect(reader.get.mock.calls.flat()).not.toContain('RESEND_API_KEY');
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('must not send'));
    expect(
      await sendPasswordChanged(payload, 'event-1', { networkEnabled: false }),
    ).toMatchObject({ kind: 'simulated' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it.each([
    { PASSWORD_CHANGED_RESEND_LIVE_ENABLED: 'true' },
    { PASSWORD_CHANGED_WORKER_ENABLED: 'true', NODE_ENV: 'production' },
    { PASSWORD_CHANGED_WORKER_ENABLED: 'yes' },
  ])('fails closed on unsafe configuration %p', (values) => {
    expect(() => passwordChangedConfig(config(values))).toThrow();
  });
  it('direct and background disabled worker do not claim, send or retain handles', async () => {
    const outbox = {
      claim: jest.fn(),
      settle: jest.fn(),
      purgeDelivered: jest.fn(),
    };
    const worker = new PasswordChangedWorker(config({}), outbox as never);
    worker.onModuleInit();
    await worker.runOnce();
    await worker.onModuleDestroy();
    expect(outbox.claim).not.toHaveBeenCalled();
  });
  it('reports exhausted reconciliation safely rather than silently dropping it', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const outbox = {
      claim: jest
        .fn()
        .mockResolvedValue({ id: 'event-1', payload, state: 'claimed' }),
      settle: jest.fn().mockResolvedValue('reconciliation'),
      purgeDelivered: jest.fn(),
    };
    const worker = new PasswordChangedWorker(
      config({ PASSWORD_CHANGED_WORKER_ENABLED: 'true', NODE_ENV: 'test' }),
      outbox as never,
    );
    await worker.runOnce();
    expect(warn).toHaveBeenCalledWith('PASSWORD_CHANGED_ATTENTION_REQUIRED');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('user@example.com');
  });
  it('does not overlap polling and waits for active work on shutdown', async () => {
    let release!: () => void;
    const claim = new Promise<null>((resolve) => {
      release = () => resolve(null);
    });
    const outbox = {
      claim: jest.fn().mockReturnValue(claim),
      settle: jest.fn(),
      purgeDelivered: jest.fn(),
    };
    const worker = new PasswordChangedWorker(
      config({ PASSWORD_CHANGED_WORKER_ENABLED: 'true', NODE_ENV: 'test' }),
      outbox as never,
    );
    const first = worker.runOnce();
    const second = worker.runOnce();
    const stopping = worker.onModuleDestroy();
    expect(outbox.claim).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second, stopping]);
    await worker.runOnce();
    expect(outbox.claim).toHaveBeenCalledTimes(1);
  });
});

describe('private Resend contract with fetch always stubbed', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('reuses exact frozen payload and event key and refuses redirects', async () => {
    const mock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'provider-1' }), { status: 200 }),
      );
    // Fresh Response per call avoids consuming the same mocked body twice.
    mock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'provider-1' }), { status: 200 }),
      ),
    );
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        await sendPasswordChanged(payload, 'event-1', {
          networkEnabled: true,
          apiKey: 'synthetic-unit-key',
        }),
      ).toMatchObject({ kind: 'accepted' });
    for (const [url, options] of mock.mock.calls) {
      expect(url).toBe('https://api.resend.com/emails');
      expect(options).toMatchObject({
        body: payload,
        redirect: 'error',
        headers: { 'Idempotency-Key': 'password-changed/event-1' },
      });
    }
    expect(payload).not.toMatch(/synthetic-unit-key|token|hash/);
  });
  it.each([
    [429, 'daily_quota_exceeded', 'failed', 'PROVIDER_QUOTA'],
    [429, 'monthly_quota_exceeded', 'failed', 'PROVIDER_QUOTA'],
    [429, 'rate_limit_exceeded', 'retry', 'PROVIDER_RATE_LIMIT'],
    [500, 'application_error', 'retry', 'PROVIDER_TRANSIENT'],
    [409, 'concurrent_idempotent_requests', 'retry', 'PROVIDER_TRANSIENT'],
    [
      409,
      'invalid_idempotent_request',
      'reconciliation',
      'IDEMPOTENCY_CONFLICT',
    ],
    [403, 'validation_error', 'failed', 'PROVIDER_REJECTED'],
  ])(
    'classifies %s/%s without exposing provider bodies',
    async (status, name, kind, code) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(
            JSON.stringify({ name, message: 'private-provider-message' }),
            { status: Number(status), headers: { 'Retry-After': '99999999' } },
          ),
        );
      const outcome = await sendPasswordChanged(payload, 'event-1', {
        networkEnabled: true,
        apiKey: 'synthetic-unit-key',
      });
      expect(outcome).toMatchObject({ kind, code });
      expect(outcome.retryAfterMs ?? 0).toBeLessThanOrEqual(3600_000);
      expect(JSON.stringify(outcome)).not.toContain('private-provider-message');
    },
  );
  it('treats unknown network outcome as retry without leaking the exception', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('private-credential-value'));
    expect(
      await sendPasswordChanged(payload, 'event-1', {
        networkEnabled: true,
        apiKey: 'synthetic-unit-key',
      }),
    ).toEqual({ kind: 'retry', code: 'NETWORK_OR_TIMEOUT' });
  });
});
