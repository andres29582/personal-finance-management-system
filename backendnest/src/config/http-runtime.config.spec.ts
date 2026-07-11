import { ConfigService } from '@nestjs/config';
import { resolveHttpRuntimeConfig } from './http-runtime.config';

function resolve(values: Record<string, unknown>) {
  return resolveHttpRuntimeConfig(new ConfigService(values));
}

describe('resolveHttpRuntimeConfig', () => {
  it('uses the default port in development', () => {
    expect(resolve({ NODE_ENV: 'development' }).port).toBe(3000);
  });

  it('accepts an explicit valid port', () => {
    expect(resolve({ NODE_ENV: 'development', PORT: '8080' }).port).toBe(8080);
  });

  it.each(['abc', '3000.5', '0', '-1', '65536', '   '])(
    'rejects invalid port %p',
    (port) => {
      expect(() => resolve({ NODE_ENV: 'development', PORT: port })).toThrow(
        'PORT',
      );
    },
  );

  it.each(['development', 'test'])('uses local CORS defaults in %s', (env) => {
    expect(resolve({ NODE_ENV: env }).allowedOrigins).toEqual([
      'http://localhost:8081',
      'http://localhost:19006',
      'http://localhost:3000',
    ]);
  });

  it('uses only an explicit development list and trims it', () => {
    expect(
      resolve({
        NODE_ENV: 'development',
        CORS_ORIGINS: ' http://localhost:8081 , https://local.example ',
      }).allowedOrigins,
    ).toEqual(['http://localhost:8081', 'https://local.example']);
  });

  it('deduplicates origins and normalizes a trailing slash', () => {
    expect(
      resolve({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.example/,https://app.example',
      }).allowedOrigins,
    ).toEqual(['https://app.example']);
  });

  it.each([
    'https://app.example/api',
    'https://app.example?x=1',
    'https://app.example#fragment',
    'https://user:password@app.example',
    '*',
    'https://*.example',
    'null',
  ])('rejects invalid origin %p', (origin) => {
    expect(() =>
      resolve({ NODE_ENV: 'production', CORS_ORIGINS: origin }),
    ).toThrow('CORS_ORIGINS');
  });

  it.each(['production', 'demo', 'staging', '', 'unexpected'])(
    'requires CORS_ORIGINS in exposed environment %p',
    (env) => {
      expect(() => resolve({ NODE_ENV: env })).toThrow('CORS_ORIGINS');
    },
  );

  it('normalizes NODE_ENV before applying local policy', () => {
    expect(resolve({ NODE_ENV: ' Test ' }).allowedOrigins).toHaveLength(3);
  });

  it('rejects HTTP in production', () => {
    expect(() =>
      resolve({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'http://app.example',
      }),
    ).toThrow('CORS_ORIGINS');
  });

  it('accepts one or multiple HTTPS origins in production', () => {
    expect(
      resolve({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.example,https://admin.example',
      }).allowedOrigins,
    ).toEqual(['https://app.example', 'https://admin.example']);
  });

  it('uses the default body limit', () => {
    expect(resolve({ NODE_ENV: 'development' }).bodyLimitBytes).toBe(102400);
  });

  it('accepts an explicit valid body limit', () => {
    expect(
      resolve({ NODE_ENV: 'development', HTTP_BODY_LIMIT_BYTES: '2048' })
        .bodyLimitBytes,
    ).toBe(2048);
  });

  it.each(['text', '1024.5', '1023', '1048577'])(
    'rejects invalid body limit %p',
    (bodyLimit) => {
      expect(() =>
        resolve({
          NODE_ENV: 'development',
          HTTP_BODY_LIMIT_BYTES: bodyLimit,
        }),
      ).toThrow('HTTP_BODY_LIMIT_BYTES');
    },
  );
});
