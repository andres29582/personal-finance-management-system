import { ConfigService } from '@nestjs/config';
import { resolveThrottlerConfig } from './throttler.config';

function resolve(values: Record<string, unknown> = {}) {
  return resolveThrottlerConfig(new ConfigService(values));
}

describe('resolveThrottlerConfig', () => {
  it('uses the existing defaults', () => {
    expect(resolve()).toEqual({ ttl: 60000, limit: 60 });
  });

  it('accepts explicit valid values', () => {
    expect(
      resolve({ THROTTLE_TTL_MS: '120000', THROTTLE_LIMIT: '100' }),
    ).toEqual({ ttl: 120000, limit: 100 });
  });

  it.each(['text', '1000.5', '0', '-1', '999', '3600001'])(
    'rejects invalid TTL %p',
    (ttl) => {
      expect(() => resolve({ THROTTLE_TTL_MS: ttl })).toThrow(
        'THROTTLE_TTL_MS',
      );
    },
  );

  it.each(['text', '1.5', '0', '-1', '10001'])(
    'rejects invalid limit %p',
    (limit) => {
      expect(() => resolve({ THROTTLE_LIMIT: limit })).toThrow(
        'THROTTLE_LIMIT',
      );
    },
  );
});
