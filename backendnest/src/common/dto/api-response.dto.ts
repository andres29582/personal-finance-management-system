/**
 * Estructura estándar de respuesta exitosa
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  requestId: string;
}

/**
 * Estructura estándar de respuesta de error
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
  };
  timestamp: string;
  requestId: string;
}

/**
 * Tipo union de todas las posibles respuestas
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
