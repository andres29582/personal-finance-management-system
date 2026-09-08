import { clearSession } from '../storage/authStorage';

type ApiLikeError = {
  response?: {
    data?: {
      error?: {
        code?: string;
        details?: Record<string, unknown>;
        message?: string;
      };
      requestId?: string;
    };
    status?: number;
  };
};

export type ResolvedApiError = {
  code?: string;
  details?: Record<string, unknown>;
  message: string;
  requestId?: string;
  unauthorized: boolean;
};

export async function resolveApiError(
  error: unknown,
  fallbackMessage: string,
  messagesByStatus: Record<number, string> = {},
): Promise<ResolvedApiError> {
  const status = (error as ApiLikeError)?.response?.status;
  const responseData = (error as ApiLikeError)?.response?.data;
  const typedError = responseData?.error;
  const contract = {
    code: typedError?.code,
    details: typedError?.details,
    requestId: responseData?.requestId,
  };

  if (status === 401) {
    await clearSession();

    return {
      ...contract,
      message:
        messagesByStatus[status] ?? 'Sessao expirada. Faca login novamente.',
      unauthorized: true,
    };
  }

  return {
    ...contract,
    message: status
      ? messagesByStatus[status] ??
        typedError?.message ??
        fallbackMessage
      : fallbackMessage,
    unauthorized: false,
  };
}
