import { ConfigService } from '@nestjs/config';
import { resolveMlApiConfig } from './ml-api.config';

describe('resolveMlApiConfig', () => {
  const strongKey = 'synthetic-ml-key-with-at-least-32-chars';

  function config(values: Record<string, string | undefined>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  it('keeps the default URL in development without key', () => {
    const result = resolveMlApiConfig(config({ NODE_ENV: 'development' }));

    expect(result.baseUrl).toBe('http://127.0.0.1:8000');
    expect(result.internalApiKey).toBeUndefined();
  });

  it('keeps compatibility in test without key', () => {
    const result = resolveMlApiConfig(config({ NODE_ENV: 'test' }));

    expect(result.baseUrl).toBe('http://127.0.0.1:8000');
    expect(result.timeoutMs).toBe(5000);
    expect(result.internalApiKey).toBeUndefined();
  });

  it('uses configured URL and timeout', () => {
    const result = resolveMlApiConfig(
      config({
        NODE_ENV: 'development',
        ML_API_URL: ' http://ml:8000/ ',
        ML_API_TIMEOUT_MS: ' 7000 ',
      }),
    );

    expect(result.baseUrl).toBe('http://ml:8000/');
    expect(result.timeoutMs).toBe(7000);
  });

  it('keeps the default timeout when absent', () => {
    const result = resolveMlApiConfig(config({ NODE_ENV: 'development' }));

    expect(result.timeoutMs).toBe(5000);
  });

  it('accepts a valid key in production', () => {
    const result = resolveMlApiConfig(
      config({ NODE_ENV: 'production', ML_INTERNAL_API_KEY: strongKey }),
    );

    expect(result.internalApiKey).toBe(strongKey);
  });

  it.each(['production', 'demo', 'staging'])(
    'requires a key in %s',
    (nodeEnv) => {
      expect(() => resolveMlApiConfig(config({ NODE_ENV: nodeEnv }))).toThrow(
        'ML_INTERNAL_API_KEY is required',
      );
    },
  );

  it('rejects a short key outside development/test', () => {
    expect(() =>
      resolveMlApiConfig(
        config({ NODE_ENV: 'production', ML_INTERNAL_API_KEY: 'short' }),
      ),
    ).toThrow('ML_INTERNAL_API_KEY must have at least 32 characters');
  });

  it('rejects predictable placeholders outside development/test', () => {
    const secret = 'replace_me_synthetic_secret_with_32_chars';

    expect(() =>
      resolveMlApiConfig(
        config({ NODE_ENV: 'production', ML_INTERNAL_API_KEY: secret }),
      ),
    ).toThrow(
      'ML_INTERNAL_API_KEY must not use a predictable placeholder value',
    );
  });

  it('does not include the key in error messages', () => {
    const secret = 'troque_synthetic_secret_with_32_chars';

    try {
      resolveMlApiConfig(
        config({ NODE_ENV: 'production', ML_INTERNAL_API_KEY: secret }),
      );
      throw new Error('Expected config resolution to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
