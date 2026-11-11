export type PasswordChangedDelivery = {
  kind: 'accepted' | 'simulated' | 'retry' | 'failed' | 'reconciliation';
  code: string;
  providerId?: string;
  retryAfterMs?: number;
};

export function passwordChangedPayload(
  sender: string,
  recipient: string,
  occurredAt: Date,
): string {
  const time = occurredAt.toISOString();
  const text = `Sua senha foi alterada em ${time}. Se voce nao realizou esta alteracao, recupere sua conta pelo aplicativo e contate o suporte. Nunca compartilhe sua senha.`;
  return JSON.stringify({
    from: sender,
    to: [recipient],
    subject: 'Sua senha foi alterada',
    html: `<p>${text}</p>`,
    text,
  });
}

// Internal contract adapter. Runtime worker NEVER authorizes network in this phase.
// Tests exercise the HTTPS contract only with a stubbed fetch and synthetic key.
export async function sendPasswordChanged(
  payload: string,
  eventId: string,
  options: { networkEnabled: boolean; apiKey?: string },
): Promise<PasswordChangedDelivery> {
  if (!options.networkEnabled)
    return { kind: 'simulated', code: 'DEVELOPMENT_SIMULATED' };
  if (!options.apiKey) return { kind: 'failed', code: 'CONFIG_DISABLED' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `password-changed/${eventId}`,
      },
      body: payload,
    });
    const body: unknown = await response.json();
    const record =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    if (response.ok) {
      if (
        typeof record.id === 'string' &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(record.id)
      )
        return { kind: 'accepted', code: 'ACCEPTED', providerId: record.id };
      return { kind: 'retry', code: 'AMBIGUOUS_RESPONSE' };
    }
    const code = typeof record.name === 'string' ? record.name : '';
    if (
      response.status === 429 &&
      ['daily_quota_exceeded', 'monthly_quota_exceeded'].includes(code)
    )
      return { kind: 'failed', code: 'PROVIDER_QUOTA' };
    if (response.status === 409 && code !== 'concurrent_idempotent_requests')
      return { kind: 'reconciliation', code: 'IDEMPOTENCY_CONFLICT' };
    if (
      response.status === 429 ||
      response.status >= 500 ||
      (response.status === 409 && code === 'concurrent_idempotent_requests')
    ) {
      const seconds = Number(response.headers.get('Retry-After'));
      return {
        kind: 'retry',
        code:
          response.status === 429
            ? 'PROVIDER_RATE_LIMIT'
            : 'PROVIDER_TRANSIENT',
        ...(Number.isFinite(seconds) && seconds > 0
          ? { retryAfterMs: Math.min(seconds * 1000, 3600_000) }
          : {}),
      };
    }
    return { kind: 'failed', code: 'PROVIDER_REJECTED' };
  } catch {
    return { kind: 'retry', code: 'NETWORK_OR_TIMEOUT' };
  }
}
