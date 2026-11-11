import { isCancel } from 'axios';
import { SessionRequestError } from './session-error';
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
  authRequestRejected?: boolean;
};
export type ResolvedApiError = {
  code?: string;
  details?: Record<string, unknown>;
  message: string;
  requestId?: string;
  unauthorized: boolean;
};
export async function resolveApiError(error: unknown, fallbackMessage: string, messagesByStatus: Record<number, string> = {}): Promise<ResolvedApiError> {
  if (isCancel(error) || error instanceof SessionRequestError) {
    return {
      message: error instanceof SessionRequestError
        ? error.sessionFailure === 'unknown' ? 'Não foi possível confirmar a renovação da sessão. Faça login novamente.'
          : error.sessionFailure === 'compatibility' ? 'Este navegador não oferece a coordenação segura de sessões necessária. Use um navegador compatível em conexão segura.'
            : error.sessionFailure === 'unavailable' ? 'Sessao temporariamente indisponivel. Tente novamente.' : '' : '',
      unauthorized: error instanceof SessionRequestError && error.sessionFailure === 'unknown',
    };
  }
  const status = (error as ApiLikeError)?.response?.status;
  const responseData = (error as ApiLikeError)?.response?.data;
  const typedError = responseData?.error;
  const contract = {
    code: typedError?.code,
    details: typedError?.details,
    requestId: responseData?.requestId,
  };
  if (status === 401) {
    return {
      ...contract,
      message: messagesByStatus[status] ?? ((error as ApiLikeError).authRequestRejected
        ? typedError?.message ?? fallbackMessage : 'Sessao expirada. Faca login novamente.'),
      unauthorized: !(error as ApiLikeError).authRequestRejected,
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
