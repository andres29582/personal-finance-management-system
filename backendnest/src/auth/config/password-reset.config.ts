import { ConfigService } from '@nestjs/config';

export type PasswordResetConfig = {
  deliveryApiKey?: string;
  deliveryUrl?: string;
  returnResetToken: boolean;
  ttlMinutes: number;
};

type ConfigReader = Pick<ConfigService, 'get'>;

const LOCAL_ENVIRONMENTS = new Set(['development', 'test']);
const MIN_DELIVERY_API_KEY_LENGTH = 32;
const PLACEHOLDER_PREFIXES = ['troque_', 'change_me', 'replace_me'];

export function resolvePasswordResetConfig(
  configService: ConfigReader,
): PasswordResetConfig {
  const nodeEnv = normalizeConfigValue(configService.get<string>('NODE_ENV'));
  const localEnvironment = LOCAL_ENVIRONMENTS.has(nodeEnv);
  const returnResetToken =
    normalizeConfigValue(
      configService.get<string>('AUTH_RETURN_RESET_TOKEN'),
    ) === 'true';
  const deliveryUrl = normalizeOptionalValue(
    configService.get<string>('PASSWORD_RESET_DELIVERY_URL'),
  );
  const deliveryApiKey = normalizeOptionalValue(
    configService.get<string>('PASSWORD_RESET_DELIVERY_API_KEY'),
  );

  if (returnResetToken && !localEnvironment) {
    throw new Error(
      'AUTH_RETURN_RESET_TOKEN nao pode ser habilitado fora de development/test.',
    );
  }

  if (!localEnvironment) {
    validateDeliveryConfiguration(deliveryUrl, deliveryApiKey);
  }

  return {
    deliveryApiKey,
    deliveryUrl,
    returnResetToken,
    ttlMinutes: resolveTtlMinutes(
      configService.get<string>('PASSWORD_RESET_TTL_MINUTES'),
    ),
  };
}

function validateDeliveryConfiguration(
  deliveryUrl: string | undefined,
  deliveryApiKey: string | undefined,
): void {
  if (!deliveryUrl) {
    throw new Error(
      'PASSWORD_RESET_DELIVERY_URL is required outside development/test.',
    );
  }

  let url: URL;
  try {
    url = new URL(deliveryUrl);
  } catch {
    throw new Error('PASSWORD_RESET_DELIVERY_URL must be a valid HTTPS URL.');
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('PASSWORD_RESET_DELIVERY_URL must be a valid HTTPS URL.');
  }

  if (!deliveryApiKey || deliveryApiKey.length < MIN_DELIVERY_API_KEY_LENGTH) {
    throw new Error(
      'PASSWORD_RESET_DELIVERY_API_KEY must have at least 32 characters outside development/test.',
    );
  }

  if (
    PLACEHOLDER_PREFIXES.some((prefix) =>
      deliveryApiKey.toLowerCase().startsWith(prefix),
    )
  ) {
    throw new Error(
      'PASSWORD_RESET_DELIVERY_API_KEY must not use a predictable placeholder value.',
    );
  }
}

function resolveTtlMinutes(value: string | undefined): number {
  const normalized = value?.trim() ?? '';
  const ttlMinutes = normalized ? Number(normalized) : 60;

  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 1440) {
    throw new Error(
      'PASSWORD_RESET_TTL_MINUTES must be an integer between 1 and 1440.',
    );
  }

  return ttlMinutes;
}

function normalizeConfigValue(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
