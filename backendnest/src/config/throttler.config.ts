import { ConfigService } from '@nestjs/config';

type ConfigReader = Pick<ConfigService, 'get'>;

export interface RuntimeThrottlerConfig {
  ttl: number;
  limit: number;
}

export function resolveThrottlerConfig(
  configService: ConfigReader,
): RuntimeThrottlerConfig {
  return {
    ttl: resolveInteger(
      configService.get('THROTTLE_TTL_MS'),
      'THROTTLE_TTL_MS',
      60000,
      1000,
      3600000,
    ),
    limit: resolveInteger(
      configService.get('THROTTLE_LIMIT'),
      'THROTTLE_LIMIT',
      60,
      1,
      10000,
    ),
  };
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
