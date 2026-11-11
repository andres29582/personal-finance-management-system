import { ConfigService } from '@nestjs/config';

export const PASSWORD_CHANGED_LEASE_MS = 60_000;
export const PASSWORD_CHANGED_RETRY_WINDOW_MS = 22 * 60 * 60 * 1000;
export const PASSWORD_CHANGED_MAX_ATTEMPTS = 5;

export function passwordChangedConfig(config: Pick<ConfigService, 'get'>) {
  const live =
    config.get<string>('PASSWORD_CHANGED_RESEND_LIVE_ENABLED') ?? 'false';
  if (live !== 'false')
    throw new Error(
      'Live password-change delivery is not authorized in this development phase.',
    );
  const enabled =
    config.get<string>('PASSWORD_CHANGED_WORKER_ENABLED') ?? 'false';
  if (!['true', 'false'].includes(enabled))
    throw new Error('Invalid password-change worker flag.');
  if (enabled === 'false')
    return { enabled: false, sender: 'onboarding@resend.dev' };
  if (!['development', 'test'].includes(config.get<string>('NODE_ENV') ?? ''))
    throw new Error('Password-change worker is development-only.');
  const sender =
    config.get<string>('PASSWORD_CHANGED_SENDER') ?? 'onboarding@resend.dev';
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(sender) || sender.length > 150)
    throw new Error('Invalid password-change sender.');
  return { enabled: true, sender };
}
