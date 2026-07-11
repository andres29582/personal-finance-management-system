import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';

const LOCAL_ENVIRONMENTS = new Set(['development', 'test']);
const LOCAL_CORS_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
];
const CORS_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'PATCH',
  'POST',
  'DELETE',
  'OPTIONS',
];

type ConfigReader = Pick<ConfigService, 'get'>;

export interface HttpRuntimeConfig {
  port: number;
  bodyLimitBytes: number;
  allowedOrigins: string[];
}

export function resolveHttpRuntimeConfig(
  configService: ConfigReader,
): HttpRuntimeConfig {
  const environment = normalizeEnvironment(configService.get('NODE_ENV'));

  return {
    port: resolveInteger(configService.get('PORT'), 'PORT', 3000, 1, 65535),
    bodyLimitBytes: resolveInteger(
      configService.get('HTTP_BODY_LIMIT_BYTES'),
      'HTTP_BODY_LIMIT_BYTES',
      102400,
      1024,
      1048576,
    ),
    allowedOrigins: resolveAllowedOrigins(
      configService.get('CORS_ORIGINS'),
      LOCAL_ENVIRONMENTS.has(environment),
    ),
  };
}

export function configureBodyParsers(
  app: NestExpressApplication,
  config: HttpRuntimeConfig,
): void {
  app.useBodyParser('json', { limit: config.bodyLimitBytes });
  app.useBodyParser('urlencoded', {
    extended: true,
    limit: config.bodyLimitBytes,
  });
}

export function configureCors(
  app: NestExpressApplication,
  config: HttpRuntimeConfig,
): void {
  const allowedOrigins = new Set(config.allowedOrigins);

  app.enableCors({
    credentials: true,
    methods: CORS_METHODS,
    origin: (origin, callback) => {
      callback(null, !origin || allowedOrigins.has(origin));
    },
  });
}

function normalizeEnvironment(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveAllowedOrigins(value: unknown, isLocal: boolean): string[] {
  const configuredValue = typeof value === 'string' ? value.trim() : '';

  if (!configuredValue) {
    if (isLocal) {
      return [...LOCAL_CORS_ORIGINS];
    }

    throw new Error('CORS_ORIGINS must be configured for exposed environments');
  }

  const origins = configuredValue.split(',').map((origin) => origin.trim());
  if (origins.some((origin) => !origin)) {
    throw new Error('CORS_ORIGINS contains an invalid origin');
  }

  return [
    ...new Set(origins.map((origin) => normalizeOrigin(origin, isLocal))),
  ];
}

function normalizeOrigin(value: string, isLocal: boolean): string {
  if (value === '*' || value.toLowerCase() === 'null' || value.includes('*')) {
    throw new Error('CORS_ORIGINS contains an invalid origin');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('CORS_ORIGINS contains an invalid origin');
  }

  const hasFunctionalPath = url.pathname !== '/' && url.pathname !== '';
  const hasCredentials = Boolean(url.username || url.password);
  if (
    !url.hostname ||
    hasFunctionalPath ||
    url.search ||
    url.hash ||
    hasCredentials ||
    (!isLocal && url.protocol !== 'https:') ||
    (isLocal && url.protocol !== 'http:' && url.protocol !== 'https:')
  ) {
    throw new Error('CORS_ORIGINS contains an invalid origin');
  }

  return url.origin;
}

function resolveInteger(
  value: unknown,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }

  return parsed;
}
