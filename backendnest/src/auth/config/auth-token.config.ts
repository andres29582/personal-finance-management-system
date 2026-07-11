import { ConfigService } from '@nestjs/config';

export type AuthTokenConfig = {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
};

type ConfigReader = Pick<ConfigService, 'get'>;

const MIN_SECURE_SECRET_LENGTH = 32;
const PLACEHOLDER_PREFIXES = ['troque_', 'change_me', 'replace_me'];

export function resolveAuthTokenConfig(
  configService: ConfigReader,
): AuthTokenConfig {
  const environment = normalizeEnvironment(
    readConfig(configService, 'NODE_ENV'),
  );
  const secureEnvironment = isSecureEnvironment(environment);
  const accessSecret = resolveAccessSecret(configService, secureEnvironment);
  const refreshSecret = resolveRefreshSecret(
    configService,
    secureEnvironment,
    accessSecret,
  );

  validateExplicitSecrets(configService, accessSecret, refreshSecret);

  if (secureEnvironment) {
    validateSecureSecret('JWT_ACCESS_SECRET', accessSecret);
    validateSecureSecret('JWT_REFRESH_SECRET', refreshSecret);
  }

  return {
    accessSecret,
    refreshSecret,
    accessExpiresIn:
      readConfig(configService, 'JWT_ACCESS_EXPIRES_IN')?.trim() ?? '15m',
    refreshExpiresIn:
      readConfig(configService, 'JWT_REFRESH_EXPIRES_IN')?.trim() ?? '30d',
  };
}

function resolveAccessSecret(
  configService: ConfigReader,
  secureEnvironment: boolean,
): string {
  const explicitAccessSecret = normalizeSecret(
    readConfig(configService, 'JWT_ACCESS_SECRET'),
  );

  if (explicitAccessSecret) {
    return explicitAccessSecret;
  }

  if (secureEnvironment) {
    throw new Error(
      'JWT_ACCESS_SECRET is required in production and demo environments.',
    );
  }

  const legacySecret = normalizeSecret(readConfig(configService, 'JWT_SECRET'));

  if (legacySecret) {
    return legacySecret;
  }

  throw new Error('JWT_ACCESS_SECRET is required for authentication tokens.');
}

function resolveRefreshSecret(
  configService: ConfigReader,
  secureEnvironment: boolean,
  accessSecret: string,
): string {
  const explicitRefreshSecret = normalizeSecret(
    readConfig(configService, 'JWT_REFRESH_SECRET'),
  );

  if (explicitRefreshSecret) {
    return explicitRefreshSecret;
  }

  if (secureEnvironment) {
    throw new Error(
      'JWT_REFRESH_SECRET is required in production and demo environments.',
    );
  }

  // Temporary compatibility for local development and tests that predate
  // explicit refresh-token secrets. Do not use this in demo or production.
  return `${accessSecret}_refresh`;
}

function validateExplicitSecrets(
  configService: ConfigReader,
  accessSecret: string,
  refreshSecret: string,
): void {
  const explicitRefreshSecret = normalizeSecret(
    readConfig(configService, 'JWT_REFRESH_SECRET'),
  );

  if (explicitRefreshSecret && accessSecret === refreshSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.',
    );
  }
}

function validateSecureSecret(name: string, secret: string): void {
  if (secret.length < MIN_SECURE_SECRET_LENGTH) {
    throw new Error(`${name} must have at least 32 characters.`);
  }

  if (isPredictablePlaceholder(secret)) {
    throw new Error(`${name} must not use a predictable placeholder value.`);
  }
}

function normalizeEnvironment(environment?: string): string {
  return environment?.trim().toLowerCase() ?? '';
}

function isSecureEnvironment(environment: string): boolean {
  return environment === 'production' || environment === 'demo';
}

function normalizeSecret(secret?: string): string | undefined {
  const normalized = secret?.trim();
  return normalized ? normalized : undefined;
}

function isPredictablePlaceholder(secret: string): boolean {
  const normalizedSecret = secret.trim().toLowerCase();
  return PLACEHOLDER_PREFIXES.some((prefix) =>
    normalizedSecret.startsWith(prefix),
  );
}

function readConfig(
  configService: ConfigReader,
  key: string,
): string | undefined {
  return configService.get<string>(key);
}
