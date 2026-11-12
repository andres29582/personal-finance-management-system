import type { ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { of } from 'rxjs';
import { AuthorizedRequestAdmissions } from '../../test/helpers/authorized-request-admission';

function fixture(token?: string, authenticated = true) {
  const response = new EventEmitter();
  const request = {
    header: (name: string) => (name === 'X-E2E-Admission' ? token : undefined),
    user: authenticated ? { id: 'owner' } : undefined,
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
  const next = { handle: jest.fn(() => of('handler')) };
  return { context, response, next };
}
it('holds an already authenticated request until explicitly released', async () => {
  const admissions = new AuthorizedRequestAdmissions();
  const held = admissions.hold();
  const f = fixture(held.token);
  const pending = admissions.intercept(f.context, f.next);
  await held.entered;
  expect(f.next.handle).not.toHaveBeenCalled();
  held.release();
  await pending;
  expect(f.next.handle).toHaveBeenCalledTimes(1);
  expect(f.response.listenerCount('close')).toBe(0);
});
it('does not stage ordinary requests', async () => {
  const f = fixture();
  await new AuthorizedRequestAdmissions().intercept(f.context, f.next);
  expect(f.next.handle).toHaveBeenCalledTimes(1);
});
it('rejects unknown tokens and requests that did not finish authentication', async () => {
  const admissions = new AuthorizedRequestAdmissions();
  const held = admissions.hold();
  for (const f of [fixture('unknown'), fixture(held.token, false)]) {
    await expect(admissions.intercept(f.context, f.next)).rejects.toThrow(
      'Authenticated',
    );
    expect(f.next.handle).not.toHaveBeenCalled();
  }
  admissions.cancelAll();
});
it.each(['disconnect', 'cleanup'])(
  'never starts financial work after %s cancels a held request',
  async (mode) => {
    const admissions = new AuthorizedRequestAdmissions();
    const held = admissions.hold();
    const f = fixture(held.token);
    const pending = admissions.intercept(f.context, f.next);
    await held.entered;
    if (mode === 'disconnect') f.response.emit('close');
    else admissions.cancelAll();
    held.release();
    await expect(pending).rejects.toThrow('cancelled');
    expect(f.next.handle).not.toHaveBeenCalled();
    expect(f.response.listenerCount('close')).toBe(0);
  },
);
