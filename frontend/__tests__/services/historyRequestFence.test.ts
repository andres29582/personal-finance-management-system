import { createHistoryRequestFence } from '../../src/shared/hooks/historyRequestFence';
import { getFinancialDraftOwner } from '../../storage/financialDrafts';
jest.mock('../../storage/financialDrafts', () => ({
  getFinancialDraftOwner: jest.fn(),
}));
const getOwner = jest.mocked(getFinancialDraftOwner);
const owner = { incarnation: 'A', sessionId: 'session', generation: 1 };
beforeEach(() => getOwner.mockReturnValue(owner));
it('rejects superseded requests and late focus callbacks', () => {
  const fence = createHistoryRequestFence();
  fence.focus();
  const first = fence.start();
  const latest = fence.start();
  expect(fence.current(first)).toBe(false);
  expect(fence.current(latest)).toBe(true);
  fence.blur();
  expect(fence.current(latest)).toBe(false);
  fence.focus();
  expect(fence.current(latest)).toBe(false);
});
it.each([
  null,
  { ...owner, incarnation: 'B' },
  { ...owner, sessionId: 'other' },
  { ...owner, generation: 2 },
])('rejects changed or suspended authority %j', (next) => {
  const fence = createHistoryRequestFence();
  fence.focus();
  const request = fence.start();
  getOwner.mockReturnValue(next);
  expect(fence.current(request)).toBe(false);
});
it('preserves an owner on token refresh but invalidates synchronously on filter intent', () => {
  const fence = createHistoryRequestFence();
  fence.focus();
  const request = fence.start();
  getOwner.mockReturnValue({ ...owner });
  expect(fence.current(request)).toBe(true);
  fence.invalidate();
  expect(fence.current(request)).toBe(false);
});
