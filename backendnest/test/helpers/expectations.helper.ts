import { Response } from 'supertest';
import { unwrapSuccess } from './http.helper';

type ApiErrorEnvelope = {
  success?: boolean;
  error?: {
    code?: string;
  };
  message?: string;
  statusCode?: number;
};

export function expectApiSuccess<T>(response: Response): T {
  return unwrapSuccess<T>(response);
}

export function expectMoney(
  actual: number | string | null | undefined,
  expected: number,
): void {
  expect(Number(actual)).toBeCloseTo(expected, 2);
}

export function expectUnauthorized(response: Response): void {
  const body = response.body as ApiErrorEnvelope;

  expect(response.status).toBe(401);

  if (body.success === false) {
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: expect.any(String) as string,
        }) as ApiErrorEnvelope['error'],
      }),
    );
    return;
  }

  expect(body).toEqual(
    expect.objectContaining({
      message: expect.any(String) as string,
      statusCode: 401,
    }),
  );
}

export function expectValidIsoTimestamp(value: unknown): void {
  expect(typeof value).toBe('string');
  expect(Number.isNaN(Date.parse(value as string))).toBe(false);
}
