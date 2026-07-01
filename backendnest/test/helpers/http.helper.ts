import { Response } from 'supertest';

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  requestId: string;
  timestamp: string;
};

export type Identifiable = {
  id: string;
};

export function bearer(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function unwrapSuccess<T>(response: Response): T {
  const body = response.body as Partial<ApiSuccessResponse<T>>;

  expect(body).toEqual(
    expect.objectContaining({
      success: true,
      data: expect.anything() as T,
      requestId: expect.any(String) as string,
      timestamp: expect.any(String) as string,
    }),
  );

  return body.data as T;
}
