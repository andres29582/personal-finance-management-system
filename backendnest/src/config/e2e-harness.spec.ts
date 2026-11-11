import { Test } from '@nestjs/testing';
import { createE2eApp } from '../../test/e2e-app';
import {
  configureE2eEnvironment,
  prepareE2eDatabase,
} from '../../test/e2e-database';
import { resolveDatabaseConfig } from './database.config';

const runtime = jest.requireActual<typeof import('../../test/e2e-runtime.cjs')>(
  '../../test/e2e-runtime.cjs',
);

jest.mock('../app.module', () => ({ AppModule: class MockAppModule {} }));
jest.mock('@nestjs/testing', () => ({
  Test: { createTestingModule: jest.fn() },
}));

const explicit = {
  E2E_DB_HOST: '127.0.0.1',
  E2E_DB_PORT: '55434',
  E2E_DB_USERNAME: 'finance_e2e_owner',
  E2E_DB_PASSWORD: 'synthetic-only',
  E2E_DB_NAME: 'finance_e2e_mock',
  E2E_DB_RESET_CONFIRM: 'finance_e2e_mock',
};

describe('E2E bootstrap failure boundaries without database or network', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  it('removes inherited TLS CA and delivery configuration before app configuration', () => {
    Object.assign(process.env, explicit, {
      DB_SSL_CA_BASE64: 'synthetic',
      PASSWORD_CHANGED_WORKER_ENABLED: 'true',
      PASSWORD_CHANGED_RESEND_LIVE_ENABLED: 'true',
    });
    configureE2eEnvironment();
    const config = resolveDatabaseConfig({
      get: (key: string) => process.env[key],
    } as never);
    expect(config.ssl).toBe(false);
    expect(process.env.PASSWORD_CHANGED_WORKER_ENABLED).toBe('false');
    expect(process.env.PASSWORD_CHANGED_RESEND_LIVE_ENABLED).toBe('false');
  });

  it('stops migration phase after reset failure and preserves the exact primary error', async () => {
    Object.assign(process.env, explicit);
    const config = configureE2eEnvironment();
    const primary = new Error('synthetic reset failure');
    const guarded = jest
      .spyOn(runtime, 'withGuardedDatabase')
      .mockRejectedValue(primary);
    await expect(prepareE2eDatabase(config)).rejects.toBe(primary);
    expect(guarded).toHaveBeenCalledTimes(1);
  });

  it('closes application after init fails and preserves both primary and cleanup errors', async () => {
    const primary = new Error('synthetic init failure');
    const cleanup = new Error('synthetic close failure');
    const app = {
      get: () => ({
        get: (key: string) => (key === 'NODE_ENV' ? 'test' : undefined),
      }),
      use: jest.fn(),
      useBodyParser: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      init: jest.fn().mockRejectedValue(primary),
      close: jest.fn().mockRejectedValue(cleanup),
    };
    const moduleFixture = {
      createNestApplication: () => app,
      close: jest.fn(),
    };
    jest.spyOn(Test, 'createTestingModule').mockReturnValue({
      compile: jest.fn().mockResolvedValue(moduleFixture),
    } as never);
    await expect(createE2eApp()).rejects.toMatchObject({
      errors: [primary, cleanup],
    });
    expect(app.close).toHaveBeenCalledTimes(1);
  });
});
