import { ConfigService } from '@nestjs/config';

export type MlApiConfig = {
  baseUrl: string;
  timeoutMs: number;
  internalApiKey?: string;
};

type ConfigReader = Pick<ConfigService, 'get'>;

export const ML_API_CONFIG = Symbol('ML_API_CONFIG');

const LOCAL_ENVIRONMENTS = new Set(['development', 'test']);
const MIN_INTERNAL_KEY_LENGTH = 32;
const PLACEHOLDER_PREFIXES = ['troque_', 'change_me', 'replace_me'];

export function resolveMlApiConfig(configService: ConfigReader): MlApiConfig {
  const environment = normalizeEnvironment(
    readConfig(configService, 'NODE_ENV'),
  );
  const localEnvironment = LOCAL_ENVIRONMENTS.has(environment);
  const internalApiKey = normalizeOptionalSecret(
    readConfig(configService, 'ML_INTERNAL_API_KEY'),
  );

  if (!localEnvironment) {
    validateExposedEnvironmentKey(internalApiKey);
  }

  return {
    baseUrl:
      readConfig(configService, 'ML_API_URL')?.trim() ??
      'http://127.0.0.1:8000',
    timeoutMs: resolveTimeoutMs(readConfig(configService, 'ML_API_TIMEOUT_MS')),
    internalApiKey,
  };
}

function normalizeEnvironment(environment?: string): string {
  const normalized = environment?.trim().toLowerCase() ?? '';
  return normalized || 'development';
}

function resolveTimeoutMs(timeout?: string): number {
  const normalized = timeout?.trim() ?? '';
  return normalized ? Number(normalized) : 5000;
}

function normalizeOptionalSecret(secret?: string): string | undefined {
  const normalized = secret?.trim();
  return normalized ? normalized : undefined;
}

function validateExposedEnvironmentKey(internalApiKey?: string): void {
  if (!internalApiKey) {
    throw new Error(
      'ML_INTERNAL_API_KEY is required outside development/test.',
    );
  }

  if (internalApiKey.length < MIN_INTERNAL_KEY_LENGTH) {
    throw new Error('ML_INTERNAL_API_KEY must have at least 32 characters.');
  }

  if (isPredictablePlaceholder(internalApiKey)) {
    throw new Error(
      'ML_INTERNAL_API_KEY must not use a predictable placeholder value.',
    );
  }
}

function isPredictablePlaceholder(secret: string): boolean {
  const normalized = secret.trim().toLowerCase();
  return PLACEHOLDER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function readConfig(
  configService: ConfigReader,
  key: string,
): string | undefined {
  return configService.get<string>(key);
}
