import { Request } from 'express';
import { resolveRequestId } from './request-id.middleware';

describe('resolveRequestId', () => {
  it('preserves a trimmed upstream request ID', () => {
    const request = {
      headers: { 'x-request-id': '  gateway-request-1  ' },
    } as unknown as Request;

    expect(resolveRequestId(request)).toBe('gateway-request-1');
  });

  it.each([[''], ['x'.repeat(129)], [['request-1', 'request-2']]])(
    'generates an ID for invalid upstream values',
    (header) => {
      const request = {
        headers: { 'x-request-id': header },
      } as unknown as Request;

      const requestId = resolveRequestId(request);

      expect(requestId).toEqual(expect.any(String));
      expect(requestId).not.toBe(header);
      expect(requestId.length).toBeGreaterThan(0);
      expect(requestId.length).toBeLessThanOrEqual(128);
    },
  );
});
