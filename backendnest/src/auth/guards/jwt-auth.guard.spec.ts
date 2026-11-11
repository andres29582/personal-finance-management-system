import { JwtAuthGuard } from './jwt-auth.guard';
describe('JwtAuthGuard pre-handler failure contract', () => {
  const guard = new JwtAuthGuard();
  it('identifies only Passport token expiration as safe pre-handler rejection', () => {
    expect(() =>
      guard.handleRequest(null, null, { name: 'TokenExpiredError' }),
    ).toThrow(
      expect.objectContaining({
        code: 'AUTH_ACCESS_TOKEN_EXPIRED',
        statusCode: 401,
      }),
    );
  });
  it.each(['JsonWebTokenError', 'Error', undefined])(
    'preserves ordinary 401 for invalid/missing JWT %s',
    (name) => {
      expect(() => guard.handleRequest(null, null, { name })).toThrow(
        expect.objectContaining({ status: 401 }),
      );
    },
  );
  it('propagates session/transient errors without reclassifying and passes authenticated user', () => {
    const error = new Error('DB unavailable');
    expect(() => guard.handleRequest(error, null, {})).toThrow(error);
    expect(guard.handleRequest(null, { id: 'A' }, {})).toEqual({ id: 'A' });
  });
});
