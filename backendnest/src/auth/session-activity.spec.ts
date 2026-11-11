import { isEligibleSessionActivity } from './session-activity';
describe('server activity classifier', () => {
  it.each(['/auth/session', '/users/me', '/dashboard', '/transacoes'])(
    'never accepts GET/background even with forged intent %s',
    (path) => {
      expect(
        isEligibleSessionActivity({
          method: 'GET',
          path,
          headers: { 'x-active': 'true' },
        } as never),
      ).toBe(false);
    },
  );
  it.each([
    '/auth/refresh',
    '/auth/logout',
    '/auth/reset-password',
    '/unknown',
    '/alertas/x/notificar',
  ])('unknown/special mutations are no-touch %s', (path) => {
    expect(isEligibleSessionActivity({ method: 'POST', path } as never)).toBe(
      false,
    );
  });
  it('accepts explicit financial mutation and ignores client intent', () => {
    expect(
      isEligibleSessionActivity({
        method: 'POST',
        path: '/transacoes',
        headers: { 'x-active': 'false' },
      } as never),
    ).toBe(true);
    expect(
      isEligibleSessionActivity({
        method: 'PATCH',
        path: '/users/me',
      } as never),
    ).toBe(true);
  });
});
