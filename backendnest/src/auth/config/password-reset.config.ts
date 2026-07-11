import { ConfigService } from '@nestjs/config';

export type PasswordResetConfig = {
  returnResetToken: boolean;
  ttlMinutes: number;
};

type ConfigReader = Pick<ConfigService, 'get'>;

const RESET_TOKEN_ALLOWED_ENVIRONMENTS = new Set(['development', 'test']);

export function resolvePasswordResetConfig(
  configService: ConfigReader,
): PasswordResetConfig {
  const nodeEnv = normalizeConfigValue(configService.get<string>('NODE_ENV'));
  const returnTokenFlag = normalizeConfigValue(
    configService.get<string>('AUTH_RETURN_RESET_TOKEN'),
  );
  const returnResetToken = returnTokenFlag === 'true';

  if (returnResetToken && !RESET_TOKEN_ALLOWED_ENVIRONMENTS.has(nodeEnv)) {
    throw new Error(
      'AUTH_RETURN_RESET_TOKEN nao pode ser habilitado fora de development/test.',
    );
  }

  return {
    returnResetToken,
    ttlMinutes: Number(
      configService.get<string>('PASSWORD_RESET_TTL_MINUTES') ?? '60',
    ),
  };
}

function normalizeConfigValue(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}
