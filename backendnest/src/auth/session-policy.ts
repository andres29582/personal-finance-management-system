import { ConfigService } from '@nestjs/config';
import { AuthSession } from './entities/auth-session.entity';
import { AppUnauthorizedException } from '../common/exceptions';

export type SessionPolicy = {
  idleSeconds: number;
  absoluteSeconds: number;
  version: number;
};
export type SessionFailure =
  | 'AUTH_INVALID_SESSION'
  | 'AUTH_SESSION_REVOKED'
  | 'AUTH_SESSION_IDLE_EXPIRED'
  | 'AUTH_SESSION_ABSOLUTE_EXPIRED';
export type SessionState = {
  serverNow: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  policyVersion: number;
};
export function resolveSessionPolicy(
  config: Pick<ConfigService, 'get'>,
): SessionPolicy {
  const integer = (key: string, fallback: number) => {
    const raw = config.get<string>(key);
    const value = raw === undefined ? fallback : Number(raw);
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 31536000 ||
      raw?.trim() === ''
    )
      throw new Error(`${key} must be a bounded positive integer.`);
    return value;
  };
  const idleSeconds = integer('AUTH_SESSION_IDLE_SECONDS', 900);
  const absoluteSeconds = integer('AUTH_SESSION_ABSOLUTE_SECONDS', 43200);
  const version = integer('AUTH_SESSION_POLICY_VERSION', 1);
  if (idleSeconds > absoluteSeconds || version !== 1)
    throw new Error('Invalid session policy.');
  return { idleSeconds, absoluteSeconds, version };
}
export function sessionFailure(
  session: AuthSession | null,
  userId: string,
  now: Date,
): SessionFailure | null {
  if (!session || session.userId !== userId) return 'AUTH_INVALID_SESSION';
  if (session.revokedAt)
    return session.terminalReason ?? 'AUTH_SESSION_REVOKED';
  const dates = [
    session.authenticatedAt,
    session.lastActivityAt,
    session.absoluteExpiresAt,
    session.refreshExpiresAt,
  ];
  if (
    session.policyVersion !== 1 ||
    !Number.isSafeInteger(session.idleTimeoutSeconds) ||
    !session.idleTimeoutSeconds ||
    session.idleTimeoutSeconds < 1 ||
    !Number.isFinite(now.getTime()) ||
    dates.some(
      (date) => !(date instanceof Date) || !Number.isFinite(date.getTime()),
    )
  )
    return 'AUTH_INVALID_SESSION';
  const start = session.authenticatedAt!.getTime(),
    activity = session.lastActivityAt!.getTime();
  if (
    start > now.getTime() ||
    activity > now.getTime() ||
    activity < start ||
    session.absoluteExpiresAt!.getTime() <= start
  )
    return 'AUTH_INVALID_SESSION';
  if (now.getTime() >= session.absoluteExpiresAt!.getTime())
    return 'AUTH_SESSION_ABSOLUTE_EXPIRED';
  if (now.getTime() >= session.refreshExpiresAt!.getTime())
    return 'AUTH_INVALID_SESSION';
  if (now.getTime() >= activity + session.idleTimeoutSeconds * 1000)
    return 'AUTH_SESSION_IDLE_EXPIRED';
  return null;
}
export function sessionState(session: AuthSession, now: Date): SessionState {
  return {
    serverNow: now.toISOString(),
    idleExpiresAt: new Date(
      Math.min(
        session.lastActivityAt!.getTime() + session.idleTimeoutSeconds! * 1000,
        session.absoluteExpiresAt!.getTime(),
        session.refreshExpiresAt!.getTime(),
      ),
    ).toISOString(),
    absoluteExpiresAt: session.absoluteExpiresAt!.toISOString(),
    policyVersion: session.policyVersion!,
  };
}
export function rejectSession(code: SessionFailure): never {
  throw new AppUnauthorizedException(
    code,
    'Sessao encerrada. Faca login novamente.',
  );
}
export function cappedExpiration(exp: number, absolute: Date): number {
  if (!Number.isSafeInteger(exp) || !Number.isFinite(absolute.getTime()))
    throw new Error('Invalid token deadline.');
  return Math.min(exp, Math.floor(absolute.getTime() / 1000));
}
