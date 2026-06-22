import { clearSession } from '../storage/authStorage';

type ApiLikeError = {
  response?: {
    data?: {
      error?: {
        code?: string;
        details?: Record<string, unknown>;
        message?: string;
      };
      message?: string | string[];
    };
    status?: number;
  };
};

export async function resolveApiError(
  error: unknown,
  fallbackMessage: string,
  messagesByStatus: Record<number, string> = {},
) {
  const status = (error as ApiLikeError)?.response?.status;
  const backendMessage = (error as ApiLikeError)?.response?.data?.message;
  const typedError = (error as ApiLikeError)?.response?.data?.error;
  const resolvedBackendMessage = Array.isArray(backendMessage)
    ? backendMessage[0]
    : backendMessage;

  if (status === 401) {
    await clearSession();

    return {
      message:
        messagesByStatus[status] ?? 'Sessao expirada. Faca login novamente.',
      unauthorized: true,
    };
  }

  return {
    code: typedError?.code,
    details: typedError?.details,
    message: status
      ? messagesByStatus[status] ??
        typedError?.message ??
        resolvedBackendMessage ??
        fallbackMessage
      : fallbackMessage,
    unauthorized: false,
  };
}
