import {
  getSessionGeneration,
  isLocallySignedOut,
  subscribeAuthState,
} from "./authStorage";
import {
  getSessionAuthority,
  subscribeSessionAuthority,
} from "../src/modules/auth/services/sessionAuthority";

export type DraftOwner = {
  incarnation: string;
  sessionId: string;
  generation: number;
};
export type FinancialDraft<T> = {
  owner: DraftOwner;
  fields: T;
  version: number;
};
const drafts = new Map<string, FinancialDraft<unknown>>();
let version = 0;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const sameOwner = (a: DraftOwner, b: DraftOwner) =>
  a.incarnation === b.incarnation &&
  a.sessionId === b.sessionId &&
  a.generation === b.generation;

export function getFinancialDraftOwner(): DraftOwner | null {
  const snapshot = getSessionAuthority()?.snapshot;
  if (
    isLocallySignedOut() ||
    !snapshot?.incarnation ||
    !snapshot.sessionId ||
    snapshot.generation !== getSessionGeneration()
  )
    return null;
  return {
    incarnation: snapshot.incarnation,
    sessionId: snapshot.sessionId,
    generation: snapshot.generation,
  };
}

function reconcile() {
  const owner = getFinancialDraftOwner();
  for (const [key, draft] of drafts) {
    if (
      isLocallySignedOut() ||
      draft.owner.generation !== getSessionGeneration() ||
      (owner && !sameOwner(owner, draft.owner))
    )
      drafts.delete(key);
  }
  return owner;
}
subscribeAuthState(reconcile);
subscribeSessionAuthority(reconcile);

export function readFinancialDraft<T>(key: string): FinancialDraft<T> | null {
  const owner = reconcile();
  const draft = drafts.get(key);
  return owner && draft && sameOwner(owner, draft.owner)
    ? clone(draft as FinancialDraft<T>)
    : null;
}

export function writeFinancialDraft<T>(
  key: string,
  owner: DraftOwner,
  fields: T,
): FinancialDraft<T> | null {
  const current = reconcile();
  if (!current || !sameOwner(current, owner)) return null;
  const draft = {
    owner: { ...owner },
    fields: clone(fields),
    version: ++version,
  };
  drafts.set(key, draft);
  return clone(draft);
}

export function clearFinancialDraft(
  key: string,
  owner: DraftOwner,
  expectedVersion: number,
) {
  const current = reconcile();
  const draft = drafts.get(key);
  if (
    current &&
    sameOwner(current, owner) &&
    draft?.version === expectedVersion &&
    sameOwner(draft.owner, owner)
  )
    drafts.delete(key);
}
