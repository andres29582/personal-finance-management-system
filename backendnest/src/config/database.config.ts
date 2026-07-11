import { ConfigService } from '@nestjs/config';

export type DatabaseConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: false | { rejectUnauthorized: true; ca?: string };
};

type DatabaseConfigSource = Pick<ConfigService, 'get'>;

const LOCAL_ENVIRONMENTS = new Set(['development', 'test']);
const ADMIN_DATABASES = new Set(['postgres', 'template0', 'template1']);
const PREDICTABLE_PASSWORDS = new Set([
  'postgres',
  'password',
  '1234',
  'admin',
]);
const PREDICTABLE_PASSWORD_PREFIXES = ['troque_', 'change_me', 'replace_me'];

export function resolveDatabaseConfig(
  configService: DatabaseConfigSource,
): DatabaseConfig {
  const environment = (configService.get<string>('NODE_ENV') ?? '')
    .trim()
    .toLowerCase();
  const isLocalEnvironment = LOCAL_ENVIRONMENTS.has(environment);
  const host = requiredTrimmed(configService, 'DB_HOST');
  const username = requiredTrimmed(configService, 'DB_USERNAME');
  const password = requiredPassword(configService);
  const database = requiredTrimmed(configService, 'DB_NAME');
  const port = resolvePort(configService.get<string>('DB_PORT'));
  const sslMode = resolveSslMode(
    configService.get<string>('DB_SSL_MODE'),
    isLocalEnvironment,
  );
  const caBase64 = configService.get<string>('DB_SSL_CA_BASE64')?.trim() ?? '';

  if (!isLocalEnvironment) {
    validateExposedConfiguration(password, database, sslMode);
  }

  if (sslMode === 'disable') {
    if (caBase64) {
      throw new Error(
        'DB_SSL_CA_BASE64 cannot be configured when DB_SSL_MODE is disable.',
      );
    }

    return { host, port, username, password, database, ssl: false };
  }

  const ca = caBase64 ? decodeCertificateAuthority(caBase64) : undefined;

  return {
    host,
    port,
    username,
    password,
    database,
    ssl: ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true },
  };
}

function requiredTrimmed(
  configService: DatabaseConfigSource,
  key: string,
): string {
  const value = configService.get<string>(key)?.trim();

  if (!value) {
    throw new Error(`${key} is required and cannot be empty.`);
  }

  return value;
}

function requiredPassword(configService: DatabaseConfigSource): string {
  const password = configService.get<string>('DB_PASSWORD');

  if (password === undefined || password.trim().length === 0) {
    throw new Error('DB_PASSWORD is required and cannot be empty.');
  }

  return password;
}

function resolvePort(value: string | undefined): number {
  const normalized = value?.trim() || '5432';

  if (!/^\d+$/.test(normalized)) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  const port = Number(normalized);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function resolveSslMode(
  value: string | undefined,
  isLocalEnvironment: boolean,
): 'disable' | 'verify-full' {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    if (isLocalEnvironment) {
      return 'disable';
    }

    throw new Error(
      'DB_SSL_MODE must be verify-full outside development and test.',
    );
  }

  if (normalized !== 'disable' && normalized !== 'verify-full') {
    throw new Error('DB_SSL_MODE must be either disable or verify-full.');
  }

  return normalized;
}

function validateExposedConfiguration(
  password: string,
  database: string,
  sslMode: 'disable' | 'verify-full',
): void {
  if (sslMode !== 'verify-full') {
    throw new Error(
      'DB_SSL_MODE must be verify-full outside development and test.',
    );
  }

  if (password.length < 12) {
    throw new Error(
      'DB_PASSWORD must contain at least 12 characters outside development and test.',
    );
  }

  const normalizedPassword = password.trim().toLowerCase();
  if (
    PREDICTABLE_PASSWORDS.has(normalizedPassword) ||
    PREDICTABLE_PASSWORD_PREFIXES.some((prefix) =>
      normalizedPassword.startsWith(prefix),
    )
  ) {
    throw new Error(
      'DB_PASSWORD is predictable and is not allowed outside development and test.',
    );
  }

  if (ADMIN_DATABASES.has(database.toLowerCase())) {
    throw new Error(
      'DB_NAME must identify a dedicated database outside development and test.',
    );
  }
}

function decodeCertificateAuthority(value: string): string {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw new Error('DB_SSL_CA_BASE64 must contain valid Base64-encoded PEM.');
  }

  const ca = Buffer.from(value, 'base64').toString('utf8');
  if (
    !ca.trim() ||
    !ca.includes('-----BEGIN CERTIFICATE-----') ||
    !ca.includes('-----END CERTIFICATE-----')
  ) {
    throw new Error(
      'DB_SSL_CA_BASE64 must decode to a PEM certificate with valid delimiters.',
    );
  }

  return ca;
}
