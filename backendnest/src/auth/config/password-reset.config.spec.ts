import { ConfigService } from '@nestjs/config';
import { resolvePasswordResetConfig } from './password-reset.config';

describe('resolvePasswordResetConfig', () => {
  const deliveryApiKey = 'password-reset-delivery-api-key-at-least-32-chars';

  function config(values: Record<string, string | undefined>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as Pick<ConfigService, 'get'>;
  }

  it.each([
    ['development', 'true', true],
    ['development', 'false', false],
    ['test', 'true', true],
    ['test', undefined, false],
  ])(
    'resolves local NODE_ENV=%s and AUTH_RETURN_RESET_TOKEN=%s',
    (nodeEnv, flag, expected) => {
      expect(
        resolvePasswordResetConfig(
          config({ AUTH_RETURN_RESET_TOKEN: flag, NODE_ENV: nodeEnv }),
        ).returnResetToken,
      ).toBe(expected);
    },
  );

  it('does not expose reset tokens in production even with delivery configured', () => {
    const result = resolvePasswordResetConfig(
      config({
        AUTH_RETURN_RESET_TOKEN: 'false',
        NODE_ENV: 'production',
        PASSWORD_RESET_DELIVERY_API_KEY: deliveryApiKey,
        PASSWORD_RESET_DELIVERY_URL:
          'https://mailer.example.test/password-reset',
      }),
    );

    expect(result.returnResetToken).toBe(false);
  });

  it.each(['production', 'demo', 'staging', ''])(
    'rejects reset-token exposure in %s without leaking secrets',
    (nodeEnv) => {
      expect(() =>
        resolvePasswordResetConfig(
          config({
            AUTH_RETURN_RESET_TOKEN: 'true',
            NODE_ENV: nodeEnv,
            PASSWORD_RESET_DELIVERY_API_KEY: deliveryApiKey,
            PASSWORD_RESET_DELIVERY_URL:
              'https://mailer.example.test/password-reset',
          }),
        ),
      ).toThrow('AUTH_RETURN_RESET_TOKEN nao pode ser habilitado');
    },
  );

  it('requires an authenticated HTTPS delivery endpoint outside local environments', () => {
    expect(() =>
      resolvePasswordResetConfig(config({ NODE_ENV: 'production' })),
    ).toThrow('PASSWORD_RESET_DELIVERY_URL is required');
    expect(() =>
      resolvePasswordResetConfig(
        config({
          NODE_ENV: 'production',
          PASSWORD_RESET_DELIVERY_API_KEY: deliveryApiKey,
          PASSWORD_RESET_DELIVERY_URL: 'http://mailer.example.test/reset',
        }),
      ),
    ).toThrow('PASSWORD_RESET_DELIVERY_URL must be a valid HTTPS URL');
  });

  it('does not leak delivery credentials in configuration errors', () => {
    const secret = 'troque_super_sensitive_delivery_key_that_must_not_leak';

    expect(() =>
      resolvePasswordResetConfig(
        config({
          NODE_ENV: 'production',
          PASSWORD_RESET_DELIVERY_API_KEY: secret,
          PASSWORD_RESET_DELIVERY_URL: 'http://mailer.example.test/reset',
        }),
      ),
    ).toThrow('PASSWORD_RESET_DELIVERY_URL must be a valid HTTPS URL');

    try {
      resolvePasswordResetConfig(
        config({
          NODE_ENV: 'production',
          PASSWORD_RESET_DELIVERY_API_KEY: secret,
          PASSWORD_RESET_DELIVERY_URL: 'http://mailer.example.test/reset',
        }),
      );
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
  it.each(['0', '15.5', '1441', 'invalid'])(
    'rejects invalid reset ttl %s',
    (ttl) => {
      expect(() =>
        resolvePasswordResetConfig(
          config({ NODE_ENV: 'test', PASSWORD_RESET_TTL_MINUTES: ttl }),
        ),
      ).toThrow(
        'PASSWORD_RESET_TTL_MINUTES must be an integer between 1 and 1440',
      );
    },
  );
});
