import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'request-1' }),
    }),
  } as unknown as ExecutionContext;

  it.each([
    ['undefined', undefined, null],
    ['null', null, null],
    ['zero', 0, 0],
    ['false', false, false],
    ['empty string', '', ''],
    ['empty array', [], []],
    ['empty object', {}, {}],
  ])('normalizes the %s payload correctly', async (_label, data, expected) => {
    const next = { handle: () => of(data) } as CallHandler<unknown>;

    await expect(
      firstValueFrom(new ResponseInterceptor().intercept(context, next)),
    ).resolves.toEqual({
      success: true,
      data: expected,
      timestamp: expect.any(String) as string,
      requestId: 'request-1',
    });
  });
});
