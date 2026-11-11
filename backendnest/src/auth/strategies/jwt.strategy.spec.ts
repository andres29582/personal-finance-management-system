import { JwtStrategy } from './jwt.strategy';
const state = {
  serverNow: '2026-10-09T12:00:00Z',
  idleExpiresAt: '2026-10-09T12:15:00Z',
  absoluteExpiresAt: '2026-10-10T00:00:00Z',
  policyVersion: 1,
};
describe('JwtStrategy', () => {
  const sessions = { authorize: jest.fn() },
    context = { setUserId: jest.fn() };
  const config = {
    get: (key: string) =>
      key === 'JWT_ACCESS_SECRET' ? 'access-secret' : undefined,
  };
  const strategy = new JwtStrategy(
    config as never,
    sessions as never,
    context as never,
  );
  const payload = {
    sub: 'user-1',
    sid: 'session-1',
    email: 'ana@example.com',
    nome: 'Ana',
    tokenType: 'access',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    sessions.authorize.mockResolvedValue(state);
  });
  it.each([
    { ...payload, sid: undefined },
    { ...payload, tokenType: 'refresh' },
  ])('rejects invalid token metadata without lookup', async (data) => {
    await expect(strategy.validate({} as never, data)).rejects.toMatchObject({
      code: 'AUTH_INVALID_SESSION',
    });
    expect(sessions.authorize).not.toHaveBeenCalled();
  });
  it('delegates owner and atomic authorization, not split touch', async () => {
    expect(
      await strategy.validate(
        { method: 'GET', path: '/users/me' } as never,
        payload,
      ),
    ).toMatchObject({ id: 'user-1', sessionState: state });
    expect(sessions.authorize).toHaveBeenCalledWith(
      'session-1',
      'user-1',
      false,
    );
    expect(context.setUserId).toHaveBeenCalledWith('user-1');
  });
  it('marks only approved interactive mutations', async () => {
    await strategy.validate(
      {
        method: 'POST',
        path: '/transacoes',
        headers: { 'x-active': 'false' },
      } as never,
      payload,
    );
    expect(sessions.authorize).toHaveBeenCalledWith(
      'session-1',
      'user-1',
      true,
    );
  });
  it('does not accept terminal or transient denied authority', async () => {
    sessions.authorize.mockRejectedValue(new Error('denied'));
    await expect(strategy.validate({} as never, payload)).rejects.toThrow(
      'denied',
    );
    expect(context.setUserId).not.toHaveBeenCalled();
  });
});
