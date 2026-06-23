import { Response } from 'supertest';

export type Identifiable = {
  id: string;
};

export function bearer(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function unwrapSuccess<T>(response: Response): T {
  expect(response.body).toEqual(
    expect.objectContaining({
      success: true,
      data: expect.anything(),
      requestId: expect.any(String),
      timestamp: expect.any(String),
    }),
  );

  return response.body.data as T;
}
