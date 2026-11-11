import { act, renderHook } from '@testing-library/react-native';
import { useFinancialDraft } from '../../src/shared/hooks/useFinancialDraft';
import { getSessionAuthority } from '../../src/modules/auth/services/sessionAuthority';
import { isLocallySignedOut } from '../../storage/authStorage';
import { readFinancialDraft } from '../../storage/financialDrafts';
jest.mock('../../storage/authStorage', () => ({
  getSessionGeneration: () => 1,
  isLocallySignedOut: jest.fn(),
  subscribeAuthState: () => () => {},
}));
jest.mock('../../src/modules/auth/services/sessionAuthority', () => ({
  getSessionAuthority: jest.fn(),
  subscribeSessionAuthority: () => () => {},
}));
beforeEach(() => {
  jest.mocked(isLocallySignedOut).mockReturnValue(true);
  readFinancialDraft('hook');
  jest.mocked(isLocallySignedOut).mockReturnValue(false);
  jest.mocked(getSessionAuthority).mockReturnValue({
    snapshot: { incarnation: 'A', sessionId: 'session', generation: 1 },
  } as never);
});
it('rejects a same-owner stale writer after a newer instance changes the store version', () => {
  const first = renderHook(() => useFinancialDraft('hook', { valor: '' }));
  act(() => first.result.current.setField('valor', '100'));
  const next = renderHook(() => useFinancialDraft('hook', { valor: '' }));
  act(() => next.result.current.setField('valor', '200'));
  act(() => first.result.current.setField('valor', '300'));
  expect(readFinancialDraft<{ valor: string }>('hook')?.fields.valor).toBe(
    '200',
  );
});
it('rejects setters and captures from a previous route scope and after unmount', () => {
  const hook = renderHook<
    ReturnType<typeof useFinancialDraft<{ valor: string }>>,
    { scope: string }
  >(({ scope }) => useFinancialDraft(scope, { valor: '' }), {
    initialProps: { scope: 'hook' },
  });
  const previous = hook.result.current;
  hook.rerender({ scope: 'hook/other' });
  act(() => previous.setField('valor', 'obsolete'));
  expect(readFinancialDraft('hook')).toBeNull();
  expect(previous.isCurrent(previous.capture())).toBe(false);
  const setter = hook.result.current.setField;
  hook.unmount();
  act(() => setter('valor', 'unmounted'));
  expect(readFinancialDraft('hook/other')).toBeNull();
});
