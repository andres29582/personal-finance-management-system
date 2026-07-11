import { ConfigService } from '@nestjs/config';
import { resolvePasswordResetConfig } from './password-reset.config';

describe('resolvePasswordResetConfig', () => {
  function config(values: Record<string, string | undefined>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as Pick<ConfigService, 'get'>;
  }

  it.each([
    ['development', 'true', true],
    ['development', 'false', false],
    ['development', undefined, false],
    ['test', 'true', true],
    ['test', 'false', false],
    ['production', 'false', false],
    ['staging', undefined, false],
  ])(
    'resolves NODE_ENV=%s and AUTH_RETURN_RESET_TOKEN=%s as returnResetToken=%s',
    (nodeEnv, flag, expected) => {
      const result = resolvePasswordResetConfig(
        config({
          AUTH_RETURN_RESET_TOKEN: flag,
          NODE_ENV: nodeEnv,
        }),
      );

      expect(result.returnResetToken).toBe(expected);
    },
  );

  it.each(['production', 'demo', 'staging', ''])(
    'fails fast when reset token exposure is enabled in %s',
    (nodeEnv) => {
      expect(() =>
        resolvePasswordResetConfig(
          config({
            AUTH_RETURN_RESET_TOKEN: 'true',
            NODE_ENV: nodeEnv,
          }),
        ),
      ).toThrow(
        'AUTH_RETURN_RESET_TOKEN nao pode ser habilitado fora de development/test.',
      );
    },
  );

  it('does not include sensitive values in the failure message', () => {
    const sensitiveValues = ['plain-token-value', 'ana@example.com', 'secret'];

    try {
      resolvePasswordResetConfig(
        config({
          AUTH_RETURN_RESET_TOKEN: 'true',
          JWT_ACCESS_SECRET: 'secret',
          NODE_ENV: 'production',
        }),
      );
      throw new Error('Expected resolvePasswordResetConfig to throw');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);

      for (const value of sensitiveValues) {
        expect(message).not.toContain(value);
      }
    }
  });

  it('uses the configured reset token ttl', () => {
    const result = resolvePasswordResetConfig(
      config({
        NODE_ENV: 'test',
        PASSWORD_RESET_TTL_MINUTES: '15',
      }),
    );

    expect(result.ttlMinutes).toBe(15);
  });

  it('defaults the reset token ttl to 60 minutes', () => {
    const result = resolvePasswordResetConfig(config({ NODE_ENV: 'test' }));

    expect(result.ttlMinutes).toBe(60);
  });
});
