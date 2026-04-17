import { clearSession } from '../storage/authStorage';

type ApiLikeError = {
  response?: {
    data?: {
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
  const resolvedBackendMessage = Array.isArray(backendMessage)
    ? backendMessage[0]
    : backendMessage;

  if (status === 401) {
    await clearSession();

    return {
      message: 'Sessao expirada. Faca login novamente.',
      unauthorized: true,
    };
  }

  return {
    message: status
      ? messagesByStatus[status] ?? resolvedBackendMessage ?? fallbackMessage
      : fallbackMessage,
    unauthorized: false,
  };
}
