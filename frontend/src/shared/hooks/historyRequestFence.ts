import {
  getFinancialDraftOwner,
  DraftOwner,
} from '../../../storage/financialDrafts';

type RequestToken = { sequence: number; owner: DraftOwner | null };
export function createHistoryRequestFence() {
  let sequence = 0;
  let focused = false;
  const capture = (): RequestToken => ({
    sequence,
    owner: getFinancialDraftOwner(),
  });
  return {
    focus() {
      focused = true;
    },
    blur() {
      focused = false;
      sequence++;
    },
    invalidate() {
      sequence++;
    },
    start() {
      sequence++;
      return capture();
    },
    capture,
    current(token: RequestToken) {
      const owner = getFinancialDraftOwner();
      return (
        focused &&
        token.sequence === sequence &&
        Boolean(
          owner &&
          token.owner &&
          owner.incarnation === token.owner.incarnation &&
          owner.sessionId === token.owner.sessionId &&
          owner.generation === token.owner.generation,
        )
      );
    },
  };
}
