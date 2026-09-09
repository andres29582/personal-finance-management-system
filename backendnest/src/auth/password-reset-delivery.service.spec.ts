import { ConfigService } from '@nestjs/config';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';

describe('PasswordResetDeliveryService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends reset instructions to the configured production HTTPS endpoint', async () => {
    const fetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue({ ok: true } as Response);
    const originalFetch = global.fetch;
    global.fetch = fetchMock as typeof fetch;
    const values: Record<string, string> = {
      NODE_ENV: 'production',
      PASSWORD_RESET_DELIVERY_API_KEY:
        'password-reset-delivery-api-key-at-least-32-chars',
      PASSWORD_RESET_DELIVERY_URL: 'https://mailer.example.test/password-reset',
    };
    const service = new PasswordResetDeliveryService({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService);

    try {
      await service.deliver({
        email: 'ana@example.com',
        expiresAt: new Date('2026-09-09T12:00:00.000Z'),
        resetToken: 'plain-reset-token',
      });
    } finally {
      global.fetch = originalFetch;
    }

    expect(fetchMock).toHaveBeenCalledWith(
      'https://mailer.example.test/password-reset',
      expect.objectContaining({
        body: JSON.stringify({
          email: 'ana@example.com',
          expiresAt: '2026-09-09T12:00:00.000Z',
          resetToken: 'plain-reset-token',
        }),
        method: 'POST',
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual(
      expect.objectContaining({
        Authorization:
          'Bearer password-reset-delivery-api-key-at-least-32-chars',
      }),
    );
  });
});
