import { configureE2eEnvironment } from '../../test/e2e-database';

describe('disposable E2E preflight', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('rejects missing explicit configuration without a connection', () => {
    Object.keys(process.env)
      .filter((key) => key.startsWith('E2E_DB_'))
      .forEach((key) => delete process.env[key]);
    process.env.DB_NAME = 'production_test';
    expect(() => configureE2eEnvironment()).toThrow();
  });

  it('rejects a loosely named test database', () => {
    Object.assign(process.env, {
      E2E_DB_HOST: '127.0.0.1',
      E2E_DB_PORT: '55432',
      E2E_DB_USERNAME: 'finance_e2e_runner',
      E2E_DB_PASSWORD: 'isolated-test-only',
      E2E_DB_NAME: 'production_test',
      E2E_DB_RESET_CONFIRM: 'production_test',
    });
    expect(() => configureE2eEnvironment()).toThrow();
  });

  it('accepts explicit preflight without consulting normal DB settings or sending mail', () => {
    Object.assign(process.env, {
      E2E_DB_HOST: '127.0.0.1',
      E2E_DB_PORT: '55432',
      E2E_DB_USERNAME: 'finance_e2e_runner',
      E2E_DB_PASSWORD: 'isolated-test-only',
      E2E_DB_NAME: 'finance_e2e_credentials',
      E2E_DB_RESET_CONFIRM: 'finance_e2e_credentials',
      DB_NAME: 'production',
      PASSWORD_RESET_DELIVERY_URL: 'https://example.com/real-mail',
    });
    expect(configureE2eEnvironment().database).toBe('finance_e2e_credentials');
    expect(process.env.DB_NAME).toBe('finance_e2e_credentials');
    expect(process.env.PASSWORD_RESET_DELIVERY_URL).toBe('');
  });
});
